if (typeof com == "undefined") {
    var com = {};
}

com.sppad = com.sppad || {};
com.sppad.fstbh = com.sppad.fstbh || {};

com.sppad.fstbh.Main = new function() {

    const MILLISECONDS_PER_SECOND = 1000;
    
    let self = this;
    
    self.tabCount = 0;
    self.evaluateTimer = null;
    
    this.handleEvent = function(aEvent) {

        switch (aEvent.type) {
            case com.sppad.fstbh.Preferences.EVENT_PREFERENCE_CHANGED:
                this.prefChanged(aEvent.name, aEvent.value);
                break;
            case 'TabClose':
                this.updateTabCount(true);
                this.evalutateTitleChangeState();
                break;
            case 'TabOpen':
                this.updateTabCount();
                break;
            case 'TabSelect':
            case 'TabAttrModified':
            case 'TabPinned':
            case 'TabUnpinned':
                this.evalutateTitleChangeState();
                break;
            default:
                break;
        }
        
    };

    this.prefChanged = function(name, value) {
        com.sppad.fstbh.Utils.dump("pref change: " + name + " -> " + value + "\n");

        switch (name) {
            
            case 'transitionDuration':
                this.setTransitionDuration(value);
                break;
            case 'transitionDelay':
                this.setTransitionDelay(value);
                break;
            case 'showWhenTitleChanged':
                this.setTitleChangeBehavior(value);
                this.evalutateTitleChangeState();
                break;
            case 'style.browserBottomBox':
                this.applyAttribute('browser-bottombox', 'backgroundStyle', value);
                break;
            case 'showTabsToolbar':
                this.setShowTabsToolbar(value);
                break;
            case 'showPersonalToolbar':
                this.setShowPersonalToolbar(value);
                break;
            case 'maximizedMode':
                this.setMaximizedMode(value);
                break;
            default:
                break;
        }
    };
    
    /*
     * Used for listening to persona change events.
     * 
     * TODO - No guarantee that we are the last to get this event. Currently
     * relying on the fact that the LightweightThemeConsumer goes first and
     * applies the appropriate style to the window. Tried creating my own
     * LightweightThemeConsumer to update navigator-toolbox instead, but that
     * broke the browser's.
     */
    this.observe = function (aSubject, aTopic, aData) {
        if (aTopic != "lightweight-theme-styling-update")
          return;

        // Only want to apply when the addon is applied
        if(applied)
            this.setupPersona();
    };
    
    /**
     * Applies an attribute to a DOM node, prefixed with com_sppad_fstbh_ to
     * avoid clashing with other addons.
     * 
     * @param id
     *            The ID of the DOM node to apply the attribute on
     * @param name
     *            The attribute name
     * @param value
     *            The attribute value
     */
    this.applyAttribute = function(id, name, value) {
        document.getElementById(id).setAttribute("com_sppad_fstbh_" + name, value);
    };
    
    /**
     * Move the navigator-toolbox to be inside our wrapper. Want to wrap it so
     * that we can make it appear at the top of the window when the parent is
     * set to stack.
     */
    this.moveNavigatorToolbox = function() {
        let nav = document.getElementById('navigator-toolbox');
        let wrapper = document.getElementById('com_sppad_fstbh_topChromeWrapper');
        
        // save these, need to add them back
        let palette = nav.palette;
        let toolbarset = nav.toolbarset;
        let customToolbarCount = nav.customToolbarCount;
        let externalToolbars = nav.externalToolbars;
        
        // do the move
        wrapper.appendChild(nav);
        
        /*
         * Need to set back the fields from the navigator-toolbox, since they
         * don't appear to stay when moving the node.
         */
        nav.palette = palette;
        nav.toolbarset = toolbarset;
        nav.customToolbarCount = customToolbarCount;
        nav.externalToolbars = externalToolbars;
    };
    
    this.updateAppliedStatus = function() {
        
        let sizemode = window.windowState;
        let fullscreen = sizemode == window.STATE_FULLSCREEN ;
        let maximized = sizemode == window.STATE_MAXIMIZED;
        let applyInMaximized = com.sppad.fstbh.CurrentPrefs['maximizedMode'] == 'hover';

        let applied = fullscreen || (maximized && applyInMaximized);
        this.applyAttribute('main-window', 'applied', applied);
        
        let showTabsContextItem = document.getElementById('com_sppad_fstbh_tcm_showTabsContextIem');
        let mainWindow = document.getElementById('main-window');
        let navToolbox = document.getElementById('navigator-toolbox');
        let wrapper = document.getElementById('com_sppad_fstbh_topChromeWrapper');
        
        showTabsContextItem.setAttribute('disabled', !applyInMaximized);
        
        if(applied) {
            navToolbox.style.color = mainWindow.style.backgroundImage;
            navToolbox.style.backgroundColor = mainWindow.style.backgroundColor;
            navToolbox.style.backgroundImage = mainWindow.style.backgroundImage;
            
            this.offsetBrowser();
        } else {
            navToolbox.style.color = '';
            navToolbox.style.backgroundColor = '';
            navToolbox.style.backgroundImage = '';
        }
        
        // Stomp over Firefox's implementation as it doesn't work correctly when
        // tabs are set to always show.
        // if(maximized && applyInMaximized)
        if(applied)
            this.ShowNavBoxHandler.setup();
        else
            this.ShowNavBoxHandler.cleanup();
    };
    
    /**
     * Need to handle mouse over in non-fullscreen. Cannot just use hover
     * because 1. want to support going above the top of the screen and keeping
     * menu open and 2. want to stay open on context menu.
     */
    this.ShowNavBoxHandler = new function() {
            
        let self = this;    
            
        this.setup = function() {
            // browser.fullscreen.animateUp = 0 // or 1
            
            let mainWindow = document.getElementById('main-window');
            let wrapper = document.getElementById('com_sppad_fstbh_topChromeWrapper');
            
            mainWindow.addEventListener('mouseleave', self.mouseleaveWindow, false);
            wrapper.addEventListener('mouseenter', self.mouseenter, false);
        };
        
        this.cleanup = function() {
            let mainWindow = document.getElementById('main-window');
            let wrapper = document.getElementById('com_sppad_fstbh_topChromeWrapper');
            
            wrapper.removeAttribute('toggle');
            
            mainWindow.removeEventListener('mousemove', self.mousemove);
            mainWindow.removeEventListener('mouseleave', self.mouseleaveWindow);
            wrapper.removeEventListener('mouseenter', self.mouseenter);
            wrapper.removeEventListener('popupshowing', self.popupshowing);
            wrapper.removeEventListener('popuphiding', self.popuphiding);
        };
            
        this.mouseenter = function() {
            self.forceOpen();
        };
     
        this.popupshowing = function() {
            self.popupOpen = true;
        };
        
        this.popuphiding = function() {
            self.popupOpen = false;
            
            // If we're not open, nothing to do
            let wrapper = document.getElementById('com_sppad_fstbh_topChromeWrapper');
            if(!wrapper.hasAttribute('toggle'))
                return;
            
            // We're open, check if we are far enough down that we need to close
            let navToolbox = document.getElementById('navigator-toolbox');
            
            let y = self.lastY;
            let tripPoint = navToolbox.boxObject.screenY + navToolbox.boxObject.height; 
                
            if(y > tripPoint)
                self.forceClose();
        };
        
        this.mouseleaveWindow = function(mouseEvent) {
            let y = mouseEvent.screenY;
            
            let mainWindow = document.getElementById('main-window');
            let tripPoint = mainWindow.boxObject.screenY; 
          
            if(y < tripPoint)
                self.forceOpen();
        };
        
        this.mousemove = function(mouseEvent) {
            let y = mouseEvent.screenY;
            
            // Save for if/when the popup closes in case we aren't over the nav
            // box
            self.lastY = y;
            // Popup is open, don't close
            if(self.popupOpen)
                return;
            
            let navToolbox = document.getElementById('navigator-toolbox');
            let tripPoint = navToolbox.boxObject.screenY + navToolbox.boxObject.height; 
            
            if(y > tripPoint)
                self.forceClose();
        };
        
        this.forceOpen = function() {
            let wrapper = document.getElementById('com_sppad_fstbh_topChromeWrapper');
            let mainWindow = document.getElementById('main-window');
            let navToolbox = document.getElementById('navigator-toolbox');
            
            wrapper.setAttribute('toggle', 'true');
            
            mainWindow.removeEventListener('mousemove', self.mousemove);
            mainWindow.addEventListener('mousemove', self.mousemove, false);
            document.addEventListener('popupshowing', self.popupshowing, false);
            document.addEventListener('popuphiding', self.popuphiding, false);
        };
        
        this.forceClose = function() {
            let wrapper = document.getElementById('com_sppad_fstbh_topChromeWrapper');
            let mainWindow = document.getElementById('main-window');
            let navToolbox = document.getElementById('navigator-toolbox');
            
            wrapper.removeAttribute('toggle');
            navToolbox.style.marginTop = -(navToolbox.getBoundingClientRect().height - 1) + "px";
            
            mainWindow.removeEventListener('mousemove', self.mousemove);
            document.removeEventListener('popupshowing', self.popupshowing);
            document.removeEventListener('popuphiding', self.popuphiding);
        };
    };
    
  
    /**
     * Counts the number of tabs with a title change event. Used for showing the
     * navigator toolbox in fullscreen mode when there is a pending
     * notification.
     */
    this.evalutateTitleChangeState = function() {
        
        // Not doing anything on title change, so no need to evaluate the state
        // of the tabs
        if(com.sppad.fstbh.CurrentPrefs['showWhenTitleChanged'] == "never")
            return;
        
        
        window.clearTimeout(self.evaluateTimer);
        
        // Delay so that tab attributes will have been set
        self.evaluateTimer = window.setTimeout(function() {
            let container = gBrowser.tabContainer;
            let titleChangedCount = 0;
            let pinnedTitleChangedCount = 0;
            
            for(let i = 0; i < container.itemCount; i++) {
                let tab = container.getItemAtIndex(i);
                let pinned = tab.hasAttribute('pinned');
                let titlechanged = tab.hasAttribute('titlechanged');
                
                if(titlechanged)
                    titleChangedCount++;
                if(titlechanged && pinned)
                    pinnedTitleChangedCount++;
            }
            
            let node = document.getElementById('com_sppad_fstbh_topChromeWrapper');
            node.setAttribute("titlechange", titleChangedCount > 0);
            node.setAttribute("pinnedTitlechange", pinnedTitleChangedCount > 0);
        }, 10);
    };
    
    this.updateTabCount = function(offset) {
        self.tabCount = gBrowser.tabContainer.itemCount + (offset ? -1 : 0);
        this.applyAttribute('browser-panel', 'tabCount', self.tabCount);
        
        this.offsetBrowser();
    };
    
    /**
     * Sets the behavior for title change by applying an attribute used by CSS.
     * 
     * @param mode
     *            The attribute value to apply for titleChangeBehavior
     */
    this.setTitleChangeBehavior = function(mode) {
        let node = document.getElementById('com_sppad_fstbh_topChromeWrapper');
        node.setAttribute("titleChangeBehavior", mode);
    };
    
    /**
     * Sets the transition duration, or how long the slide-out animation takes
     * to complete.
     * 
     * @param value
     *            The amount of time, in milliseconds.
     */
    this.setTransitionDuration = function(value) {
        let transitionDuration = (value / MILLISECONDS_PER_SECOND) + 's';
        
        let nav = document.getElementById('navigator-toolbox');
        nav.style.transitionDuration = transitionDuration;
    };
    
    /**
     * Sets the transition duration, or how long to wait before starting the
     * slide-out animation. TODO - want this to only apply to slide-out and not
     * slide in, then expose it via preferences.
     * 
     * @param value
     *            The amount of time, in milliseconds.
     */
    this.setTransitionDelay = function(value) {
        let transitionDelay = (value / MILLISECONDS_PER_SECOND) + 's';
        
        let nav = document.getElementById('navigator-toolbox');
        nav.style.transitionDelay = transitionDelay;
    };

    /**
     * Sets the showTabsToolbar mode.
     * 
     * @param value
     *            The mode for showTabsToolbar
     */
    this.setShowTabsToolbar = function(value) {
        let node = document.getElementById('com_sppad_fstbh_topChromeWrapper');
        node.setAttribute("showTabsToolbar", value);
        
        let menuitem = document.getElementById('com_sppad_fstbh_fullscreenTabs');
        if(value == 'always')
            menuitem.setAttribute('checked', 'true');
        else
            menuitem.removeAttribute('checked');
        
        this.offsetBrowser();
    };
    
    
    /**
     * Sets the showPersonalToolbar mode.
     * 
     * @param value
     *            The mode for showPersonalToolbar
     */
    this.setShowPersonalToolbar = function(value) {
        let node = document.getElementById('com_sppad_fstbh_topChromeWrapper');
        node.setAttribute("showPersonalToolbar", value);
        
        let menuitem = document.getElementById('com_sppad_fstbh_fullscreenPersonalToolbar');
        if(value == 'hover')
            menuitem.setAttribute('checked', 'true');
        else
            menuitem.removeAttribute('checked');
        
        /*
         * This is to set PersonalToolbar visible in case it is hidden (and has
         * been hidden since application start). If it hasn't been opened yet,
         * then the items will not be displayed and the PersonalToolbar will be
         * blank.
         */
        if(value == 'hover') {
            let toolbar = document.getElementById('PersonalToolbar');
            let hiding = toolbar.getAttribute('collapsed') == 'true';
            
            // Show it and set it back to hiding.
            if(hiding) {
                setToolbarVisibility(toolbar, true);
                setToolbarVisibility(toolbar, false);
            }
        }
    };
    

    this.setMaximizedMode = function(value) {
        
        let menuitem = document.getElementById('com_sppad_fstbh_tcm_maximizedModeContextItem');
        if(value == 'hover')
            menuitem.setAttribute('checked', 'true');
        else
            menuitem.removeAttribute('checked');
        
        this.updateAppliedStatus();
    };
    
    /**
     * Sets the preference for showTabsToolbar based on the context menuitem
     * state.
     */
    this.setFullscreenTabs = function(source) {
        let checked = source.hasAttribute('checked');
        com.sppad.fstbh.Preferences.setPreference('showTabsToolbar', checked ? 'always' : 'hoverOnly');
    };
    
    /**
     * Sets the preference for showPersonalToolbar based on the context menuitem
     * state.
     */
    this.setFullscreenPersonalToolbar = function(source) {
        let checked = source.hasAttribute('checked');
        com.sppad.fstbh.Preferences.setPreference('showPersonalToolbar', checked ? 'hover' : 'never');
    };
    
    /**
     * Sets maximized mode.
     */
    this.setAlmostFullscreen = function(source) {
        let checked = source.hasAttribute('checked');
        com.sppad.fstbh.Preferences.setPreference('maximizedMode', checked ? 'hover' : 'normal');
    };
    
    
    /**
     * Offsets / un-offsets the browser by setting a top margin. This is done so
     * that we can stay as display stack and always show TabsToolbar without
     * covering page content. This is used when the showTabsToolbar is set to
     * always or multipleTabs.
     */
    this.offsetBrowser = function() {
        let browser = document.getElementById('browser');
        let tabsToolbar = document.getElementById('TabsToolbar');
        
        let offset = tabsToolbar.boxObject.height;
        let mode = com.sppad.fstbh.CurrentPrefs['showTabsToolbar'];
        
        if(mode == "always" || (mode == "multipleTabs" && self.tabCount > 1)) {
            browser.style.marginTop = offset + "px";
        } else {
            browser.style.marginTop = "";
        }
    };
    
    this.loadPreferences = function() {
        this.prefChanged('transitionDelay', com.sppad.fstbh.CurrentPrefs['transitionDelay']);
        this.prefChanged('transitionDuration', com.sppad.fstbh.CurrentPrefs['transitionDuration']);
        this.prefChanged('showWhenTitleChanged', com.sppad.fstbh.CurrentPrefs['showWhenTitleChanged']);
        this.prefChanged('style.browserBottomBox', com.sppad.fstbh.CurrentPrefs['style.browserBottomBox']);
        this.prefChanged('showTabsToolbar', com.sppad.fstbh.CurrentPrefs['showTabsToolbar']);
        this.prefChanged('showPersonalToolbar', com.sppad.fstbh.CurrentPrefs['showPersonalToolbar']);
        this.prefChanged('maximizedMode', com.sppad.fstbh.CurrentPrefs['maximizedMode']);
    };
    
    this.setup = function() {
        com.sppad.fstbh.Preferences.addListener(this);
        
        let container = window.gBrowser.tabContainer;
        container.addEventListener("TabSelect", this, false);
        container.addEventListener("TabClose", this, false);
        container.addEventListener("TabOpen", this, false);
        container.addEventListener("TabAttrModified", this, false);
        container.addEventListener("TabPinned", this, false);
        container.addEventListener("TabUnpinned", this, false);
        
        Components.classes["@mozilla.org/observer-service;1"]
            .getService(Components.interfaces.nsIObserverService)
            .addObserver(this, "lightweight-theme-styling-update", false);
        
        this.loadPreferences();
        this.moveNavigatorToolbox();
        this.updateTabCount();
    };
    
    this.cleanup = function() {
        
        Components.classes["@mozilla.org/observer-service;1"]
            .getService(Components.interfaces.nsIObserverService)
            .removeObserver(this, "lightweight-theme-styling-update");

        let container = window.gBrowser.tabContainer;
        container.removeEventListener("TabSelect", this);
        container.removeEventListener("TabClose", this);
        container.removeEventListener("TabOpen", this);
        container.removeEventListener("TabAttrModified", this);
        container.removeEventListener("TabPinned", this);
        container.removeEventListener("TabUnpinned", this);
        
        com.sppad.fstbh.Preferences.removeListener(this);
    };

};

window.addEventListener("load", function() {
    com.sppad.fstbh.Main.setup();
}, false);

window.addEventListener("unload", function() {
    com.sppad.fstbh.Main.cleanup();
    com.sppad.fstbh.Preferences.cleanup();
}, false);

window.addEventListener("sizemodechange", function () {
    com.sppad.fstbh.Main.updateAppliedStatus();
}, false);