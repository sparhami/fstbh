if (typeof com == "undefined") {
    var com = {};
}

com.sppad = com.sppad || {};
com.sppad.fstbh = com.sppad.fstbh || {};

com.sppad.fstbh.BottomBoxHandler = new function() {
    
    const MILLISECONDS_PER_SECOND = 1000;
        
    let self = this;
    self.opened = false;
    self.enabled = false;
    
    // Used for determining whether to show are not
    self.hovering = false;
    self.findbarActive = false;
    self.popupTarget = null;
    
    this.enable = function() {
        if(self.enabled)
            return;
        
        let toggler = document.getElementById('com_sppad_fstbh_bottom_toggler');
        let bottomBox = document.getElementById('browser-bottombox');
        let mainWindow = document.getElementById('main-window');
        
        // Tracking mouse going out the bottom
        mainWindow.addEventListener('mouseleave', self.mouseleave, false);
        
        // For showing when mousing or dragging
        toggler.addEventListener('dragenter', self.mouseenter, false);
        toggler.addEventListener('mouseenter', self.mouseenter, false);
        bottomBox.addEventListener('dragenter', self.mouseenter, false);
        bottomBox.addEventListener('mouseenter', self.mouseenter, false);
        
        // For showing when FindToolbar is toggled
        self.findbarObserver.observe(gFindBar, { attributes: true });
        
        self.hovering = false;
        self.popupTarget = null;
        self.updateOpenedStatus();
        
        self.setHiddenStyle();
        self.enabled = true;
    };
    
    this.disable = function() {
        if(!self.enabled)
            return;
        
        let toggler = document.getElementById('com_sppad_fstbh_bottom_toggler');
        let bottomBox = document.getElementById('browser-bottombox');
        let mainWindow = document.getElementById('main-window');
        
        // Tracking mouse going out the bottom
        mainWindow.removeEventListener('mouseleave', self.mouseleave);
        
        // For showing when mousing or dragging
        toggler.removeEventListener('dragenter', self.mouseenter);
        toggler.removeEventListener('mouseenter', self.mouseenter);
        bottomBox.removeEventListener('dragenter', self.mouseenter);
        bottomBox.removeEventListener('mouseenter', self.mouseenter);
        
        // For showing when FindToolbar is toggled
        self.findbarObserver.disconnect();
        
        self.hovering = false;
        self.popupTarget = null;
        self.updateOpenedStatus();
        
        self.enabled = false;
    };
    
    /**
     * Observe attribute changes on FindToolbar for showing when the find bar
     * is active.
     */
    this.findbarObserver = new MutationObserver(function(mutations) {
        mutations.forEach(function(mutation) {
            if(mutation.attributeName == 'hidden') {
                self.findbarActive = !mutation.target.getAttribute('hidden');
                self.updateOpenedStatus();
            }
        });   
    });
    
    this.popupshown = function(aEvent) {
        let targetName = aEvent.target.localName;
        if(targetName == "tooltip" || targetName == "window")
            return;
        
        // Sub-popup, ignore it since original is still open
        if(self.popupTarget)
            return;
        
        self.popupTarget = aEvent.originalTarget;
        self.updateOpenedStatus();
    };
    
    this.popuphidden = function(aEvent) {
        let targetName = aEvent.target.localName;
        if(targetName == "tooltip" || targetName == "window")
            return;
        
        // Check if sub-popup is closing and ignore it if it is
        if(self.popupTarget != aEvent.originalTarget)
            return;
        
        self.popupTarget = null;
        self.updateOpenedStatus();
    };
    
    this.mouseleave = function(aEvent) {
        if(self.hovering)
            return;
        
        let y = aEvent.screenY;
        let tripPoint = aEvent.target.boxObject.screenY + aEvent.target.boxObject.height;
        
        if(y >= tripPoint) {
            self.hovering = true;
            self.updateOpenedStatus();
        }
    };
    
    this.mouseenter = function(aEvent) {
        if(self.hovering)
            return;
        
        let toggler = document.getElementById('com_sppad_fstbh_bottom_toggler');
        let bottomBox = document.getElementById('browser-bottombox');
        
        let bottomBoxTop = bottomBox.boxObject.screenY; 
        let togglerTop = toggler.boxObject.screenY; 
        
        let y = aEvent.screenY;
        let tripPoint = Math.min(bottomBoxTop, togglerTop);
        
        if(y >= tripPoint) {
            self.hovering = true;
            self.updateOpenedStatus();
        }
    };
 
    /**
     * Checks the to see if the mouse has gone below the bottom of the toolbars
     * and remove hovering if so.
     */
    this.checkMousePosition = function(aEvent) {
        if(!self.hovering)
            return;
        
        let toggler = document.getElementById('com_sppad_fstbh_bottom_toggler');
        let bottomBox = document.getElementById('browser-bottombox');
        
        let bottomBoxTop = bottomBox.boxObject.screenY; 
        let togglerTop = toggler.boxObject.screenY; 
        
        let y = aEvent.screenY;
        let buffer = com.sppad.fstbh.CurrentPrefs['bottomBuffer'];
        let tripPoint = Math.min(bottomBoxTop, togglerTop) - buffer;
        
        if(y < tripPoint) {
            self.hovering = false;
            self.updateOpenedStatus();
        }
    };

    this.updateOpenedStatus = function() {
        if(self.hovering || self.popupTarget || self.findbarActive)
            self.setOpened();
        else
            self.setClosed();
    }
    
    this.setOpened = function() {
        if(self.opened)
            return;
        
        self.opened = true;
        
        let mainWindow = document.getElementById('main-window');
        mainWindow.setAttribute('com_sppad_fstbh_toggle_bottom', 'true');
        
        window.addEventListener('dragover', self.checkMousePosition, false);
        window.addEventListener('mousemove', self.checkMousePosition, false);
        document.addEventListener('popupshown', self.popupshown, false);
        document.addEventListener('popuphidden', self.popuphidden, false);
        
        let transitionDuration = (com.sppad.fstbh.CurrentPrefs['transitionDurationIn'] / MILLISECONDS_PER_SECOND) + 's';
        let bottomBox = document.getElementById('browser-bottombox');
        bottomBox.style.transitionDuration = transitionDuration;
    };
    
    this.setClosed = function() {
        if(!self.opened)
            return;
        
        self.opened = false;
        
        let mainWindow = document.getElementById('main-window');
        mainWindow.removeAttribute('com_sppad_fstbh_toggle_bottom');
        
        window.removeEventListener('dragover', self.checkMousePosition);
        window.removeEventListener('mousemove', self.checkMousePosition);
        document.removeEventListener('popupshown', self.popupshown);
        document.removeEventListener('popuphidden', self.popuphidden);
        
        let transitionDuration = (com.sppad.fstbh.CurrentPrefs['transitionDurationOut'] / MILLISECONDS_PER_SECOND) + 's';
        let bottomBox = document.getElementById('browser-bottombox');
        bottomBox.style.transitionDuration = transitionDuration;
        
        self.setHiddenStyle();
    };

    this.setHiddenStyle = function() {
        // TODO
    };
};
