// logger.js
const fs = require('fs');
const path = require('path');
const winston = require('winston');

// Asegurarse que el directorio "logs" exista
const logDir = path.join(__dirname, 'logs');
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
}

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'debug',
  format: winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.printf(info => `${info.timestamp} [${info.level.toUpperCase()}]: ${info.message}`)
  ),
  transports: [
    // Consola para ver en vivo
    new winston.transports.Console(),

    // Log archivo principal general
    new winston.transports.File({ filename: path.join(logDir, 'creacion.log') }),

    // Log de errores separado (solo errores)
    new winston.transports.File({ filename: path.join(logDir, 'error.log'), level: 'error' })
  ]
});

module.exports = logger;
