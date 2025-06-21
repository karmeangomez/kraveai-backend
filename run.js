import AccountManager from './src/accounts/accountManager.js';
import crearCuentaInstagram from './src/accounts/crearCuentaInstagram.js';
import UltimateProxyMaster from './src/proxies/ultimateProxyMaster.js';
import ProxyRotationSystem from './src/proxies/proxyRotationSystem.js';
import fs from 'fs';
import { notifyTelegram } from './src/utils/telegram_utils.js';

const CONFIG = {
    ACCOUNTS_TO_CREATE: 5,
    DELAY_BETWEEN_ACCOUNTS: 30000
};

(async () => {
    try {
        // 1. Inicialización
        AccountManager.clearAccounts();
        await UltimateProxyMaster.init();
        const proxySystem = new ProxyRotationSystem();
        await proxySystem.initHealthChecks();

        // 2. Creación de cuentas
        for (let i = 0; i < CONFIG.ACCOUNTS_TO_CREATE; i++) {
            console.log(`\n🚀 Creando cuenta ${i+1}/${CONFIG.ACCOUNTS_TO_CREATE}`);
            
            const result = await crearCuentaInstagram(proxySystem);
            AccountManager.addAccount(result);
            
            if (result.status === 'created') {
                console.log(`✅ Cuenta creada: @${result.username}`);
            } else {
                console.error(`❌ Fallo: ${result.error}`);
            }

            if (i < CONFIG.ACCOUNTS_TO_CREATE - 1) {
                await new Promise(r => setTimeout(r, CONFIG.DELAY_BETWEEN_ACCOUNTS));
            }
        }

        // 3. Guardar resultados
        const allAccounts = AccountManager.getAccounts();
        fs.writeFileSync('cuentas_creadas.json', JSON.stringify(allAccounts, null, 2));

        // 4. Resultados finales
        const successCount = allAccounts.filter(a => a.status === 'created').length;
        console.log('\n🎉 Proceso completado!');
        console.log('Cuentas creadas:', successCount);

        // 5. Notificación Telegram (opcional)
        await notifyTelegram(`✅ Se crearon ${successCount} cuentas exitosamente 🚀`);

    } catch (error) {
        console.error('🔥 Error crítico:', error);
        process.exit(1);
    }
})();
