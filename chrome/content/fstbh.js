if (typeof com == "undefined") {
    var com = {};
}

com.sppad = com.sppad || {};
com.sppad.fstbh = com.sppad.fstbh || {};

com.sppad.fstbh.Main = new function() {

    const MILLISECONDS_PER_SECOND = 1000;
    const WINDOWS = "WINNT";
    
    let self = this;
    self.sizemodeTimer = null;
    self.os = Components.classes["@mozilla.org/xre/app-info;1"]
        .getService(Components.interfaces.nsIXULRuntime).OS;
    
    this.handleEvent = function(aEvent) {
        switch (aEvent.type) {
            case com.sppad.fstbh.Preferences.EVENT_PREFERENCE_CHANGED:
                this.prefChanged(aEvent.name, aEvent.value);
                break;
            case 'TabClose':
                this.updateTabCount(true);
                break;
            case 'TabOpen':
                this.updateTabCount();
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
                com.sppad.fstbh.NavBoxHandler.setHiddenStyle();
                break;
            case 'style.browserBottomBox':
                this.applyAttribute('browser-bottombox', 'backgroundStyle', value);
                break;
            case 'style.topChromeBackground':
                this.applyAttribute('navigator-toolbox', 'backgroundStyle', value);
                break;
            case 'showIdentityBox':
                document.getElementById('com_sppad_fstbh_ssl_info_boundry').setAttribute('hidden', !value);
                break;
            case 'showTabsToolbar':
                this.setShowTabsToolbar(value);
                this.updateTabCount();
                break;
            case 'showAddonsBar':
                this.setShowAddonsBar(value);
                break;
            case 'normalMode':
                this.setNormalMode(value);
                break;
            case 'maximizedMode':
                this.setMaximizedMode(value);
                break;
            case 'fullscreenMode':
                this.setFullscreenMode(value);
                break;
            case 'fullishScreen':
            case 'fullscreenMenu':
                this.updateAppliedStatus();
                break;
            case 'tweaks.onePixelPadding':
                this.offsetBrowser();
                document.getElementById('com_sppad_fstbh_top_toggler').setAttribute('singlePixelPadding', value);
                break;
            default:
                break;
        }
    };
    
    this.observe = function (aSubject, aTopic, aData) {
        if(aTopic == 'lightweight-theme-styling-update')
            self.applied && self.setupTheme();
        else if(aTopic == 'nsPref:changed' && aData == 'browser.fullscreen.autohide')
            self.updateAppliedStatus();
    };
    
    this.addonbarObserver = new MutationObserver(function(mutations) {
        mutations.forEach(function(mutation) {
            if(mutation.attributeName == 'collapsed') {
                self.offsetBrowser();
            }
        });   
    });
    
    this.setupTheme = function() {
        let mainWindow = document.getElementById('main-window');
        
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
        if(self.os == WINDOWS) {
            let titlebar = document.getElementById('titlebar');
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
     */
    this.applyAttribute = function(id, name, value) {
        document.getElementById(id).setAttribute("com_sppad_fstbh_" + name, value);
    };
    
    this.sizemodeChange = function() {
        // Need to let browser apply all changes first so it can correctly
        // calculate
        // the bottom margin on the titlebar under Windows
        window.clearTimeout(com.sppad.fstbh.sizemodeTimer);
        com.sppad.fstbh.sizemodeTimer = window.setTimeout(function() {
            com.sppad.fstbh.Main.updateAppliedStatus();
        }, 10);
    }
    
    /**
     * Updates the applied status, checking if the add-on should be applied or
     * not. Sets everything up for auto-hide behavior to take effect.
     */
    this.updateAppliedStatus = function() {
        let cp = com.sppad.fstbh.CurrentPrefs;
        
        let sizemode = window.windowState;
        
        let normal = sizemode == window.STATE_NORMAL;
        let maximized = sizemode == window.STATE_MAXIMIZED;
        let fullscreen = sizemode == window.STATE_FULLSCREEN;

        let applyInNormal = cp['normalMode'] == 'hover';
        let applyInMaximized = cp['maximizedMode'] == 'hover';
        let applyInFullscreen = cp['fullscreenMode'] == 'hover';
 
        self.applied = (normal && applyInNormal)
                    || (maximized && applyInMaximized)
                    || (fullscreen && applyInFullscreen);
        
        self.applyAttribute('main-window', 'applied', self.applied);
        
        self.windowingTweaks(maximized, applyInMaximized, fullscreen, applyInFullscreen);
    
        if(self.applied) {
            self.offsetBrowser();
            self.setupTheme();
            com.sppad.fstbh.NavBoxHandler.setHiddenStyle();
            com.sppad.fstbh.NavBoxHandler.enable();
            com.sppad.fstbh.BottomBoxHandler.enable();
        } else {
            self.clearTheme();
            com.sppad.fstbh.NavBoxHandler.setShowingStyle();
            com.sppad.fstbh.NavBoxHandler.disable();
            com.sppad.fstbh.BottomBoxHandler.disable();
        }
        
        let contextItems = ['com_sppad_fstbh_alwaysShowTabs',
                            'com_sppad_fstbh_alwaysShowTabs_fullscreen',
                            'com_sppad_fstbh_alwaysShowAddonsBar',
                            'com_sppad_fstbh_alwaysShowAddonsBar_fullscreen'];
        contextItems.forEach(function(id) {
            if(self.applied)
                document.getElementById(id).removeAttribute('disabled');
            else
                document.getElementById(id).setAttribute('disabled', 'true');
        });
    };
    
    this.windowingTweaks = function(maximized, applyInMaximized, fullscreen, applyInFullscreen) {
        let cp = com.sppad.fstbh.CurrentPrefs;
        
        let mainWindow = document.getElementById('main-window');
        let tabViewDeck = document.getElementById('tab-view-deck');
    
        // fullishScreen preference
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
        
        // Menu button / bar in fullscreen
        if(self.os == WINDOWS) {
            let menubar = document.getElementById('toolbar-menubar');
            let appmenu = document.getElementById('appmenu-button-container');
            let controls = document.getElementById('window-controls');
            let titlebar = document.getElementById('titlebar-content');
            let fsTitlebar = document.getElementById('com_sppad_fstbh_fullscreen_titlebar');
            let fstbhControls = document.getElementById('com_sppad_fstbh_windowControls');
            let maximizedControls = document.getElementById('titlebar-buttonbox-container');
            let tabstoolbar = document.getElementById('TabsToolbar');
            
            self.applyAttribute('main-window', 'fullscreenMenu', cp['fullscreenMenu']);
            
            if(fullscreen && cp['fullscreenMenu']) {
                fsTitlebar.appendChild(appmenu);
                fsTitlebar.appendChild(controls);
                
                menubar.removeAttribute('moz-collapsed');
                appmenu.setAttribute('orient', 'vertical');
                
                let autohide = menubar.getAttribute('autohide');
                self.applyAttribute('main-window', 'menubar_autohide', autohide);
            } else {
                if(fullscreen)
                    menubar.setAttribute('moz-collapsed', true);
                
                appmenu.removeAttribute('orient', 'vertical');
                titlebar.insertBefore(appmenu, titlebar.firstChild);
                tabstoolbar.appendChild(controls);
            }
            
            let controlButtons = fullscreen ? controls : fstbhControls;
            let placeholders = document.getElementsByClassName('titlebar-placeholder');
            
            for(let i=0; i<placeholders.length; i++) {
                let placeholder = placeholders[i];
                let type = placeholder.getAttribute('type');
                
                if(type == 'appmenu-button') {
                    let width = appmenu.boxObject.width;
                    placeholder.setAttribute('width', width);
                } else if(type == 'caption-buttons') {
                    let width = Math.max(maximizedControls.boxObject.width, controlButtons.boxObject.width);
                    placeholder.setAttribute('width', width);
                }
            }
        }
       
    };
    
    this.menubarObserver = new MutationObserver(function(mutations) {
        mutations.forEach(function(mutation) {
            if(mutation.attributeName == 'autohide') {
                let autohide = mutation.target.getAttribute('autohide');
                self.applyAttribute('main-window', 'menubar_autohide', autohide);
            }
        });   
    });
    
    /**
     * Updates based on the number of tabs open. Sets the attribute to keep tabs
     * toolbar showing.
     * 
     * @param offset
     *            If called while a tab is closing, do not count that tab.
     */
    this.updateTabCount = function(offset) {
        let pref = com.sppad.fstbh.CurrentPrefs['showTabsToolbar'];
        let tabCount = gBrowser.tabContainer.itemCount + (offset ? -1 : 0);

        self.alwaysShowTabs = (pref == 'always') || (pref == 'multipleTabs' && tabCount > 1);
        self.applyAttribute('main-window', 'showTabsToolbar', self.alwaysShowTabs);
        
        self.offsetBrowser();
    };
    
    this.setTransitionDelay = function(value) {
        let transitionDelay = (value / MILLISECONDS_PER_SECOND) + 's';
        
        gNavToolbox.style.transitionDelay = transitionDelay;
    };
    
    this.setTransitionProperty = function(value) {
        gNavToolbox.style.transitionProperty = value;
    };

    this.setShowTabsToolbar = function(value) {
        let contextItems = ['com_sppad_fstbh_alwaysShowTabs', 'com_sppad_fstbh_alwaysShowTabs_fullscreen'];
        contextItems.forEach(function(id) {
            if(value == 'always')
                document.getElementById(id).setAttribute('checked', 'true');
            else
                document.getElementById(id).removeAttribute('checked');
        });
        
        self.offsetBrowser();
    };
    
    this.setShowAddonsBar = function(value) {
        let contextItems = ['com_sppad_fstbh_alwaysShowAddonsBar', 'com_sppad_fstbh_alwaysShowAddonsBar_fullscreen'];
        contextItems.forEach(function(id) {
            if(value == 'always')
                document.getElementById(id).setAttribute('checked', 'true');
            else
                document.getElementById(id).removeAttribute('checked');
        });
        
        self.alwaysShowAddonsBar = value == 'always';
        self.applyAttribute('main-window', 'showAddonsBar', self.alwaysShowAddonsBar);
        self.offsetBrowser();
    };
    
    this.setNormalMode = function(value) {
        let menuitem = document.getElementById('com_sppad_fstbh_normalModeContextItem');
        if(value == 'hover')
            menuitem.setAttribute('checked', 'true');
        else
            menuitem.removeAttribute('checked');
        
        self.updateAppliedStatus();
    };

    this.setMaximizedMode = function(value) {
        let menuitem = document.getElementById('com_sppad_fstbh_maximizedModeContextItem');
        if(value == 'hover')
            menuitem.setAttribute('checked', 'true');
        else
            menuitem.removeAttribute('checked');
        
        self.updateAppliedStatus();
    };
    
    this.setFullscreenMode = function(value) {
        let menuitem = document.getElementById('com_sppad_fstbh_fullscreenModeContextItem');
        if(value == 'hover')
            menuitem.setAttribute('checked', 'true');
        else
            menuitem.removeAttribute('checked');
        
        self.updateAppliedStatus();
    };
    
    this.setAlwaysShowTabs = function(source) {
        let checked = source.hasAttribute('checked');
        com.sppad.fstbh.Preferences.setPreference('showTabsToolbar', checked ? 'always' : 'hoverOnly');
    };
    
    this.setAlwaysShowAddonsBar = function(source) {
        let checked = source.hasAttribute('checked');
        com.sppad.fstbh.Preferences.setPreference('showAddonsBar', checked ? 'always' : 'hoverOnly');
    };
    
    this.setNormalAutohide = function(source) {
        let checked = source.hasAttribute('checked');
        com.sppad.fstbh.Preferences.setPreference('normalMode', checked ? 'hover' : 'normal');
    };
    
    this.setMaximizedAutohide = function(source) {
        let checked = source.hasAttribute('checked');
        com.sppad.fstbh.Preferences.setPreference('maximizedMode', checked ? 'hover' : 'normal');
    };
    
    this.setFullscreenAutohide = function(source) {
        let checked = source.hasAttribute('checked');
        com.sppad.fstbh.Preferences.setPreference('fullscreenMode', checked ? 'hover' : 'normal');
    };
    
    /**
     * Offsets / un-offsets the browser by setting a top margin. This is done so
     * that we can stay as display stack and always show TabsToolbar without
     * covering page content. This is used when the showTabsToolbar is set to
     * always or multipleTabs.
     */
    this.offsetBrowser = function() {
        let cp = com.sppad.fstbh.CurrentPrefs;
        
        let sslBox = document.getElementById('com_sppad_fstbh_ssl_info_boundry');
        let browser = document.getElementById('browser');
        let tabsToolbar = document.getElementById('TabsToolbar');
        let addonsBar = document.getElementById('addon-bar');
        
        let offsetTop = self.alwaysShowTabs ? tabsToolbar.boxObject.height : cp['tweaks.onePixelPadding'] ? 1 : 0;
        let offsetBottom = self.alwaysShowAddonsBar ? addonsBar.boxObject.height : 0;
        
        sslBox.style.marginTop = offsetTop + "px";
        browser.style.marginTop = offsetTop + "px";
        browser.style.marginBottom = offsetBottom + "px";
    };
    
    this.loadPreferences = function() {
        let prefs = ['transitionDelay', 'transitionProperty',
                     'showWhenTitleChanged', 'style.browserBottomBox',
                     'style.topChromeBackground', 'showTabsToolbar',
                     'showAddonsBar', 'normalMode', 'maximizedMode',
                     'fullscreenMode', 'showIdentityBox', 'tweaks.onePixelPadding' ];
        
        prefs.forEach(function(pref) {
            self.prefChanged(pref, com.sppad.fstbh.CurrentPrefs[pref]);
        });
    };
    
    this.setupContextMenus = function() {
        let autohideContext = document.getElementById('autohide-context');
        
        // Hide "Hide Toolbars" context menu item since we are going to use our
        // own. No id so need to do it another way.
        for (let i=0; i<autohideContext.childNodes.length; i++) {
            let item = autohideContext.childNodes[i];

            if (item.getAttribute("oncommand") === "FullScreen.setAutohide();")
                item.setAttribute('hidden', true);
        }
        
        autohideContext.addEventListener('popupshowing', function(aEvent) {
            let insertPoint = document.getElementById('com_sppad_fstbh_fullscreen_context_separator');
            onViewToolbarsPopupShowing(aEvent, insertPoint);
        }, false);
    };
    
    this.setup = function() {
        com.sppad.fstbh.Preferences.addListener(this);
        
        let tabContainer = window.gBrowser.tabContainer;
        tabContainer.addEventListener("TabClose", this, false);
        tabContainer.addEventListener("TabOpen", this, false);
        
        window.addEventListener("sizemodechange", this.sizemodeChange, false);
        
        Components.classes["@mozilla.org/observer-service;1"]
            .getService(Components.interfaces.nsIObserverService)
            .addObserver(this, "lightweight-theme-styling-update", false);
        
        
        let menubar = document.getElementById('toolbar-menubar');
        let addonbar = document.getElementById('addon-bar');

        self.menubarObserver.observe(menubar, { attributes: true });
        self.addonbarObserver.observe(addonbar, { attributes: true });
        
        this.setupContextMenus();
        this.loadPreferences();
        this.updateTabCount();
    };
    
    this.cleanup = function() {
        com.sppad.fstbh.Preferences.removeListener(this);
        
        let tabContainer = window.gBrowser.tabContainer;
        tabContainer.removeEventListener("TabClose", this);
        tabContainer.removeEventListener("TabOpen", this);
        
        window.removeEventListener("sizemodechange", this.sizemodeChange);
        
        self.menubarObserver.disconnect();
        self.addonbarObserver.disconnect();
        
        Components.classes["@mozilla.org/observer-service;1"]
            .getService(Components.interfaces.nsIObserverService)
            .removeObserver(this, "lightweight-theme-styling-update");
    };
};

window.addEventListener("load", function() {
    com.sppad.fstbh.Main.setup();
}, false);

window.addEventListener("unload", function() {
    com.sppad.fstbh.Main.cleanup();
    com.sppad.fstbh.Preferences.cleanup();
}, false);
