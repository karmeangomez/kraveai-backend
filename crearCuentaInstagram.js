// crearCuentaInstagram.js - Generador de cuentas Instagram automatizado

const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');
const { generar_usuario, generar_nombre } = require('./nombre_utils');
const { guardarCuenta } = require('./utils/saveAccount');
const { v4: uuidv4 } = require('uuid');

const INSTAGRAM_SIGNUP_URL = 'https://www.instagram.com/accounts/emailsignup/';
const TEMP_EMAIL_API = 'https://api.1secmail.com/mailbox';
const MAX_ATTEMPTS = 3;

const proxy = process.argv[2] || null;
const flags = process.argv.slice(3) || [];

async function createInstagramAccount() {
    let browser;
    let accountData = {
        usuario: '',
        email: '',
        password: '',
        proxy: proxy || 'none',
        status: 'error',
        error: '',
        timestamp: new Date().toISOString()
    };

    try {
        const fullName = generar_nombre();
        const username = generar_usuario();
        const password = generatePassword(12);
        const email = await generateTempEmail();

        const browserOptions = {
            headless: true,
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-accelerated-2d-canvas',
                '--disable-gpu',
                ...flags
            ],
            ignoreHTTPSErrors: true,
            timeout: 120000
        };

        if (proxy && proxy !== 'none') {
            browserOptions.args.push(`--proxy-server=${proxy}`);
        }

        browser = await puppeteer.launch(browserOptions);
        const page = await browser.newPage();

        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');
        await page.goto(INSTAGRAM_SIGNUP_URL, { waitUntil: 'networkidle2', timeout: 60000 });

        await page.type('input[name="emailOrPhone"]', email);
        await page.type('input[name="fullName"]', fullName);
        await page.type('input[name="username"]', username);
        await page.type('input[name="password"]', password);

        await page.waitForTimeout(2000);
        await page.click('button[type="submit"]');

        let requiresVerification = false;
        let verificationCode = '';

        try {
            await page.waitForSelector('input[name="email_confirmation_code"]', { timeout: 15000 });
            requiresVerification = true;
        } catch (e) {}

        if (requiresVerification) {
            for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
                verificationCode = await getVerificationCode(email);
                if (verificationCode) break;
                await page.waitForTimeout(5000);
            }

            if (verificationCode) {
                await page.type('input[name="email_confirmation_code"]', verificationCode);
                await page.click('button[type="button"]');
                await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 });
            } else {
                throw new Error('No se pudo obtener el código de verificación');
            }
        }

        const success = await page.evaluate(() => {
            return window.location.href.includes('/accounts/emailsignup/') === false;
        });

        if (success) {
            accountData = {
                usuario: username,
                email: email,
                password: password,
                proxy: proxy || 'none',
                verification_code: verificationCode,
                status: 'success',
                timestamp: new Date().toISOString()
            };

            guardarCuenta(accountData);
        } else {
            throw new Error('Registro fallido después de completar el formulario');
        }

    } catch (error) {
        accountData.error = error.message;
        accountData.status = 'error';
    } finally {
        if (browser) await browser.close();
        return accountData;
    }
}

function generatePassword(length = 12) {
    const charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()_+~`|}{[]:;?><,./-=';
    let password = '';
    for (let i = 0; i < length; i++) {
        const randomIndex = Math.floor(Math.random() * charset.length);
        password += charset[randomIndex];
    }
    return password;
}

async function generateTempEmail() {
    try {
        const response = await fetch(`${TEMP_EMAIL_API}?action=genRandomMailbox&count=1`);
        const emails = await response.json();
        return emails[0];
    } catch (error) {
        const domains = ['gmail.com', 'yahoo.com', 'outlook.com', 'protonmail.com'];
        const domain = domains[Math.floor(Math.random() * domains.length)];
        return `krave_${uuidv4().substring(0, 8)}@${domain}`;
    }
}

async function getVerificationCode(email) {
    const [login, domain] = email.split('@');

    try {
        const response = await fetch(`${TEMP_EMAIL_API}?action=getMessages&login=${login}&domain=${domain}`);
        const messages = await response.json();

        for (const message of messages) {
            if (message.subject.toLowerCase().includes('instagram')) {
                const messageRes = await fetch(`${TEMP_EMAIL_API}?action=readMessage&login=${login}&domain=${domain}&id=${message.id}`);
                const messageData = await messageRes.json();
                const codeMatch = messageData.textBody.match(/\b\d{6}\b/);
                if (codeMatch) return codeMatch[0];
            }
        }
    } catch (error) {
        console.error('Error obteniendo código:', error);
    }

    return null;
}

createInstagramAccount()
    .then(result => {
        console.log(JSON.stringify(result));
        process.exit(result.status === 'success' ? 0 : 1);
    })
    .catch(error => {
        console.error(JSON.stringify({ error: error.message }));
        process.exit(1);
    });
