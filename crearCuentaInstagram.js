const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const proxyChain = require('proxy-chain');
const UserAgent = require('user-agents');
const fs = require('fs');
const path = require('path');

puppeteer.use(StealthPlugin());

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function crearCuentaInstagram(proxy) {
  let browser;
  let proxyAnonimo;

  try {
    proxyAnonimo = proxy ? await proxyChain.anonymizeProxy(proxy) : null;
    const userAgent = new UserAgent().toString();
    const correo = `test_${Date.now()}@kuku.lu`;

    browser = await puppeteer.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--window-size=375,812',
        '--lang=en-US,en;q=0.9',
        proxyAnonimo ? `--proxy-server=${proxyAnonimo}` : null
      ].filter(Boolean)
    });

    const page = await browser.newPage();
    await page.setUserAgent(userAgent);
    await page.setViewport({ width: 375, height: 812 });

    await page.goto('https://www.instagram.com/accounts/emailsignup/', {
      waitUntil: 'networkidle2',
      timeout: 60000
    });

    await page.type('input[name="emailOrPhone"]', correo, { delay: 50 });
    await page.type('input[name="fullName"]', 'Karmean Test', { delay: 50 });
    await page.type('input[name="username"]', `usuario${Math.floor(Math.random() * 10000)}`, { delay: 50 });
    await page.type('input[name="password"]', 'Andrick99', { delay: 50 });
    await delay(1000);
    await page.click('button[type="submit"]');

    // Espera si Instagram pide código
    const inputCodigo = await page.$('input[name="email_confirmation_code"]');
    if (inputCodigo) {
      const safeCorreo = correo.replace(/[^a-z0-9]/gi, '_');
      const codigoPath = path.join(__dirname, 'codigos', `${safeCorreo}.txt`);

      let codigo = null;
      const start = Date.now();
      while (!codigo && Date.now() - start < 90000) {
        if (fs.existsSync(codigoPath)) {
          codigo = fs.readFileSync(codigoPath, 'utf8').trim();
          break;
        }
        await delay(3000);
      }

      if (codigo && /^\d{6}$/.test(codigo)) {
        await page.type('input[name="email_confirmation_code"]', codigo, { delay: 50 });
        await delay(1000);
        await page.click('button[type="submit"]');
      } else {
        throw new Error("No se recibió el código de verificación.");
      }
    }

    await delay(5000);
    await browser.close();

    return {
      exito: true,
      usuario: "cuenta_test",
      correo,
      proxy
    };

  } catch (error) {
    if (browser) await browser.close();
    return {
      exito: false,
      error: error.message
    };
  }
}

module.exports = { crearCuentaInstagram };
