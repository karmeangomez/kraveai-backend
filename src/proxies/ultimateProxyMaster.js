import SwiftShadow from './swiftShadowLoader.js';
import fs from 'fs';
import path from 'path';

const ProxySources = {
  SwiftShadow: SwiftShadow
};

const proxiesPath = path.resolve('./src/proxies/proxies.json');

const UltimateProxyMaster = {
  async loadAllProxies() {
    const allProxies = [];

    // ✅ 1. Intentar cargar proxies reales desde proxies.json
    if (fs.existsSync(proxiesPath)) {
      try {
        const jsonData = fs.readFileSync(proxiesPath, 'utf-8');
        const proxiesFromFile = JSON.parse(jsonData);

        for (const proxy of proxiesFromFile) {
          const host = proxy.ip || proxy.host;
          const port = proxy.port;
          const fullProxy = `${host}:${port}`;

          if (!host || !port) continue;
          if (host.includes('127.') || host.includes('localhost') || host === '0.0.0.0') {
            console.warn(`⚠️ Proxy descartado por ser local: ${fullProxy}`);
            continue;
          }

          allProxies.push({
            source: 'LocalFile',
            proxy: fullProxy,
            ...(proxy.auth && { auth: `${proxy.auth.username}:${proxy.auth.password}` }),
            score: 100,
            latency: 100
          });
        }

        if (allProxies.length) {
          console.log(`✅ ${allProxies.length} proxies cargados desde proxies.json`);
          return allProxies;
        } else {
          console.warn('⚠️ proxies.json está vacío o no contiene proxies válidos.');
        }
      } catch (error) {
        console.error('❌ Error leyendo proxies.json:', error.message);
      }
    }

    // ✅ 2. Fallback: cargar de SwiftShadow si no hay proxies reales
    for (const [sourceName, source] of Object.entries(ProxySources)) {
      try {
        console.log(`🔍 Cargando proxies de ${sourceName}...`);
        const loader = source();
        await loader.initialize();

        for (let i = 0; i < 5; i++) {
          const proxy = loader.getProxy();
          const fullProxy = `${proxy.host}:${proxy.port}`;

          if (proxy.host.includes('127.') || proxy.host.includes('localhost') || proxy.host === '0.0.0.0') {
            console.warn(`⚠️ Proxy descartado por ser local: ${fullProxy}`);
            continue;
          }

          allProxies.push({
            source: sourceName,
            proxy: fullProxy,
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
  }
};

export default UltimateProxyMaster;
