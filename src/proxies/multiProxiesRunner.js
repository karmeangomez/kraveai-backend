import axios from 'axios';

export default async function runMultiProxies() {
  try {
    const sources = [
      'https://raw.githubusercontent.com/TheSpeedX/SOCKS-List/master/socks5.txt',
      'https://raw.githubusercontent.com/hookzof/socks5_list/master/proxy.txt',
      'https://api.proxyscrape.com/v2/?request=getproxies&protocol=socks5',
      'https://www.proxy-list.download/api/v1/get?type=socks5'
    ];

    const allProxies = [];
    
    for (const url of sources) {
      try {
        const response = await axios.get(url, { timeout: 10000 });
        let proxies = [];
        
        if (url.includes('github')) {
          proxies = response.data.split('\n');
        } else {
          proxies = response.data.split('\r\n');
        }
        
        const formattedProxies = proxies
          .map(line => line.trim())
          .filter(line => line && !line.startsWith('#'))
          .map(line => {
            const [ip, port] = line.split(':');
            return {
              ip: ip?.trim(),
              port: parseInt(port),
              type: 'socks5',
              source: 'public'
            };
          })
          .filter(p => p.ip && p.port > 0 && p.port < 65536);
        
        allProxies.push(...formattedProxies);
        console.log(`✅ ${formattedProxies.length} proxies de ${new URL(url).hostname}`);
      } catch (e) {
        console.warn(`⚠️ Error cargando ${url}: ${e.message}`);
      }
    }

    // Eliminar duplicados
    const uniqueProxies = allProxies.filter(
      (proxy, index, self) =>
        index === self.findIndex(p => p.ip === proxy.ip && p.port === proxy.port)
    );

    console.log(`📊 Total proxies públicos únicos: ${uniqueProxies.length}`);
    return uniqueProxies;

  } catch (error) {
    console.error('❌ Error crítico en multiProxies:', error);
    return [];
  }
}
