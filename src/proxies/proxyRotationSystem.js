// src/proxies/proxyRotationSystem.js
export default class ProxyRotationSystem {
  constructor(proxies = []) {
    this.proxies = proxies;
    this.currentIndex = 0;
    this.badProxies = new Set();
  }

  getNextProxy() {
    if (!this.proxies.length) return null;

    let start = this.currentIndex;
    let attempts = 0;

    while (attempts < this.proxies.length) {
      const proxy = this.proxies[this.currentIndex];
      this.currentIndex = (this.currentIndex + 1) % this.proxies.length;

      const key = `${proxy.ip}:${proxy.port}`;
      if (!this.badProxies.has(key)) {
        return proxy;
      }

      attempts++;
    }

    console.warn('⚠️ Todos los proxies están en blacklist. Usando uno igualmente.');
    return this.proxies[start];
  }

  markProxyAsBad(proxy) {
    const key = `${proxy.ip}:${proxy.port}`;
    this.badProxies.add(key);
    console.log(`🚫 Proxy marcado como malo: ${key}`);
  }

  getGoodProxies() {
    return this.proxies.filter(p => !this.badProxies.has(`${p.ip}:${p.port}`));
  }

  resetBlacklist() {
    this.badProxies.clear();
  }
}
