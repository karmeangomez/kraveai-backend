import UltimateProxyMaster from './ultimateProxyMaster.js';

class ProxyRotationSystem {
  constructor() {
    this.validProxies = [];
    this.currentIndex = 0;
  }

  async initialize() {
    if (this.validProxies.length > 0) return;
    
    console.log('⚙️ Inicializando sistema de proxies...');
    
    try {
      this.validProxies = await UltimateProxyMaster.loadAllProxies();
      
      if (this.validProxies.length === 0) {
        console.warn('⚠️ No se cargaron proxies. Usando respaldo local');
        this.validProxies = [{
          proxy: 'localhost:8080',
          score: 80,
          latency: 150
        }];
      }
      
      console.log(`✅ ${this.validProxies.length} proxies disponibles`);
    } catch (error) {
      console.error('🔥 Error crítico inicializando proxies:', error);
      this.validProxies = [{
        proxy: 'localhost:8080',
        score: 80,
        latency: 150
      }];
    }
  }

  getNextProxy() {
    if (this.validProxies.length === 0) {
      return {
        proxy: 'localhost:8080',
        score: 80,
        latency: 150
      };
    }
    
    const proxy = this.validProxies[this.currentIndex];
    this.currentIndex = (this.currentIndex + 1) % this.validProxies.length;
    
    return {
      ...proxy,
      ip: proxy.proxy.split(':')[0]
    };
  }
}

// Singleton
const proxySystem = new ProxyRotationSystem();
export default proxySystem;
