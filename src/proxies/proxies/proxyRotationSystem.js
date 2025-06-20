// src/proxies/proxyRotationSystem.js
import UltimateProxyMaster from './ultimateProxyMaster.js';

class ProxyRotationSystem {
  constructor() {
    this.proxyStats = {};
    this.failedProxies = new Set();
    this.MAX_FAILS = 3; // Máximo de fallos antes de deshabilitar proxy
    this.HEALTH_CHECK_INTERVAL = 300000; // 5 minutos
    this.initHealthChecks();
  }

  initHealthChecks() {
    setInterval(() => this.checkPremiumProxies(), this.HEALTH_CHECK_INTERVAL);
  }

  async checkPremiumProxies() {
    const premiumProxies = UltimateProxyMaster.proxySources.premium;
    
    for (const proxyStr of premiumProxies) {
      const proxy = UltimateProxyMaster.formatProxy(proxyStr, 'premium');
      
      try {
        const health = await this.testProxy(proxy);
        this.recordHealth(proxy.string, health);
      } catch (error) {
        console.error(`Error probando proxy ${proxy.string}: ${error.message}`);
      }
    }
  }

  async testProxy(proxy) {
    try {
      const start = Date.now();
      await axios.get('https://www.instagram.com', {
        proxy: {
          host: proxy.ip,
          port: proxy.port,
          ...(proxy.auth ? {
            auth: {
              username: proxy.auth.username,
              password: proxy.auth.password
            }
          } : {})
        },
        timeout: 5000
      });
      return {
        status: 'active',
        responseTime: Date.now() - start
      };
    } catch (error) {
      return {
        status: 'inactive',
        error: error.message
      };
    }
  }

  recordHealth(proxyString, result) {
    if (!this.proxyStats[proxyString]) {
      this.proxyStats[proxyString] = { success: 0, fail: 0 };
    }

    if (result.status === 'active') {
      this.proxyStats[proxyString].success++;
      this.failedProxies.delete(proxyString);
    } else {
      this.proxyStats[proxyString].fail++;
      
      if (this.proxyStats[proxyString].fail >= this.MAX_FAILS) {
        this.failedProxies.add(proxyString);
      }
    }
  }

  getBestProxy() {
    const premiumProxies = UltimateProxyMaster.proxySources.premium
      .map(p => UltimateProxyMaster.formatProxy(p, 'premium'))
      .filter(p => !this.failedProxies.has(p.string));

    // Ordenar por éxito reciente
    premiumProxies.sort((a, b) => {
      const statsA = this.proxyStats[a.string] || { success: 0, fail: 1 };
      const statsB = this.proxyStats[b.string] || { success: 0, fail: 1 };
      
      const ratioA = statsA.success / (statsA.success + statsA.fail);
      const ratioB = statsB.success / (statsB.success + statsB.fail);
      
      return ratioB - ratioA;
    });

    return premiumProxies.length > 0 ? premiumProxies[0] : null;
  }
}

export default new ProxyRotationSystem();
