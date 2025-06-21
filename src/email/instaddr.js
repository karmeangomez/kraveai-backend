import axios from 'axios';
import { JSDOM } from 'jsdom';

export default class InstAddr {
  constructor(proxy = null) {
    this.baseUrl = 'https://m.kuku.lu';
    this.session = axios.create({
      baseURL: this.baseUrl,
      proxy: proxy ? {
        host: proxy.ip,
        port: proxy.port,
        ...(proxy.auth && {
          auth: {
            username: proxy.auth.username,
            password: proxy.auth.password
          }
        })
      } : undefined,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8'
      },
      timeout: 10000
    });
    this.csrfToken = null;
    this.sessionHash = null;
  }

  async init() {
    try {
      const response = await this.session.get('/');
      const cookies = response.headers['set-cookie'];
      
      if (!cookies) throw new Error('No se recibieron cookies');
      
      const csrfCookie = cookies.find(c => c.includes('cookie_csrf_token'));
      const sessionCookie = cookies.find(c => c.includes('cookie_sessionhash'));
      
      if (!csrfCookie || !sessionCookie) {
        throw new Error('Faltan cookies esenciales');
      }
      
      this.csrfToken = csrfCookie.match(/cookie_csrf_token=([^;]+)/)[1];
      this.sessionHash = sessionCookie.match(/cookie_sessionhash=([^;]+)/)[1];
      
      this.session.defaults.headers.common['Cookie'] = 
        `cookie_csrf_token=${this.csrfToken}; cookie_sessionhash=${this.sessionHash}`;
      
      return { csrfToken: this.csrfToken, sessionHash: this.sessionHash };
    } catch (error) {
      throw new Error(`Error en init: ${error.message}`);
    }
  }

  async createMailAddress(domain = null) {
    try {
      await this.init(); // Asegurar que tenemos tokens
      
      const url = domain 
        ? `/index.php?action=addMailAddrByManual&nopost=1&by_system=1&t=${Date.now()}&csrf_token_check=${this.csrfToken}&newdomain=${domain}`
        : '/index.php?action=addMailAddrByAuto&nopost=1&by_system=1';
      
      const response = await this.session.get(url);
      
      if (!response.data.startsWith('OK:')) {
        throw new Error(`Respuesta inesperada: ${response.data}`);
      }
      
      return response.data.slice(3).trim(); // Elimina prefijo "OK:"
    } catch (error) {
      throw new Error(`Error creando email: ${error.message}`);
    }
  }

  async checkTopMail(email, maxRetries = 3) {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const encodedEmail = encodeURIComponent(email);
        const response = await this.session.get(
          `/recv._ajax.php?&q=${encodedEmail}&nopost=1&csrf_token_check=${this.csrfToken}`
        );
        
        const dom = new JSDOM(response.data);
        const scripts = dom.window.document.querySelectorAll('script');
        const openMailData = Array.from(scripts).find(s => 
          s.textContent.includes('openMailData')
        );
        
        if (!openMailData) {
          if (attempt < maxRetries) {
            await new Promise(resolve => setTimeout(resolve, 2000));
            continue;
          }
          throw new Error('No hay correos disponibles');
        }
        
        const match = openMailData.textContent.match(
          /openMailData\('([^']+)','([^']+)','([^']+)','([^']+)'\)/
        );
        
        if (!match || match.length < 3) {
          throw new Error('Formato de correo inesperado');
        }
        
        const [, num, key] = match;
        const mailResponse = await this.session.post('/smphone.app.recv.view.php', 
          `num=${num}&key=${key}&noscroll=1`,
          {
            headers: {
              'Content-Type': 'application/x-www-form-urlencoded'
            }
          }
        );
        
        const mailDom = new JSDOM(mailResponse.data);
        const text = mailDom.window.document.querySelector('div[dir="ltr"]')?.textContent || '';
        const code = text.match(/\b\d{6}\b/)?.[0];
        
        if (!code && attempt < maxRetries) {
          await new Promise(resolve => setTimeout(resolve, 2000));
          continue;
        }
        
        return { text, code };
      } catch (error) {
        if (attempt === maxRetries) {
          throw new Error(`Error verificando correo: ${error.message}`);
        }
      }
    }
    throw new Error('No se pudo obtener el código después de varios intentos');
  }
}
