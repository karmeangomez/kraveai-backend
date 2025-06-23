// src/proxies/ultimateProxyMaster.js
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import swiftShadowLoader from './swiftshadow/swiftShadowLoader.js';
import multiProxiesRunner from './multiProxiesRunner.js';
import proxyScoreWatcher from './proxyScoreWatcher.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

class UltimateProxyMaster {
  constructor() {
    this.proxySources = {
      premium: [],
      public: [],
      swiftShadow: [],
      multiProxies: [],
      tor: []
    };
  }

  async loadAllProxies() {
    // 1. Cargar proxies premium desde archivo
    this.proxySources.premium = this.loadFromFile('../../config/proxies.json');
    
    // 2. Extraer proxies públicos
    this.proxySources.swiftShadow = await swiftShadowLoader.fetchMassiveProxies();
    
    // 3. Fuentes alternativas
    this.proxySources.multiProxies = await multiProxiesRunner.getProxies();
    
    // 4. Combinar todos los proxies (premium + públicos)
    const allProxies = [
      ...this.proxySources.premium,
      ...this.proxySources.swiftShadow,
      ...this.proxySources.multiProxies
    ];
    
    // 5. Validar y calificar (usando el validador)
    return await proxyScoreWatcher.validateProxies(allProxies);
  }

  loadFromFile(filePath) {
    const fullPath = path.resolve(__dirname, filePath);
    if (!fs.existsSync(fullPath)) {
      console.warn(`⚠️ Archivo de proxies no encontrado: ${fullPath}`);
      return [];
    }
    const rawData = fs.readFileSync(fullPath, 'utf8');
    const data = JSON.parse(rawData);
    return data.premium || [];
  }
}

// Exportamos una instancia única (singleton)
const ultimateProxyMaster = new UltimateProxyMaster();
export default ultimateProxyMaster;
