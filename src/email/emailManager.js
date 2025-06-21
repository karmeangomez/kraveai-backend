import InstAddr from './instaddr.js';
import OneSecMail from './oneSecMail.js';
import IONOSMail from './ionosMail.js';
import TempMail from './tempMail.js';

export default class EmailManager {
  constructor(proxy = null) {
    this.providers = [
      new InstAddr(proxy),
      new OneSecMail(proxy),
      new TempMail(proxy)
    ];

    // Agregar IONOS solo si está activo
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

    const randomIndex = Math.floor(Math.random() * this.providers.length);
    const provider = this.providers[randomIndex];

    try {
      return await provider.getEmailAddress();
    } catch (error) {
      console.warn(`⚠️ Fallo con ${provider.constructor.name}: ${error.message}`);
      return this.getRandomEmail(); // Fallback automático
    }
  }

  async waitForCode(email) {
    for (const provider of this.providers) {
      try {
        const { code } = await provider.checkTopMail(email);
        if (code) return code;
      } catch (error) {
        console.warn(`⚠️ ${provider.constructor.name} no encontró código: ${error.message}`);
      }
    }

    throw new Error("❌ No se pudo obtener ningún código de verificación.");
  }
}
