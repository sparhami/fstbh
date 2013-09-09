com.sppad.fstbh.BottomBoxHandler = new function() {
    
    const MILLISECONDS_PER_SECOND = 1000;
        
    let self = this;
    self.prefs = com.sppad.fstbh.CurrentPrefs;
    
    self.opened = false;
    self.enabled = false;
    
    // Used for determining whether to show are not
    self.hovering = false;
    self.findbarActive = false;
    self.popupTarget = null;
    
    self.enable = function() {
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
        self.findbarActive = false;
        self.popupTarget = null;
        self.setHiddenStyle();
        
        self.enabled = true;
    };
    
    self.disable = function() {
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
        
        self.setShowingStyle();
        
        self.enabled = false;
    };
    
    /**
     * Observe attribute changes on FindToolbar for showing when the find bar
     * is active.
     */
    self.findbarObserver = new MutationObserver(function(mutations) {
        mutations.forEach(function(mutation) {
            if(mutation.attributeName == 'hidden') {
                self.findbarActive = !mutation.target.getAttribute('hidden');
                self.updateOpenedStatus();
            }
        });   
    });
    
    self.popupshown = function(aEvent) {
        let targetName = aEvent.target.localName;
        if(targetName == "tooltip" || targetName == "window")
            return;
        
        // Sub-popup, ignore it since original is still open
        if(self.popupTarget)
            return;
        
        self.popupTarget = aEvent.originalTarget;
        self.updateOpenedStatus();
    };
    
    self.popuphidden = function(aEvent) {
    	// Don't check originalTarget, doing it that way has been unreliable
    	if(self.popupTarget && self.popupTarget.state == "open")
    		return;
        
        self.popupTarget = null;
        self.updateOpenedStatus();
    };
    
    self.mouseleave = function(aEvent) {
        if(self.hovering)
            return;
        
        let y = aEvent.screenY;
        let tripPoint = aEvent.target.boxObject.screenY + aEvent.target.boxObject.height;
        
        if(y >= tripPoint) {
            self.hovering = true;
            self.updateOpenedStatus();
        }
    };
    
    self.mouseenter = function(aEvent) {
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
    self.checkMousePosition = function(aEvent) {
        if(!self.hovering)
            return;
        
        let toggler = document.getElementById('com_sppad_fstbh_bottom_toggler');
        let bottomBox = document.getElementById('browser-bottombox');
        
        let bottomBoxTop = bottomBox.boxObject.screenY; 
        let togglerTop = toggler.boxObject.screenY; 
        
        let y = aEvent.screenY;
        let buffer = self.prefs['bottomBuffer'];
        let tripPoint = Math.min(bottomBoxTop, togglerTop) - buffer;
        
        if(y < tripPoint) {
            self.hovering = false;
            self.updateOpenedStatus();
        }
    };

    self.updateOpenedStatus = function() {
        if(self.hovering || self.popupTarget || self.findbarActive)
            self.setOpened();
        else
            self.setClosed();
    }
    
    self.setOpened = function() {
        if(self.opened)
            return;
        
        self.opened = true;
        
        window.addEventListener('dragover', self.checkMousePosition, false);
        window.addEventListener('mousemove', self.checkMousePosition, false);
        document.addEventListener('popupshown', self.popupshown, false);
        document.addEventListener('popuphidden', self.popuphidden, false);
        
        let transitionDuration = self.prefs['transitionDurationIn'] + 'ms';
        let bottomBox = document.getElementById('browser-bottombox');
        bottomBox.style.transitionDuration = transitionDuration;
        
        self.setShowingStyle();
    };
    
    self.setClosed = function() {
        if(!self.opened || !self.enabled)
            return;
        
        self.opened = false;
        
        window.removeEventListener('dragover', self.checkMousePosition);
        window.removeEventListener('mousemove', self.checkMousePosition);
        document.removeEventListener('popupshown', self.popupshown);
        document.removeEventListener('popuphidden', self.popuphidden);
        
        let transitionDuration = self.prefs['transitionDurationOut'] + 'ms';
        let bottomBox = document.getElementById('browser-bottombox');
        bottomBox.style.transitionDuration = transitionDuration;
        
        self.setHiddenStyle();
    };
    
    self.setHiddenStyle = function() {
        let mainWindow = document.getElementById('main-window');
        mainWindow.removeAttributeNS(com.sppad.fstbh.xmlns, 'toggle_bottom');
    };
    
    self.setShowingStyle = function() {
        let mainWindow = document.getElementById('main-window');
        mainWindow.setAttributeNS(com.sppad.fstbh.xmlns, 'toggle_bottom', 'true');
    };
};
