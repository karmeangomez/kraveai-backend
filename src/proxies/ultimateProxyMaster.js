// src/proxies/ultimateProxyMaster.js
import fs from 'fs';
import axios from 'axios';
import path from 'path';

const premiumPath = path.resolve('config/premium_proxies.txt');
const backupPath = path.resolve('config/backup_proxies.txt');

const proxySources = {
  premium: [],
  public: [],
  all: [],
};

const getPublicProxies = async () => {
  const urls = [
    'https://raw.githubusercontent.com/TheSpeedX/PROXY-List/master/http.txt',
    'https://proxyspace.pro/http.txt',
    'https://raw.githubusercontent.com/clarketm/proxy-list/master/proxy-list-raw.txt',
    'https://raw.githubusercontent.com/mertguvencli/http-proxy-list/main/proxy-list/data.txt'
  ];

  const proxies = new Set();

  for (const url of urls) {
    try {
      const { data } = await axios.get(url, { timeout: 10000 });
      data.split('\n').forEach(p => p.trim() && proxies.add(`http://${p.trim()}`));
    } catch (e) {
      console.warn(`⚠️ Error al obtener proxies de ${url}`);
    }
  }

  return [...proxies];
};

const loadProxiesFromFile = (filePath) => {
  try {
    return fs.readFileSync(filePath, 'utf-8')
      .split('\n')
      .map(p => p.trim())
      .filter(p => p.length && !p.startsWith('#'))
      .map(p => p.startsWith('http') ? p : `http://${p}`);
  } catch {
    return [];
  }
};

const parseProxy = (proxyStr) => {
  const cleaned = proxyStr.replace(/^https?:\/\//, '');
  const [authHost, port] = cleaned.split(':').slice(-2);
  const [auth, ip] = authHost.includes('@') ? authHost.split('@') : [null, authHost];
  const [username, password] = auth ? auth.split(':') : [];

  return {
    string: proxyStr,
    ip,
    port: parseInt(port),
    auth: username && password ? { username, password } : null,
    type: proxyStr.includes('socks5://') ? 'socks5' : 'http'
  };
};

const validateProxy = async (proxyObj) => {
  try {
    const res = await axios.get('http://httpbin.org/ip', {
      proxy: {
        host: proxyObj.ip,
        port: proxyObj.port,
        auth: proxyObj.auth || undefined,
      },
      timeout: 5000
    });
    return res.status === 200;
  } catch {
    return false;
  }
};

const UltimateProxyMaster = {
  proxySources,

  async init() {
    const premium = loadProxiesFromFile(premiumPath);
    const backup = loadProxiesFromFile(backupPath);
    const publicRaw = await getPublicProxies();

    const parsedPremium = premium.map(parseProxy);
    const parsedBackup = backup.map(parseProxy);
    const parsedPublic = publicRaw.map(parseProxy);

    const validatedPremium = await Promise.all(parsedPremium.map(async p => await validateProxy(p) ? p : null));
    const validatedBackup = await Promise.all(parsedBackup.map(async p => await validateProxy(p) ? p : null));
    const validatedPublic = await Promise.all(parsedPublic.map(async p => await validateProxy(p) ? p : null));

    proxySources.premium = validatedPremium.filter(Boolean).map(p => p.string);
    proxySources.public = validatedPublic.filter(Boolean).map(p => p.string);
    proxySources.all = [...proxySources.premium, ...validatedBackup.filter(Boolean).map(p => p.string), ...proxySources.public];

    console.log(`✅ Proxy Master iniciado con ${proxySources.all.length} proxies funcionales`);
  },

  getWorkingProxies() {
    return proxySources.all.map(parseProxy);
  }
};

export default UltimateProxyMaster;
