// 📁 src/proxies/webshareApi.js
import axios from 'axios';
import fs from 'fs';
import path from 'path';

const API_KEY = 'pviun7nhput7prysuda9v3i5s53pdulwjothsdnj';
const PROXY_FILE = path.resolve('src/proxies/proxies.json');

// Tipos de proxy disponibles
const PROXY_TYPES = {
  RESIDENTIAL: 'residential',
  MOBILE: 'mobile',
  DATACENTER: 'datacenter'
};

export default class WebshareProxyManager {
  static async fetchProxies(proxyType = PROXY_TYPES.RESIDENTIAL, limit = 50) {
    try {
      const response = await axios.get('https://proxy.webshare.io/api/proxy/list/', {
        headers: {
          'Authorization': `Token ${API_KEY}`
        },
        params: {
          mode: 'direct',
          page: 1,
          page_size: limit,
          proxy_type: proxyType,
          countries: 'us,gb,ca'
        }
      });

      return response.data.results.map(proxy => ({
        ip: proxy.proxy_address,
        port: proxy.ports.socks5 || proxy.ports.http,
        auth: {
          username: proxy.username,
          password: proxy.password
        },
        country: proxy.country_code,
        city: proxy.city_name,
        type: 'socks5',
        lastUsed: 0,
        successCount: 0,
        failCount: 0
      }));
    } catch (error) {
      console.error('❌ Error obteniendo proxies de Webshare:', error.message);
      return [];
    }
  }

  static async refreshProxies() {
    try {
      // Obtener proxies residenciales y móviles
      const residential = await this.fetchProxies(PROXY_TYPES.RESIDENTIAL, 30);
      const mobile = await this.fetchProxies(PROXY_TYPES.MOBILE, 20);
      
      const proxies = [...residential, ...mobile];
      
      // Guardar en archivo
      fs.writeFileSync(PROXY_FILE, JSON.stringify(proxies, null, 2));
      console.log(`✅ ${proxies.length} proxies de Webshare actualizados`);
      
      return proxies;
    } catch (error) {
      console.error('❌ Error crítico actualizando proxies:', error);
      return [];
    }
  }

  static async getProxies() {
    try {
      // Intentar cargar de archivo primero
      const data = fs.readFileSync(PROXY_FILE, 'utf-8');
      return JSON.parse(data);
    } catch {
      // Si no existe, obtener nuevos
      return await this.refreshProxies();
    }
  }
}
