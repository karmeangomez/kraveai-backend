import fs from 'fs';
import path from 'path';
import ProxyRotationSystem from './proxyRotationSystem.js';
import WebshareProxyManager from './webshareApi.js';
import { getProxies as loadSwiftShadowProxies } from './swiftShadowLoader.js';
import runMultiProxies from './multiProxiesRunner.js';
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
          failCount: 0,
          source: 'tor_fallback'
        }];
      }

      fs.writeFileSync(PROXIES_VALIDATED_PATH, JSON.stringify(proxies, null, 2));
      console.log(`💾 Guardado proxies válidos en proxies_validados.json`);
    }

    this.proxies = proxies;
    await super.initialize();
    this.resetRotation();
    this.autoRefreshProxies();
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
    
    // 1. Prioridad al proxy residencial de Webshare
    let webshareProxies = [];
    try {
      webshareProxies = await WebshareProxyManager.getProxies();
      console.log(`⭐ ${webshareProxies.length} proxies de Webshare obtenidos`);
    } catch (error) {
      console.error('⚠️ Error con Webshare:', error.message);
    }

    // 2. Cargar lista manual de proxies
    let manualProxies = [];
    if (process.env.PROXY_LIST) {
      manualProxies = process.env.PROXY_LIST.split(',')
        .map(proxyStr => {
          const match = proxyStr.match(/http:\/\/([^:]+):([^@]+)@([^:]+):(\d+)/);
          if (match) {
            return {
              ip: match[3],
              port: parseInt(match[4]),
              auth: {
                username: match[1],
                password: match[2]
              },
              type: 'http',
              source: 'manual'
            };
          }
          return null;
        })
        .filter(Boolean);
      
      console.log(`🛠️ ${manualProxies.length} proxies manuales cargados`);
    }

    // 3. Solo cargar otras fuentes si Webshare falla y no hay manuales
    let publicProxies = [];
    if (webshareProxies.length === 0 && manualProxies.length === 0) {
      console.warn('⚠️ Cargando proxies públicos como respaldo');
      const [swift, multi] = await Promise.allSettled([
        loadSwiftShadowProxies(),
        runMultiProxies()
      ]);
      
      publicProxies = [
        ...(swift.status === 'fulfilled' ? swift.value : []),
        ...(multi.status === 'fulfilled' ? multi.value : [])
      ];
    }

    // Combinar todos los proxies
    const allProxies = [
      ...webshareProxies,
      ...manualProxies,
      ...publicProxies
    ];

    // Filtrar para mantener solo HTTP/SOCKS
    const filtered = allProxies.filter(proxy => 
      ['http', 'https', 'socks4', 'socks5'].includes(proxy.type?.toLowerCase())
    );

    // Tor como último recurso
    if (filtered.length === 0) {
      console.warn('🚨 Usando Tor como último recurso');
      return [{
        ip: '127.0.0.1',
        port: 9050,
        auth: null,
        type: 'socks5',
        country: 'TOR',
        source: 'tor_fallback'
      }];
    }

    console.log(`📊 Total proxies disponibles: ${filtered.length}`);
    return filtered;
  }

  async filterValidProxies(proxies) {
    console.log('⚙️ Validando proxies...');
    const validationResults = await Promise.all(
      proxies.map(proxy => 
        validateProxy(proxy)
          .then(isValid => ({ proxy, isValid }))
          .catch(() => ({ proxy, isValid: false }))
    );

    const validProxies = validationResults
      .filter(result => result.isValid)
      .map(result => result.proxy);

    console.log(`📊 Proxies válidos: ${validProxies.length}/${proxies.length}`);
    return validProxies;
  }

  autoRefreshProxies() {
    setInterval(async () => {
      if (this.proxies.length < 10) {
        console.log('🔄 Auto-refrescando proxies (bajo umbral)');
        await this.refreshProxies();
      }
    }, 60 * 60 * 1000);
  }

  static async loadAllProxies() {
    if (!fs.existsSync(PROXIES_VALIDATED_PATH)) return [];
    const data = fs.readFileSync(PROXIES_VALIDATED_PATH, 'utf-8');
    return JSON.parse(data);
  }
}
