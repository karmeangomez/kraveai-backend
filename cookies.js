const fs = require('fs').promises;
const path = require('path');

const COOKIE_PATH = path.join(__dirname, 'instagram_cookies.json');
let cookiesCache = [];

async function loadCookies(page) {
  try {
    const data = await fs.readFile(COOKIE_PATH, 'utf8');
    cookiesCache = JSON.parse(data);
    const sessionCookie = cookiesCache.find(c => c.name === 'sessionid');
    if (sessionCookie?.expires > Date.now() / 1000) {
      console.log('[Cookies] Sesión válida encontrada');
      await page.setCookie(...cookiesCache);
      return true;
    }
  } catch (_) {
    console.warn('[Cookies] No se encontraron cookies válidas');
  }
  return false;
}

async function saveCookies(page) {
  try {
    cookiesCache = await page.cookies();
    await fs.writeFile(COOKIE_PATH, JSON.stringify(cookiesCache, null, 2));
    console.log('[Cookies] Cookies guardadas correctamente');
  } catch (err) {
    console.error('[Cookies] Error al guardar cookies:', err.message);
  }
}

function getCookies() {
  return cookiesCache;
}

function validateCookies(cookies) {
  if (!Array.isArray(cookies) || cookies.length === 0) return false;
  const sessionCookie = cookies.find(c => c.name === 'sessionid');
  return sessionCookie && sessionCookie.expires > Date.now() / 1000;
}

module.exports = {
  loadCookies,
  saveCookies,
  getCookies,
  validateCookies
};
