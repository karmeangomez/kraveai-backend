#!/usr/bin/env node
require('dotenv').config();

function checkEnvironment() {
  const requiredVars = ['IONOS_EMAIL', 'IONOS_PASSWORD', 'MAILBOXVALIDATOR_KEY', 'WEBSHARE_API_KEY'];
  const missing = [];

  requiredVars.forEach(varName => {
    if (!process.env[varName] || process.env[varName].trim() === '') {
      missing.push(varName);
    }
  });

  if (missing.length > 0) {
    throw new Error(`❌ Variables de entorno faltantes: ${missing.join(', ')}`);
  }

  console.log('✅ Variables de entorno configuradas correctamente');

  // Mostrar valores de forma segura
  console.log(`- IONOS_EMAIL: ${process.env.IONOS_EMAIL.slice(0, 3)}...@...`);
  console.log(`- IONOS_PASSWORD: ${'*'.repeat(process.env.IONOS_PASSWORD.length)}`);

  // Mostrar solo parte de la API key para verificación
  const mbvKey = process.env.MAILBOXVALIDATOR_KEY;
  const maskedMbvKey = mbvKey.length > 8 
    ? `${mbvKey.slice(0, 3)}...${mbvKey.slice(-3)}` 
    : '*****';
  console.log(`- MAILBOXVALIDATOR_KEY: ${maskedMbvKey} (${mbvKey.length} caracteres)`);

  // Verificación adicional de formato MailboxValidator
  if (!mbvKey.startsWith('MBV') || mbvKey.length < 12) {
    console.warn('⚠️ La API Key de MailboxValidator parece tener un formato inusual');
  }

  // Mostrar solo parte de la API key de Webshare
  const wsKey = process.env.WEBSHARE_API_KEY;
  const maskedWsKey = wsKey.length > 8 
    ? `${wsKey.slice(0, 4)}...${wsKey.slice(-4)}` 
    : '*****';
  console.log(`- WEBSHARE_API_KEY: ${maskedWsKey} (${wsKey.length} caracteres)`);

  // Verificación adicional de formato Webshare
  if (wsKey.length !== 40) {
    console.warn('⚠️ La API Key de Webshare parece tener una longitud inusual (normalmente 40 caracteres)');
  }
}

try {
  checkEnvironment();
} catch (error) {
  console.error(error.message);
  console.error('🔧 Solución:');
  console.error('1. Asegúrate de tener estas variables en tu .env:');
  console.error('   - IONOS_EMAIL');
  console.error('   - IONOS_PASSWORD');
  console.error('   - MAILBOXVALIDATOR_KEY');
  console.error('   - WEBSHARE_API_KEY');
  console.error('2. Verifica las variables en GitHub Secrets (si estás en CI/CD)');
  console.error('3. Para desarrollo local, copia .env.example a .env');
  process.exit(1);
}