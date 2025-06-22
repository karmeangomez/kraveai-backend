// src/proxies/ultimateProxyMaster.js
import fs from 'fs';
import path from 'path';
import axios from 'axios';

const premiumPath = path.resolve('config/premium_proxies.txt');
const publicPath = path.resolve('config/backup_proxies.txt');

class UltimateProxyMaster {
  constructor() {
    this.proxyList = [];
    this.proxySources = {
      premium: [],
      public: []
    };
  }

  async loadAllProxies() {
    this.proxyList = [];
    this.proxySources.premium = [];
    this.proxySources.public = [];

    // 1. Premium (local)
    if (fs.existsSync(premiumPath)) {
      const raw = fs.readFileSync(premiumPath, 'utf8').split('\n').map(l => l.trim()).filter(Boolean);
      for (const proxy of raw) {
        const parsed = this.parse(proxy);
        if (parsed) {
          parsed.source = 'premium';
          this.proxyList.push(parsed);
          this.proxySources.premium.push(parsed.string);
        }
      }
      console.log(`✅ Proxies premium cargados: ${this.proxySources.premium.length}`);
    }

    // 2. Públicos desde archivo
    if (fs.existsSync(publicPath)) {
      const raw = fs.readFileSync(publicPath, 'utf8').split('\n').map(l => l.trim()).filter(Boolean);
      for (const proxy of raw) {
        const parsed = this.parse(proxy);
        if (parsed) {
          parsed.source = 'public';
          this.proxyList.push(parsed);
          this.proxySources.public.push(parsed.string);
        }
      }
      console.log(`✅ Proxies públicos locales cargados: ${this.proxySources.public.length}`);
    }

    // 3. Scraping adicional en vivo (async, sin bloquear)
    this.fetchPublicSources();
  }

  async fetchPublicSources() {
    const urls = [
      'https://raw.githubusercontent.com/TheSpeedX/PROXY-List/master/http.txt',
      'https://api.proxyscrape.com/v2/?request=getproxies&protocol=http&timeout=5000&country=all',
      'https://raw.githubusercontent.com/monosans/proxy-list/main/proxies/http.txt'
    ];

    for (const url of urls) {
      try {
        const res = await axios.get(url, { timeout: 10000 });
        const lines = res.data.split('\n').map(l => l.trim()).filter(Boolean);
        for (const line of lines) {
          const proxy = `http://${line}`;
          const parsed = this.parse(proxy);
          if (parsed && !this.proxySources.public.includes(parsed.string)) {
            parsed.source = 'public';
            this.proxyList.push(parsed);
            this.proxySources.public.push(parsed.string);
          }
        }
        console.log(`🌍 Proxies públicos extraídos de: ${url}`);
      } catch (e) {
        console.warn(`⚠️ Fallo al obtener proxies desde ${url}: ${e.message}`);
      }
    }
  }

  parse(rawProxy) {
    try {
      const cleaned = rawProxy.replace(/^http:\/\//, '');
      const [authPart, ipPortPart] = cleaned.includes('@') ? cleaned.split('@') : [null, cleaned];
      const [ip, port] = ipPortPart.split(':');
      const [username, password] = authPart ? authPart.split(':') : [null, null];
      return {
        ip,
        port: parseInt(port),
        auth: username && password ? { username, password } : null,
        string: `http://${authPart ? `${username}:${password}@` : ''}${ip}:${port}`
      };
    } catch (e) {
      return null;
    }
  }

  getWorkingProxies() {
    return this.proxyList;
  }
}

const instance = new UltimateProxyMaster();
await instance.loadAllProxies();
export default instance;
