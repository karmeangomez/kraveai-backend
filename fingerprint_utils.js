// fingerprint_utils.js
const randomUserAgent = require('random-useragent');

const mobileDevices = [
  {
    name: 'iPhone 13 Pro',
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
    viewport: { width: 390, height: 844, deviceScaleFactor: 3 },
    platform: 'iPhone',
    mobile: true,
    webglVendor: 'Apple Inc.',
    webglRenderer: 'Apple A16 GPU',
    maxTouchPoints: 5
  },
  {
    name: 'Galaxy S21',
    userAgent: 'Mozilla/5.0 (Linux; Android 14; SM-G991B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36',
    viewport: { width: 412, height: 915, deviceScaleFactor: 3 },
    platform: 'Linux armv8l',
    mobile: true,
    webglVendor: 'ARM',
    webglRenderer: 'Mali-G78 MP14',
    maxTouchPoints: 5
  },
  {
    name: 'Xiaomi Redmi Note 11',
    userAgent: 'Mozilla/5.0 (Linux; Android 13; Redmi Note 11) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Mobile Safari/537.36',
    viewport: { width: 393, height: 873, deviceScaleFactor: 2.75 },
    platform: 'Linux armv8l',
    mobile: true,
    webglVendor: 'Qualcomm',
    webglRenderer: 'Adreno 610',
    maxTouchPoints: 5
  }
];

const desktopViewports = [
  { width: 1366, height: 768 },
  { width: 1440, height: 900 },
  { width: 1920, height: 1080 }
];

const languagesTimezones = [
  { language: 'es-MX', timezoneId: 'America/Mexico_City' },
  { language: 'en-US', timezoneId: 'America/New_York' },
  { language: 'fr-FR', timezoneId: 'Europe/Paris' },
  { language: 'de-DE', timezoneId: 'Europe/Berlin' },
  { language: 'pt-BR', timezoneId: 'America/Sao_Paulo' },
  { language: 'it-IT', timezoneId: 'Europe/Rome' }
];

function generateFingerprint() {
  const isMobile = Math.random() > 0.4; // 60% móviles, 40% desktop

  if (isMobile) {
    const device = mobileDevices[Math.floor(Math.random() * mobileDevices.length)];
    const langZone = languagesTimezones[Math.floor(Math.random() * languagesTimezones.length)];
    return {
      ...device,
      language: langZone.language,
      timezoneId: langZone.timezoneId,
      connectionType: Math.random() > 0.5 ? '4g' : '3g'
    };
  } else {
    const ua = randomUserAgent.getRandom(ua => ua.deviceType !== 'mobile' && ua.deviceType !== 'tablet');
    const viewport = desktopViewports[Math.floor(Math.random() * desktopViewports.length)];
    const langZone = languagesTimezones[Math.floor(Math.random() * languagesTimezones.length)];
    const desktopVendors = [
      { vendor: 'Intel Inc.', renderer: 'Intel Iris OpenGL' },
      { vendor: 'NVIDIA Corporation', renderer: 'NVIDIA GeForce GTX 1050 Ti' },
      { vendor: 'AMD', renderer: 'Radeon RX Vega' }
    ];
    const webgl = desktopVendors[Math.floor(Math.random() * desktopVendors.length)];

    return {
      userAgent: ua,
      viewport: { ...viewport, deviceScaleFactor: 1 },
      language: langZone.language,
      timezoneId: langZone.timezoneId,
      platform: 'Win32',
      mobile: false,
      webglVendor: webgl.vendor,
      webglRenderer: webgl.renderer,
      maxTouchPoints: 0,
      connectionType: 'ethernet'
    };
  }
}

module.exports = { generateFingerprint };
