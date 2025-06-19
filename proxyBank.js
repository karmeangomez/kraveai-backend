// proxyBank.js - rotador de proxies con formato correcto para proxy-chain

const proxies = require('./proxies.json');

let index = 0;

function getNextProxy() {
  if (!Array.isArray(proxies) || proxies.length === 0) {
    console.warn('⚠️ No hay proxies disponibles en proxies.json');
    return null;
  }

  const rawProxy = proxies[index % proxies.length];
  index++;

  // Asegurar que tenga el formato correcto para proxy-chain
  return `http://${rawProxy}`;
}

module.exports = { getNextProxy };
