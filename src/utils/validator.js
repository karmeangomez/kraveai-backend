import axios from 'axios';
import { SocksProxyAgent } from 'socks-proxy-agent';
import { HttpsProxyAgent } from 'https-proxy-agent';

export async function validateProxy(proxy) {
  // Caso especial para Tor
  if (proxy.country === 'TOR' || proxy.source === 'tor_fallback') return true;
  
  try {
    let agent;
    let config = {};
    
    // Configuración especial para proxy residencial
    if (proxy.source === 'webshare_residential') {
      agent = new HttpsProxyAgent({
        host: proxy.ip,
        port: proxy.port,
        auth: `${proxy.auth.username}:${proxy.auth.password}`
      });
      
      config = {
        httpsAgent: agent,
        proxy: false, // Desactivar proxy automático de axios
        timeout: 20000
      };
    } else {
      // Configuración normal para SOCKS5
      const proxyUrl = proxy.auth?.username 
        ? `socks5://${proxy.auth.username}:${proxy.auth.password}@${proxy.ip}:${proxy.port}`
        : `socks5://${proxy.ip}:${proxy.port}`;
      
      agent = new SocksProxyAgent(proxyUrl);
      config = { httpsAgent: agent };
    }

    // Prueba con Instagram - Endpoint clave
    const response = await axios.get('https://www.instagram.com/api/v1/web/data/shared_data/', {
      ...config,
      timeout: 15000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
        'X-IG-App-ID': '936619743392459',
        'Accept-Language': 'en-US,en;q=0.9'
      }
    });

    // Verificar respuesta de Instagram
    return response.status === 200 && response.data?.config?.viewer;
  } catch (error) {
    console.error(`❌ Validación proxy fallida: ${error.message}`);
    return false;
  }
}
