import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import axios from 'axios';
import { validateProxy } from '../utils/validator.js';

dotenv.config();

const PROXY_FILE = path.resolve('src/proxies/webshare_proxies.json');
const PROXY_LIST_FILE = path.resolve('src/proxies/proxies.txt');

// 🌐 Fuentes públicas (HTTP sin auth)
const publicSources = [
  'https://raw.githubusercontent.com/TheSpeedX/PROXY-List/master/http.txt',
  'https://proxyspace.pro/http.txt',
  'https://raw.githubusercontent.com/monosans/proxy-list/main/proxies/http.txt',
  'https://raw.githubusercontent.com/mertguvencli/http-proxy-list/main/proxy-list/data.txt',
  'https://raw.githubusercontent.com/officialputuid/KangProxy/KangProxy/http/http.txt',
  'https://raw.githubusercontent.com/ShiftyTR/Proxy-List/master/http.txt',
  'https://www.proxy-list.download/api/v1/get?type=http'
];

export default class WebshareProxyManager {
  static async getProxies() {
    const USER = process.env.WEBSHARE_RESIDENTIAL_USER?.trim();
    const PASS = process.env.WEBSHARE_RESIDENTIAL_PASS?.trim();
    const allProxies = [];

    // 1️⃣ Añadir Webshare (rotativo)
    if (USER && PASS) {
      allProxies.push({
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
      });
    } else {
      console.warn('⚠️ Webshare no configurado en .env');
    }

    // 2️⃣ Leer proxies personalizados de proxies.txt
    if (fs.existsSync(PROXY_LIST_FILE)) {
      const lines = fs.readFileSync(PROXY_LIST_FILE, 'utf-8')
        .split('\n')
        .map(line => line.trim())
        .filter(line => line && !line.startsWith('#'));

      for (const line of lines) {
        const [ip, port, username, password] = line.split(':');
        if (ip && port && username && password) {
          allProxies.push({
            ip,
            port: parseInt(port),
            auth: { username, password },
            type: 'http',
            country: 'UNKNOWN',
            lastUsed: 0,
            successCount: 0,
            failCount: 0,
            isRotating: false,
            source: 'custom_list'
          });
        } else {
          console.warn(`⚠️ Proxy mal formado en proxies.txt: ${line}`);
        }
      }
    }

    // 3️⃣ Descargar proxies públicos (sin auth)
    for (const url of publicSources) {
      try {
        const { data } = await axios.get(url, { timeout: 10000 });
        const proxies = data
          .split('\n')
          .map(p => p.trim())
          .filter(p => /^\d{1,3}(\.\d{1,3}){3}:\d{2,5}$/.test(p));
        for (const entry of proxies) {
          const [ip, port] = entry.split(':');
          allProxies.push({
            ip,
            port: parseInt(port),
            auth: null,
            type: 'http',
            country: 'PUBLIC',
            lastUsed: 0,
            successCount: 0,
            failCount: 0,
            isRotating: false,
            source: 'public'
          });
        }
        console.log(`📥 ${proxies.length} proxies cargados de ${url}`);
      } catch (err) {
        console.warn(`❌ Error al obtener proxies de ${url}: ${err.message}`);
      }
    }

    // 4️⃣ Validar todos los proxies (Webshare, personalizados y públicos)
    console.log(`🔍 Validando ${allProxies.length} proxies...`);
    const validProxies = [];
    for (const proxy of allProxies) {
      const isValid = await validateProxy(proxy);
      if (isValid) {
        validProxies.push(proxy);
        console.log(`✅ Proxy válido: ${proxy.ip}:${proxy.port} (${proxy.source})`);
      } else {
        console.warn(`❌ Proxy inválido: ${proxy.ip}:${proxy.port} (${proxy.source})`);
      }
    }

    // 5️⃣ Guardar resultados
    try {
      const dir = path.dirname(PROXY_FILE);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(PROXY_FILE, JSON.stringify(validProxies, null, 2));
      console.log(`💾 ${validProxies.length} proxies válidos guardados en ${PROXY_FILE}`);
    } catch (err) {
      console.error(`❌ Error al guardar ${PROXY_FILE}: ${err.message}`);
    }

    return validProxies;
  }
}