// 📁 src/proxies/ultimateProxyMaster.js
import fs from 'fs';
import path from 'path';
import ProxyRotationSystem from './proxyRotationSystem.js';
import { isProxyBlacklisted } from './proxyBlacklistManager.js';

export default class UltimateProxyMaster extends ProxyRotationSystem {
  constructor() {
    super([]);
  }

  async initialize() {
    try {
      const data = fs.readFileSync(path.resolve('proxies.json'), 'utf-8');
      const parsed = JSON.parse(data);
      const filtered = parsed.filter(p => !isProxyBlacklisted(p));
      this.proxies = filtered;

      if (!filtered.length) {
        console.warn('⚠️ No se encontraron proxies válidos.');
      } else {
        console.log(`✅ ${filtered.length} proxies cargados desde proxies.json`);
      }
    } catch (err) {
      console.error('❌ Error leyendo proxies.json:', err.message);
    }
  }
}
