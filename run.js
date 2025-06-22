// src/run.js
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
  ACCOUNTS_TO_CREATE: 50,
  DELAY_BETWEEN_ACCOUNTS: 15000 // 15 segundos para evitar detección
};

(async () => {
  try {
    const inicio = new Date();
    await notifyInstanciaIniciada({
      hora: inicio.toLocaleTimeString(),
      entorno: 'Producción'
    });

    // 🔄 Limpieza y validación inicial
    AccountManager.clearAccounts();
    await UltimateProxyMaster.loadProxies();
    await ProxyRotationSystem.loadBlacklist?.(); // si implementaste persistencia
    await ProxyRotationSystem.initHealthChecks();
    ProxyRotationSystem.startPeriodicValidation?.(); // si tienes activada revalidación automática

    for (let i = 0; i < CONFIG.ACCOUNTS_TO_CREATE; i++) {
      console.log(`\n🚀 Creando cuenta ${i + 1}/${CONFIG.ACCOUNTS_TO_CREATE}`);
      const result = await crearCuentaInstagram();

      if (result) {
        AccountManager.addAccount(result);

        if (result.username) {
          console.log(`✅ Cuenta creada: @${result.username}`);
          await notifyCuentaExitosa(result);
        } else {
          const mensaje = result.error || '❌ Cuenta inválida';
          console.error(`❌ Fallo: ${mensaje}`);
          await notifyErrorCuenta(result, mensaje);
        }
      } else {
        const fallback = {
          username: '',
          email: '',
          password: '',
          proxy: '',
          status: 'failed',
          error: '❌ crearCuentaInstagram devolvió null'
        };
        AccountManager.addAccount(fallback);
        await notifyErrorCuenta(fallback, fallback.error);
      }

      if (i < CONFIG.ACCOUNTS_TO_CREATE - 1) {
        await new Promise(r => setTimeout(r, CONFIG.DELAY_BETWEEN_ACCOUNTS));
      }
    }

    // Guardar cuentas
    const allAccounts = AccountManager.getAccounts();
    if (allAccounts.length) {
      fs.writeFileSync('cuentas_creadas.json', JSON.stringify(allAccounts, null, 2));
    }

    // Resumen final
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
