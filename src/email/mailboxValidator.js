import axios from 'axios';

export default {
  name: 'MailBoxValidator',
  apiKey: process.env.MAILBOXVALIDATOR_KEY,
  
  async getEmailAddress() {
    const response = await axios.get(`https://api.mailboxvalidator.com/v1/email/get?key=${this.apiKey}`);
    return response.data.email_address;
  },
  
  async getVerificationCode(email) {
    // Esperar 15 segundos para que llegue el email
    await new Promise(resolve => setTimeout(resolve, 15000));
    
    const response = await axios.get(`https://api.mailboxvalidator.com/v1/email/getcode?key=${this.apiKey}&email=${email}`);
    return response.data.verification_code;
  }
};
