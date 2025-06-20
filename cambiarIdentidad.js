// cambiarIdentidad.js
const injectNoise = require('./noiseInjector');

module.exports = async function cambiarIdentidad(page, fingerprint) {
  try {
    // Aplicar user agent
    await page.setUserAgent(fingerprint.userAgent);

    // Aplicar resolución / viewport
    await page.setViewport({
      width: fingerprint.viewport.width,
      height: fingerprint.viewport.height,
      deviceScaleFactor: fingerprint.viewport.deviceScaleFactor || 1,
      isMobile: fingerprint.mobile || false,
      hasTouch: fingerprint.maxTouchPoints > 0
    });

    // Encabezados adicionales
    await page.setExtraHTTPHeaders({
      'Accept-Language': fingerprint.language || 'en-US'
    });

    // Inyección de ruido ruso (spoof de propiedades sospechosas)
    await injectNoise(page, fingerprint);
  } catch (error) {
    console.error(`❌ Error aplicando fingerprint: ${error.message}`);
    throw error;
  }
};
