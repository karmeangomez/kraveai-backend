// 📁 src/proxies/ultimateProxyMaster.js
import fs from 'fs';
import path from 'path';
import ProxyRotationSystem from './proxyRotationSystem.js';
import { isProxyBlacklisted } from './proxyBlacklistManager.js';

export default class UltimateProxyMaster extends ProxyRotationSystem {
  constructor() {
    let proxies = [];

    try {
      const data = fs.readFileSync(path.resolve('proxies.json'), 'utf-8');
      proxies = JSON.parse(data).filter(p => !isProxyBlacklisted(p));
      console.log(`✅ ${proxies.length} proxies cargados desde proxies.json`);
    } catch (err) {
      console.error('❌ Error leyendo proxies.json:', err.message);
    }

    super(proxies);
  }

  async initialize() {
    this.resetRotation(); // Reiniciar blacklist
    return true;
  }
}
