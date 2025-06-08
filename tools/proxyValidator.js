// tools/proxyValidator.js - Valida todos los proxies de PROXY_LIST
require('dotenv').config();
const axios = require('axios');
const { HttpsProxyAgent } = require('https-proxy-agent');

const list = process.env.PROXY_LIST?.split(';') || [];
const TIMEOUT = 8000;
const TARGET = 'https://www.instagram.com/';

async function testProxy(proxy) {
  const full = proxy.startsWith('http') ? proxy : `http://${proxy}`;
  const agent = new HttpsProxyAgent(full);
  try {
    const res = await axios.get(TARGET, {
      httpsAgent: agent,
      timeout: TIMEOUT
    });
    console.log(`✅ FUNCIONAL: ${full} (Status ${res.status})`);
  } catch (err) {
    console.log(`❌ FALLÓ: ${full} → ${err.message}`);
  }
}

(async () => {
  if (!list.length) return console.log('⚠️ No hay proxies en PROXY_LIST');
  console.log(`🔎 Verificando ${list.length} proxies en PROXY_LIST\n`);
  for (const proxy of list) {
    await testProxy(proxy.trim());
  }
})();
