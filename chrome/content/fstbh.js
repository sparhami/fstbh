if (typeof com == "undefined") {
    var com = {};
}

com.sppad = com.sppad || {};
com.sppad.fstbh = com.sppad.fstbh || {};

com.sppad.fstbh.Main = new function() {

    const MILLISECONDS_PER_SECOND = 1000;
    
    let self = this;
    
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
     * limitation is that if the persona changes while in fullscreen, the
     * change will not be seen until exiting fullscreen.
     */
    this.fullscreenChange = function() {
        
        // Event occurs before the fullscreen is set, so take the opposite
        let enter = !window.fullScreen;
        
        if(enter)
            this.setupPersona();
        else
            this.clearoutPersona();
        
    };
    
    this.setupPersona = function() {
        let mainWindow = document.getElementById('main-window');
        let element = document.getElementById('navigator-toolbox');
        
        element.style.color =  mainWindow.style.backgroundImage;
        element.style.backgroundColor =  mainWindow.style.backgroundColor;
        element.style.backgroundImage =  mainWindow.style.backgroundImage;
        
    };
    
    this.clearoutPersona = function() {
        let element = document.getElementById('navigator-toolbox');
        
        element.style.color =  '';
        element.style.backgroundColor = '';
        element.style.backgroundImage = '';
    };
    
    this.setTransitionDuration = function(value) {
        let transitionDuration = (value / MILLISECONDS_PER_SECOND) + 's';
        
        let nav = document.getElementById('navigator-toolbox');
        nav.style.transitionDuration = transitionDuration;
    };
    
    this.setTransitionDelay = function(value) {
        let transitionDelay = (value / MILLISECONDS_PER_SECOND) + 's';
        
        let nav = document.getElementById('navigator-toolbox');
        nav.style.transitionDelay = transitionDelay;
    };

    this.handleEvent = function(aEvent) {

        switch (aEvent.type) {
            case com.sppad.fstbh.Preferences.EVENT_PREFERENCE_CHANGED:
                return this.prefChanged(aEvent.name, aEvent.value);
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
            default:
                break;
        }
    };

    this.loadPreferences = function() {
        this.prefChanged('transitionDelay', com.sppad.fstbh.CurrentPrefs['transitionDelay']);
        this.prefChanged('transitionDuration', com.sppad.fstbh.CurrentPrefs['transitionDuration']);
    };
    
    this.setup = function() {
        
        com.sppad.fstbh.Preferences.addListener(this);
        
        this.loadPreferences();
        this.moveNavigatorToolbox();
    };

};

window.addEventListener("load", function() {
    com.sppad.fstbh.Main.setup();
}, false);

window.addEventListener("fullscreen", function () {
    com.sppad.fstbh.Main.fullscreenChange();
}, false);
