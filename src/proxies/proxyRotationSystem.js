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
      throw new Error('❌ No hay proxies disponibles');
    }

    for (let i = 0; i < this.proxies.length; i++) {
      const proxy = this.proxies[this.currentIndex];
      this.currentIndex = (this.currentIndex + 1) % this.proxies.length;

      const key = `${proxy.ip}:${proxy.port}`;
      if (!this.badProxies.has(key)) {
        console.log(`✅ Proxy seleccionado: ${key}`);
        return proxy;
      }
    }

    console.warn('⚠️ Todos los proxies están bloqueados. Usando primero como fallback.');
    return this.proxies[0]; // fallback
  }

  markProxyAsBad(proxy) {
    const key = `${proxy.ip}:${proxy.port}`;
    this.badProxies.add(key);
    console.log(`⛔ Añadido a la blacklist: ${key}`);
  }

  resetRotation() {
    this.currentIndex = 0;
    this.badProxies.clear();
    console.log('🔁 Rotación reiniciada');
  }
}
