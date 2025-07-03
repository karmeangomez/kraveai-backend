// ... (imports previos permanecen igual)

// Nuevas constantes para manejo de errores específicos
const ERROR_CODES = {
  BLOCKED_BY_INSTAGRAM: 'BLOCKED_BY_INSTAGRAM',
  CAPTCHA_REQUIRED: 'CAPTCHA_REQUIRED',
  PHONE_VERIFICATION: 'PHONE_VERIFICATION',
  UNKNOWN_ERROR: 'UNKNOWN_ERROR'
};

export default async function crearCuentaInstagram(proxy, usarTor = false, retryCount = 0) {
  // ... (configuración previa de usuario y proxy permanece igual)

  try {
    // ... (validación de proxy y configuración de browser permanece igual)

    // Paso 1: Detectar y manejar cookies
    await handleCookies(page);

    // Paso 2: Cambiar a registro por email si es necesario
    await switchToEmailRegistration(page);

    // Paso 3: Completar formulario
    await fillRegistrationForm(page, email, nombre, username, password);
    console.log(`✅ Cuenta generada: @${username} | ${email}`);

    // Enviar formulario con verificación
    await submitForm(page);

    // Paso 4: Manejar posibles respuestas después del envío
    const result = await handlePostSubmission(page, username, email);
    
    if (result.status === 'success') {
      return result;
    }

    // Si llegamos aquí, algo salió mal en el proceso posterior
    throw new Error('No se pudo completar el registro');

  } catch (error) {
    // ... (manejo de errores existente)
  } finally {
    // ... (cierre de browser)
  }
}

// --- Funciones auxiliares mejoradas ---

async function handleCookies(page) {
  try {
    const cookieSelectors = [
      'button:has-text("Allow all cookies")',
      'button:has-text("Accept all")',
      'button:has-text("Allow essential and optional cookies")',
      'button[data-testid="cookie-banner-accept"]'
    ];

    for (const selector of cookieSelectors) {
      try {
        const button = await page.waitForSelector(selector, { timeout: 5000 });
        await button.click();
        console.log('🍪 Cookies aceptadas');
        await page.waitForTimeout(1500);
        return;
      } catch {}
    }
    console.log('✅ No se encontró banner de cookies');
  } catch (error) {
    console.log('⚠️ Error en manejo de cookies:', error.message);
  }
}

async function switchToEmailRegistration(page) {
  try {
    const emailButtons = [
      'button:has-text("Use email")',
      'button:has-text("Use email address")',
      'button:has-text("Sign up with email")'
    ];

    for (const selector of emailButtons) {
      try {
        const button = await page.waitForSelector(selector, { timeout: 5000 });
        await button.click();
        console.log('📧 Cambiado a registro por correo');
        await page.waitForTimeout(2000);
        return;
      } catch {}
    }
    console.log('✅ Formulario de correo ya visible');
  } catch (error) {
    console.log('⚠️ Error cambiando a email:', error.message);
  }
}

async function fillRegistrationForm(page, email, nombre, username, password) {
  // Verificar que los campos estén realmente presentes
  await page.waitForSelector('input[name="emailOrPhone"]', { 
    visible: true,
    timeout: 30000
  });

  // Rellenar con verificaciones
  await fillField(page, 'input[name="emailOrPhone"]', email);
  await fillField(page, 'input[name="fullName"]', nombre);
  await fillField(page, 'input[name="username"]', username);
  await fillField(page, 'input[name="password"]', password);
}

async function fillField(page, selector, value) {
  await page.focus(selector);
  await page.click(selector, { clickCount: 3 }); // Seleccionar texto existente
  await page.type(selector, value, { delay: 50 + Math.random() * 50 });
  
  // Verificar que el valor se ingresó correctamente
  const enteredValue = await page.$eval(selector, el => el.value);
  if (enteredValue !== value) {
    throw new Error(`Campo ${selector} no se rellenó correctamente`);
  }
}

async function submitForm(page) {
  const submitButton = await page.waitForSelector('button[type="submit"]');
  await submitButton.click();
  console.log('📝 Formulario enviado');
  
  // Esperar a que la página reaccione al envío
  await page.waitForTimeout(3000);
}

