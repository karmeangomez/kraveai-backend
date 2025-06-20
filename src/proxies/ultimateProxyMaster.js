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
      // Carga proxies de archivos o APIs
      const premiumData = await fs.readFile('./config/premium_proxies.txt', 'utf8');
      this.proxySources.premium = premiumData.split('\n').filter(Boolean);
      
      const backupData = await fs.readFile('./config/backup_proxies.txt', 'utf8');
      this.proxySources.backup = backupData.split('\n').filter(Boolean);
      
      // Inicializa contadores
      this.proxySources.premium.forEach(proxy => this.proxyUsageCount.set(proxy, 0));
    } catch (error) {
      console.warn('⚠️ Usando proxies por defecto');
      this.proxySources = {
        premium: [
          '185.199.229.156:7492:user:pass',
          '185.199.228.220:7300:user:pass',
          '188.74.210.207:6286'
        ],
        backup: [
          '45.155.68.129:8137',
          '51.158.68.133:8811'
        ]
      };
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

  async testProxyConnection(proxy) {
    const testUrls = [
      'https://www.instagram.com',
      'https://www.google.com'
    ];

    const results = [];
    for (const url of testUrls) {
      try {
        const start = Date.now();
        await axios.get(url, {
          proxy: {
            host: proxy.ip,
            port: proxy.port,
            ...(proxy.auth ? {
              auth: proxy.auth
            } : {})
          },
          timeout: 8000
        });
        results.push({
          url,
          status: 'success',
          responseTime: Date.now() - start
        });
      } catch (error) {
        results.push({
          url,
          status: 'failed',
          error: error.message
        });
      }
    }
    return results;
  }

  getProxyStats() {
    return {
      premium: this.proxySources.premium.length,
      backup: this.proxySources.backup.length,
      usage: Object.fromEntries(this.proxyUsageCount)
    };
  }
}

export default new UltimateProxyMaster();
