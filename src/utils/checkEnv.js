#!/usr/bin/env node
require('dotenv').config();

function checkEnvironment() {
  const requiredVars = ['IONOS_USER', 'IONOS_PASS'];
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
  console.log(`- IONOS_USER: ${process.env.IONOS_USER.slice(0, 3)}...@...`);
  console.log(`- IONOS_PASS: ${'*'.repeat(process.env.IONOS_PASS.length)}`);
}

try {
  checkEnvironment();
} catch (error) {
  console.error(error.message);
  process.exit(1);
}
