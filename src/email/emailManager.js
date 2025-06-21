import InstAddr from './instaddr.js';
import TempMail from './tempMail.js';
import OneSecMail from './oneSecMail.js';
import IONOSMail from './ionosMail.js';

export default class EmailManager {
  constructor() {
    this.providers = [
      new InstAddr(),
      new TempMail(),
      new OneSecMail()
    ];

    try {
      const ionos = new IONOSMail();
      if (ionos.isActive()) {
        this.providers.push(ionos);
      }
    } catch (err) {
      console.warn("❌ IONOSMail no disponible:", err.message);
    }

    console.log("📧 Proveedores activos:", this.providers.map(p => p.constructor.name).join(', '));
  }

  async getRandomEmail() {
    for (const provider of this.providers) {
      try {
        if (typeof provider.getEmailAddress === 'function') {
          const email = await provider.getEmailAddress();
          return email;
        } else {
          throw new Error(`${provider.constructor.name} no implementa getEmailAddress()`);
        }
      } catch (err) {
        console.warn(`⚠️ Fallo con ${provider.constructor.name}: ${err.message}`);
      }
    }
    throw new Error("❌ Todos los proveedores fallaron al generar email.");
  }
}
