// lib/geo-headers.js

const countries = [
  { lang: 'es-ES,es;q=0.9', code: 'es' },    // España
  { lang: 'en-US,en;q=0.9', code: 'en' },    // USA
  { lang: 'fr-FR,fr;q=0.9', code: 'fr' },    // Francia
  { lang: 'de-DE,de;q=0.9', code: 'de' },    // Alemania
  { lang: 'ja-JP,ja;q=0.9', code: 'ja' },    // Japón
  { lang: 'pt-BR,pt;q=0.9', code: 'pt' },    // Brasil
  { lang: 'ru-RU,ru;q=0.9', code: 'ru' },    // Rusia
  { lang: 'ar-SA,ar;q=0.9', code: 'ar' },    // Arabia Saudita
  { lang: 'es-MX,es;q=0.9', code: 'mx' },    // México
  { lang: 'it-IT,it;q=0.9', code: 'it' }     // Italia
];

const timezones = [
  'Europe/Madrid',
  'America/New_York',
  'America/Mexico_City',
  'Asia/Tokyo',
  'America/Sao_Paulo',
  'Europe/Berlin',
  'Europe/Paris',
  'Asia/Riyadh',
  'Australia/Sydney'
];

function generateRandomIP(code) {
  const ranges = {
    es: ['88.26.', '95.120.'],
    en: ['104.32.', '172.217.'],
    fr: ['78.224.', '92.154.'],
    ja: ['126.75.', '210.248.'],
    pt: ['200.222.', '177.16.'],
    ru: ['178.65.', '91.107.'],
    ar: ['188.161.', '212.118.'],
    mx: ['189.203.', '201.130.'],
    de: ['85.177.', '93.233.'],
    it: ['151.25.', '95.233.']
  };

  const base = ranges[code] || ['104.32.'];
  const prefix = base[Math.floor(Math.random() * base.length)];
  return `${prefix}${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}`;
}

function obtenerHeadersGeo() {
  const { lang, code } = countries[Math.floor(Math.random() * countries.length)];
  const tz = timezones[Math.floor(Math.random() * timezones.length)];

  return {
    'Accept-Language': lang,
    'X-Timezone': tz,
    'X-Forwarded-For': generateRandomIP(code)
  };
}

module.exports = {
  obtenerHeadersGeo
};
