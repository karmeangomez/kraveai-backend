import UserAgent from 'user-agents';

// Lista ampliada de user agents
const userAgentOptions = {
  platform: ['Windows', 'Mac', 'Linux'],
  browser: ['Chrome', 'Firefox', 'Safari', 'Edge'],
  deviceCategory: ['desktop', 'mobile'],
};

// Lista ampliada de resoluciones
const resolutions = [
  { width: 1920, height: 1080 },
  { width: 1366, height: 768 },
  { width: 1600, height: 900 },
  { width: 1440, height: 900 },
  { width: 1536, height: 864 },
  { width: 1280, height: 720 },
  { width: 2560, height: 1440 }
];

// Timezones por país
const timezones = {
  'RU': ['Europe/Moscow', 'Asia/Yekaterinburg', 'Asia/Vladivostok'],
  'US': ['America/New_York', 'America/Los_Angeles', 'America/Chicago'],
  'GB': ['Europe/London'],
  'DE': ['Europe/Berlin']
};

// Lenguajes por país
const languages = {
  'RU': 'ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7',
  'US': 'en-US,en;q=0.9',
  'GB': 'en-GB,en;q=0.9',
  'DE': 'de-DE,de;q=0.9,en-US;q=0.8,en;q=0.7'
};

export function generateRussianFingerprint() {
  const ua = new UserAgent({ deviceCategory: 'desktop', browser: 'Chrome' });
  const tz = timezones['RU'][Math.floor(Math.random() * timezones['RU'].length)];
  return {
    userAgent: ua.toString(),
    screen: getRandomResolution(),
    language: languages['RU'],
    timezone: tz,
    platform: getRandomPlatform()
  };
}

export function generateAdaptiveFingerprint(country = 'RU') {
  if (country === 'RU') return generateRussianFingerprint();
  // Extensible para otros países
  const ua = new UserAgent();
  const tz = timezones[country] ? timezones[country][Math.floor(Math.random() * timezones[country].length)] : 'UTC';
  const lang = languages[country] || 'en-US,en;q=0.9';
  return {
    userAgent: ua.toString(),
    screen: getRandomResolution(),
    language: lang,
    timezone: tz,
    platform: getRandomPlatform()
  };
}

function getRandomResolution() {
  return resolutions[Math.floor(Math.random() * resolutions.length)];
}

function getRandomPlatform() {
  const platforms = ['Win32', 'Win64', 'Linux x86_64', 'MacIntel'];
  return platforms[Math.floor(Math.random() * platforms.length)];
}
