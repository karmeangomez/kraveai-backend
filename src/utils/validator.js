import axios from 'axios';
import { SocksProxyAgent } from 'socks-proxy-agent';

export async function validateProxy(proxy) {
  // Caso especial para Tor
  if (proxy.country === 'TOR') return true;
  
  // Ignorar proxies HTTP
  if (proxy.type?.toLowerCase().includes('http')) return false;

  try {
    const proxyUrl = proxy.auth?.username 
      ? `socks5://${proxy.auth.username}:${proxy.auth.password}@${proxy.ip}:${proxy.port}`
      : `socks5://${proxy.ip}:${proxy.port}`;
    
    const agent = new SocksProxyAgent(proxyUrl);
    
    // Verificación específica para Instagram
    const response = await axios.get('https://www.instagram.com/data/shared_data/', {
      httpsAgent: agent,
      timeout: 15000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
        'Accept-Language': 'en-US,en;q=0.9'
      }
    });

    // Verificar estructura de respuesta de Instagram
    return response.data && response.data.config && response.data.config.viewer;
  } catch (error) {
    console.error(`❌ Proxy ${proxy.ip}:${proxy.port} falló: ${error.message}`);
    return false;
  }
}
