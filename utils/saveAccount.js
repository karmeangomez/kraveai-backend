const fs = require('fs');
const path = require('path');

const rutaArchivo = path.join(__dirname, '../cuentas_creadas.json');

function guardarCuenta(cuenta) {
  try {
    let cuentas = [];
    if (fs.existsSync(rutaArchivo)) {
      const contenido = fs.readFileSync(rutaArchivo, 'utf8');
      cuentas = JSON.parse(contenido);
    }
    cuentas.push(cuenta);
    fs.writeFileSync(rutaArchivo, JSON.stringify(cuentas, null, 2));
    console.log(`📝 Cuenta guardada: ${cuenta.usuario}`);
  } catch (err) {
    console.error('❌ Error guardando cuenta:', err.message);
  }
}

module.exports = { guardarCuenta };
