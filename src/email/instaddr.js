import axios from 'axios';

export default class InstAddr {
  async getEmailAddress() {
    try {
      const response = await axios.get('https://www.instaddr.com/email_generator');
      const email = response.data.match(/Your email is: <b>(.*?)<\/b>/)[1];
      return email;
    } catch (error) {
      throw new Error(`InstAddr failed: ${error.message}`);
    }
  }
}
