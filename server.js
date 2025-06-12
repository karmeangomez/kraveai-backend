// 📦 server.js - Backend con SSE y login temporalmente desactivado

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

// ============= RUTAS ======================

// SSE para creación de cuentas
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

// Healthcheck
app.get('/health', (req, res) => {
  res.json({
    status: sessionStatus,
    browser: browserInstance ? 'ACTIVE' : 'INACTIVE',
    memory: process.memoryUsage().rss,
    uptime: process.uptime()
  });
});

// Ruta base
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ========== ARRANQUE DEL SERVIDOR ============
app.listen(PORT, '0.0.0.0', () => {
  logger.info(`🚀 Backend activo en puerto ${PORT}`);
  notifyTelegram(`🚀 Servidor backend activo en puerto ${PORT}`);
  // initBrowser(); // ⚠️ Desactivado temporalmente para pruebas
});

process.on('SIGTERM', async () => {
  logger.info('🛑 SIGTERM recibido. Cerrando navegador...');
  if (browserInstance) await browserInstance.close();
  process.exit(0);
});

process.on('unhandledRejection', reason => {
  logger.error('Unhandled Rejection:', reason);
});
