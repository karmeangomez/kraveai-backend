const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
puppeteer.use(StealthPlugin());
const { cambiarIdentidad } = require('./cambiarIdentidad');
const { humanType, humanMouseMove } = require('./humanBehavior');
const { verificarEmail } = require('./imapVerifier');
const logger = require('./logger');
const fs = require('fs');
const path = require('path');

// Selectores actualizados para Instagram 2025
const SELECTORS = {
  EMAIL: [
    'input[name="emailOrPhone"]',
    'input[name="email"]',
    'input[aria-label="Email address or phone number"]',
    'input[aria-label="Mobile Number or Email"]',
    'input[aria-label="Email o teléfono"]'
  ],
  FULL_NAME: [
    'input[name="fullName"]',
    'input[aria-label="Full Name"]',
    'input[aria-label="Nombre completo"]'
  ],
  USERNAME: [
    'input[name="username"]',
    'input[aria-label="Username"]',
    'input[aria-label="Nombre de usuario"]'
  ],
  PASSWORD: [
    'input[name="password"]',
    'input[aria-label="Password"]',
    'input[aria-label="Contraseña"]'
  ],
  SUBMIT: [
    'button[type="submit"]',
    'button:contains("Sign up")',
    'button:contains("Registrarse")'
  ]
};

module.exports = async (datosUsuario, fingerprint) => {
  // Configuración mejorada para Raspberry Pi
  const browser = await puppeteer.launch({
    headless: process.env.HEADLESS !== 'false' ? "new" : false,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-accelerated-2d-canvas',
      '--disable-gpu',
      '--single-process'
    ],
    executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium-browser'
  });

  const page = await browser.newPage();
  
  try {
    // 1. Aplicar identidad rusa mejorada
    await cambiarIdentidad(page, fingerprint);
    logger.info(`🧬 Fingerprint aplicado: ${fingerprint.userAgent.substring(0, 40)}...`);

    // 2. Navegación estratégica con comportamiento humano
    await page.goto('https://www.instagram.com/', {
      waitUntil: 'networkidle2',
      timeout: 60000
    });
    await page.waitForTimeout(2000 + Math.random() * 3000);
    
    // 3. Ir a página de registro con detección inteligente
    let signupLink = await page.$('a[href="/accounts/emailsignup/"]');
    if (!signupLink) {
      // Fallback: Navegar directamente
      await page.goto('https://www.instagram.com/accounts/emailsignup/', {
        waitUntil: 'networkidle2',
        timeout: 30000
      });
    } else {
      await humanMouseMove(page, 100, 100);
      await signupLink.click();
      await page.waitForTimeout(3000 + Math.random() * 2000);
    }

    // 4. Captura de diagnóstico inicial
    await page.screenshot({ path: `screenshots/${datosUsuario.username}_step1.png` });
    
    // 5. Sistema de campos inteligente con múltiples selectores
    const fillField = async (fieldType, value) => {
      for (const selector of SELECTORS[fieldType]) {
        try {
          await page.waitForSelector(selector, { timeout: 5000 });
          await humanType(page, selector, value);
          logger.debug(`✅ Campo ${fieldType} llenado con selector: ${selector}`);
          return true;
        } catch (error) {
          // Continuar con el siguiente selector
        }
      }
      return false;
    };

    // 6. Rellenar campos con técnica rusa mejorada
    const campos = [
      { type: 'EMAIL', value: datosUsuario.email },
      { type: 'FULL_NAME', value: datosUsuario.nombre },
      { type: 'USERNAME', value: datosUsuario.username },
      { type: 'PASSWORD', value: datosUsuario.password }
    ];
    
    for (const campo of campos) {
      const success = await fillField(campo.type, campo.value);
      if (!success) {
        await page.screenshot({ path: `logs/error_field_${campo.type}.png` });
        throw new Error(`No se encontró campo para ${campo.type}`);
      }
      
      // Delay humano entre campos
      await page.waitForTimeout(800 + Math.random() * 1200);
    }
    
    // 7. Comportamiento humano final antes de enviar
    await humanMouseMove(page, 350, 200);
    await page.waitForTimeout(1500);
    
    // 8. Enviar formulario con selector inteligente
    let submitted = false;
    for (const selector of SELECTORS.SUBMIT) {
      try {
        await page.waitForSelector(selector, { timeout: 5000 });
        await page.click(selector, {
          delay: 100 + Math.random() * 200
        });
        submitted = true;
        logger.info(`🚀 Formulario enviado con selector: ${selector}`);
        break;
      } catch (error) {
        // Continuar con el siguiente selector
      }
    }
    
    if (!submitted) {
      throw new Error('No se encontró botón de registro');
    }
    
    await page.waitForTimeout(5000 + Math.random() * 3000);
    
    // 9. Manejo de errores de username mejorado
    const usernameError = await page.$('input[name="username"] + div[role="alert"]');
    if (usernameError) {
      const errorText = await page.evaluate(el => el.textContent, usernameError);
      if (/no disponible|taken/i.test(errorText)) {
        throw new Error(`Username ${datosUsuario.username} no disponible`);
      }
    }
    
    // 10. Verificación por email con reintentos
    logger.info(`📩 Esperando verificación para ${datosUsuario.email}...`);
    let emailVerificado = false;
    for (let i = 0; i < 3; i++) {
      emailVerificado = await verificarEmail(datosUsuario.email);
      if (emailVerificado) break;
      await page.waitForTimeout(10000); // Esperar 10 segundos entre reintentos
    }
    
    if (!emailVerificado) {
      throw new Error('Email de verificación no recibido después de 3 intentos');
    }
    logger.success('✅ Email verificado!');
    
    // 11. Validación de cuenta con detección de shadowban
    await page.goto(`https://instagram.com/${datosUsuario.username}`, {
      waitUntil: 'networkidle2',
      timeout: 30000
    });
    
    const profileExists = await page.$('main section') !== null;
    if (!profileExists) {
      throw new Error('Perfil no accesible (posible shadowban)');
    }
    
    // 12. Guardar cookies de sesión seguras
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
      email: datosUsuario.email,
      timestamp: new Date().toISOString()
    };
    
  } catch (error) {
    // Captura de error y diagnóstico mejorado
    const errorTime = new Date().toISOString().replace(/[:.]/g, '-');
    const errorFile = `logs/error_${datosUsuario.username}_${errorTime}.png`;
    await page.screenshot({ path: errorFile });
    
    logger.error(`🔥 Error en cuenta @${datosUsuario.username}: ${error.message}`);
    logger.info(`📸 Captura guardada en: ${errorFile}`);
    
    return {
      status: 'error',
      username: datosUsuario.username,
      error: error.message,
      screenshot: errorFile,
      timestamp: new Date().toISOString()
    };
    
  } finally {
    await browser.close();
  }
};
