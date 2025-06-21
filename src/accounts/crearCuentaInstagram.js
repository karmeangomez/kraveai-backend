import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import { v4 as uuidv4 } from 'uuid';
import { getRandomName } from '../utils/nombre_utils.js';
import { humanType, randomDelay, simulateMouseMovement, humanInteraction } from '../utils/humanActions.js';
import ProxyRotationSystem from '../proxies/proxyRotationSystem.js';
import AccountManager from './accountManager.js';
import { getTempMail } from '../email/tempMail.js';

puppeteer.use(StealthPlugin());

const logger = {
    info: (msg) => console.log(`[INFO] ${new Date().toISOString()} - ${msg}`),
    error: (msg) => console.error(`[ERROR] ${new Date().toISOString()} - ${msg}`)
};

async function crearCuentaInstagram() {
    const browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu'],
        executablePath: '/usr/bin/chromium-browser'
    });
    const page = await browser.newPage();

    let proxyObj = ProxyRotationSystem.getBestProxy();
    let proxyStr = proxyObj ? proxyObj.string : 'none';

    try {
        logger.info(`🛡️ Usando proxy: ${proxyStr}`);

        if (proxyObj) {
            await page.authenticate({
                username: proxyObj.auth?.username,
                password: proxyObj.auth?.password
            });
        }

        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');
        await page.goto('https://www.instagram.com/accounts/emailsignup/', { waitUntil: 'networkidle2' });

        await randomDelay(2000, 5000);
        await simulateMouseMovement(page);

        const { firstName, lastName } = getRandomName();
        const username = `${firstName.toLowerCase()}${lastName.toLowerCase()}${Math.floor(Math.random() * 1000)}`;
        const password = `${firstName}${lastName}${Math.random().toString(36).slice(-4)}!`;
        const { email } = await getTempMail();

        await humanInteraction(page);

        const emailInput = await page.$('input[name="emailOrPhone"]');
        if (!emailInput) throw new Error('No se encontró el campo de email');

        await humanType(page, 'input[name="emailOrPhone"]', email);
        await humanType(page, 'input[name="fullName"]', `${firstName} ${lastName}`);
        await humanType(page, 'input[name="username"]', username);
        await humanType(page, 'input[name="password"]', password);

        await randomDelay(1000, 3000);
        const signUpButton = await page.$('button[type="submit"]');
        if (!signUpButton) throw new Error('No se encontró el botón de registro');
        await signUpButton.click();

        await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 10000 }).catch(() => {});

        const account = {
            id: uuidv4(),
            username,
            email,
            password,
            proxy: proxyStr,
            status: 'created'
        };
        AccountManager.addAccount(account);
        ProxyRotationSystem.markProxyUsed(proxyStr);

        await browser.close();
        return account;

    } catch (error) {
        logger.error(`❌ Error creando cuenta: ${error.message}`);
        ProxyRotationSystem.recordFailure(proxyStr);

        const account = {
            id: uuidv4(),
            username: '',
            email: '',
            password: '',
            proxy: proxyStr,
            status: 'failed',
            error: error.message
        };
        AccountManager.addAccount(account);

        await browser.close();
        return account;
    }
}

export { crearCuentaInstagram };
