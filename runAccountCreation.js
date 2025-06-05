// ✅ runAccountCreation.js - Controlado desde frontend vía POST
const express = require('express');
const { createMultipleAccounts } = require('./instagramAccountCreator');

const router = express.Router();

router.post('/create-accounts', async (req, res) => {
  const total = parseInt(req.body.count) || 1;
  const turbo = req.body.turbo === true;

  console.log(`🚀 Creación solicitada desde frontend: ${total} cuentas`);
  console.time('⏱️ Tiempo de ejecución');

  try {
    const cuentas = await createMultipleAccounts(total, turbo); // turbo puede ser usado si lo agregas
    console.log(`✅ ${cuentas.length} creadas correctamente`);
    console.timeEnd('⏱️ Tiempo de ejecución');

    res.status(200).json({
      success: true,
      total,
      creadas: cuentas.length,
      detalle: cuentas
    });
  } catch (error) {
    console.error('❌ Error general:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
