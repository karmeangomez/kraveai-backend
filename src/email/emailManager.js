// src/email/emailManager.js
import oneSecMail from './oneSecMail.js';
import tempMail from './tempMail.js';
import instaddr from './instaddr.js';
import IONOSMail from './ionosMail.js';

const emailManager = {
  providers: [],

  init() {
    this.providers = [oneSecMail, tempMail, instaddr];

    try {
      const ionos = new IONOSMail();
      if (ionos.isActive()) {
        this.providers.push(ionos);
        console.log('✅ Proveedor IONOSMail activado');
      }
    } catch (e) {
      console.warn('⚠️ IONOSMail no disponible:', e.message);
    }

    console.log(
      `📧 Proveedores activos: ${this.providers
        .map(p => p?.getEmailAddress?.name || p?.constructor?.name || 'desconocido')
        .join(', ')}`
    );
  },

  async getRandomEmail() {
    for (const provider of this.providers) {
      try {
        if (typeof provider.getEmailAddress === 'function') {
          const email = await provider.getEmailAddress();
          if (email && email.includes('@')) {
            console.log(`📨 Email generado: ${email}`);
            return email;
          }
        }
      } catch (error) {
        console.warn(
          `⚠️ Fallo con ${provider?.getEmailAddress?.name || provider?.constructor?.name}: ${error.message}`
        );
      }
    }
    throw new Error('❌ Todos los proveedores fallaron al generar email.');
  }
};

emailManager.init();
export default emailManager;
