// utils/validator.js
import axios from 'axios';

export async function validateProxy(proxy) {
  const proxyUrl = `${proxy.type}://${proxy.auth.username}:${proxy.auth.password}@${proxy.ip}:${proxy.port}`;
  try {
    const response = await axios.get('https://www.google.com', {
      proxy: {
        host: proxy.ip,
        port: Number(proxy.port),
        auth: {
          username: proxy.auth.username,
          password: proxy.auth.password
        },
        protocol: proxy.type // ✅ ahora respeta http o socks5
      },
      timeout: 7000,
    });

    return response.status === 200;
  } catch (err) {
    return false;
  }
}
