import UltimateProxyMaster from './proxies/ultimateProxyMaster.js';
import { crearCuentaInstagram } from './accounts/crearCuentaInstagram.js';
import fs from 'fs';
import path from 'path';

const TOTAL_CUENTAS = 50;
const cuentasExitosas = [];
const cuentasFallidas = [];
const MAX_FALLOS = 10;
let fallosTotales = 0;

const salida = path.resolve('cuentas_creadas.json');

async function main() {
  console.log('🔥 Iniciando KraveAI-Granja Rusa 🔥');

  const proxyMaster = new UltimateProxyMaster();
  await proxyMaster.initialize();
  
  // Limitar proxies a 500 para optimizar memoria
  proxyMaster.limitProxies(500);

  for (let i = 0; i < TOTAL_CUENTAS; i++) {
    console.log(`\n🚀 Creando cuenta ${i + 1}/${TOTAL_CUENTAS}`);
    const proxy = proxyMaster.getNextProxy();

    const resultado = await crearCuentaInstagram(proxy);

    if (resultado.status === 'success') {
      cuentasExitosas.push(resultado);
      console.log(`🎉 Cuenta creada: @${resultado.usuario}`);
    } else {
      cuentasFallidas.push(resultado);
      fallosTotales++;
      console.log(`❌ Fallo #${fallosTotales}: ${resultado.error}`);
    }

    if (fallosTotales >= MAX_FALLOS) {
      console.log(`🛑 Proceso detenido por alcanzar ${MAX_FALLOS} fallos`);
      break;
    }

    await new Promise(r => setTimeout(r, 3000)); // Delay entre cuentas
  }

  fs.writeFileSync(salida, JSON.stringify(cuentasExitosas, null, 2));
  console.log('\n📦 Resultado final:');
  console.log(`✅ Creadas: ${cuentasExitosas.length}`);
  console.log(`❌ Fallidas: ${cuentasFallidas.length}`);
  console.log(`💾 Guardadas en: ${salida}`);
  
  // Salida para el proceso Python
  if (cuentasExitosas.length > 0) {
    console.log(JSON.stringify(cuentasExitosas[cuentasExitosas.length - 1]));
  } else if (cuentasFallidas.length > 0) {
    console.log(JSON.stringify(cuentasFallidas[cuentasFallidas.length - 1]));
  } else {
    console.log(JSON.stringify({status: "error", error: "No se crearon cuentas"}));
  }
}

main().catch(error => {
  console.error('❌ Error crítico en run.js:', error);
  process.exit(1);
});
