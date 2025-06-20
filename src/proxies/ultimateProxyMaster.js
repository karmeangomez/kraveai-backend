// src/proxies/ultimateProxyMaster.js
import fs from 'fs';
import path from 'path';
import SwiftShadowLoader from './swiftShadowLoader.js';
import MultiProxiesRunner from './multiProxiesRunner.js';

// Cargar proxies premium desde archivo
const PROXIES_FILE = path.resolve('src/proxies/proxies.json');

class UltimateProxyMaster {
  constructor() {
    this.proxySources = {
      premium: this.loadPremiumProxies(),
      swiftShadow: [],
      multiProxies: [],
      hrisikesh: [],
      public: []
    };
    this.init();
  }

  loadPremiumProxies() {
    try {
      const data = fs.readFileSync(PROXIES_FILE, 'utf8');
      const config = JSON.parse(data);
      return config.premium || [];
    } catch (error) {
      console.error('Error cargando proxies premium:', error);
      return [];
    }
  }

  // ... (resto del código permanece igual) ...
}

export default new UltimateProxyMaster();
