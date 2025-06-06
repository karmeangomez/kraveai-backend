// ✅ proxyBank.js funcional con getNextProxy exportado correctamente
const proxies = [
  { host: 'p.webshare.io', port: 80, username: 'pdsmombq-rotate', password: 'terqdq67j6mp', lastFail: null, failCount: 0, lastSuccess: null },
  { host: 'p.webshare.io', port: 80, username: 'pdsmombq-rotate', password: 'terqdq67j6mp', lastFail: null, failCount: 0, lastSuccess: null },
  { host: 'p.webshare.io', port: 80, username: 'pdsmombq-rotate', password: 'terqdq67j6mp', lastFail: null, failCount: 0, lastSuccess: null }
];

const FAIL_COOLDOWN = 5 * 60 * 1000; // 5 minutos
let lastIndex = 0;

function getProxy() {
  if (proxies.length === 0) {
    console.error("proxyBank: No hay proxies configurados.");
    return null;
  }
  const now = Date.now();
  const n = proxies.length;
  for (let i = 0; i < n; i++) {
    const idx = (lastIndex + i) % n;
    const proxy = proxies[idx];
    if (proxy.lastFail && (now - proxy.lastFail) < FAIL_COOLDOWN) continue;
    lastIndex = idx + 1;
    return `${proxy.username}:${proxy.password}@${proxy.host}:${proxy.port}`;
  }
  return null;
}

function getNextProxy() {
  return getProxy();
}

function reportFailure(proxy) {
  const match = proxies.find(p => `${p.username}:${p.password}@${p.host}:${p.port}` === proxy);
  if (match) {
    match.lastFail = Date.now();
    match.failCount = (match.failCount || 0) + 1;
    console.log(`proxyBank: Proxy ${proxy} marcado como FAIL.`);
  }
}

function reportSuccess(proxy) {
  const match = proxies.find(p => `${p.username}:${p.password}@${p.host}:${p.port}` === proxy);
  if (match) {
    match.lastSuccess = Date.now();
    match.failCount = 0;
    console.log(`proxyBank: Proxy ${proxy} marcado como OK.`);
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
