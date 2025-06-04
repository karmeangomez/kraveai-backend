// runAccountCreation.js - Script para ejecutar la creación de cuentas
const { createMultipleAccounts } = require('./instagramAccountCreator');

(async () => {
  try {
    console.log('🚀 Iniciando creación automática de cuentas...');
    const accounts = await createMultipleAccounts(3); // Crear 3 cuentas
    console.log('Cuentas creadas:', accounts);
  } catch (error) {
    console.error('❌ Error en la ejecución:', error.message);
  }
})();
