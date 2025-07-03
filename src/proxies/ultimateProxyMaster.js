import fs from 'fs';
import path from 'path';
import ProxyRotationSystem from './proxyRotationSystem.js';
import WebshareProxyManager from './webshareApi.js';
import SwiftShadowLoader from './swiftShadowLoader.js';
import MultiProxiesRunner from './multiProxiesRunner.js';
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

      if (proxies.length === 0) throw new Error('❌ No se encontraron proxies válidos');
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

    this.proxies = validos;
    this.resetRotation();
    this.stats = { totalRequests: 0, successCount: 0, failCount: 0 };

    fs.writeFileSync(PROXIES_VALIDATED_PATH, JSON.stringify(validos, null, 2));
    console.log(`🔁 Proxies validados y actualizados (${validos.length})`);
  }

  async getAllSourcesProxies() {
    console.log('🔍 Obteniendo proxies desde todas las fuentes...');
    const webshare = await WebshareProxyManager.getProxies();
    const swift = await SwiftShadowLoader.getProxies();
    const multi = await MultiProxiesRunner.getProxies();

    const all = [...webshare, ...swift, ...multi];

    const unique = all.filter(
      (proxy, index, self) =>
        index === self.findIndex(p => `${p.ip}:${p.port}` === `${proxy.ip}:${proxy.port}`)
    );

    console.log(`📊 Total combinados (sin duplicados): ${unique.length}`);
    return unique;
  }

  async filterValidProxies(proxies) {
    const results = [];

    for (const proxy of proxies) {
      const isValid = await validateProxy(proxy);
      if (isValid) {
        results.push(proxy);
        console.log(`✅ Válido: ${proxy.ip}:${proxy.port}`);
      } else {
        console.log(`⛔ Falló: ${proxy.ip}:${proxy.port}`);
      }
    }

    return results;
  }

  static async loadAllProxies() {
    if (!fs.existsSync(PROXIES_VALIDATED_PATH)) return [];
    const data = fs.readFileSync(PROXIES_VALIDATED_PATH, 'utf-8');
    return JSON.parse(data);
  }
}
