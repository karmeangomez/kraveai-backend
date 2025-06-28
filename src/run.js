// 📁 src/run.js
import chalk from 'chalk';
import UltimateProxyMaster from './proxies/ultimateProxyMaster.js';
import crearCuentaInstagram from './accounts/crearCuentaInstagram.js';
import { notifyTelegram } from './utils/telegram.js';

const TOTAL_CUENTAS = 50;

async function main() {
  console.log(`[${new Date().toISOString()}] 🔥 Iniciando KraveAI-Granja Rusa 🔥`);
  console.log(`✅ Plataforma: ${process.platform}`);
  console.log(`✅ Modo: HEADLESS`);
  console.log(`✅ Cuentas a crear: ${TOTAL_CUENTAS}`);

  await notifyTelegram('📲 Iniciando creación de 50 cuentas en KraveAI.');

  const proxySystem = new UltimateProxyMaster();
  await proxySystem.initialize();

  console.log('✅ Sistema de proxies listo\n');

  let errores = 0;

  for (let i = 1; i <= TOTAL_CUENTAS; i++) {
    console.log(chalk.blue(`🚀 Creando cuenta ${i}/${TOTAL_CUENTAS}`));
    const proxy = proxySystem.getNextProxy();

    if (!proxy) {
      console.error(`❌ Sin proxies válidos disponibles. Deteniendo.`);
      break;
    }

    try {
      const cuenta = await crearCuentaInstagram(proxy);
      if (cuenta && cuenta.username) {
        console.log(chalk.green(`✅ Cuenta creada: @${cuenta.username}`));
      } else {
        throw new Error('Cuenta inválida');
      }
    } catch (err) {
      console.error(`🔥 Error creando cuenta #${i}: ${err.message}`);
      proxySystem.markProxyAsBad(proxy);
      errores++;
      if (errores >= 10) {
        console.log('🛑 Se alcanzaron 10 errores. Deteniendo producción.');
        await notifyTelegram('❌ Se alcanzaron 10 errores consecutivos. KraveAI detuvo la producción.');
        break;
      }
    }
  }
}

main();
