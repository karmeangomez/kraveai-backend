// src/utils/validator.js
export async function validateProxy(proxy) {
    // Usar Tor directamente si está configurado
    if (proxy.country === 'TOR') return true;
    
    try {
        const options = {
            host: proxy.ip,
            port: proxy.port,
            userId: proxy.auth?.username,
            password: proxy.auth?.password,
            type: 'socks5'
        };

        const agent = new SocksProxyAgent(options);
        
        // Prueba más robusta con Instagram
        const response = await axios.get('https://www.instagram.com/instagram/', {
            httpsAgent: agent,
            timeout: 15000,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
                'Accept-Language': 'en-US,en;q=0.9'
            }
        });

        // Verificar contenido específico de Instagram
        return response.data.includes('"og:site_name":"Instagram"');
    } catch (error) {
        return false;
    }
}
