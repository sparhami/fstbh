/**
 * Handles an box showing the SSL cert issuer and domain. Hides when the mouse
 * approaches it so that the area of the browser is not rendered unusable.
 */
com.sppad.fstbh.Identity = new function() {
    
    /** Additional right padding, beyond hiding start point before showing again */
    const IDENTITY_BOX_SHOW_PADDING_RIGHT = 25;
    
    /** Additional bottom padding, beyond hiding start point before showing again */
    const IDENTITY_BOX_SHOW_PADDING_BOTTOM = 25;
    
    let self = this;
    
    self.entered = false;

    // Coordinate for showing the identity box after hiding
    self.tripX = 0;
    self.tripY = 0;
    
    self.setup = function() {
        let sslBox = document.getElementById('com_sppad_fstbh_ssl_info_boundry');
        sslBox.addEventListener('mouseenter', self.mouseenter, false);
    };
    
    /**
     * Updates the identity box with the current state, updating the text values and any styling.
     */
    self.updateState = function(aState) {
        let sslCA = document.getElementById('com_sppad_fstbh_ssl_info_ca');
        let sslDomain = document.getElementById('com_sppad_fstbh_ssl_info_domain');
        let location = gBrowser.contentWindow.location;
        
        try {
            sslDomain.value = location.host;
            sslCA.value = self.getCertIssuer();
        } catch(err) {
            sslDomain.value = '';
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
    
    /**
     * Gets the issuer of the SSL certificate for the current site.
     */
    self.getCertIssuer = function() {
        let cert = gBrowser.securityUI
            .QueryInterface(Components.interfaces.nsISSLStatusProvider)
            .SSLStatus
            .serverCert;
        
        return cert.issuerOrganization || cert.issuerCommonName;
    };
    
    /**
     * Hides the identity box when the mouse has entered the boundry area.
     */
    self.mouseenter = function(aEvent) {
        if(self.entered)
            return;
        
        let sslBox = document.getElementById('com_sppad_fstbh_ssl_info_boundry');
        
        self.tripX = sslBox.boxObject.screenX + sslBox.boxObject.width + IDENTITY_BOX_SHOW_PADDING_RIGHT;
        self.tripY = sslBox.boxObject.screenY + sslBox.boxObject.height + IDENTITY_BOX_SHOW_PADDING_BOTTOM;
        
        // Even without extra padding for leaving, can't use mouseleave since 
        // we must set pointer-events: none.
        window.addEventListener('mousemove', self.checkMousePosition, false);
        sslBox.setAttribute('hiding', true);
        self.entered = true;
    };
    
    /**
     * Checks to see if the mouse has moved out of the boundry + padding area.
     */
    self.checkMousePosition = function(aEvent) {
        if(aEvent.screenX < self.tripX && aEvent.screenY < self.tripY)
            return;
      
        let sslBox = document.getElementById('com_sppad_fstbh_ssl_info_boundry');
        
        window.removeEventListener('mousemove', self.checkMousePosition);
        sslBox.removeAttribute('hiding');
        self.entered = false;
    };
}

window.addEventListener("load", function() {
    com.sppad.fstbh.Identity.setup();
}, false);
