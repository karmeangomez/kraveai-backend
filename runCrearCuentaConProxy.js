// runCrearCuentaConProxy.js - Ejecuta creación con proxies reales

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const proxyChain = require('proxy-chain');

const proxies = JSON.parse(fs.readFileSync(path.join(__dirname, 'proxies.json')));
const MAX_CUENTAS = 20; // ajustable
let index = 0;

async function ejecutarCuenta(proxyRaw) {
    const proxyAnonymized = await proxyChain.anonymizeProxy(`http://${proxyRaw}`);
    return new Promise((resolve) => {
        const proceso = spawn('node', ['crearCuentaInstagram.js', proxyAnonymized], {
            stdio: ['ignore', 'pipe', 'pipe'],
            env: { ...process.env, NODE_ENV: 'production' },
        });

        let salida = '';
        proceso.stdout.on('data', data => salida += data.toString());
        proceso.stderr.on('data', data => console.error(`[stderr] ${data}`));

        proceso.on('exit', code => {
            console.log(`\n🔁 Proxy usado: ${proxyRaw}`);
            try {
                const resultado = JSON.parse(salida.trim());
                if (resultado.status === 'success') {
                    console.log(`✅ Cuenta creada: @${resultado.usuario}`);
                } else {
                    console.log(`❌ Falló: ${resultado.error}`);
                }
            } catch {
                console.error('⚠️ Error procesando salida');
            }
            resolve();
        });
    });
}

async function run() {
    console.log(`🚀 Creando ${MAX_CUENTAS} cuentas con proxies reales...`);
    for (let i = 0; i < MAX_CUENTAS; i++) {
        const proxy = proxies[index % proxies.length];
        await ejecutarCuenta(proxy);
        index++;
    }
    console.log('🎉 Proceso finalizado');
}

run();
