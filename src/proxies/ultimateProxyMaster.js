import fs from 'fs';
import path from 'path';
import ProxyRotationSystem from './proxyRotationSystem.js';
import { isProxyBlacklisted } from './proxyBlacklistManager.js';

export default class UltimateProxyMaster extends ProxyRotationSystem {
  constructor() {
    const proxies = UltimateProxyMaster.loadProxies();
    super(proxies);
  }

  static loadProxies() {
    try {
      const filePath = path.resolve('src/proxies/proxies.json');
      const data = fs.readFileSync(filePath, 'utf-8');
      const proxies = JSON.parse(data);
      
      console.log(`✅ ${proxies.length} proxies cargados desde proxies.json`);
      return proxies.filter(p => !isProxyBlacklisted(p));
    } catch (err) {
      console.error('❌ Error cargando proxies:', err.message);
      return [];
    }
  }

  async initialize() {
    await super.initialize();
    this.resetRotation();
    console.log(`🔁 ${this.getActiveProxies().length} proxies activos`);
    return true;
  }
}
