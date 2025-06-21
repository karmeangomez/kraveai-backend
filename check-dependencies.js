// check-dependencies.js
import pkg from './package.json' assert { type: 'json' };
const { dependencies } = pkg;

console.log('🔍 Revisando dependencias...');

const required = ['axios', 'imap', 'puppeteer', 'user-agents', 'jsdom', 'mailparser'];
const missing = required.filter(dep => !dependencies.hasOwnProperty(dep));

if (missing.length > 0) {
  console.error('❌ Dependencias faltantes en package.json:');
  missing.forEach(d => console.error(`• ${d}`));
  process.exit(1);
} else {
  console.log('✅ Todas las dependencias requeridas están en package.json');
}
