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
            case 'transitionDelay':
                this.setTransitionDelay(value);
                break;
            case 'transitionProperty':
                this.setTransitionProperty(value);
                this.ShowNavBoxHandler.setHiddenStyle();
                break;
            case 'showWhenTitleChanged':
                this.setTitleChangeBehavior(value);
                this.evalutateTitleChangeState();
                break;
            case 'style.browserBottomBox':
                this.applyAttribute('browser-bottombox', 'backgroundStyle', value);
                break;
            case 'style.topChromeBackground':
                this.applyAttribute('navigator-toolbox', 'backgroundStyle', value);
                break;
            case 'showTabsToolbar':
                this.setShowTabsToolbar(value);
                break;
            case 'showPersonalToolbar':
                this.setShowPersonalToolbar(value);
                break;
            case 'normalMode':
                this.setNormalMode(value);
                break;
            case 'maximizedMode':
                this.setMaximizedMode(value);
                break;
            case 'fullishScreen':
                this.updateAppliedStatus();
                break;
            default:
                break;
        }
    };
    
    /*
     * Used for listening for persona change events and fullscreen autohide
     * preference changes.
     * 
     * TODO - No guarantee that we are the last to get this event. Currently
     * relying on the fact that the LightweightThemeConsumer goes first and
     * applies the appropriate style to the window. Tried creating my own
     * LightweightThemeConsumer to update navigator-toolbox instead, but that
     * broke the browser's.
     */
    this.observe = function (aSubject, aTopic, aData) {
        if(aTopic == 'lightweight-theme-styling-update')
            self.applied && self.setupTheme();
        else if(aTopic == 'nsPref:changed' && aData == 'browser.fullscreen.autohide')
            self.updateAppliedStatus();
    };
    
    this.setupTheme = function() {
        let mainWindow = document.getElementById('main-window');
        let titlebar = document.getElementById('titlebar');
        
        gNavToolbox.style.color = mainWindow.style.backgroundImage;
        gNavToolbox.style.backgroundColor = mainWindow.style.backgroundColor;
        gNavToolbox.style.backgroundImage = mainWindow.style.backgroundImage;
        
        /*
         * For Windows - if applied while window mode is normal (not
         * maximized/fullscreen), titlebar will have part of the persona
         * already. Don't want to repeat the start of the persona, to shift it
         * up to align correctly.
         * 
         * For PersonalTitlebar - don't show window controls when not tabs in
         * title bar by setting separatedTitlebar attribute.
         */
        if(titlebar) {
            let marginBottom = titlebar.style.marginBottom;
            let separatedTitlebar = (marginBottom == '') 
                || (marginBottom && marginBottom.startsWith('0'))
                || (window.windowState === window.STATE_NORMAL);
            
            let topOffset = separatedTitlebar ? -gNavToolbox.boxObject.y : 0;
            gNavToolbox.style.backgroundPosition = '100% ' + topOffset + 'px';
            
            self.applyAttribute('main-window', 'separatedTitlebar', separatedTitlebar);
        }
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
     * Updates the applied status, checking if the add-on should be applied or
     * not. Sets everything up for autohide behavior to take effect.
     * <p>
     * Applies either when in fullscreen and browser's autohide preference is
     * true or maximized and addon's autohide preference is true.
     */
    this.updateAppliedStatus = function() {
        let cp = com.sppad.fstbh.CurrentPrefs;
        
        let sizemode = window.windowState;
        
        let normal = sizemode == window.STATE_NORMAL;
        let maximized = sizemode == window.STATE_MAXIMIZED;
        let fullscreen = sizemode == window.STATE_FULLSCREEN;

        let applyInNormal = cp['normalMode'] == 'hover';
        let applyInMaximized = cp['maximizedMode'] == 'hover';
        let applyInFullscreen = gPrefService.getBoolPref("browser.fullscreen.autohide") == true;
 
        self.applied = (normal && applyInNormal)
                    || (maximized && applyInMaximized)
                    || (fullscreen && applyInFullscreen);
        
        self.applyAttribute('main-window', 'applied', self.applied);
        
        self.windowingTweaks(maximized, applyInMaximized, fullscreen, applyInFullscreen);
    
        /*
         * Always call this to unregister any listeners that are active from
         * applied mode and to prevent double registering of listeners if going
         * from one applied state to another.
         */
        self.ShowNavBoxHandler.cleanup();
        
        if(self.applied) {
            self.setupTheme();
            self.offsetBrowser();
            self.ShowNavBoxHandler.setup();
        } else {
            self.clearTheme();
        }
        
        let showTabsContextItem = document.getElementById('com_sppad_fstbh_tcm_showTabsContextIem');
        if(self.applied)
            showTabsContextItem.removeAttribute('disabled');
        else
            showTabsContextItem.setAttribute('disabled', true);
    };
    
    /**
     * Performs tweaks, mostly for Windows.
     * <p>
     * Handles the fullishScreen preference, which sets the window inFullscreen
     * attribute to tell everyone that we are in fullscreen. They might still
     * use sizemode, but that really isn't our problem.
     * <p>
     * XXX - Wait until there is a way to fix the titlebar controls. Currently,
     * just paint some icons to take the same space as the ones Windows creates.
     * Would like to use the fullscreen controls from Firefox, but Windows
     * directly draws the buttons and we can't do anything with that space.
     * <p>
     * This originally came up for supporting the PersonalTitlebar add-on.
     */
    this.windowingTweaks = function(maximized, applyInMaximized, fullscreen, applyInFullscreen) {
        let cp = com.sppad.fstbh.CurrentPrefs;
        
        let mainWindow = document.getElementById('main-window');
        let tabViewDeck = document.getElementById('tab-view-deck');
    
        if(maximized && applyInMaximized && cp['fullishScreen']) {
            mainWindow.setAttribute('com_sppad_fstbh_fullishScreen', 'true');
 
            mainWindow.setAttribute('inFullscreen', 'true');
            gNavToolbox.setAttribute('inFullscreen', 'true');
            tabViewDeck.style.paddingTop = -(mainWindow.boxObject.screenY) + "px";
        } else {
            mainWindow.removeAttribute('com_sppad_fstbh_fullishScreen');   
            tabViewDeck.style.paddingTop = "";
            
            if(!fullscreen) {
                mainWindow.removeAttribute('inFullscreen');
                gNavToolbox.removeAttribute('inFullscreen');
                tabViewDeck.style.paddingTop = '';
            }
        }
    };
    
    /**
     * Handles showing #navigator-toolbox due to mouse or focus events when the
     * add-on is applied.
     * 
     * This handles:
     * <ul>
     * <li>Showing when hovering
     * <li>Showing when going above the top of the browser
     * <li>Showing when one of the show events triggers
     * <li>Staying open when a context menu or other popup is open
     * <li>Showing on input field (such as nav-bar or search bar) focus
     * <li>Showing when a menu (e.g. File menu) is opened
     * </ul>
     */
    this.ShowNavBoxHandler = new function() {
            
        let self = this;   
        self.opened = false;
        self.hovering = false;
        self.focused = false;
        self.menuActive = false;
        self.popupTarget = null;
        self.showEventActive = false;
        self.showEventDelayTimer = null;
        self.eventTime = 0;
        
        /* How long to ignore a tab select for after a open or close */
        self.ignoreSelectDelta = 100;
        
        this.setup = function() {
            let container = window.gBrowser.tabContainer;
            let toggler = document.getElementById('com_sppad_fstbh_toggler');
            let toolbarMenubar = document.getElementById('toolbar-menubar');
            
            document.addEventListener("keypress", self.keyevent, false);
            gBrowser.addEventListener('mouseleave', self.mouseleave, false);
            toggler.addEventListener('dragenter', self.mouseenter, false);
            toggler.addEventListener('mouseenter', self.mouseenter, false);
            gNavToolbox.addEventListener('dragenter', self.mouseenter, false);
            gNavToolbox.addEventListener('mouseenter', self.mouseenter, false);
            gNavToolbox.addEventListener('focus', self.checkfocus, true);
            gNavToolbox.addEventListener('blur', self.checkfocus, true);
            gNavToolbox.addEventListener('popupshown', self.popupshown, false);
            gNavToolbox.addEventListener('popuphidden', self.popuphidden, false);
            container.addEventListener("TabSelect", this, false);
            container.addEventListener("TabClose", this, false);
            container.addEventListener("TabOpen", this, false);
            
            gBrowser.addProgressListener(this);
            self.menubarObserver.observe(toolbarMenubar, { attributes: true });
            
            self.hovering = false;
            self.popupTarget = null;
            self.updateOpenedStatus();
            
            self.setHiddenStyle();
        };
        
        this.cleanup = function() {
            let container = window.gBrowser.tabContainer;
            let toggler = document.getElementById('com_sppad_fstbh_toggler');
            
            document.removeEventListener("keypress", self.keyevent);
            gBrowser.removeEventListener('mouseleave', self.mouseleave);
            toggler.removeEventListener('dragenter', self.mouseenter);
            toggler.removeEventListener('mouseenter', self.mouseenter);
            gNavToolbox.removeEventListener('dragenter', self.mouseenter);
            gNavToolbox.removeEventListener('mouseenter', self.mouseenter);
            gNavToolbox.removeEventListener('focus', self.checkfocus);
            gNavToolbox.removeEventListener('blur', self.checkfocus);
            gNavToolbox.removeEventListener('popupshown', self.popupshown);
            gNavToolbox.removeEventListener('popuphidden', self.popuphidden);
            container.removeEventListener("TabSelect", this);
            container.removeEventListener("TabClose", this);
            container.removeEventListener("TabOpen", this);
            
            gBrowser.removeProgressListener(this);
            self.menubarObserver.disconnect();
            
            self.hovering = false;
            self.popupTarget = null;
            self.updateOpenedStatus();
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
            
            trigger && self.triggerShowEvent();
        };
        
        // nsIWebProgressListener
        this.QueryInterface = XPCOMUtils.generateQI(['nsIWebProgressListener', 'nsISupportsWeakReference']),
                            
        /**
         * Listen for location change in case showOnLocationChange preference is
         * set.
         */
        this.onLocationChange = function(aProgress, aRequest, aURI) {
            if(com.sppad.fstbh.CurrentPrefs['showEvents.showOnLocationChange'])
                self.triggerShowEvent();
        };
    
        // Nothing to do for these
        this.onStateChange = function() {};
        this.onProgressChange = function() {};
        this.onStatusChange = function() {};
        this.onSecurityChange = function() {};
        // end nsIWebProgressListener
        
        /**
         * Observe attribute changes on toolbar-menubar for showing when the
         * menubar is active, such as when using alt or F10.
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
         * Handle escape: clear the focused item if we are focused so that we
         * can hide.
         */
        this.keyevent = function(aEvent) {
            if(self.focused && (aEvent.keyCode == aEvent.DOM_VK_ESCAPE))
                document.commandDispatcher.focusedElement = null;
        };
        
        /**
         * Checks if an item is focused so that we can know if we should display
         * or not on that basis.
         */
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
         * Tracks if the mouse goes out of the top of the browser and sets the
         * toolbars open if it does.
         * <p>
         * This serves two purposes:
         * <ul>
         * <li> Opening up if the mouse moves too quickly out the top in
         * maximized mode for a mouseenter event to occur
         * <li> Opening up under Windows when show tabs is set in maximized mode
         * and mousing over an empty part of the toolbar. For some reason, no
         * mouse events are generated on that part of the toolbar.
         * </ul>
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
         * Can't check if the target is a popup, since the user can move from
         * the popup up into the navigator-toolbox.
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

        /**
         * Either sets the toolbars opened or closed, depending on the following
         * factors:
         * 
         * <ul>
         * <li> self.hovering - The mouse is over the toolbars
         * <li> self.focused - Something (e.g. input field) is focused
         * <li> self.popupTarget - A popup (e.g. menu) is opened
         * <li> self.showEventActive - A show event occured (e.g. switched tabs)
         * </ul>
         */
        this.updateOpenedStatus = function() {
            if(self.hovering || self.focused || self.popupTarget || self.showEventActive || self.menuActive)
                self.setOpened();
            else
                self.setClosed();
        }
        
        /**
         * Causes the navigator toolbox to show by setting the toggle attribute.
         * Also sets up listeners to stay open on context menu to stay open and
         * mouse move for eventually closing.
         */
        this.setOpened = function() {
            if(self.opened)
                return;
            
            self.opened = true;
            
            gNavToolbox.setAttribute('com_sppad_fstbh_toggle', 'true');
            
            window.addEventListener('dragover', self.checkMousePosition, false);
            window.addEventListener('mousemove', self.checkMousePosition, false);
            document.addEventListener('popupshown', self.popupshown, false);
            document.addEventListener('popuphidden', self.popuphidden, false);
            
            let transitionDuration = (com.sppad.fstbh.CurrentPrefs['transitionDurationIn'] / MILLISECONDS_PER_SECOND) + 's';
            gNavToolbox.style.transitionDuration = transitionDuration;
        };
        
        /**
         * Causes the navigator toolbox to close by removing the toggle
         * attribute. Can still be showing if the inputFocused attribute is set
         * though.
         * 
         * Also re-calculates the top offset in case the size has changed.
         */
        this.setClosed = function() {
            if(!self.opened)
                return;
            
            self.opened = false;
            
            gNavToolbox.removeAttribute('com_sppad_fstbh_toggle');
            
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
        
        // Delay so that tab attributes will have been set. Also prevents us
        // from evaluating the state too often.
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
            
            self.applyAttribute('navigator-toolbox', 'titlechange', titleChangedCount > 0);
            self.applyAttribute('navigator-toolbox', 'pinnedTitlechange', pinnedTitleChangedCount > 0);
        }, 200);
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
        self.applyAttribute('navigator-toolbox', 'titleChangeBehavior', mode);
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
        
        gNavToolbox.style.transitionDelay = transitionDelay;
    };
    
    /**
     * Sets the transition property.
     */
    this.setTransitionProperty = function(value) {
        gNavToolbox.style.transitionProperty = value;
    };

    /**
     * Sets the showTabsToolbar mode.
     * 
     * @param value
     *            The mode for showTabsToolbar
     */
    this.setShowTabsToolbar = function(value) {
        self.applyAttribute('navigator-toolbox', 'showTabsToolbar', value);
        
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
        self.applyAttribute('navigator-toolbox', 'showPersonalToolbar', value);
        
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
    
    this.setNormalMode = function(value) {
        
        let menuitem = document.getElementById('com_sppad_fstbh_tcm_normalModeContextItem');
        if(value == 'hover')
            menuitem.setAttribute('checked', 'true');
        else
            menuitem.removeAttribute('checked');
        
        self.updateAppliedStatus();
        
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
     * Sets the preference for showTabsToolbar from a context menu item.
     */
    this.setFullscreenTabs = function(source) {
        let checked = source.hasAttribute('checked');
        com.sppad.fstbh.Preferences.setPreference('showTabsToolbar', checked ? 'always' : 'hoverOnly');
    };
    
    /**
     * Sets the preference for showPersonalToolbar from a context menu item.
     */
    this.setFullscreenPersonalToolbar = function(source) {
        let checked = source.hasAttribute('checked');
        com.sppad.fstbh.Preferences.setPreference('showPersonalToolbar', checked ? 'hover' : 'never');
    };
    
    /**
     * Sets normal autohide mode from a context menu item.
     */
    this.setNormalAutohide = function(source) {
        let checked = source.hasAttribute('checked');
        com.sppad.fstbh.Preferences.setPreference('normalMode', checked ? 'hover' : 'normal');
    };
    
    /**
     * Sets maximized autohide mode from a context menu item.
     */
    this.setMaximizedAutohide = function(source) {
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
        let prefs = ['transitionDelay', 'transitionProperty',
                     'showWhenTitleChanged', 'style.browserBottomBox',
                     'style.topChromeBackground', 'showTabsToolbar',
                     'showPersonalToolbar', 'normalMode', 'maximizedMode'];
        
        prefs.forEach(function(pref) {
            self.prefChanged(pref, com.sppad.fstbh.CurrentPrefs[pref]);
        });
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
        
        gPrefService.addObserver("browser.fullscreen", this, false);
        
        Components.classes["@mozilla.org/observer-service;1"]
            .getService(Components.interfaces.nsIObserverService)
            .addObserver(this, "lightweight-theme-styling-update", false);
        
        this.loadPreferences();
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
        
        gPrefService.removeObserver("browser.fullscreen", this);
        
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
    
    // Need to let browser apply all changes first so it can correctly calculate
    // the bottom margin on the titlebar under Windows
    window.clearTimeout(com.sppad.fstbh.sizemodeTimer);
    com.sppad.fstbh.sizemodeTimer = window.setTimeout(function() {
        com.sppad.fstbh.Main.updateAppliedStatus();
    }, 10);
}, false);