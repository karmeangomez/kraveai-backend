const fs = require('fs');
const path = require('path');

const userAgents = { mobile: [], desktop: [], tablet: [] };

try {
  const raw = fs.readFileSync(path.join(__dirname, 'user-agents-min.json'), 'utf8');
  const parsed = JSON.parse(raw);

  if (Array.isArray(parsed)) {
    parsed.forEach(ua => {
      if (ua.includes('iPad') || ua.includes('Tablet')) userAgents.tablet.push(ua);
      else if (ua.includes('Mobile') || ua.includes('iPhone') || ua.includes('Android')) userAgents.mobile.push(ua);
      else userAgents.desktop.push(ua);
    });
    console.log(`✅ Cargados desde lista plana: ${parsed.length} User-Agents`);
  }
} catch (error) {
  console.error("❌ Error cargando User-Agents:", error.message);
  userAgents.mobile = [
    'Mozilla/5.0 (iPhone; CPU iPhone OS 16_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.4 Mobile/15E148 Safari/604.1'
  ];
}

module.exports = {
  getRandomUA: (deviceType = 'mobile') => {
    const pool = userAgents[deviceType] || userAgents.mobile;
    return pool[Math.floor(Math.random() * pool.length)];
  }
};
