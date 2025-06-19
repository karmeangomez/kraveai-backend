// runCrearCuentaConProxy.js - Ejecuta múltiples cuentas usando proxies rotativos

const { getNextProxy } = require('./proxyBank');
const { exec } = require('child_process');

const TOTAL = parseInt(process.argv[2], 10) || 20;

console.log(`🚀 Creando ${TOTAL} cuentas con proxies reales...\n`);

let count = 0;

async function crearCuenta() {
  return new Promise(resolve => {
    const proxy = getNextProxy();

    if (!proxy) {
      console.log('⚠️ No hay proxy disponible, se omite intento.\n');
      resolve();
      return;
    }

    console.log(`🔁 Proxy usado: ${proxy.replace('http://', '')}`);

    const proceso = exec(`node crearCuentaInstagram.js "${proxy}"`);

    let stdoutBuffer = '';
    proceso.stdout.on('data', data => {
      stdoutBuffer += data;
      try {
        const result = JSON.parse(stdoutBuffer);
        if (result.status === 'success') {
          console.log(`✅ Cuenta creada: @${result.usuario} (${result.email})`);
        } else {
          console.log(`❌ Falló: ${result.error || 'Error desconocido'}`);
        }
        resolve();
      } catch {
        // Esperar a que termine el JSON completo
      }
    });

    proceso.stderr.on('data', err => {
      console.log(`❌ Error de ejecución: ${err}`);
      resolve();
    });

    proceso.on('exit', code => {
      if (code !== 0) {
        console.log(`⚠️ Proceso finalizó con código ${code}`);
      }
    });
  });
}

(async () => {
  for (let i = 0; i < TOTAL; i++) {
    await crearCuenta();
    count++;
  }
  console.log(`🎉 Proceso finalizado. Total intentos: ${count}`);
})();
