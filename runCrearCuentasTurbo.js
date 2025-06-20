const { crearCuentaInstagram } = require('./crearCuentaInstagram');
const { generarFingerprint } = require('./fingerprint_utils');
const { generarDatosUsuario } = require('./dataGenerator');
const logger = require('./logger');
const fs = require('fs');
const path = require('path');

// Configuración de granja rusa
const CUENTAS_POR_LOTE = 5;
const DELAY_ENTRE_CUENTAS = [30000, 60000]; // 30-60s
const MAX_REINTENTOS = 2;

// Crear carpetas necesarias
[ 'cookies', 'screenshots', 'logs' ].forEach(dir => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir);
});

async function ejecutarLote() {
  for (let i = 0; i < CUENTAS_POR_LOTE; i++) {
    let exito = false;
    let reintentos = 0;
    
    while (!exito && reintentos <= MAX_REINTENTOS) {
      try {
        // Generar identidad única
        const fingerprint = generarFingerprint(); 
        const datosUsuario = generarDatosUsuario();
        
        logger.info(`🧬 Lote ${i+1} | Fingerprint: ${fingerprint.userAgent.substring(0, 30)}...`);
        
        // Crear cuenta
        await crearCuentaInstagram(datosUsuario, fingerprint);
        logger.success(`✅ Cuenta @${datosUsuario.username} creada!`);
        exito = true;
        
        // Delay aleatorio entre cuentas (técnica rusa)
        const delay = Math.floor(Math.random() * (DELAY_ENTRE_CUENTAS[1] - DELAY_ENTRE_CUENTAS[0])) + DELAY_ENTRE_CUENTAS[0];
        await new Promise(resolve => setTimeout(resolve, delay));
        
      } catch (error) {
        reintentos++;
        logger.error(`⚠️ Fallo (Intento ${reintentos}): ${error.message}`);
      }
    }
  }
}

// Ciclo infinito estilo granja rusa
(async () => {
  logger.info('🔥 Sistema Ruso Activado. Comenzando producción...');
  while (true) {
    await ejecutarLote();
    logger.info(`🌀 Lote de ${CUENTAS_POR_LOTE} cuentas completado. Próximo lote en 3 minutos...`);
    await new Promise(resolve => setTimeout(resolve, 180000)); // Pausa estratégica
  }
})();
