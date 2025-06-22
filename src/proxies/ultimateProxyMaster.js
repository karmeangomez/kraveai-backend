import fs from 'fs';
import path from 'path';
import axios from 'axios';
import { fileURLToPath } from 'url';
import SwiftShadowLoader from './swiftShadowLoader.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

class UltimateProxyMaster {
  constructor() {
    this.proxySources = { premium: [], public: [] };
    this.allProxies = [];
  }

  async loadProxies() {
    this.proxySources.premium = this.loadFromFile('../../config/premium_proxies.txt');
    this.proxySources.public = this.loadFromFile('../../config/backup_proxies.txt');

    const urls = [
      'https://raw.githubusercontent.com/TheSpeedX/PROXY-List/master/http.txt',
      'https://raw.githubusercontent.com/clarketm/proxy-list/master/proxy-list-raw.txt',
      'https://raw.githubusercontent.com/ShiftyTR/Proxy-List/master/http.txt'
    ];
    for (const url of urls) {
      try {
        const { data } = await axios.get(url, { timeout: 5000 });
        this.proxySources.public.push(
          ...data.split('\n').filter(l => l.includes(':')).slice(0, 100)
        );
      } catch { /* ignore */ }
    }

    const swiftList = await SwiftShadowLoader.getProxies();
    this.proxySources.public.push(...swiftList);

    this.allProxies = [
      ...new Set([...this.proxySources.premium, ...this.proxySources.public])
    ]
      .map(this.parseProxy)
      .filter(Boolean);

    console.log(`✅ Proxy Master inicial: ${this.allProxies.length} proxies`);
    return this.allProxies;
  }

  loadFromFile(filePath) {
    try {
      const txt = fs.readFileSync(path.resolve(__dirname, filePath), 'utf-8');
      return txt.split('\n').map(l => l.trim()).filter(l => l.includes(':'));
    } catch (e) {
      console.warn(`⚠️ No se pudo cargar ${filePath}: ${e.message}`);
      return [];
    }
  }

  parseProxy(proxyStr) {
    const parts = proxyStr.split(':');
    if (parts.length < 2) return null;
    const [ip, port, user, pass] = parts;
    return {
      string: proxyStr,
      ip,
      port: Number(port),
      auth: user && pass ? { username: user, password: pass } : null,
      type: 'http'
    };
  }

  getWorkingProxies() {
    return this.allProxies;
  }
}

export default new UltimateProxyMaster();
