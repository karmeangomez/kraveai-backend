// validator.js
import axios from 'axios';
import { SocksProxyAgent } from 'socks-proxy-agent';

/**
 * Verifica si un proxy SOCKS5 es funcional accediendo a ipinfo.io
 * @param {Object} proxy - { ip, port, auth: { username, password } }
 * @returns {Promise<boolean>}
 */
export async function validateProxy(proxy) {
  const proxyUrl = `socks5://${proxy.auth.username}:${proxy.auth.password}@${proxy.ip}:${proxy.port}`;
  const agent = new SocksProxyAgent(proxyUrl);

  try {
    const res = await axios.get('https://ipinfo.io/json', {
      httpsAgent: agent,
      timeout: 8000,
    });

    return !!res.data && !!res.data.ip;
  } catch (err) {
    return false;
  }
}
