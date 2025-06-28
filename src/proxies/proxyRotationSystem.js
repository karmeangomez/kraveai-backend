// 📁 src/proxies/proxyRotationSystem.js
export default class ProxyRotationSystem {
  constructor(proxies = []) {
    this.proxies = proxies;
    this.currentIndex = 0;
    this.badProxies = new Set();
  }

  async initialize() {
    console.log(`🔄 Inicializando ${this.proxies.length} proxies...`);
    return true;
  }

  getNextProxy() {
    if (!this.proxies.length) return null;

    for (let i = 0; i < this.proxies.length; i++) {
      const index = (this.currentIndex + i) % this.proxies.length;
      const proxy = this.proxies[index];
      const key = `${proxy.ip}:${proxy.port}`;

      if (!this.badProxies.has(key)) {
        this.currentIndex = (index + 1) % this.proxies.length;
        return proxy;
      }
    }

    return null; // Todos bloqueados
  }

  markProxyAsBad(proxy) {
    const key = `${proxy.ip}:${proxy.port}`;
    this.badProxies.add(key);
    console.log(`⛔ Añadido a la blacklist: ${key}`);
  }

  resetRotation() {
    this.badProxies.clear();
    this.currentIndex = 0;
    console.log('🔁 Rotación reiniciada');
  }
}
