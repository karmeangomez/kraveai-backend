import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { validateProxy } from '../utils/validator.js';

dotenv.config();

const PROXY_FILE = path.resolve('src/proxies/webshare_proxies.json');

export default class WebshareProxyManager {
  static async getProxies() {
    const USER = process.env.WEBSHARE_RESIDENTIAL_USER?.trim();
    const PASS = process.env.WEBSHARE_RESIDENTIAL_PASS?.trim();

    if (!USER || !PASS) {
      console.error('❌ Credenciales Webshare faltantes en .env');
      throw new Error('Faltan WEBSHARE_RESIDENTIAL_USER o WEBSHARE_RESIDENTIAL_PASS en .env');
    }

    const proxy = {
      ip: 'p.webshare.io',
      port: 80,
      auth: { username: USER, password: PASS },
      type: 'http',
      country: 'RESIDENTIAL',
      lastUsed: 0,
      successCount: 0,
      failCount: 0,
      isRotating: true,
      source: 'webshare_residential'
    };

    const isValid = await validateProxy(proxy);
    if (!isValid) {
      console.error(`❌ Proxy ${proxy.ip}:${proxy.port} no es válido`);
      throw new Error('No se pudo validar el proxy de Webshare');
    }

    const proxies = [proxy];
    const proxyDir = path.dirname(PROXY_FILE);
    try {
      if (!fs.existsSync(proxyDir)) {
        fs.mkdirSync(proxyDir, { recursive: true });
      }
      fs.writeFileSync(PROXY_FILE, JSON.stringify(proxies, null, 2));
      console.log(`💾 Proxy residencial guardado en ${PROXY_FILE}`);
    } catch (error) {
      console.error(`❌ Error al guardar ${PROXY_FILE}: ${error.message}`);
      throw error;
    }

    return proxies;
  }
}
