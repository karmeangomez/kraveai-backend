const blacklistedProxies = new Set();

export const isProxyBlacklisted = (proxy) => {
  if (!proxy || !proxy.ip) return false;
  const key = `${proxy.ip}:${proxy.port}`;
  return blacklistedProxies.has(key);
};

export const addToBlacklist = (proxy) => {
  if (!proxy || !proxy.ip) {
    console.error('❌ Proxy inválido para añadir a blacklist:', proxy);
    return;
  }
  
  const key = `${proxy.ip}:${proxy.port}`;
  blacklistedProxies.add(key);
  console.log(`⛔ Proxy añadido a blacklist: ${key}`);
};

export const removeFromBlacklist = (proxy) => {
  if (!proxy || !proxy.ip) return;
  
  const key = `${proxy.ip}:${proxy.port}`;
  blacklistedProxies.delete(key);
  console.log(`✅ Proxy removido de blacklist: ${key}`);
};

export const getBlacklistedCount = () => blacklistedProxies.size;
