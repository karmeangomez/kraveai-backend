// crearCuentaInstagram.js
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const proxyChain = require('proxy-chain');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid'); // Corrección de 'vek4' a 'v4'
const fetch = require('node-fetch');
const { URL } = require('url');
const { generar_usuario, generar_nombre } = require('./nombre_utils');

puppeteer.use(StealthPlugin());

const TEMP_EMAIL_API = 'https://api.1secmail.com';
const MAX_ATTEMPTS = 7;
const INSTAGRAM_SIGNUP_URL = 'https://www.instagram.com/accounts/emailsignup/';
const COOKIES_DIR = path.join(__dirname, 'cookies');
const ACCOUNTS_FILE = path.join(__dirname, 'cuentas_creadas.json');
const SCREENSHOTS_DIR = path.join(__dirname, 'screenshots');
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

// Obtener proxy desde argumentos CLI
const rawProxy = process.argv[2] || null;

// Validar y formatear proxy
function validateAndFormatProxy(proxy) {
    if (!proxy || proxy === 'none') return null;

    try {
        let formattedProxy = proxy;
        if (!proxy.startsWith('http://') && !proxy.startsWith('socks5://')) {
            formattedProxy = `http://${proxy}`;
        }

        const url = new URL(formattedProxy);
        if (!url.hostname || !url.port) {
            throw new Error('Proxy inválido: falta hostname o puerto');
        }

        return formattedProxy;
    } catch (error) {
        console.error(`❌ Error validando proxy: ${error.message}`);
        return null;
    }
}

// Comportamiento humano
async function humanType(page, selector, text) {
    try {
        await page.focus(selector);
        for (const char of text) {
            await page.type(selector, char, { delay: Math.random() * 40 + 20 });
            if (Math.random() > 0.7) await delay(Math.random() * 100);
        }
    } catch (error) {
        console.error(`❌ Error en humanType para ${selector}: ${error.message}`);
        throw error;
    }
}

// Verificar disponibilidad de nombre de usuario
async function verifyUsernameAvailability(page, username) {
    try {
        await page.focus('input[name="username"]');
        await page.evaluate(selector => {
            const input = document.querySelector(selector);
            if (input) input.value = '';
        }, 'input[name="username"]');

        await humanType(page, 'input[name="username"]', username);
        await delay(2000); // Esperar validación de Instagram

        const errorElements = await page.$$('div[role="alert"], p[id*="error"], span[class*="error"], div[class*="error"]');
        for (const element of errorElements) {
            const errorText = await page.evaluate(el => el.textContent, element);
            if (errorText && (errorText.includes('taken') || errorText.includes('no está disponible'))) {
                console.error(`❌ Nombre de usuario ${username} no disponible: ${errorText}`);
                return false;
            }
        }

        return true;
    } catch (error) {
        console.error(`⚠️ Error verificando usuario ${username}: ${error.message}`);
        return false;
    }
}

// Captura de pantalla
async function saveScreenshot(page, name) {
    try {
        if (!fs.existsSync(SCREENSHOTS_DIR)) fs.mkdirSync(SCREENSHOTS_DIR);
        const filePath = path.join(SCREENSHOTS_DIR, `${name}_${Date.now()}.png`);
        await page.screenshot({ path: filePath, fullPage: true });
        return filePath;
    } catch (error) {
        console.error(`❌ Error guardando screenshot: ${error.message}`);
        return null;
    }
}

// Guardar cookies
async function saveCookies(page, username) {
    try {
        if (!fs.existsSync(COOKIES_DIR)) fs.mkdirSync(COOKIES_DIR);
        const cookies = await page.cookies();
        fs.writeFileSync(
            path.join(COOKIES_DIR, `${username}.json`),
            JSON.stringify(cookies, null, 2)
        );
    } catch (error) {
        console.error(`❌ Error guardando cookies: ${error.message}`);
    }
}

