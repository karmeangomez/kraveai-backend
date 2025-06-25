#!/usr/bin/env node
import AccountManager from './accounts/accountManager.js';
import crearCuentaInstagram from './accounts/crearCuentaInstagram.js';
import ProxyRotationSystem from './proxies/proxyRotationSystem.js';
import fs from 'fs';
import axios from 'axios';
import {
  notifyTelegram,
  notifyCuentaExitosa,
  notifyErrorCuenta,
  notifyResumenFinal,
  notifyInstanciaIniciada
} from './utils/telegram_utils.js';

// Configuración optimizada para Raspberry Pi
const isRaspberryPi = process.platform === 'linux' && process.arch === 'arm';
const CONFIG = {
  ACCOUNTS_TO_CREATE: 50,
  DELAY_BETWEEN_ACCOUNTS: isRaspberryPi ? 30000 : 15000, // 30 seg en Pi, 15 en otros
  LOG_FILE: 'kraveai.log',
  HEADLESS: isRaspberryPi ? true : (process.env.HEADLESS !== 'false')
};

// Configuración de Puppeteer para Raspberry Pi
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

// Sistema de logging mejorado
function log(message) {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] ${message}`;
  console.log(logMessage);
  
  // Guardar en archivo log
  fs.appendFileSync(CONFIG.LOG_FILE, logMessage + '\n');
}

// Función geolocalización optimizada
async function getGeo(ip) {
  try {
    const response = await axios.get(`http://ip-api.com/json/${ip}?fields=66842623`, {
      timeout: 5000
    });
    
    return {
      ip: ip,
      country: response.data.countryCode || 'XX',
      countryName: response.data.country || 'Unknown',
      region: response.data.regionName || 'Unknown',
      city: response.data.city || 'Unknown',
      isp: response.data.isp || 'Unknown',
      proxy: response.data.proxy || false,
      mobile: response.data.mobile || false
    };
  } catch (error) {
    log(`⚠️ Error geoip (${ip}): ${error.message}`);
    return { 
      ip: ip,
      country: 'XX',
      error: 'No se pudo obtener geolocalización'
    };
  }
}

// Manejo de señales para terminación limpia
let isShuttingDown = false;
function handleShutdown() {
  if (isShuttingDown) return;
  isShuttingDown = true;
  
  log('🚫 Recibida señal de apagado. Guardando estado actual...');
  
  // Guardar cuentas creadas hasta ahora
  const allAccounts = AccountManager.getAccounts();
  if (allAccounts.length) {
    fs.writeFileSync('cuentas_creadas_partial.json', JSON.stringify(allAccounts, null, 2));
    log('💾 Cuentas parciales guardadas en cuentas_creadas_partial.json');
  }
  
  setTimeout(() => process.exit(0), 3000);
}

process.on('SIGINT', handleShutdown);
process.on('SIGTERM', handleShutdown);

// Función principal
(async () => {
  try {
    // Limpiar archivo log al iniciar
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

    // 🔄 Limpieza y validación inicial
    AccountManager.clearAccounts();
    
    // Inicializar el sistema de proxies
    log('🔄 Inicializando sistema de proxies...');
    await ProxyRotationSystem.initialize();
    log('✅ Sistema de proxies listo');

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
        } else {
          const mensaje = result.error || '❌ Cuenta inválida';
          log(`❌ Fallo: ${mensaje}`);
          await notifyErrorCuenta(result, mensaje);
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
      }

      if (i < CONFIG.ACCOUNTS_TO_CREATE - 1 && !isShuttingDown) {
        log(`⏳ Esperando ${CONFIG.DELAY_BETWEEN_ACCOUNTS / 1000} segundos...`);
        await new Promise(r => setTimeout(r, CONFIG.DELAY_BETWEEN_ACCOUNTS));
      }
    }

    // Guardar cuentas (solo si no estamos en proceso de apagado)
    if (!isShuttingDown) {
      const allAccounts = AccountManager.getAccounts();
      if (allAccounts.length) {
        fs.writeFileSync('cuentas_creadas.json', JSON.stringify(allAccounts, null, 2));
        log('💾 Cuentas guardadas en cuentas_creadas.json');
      }

      // Resumen final
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
