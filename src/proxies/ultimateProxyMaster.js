// 📁 src/proxies/ultimateProxyMaster.js
import fs from 'fs';
import path from 'path';
import ProxyRotationSystem from './proxyRotationSystem.js';
import { isProxyBlacklisted } from './proxyBlacklistManager.js';

export default class UltimateProxyMaster extends ProxyRotationSystem {
  constructor() {
    // ✅ Leer proxies de archivo y filtrar blacklist
    let proxies = [];
    try {
      const data = fs.readFileSync(path.resolve('src/proxies/proxies.json'), 'utf-8');
      proxies = JSON.parse(data).filter(p => !isProxyBlacklisted(p));
      console.log(`✅ ${proxies.length} proxies cargados desde proxies.json`);
    } catch (err) {
      console.error('❌ Error leyendo proxies.json:', err.message);
    }

    // ✅ Inicializar clase padre con proxies válidos
    super(proxies);
  }

  async initialize() {
    this.resetRotation(); // ✅ Limpia index y blacklist al iniciar
    return true;
  }
}
