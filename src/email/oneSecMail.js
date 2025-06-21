export default class OneSecMail {
  async getEmailAddress() {
    try {
      // Generar email aleatorio con OneSecMail
      const randomString = Math.random().toString(36).substring(2, 10);
      return `${randomString}@1secmail.com`;
    } catch (error) {
      throw new Error(`OneSecMail failed: ${error.message}`);
    }
  }
}
