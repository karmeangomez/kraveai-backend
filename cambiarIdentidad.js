module.exports = async (page, fingerprint) => {
  await page.setUserAgent(fingerprint.userAgent);
  await page.setViewport(fingerprint.viewport);
  await page.setExtraHTTPHeaders({
    'Accept-Language': fingerprint.headers['Accept-Language']
  });
  
  // Sobrescribir propiedades críticas
  await page.evaluateOnNewDocument((timezone) => {
    // Ocultar WebDriver
    Object.defineProperty(navigator, 'webdriver', { get: () => false });
    
    // Enmascarar plugins
    Object.defineProperty(navigator, 'plugins', { 
      get: () => [1, 2, 3, 4, 5] 
    });
    
    // Modificar huso horario
    Intl.DateTimeFormat = () => {};
    Object.defineProperty(Date.prototype, 'toString', {
      value: () => `Date mocked for ${timezone}`
    });
  }, fingerprint.timezoneId);
};
