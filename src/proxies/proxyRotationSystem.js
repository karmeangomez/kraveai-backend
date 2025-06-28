// 📁 src/proxies/proxyRotationSystem.js
export default class ProxyRotationSystem {
  constructor() {
    this.proxies = [];
    this.currentIndex = 0;
    this.badProxies = new Set();
  }

  async initialize(proxyArray) {
    this.proxies = proxyArray;
    this.currentIndex = 0;
    this.badProxies.clear();
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

      const key = this._formatProxyKey(proxy);
      if (!this.badProxies.has(key)) {
        return proxy;
      }

    } while (this.currentIndex !== startIndex);

    return null; // Todos en blacklist
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
    // Admite objetos del tipo { proxy: 'ip:puerto' } o { ip, port }
    if (proxy.proxy) return proxy.proxy;
    return `${proxy.ip}:${proxy.port}`;
  }
}
