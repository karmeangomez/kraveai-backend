const viewports = [
  // Móviles (70%)
  { width: 393, height: 852, deviceScaleFactor: 3, isMobile: true }, // iPhone 15 Pro
  { width: 360, height: 800, deviceScaleFactor: 3, isMobile: true }, // Galaxy S22
  // Tablets (20%)
  { width: 820, height: 1180, deviceScaleFactor: 2, isMobile: true }, // iPad Air
  // Escritorio (10%)
  { width: 1920, height: 1080, deviceScaleFactor: 1, isMobile: false }
];

const languages = ['es-ES', 'es-MX', 'en-US', 'pt-BR', 'fr-FR', 'de-DE'];
const timezones = {
  'es-ES': 'Europe/Madrid',
  'es-MX': 'America/Mexico_City',
  'en-US': 'America/New_York',
  'pt-BR': 'America/Sao_Paulo',
  'fr-FR': 'Europe/Paris',
  'de-DE': 'Europe/Berlin'
};

const hardwareProfiles = {
  mobile: {
    deviceMemory: [4, 6, 8],
    hardwareConcurrency: [4, 6],
    webglVendor: ['Apple Inc.', 'ARM'],
    webglRenderer: ['Apple GPU', 'Mali-G78']
  },
  desktop: {
    deviceMemory: [8, 16],
    hardwareConcurrency: [8, 12],
    webglVendor: ['NVIDIA Corporation', 'Intel'],
    webglRenderer: ['GeForce RTX 3080', 'Intel Iris Xe']
  }
};

module.exports.generarFingerprint = () => {
  const random = arr => arr[Math.floor(Math.random() * arr.length)];
  
  // 1. Seleccionar perfil (móvil/escritorio)
  const viewport = random(viewports);
  const isMobile = viewport.isMobile;
  const profileType = isMobile ? 'mobile' : 'desktop';
  
  // 2. User Agent específico por dispositivo
  const userAgents = {
    mobile: [
      'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1',
      'Mozilla/5.0 (Linux; Android 14; SM-S911B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36'
    ],
    desktop: [
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_5) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15'
    ]
  };
  
  // 3. Idioma y timezone coherentes
  const language = random(languages);
  const timezoneId = timezones[language];
  
  return {
    userAgent: random(userAgents[profileType]),
    viewport: {
      width: viewport.width,
      height: viewport.height,
      deviceScaleFactor: viewport.deviceScaleFactor,
      isMobile: viewport.isMobile
    },
    language,
    timezoneId,
    deviceMemory: random(hardwareProfiles[profileType].deviceMemory),
    hardwareConcurrency: random(hardwareProfiles[profileType].hardwareConcurrency),
    webglVendor: random(hardwareProfiles[profileType].webglVendor),
    webglRenderer: random(hardwareProfiles[profileType].webglRenderer)
  };
};
