import fs from 'fs';
import axios from 'axios';
import path from 'path';

const premiumPath = path.resolve('config/premium_proxies.txt');
const publicPath = path.resolve('config/backup_proxies.txt');

let workingProxies = [];
let proxySources = {
  premium: [],
  public: []
};

async function fetchPublicProxies() {
  const urls = [
    'https://raw.githubusercontent.com/TheSpeedX/PROXY-List/master/http.txt',
    'https://proxyspace.pro/http.txt',
    'https://api.proxyscrape.com/v2/?request=getproxies&protocol=http&timeout=3000'
  ];

  const all = await Promise.allSettled(urls.map(u => axios.get(u, { timeout: 10000 })));
  const combined = all
    .filter(r => r.status === 'fulfilled')
    .flatMap(r => r.value.data.split('\n'))
    .map(p => p.trim())
    .filter(p => /^[\d.:]+$/.test(p));

  return [...new Set(combined)];
}

async function loadProxies() {
  try {
    const premium = fs.readFileSync(premiumPath, 'utf-8')
      .split('\n')
      .map(p => p.trim())
      .filter(Boolean);

    const publicFetched = await fetchPublicProxies();
    fs.writeFileSync(publicPath, publicFetched.join('\n'));

    const publicProxies = publicFetched.map(p => `http://${p}`);

    const all = [...premium.map(p => `http://${p}`), ...publicProxies];
    const parsed = all.map(str => {
      const [protocol, rest] = str.includes('://') ? str.split('://') : ['http', str];
      const [ip, port, user, pass] = rest.split(/:|@/);
      return {
        ip,
        port,
        auth: user ? { username: user, password: pass } : null,
        type: protocol,
        string: `${protocol}://${rest}`
      };
    });

    proxySources.premium = premium.map(p => `http://${p}`);
    proxySources.public = publicProxies;
    workingProxies = parsed;
  } catch (e) {
    console.error('❌ Error cargando proxies:', e.message);
  }
}

function getWorkingProxies() {
  return workingProxies;
}

await loadProxies();

export default {
  getWorkingProxies,
  proxySources,
  reload: loadProxies
};
