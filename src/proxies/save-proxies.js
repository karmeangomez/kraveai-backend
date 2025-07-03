// 📁 src/proxies/save-proxies.js
import fs from 'fs';
import path from 'path';

const inputFile = path.resolve('src/proxies/Webshare 100 proxies.txt');
const outputFile = path.resolve('src/proxies/proxies.json');

const lines = fs.readFileSync(inputFile, 'utf-8')
  .split('\n')
  .map(line => line.trim())
  .filter(line => line && line.includes(':'));

const proxies = lines.map(line => {
  const [ip, port, username, password] = line.split(':');
  return {
    ip,
    port: parseInt(port),
    auth: { username, password },
    type: 'socks5'
  };
});

fs.writeFileSync(outputFile, JSON.stringify(proxies, null, 2));
console.log(`✅ Guardado ${proxies.length} proxies en ${outputFile}`);
