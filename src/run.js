import 'dotenv/config';
import chalk from 'chalk';
import { fileURLToPath } from 'url';
import path from 'path';
import crearCuentaInstagram from './accounts/crearCuentaInstagram.js';
import AccountManager from './accounts/accountManager.js';
import proxySystem from './proxies/proxyRotationSystem.js';
import {
  notifyTelegram,
  notifyResumenFinal
} from './utils/telegram_utils.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const CUENTAS_A_CREAR = 50;
const MAX_ERRORES = 10;

console.log(`[${new Date().toISOString()}] 🔥 Iniciando KraveAI-Granja Rusa 🔥`);
console.log(`[${new Date().toISOString()}] ✅ Plataforma: ${process.platform}`);
console.log(`[${new Date().toISOString()}] ✅ Modo: ${process.env.HEADLESS === 'true' ? 'HEADLESS' : 'VISIBLE'}`);
console.log(`[${new Date().toISOString()}] ✅ Cuentas a crear: ${CUENTAS_A_CREAR}`);

await notifyTelegram(`🚀 Iniciando creación de ${CUENTAS_A_CREAR} cuentas de Instagram.`);

AccountManager.clearAccounts();

console.log('🔄 Inicializando sistema de proxies...');
await proxySystem.initialize();
console.log('✅ Sistema de proxies listo\n');

let cuentasCreadas = 0;
let errores = 0;
const tiempoInicio = Date.now();

for (let i = 0; i < CUENTAS_A_CREAR; i++) {
  console.log(`🚀 Creando cuenta ${i + 1}/${CUENTAS_A_CREAR}`);
  const proxy = proxySystem.getNextProxy();

  try {
    const resultado = await crearCuentaInstagram(proxy);
    if (resultado?.username) {
      cuentasCreadas++;
      console.log(chalk.green(`✅ Cuenta creada: @${resultado.username}`));
    } else {
      errores++;
      console.log(chalk.red(`❌ Fallo creando cuenta #${i + 1}`));
    }
  } catch (error) {
    errores++;
    console.log(chalk.red(`🔥 Error creando cuenta #${i + 1}: ${error.message}`));
  }

  if (errores >= MAX_ERRORES) {
    console.log(chalk.bgRed(`❌ Se alcanzó el máximo de ${MAX_ERRORES} errores. Deteniendo producción.`));
    await notifyTelegram(`❌ Se detuvo la producción de cuentas. Fallos acumulados: ${errores}`);
    break;
  }
}

const tiempoTotal = ((Date.now() - tiempoInicio) / 1000).toFixed(1);

console.log(`\n📊 Resumen:`);
console.log(chalk.green(`✅ Creadas: ${cuentasCreadas}`));
console.log(chalk.red(`❌ Fallidas: ${errores}`));
console.log(chalk.yellow(`📁 Total en memoria: ${AccountManager.getAccounts().length}`));

await notifyResumenFinal({
  total: cuentasCreadas + errores,
  success: cuentasCreadas,
  fail: errores,
  tiempo: `${tiempoTotal}s`
});