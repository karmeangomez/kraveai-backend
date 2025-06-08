// proxyBank.js
require('dotenv').config();
const fs = require('fs');

let proxies = [];
let index = 0;

// Carga los proxies desde el .env una sola vez
function loadProxies() {
  if (process.env.PROXY_LIST) {
    proxies = process.env.PROXY_LIST.split(';')
      .map(p => p.trim())
      .filter(p => p.includes('@') && p.includes(':'));
    console.log(`🌐 ${proxies.length} proxies cargados desde PROXY_LIST`);
  } else {
    console.warn('⚠️ No se encontró PROXY_LIST en el entorno');
  }
}

// Devuelve el siguiente proxy disponible, en forma de URL completa
function getNextProxy() {
  if (proxies.length === 0) loadProxies();
  if (proxies.length === 0) throw new Error('❌ No hay proxies válidos en PROXY_LIST');

  const proxy = proxies[index];
  index = (index + 1) % proxies.length;
  return `http://${proxy}`;
}

module.exports = { getNextProxy };
