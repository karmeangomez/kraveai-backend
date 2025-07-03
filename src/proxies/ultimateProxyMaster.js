import fs from 'fs';
import path from 'path';
import ProxyRotationSystem from './proxyRotationSystem.js';
import WebshareProxyManager from './webshareApi.js';
import SwiftShadowLoader from './swiftShadowLoader.js';
import MultiProxiesRunner from './multiProxiesRunner.js';

const PROXIES_VALIDATED_PATH = path.resolve('src/proxies/proxies_validados.json');

export default class UltimateProxyMaster extends ProxyRotationSystem {
  constructor() {
    super([]);
  }

  async initialize(forceRefresh = false) {
    let proxies = [];

    // Si no se fuerza actualización, usar archivo cacheado
    if (!forceRefresh && fs.existsSync(PROXIES_VALIDATED_PATH)) {
      const data = fs.readFileSync(PROXIES_VALIDATED_PATH, 'utf-8');
      proxies = JSON.parse(data);
      console.log(`📦 Cargando ${proxies.length} proxies validados desde proxies_validados.json`);
    } else {
      // Webshare
      console.log('🔄 Actualizando proxies desde Webshare...');
      const webshareProxies = await WebshareProxyManager.getProxies(true);
      console.log(`✅ ${webshareProxies.length} proxies actualizados`);

      // SwiftShadow
      console.log('🕵️‍♂️ Cargando proxies desde SwiftShadow...');
      const swiftProxies = await SwiftShadowLoader.getProxies();
      console.log(`✅ ${swiftProxies.length} proxies públicos cargados desde SwiftShadow`);

      // MultiProxies
      console.log('🌐 Fetching proxies from multiProxies (public sources)...');
      const multiProxies = await MultiProxiesRunner.getProxies();
      console.log(`✅ ${multiProxies.length} proxies públicos convertidos correctamente`);

      proxies = [...webshareProxies, ...swiftProxies, ...multiProxies];
    }

    this.proxies = proxies;
    await super.initialize();
    this.resetRotation();

    console.log(`♻️ ${this.proxies.length} proxies activos cargados`);
    return true;
  }

  async refreshProxies() {
    return this.initialize(true); // forzar actualización completa
  }

  static async loadAllProxies() {
    const data = fs.readFileSync(PROXIES_VALIDATED_PATH, 'utf-8');
    return JSON.parse(data);
  }
}
