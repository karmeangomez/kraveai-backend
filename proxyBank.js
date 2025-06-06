// ✅ proxyBank.js corregido para proxies Webshare válidos con formato correcto
const proxies = [
  {
    host: 'p.webshare.io',
    port: 80,
    username: 'pdsmombq-rotate',
    password: 'terqdq67j6mp',
    lastFail: null,
    failCount: 0,
    lastSuccess: null
  },
  {
    host: 'p.webshare.io',
    port: 80,
    username: 'pdsmombq-rotate',
    password: 'terqdq67j6mp',
    lastFail: null,
    failCount: 0,
    lastSuccess: null
  },
  {
    host: 'p.webshare.io',
    port: 80,
    username: 'pdsmombq-rotate',
    password: 'terqdq67j6mp',
    lastFail: null,
    failCount: 0,
    lastSuccess: null
  }
];

const FAIL_COOLDOWN = 5 * 60 * 1000; // 5 minutos
let lastIndex = 0;

function getNextProxy() {
  const now = Date.now();
  const n = proxies.length;
  for (let i = 0; i < n; i++) {
    const idx = (lastIndex + i) % n;
    const proxy = proxies[idx];
    if (proxy.lastFail && (now - proxy.lastFail) < FAIL_COOLDOWN) continue;
    lastIndex = idx + 1;
    const proxyUrl = `${proxy.username}:${proxy.password}@${proxy.host}:${proxy.port}`;
    proxy.__url = proxyUrl; // guardamos la URL en el objeto para referencia
    return proxyUrl;
  }
  return null;
}

function reportFailure(proxyString) {
  const proxy = proxies.find(p => p.__url === proxyString);
  if (proxy) {
    proxy.lastFail = Date.now();
    proxy.failCount = (proxy.failCount || 0) + 1;
    console.warn(`proxyBank: Proxy ${proxyString} marcado como FAIL.`);
  }
}

function reportSuccess(proxyString) {
  const proxy = proxies.find(p => p.__url === proxyString);
  if (proxy) {
    proxy.lastSuccess = Date.now();
    proxy.failCount = 0;
    console.log(`proxyBank: Proxy ${proxyString} marcado como OK.`);
  }
}

function count() {
  return proxies.length;
}

module.exports = {
  getNextProxy,
  reportFailure,
  reportSuccess,
  count
};
