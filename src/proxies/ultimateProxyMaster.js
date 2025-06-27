// src/proxies/ultimateProxyMaster.js
import fs from 'fs';
import path from 'path';
import ProxyRotationSystem from './proxyRotationSystem.js';
import { isProxyBlacklisted } from './proxyBlacklistManager.js';

export default async function ultimateProxyMaster() {
  let proxies = [];

  try {
    const data = fs.readFileSync(path.resolve('proxies.json'), 'utf-8');
    const parsed = JSON.parse(data);
    proxies = parsed.filter(p => !isProxyBlacklisted(p));
  } catch (err) {
    console.error('❌ Error leyendo proxies.json:', err.message);
  }

  if (!proxies.length) {
    console.warn('⚠️ No se encontraron proxies válidos.');
  } else {
    console.log(`✅ ${proxies.length} proxies cargados desde proxies.json`);
  }

  return new ProxyRotationSystem(proxies);
}
