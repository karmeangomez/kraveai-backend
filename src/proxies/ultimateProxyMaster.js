// src/proxies/ultimateProxyMaster.js
import fs from 'fs';
import path from 'path';
import ProxyRotationSystem from './proxyRotationSystem.js';
import WebshareProxyManager from './webshareApi.js';
import loadSwiftShadowProxies from './swiftShadowLoader.js';
import runMultiProxies from './multiProxiesRunner.js';

const PROXIES_VALIDATED_PATH = path.resolve('src/proxies/proxies_validados.json');

export default class UltimateProxyMaster extends ProxyRotationSystem {
  constructor() {
    super([]);
  }

  async initialize(forceRefresh = false) {
    let proxies = [];

    // 1. Intenta cargar los proxies validados
    if (!forceRefresh && fs.existsSync(PROXIES_VALIDATED_PATH)) {
      const data = fs.readFileSync(PROXIES_VALIDATED_PATH, 'utf-8');
      proxies = JSON.parse(data);
      console.log(`📦 Cargando ${proxies.length} proxies validados desde proxies_validados.json`);
    } else {
      // 2. Obtener de Webshare
      const webshareProxies = await WebshareProxyManager.getProxies(true);
      // 3. Obtener de fuentes públicas
      const swiftProxies = await loadSwiftShadowProxies();
      const multiProxies = await runMultiProxies();

      proxies = [
        ...webshareProxies,
        ...swiftProxies,
        ...multiProxies
      ];

      if (proxies.length === 0) throw new Error('No se pudieron obtener proxies');
    }

    this.proxies = proxies;
    await super.initialize();
    this.resetRotation();

    console.log(`♻️ ${this.proxies.length} proxies activos cargados`);
    return true;
  }

  async refreshProxies() {
    const webshareProxies = await WebshareProxyManager.refreshProxies();
    const swiftProxies = await loadSwiftShadowProxies();
    const multiProxies = await runMultiProxies();

    this.proxies = [
      ...webshareProxies,
      ...swiftProxies,
      ...multiProxies
    ];

    this.resetRotation();
    this.stats = {
      totalRequests: 0,
      successCount: 0,
      failCount: 0
    };
    console.log(`🔄 Proxies actualizados: ${this.proxies.length} disponibles`);
  }
}
