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

    const proxies = res.data.results.map(proxy => ({
      ip: proxy.proxy_address,
      port: proxy.ports.socks5,
      auth: {
        username: proxy.username,
        password: proxy.password
      },
      type: 'socks5'
    }));

    fs.writeFileSync(savePath, JSON.stringify(proxies, null, 2));
    console.log(`✅ ${proxies.length} proxies guardados en ${savePath}`);
  } catch (err) {
    console.error('❌ Error al descargar proxies:', err.message);
  }
}

fetchWebshareProxies();
