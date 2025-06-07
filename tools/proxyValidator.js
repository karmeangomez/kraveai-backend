const axios = require('axios');
const { HttpsProxyAgent } = require('https-proxy-agent');

const proxiesA = process.env.PROXY_LIST_A?.split(';') || [];
const proxiesB = process.env.PROXY_LIST_B?.split(';') || [];
const allProxies = proxiesA.concat(proxiesB).filter(Boolean);

async function testProxy(proxy) {
  const agent = new HttpsProxyAgent(`http://${proxy}`);
  try {
    const response = await axios.get('https://www.instagram.com', {
      httpsAgent: agent,
      timeout: 5000
    });
    console.log(`✅ FUNCIONAL: ${proxy} (Status: ${response.status})`);
  } catch (err) {
    console.error(`❌ FALLIDO: ${proxy} →`, err.message);
  }
}

(async () => {
  if (!allProxies.length) {
    console.error("No se encontraron proxies en las variables de entorno.");
    return;
  }

  console.log(`🔎 Verificando ${allProxies.length} proxies...
`);
  for (const proxy of allProxies) {
    await testProxy(proxy);
  }
})();
