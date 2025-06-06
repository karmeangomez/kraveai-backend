// ✅ proxyBank.js - Banco de proxies Webshare con validación y rotación inteligente
const axios = require('axios');
const { HttpsProxyAgent } = require('https-proxy-agent');

let proxyPool = [];
let lastUsed = new Map();
let cooldown = 5 * 60 * 1000; // 5 minutos

function loadProxyList() {
  const rawList = process.env.PROXY_LIST;
  if (!rawList) return [];
  return rawList.split(';').map(p => p.trim()).filter(Boolean);
}

function isCoolingDown(proxy) {
  const last = lastUsed.get(proxy);
  return last && (Date.now() - last < cooldown);
}

async function validateProxy(proxy) {
  try {
    const agent = new HttpsProxyAgent(`http://${proxy}`);
    const res = await axios.get('https://www.instagram.com', {
      httpsAgent: agent,
      timeout: 5000
    });
    return res.status === 200;
  } catch {
    return false;
  }
}

async function getNextProxy() {
  if (proxyPool.length === 0) proxyPool = loadProxyList();
  for (const proxy of proxyPool) {
    if (isCoolingDown(proxy)) continue;
    const isValid = await validateProxy(proxy);
    if (isValid) {
      lastUsed.set(proxy, Date.now());
      return proxy;
    } else {
      console.warn(`❌ Proxy inválido: ${proxy}`);
      lastUsed.set(proxy, Date.now());
    }
  }
  throw new Error('No hay proxies válidos disponibles');
}

module.exports = {
  getNextProxy
};
