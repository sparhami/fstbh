com.sppad.fstbh.PREF_WINDOW_FILE = "chrome://fstbh/content/preferences/config.xul";
com.sppad.fstbh.PREF_WINDOW_ID = "fstbh-preferences-window";
com.sppad.fstbh.PREF_BRANCH = "extensions.fstbh.";
com.sppad.fstbh.PREFS = {
    // transition delay, milliseconds - only applies for slide out animation
    transitionDelay : 0,

    // transition time, milliseconds
    // Deprecated: 0.x - 3.x
    transitionDuration : 200,

    // transition time for appearing, milliseconds
    transitionDurationIn : 200,

    // transition time for hiding, milliseconds
    transitionDurationOut : 200,

    // transition property - one of margin-top, height
    // NOTE - height corresponds to no transition since the height is
    // changing from auto to 0.
    transitionProperty : 'height',
    
    // Buffer zone for leaving toggled toolbar open, in pixels
    bottomBuffer : 0,

    // One of never, pinned, any
    showWhenTitleChanged : 'never',

    showEvents : {
        // show when tab is opened (foreground or background)
        showOnTabOpen : false,

        // show when tab is closed
        showOnTabClose : false,

        // show when tab is selected
        showOnTabSelect : true,

        // show when location bar is changed (URI)
        showOnLocationChange : false,

        // delay for staying open, milliseconds
        delay : 1500,
    },

    style : {
        // One of default, transparent
        browserBottomBox : 'transparent',

        // One of default, transparent - Windows only
        topChromeBackground : 'transparent',
        
        // Shadow under navigator-toolbox when toggled
        shadowWhenToggled : true,
    },
    
    tweaks: {
        // Use at least one pixel for browser margin top to allow mouse events over plug-in content
        onePixelPadding: true,
        
        // Only show when mousing enter toggler rather than mousing into #navigator-toolbox
        mouseEnterOnTogglerOnly: false,
    },

    // One of hoverOnly, multipleTabs, always
    showTabsToolbar : 'hoverOnly',
    
    // One of hoverOnly, always (TODO - secureSites)
    showNavBar: 'hoverOnly',
    
    // One of hoverOnly, always
    showAddonsBar : 'hoverOnly',

    // One of hover, normal
    normalMode : 'normal',
    
    // One of hover, normal
    maximizedMode : 'normal',
    
    // One of hover, normal
    fullscreenMode : 'normal',
    
    // Make it more like fullscreen
    fullishScreen : false,
    
    // Show the app menu button or Firefox menu in fullscreen
    fullscreenMenu: true,

    // Show box iwth cert org and domain when hiding toolbars
    showIdentityBox: false,
    
    // The saved value of the autohide browser preference, for restoring later
    autohide_saved : false,
    autohide_saved_value : true,
};

/**
 * From https://developer.mozilla.org/en/Code_snippets/Preferences
 * 
 * @constructor
 * 
 * @param {string}
 *            branch_name
 * @param {Function}
 *            callback must have the following arguments: branch, pref_leaf_name
 */
com.sppad.fstbh.PrefListener = function(branch_name, callback) {
    // Keeping a reference to the observed preference branch or it will get
    // garbage collected.
    let prefService = Components.classes["@mozilla.org/preferences-service;1"]
            .getService(Components.interfaces.nsIPrefService);
    this._branch = prefService.getBranch(branch_name);
    this._branch.QueryInterface(Components.interfaces.nsIPrefBranch);
    this._callback = callback;
}

com.sppad.fstbh.PrefListener.prototype.observe = function(subject, topic, data) {
    if (topic == 'nsPref:changed')
        this._callback(this._branch, data);
};

/**
 * @param {boolean=}
 *            trigger if true triggers the registered function on registration,
 *            that is, when this method is called.
 */
com.sppad.fstbh.PrefListener.prototype.register = function(trigger) {
    this._branch.addObserver('', this, false);
    if (trigger) {
        let that = this;
        this._branch.getChildList('', {}).forEach(function(pref_leaf_name) {
            that._callback(that._branch, pref_leaf_name);
        });
    }
};

com.sppad.fstbh.PrefListener.prototype.unregister = function() {
    if (this._branch)
        this._branch.removeObserver('', this);
};

com.sppad.fstbh.CurrentPrefs = {};

