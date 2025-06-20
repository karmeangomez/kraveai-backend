// src/email/oneSecMail.js
import axios from 'axios';

export default class OneSecMail {
  constructor(proxy = null) {
    this.apiUrl = 'https://www.1secmail.com/api/v1';
    this.session = axios.create({
      proxy: proxy ? { host: proxy.ip, port: proxy.port } : false,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/91.0.4472.124'
      }
    });
    this.email = null;
  }

  async createMailAddress() {
    try {
      const response = await this.session.get(`${this.apiUrl}/?action=genRandomMailbox`);
      this.email = response.data[0];
      return this.email;
    } catch (error) {
      throw new Error(`Error creando email: ${error.message}`);
    }
  }

  async checkTopMail() {
    if (!this.email) throw new Error('Email no generado');
    
    const [login, domain] = this.email.split('@');
    
    try {
      const response = await this.session.get(`${this.apiUrl}/?action=getMessages&login=${login}&domain=${domain}`);
      const messages = response.data || [];
      
      if (messages.length === 0) return null;
      
      const latestId = messages[0].id;
      const messageResponse = await this.session.get(
        `${this.apiUrl}/?action=readMessage&login=${login}&domain=${domain}&id=${latestId}`
      );
      
      const text = messageResponse.data.textBody;
      const code = text.match(/\b\d{6}\b/)?.[0];
      
      return { text, code };
    } catch (error) {
      throw new Error(`Error verificando correo: ${error.message}`);
    }
  }
}
