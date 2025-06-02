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

    if (await fs.access(cookiesPath).then(() => true).catch(() => false)) {
      const cookies = JSON.parse(await fs.readFile(cookiesPath, 'utf8'));
      await page.setCookie(...cookies);
      console.log("🍪 Cookies cargadas");
    }

    await page.goto('https://www.instagram.com/', {
      waitUntil: 'networkidle2',
      timeout: NAVIGATION_TIMEOUT
    });

    const loginInput = await page.$('input[name="username"]');
    if (!loginInput) {
      console.log("✅ Sesión activa detectada.");
      return true;
    }

    console.log("🔐 Iniciando login...");
    await page.goto('https://www.instagram.com/accounts/login/', {
      waitUntil: 'domcontentloaded',
      timeout: NAVIGATION_TIMEOUT
    });

    await Promise.race([
      page.waitForSelector('input[name="username"]', { visible: true }),
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

    // ✅ Manejo seguro del pop-up "Ahora no"
    try {
      if (page && page.$x) {
        const dialogs = await page.$x('//button[contains(., "Ahora no") or contains(., "Not Now")]');
        if (dialogs.length > 0) {
          await dialogs[0].click();
          console.log("🧼 Cerrado modal de 'Ahora no'");
          await humanBehavior.randomDelay(500, 1000);
        }
      } else {
        console.log("⛔ No se puede ejecutar $x: página cerrada o no disponible");
      }
    } catch (e) {
      console.log("ℹ️ No se encontró modal de 'Ahora no'");
    }

    const cookies = await page.cookies();
    await fs.writeFile(cookiesPath, JSON.stringify(cookies, null, 2));
    console.log("✅ Login exitoso y cookies guardadas");

    return true;
  } catch (error) {
    console.error("❌ Fallo durante login:", error.message);
    return false;
  }
}

module.exports = { instagramLogin };
