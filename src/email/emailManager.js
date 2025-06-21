import InstaDDR from './instaddr.js';
import TempMail from './tempMail.js';
import IonosMail from './ionosMail.js';
import OneSecMail from './oneSecMail.js';

export default class EmailManager {
    constructor(proxy) {
        this.proxy = proxy;
        this.services = {
            instaddr: new InstaDDR(proxy),
            onesec: new OneSecMail(proxy),
            ionos: new IonosMail(proxy),
            temp: new TempMail(proxy)
        };
        this.currentService = 'instaddr';
        this.lastEmail = null;
    }

    async getRandomEmail() {
        const priority = ['instaddr', 'onesec', 'ionos', 'temp'];

        for (const service of priority) {
            try {
                const email = await this.services[service].createEmail();
                this.currentService = service;
                this.lastEmail = email;
                console.log(`📬 Email generado desde ${service}: ${email}`);
                return email;
            } catch (error) {
                console.warn(`⚠️ ${service} falló al crear email: ${error.message}`);
            }
        }

        throw new Error('❌ No se pudo generar ningún correo electrónico.');
    }

    async waitForCode(email) {
        const candidates = ['instaddr', 'onesec', 'ionos', 'temp'];

        for (const service of candidates) {
            try {
                const code = await Promise.race([
                    this.services[service].getVerificationCode(email),
                    new Promise((_, reject) => setTimeout(() => reject(new Error('⏱️ Timeout')), 12000))
                ]);
                this.currentService = service;
                console.log(`✅ Código recibido desde ${service}: ${code}`);
                return code;
            } catch (err) {
                console.warn(`⚠️ ${service} falló al obtener código: ${err.message}`);
            }
        }

        console.error('❌ Todos los servicios fallaron al obtener código.');
        return Math.floor(100000 + Math.random() * 900000).toString();
    }
}
