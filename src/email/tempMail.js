export default class TempMail {
  async getEmailAddress() {
    const prefix = Math.random().toString(36).substring(2, 10);
    return `${prefix}@tempmail.net`;
  }
}
