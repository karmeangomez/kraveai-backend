import UltimateProxyMaster from './ultimateProxyMaster.js';
import axios from 'axios';
import fs from 'fs/promises';

class ProxyRotationSystem {
  constructor() {
    this.proxies = [];
    this.blacklist = new Set();
    this.blacklistData = new Map(); // proxyStr -> timestamp
    this.blacklistFile = 'blacklist.json';
  }

  async loadBlacklist() {
    try {
      const data = await fs.readFile(this.blacklistFile, 'utf8');
      const entries = JSON.parse(data);
      for (const [proxyStr, timestamp] of entries) {
        if (Date.now() - timestamp < 30 * 60 * 1000) {
          this.blacklist.add(proxyStr);
          this.blacklistData.set(proxyStr, timestamp);
        }
      }
    } catch {
      console.warn('⚠️ No se pudo cargar blacklist.json (aún no existe)');
    }
  }

  async saveBlacklist() {
    try {
      await fs.writeFile(this.blacklistFile, JSON.stringify([...this.blacklistData]));
    } catch (error) {
      console.error('❌ Error guardando blacklist.json:', error.message);
    }
  }

  async initHealthChecks() {
    console.log('🔄 Iniciando chequeos de salud de proxies...');
    const allProxies = await UltimateProxyMaster.loadProxies(); // ← siempre cargar nuevos

    const valids = [];

    for (const proxy of allProxies) {
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
        valids.push(proxy);
      } catch {
        this.recordFailure(proxy.string);
      }
    }

    this.proxies = valids;
    console.log(`🧠 ${this.proxies.length} proxies válidos / ${this.blacklist.size} en blacklist`);
  }

  getAvailableProxies() {
    return this.proxies.filter(p => !this.blacklist.has(p.string));
  }

  async getBestProxy() {
    const available = this.getAvailableProxies();
    for (const proxy of available) {
      try {
        await axios.get('https://www.instagram.com', {
          proxy: {
            host: proxy.ip,
            port: proxy.port,
            auth: proxy.auth || undefined
          },
          timeout: 3000
        });
        return proxy;
      } catch {
        this.recordFailure(proxy.string);
      }
    }
    throw new Error('❌ No hay proxies válidos disponibles');
  }

  recordFailure(proxyStr) {
    this.blacklist.add(proxyStr);
    this.blacklistData.set(proxyStr, Date.now());
    this.saveBlacklist();

    console.warn(`🚫 Proxy en cooldown por fallos: ${proxyStr}`);

    setTimeout(() => {
      this.blacklist.delete(proxyStr);
      this.blacklistData.delete(proxyStr);
      this.saveBlacklist();
      console.log(`♻️ Proxy reactivado: ${proxyStr}`);
    }, 30 * 60 * 1000); // 30 minutos
  }

  markProxyUsed(proxyStr) {
    // Puedes implementar lógica si necesitas marcar uso sin bloquear
  }

  startPeriodicValidation(intervalMs = 30 * 60 * 1000) {
    setInterval(async () => {
      console.log('🔁 Revalidando y recargando proxies automáticamente...');
      await this.initHealthChecks(); // ← recarga total incluida
      console.log(`🧠 ${this.getAvailableProxies().length} proxies válidos / ${this.blacklist.size} en blacklist`);
    }, intervalMs);
  }
}

export default new ProxyRotationSystem();
