// touchEmulator.js
module.exports = async function emulateTouch(page) {
  await page.evaluateOnNewDocument(() => {
    try {
      // Simular entorno táctil
      Object.defineProperty(navigator, 'maxTouchPoints', { get: () => 5 });

      // Simular plataforma móvil
      Object.defineProperty(navigator, 'platform', { get: () => 'iPhone' });

      // Simular compatibilidad de API táctil
      window.ontouchstart = true;
      window.ontouchend = true;

      // Simular soporte para TouchEvent
      window.TouchEvent = function () {};
      window.Touch = function () {};
      window.TouchList = function () {};

      if (typeof document.createTouch === 'undefined') {
        document.createTouch = () => ({ identifier: Date.now(), target: null });
      }

      // userAgentData mobile = true
      if (navigator.userAgentData) {
        Object.defineProperty(navigator.userAgentData, 'mobile', {
          get: () => true
        });
      }

      // Simular sensores disponibles
      navigator.mediaDevices = {
        getUserMedia: async () => ({
          getTracks: () => []
        })
      };

    } catch (e) {
      console.warn('⚠️ Touch emulation failed:', e.message);
    }
  });
};
