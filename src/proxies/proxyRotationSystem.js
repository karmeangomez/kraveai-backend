import UltimateProxyMaster from './ultimateProxyMaster.js';

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

    if (available.length === 0) throw new Error('❌ No hay proxies disponibles');

    return available.sort((a, b) => {
      // Prioriza proxies premium
      if (a.premium !== b.premium) return b.premium - a.premium;
      // Luego menos fallos y menos uso
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
}

const proxyRotationSystem = new ProxyRotationSystem();
export default proxyRotationSystem;
