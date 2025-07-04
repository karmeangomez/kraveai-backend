import chalk from 'chalk';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
dotenv.config();

import AccountManager from './accounts/accountManager.js';
import { crearCuentaInstagram } from './accounts/crearCuentaInstagram.js';
import UltimateProxyMaster from './proxies/ultimateProxyMaster.js';
import { notifyTelegram } from './utils/telegram_utils.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const TOTAL_CUENTAS = 50;
const MAX_ERRORES = 10;

chalk.level = 1;
const log = {
  info: (msg) => console.log(chalk.cyan(msg)),
  success: (msg) => console.log(chalk.green(msg)),
  warn: (msg) => console.log(chalk.yellow(msg)),
  error: (msg) => console.log(chalk.red(msg)),
  highlight: (msg) => console.log(chalk.magenta.bold(msg))
};

let errores = 0;
let creadas = 0;
let proxySystem;

async function startApp() {
  log.highlight(`\n[${new Date().toISOString()}] 🔥 Iniciando KraveAI-Granja Rusa 🔥`);
  log.info(`✅ Plataforma: ${process.platform}`);
  log.info(`✅ Modo: ${process.env.HEADLESS === 'true' ? 'HEADLESS' : 'VISIBLE'}`);
  log.info(`✅ Cuentas a crear: ${TOTAL_CUENTAS}`);

  try {
    proxySystem = new UltimateProxyMaster();
    await proxySystem.initialize(true);
    log.success(`✅ Sistema de proxies listo con ${proxySystem.proxies.length} proxies\n`);
  } catch (err) {
    log.error(`❌ Error inicializando proxies: ${err.message}`);
    await notifyTelegram(`❌ Error crítico en proxies: ${err.message}`);
    process.exit(1);
  }

  // Limpiar cuentas anteriores
  AccountManager.clearAccounts();

  for (let i = 1; i <= TOTAL_CUENTAS; i++) {
    if (errores >= MAX_ERRORES) {
      log.error(`🛑 Se alcanzaron ${errores} errores. Deteniendo producción.`);
      await notifyTelegram(`❌ Detenido tras ${errores} errores. Se crearon ${creadas} cuentas.`);
      break;
    }

    log.highlight(`\n🚀 Creando cuenta ${i}/${TOTAL_CUENTAS}`);

    try {
      const proxy = proxySystem.getNextProxy();
      if (!proxy) {
        throw new Error('No hay proxies disponibles');
      }

      const cuenta = await crearCuentaInstagram(proxy);

      if (cuenta?.status === 'success') {
        creadas++;
        AccountManager.addAccount(cuenta);
        log.success(`✅ Cuenta creada: @${cuenta.usuario}`);
      } else {
        throw new Error(cuenta?.error || 'Error desconocido');
      }
    } catch (error) {
      errores++;
      log.error(`🔥 Error creando cuenta #${i}: ${error.message}`);

      if (errores >= MAX_ERRORES) {
        log.error(`🛑 Se alcanzaron ${errores} errores. Deteniendo producción.`);
        await notifyTelegram(`❌ Detenido tras ${errores} errores. Se crearon ${creadas} cuentas.`);
        break;
      }
    }

    // Espera aleatoria entre cuentas
    const waitTime = Math.floor(Math.random() * 120 + 60); // 60-180 segundos
    log.info(`⏳ Esperando ${waitTime} segundos...`);
    await new Promise(resolve => setTimeout(resolve, waitTime * 1000));
  }

  if (creadas > 0) {
    const ruta = path.join(__dirname, 'cuentas_creadas.json');
    fs.writeFileSync(ruta, JSON.stringify(AccountManager.getAccounts(), null, 2));
    log.success(`💾 ${creadas} cuentas guardadas`);

    await notifyTelegram(
      `✅ ${creadas} cuentas creadas correctamente!\n` +
      `📊 Proxies usados: ${proxySystem.proxies.length}`
    );
  } else {
    log.warn('⚠️ No se creó ninguna cuenta válida.');
    await notifyTelegram('⚠️ No se crearon cuentas en esta ejecución');
  }

  log.highlight('\n🏁 Ejecución completada');
}

startApp().catch(async (error) => {
  log.error(`❌ Error no controlado: ${error.message}`);
  await notifyTelegram(`💥 Error crítico: ${error.message}`);
  process.exit(1);
});
