// proxyBank.js - Módulo para gestionar una lista de proxies rotativos con sus estados de uso/fallo.

const proxies = [
    // *** Rellenar con la lista de proxies de Webshare (o similar) con autenticación. ***
    // Formato de ejemplo:
    // { host: 'p.webshare.io', port: 80, username: 'USUARIO_PROXY', password: 'PASSWORD_PROXY', lastFail: null, failCount: 0, lastSuccess: null }
];

// Tiempo de cooldown tras un fallo (ms). Durante este periodo el proxy no se reutilizará.
const FAIL_COOLDOWN = 5 * 60 * 1000; // 5 minutos

let lastIndex = 0; // Índice del último proxy usado, para rotar de forma circular.

function getProxy() {
    if (proxies.length === 0) {
        console.error("proxyBank: No hay proxies configurados.");
        return null;
    }
    const now = Date.now();
    const n = proxies.length;
    // Intentar encontrar un proxy no marcado como fallido recientemente
    for (let i = 0; i < n; i++) {
        const idx = (lastIndex + i) % n;
        const proxy = proxies[idx];
        // Si el proxy falló hace poco, saltarlo hasta que pase el cooldown
        if (proxy.lastFail && (now - proxy.lastFail) < FAIL_COOLDOWN) {
            continue;
        }
        // Seleccionar este proxy
        lastIndex = idx + 1; // actualizar índice para la próxima rotación
        return proxy;
    }
    // Si ninguno está disponible (todos en cooldown), devolver null
    return null;
}

function reportFailure(proxy) {
    // Marcar proxy como fallido temporalmente
    proxy.lastFail = Date.now();
    proxy.failCount = (proxy.failCount || 0) + 1;
    console.log(`proxyBank: Proxy ${proxy.host}:${proxy.port} marcado como FAIL (failCount=${proxy.failCount}).`);
}

function reportSuccess(proxy) {
    // Marcar proxy como exitoso recientemente
    proxy.lastSuccess = Date.now();
    proxy.failCount = 0;
    console.log(`proxyBank: Proxy ${proxy.host}:${proxy.port} marcado como OK.`);
}

function count() {
    return proxies.length;
}

module.exports = { getProxy, reportFailure, reportSuccess, count, proxies };
