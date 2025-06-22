// src/proxies/ultimateProxyMaster.js
import fs from 'fs';
import path from 'path';
import axios from 'axios';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

class UltimateProxyMaster {
  constructor() {
    this.proxySources = {
      premium: [],
      public: []
    };

    this.allProxies = [];
  }

  async loadProxies() {
    this.proxySources.premium = this.loadFromFile('../../config/premium_proxies.txt');
    this.proxySources.public = this.loadFromFile('../../config/backup_proxies.txt');

    const onlineProxies = await this.fetchOnlineProxies();
    this.proxySources.public.push(...onlineProxies);

    this.allProxies = [...new Set([...this.proxySources.premium, ...this.proxySources.public])]
      .map(this.parseProxy)
      .filter(p => !!p); // filtrar nulls

    console.log(`✅ Proxy Master iniciado con ${this.allProxies.length} proxies funcionales`);
    return this.allProxies;
  }

  loadFromFile(relativePath) {
    try {
      const fullPath = path.resolve(__dirname, relativePath);
      const content = fs.readFileSync(fullPath, 'utf-8');
      return content
        .split('\n')
        .map(l => l.trim())
        .filter(l => l && l.includes(':'));
    } catch (err) {
      console.warn(`⚠️ No se pudo cargar ${relativePath}:`, err.message);
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
        const proxies = res.data
          .split('\n')
          .map(l => l.trim())
          .filter(l => l.includes(':'));
        all.push(...proxies);
      } catch (err) {
        console.warn(`⚠️ Fallo al obtener proxies de ${url}`);
      }
    }

    return all.slice(0, 100);
  }

  parseProxy(proxyStr) {
    const parts = proxyStr.split(':');
    if (parts.length < 2) return null;

    const [ip, port, username, password] = parts;
    const isAuth = username && password;

    return {
      string: proxyStr,
      ip,
      port: Number(port),
      auth: isAuth ? { username, password } : null,
      type: 'http'
    };
  }

  getWorkingProxies() {
    return this.allProxies;
  }
}

const proxyMaster = new UltimateProxyMaster();
export default proxyMaster;
