// tools/proxyValidator.js - Validador inteligente de proxies Webshare
require('dotenv').config();
const fs = require('fs');
const axios = require('axios');
const { HttpsProxyAgent } = require('https-proxy-agent');
const path = require('path');

const rawList = process.env.PROXY_LIST_A || '';
const proxies = rawList.split(';').map(p => p.trim()).filter(p => p);

const TIMEOUT = 7000;
const TEST_URL = 'https://www.instagram.com';
const valid = [];
const failed = [];

async function validate(proxy) {
  const agent = new HttpsProxyAgent(`http://${proxy}`);
  try {
    const res = await axios.get(TEST_URL, {
      httpsAgent: agent,
      timeout: TIMEOUT
    });
    if (res.status === 200) {
      console.log(`✅ FUNCIONAL: ${proxy}`);
      valid.push(proxy);
    } else {
      console.log(`❌ RECHAZADO: ${proxy} → HTTP ${res.status}`);
      failed.push(proxy);
    }
  } catch (err) {
    console.log(`❌ FALLÓ: ${proxy} → ${err.message}`);
    failed.push(proxy);
  }
}

(async () => {
  console.log(`🔎 Validando ${proxies.length} proxies...");
  for (const proxy of proxies) {
    await validate(proxy);
  }
  const resultPath = path.join(__dirname, 'proxies_validos.txt');
  fs.writeFileSync(resultPath, valid.join('\n'));
  console.log(`\n✅ Completado. Proxies válidos: ${valid.length}`);
  console.log(`📁 Guardados en: ${resultPath}`);
})();
