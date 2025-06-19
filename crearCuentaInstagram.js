const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
puppeteer.use(StealthPlugin());
const fs = require('fs');
const path = require('path');
const { generar_usuario, generar_nombre } = require('./nombre_utils');
const { v4: uuidv4 } = require('uuid');
const fetch = require('node-fetch');

// Configuración
const TEMP_EMAIL_API = 'https://api.1secmail.com';
const MAX_ATTEMPTS = 7;
const INSTAGRAM_SIGNUP_URL = 'https://www.instagram.com/accounts/emailsignup/';
const proxy = process.argv[2] || null;
const ACCOUNTS_FILE = path.join(__dirname, 'cuentas_creadas.json');

// Utilidades
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
const generatePassword = (len = 12) => [...Array(len)].map(() => 
    'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*'[Math.floor(Math.random() * 72)]
).join('');

// Comportamiento humano
async function humanType(page, selector, text) {
    await page.focus(selector);
    for (const char of text) {
        await page.type(selector, char, { 
            delay: Math.floor(Math.random() * 40) + 20 
        });
        await delay(Math.floor(Math.random() * 100));
    }
}

async function randomDelay(min = 500, max = 3000) {
    await delay(Math.floor(Math.random() * (max - min + 1) + min));
}

async function moveMouseToElement(page, selector) {
    const rect = await page.evaluate(selector => {
        const element = document.querySelector(selector);
        if (!element) return null;
        const { x, y, width, height } = element.getBoundingClientRect();
        return { x: x + width / 2, y: y + height / 2 };
    }, selector);

    if (rect) {
        await page.mouse.move(rect.x, rect.y, { 
            steps: Math.floor(Math.random() * 10) + 5 
        });
    }
}

// Manejo de errores de Instagram
async function detectInstagramErrors(page) {
    const errorSelectors = [
        '#ssfErrorAlert', 
        'div[role="alert"]', 
        'p[id*="error"]',
        'span[class*="error"]',
        '.x1sxyh'
    ];

    for (const selector of errorSelectors) {
        const errorElement = await page.$(selector);
        if (errorElement) {
            const errorText = await page.evaluate(el => el.textContent, errorElement);
            if (errorText) return errorText.trim();
        }
    }
    return null;
}

// Guardado de cuentas
async function saveAccount(accountData) {
    try {
        let accounts = [];
        if (fs.existsSync(ACCOUNTS_FILE)) {
            const data = fs.readFileSync(ACCOUNTS_FILE, 'utf8');
            accounts = JSON.parse(data);
        }

        accounts.push({
            ...accountData,
            creation_time: new Date().toISOString()
        });

        fs.writeFileSync(ACCOUNTS_FILE, JSON.stringify(accounts, null, 2));
        return true;
    } catch (error) {
        console.error('Error guardando cuenta:', error.message);
        return false;
    }
}

// Generación de email temporal
async function generateTempEmail() {
    try {
        const response = await fetch(`${TEMP_EMAIL_API}/v1/?action=genRandomMailbox&count=1`);
        const data = await response.json();
        return data[0];
    } catch (error) {
        return `krave_${uuidv4().slice(0, 8)}@1secmail.com`;
    }
}

// Obtención de código de verificación
async function getVerificationCode(email) {
    const [login, domain] = email.split('@');
    
    for (let i = 0; i < MAX_ATTEMPTS; i++) {
        try {
            const response = await fetch(`${TEMP_EMAIL_API}/v1/?action=getMessages&login=${login}&domain=${domain}`);
            const messages = await response.json();
            
            for (const msg of messages) {
                if (msg.subject.toLowerCase().includes('instagram')) {
                    const contentRes = await fetch(`${TEMP_EMAIL_API}/v1/?action=readMessage&login=${login}&domain=${domain}&id=${msg.id}`);
                    const content = await contentRes.json();
                    
                    // Buscar código en diferentes formatos
                    const codeRegex = /(\b\d{6}\b)|(code[\s:]+(\d{6}))|(>\s*(\d{6})\s*<)/i;
                    const match = codeRegex.exec(content.textBody || content.htmlBody);
                    
                    if (match) {
                        return match[1] || match[3] || match[5];
                    }
                }
            }
            await delay(4000);
        } catch (error) {
            console.error(`Intento ${i+1}: Error obteniendo código - ${error.message}`);
            await delay(3000);
        }
    }
    return null;
}

// Capturas de pantalla para depuración
async function takeScreenshot(page, name) {
    try {
        const screenshotDir = path.join(__dirname, 'screenshots');
        if (!fs.existsSync(screenshotDir)) fs.mkdirSync(screenshotDir);
        
        const screenshotPath = path.join(screenshotDir, `${name}_${Date.now()}.png`);
        await page.screenshot({ path: screenshotPath });
        return screenshotPath;
    } catch (error) {
        console.error('Error tomando screenshot:', error.message);
        return null;
    }
}

