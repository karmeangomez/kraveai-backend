// src/proxies/ultimateProxyMaster.js
async initialize(forceRefresh = false) {
    // FORZAR siempre la recarga inicial
    forceRefresh = true;
    
    console.log('🔥 Inicializando sistema de proxies...');
    let proxies = [];

    // Eliminar cachés antiguas
    ['proxies_validados.json', 'webshare_proxies.json'].forEach(file => {
        const filePath = path.resolve('src/proxies', file);
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    });

    // Obtener proxies frescos
    proxies = await this.getAllSourcesProxies();
    proxies = await this.filterValidProxies(proxies);

    // ... resto del código se mantiene igual ...
}

async getAllSourcesProxies() {
    console.log('🔍 Obteniendo proxies desde todas las fuentes...');
    
    // 1. Priorizar Webshare
    let webshareProxies = [];
    try {
        webshareProxies = await WebshareProxyManager.getProxies();
        console.log(`⭐ ${webshareProxies.length} proxies de Webshare obtenidos`);
    } catch (e) {
        console.error('⚠️ Error con Webshare:', e.message);
    }

    // 2. Solo cargar otras fuentes si Webshare falló
    let publicProxies = [];
    if (webshareProxies.length === 0) {
        console.warn('⚠️ Cargando proxies públicos como respaldo');
        const [swift, multi] = await Promise.allSettled([
            loadSwiftShadowProxies(),
            runMultiProxies()
        ]);
        
        publicProxies = [
            ...(swift.status === 'fulfilled' ? swift.value : []),
            ...(multi.status === 'fulfilled' ? multi.value : [])
        ];
    }

    // 3. Combinar y filtrar
    const allProxies = [...webshareProxies, ...publicProxies]
        .filter(proxy => proxy.type?.includes('socks'))
        .filter((proxy, index, self) => 
            index === self.findIndex(p => p.ip === proxy.ip && p.port === proxy.port)
        );

    console.log(`📊 Total proxies disponibles: ${allProxies.length}`);
    return allProxies;
}
