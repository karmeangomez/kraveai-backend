import fs from 'fs';
import path from 'path';
import ProxyRotationSystem from './proxyRotationSystem.js';
import WebshareProxyManager from './webshareApi.js';

const PROXIES_VALIDATED_PATH = path.resolve('src/proxies/proxies_validados.json');

export default class UltimateProxyMaster extends ProxyRotationSystem {
  constructor() {
    super([]);
  }

  async initialize(forceRefresh = false) {
    let proxies = [];

    // Si existen proxies validados y no se fuerza actualización, usarlos
    if (!forceRefresh && fs.existsSync(PROXIES_VALIDATED_PATH)) {
      const data = fs.readFileSync(PROXIES_VALIDATED_PATH, 'utf-8');
      proxies = JSON.parse(data);
      console.log(`📦 Cargando ${proxies.length} proxies validados desde proxies_validados.json`);
    } else {
      proxies = await WebshareProxyManager.getProxies(forceRefresh);
      if (proxies.length === 0) throw new Error('No se pudieron obtener proxies de Webshare');
    }

    this.proxies = proxies;
    await super.initialize();
    this.resetRotation();

    console.log(`♻️ ${this.proxies.length} proxies activos cargados`);
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
