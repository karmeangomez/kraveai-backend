// save-proxies.js
import fs from 'fs';

const inputFile = 'proxies.txt'; // Cada 4 líneas: ip, port, usuario, contraseña
const outputFile = 'proxies.json';

const lines = fs.readFileSync(inputFile, 'utf-8').trim().split('\n');

const proxies = [];

for (let i = 0; i < lines.length; i += 4) {
  const ip = lines[i].trim();
  const port = lines[i + 1].trim();
  const username = lines[i + 2].trim();
  const password = lines[i + 3].trim();

  proxies.push({
    ip,
    port,
    auth: { username, password },
    type: 'http' // ✅ clave corregida
  });
}

fs.writeFileSync(outputFile, JSON.stringify(proxies, null, 2));
console.log(`✅ Guardado ${proxies.length} proxies en ${outputFile}`);
