const fs = require('fs').promises;
const path = require('path');

async function loadCookies(filePath) {
  try {
    const data = await fs.readFile(filePath, 'utf8');
    const cookies = JSON.parse(data);
    if (!Array.isArray(cookies)) {
      console.warn('[Cookies] Formato de cookies inválido en:', filePath);
      return [];
    }
    const hasSession = cookies.some(c => ['sessionid', 'csrftoken', 'mid'].includes(c.name) && 
      (!c.expires || c.expires * 1000 > Date.now()));
    if (hasSession) {
      console.log('[Cookies] Cookies válidas cargadas desde:', filePath);
      return cookies;
    }
    console.warn('[Cookies] No se encontraron cookies válidas en:', filePath);
    return [];
  } catch (err) {
    console.warn('[Cookies] Error cargando cookies:', err.message);
    return [];
  }
}

async function saveCookies(cookies, filePath) {
  try {
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, JSON.stringify(cookies, null, 2));
    console.log('[Cookies] Cookies guardadas en:', filePath);
  } catch (err) {
    console.error('[Cookies] Error guardando cookies:', err.message);
  }
}

module.exports = { loadCookies, saveCookies };
