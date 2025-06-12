// instagramAccountCreator.js - Actualizado para SSE

const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const proxyChain = require('proxy-chain');
const { getNextProxy } = require('./proxyBank');

puppeteer.use(StealthPlugin());

async function createMultipleAccounts(count, page) {
  const accounts = [];

  for (let i = 0; i < count; i++) {
    try {
      const timestamp = Date.now();
      const email = `test${timestamp}${i}@example.com`;
      const username = `testuser${timestamp}${i}`;
      const password = 'SecurePass123!';

      await page.goto('https://www.instagram.com/accounts/emailsignup/', {
        waitUntil: 'domcontentloaded',
        timeout: 30000
      });

      await page.type('input[name="email"]', email);
      await page.type('input[name="username"]', username);
      await page.type('input[name="password"]', password);
      await page.click('button[type="submit"]');

      await page.waitForNavigation({ waitUntil: 'networkidle0', timeout: 30000 });

      const pageUrl = page.url();
      if (pageUrl.includes('/accounts/emailsignup/')) {
        throw new Error(`Instagram no redirigió, posible bloqueo o CAPTCHA`);
      }

      logger.info(`✅ Cuenta creada: ${username}`);
      accounts.push({ email, username, password });

    } catch (err) {
      logger.error(`❌ Error creando cuenta ${i + 1}: ${err.stack || err.message}`);
      continue;
    }
  }

  return accounts;
}

module.exports = { createMultipleAccounts };
