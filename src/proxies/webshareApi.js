// 📁 src/proxies/webshareApi.js
import axios from 'axios';
import fs from 'fs';
import path from 'path';

const API_KEY = process.env.WEBSHARE_API_KEY || 'pviun7nhput7prysuda9v3i5s53pdulwjothsdnj';
const PROXY_FILE = path.resolve('src/proxies/proxies.json');
const CACHE_TIME = 30 * 60 * 1000; // 30 minutos

const PROXY_TYPES = {
  RESIDENTIAL: 'residential',
  MOBILE: 'mobile',
  DATACENTER: 'datacenter'
};

export default class WebshareProxyManager {
  static async fetchProxies(proxyType = PROXY_TYPES.RESIDENTIAL, limit = 50) {
    try {
      const response = await axios.get('https://proxy.webshare.io/api/v2/proxy/list/', {
        headers: {
          'Authorization': `Token ${API_KEY}`,
          'Content-Type': 'application/json'
        },
        params: {
          mode: 'direct',
          page: 1,
          page_size: limit,
          proxy_type: proxyType,
          countries: 'us,gb,ca,de,fr,es',
          valid: true
        },
        timeout: 15000
      });

      // Manejo de nueva estructura de respuesta
      return response.data.results.map(proxy => ({
        ip: proxy.proxy_address,
        port: proxy.ports.http || Object.values(proxy.ports)[0], // Solución para estructura cambiada
        auth: {
          username: proxy.username,
          password: proxy.password
        },
        country: proxy.country_code,
        city: proxy.city_name,
        type: 'http',
        lastUsed: 0,
        successCount: 0,
        failCount: 0,
        lastChecked: Date.now(),
        isp: proxy.isp
      }));
    } catch (error) {
      console.error('❌ Error obteniendo proxies de Webshare:', error.response?.data || error.message);
      return [];
    }
  }

  static async refreshProxies() {
    try {
      console.log('🔄 Actualizando proxies desde Webshare...');
      
      const [residential, mobile] = await Promise.all([
        this.fetchProxies(PROXY_TYPES.RESIDENTIAL, 30),
        this.fetchProxies(PROXY_TYPES.MOBILE, 20)
      ]);
      
      const proxies = [...residential, ...mobile];
      
      if (proxies.length > 0) {
        fs.writeFileSync(PROXY_FILE, JSON.stringify(proxies, null, 2));
        console.log(`✅ ${proxies.length} proxies actualizados (${residential.length} residenciales, ${mobile.length} móviles)`);
      } else {
        console.warn('⚠️ No se obtuvieron nuevos proxies, usando caché existente');
      }
      
      return proxies;
    } catch (error) {
      console.error('❌ Error crítico actualizando proxies:', error);
      return this.getCachedProxies();
    }
  }

  static getCachedProxies() {
    try {
      if (fs.existsSync(PROXY_FILE)) {
        const data = fs.readFileSync(PROXY_FILE, 'utf-8');
        const proxies = JSON.parse(data);
        
        // Filtrar proxies verificados recientemente
        const freshProxies = proxies.filter(p => 
          p.lastChecked && (Date.now() - p.lastChecked) < 48 * 60 * 60 * 1000
        );
        
        if (freshProxies.length > 0) {
          console.log(`♻️ Usando ${freshProxies.length} proxies en caché`);
          return freshProxies;
        }
      }
    } catch (error) {
      console.error('❌ Error cargando proxies en caché:', error.message);
    }
    return [];
  }

  static async getProxies(forceRefresh = false) {
    // Forzar refresco si no hay proxies o si pasó el tiempo de caché
    if (forceRefresh || !fs.existsSync(PROXY_FILE) || 
        (Date.now() - fs.statSync(PROXY_FILE).mtimeMs) > CACHE_TIME) {
      return await this.refreshProxies();
    }
    return this.getCachedProxies();
  }
}
