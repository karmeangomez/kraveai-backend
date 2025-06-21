export default class IONOSMail {
  constructor() {
    this.username = process.env.IONOS_EMAIL || '';
    this.password = process.env.IONOS_PASSWORD || '';

    if (!this.username || !this.password) {
      console.warn("⚠️ Credenciales IONOS no configuradas - Proveedor desactivado");
      this.active = false;
      return;
    }

    this.active = true;
  }

  isActive() {
    return this.active;
  }

  async getEmailAddress() {
    if (!this.active) {
      throw new Error("IONOSMail no activo");
    }
    const prefix = Math.random().toString(36).substring(2, 10);
    return `${prefix}@kraveapi.xyz`;
  }
}
