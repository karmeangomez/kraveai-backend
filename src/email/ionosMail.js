// src/email/ionosMail.js
export default class IONOSMail {
  constructor() {
    this.config = {
      user: process.env.IONOS_USER,
      password: process.env.IONOS_PASS,
      host: 'imap.ionos.mx',
      port: 993,
      tls: true,
      authTimeout: 10000
    };
    
    // Validación básica
    if (!this.config.user || !this.config.password) {
      throw new Error('IONOS credentials not configured');
    }
  }
}
