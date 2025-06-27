// proxyBlacklistManager.js

const blacklistedProxies = new Set();
const failureCounts = new Map();

const getProxyKey = (proxy) => {
  if (typeof proxy === 'string') return proxy;
  return `${proxy.ip}:${proxy.port}`;
};

export const isProxyBlacklisted = (proxy) => {
  const key = getProxyKey(proxy);
  return blacklistedProxies.has(key);
};

export const addToBlacklist = (proxy) => {
  const key = getProxyKey(proxy);
  blacklistedProxies.add(key);
  console.log(`🚨 Proxy añadido a la blacklist: ${key}`);
};

export const markFailure = (proxy) => {
  const key = getProxyKey(proxy);
  const current = failureCounts.get(key) || 0;
  failureCounts.set(key, current + 1);

  if (failureCounts.get(key) >= 3) {
    addToBlacklist(proxy);
  }
};

export const resetFailure = (proxy) => {
  const key = getProxyKey(proxy);
  failureCounts.delete(key);
};
