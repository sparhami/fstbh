if (typeof com == "undefined") {
    var com = {};
}

com.sppad = com.sppad || {};
com.sppad.fstbh = com.sppad.fstbh || {};

/**
 * Handles showing #navigator-toolbox due to mouse or focus events when the
 * add-on is applied.
 * 
 * This handles:
 * <ul>
 * <li>Showing when hovering
 * <li>Showing when going above the top of the browser
 * <li>Showing when one of the show events triggers
 * <li>Showing / staying open when a menu is open
 * <li>Showing on input field (such as nav-bar or search bar) focus
 * <li>Showing when the menu bar is activated via keyboard
 * </ul>
 * 
 * This also handles:
 * <ul>
 * <li>Letting the identity box know when to update the site information.
 * </ul>
 */
com.sppad.fstbh.NavBoxHandler = new function() {
    
    const MILLISECONDS_PER_SECOND = 1000;
        
    let self = this;   
    self.enabled = false;
    self.opened = false;
    
    // Used for determining whether to show are not
    self.hovering = false;
    self.focused = false;
    self.menuActive = false;
    self.popupTarget = null;
    self.showEventActive = false;
    
    self.showEventDelayTimer = null;
    self.eventTime = 0;
    
    /** How long to ignore a tab select for after a open or close */
    self.ignoreSelectDelta = 100;
    
    this.enable = function() {
        if(self.enabled)
            return;
        
        let tabContainer = window.gBrowser.tabContainer;
        let toggler = document.getElementById('com_sppad_fstbh_toggler');
        let toolbarMenubar = document.getElementById('toolbar-menubar');
        let mainWindow = document.getElementById('main-window');
        
        // Used for hiding when focused and escape is used
        document.addEventListener("keypress", self.keyevent, false);
        
        // Tracking mouse going out the top
        gBrowser.addEventListener('mouseleave', self.mouseleave, false);
        mainWindow.addEventListener('mouseleave', self.mouseleave, false);
        
        // For showing when mousing or dragging
        toggler.addEventListener('dragenter', self.mouseenter, false);
        toggler.addEventListener('mouseenter', self.mouseenter, false);
        gNavToolbox.addEventListener('dragenter', self.mouseenter, false);
        gNavToolbox.addEventListener('mouseenter', self.mouseenter, false);
        
        // For showing on input field focus
        gNavToolbox.addEventListener('focus', self.checkfocus, true);
        gNavToolbox.addEventListener('blur', self.checkfocus, true);
        
        // For staying showing when a menu is open
        gNavToolbox.addEventListener('popupshown', self.popupshown, false);
        gNavToolbox.addEventListener('popuphidden', self.popuphidden, false);
        
        // For show event preferences
        tabContainer.addEventListener("TabSelect", this, false);
        tabContainer.addEventListener("TabClose", this, false);
        tabContainer.addEventListener("TabOpen", this, false);
        
        // For URL change show event and updating SSL identity box
        gBrowser.addProgressListener(this);
        
        // For showing when toolbar-menubar is toggled
        self.menubarObserver.observe(toolbarMenubar, { attributes: true });
        
        self.hovering = false;
        self.popupTarget = null;
        self.updateOpenedStatus();
        
        self.setHiddenStyle();
        self.enabled = true;
    };
    
    this.disable = function() {
        if(!self.enabled)
            return;
        
        let tabContainer = window.gBrowser.tabContainer;
        let toggler = document.getElementById('com_sppad_fstbh_toggler');
        let mainWindow = document.getElementById('main-window');
        
        // Used for hiding when focused and escape is used
        document.removeEventListener("keypress", self.keyevent);
        
        // Tracking mouse going out the top
        gBrowser.removeEventListener('mouseleave', self.mouseleave);
        mainWindow.removeEventListener('mouseleave', self.mouseleave);
        
        // For showing when mousing or dragging
        toggler.removeEventListener('dragenter', self.mouseenter);
        toggler.removeEventListener('mouseenter', self.mouseenter);
        gNavToolbox.removeEventListener('dragenter', self.mouseenter);
        gNavToolbox.removeEventListener('mouseenter', self.mouseenter);
        
        // For showing on input field focus
        gNavToolbox.removeEventListener('focus', self.checkfocus);
        gNavToolbox.removeEventListener('blur', self.checkfocus);
        
        // For staying showing when a menu is open
        gNavToolbox.removeEventListener('popupshown', self.popupshown);
        gNavToolbox.removeEventListener('popuphidden', self.popuphidden);
        
        // For show event preferences
        tabContainer.removeEventListener("TabSelect", this);
        tabContainer.removeEventListener("TabClose", this);
        tabContainer.removeEventListener("TabOpen", this);
        
        // For URL change show event and updating SSL identity box
        gBrowser.removeProgressListener(this);
        
        // For showing when toolbar-menubar is toggled
        self.menubarObserver.disconnect();
        
        self.hovering = false;
        self.popupTarget = null;
        self.updateOpenedStatus();
        
        self.enabled = false;
    };
    
    this.handleEvent = function(aEvent) {
        let type = aEvent.type;
        let cp = com.sppad.fstbh.CurrentPrefs;
        let now = Date.now();
        let trigger = false;
        
        switch(aEvent.type) {
            case 'TabOpen':
                trigger = cp['showEvents.showOnTabOpen'];
                self.eventTime = now;
                break;
            case 'TabClose':
                trigger = cp['showEvents.showOnTabClose'];
                self.eventTime = now;
                break;
            case 'TabSelect':
                let allowSelect = (now - self.eventTime) > self.ignoreSelectDelta;
                trigger = allowSelect && cp['showEvents.showOnTabSelect'];
                break;
        }
        
        if(trigger)
            self.triggerShowEvent();
    };
    
    // nsIWebProgressListener
    this.QueryInterface = XPCOMUtils.generateQI(['nsIWebProgressListener', 'nsISupportsWeakReference']),
                        
    this.onLocationChange = function(aProgress, aRequest, aURI) {
        if(com.sppad.fstbh.CurrentPrefs['showEvents.showOnLocationChange'])
            self.triggerShowEvent();
    };

    // Nothing to do for these
    this.onStateChange = function() {};
    this.onProgressChange = function() {};
    this.onStatusChange = function() {};
    
    this.onSecurityChange = function(aWebProgress, aRequest, aState) {
        com.sppad.fstbh.Identity.updateState(aState);
    };
    
    // end nsIWebProgressListener
    
    /**
     * Observe attribute changes on toolbar-menubar for showing when the
     * menubar is active, such as when using alt (Windows) or F10.
     */
    this.menubarObserver = new MutationObserver(function(mutations) {
        mutations.forEach(function(mutation) {
            if(mutation.attributeName == 'inactive') {
                self.menuActive = !mutation.target.getAttribute('inactive');
                self.updateOpenedStatus();
            }
        });   
    });
    
    /**
     * Causes the toolbars to show to due to a show event briefly before
     * hiding again.
     */
    this.triggerShowEvent = function() {
        self.showEventActive = true;
        self.updateOpenedStatus();

        window.clearTimeout(self.showEventDelayTimer);
        self.showEventDelayTimer = window.setTimeout(function() {
            self.showEventActive = false;
            self.updateOpenedStatus();
        }, com.sppad.fstbh.CurrentPrefs['showEvents.delay']);
    };
    
    /**
     * Handle escape: clear the focused item, if something is focused, so
     * that the toolbars can hide.
     */
    this.keyevent = function(aEvent) {
        if(self.focused && (aEvent.keyCode == aEvent.DOM_VK_ESCAPE))
            document.commandDispatcher.focusedElement = null;
    };
    
    this.checkfocus = function(aEvent) {
        let fe = document.commandDispatcher.focusedElement;
        
        self.focused = fe && fe.ownerDocument == document && fe.localName == "input";
        self.updateOpenedStatus();
    };
        
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
    
    /**
     * Causes toolbars to show when the mouse is being moved too quickly out
     * the top in order to trigger a mouse enter on the toggler.
     */
    this.mouseleave = function(aEvent) {
        if(self.hovering)
            return;
        
        let y = aEvent.screenY;
        let tripPoint = aEvent.target.boxObject.screenY;
        
        if(y <= tripPoint) {
            self.hovering = true;
            self.updateOpenedStatus();
        }
    };
    
    /**
     * Handles mouse entering either the toggler or navigator-toolbox.
     * <p>
     * Checks if the y location of the mouse to see if it is above the
     * bottom of toggler or navigator-toolbox. This is because a mouseenter
     * event might trigger when entering a popup. For example, if showing
     * when the bookmarks menu has been triggered via keyboard. If mousing
     * over the menu, a mouseenter event is generated. If the menu is
     * closed, then hovering would be still true if we did not check the y
     * coordinate.
     * <p>
     * Can't simply check if the target is a popup, since the user can move
     * from the popup up into the navigator-toolbox without any additional
     * events generated.
     */
    this.mouseenter = function(aEvent) {
        if(self.hovering)
            return;
        
        let toggler = document.getElementById('com_sppad_fstbh_toggler');
        
        let navBottom = gNavToolbox.boxObject.screenY + gNavToolbox.boxObject.height; 
        let togglerBottom = toggler.boxObject.screenY + toggler.boxObject.height; 
        
        let y = aEvent.screenY;
        let tripPoint = Math.max(navBottom, togglerBottom);
        
        if(y <= tripPoint) {
            self.hovering = true;
            self.updateOpenedStatus();
        }
    };
 
    /**
     * Checks the to see if the mouse has gone below the bottom of the
     * toolbars and remove hovering if so.
     */
    this.checkMousePosition = function(aEvent) {
        if(!self.hovering)
            return;
        
        let toggler = document.getElementById('com_sppad_fstbh_toggler');
        
        let navBottom = gNavToolbox.boxObject.screenY + gNavToolbox.boxObject.height; 
        let togglerBottom = toggler.boxObject.screenY + toggler.boxObject.height; 
        
        let y = aEvent.screenY;
        let buffer = com.sppad.fstbh.CurrentPrefs['bottomBuffer'];
        let tripPoint = Math.max(navBottom, togglerBottom) + buffer;
        
        if(y > tripPoint) {
            self.hovering = false;
            self.updateOpenedStatus();
        }
    };

    this.updateOpenedStatus = function() {
        if(self.hovering || self.focused || self.popupTarget || self.showEventActive || self.menuActive)
            self.setOpened();
        else
            self.setClosed();
    }
    
    /**
     * Causes the navigator toolbox to show by setting the toggle attribute.
     * Also sets up listeners to stay open when menus are open and mouse
     * move for eventually closing.
     */
    this.setOpened = function() {
        if(self.opened)
            return;
        
        self.opened = true;
        
        let mainWindow = document.getElementById('main-window');
        mainWindow.setAttribute('com_sppad_fstbh_toggle', 'true');
        
        window.addEventListener('dragover', self.checkMousePosition, false);
        window.addEventListener('mousemove', self.checkMousePosition, false);
        document.addEventListener('popupshown', self.popupshown, false);
        document.addEventListener('popuphidden', self.popuphidden, false);
        
        let transitionDuration = (com.sppad.fstbh.CurrentPrefs['transitionDurationIn'] / MILLISECONDS_PER_SECOND) + 's';
        gNavToolbox.style.transitionDuration = transitionDuration;
    };
    
    /**
     * Causes the navigator toolbox to close by removing the toggle
     * attribute.
     * 
     * Also re-calculates the top offset in case the size of gNavToolbox has
     * changed.
     */
    this.setClosed = function() {
        if(!self.opened)
            return;
        
        self.opened = false;
        
        let mainWindow = document.getElementById('main-window');
        mainWindow.removeAttribute('com_sppad_fstbh_toggle');
        
        window.removeEventListener('dragover', self.checkMousePosition);
        window.removeEventListener('mousemove', self.checkMousePosition);
        document.removeEventListener('popupshown', self.popupshown);
        document.removeEventListener('popuphidden', self.popuphidden);
        
        let transitionDuration = (com.sppad.fstbh.CurrentPrefs['transitionDurationOut'] / MILLISECONDS_PER_SECOND) + 's';
        gNavToolbox.style.transitionDuration = transitionDuration;
        
        self.setHiddenStyle();
    };
    
    /**
     * Sets the style for the navigator toolbox for the hidden state.
     * Showing state is handled by CSS.
     * <p>
     * For height, transition is from auto to 0, so transition properties
     * don't have an effect. Don't use visibility or display since we still
     * want to be able to use shortcut keys for navigation/search boxes.
     */
    this.setHiddenStyle = function() {
        switch(com.sppad.fstbh.CurrentPrefs['transitionProperty']) {
            case 'margin-top':
                gNavToolbox.style.marginTop = -(gNavToolbox.getBoundingClientRect().height) + "px";
                gNavToolbox.style.height = '';
                break;
            case 'height':
            default:
                gNavToolbox.style.marginTop = '0';
                gNavToolbox.style.height = '0';
                break;
        }
    };
};