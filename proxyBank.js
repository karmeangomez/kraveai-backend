// proxyBank.js - rotador de proxies con prefijo http:// para proxy-chain

const proxies = require('./proxies.json');
let index = 0;

function getNextProxy() {
  if (!proxies.length) {
    console.warn('⚠️ Lista de proxies vacía');
    return null;
  }

  const raw = proxies[index % proxies.length];
  index++;

  // Asegurar que comience con http://
  return raw.startsWith('http://') ? raw : `http://${raw}`;
}

module.exports = { getNextProxy };
