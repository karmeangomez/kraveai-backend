const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const proxyChain = require('proxy-chain');
const fs = require('fs');
const path = require('path');
const { generar_usuario, generar_nombre } = require('./nombre_utils');
const { v4: uuidv4 } = require('uuid');
const fetch = require('node-fetch');

puppeteer.use(StealthPlugin());

const TEMP_EMAIL_API = 'https://api.1secmail.com';
const MAX_ATTEMPTS = 7;
const INSTAGRAM_SIGNUP_URL = 'https://www.instagram.com/accounts/emailsignup/';
const proxyOriginal = process.argv[2] || null;
const ACCOUNTS_FILE = path.join(__dirname, 'cuentas_creadas.json');
const COOKIES_DIR = path.join(__dirname, 'cookies');
const delay = ms => new Promise(res => setTimeout(res, ms));

async function humanType(page, selector, text) {
    await page.focus(selector);
    for (const char of text) {
        await page.type(selector, char, { delay: Math.random() * 40 + 20 });
        await delay(Math.random() * 100);
    }
}

async function moveMouseToElement(page, selector) {
    const rect = await page.evaluate(sel => {
        const el = document.querySelector(sel);
        if (!el) return null;
        const { x, y, width, height } = el.getBoundingClientRect();
        return { x: x + width / 2, y: y + height / 2 };
    }, selector);
    if (rect) await page.mouse.move(rect.x, rect.y, { steps: 10 });
}

async function detectInstagramErrors(page) {
    const selectors = ['#ssfErrorAlert', 'div[role="alert"]', 'p[id*="error"]', 'span[class*="error"]'];
    for (const sel of selectors) {
        const el = await page.$(sel);
        if (el) {
            const text = await page.evaluate(el => el.textContent, el);
            if (text) return text.trim();
        }
    }
    return null;
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
            const res = await fetch(`${TEMP_EMAIL_API}/v1/?action=getMessages&login=${login}&domain=${domain}`);
            const messages = await res.json();
            for (const msg of messages) {
                if (msg.subject.toLowerCase().includes('instagram')) {
                    const msgRes = await fetch(`${TEMP_EMAIL_API}/v1/?action=readMessage&login=${login}&domain=${domain}&id=${msg.id}`);
                    const content = await msgRes.json();
                    const regex = /\b\d{6}\b/;
                    const match = regex.exec(content.textBody || content.htmlBody);
                    if (match) return match[0];
                }
            }
        } catch {}
        await delay(4000);
    }
    return null;
}

async function saveCookies(page, username) {
    const cookies = await page.cookies();
    if (!fs.existsSync(COOKIES_DIR)) fs.mkdirSync(COOKIES_DIR);
    const filePath = path.join(COOKIES_DIR, `${username}.json`);
    fs.writeFileSync(filePath, JSON.stringify(cookies, null, 2));
}

async function saveAccount(data) {
    const cuentas = fs.existsSync(ACCOUNTS_FILE)
        ? JSON.parse(fs.readFileSync(ACCOUNTS_FILE, 'utf8'))
        : [];
    cuentas.push({ ...data, creation_time: new Date().toISOString() });
    fs.writeFileSync(ACCOUNTS_FILE, JSON.stringify(cuentas, null, 2));
}

async function createInstagramAccount() {
    const account = {
        usuario: '', email: '', password: '', proxy: proxyOriginal || 'none',
        status: 'error', error: '', timestamp: new Date().toISOString(), screenshots: []
    };

    let browser;
    let proxyAnonimo = null;

    try {
        const username = generar_usuario();
        const fullName = generar_nombre();
        const password = uuidv4().slice(0, 12);
        const email = await generateTempEmail();

        const args = ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu'];
        if (proxyOriginal && proxyOriginal !== 'none') {
            proxyAnonimo = await proxyChain.anonymizeProxy(`http://${proxyOriginal}`);
            args.push(`--proxy-server=${proxyAnonimo}`);
            account.proxy = proxyAnonimo;
        }

        browser = await puppeteer.launch({
            headless: true,
            args,
            executablePath: '/usr/bin/chromium-browser'
        });

        const page = await browser.newPage();
        await page.setUserAgent('Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/117.0.0.0 Safari/537.36');
        await page.goto(INSTAGRAM_SIGNUP_URL, { waitUntil: 'networkidle2' });

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

        if (await page.$('input[name="email_confirmation_code"]')) {
            const code = await getVerificationCode(email);
            if (!code) throw new Error('No se recibió código de verificación');
            await humanType(page, 'input[name="email_confirmation_code"]', code);
            await delay(2000);
            await page.click('button[type="button"]');
        }

        account.status = 'success';
        account.usuario = username;
        account.email = email;
        account.password = password;
        await saveCookies(page, username);
    } catch (e) {
        account.error = e.message;
    } finally {
        if (browser) await browser.close();
        if (proxyAnonimo) await proxyChain.closeAnonymizedProxy(proxyAnonimo, true);
        await saveAccount(account);
        console.log(JSON.stringify(account));
        process.exit(account.status === 'success' ? 0 : 1);
    }
}

createInstagramAccount();
