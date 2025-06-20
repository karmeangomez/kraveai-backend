import UltimateProxyMaster from './ultimateProxyMaster.js';

// Esperar inicialización
setTimeout(() => {
  console.log('\n✅ Proxy System Test');
  console.log('Premium Proxy:', UltimateProxyMaster.proxySources.premium[0]);
  console.log('SwiftShadow Proxy:', UltimateProxyMaster.proxySources.swiftShadow[0] || 'Loading...');
  console.log('multiProxies Proxy:', UltimateProxyMaster.proxySources.multiProxies[0] || 'Loading...');
  
  UltimateProxyMaster.logStats();
}, 5000);
