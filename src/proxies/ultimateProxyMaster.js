import fs from 'fs';
import path from 'path';
import ProxyRotationSystem from './proxyRotationSystem.js';
import WebshareProxyManager from './webshareApi.js';
import { getProxies as loadSwiftShadowProxies } from './swiftShadowLoader.js';
import runMultiProxies from './multiProxiesRunner.js';
import { validateProxy } from '../utils/validator.js';

const PROXIES_VALIDATED_PATH = path.resolve('src/proxies/proxies_validados.json');

export default class UltimateProxyMaster extends ProxyRotationSystem {
  constructor() {
    super([]);
  }

  // ... (métodos initialize y refreshProxies se mantienen igual) ...

  async getAllSourcesProxies() {
    console.log('🔍 Obteniendo proxies desde todas las fuentes...');
    
    // 1. PRIORIDAD MÁXIMA: Webshare
    let webshareProxies = [];
    try {
      webshareProxies = await WebshareProxyManager.getProxies();
      console.log(`⭐ Obtenidos ${webshareProxies.length} proxies premium de Webshare`);
      
      // Si tenemos proxies de Webshare, los usamos como principales
      if (webshareProxies.length > 0) {
        return webshareProxies;
      }
    } catch (error) {
      console.error('⚠️ Error obteniendo proxies Webshare:', error.message);
    }
    
    // 2. RESERVAS: Fuentes públicas (solo si Webshare falla o no devuelve proxies)
    console.warn('⚠️ Usando proxies públicos como reserva');
    const [swift, multi] = await Promise.allSettled([
      loadSwiftShadowProxies(),
      runMultiProxies()
    ]);

    const publicProxies = [
      ...(swift.status === 'fulfilled' ? swift.value : []),
      ...(multi.status === 'fulfilled' ? multi.value : [])
    ];

    // 3. Combinamos con Webshare (por si hubo algunos)
    const allProxies = [...webshareProxies, ...publicProxies];
    
    // Filtrar para mantener solo SOCKS5
    const filtered = allProxies.filter(proxy => 
      proxy.type?.toLowerCase().includes('socks')
    );

    // Eliminar duplicados manteniendo los de Webshare primero
    const uniqueProxies = [];
    const seen = new Set();
    
    for (const proxy of filtered) {
      const key = `${proxy.ip}:${proxy.port}`;
      if (!seen.has(key)) {
        seen.add(key);
        uniqueProxies.push(proxy);
      }
    }

    console.log(`📊 Proxies combinados (SOCKS5): ${uniqueProxies.length}`);
    return uniqueProxies;
  }

  // ... (métodos filterValidProxies, autoRefreshProxies y loadAllProxies se mantienen igual) ...
}
