import axios from 'axios';

export default {
  name: 'MailTM',
  account: null,
  
  async createAccount() {
    // 1. Obtener dominio
    const domainRes = await axios.get('https://api.mail.tm/domains');
    const domain = domainRes.data['hydra:member'][0].domain;
    
    // 2. Crear cuenta
    const address = `${Math.random().toString(36).substring(2, 10)}@${domain}`;
    const password = Math.random().toString(36);
    
    const accountRes = await axios.post('https://api.mail.tm/accounts', {
      address,
      password
    });
    
    this.account = { address, password, id: accountRes.data.id };
    return address;
  },

  async getEmailAddress() {
    if (!this.account) return this.createAccount();
    return this.account.address;
  },

  async getVerificationCode(email) {
    if (!this.account) return null;
    
    // 1. Obtener token
    const tokenRes = await axios.post('https://api.mail.tm/token', {
      address: this.account.address,
      password: this.account.password
    });
    
    // 2. Buscar email de Instagram
    const messagesRes = await axios.get('https://api.mail.tm/messages', {
      headers: { Authorization: `Bearer ${tokenRes.data.token}` }
    });
    
    const instagramMsg = messagesRes.data['hydra:member'].find(m => 
      m.subject.includes('Instagram') && 
      m.to[0].address === email
    );
    
    if (instagramMsg) {
      const messageRes = await axios.get(`https://api.mail.tm/messages/${instagramMsg.id}`, {
        headers: { Authorization: `Bearer ${tokenRes.data.token}` }
      });
      
      const codeMatch = messageRes.data.text.match(/\d{6}/);
      return codeMatch ? codeMatch[0] : null;
    }
    return null;
  }
};
