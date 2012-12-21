if (typeof com == "undefined") {
    var com = {};
}

com.sppad = com.sppad || {};
com.sppad.fstbh = com.sppad.fstbh || {};

com.sppad.fstbh.Main = new function() {

    const MILLISECONDS_PER_SECOND = 1000;
    
    let self = this;
    
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
    
    /**
     * This is used for setting the style attribute on #navigator-toolbox in
     * order to apply the persona background image and text color. The
     * limitation is that if the persona changes while in fullscreen, the change
     * will not be seen until exiting fullscreen.
     */
    this.fullscreenChange = function() {
        
        // Event occurs before the fullscreen is set, so take the opposite
        let enter = !window.fullScreen;
        
        if(enter)
            this.setupPersona();
        else
            this.clearoutPersona();
        
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
        
        let node = document.getElementById('com_sppad_fstbh_topChromeStackElement');
        node.setAttribute("titlechange", titleChangedCount > 0);
        node.setAttribute("pinnedTitlechange", pinnedTitleChangedCount > 0);
        
    };
    
    /**
     * Applies the persona image to the navigator-toolbox. Only want to do this
     * while in fullscreen.
     */
    this.setupPersona = function() {
        let mainWindow = document.getElementById('main-window');
        let element = document.getElementById('navigator-toolbox');
        
        element.style.color =  mainWindow.style.backgroundImage;
        element.style.backgroundColor =  mainWindow.style.backgroundColor;
        element.style.backgroundImage =  mainWindow.style.backgroundImage;
        
    };
    
    /**
     * Removes the persona image from the navigator-toolbox. Want to do this
     * when exiting fullscreen.
     */
    this.clearoutPersona = function() {
        let element = document.getElementById('navigator-toolbox');
        
        element.style.color =  '';
        element.style.backgroundColor = '';
        element.style.backgroundImage = '';
    };
    
    /**
     * Sets the behavior for title change by applying an attribute used by CSS.
     * 
     * @param mode
     *            The attribute value to apply for titleChangeBehavior
     */
    this.setTitleChangeBehavior = function(mode) {
        let node = document.getElementById('com_sppad_fstbh_topChromeStackElement');
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

    this.handleEvent = function(aEvent) {

        switch (aEvent.type) {
            case com.sppad.fstbh.Preferences.EVENT_PREFERENCE_CHANGED:
                return this.prefChanged(aEvent.name, aEvent.value);
            case  'TabSelect':
            case  'TabClose':
            case  'TabAttrModified':
            case  'TabPinned':
            case  'TabUnpinned':
                return this.evalutateTitleChangeState();
            default:
                return;
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

        // Only want to apply when in fullscreen, want to have browser handle
        // persona as usual otherwise.
        if(window.fullScreen)
            this.setupPersona();
    };

    this.loadPreferences = function() {
        this.prefChanged('transitionDelay', com.sppad.fstbh.CurrentPrefs['transitionDelay']);
        this.prefChanged('transitionDuration', com.sppad.fstbh.CurrentPrefs['transitionDuration']);
        this.prefChanged('showWhenTitleChanged', com.sppad.fstbh.CurrentPrefs['showWhenTitleChanged']);
    };
    
    this.setup = function() {
        
        com.sppad.fstbh.Preferences.addListener(this);
        
        let container = window.gBrowser.tabContainer;
        container.addEventListener("TabSelect", this, false);
        container.addEventListener("TabClose", this, false);
        container.addEventListener("TabAttrModified", this, false);
        container.addEventListener("TabPinned", this, false);
        container.addEventListener("TabUnpinned", this, false);
        
        
        Components.classes["@mozilla.org/observer-service;1"]
            .getService(Components.interfaces.nsIObserverService)
            .addObserver(this, "lightweight-theme-styling-update", false);
        
        this.loadPreferences();
        this.moveNavigatorToolbox();
        
    };
    
    this.cleanup = function() {
        
        Components.classes["@mozilla.org/observer-service;1"]
            .getService(Components.interfaces.nsIObserverService)
            .removeObserver(this, "lightweight-theme-styling-update");

        let container = window.gBrowser.tabContainer;
        container.removeEventListener("TabSelect", this);
        container.removeEventListener("TabClose", this);
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
}, false);

window.addEventListener("fullscreen", function () {
    com.sppad.fstbh.Main.fullscreenChange();
}, false);
