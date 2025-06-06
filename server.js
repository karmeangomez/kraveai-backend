require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const axios = require('axios');
const { createMultipleAccounts } = require('./instagramAccountCreator'); // Asegúrate de que exista
const puppeteer = require('puppeteer-core');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const { instagramLogin } = require('./instagramLogin'); // Asegúrate de que exista
const fs = require('fs').promises;
const UserAgent = require('user-agents');
const { Telegraf } = require('telegraf');
const chromium = require('@sparticuz/chromium-min');

puppeteer.use(StealthPlugin());

// ... (resto del código)

async function initBrowser() {
  await loadProxies(); // Carga proxies al iniciar
  try {
    await logAndNotify("Verificando sesión de Instagram...");

    // Encuentra un proxy funcional
    let proxy = null;
    for (let i = 0; i < proxies.length; i++) {
      const candidate = proxies[proxyIndex];
      proxyIndex = (proxyIndex + 1) % proxies.length;
      if (!invalidProxies.has(candidate) && await checkProxy(candidate)) {
        proxy = candidate;
        break;
      } else {
        invalidProxies.add(candidate); // Marca como inválido si falla
      }
    }

    if (!proxy) {
      throw new Error('No se encontró un proxy funcional');
    }

    browserInstance = await puppeteer.launch({
      executablePath: await chromium.executablePath(),
      args: [
        ...chromium.args,
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--disable-blink-features=AutomationControlled',
        '--single-process',
        '--js-flags=--max-old-space-size=256',
        `--proxy-server=http://${proxy}`
      ],
      headless: chromium.headless,
      ignoreHTTPSErrors: true
    });

    const page = await browserInstance.newPage();
    const isLoggedIn = await instagramLogin(page, process.env.INSTAGRAM_USERNAME, process.env.INSTAGRAM_PASSWORD);
    if (!isLoggedIn) {
      throw new Error('No se pudo iniciar sesión en Instagram');
    }
    await page.close();

    await logAndNotify(`Sesión de Instagram lista con proxy: ${proxy}`);
    sessionStatus = 'ACTIVE';
    setInterval(checkSessionValidity, 60 * 60 * 1000); // Verifica cada hora
  } catch (err) {
    sessionStatus = 'ERROR';
    await logAndNotify('Error al iniciar Chromium', 'error', err);
    await restartBrowser(); // Intenta reiniciar si falla
  }
}

// ... (resto del código)