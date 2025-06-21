import axios from 'axios';

export default class SwiftShadowLoader {
  static async getProxies() {
    try {
      console.log('⚡ Cargando proxies desde SwiftShadow...');

      const { data } = await axios.get('https://raw.githubusercontent.com/mertguvencli/http-proxy-list/main/proxy-list/data.txt');

      const proxies = data
        .split('\n')
        .filter(line => line.includes(':'))
        .slice(0, 50)
        .map(ipPort => `${ipPort}:user:pass`);

      console.log(`✅ ${proxies.length} proxies de SwiftShadow cargados`);
      return proxies;
    } catch (error) {
      console.error('❌ Error al cargar proxies desde SwiftShadow:', error.message);
      return [];
    }
  }
}
