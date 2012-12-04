if (typeof com == "undefined") {
    var com = {};
}

com.sppad = com.sppad || {};
com.sppad.fstbh = com.sppad.fstbh || {};

com.sppad.fstbh.Main = new function() {

    const MILLISECONDS_PER_SECOND = 1000;
    
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
    };

};

window.addEventListener("load", function() {

    let nav = document.getElementById('navigator-toolbox');
    let wrapper = document.getElementById('com_sppad_fstbh_topChromeWrapper');

    wrapper.appendChild(nav);

    com.sppad.fstbh.Main.setup();

}, false);
