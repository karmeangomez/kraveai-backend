import axios from 'axios';
import { SocksProxyAgent } from 'socks-proxy-agent';
import { HttpsProxyAgent } from 'https-proxy-agent';
import https from 'https';

// Agente que ignora errores de certificado
const httpsAgent = new https.Agent({  
  rejectUnauthorized: false
});

export async function validateProxy(proxy) {
  // Caso especial para Tor
  if (proxy.country === 'TOR' || proxy.source === 'tor_fallback') return true;
  
  try {
    let config = {
      httpsAgent, // Usamos el agente que ignora certificados inválidos
      timeout: 30000 // 30 segundos
    };
    
    if (proxy.type === 'http' || proxy.type === 'https') {
      // Configuración para proxy HTTP
      const proxyUrl = `http://${proxy.auth?.username ? `${proxy.auth.username}:${proxy.auth.password}@` : ''}${proxy.ip}:${proxy.port}`;
      config.proxy = {
        protocol: 'http',
        host: proxy.ip,
        port: proxy.port,
        auth: proxy.auth ? {
          username: proxy.auth.username,
          password: proxy.auth.password
        } : undefined
      };
    } else if (proxy.type === 'socks4' || proxy.type === 'socks5') {
      // Configuración para SOCKS
      const proxyUrl = proxy.auth?.username 
        ? `${proxy.type}://${proxy.auth.username}:${proxy.auth.password}@${proxy.ip}:${proxy.port}`
        : `${proxy.type}://${proxy.ip}:${proxy.port}`;
      
      const agent = new SocksProxyAgent(proxyUrl);
      config = { 
        httpsAgent: agent,
        httpAgent: agent
      };
    } else {
      console.error(`⚠️ Tipo de proxy no soportado: ${proxy.type}`);
      return false;
    }

    // Prueba con Instagram - Endpoint rápido
    const response = await axios.get('https://www.instagram.com/data/shared_data/', {
      ...config,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
        'Accept-Language': 'en-US,en;q=0.9'
      }
    });

    // Verificar respuesta
    return response.status === 200;
  } catch (error) {
    console.error(`❌ Validación proxy fallida: ${error.message}`);
    return false;
  }
}
