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
            case 'TabSelect':
            	self.offsetBrowser();
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
            case 'maximizedMode':
            case 'fullscreenMode':
                self.updateAppliedStatus();
                break;
            case 'tweaks.mouse':
                self.setMouseTweaks(value);
                break;
            case 'tweaks.toggleWhenFocusedAndHasText':
                com.sppad.fstbh.NavBoxHandler.disable();
                self.updateAppliedStatus();
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
    
    self.setShowAddonsBar = function(value) {
        self.alwaysShowAddonsBar = value == 'always';
        self.applyAttribute('main-window', 'showAddonsBar', self.alwaysShowAddonsBar);
        self.offsetBrowser();
    };
    
    self.setMouseTweaks = function(value) {
        for(let node of document.getElementsByClassName('com_sppad_fstbh_toggler'))
            node.setAttribute('hidden', value === "dontTriggerOnMouse");
        
        self.offsetBrowser();
        document.getElementById('com_sppad_fstbh_top_toggler').setAttribute('singlePixelPadding', value === "onePixelPadding");
    }
    
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
	 * Offsets / un-offsets the browser by setting a top margin. This is done so
	 * that we can stay as display stack and always show TabsToolbar without
	 * covering page content. This is used when the showTabsToolbar is set to
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
        	
        	if(node.getAttributeNS(com.sppad.fstbh.xmlns, 'forceShow') == 'true' && !node.hasAttribute('treestyletab-mode'))
        		offsetTop += node.boxObject.height;
        }
        
        if(offsetTop == 0 && self.prefs['tweaks.mouse'] === 'onePixelPadding')
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
                     'tweaks.mouse'];
        
        prefs.forEach(function(pref) {
            self.prefChanged(pref, self.prefs[pref]);
        });
    };
    
    self.popupmenuShowing = function(event) {
        let popup = event.target;
        
        ['normalMode', 'maximizedMode', 'fullscreenMode', 'showAddonsBar', 'showTabsToolbar'].forEach(function(action) {
            let value = self.prefs[action];
            let menuitem = popup.querySelector('[action="' + action + '"]');
            
            if(value === 'hover' || value === 'always') {
                menuitem.setAttribute('checked', 'true');
            } else {
                menuitem.removeAttribute('checked');
            }
        });
    };
    
    self.setupContextMenus = function() {
        let autohideContext = document.getElementById('autohide-context');
        let toolbarContext = document.getElementById('toolbar-context-menu');
        let viewToolbarsMenu = document.querySelector('#viewToolbarsMenu menupopup');
        
        let tmpl = document.getElementById('fstbh-menu-nodes');
        
        // Hide "Hide Toolbars" context menu item since we are going to use our
        // own. No id so need to do it another way.
        for (let i=0; i<autohideContext.childNodes.length; i++) {
            let item = autohideContext.childNodes[i];

            if (item.getAttribute("oncommand") === "FullScreen.setAutohide();")
                item.setAttribute('hidden', true);
        }
        
        autohideContext.addEventListener('popupshowing', function(aEvent) {
            let insertPoint = aEvent.target.querySelector('menuseparator');
            onViewToolbarsPopupShowing(aEvent, insertPoint);
        }, false);
        
        [toolbarContext, autohideContext, viewToolbarsMenu].forEach(function(menupopup) {
            for (let i=0; i<tmpl.childNodes.length; i++)
                menupopup.insertBefore(tmpl.childNodes[i].cloneNode(true), null);
            
            menupopup.addEventListener('popupshowing', self.popupmenuShowing, false);
        });
    };
    
    self.setup = function() {
        com.sppad.fstbh.Preferences.addListener(self);
        
        let tabContainer = window.gBrowser.tabContainer;
        tabContainer.addEventListener("TabSelect", self, false);
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
        tabContainer.removeEventListener("TabSelect", self);
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
