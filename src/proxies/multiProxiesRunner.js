import axios from 'axios';

export default class MultiProxiesRunner {
  static async getProxies() {
    try {
      console.log('🌐 Fetching proxies from multiProxies (public sources)...');

      const { data } = await axios.get('https://raw.githubusercontent.com/TheSpeedX/SOCKS-List/master/http.txt');

      const proxies = data
        .split('\n')
        .filter(line => line.includes(':'))
        .slice(0, 50)
        .map(line => {
          const [ip, port] = line.trim().split(':');
          return {
            ip,
            port: parseInt(port),
            auth: {
              username: 'user',
              password: 'pass'
            },
            type: 'http',
            country: 'XX',
            lastUsed: 0,
            successCount: 0,
            failCount: 0
          };
        });

      console.log(`✅ ${proxies.length} proxies públicos convertidos correctamente`);
      return proxies;
    } catch (err) {
      console.error('❌ Error al obtener proxies desde multiProxies:', err.message);
      return [];
    }
  }
}
