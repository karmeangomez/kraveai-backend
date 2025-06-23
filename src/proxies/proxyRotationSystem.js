const ultimateProxyMaster = require('./ultimateProxyMaster');

class ProxyRotationSystem {
  constructor() {
    this.validProxies = [];
    this.currentIndex = 0;
  }

  async initialize() {
    this.validProxies = await ultimateProxyMaster.loadAllProxies();
    console.log(`✅ ${this.validProxies.length} proxies válidos cargados`);
  }

  getNextProxy() {
    if (this.validProxies.length === 0) throw new Error('No hay proxies disponibles');
    
    const proxy = this.validProxies[this.currentIndex];
    this.currentIndex = (this.currentIndex + 1) % this.validProxies.length;
    
    return proxy;
  }
}

module.exports = new ProxyRotationSystem();
