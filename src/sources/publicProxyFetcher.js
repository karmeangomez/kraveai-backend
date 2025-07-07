import axios from 'axios';
import cheerio from 'cheerio';

export default async function fetchPublicProxies() {
  console.log('🌐 Cargando proxies públicos desde múltiples fuentes...');
  const proxies = [];

  // Fuente 1: ProxyNova
  try {
    const response = await axios.get('https://www.proxynova.com/proxy-server-list/');
    const $ = cheerio.load(response.data);
    $('table#tbl_proxy_list tbody tr').each((_, row) => {
      const ipScript = $(row).find('td:nth-child(1) script').html();
      const ipMatch = ipScript && ipScript.match(/'(.+)'/);
      const ip = ipMatch ? ipMatch[1] : null;
      const port = $(row).find('td:nth-child(2)').text().trim();
      if (ip && port && !isNaN(port)) {
        proxies.push({
          ip,
          port: parseInt(port),
          type: 'http',
          source: 'proxynova',
          country: 'UNKNOWN',
          isRotating: false
        });
      }
    });
    console.log(`✅ ${proxies.length} proxies cargados de ProxyNova`);
  } catch (error) {
    console.warn('⚠️ No se pudo obtener proxies de ProxyNova:', error.message);
  }

  // Fuente 2: ProxyScrape HTTP
  try {
    const res = await axios.get('https://api.proxyscrape.com/v2/?request=getproxies&protocol=http&timeout=2000&country=all&ssl=all&anonymity=elite');
    const lines = res.data.split('\n').map(l => l.trim()).filter(l => l.includes(':'));
    for (const line of lines) {
      const [ip, port] = line.split(':');
      proxies.push({
        ip,
        port: parseInt(port),
        type: 'http',
        source: 'proxyscrape',
        country: 'UNKNOWN',
        isRotating: false
      });
    }
    console.log(`✅ ${lines.length} proxies cargados de ProxyScrape`);
  } catch (err) {
    console.warn('⚠️ No se pudo obtener proxies de ProxyScrape:', err.message);
  }

  // Fuente 3: Raw university proxies (opcional si compartes fuente exacta luego)
  // Puedes agregar más aquí...

  return proxies;
}
