// src/proxies/proxyRotationSystem.js
import { isProxyBlacklisted } from './proxyBlacklistManager.js';

export default class ProxyRotationSystem {
  constructor(proxies = []) {
    this.proxies = proxies;
    this.currentIndex = 0;
    this.badProxies = new Set();
    this.stats = {
      totalRequests: 0,
      successCount: 0,
      failCount: 0
    };
  }

  async initialize() {
    console.log(`🔄 Inicializando ${this.proxies.length} proxies...`);
    return true;
  }

  getNextProxy() {
    if (!this.proxies || this.proxies.length === 0) {
      console.error('❌ No hay proxies disponibles');
      return null;
    }

    const sortedProxies = [...this.proxies].sort((a, b) => {
      const scoreA = (a.successCount || 0) * 2 - (a.failCount || 0);
      const scoreB = (b.successCount || 0) * 2 - (b.failCount || 0);
      return scoreB - scoreA;
    });

    for (const proxy of sortedProxies) {
      const key = `${proxy.ip}:${proxy.port}`;
      if (
        !this.badProxies.has(key) &&
        !isProxyBlacklisted(proxy) &&
        (!proxy.lastUsed || (Date.now() - proxy.lastUsed) > 10 * 60 * 1000)
      ) {
        proxy.lastUsed = Date.now();
        this.stats.totalRequests++;
        console.log(`✅ Proxy seleccionado: ${key} (Score: ${(proxy.successCount || 0) - (proxy.failCount || 0)})`);
        return proxy;
      }
    }

    console.warn('⚠️ Todos los proxies están bloqueados o en uso! Usando el mejor disponible');
    return sortedProxies[0];
  }

  markProxyAsBad(proxy) {
    if (!proxy || !proxy.ip) {
      console.error('❌ Intento de marcar proxy inválido');
      return;
    }

    const key = `${proxy.ip}:${proxy.port}`;
    this.badProxies.add(key);
    proxy.failCount = (proxy.failCount || 0) + 1;
    this.stats.failCount++;
    console.log(`🚫 Proxy añadido a lista negra: ${key} (Fallos: ${proxy.failCount})`);
  }

  markProxySuccess(proxy) {
    if (!proxy || !proxy.ip) return;

    proxy.successCount = (proxy.successCount || 0) + 1;
    this.stats.successCount++;

    const key = `${proxy.ip}:${proxy.port}`;
    console.log(`🏆 Proxy exitoso: ${key} (Éxitos: ${proxy.successCount})`);
  }

  resetRotation() {
    this.badProxies.clear();
    this.currentIndex = 0;
    console.log('🔁 Rotación reiniciada');
  }

  getStats() {
    return {
      ...this.stats,
      successRate: this.stats.totalRequests > 0
        ? (this.stats.successCount / this.stats.totalRequests * 100).toFixed(1)
        : 0
    };
  }
}
