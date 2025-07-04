import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
dotenv.config();

const PROXY_FILE = path.resolve('src/proxies/webshare_proxies.json');

export default class WebshareProxyManager {
  static async getProxies() {
    const USER = process.env.WEBSHARE_RESIDENTIAL_USER;
    const PASS = process.env.WEBSHARE_RESIDENTIAL_PASS;
    
    if (!USER || USER.trim() === "" || !PASS || PASS.trim() === "") {
      console.error('❌ ERROR CRÍTICO: Credenciales residenciales vacías o no configuradas');
      console.error('   Verifica tus variables WEBSHARE_RESIDENTIAL_USER y WEBSHARE_RESIDENTIAL_PASS en .env');
      return [];
    }

    console.log(`🚀 Usando proxy residencial rotativo de Webshare con usuario: ${USER}`);
    
    // Solo necesitamos un proxy ya que es rotativo
    const proxy = {
      ip: 'p.webshare.io',
      port: 80,
      auth: {
        username: USER.trim(),
        password: PASS.trim()
      },
      type: 'http',
      country: 'RESIDENTIAL',
      lastUsed: 0,
      successCount: 0,
      failCount: 0,
      isRotating: true,
      source: 'webshare_residential'
    };

    // Guardamos el proxy para uso posterior
    fs.writeFileSync(PROXY_FILE, JSON.stringify([proxy], null, 2));
    console.log(`💾 Proxy de Webshare guardado en ${PROXY_FILE}`);
    return [proxy];
  }
}
