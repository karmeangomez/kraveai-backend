const { Worker } = require('worker_threads');
const proxies = require('./proxies.json'); // Asegúrate de que este archivo exista
const path = require('path');
const logger = require('./logger');

const WORKERS = 4; // Número de hilos paralelos
const CHUNK_SIZE = Math.ceil(proxies.length / WORKERS);

for (let i = 0; i < WORKERS; i++) {
  const workerProxies = proxies.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE);
  
  new Worker(path.join(__dirname, 'crearCuentaInstagramWorker.js'), {
    workerData: { proxies: workerProxies, workerId: i + 1 }
  });
}
