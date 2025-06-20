const fs = require('fs');
const logger = require('./logger');

// Sistema de autodestrucción ante análisis
setInterval(() => {
  // Detección de uso elevado de memoria
  if(process.memoryUsage().heapUsed > 150*1024*1024) {
    logger.error('🚨 Detección de análisis de memoria! Autodestrucción...');
    process.exit(0);
  }
  
  // Reinicio programado cada 1 hora
  if(process.uptime() > 3600) {
    fs.writeFileSync('.killswitch', '1');
    process.exit(0);
  }
}, 30000);
