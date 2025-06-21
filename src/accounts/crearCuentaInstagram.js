import puppeteer from 'puppeteer';
import { getRandomEmail } from '../email/emailManager.js';
import { generateRussianName } from '../utils/nombre_utils.js';
import ProxyRotationSystem from '../proxies/proxyRotationSystem.js';
import { humanType, randomDelay, simulateMouseMovement } from '../utils/humanActions.js';
import fs from 'fs';
import path from 'path';

// Configuración de logs y rutas
const __dirname = path.resolve();
const logger = {
    info: (msg) => console.log(`[INFO] ${new Date().toISOString()} - ${msg}`),
    warn: (msg) => console.warn(`[WARN] ${new Date().toISOString()} - ${msg}`),
    error: (msg) => console.error(`[ERROR] ${new Date().toISOString()} - ${msg}`)
};

export default async function crearCuentaInstagram(retryCount = 0) {
    // ... (resto de tu código existente sin cambios) ...
    try {
        // 1. Obtener proxy
        let proxy = null;
        try {
            proxy = ProxyRotationSystem.getBestProxy();
            accountData.proxy = proxy.string;
            logger.info(`🛡️ Usando proxy: ${proxy.string}`);
        } catch (error) {
            logger.warn('⚠️ Continuando sin proxy');
            accountData.proxy = 'none';
        }

        // ... (generación de datos de usuario) ...

        // 4. Configurar navegador
        const launchOptions = {
            headless: true,
            executablePath: '/usr/bin/chromium-browser',
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-accelerated-2d-canvas',
                '--disable-gpu',
                `--user-agent=${fingerprint.userAgent}`,
                '--single-process'
            ],
            ignoreHTTPSErrors: true
        };

        // Configurar proxy si está disponible
        if (proxy) {
            launchOptions.args.push(`--proxy-server=${proxy.ip}:${proxy.port}`);
        }

        browser = await puppeteer.launch(launchOptions);
        page = await browser.newPage();
        
        // Autenticación de proxy
        if (proxy && proxy.auth) {
            await page.authenticate({
                username: proxy.auth.username,
                password: proxy.auth.password
            });
        }

        // ... (resto de tu código existente sin cambios) ...

    } catch (error) {
        // ... (manejo de errores) ...
        
        if (proxy) {
            ProxyRotationSystem.recordFailure(proxy.string);
        }
        
        // ... (lógica de reintento) ...
    } finally {
        if (browser) await browser.close();
    }
}

// Función para guardar cookies
async function saveCookies(page, username) {
    const cookies = await page.cookies();
    const cookiePath = path.join(__dirname, 'cookies', `${username}.json`);
    fs.mkdirSync(path.dirname(cookiePath), { recursive: true });
    fs.writeFileSync(cookiePath, JSON.stringify(cookies, null, 2));
    logger.info(`🍪 Cookies guardadas para ${username}`);
}

// Función para generar username basado en nombre
function generateUsername(fullName) {
    const cleanName = fullName.toLowerCase().replace(/\s+/g, '');
    const randomNum = Math.floor(Math.random() * 1000);
    return `${cleanName}${randomNum}`;
}
