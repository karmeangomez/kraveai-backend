import axios from 'axios';
import fs from 'fs/promises';
import path from 'path';

class UltimateProxyMaster {
  constructor() {
    this.proxySources = {
      premium: [],
      public: []
    };
    this.proxyUsageCount = new Map();
    this.workingProxies = [];
    this.cachePath = path.resolve('./config/public_proxies_cache.txt');
  }

  async init() {
    try {
      await this.loadPremiumProxies();
      await this.loadPublicProxies();
      const combinedProxies = [...this.proxySources.premium, ...this.proxySources.public];
      this.workingProxies = await this.filterWorkingProxies(combinedProxies);

      console.log(`✅ Proxy Master iniciado con ${this.workingProxies.length} proxies funcionales`);
      this.workingProxies.forEach(proxy => this.proxyUsageCount.set(proxy.string, 0));
      await this.savePublicProxiesCache();
    } catch (error) {
      console.error('❌ Error al iniciar Proxy Master:', error);
      throw error;
    }
  }

  async loadPremiumProxies() {
    try {
      const proxyJsonPath = path.resolve('./src/proxies/proxies.json');
      const jsonData = await fs.readFile(proxyJsonPath, 'utf8');
      const parsed = JSON.parse(jsonData);
      this.proxySources.premium = parsed.premium || [];
      console.log(`🔐 ${this.proxySources.premium.length} proxies premium cargados`);
    } catch (error) {
      console.warn('⚠️ No se pudo cargar proxies premium:', error.message);
      this.proxySources.premium = [];
    }
  }

  async loadPublicProxies() {
    try {
      try {
        const cacheData = await fs.readFile(this.cachePath, 'utf8');
        this.proxySources.public = cacheData.split('\n').filter(Boolean);
        console.log(`📂 ${this.proxySources.public.length} proxies públicos cargados desde caché`);
        if (this.proxySources.public.length >= 50) return;
      } catch {
        console.log('📂 Sin caché de proxies públicos, extrayendo nuevos...');
      }

      const sources = [
        'https://www.proxy-list.download/api/v1/get?type=http&country=MX',
        'https://www.proxy-list.download/api/v1/get?type=http&country=AR',
        'https://www.proxy-list.download/api/v1/get?type=http&country=CO',
        'https://www.proxy-list.download/api/v1/get?type=http&country=CL',
        'https://www.proxy-list.download/api/v1/get?type=http&country=PE',
        'https://api.proxyscrape.com/v2/?request=getproxies&protocol=http&timeout=5000&country=ES',
        'https://www.proxy-list.download/api/v1/get?type=http&country=ES',
        'https://raw.githubusercontent.com/proxy4parsing/proxy-list/main/http.txt',
        'https://proxylist.geonode.com/api/proxy-list?limit=50&sort_by=lastChecked&sort_type=desc&protocols=http&country=US,MX,BR,AR,CO,CL,PE',
        'https://api.proxyscrape.com/v2/?request=getproxies&protocol=http&timeout=5000&country=all&simplified=true',
        'https://raw.githubusercontent.com/TheSpeedX/SOCKS-List/master/http.txt',
        'https://raw.githubusercontent.com/jetkai/proxy-list/main/online-proxies/txt/proxies-http.txt',
        'https://raw.githubusercontent.com/monosans/proxy-list/main/proxies/http.txt',
        'https://raw.githubusercontent.com/clarketm/proxy-list/master/proxy-list-raw.txt',
        'https://raw.githubusercontent.com/roosterkid/openproxylist/main/HTTP_RAW.txt',
        'https://raw.githubusercontent.com/MuRongPiaoXue/ProxyList/main/http.txt',
        'https://raw.githubusercontent.com/shiftytr/proxy-list/master/proxy.txt',
        'https://raw.githubusercontent.com/hendrikbgr/Free-Proxy-List/main/proxies.txt'
      ];

      const results = await Promise.allSettled(
        sources.map(async url => {
          for (let retry = 0; retry < 2; retry++) {
            try {
              const response = await axios.get(url, { timeout: 7000 });
              return response.data;
            } catch {
              if (retry === 1) throw new Error(`Fallo en ${url}`);
              await new Promise(resolve => setTimeout(resolve, 1000));
            }
          }
        })
      );

      const combined = results
        .filter(res => res.status === 'fulfilled')
        .map(res => {
          if (typeof res.value === 'object') {
            return res.value.data ? res.value.data.map(p => `${p.ip}:${p.port}`) : [];
          }
          return res.value;
        })
        .flatMap(data => data.split(/\r?\n/).filter(p => p.includes(':')))
        .map(p => `${p}:user:pass`)
        .filter((p, i, arr) => arr.indexOf(p) === i);

      this.proxySources.public = combined;
      console.log(`🌐 ${combined.length} proxies públicos extraídos de múltiples fuentes`);
    } catch (error) {
      console.warn('⚠️ Error al cargar proxies públicos:', error.message);
      this.proxySources.public = [];
    }
  }

  async savePublicProxiesCache() {
    try {
      const functionalProxies = this.workingProxies
        .filter(p => !this.proxySources.premium.includes(p.string))
        .map(p => p.string);
      await fs.writeFile(this.cachePath, functionalProxies.join('\n'));
      console.log(`📂 ${functionalProxies.length} proxies públicos guardados en caché`);
    } catch (error) {
      console.warn('⚠️ Error al guardar caché de proxies:', error.message);
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
            auth: proxy.auth || undefined
          },
          timeout: 5000
        });

        if (response.data && response.data.origin) {
          console.log(`✅ Proxy activo: ${proxyStr}`);
          return proxy;
        }
      } catch (_) {}
      return null;
    });

    const results = await Promise.all(testPromises);
    return results.filter(p => p !== null);
  }

  formatProxy(proxyStr) {
    const parts = proxyStr.trim().split(':');
    if (parts.length < 2) throw new Error(`Formato inválido: ${proxyStr}`);
    return {
      ip: parts[0],
      port: parseInt(parts[1]),
      auth: (parts.length === 4)
        ? { username: parts[2], password: parts[3] }
        : null,
      string: proxyStr
    };
  }

  getWorkingProxies() {
    return this.workingProxies;
  }

  getProxy(proxyStr) {
    return this.formatProxy(proxyStr);
  }

  markProxyUsed(proxyStr) {
    const count = this.proxyUsageCount.get(proxyStr) || 0;
    this.proxyUsageCount.set(proxyStr, count + 1);
  }

  logStats() {
    console.log('\n📊 Estadísticas de Proxies:');
    Object.entries(this.proxySources).forEach(([tipo, lista]) => {
      console.log(`• ${tipo}: ${lista.length} proxies`);
    });
  }
}

const proxyMaster = new UltimateProxyMaster();
export default proxyMaster;
