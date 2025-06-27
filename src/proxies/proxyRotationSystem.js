// 📁 src/proxies/proxyRotationSystem.js
import proxies from './proxies.json' assert { type: 'json' };
import { isProxyBlacklisted, addToBlacklist } from './proxyBlacklistManager.js';
import testProxy from './proxyTester.js';
import rotateTorIP from './torController.js';

export default class ProxyRotationSystem {
  constructor() {
    this.proxies = [];
    this.index = 0;
    this.cooldown = {};
  }

  async initialize() {
    this.proxies = proxies.filter(p => !isProxyBlacklisted(p));
    this.proxies = await this._testAll(this.proxies);
    console.log(`✅ ${this.proxies.length} proxies válidos cargados con geolocalización`);
  }

  async _testAll(proxyList) {
    const tested = [];
    for (const proxy of proxyList) {
      const result = await testProxy(proxy);
      if (result.ok) tested.push(proxy);
    }
    return tested;
  }

  async getNextProxy() {
    if (this.proxies.length === 0) return null;

    for (let i = 0; i < this.proxies.length; i++) {
      const proxy = this.proxies[this.index];
      this.index = (this.index + 1) % this.proxies.length;

      const key = `${proxy.ip}:${proxy.port}`;
      const cooldownUntil = this.cooldown[key];
      if (cooldownUntil && Date.now() < cooldownUntil) continue;

      return proxy;
    }

    // Si todos están en cooldown, forzar rotación Tor
    await rotateTorIP();
    return {
      ip: '127.0.0.1',
      port: 9050,
      type: 'socks5'
    };
  }

  async markProxyAsBad(proxy) {
    const key = `${proxy.ip}:${proxy.port}`;
    addToBlacklist(proxy);
    this.cooldown[key] = Date.now() + 30 * 60 * 1000; // 30 min de cooldown
  }
}
