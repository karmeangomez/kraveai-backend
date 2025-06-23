const sources = [
  'https://raw.githubusercontent.com/TheSpeedX/PROXY-List/master/http.txt',
  'https://api.proxyscrape.com/v2/?request=getproxies&protocol=http',
  'https://raw.githubusercontent.com/mertguvencli/http-proxy-list/main/proxy-list/data.txt',
  'https://www.proxynova.com/proxy-server-list/'
];

async function fetchMassiveProxies() {
  let allProxies = [];
  for (const url of sources) {
    const response = await axios.get(url);
    const proxies = response.data.split('\n')
      .filter(line => line.includes(':'))
      .map(line => {
        const [ip, port] = line.trim().split(':');
        return `${ip}:${port}:username:password`; // Estructura estándar
      });
    allProxies = [...allProxies, ...proxies];
  }
  return [...new Set(allProxies)].slice(0, 10000); // 10,000 únicos
}
