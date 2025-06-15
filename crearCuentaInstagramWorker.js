const { workerData } = require('worker_threads');
const { crearCuentaInstagram } = require('./crearCuentaInstagram');
const logger = require('./logger');

(async () => {
  const { proxies, workerId } = workerData;

  for (const proxy of proxies) {
    try {
      logger.info(`[Worker ${workerId}] 🧪 Intentando con proxy: ${proxy}`);
      const result = await crearCuentaInstagram(proxy);

      if (result.exito) {
        logger.info(`[Worker ${workerId}] ✅ Cuenta creada: ${result.usuario}`);
      } else {
        logger.warn(`[Worker ${workerId}] ❌ Error: ${result.error}`);
      }
    } catch (err) {
      logger.error(`[Worker ${workerId}] ❌ Excepción: ${err.message}`);
    }
  }
})();
