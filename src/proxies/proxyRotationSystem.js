import UltimateProxyMaster from './ultimateProxyMaster.js';
import axios from 'axios';

class ProxyRotationSystem {
  constructor() {
    this.proxyStats = new Map();
    this.blacklist = new Set();
    this.healthCheckInterval = null;
    this.config = {
      MAX_FAILS: 3,
      HEALTH_CHECK_INTERVAL: 300000, // 5 minutos
      REQUEST_TIMEOUT: 10000,
      MAX_RETRIES: 2
    };
  }

  async initHealthChecks() {
    // No necesitamos health checks adicionales ya que los proxies ya fueron verificados
    console.log('🔍 Proxies ya verificados durante la inicialización');
  }

  getBestProxy() {
    const workingProxies = UltimateProxyMaster.getWorkingProxies();
    
    if (workingProxies.length === 0) {
      throw new Error('No hay proxies disponibles');
    }
    
    // Seleccionar proxy con menos uso
    const proxyStats = Array.from(this.proxyStats.entries());
    const leastUsed = proxyStats.sort((a, b) => a[1].usageCount - b[1].usageCount)[0];
    
    return leastUsed ? 
      UltimateProxyMaster.getProxy(leastUsed[0]) : 
      UltimateProxyMaster.getProxy(workingProxies[0]);
  }

  recordFailure(proxyString) {
    if (!this.proxyStats.has(proxyString)) {
      this.proxyStats.set(proxyString, {
        usageCount: 0,
        failures: 0,
        successes: 0
      });
    }
    
    const stats = this.proxyStats.get(proxyString);
    stats.failures++;
    stats.usageCount++;
    
    if (stats.failures >= this.config.MAX_FAILS) {
      this.blacklist.add(proxyString);
      console.warn(`🚫 Proxy añadido a blacklist: ${proxyString}`);
    }
  }

  recordSuccess(proxyString) {
    if (!this.proxyStats.has(proxyString)) {
      this.proxyStats.set(proxyString, {
        usageCount: 0,
        failures: 0,
        successes: 0
      });
    }
    
    const stats = this.proxyStats.get(proxyString);
    stats.successes++;
    stats.usageCount++;
  }
}

const proxySystem = new ProxyRotationSystem();
export default proxySystem;
