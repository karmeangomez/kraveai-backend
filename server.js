// 📦 server.js - Backend completo con Telegram y logs para Railway (final completo actualizado)

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
  logger.info(`
