async getAllSourcesProxies() {
  console.log('🔍 Obteniendo proxies desde todas las fuentes...');
  
  // 1. Prioridad ABSOLUTA al proxy residencial de Webshare
  try {
    const webshare = await WebshareProxyManager.getProxies();
    if (webshare.length > 0) {
      console.log('⭐ Usando proxy residencial premium de Webshare');
      return webshare;
    }
  } catch (error) {
    console.error('⚠️ Error con proxy residencial:', error.message);
  }

  // 2. Fuentes secundarias (solo si falla Webshare)
  console.warn('⚠️ Usando proxies públicos como respaldo');
  const [swift, multi] = await Promise.allSettled([
    loadSwiftShadowProxies(),
    runMultiProxies()
  ]);

  const publicProxies = [
    ...(swift.status === 'fulfilled' ? swift.value : []),
    ...(multi.status === 'fulfilled' ? multi.value : [])
  ].filter(proxy => proxy.type?.includes('socks'));

  // 3. Tor como último recurso
  if (publicProxies.length === 0) {
    console.warn('🚨 Usando Tor como último recurso');
    return [{
      ip: '127.0.0.1',
      port: 9050,
      type: 'socks5',
      country: 'TOR',
      source: 'tor_fallback'
    }];
  }

  return publicProxies;
}
