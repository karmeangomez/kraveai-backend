const { Worker } = require('worker_threads');
const { saveBatchStats } = require('./batchStats');
const { sendTelegramMessage } = require('./monitorTelegram');
const Logger = require('./logger');

const logger = new Logger();
const TOTAL = parseInt(process.argv[2], 10) || 5;
const MAX_REINTENTOS = 3;
const RETRASO_ENTRE_CUENTAS = [30000, 60000]; // 30–60 segundos

const intentadas = [];
const exitosas = [];
const shadowban = [];
const errores = [];

const start = Date.now();

async function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function crearCuentaConReintentos(intento = 1) {
  return new Promise((resolve) => {
    const worker = new Worker('./crearCuentaInstagram.js');

    worker.once('message', (data) => {
      try {
        let resultado;
        try {
          resultado = typeof data === 'string' ? JSON.parse(data) : data;
        } catch (err) {
          logger.error(`❌ Error al interpretar la respuesta del worker: ${err.message}`);
          errores.push('respuesta inválida');
          return resolve(false);
        }

        const usuario = resultado.usuario || `anon_${Date.now()}`;
        intentadas.push(usuario);

        if (resultado.status === 'success') {
          exitosas.push(usuario);
        } else if (resultado.status === 'shadowbanned') {
          shadowban.push(usuario);
        } else {
          errores.push(resultado.error || 'desconocido');
          if (intento < MAX_REINTENTOS) {
            logger.warn(`🔁 Reintentando cuenta (${intento + 1}/${MAX_REINTENTOS})...`);
            return resolve(crearCuentaConReintentos(intento + 1));
          }
        }

        resolve(true);
      } catch (err) {
        logger.error(`❌ Error procesando resultado: ${err.message}`);
        errores.push('fallo inesperado');
        resolve(false);
      }
    });

    worker.once('error', (err) => {
      logger.error(`❌ Error en worker: ${err.message}`);
      errores.push(err.message);
      resolve(false);
    });
  });
}

async function runLote() {
  for (let i = 0; i < TOTAL; i++) {
    logger.info(`⚙️ Creando cuenta ${i + 1}/${TOTAL}`);
    await crearCuentaConReintentos();

    const delayMs = Math.floor(Math.random() * (RETRASO_ENTRE_CUENTAS[1] - RETRASO_ENTRE_CUENTAS[0])) + RETRASO_ENTRE_CUENTAS[0];
    logger.info(`⏳ Esperando ${Math.floor(delayMs / 1000)}s antes de la siguiente...`);
    await delay(delayMs);
  }
}

(async () => {
  logger.info(`🚀 Iniciando lote de ${TOTAL} cuentas...\n`);

  await runLote();

  const end = Date.now();
  const stats = {
    totalIntentadas: intentadas.length,
    totalCreadas: exitosas.length,
    totalShadowban: shadowban.length,
    totalErrores: errores.length,
    inicio: start,
    fin: end,
    errores
  };

  saveBatchStats(stats);

  const mensaje = `
📦 *Lote finalizado:*

• Intentadas: ${stats.totalIntentadas}
• Creadas: ${stats.totalCreadas}
• Shadowban: ${stats.totalShadowban}
• Errores: ${stats.totalErrores}
• Tiempo: ${(end - start) / 1000}s
• Éxito: ${((stats.totalCreadas / stats.totalIntentadas) * 100).toFixed(2)}%
`;

  await sendTelegramMessage(mensaje).catch(() => {});
  logger.success(`🎯 Lote terminado. Resultados enviados a Telegram.`);
})();
