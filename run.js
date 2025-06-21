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
    // 1. Inicializar sistemas
    console.log('⚙️ Inicializando sistemas...');
    
    // Inicializar AccountManager
    AccountManager.clearAccounts();
    
    // Inicializar proxies
    await UltimateProxyMaster.init();
    const proxySystem = new ProxyRotationSystem();
    await proxySystem.initHealthChecks();
    
    console.log('🔥 Todos los sistemas iniciados');
    
    // 2. Crear cuentas
    const results = [];
    for (let i = 0; i < ACCOUNTS_TO_CREATE; i++) {
      console.log(`\n🚀 Creando cuenta ${i + 1}/${ACCOUNTS_TO_CREATE}...`);
      
      const startTime = Date.now();
      const result = await crearCuentaInstagram(proxySystem); // Pasamos el proxySystem
      const elapsedTime = ((Date.now() - startTime) / 1000).toFixed(1);
      
      if (result.status === 'created') {
        console.log(`✅ Cuenta creada en ${elapsedTime}s | @${result.username}`);
      } else {
        console.error(`❌ Error: ${result.error || 'Desconocido'}`);
      }
      
      if (i < ACCOUNTS_TO_CREATE - 1) {
        console.log(`⏳ Esperando ${DELAY_BETWEEN_ACCOUNTS / 1000}s...`);
        await new Promise(resolve => setTimeout(resolve, DELAY_BETWEEN_ACCOUNTS));
      }
      
      results.push(result);
    }
    
    // 3. Generar reporte
    generateReport(results);
    
  } catch (error) {
    console.error(`🔥 Error fatal: ${error.message}`);
    fs.writeFileSync('error_report.json', JSON.stringify({
      error: error.message,
      stack: error.stack
    }, null, 2));
    process.exit(1);
  }
})();

function generateReport(results) {
  const successCount = results.filter(r => r.status === 'created').length;
  
  console.log(`\n🎉 Resultados:`);
  console.log(`✔️ ${successCount} exitosas | ✖️ ${results.length - successCount} fallidas`);
  
  fs.writeFileSync('cuentas_creadas.json', JSON.stringify({
    timestamp: new Date().toISOString(),
    results: results
  }, null, 2));
  
  console.log('📊 Reporte guardado en cuentas_creadas.json');
}
