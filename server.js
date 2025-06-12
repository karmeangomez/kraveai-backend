// 📦 server.js - Backend completo con SSE, Telegram y cuentas guardadas

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const fs = require('fs-extra');
const path = require('path');
const rateLimit = require('express-rate-limit');
const winston = require('winston');
const { PassThrough } = require('stream');

const { smartLogin, ensureLoggedIn, getCookies } = require('./instagramLogin');
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
app.set('trust proxy', true);

app.use(rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: 'Demasiadas solicitudes. Intenta de nuevo más tarde.',
  keyGenerator: req => req.ip
}));

app.use((req, res, next) => {
  const memory = process.memoryUsage().rss;
  logger.info(`🧠 Memoria: ${Math.round(memory / 1024 / 1024)}MB RSS`);
  next();
});

// ============= BROWSER CONTROL ============
const pageQueue = [];
let activePages = 0;
const maxConcurrentPages = parseInt(process.env.PUPPETEER_MAX_CONCURRENT_PAGES) || 3;

async function acquirePage(browser) {
  return new Promise(resolve => {
    const tryAcquire = async () => {
      if (activePages < maxConcurrentPages) {
        activePages++;
        const page = await browser.newPage();
        resolve(page);
      } else {
        pageQueue.push(tryAcquire);
        setTimeout(tryAcquire, 100);
      }
    };
    tryAcquire();
  });
}

async function releasePage(page) {
  if (page && !page.isClosed()) await page.close().catch(() => {});
  activePages--;
  const next = pageQueue.shift();
  if (next) next();
}

// =========== LOGIN INICIAL =============
async function initBrowser() {
  try {
    logger.info('🔐 Verificando sesión...');
    const sessionValida = await ensureLoggedIn();
    const username = process.env.IG_USERNAME;
    const password = process.env.INSTAGRAM_PASS;
    const { success, browser } = await smartLogin({
      username,
      password,
      options: { proxyList: process.env.PROXY_LIST.split(',') }
    });
    if (!success) throw new Error('Fallo al iniciar sesión');
    browserInstance = browser;
    sessionStatus = 'ACTIVE';
    logger.info('✅ Sesión activa');
    notifyTelegram('✅ Sesión de Instagram iniciada correctamente');
  } catch (err) {
    sessionStatus = 'ERROR';
    logger.error(`❌ Error de login: ${err.message}`);
    notifyTelegram(`❌ Error al iniciar sesión: ${err.message}`);
    if (browserInstance) await browserInstance.close();
  }
}

// =========== REVISIÓN DE SESIÓN =============
setInterval(async () => {
  if (!browserInstance) return;
  try {
    const page = await acquirePage(browserInstance);
    const cookies = getCookies();
    await page.setCookie(...cookies);
    await page.goto('https://www.instagram.com/', { 
      waitUntil: 'domcontentloaded',
      timeout: 60000
    });
    
    const loggedIn = await page.evaluate(() => 
      !!document.querySelector('a[href*="/accounts/activity/"]')
    );
    
    if (!loggedIn) {
      logger.warn('⚠️ Sesión expirada, reintentando login...');
      await initBrowser();
    }
    await releasePage(page);
  } catch (err) {
    sessionStatus = 'EXPIRED';
    logger.error(`❌ Error verificando sesión: ${err.message}`);
  }
}, 60 * 60 * 1000);

// ============= RUTAS ======================

// Endpoint para Server-Sent Events (SSE)
app.get('/create-accounts-sse', (req, res) => {
  const count = parseInt(req.query.count) || 1;
  
  // Configurar SSE
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.flushHeaders();
  
  // Crear un stream de eventos
  const stream = new PassThrough();
  stream.pipe(res);
  
  // Función para enviar eventos
  const sendEvent = (type, data) => {
    stream.write(`event: ${type}\n`);
    stream.write(`data: ${JSON.stringify(data)}\n\n`);
  };
  
  // Enviar estado inicial
  sendEvent('status', {
    status: 'active',
    message: 'Iniciando creación de cuentas'
  });
  
  // Proceso de creación de cuentas
  (async () => {
    try {
      const proxyList = process.env.PROXY_LIST.split(',');
      
      for (let i = 0; i < count; i++) {
        try {
          const proxy = proxyList[Math.floor(Math.random() * proxyList.length)];
          
          sendEvent('status', {
            status: 'active',
            message: `Creando cuenta ${i+1}/${count}`
          });
          
          const cuenta = await crearCuentaInstagram(proxy);
          
          if (cuenta) {
            sendEvent('account-created', { account: cuenta });
            notifyTelegram(`✅ Cuenta creada: ${cuenta.usuario}`);
          } else {
            sendEvent('status', {
              status: 'error',
              message: `Error creando cuenta ${i+1}`
            });
          }
        } catch (err) {
          sendEvent('status', {
            status: 'error',
            message: `Error en cuenta ${i+1}: ${err.message}`
          });
          logger.error(`❌ Error creando cuenta ${i+1}: ${err.message}`);
        }
      }
      
      sendEvent('complete', { message: 'Proceso completado' });
    } catch (err) {
      sendEvent('error', { message: err.message });
      logger.error(`❌ Error en el proceso SSE: ${err.message}`);
    } finally {
      // Cerrar la conexión SSE
      res.end();
    }
  })();
  
  // Manejar cierre de conexión
  req.on('close', () => {
    stream.end();
    logger.info('🔌 Conexión SSE cerrada por el cliente');
  });
});

// Mostrar cuentas guardadas
app.get('/cuentas', (req, res) => {
  const filePath = path.join(__dirname, 'cuentas_creadas.json');
  if (!fs.existsSync(filePath)) return res.json([]);
  
  try {
    const data = fs.readFileSync(filePath, 'utf8');
    const cuentas = JSON.parse(data);
    res.json(Array.isArray(cuentas) ? cuentas : []);
  } catch (err) {
    logger.error(`❌ Error leyendo cuentas: ${err.message}`);
    res.status(500).json({ error: 'Error al leer las cuentas' });
  }
});

app.get('/health', (req, res) => {
  res.json({
    status: sessionStatus,
    browser: browserInstance ? 'ACTIVE' : 'INACTIVE',
    memory: process.memoryUsage().rss,
    uptime: process.uptime()
  });
});

// Servir el frontend
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ====== ERRORES Y ARRANQUE =======

process.on('SIGTERM', async () => {
  logger.info('🛑 SIGTERM recibido. Cerrando navegador...');
  if (browserInstance) await browserInstance.close();
  process.exit(0);
});

process.on('unhandledRejection', reason => {
  logger.error('Unhandled Rejection:', reason);
});

app.listen(PORT, () => {
  logger.info(`🚀 Backend activo en puerto ${PORT}`);
  notifyTelegram(`🚀 Servidor backend activo en puerto ${PORT}`);
  initBrowser();
});
