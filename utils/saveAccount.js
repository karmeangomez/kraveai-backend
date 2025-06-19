// saveAccount.js - Guardar cuentas generadas en JSON persistente

const fs = require('fs');
const path = require('path');

const archivo = path.join(__dirname, 'cuentas_creadas.json');

function guardarCuenta(cuenta) {
  let cuentas = [];

  try {
    if (fs.existsSync(archivo)) {
      const data = fs.readFileSync(archivo, 'utf8');
      cuentas = JSON.parse(data);
    }
  } catch (err) {
    console.error('⚠️ Error leyendo cuentas existentes:', err.message);
  }

  cuentas.push(cuenta);

  try {
    fs.writeFileSync(archivo, JSON.stringify(cuentas, null, 2), 'utf8');
  } catch (err) {
    console.error('❌ Error guardando cuenta:', err.message);
  }
}

module.exports = { guardarCuenta };
