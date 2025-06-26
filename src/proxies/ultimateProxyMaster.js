// src/proxies/ultimateProxyMaster.js
import SwiftShadow from './swiftShadowLoader.js';
import fs from 'fs';
import path from 'path';

const proxiesPath = path.resolve('./src/proxies/proxies.json');

const UltimateProxyMaster = {
  async loadAllProxies() {
    const allProxies = [];

    // 1. Cargar proxies reales
    if (fs.existsSync(proxiesPath)) {
      try {
        const jsonData = fs.readFileSync(proxiesPath, 'utf-8');
        const proxiesFromFile = JSON.parse(jsonData);

        for (const proxy of proxiesFromFile) {
          const host = proxy.ip || proxy.host;
          const port = proxy.port;
          const fullProxy = `${host}:${port}`;

          if (!host || !port) continue;
          if (host.includes('127.') || host.includes('localhost') || host === '0.0.0.0') continue;

          allProxies.push({
            source: 'LocalFile',
            proxy: fullProxy,
            ...(proxy.auth && { auth: proxy.auth }),
            score: 100,
            latency: 100
          });
        }
        console.log(`✅ ${allProxies.length} proxies cargados desde proxies.json`);
      } catch (err) {
        console.error('❌ Error leyendo proxies.json:', err.message);
      }
    }

    // 2. Fallback: SwiftShadow
    try {
      const loader = SwiftShadow();
      await loader.initialize();
      for (let i = 0; i < 5; i++) {
        const proxy = loader.getProxy();
        const fullProxy = `${proxy.host}:${proxy.port}`;
        if (proxy.host.includes('127.') || proxy.host.includes('localhost')) continue;
        allProxies.push({
          source: 'SwiftShadow',
          proxy: fullProxy,
          ...(proxy.auth && { auth: proxy.auth }),
          score: 80,
          latency: Math.floor(Math.random() * 300) + 100
        });
      }
    } catch (err) {
      console.error(`⚠️ Error cargando SwiftShadow: ${err.message}`);
    }

    // 3. Agregar proxy Tor
    allProxies.push({
      source: 'Tor',
      proxy: 'socks5://127.0.0.1:9050',
      tor: true,
      score: 50,
      latency: 500
    });

    return allProxies;
  }
};

export default UltimateProxyMaster;
