export default class InstAddr {
  async getEmailAddress() {
    const prefix = Math.random().toString(36).substring(2, 10);
    return `${prefix}@instaddr.com`;
  }
}
