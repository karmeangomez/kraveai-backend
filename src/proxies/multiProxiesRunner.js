import axios from 'axios';

export default class MultiProxiesRunner {
  static async getProxies() {
    try {
      console.log('🌐 Fetching proxies from multiProxies (public sources)...');

      // Fuente pública confiable de proxies HTTP
      const { data } = await axios.get('https://raw.githubusercontent.com/TheSpeedX/SOCKS-List/master/http.txt');

      const proxies = data
        .split('\n')
        .filter(line => line.includes(':'))
        .slice(0, 50) // Puedes ajustar la cantidad si deseas más
        .map(ipPort => `${ipPort}:user:pass`); // Añade auth falsa para compatibilidad

      console.log(`✅ ${proxies.length} proxies públicos obtenidos desde multiProxies`);
      return proxies;
    } catch (error) {
      console.error('❌ Error al obtener proxies desde multiProxies:', error.message);
      return [];
    }
  }
}
