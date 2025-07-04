import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
dotenv.config();

const PROXY_FILE = path.resolve('src/proxies/webshare_proxies.json');
const NUM_PROXIES = 50; // Puedes ajustar esta cantidad si quieres más o menos

export default class WebshareProxyManager {
  static async getProxies() {
    const USER = process.env.WEBSHARE_RESIDENTIAL_USER;
    const PASS = process.env.WEBSHARE_RESIDENTIAL_PASS;

    if (!USER || USER.trim() === "" || !PASS || PASS.trim() === "") {
      console.error('❌ ERROR: Credenciales residenciales vacías o no configuradas');
      return [];
    }

    console.log(`🚀 Usando proxy residencial rotativo de Webshare con usuario: ${USER}`);

    const baseProxy = {
      ip: 'p.webshare.io',
      port: 80,
      auth: {
        username: USER.trim(),
        password: PASS.trim()
      },
      type: 'http',
      country: 'RESIDENTIAL',
      isRotating: true,
      source: 'webshare_residential'
    };

    // Simulamos múltiples proxies virtuales para rotación real
    const proxies = Array.from({ length: NUM_PROXIES }).map((_, i) => ({
      ...baseProxy,
      id: i + 1,
      lastUsed: 0,
      successCount: 0,
      failCount: 0
    }));

    fs.writeFileSync(PROXY_FILE, JSON.stringify(proxies, null, 2));
    console.log(`💾 ${proxies.length} proxies residenciales simulados guardados en ${PROXY_FILE}`);
    return proxies;
  }

  static async refreshProxies() {
    if (fs.existsSync(PROXY_FILE)) fs.unlinkSync(PROXY_FILE);
    return this.getProxies();
  }

  static async getCachedProxies() {
    if (!fs.existsSync(PROXY_FILE)) return [];
    return JSON.parse(fs.readFileSync(PROXY_FILE, 'utf-8'));
  }
}
