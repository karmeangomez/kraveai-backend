import UltimateProxyMaster from './ultimateProxyMaster.js';
import axios from 'axios';
import fs from 'fs/promises';

class ProxyRotationSystem {
  constructor() {
    this.proxies = [];
    this.blacklist = new Set();
    this.blacklistData = new Map();
    this.blacklistFile = 'blacklist.json';
  }

  async loadBlacklist() {
    try {
      const data = await fs.readFile(this.blacklistFile, 'utf8');
      const entries = JSON.parse(data);
      for (const [p, t] of entries) {
        if (Date.now() - t < 30 * 60e3) {
          this.blacklist.add(p);
          this.blacklistData.set(p, t);
        }
      }
    } catch {
      console.warn('⚠️ blacklist.json no existe o es inválido');
    }
  }

  async saveBlacklist() {
    await fs.writeFile(this.blacklistFile, JSON.stringify([...this.blacklistData]));
  }

  async initHealthChecks() {
    console.log('🔄 Chequeando salud de proxies...');
    const list = await UltimateProxyMaster.loadProxies();
    const good = [];
    for (const proxy of list) {
      if (this.blacklist.has(proxy.string)) continue;
      try {
        await axios.get('https://www.instagram.com', {
          proxy: {
            host: proxy.ip,
            port: proxy.port,
            auth: proxy.auth || undefined
          },
          timeout: 3000
        });
        good.push(proxy);
      } catch {
        this.recordFailure(proxy.string);
      }
    }
    this.proxies = good;
    console.log(`🧠 Válidos: ${this.proxies.length}, En btlist: ${this.blacklist.size}`);
  }

  getAvailableProxies() {
    return this.proxies.filter(p => !this.blacklist.has(p.string));
  }

  async getBestProxy() {
    const cands = this.getAvailableProxies();
    for (const p of cands) {
      try {
        await axios.get('https://www.instagram.com', {
          proxy: { host: p.ip, port: p.port, auth: p.auth || undefined },
          timeout: 2000
        });
        return p;
      } catch {
        this.recordFailure(p.string);
      }
    }
    throw new Error('❌ No hay proxies válidos disponibles');
  }

  recordFailure(p) {
    if (!this.blacklist.has(p)) {
      this.blacklist.add(p);
      this.blacklistData.set(p, Date.now());
      this.saveBlacklist();
      console.warn(`🚫 Proxy en cooldown: ${p}`);
      setTimeout(async () => {
        this.blacklist.delete(p);
        this.blacklistData.delete(p);
        await this.saveBlacklist();
        console.log(`♻️ Proxy reactivado: ${p}`);
      }, 30 * 60e3);
    }
  }

  markProxyUsed(_) { /* opcional */ }

  startPeriodicValidation(intervalMs = 30 * 60e3) {
    setInterval(async () => {
      await this.initHealthChecks();
    }, intervalMs);
  }
}

export default new ProxyRotationSystem();
