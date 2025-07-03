// src/utils/validator.js
import axios from 'axios';
import { SocksProxyAgent } from 'socks-proxy-agent';

export async function validateProxy(proxy) {
  const { ip, port, auth, type } = proxy;

  if (type !== 'socks5') return false;

  const proxyUrl = `socks5://${auth.username}:${auth.password}@${ip}:${port}`;
  const agent = new SocksProxyAgent(proxyUrl);

  try {
    const response = await axios.get('https://www.google.com', {
      httpAgent: agent,
      httpsAgent: agent,
      timeout: 7000,
    });

    return response.status === 200;
  } catch (err) {
    return false;
  }
}
