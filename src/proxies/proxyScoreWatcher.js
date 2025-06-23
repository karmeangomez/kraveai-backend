class ProxyScoreWatcher {
  constructor() {
    this.scores = new Map();
    setInterval(this.checkProxies.bind(this), 300000); // 5 minutos
  }

  async checkProxies() {
    const proxies = ultimateProxyMaster.getProxies();
    for (const proxy of proxies) {
      const result = await proxyTester.testProxy(proxy);
      const score = result.valid ? 100 - (result.latency / 100) : 0;
      this.scores.set(proxy.string, score);
    }
  }

  getIpScore(proxyString) {
    return this.scores.get(proxyString) || 0;
  }
}
