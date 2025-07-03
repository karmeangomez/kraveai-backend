import axios from 'axios';

export async function getProxies() {
  try {
    console.log('🕵️‍♂️ Cargando proxies desde SwiftShadow...');

    const { data } = await axios.get(
      'https://raw.githubusercontent.com/roosterkid/openproxylist/main/SOCKS5.txt',
      { timeout: 15000 }
    );

    const proxies = data
      .split('\n')
      .filter(line => {
        const parts = line.trim().split(':');
        return parts.length === 2 && 
               !isNaN(parts[1]) && 
               parts[1].trim() !== 'NaN' && 
               !line.includes('Support us') && 
               !line.includes('ETH') &&
               parts[0].split('.').length === 4; // Asegura que la IP tenga 4 octetos
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

    console.log(`✅ ${proxies.length} proxies públicos cargados desde SwiftShadow`);
    return proxies;
  } catch (err) {
    console.error('❌ Error en SwiftShadow:', err.message);
    return [];
  }
}
