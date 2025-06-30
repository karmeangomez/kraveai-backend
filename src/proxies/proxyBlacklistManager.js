import fs from 'fs';
import path from 'path';

const BLACKLIST_FILE = path.resolve('src/proxies/blacklist.json');
let blacklistedProxies = new Set();

// Cargar blacklist desde archivo al iniciar
(function loadBlacklist() {
  try {
    if (fs.existsSync(BLACKLIST_FILE)) {
      const data = JSON.parse(fs.readFileSync(BLACKLIST_FILE, 'utf-8'));
      blacklistedProxies = new Set(data);
      console.log(`🗂️ Blacklist cargada con ${blacklistedProxies.size} proxies`);
    }
  } catch (err) {
    console.error('❌ Error cargando blacklist:', err.message);
  }
})();

// Guardar blacklist actual al archivo
function saveBlacklist() {
  try {
    fs.writeFileSync(BLACKLIST_FILE, JSON.stringify([...blacklistedProxies], null, 2));
  } catch (err) {
    console.error('❌ Error guardando blacklist:', err.message);
  }
}

export const isProxyBlacklisted = (proxy) => {
  if (!proxy || !proxy.ip) return false;
  const key = `${proxy.ip}:${proxy.port}`;
  return blacklistedProxies.has(key);
};

export const addToBlacklist = (proxy) => {
  if (!proxy || !proxy.ip) {
    console.error('❌ Proxy inválido para añadir a blacklist:', proxy);
    return;
  }

  const key = `${proxy.ip}:${proxy.port}`;
  blacklistedProxies.add(key);
  console.log(`⛔ Proxy añadido a blacklist: ${key}`);
  saveBlacklist();
};

export const removeFromBlacklist = (proxy) => {
  if (!proxy || !proxy.ip) return;

  const key = `${proxy.ip}:${proxy.port}`;
  blacklistedProxies.delete(key);
  console.log(`✅ Proxy removido de blacklist: ${key}`);
  saveBlacklist();
};

export const getBlacklistedCount = () => blacklistedProxies.size;
