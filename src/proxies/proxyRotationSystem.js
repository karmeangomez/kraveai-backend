// src/proxies/proxyRotationSystem.js
import UltimateProxyMaster from './ultimateProxyMaster.js';
import { getGeo } from '../utils/geoUtils.js'; // Utilidad para geolocalización

class ProxyRotationSystem {
  constructor() {
    this.validProxies = [];
    this.currentIndex = 0;
    this.initialized = false;
  }

  async initialize() {
    if (this.initialized) return;

    try {
      // ✅ Llamamos al método exportado correctamente
      const rawProxies = await UltimateProxyMaster.loadAllProxies();
      console.log(`⏳ Enriqueciendo ${rawProxies.length} proxies con geolocalización...`);

      for (let i = 0; i < rawProxies.length; i++) {
        try {
          const proxy = rawProxies[i];
          const ip = proxy.proxy.split(':')[0];
          const geoInfo = await getGeo(ip);

          rawProxies[i] = {
            ...proxy,
            country: geoInfo.country,
            countryName: geoInfo.countryName,
            region: geoInfo.region,
            city: geoInfo.city
          };
        } catch (error) {
          console.error(`⚠️ Error en proxy ${i + 1}/${rawProxies.length}: ${error.message}`);
          rawProxies[i] = {
            ...rawProxies[i],
            country: 'XX',
            countryName: 'Unknown',
            region: 'Unknown',
            city: 'Unknown'
          };
        }
      }

      this.validProxies = rawProxies;
      this.initialized = true;
      console.log(`✅ ${this.validProxies.length} proxies válidos cargados con geolocalización`);
    } catch (error) {
      console.error('🔥 Error crítico inicializando proxies:', error);
      throw error;
    }
  }

  getNextProxy() {
    if (!this.initialized) {
      throw new Error('Sistema de proxies no inicializado. Ejecuta initialize() primero.');
    }

    if (this.validProxies.length === 0) {
      throw new Error('No hay proxies disponibles');
    }

    const proxy = this.validProxies[this.currentIndex];
    this.currentIndex = (this.currentIndex + 1) % this.validProxies.length;

    return {
      ...proxy,
      ip: proxy.proxy.split(':')[0]
    };
  }

  getProxyCount() {
    return this.validProxies.length;
  }
}

// Singleton listo para producción
const proxySystem = new ProxyRotationSystem();
export default proxySystem;
