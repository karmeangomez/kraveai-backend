// src/proxies/proxyRotationSystem.js
import UltimateProxyMaster from './ultimateProxyMaster.js';

class ProxyRotationSystem {
  constructor() {
    this.validProxies = [];
    this.currentIndex = 0;
  }

  async initialize() {
    // Cargar todos los proxies usando UltimateProxyMaster
    this.validProxies = await UltimateProxyMaster.loadAllProxies();
    console.log(`✅ ${this.validProxies.length} proxies válidos cargados`);
  }

  getNextProxy() {
    if (this.validProxies.length === 0) {
      throw new Error('No hay proxies disponibles. Ejecuta initialize() primero.');
    }
    
    const proxy = this.validProxies[this.currentIndex];
    this.currentIndex = (this.currentIndex + 1) % this.validProxies.length;
    
    return {
      proxy: proxy.proxy, // String en formato "ip:port:user:pass" o "ip:port"
      score: proxy.score,
      latency: proxy.latency
    };
  }
}

// Exportamos una instancia única (singleton)
const proxySystem = new ProxyRotationSystem();
export default proxySystem;
