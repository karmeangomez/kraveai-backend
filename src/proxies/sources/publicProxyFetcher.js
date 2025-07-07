import axios from 'axios';
import * as cheerio from 'cheerio';

export default async function fetchPublicProxies() {
  console.log('🌐 Cargando proxies públicos desde múltiples fuentes...');
  const proxies = [];

  const sources = [
    'https://www.proxy-list.download/HTTP',
    'https://free-proxy-list.net/',
    'https://www.sslproxies.org/',
    'https://www.us-proxy.org/',
    'https://free-proxy-list.net/uk-proxy.html',
    'https://spys.one/en/http-proxy-list/',
  ];

  for (const url of sources) {
    try {
      const res = await axios.get(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0',
          'Accept-Language': 'en-US,en;q=0.9',
        },
        timeout: 15000
      });

      const $ = cheerio.load(res.data);
      const rows = $('table tbody tr');

      rows.each((i, row) => {
        const cols = $(row).find('td');
        const ip = $(cols[0]).text().trim();
        const port = $(cols[1]).text().trim();
        const country = $(cols[3]).text().trim();
        const https = $(cols[6]).text().trim();

        if (ip && port && !ip.includes('...') && port.length <= 5) {
          proxies.push({
            ip,
            port: parseInt(port),
            type: https.toLowerCase() === 'yes' ? 'https' : 'http',
            country: country || 'UNKNOWN',
            auth: null,
            lastUsed: 0,
            source: 'public',
            successCount: 0,
            failCount: 0
          });
        }
      });

      console.log(`✅ ${url} → ${proxies.length} proxies acumulados`);
    } catch (err) {
      console.warn(`⚠️ Error al obtener proxies de ${url}: ${err.message}`);
    }
  }

  return proxies;
}
