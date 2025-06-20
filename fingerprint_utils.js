const viewports = [
  { width: 375, height: 812, deviceScaleFactor: 3 },
  { width: 414, height: 896, deviceScaleFactor: 2 },
  { width: 360, height: 800, deviceScaleFactor: 3 },
  { width: 768, height: 1024, deviceScaleFactor: 2 }
];

const idiomas = ['es-MX', 'en-US', 'fr-FR', 'pt-BR', 'de-DE'];
const timezones = ['America/Mexico_City', 'Europe/Paris', 'Asia/Kolkata', 'Australia/Sydney'];

module.exports.generarFingerprint = () => {
  const random = arr => arr[Math.floor(Math.random() * arr.length)];
  
  return {
    userAgent: random([
      'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1',
      'Mozilla/5.0 (Linux; Android 14; SM-G991B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36',
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36 Edg/126.0.0.0'
    ]),
    viewport: random(viewports),
    language: random(idiomas),
    timezoneId: random(timezones),
    headers: {
      'Accept-Language': `${random(idiomas)};q=0.9,en;q=0.8`,
    }
  };
};
