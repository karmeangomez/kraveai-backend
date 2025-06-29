// Versión ultra-robusta
static async fetchProxies(proxyType = PROXY_TYPES.RESIDENTIAL, limit = 50) {
  try {
    const response = await axios.get('https://proxy.webshare.io/api/v2/proxy/list/', {
      // ... configuración existente
    });

    return response.data.results.map(proxy => {
      // Determinar puerto
      let port = 80; // Valor por defecto
      
      // Intentar obtener puerto de diferentes maneras
      if (proxy.ports && Object.keys(proxy.ports).length > 0) {
        // Priorizar HTTP/HTTPS/SOCKS
        port = proxy.ports.http || proxy.ports.https || proxy.ports.socks5;
        
        // Si no se encuentra, tomar el primer puerto disponible
        if (!port) port = Object.values(proxy.ports)[0];
      }
      
      // Si todo falla, extraer de proxy_address si contiene ":"
      if (!port && proxy.proxy_address.includes(':')) {
        const parts = proxy.proxy_address.split(':');
        if (parts.length > 1) port = parseInt(parts[1]);
      }

      return {
        ip: proxy.proxy_address.split(':')[0], // Por si acaso
        port: port || 80, // Asegurar valor
        // ... resto de propiedades
      };
    });
  } catch (error) {
    console.error('❌ Error obteniendo proxies de Webshare:', error.response?.data || error.message);
    return [];
  }
}
