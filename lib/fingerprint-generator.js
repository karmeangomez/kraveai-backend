// lib/fingerprint-generator.js

module.exports = {
  applyFingerprint: async (page) => {
    await page.evaluateOnNewDocument(() => {
      // Ocultar webdriver
      Object.defineProperty(navigator, 'webdriver', { get: () => false });

      // Plugins falsos
      Object.defineProperty(navigator, 'plugins', {
        get: () => [1, 2, 3].map(() => ({
          name: Math.random().toString(36).substring(2, 8),
          filename: Math.random().toString(36).substring(2) + '.dll',
          description: '',
        }))
      });

      // Canvas fingerprint alterado
      HTMLCanvasElement.prototype.getContext = new Proxy(
        HTMLCanvasElement.prototype.getContext,
        {
          apply: (target, thisArg, args) => {
            const context = target.apply(thisArg, args);
            if (args[0] === '2d') {
              context.fillText = new Proxy(context.fillText, {
                apply: (txtTarget, txtThis, txtArgs) => {
                  txtArgs[0] += ' ' + Math.random().toString(36).substring(2, 5);
                  return txtTarget.apply(txtThis, txtArgs);
                }
              });
            }
            return context;
          }
        }
      );
    });

    // Resoluciones aleatorias
    const resolutions = [
      { width: 1920, height: 1080 },
      { width: 1366, height: 768 },
      { width: 1536, height: 864 },
      { width: 360, height: 740 },
      { width: 414, height: 896 }
    ];

    const res = resolutions[Math.floor(Math.random() * resolutions.length)];

    await page.setViewport({
      width: res.width,
      height: res.height,
      deviceScaleFactor: Math.random() > 0.5 ? 1 : 2,
      isMobile: Math.random() > 0.5
    });
  }
};
