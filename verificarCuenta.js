const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
puppeteer.use(StealthPlugin());
const logger = require('./logger');

module.exports = async (username, fingerprint) => {
  const browser = await puppeteer.launch({ headless: "new" });
  const page = await browser.newPage();
  
  try {
    // Aplicar fingerprint
    await require('./cambiarIdentidad')(page, fingerprint);
    
    // Navegar al perfil
    await page.goto(`https://instagram.com/${username}`, { timeout: 60000 });
    
    // Verificar existencia
    const selector = username.length > 5 ? 'h2' : 'h1';
    await page.waitForSelector(selector, { timeout: 15000 });
    
    // Captura de seguridad
    await page.screenshot({ path: `screenshots/verify_${username}.png` });
    
    return true;
  } catch (error) {
    logger.error(`🚨 Validación fallida para @${username}: ${error.message}`);
    return false;
  } finally {
    await browser.close();
  }
};
