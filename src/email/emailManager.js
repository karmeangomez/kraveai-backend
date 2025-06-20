// src/email/emailManager.js
import InstAddr from './instaddr.js';
import TempMail from './tempMail.js';
import OneSecMail from './oneSecMail.js';
import IONOSMail from './ionosMail.js';

export default class EmailManager {
  constructor(proxy = null) {
    this.services = {
      instaddr: new InstAddr(proxy),
      tempmail: new TempMail(proxy),
      onesecmail: new OneSecMail(proxy),
      ionos: new IONOSMail()
    };
    
    this.currentService = null;
    this.currentEmail = null;
  }

  async createEmail(servicePreference = 'auto') {
    const serviceOrder = servicePreference === 'auto' 
      ? ['onesecmail', 'tempmail', 'instaddr', 'ionos'] 
      : [servicePreference];
    
    for (const serviceName of serviceOrder) {
      try {
        let email;
        
        switch(serviceName) {
          case 'instaddr':
            await this.services.instaddr.init();
            email = await this.services.instaddr.createMailAddress();
            this.currentService = 'instaddr';
            break;
            
          case 'tempmail':
            email = await this.services.tempmail.createMailAddress();
            this.currentService = 'tempmail';
            break;
            
          case 'onesecmail':
            email = await this.services.onesecmail.createMailAddress();
            this.currentService = 'onesecmail';
            break;
            
          case 'ionos':
            // Para IONOS, generamos un email aleatorio
            const prefix = Math.random().toString(36).substring(2, 8);
            email = `${prefix}@kraveapi.xyz`;
            this.currentService = 'ionos';
            break;
        }
        
        this.currentEmail = email;
        return email;
        
      } catch (error) {
        console.warn(`⚠️ Fallo con ${serviceName}: ${error.message}`);
      }
    }
    
    throw new Error('Todas las fuentes de email fallaron');
  }

  async getVerificationCode(timeout = 120000) {
    if (!this.currentService || !this.currentEmail) {
      throw new Error('Email no generado');
    }
    
    try {
      switch(this.currentService) {
        case 'instaddr':
          const resultInst = await this.services.instaddr.checkTopMail(this.currentEmail);
          return resultInst.code;
          
        case 'tempmail':
          const resultTemp = await this.services.tempmail.checkTopMail();
          return resultTemp.code;
          
        case 'onesecmail':
          const resultOneSec = await this.services.onesecmail.checkTopMail();
          return resultOneSec.code;
          
        case 'ionos':
          return await this.services.ionos.getVerificationCode(this.currentEmail, timeout);
      }
    } catch (error) {
      throw new Error(`Error obteniendo código: ${error.message}`);
    }
  }
}
