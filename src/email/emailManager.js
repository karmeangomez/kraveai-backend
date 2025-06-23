import IONOSMail from './ionosMail.js';
import GuerrillaMail from './guerrillaMail.js';
import MailTM from './mailtm.js';
import MailBoxValidator from './mailboxValidator.js';

const emailManager = {
  providers: [],

  init() {
    try {
      // 1. Proveedor premium (IONOS) - Máxima confiabilidad
      const ionos = new IONOSMail();
      if (ionos.isActive()) {
        this.providers.push(ionos);
        console.log('✅ Proveedor IONOSMail activado');
      }
    } catch (e) {
      console.warn('⚠️ IONOSMail no disponible:', e.message);
    }

    // 2. Proveedores alternativos confiables
    this.providers.push(
      MailBoxValidator,  // Servicio especializado en cuentas
      GuerrillaMail,     // Dominios rotativos
      MailTM             // Alta tasa de éxito actual
    );

    console.log(
      `📧 Proveedores activos: ${this.providers
        .map(p => p?.name || p?.constructor?.name || 'desconocido')
        .join(', ')}`
    );
  },

  async getRandomEmail() {
    // Orden aleatorio para evitar patrones detectables
    const shuffledProviders = [...this.providers].sort(() => Math.random() - 0.5);
    
    for (const provider of shuffledProviders) {
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
          `⚠️ Fallo con ${provider?.name || provider?.constructor?.name}: ${error.message}`
        );
      }
    }
    throw new Error('❌ Todos los proveedores fallaron al generar email.');
  },
  
  async getVerificationCode(email) {
    for (const provider of this.providers) {
      try {
        if (typeof provider.getVerificationCode === 'function') {
          const code = await provider.getVerificationCode(email);
          if (code && code.length >= 4) {
            return code;
          }
        }
      } catch {}
    }
    throw new Error('❌ Código de verificación no recibido');
  }
};

emailManager.init();
export default emailManager;
