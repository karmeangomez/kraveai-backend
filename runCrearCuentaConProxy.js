// runCrearCuentaConProxy.js
const { getNextProxy } = require('./proxyBank');
const { exec } = require('child_process');

const TOTAL = 20;

console.log(`🚀 Creando ${TOTAL} cuentas con proxies reales...\n`);

let count = 0;
async function crearCuenta() {
  return new Promise(resolve => {
    const proxy = getNextProxy();
    console.log(`🔁 Proxy usado: ${proxy.replace('http://', '')}`);
    const proceso = exec(`node crearCuentaInstagram.js "${proxy.replace('http://', '')}"`);
    proceso.stdout.on('data', d => {
      try {
        const j = JSON.parse(d);
        if (j.status === 'success') {
          console.log(`✅ Cuenta creada: @${j.usuario} (${j.email})`);
        } else {
          console.log(`❌ Falló: ${j.error}`);
        }
        resolve();
      } catch (e) {
        console.log(`⚠️ Salida inválida: ${d}`);
        resolve();
      }
    });
    proceso.stderr.on('data', e => {
      console.log(`❌ Error de ejecución: ${e}`);
      resolve();
    });
  });
}

(async () => {
  for (let i = 0; i < TOTAL; i++) {
    await crearCuenta();
    count++;
  }
  console.log(`🎉 Proceso finalizado. Total: ${count}`);
})();
