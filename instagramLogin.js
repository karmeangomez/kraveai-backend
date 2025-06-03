const fs = require('fs').promises;
const path = require('path');
const UserAgent = require('user-agents');

const cookiesDir = path.join(__dirname, 'cookies');
const LOGIN_TIMEOUT = 60000;
const NAVIGATION_TIMEOUT = 45000;

const humanBehavior = {
  randomDelay: (min = 800, max = 2500) => new Promise(resolve =>
    setTimeout(resolve, min + Math.random() * (max - min))),
  randomType: async (page, selector, text) => {
    for (let char of text) {
      await page.type(selector, char, { delay: 50 + Math.random() * 80 });
      await humanBehavior.randomDelay(100, 300);
    }
  }
};

async function instagramLogin(page, username, password, cookiesFile = 'default') {
  const cookiesPath = path.join(cookiesDir, `${cookiesFile}.json`);

  try {
    console.log(`🔍 Revisando sesión para: ${username}`);
    await fs.mkdir(cookiesDir, { recursive: true });

    // Cargar cookies existentes
    let cookies = [];
    if (await fs.access(cookiesPath).then(() => true).catch(() => false)) {
      cookies = JSON.parse(await fs.readFile(cookiesPath, 'utf8'));
      await page.setCookie(...cookies);
      console.log("🍪 Cookies cargadas");
    }

    // Verificar sesión con una solicitud ligera
    await page.goto('https://www.instagram.com/', {
      waitUntil: 'networkidle0',
      timeout: NAVIGATION_TIMEOUT
    });

    const sessionActive = await page.evaluate(() => {
      return document.querySelector('svg[aria-label="Inicio"]') !== null;
    });

    if (sessionActive) {
      console.log("✅ Sesión activa detectada desde cookies");
      return true;
    }

    console.warn("⚠️ Cookies inválidas o sesión expirada, intentando refrescar o login");

    // Intentar refrescar sesión
    await page.goto('https://www.instagram.com/', { waitUntil: 'networkidle0', timeout: NAVIGATION_TIMEOUT });
    const refreshedSession = await page.evaluate(() => {
      return document.querySelector('svg[aria-label="Inicio"]') !== null;
    });

    if (refreshedSession) {
      const newCookies = await page.cookies();
      await fs.writeFile(cookiesPath, JSON.stringify(newCookies, null, 2));
      console.log("🔄 Sesión refresca con éxito y cookies actualizadas");
      return true;
    }

    // Login completo si el refresco falla
    console.log("🔐 Iniciando login completo...");
    await page.goto('https://www.instagram.com/accounts/login/', {
      waitUntil: 'domcontentloaded',
      timeout: NAVIGATION_TIMEOUT
    });

    await Promise.race([
      page.waitForSelector('input[name="username"]', { visible: true, timeout: 20000 }),
      page.waitForFunction(() => window.location.href.includes('challenge'), { timeout: 20000 })
    ]);

    const ua = new UserAgent({ deviceCategory: 'mobile' }).toString();
    await page.setUserAgent(ua);
    console.log(`📱 User-Agent: ${ua}`);

    await humanBehavior.randomType(page, 'input[name="username"]', username);
    await humanBehavior.randomDelay(1000, 2000);
    await humanBehavior.randomType(page, 'input[name="password"]', password);
    await humanBehavior.randomDelay(1000, 2000);

    await page.click('button[type="submit"]');

    await Promise.race([
      page.waitForNavigation({ waitUntil: 'networkidle2', timeout: LOGIN_TIMEOUT }),
      humanBehavior.randomDelay(8000, 10000)
    ]);

    const error = await page.$('#slfErrorAlert');
    if (error) {
      const msg = await page.$eval('#slfErrorAlert', el => el.textContent);
      console.error("❌ Error en login:", msg);
      return false;
    }

    try {
      if (page && typeof page.$x === 'function') {
        const dialogs = await page.$x('//button[contains(., "Ahora no") or contains(., "Not Now")]');
        if (dialogs.length > 0) {
          await dialogs[0].click();
          console.log("🧼 Cerrado modal de 'Ahora no'");
          await humanBehavior.randomDelay(500, 1000);
        }
      }
    } catch (e) {
      console.log("ℹ️ No se encontró modal de 'Ahora no'");
    }

    // Guardar cookies actualizadas
    const newCookies = await page.cookies();
    await fs.writeFile(cookiesPath, JSON.stringify(newCookies, null, 2));
    console.log("✅ Login exitoso y cookies guardadas");

    return true;
  } catch (error) {
    console.error("❌ Fallo durante login:", error.message);
    return false;
  }
}

module.exports = { instagramLogin };