async function handlePostSubmission(page, username, email) {
  try {
    // Intentar detectar página de fecha de nacimiento
    try {
      await page.waitForSelector('select[title="Month:"]', { timeout: 10000 });
      await handleBirthdateSelection(page);
    } catch {
      console.log('⚠️ No se solicitó fecha de nacimiento');
    }

    // Intentar detectar verificación de correo
    try {
      await page.waitForSelector('input[name="email_confirmation_code"]', { timeout: 10000 });
      return await handleEmailVerification(page, email);
    } catch {
      console.log('✅ No se solicitó verificación de código');
    }

    // Verificar si estamos en la página de inicio (registro exitoso)
    try {
      await page.waitForSelector('svg[aria-label="Instagram"]', { timeout: 15000 });
      console.log('🎉 ¡Registro exitoso!');
      return {
        usuario: username,
        email,
        status: 'success'
      };
    } catch {}

    // Detectar posibles bloqueos o errores
    const error = await detectRegistrationError(page);
    if (error) {
      throw new Error(error.message);
    }

    // Si no se detectó nada, intentar continuar
    const nextButtons = await page.$x('//button[contains(., "Next") or contains(., "Continue")]');
    if (nextButtons.length > 0) {
      await nextButtons[0].click();
      await page.waitForTimeout(3000);
      return await handlePostSubmission(page, username, email); // Recursivo
    }

    // Último recurso: verificar URL actual
    const currentUrl = page.url();
    if (currentUrl.includes('/challenge/') || currentUrl.includes('/verify_email/')) {
      throw new Error('Instagram solicitó verificación adicional');
    }

    throw new Error('No se pudo determinar el estado del registro');

  } catch (error) {
    throw new Error(`Error post-envío: ${error.message}`);
  }
}

async function handleBirthdateSelection(page) {
  console.log('📅 Seleccionando fecha de nacimiento...');
  
  // Mes - Valor aleatorio entre 1-12
  const month = Math.floor(Math.random() * 12) + 1;
  await page.select('select[title="Month:"]', month.toString());
  
  // Día - Valor aleatorio entre 1-28
  const day = Math.floor(Math.random() * 28) + 1;
  await page.select('select[title="Day:"]', day.toString());
  
  // Año - Valor aleatorio entre 1980-2000
  const year = Math.floor(Math.random() * 20) + 1980;
  await page.select('select[title="Year:"]', year.toString());
  
  // Continuar
  const nextButton = await page.waitForSelector('button:has-text("Next")');
  await nextButton.click();
  console.log(`🎂 Fecha seleccionada: ${month}/${day}/${year}`);
}

async function handleEmailVerification(page, email) {
  console.log('📬 Instagram solicitó verificación de correo');
  
  // Lógica para obtener el código real de tu servicio de correo
  const verificationCode = await getVerificationCodeFromEmail(email);
  
  await page.type('input[name="email_confirmation_code"]', verificationCode);
  
  const verifyButton = await page.waitForSelector('button:has-text("Next"), button:has-text("Confirm")');
  await verifyButton.click();
  
  console.log('✅ Código de verificación enviado');
  
  return {
    status: 'verification_sent',
    message: 'Esperando confirmación manual'
  };
}

async function detectRegistrationError(page) {
  // Detectar bloqueo por Instagram
  const blockedMsg = await page.$x('//*[contains(text(), "suspicious activity") or contains(text(), "blocked")]');
  if (blockedMsg.length > 0) {
    return {
      code: ERROR_CODES.BLOCKED_BY_INSTAGRAM,
      message: 'Instagram bloqueó el registro por actividad sospechosa'
    };
  }

  // Detectar requerimiento de CAPTCHA
  const captchaFrame = await page.$('iframe[src*="captcha"]');
  if (captchaFrame) {
    return {
      code: ERROR_CODES.CAPTCHA_REQUIRED,
      message: 'Instagram solicitó resolver CAPTCHA'
    };
  }

  // Detectar requerimiento de verificación telefónica
  const phoneVerification = await page.$('input[name="phone_number"]');
  if (phoneVerification) {
    return {
      code: ERROR_CODES.PHONE_VERIFICATION,
      message: 'Instagram solicitó verificación telefónica'
    };
  }

  return null;
}

// Función para obtener código de verificación (debes implementar según tu servicio)
async function getVerificationCodeFromEmail(email) {
  console.log(`⏳ Obteniendo código de verificación para: ${email}`);
  // Aquí implementarías la conexión con tu servicio de correo
  // Ejemplo: return await fetchCodeFromKraveAPI(email);
  
  // Simulación: genera un código aleatorio
  return Math.floor(100000 + Math.random() * 900000).toString();
}
