// server.js - Backend completo para Railway con login, creación de cuentas y Telegram

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const axios = require('axios');
const fs = require('fs-extra');
const path = require('path');
const rateLimit = require('express-rate-limit');
const winston = require('winston');

const { smartLogin, ensureLoggedIn, getCookies } = require('./instagramLogin');
const { createMultipleAccounts } = require('./instagramAccountCreator');
const { crearCuentaInstagram } = require('./crearCuentas');
const { notifyTelegram } = require('./utils/telegram');

const app = express();
const PORT = process.env.PORT || 3000;
let browserInstance = null;
let sessionStatus = 'INITIALIZING';

// ================== LOGS ==================
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'debug',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.printf(info => `${info.timestamp} [${info.level.toUpperCase()}]: ${info.message}`)
  ),
  transports: [new winston.transports.Console()]
});

// ============= EXPRESS SETUP ==============
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
app.set('trust proxy', false);

app.use(rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 100,
  message: 'Demasiadas solicitudes. Intenta de nuevo más tarde.',
  keyGenerator: req => req.ip
}));

app.use((req, res, next) => {
  const memory = process.memoryUsage().rss;
  logger.info(`🧠 Memoria: ${Math.round(memory / 1024 / 1024)}MB RSS`);
  next();
});

// =========== LOGIN INICIAL =============
async function initBrowser() {
  try {
    logger.info('🔐 Verificando sesión...');
    const sessionValida = await ensureLoggedIn();
    if (!sessionValida) throw new Error('Sesión inválida o expirada');

    const { success, browser, page } = await smartLogin({
      username: process.env.IG_USERNAME,
      password: process.env.INSTAGRAM_PASS,
      options: { proxyList: process.env.PROXY_LIST.split(',') }
    });

    if (!success) throw new Error('Fallo al iniciar sesión');
    browserInstance = browser;
    sessionStatus = 'ACTIVE';
    logger.info('✅ Sesión activa');
    notifyTelegram('✅ Sesión de Instagram iniciada correctamente');
    await page.close();
  } catch (err) {
    sessionStatus = 'ERROR';
    logger.error(`❌ Error de login: ${err.message}`);
    notifyTelegram(`❌ Error al iniciar sesión: ${err.message}`);
    if (browserInstance) await browserInstance.close().catch(() => {});
  }
}

// =========== REVISIÓN DE SESIÓN =============
setInterval(async () => {
  if (!browserInstance) return;
  try {
    const page = await browserInstance.newPage();
    const cookies = getCookies();
    await page.setCookie(...cookies);
    await page.goto('https://www.instagram.com/', { waitUntil: 'domcontentloaded' });
    const loggedIn = await page.evaluate(() => !!document.querySelector('a[href*="/accounts/activity/"]'));
    if (!loggedIn) {
      logger.warn('⚠️ Sesión expirada, reintentando login...');
      await initBrowser();
    }
    await page.close();
  } catch (err) {
    sessionStatus = 'EXPIRED';
    logger.error(`❌ Error verificando sesión: ${err.message}`);
  }
}, 1000 * 60 * 60);

// ============= RUTAS ======================

app.post('/crear-cuenta', async (req, res) => {
  try {
    if (!browserInstance) {
      logger.warn('⚠️ Navegador no iniciado. Reintentando...');
      await initBrowser();
      if (!browserInstance) throw new Error('No se pudo iniciar el navegador');
    }
    const proxyList = process.env.PROXY_LIST.split(',');
    const proxy = proxyList[Math.floor(Math.random() * proxyList.length)];
    const cuenta = await crearCuentaInstagram(proxy);
    if (!cuenta) return res.status(500).json({ error: 'Falló creación de cuenta' });
    notifyTelegram(`✅ Cuenta creada: ${cuenta.usuario}`);
    res.json({ success: true, cuenta });
  } catch (err) {
    logger.error('❌ Error en /crear-cuenta:', err.message);
    notifyTelegram(`❌ Error al crear cuenta: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
});

app.post('/create-accounts', async (req, res) => {
  try {
    const count = req.body.count || 3;
    if (!browserInstance) {
      logger.warn('⚠️ Navegador no iniciado. Reintentando...');
      await initBrowser();
      if (!browserInstance) throw new Error('No se pudo iniciar el navegador');
    }
    const page = await browserInstance.newPage();
    const accounts = await createMultipleAccounts(count, page);
    notifyTelegram(`✅ ${accounts.length} cuentas creadas`);
    res.json({ success: true, accounts });
    await page.close();
  } catch (err) {
    logger.error('❌ Error creando múltiples cuentas:', err.message);
    notifyTelegram(`❌ Error en creación múltiple: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
});

app.get('/health', (req,
