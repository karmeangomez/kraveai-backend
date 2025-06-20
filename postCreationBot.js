// postCreationBot.js
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const fs = require('fs');
const path = require('path');
const Logger = require('./logger');

puppeteer.use(StealthPlugin());
const logger = new Logger();

async function postCreationBot({ username, password }) {
  let browser;
  try {
    browser = await puppeteer.launch({
      headless: true,
      executablePath: '/usr/bin/chromium-browser',
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const page = await browser.newPage();
    await page.goto('https://www.instagram.com/accounts/login/', {
      waitUntil: 'networkidle2',
      timeout: 60000
    });

    // Login con la cuenta recién creada
    await page.type('input[name="username"]', username, { delay: 80 });
    await page.type('input[name="password"]', password, { delay: 80 });
    await page.click('button[type="submit"]');
    await page.waitForNavigation({ waitUntil: 'networkidle2' });

    logger.info(`✅ Login exitoso para @${username}`);

    // Ir al perfil para editar bio
    await page.goto('https://www.instagram.com/accounts/edit/', { waitUntil: 'networkidle2' });
    await page.waitForSelector('textarea[name="biography"]', { timeout: 10000 });

    const bioOpciones = [
      '📸 Apasionado por la fotografía.',
      '🎵 Amante de la música y los libros.',
      '🚀 Explorando nuevas ideas.',
      '💡 Creando cosas nuevas.',
      '🌍 Viajando por el mundo.'
    ];

    const bio = bioOpciones[Math.floor(Math.random() * bioOpciones.length)];
    await page.evaluate(() => {
      document.querySelector('textarea[name="biography"]').value = '';
    });
    await page.type('textarea[name="biography"]', bio, { delay: 40 });
    await page.click('button[type="submit"]');
    logger.info(`📝 Bio actualizada: "${bio}"`);

    // Seguir a una cuenta popular (Cristiano Ronaldo)
    await page.goto('https://www.instagram.com/cristiano/', { waitUntil: 'networkidle2' });
    await page.waitForSelector('button', { timeout: 10000 });

    const followBtn = await page.$x("//button[contains(text(),'Seguir') or contains(text(),'Follow')]");
    if (followBtn.length > 0) {
      await followBtn[0].click();
      logger.info(`👤 Cuenta @${username} siguió a @cristiano`);
    }

    // Navegar el feed principal
    await page.goto('https://www.instagram.com/', { waitUntil: 'networkidle2' });
    await page.waitForTimeout(3000 + Math.random() * 2000);

    // Simular scroll y movimiento
    for (let i = 0; i < 3; i++) {
      await page.mouse.move(200 + Math.random() * 100, 400 + Math.random() * 100);
      await page.evaluate(() => window.scrollBy(0, 300 + Math.random() * 200));
      await page.waitForTimeout(1000 + Math.random() * 1000);
    }

    // Screenshot opcional
    const SCREENSHOTS_DIR = path.join(__dirname, 'screenshots');
    if (!fs.existsSync(SCREENSHOTS_DIR)) fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });
    const screenshotPath = path.join(SCREENSHOTS_DIR, `${username}_postcreation.png`);
    await page.screenshot({ path: screenshotPath, fullPage: true });

    logger.success(`✅ @${username} finalizó post-actividad correctamente`);

    return true;

  } catch (error) {
    logger.error(`❌ Error en postCreationBot: ${error.message}`);
    return false;
  } finally {
    if (browser) await browser.close();
  }
}

module.exports = { postCreationBot };
