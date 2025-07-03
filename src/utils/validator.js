// src/utils/validator.js
import axios from 'axios';
import { SocksProxyAgent } from 'socks-proxy-agent';

export async function validateProxy(proxy) {
  try {
    let httpsAgent;
    if (proxy.type.startsWith('socks')) {
      const proxyUrl = `${proxy.type}://${proxy.auth.username}:${proxy.auth.password}@${proxy.ip}:${proxy.port}`;
      httpsAgent = new SocksProxyAgent(proxyUrl);
    }

    const response = await axios.get('https://api.ipify.org?format=json', {
      ...(httpsAgent ? { httpAgent: httpsAgent, httpsAgent: httpsAgent } : {
        proxy: {
          protocol: proxy.type,
          host: proxy.ip,
          port: Number(proxy.port),
          auth: {
            username: proxy.auth.username,
            password: proxy.auth.password
          }
        }
      }),
      timeout: 7000,
      headers: { 'User-Agent': 'Axios/1.0' }
    });

    return response.status === 200;
  } catch (err) {
    return false;
  }
}
