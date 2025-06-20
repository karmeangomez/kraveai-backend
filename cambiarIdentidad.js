// cambiarIdentidad.js
const injectNoise = require('./noiseInjector');
const emulateNetwork = require('./networkEmulator');
const emulateTouch = require('./touchEmulator');

module.exports = async function cambiarIdentidad(page, fingerprint) {
  try {
    // Verificar que el fingerprint tenga los campos necesarios
    const requiredFields = [
      'userAgent',
      'viewport',
      'language',
      'timezoneId',
      'platform',
      'mobile',
      'webglVendor',
      'webglRenderer',
      'maxTouchPoints',
      'connectionType'
    ];

    const missing = requiredFields.filter(field => !(field in fingerprint));
    if (missing.length > 0) {
      throw new Error(`Fingerprint incompleto. Faltan: ${missing.join(', ')}`);
    }

    // Aplicar User-Agent
    await page.setUserAgent(fingerprint.userAgent);

    // Configurar Viewport y modo móvil
    await page.setViewport({
      width: fingerprint.viewport.width,
      height: fingerprint.viewport.height,
      deviceScaleFactor: fingerprint.viewport.deviceScaleFactor || 1,
      isMobile: fingerprint.mobile,
      hasTouch: fingerprint.maxTouchPoints > 0
    });

    // Encabezados adicionales
    await page.setExtraHTTPHeaders({
      'Accept-Language': fingerprint.language
    });

    // Emular conexión de red
    await emulateNetwork(page, fingerprint.connectionType);

    // Emular entorno táctil si aplica
    if (fingerprint.mobile || fingerprint.maxTouchPoints > 0) {
      await emulateTouch(page);
    }

    // Inyectar ruido antifingerprint
    await injectNoise(page, fingerprint);

  } catch (error) {
    console.error(`❌ Error aplicando fingerprint: ${error.message}`);
    throw error;
  }
};
