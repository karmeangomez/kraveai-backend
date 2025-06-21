import UltimateProxyMaster from './ultimateProxyMaster.js';
import axios from 'axios';

class ProxyRotationSystem {
    constructor() {
        this.proxyStats = new Map();
        this.blacklist = new Set();
        this.healthCheckInterval = null;
        this.config = {
            MAX_FAILS: 3,
            HEALTH_CHECK_INTERVAL: 300000,
            REQUEST_TIMEOUT: 10000,
            MAX_RETRIES: 2
        };
    }

    async initHealthChecks() {
        await this.checkAllProxies();
        this.healthCheckInterval = setInterval(
            () => this.checkAllProxies(),
            this.config.HEALTH_CHECK_INTERVAL
        );
        console.log('🔄 Health checks programados cada', 
            this.config.HEALTH_CHECK_INTERVAL / 60000, 'minutos');
    }

    async checkAllProxies() {
        console.log('🔍 Iniciando escaneo de proxies...');
        const allProxies = [
            ...UltimateProxyMaster.proxySources.premium,
            ...UltimateProxyMaster.proxySources.backup
        ];

        const results = await Promise.all(
            allProxies.map(proxyStr => this.testProxy(
                UltimateProxyMaster.formatProxy(proxyStr, 'check')
            ))
        );

        results.forEach((result, index) => {
            this.recordProxyStatus(allProxies[index], result);
        });

        console.log(`📊 Proxies activos: ${this.getActiveProxies().length}/${allProxies.length}`);
    }

    async testProxy(proxy, retryCount = 0) {
        try {
            const start = Date.now();
            const response = await axios.get('https://www.instagram.com', {
                proxy: {
                    host: proxy.ip,
                    port: proxy.port,
                    ...(proxy.auth ? { auth: proxy.auth } : {})
                },
                timeout: this.config.REQUEST_TIMEOUT
            });

            return {
                status: response.status === 200 ? 'active' : 'inactive',
                responseTime: Date.now() - start,
                statusCode: response.status
            };
        } catch (error) {
            if (retryCount < this.config.MAX_RETRIES) {
                return this.testProxy(proxy, retryCount + 1);
            }
            return {
                status: 'error',
                error: error.message,
                responseTime: null
            };
        }
    }

    recordProxyStatus(proxyString, result) {
        if (!this.proxyStats.has(proxyString)) {
            this.proxyStats.set(proxyString, {
                successes: 0,
                failures: 0,
                lastResponseTimes: []
            });
        }

        const stats = this.proxyStats.get(proxyString);

        if (result.status === 'active') {
            stats.successes++;
            stats.lastResponseTimes.push(result.responseTime);
            if (stats.lastResponseTimes.length > 10) {
                stats.lastResponseTimes.shift();
            }
            this.blacklist.delete(proxyString);
        } else {
            stats.failures++;
            if (stats.failures >= this.config.MAX_FAILS) {
                this.blacklist.add(proxyString);
                console.warn(`🚫 Proxy ${proxyString} añadido a blacklist`);
            }
        }
    }

    recordFailure(proxyString) {
        if (!this.proxyStats.has(proxyString)) {
            this.proxyStats.set(proxyString, {
                successes: 0,
                failures: 0,
                lastResponseTimes: []
            });
        }
        
        const stats = this.proxyStats.get(proxyString);
        stats.failures++;
        
        if (stats.failures >= this.config.MAX_FAILS) {
            this.blacklist.add(proxyString);
            console.warn(`🚫 Proxy ${proxyString} añadido a blacklist`);
        }
    }

    getActiveProxies() {
        return [...UltimateProxyMaster.proxySources.premium, ...UltimateProxyMaster.proxySources.backup]
            .filter(proxyStr => !this.blacklist.has(proxyStr));
    }

    getBestProxy() {
        const activeProxies = this.getActiveProxies()
            .map(proxyStr => UltimateProxyMaster.formatProxy(proxyStr, 'active'));

        if (activeProxies.length === 0) {
            throw new Error('No hay proxies disponibles');
        }

        activeProxies.sort((a, b) => {
            const statsA = this.proxyStats.get(a.string) || { lastResponseTimes: [] };
            const statsB = this.proxyStats.get(b.string) || { lastResponseTimes: [] };
            
            const avgA = statsA.lastResponseTimes.length > 0 
                ? statsA.lastResponseTimes.reduce((sum, t) => sum + t, 0) / statsA.lastResponseTimes.length 
                : 1000;
            const avgB = statsB.lastResponseTimes.length > 0 
                ? statsB.lastResponseTimes.reduce((sum, t) => sum + t, 0) / statsB.lastResponseTimes.length 
                : 1000;
            
            return avgA - avgB || a.usageCount - b.usageCount;
        });

        return activeProxies[0];
    }

    showProxyStats() {
        console.log('\n📊 ===== ESTADÍSTICAS DE PROXIES =====');
        console.log(`🔢 Totales: ${this.getActiveProxies().length} activos, ${this.blacklist.size} en blacklist`);
        
        Array.from(this.proxyStats.entries()).forEach(([proxy, stats]) => {
            const avgTime = stats.lastResponseTimes.length > 0
                ? (stats.lastResponseTimes.reduce((a, b) => a + b, 0) / stats.lastResponseTimes.length).toFixed(2)
                : 'N/A';
            
            console.log(
                `${this.blacklist.has(proxy) ? '🚫' : '✅'} ${proxy} | ` +
                `👍 ${stats.successes} | 👎 ${stats.failures} | ⏱ ${avgTime}ms`
            );
        });
    }
}

const proxySystem = new ProxyRotationSystem();
export default proxySystem;
