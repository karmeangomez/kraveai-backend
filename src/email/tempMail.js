export default class TempMail {
  async getEmailAddress() {
    try {
      // API de Temp-Mail.org
      const response = await axios.get('https://api.temp-mail.org/request/domains/format/json');
      const domains = response.data;
      const randomDomain = domains[Math.floor(Math.random() * domains.length)];
      const prefix = Math.random().toString(36).substring(2, 10);
      return `${prefix}@${randomDomain}`;
    } catch (error) {
      throw new Error(`TempMail failed: ${error.message}`);
    }
  }
}
