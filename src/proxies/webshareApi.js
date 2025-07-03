import axios from 'axios';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
dotenv.config();

const API_KEY = process.env.WEBSHARE_API_KEY;
const PROXY_FILE = path.resolve('src/proxies/proxies.json');

export default class WebshareProxyManager {
  static async fetchProxies(limit = 50) {
    if (!API_KEY || API_KEY.length < 20) {
      console.error('❌ WEBSHARE_API_KEY no definido o inválido');
      return [];
    }

    try {
      const res = await axios.get('https://proxy.webshare.io/api/v2/proxy/list/', {
        headers: { Authorization: `Token ${API_KEY}` },
        params: {
          mode: 'direct',
          page: 1,
          page_size: limit,
          proxy_type: 'socks5',
          countries: 'us,ca,mx,es',
          valid: true
        },
        timeout: 15000
      });

      return res.data.results.map(p => ({
        ip: p.proxy_address,
        port: p.ports?.socks5 || 1080,
        auth: {
          username: p.username,
          password: p.password
        },
        type: 'socks5',
        country: p.country_code,
        isp: p.isp,
        lastUsed: 0,
        successCount: 0,
        failCount: 0,
        lastChecked: Date.now()
      }));
    } catch (err) {
      console.error('❌ Error obteniendo proxies de Webshare:', err.message);
      return [];
    }
  }

  static async refreshProxies() {
    console.log('🔄 Actualizando proxies desde Webshare...');
    const proxies = await this.fetchProxies();
    if (proxies.length > 0) {
      fs.writeFileSync(PROXY_FILE, JSON.stringify(proxies, null, 2));
      console.log(`✅ ${proxies.length} proxies actualizados`);
      return proxies;
    } else {
      console.warn('⚠️ No se recibieron proxies válidos. Usando caché...');
      return this.getCachedProxies();
    }
  }

  static getCachedProxies() {
    if (fs.existsSync(PROXY_FILE)) {
      const content = fs.readFileSync(PROXY_FILE, 'utf-8');
      return JSON.parse(content);
    }
    return [];
  }

  static async getProxies(forceRefresh = false) {
    const needRefresh = !fs.existsSync(PROXY_FILE) || ((Date.now() - fs.statSync(PROXY_FILE).mtimeMs) / 60000 > 30);
    return forceRefresh || needRefresh ? await this.refreshProxies() : this.getCachedProxies();
  }
}
