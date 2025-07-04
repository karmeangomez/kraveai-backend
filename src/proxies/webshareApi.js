import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
dotenv.config();

const PROXY_FILE = path.resolve('src/proxies/webshare_proxies.json');

export default class WebshareProxyManager {
  static async getProxies() {
    const USER = process.env.WEBSHARE_RESIDENTIAL_USER;
    const PASS = process.env.WEBSHARE_RESIDENTIAL_PASS;

    if (!USER || !PASS) {
      console.error('❌ Credenciales Webshare faltantes en .env');
      return [];
    }

    const proxy = {
      ip: 'p.webshare.io',
      port: 80,
      auth: {
        username: USER.trim(),
        password: PASS.trim()
      },
      type: 'socks5',
      country: 'RESIDENTIAL',
      lastUsed: 0,
      successCount: 0,
      failCount: 0,
      isRotating: true,
      source: 'webshare_residential'
    };

    // Creamos 50 instancias simuladas del mismo proxy para la rotación interna
    const proxies = Array.from({ length: 50 }, () => ({ ...proxy }));

    fs.writeFileSync(PROXY_FILE, JSON.stringify(proxies, null, 2));
    console.log(`💾 50 proxies residenciales simulados guardados en ${PROXY_FILE}`);
    return proxies;
  }
}
