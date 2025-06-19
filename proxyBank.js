// proxyBank.js
const proxies = require('./proxies.json');
let index = 0;

function getNextProxy() {
  if (!proxies.length) {
    console.warn('⚠️ Lista de proxies vacía');
    return null;
  }

  const raw = proxies[index % proxies.length];
  index++;

  // Validar formato: [username:password@]hostname:port
  const proxyRegex = /^(?:.+:.+@)?(?:\d{1,3}\.){3}\d{1,3}:\d+$/;
  if (!proxyRegex.test(raw)) {
    console.warn(`⚠️ Proxy inválido: ${raw}`);
    return getNextProxy();
  }

  const formattedProxy = raw.startsWith('http://') ? raw : `http://${raw}`;
  console.log(`🔍 Proxy generado: ${formattedProxy}`);
  return formattedProxy;
}

module.exports = { getNextProxy };
