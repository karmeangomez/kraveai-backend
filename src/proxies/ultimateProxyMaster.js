import axios from 'axios';
import fs from 'fs/promises';
import path from 'path';

class UltimateProxyMaster {
  constructor() {
    this.proxySources = {
      premium: [],
      backup: []
    };
    this.proxyUsageCount = new Map();
    this.workingProxies = [];
  }

  async init() {
    try {
      await this.loadProxies();
      console.log(`✅ Proxy Master iniciado con ${this.workingProxies.length} proxies funcionales`);
      return this;
    } catch (error) {
      console.error('❌ Error al iniciar Proxy Master:', error);
      throw error;
    }
  }

  async loadProxies() {
    try {
      // 1. Cargar proxies desde proxies.json
      const proxiesJsonPath = path.resolve('./src/proxies/proxies.json');
      const jsonData = await fs.readFile(proxiesJsonPath, 'utf8');
      const proxiesData = JSON.parse(jsonData);
      
      this.proxySources.premium = proxiesData.premium || [];
      console.log(`📁 ${this.proxySources.premium.length} proxies cargados desde proxies.json`);
      
      // 2. Filtrar proxies funcionales con autenticación
      this.workingProxies = await this.filterWorkingProxies(this.proxySources.premium);
      
      console.log(`🧪 ${this.workingProxies.length} proxies funcionales encontrados`);
      
      // 3. Inicializar contadores
      this.workingProxies.forEach(proxy => this.proxyUsageCount.set(proxy, 0));
    } catch (error) {
      console.error('❌ Error crítico cargando proxies:', error);
      throw new Error('No se pudieron cargar los proxies');
    }
  }

  async filterWorkingProxies(proxyList) {
    if (!proxyList || proxyList.length === 0) return [];
    
    const testPromises = proxyList.map(async proxyStr => {
      try {
        const proxy = this.formatProxy(proxyStr);
        const response = await axios.get('http://httpbin.org/ip', {
          proxy: {
            host: proxy.ip,
            port: proxy.port,
            auth: {
              username: proxy.auth.username,
              password: proxy.auth.password
            }
          },
          timeout: 5000
        });
        
        if (response.data && response.data.origin) {
          console.log(`✅ Proxy activo: ${proxyStr} (${response.data.origin})`);
          return proxyStr;
        }
      } catch (error) {
        console.warn(`❌ Proxy fallido: ${proxyStr} - ${error.message}`);
      }
      return null;
    });
    
    const results = await Promise.all(testPromises);
    return results.filter(p => p !== null);
  }

  formatProxy(proxyStr) {
    const parts = proxyStr.split(':');
    if (parts.length < 4) {
      throw new Error(`Formato de proxy inválido: ${proxyStr}`);
    }
    
    return {
      ip: parts[0],
      port: parseInt(parts[1]),
      auth: {
        username: parts[2],
        password: parts[3]
      },
      string: proxyStr
    };
  }

  getWorkingProxies() {
    return this.workingProxies;
  }

  getProxy(proxyStr) {
    return this.formatProxy(proxyStr);
  }
}

const proxyMaster = new UltimateProxyMaster();
export default proxyMaster;
