import axios from 'axios';
import { SocksProxyAgent } from 'socks-proxy-agent';
import { HttpsProxyAgent } from 'https-proxy-agent';

export async function validateProxy(proxy) {
  // Caso especial para Tor
  if (proxy.country === 'TOR') return true;
  
  // Ignorar proxies HTTP
  const proxyType = proxy.type?.toLowerCase() || 'socks5';
  if (proxyType.includes('http')) {
    console.log(`⏩ Omitiendo proxy HTTP: ${proxy.ip}:${proxy.port}`);
    return false;
  }

  try {
    let agent;
    
    if (proxyType.includes('socks')) {
      const proxyUrl = proxy.auth?.username 
        ? `socks5://${proxy.auth.username}:${proxy.auth.password}@${proxy.ip}:${proxy.port}`
        : `socks5://${proxy.ip}:${proxy.port}`;
      
      agent = new SocksProxyAgent(proxyUrl);
    } else {
      return false; // Solo aceptamos SOCKS
    }

    const response = await axios.get('https://www.instagram.com', {
      httpsAgent: agent,
      timeout: 10000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
        'Accept-Language': 'en-US,en;q=0.9'
      }
    });

    return response.status === 200;
  } catch (error) {
    console.error(`❌ Proxy ${proxy.ip}:${proxy.port} falló: ${error.message}`);
    return false;
  }
}
