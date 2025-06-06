// ✅ proxyBank.js compatible con proxy-chain y rotación inteligente
const proxies = [
  'pdsmombq-rotate:terqdq67j6mp@p.webshare.io:80',
  'pdsmombq-rotate:terqdq67j6mp@p.webshare.io:80',
  'pdsmombq-rotate:terqdq67j6mp@p.webshare.io:80'
];

const FAIL_COOLDOWN = 5 * 60 * 1000;
let lastIndex = 0;
const state = new Map();

function getNextProxy() {
  const now = Date.now();
  const n = proxies.length;
  for (let i = 0; i < n; i++) {
    const idx = (lastIndex + i) % n;
    const proxy = proxies[idx];
    const failInfo = state.get(proxy);
    if (failInfo && (now - failInfo.lastFail < FAIL_COOLDOWN)) continue;
    lastIndex = idx + 1;
    return proxy;
  }
  return null;
}

function reportFailure(proxy) {
  const now = Date.now();
  state.set(proxy, { lastFail: now, failCount: (state.get(proxy)?.failCount || 0) + 1 });
  console.warn(`⛔ Proxy FAIL: ${proxy}`);
}

function reportSuccess(proxy) {
  state.set(proxy, { lastFail: 0, failCount: 0 });
  console.log(`✅ Proxy OK: ${proxy}`);
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
