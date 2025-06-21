// src/email/emailManager.js

import InstAddr from './instaddr.js';
import TempMail from './tempMail.js';
import OneSecMail from './oneSecMail.js';
import IONOSMail from './ionosMail.js';

export default class EmailManager {
  constructor(proxy = null) {
    this.providers = [
      new InstAddr(proxy),
      new TempMail(proxy),
      new OneSecMail(proxy)
    ];

    const ionos = new IONOSMail();
    if (ionos.isActive()) {
      this.providers.push(ionos);
    }

    console.log(`📧 Proveedores activos: ${this.providers.map(p => p.constructor.name).join(', ')}`);
  }

  async getRandomEmail() {
    if (this.providers.length === 0) {
      throw new Error("No hay proveedores de email disponibles");
    }

    const shuffled = this.providers.sort(() => 0.5 - Math.random());

    for (const provider of shuffled) {
      try {
        const email = await provider.getEmailAddress();
        console.log(`📬 Email generado desde ${provider.constructor.name}: ${email}`);
        return email;
      } catch (error) {
        console.warn(`⚠️ Fallo con ${provider.constructor.name}: ${error.message}`);
      }
    }

    throw new Error("❌ Todos los proveedores fallaron al generar email.");
  }

  async waitForCode(email) {
    for (const provider of this.providers) {
      try {
        const { code } = await provider.checkTopMail(email);
        console.log(`✅ Código recibido desde ${provider.constructor.name}: ${code}`);
        return code;
      } catch (err) {
        console.warn(`⚠️ ${provider.constructor.name} falló al obtener código: ${err.message}`);
      }
    }

    console.error('❌ Todos los servicios fallaron al obtener código.');
    return Math.floor(100000 + Math.random() * 900000).toString(); // fallback aleatorio
  }
}
