import fs from 'fs';
import path from 'path';

const projectRoot = path.resolve();
const filesToCheck = [
  'src/accounts/accountManager.js',
  'src/accounts/crearCuentaInstagram.js',
  'src/proxies/proxyRotationSystem.js',
  'src/email/emailManager.js',
  'src/utils/humanActions.js',
  'src/utils/nombre_utils.js'
];

console.log('🔍 Verificando exportaciones...');
filesToCheck.forEach(file => {
  const filePath = path.join(projectRoot, file);
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    const hasDefaultExport = content.includes('export default');
    
    console.log(`📄 ${file}:`);
    console.log(`   Default Export: ${hasDefaultExport ? '✅' : '❌'}`);
    
    if (!hasDefaultExport) {
      console.warn('   ⚠️ Este archivo necesita "export default"');
    }
  } catch (error) {
    console.error(`   ❌ Error leyendo archivo: ${error.message}`);
  }
});
