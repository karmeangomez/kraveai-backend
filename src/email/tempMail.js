// src/email/tempMail.js
import axios from 'axios';

export default class TempMail {
  constructor(proxy = null) {
    this.apiUrl = 'https://api.temp-mail.org';
    this.session = axios.create({
      baseURL: this.apiUrl,
      proxy: proxy ? { host: proxy.ip, port: proxy.port } : false,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/91.0.4472.124'
      }
    });
    this.email = null;
    this.token = null;
  }

  async createMailAddress() {
    try {
      const response = await this.session.get('/request/mail/id/random/');
      this.email = response.data.email;
      this.token = response.data.token;
      return this.email;
    } catch (error) {
      throw new Error(`Error creando email: ${error.response?.data || error.message}`);
    }
  }

  async checkTopMail() {
    if (!this.token) throw new Error('Token no disponible');
    
    try {
      const response = await this.session.get(`/request/inbox/id/${this.token}`);
      const messages = response.data?.mail_list || [];
      
      if (messages.length === 0) return null;
      
      const latest = messages[0];
      const messageResponse = await this.session.get(`/request/one_mail/id/${latest.id}`);
      
      const text = messageResponse.data.body_text;
      const code = text.match(/\b\d{6}\b/)?.[0];
      
      return { text, code };
    } catch (error) {
      throw new Error(`Error verificando correo: ${error.response?.data || error.message}`);
    }
  }
}
