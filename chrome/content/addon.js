Components.utils.import("resource://gre/modules/AddonManager.jsm");

/**
 * Handles installation, uninstallation and updates.
 */
com.sppad.fstbh.Addon = new function() {

    let self = this;
    self.prefs = com.sppad.fstbh.CurrentPrefs;
    
    self.beingUninstalled = false;
    
    this.setupBrowserPreferences = function() {
        let userPref = Services.prefs.prefHasUserValue('browser.fullscreen.autohide');
        let branch = userPref ? Services.prefs.getBranch("browser.fullscreen.")
                              : Services.prefs.getDefaultBranch("browser.fullscreen.");
        
        if (self.prefs['autohide_saved'] == false) {
            let autohide = branch.getBoolPref('autohide');
            com.sppad.fstbh.Preferences.setPreference('autohide_saved', true);
            com.sppad.fstbh.Preferences.setPreference('autohide_saved_value', autohide);
        }
       
        // Set to disabled since fstbh handles autohiding
        branch.setBoolPref('autohide', false);
    };

    this.restoreBrowserPreferences = function() {
        let branch = Services.prefs.getBranch("browser.fullscreen.");
        
        com.sppad.fstbh.Preferences.setPreference('autohide_saved', false);
        
        // restore the saved value
        branch.setBoolPref('autohide', self.prefs['autohide_saved_value']);
    };

    /**
     * Listen for uninstall events.
     */
    this.addonListener = {
        onUninstalling : function(addon) {
            // Still active at this point, so don't restore yet
            if (addon.id == "fullscreentoolbarhover@com.sppad")
                self.beingUninstalled = true;
        },

        onOperationCancelled : function(addon) {
            if (addon.id == "fullscreentoolbarhover@com.sppad")
                self.beingUninstalled = (addon.pendingOperations & AddonManager.PENDING_UNINSTALL) != 0;
        },
    };

    /**
     * Listen for application quit to see if preferences should be restored.
     */
    this.applicationObserver = {
        observe : function(aSubject, aTopic, aData) {
            // Sure that we are being uninstalled now, so restore preferences
            if (aTopic == "quit-application" && self.beingUninstalled)
                self.restoreBrowserPreferences();
        }
    };
    
    /**
     * Handles an add-on update from the previous version to the current version.
     */
    this.handleUpdate = function(previousVersion) {
        let major = 0;
        
        // Anything before 4.x (didn't setup version preference) should be treated as 0
        if(previousVersion) {
            let versionParts = previousVersion.split("\\.");
            //  Check for dev version
            if(versionParts.length == 0 || isNaN(versionParts[0]))
                return;
        
            major = versionParts[0];
        }
    
        if(major < 4) {
            let prefs = com.sppad.fstbh.Preferences;

            let transitionDuration = prefs.getPreference('transitionDuration');
            prefs.setPreference('transitionDurationIn', transitionDuration);
            prefs.setPreference('transitionDurationOut', transitionDuration);
        }
    };

    this.checkForAddonUpdate = function() {
        Application.getExtensions(function (extensions) {
            let extension = extensions.get("fullscreentoolbarhover@com.sppad");
            let currentVersion = extension.version;
            let previousVersion = com.sppad.fstbh.Preferences.getPreference('version');
                
            if(previousVersion == currentVersion)
                return;
                
            self.handleUpdate(previousVersion);
            com.sppad.fstbh.Preferences.setPreference('version', currentVersion);
        });
    };
    
    
    AddonManager.addAddonListener(self.addonListener);
    let observerService = Components.classes["@mozilla.org/observer-service;1"]
            .getService(Components.interfaces.nsIObserverService);
    observerService.addObserver(self.applicationObserver, "quit-application",
            false);

    self.setupBrowserPreferences();
    self.checkForAddonUpdate();
};