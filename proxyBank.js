// proxyBank.js - Manejo inteligente de proxies con prefijo automático

const fs = require('fs');
const path = require('path');

const proxiesPath = path.join(__dirname, 'proxies.json');

let proxies = [];
let currentIndex = 0;

function cargarProxies() {
    try {
        const data = fs.readFileSync(proxiesPath, 'utf8');
        const rawList = JSON.parse(data);

        // Asegura prefijo 'http://'
        proxies = rawList.map(p => {
            return p.startsWith('http://') ? p : `http://${p}`;
        });
    } catch (e) {
        console.error('❌ Error cargando proxies:', e.message);
        proxies = [];
    }
}

function getNextProxy() {
    if (proxies.length === 0) cargarProxies();
    if (proxies.length === 0) return null;

    const proxy = proxies[currentIndex];
    currentIndex = (currentIndex + 1) % proxies.length;
    return proxy;
}

module.exports = { getNextProxy };
