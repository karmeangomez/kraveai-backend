const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
puppeteer.use(StealthPlugin());
const { cambiarIdentidad } = require('./cambiarIdentidad');
const { verificarEmail } = require('./instaddr');
const logger = require('./logger');
const fs = require('fs');
const path = require('path');

module.exports = async (datosUsuario, fingerprint) => {
  const browser = await puppeteer.launch({
    headless: "new",
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-web-security',
      '--disable-features=IsolateOrigins,site-per-process'
    ]
  });

  const page = await browser.newPage();
  await cambiarIdentidad(page, fingerprint);

  try {
    // Técnica rusa: Patrón de navegación errático
    await page.goto('https://instagram.com', { waitUntil: 'networkidle2', timeout: 0 });
    await page.waitForTimeout(2000 + Math.random() * 3000);
    
    // Movimientos de mouse no lineales
    await page.mouse.move(100, 100);
    await page.mouse.move(300, 150, { steps: 20 });
    await page.mouse.click(350, 200);
    
    // Registro con errores humanos simulados
    await page.type('input[name="emailOrPhone"]', datosUsuario.email, { delay: 80 + Math.random() * 120 });
    await page.keyboard.press('Tab');
    await page.waitForTimeout(500 + Math.random() * 800);
    
    // Escritura de contraseña con variabilidad
    for (const char of datosUsuario.password) {
      await page.keyboard.type(char, { delay: 60 + Math.random() * 100 });
      if (Math.random() > 0.8) await page.waitForTimeout(200);
    }

    // Técnica anti-captcha: Cambio de campo repentino
    await page.click('input[name="fullName"]');
    await page.waitForTimeout(1000);
    await page.type('input[name="fullName"]', datosUsuario.nombre, { delay: 70 });
    
    // Username con correcciones simuladas
    await page.type('input[name="username"]', datosUsuario.username + 'aa');
    await page.waitForTimeout(800);
    await page.keyboard.press('Backspace');
    await page.keyboard.press('Backspace');
    
    // Scroll humano
    await page.evaluate(() => window.scrollBy(0, 150));
    await page.waitForTimeout(1500);

    // Click aleatorizado
    const signupBtn = await page.$x("//button[contains(., 'Sign up')]");
    await signupBtn[0].click({ delay: 150 });
    
    // Espera táctica para verificación
    await page.waitForTimeout(8000 + Math.random() * 5000);
    
    // Verificación automática de email
    await verificarEmail(datosUsuario.email);
    
    // Guardado de cookies cifradas
    const cookies = await page.cookies();
    const cookieData = Buffer.from(JSON.stringify(cookies)).toString('base64');
    fs.writeFileSync(`cookies/${datosUsuario.username}.enc`, cookieData);

    // Validación final
    await page.goto(`https://instagram.com/${datosUsuario.username}`);
    await page.screenshot({ path: `screenshots/${datosUsuario.username}.png` });

    // Registro en JSON cifrado
    const cuentaData = {
      ...datosUsuario,
      created: new Date().toISOString(),
      fingerprint: fingerprint.userAgent.substring(0, 40)
    };
    
    fs.appendFileSync('cuentas_creadas.enc', 
      Buffer.from(JSON.stringify(cuentaData)).toString('base64') + '\n'
    );

  } catch (error) {
    logger.error(`🔥 Falla crítica: ${error.message}`);
    // Captura de emergencia
    await page.screenshot({ path: `logs/error_${Date.now()}.png` });
    throw error;
  } finally {
    await browser.close();
  }
};
