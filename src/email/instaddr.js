import axios from 'axios';
import * as cheerio from 'cheerio';

// Configuración
const KUKU_BASE_URL = 'https://m.kuku.lu';
const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36';
const TIMEOUT_MS = 30000;

/**
 * Genera un email temporal real usando Kuku.lu
 * @returns {Promise<string>} Email temporal (ej: random123@kuku.lu)
 */
export async function getEmailAddress() {
  try {
    const response = await axios.get(`${KUKU_BASE_URL}/create.php`, {
      timeout: TIMEOUT_MS,
      headers: { 'User-Agent': USER_AGENT }
    });
    
    const $ = cheerio.load(response.data);
    const email = $('input#newmail').val();
    
    if (!email || !email.includes('@')) {
      throw new Error('No se pudo generar el email (selector inválido)');
    }
    
    return email;
  } catch (error) {
    throw new Error(`Fallo en Kuku.lu: ${error.message}`);
  }
}

/**
 * Obtiene el código de verificación de Instagram desde Kuku.lu
 * @param {string} email - Email generado por getEmailAddress()
 * @returns {Promise<string>} Código de 6 dígitos (ej: "123456")
 */
export async function getVerificationCode(email) {
  if (!email || !email.includes('@')) {
    throw new Error('Email inválido');
  }

  const [localPart, domain] = email.split('@');
  const startTime = Date.now();
  const MAX_WAIT_MS = 120000; // 2 minutos máximo

  while (Date.now() - startTime < MAX_WAIT_MS) {
    try {
      const response = await axios.get(
        `${KUKU_BASE_URL}/recv.php?email=${encodeURIComponent(email)}`,
        {
          timeout: TIMEOUT_MS,
          headers: { 'User-Agent': USER_AGENT }
        }
      );

      const $ = cheerio.load(response.data);
      const instagramRow = $('td:contains("instagram.com")').closest('tr');
      
      if (instagramRow.length) {
        const codeMatch = instagramRow.text().match(/>(\d{6})</);
        if (codeMatch) return codeMatch[1];
      }
      
      await new Promise(resolve => setTimeout(resolve, 5000)); // Espera 5 segundos
    } catch (error) {
      await new Promise(resolve => setTimeout(resolve, 10000)); // Reintenta después de error
    }
  }

  throw new Error('Código no recibido en 2 minutos');
}

export default { getEmailAddress, getVerificationCode };
