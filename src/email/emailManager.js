import InstaDDR from './instaddr.js';
import TempMail from './tempMail.js';
import IonosMail from './ionosMail.js';
import OneSecMail from './oneSecMail.js';

export default class EmailManager {
    constructor(proxy) {
        this.proxy = proxy;
        this.services = {
            instaddr: new InstaDDR(proxy),
            temp: new TempMail(proxy),
            ionos: new IonosMail(proxy),
            onesec: new OneSecMail(proxy)
        };
        this.currentService = 'instaddr';
    }

    async createEmail() {
        try {
            return await this.services[this.currentService].createEmail();
        } catch (error) {
            console.error(`Fallback a temp mail: ${error.message}`);
            this.currentService = 'temp';
            return this.services.temp.createEmail();
        }
    }

    async getVerificationCode(email) {
        try {
            return await this.services[this.currentService].getVerificationCode(email);
        } catch (error) {
            console.error(`Error obteniendo código: ${error.message}`);
            // Generar código aleatorio como fallback
            return Math.floor(100000 + Math.random() * 900000).toString();
        }
    }
}
