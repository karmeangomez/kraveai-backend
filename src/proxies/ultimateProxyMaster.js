import ProxyRotationSystem from './proxyRotationSystem.js';
import WebshareProxyManager from './webshareApi.js';

export default class UltimateProxyMaster extends ProxyRotationSystem {
  constructor() {
    super([]); // Iniciar vacío
  }

  async initialize(forceRefresh = false) {
    // Obtener proxies de Webshare
    const proxies = await WebshareProxyManager.getProxies(forceRefresh);
    
    if (proxies.length === 0) {
      throw new Error('No se pudieron obtener proxies de Webshare');
    }

    this.proxies = proxies;
    await super.initialize();
    this.resetRotation();
    
    console.log(`♻️ ${this.proxies.length} proxies de Webshare activos`);
    return true;
  }

  async refreshProxies() {
    this.proxies = await WebshareProxyManager.refreshProxies();
    this.resetRotation();
    this.stats = {
      totalRequests: 0,
      successCount: 0,
      failCount: 0
    };
    console.log(`🔄 Proxies actualizados: ${this.proxies.length} disponibles`);
  }
}
