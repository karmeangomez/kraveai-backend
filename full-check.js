const modules = [
  './src/accounts/accountManager.js',
  './src/accounts/crearCuentaInstagram.js',
  './src/proxies/proxyRotationSystem.js',
  './src/email/emailManager.js',
  './src/utils/humanActions.js',
  './src/utils/nombre_utils.js'
];

console.log('🔍 Verificando importaciones...');

for (const modulePath of modules) {
  try {
    console.log(`   Probando: ${modulePath}`);
    await import(modulePath);
  } catch (error) {
    console.error(`❌ Error en ${modulePath}:`);
    console.error(`   ${error.message}`);
    if (error.code === 'ERR_MODULE_NOT_FOUND') {
      console.error(`   Posible solución: npm install ${error.message.split("'")[1]}`);
    }
  }
}
console.log('✅ Verificación completada');
