// src/proxies/webshareApi.js
static async getProxies() {
    console.log('🔄 Obteniendo nuevos proxies de Webshare...');
    
    // Verificar que la API key existe
    if (!API_KEY) {
        console.error('❌ WEBSHARE_API_KEY no está configurada en .env');
        return [];
    }

    try {
        const response = await axios.get(
            'https://proxy.webshare.io/api/v2/proxy/list/',
            {
                headers: { 'Authorization': `Token ${API_KEY}` },
                params: { mode: 'direct', page: 1, page_size: 100 },
                timeout: 10000
            }
        );

        // Mapeo correcto de los proxies
        const proxies = response.data.results.map(proxy => ({
            ip: proxy.proxy_address,
            port: proxy.ports ? proxy.ports[0] : proxy.port, // Webshare usa array de puertos
            auth: {
                username: proxy.username,
                password: proxy.password
            },
            type: 'socks5', // Forzar tipo SOCKS5
            country: proxy.country_code,
            source: 'webshare'
        }));

        console.log(`✅ ${proxies.length} proxies de Webshare obtenidos`);
        return proxies;

    } catch (error) {
        // Detallar el error
        const errorMsg = error.response 
            ? `Status: ${error.response.status}, Data: ${JSON.stringify(error.response.data)}`
            : error.message;
        
        console.error('❌ Error crítico obteniendo proxies de Webshare:', errorMsg);
        return [];
    }
}
