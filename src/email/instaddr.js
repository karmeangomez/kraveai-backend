// src/email/instaddr.js
import axios from 'axios';
import { JSDOM } from 'jsdom';

export default class InstAddr {
  constructor(proxy = null) {
    this.baseUrl = 'https://m.kuku.lu';
    this.session = axios.create({
      baseURL: this.baseUrl,
      proxy: proxy ? { host: proxy.ip, port: proxy.port } : false,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/91.0.4472.124'
      }
    });
    this.csrfToken = null;
    this.sessionHash = null;
  }

  async init() {
    const response = await this.session.get('/');
    const cookies = response.headers['set-cookie'];
    this.csrfToken = cookies.find(c => c.includes('cookie_csrf_token')).match(/cookie_csrf_token=([^;]+)/)[1];
    this.sessionHash = cookies.find(c => c.includes('cookie_sessionhash')).match(/cookie_sessionhash=([^;]+)/)[1];
    this.session.defaults.headers.Cookie = `cookie_csrf_token=${this.csrfToken}; cookie_sessionhash=${this.sessionHash}`;
    return { csrfToken: this.csrfToken, sessionHash: this.sessionHash };
  }

  async createMailAddress(domain = null) {
    try {
      const url = domain 
        ? `/index.php?action=addMailAddrByManual&nopost=1&by_system=1&t=${Date.now()}&csrf_token_check=${this.csrfToken}&newdomain=${domain}`
        : '/index.php?action=addMailAddrByAuto&nopost=1&by_system=1';
      
      const response = await this.session.get(url);
      return response.data.slice(3); // Elimina prefijo "OK:"
    } catch (error) {
      throw new Error(`Error creando email: ${error.message}`);
    }
  }

  async checkTopMail(email) {
    try {
      const encodedEmail = encodeURIComponent(email);
      const response = await this.session.get(`/recv._ajax.php?&q=${encodedEmail}&nopost=1&csrf_token_check=${this.csrfToken}`);
      
      const dom = new JSDOM(response.data);
      const scripts = dom.window.document.querySelectorAll('script');
      const openMailData = Array.from(scripts).find(s => s.textContent.includes('openMailData'));
      
      if (!openMailData) throw new Error('No hay correos');
      
      const match = openMailData.textContent.match(/openMailData\('([^']+)','([^']+)','([^']+)','([^']+)'\)/);
      const [, num, key] = match;
      
      const mailResponse = await this.session.post('/smphone.app.recv.view.php', { num, key, noscroll: '1' });
      const mailDom = new JSDOM(mailResponse.data);
      
      const text = mailDom.window.document.querySelector('div[dir="ltr"]')?.textContent || '';
      const code = text.match(/\b\d{6}\b/)?.[0];
      
      return { text, code };
    } catch (error) {
      throw new Error(`Error verificando correo: ${error.message}`);
    }
  }
}
