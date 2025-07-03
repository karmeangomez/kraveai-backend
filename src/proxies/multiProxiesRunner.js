import axios from 'axios';

export async function getProxies() {
  try {
    console.log('🌐 Cargando proxies desde multiProxies...');
    const { data } = await axios.get('https://raw.githubusercontent.com/TheSpeedX/SOCKS-List/master/http.txt', {
      timeout: 15000
    });

    const proxies = data
      .split('\n')
      .filter(line => {
        const parts = line.trim().split(':');
        return parts.length === 2 && !isNaN(parts[1]);
      })
      .slice(0, 50)
      .map(line => {
        const [ip, port] = line.trim().split(':');
        return {
          ip,
          port: parseInt(port),
          auth: null,
          type: 'http',
          country: 'XX',
          lastUsed: 0,
          successCount: 0,
          failCount: 0
        };
      });

    console.log(`✅ ${proxies.length} proxies públicos cargados desde multiProxies`);
    return proxies;
  } catch (err) {
    console.error('❌ Error en multiProxies:', err.message);
    return [];
  }
}
