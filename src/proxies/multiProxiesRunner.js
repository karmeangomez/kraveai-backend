import axios from 'axios';

export default async function runMultiProxies() {
  try {
    console.log('🌐 Cargando proxies desde multiProxies...');

    const { data } = await axios.get('https://raw.githubusercontent.com/TheSpeedX/SOCKS-List/master/socks5.txt', {
      timeout: 10000
    });

    const proxies = data
      .split('\n')
      .filter(line => {
        const parts = line.trim().split(':');
        return parts.length === 2 && 
               !isNaN(parts[1]) && 
               parts[1].trim() !== 'NaN' && 
               !line.includes('Support us') && 
               !line.includes('ETH') &&
               parts[0].split('.').length === 4;
      })
      .slice(0, 50)
      .map(line => {
        const [ip, port] = line.trim().split(':');
        return {
          ip,
          port: parseInt(port),
          auth: null,
          type: 'socks5',
          country: 'XX',
          lastUsed: 0,
          successCount: 0,
          failCount: 0
        };
      });

    console.log(`✅ ${proxies.length} proxies públicos cargados desde multiProxies`);
    return proxies;
  } catch (err) {
    console.error('❌ Error cargando multiProxies:', err.message);
    return [];
  }
}
