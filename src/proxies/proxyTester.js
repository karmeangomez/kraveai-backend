async function testProxy(proxy) {
  try {
    const start = Date.now();
    const response = await axios.get('https://www.instagram.com', {
      proxy: {
        host: proxy.ip,
        port: proxy.port,
        auth: { username: proxy.user, password: proxy.pass }
      },
      timeout: 6000 // 6 segundos máximo
    });
    
    const latency = Date.now() - start;
    const isBlocked = response.data.includes('instagram.com/accounts/login');
    
    return {
      valid: response.status === 200 && !isBlocked,
      latency,
      country: parseGeoHeader(response.headers)
    };
  } catch {
    return { valid: false };
  }
}
