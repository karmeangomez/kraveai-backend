import axios from 'axios';

export default {
  name: 'GuerrillaMail',
  sessionToken: null,
  
  async initSession() {
    const response = await axios.get('https://api.guerrillamail.com/ajax.php?f=get_email_address');
    this.sessionToken = response.data.sid_token;
    return response.data.email_addr;
  },

  async getEmailAddress() {
    if (!this.sessionToken) return this.initSession();
    
    const response = await axios.get(`https://api.guerrillamail.com/ajax.php?f=get_email_address&sid_token=${this.sessionToken}`);
    return response.data.email_addr;
  },

  async getVerificationCode(email) {
    if (!this.sessionToken) return null;
    
    const response = await axios.get(`https://api.guerrillamail.com/ajax.php?f=get_email_list&offset=0&sid_token=${this.sessionToken}`);
    const emails = response.data.list;
    
    const instagramEmail = emails.find(e => 
      e.mail_subject.includes('Instagram') && 
      e.mail_recipient === email
    );
    
    if (instagramEmail) {
      const emailResponse = await axios.get(`https://api.guerrillamail.com/ajax.php?f=fetch_email&email_id=${instagramEmail.mail_id}&sid_token=${this.sessionToken}`);
      const body = emailResponse.data.mail_body;
      const codeMatch = body.match(/>(\d{6})</);
      return codeMatch ? codeMatch[1] : null;
    }
    return null;
  }
};
