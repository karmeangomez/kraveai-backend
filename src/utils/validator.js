import axios from 'axios';
import { SocksProxyAgent } from 'socks-proxy-agent';

export async function validateProxy(proxy) {
  const { ip, port, auth, type } = proxy;

  try {
    const proxyString = `${type}://${auth.username}:${auth.password}@${ip}:${port}`;

    const agent = type.startsWith('socks')
      ? new SocksProxyAgent(proxyString)
      : undefined;

    const response = await axios.get('https://httpbin.org/ip', {
      httpsAgent: agent,
      httpAgent: agent,
      proxy: type === 'http' ? {
        host: ip,
        port: Number(port),
        auth: {
          username: auth.username,
          password: auth.password
        },
        protocol: 'http'
      } : false,
      timeout: 7000
    });

    return response?.status === 200;
  } catch (err) {
    return false;
  }
}
