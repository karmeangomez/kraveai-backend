// 📁 src/run.js
import chalk from 'chalk';
import { notifyTelegram } from './utils/telegram_utils.js';
import UltimateProxyMaster from './proxies/ultimateProxyMaster.js';
import ProxyRotationSystem from './proxies/proxyRotationSystem.js';
import crearCuentaInstagram from './accounts/crearCuentaInstagram.js';

const TOTAL_CUENTAS = 50;

let proxySystem = null;

async function main() {
  console.log(`[${new Date().toISOString()}] 🔥 Iniciando KraveAI-Granja Rusa 🔥`);
  console.log(`✅ Plataforma: ${process.platform}`);
  console.log(`✅ Modo: HEADLESS`);
  console.log(`✅ Cuentas a crear: ${TOTAL_CUENTAS}`);

  try {
    await notifyTelegram('🚀 Iniciando KraveAI - Granja Rusa');

    const ultimate = new UltimateProxyMaster();
    const proxyList = await ultimate.getProxyList();

    proxySystem = new ProxyRotationSystem();
    await proxySystem.initialize(proxyList);

    console.log(`✅ Sistema de proxies listo\n`);

    let creadas = 0;
    let fallidas = 0;

    for (let i = 1; i <= TOTAL_CUENTAS; i++) {
      console.log(chalk.blue(`🚀 Creando cuenta ${i}/${TOTAL_CUENTAS}`));
      let proxy = null;

      try {
        proxy = proxySystem.getNextProxy();
        const cuenta = await crearCuentaInstagram(proxy);

        if (cuenta && cuenta.username) {
          creadas++;
          console.log(chalk.green(`✅ Cuenta creada: @${cuenta.username}`));
        } else {
          throw new Error('Cuenta inválida');
        }

      } catch (error) {
        fallidas++;
        if (proxy) proxySystem.markProxyAsBad(proxy);
        console.log(chalk.red(`🔥 Error creando cuenta #${i}: ${error.message}`));
      }

      if (fallidas >= 10) {
        console.log(chalk.red(`🛑 Se alcanzaron 10 errores. Deteniendo producción.`));
        await notifyTelegram('🛑 Se alcanzaron 10 errores. KraveAI detuvo la creación.');
        break;
      }
    }

    console.log(chalk.bold(`\nResumen Final:`));
    console.log(`✔️ Creadas: ${creadas}`);
    console.log(`❌ Fallidas: ${fallidas}`);

  } catch (err) {
    console.error('❌ Error general:', err.message);
    await notifyTelegram(`❌ Error crítico en KraveAI: ${err.message}`);
  }
}

main();
