if (typeof com == "undefined") {
    var com = {};
}

com.sppad = com.sppad || {};
com.sppad.fstbh = com.sppad.fstbh || {};

Components.utils.import("resource://gre/modules/AddonManager.jsm");

/**
 * Changes any browser preferences necessary, saving them so that they can be
 * applied when the add-on is uninstalled.
 * 
 * Currently only browser.fullscreen.animateUp is changed.
 */
com.sppad.fstbh.Addon = new function() {

    let self = this;
    self.beingUninstalled = false;

    this.setupBrowserPreferences = function() {
        // Save off browser.fullscreen.animateUp up setting, then set it to not
        // animate
        if (com.sppad.fstbh.CurrentPrefs['animateUp_saved'] != -1)
            return;

        let branch = null;
        if (Services.prefs.prefHasUserValue('browser.fullscreen.animateUp'))
            branch = Services.prefs.getBranch("browser.fullscreen.");
        else
            branch = Services.prefs.getDefaultBranch("browser.fullscreen.");

        let animateUp = branch.getIntPref('animateUp');
        com.sppad.fstbh.Preferences.setPreference('animateUp_saved', animateUp);

        // Set to 0 (don't animate) as it interferes with the add-on
        branch.setIntPref('animateUp', 0);
    };

    this.restoreBrowserPreferences = function() {
        let branch = Services.prefs.getBranch("browser.fullscreen.");
        branch.setIntPref('animateUp',
                com.sppad.fstbh.CurrentPrefs['animateUp_saved']);

        com.sppad.fstbh.Preferences.setPreference('animateUp_saved', -1);
    };

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

    this.applicationObserver = {
        observe : function(aSubject, aTopic, aData) {
            // Sure that we are being uninstalled now, so restore preferences
            if (aTopic == "quit-application" && self.beingUninstalled)
                self.restoreBrowserPreferences();
        }
    };

    AddonManager.addAddonListener(self.addonListener);

    let observerService = Components.classes["@mozilla.org/observer-service;1"]
            .getService(Components.interfaces.nsIObserverService);

    observerService.addObserver(self.applicationObserver, "quit-application",
            false);

    self.setupBrowserPreferences();
}
