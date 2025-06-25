import SwiftShadow from './swiftshadow/swiftShadowLoader.js';

const ProxySources = {
  SwiftShadow: SwiftShadow
};

const UltimateProxyMaster = {
  async loadAllProxies() {
    try {
      const allProxies = [];
      for (const [sourceName, source] of Object.entries(ProxySources)) {
        try {
          console.log(`🔍 Cargando proxies de ${sourceName}...`);
          const loader = source();
          await loader.initialize();
          for (let i = 0; i < 5; i++) {
            const proxy = loader.getProxy();
            allProxies.push({
              source: sourceName,
              proxy: `${proxy.host}:${proxy.port}`,
              ...(proxy.auth && {
                auth: `${proxy.auth.username}:${proxy.auth.password}`
              }),
              score: 80,
              latency: Math.floor(Math.random() * 300) + 100
            });
          }
        } catch (error) {
          console.error(`⚠️ Error cargando ${sourceName}: ${error.message}`);
        }
      }
      return allProxies;
    } catch (error) {
      console.error('🔥 Error crítico en loadAllProxies:', error);
      return [];
    }
  }
};

export default UltimateProxyMaster;
