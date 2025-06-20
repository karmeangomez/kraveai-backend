const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
puppeteer.use(StealthPlugin());
const { cambiarIdentidad } = require('./cambiarIdentidad');
const { humanType, humanMouseMove } = require('./humanBehavior');
const { verificarEmail } = require('./imapVerifier');
const logger = require('./logger');
const fs = require('fs');
const path = require('path');

module.exports = async (datosUsuario, fingerprint) => {
  // Configuración específica para Raspberry Pi
  const browser = await puppeteer.launch({
    headless: "new",
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-accelerated-2d-canvas',
      '--disable-gpu',
      '--single-process'
    ],
    executablePath: '/usr/bin/chromium-browser' // Ruta en Raspberry Pi OS
  });

  const page = await browser.newPage();
  
  try {
    // 1. Aplicar identidad rusa
    await cambiarIdentidad(page, fingerprint);
    logger.info(`🧬 Identidad aplicada: ${fingerprint.userAgent.substring(0, 40)}...`);

    // 2. Navegación inicial con comportamiento humano
    await page.goto('https://instagram.com', {
      waitUntil: 'networkidle2',
      timeout: 60000
    });
    await humanMouseMove(page, 100, 100);
    await page.waitForTimeout(2000 + Math.random() * 3000);
    
    // 3. Ir a página de registro
    await humanMouseMove(page, 300, 150);
    await page.click('a[href="/accounts/emailsignup/"]');
    await page.waitForTimeout(3000 + Math.random() * 2000);
    
    // 4. Captura de diagnóstico
    await page.screenshot({ path: `screenshots/${datosUsuario.username}_step1.png` });
    
    // 5. Rellenar formulario con técnica rusa
    const campos = [
      { selector: 'input[name="emailOrPhone"]', value: datosUsuario.email, name: 'email' },
      { selector: 'input[name="fullName"]', value: datosUsuario.nombre, name: 'nombre' },
      { selector: 'input[name="username"]', value: datosUsuario.username, name: 'username' },
      { selector: 'input[name="password"]', value: datosUsuario.password, name: 'password' }
    ];
    
    for (const campo of campos) {
      try {
        await page.waitForSelector(campo.selector, { timeout: 8000 });
        await humanType(page, campo.selector, campo.value);
        logger.debug(`📝 Campo ${campo.name} llenado`);
        
        // Delay humano entre campos
        await page.waitForTimeout(800 + Math.random() * 1200);
      } catch (error) {
        // Fallback a selectores alternativos
        const altSelector = `input[aria-label="${campo.name === 'email' ? 'Email o teléfono' : campo.name === 'nombre' ? 'Nombre completo' : campo.name}"]`;
        await page.waitForSelector(altSelector, { timeout: 5000 });
        await humanType(page, altSelector, campo.value);
        logger.warning(`⚠️ Usando selector alternativo para ${campo.name}`);
      }
    }
    
    // 6. Comportamiento humano final antes de enviar
    await humanMouseMove(page, 350, 200);
    await page.waitForTimeout(1500);
    
    // 7. Enviar formulario
    await page.click('button[type="submit"]', {
      delay: 100 + Math.random() * 200
    });
    logger.info('🚀 Formulario enviado');
    await page.waitForTimeout(5000 + Math.random() * 3000);
    
    // 8. Manejo de errores de username
    const usernameError = await page.$('input[name="username"] + div[role="alert"]');
    if (usernameError) {
      const errorText = await page.evaluate(el => el.textContent, usernameError);
      if (/no disponible|taken/i.test(errorText)) {
        throw new Error(`Username ${datosUsuario.username} no disponible`);
      }
    }
    
    // 9. Verificación por email (método ruso con IMAP)
    logger.info(`📩 Esperando verificación para ${datosUsuario.email}...`);
    const emailVerificado = await verificarEmail(datosUsuario.email);
    
    if (!emailVerificado) {
      throw new Error('Email de verificación no recibido');
    }
    logger.success('✅ Email verificado!');
    
    // 10. Validación final de cuenta
    await page.goto(`https://instagram.com/${datosUsuario.username}`, {
      waitUntil: 'networkidle2',
      timeout: 30000
    });
    
    // 11. Confirmar que la cuenta es pública
    const profileExists = await page.$('h2, h1') !== null;
    if (!profileExists) {
      throw new Error('Perfil no accesible (posible shadowban)');
    }
    
    // 12. Guardar cookies de sesión
    const cookies = await page.cookies();
    fs.writeFileSync(
      `cookies/${datosUsuario.username}.json`,
      JSON.stringify(cookies, null, 2)
    );
    
    // 13. Captura final de éxito
    await page.screenshot({ path: `screenshots/${datosUsuario.username}_success.png` });
    
    return {
      status: 'success',
      username: datosUsuario.username,
      email: datosUsuario.email
    };
    
  } catch (error) {
    // Captura de error y diagnóstico
    const errorTime = new Date().toISOString().replace(/[:.]/g, '-');
    await page.screenshot({ path: `logs/error_${datosUsuario.username}_${errorTime}.png` });
    logger.error(`🔥 Error en cuenta @${datosUsuario.username}: ${error.message}`);
    
    return {
      status: 'error',
      username: datosUsuario.username,
      error: error.message
    };
    
  } finally {
    await browser.close();
  }
};
