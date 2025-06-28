import fs from 'fs';
import path from 'path';
import ProxyRotationSystem from './proxyRotationSystem.js';
import { isProxyBlacklisted } from './proxyBlacklistManager.js';

export default class UltimateProxyMaster extends ProxyRotationSystem {
  constructor() {
    // Cargar proxies primero
    const proxies = this.loadProxies();
    
    // Llamar al constructor padre con los proxies
    super(proxies);
    
    console.log(`✅ ${proxies.length} proxies válidos cargados`);
  }

  loadProxies() {
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
    this.resetRotation();
    console.log('🔁 Rotación reiniciada');
    return true;
  }

  // ⭐⭐ MÉTODO AÑADIDO ⭐⭐
  getProxyList() {
    return this.proxies.filter(proxy => {
      const key = `${proxy.ip}:${proxy.port}`;
      return !this.badProxies.has(key);
    });
  }
}
