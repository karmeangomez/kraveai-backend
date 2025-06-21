// src/proxies/proxyRotationSystem.js
import UltimateProxyMaster from './ultimateProxyMaster.js';
import axios from 'axios';

class ProxyRotationSystem {
  constructor() {
    this.proxyStats = new Map();
    this.blacklist = new Set();
    this.config = {
      MAX_FAILS: 3
    };
  }

  getBestProxy() {
    const available = UltimateProxyMaster.getWorkingProxies()
      .filter(p => !this.blacklist.has(p.string))
      .map(p => ({
        proxy: p,
        stats: this.proxyStats.get(p.string) || { usageCount: 0, failures: 0 },
        premium: UltimateProxyMaster.proxySources.premium.includes(p.string)
      }));

    if (available.length === 0) throw new Error('No hay proxies disponibles');

    return available.sort((a, b) => {
      if (a.premium !== b.premium) return b.premium - a.premium;
      return a.stats.failures - b.stats.failures || a.stats.usageCount - b.stats.usageCount;
    })[0].proxy;
  }

  recordFailure(proxyString) {
    const stats = this.proxyStats.get(proxyString) || { usageCount: 0, failures: 0 };
    stats.usageCount++;
    stats.failures++;
    this.proxyStats.set(proxyString, stats);

    if (stats.failures >= this.config.MAX_FAILS) {
      this.blacklist.add(proxyString);
      console.warn(`🚫 Proxy blacklisted: ${proxyString}`);
    }
  }

  recordSuccess(proxyString) {
    const stats = this.proxyStats.get(proxyString) || { usageCount: 0, failures: 0 };
    stats.usageCount++;
    this.proxyStats.set(proxyString, stats);
  }

  markProxyUsed(proxyString) {
    const stats = this.proxyStats.get(proxyString) || { usageCount: 0, failures: 0 };
    stats.usageCount++;
    this.proxyStats.set(proxyString, stats);
  }

  getProxyStats() {
    return {
      total: this.proxyStats.size,
      buenos: [...this.proxyStats.entries()].filter(([_, s]) => s.failures < this.config.MAX_FAILS).length,
      malos: this.blacklist.size
    };
  }

  async initHealthChecks() {
    console.log('🔄 Iniciando chequeos de salud de proxies...');
    const proxies = UltimateProxyMaster.getWorkingProxies();

    for (const proxy of proxies) {
      try {
        const response = await axios.get('http://httpbin.org/ip', {
          proxy: {
            host: proxy.ip,
            port: proxy.port,
            auth: proxy.auth || undefined
          },
          timeout: 5000
        });
        if (response.status === 200) {
          this.recordSuccess(proxy.string);
        } else {
          this.recordFailure(proxy.string);
        }
      } catch (err) {
        this.recordFailure(proxy.string);
      }
    }
  }
}

const proxyRotationSystem = new ProxyRotationSystem();
export default proxyRotationSystem;
