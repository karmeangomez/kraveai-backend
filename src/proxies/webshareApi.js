import axios from 'axios';
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
      console.error('❌ Credenciales residenciales de Webshare no configuradas');
      return [];
    }

    console.log('🚀 Usando proxy residencial rotativo de Webshare');
    
    // Solo necesitamos un proxy ya que es rotativo
    const proxy = {
      ip: 'p.webshare.io',
      port: 80,
      auth: {
        username: USER,
        password: PASS
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
    return [proxy];
  }
}
