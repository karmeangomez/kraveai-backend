#!/usr/bin/env node
import AccountManager from './accounts/accountManager.js';
import crearCuentaInstagram from './accounts/crearCuentaInstagram.js';
import proxySystem from './proxies/proxyRotationSystem.js';
import fs from 'fs';
import axios from 'axios';
import {
  notifyTelegram,
  notifyCuentaExitosa,
  notifyErrorCuenta,
  notifyResumenFinal,
  notifyInstanciaIniciada
} from './utils/telegram_utils.js';

const isRaspberryPi = process.platform === 'linux' && process.arch === 'arm';
const CONFIG = {
  ACCOUNTS_TO_CREATE: 50,
  DELAY_BETWEEN_ACCOUNTS: isRaspberryPi ? 30000 : 15000,
  LOG_FILE: 'kraveai.log',
  HEADLESS: isRaspberryPi ? true : (process.env.HEADLESS !== 'false')
};

export const PUPPETEER_CONFIG = {
  headless: CONFIG.HEADLESS,
  args: [
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--disable-dev-shm-usage',
    '--disable-accelerated-2d-canvas',
    '--no-first-run',
    '--no-zygote',
    '--single-process',
    '--disable-gpu',
    '--disable-software-rasterizer',
    '--disable-features=site-per-process'
  ],
  ...(isRaspberryPi && { 
    executablePath: '/usr/bin/chromium-browser',
    ignoreDefaultArgs: ['--disable-extensions']
  })
};

function log(message) {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] ${message}`;
  console.log(logMessage);
  fs.appendFileSync(CONFIG.LOG_FILE, logMessage + '\n');
}

let isShuttingDown = false;
function handleShutdown() {
  if (isShuttingDown) return;
  isShuttingDown = true;

  log('🚫 Recibida señal de apagado. Guardando estado actual...');
  const allAccounts = AccountManager.getAccounts();
  if (allAccounts.length) {
    fs.writeFileSync('cuentas_creadas_partial.json', JSON.stringify(allAccounts, null, 2));
    log('💾 Cuentas parciales guardadas en cuentas_creadas_partial.json');
  }

  setTimeout(() => process.exit(0), 3000);
}

process.on('SIGINT', handleShutdown);
process.on('SIGTERM', handleShutdown);

(async () => {
  try {
    if (fs.existsSync(CONFIG.LOG_FILE)) {
      fs.writeFileSync(CONFIG.LOG_FILE, '');
    }

    log('🔥 Iniciando KraveAI-Granja Rusa 🔥');
    log(`✅ Plataforma: ${isRaspberryPi ? 'RASPBERRY PI' : process.platform}`);
    log(`✅ Modo: ${CONFIG.HEADLESS ? 'HEADLESS' : 'VISUAL'}`);
    log(`✅ Cuentas a crear: ${CONFIG.ACCOUNTS_TO_CREATE}`);

    const inicio = new Date();
    await notifyInstanciaIniciada({
      hora: inicio.toLocaleTimeString(),
      entorno: 'Producción',
      plataforma: isRaspberryPi ? 'Raspberry Pi' : process.platform,
      modo: CONFIG.HEADLESS ? 'Headless' : 'Visual'
    });

    AccountManager.clearAccounts();

    log('🔄 Inicializando sistema de proxies...');
    await proxySystem.initialize();
    log('✅ Sistema de proxies listo');

    let consecutiveFails = 0;

    for (let i = 0; i < CONFIG.ACCOUNTS_TO_CREATE; i++) {
      if (isShuttingDown) {
        log('⏹️ Deteniendo ejecución debido a señal de apagado');
        break;
      }

      log(`\n🚀 Creando cuenta ${i + 1}/${CONFIG.ACCOUNTS_TO_CREATE}`);
      const result = await crearCuentaInstagram(PUPPETEER_CONFIG);

      if (result) {
        AccountManager.addAccount(result);

        if (result.status === 'created') {
          log(`✅ Cuenta creada: @${result.username}`);
          await notifyCuentaExitosa(result);
          consecutiveFails = 0; // ✅ Resetea contador en éxito
        } else {
          const mensaje = result.error || '❌ Cuenta inválida';
          log(`❌ Fallo: ${mensaje}`);
          await notifyErrorCuenta(result, mensaje);
          consecutiveFails++;
        }
      } else {
        const fallback = {
          username: 'unknown',
          email: 'unknown',
          password: 'unknown',
          proxy: 'none',
          status: 'failed',
          error: '❌ crearCuentaInstagram devolvió null'
        };
        AccountManager.addAccount(fallback);
        log(fallback.error);
        await notifyErrorCuenta(fallback, fallback.error);
        consecutiveFails++;
      }

      // ✅ Protección por fallos consecutivos
      if (consecutiveFails >= 10) {
        const msg = `🛑 Se detectaron ${consecutiveFails} fallos consecutivos.\nSe detiene el sistema para evitar sobrecarga.`;
        log(msg);
        await notifyTelegram(msg);
        break;
      }

      if (i < CONFIG.ACCOUNTS_TO_CREATE - 1 && !isShuttingDown) {
        log(`⏳ Esperando ${CONFIG.DELAY_BETWEEN_ACCOUNTS / 1000} segundos...`);
        await new Promise(r => setTimeout(r, CONFIG.DELAY_BETWEEN_ACCOUNTS));
      }
    }

    if (!isShuttingDown) {
      const allAccounts = AccountManager.getAccounts();
      if (allAccounts.length) {
        fs.writeFileSync('cuentas_creadas.json', JSON.stringify(allAccounts, null, 2));
        log('💾 Cuentas guardadas en cuentas_creadas.json');
      }

      const successCount = allAccounts.filter(a => a.status === 'created').length;
      const failCount = allAccounts.length - successCount;
      const fin = new Date();
      const tiempo = ((fin - inicio) / 60000).toFixed(1) + ' min';

      log('\n🎉 Proceso completado!');
      log(`✅ Cuentas creadas: ${successCount}`);
      log(`❌ Fallidas: ${failCount}`);
      log(`⏱️ Tiempo total: ${tiempo}`);

      await notifyResumenFinal({
        total: allAccounts.length,
        success: successCount,
        fail: failCount,
        tiempo,
        plataforma: isRaspberryPi ? 'Raspberry Pi' : process.platform
      });
    }
  } catch (error) {
    log(`🔥 Error crítico: ${error.message}`);
    log(error.stack);
    await notifyTelegram(`🔥 Error crítico en ejecución:\n${error.message}\n${error.stack}`);
    process.exit(1);
  } finally {
    if (!isShuttingDown) process.exit(0);
  }
})();
