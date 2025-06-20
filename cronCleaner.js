// cronCleaner.js
const fs = require('fs');
const path = require('path');

const DIRECTORIOS = {
  cookies: path.join(__dirname, 'cookies'),
  screenshots: path.join(__dirname, 'screenshots'),
  logs: path.join(__dirname, 'logs')
};

const ARCHIVO_CUENTAS = path.join(__dirname, 'cuentas_creadas.json');

const LIMPIAR_SHADOWBAN = true;
const DIAS_EXPIRACION = 3; // archivos mayores a 3 días se borran

function limpiarArchivosAntiguos(dir, dias) {
  const ahora = Date.now();
  const expiracion = dias * 24 * 60 * 60 * 1000;

  if (!fs.existsSync(dir)) return;

  fs.readdirSync(dir).forEach((file) => {
    const filePath = path.join(dir, file);
    const stats = fs.statSync(filePath);
    if ((ahora - stats.mtimeMs) > expiracion) {
      fs.unlinkSync(filePath);
      console.log(`🧹 Eliminado: ${filePath}`);
    }
  });
}

function limpiarCuentasFallidas() {
  if (!fs.existsSync(ARCHIVO_CUENTAS)) return;

  const cuentas = fs.readFileSync(ARCHIVO_CUENTAS, 'utf8')
    .split('\n')
    .filter(Boolean)
    .map(line => JSON.parse(line));

  const cuentasValidas = cuentas.filter(cuenta =>
    cuenta.status === 'success' && (!LIMPIAR_SHADOWBAN || !cuenta.shadowban)
  );

  fs.writeFileSync(ARCHIVO_CUENTAS, cuentasValidas.map(c => JSON.stringify(c)).join('\n') + '\n');
  console.log(`📁 Archivo de cuentas limpiado. Quedan: ${cuentasValidas.length}`);
}

function ejecutarLimpieza() {
  console.log(`🧹 Ejecutando limpieza (${DIAS_EXPIRACION} días de antigüedad)...\n`);
  Object.values(DIRECTORIOS).forEach(dir => limpiarArchivosAntiguos(dir, DIAS_EXPIRACION));
  limpiarCuentasFallidas();
  console.log('✅ Limpieza completa\n');
}

ejecutarLimpieza();
