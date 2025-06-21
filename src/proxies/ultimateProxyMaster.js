import UltimateProxyMaster from './ultimateProxyMaster.js';
import axios from 'axios';

class ProxyRotationSystem {
  constructor() {
    this.proxyStats = new Map();
    this.blacklist = new Set();
    this.config = {
      MAX_FAILS: 3
    };
  }

  getBestProxy() {
    const available = UltimateProxyMaster.getWorkingProxies()
      .filter(p => !this.blacklist.has(p.string))
      .map(p => ({
        proxy: p,
        stats: this.proxyStats.get(p.string) || { usageCount: 0, failures: 0 },
        premium: UltimateProxyMaster.proxySources.premium.includes(p.string)
      }));

    if (available.length === 0) throw new Error('No hay proxies disponibles');

    return available.sort((a, b) => {
      if (a.premium !== b.premium) return b.premium - a.premium;
      return a.stats.failures - b.stats.failures || a.stats.usageCount - b.stats.usageCount;
    })[0].proxy;
  }

  recordFailure(proxyString) {
    const stats = this.proxyStats.get(proxyString) || { usageCount: 0, failures: 0 };
    stats.usageCount++;
    stats.failures++;
    this.proxyStats.set(proxyString, stats);

    if (stats.failures >= this.config.MAX_FAILS) {
      this.blacklist.add(proxyString);
      console.warn(`🚫 Proxy blacklisted: ${proximport puppeteer from 'puppeteer-extra';
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

export async function crearCuentaInstagram() {
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
                username: proxyObj.auth ? proxyObj.auth.username : undefined,
                password: proxyObj.auth ? proxyObj.auth.password : undefined
            });
        }

        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');
        await page.goto('https://www.instagram.com/accounts/emailsignup/', { waitUntil: 'networkidle2' });

        await randomDelay(2000, 5000);
        await simulateMouseMovement(page);

        const { firstName, lastName } = getRandomName();
        const username = `${firstName.toLowerCase()}${lastName.toLowerCase()}${Math.floor(Math.random() * 1000)}`;
        const password = `${firstName}${lastName}${Math.random().toString(36).slice(-4)}!`;
        const { email, token } = await getTempMail();

        await humanInteraction(page);

        await humanType(page, 'input[name="emailOrPhone"]', email);
        await humanType(page, 'input[name="fullName"]', `${firstName} ${lastName}`);
        await humanType(page, 'input[name="username"]', username);
        await humanType(page, 'input[name="password"]', password);

        await randomDelay(1000, 3000);
        const signUpButton = await page.$('button[type="submit"]');
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
        return {
            status: 'created',
            username,
            email,
            proxy: proxyStr
        };
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
        return {
            status: 'failed',
            error: error.message,
            proxy: proxyStr
        };
    }
}yString}`);
    }
  }

  recordSuccess(proxyString) {
    const stats = this.proxyStats.get(proxyString) || { usageCount: 0, failures: 0 };
    stats.usageCount++;
    this.proxyStats.set(proxyString, stats);
  }

  markProxyUsed(proxyString) {
    const stats = this.proxyStats.get(proxyString) || { usageCount: 0, failures: 0 };
    stats.usageCount++;
    this.proxyStats.set(proxyString, stats);
  }

  getProxyStats() {
    return {
      total: this.proxyStats.size,
      buenos: [...this.proxyStats.entries()].filter(([_, s]) => s.failures < this.config.MAX_FAILS).length,
      malos: this.blacklist.size
    };
  }
}

const proxyRotationSystem = new ProxyRotationSystem();
export default proxyRotationSystem;
