const axios = require('axios');

module.exports = {
  async fetchMassiveProxies() {
    const sources = [
      'https://raw.githubusercontent.com/TheSpeedX/PROXY-List/master/http.txt',
      'https://api.proxyscrape.com/v2/?request=getproxies&protocol=http',
      'https://raw.githubusercontent.com/mertguvencli/http-proxy-list/main/proxy-list/data.txt'
    ];

    let allProxies = [];
    for (const url of sources) {
      try {
        const { data } = await axios.get(url, { timeout: 5000 });
        allProxies = [
          ...allProxies,
          ...data.split('\n').filter(p => p.includes(':')).slice(0, 3500)
        ];
      } catch {}
    }
    return [...new Set(allProxies)].slice(0, 10000); // 10,000 únicos
  }
};
