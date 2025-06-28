import { isProxyBlacklisted } from './proxyBlacklistManager.js';

export default class ProxyRotationSystem {
  constructor(proxies = []) {
    this.proxies = proxies;
    this.currentIndex = 0;
    this.badProxies = new Set();
    console.log(`🔄 Sistema de proxies creado con ${proxies.length} proxies`);
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

    let attempts = 0;
    while (attempts < this.proxies.length) {
      const proxy = this.proxies[this.currentIndex];
      this.currentIndex = (this.currentIndex + 1) % this.proxies.length;
      
      const key = `${proxy.ip}:${proxy.port}`;
      
      if (!this.badProxies.has(key) && !isProxyBlacklisted(proxy)) {
        console.log(`✅ Proxy seleccionado: ${key}`);
        return proxy;
      }
      
      attempts++;
    }

    console.warn('⚠️ Todos los proxies están bloqueados! Usando uno de emergencia');
    return this.proxies[0]; // Fallback
  }

  markProxyAsBad(proxy) {
    if (!proxy || !proxy.ip) {
      console.error('❌ Intento de marcar proxy inválido:', proxy);
      return;
    }
    
    const key = `${proxy.ip}:${proxy.port}`;
    this.badProxies.add(key);
    console.log(`🚫 Proxy añadido a lista negra: ${key}`);
  }

  resetRotation() {
    this.badProxies.clear();
    this.currentIndex = 0;
    console.log('🔁 Rotación reiniciada');
  }
  
  getActiveProxies() {
    return this.proxies.filter(proxy => {
      const key = `${proxy.ip}:${proxy.port}`;
      return !this.badProxies.has(key) && !isProxyBlacklisted(proxy);
    });
  }
}
