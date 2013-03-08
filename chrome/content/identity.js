if (typeof com == "undefined") {
    var com = {};
}

com.sppad = com.sppad || {};
com.sppad.fstbh = com.sppad.fstbh || {};

com.sppad.fstbh.Identity = new function() {
    
    /** Additional right padding, beyond hiding start point before showing */
    const IDENTITY_BOX_SHOW_PADDING_RIGHT = 25;
    
    /** Additional bottom padding, beyond hiding start point before showing */
    const IDENTITY_BOX_SHOW_PADDING_BOTTOM = 25;
    
    let self = this;
    self.entered = false;
    
    self.setup = function() {
        let sslBox = document.getElementById('com_sppad_fstbh_ssl_info_boundry');
        sslBox.addEventListener('mouseenter', self.mouseenter, false);
    };
    
    self.updateState = function(aState) {
        let sslCA = document.getElementById('com_sppad_fstbh_ssl_info_ca');
        let sslDomain = document.getElementById('com_sppad_fstbh_ssl_info_domain');
        let location = gBrowser.contentWindow.location;
        
        try {
            sslDomain.value = location.host;
        } catch(err) {
            sslDomain.value = '';
        }
        
        try {
            sslCA.value = self.getCertName();
        } catch(err) {
            sslCA.value = '';
        }
        
        let nsIWebProgressListener = Ci.nsIWebProgressListener;
        if (location.protocol == "chrome:" || location.protocol == "about:")
            self.setIdentityState(gIdentityHandler.IDENTITY_MODE_CHROMEUI);
        else if (aState & nsIWebProgressListener.STATE_IDENTITY_EV_TOPLEVEL)
            self.setIdentityState(gIdentityHandler.IDENTITY_MODE_IDENTIFIED);
        else if (aState & nsIWebProgressListener.STATE_IS_SECURE)
            self.setIdentityState(gIdentityHandler.IDENTITY_MODE_DOMAIN_VERIFIED);
        else if (aState & nsIWebProgressListener.STATE_IS_BROKEN)
            self.setIdentityState(gIdentityHandler.IDENTITY_MODE_MIXED_CONTENT);
        else
            self.setIdentityState(gIdentityHandler.IDENTITY_MODE_UNKNOWN);
    };
    
    self.setIdentityState = function(identityMode) {
        let sslInfo = document.getElementById('com_sppad_fstbh_ssl_info');
        sslInfo.setAttribute('class', identityMode);
    };
    
    self.getCertName = function() {
        let currentStatus = gBrowser.securityUI
            .QueryInterface(Components.interfaces.nsISSLStatusProvider)
            .SSLStatus;
        
        let cert = currentStatus.serverCert;
        let caOrg = cert.issuerOrganization || cert.issuerCommonName;
        
        return caOrg;
        
    };
    
    self.mouseenter = function(aEvent) {
        if(self.entered)
            return;
        
        let sslBox = document.getElementById('com_sppad_fstbh_ssl_info_boundry');

        self.tripX = sslBox.boxObject.screenX + sslBox.boxObject.width + IDENTITY_BOX_SHOW_PADDING_RIGHT;
        self.tripY = sslBox.boxObject.screenY + sslBox.boxObject.height + IDENTITY_BOX_SHOW_PADDING_BOTTOM;
        
        window.addEventListener('mousemove', self.mousemove, false);
        sslBox.setAttribute('hiding', true);
        sslBox.style.marginLeft = -sslBox.boxObject.width + 'px';
        self.entered = true;
    };
    
    self.mousemove = function(aEvent) {
        if(aEvent.screenX < self.tripX && aEvent.screenY < self.tripY)
            return;
      
        let sslBox = document.getElementById('com_sppad_fstbh_ssl_info_boundry');
        
        window.removeEventListener('mousemove', self.mousemove);
        sslBox.removeAttribute('hiding');
        sslBox.style.marginLeft = '';
        self.entered = false;
    };
}

window.addEventListener("load", function() {
    com.sppad.fstbh.Identity.setup();
}, false);
