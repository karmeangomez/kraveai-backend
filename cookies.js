const fs = require('fs').promises;

async function loadCookies(filePath) {
  try {
    const data = await fs.readFile(filePath, 'utf8');
    const cookies = JSON.parse(data);
    const session = cookies.find(c => c.name === 'sessionid');
    const valid = session && (!session.expires || session.expires * 1000 > Date.now());
    if (valid) {
      return cookies;
    }
  } catch (_) {
    // no hay cookies válidas
  }
  return [];
}

async function saveCookies(cookies, filePath) {
  try {
    await fs.mkdir(require('path').dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, JSON.stringify(cookies, null, 2));
    console.log('[Cookies] Cookies guardadas correctamente');
  } catch (err) {
    console.error('❌ Error guardando cookies:', err.message);
  }
}

module.exports = {
  loadCookies,
  saveCookies
};
