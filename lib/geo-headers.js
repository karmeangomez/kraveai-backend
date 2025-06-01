// lib/geo-headers.js

const countries = [
  'es-ES,es;q=0.9',       // España
  'en-US,en;q=0.9',       // USA
  'fr-FR,fr;q=0.9',       // Francia
  'de-DE,de;q=0.9',       // Alemania
  'ja-JP,ja;q=0.9',       // Japón
  'pt-BR,pt;q=0.9',       // Brasil
  'ru-RU,ru;q=0.9',       // Rusia
  'ar-SA,ar;q=0.9'        // Arabia Saudita
];

const timezones = [
  'Europe/Madrid',
  'America/New_York',
  'Asia/Tokyo',
  'Australia/Sydney'
];

module.exports = {
  generateGeoHeaders: () => {
    const country = countries[Math.floor(Math.random() * countries.length)];
    const tz = timezones[Math.floor(Math.random() * timezones.length)];
    
    return {
      'Accept-Language': country,
      'X-Timezone': tz,
      'X-Forwarded-For': generateRandomIP(country.split('-')[0])
    };
  }
};

function generateRandomIP(countryCode) {
  const ranges = {
    'es': ['88.26.', '95.120.'],
    'en': ['104.32.', '172.217.'],
    'fr': ['78.224.', '92.154.'],
    'ja': ['126.75.', '210.248.'],
    'pt': ['200.222.', '177.16.'],
    'ru': ['178.65.', '91.107.'],
    'ar': ['188.161.', '212.118.']
  };
  
  const base = ranges[countryCode] || ranges['en'];
  const prefix = base[Math.floor(Math.random() * base.length)];
  return `${prefix}${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}`;
}
