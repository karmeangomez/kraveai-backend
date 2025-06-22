import AccountManager from './src/accounts/accountManager.js';
import crearCuentaInstagram from './src/accounts/crearCuentaInstagram.js';
import UltimateProxyMaster from './src/proxies/ultimateProxyMaster.js';
import ProxyRotationSystem from './src/proxies/proxyRotationSystem.js';
import fs from 'fs';
import {
  notifyTelegram,
  notifyCuentaExitosa,
  notifyErrorCuenta,
  notifyResumenFinal,
  notifyInstanciaIniciada
} from './src/utils/telegram_utils.js';

const CONFIG = {
  ACCOUNTS_TO_CREATE: 5,
  DELAY_BETWEEN_ACCOUNTS: 30000
};

(async () => {
  try {
    const inicio = new Date();
    await notifyInstanciaIniciada({
      hora: inicio.toLocaleTimeString(),
      entorno: 'Producción'
    });

    AccountManager.clearAccounts();
    await UltimateProxyMaster.init();
    await ProxyRotationSystem.initHealthChecks();

    for (let i = 0; i < CONFIG.ACCOUNTS_TO_CREATE; i++) {
      console.log(`\n🚀 Creando cuenta ${i + 1}/${CONFIG.ACCOUNTS_TO_CREATE}`);
      const result = await crearCuentaInstagram();

      if (result && result.username) {
        AccountManager.addAccount(result);
        console.log(`✅ Cuenta creada: @${result.username}`);
        await notifyCuentaExitosa(result);
      } else {
        const mensaje = result?.error || '❌ Error desconocido creando cuenta';
        console.error(`❌ Fallo: ${mensaje}`);
        await notifyErrorCuenta(result || {}, mensaje);
      }

      if (i < CONFIG.ACCOUNTS_TO_CREATE - 1) {
        await new Promise(r => setTimeout(r, CONFIG.DELAY_BETWEEN_ACCOUNTS));
      }
    }

    const allAccounts = AccountManager.getAccounts();
    fs.writeFileSync('cuentas_creadas.json', JSON.stringify(allAccounts, null, 2));

    const successCount = allAccounts.filter(a => a.status === 'created').length;
    const failCount = allAccounts.length - successCount;
    const fin = new Date();
    const tiempo = ((fin - inicio) / 1000).toFixed(1) + 's';

    console.log('\n🎉 Proceso completado!');
    console.log('Cuentas creadas:', successCount);

    await notifyResumenFinal({
      total: allAccounts.length,
      success: successCount,
      fail: failCount,
      tiempo
    });

  } catch (error) {
    console.error('🔥 Error crítico:', error);
    await notifyTelegram(`🔥 Error crítico en ejecución:\n${error.message}`);
    process.exit(1);
  }
})();
