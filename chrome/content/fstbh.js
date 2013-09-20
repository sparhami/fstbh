com.sppad.fstbh.Main = new function() {

    const WINDOWS = "WINNT";
    
    let self = this;
    self.prefs = com.sppad.fstbh.CurrentPrefs;
    
    self.sizemodeTimer = null;
    self.os = Components.classes["@mozilla.org/xre/app-info;1"]
        .getService(Components.interfaces.nsIXULRuntime).OS;
    
    self.handleEvent = function(aEvent) {
        switch (aEvent.type) {
            case com.sppad.fstbh.Preferences.EVENT_PREFERENCE_CHANGED:
                self.prefChanged(aEvent.name, aEvent.value);
                break;
            case 'TabClose':
                self.updateShowTabs(true);
                self.offsetBrowser();
                break;
            case 'TabOpen':
                self.updateShowTabs();
                self.offsetBrowser();
                break;
            default:
                break;
        }
    };

    self.prefChanged = function(name, value) {
        switch (name) {
        	case 'transitionProperty':
        		self.updateTransitionProperty();
        		break;
            case 'style.browserBottomBox':
                self.applyAttribute('browser-bottombox', 'backgroundStyle', value);
                break;
            case 'style.topChromeBackground':
                self.applyAttribute('navigator-toolbox', 'backgroundStyle', value);
                break;
            case 'style.shadowWhenToggled':
                self.applyAttribute('navigator-toolbox', 'shadowWhenToggled', value);
                break;
            case 'showIdentityBox':
                document.getElementById('com_sppad_fstbh_ssl_info_boundry').setAttribute('hidden', !value);
                break;
            case 'showTabsToolbar':
                self.setShowTabsToolbar(value);
                self.updateShowTabs();
            	self.offsetBrowser();
                break;
            case 'showNavBar':
            	self.updateShowNavBar();
            	self.offsetBrowser();
            	break;
            case 'showBookmarksBar':
            	self.updateShowBookmarksBar();
            	self.offsetBrowser();
            	break;
            case 'showAddonsBar':
                self.setShowAddonsBar(value);
                break;
            case 'normalMode':
                self.setNormalMode(value);
                break;
            case 'maximizedMode':
                self.setMaximizedMode(value);
                break;
            case 'fullscreenMode':
                self.setFullscreenMode(value);
                break;
            case 'fullishScreen':
            case 'fullscreenMenu':
                self.updateAppliedStatus();
                break;
            case 'tweaks.onePixelPadding':
                self.offsetBrowser();
                document.getElementById('com_sppad_fstbh_top_toggler').setAttribute('singlePixelPadding', value);
                break;
            default:
                break;
        }
    };
    
    self.observe = function (aSubject, aTopic, aData) {
        if(aTopic == 'lightweight-theme-styling-update')
            self.applied && self.setupTheme();
    };
    
    self.addonbarObserver = new MutationObserver(function(mutations) {
        mutations.forEach(function(mutation) {
            if(mutation.attributeName == 'collapsed') {
                self.offsetBrowser();
            }
        });   
    });
    
    self.setupTheme = function() {
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
    
    self.clearTheme = function() {
        gNavToolbox.style.color = '';
        gNavToolbox.style.backgroundColor = '';
        gNavToolbox.style.backgroundImage = '';
    };
    
    self.applyAttribute = function(id, name, value) {
        document.getElementById(id).setAttributeNS(com.sppad.fstbh.xmlns, name, value);
    };
    
    /*
	 * Need to let browser apply all changes first so it can correctly
	 * calculate the bottom margin on the titlebar under Windows. Also need
	 * to make sure customize attribute has been set if checking for
	 * customize mode.
	 */
    self.evaluateAppliedStatus = function() {
        window.clearTimeout(com.sppad.fstbh.sizemodeTimer);
        com.sppad.fstbh.sizemodeTimer = window.setTimeout(function() {
            com.sppad.fstbh.Main.updateAppliedStatus();
        }, 1);
    }
    
    /**
	 * Updates the applied status, checking if the add-on should be applied or
	 * not. Sets everything up for auto-hide behavior to take effect.
	 */
    self.updateAppliedStatus = function() {
    	let sizemode = window.windowState;
        
        let mainWindow = document.getElementById('main-window');
        
        let normal = sizemode == window.STATE_NORMAL;
        let maximized = sizemode == window.STATE_MAXIMIZED;
        let fullscreen = sizemode == window.STATE_FULLSCREEN;

        let applyInNormal = self.prefs['normalMode'] == 'hover';
        let applyInMaximized = self.prefs['maximizedMode'] == 'hover';
        let applyInFullscreen = self.prefs['fullscreenMode'] == 'hover';
        
        self.applied = !gNavToolbox.hasAttribute('customizing')
        			&& !mainWindow.hasAttribute('customizing')
        			&& ((normal && applyInNormal)
                    || (maximized && applyInMaximized)
                    || (fullscreen && applyInFullscreen));
        
        self.applyAttribute('main-window', 'applied', self.applied);
        self.applyAttribute('main-window', 'domFS', document.mozFullScreen);
        
        self.windowingTweaks(maximized, applyInMaximized, fullscreen, applyInFullscreen);
    
        if(self.applied) {
            self.offsetBrowser();
            self.setupTheme();
            com.sppad.fstbh.NavBoxHandler.enable();
            com.sppad.fstbh.BottomBoxHandler.enable();
        } else {
            self.clearTheme();
            com.sppad.fstbh.NavBoxHandler.disable();
            com.sppad.fstbh.BottomBoxHandler.disable();
        }
        
        let addonbar = document.getElementById('addon-bar');
        addonbar.setAttribute('context', fullscreen ? 'autohide-context' : 'toolbar-context-menu');
    };
    
    self.windowingTweaks = function(maximized, applyInMaximized, fullscreen, applyInFullscreen) {
        let mainWindow = document.getElementById('main-window');
        let tabViewDeck = document.getElementById('tab-view-deck');
    
        // fullishScreen preference
        if(maximized && applyInMaximized && self.prefs['fullishScreen']) {
            mainWindow.setAttribute('inFullscreen', 'true');
            gNavToolbox.setAttribute('inFullscreen', 'true');
            
            tabViewDeck.style.paddingTop = -(mainWindow.boxObject.screenY) + "px";
        } else {
            if(!fullscreen) {
                mainWindow.removeAttribute('inFullscreen');
                gNavToolbox.removeAttribute('inFullscreen');
            }
            
            tabViewDeck.style.paddingTop = '';
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
            
            self.applyAttribute('main-window', 'fullscreenMenu', self.prefs['fullscreenMenu']);
            
            if(fullscreen && self.prefs['fullscreenMenu']) {
                appmenu && fsTitlebar.appendChild(appmenu);
                fsTitlebar.appendChild(controls);
                
                menubar.removeAttribute('moz-collapsed');
                appmenu && appmenu.setAttribute('orient', 'vertical');
                
                let autohide = menubar.getAttribute('autohide');
                self.applyAttribute('main-window', 'menubar_autohide', autohide);
            } else {
                if(fullscreen)
                    menubar.setAttribute('moz-collapsed', true);
                
                appmenu && appmenu.removeAttribute('orient', 'vertical');
                appmenu && titlebar.insertBefore(appmenu, titlebar.firstChild);
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
    
    self.menubarObserver = new MutationObserver(function(mutations) {
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
    self.updateShowTabs = function(offset) {
        let pref = self.prefs['showTabsToolbar'];
        let tabCount = gBrowser.tabContainer.itemCount + (offset ? -1 : 0);

        let forceShow = (pref == 'always') || (pref == 'multipleTabs' && tabCount > 1);
        self.applyAttribute('main-window', 'showTabsToolbar', forceShow);
        self.applyAttribute('TabsToolbar', 'forceShow', forceShow);
    };
  
    
    self.updateShowNavBar = function() {
        let pref = self.prefs['showNavBar'];
    	
        let forceShow = (pref === 'always');
        self.applyAttribute('nav-bar', 'forceShow', forceShow);
    };
    
    self.updateShowBookmarksBar = function() {
        let pref = self.prefs['showBookmarksBar'];
    	
        let forceShow = (pref === 'always');
        self.applyAttribute('PersonalToolbar', 'forceShow', forceShow);
    };
    
    self.updateTransitionProperty = function() {
        let pref = self.prefs['transitionProperty'];
    	
		self.applyAttribute('main-window', 'transitionProperty', pref);
		
		if(pref !== 'height') {
			com.sppad.fstbh.Preferences.setPreference('showNavBar', 'hoverOnly');
			com.sppad.fstbh.Preferences.setPreference('showTabsToolbar', 'hoverOnly');
			com.sppad.fstbh.Preferences.setPreference('showBookmarksBar', 'hoverOnly');
		}

    };
    
    self.setTransitionDelay = function(value) {
        gNavToolbox.style.transitionDelay = value + 'ms';
    };
    
    self.setShowTabsToolbar = function(value) {
        let contextItems = ['com_sppad_fstbh_alwaysShowTabs', 'com_sppad_fstbh_alwaysShowTabs_fullscreen'];
        contextItems.forEach(function(id) {
            if(value == 'always')
                document.getElementById(id).setAttribute('checked', 'true');
            else
                document.getElementById(id).removeAttribute('checked');
        });
        
        self.offsetBrowser();
    };
    
    self.setShowAddonsBar = function(value) {
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
    
    self.setNormalMode = function(value) {
        let menuitem = document.getElementById('com_sppad_fstbh_normalModeContextItem');
        if(value == 'hover')
            menuitem.setAttribute('checked', 'true');
        else
            menuitem.removeAttribute('checked');
        
        self.updateAppliedStatus();
    };

    self.setMaximizedMode = function(value) {
        let menuitem = document.getElementById('com_sppad_fstbh_maximizedModeContextItem');
        if(value == 'hover')
            menuitem.setAttribute('checked', 'true');
        else
            menuitem.removeAttribute('checked');
        
        self.updateAppliedStatus();
    };
    
    self.setFullscreenMode = function(value) {
        let menuitem = document.getElementById('com_sppad_fstbh_fullscreenModeContextItem');
        if(value == 'hover')
            menuitem.setAttribute('checked', 'true');
        else
            menuitem.removeAttribute('checked');
        
        self.updateAppliedStatus();
    };
    
    self.setAlwaysShowTabs = function(source) {
        let checked = source.hasAttribute('checked');
        com.sppad.fstbh.Preferences.setPreference('showTabsToolbar', checked ? 'always' : 'hoverOnly');
   
        if(checked) {
        	com.sppad.fstbh.Preferences.setPreference('transitionProperty', 'height');
        }
    };
    
    self.setAlwaysShowAddonsBar = function(source) {
        let checked = source.hasAttribute('checked');
        com.sppad.fstbh.Preferences.setPreference('showAddonsBar', checked ? 'always' : 'hoverOnly');
    };
    
    self.setNormalAutohide = function(source) {
        let checked = source.hasAttribute('checked');
        com.sppad.fstbh.Preferences.setPreference('normalMode', checked ? 'hover' : 'normal');
    };
    
    self.setMaximizedAutohide = function(source) {
        let checked = source.hasAttribute('checked');
        com.sppad.fstbh.Preferences.setPreference('maximizedMode', checked ? 'hover' : 'normal');
    };
    
    self.setFullscreenAutohide = function(source) {
        let checked = source.hasAttribute('checked');
        com.sppad.fstbh.Preferences.setPreference('fullscreenMode', checked ? 'hover' : 'normal');
    };
    
    /**
	 * Offsets / un-offsets the browser by setting a top margin. self is done so
	 * that we can stay as display stack and always show TabsToolbar without
	 * covering page content. self is used when the showTabsToolbar is set to
	 * always or multipleTabs.
	 */
    self.offsetBrowser = function() {
        let sslBox = document.getElementById('com_sppad_fstbh_ssl_info_boundry');
        let browser = document.getElementById('browser');
        let addonsBar = document.getElementById('addon-bar');
        
        let offsetTop = 0;
        let nodes = gNavToolbox.childNodes;

        for (let i = 0; i < nodes.length; i++) {
        	let node = nodes[i];
        	
        	if(node.getAttributeNS(com.sppad.fstbh.xmlns, 'forceShow') == 'true')
        		offsetTop += node.boxObject.height;
        }
        
        if(offsetTop == 0 && self.prefs['tweaks.onePixelPadding'])
        	offsetTop = 1;
        	
        let offsetBottom = self.alwaysShowAddonsBar ? addonsBar.boxObject.height : 0;
        
        sslBox.style.marginTop = offsetTop + "px";
        browser.style.marginTop = offsetTop + "px";
        browser.style.marginBottom = offsetBottom + "px";
    };
    
    self.loadPreferences = function() {
        let prefs = ['debug',
                     'transitionDelay',
                     'transitionProperty',
                     'showWhenTitleChanged',
                     'style.browserBottomBox',
                     'style.topChromeBackground',
                     'style.shadowWhenToggled',
                     'showTabsToolbar',
                     'showNavBar',
                     'showBookmarksBar',
                     'showAddonsBar',
                     'normalMode',
                     'maximizedMode',
                     'fullscreenMode',
                     'showIdentityBox',
                     'tweaks.onePixelPadding'];
        
        prefs.forEach(function(pref) {
            self.prefChanged(pref, self.prefs[pref]);
        });
    };
    
    self.setupContextMenus = function() {
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
    
    self.setup = function() {
        com.sppad.fstbh.Preferences.addListener(self);
        
        let tabContainer = window.gBrowser.tabContainer;
        tabContainer.addEventListener("TabClose", self, false);
        tabContainer.addEventListener("TabOpen", self, false);
        
        window.addEventListener("beforecustomization", self.evaluateAppliedStatus, false);
        window.addEventListener("aftercustomization", self.evaluateAppliedStatus, false);
        window.addEventListener("sizemodechange", self.evaluateAppliedStatus, false);
        window.addEventListener("MozEnteredDomFullscreen", self.evaluateAppliedStatus, false);
        
        Components.classes["@mozilla.org/observer-service;1"]
            .getService(Components.interfaces.nsIObserverService)
            .addObserver(self, "lightweight-theme-styling-update", false);
        
        let menubar = document.getElementById('toolbar-menubar');
        let addonbar = document.getElementById('addon-bar');

        self.menubarObserver.observe(menubar, { attributes: true });
        self.addonbarObserver.observe(addonbar, { attributes: true });
        
        self.setupContextMenus();
        self.loadPreferences();
        
        self.updateShowTabs();
        self.offsetBrowser();
    };
    
    self.cleanup = function() {
        com.sppad.fstbh.Preferences.removeListener(self);
        
        let tabContainer = window.gBrowser.tabContainer;
        tabContainer.removeEventListener("TabClose", self);
        tabContainer.removeEventListener("TabOpen", self);
        
        window.removeEventListener("beforecustomization", self.evaluateAppliedStatus);
        window.removeEventListener("aftercustomization", self.evaluateAppliedStatus);
        window.removeEventListener("sizemodechange", self.evaluateAppliedStatus);
        window.removeEventListener("MozEnteredDomFullscreen", self.evaluateAppliedStatus);
        
        Components.classes["@mozilla.org/observer-service;1"]
            .getService(Components.interfaces.nsIObserverService)
            .removeObserver(self, "lightweight-theme-styling-update");
        
        self.menubarObserver.disconnect();
        self.addonbarObserver.disconnect();
    };
};

window.addEventListener("load", function() {
    com.sppad.fstbh.Main.setup();
}, false);

window.addEventListener("unload", function() {
    com.sppad.fstbh.Main.cleanup();
    com.sppad.fstbh.Preferences.cleanup();
}, false);