// Guardar cuenta
async function saveAccount(data) {
    try {
        let accounts = [];
        if (fs.existsSync(ACCOUNTS_FILE)) {
            accounts = JSON.parse(fs.readFileSync(ACCOUNTS_FILE, 'utf8'));
        }
        accounts.push({ ...data, creation_time: new Date().toISOString() });
        fs.writeFileSync(ACCOUNTS_FILE, JSON.stringify(accounts, null, 2));
    } catch (error) {
        console.error(`❌ Error guardando cuenta: ${error.message}`);
    }
}

// Generar email temporal
async function generateTempEmail() {
    try {
        const response = await fetch(`${TEMP_EMAIL_API}/v1/?action=genRandomMailbox&count=1`);
        const data = await response.json();
        return data[0];
    } catch (error) {
        console.error(`⚠️ Error generando email: ${error.message}`);
        return `krave_${uuidv4().slice(0, 8)}@1secmail.com`;
    }
}

// Obtener código de verificación
async function getVerificationCode(email) {
    const [login, domain] = email.split('@');
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
        try {
            console.error(`📭 Buscando código (intento ${attempt}/${MAX_ATTEMPTS})...`);
            const response = await fetch(`${TEMP_EMAIL_API}/v1/?action=getMessages&login=${login}&domain=${domain}`);
            const messages = await response.json();
            for (const message of messages) {
                if (message.subject.toLowerCase().includes('instagram')) {
                    const contentRes = await fetch(`${TEMP_EMAIL_API}/v1/?action=readMessage&login=${login}&domain=${domain}&id=${message.id}`);
                    const content = await contentRes.json();
                    const codeRegex = /(\b\d{6}\b)|(código[\s:]+(\d{6}))|(>\s*(\d{6})\s*<)/i;
                    const match = codeRegex.exec(content.textBody || content.htmlBody);
                    if (match) {
                        return match[1] || match[3] || match[5];
                    }
                }
            }
            await delay(5000);
        } catch (error) {
            console.error(`⚠️ Error obteniendo código: ${error.message}`);
        }
    }
    console.error(`❌ No se recibió código tras ${MAX_ATTEMPTS} intentos`);
    return null;
}

