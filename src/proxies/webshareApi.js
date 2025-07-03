import axios from 'axios';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
dotenv.config();

const PROXY_FILE = path.resolve('src/proxies/webshare_proxies.json');
const API_KEY = process.env.WEBSHARE_API_KEY;

export default class WebshareProxyManager {
  static async getProxies() {
    // Siempre obtener nuevos proxies (ignorar caché)
    console.log('🔄 Forzando obtención de nuevos proxies Webshare...');
    try {
      const response = await axios.get(
        'https://proxy.webshare.io/api/v2/proxy/list/',
        {
          headers: {
            'Authorization': `Token ${API_KEY}`
          },
          params: {
            mode: 'direct',
            page: 1,
            page_size: 100
          },
          timeout: 15000
        }
      );

      const proxies = response.data.results.map(proxy => ({
        ip: proxy.proxy_address,
        port: proxy.port,
        auth: {
          username: proxy.username,
          password: proxy.password
        },
        type: proxy.proxy_type,
        country: proxy.country_code,
        lastUsed: 0,
        successCount: 0,
        failCount: 0,
        isRotating: true,
        source: 'webshare'
      }));

      fs.writeFileSync(PROXY_FILE, JSON.stringify(proxies, null, 2));
      console.log(`✅ ${proxies.length} proxies rotativos obtenidos de Webshare`);
      return proxies;

    } catch (error) {
      console.error('❌ Error obteniendo proxies de Webshare:', error.response?.data || error.message);
      return [];
    }
  }

  // ... resto del código
}
