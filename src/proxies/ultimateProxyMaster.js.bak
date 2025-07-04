import fs from 'fs';
import path from 'path';
import ProxyRotationSystem from './proxyRotationSystem.js';
import WebshareProxyManager from './webshareApi.js';
import { validateProxy } from '../utils/validator.js';

const PROXIES_VALIDATED_PATH = path.resolve('src/proxies/proxies_validados.json');

export default class UltimateProxyMaster extends ProxyRotationSystem {
  constructor() {
    super([]);
  }

  async initialize(forceRefresh = true) {
    console.log('🔄 Inicializando sistema de proxies...');
    let proxies = [];

    if (!forceRefresh && fs.existsSync(PROXIES_VALIDATED_PATH)) {
      try {
        const data = fs.readFileSync(PROXIES_VALIDATED_PATH, 'utf-8');
        proxies = JSON.parse(data);
        console.log(`📦 Cargando ${proxies.length} proxies validados`);
      } catch (error) {
        console.error(`❌ Error leyendo proxies: ${error.message}`);
      }
    }

    if (proxies.length === 0) {
      proxies = await this.getAllSourcesProxies();
      proxies = await this.filterValidProxies(proxies);
    }

    if (proxies.length === 0) {
      console.error('❌ No se encontraron proxies válidos');
      throw new Error('No hay proxies válidos disponibles');
    }

    this.proxies = proxies;
    fs.writeFileSync(PROXIES_VALIDATED_PATH, JSON.stringify(proxies, null, 2));
    console.log(`💾 ${proxies.length} proxies válidos guardados`);
    
    this.resetRotation();
    this.autoRefreshProxies();
    return true;
  }

  async refreshProxies() {
    console.log('🔄 Refrescando proxies...');
    let proxies = await this.getAllSourcesProxies();
    proxies = await this.filterValidProxies(proxies);

    if (proxies.length > 0) {
      this.proxies = proxies;
      fs.writeFileSync(PROXIES_VALIDATED_PATH, JSON.stringify(proxies, null, 2));
    }

    this.resetRotation();
  }

  async getAllSourcesProxies() {
    console.log('🔍 Obteniendo proxies de todas las fuentes...');
    const proxies = [];
    
    // Prioridad 1: Webshare
    try {
      const webshareProxies = await WebshareProxyManager.getProxies();
      if (webshareProxies.length > 0) {
        console.log(`⭐ ${webshareProxies.length} proxies de Webshare`);
        proxies.push(...webshareProxies);
        return proxies; // Devolver inmediatamente si hay Webshare
      }
    } catch (error) {
      console.error('⚠️ Error con Webshare:', error.message);
    }

    // Prioridad 2: Proxies manuales
    if (process.env.PROXY_LIST) {
      const manualProxies = process.env.PROXY_LIST.split(',')
        .map(proxyStr => {
          const match = proxyStr.match(/http:\/\/([^:]+):([^@]+)@([^:]+):(\d+)/);
          if (match) {
            return {
              ip: match[3],
              port: parseInt(match[4]),
              auth: { username: match[1], password: match[2] },
              type: 'http',
              source: 'manual'
            };
          }
          return null;
        })
        .filter(Boolean);
      
      if (manualProxies.length > 0) {
        console.log(`📖 ${manualProxies.length} proxies manuales`);
        proxies.push(...manualProxies);
      }
    }

    return proxies;
  }

  async filterValidProxies(proxies) {
    console.log('⚙️ Validando proxies...');
    const validationResults = await Promise.all(
      proxies.map(async (proxy) => {
        const isValid = await validateProxy(proxy);
        return { proxy, isValid };
      })
    );

    return validationResults
      .filter(result => result.isValid)
      .map(result => result.proxy);
  }

  getNextProxy() {
    // Priorizar siempre proxies de Webshare
    const webshareProxy = this.proxies.find(p => p.source === 'webshare_residential');
    if (webshareProxy) {
      console.log(`✅ Proxy seleccionado: ${webshareProxy.ip}:${webshareProxy.port} (Webshare)`);
      return webshareProxy;
    }

    // Fallback a otros proxies
    const proxy = super.getNextProxy();
    console.log(`✅ Proxy seleccionado: ${proxy.ip}:${proxy.port} (${proxy.source})`);
    return proxy;
  }

  autoRefreshProxies() {
    setInterval(async () => {
      await this.refreshProxies();
      console.log('🔄 Proxies actualizados automáticamente');
    }, 30 * 60 * 1000); // 30 minutos
  }
}
