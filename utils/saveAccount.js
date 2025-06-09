const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'cuentas_creadas.json');

function guardarCuenta(nuevaCuenta) {
  let cuentas = [];

  if (fs.existsSync(filePath)) {
    try {
      const data = fs.readFileSync(filePath, 'utf8');
      cuentas = JSON.parse(data);
    } catch (err) {
      console.warn('⚠️ Error leyendo archivo de cuentas, se creará nuevo');
    }
  }

  cuentas.push(nuevaCuenta);

  try {
    fs.writeFileSync(filePath, JSON.stringify(cuentas, null, 2));
    console.log(`✅ Cuenta guardada: ${nuevaCuenta.usuario}`);
  } catch (err) {
    console.error('❌ Error guardando cuenta:', err.message);
  }
}

module.exports = { guardarCuenta };
