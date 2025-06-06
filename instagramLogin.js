// instagramLogin.js - Módulo para iniciar sesión en Instagram con Puppeteer usando proxies rotativos y cookies persistentes.

const puppeteer = require('puppeteer');
const humanBehavior = require('./humanBehavior');
const encryption = require('./encryption');
const cookies = require('./cookies');
const proxyBank = require('./proxyBank');

// Función principal de login
async function loginInstagram() {
    // Obtener credenciales de Instagram (desencriptadas si es necesario)
    let igUsername, igPassword;
    try {
        igUsername = encryption.decrypt(process.env.IG_USERNAME);
        igPassword = encryption.decrypt(process.env.IG_PASSWORD);
    } catch (e) {
        console.error("No se pudieron obtener/desencriptar las credenciales de Instagram:", e);
        return false;
    }
    if (!igUsername || !igPassword) {
        console.error("Credenciales de Instagram no proporcionadas.");
        return false;
    }

    let loggedIn = false;
    let lastError = null;
    const totalProxies = proxyBank.count();
    let attempts = 0;

    // Intentar con distintos proxies hasta lograr login o agotar lista
    while (!loggedIn && attempts < totalProxies) {
        const proxy = proxyBank.getProxy();
        if (!proxy) {
            lastError = new Error("No hay proxies disponibles para intentar.");
            break;
        }
        console.log(`\n[InstagramLogin] Probando login con proxy: ${proxy.host}:${proxy.port}`);

        let browser = null;
        try {
            // Lanzar Puppeteer con el proxy seleccionado
            browser = await puppeteer.launch({
                headless: true,
                args: [
                    `--proxy-server=${proxy.host}:${proxy.port}`,
                    '--no-sandbox',
                    '--disable-setuid-sandbox'
                ]
            });
            const page = await browser.newPage();
            // Autenticación del proxy con usuario/contraseña si aplica
            if (proxy.username && proxy.password) {
                await page.authenticate({ username: proxy.username, password: proxy.password });
            }

            // Intentar cargar cookies guardadas para evitar reloguear si la sesión persiste
            let cookiesLoaded = false;
            try {
                cookiesLoaded = await cookies.loadCookies(page);
            } catch (err) {
                console.warn("Error al cargar cookies guardadas:", err);
            }
            if (cookiesLoaded) {
                // Verificar si la sesión sigue válida navegando a una página que requiere login
                const response = await page.goto('https://www.instagram.com/accounts/edit/', { waitUntil: 'domcontentloaded', timeout: 15000 });
                const status = response ? response.status() : null;
                if (status === 429) {
                    // Error 429 indica demasiadas solicitudes (posible bloqueo de IP)
                    console.warn("El proxy ha devuelto 429 (Too Many Requests) al validar sesión. Se rotará el proxy.");
                    proxyBank.reportFailure(proxy);
                    lastError = new Error("Proxy bloqueado (429) al validar cookies de sesión");
                    await browser.close();
                    attempts++;
                    continue; // intentar con el siguiente proxy
                }
                // Comprobar URL actual para ver si Instagram redirigió al login (sesión inválida)
                const currentUrl = page.url();
                if (!currentUrl.includes('/accounts/login')) {
                    // La sesión es válida (no redirigió a login)
                    console.log("Sesión de Instagram restaurada mediante cookies (no se requiere login).");
                    proxyBank.reportSuccess(proxy);
                    global.browser = browser;
                    global.page = page;
                    loggedIn = true;
                    break; // salir del bucle de proxies, login conseguido
                } else {
                    console.log("Las cookies guardadas no son válidas o la sesión expiró, se procederá a login manual.");
                    // Limpiar cookies inválidas antes de reloguear
                    try {
                        await page.deleteCookie(...(await page.cookies()));
                    } catch (err) {
                        /* ignorar errores de borrado de cookies */
                    }
                }
            }

            // Navegar a la página de login de Instagram
            await page.goto('https://www.instagram.com/accounts/login/', { waitUntil: 'networkidle2' });
            await page.waitForSelector('input[name=username]');

            // Ingresar credenciales con comportamiento humano (simulación de tecleo)
            await humanBehavior.type(page, 'input[name=username]', igUsername);
            await humanBehavior.type(page, 'input[name=password]', igPassword);
            // Click en el botón de iniciar sesión con comportamiento humano
            await humanBehavior.click(page, 'button[type=submit]');

            // Esperar la respuesta de la petición de login (XHR) de Instagram
            let loginResponse;
            try {
                loginResponse = await page.waitForResponse(
                    res => res.url().includes('/accounts/login/ajax/') && res.status() === 200,
                    { timeout: 15000 }
                );
            } catch {
                loginResponse = null;
            }

            let loginResult = null;
            if (loginResponse) {
                try {
                    loginResult = await loginResponse.json();
                } catch {
                    loginResult = null;
                }
            }

            // Analizar resultado del intento de login
            if (loginResult && loginResult.authenticated) {
                // Login exitoso
                console.log("Login de Instagram exitoso.");
                try {
                    await cookies.saveCookies(page);  // Guardar cookies de sesión para futuras ejecuciones
                } catch (err) {
                    console.error("Error al guardar cookies de sesión:", err);
                }
                proxyBank.reportSuccess(proxy);
                global.browser = browser;
                global.page = page;
                loggedIn = true;
                break;
            } else {
                // Login no autenticado (falló por alguna razón)
                let msg = loginResult ? (loginResult.message || '') : '';
                let errorType = loginResult ? (loginResult.error_type || '') : '';
                if (msg.includes("few minutes") || errorType === "rate_limit_error") {
                    // Instagram retornó "Please wait a few minutes..." => bloqueo temporal / demasiados intentos
                    console.warn("Instagram respondió con 'wait a few minutes' (posible rate limit). Se rotará el proxy.");
                    proxyBank.reportFailure(proxy);
                    lastError = new Error("Bloqueo temporal de Instagram durante login (rate limit).");
                    await browser.close();
                    attempts++;
                    continue; // reintentar con siguiente proxy
                } else if (errorType === "bad_password" || errorType === "invalid_user") {
                    // Credenciales incorrectas (usuario o contraseña inválidos)
                    lastError = new Error("Credenciales de Instagram incorrectas. Deteniendo intento de login.");
                    console.error(lastError.message);
                    await browser.close();
                    break; // no reintenta con otros proxies porque el error es de credenciales
                } else if (errorType === "checkpoint_challenge_required" || (loginResult && loginResult.challenge)) {
                    // Instagram requiere verificación adicional (checkpoint)
                    lastError = new Error("Instagram requiere verificación (checkpoint) para este login.");
                    console.error(lastError.message);
                    await browser.close();
                    break; // detener - se necesita intervención manual en la cuenta
                } else if (loginResult && loginResult.two_factor_required) {
                    // La cuenta tiene 2FA habilitado y se solicitó código de autenticación en dos pasos
                    lastError = new Error("No se pudo iniciar sesión: la cuenta tiene 2FA habilitado (requiere código).");
                    console.error(lastError.message);
                    await browser.close();
                    break;
                } else {
                    // Otro error desconocido (no se obtuvo respuesta JSON o estructura inesperada)
                    lastError = new Error("Fallo desconocido en el login de Instagram.");
                    console.error(lastError.message, loginResult);
                    await browser.close();
                    // Intentar con siguiente proxy por si fue un problema de red/proxy
                    attempts++;
                    continue;
                }
            }
        } catch (err) {
            // Manejo de errores inesperados en el proceso de login con este proxy
            console.error("Error durante el proceso de login con el proxy:", err);
            lastError = err;
            proxyBank.reportFailure(proxy);
            if (browser) {
                await browser.close().catch(() => {});
            }
            attempts++;
            continue; // intentar con el siguiente proxy
        }
    } // fin del while de proxies

    if (!loggedIn) {
        console.error("No fue posible iniciar sesión en Instagram después de probar todos los proxies.");
        // Notificar por Telegram si está habilitado
        if (process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHAT_ID) {
            const botToken = process.env.TELEGRAM_BOT_TOKEN;
            const chatId = process.env.TELEGRAM_CHAT_ID;
            const text = lastError ? `[InstagramLogin] ${lastError.message}` : "[InstagramLogin] Fallo al iniciar sesión en Instagram.";
            // Enviar mensaje (sin esperar para no bloquear en caso de fallo)
            fetch(`https://api.telegram.org/bot${botToken}/sendMessage?chat_id=${chatId}&text=${encodeURIComponent(text)}`)
                .catch(err => console.error("Error al enviar notificación de Telegram:", err));
        }
    }

    return loggedIn;
}

module.exports = { loginInstagram };
