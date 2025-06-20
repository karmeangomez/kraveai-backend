// noiseInjector.js
module.exports = async function injectNoise(page, fingerprint) {
  await page.evaluateOnNewDocument((fingerprint) => {
    // Falsificar webdriver
    Object.defineProperty(navigator, 'webdriver', { get: () => false });

    // Falsificar idiomas
    Object.defineProperty(navigator, 'languages', {
      get: () => ['es-MX', 'en-US', 'es', 'en']
    });

    // Falsificar número de hilos del CPU (con ruido)
    Object.defineProperty(navigator, 'hardwareConcurrency', {
      get: () => Math.floor(2 + Math.random() * 6)
    });

    // Falsificar memoria RAM del sistema
    Object.defineProperty(navigator, 'deviceMemory', {
      get: () => (Math.random() > 0.5 ? 4 : 2)
    });

    // Plugins falsos
    Object.defineProperty(navigator, 'plugins', {
      get: () => [1, 2, 3, 4, 5]
    });

    // window.chrome spoof
    window.chrome = { runtime: {} };

    // Fonts simuladas
    Object.defineProperty(document, 'fonts', {
      value: ['Roboto', 'Open Sans', 'Arial', 'Helvetica Neue']
    });

    // WebGL Vendor y Renderer falsos
    const getParameter = WebGLRenderingContext.prototype.getParameter;
    WebGLRenderingContext.prototype.getParameter = function (param) {
      if (param === 37445) return fingerprint.webglVendor;
      if (param === 37446) return fingerprint.webglRenderer;
      return getParameter.call(this, param);
    };

    // Permissions spoof (microphone, camera, notifications)
    const originalQuery = window.navigator.permissions.query;
    window.navigator.permissions.query = (parameters) => (
      parameters.name === 'notifications'
        ? Promise.resolve({ state: Notification.permission })
        : originalQuery(parameters)
    );

    // User-Agent Data
    Object.defineProperty(navigator, 'userAgentData', {
      get: () => ({
        brands: [{ brand: "Chromium", version: "113" }],
        mobile: fingerprint.mobile
      })
    });

    // Touch simulation
    Object.defineProperty(navigator, 'maxTouchPoints', {
      get: () => fingerprint.maxTouchPoints || 1
    });

    // Timezone spoof
    const offsetMap = {
      'America/Mexico_City': -360,
      'Europe/Madrid': -120,
      'Asia/Tokyo': -540,
      'America/New_York': -300
    };

    const spoofedOffset = offsetMap[fingerprint.timezoneId] || -360;
    Date.prototype.getTimezoneOffset = () => spoofedOffset;
  }, fingerprint);
};
