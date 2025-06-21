import puppeteer from 'puppeteer';
import emailManager from '../email/emailManager.js';
import nombreUtils from '../utils/nombre_utils.js';
import humanActions from '../utils/humanActions.js';
import { generateRussianFingerprint } from '../fingerprints/generator.js';
import fs from 'fs';
import path from 'path';

const __dirname = path.resolve();

export default async function crearCuentaInstagram(proxySystem, retryCount = 0) {
    const accountData = {
        id: Date.now().toString(),
        status: 'pending',
        attempts: retryCount + 1
    };

    let browser;
    try {
        // 1. Obtener proxy
        let proxy = null;
        try {
            proxy = proxySystem.getBestProxy();
            accountData.proxy = proxy.string;
            console.log(`🛡️ Usando proxy: ${proxy.string}`);
        } catch (error) {
            console.warn('⚠️ Continuando sin proxy');
            accountData.proxy = 'none';
        }

        // 2. Generar datos de usuario
        accountData.fullName = nombreUtils.generateRussianName();
        accountData.username = generateUsername(accountData.fullName);
        accountData.password = generatePassword();
        accountData.email = await emailManager.getRandomEmail();

        // 3. Configurar navegador
        const fingerprint = generateRussianFingerprint();
        const launchOptions = {
            headless: true,
            executablePath: '/usr/bin/chromium-browser',
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-gpu'
            ]
        };

        if (proxy) {
            launchOptions.args.push(`--proxy-server=${proxy.ip}:${proxy.port}`);
        }

        browser = await puppeteer.launch(launchOptions);
        const page = await browser.newPage();

        if (proxy?.auth) {
            await page.authenticate(proxy.auth);
        }

        await page.setUserAgent(fingerprint.userAgent);
        await page.setViewport(fingerprint.resolution);
        await page.setExtraHTTPHeaders({ 'Accept-Language': fingerprint.language });

        // 4. Navegar a Instagram y llenar formulario
        await page.goto('https://www.instagram.com/accounts/emailsignup/', { waitUntil: 'networkidle2' });
        await humanActions.waitRandomDelay?.();
        await humanActions.simulateMouseMovement(page);

        await humanActions.humanType(page, 'input[name="emailOrPhone"]', accountData.email);
        await humanActions.humanType(page, 'input[name="fullName"]', accountData.fullName);
        await humanActions.humanType(page, 'input[name="username"]', accountData.username);
        await humanActions.humanType(page, 'input[name="password"]', accountData.password);

        await humanActions.waitRandomDelay?.();
        await humanActions.simulateMouseMovement(page);

        await Promise.all([
            page.waitForNavigation({ waitUntil: 'networkidle2' }),
            humanActions.clickLikeHuman?.(page, 'button[type="submit"]') || page.click('button[type="submit"]')
        ]);

        // 5. Esperar código de verificación y enviarlo
        const code = await emailManager.waitForCode(accountData.email);
        await humanActions.humanType(page, 'input[name="email_confirmation_code"]', code);
        await humanActions.simulateMouseMovement(page);
        await humanActions.clickLikeHuman?.(page, 'button[type="submit"]') || page.click('button[type="submit"]');
        await humanActions.waitRandomDelay?.();

        // 6. Validar cuenta creada correctamente
        await page.waitForTimeout(5000);
        const currentUrl = page.url();
        if (currentUrl.includes('/accounts/')) {
            throw new Error('Redirigido a página de error');
        }

        accountData.status = 'created';
        accountData.cookiesPath = `cookies/${accountData.username}.json`;

        const cookies = await page.cookies();
        fs.writeFileSync(accountData.cookiesPath, JSON.stringify(cookies, null, 2));
        const screenshotPath = `screenshots/${accountData.username}_final.png`;
        await page.screenshot({ path: screenshotPath });
        accountData.screenshotPath = screenshotPath;

        if (proxy) {
            proxySystem.recordSuccess(proxy.string);
        }

        return accountData;

    } catch (error) {
        accountData.status = 'failed';
        accountData.error = error.message;

        if (proxy) {
            proxySystem.recordFailure(proxy.string);
        }

        if (retryCount < 2) {
            console.log(`🔄 Reintentando (${retryCount + 1}/3)...`);
            return crearCuentaInstagram(proxySystem, retryCount + 1);
        }

        return accountData;
    } finally {
        if (browser) await browser.close();
    }
}

function generateUsername(fullName) {
    return fullName.toLowerCase().replace(/\s+/g, '') + Math.floor(Math.random() * 1000);
}

function generatePassword() {
    return Math.random().toString(36).slice(-10);
}
