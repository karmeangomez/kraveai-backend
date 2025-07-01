// utils/validator.js
import axios from 'axios';

export async function validateProxy(proxy) {
  const proxyUrl = `socks5://${proxy.auth}@${proxy.ip}:${proxy.port}`;
  try {
    const response = await axios.get('https://www.google.com', {
      proxy: {
        host: proxy.ip,
        port: Number(proxy.port),
        auth: proxy.auth
          ? {
              username: proxy.auth.split(':')[0],
              password: proxy.auth.split(':')[1],
            }
          : undefined,
        protocol: 'socks5',
      },
      timeout: 7000,
    });

    return response.status === 200;
  } catch (err) {
    return false;
  }
}
