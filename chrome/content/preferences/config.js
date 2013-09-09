if (typeof com == "undefined") {
    var com = {};
}

com.sppad = com.sppad || {};
com.sppad.fstbh = com.sppad.fstbh || {};

com.sppad.fstbh.Config = new function() {
    let self = this;
    
    this.init = function() {
        self.transitionPropertyChange();
    };
    
    /**
     * Disables the transition timing items if the user selects no transition
     * animation.
     */
    this.transitionPropertyChange = function() {
        let td = document.getElementById('transitionDisabled').selected;
        
        for(node of document.querySelectorAll('[transitionRequired]')) {
            if(node.getAttribute('transitionRequired') == "true" ? td : !td)
                node.setAttribute('disabled', true);
            else
                node.removeAttribute('disabled');
        }
    };
}



com.sppad.fstbh.Config.init();