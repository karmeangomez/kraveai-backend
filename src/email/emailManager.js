import instaddr from './instaddr.js';
import tempmail from './tempMail.js';
import onesecmail from './oneSecMail.js';
import IONOSMail from './ionosMail.js';

export default class EmailManager {
  constructor() {
    this.providers = [
      instaddr,
      tempmail,
      onesecmail
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

    console.log(`📧 Proveedores activos: ${this.providers.map(p => p.getEmailAddress.name || p.constructor.name).join(', ')}`);
  }

  async getRandomEmail() {
    for (const provider of this.providers) {
      try {
        const email = await provider.getEmailAddress();
        console.log(`📨 Email generado: ${email}`);
        return email;
      } catch (error) {
        console.warn(`⚠️ Fallo con ${provider.getEmailAddress.name || provider.constructor.name}: ${error.message}`);
      }
    }

    throw new Error('❌ Todos los proveedores fallaron al generar email.');
  }
}
