export default class IONOSMail {
  constructor() {
    this.username = process.env.IONOS_USER || '';
    this.password = process.env.IONOS_PASSWORD || '';
    
    // Verifica si las credenciales están vacías
    if (!this.username || !this.password) {
      console.warn("⚠️ Credenciales IONOS no configuradas - Proveedor desactivado");
      this.active = false;
      return;
    }
    
    this.active = true;
    console.log("✅ Proveedor IONOSMail activado");
  }
  
  isActive() {
    return this.active;
  }

  async getEmailAddress() {
    if (!this.active) {
      throw new Error("IONOSMail no activo");
    }
    // ... resto de tu implementación ...
  }
}
