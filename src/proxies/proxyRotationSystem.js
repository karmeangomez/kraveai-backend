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
    if (!this.proxies || this.proxies.length === 0) {
      throw new Error('No hay proxies disponibles');
    }

    let startIndex = this.currentIndex;
    do {
      const proxy = this.proxies[this.currentIndex];
      this.currentIndex = (this.currentIndex + 1) % this.proxies.length;

      if (!this.badProxies.has(this._formatProxyKey(proxy))) {
        return proxy;
      }

    } while (this.currentIndex !== startIndex);

    return null; // Todos están en blacklist
  }

  markProxyAsBad(proxy) {
    const key = this._formatProxyKey(proxy);
    this.badProxies.add(key);
    console.log(`⛔ Añadido a la blacklist: ${key}`);
  }

  resetRotation() {
    this.currentIndex = 0;
    this.badProxies.clear();
    console.log('🔁 Rotación reiniciada');
  }

  _formatProxyKey(proxy) {
    return `${proxy.ip}:${proxy.port}`;
  }
}