// Función principal
async function createInstagramAccount() {
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

    try {
        // Generar datos de cuenta
        const username = generar_usuario();
        const fullName = generar_nombre();
        const password = generatePassword();
        const email = await generateTempEmail();

        // Configurar Puppeteer
        const args = [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-gpu',
            '--disable-infobars',
            '--window-size=1400,900',
            '--lang=es-ES'
        ];
        
        if (proxy && proxy !== 'none') args.push(`--proxy-server=${proxy}`);

        browser = await puppeteer.launch({ 
            headless: true,
            args,
            ignoreDefaultArgs: ['--enable-automation'],
            // Para Raspberry Pi:
            // executablePath: '/usr/bin/chromium-browser'
        });
        
        page = await browser.newPage();
        
        // Configurar navegador
        await page.setExtraHTTPHeaders({
            'Accept-Language': 'es-ES,es;q=0.9'
        });
        
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/117.0.0.0 Safari/537.36');
        
        // Navegar a Instagram
        await page.goto(INSTAGRAM_SIGNUP_URL, { 
            waitUntil: 'networkidle2', 
            timeout: 120000
        });

        // Captura inicial
        accountData.screenshots.push(await takeScreenshot(page, 'inicio'));

        // Llenar formulario con comportamiento humano
        await moveMouseToElement(page, 'input[name="emailOrPhone"]');
        await humanType(page, 'input[name="emailOrPhone"]', email);
        
        await moveMouseToElement(page, 'input[name="fullName"]');
        await humanType(page, 'input[name="fullName"]', fullName);
        
        await moveMouseToElement(page, 'input[name="username"]');
        await humanType(page, 'input[name="username"]', username);
        
        await moveMouseToElement(page, 'input[name="password"]');
        await humanType(page, 'input[name="password"]', password);
        
        // Captura después de llenar formulario
        accountData.screenshots.push(await takeScreenshot(page, 'formulario_lleno'));
        
        // Enviar formulario
        await moveMouseToElement(page, 'button[type="submit"]');
        await randomDelay(800, 1500);
        await page.click('button[type="submit"]');
        await randomDelay(2000, 4000);

        // Verificar errores inmediatos
        const formError = await detectInstagramErrors(page);
        if (formError) throw new Error(formError);

        // Manejar diferentes flujos
        let requiresEmailVerification = false;
        
        // Verificar si Instagram pide verificación por email
        try {
            await page.waitForSelector('input[name="email_confirmation_code"]', { timeout: 10000 });
            requiresEmailVerification = true;
        } catch (error) {
            // Instagram no solicitó verificación por email
        }

        if (requiresEmailVerification) {
            accountData.screenshots.push(await takeScreenshot(page, 'pre_verificacion'));
            
            // Obtener código de verificación
            const code = await getVerificationCode(email);
            if (!code) throw new Error('No se recibió el código de verificación');
            
            // Ingresar código
            await moveMouseToElement(page, 'input[name="email_confirmation_code"]');
            await humanType(page, 'input[name="email_confirmation_code"]', code);
            
            await moveMouseToElement(page, 'button[type="button"]');
            await randomDelay(800, 1500);
            await page.click('button[type="button"]');
            
            // Esperar resultado
            await randomDelay(3000, 5000);
            accountData.screenshots.push(await takeScreenshot(page, 'post_verificacion'));
            
            // Verificar errores en verificación
            const verificationError = await detectInstagramErrors(page);
            if (verificationError) throw new Error(verificationError);
        }

        // Verificar si la cuenta se creó exitosamente
        let accountCreated = false;
        try {
            // Verificar cambio de URL
            const currentUrl = await page.url();
            if (!currentUrl.includes('/emailsignup/')) {
                accountCreated = true;
            }
            
            // Verificar elementos de éxito
            try {
                await page.waitForSelector('a[href="/"]', { timeout: 5000 });
                accountCreated = true;
            } catch (error) {}
        } catch (error) {
            throw new Error('No se pudo confirmar la creación de la cuenta');
        }

        if (!accountCreated) {
            throw new Error('Registro fallido después del proceso de verificación');
        }

        // Éxito
        accountData.status = 'success';
        accountData.usuario = username;
        accountData.email = email;
        accountData.password = password;
        accountData.screenshots.push(await takeScreenshot(page, 'exito'));

    } catch (error) {
        accountData.error = error.message;
        accountData.screenshots.push(await takeScreenshot(page, 'error'));
    } finally {
        // Guardar cuenta independientemente del resultado
        await saveAccount(accountData);
        
        // Cerrar navegador
        if (browser) await browser.close();
        
        // Salida
        console.log(JSON.stringify(accountData));
        process.exit(accountData.status === 'success' ? 0 : 1);
    }
}

// Iniciar proceso
createInstagramAccount();
