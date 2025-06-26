// src/proxies/proxyRotationSystem.js
import UltimateProxyMaster from './ultimateProxyMaster.js';
import { isProxyBlacklisted } from './proxyBlacklistManager.js';
import { getGeo } from '../utils/geoUtils.js';

class ProxyRotationSystem {
  constructor() {
    this.validProxies = [];
    this.currentIndex = 0;
    this.initialized = false;
  }

  async initialize() {
    if (this.initialized) return;

    const rawProxies = await UltimateProxyMaster.loadAllProxies();
    const enriched = [];

    for (const proxy of rawProxies) {
      if (isProxyBlacklisted(proxy.proxy)) {
        console.warn(`🚫 Proxy ignorado (blacklist): ${proxy.proxy}`);
        continue;
      }

      try {
        const ip = proxy.proxy.split(':')[0];
        const geo = await getGeo(ip);
        enriched.push({
          ...proxy,
          country: geo.country,
          region: geo.region,
          city: geo.city
        });
      } catch {
        enriched.push({ ...proxy, country: 'XX', region: 'Unknown', city: 'Unknown' });
      }
    }

    this.validProxies = enriched;
    this.initialized = true;
    console.log(`✅ ${this.validProxies.length} proxies válidos cargados con geolocalización`);
  }

  getNextProxy() {
    if (!this.initialized) throw new Error('No inicializado');
    if (!this.validProxies.length) throw new Error('No hay proxies disponibles');

    const proxy = this.validProxies[this.currentIndex];
    this.currentIndex = (this.currentIndex + 1) % this.validProxies.length;
    return proxy;
  }

  getProxyCount() {
    return this.validProxies.length;
  }
}

const proxySystem = new ProxyRotationSystem();
export default proxySystem;
