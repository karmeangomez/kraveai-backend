import fs from 'fs';
import path from 'path';
import ProxyRotationSystem from './proxyRotationSystem.js';
import WebshareProxyManager from './webshareApi.js';
import { validateProxy } from '../utils/validator.js';
import { getPublicProxies } from './sources/publicProxyFetcher.js'; // <-- módulo nuevo
import dotenv from 'dotenv';
dotenv.config();

const PROXIES_VALIDATED_PATH = path.resolve('src/proxies/proxies_validados.json');
const PROXY_LIST_FILE = path.resolve('src/proxies/proxies.txt');

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

    // 1. Webshare rotativo
    try {
      const webshareProxies = await WebshareProxyManager.getProxies();
      if (webshareProxies.length > 0) {
        console.log(`⭐ ${webshareProxies.length} proxies de Webshare`);
        proxies.push(...webshareProxies);
      }
    } catch (error) {
      console.error('⚠️ Error con Webshare:', error.message);
    }

    // 2. proxies.txt personalizados
    if (fs.existsSync(PROXY_LIST_FILE)) {
      try {
        const lines = fs.readFileSync(PROXY_LIST_FILE, 'utf-8')
          .split('\n')
          .map(l => l.trim())
          .filter(Boolean);
        for (const line of lines) {
          const [ip, port, username, password] = line.split(':');
          if (ip && port && username && password) {
            proxies.push({
              ip,
              port: parseInt(port),
              auth: { username, password },
              type: 'http',
              source: 'proxies.txt'
            });
          }
        }
        console.log(`📂 ${lines.length} proxies cargados desde proxies.txt`);
      } catch (error) {
        console.warn('⚠️ Error leyendo proxies.txt:', error.message);
      }
    }

    // 3. Proxies manuales desde .env
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
              source: 'manual_env'
            };
          }
          return null;
        })
        .filter(Boolean);
      proxies.push(...manualProxies);
      console.log(`🔧 ${manualProxies.length} proxies desde .env`);
    }

    // 4. Proxies públicos (SwiftShadow, ProxyNova, ProxyShare.io)
    try {
      const publicProxies = await getPublicProxies();
      proxies.push(...publicProxies);
      console.log(`🌍 ${publicProxies.length} proxies públicos extraídos`);
    } catch (error) {
      console.error('⚠️ Error obteniendo proxies públicos:', error.message);
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
    const proxy = super.getNextProxy();
    if (proxy) {
      console.log(`✅ Proxy seleccionado: ${proxy.ip}:${proxy.port} (${proxy.source})`);
    } else {
      console.warn('⚠️ No hay proxy disponible en este momento');
    }
    return proxy;
  }

  autoRefreshProxies() {
    setInterval(async () => {
      await this.refreshProxies();
      console.log('🔄 Proxies actualizados automáticamente');
    }, 30 * 60 * 1000); // 30 minutos
  }
}