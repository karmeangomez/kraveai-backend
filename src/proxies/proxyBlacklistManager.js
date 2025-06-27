// src/proxies/proxyBlacklistManager.js
const blacklistedProxies = new Set();

export function isProxyBlacklisted(proxy) {
  return blacklistedProxies.has(`${proxy.ip}:${proxy.port}`);
}

export function addToBlacklist(proxy) {
  const key = `${proxy.ip}:${proxy.port}`;
  blacklistedProxies.add(key);
  console.log(`⛔ Añadido a la blacklist: ${key}`);
}

export function clearBlacklist() {
  blacklistedProxies.clear();
  console.log('✅ Blacklist limpiada');
}

export function getBlacklist() {
  return Array.from(blacklistedProxies);
}
