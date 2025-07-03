export async function validateProxy(proxy) {
  // Añade este caso especial para Tor
  if (proxy.country === 'TOR') return true;

  try {
    const formattedProxy = formatProxyUrl(proxy);
    const response = await axios.get('https://www.instagram.com', {
      proxy: {
        host: proxy.ip,
        port: proxy.port,
        ...(proxy.auth.username && {
          auth: {
            username: proxy.auth.username,
            password: proxy.auth.password
          }
        })
      },
      timeout: 10000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36'
      }
    });
    return response.status === 200;
  } catch (error) {
    console.error(`❌ Proxy ${proxy.ip}:${proxy.port} falló: ${error.message}`);
    return false;
  }
}
