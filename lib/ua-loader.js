// lib/ua-loader.js

const fs = require('fs');
const path = require('path');

const userAgents = {
  mobile: [],
  desktop: [],
  tablet: []
};

try {
  const raw = fs.readFileSync(path.join(__dirname, 'user-agents-min.json'), 'utf8');
  const parsed = JSON.parse(raw);

  if (Array.isArray(parsed)) {
    parsed.forEach(ua => {
      if (ua.includes('iPad') || ua.includes('Tablet')) {
        userAgents.tablet.push(ua);
      } else if (ua.includes('Mobile') || ua.includes('iPhone') || ua.includes('Android')) {
        userAgents.mobile.push(ua);
      } else {
        userAgents.desktop.push(ua);
      }
    });
    console.log(`✅ Cargados desde lista plana: ${parsed.length} User-Agents`);
  } else {
    userAgents.mobile = parsed.mobile || [];
    userAgents.desktop = parsed.desktop || [];
    userAgents.tablet = parsed.tablet || [];
    console.log(`✅ Cargados desde estructura por tipo`);
  }
} catch (error) {
  console.error("❌ Error cargando User-Agents:", error.message);
  userAgents.mobile = [
    'Mozilla/5.0 (iPhone; CPU iPhone OS 16_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.4 Mobile/15E148 Safari/604.1',
    'Mozilla/5.0 (Linux; Android 13; Pixel 7 Pro) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.6367.82 Mobile Safari/537.36'
  ];
  userAgents.desktop = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
  ];
}

module.exports = {
  getRandomUA: (deviceType = 'mobile') => {
    const pool = userAgents[deviceType] || userAgents.mobile;
    return pool[Math.floor(Math.random() * pool.length)];
  },
  getDeviceFromUA: (ua) => {
    if (ua.includes('iPad') || ua.includes('Tablet')) return 'tablet';
    if (ua.includes('Mobile') || ua.includes('iPhone') || ua.includes('Android')) return 'mobile';
    return 'desktop';
  }
};

