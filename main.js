// main.js - Lanzador paralelo de cuentas (KraveAI)

const { Worker } = require('worker_threads');
const path = require('path');

const cantidad = parseInt(process.argv[2]) || 1;
let completadas = 0;
let activas = 0;
let errores = 0;

function lanzarWorker(i) {
  const worker = new Worker(path.resolve(__dirname, 'crearCuentaInstagram.js'));

  activas++;

  worker.on('message', (msg) => {
    if (msg.exito) {
      console.log(`✅ Cuenta #${i + 1} creada: ${msg.usuario}`);
    } else {
      errores++;
      console.log(`⚠️ Fallo en cuenta #${i + 1}: ${msg.error}`);
    }
  });

  worker.on('error', (err) => {
    errores++;
    console.error(`❌ Error interno en worker #${i + 1}:`, err);
  });

  worker.on('exit', (code) => {
    completadas++;
    activas--;
    if (completadas === cantidad) {
      console.log(`🎉 Completadas: ${completadas} | Errores: ${errores}`);
      process.exit(0);
    }
  });
}

console.log(`🚀 Iniciando creación de ${cantidad} cuentas...`);
for (let i = 0; i < cantidad; i++) {
  setTimeout(() => lanzarWorker(i), i * 250); // Espaciado para proxies
}
