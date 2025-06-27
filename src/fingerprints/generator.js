import UserAgent from 'user-agents';

export function generateRussianFingerprint() {
  const ua = new UserAgent(); // Eliminado el filtro /Chrome/ para evitar errores
  return {
    userAgent: ua.toString(),
    screen: getRandomResolution(),
    language: 'ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7',
    timezone: 'Europe/Moscow',
    platform: getRandomPlatform()
  };
}

export function generateAdaptiveFingerprint(country = 'RU') {
  return generateRussianFingerprint();
}

function getRandomResolution() {
  const resolutions = [
    { width: 1920, height: 1080 },
    { width: 1366, height: 768 },
    { width: 1600, height: 900 },
    { width: 1440, height: 900 },
    { width: 1536, height: 864 }
  ];
  return resolutions[Math.floor(Math.random() * resolutions.length)];
}

function getRandomPlatform() {
  const platforms = ['Win32', 'Win64', 'Linux x86_64', 'MacIntel'];
  return platforms[Math.floor(Math.random() * platforms.length)];
}
