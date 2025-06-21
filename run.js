import fs from 'fs';
import crearCuentaInstagram from './src/accounts/crearCuentaInstagram.js';
import AccountManager from './src/accounts/accountManager.js';
import UltimateProxyMaster from './src/proxies/ultimateProxyMaster.js';
import ProxyRotationSystem from './src/proxies/proxyRotationSystem.js';

// Configuración
const ACCOUNTS_TO_CREATE = 5;
const DELAY_BETWEEN_ACCOUNTS = 30000; // 30 segundos

(async () => {
  try {
    // 1. Inicializar sistema de proxies
    console.log('⚙️ Inicializando sistema de proxies...');
    await UltimateProxyMaster.init();
    
    // 2. Iniciar sistema de rotación
    await ProxyRotationSystem.initHealthChecks();
    
    console.log('🔥 Sistema de proxies iniciado');
    
    // Ejecutar cuentas en serie
    const results = [];
    for (let i = 0; i < ACCOUNTS_TO_CREATE; i++) {
      console.log(`\n🚀 Creando cuenta ${i + 1}/${ACCOUNTS_TO_CREATE}...`);
      
      const startTime = Date.now();
      const result = await crearCuentaInstagram();
      const elapsedTime = ((Date.now() - startTime) / 1000).toFixed(1);
      
      if (result.status === 'created') {
        console.log(`✅ Cuenta creada exitosamente en ${elapsedTime}s`);
        console.log(`   Usuario: @${result.username}`);
        console.log(`   Email: ${result.email}`);
        console.log(`   Proxy usado: ${result.proxy}`);
      } else {
        console.error(`❌ Error: ${result.error || 'Desconocido'}`);
      }
      
      // Esperar antes de la siguiente cuenta (excepto la última)
      if (i < ACCOUNTS_TO_CREATE - 1) {
        console.log(`⏳ Esperando ${DELAY_BETWEEN_ACCOUNTS / 1000} segundos...`);
        await new Promise(resolve => setTimeout(resolve, DELAY_BETWEEN_ACCOUNTS));
      }
      
      results.push(result);
    }
    
    // 3. Reporte final
    const accounts = AccountManager.getAccounts();
    const successCount = accounts.filter(a => a.status === 'created').length;
    
    console.log(`\n🎉 Proceso completado!`);
    console.log(`   Cuentas exitosas: ${successCount}/${ACCOUNTS_TO_CREATE}`);
    console.log(`   Cuentas fallidas: ${ACCOUNTS_TO_CREATE - successCount}`);
    
    // 4. Mostrar estadísticas de proxies
    console.log('\n📊 Estadísticas de Proxies:');
    ProxyRotationSystem.showProxyStats();
    
    // 5. Guardar reporte
    fs.writeFileSync('creacion_cuentas_report.json', JSON.stringify({
      timestamp: new Date().toISOString(),
      total: ACCOUNTS_TO_CREATE,
      success: successCount,
      failed: ACCOUNTS_TO_CREATE - successCount,
      accounts: accounts.map(a => ({
        id: a.id,
        username: a.username,
        status: a.status,
        email: a.email,
        proxy: a.proxy,
        error: a.error
      }))
    }, null, 2));
    console.log('📝 Reporte guardado en creacion_cuentas_report.json');
    
  } catch (error) {
    console.error(`🔥 Error fatal: ${error.message}`);
    process.exit(1);
  }
})();
