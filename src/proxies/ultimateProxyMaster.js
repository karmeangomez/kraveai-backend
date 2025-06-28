// 📁 src/proxies/ultimateProxyMaster.js
import fs from 'fs';
import path from 'path';
import ProxyRotationSystem from './proxyRotationSystem.js';
import { isProxyBlacklisted } from './proxyBlacklistManager.js';

export default class UltimateProxyMaster extends ProxyRotationSystem {
  constructor() {
    const proxies = UltimateProxyMaster.loadProxies();
    super(proxies); // 👈 Herencia correctamente inicializada
  }

  static loadProxies() {
    try {
      const filePath = path.resolve('src/proxies/proxies.json');
      const data = fs.readFileSync(filePath, 'utf-8');
      const proxies = JSON.parse(data);
      return proxies.filter(p => !isProxyBlacklisted(p));
    } catch (err) {
      console.error('❌ Error cargando proxies:', err.message);
      return [];
    }
  }

  async initialize() {
    await super.initialize();
    this.resetRotation();
    console.log(`✅ ${this.proxies.length} proxies válidos cargados`);
    return true;
  }
}
