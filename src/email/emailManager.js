export default class EmailManager {
  constructor() {
    this.providers = [
      new InstAddr(),
      new OneSecMail()
    ];
    
    // Intenta agregar IONOS solo si está configurado
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
    
    // Selecciona un proveedor aleatorio
    const randomIndex = Math.floor(Math.random() * this.providers.length);
    const provider = this.providers[randomIndex];
    
    try {
      return await provider.getEmailAddress();
    } catch (error) {
      console.warn(`⚠️ Fallo con ${provider.constructor.name}: ${error.message}`);
      // Reintenta con otro proveedor
      return this.getRandomEmail();
    }
  }
}
