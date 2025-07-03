// src/proxies/validatorRunner.js
import fs from 'fs';
import path from 'path';
import chalk from 'chalk';
import { validateProxy } from '../utils/validator.js';

const proxiesPath = path.resolve('src/proxies/proxies.json');

async function main() {
  if (!fs.existsSync(proxiesPath)) {
    console.log(chalk.red('❌ Archivo proxies.json no encontrado'));
    return;
  }

  const proxies = JSON.parse(fs.readFileSync(proxiesPath, 'utf-8'));
  const buenos = [];
  const malos = [];

  console.log(chalk.cyan(`🔍 Validando ${proxies.length} proxies...\n`));

  for (const proxy of proxies) {
    const valido = await validateProxy(proxy);
    if (valido) {
      buenos.push(proxy);
      console.log(chalk.green(`✅ Válido: ${proxy.ip}:${proxy.port}`));
    } else {
      malos.push(proxy);
      console.log(chalk.red(`⛔ Falló: ${proxy.ip}:${proxy.port}`));
    }
  }

  const outputPath = path.resolve('src/proxies/proxies_validados.json');
  fs.writeFileSync(outputPath, JSON.stringify(buenos, null, 2));

  console.log('\n' + chalk.magenta(`📁 Guardado proxies válidos en ${outputPath}`));
  console.log(chalk.yellow(`✅ Total válidos: ${buenos.length}`));
  console.log(chalk.red(`⛔ Total fallidos: ${malos.length}`));
}

main();
