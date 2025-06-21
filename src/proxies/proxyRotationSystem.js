import UltimateProxyMaster from './ultimateProxyMaster.js';

export default class ProxyRotationSystem {
    constructor() {
        this.proxyStats = new Map();
        this.blacklist = new Set();
        this.config = {
            MAX_FAILS: 3,
            HEALTH_CHECK_INTERVAL: 300000,
            REQUEST_TIMEOUT: 10000
        };
    }

    async initHealthChecks() {
        console.log('🔄 Iniciando chequeos de salud de proxies...');
        setInterval(() => this.checkProxies(), this.config.HEALTH_CHECK_INTERVAL);
    }

    async checkProxies() {
        const proxies = UltimateProxyMaster.getWorkingProxies();
        console.log(`🔍 Verificando ${proxies.length} proxies...`);
        // Implementar lógica de verificación
    }

    getBestProxy() {
        const available = UltimateProxyMaster.getWorkingProxies()
            .filter(p => !this.blacklist.has(p.string))
            .map(p => ({
                proxy: p,
                stats: this.proxyStats.get(p.string) || { usageCount: 0, failures: 0 }
            }));

        if (available.length === 0) throw new Error('No hay proxies disponibles');

        return available.sort((a, b) => 
            a.stats.failures - b.stats.failures || 
            a.stats.usageCount - b.stats.usageCount
        )[0].proxy;
    }

    recordFailure(proxyString) {
        const stats = this.proxyStats.get(proxyString) || { usageCount: 0, failures: 0 };
        stats.usageCount++;
        stats.failures++;
        this.proxyStats.set(proxyString, stats);

        if (stats.failures >= this.config.MAX_FAILS) {
            this.blacklist.add(proxyString);
            console.warn(`🚫 Proxy blacklisted: ${proxyString}`);
        }
    }

    recordSuccess(proxyString) {
        const stats = this.proxyStats.get(proxyString) || { usageCount: 0, failures: 0 };
        stats.usageCount++;
        this.proxyStats.set(proxyString, stats);
        console.log(`✅ Proxy ${proxyString} marcado como exitoso`);
    }
}
