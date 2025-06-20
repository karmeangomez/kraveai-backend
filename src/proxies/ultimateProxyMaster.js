import SwiftShadowLoader from './swiftShadowLoader.js';
import MultiProxiesRunner from './multiProxiesRunner.js';

class UltimateProxyMaster {
  constructor() {
    this.proxySources = {
      premium: this.loadPremiumProxies(),
      swiftShadow: [],
      multiProxies: []
    };
    this.init();
  }

  init() {
    setInterval(() => this.refreshSwiftShadow(), 1800000);
    setInterval(() => this.refreshMultiProxies(), 2100000);
    this.refreshAll();
  }

  loadPremiumProxies() {
    return [
      '31.57.90.48:5617:pdsmombq:terqdq67j6mp',
      '45.39.7.214:5645:pdsmombq:terqdq67j6mp'
    ];
  }

  async refreshAll() {
    await Promise.all([
      this.refreshSwiftShadow(),
      this.refreshMultiProxies()
    ]);
    console.log('🔥 Proxies actualizados');
    this.logStats();
  }

  async refreshSwiftShadow() {
    try {
      this.proxySources.swiftShadow = await SwiftShadowLoader.refreshProxies();
      console.log(`♻️ SwiftShadow: ${this.proxySources.swiftShadow.length} proxies`);
    } catch (error) {
      console.error('⚠️ Error SwiftShadow:', error);
    }
  }

  async refreshMultiProxies() {
    try {
      this.proxySources.multiProxies = await MultiProxiesRunner.getProxies();
      console.log(`♻️ multiProxies: ${this.proxySources.multiProxies.length} proxies`);
    } catch (error) {
      console.error('⚠️ Error multiProxies:', error);
    }
  }

  logStats() {
    console.log('📊 Proxy Stats:');
    console.log(`- Premium: ${this.proxySources.premium.length}`);
    console.log(`- SwiftShadow: ${this.proxySources.swiftShadow.length}`);
    console.log(`- multiProxies: ${this.proxySources.multiProxies.length}`);
  }
}

export default new UltimateProxyMaster();
