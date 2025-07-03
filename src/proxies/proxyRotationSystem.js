export default class ProxyRotationSystem {
  constructor(proxies = []) {
    this.proxies = proxies;
    this.currentIndex = 0;
    this.stats = {
      totalRequests: 0,
      successCount: 0,
      failCount: 0
    };
  }

  async initialize() {
    // Filtra proxies inválidos antes de iniciar
    this.proxies = this.proxies.filter(proxy => 
      proxy.port > 0 && proxy.port < 65535
    );
    
    console.log(`🔄 Sistema de rotación inicializado con ${this.proxies.length} proxies`);
  }

  getNextProxy() {
    if (this.proxies.length === 0) {
      return null;
    }

    // Ordenar por puntaje (éxitos - fallos)
    const sortedProxies = [...this.proxies].sort((a, b) => {
      const scoreA = a.successCount - a.failCount;
      const scoreB = b.successCount - b.failCount;
      return scoreB - scoreA;
    });

    const bestProxy = sortedProxies[0];
    this.currentIndex = (this.currentIndex + 1) % this.proxies.length;
    
    // Actualizar estadísticas
    bestProxy.lastUsed = Date.now();
    
    console.log(`✅ Proxy seleccionado: ${bestProxy.ip}:${bestProxy.port} (Score: ${bestProxy.successCount - bestProxy.failCount})`);
    return bestProxy;
  }

  reportSuccess(proxy) {
    if (!proxy) return;
    proxy.successCount++;
    this.stats.successCount++;
    this.stats.totalRequests++;
  }

  reportFailure(proxy) {
    if (!proxy) return;
    proxy.failCount++;
    this.stats.failCount++;
    this.stats.totalRequests++;
    
    // Descartar proxy después de 3 fallos
    if (proxy.failCount >= 3) {
      this.proxies = this.proxies.filter(p => p !== proxy);
      console.log(`🚫 Proxy añadido a lista negra: ${proxy.ip}:${proxy.port} (Fallos: ${proxy.failCount})`);
    }
  }

  resetRotation() {
    this.currentIndex = 0;
    console.log('🔁 Rotación reiniciada');
  }
}
