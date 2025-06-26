// src/proxies/proxyBlacklistManager.js
import fs from 'fs';
import path from 'path';

const BLACKLIST_PATH = path.resolve('./src/proxies/blacklist_auth.json');
const COOLDOWN_MS = 30 * 60 * 1000; // 30 minutos

function loadBlacklist() {
  if (!fs.existsSync(BLACKLIST_PATH)) return {};
  try {
    const data = fs.readFileSync(BLACKLIST_PATH, 'utf-8');
    return JSON.parse(data);
  } catch {
    return {};
  }
}

function saveBlacklist(blacklist) {
  fs.writeFileSync(BLACKLIST_PATH, JSON.stringify(blacklist, null, 2));
}

export function isProxyBlacklisted(proxy) {
  const blacklist = loadBlacklist();
  const timestamp = blacklist[proxy];
  if (!timestamp) return false;

  const expired = Date.now() - timestamp > COOLDOWN_MS;
  if (expired) {
    delete blacklist[proxy];
    saveBlacklist(blacklist);
    return false;
  }
  return true;
}

export function blacklistProxy(proxy) {
  const blacklist = loadBlacklist();
  blacklist[proxy] = Date.now();
  saveBlacklist(blacklist);
  console.warn(`⛔ Proxy enviado a blacklist por auth inválido: ${proxy}`);
}
