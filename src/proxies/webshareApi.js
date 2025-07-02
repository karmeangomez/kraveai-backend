// 📁 src/proxies/webshareApi.js
import axios from 'axios';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import testProxy from './proxyTester.js'; // ✅ Importa el validador

// 🔐 Forzar carga del .env desde la raíz del proyecto
dotenv.config({ path: path.resolve('./.env') });

const API_KEY = process.env.WEBSHARE_API_KEY;
const PROXY_FILE = path.resolve('src/proxies/proxies.json');

const PROXY_TYPES = {
  RESIDENTIAL: 'residential',
  MOBILE: 'mobile'
};

export default class WebshareProxyManager {
  static async fetchProxies(proxyType = PROXY_TYPES.RESIDENTIAL, limit = 50) {
    if (!API_KEY || API_KEY.length < 20) {
      console.error('❌ WEBSHARE_API_KEY no definido o inválido');
      return [];
    }

    try {
      const response = await axios.get('https://proxy.webshare.io/api/v2/proxy/list/', {
        headers: {
          Authorization: `Token ${API_KEY}`,
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

      return response.data.results.map(proxy => {
        let port = 80;
        if (proxy.ports) {
          port = proxy.ports.http ||
                 proxy.ports.https ||
                 proxy.ports.socks5 ||
                 Object.values(proxy.ports)[0];
        }

        return {
          ip: proxy.proxy_address,
          port,
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
        };
      });
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

      const rawProxies = [...residential, ...mobile].filter(Boolean);

      console.log(`⚙️ Validando ${rawProxies.length} proxies...`);
      const validProxies = [];

      for (const proxy of rawProxies) {
        const result = await testProxy(proxy);
        if (result.working) {
          validProxies.push(proxy);
          console.log(`✅ Proxy válido: ${proxy.ip}:${proxy.port}`);
        } else {
          console.log(`❌ Falló: ${proxy.ip}:${proxy.port} (${result.error})`);
        }
      }

      if (validProxies.length > 0) {
        fs.writeFileSync(PROXY_FILE, JSON.stringify(validProxies, null, 2));
        console.log(`✅ ${validProxies.length} proxies válidos guardados`);
        return validProxies;
      }

      throw new Error('No se obtuvieron proxies válidos');
    } catch (error) {
      console.error('❌ Error actualizando proxies:', error.message);
      return this.getCachedProxies();
    }
  }

  static getCachedProxies() {
    try {
      if (fs.existsSync(PROXY_FILE)) {
        const data = fs.readFileSync(PROXY_FILE, 'utf-8');
        return JSON.parse(data);
      }
    } catch (error) {
      console.error('❌ Error cargando proxies en caché:', error);
    }
    return [];
  }

  static async getProxies(forceRefresh = false) {
    if (forceRefresh || !fs.existsSync(PROXY_FILE)) {
      return await this.refreshProxies();
    }

    const stats = fs.statSync(PROXY_FILE);
    const now = Date.now();
    const diff = (now - stats.mtimeMs) / 1000 / 60;

    if (diff > 30) {
      return await this.refreshProxies();
    }

    return this.getCachedProxies();
  }
}
