export default class IONOSMail {
  constructor() {
    this.config = {
      user: process.env.IONOS_EMAIL,     // <-- nombre correcto
      password: process.env.IONOS_PASSWORD, // <-- nombre correcto
      host: 'imap.ionos.mx',
      port: 993,
      tls: true,
      authTimeout: 10000
    };

    if (!this.config.user || !this.config.password) {
      throw new Error('IONOS credentials not configured');
    }
  }
}
