import cheerio from 'cheerio';
import axios from 'axios';

/**
 * Extrae proxies públicos desde múltiples fuentes web
 * Devuelve un array de objetos tipo:
 * { ip: string, port: number, type: 'http', source: string }
 */
export default async function getPublicProxies() {
  const proxies = [];

  try {
    // Fuente 1: ProxyScrape
    const proxyScrapeRes = await axios.get('https://api.proxyscrape.com/v2/?request=displayproxies&protocol=http&timeout=10000&country=all&ssl=all&anonymity=all');
    const proxyScrapeList = proxyScrapeRes.data
      .split('\n')
      .map(p => p.trim())
      .filter(Boolean);
    for (const line of proxyScrapeList) {
      const [ip, port] = line.split(':');
      if (ip && port) {
        proxies.push({
          ip,
          port: parseInt(port),
          type: 'http',
          source: 'proxyscrape'
        });
      }
    }
  } catch (e) {
    console.error('⚠️ Error obteniendo de ProxyScrape:', e.message);
  }

  try {
    // Fuente 2: ProxyNova (scraping HTML)
    const res = await axios.get('https://www.proxynova.com/proxy-server-list/');
    const $ = cheerio.load(res.data);
    $('table#tbl_proxy_list tbody tr').each((i, el) => {
      const ipRaw = $(el).find('td:nth-child(1)').text().trim();
      const port = $(el).find('td:nth-child(2)').text().trim();
      const ip = ipRaw.replace(/document\.write\(['"]?|['"]?\);?/g, '').trim();
      if (ip && port && !ip.includes('Proxy')) {
        proxies.push({
          ip,
          port: parseInt(port),
          type: 'http',
          source: 'proxynova'
        });
      }
    });
  } catch (e) {
    console.error('⚠️ Error obteniendo de ProxyNova:', e.message);
  }

  try {
    // Fuente 3: ProxyScan.io
    const res = await axios.get('https://www.proxyscan.io/api/proxy?format=json&type=http&limit=20');
    if (Array.isArray(res.data)) {
      for (const p of res.data) {
        proxies.push({
          ip: p.Ip,
          port: p.Port,
          type: 'http',
          source: 'proxyscan'
        });
      }
    }
  } catch (e) {
    console.error('⚠️ Error obteniendo de ProxyScan:', e.message);
  }

  return proxies;
}
