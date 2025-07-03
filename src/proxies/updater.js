// src/proxies/updater.js
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import axios from 'axios';

dotenv.config();

const WEBSHARE_API_KEY = process.env.WEBSHARE_API_KEY;
const count = parseInt(process.argv.find(arg => arg.startsWith('--count='))?.split('=')[1] || '50');

if (!WEBSHARE_API_KEY) {
  console.error('❌ Falta WEBSHARE_API_KEY en .env');
  process.exit(1);
}

const savePath = path.resolve('./src/proxies/proxies.json');

async function fetchWebshareProxies() {
  try {
    const res = await axios.get(`https://proxy.webshare.io/api/v2/proxy/list/?mode=direct&page=1&page_size=${count}`, {
      headers: {
        Authorization: `Token ${WEBSHARE_API_KEY}`
      }
    });

    const proxies = res.data.results
      .map(proxy => {
        const ports = proxy.ports || {};
        const port = ports.socks5 || ports.https || ports.http || Object.values(ports)[0];

        if (!port) return null; // Saltar proxies sin puerto

        return {
          ip: proxy.proxy_address,
          port,
          auth: {
            username: proxy.username,
            password: proxy.password
          },
          type: 'socks5' // O 'http' si prefieres forzarlo
        };
      })
      .filter(Boolean); // Eliminar nulls

    if (proxies.length === 0) {
      console.error('❌ No se encontraron proxies válidos');
      process.exit(1);
    }

    fs.writeFileSync(savePath, JSON.stringify(proxies, null, 2));
    console.log(`✅ ${proxies.length} proxies guardados en ${savePath}`);
  } catch (err) {
    console.error('❌ Error al descargar proxies:', err.message);
  }
}

fetchWebshareProxies();