// Función principal
async function createInstagramAccount() {
    const proxy = validateAndFormatProxy(rawProxy);
    const accountData = {
        usuario: '',
        email: '',
        password: '',
        proxy: proxy || 'none',
        status: 'error',
        error: '',
        timestamp: new Date().toISOString(),
        screenshots: []
    };
    let browser;
    let page;
    let proxyAnon = null;

    try {
        if (!proxy) throw new Error('No se proporcionó un proxy válido');

        // Anonimizar proxy
        proxyAnon = await proxyChain.anonymizeProxy(proxy);
        console.error(`🔍 Proxy anonimizado: ${proxyAnon}`);

        const proxyUrl = new URL(proxy);
        const hostPort = `${proxyUrl.hostname}:${proxyUrl.port}`;
        const credentials = proxyUrl.username ? {
            username: proxyUrl.username,
            password: proxyUrl.password
        } : null;

        console.error(`🔁 Usando proxy: ${hostPort}`);

        // Configurar navegador
        const browserOptions = {
            headless: true,
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-gpu',
                '--disable-infobars',
                '--window-size=1400,900',
                '--lang=es-ES',
                `--proxy-server=${hostPort}`
            ],
            executablePath: '/usr/bin/chromium-browser'
        };

        browser = await puppeteer.launch(browserOptions);
        page = await browser.newPage();

        // Autenticar credenciales del proxy
        if (credentials) {
            await page.authenticate(credentials);
        }

        await page.setUserAgent('Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/117.0.0.0 Safari/537.36');
        await page.setExtraHTTPHeaders({ 'Accept-Language': 'es-ES,es;q=0.9' });

        // Navegar a Instagram
        console.error('🌐 Navegando a Instagram...');
        await page.goto(INSTAGRAM_SIGNUP_URL, { waitUntil: 'networkidle2', timeout: 60000 });
        accountData.screenshots.push(await saveScreenshot(page, 'inicio'));

        // Verificar formulario
        const emailInput = await page.$('input[name="emailOrPhone"]');
        if (!emailInput) {
            accountData.screenshots.push(await saveScreenshot(page, 'no_formulario'));
            throw new Error('No se encontró el formulario de registro');
        }

        // Generar datos
        let username = generar_usuario();
        const fullName = generar_nombre();
        const password = uuidv4().slice(0, 12);
        const email = await generateTempEmail();

        console.error(`📝 Datos generados: email=${email}, username=${username}, fullName=${fullName}, password=${password}`);

        // Verificar disponibilidad de usuario con reintentos
        let attempts = 0;
        const maxUsernameAttempts = 3;
        while (attempts < maxUsernameAttempts) {
            const isAvailable = await verifyUsernameAvailability(page, username);
            if (isAvailable) break;
            attempts++;
            console.error(`⚠️ Intento ${attempts}/${maxUsernameAttempts}: ${username} no disponible, generando nuevo...`);
            username = generar_usuario();
            if (attempts === maxUsernameAttempts) {
                accountData.screenshots.push(await saveScreenshot(page, 'username_failed'));
                throw new Error(`No se encontró nombre de usuario disponible tras ${maxUsernameAttempts} intentos`);
            }
        }

        // Llenar formulario
        console.error('📝 Llenando formulario...');
        await humanType(page, 'input[name="emailOrPhone"]', email);
        await humanType(page, 'input[name="fullName"]', fullName);
        await humanType(page, 'input[name="username"]', username);
        await humanType(page, 'input[name="password"]', password);
        accountData.screenshots.push(await saveScreenshot(page, 'formulario_llenado'));

        // Enviar formulario
        console.error('🚀 Enviando formulario...');
        await page.click('button[type="submit"]');
        await delay(5000);

        // Verificar errores
        const error = await page.$('div[role="alert"], p[id*="error"], span[class*="error"]');
        if (error) {
            const errorText = await page.evaluate(el => el.textContent, error);
            accountData.screenshots.push(await saveScreenshot(page, 'form_error'));
            throw new Error(`Error en formulario: ${errorText}`);
        }

        // Verificar si requiere código
        const requiresVerification = await page.$('input[name="email_confirmation_code"]');
        if (requiresVerification) {
            console.error('📬 Requiere verificación por email');
            accountData.screenshots.push(await saveScreenshot(page, 'pre_verificacion'));
            const code = await getVerificationCode(email);
            if (!code) {
                accountData.screenshots.push(await saveScreenshot(page, 'no_code'));
                throw new Error('No se recibió el código de verificación');
            }
            console.error(`🔑 Código recibido: ${code}`);
            await humanType(page, 'input[name="email_confirmation_code"]', code);
            await page.click('button[type="button"]');
            await delay(5000);
        }

        // Confirmar creación
        console.error('✅ Verificando creación de cuenta...');
        const successSelector = await page.waitForSelector('a[href="/"]', { timeout: 10000 }).catch(() => null);
        if (!successSelector) {
            accountData.screenshots.push(await saveScreenshot(page, 'no_success'));
            throw new Error('No se pudo confirmar la creación de la cuenta');
        }

        // Guardar cookies y datos
        await saveCookies(page, username);
        accountData.status = 'success';
        accountData.usuario = username;
        accountData.email = email;
        accountData.password = password;
        accountData.screenshots.push(await saveScreenshot(page, 'exito'));
        console.error(`🎉 Cuenta creada exitosamente: @${username}`);
    } catch (error) {
        accountData.error = error.message;
        console.error(`❌ Error: ${error.message}`);
        if (page) accountData.screenshots.push(await saveScreenshot(page, 'error'));
    } finally {
        if (browser) await browser.close();
        if (proxyAnon) await proxyChain.closeAnonymizedProxy(proxyAnon, true);
        await saveAccount(accountData);
        console.log(JSON.stringify(accountData));
    }
}

createInstagramAccount();
