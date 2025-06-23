const fs = require('fs');
const path = require('path');
const swiftShadowLoader = require('./swiftshadow/swiftShadowLoader');
const multiProxiesRunner = require('./multiProxiesRunner');
const proxyScoreWatcher = require('./proxyScoreWatcher');

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
    this.proxySources.premium = this.loadFromFile('../config/proxies.json');
    
    // 2. Extraer 10,000 proxies públicos
    this.proxySources.swiftShadow = await swiftShadowLoader.fetchMassiveProxies();
    
    // 3. Fuentes alternativas
    this.proxySources.multiProxies = await multiProxiesRunner.getProxies();
    
    // 4. Validar y calificar
    return proxyScoreWatcher.validateProxies(
      [...this.proxySources.premium, ...this.proxySources.swiftShadow]
    );
  }

  loadFromFile(filePath) {
    const rawData = fs.readFileSync(path.resolve(__dirname, filePath));
    return JSON.parse(rawData).premium || [];
  }
}

module.exports = new UltimateProxyMaster();
