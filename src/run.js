import chalk from 'chalk';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
dotenv.config();

import AccountManager from './accounts/accountManager.js';
import crearCuentaInstagram from './accounts/crearCuentaInstagram.js';
import UltimateProxyMaster from './proxies/ultimateProxyMaster.js';
import { notifyTelegram } from './utils/telegram_utils.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const TOTAL_CUENTAS = 50;
const MAX_ERRORES = 10;
const PROXY_REFRESH_INTERVAL = 60 * 60 * 1000; // 1 hora

// Configurar colores para consola
chalk.level = 1;
const log = {
  info: (msg) => console.log(chalk.cyan(msg)),
  success: (msg) => console.log(chalk.green(msg)),
  warn: (msg) => console.log(chalk.yellow(msg)),
  error: (msg) => console.log(chalk.red(msg)),
  highlight: (msg) => console.log(chalk.magenta.bold(msg))
};

// Variables de estado
let errores = 0;
let creadas = 0;
let proxySystem;
let refreshInterval;

// Función para iniciar el sistema
async function startApp() {
  log.highlight(`\n[${new Date().toISOString()}] 🔥 Iniciando KraveAI-Granja Rusa 🔥`);
  log.info(`✅ Plataforma: ${process.platform}`);
  log.info(`✅ Modo: ${process.env.HEADLESS === 'true' ? 'HEADLESS' : 'VISIBLE'}`);
  log.info(`✅ Cuentas a crear: ${TOTAL_CUENTAS}`);

  if (!process.env.TELEGRAM_BOT_TOKEN || !process.env.TELEGRAM_CHAT_ID) {
    log.warn('⚠️ Configuración de Telegram incompleta');
    log.warn('   Asegúrate de configurar TELEGRAM_BOT_TOKEN y TELEGRAM_CHAT_ID');
  }

  try {
    await notifyTelegram(`🚀 Iniciando creación de ${TOTAL_CUENTAS} cuentas de Instagram`);
    log.success('📲 Notificación enviada a Telegram.');
  } catch (error) {
    log.error(`❌ Error al enviar notificación: ${error.message}`);
  }

  try {
    proxySystem = new UltimateProxyMaster();
    await proxySystem.initialize(true); // Forzar refresco inicial

    // Programar refresco periódico de proxies
    refreshInterval = setInterval(async () => {
      try {
        await proxySystem.refreshProxies();
        await notifyTelegram('🔄 Proxies actualizados automáticamente');
      } catch (error) {
        log.error(`⚠️ Error actualizando proxies: ${error.message}`);
      }
    }, PROXY_REFRESH_INTERVAL);

    log.success(`✅ Sistema de proxies listo con ${proxySystem.proxies.length} proxies\n`);
  } catch (err) {
    log.error(`❌ Error inicializando sistema de proxies: ${err.message}`);
    await notifyTelegram(`❌ Error crítico en proxies: ${err.message}`);
    clearInterval(refreshInterval);
    process.exit(1);
  }

  // Limpiar cuentas existentes
  if (AccountManager.getAccounts().length > 0) {
    log.info(`🧹 Limpiando ${AccountManager.getAccounts().length} cuentas...`);
    AccountManager.clearAccounts();
  }

  // Crear cuentas
  for (let i = 1; i <= TOTAL_CUENTAS; i++) {
    if (errores >= MAX_ERRORES) break;

    log.highlight(`\n🚀 Creando cuenta ${i}/${TOTAL_CUENTAS}`);

    let proxy;
    try {
      proxy = proxySystem.getNextProxy();
      if (!proxy) {
        log.error('❌ Sin proxies válidos disponibles. Deteniendo.');
        break;
      }

      const cuenta = await crearCuentaInstagram(proxy);

      if (cuenta?.usuario && cuenta?.password) {
        creadas++;
        AccountManager.addAccount(cuenta);
        proxySystem.markProxySuccess(proxy);
        log.success(`✅ Cuenta creada: @${cuenta.usuario}`);
      } else {
        throw new Error('Cuenta inválida');
      }
    } catch (error) {
      errores++;
      log.error(`🔥 Error creando cuenta #${i}: ${error.message}`);

      if (proxy) {
        proxySystem.markProxyAsBad(proxy);
      }

      if (errores >= MAX_ERRORES) {
        log.error(`🛑 Se alcanzaron ${errores} errores. Deteniendo producción.`);
        await notifyTelegram(`❌ Detenido tras ${errores} errores. Se crearon ${creadas} cuentas.`);
        break;
      }
    }

    // Espera aleatoria entre cuentas (30-120 segundos)
    const waitTime = Math.floor(Math.random() * 90 + 30);
    log.info(`⏳ Esperando ${waitTime} segundos antes de la próxima cuenta...`);
    await new Promise(resolve => setTimeout(resolve, waitTime * 1000));
  }

  // Guardar resultados
  if (creadas > 0) {
    const ruta = path.join(__dirname, 'cuentas_creadas.json');
    fs.writeFileSync(ruta, JSON.stringify(AccountManager.getAccounts(), null, 2));
    log.success(`💾 ${creadas} cuentas guardadas en cuentas_creadas.json`);

    const stats = proxySystem.getStats();
    await notifyTelegram(
      `✅ ${creadas} cuentas creadas correctamente!\n` +
      `📊 Estadísticas:\n` +
      `- Proxies usados: ${stats.totalRequests}\n` +
      `- Éxitos: ${stats.successCount}\n` +
      `- Fallos: ${stats.failCount}\n` +
      `- Tasa éxito: ${stats.successRate}%`
    );
  } else {
    log.warn('⚠️ No se creó ninguna cuenta válida.');
    await notifyTelegram('⚠️ No se crearon cuentas en esta ejecución');
  }

  // Limpieza final
  clearInterval(refreshInterval);
  log.highlight('\n🏁 Ejecución completada');
}

// Iniciar la aplicación
startApp().catch(async (error) => {
  log.error(`❌ Error no controlado: ${error.message}`);
  await notifyTelegram(`💥 Error crítico: ${error.message}`);
  clearInterval(refreshInterval);
  process.exit(1);
});