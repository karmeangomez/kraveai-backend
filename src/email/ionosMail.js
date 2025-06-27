import nodemailer from 'nodemailer';
import Imap from 'imap';
import { simpleParser } from 'mailparser';

export default class IONOSMail {
  constructor() {
    this.username = process.env.IONOS_EMAIL || '';
    this.password = process.env.IONOS_PASSWORD || '';
    this.imapConfig = {
      user: this.username,
      password: this.password,
      host: 'imap.ionos.com',
      port: 993,
      tls: true
    };
    this.smtpConfig = {
      service: 'IONOS',
      auth: {
        user: this.username,
        pass: this.password
      }
    };

    if (!this.username || !this.password) {
      console.warn('⚠️ Credenciales IONOS no configuradas - Proveedor desactivado');
      this.active = false;
      return;
    }

    this.active = true;
    this.transporter = nodemailer.createTransport(this.smtpConfig);
    this.verificationCode = null;
    console.log('✅ Proveedor IONOSMail activado');
  }

  isActive() {
    return this.active;
  }

  async getEmailAddress() {
    if (!this.active) throw new Error('IONOSMail no activo');
    const prefix = Math.random().toString(36).substring(2, 10);
    return `${prefix}@kraveapi.xyz`;
  }

  async waitForVerificationCode(timeout = 60000) {
    if (!this.active) throw new Error('IONOSMail no activo');

    return new Promise((resolve, reject) => {
      const imap = new Imap(this.imapConfig);
      imap.once('ready', () => {
        imap.openBox('INBOX', true, (err) => {
          if (err) return reject(err);

          imap.on('mail', () => {
            imap.search(['UNSEEN', ['SINCE', new Date()]], (err, results) => {
              if (err) return reject(err);
              if (!results.length) return;

              const fetch = imap.fetch(results, { bodies: '' });
              fetch.on('message', (msg) => {
                msg.on('body', (stream) => {
                  simpleParser(stream, (err, mail) => {
                    if (err) return reject(err);
                    if (mail.from.text.includes('instagram') && mail.subject.includes('verify')) {
                      const codeMatch = mail.text.match(/\b(\d{6})\b/); // Busca código de 6 dígitos
                      if (codeMatch) {
                        this.verificationCode = codeMatch[1];
                        imap.end();
                        resolve(this.verificationCode);
                      }
                    }
                  });
                });
              });
              fetch.once('error', reject);
            });
          });

          imap.start();
        });
      });

      imap.once('error', reject);
      imap.once('end', () => reject(new Error('Conexión IMAP cerrada')));
      imap.connect();

      setTimeout(() => {
        imap.end();
        reject(new Error('Tiempo de espera agotado para el código de verificación'));
      }, timeout);
    });
  }

  async sendVerificationCode(code) {
    if (!this.active) throw new Error('IONOSMail no activo');
    const mailOptions = {
      from: this.username,
      to: this.username,
      subject: 'Verification Code',
      text: `Your verification code is ${code}`
    };

    await this.transporter.sendMail(mailOptions);
    console.log('✅ Código de verificación enviado');
  }
}
