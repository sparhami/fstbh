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
    
    this.transitionPropertyChange = function() {
        let timingDisabled = document.getElementById('transitionDisabled').selected;
        
        let nodes = document.getElementsByClassName('transitionTiming');
        for(let i=0; i<nodes.length; i++) {
            if(timingDisabled)
                nodes[i].setAttribute('disabled', timingDisabled);
            else
                nodes[i].removeAttribute('disabled');
        }
    };
}



com.sppad.fstbh.Config.init();