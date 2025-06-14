// crearCuentas.js - Optimizado para SSE + Chromium explícito

const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const proxyChain = require('proxy-chain');
const UserAgent = require('user-agents');
const logger = require('./logger');
const { generarCorreoInstAddr, obtenerCodigoInstAddr } = require('./utils/instaddr');
const { guardarCuenta } = require('./utils/saveAccount');
const path = require('path');

puppeteer.use(StealthPlugin());

async function crearCuentaInstagram(proxy) {
  let proxyAnonimo;
  let browser;

  try {
    proxyAnonimo = await proxyChain.anonymizeProxy(proxy);
    const userAgent = new UserAgent().toString();
    const cuentaEmail = generarCorreoInstAddr();

    browser = await puppeteer.launch({
      headless: true,
      executablePath: '/usr/bin/chromium-browser', // ✅ Ruta explícita
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        `--proxy-server=${proxyAnonimo}`,
        '--disable-dev-shm-usage',
        '--disable-gpu'
      ]
    });

    const page = await browser.newPage();
    await page.setUserAgent(userAgent);
    await page.setDefaultNavigationTimeout(60000);

    await page.goto('https://www.instagram.com/accounts/emailsignup/', {
      waitUntil: 'networkidle2',
      timeout: 60000
    });

    const datos = {
      email: cuentaEmail.email,
      nombre: 'Krave Bot',
      usuario: `krave_${Date.now()}`,
      clave: `Krave${Math.floor(Math.random() * 9999)}!`
    };

    await page.type('input[name="emailOrPhone"]', datos.email, { delay: 80 });
    await page.type('input[name="fullName"]', datos.nombre, { delay: 80 });
    await page.type('input[name="username"]', datos.usuario, { delay: 80 });
    await page.type('input[name="password"]', datos.clave, { delay: 100 });

    await Promise.all([
      page.click('button[type="submit"]'),
      page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 60000 }),
    ]);

    const codeInput = await page.$('input[name="email_confirmation_code"]');
    if (!codeInput) {
      throw new Error('No se mostró el campo para ingresar el código de confirmación');
    }

    const codigo = await obtenerCodigoInstAddr(cuentaEmail.alias);
    if (!codigo) throw new Error('No se recibió código desde InstAddr');

    await codeInput.type(codigo, { delay: 80 });
    await page.waitForTimeout(2000);

    await Promise.all([
      page.click('button[type="button"]'),
      page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 60000 }).catch(() => {})
    ]);

    guardarCuenta({
      usuario: datos.usuario,
      email: datos.email,
      password: datos.clave,
      fecha: new Date().toISOString(),
      proxy: proxy
    });

    logger.info(`✅ Cuenta creada: ${datos.usuario}`);
    return {
      usuario: datos.usuario,
      email: datos.email,
      password: datos.clave,
      proxy: proxy
    };

  } catch (err) {
    const screenshotPath = path.join(__dirname, 'error_screenshots', `error_${Date.now()}.png`);
    if (browser) {
      const page = (await browser.pages())[0];
      await page.screenshot({ path: screenshotPath, fullPage: true }).catch(() => {});
    }
    logger.error(`❌ Error creando cuenta: ${err.stack || err.message}`);
    logger.warn(`📸 Captura de error guardada en: ${screenshotPath}`);
    return null;
  } finally {
    if (browser) await browser.close();
    if (proxyAnonimo) await proxyChain.closeAnonymizedProxy(proxyAnonimo);
  }
}

module.exports = { crearCuentaInstagram };

    await page.setDefaultNavigationTimeout(60000);

    await page.goto('https://www.instagram.com/accounts/emailsignup/', {
      waitUntil: 'networkidle2',
      timeout: 60000
    });

    const datos = {
      email: cuentaEmail.email,
      nombre: 'Krave Bot',
      usuario: `krave_${Date.now()}`,
      clave: `Krave${Math.floor(Math.random() * 9999)}!`
    };

    await page.type('input[name="emailOrPhone"]', datos.email, { delay: 80 });
    await page.type('input[name="fullName"]', datos.nombre, { delay: 80 });
    await page.type('input[name="username"]', datos.usuario, { delay: 80 });
    await page.type('input[name="password"]', datos.clave, { delay: 100 });

    await Promise.all([
      page.click('button[type="submit"]'),
      page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 60000 }),
    ]);

    // Verificación de campo de código
    const codeInput = await page.$('input[name="email_confirmation_code"]');
    if (!codeInput) {
      throw new Error('No se mostró el campo para ingresar el código de confirmación');
    }

    const codigo = await obtenerCodigoInstAddr(cuentaEmail.alias);
    if (!codigo) throw new Error('No se recibió código desde InstAddr');

    await codeInput.type(codigo, { delay: 80 });
    await page.waitForTimeout(2000);

    await Promise.all([
      page.click('button[type="button"]'),
      page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 60000 }).catch(() => {})
    ]);

    // ✅ Guardar cuenta
    guardarCuenta({
      usuario: datos.usuario,
      email: datos.email,
      password: datos.clave,
      fecha: new Date().toISOString(),
      proxy: proxy
    });

    logger.info(`✅ Cuenta creada: ${datos.usuario}`);
    return {
      usuario: datos.usuario,
      email: datos.email,
      password: datos.clave,
      proxy: proxy
    };

  } catch (err) {
    const screenshotPath = path.join(__dirname, 'error_screenshots', `error_${Date.now()}.png`);
    if (browser) {
      const page = (await browser.pages())[0];
      await page.screenshot({ path: screenshotPath, fullPage: true }).catch(() => {});
    }
    logger.error(`❌ Error creando cuenta: ${err.stack || err.message}`);
    logger.warn(`📸 Captura de error guardada en: ${screenshotPath}`);
    return null;
  } finally {
    if (browser) await browser.close();
    if (proxyAnonimo) await proxyChain.closeAnonymizedProxy(proxyAnonimo);
  }
}

module.exports = { crearCuentaInstagram };
