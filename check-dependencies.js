import { dependencies } from './package.json' assert { type: 'json' };

const requiredDeps = [
  'puppeteer', 'axios', 'imap', 'mailparser', 'jsdom'
];

console.log('🔍 Verificando dependencias:');
requiredDeps.forEach(dep => {
  const installed = dependencies[dep];
  console.log(`   ${dep}: ${installed ? '✅' : '❌'}`);
  
  if (!installed) {
    console.warn(`   ⚠️ Ejecuta: npm install ${dep}`);
  }
});
