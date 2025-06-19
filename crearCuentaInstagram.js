// crearCuentaInstagram.js - con soporte de fallback visual

const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
puppeteer.use(StealthPlugin());
const fs = require('fs');
const path = require('path');
const { generar_usuario, generar_nombre } = require('./nombre_utils');
const { v4: uuidv4 } = require('uuid');
const fetch = require('node-fetch');

const TEMP_EMAIL_API = 'https://api.1secmail.com';
const MAX_ATTEMPTS = 7;
const INSTAGRAM_SIGNUP_URL = 'https://www.instagram.com/accounts/emailsignup/';
const proxy = process.argv[2] || null;
const ACCOUNTS_FILE = path.join(__dirname, 'cuentas_creadas.json');
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

async function humanType(page, selector, text) {
    await page.focus(selector);
    for (const char of text) {
        await page.type(selector, char, { delay: Math.floor(Math.random() * 40) + 20 });
        await delay(Math.floor(Math.random() * 100));
    }
}

async function moveMouseToElement(page, selector) {
    const rect = await page.evaluate(selector => {
        const element = document.querySelector(selector);
        if (!element) return null;
        const { x, y, width, height } = element.getBoundingClientRect();
        return { x: x + width / 2, y: y + height / 2 };
    }, selector);
    if (rect) {
        await page.mouse.move(rect.x, rect.y, { steps: Math.floor(Math.random() * 10) + 5 });
    }
}

async function detectInstagramErrors(page) {
    const errorSelectors = ['#ssfErrorAlert', 'div[role="alert"]', 'p[id*="error"]', 'span[class*="error"]', '.x1sxyh'];
    for (const selector of errorSelectors) {
        const errorElement = await page.$(selector);
        if (errorElement) {
            const errorText = await page.evaluate(el => el.textContent, errorElement);
            if (errorText) return errorText.trim();
        }
    }
    return null;
}

async function saveAccount(accountData) {
    try {
        let accounts = [];
        if (fs.existsSync(ACCOUNTS_FILE)) {
            const data = fs.readFileSync(ACCOUNTS_FILE, 'utf8');
            accounts = JSON.parse(data);
        }
        accounts.push({ ...accountData, creation_time: new Date().toISOString() });
        fs.writeFileSync(ACCOUNTS_FILE, JSON.stringify(accounts, null, 2));
        return true;
    } catch (error) {
        console.error('Error guardando cuenta:', error.message);
        return false;
    }
}

async function generateTempEmail() {
    try {
        const res = await fetch(`${TEMP_EMAIL_API}/v1/?action=genRandomMailbox&count=1`);
        const json = await res.json();
        return json[0];
    } catch {
        return `krave_${uuidv4().slice(0, 8)}@1secmail.com`;
    }
}

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
                    const regex = /\b(\d{6})\b/;
                    const match = regex.exec(content.textBody || content.htmlBody);
                    if (match) return match[1];
                }
            }
        } catch (e) {
            console.log(`Intento ${i + 1} fallido: ${e.message}`);
        }
        await delay(4000);
    }
    return await getVerificationCodeFallback(login, domain);
}

async function getVerificationCodeFallback(mailName, domain) {
    const fallbackURL = `https://email-fake.com/${domain}/${mailName}`;
    let browser;
    try {
        browser = await puppeteer.launch({
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu'],
            executablePath: '/usr/bin/chromium-browser'
        });
        const page = await browser.newPage();
        await page.goto(fallbackURL, { waitUntil: 'domcontentloaded' });
        for (let i = 0; i < MAX_ATTEMPTS; i++) {
            const title = await page.title();
            const match = title.match(/(\d{6})/);
            if (match) return match[1];
            await page.reload({ waitUntil: 'domcontentloaded' });
            await delay(3000);
        }
        return null;
    } catch (e) {
        console.error('Error en fallback visual:', e.message);
        return null;
    } finally {
        if (browser) await browser.close();
    }
}

async function createInstagramAccount() {
    const accountData = {
        usuario: '', email: '', password: '', proxy: proxy || 'none', status: 'error',
        error: '', timestamp: new Date().toISOString(), screenshots: []
    };
    let browser;
    try {
        const username = generar_usuario();
        const fullName = generar_nombre();
        const password = uuidv4().slice(0, 12);
        const email = await generateTempEmail();

        const args = ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu'];
        if (proxy && proxy !== 'none') args.push(`--proxy-server=${proxy}`);

        browser = await puppeteer.launch({ headless: true, args, executablePath: '/usr/bin/chromium-browser' });
        const page = await browser.newPage();

        await page.goto(INSTAGRAM_SIGNUP_URL, { waitUntil: 'networkidle2', timeout: 60000 });

        await moveMouseToElement(page, 'input[name="emailOrPhone"]');
        await humanType(page, 'input[name="emailOrPhone"]', email);
        await moveMouseToElement(page, 'input[name="fullName"]');
        await humanType(page, 'input[name="fullName"]', fullName);
        await moveMouseToElement(page, 'input[name="username"]');
        await humanType(page, 'input[name="username"]', username);
        await moveMouseToElement(page, 'input[name="password"]');
        await humanType(page, 'input[name="password"]', password);

        await page.click('button[type="submit"]');
        await delay(4000);

        const error = await detectInstagramErrors(page);
        if (error) throw new Error(error);

        const inputSelector = 'input[name="email_confirmation_code"]';
        if (await page.$(inputSelector)) {
            const code = await getVerificationCode(email);
            if (!code) throw new Error('No se recibió código');
            await humanType(page, inputSelector, code);
            await delay(2000);
            await page.click('button[type="button"]');
        }

        accountData.status = 'success';
        accountData.usuario = username;
        accountData.email = email;
        accountData.password = password;
    } catch (error) {
        accountData.error = error.message;
    } finally {
        if (browser) await browser.close();
        await saveAccount(accountData);
        console.log(JSON.stringify(accountData));
        process.exit(accountData.status === 'success' ? 0 : 1);
    }
}

createInstagramAccount();
