// 📦 server.js - Backend optimizado para Raspberry Pi con Puppeteer
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const fs = require('fs-extra');
const path = require('path');
const rateLimit = require('express-rate-limit');
const winston = require('winston');
const { PassThrough } = require('stream');
const puppeteer = require('puppeteer-core');

const { smartLogin, ensureLoggedIn, getCookies } = require('./instagramLogin');
const { crearCuentaInstagram } = require('./crearCuentas');
const { notifyTelegram } = require('./utils/telegram');

const app = express();
const PORT = process.env.PORT || 3000;
let browserInstance = null;
let sessionStatus = 'INITIALIZING';

// ================== LOGS ==================
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.printf(info => `${info.timestamp} [${info.level.toUpperCase()}]: ${info.message}`)
  ),
  transports: [new winston.transports.Console()]
});

// ============= EXPRESS SETUP ==============
const corsOptions = {
  origin: [
    'http://localhost:3000',
    'http://karmean.duckdns.org:3000',
    'https://kraveai.netlify.app'
  ],
  credentials: true
};

app.use(cors(corsOptions));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
app.set('trust proxy', true);

app.use(rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: 'Demasiadas solicitudes. Intenta de nuevo más tarde.',
  keyGenerator: req => req.ip
}));

// ============= BROWSER CONTROL ============
const pageQueue = [];
let activePages = 0;
const maxConcurrentPages = parseInt(process.env.PUPPETEER_MAX_CONCURRENT_PAGES) || 3;

async function acquirePage() {
  return new Promise(resolve => {
    const tryAcquire = async () => {
      if (activePages < maxConcurrentPages && browserInstance) {
        activePages++;
        const page = await browserInstance.newPage();
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
  if (page && !page.isClosed()) {
    try {
      await page.close();
    } catch (err) {
      logger.error(`⚠️ Error cerrando página: ${err.message}`);
    }
  }
  activePages--;
  if (pageQueue.length > 0) {
    const next = pageQueue.shift();
    next();
  }
}

// =========== LOGIN INICIAL =============
async function initBrowser() {
  try {
    logger.info('🔐 Iniciando navegador...');
    
    // Configuración específica para Raspberry Pi
    const browser = await puppeteer.launch({
      headless: 'new',
      executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || '/usr/bin/chromium-browser',
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--single-process',
        '--disable-gpu',
        '--no-zygote'
      ],
      timeout: 60000
    });
    
    browserInstance = browser;
    logger.info('🌐 Navegador iniciado correctamente');
    
    // Verificar sesión de Instagram
    logger.info('🔐 Verificando sesión de Instagram...');
    const sessionValida = await ensureLoggedIn(browser);
    
    if (sessionValida) {
      sessionStatus = 'ACTIVE';
      logger.info('✅ Sesión activa');
      notifyTelegram('✅ Sesión de Instagram iniciada correctamente');
    } else {
      throw new Error('No se pudo iniciar sesión en Instagram');
    }
  } catch (err) {
    sessionStatus = 'ERROR';
    logger.error(`❌ Error de inicio: ${err.message}`);
    notifyTelegram(`❌ Error al iniciar sesión: ${err.message}`);
    if (browserInstance) {
      await browserInstance.close().catch(e => logger.error('⚠️ Error cerrando navegador:', e));
      browserInstance = null;
    }
    // Reintentar después de 1 minuto
    setTimeout(initBrowser, 60000);
  }
}

// =========== REVISIÓN DE SESIÓN =============
setInterval(async () => {
  if (!browserInstance || sessionStatus !== 'ACTIVE') return;
  
  try {
    logger.info('🔍 Verificando estado de sesión...');
    const page = await acquirePage();
    await page.goto('https://www.instagram.com/', { 
      waitUntil: 'networkidle2',
      timeout: 60000
    });
    
    const loggedIn = await page.evaluate(() => {
      return document.querySelector('a[href*="/accounts/activity/"]') !== null;
    });
    
    if (!loggedIn) {
      logger.warn('⚠️ Sesión expirada, reintentando login...');
      sessionStatus = 'REINICIANDO';
      await initBrowser();
    } else {
      logger.info('🔄 Sesión sigue activa');
    }
    
    await releasePage(page);
  } catch (err) {
    logger.error(`❌ Error en verificación de sesión: ${err.message}`);
    sessionStatus = 'ERROR';
  }
}, 30 * 60 * 1000); // Cada 30 minutos

// ============= RUTAS ======================
app.get('/create-accounts-sse', (req, res) => {
  const count = parseInt(req.query.count) || 1;

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.flushHeaders();

  const stream = new PassThrough();
  stream.pipe(res);

  const sendEvent = (type, data) => {
    stream.write(`event: ${type}\n`);
    stream.write(`data: ${JSON.stringify(data)}\n\n`);
  };

  sendEvent('status', {
    status: 'active',
    message: 'Iniciando creación de cuentas'
  });

  (async () => {
    try {
      const proxyList = process.env.PROXY_LIST.split(',');

      for (let i = 0; i < count; i++) {
        try {
          const proxy = proxyList[Math.floor(Math.random() * proxyList.length)];

          sendEvent('status', {
            status: 'active',
            message: `Creando cuenta ${i + 1}/${count}`
          });

          const cuenta = await crearCuentaInstagram(proxy);

          if (cuenta) {
            sendEvent('account-created', { account: cuenta });
            notifyTelegram(`✅ Cuenta creada: ${cuenta.usuario}`);
          } else {
            sendEvent('status', {
              status: 'error',
              message: `Error creando cuenta ${i + 1}`
            });
          }
        } catch (err) {
          sendEvent('status', {
            status: 'error',
            message: `Error en cuenta ${i + 1}: ${err.message}`
          });
          logger.error(`❌ Error creando cuenta ${i + 1}: ${err.message}`);
        }
      }

      sendEvent('complete', { message: 'Proceso completado' });
    } catch (err) {
      sendEvent('error', { message: err.message });
      logger.error(`❌ Error en el proceso SSE: ${err.message}`);
    } finally {
      res.end();
    }
  })();

  req.on('close', () => {
    stream.end();
    logger.info('🔌 Conexión SSE cerrada por el cliente');
  });
});

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

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ========== ARRANQUE DEL SERVIDOR ============
app.listen(PORT, '0.0.0.0', () => {
  logger.info(`🚀 Backend activo en puerto ${PORT}`);
  notifyTelegram(`🚀 Servidor backend activo en puerto ${PORT}`);
  initBrowser();
});

// ========== MANEJO DE CIERRE ============
process.on('SIGTERM', async () => {
  logger.info('🛑 SIGTERM recibido. Cerrando navegador...');
  if (browserInstance) {
    await browserInstance.close().catch(e => logger.error('⚠️ Error cerrando navegador:', e));
  }
  process.exit(0);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error(`⚠️ Unhandled Rejection at: ${promise}, reason: ${reason}`);
});

process.on('uncaughtException', err => {
  logger.error(`⚠️ Uncaught Exception: ${err.message}`);
  if (browserInstance) {
    browserInstance.close().catch(e => logger.error('⚠️ Error cerrando navegador:', e));
  }
  process.exit(1);
});
