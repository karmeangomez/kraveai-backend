import axios from 'axios';

// Configuración
const API_BASE = 'https://www.1secmail.com/api/v1/';
const TIMEOUT_MS = 25000;
const DOMAINS = ['1secmail.com', '1secmail.net', '1secmail.org'];

/**
 * Genera email temporal con dominio aleatorio
 * @returns {Promise<string>} Email temporal (ej: random123@1secmail.com)
 */
export async function getEmailAddress() {
  try {
    const randomDomain = DOMAINS[Math.floor(Math.random() * DOMAINS.length)];
    const randomUser = Math.random().toString(36).substring(2, 12);
    return `${randomUser}@${randomDomain}`;
  } catch (error) {
    throw new Error(`Error generando email: ${error.message}`);
  }
}

/**
 * Busca código de verificación en emails recibidos
 * @param {string} email - Email generado por getEmailAddress()
 * @returns {Promise<string>} Código de 6 dígitos
 */
export async function getVerificationCode(email) {
  const [login, domain] = email.split('@');
  const startTime = Date.now();

  while (Date.now() - startTime < 120000) {
    try {
      const { data: emails } = await axios.get(
        `${API_BASE}?action=getMessages&login=${login}&domain=${domain}`,
        { timeout: TIMEOUT_MS }
      );

      for (const email of emails) {
        const { data: fullEmail } = await axios.get(
          `${API_BASE}?action=readMessage&login=${login}&domain=${domain}&id=${email.id}`,
          { timeout: TIMEOUT_MS }
        );

        if (/instagram\.com/i.test(fullEmail.from)) {
          const codeMatch = fullEmail.textBody.match(/\b\d{6}\b/);
          if (codeMatch) return codeMatch[0];
        }
      }

      await new Promise(resolve => setTimeout(resolve, 7000)); // Poll cada 7s
    } catch (error) {
      if (error.code !== 'ECONNABORTED') {
        await new Promise(resolve => setTimeout(resolve, 10000));
      }
    }
  }

  throw new Error('Código no recibido en 2 minutos');
}

export default { getEmailAddress, getVerificationCode };
