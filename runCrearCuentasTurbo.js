const { crearCuentaInstagram } = require('./crearCuentaInstagram');
const { generarFingerprint } = require('./fingerprint_utils');
const { generarDatosUsuario } = require('./dataGenerator');
// Solución al problema del logger
const logger = {
    info: console.log,
    error: console.error,
    warn: console.warn,
    success: console.log // Para mensajes de éxito
};
const fs = require('fs');
const path = require('path');

// Configuración para Raspberry Pi
const MAX_CUENTAS_POR_LOTE = 5; // Evita sobrecarga de memoria
const DELAY_ENTRE_LOTES = 180000; // 3 minutos entre lotes (evita detección)
const MAX_REINTENTOS = 2;
const MEMORY_LIMIT = 500 * 1024 * 1024; // 500MB (reiniciar si se excede)

// Crear carpetas necesarias
['cookies', 'screenshots', 'logs'].forEach(dir => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

// Monitoreo de memoria
setInterval(() => {
  const memory = process.memoryUsage().heapUsed;
  if (memory > MEMORY_LIMIT) {
    logger.error(`🛑 Memoria excedida (${Math.round(memory/1024/1024)}MB). Reiniciando...`);
    process.exit(1); // Será reiniciado por systemd
  }
}, 30000);

async function ejecutarLote(numLote, totalCuentas) {
  const loteStart = Date.now();
  let cuentasExitosas = 0;
  
  for (let i = 1; i <= MAX_CUENTAS_POR_LOTE; i++) {
    const cuentaNum = totalCuentas + i;
    let reintentos = 0;
    let exito = false;
    
    while (!exito && reintentos <= MAX_REINTENTOS) {
      try {
        logger.info(`⚙️ Lote ${numLote} | Cuenta ${cuentaNum}/${MAX_CUENTAS_POR_LOTE} | Intento ${reintentos+1}`);
        
        // 1. Generar identidad única
        const fingerprint = generarFingerprint();
        
        // 2. Generar datos de usuario realistas
        const datosUsuario = generarDatosUsuario();
        
        // 3. Crear cuenta con método ruso
        const resultado = await crearCuentaInstagram(datosUsuario, fingerprint);
        
        if (resultado.status === 'success') {
          logger.info(`✅ Cuenta @${datosUsuario.username} creada!`);
          cuentasExitosas++;
          
          // Guardar en JSON
          const cuentaData = {
            ...datosUsuario,
            fingerprint: {
              userAgent: fingerprint.userAgent.substring(0, 40),
              viewport: fingerprint.viewport,
              language: fingerprint.language
            },
            timestamp: new Date().toISOString()
          };
          
          fs.appendFileSync('cuentas_creadas.json', JSON.stringify(cuentaData) + '\n');
        } else {
          throw new Error(resultado.error || 'Error desconocido');
        }
        
        exito = true;
        
        // Delay aleatorio entre cuentas (10-30 segundos)
        const delay = 10000 + Math.floor(Math.random() * 20000);
        await new Promise(resolve => setTimeout(resolve, delay));
        
      } catch (error) {
        reintentos++;
        logger.error(`⚠️ Fallo: ${error.message}`);
        
        if (reintentos > MAX_REINTENTOS) {
          logger.warn(`🚫 Cuenta abandonada después de ${MAX_REINTENTOS} intentos`);
        }
      }
    }
  }
  
  const tiempoLote = (Date.now() - loteStart) / 1000;
  logger.info(`🌀 Lote ${numLote} completado. Cuentas: ${cuentasExitosas}/${MAX_CUENTAS_POR_LOTE} | Tiempo: ${tiempoLote}s`);
  
  return cuentasExitosas;
}

// Manejo de cierre limpio
process.on('SIGINT', async () => {
  logger.info('🛑 Deteniendo sistema (SIGINT)...');
  process.exit(0);
});

// Función principal
(async () => {
  logger.info('🔥 Sistema Ruso Activado. Iniciando producción...');
  
  let numLote = 1;
  let totalCuentas = 0;
  
  while (true) {
    const cuentasCreadas = await ejecutarLote(numLote, totalCuentas);
    totalCuentas += cuentasCreadas;
    
    logger.info(`💾 Total acumulado: ${totalCuentas} cuentas | Próximo lote en ${DELAY_ENTRE_LOTES/1000}s...`);
    
    // Delay estratégico entre lotes
    await new Promise(resolve => setTimeout(resolve, DELAY_ENTRE_LOTES));
    
    numLote++;
    
    // Reinicio periódico para limpiar memoria
    if (numLote % 10 === 0) {
      logger.info('🔄 Reinicio periódico para optimizar memoria');
      process.exit(0); // Systemd nos reiniciará
    }
  }
})();
