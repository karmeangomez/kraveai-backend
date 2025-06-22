// src/proxies/ultimateProxyMaster.js
import fs from 'fs';
import path from 'path';
import axios from 'axios';

class UltimateProxyMaster {
  constructor() {
    this.proxySources = {
      premium: [],
      public: []
    };

    this.allProxies = [];
  }

  async loadProxies() {
    this.proxySources.premium = this.loadFromFile('config/premium_proxies.txt');
    this.proxySources.public = this.loadFromFile('config/backup_proxies.txt');

    const onlineProxies = await this.fetchOnlineProxies();
    this.proxySources.public.push(...onlineProxies);

    this.allProxies = [...new Set([...this.proxySources.premium, ...this.proxySources.public])]
      .map(this.parseProxy);

    console.log(`✅ Proxy Master iniciado con ${this.allProxies.length} proxies funcionales`);
  }

  loadFromFile(filename) {
    try {
      const fullPath = path.resolve(filename);
      const content = fs.readFileSync(fullPath, 'utf-8');
      return content
        .split('\n')
        .map(l => l.trim())
        .filter(l => l && l.includes(':'));
    } catch {
      return [];
    }
  }

  async fetchOnlineProxies() {
    const urls = [
      'https://raw.githubusercontent.com/TheSpeedX/PROXY-List/master/http.txt',
      'https://raw.githubusercontent.com/clarketm/proxy-list/master/proxy-list-raw.txt',
      'https://raw.githubusercontent.com/ShiftyTR/Proxy-List/master/http.txt'
    ];

    const all = [];

    for (const url of urls) {
      try {
        const res = await axios.get(url, { timeout: 5000 });
        const proxies = res.data.split('\n').map(l => l.trim()).filter(l => l.includes(':'));
        all.push(...proxies);
      } catch {
        continue;
      }
    }

    return all.slice(0, 100); // límite para evitar sobrecarga
  }

  parseProxy(proxyStr) {
    const [ip, port, user, pass] = proxyStr.split(':');
    const isAuth = !!(user && pass);
    return {
      string: proxyStr,
      ip,
      port: Number(port),
      auth: isAuth ? { username: user, password: pass } : null,
      type: 'http' // se puede ajustar dinámicamente si se quiere más adelante
    };
  }

  getWorkingProxies() {
    return this.allProxies;
  }
}

const proxyMaster = new UltimateProxyMaster();
await proxyMaster.loadProxies();
export default proxyMaster;
