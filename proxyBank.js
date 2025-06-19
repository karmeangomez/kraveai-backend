// proxyBank.js - rotador de proxies autenticados con http://

const proxies = require('./proxies.json');
let index = 0;

function getNextProxy() {
  if (!proxies.length) {
    console.warn('⚠️ Lista de proxies vacía');
    return null;
  }

  const raw = proxies[index % proxies.length];
  index++;

  // Devuelve el proxy con prefijo http:// requerido por proxy-chain
  return `http://${raw}`;
}

module.exports = { getNextProxy };
