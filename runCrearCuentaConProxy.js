// runCrearCuentaConProxy.js
const { getNextProxy } = require('./proxyBank');
const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);

const TOTAL = parseInt(process.argv[2], 10) || 5;

console.log(`🚀 Creando ${TOTAL} cuentas con proxies reales...\n`);

async function crearCuenta() {
  const proxy = getNextProxy();
  if (!proxy) {
    console.log('❌ Sin proxy válido, se salta este intento');
    return;
  }

  console.log(`🔁 Proxy usado: ${proxy.replace('http://', '')}`);
  try {
    const { stdout, stderr } = await execPromise(`node crearCuentaInstagram.js "${proxy}"`, { timeout: 120000 }); // 2 minutos de timeout
    const lines = stdout.trim().split('\n');
    const jsonLine = lines.find(line => line.startsWith('{') && line.endsWith('}'));
    
    if (jsonLine) {
      const account = JSON.parse(jsonLine);
      if (account.status === 'success') {
        console.log(`✅ Cuenta creada: @${account.usuario} (${account.email})`);
      } else {
        console.log(`❌ Falló: ${account.error}`);
      }
    } else {
      console.log(`⚠️ No se encontró JSON en la salida: ${stdout}`);
    }
    
    if (stderr) console.error(`⚠️ Errores en stderr: ${stderr}`);
  } catch (e) {
    console.error(`❌ Error al ejecutar el script: ${e.message}`);
  }
}

(async () => {
  let count = 0;
  for (let i = 0; i < TOTAL; i++) {
    await crearCuenta();
    count++;
    await delay(2000); // Retraso entre intentos
  }
  console.log(`🎉 Proceso finalizado. Total intentos: ${count}`);
})();

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
