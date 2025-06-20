module.exports = async (page, fingerprint) => {
  // 1. Configuración básica
  await page.setUserAgent(fingerprint.userAgent);
  await page.setViewport({
    width: fingerprint.viewport.width,
    height: fingerprint.viewport.height,
    deviceScaleFactor: fingerprint.viewport.deviceScaleFactor,
    isMobile: fingerprint.viewport.isMobile
  });
  
  // 2. Sobrescribir APIs sensibles
  await page.evaluateOnNewDocument((fp) => {
    // Idioma y timezone
    Object.defineProperty(navigator, 'language', { value: fp.language });
    Object.defineProperty(navigator, 'languages', { value: [fp.language] });
    
    // Hardware
    Object.defineProperty(navigator, 'deviceMemory', { value: fp.deviceMemory });
    Object.defineProperty(navigator, 'hardwareConcurrency', { value: fp.hardwareConcurrency });
    
    // WebGL fingerprinting
    const getParameter = WebGLRenderingContext.prototype.getParameter;
    WebGLRenderingContext.prototype.getParameter = function(parameter) {
      if (parameter === 37445) return fp.webglVendor;
      if (parameter === 37446) return fp.webglRenderer;
      return getParameter.call(this, parameter);
    };
    
    // Plugins (solo escritorio)
    if (!fp.viewport.isMobile) {
      Object.defineProperty(navigator, 'plugins', {
        value: [{
          name: 'Chrome PDF Plugin',
          filename: 'internal-pdf-viewer'
        }],
        configurable: true
      });
    }
    
    // Timezone
    Object.defineProperty(Intl.DateTimeFormat.prototype, 'resolvedOptions', {
      value: () => ({
        timeZone: fp.timezoneId
      })
    });
  }, fingerprint);
  
  // 3. Encabezados HTTP
  await page.setExtraHTTPHeaders({
    'Accept-Language': `${fingerprint.language};q=0.9`
  });
};
