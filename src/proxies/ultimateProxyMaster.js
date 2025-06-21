import axios from 'axios';
import fs from 'fs/promises';

class UltimateProxyMaster {
  constructor() {
    this.proxySources = {
      premium: [],
      backup: []
    };
    this.MAX_PROXY_REQUESTS = 50;
    this.proxyUsageCount = new Map();
  }

  async init() {
    try {
      await this.loadProxies();
      console.log(`✅ Proxy Master iniciado con ${this.proxySources.premium.length} proxies premium y ${this.proxySources.backup.length} de backup`);
      return this;
    } catch (error) {
      console.error('❌ Error al iniciar Proxy Master:', error);
      throw error;
    }
  }

  async loadProxies() {
    try {
      // Carga proxies de archivos
      const premiumData = await fs.readFile('./config/premium_proxies.txt', 'utf8');
      const rawPremium = premiumData.split('\n').filter(Boolean);
      
      const backupData = await fs.readFile('./config/backup_proxies.txt', 'utf8');
      const rawBackup = backupData.split('\n').filter(Boolean);
      
      // Filtrar proxies funcionales
      this.proxySources.premium = [];
      for (const proxyStr of rawPremium) {
        if (await this.testProxy(proxyStr)) {
          this.proxySources.premium.push(proxyStr);
          console.log(`✅ Proxy premium verificado: ${proxyStr}`);
        } else {
          console.warn(`❌ Proxy premium no funcional: ${proxyStr}`);
        }
      }
      
      this.proxySources.backup = [];
      for (const proxyStr of rawBackup) {
        if (await this.testProxy(proxyStr)) {
          this.proxySources.backup.push(proxyStr);
          console.log(`✅ Proxy backup verificado: ${proxyStr}`);
        } else {
          console.warn(`❌ Proxy backup no funcional: ${proxyStr}`);
        }
      }

      // Si no hay suficientes proxies, usar respaldo online
      if (this.proxySources.premium.length < 3) {
        console.log('⚠️ Usando proxies de respaldo online');
        const onlineProxies = await this.getOnlineProxies();
        this.proxySources.premium = [...this.proxySources.premium, ...onlineProxies.slice(0, 5)];
      }
      
      // Inicializa contadores
      this.proxySources.premium.forEach(proxy => this.proxyUsageCount.set(proxy, 0));
      this.proxySources.backup.forEach(proxy => this.proxyUsageCount.set(proxy, 0));
    } catch (error) {
      console.warn('⚠️ Usando proxies por defecto');
      this.proxySources = {
        premium: [
          '45.95.96.187:8446',
          '45.95.96.188:8446',
          '45.95.96.189:8446'
        ],
        backup: [
          '45.95.96.190:8446',
          '45.95.96.191:8446'
        ]
      };
    }
  }

  async testProxy(proxyStr) {
    const proxy = this.formatProxy(proxyStr, 'test');
    try {
      const response = await axios.get('https://www.google.com', {
        proxy: {
          host: proxy.ip,
          port: proxy.port,
          ...(proxy.auth && {
            auth: {
              username: proxy.auth.username,
              password: proxy.auth.password
            }
          })
        },
        timeout: 5000
      });
      return response.status === 200;
    } catch (error) {
      return false;
    }
  }

  async getOnlineProxies() {
    try {
      const response = await axios.get('https://api.proxyscrape.com/v2/?request=getproxies&protocol=http&timeout=5000&country=all');
      return response.data.split('\r\n').filter(p => p);
    } catch (error) {
      console.error('Error obteniendo proxies online:', error.message);
      return [];
    }
  }

  formatProxy(proxyStr, type) {
    const parts = proxyStr.split(':');
    const port = parseInt(parts[1]);
    
    if (isNaN(port) || port < 1 || port > 65535) {
      throw new Error(`Puerto inválido en proxy: ${proxyStr}`);
    }

    return {
      ip: parts[0],
      port,
      ...(parts[2] && parts[3] ? {
        auth: {
          username: parts[2],
          password: parts[3]
        }
      } : {}),
      type,
      string: proxyStr,
      usageCount: this.proxyUsageCount.get(proxyStr) || 0
    };
  }

  getProxyStats() {
    return {
      premium: this.proxySources.premium.length,
      backup: this.proxySources.backup.length,
      usage: Object.fromEntries(this.proxyUsageCount)
    };
  }
}

const proxyMaster = new UltimateProxyMaster();
export default proxyMaster;
