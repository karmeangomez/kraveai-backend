import InstAddr from './providers/instaddr.js';
import TempMail from './providers/tempmail.js';
import OneSecMail from './providers/onesecmail.js';
import IONOSMail from './providers/ionosMail.js';

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
        console.log("✅ Proveedor IONOSMail activado");
      }
    } catch (error) {
      console.warn("⚠️ IONOSMail desactivado:", error.message);
    }

    console.log(`📧 Proveedores activos: ${this.providers.map(p => p.constructor.name).join(', ')}`);
  }

  async getRandomEmail() {
    for (const provider of this.providers) {
      try {
        if (typeof provider.getEmailAddress === 'function') {
          const email = await provider.getEmailAddress();
          console.log(`📧 Email obtenido con ${provider.constructor.name}: ${email}`);
          return { email };
        }
      } catch (error) {
        console.warn(`⚠️ Fallo con ${provider.constructor.name}: ${error.message}`);
      }
    }

    const fallback = `fallback_${Date.now()}@example.com`;
    console.warn(`⚠️ Todos los proveedores fallaron. Usando email de respaldo: ${fallback}`);
    return { email: fallback };
  }
}
