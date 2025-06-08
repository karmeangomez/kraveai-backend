const fs = require('fs');
const path = require('path');

const PROXY_FILE = path.join(__dirname, 'proxies.txt');
let proxies = [];
let index = 0;

// Cargar proxies desde el archivo
function loadProxyList() {
  try {
    const data = fs.readFileSync(PROXY_FILE, 'utf8');
    proxies = data
      .split('\n')
      .map(p => p.trim())
      .filter(p => p && !p.startsWith('#'));
    console.log(`🌀 ${proxies.length} proxies cargados desde proxies.txt`);
  } catch (err) {
    console.error('⚠️ No se pudo cargar proxies.txt:', err.message);
  }
}

// Obtener el siguiente proxy disponible (rotativo)
function getNextProxy() {
  if (proxies.length === 0) return null;
  const proxy = proxies[index % proxies.length];
  index++;
  return proxy;
}

// Cargar automáticamente al inicio
loadProxyList();

module.exports = {
  getNextProxy,
  loadProxyList
};
