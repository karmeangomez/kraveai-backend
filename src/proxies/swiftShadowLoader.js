// src/proxies/swiftShadowLoader.js
import axios from 'axios';

export default async function loadSwiftShadowProxies() {
  try {
    console.log('🕵️‍♂️ Cargando proxies desde SwiftShadow...');

    const { data } = await axios.get('https://raw.githubusercontent.com/roosterkid/openproxylist/main/SOCKS5.txt');

    const proxies = data
      .split('\n')
      .filter(line => line.includes(':'))
      .slice(0, 50)
      .map(line => {
        const [ip, port] = line.trim().split(':');
        return {
          ip,
          port: parseInt(port),
          auth: {
            username: 'user',
            password: 'pass'
          },
          type: 'socks5',
          country: 'XX',
          lastUsed: 0,
          successCount: 0,
          failCount: 0
        };
      });

    console.log(`✅ ${proxies.length} proxies públicos cargados desde SwiftShadow`);
    return proxies;
  } catch (err) {
    console.error('❌ Error en SwiftShadow:', err.message);
    return [];
  }
}
