// 📁 src/proxies/proxyTester.js
import axios from 'axios';

async function testProxy(proxy) {
  const proxyUrl = `${proxy.type}://${proxy.auth.username}:${proxy.auth.password}@${proxy.ip}:${proxy.port}`;
  try {
    const response = await axios.get('https://api.ipify.org?format=json', {
      proxy: {
        protocol: proxy.type,
        host: proxy.ip,
        port: proxy.port,
        auth: {
          username: proxy.auth.username,
          password: proxy.auth.password
        }
      },
      timeout: 8000
    });
    return {
      working: true,
      ip: response.data.ip
    };
  } catch (err) {
    return {
      working: false,
      error: err.message
    };
  }
}

export default testProxy;
