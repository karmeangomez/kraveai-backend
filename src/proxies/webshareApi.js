import axios from 'axios';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
dotenv.config();

const PROXY_FILE = path.resolve('src/proxies/proxies.json');
const API_KEY = process.env.WEBSHARE_API_KEY;

export default class WebshareProxyManager {
  static async getProxies() {
    // 1. Intenta cargar proxies existentes
    if (fs.existsSync(PROXY_FILE)) {
      try {
        const cached = JSON.parse(fs.readFileSync(PROXY_FILE, 'utf-8'));
        if (cached.length > 0) {
          console.log(`♻️ Usando ${cached.length} proxies de Webshare en caché`);
          return cached;
        }
      } catch (e) {
        console.warn('⚠️ Error cargando caché de proxies, regenerando...');
      }
    }

    // 2. Obtener proxies reales del API
    try {
      console.log('🌐 Obteniendo proxies rotativos de Webshare...');
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

      // 3. Filtrar y formatear - CORRECCIÓN CLAVE AQUÍ
      const proxies = response.data.results.map(proxy => ({
        ip: proxy.proxy_address,
        port: proxy.port,  // Usar directamente proxy.port en lugar de proxy.ports
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

      // 4. Guardar en el archivo principal
      fs.writeFileSync(PROXY_FILE, JSON.stringify(proxies, null, 2));
      console.log(`✅ ${proxies.length} proxies rotativos obtenidos de Webshare`);
      return proxies;

    } catch (error) {
      console.error('❌ Error obteniendo proxies de Webshare:', error.response?.data || error.message);
      return [];
    }
  }

  static async refreshProxies() {
    // Borrar caché para forzar nueva descarga
    if (fs.existsSync(PROXY_FILE)) fs.unlinkSync(PROXY_FILE);
    return this.getProxies();
  }
  
  static async getCachedProxies() {
    if (!fs.existsSync(PROXY_FILE)) return [];
    return JSON.parse(fs.readFileSync(PROXY_FILE, 'utf-8'));
  }
}
