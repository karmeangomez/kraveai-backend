import UltimateProxyMaster from './ultimateProxyMaster.js';
import fs from 'fs';
import axios from 'axios';
import { notifyProxyFallido } from '../utils/telegram_utils.js';

export default class ProxyRotationSystem {
    constructor() {
        this.proxyStats = new Map();
        this.blacklist = new Set();
        this.config = {
            MAX_FAILS: 3,
            HEALTH_CHECK_INTERVAL: 300000, // 5 min
            REQUEST_TIMEOUT: 8000
        };

        // Cargar blacklist persistente
        if (fs.existsSync('blacklist_proxies.json')) {
            this.blacklist = new Set(JSON.parse(fs.readFileSync('blacklist_proxies.json')));
        }
    }

    async initHealthChecks() {
        console.log('🔄 Iniciando chequeos de salud de proxies...');
        setInterval(() => this.checkProxies(), this.config.HEALTH_CHECK_INTERVAL);
    }

    async checkProxies() {
        const proxies = UltimateProxyMaster.getWorkingProxies();
        console.log(`🔍 Verificando ${proxies.length} proxies activos...`);

        for (const p of proxies) {
            if (this.blacklist.has(p.string)) continue;

            try {
                const response = await axios.get('https://www.instagram.com/', {
                    proxy: {
                        host: p.ip,
                        port: parseInt(p.port),
                        auth: p.auth || undefined
                    },
                    timeout: this.config.REQUEST_TIMEOUT
                });

                if (response.status === 200) {
                    this.recordSuccess(p.string);
                } else {
                    this.recordFailure(p.string);
                }
            } catch (err) {
                this.recordFailure(p.string);
            }
        }

        // Guardar blacklist actualizada
        fs.writeFileSync('blacklist_proxies.json', JSON.stringify([...this.blacklist]));
    }

    getBestProxy() {
        const available = UltimateProxyMaster.getWorkingProxies()
            .filter(p => !this.blacklist.has(p.string))
            .map(p => ({
                proxy: p,
                stats: this.proxyStats.get(p.string) || { usageCount: 0, failures: 0 }
            }));

        if (available.length === 0) throw new Error('❌ No hay proxies disponibles');

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
            fs.writeFileSync('blacklist_proxies.json', JSON.stringify([...this.blacklist]));
            notifyProxyFallido(proxyString);
        }
    }

    recordSuccess(proxyString) {
        const stats = this.proxyStats.get(proxyString) || { usageCount: 0, failures: 0 };
        stats.usageCount++;
        this.proxyStats.set(proxyString, stats);
        console.log(`✅ Proxy ${proxyString} marcado como exitoso`);
    }

    getProxyStats() {
        return {
            total: this.proxyStats.size,
            buenos: [...this.proxyStats.entries()].filter(([_, s]) => s.failures < this.config.MAX_FAILS).length,
            malos: this.blacklist.size
        };
    }
}