com.sppad.fstbh.Preferences = new function() {

    let self = this;

    self._eventSupport = new com.sppad.fstbh.EventSupport();
    self._EVENT_PREFERENCE_CHANGED = 'EVENT_PREFERENCE_CHANGED';

    /** Listens for prefs changes in order to record them, fire event */
    self._myListener = new com.sppad.fstbh.PrefListener(
            com.sppad.fstbh.PREF_BRANCH, function(branch, name) {
                com.sppad.fstbh.CurrentPrefs[name] = _getPreference(branch,
                        name);

                self._eventSupport.fire({
                    'name' : name,
                    'value' : com.sppad.fstbh.CurrentPrefs[name]
                }, self._EVENT_PREFERENCE_CHANGED);
            });

    /**
     * Sets the current preferences for a given branch.
     * 
     * @param prefBranch
     *            The branch to set preferences for, e.g. extension.mine.
     * @param prefs
     *            A javascript object containing key-value pairs mapping to
     *            preferences and their values. Objects and their keys/values
     *            map to sub-branches.
     */
    let _setPrefBranch = function(prefBranch, prefs) {
        let branch = Services.prefs.getBranch(prefBranch);
        for (let[key, val] in Iterator(prefs)) {
            switch (typeof val) {
                case "boolean":
                    branch.setBoolPref(key, val);
                    break;
                case "number":
                    branch.setIntPref(key, val);
                    break;
                case "string":
                    branch.setCharPref(key, val);
                    break;
                case "object":
                    _setPrefBranch(prefBranch + key + ".", val);
                    break;
            }
        }
    };

    /**
     * Sets the default preferences for a given branch.
     * 
     * @param prefBranch
     *            The branch to set preferences for, e.g. extension.mine.
     * @param prefs
     *            A javascript object containing key-value pairs mapping to
     *            preferences and their values. Objects and their keys/values
     *            map to sub-branches.
     */
    let _setDefaultPrefBranch = function(prefBranch, prefs) {
        let branch = Services.prefs.getDefaultBranch(prefBranch);
        for (let[key, val] in Iterator(prefs)) {
            switch (typeof val) {
                case "boolean":
                    branch.setBoolPref(key, val);
                    break;
                case "number":
                    branch.setIntPref(key, val);
                    break;
                case "string":
                    branch.setCharPref(key, val);
                    break;
                case "object":
                    _setDefaultPrefBranch(prefBranch + key + ".", val);
                    break;
            }
        }
    };

    let _getPreference = function(branch, preference) {

        switch (branch.getPrefType(preference)) {
            case Services.prefs.PREF_BOOL:
                return branch.getBoolPref(preference);
            case Services.prefs.PREF_INT:
                return branch.getIntPref(preference);
            case Services.prefs.PREF_STRING:
                return branch.getCharPref(preference);
        }
    };

    // No need to unregister, taken care of by unloading the module.
    self._myListener.register(true);

    // Set the default preferences.
    _setDefaultPrefBranch(com.sppad.fstbh.PREF_BRANCH, com.sppad.fstbh.PREFS);

    return {

        EVENT_PREFERENCE_CHANGED : self._EVENT_PREFERENCE_CHANGED,

        /**
         * Sets a preference to the given value
         * 
         * @param preference
         *            The preference key set
         * @param value
         *            The value to set for the preference
         */
        setPreference : function(preference, value) {
            let obj = {};
            obj[preference] = value;

            _setPrefBranch(com.sppad.fstbh.PREF_BRANCH, obj);
        },

        /**
         * Gets the value of a preference
         * 
         * @param preference
         *            The preference to get
         */
        getPreference : function(preference) {
            let branch = Services.prefs.getBranch(com.sppad.fstbh.PREF_BRANCH);
            return _getPreference(branch, preference);
        },

        /**
         * Toggles a boolean preference to have the opposite of the current
         * value.
         * 
         * @param preference
         *            The preference key to toggle
         */
        togglePreference : function(preference) {
            this.setPreference(preference, !this.getPreference(preference));
        },

        /**
         * Opens a preferences window. Note that on non-Windows platforms, it is
         * possible to have a window created here open as well as one from the
         * addons manager.
         * 
         * @param aWindow
         *            A window object to use for opening up the preferences
         *            dialog.
         */
        openPreferences : function(aWindow) {
            if (this._preferencesWindow == null
                    || this._preferencesWindow.closed) {
                let instantApply = _getPreference(Services.prefs
                        .getBranch('browser.preferences.'), 'instantApply');
                let features = "chrome,titlebar,toolbar,centerscreen"
                        + (instantApply ? ",dialog=no" : ",modal");
                this._preferencesWindow = aWindow.openDialog(
                        com.sppad.fstbh.PREF_WINDOW_FILE,
                        com.sppad.fstbh.PREF_WINDOW_ID, features);
            }

            this._preferencesWindow.focus();
        },

        cleanup : function() {
            self._myListener.unregister();
        },

        addListener : function(listener, type) {
            self._eventSupport.addListener(listener, type);
        },
        removeListener : function(listener, type) {
            self._eventSupport.removeListener(listener, type);
        },
    }
};