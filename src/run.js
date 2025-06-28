// 📁 src/run.js
import chalk from 'chalk';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import AccountManager from './accounts/accountManager.js';
import crearCuentaInstagram from './accounts/crearCuentaInstagram.js';
import ultimateProxyMaster from './proxies/ultimateProxyMaster.js';
import { notifyTelegram } from './utils/telegram_utils.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TOTAL_CUENTAS = 50;
const MAX_ERRORES = 10;

let errores = 0;
let creadas = 0;
let proxySystem;

console.log(chalk.magenta.bold(`[${new Date().toISOString()}] 🔥 Iniciando KraveAI-Granja Rusa 🔥`));
console.log(chalk.green(`✅ Plataforma: ${process.platform}`));
console.log(chalk.green(`✅ Modo: ${process.env.HEADLESS === 'true' ? 'HEADLESS' : 'VISIBLE'}`));
console.log(chalk.green(`✅ Cuentas a crear: ${TOTAL_CUENTAS}`));

// Notifica inicio por Telegram
await notifyTelegram(`🚀 Iniciando creación de ${TOTAL_CUENTAS} cuentas de Instagram`);

try {
  // ✅ Corrección: usar función async directamente
  proxySystem = await ultimateProxyMaster();
  console.log(chalk.green(`✅ Sistema de proxies listo\n`));
} catch (err) {
  console.error(`❌ Error inicializando sistema de proxies:`, err);
  process.exit(1);
}

// 🧹 Limpieza previa
if (AccountManager.getAccounts().length > 0) {
  console.log(`🧹 Limpiando ${AccountManager.getAccounts().length} cuentas...`);
  AccountManager.clearAccounts();
}

// 🚀 Inicio de creación de cuentas
for (let i = 1; i <= TOTAL_CUENTAS; i++) {
  console.log(chalk.blue(`🚀 Creando cuenta ${i}/${TOTAL_CUENTAS}`));

  const proxy = await proxySystem.getNextProxy();
  if (!proxy) {
    console.error(`❌ Sin proxies válidos disponibles. Deteniendo.`);
    break;
  }

  try {
    const cuenta = await crearCuentaInstagram(proxy);

    if (cuenta && cuenta.usuario && cuenta.password) {
      creadas++;
      AccountManager.addAccount(cuenta);
      console.log(chalk.green(`✅ Cuenta creada: @${cuenta.usuario}`));
    } else {
      throw new Error('Cuenta inválida');
    }
  } catch (error) {
    errores++;
    console.log(chalk.red(`🔥 Error creando cuenta #${i}: ${error.message || error}`));
    await proxySystem.markProxyAsBad(proxy);

    if (errores >= MAX_ERRORES) {
      console.log(chalk.bgRed(`🛑 Se alcanzaron ${errores} errores. Deteniendo producción.`));
      await notifyTelegram(`❌ Se detuvo la creación tras ${errores} errores. Solo se crearon ${creadas} cuentas.`);
      break;
    }
  }
}

// 💾 Guardar cuentas si hubo éxito
if (creadas > 0) {
  const ruta = path.join(__dirname, 'cuentas_creadas.json');
  fs.writeFileSync(ruta, JSON.stringify(AccountManager.getAccounts(), null, 2));
  console.log(chalk.green(`💾 ${creadas} cuentas guardadas en cuentas_creadas.json`));
  await notifyTelegram(`✅ Proceso finalizado: ${creadas} cuentas creadas correctamente.`);
} else {
  console.log(chalk.yellow(`⚠️ No se creó ninguna cuenta válida.`));
}
