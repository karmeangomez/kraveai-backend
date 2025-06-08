// proxyBank.js - Manejo inteligente de proxies desde PROXY_LIST
const proxies = process.env.PROXY_LIST?.split(';').map(p => p.trim()).filter(Boolean) || [];

let index = 0;

function getNextProxy() {
  if (proxies.length === 0) {
    console.warn('⚠️ No hay proxies definidos en PROXY_LIST');
    return null;
  }

  const proxy = proxies[index % proxies.length];
  index++;
  console.log(`🔁 Usando proxy [${index}/${proxies.length}]: ${proxy}`);
  return proxy;
}

module.exports = {
  getNextProxy,
  proxyCount: proxies.length
};
