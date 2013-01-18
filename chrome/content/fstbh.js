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
        if(self.applied)
            self.setupTheme();
    };
    
    this.setupTheme = function() {
        let mainWindow = document.getElementById('main-window');
        
        gNavToolbox.style.color = mainWindow.style.backgroundImage;
        gNavToolbox.style.backgroundColor = mainWindow.style.backgroundColor;
        gNavToolbox.style.backgroundImage = mainWindow.style.backgroundImage;
    };
    
    
    this.clearTheme = function() {
        gNavToolbox.style.color = '';
        gNavToolbox.style.backgroundColor = '';
        gNavToolbox.style.backgroundImage = '';
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
        let wrapper = document.getElementById('com_sppad_fstbh_topChromeWrapper');
        
        // save these, need to add them back
        let palette = gNavToolbox.palette;
        let toolbarset = gNavToolbox.toolbarset;
        let customToolbarCount = gNavToolbox.customToolbarCount;
        let externalToolbars = gNavToolbox.externalToolbars;
        
        // do the move
        wrapper.appendChild(gNavToolbox);
        
        /*
         * Need to set back the fields from the navigator-toolbox, since they
         * don't appear to stay when moving the node.
         */
        gNavToolbox.palette = palette;
        gNavToolbox.toolbarset = toolbarset;
        gNavToolbox.customToolbarCount = customToolbarCount;
        gNavToolbox.externalToolbars = externalToolbars;
    };
    
    /**
     * This only applies to Windows.
     * <p>
     * When tranistioning from non-maximized mode to maximized-mode with hover
     * set, the calculation for margin-bottom of #titlebar doesn't work
     * correctly. Instead of being -23px or something like that, it ends up as
     * being something like positive 40-60px.
     * <p>
     * The browser code will calculate it sometime after this function, so we
     * can't set style.marginTop on the titlebar since it will be overwritten.
     * Instead use a CSS rule to apply the correct value.
     * <p>
     * Forcing it to zero via CSS and setting a negative margin-top on the
     * wrapper style does not work correctly in all situations.
     */
    this.windowsTitlebarWorkaround = function(apply) {
        let titlebar = document.getElementById('titlebar');
        
        // No #titlebar DOM node = nothing to do.
        if(!titlebar)
            return;
        
        let offset = apply ? titlebar.boxObject.screenY + titlebar.boxObject.height : 0;
        titlebar.setAttribute('com_sppad_fstbh_workaround', offset);
    };
    
    this.updateAppliedStatus = function() {

        let sizemode = window.windowState;
        let fullscreen = sizemode == window.STATE_FULLSCREEN ;
        let maximized = sizemode == window.STATE_MAXIMIZED;
        let applyInMaximized = com.sppad.fstbh.CurrentPrefs['maximizedMode'] == 'hover';

        self.applied = fullscreen || (maximized && applyInMaximized);
        
        self.windowsTitlebarWorkaround(maximized && applyInMaximized);
        self.applyAttribute('main-window', 'applied', self.applied);
        
        let showTabsContextItem = document.getElementById('com_sppad_fstbh_tcm_showTabsContextIem');
        showTabsContextItem.setAttribute('disabled', !applyInMaximized);
        
        self.ShowNavBoxHandler.cleanup();
        
        if(self.applied) {
            self.setupTheme();
            self.offsetBrowser();
            self.ShowNavBoxHandler.setup();
        } else {
            self.clearTheme();
        }
    };
    
    /**
     * Handles showing nav box due to mouse or focus events in maximized mode.
     * 
     * This handles:
     * <ul>
     * <li>Showing when going above the top of the browser</li>
     * <li>Staying open when a context menu or other popup is open</li>
     * <li>Showing on input field (such as nav-bar or search bar) focus</li>
     * </ul>
     */
    this.ShowNavBoxHandler = new function() {
            
        let self = this;   
        self.opened = false;
            
        this.setup = function() {
            let mainWindow = document.getElementById('main-window');
            let wrapper = document.getElementById('com_sppad_fstbh_topChromeWrapper');
            
            document.addEventListener("keypress", self.keyevent, false);
            mainWindow.addEventListener('mouseleave', self.mouseleaveWindow, false);
            wrapper.addEventListener('mouseenter', self.mouseenter, false);
            wrapper.addEventListener('focus', self.checkfocus, true);
            wrapper.addEventListener('blur', self.checkfocus, true);
            
            self.setClosed();
        };
        
        this.cleanup = function() {
            let mainWindow = document.getElementById('main-window');
            let wrapper = document.getElementById('com_sppad_fstbh_topChromeWrapper');
            
            document.removeEventListener("keypress", self.keyevent);
            mainWindow.removeEventListener('mouseleave', self.mouseleaveWindow);
            wrapper.removeEventListener('mouseenter', self.mouseenter);
            wrapper.removeEventListener('focus', self.checkfocus);
            wrapper.removeEventListener('blur', self.checkfocus);
            
            self.setClosed();
        };
        
        /**
         * Handle escape: set focus to false to hide nav-bar and others and also
         * clear the focus from the focused item.
         */
        this.keyevent = function(event) {
            if(self.focused && (event.keyCode == event.DOM_VK_ESCAPE))
                document.commandDispatcher.focusedElement = null;
        };
        
        /**
         * Checks if an item is focused so that we can know if we should display
         * or not on that basis.
         */
        this.checkfocus = function(event) {
          let cd = document.commandDispatcher;
          let inputFocused = cd.focusedElement &&
              cd.focusedElement.ownerDocument == document &&
              cd.focusedElement.localName == "input";
          
          self.setfocus(inputFocused == true);
        };
        
        /**
         * Sets the focused state, causing the navigator toolbox to show via CSS
         * rule.
         */
        this.setfocus = function(focus) {
            let wrapper = document.getElementById('com_sppad_fstbh_topChromeWrapper');
           
            if(focus)
                wrapper.setAttribute('inputFocused', 'true');
            else
                wrapper.removeAttribute('inputFocused');
            
            self.focused = focus;
            self.setTopOffset();
        };
            
        this.mouseenter = function() {
            self.setOpened();
        };
     
        this.popupshown = function() {
            self.popupOpen = true;
        };
        
        this.popuphidden = function(event) {
            self.popupOpen = false;
            
            // If we're open, re-evaluate if we should be open or not
            if(!self.opened)
                return;
                
            let tripPoint = gNavToolbox.boxObject.screenY + gNavToolbox.boxObject.height; 
            if(self.lastY && (self.lastY > tripPoint))
                self.setClosed();
        };
        
        /**
         * Tracks if the mouse goes out the top of the window to stay showing.
         * This is in case the mouse is moved too fast and an enter event never
         * fires.
         */
        this.mouseleaveWindow = function(event) {
            let y = event.screenY;
            
            // Only show if going out of the top
            let mainWindow = document.getElementById('main-window');
            let tripPoint = mainWindow.boxObject.screenY; 
            if(y < tripPoint)
                self.setOpened();
        };
        
        /**
         * Checks the mouse position to see if the toolbars should be hidden.
         */
        this.checkMousePosition = function(event) {
            self.lastY = event.screenY;
            
            // Popup is open, don't close
            if(self.popupOpen)
                return;
            
            let tripPoint = gNavToolbox.boxObject.screenY + gNavToolbox.boxObject.height; 
            if(self.lastY > tripPoint)
                self.setClosed();
        };
        
        /*
         * Causes the navigator toolbox to show by setting the toggle attribute.
         * Also sets up listeners to stay open on context menu to stay open and
         * mouse move for eventually closing.
         */
        this.setOpened = function() {
            if(self.opened)
                return;
            
            self.opened = true;
            
            let wrapper = document.getElementById('com_sppad_fstbh_topChromeWrapper');
            let mainWindow = document.getElementById('main-window');
            
            wrapper.setAttribute('toggle', 'true');
            
            mainWindow.addEventListener('mousemove', self.checkMousePosition, false);
            document.addEventListener('popupshown', self.popupshown, false);
            document.addEventListener('popuphidden', self.popuphidden, false);
        };
        
        /**
         * Causes the navigator toolbox to close by removing the toggle
         * attribute. Can still be showing if the inputFocused attribute is set
         * though.
         * 
         * Also re-calculates the top offset in case the size has changed.
         */
        this.setClosed = function() {
            self.opened = false;
            
            /*
             * If closing via context menu option, popuphidden listener will be
             * removed before the event fires and this will never be set
             * otherwise.
             */
            self.popupOpen = false;
            
            let wrapper = document.getElementById('com_sppad_fstbh_topChromeWrapper');
            let mainWindow = document.getElementById('main-window');
            
            wrapper.removeAttribute('toggle');
       
            mainWindow.removeEventListener('mousemove', self.checkMousePosition);
            document.removeEventListener('popupshown', self.popupshown);
            document.removeEventListener('popuphidden', self.popuphidden);
            
            self.setTopOffset();
        };
        
        this.setTopOffset = function() {
            gNavToolbox.style.marginTop = -(gNavToolbox.getBoundingClientRect().height - 1) + "px";
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
        
        let contextItems = ['com_sppad_fstbh_tcm_showTabsContextIem', 'com_sppad_fstbh_fullscreenTabs'];
        contextItems.forEach(function(id) {
            if(value == 'always')
                document.getElementById(id).setAttribute('checked', 'true');
            else
                document.getElementById(id).removeAttribute('checked');
        });
        
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
        
        self.updateAppliedStatus();
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