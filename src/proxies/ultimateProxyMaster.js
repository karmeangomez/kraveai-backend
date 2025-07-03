import fs from 'fs';
import path from 'path';
import ProxyRotationSystem from './proxyRotationSystem.js';
import WebshareProxyManager from './webshareApi.js';
import { getProxies as loadSwiftShadowProxies } from './swiftShadowLoader.js';
import { getProxies as loadMultiProxies } from './multiProxiesRunner.js';
import { validateProxy } from '../utils/validator.js';

const PROXIES_VALIDATED_PATH = path.resolve('src/proxies/proxies_validados.json');

export default class UltimateProxyMaster extends ProxyRotationSystem {
  constructor() {
    super([]);
  }

  async initialize(forceRefresh = false) {
    let proxies = [];

    if (!forceRefresh && fs.existsSync(PROXIES_VALIDATED_PATH)) {
      const data = fs.readFileSync(PROXIES_VALIDATED_PATH, 'utf-8');
      proxies = JSON.parse(data);
      console.log(`📦 Cargando ${proxies.length} proxies validados desde proxies_validados.json`);
    } else {
      proxies = await this.getAllSourcesProxies();
      proxies = await this.filterValidProxies(proxies);

      if (proxies.length === 0) {
        console.warn('⚠️ Usando Tor como respaldo temporal');
        proxies = [{
          ip: '127.0.0.1',
          port: 9050,
          auth: null,
          type: 'socks5',
          country: 'TOR',
          lastUsed: 0,
          successCount: 0,
          failCount: 0
        }];
      }

      fs.writeFileSync(PROXIES_VALIDATED_PATH, JSON.stringify(proxies, null, 2));
      console.log(`💾 Guardado proxies válidos en proxies_validados.json`);
    }

    this.proxies = proxies;
    await super.initialize();
    this.resetRotation();
    console.log(`♻️ ${this.proxies.length} proxies activos cargados`);
    return true;
  }

  async refreshProxies() {
    console.log('🔄 Refrescando todos los proxies...');
    const proxies = await this.getAllSourcesProxies();
    const validos = await this.filterValidProxies(proxies);

    this.proxies = validos.length > 0 ? validos : this.proxies;
    this.resetRotation();
    this.stats = { totalRequests: 0, successCount: 0, failCount: 0 };

    if (validos.length > 0) {
      fs.writeFileSync(PROXIES_VALIDATED_PATH, JSON.stringify(validos, null, 2));
    }
    console.log(`🔁 Proxies validados y actualizados (${validos.length})`);
  }

  async getAllSourcesProxies() {
    console.log('🔍 Obteniendo proxies desde todas las fuentes...');
    const [webshare, swift, multi] = await Promise.allSettled([
      WebshareProxyManager.getProxies(),
      loadSwiftShadowProxies(),
      loadMultiProxies()
    ]);

    const all = [
      ...(webshare.status === 'fulfilled' ? webshare.value : []),
      ...(swift.status === 'fulfilled' ? swift.value : []),
      ...(multi.status === 'fulfilled' ? multi.value : [])
    ];

    const unique = all.filter(
      (proxy, index, self) =>
        index === self.findIndex(p => `${p.ip}:${p.port}` === `${proxy.ip}:${proxy.port}`)
    );

    console.log(`📊 Total combinados (sin duplicados): ${unique.length}`);
    return unique;
  }

  async filterValidProxies(proxies) {
    console.log('⚙️ Validando proxies...');
    const validationResults = await Promise.all(
      proxies.map(proxy =>
        validateProxy(proxy)
          .then(isValid => ({ proxy, isValid }))
          .catch(() => ({ proxy, isValid: false }))
      )
    );

    const validProxies = validationResults
      .filter(result => result.isValid)
      .map(result => result.proxy);

    console.log(`📊 Proxies válidos: ${validProxies.length}/${proxies.length}`);
    return validProxies;
  }

  static async loadAllProxies() {
    if (!fs.existsSync(PROXIES_VALIDATED_PATH)) return [];
    const data = fs.readFileSync(PROXIES_VALIDATED_PATH, 'utf-8');
    return JSON.parse(data);
  }
}
