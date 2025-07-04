import axios from 'axios';
import { SocksProxyAgent } from 'socks-proxy-agent';
import { HttpsProxyAgent } from 'https-proxy-agent';
import https from 'https';

const insecureAgent = new https.Agent({  
  rejectUnauthorized: false
});

export async function validateProxy(proxy) {
  // Caso especial para Tor
  if (proxy.country === 'TOR' || proxy.source === 'tor_fallback') return true;
  
  try {
    let config = {
      timeout: 30000
    };
    
    if (proxy.type === 'http' || proxy.type === 'https') {
      // CONFIGURACIÓN CORREGIDA PARA HTTP
      const proxyUrl = `http://${proxy.auth.username}:${proxy.auth.password}@${proxy.ip}:${proxy.port}`;
      config.httpsAgent = new HttpsProxyAgent(proxyUrl);
    } else if (proxy.type === 'socks4' || proxy.type === 'socks5') {
      const proxyUrl = proxy.auth?.username 
        ? `${proxy.type}://${proxy.auth.username}:${proxy.auth.password}@${proxy.ip}:${proxy.port}`
        : `${proxy.type}://${proxy.ip}:${proxy.port}`;
      
      const agent = new SocksProxyAgent(proxyUrl);
      config.httpsAgent = agent;
    } else {
      console.error(`⚠️ Tipo de proxy no soportado: ${proxy.type}`);
      return false;
    }

    // Usar agente inseguro como respaldo
    if (!config.httpsAgent) {
      config.httpsAgent = insecureAgent;
    }

    // Prueba con endpoint más simple
    const response = await axios.get('https://www.instagram.com/', {
      ...config,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36'
      }
    });

    return response.status === 200;
  } catch (error) {
    console.error(`❌ Validación proxy fallida: ${error.message}`);
    return false;
  }
}
