const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const proxyChain = require('proxy-chain');
const UserAgent = require('user-agents');
const logger = require('./logger');
const { generarCorreoInstAddr, obtenerCodigoInstAddr } = require('./utils/instaddr');
const nopecha = require('nopecha');

puppeteer.use(StealthPlugin());
nopecha.apiKey = process.env.NOPECHA_APIKEY;

async function crearCuentaInstagram(proxy) {
  const proxyAnonimo = await proxyChain.anonymizeProxy(proxy);
  const userAgent = new UserAgent().toString();
  const cuentaEmail = generarCorreoInstAddr();

  const browser = await puppeteer.launch({
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      `--proxy-server=${proxyAnonimo}`,
    ]
  });

  const page = await browser.newPage();
  await page.setUserAgent(userAgent);

  try {
    await page.goto('https://www.instagram.com/accounts/emailsignup/', {
      waitUntil: 'networkidle2'
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
      page.waitForNavigation({ waitUntil: 'networkidle2' }),
    ]);

    const codigo = await obtenerCodigoInstAddr(cuentaEmail.alias);
    await page.type('input[name="email_confirmation_code"]', codigo, { delay: 80 });

    await page.click('button[type="button"]'); // Botón continuar tras el código
    logger.info(`✅ Cuenta creada: ${datos.usuario}`);
    return {
      usuario: datos.usuario,
      email: datos.email,
      password: datos.clave
    };

  } catch (err) {
    logger.error(`❌ Error creando cuenta: ${err.message}`);
    return null;
  } finally {
    await browser.close();
    await proxyChain.closeAnonymizedProxy(proxyAnonimo);
  }
}

module.exports = { crearCuentaInstagram };
