export default class OneSecMail {
  async getEmailAddress() {
    const prefix = Math.random().toString(36).substring(2, 10);
    return `${prefix}@1secmail.com`;
  }
}
