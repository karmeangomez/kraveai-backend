// save-proxies.js
import fs from 'fs';

const inputFile = 'proxies.txt'; // Cada línea: ip:port:usuario:contraseña
const outputFile = 'proxies.json';

const lines = fs.readFileSync(inputFile, 'utf-8').trim().split('\n');

const proxies = lines.map(line => {
  const [ip, port, username, password] = line.trim().split(':');
  return {
    ip,
    port,
    auth: {
      username,
      password
    },
    type: 'socks5'
  };
});

fs.writeFileSync(outputFile, JSON.stringify(proxies, null, 2));
console.log(`✅ Guardado ${proxies.length} proxies en ${outputFile}`);
