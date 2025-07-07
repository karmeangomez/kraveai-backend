import * as cheerio from 'cheerio';
import axios from 'axios';

export async function getPublicProxies() {
  const proxies = [];

  // SwiftShadow
  try {
    const res = await axios.get('https://www.sslproxies.org/');
    const $ = cheerio.load(res.data);
    $('#proxylisttable tbody tr').each((i, el) => {
      const cols = $(el).find('td');
      const ip = $(cols[0]).text().trim();
      const port = $(cols[1]).text().trim();
      if (ip && port) {
        proxies.push({
          ip,
          port: parseInt(port),
          type: 'http',
          source: 'sslproxies.org'
        });
      }
    });
    console.log(`🌐 ${proxies.length} proxies extraídos de sslproxies.org`);
  } catch (error) {
    console.warn('⚠️ Error obteniendo de sslproxies.org:', error.message);
  }

  // ProxyNova
  try {
    const res = await axios.get('https://www.proxynova.com/proxy-server-list/');
    const $ = cheerio.load(res.data);
    $('table#tbl_proxy_list tbody tr').each((i, row) => {
      const ipScript = $(row).find('td:nth-child(1) script').html();
      const portText = $(row).find('td:nth-child(2)').text().trim();

      if (ipScript && portText) {
        const ipMatch = ipScript.match(/"(.+?)"/);
        if (ipMatch) {
          const ip = ipMatch[1];
          const port = parseInt(portText);
          if (ip && port) {
            proxies.push({
              ip,
              port,
              type: 'http',
              source: 'proxynova'
            });
          }
        }
      }
    });
    console.log(`🌐 ${proxies.length} proxies acumulados tras proxynova`);
  } catch (error) {
    console.warn('⚠️ Error obteniendo de proxynova:', error.message);
  }

  // ProxyShare.io
  try {
    const res = await axios.get('https://proxyshare.io/free-proxy-list');
    const $ = cheerio.load(res.data);
    $('table tbody tr').each((i, el) => {
      const cols = $(el).find('td');
      const ip = $(cols[0]).text().trim();
      const port = $(cols[1]).text().trim();
      const protocol = $(cols[2]).text().trim().toLowerCase();

      if (ip && port && (protocol === 'http' || protocol === 'https')) {
        proxies.push({
          ip,
          port: parseInt(port),
          type: 'http',
          source: 'proxyshare.io'
        });
      }
    });
    console.log(`🌐 ${proxies.length} proxies acumulados tras proxyshare.io`);
  } catch (error) {
    console.warn('⚠️ Error obteniendo de proxyshare.io:', error.message);
  }

  return proxies;
}
