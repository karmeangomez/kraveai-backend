// ✅ runAccountCreation.js - Ejecución optimizada con logs y modo turbo
const { createMultipleAccounts } = require('./instagramAccountCreator');

const TOTAL = 5; // 🔁 Número de cuentas a crear (modificable desde el frontend)
const TURBO_MODE = true; // ⚡ true = sin pausas largas (usar solo en pruebas internas)

(async () => {
  try {
    console.time('⏱️ Tiempo total');
    console.log(`🚀 Iniciando creación de ${TOTAL} cuentas...`);

    const accounts = await createMultipleAccounts(TOTAL);

    const creadas = accounts.length;
    const fallidas = TOTAL - creadas;

    console.log('✅ Cuentas creadas con éxito:', creadas);
    console.log('❌ Fallidas:', fallidas);
    console.log('📦 Detalle:', accounts);

    console.timeEnd('⏱️ Tiempo total');

    // 💾 Si quieres guardar en otro lado (como base de datos), puedes hacerlo aquí
  } catch (error) {
    console.error('❌ Error general en el proceso:', error.message);
  }
})();
