const axios = require('axios');

module.exports = {
  async validateProxies(proxies) {
    const validProxies = [];
    
    for (const proxyStr of proxies) {
      const [ip, port, user, pass] = proxyStr.split(':');
      try {
        const start = Date.now();
        await axios.get('https://www.instagram.com', {
          proxy: { host: ip, port: parseInt(port), auth: { username: user, password: pass } },
          timeout: 6000
        });
        const latency = Date.now() - start;
        
        if (latency < 6000) {
          validProxies.push({
            proxy: proxyStr,
            score: this.calculateScore(latency),
            latency
          });
        }
      } catch {}
    }
    
    return validProxies.sort((a, b) => b.score - a.score);
  },

  calculateScore(latency) {
    return Math.max(0, 100 - (latency / 100)); // Más alto = mejor
  }
};
