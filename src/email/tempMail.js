import axios from 'axios';

// Configuración
const API_BASE = 'https://api.mail.tm';
const TIMEOUT_MS = 30000;
let token = null;

/**
 * Crea email temporal real con Mail.tm
 * @returns {Promise<string>} Email temporal (ej: random123@mail.tm)
 */
export async function getEmailAddress() {
  try {
    // Obtener dominio
    const { data: domains } = await axios.get(`${API_BASE}/domains`, { timeout: TIMEOUT_MS });
    const domain = domains['hydra:member'][0].domain;
    
    // Generar credenciales
    const user = `insta_${Math.random().toString(36).substring(2, 8)}`;
    const email = `${user}@${domain}`;
    const password = Math.random().toString(36).substring(2, 16);
    
    // Crear cuenta
    await axios.post(
      `${API_BASE}/accounts`,
      { address: email, password },
      { timeout: TIMEOUT_MS }
    );
    
    // Obtener token
    const { data: auth } = await axios.post(
      `${API_BASE}/token`,
      { address: email, password }
    );
    
    token = auth.token;
    return email;
    
  } catch (error) {
    throw new Error(`Fallo en Mail.tm: ${error.response?.data?.message || error.message}`);
  }
}

/**
 * Recupera código de Instagram desde el buzón
 * @param {string} email - Email generado por getEmailAddress()
 * @returns {Promise<string>} Código de 6 dígitos
 */
export async function getVerificationCode(email) {
  if (!token) throw new Error('Token no disponible. Genere el email primero.');

  const startTime = Date.now();
  while (Date.now() - startTime < 120000) {
    try {
      const { data: messages } = await axios.get(
        `${API_BASE}/messages`,
        {
          headers: { Authorization: `Bearer ${token}` },
          timeout: TIMEOUT_MS
        }
      );

      for (const msg of messages['hydra:member']) {
        if (msg.from.address.includes('instagram.com')) {
          const { data: fullMsg } = await axios.get(
            `${API_BASE}/messages/${msg.id}`,
            {
              headers: { Authorization: `Bearer ${token}` },
              timeout: TIMEOUT_MS
            }
          );
          
          const codeMatch = fullMsg.text.match(/>(\d{6})</);
          if (codeMatch) return codeMatch[1];
        }
      }
      
      await new Promise(resolve => setTimeout(resolve, 8000)); // Poll cada 8s
    } catch (error) {
      if (error.response?.status === 401) {
        throw new Error('Sesión expirada. Genere un nuevo email.');
      }
      await new Promise(resolve => setTimeout(resolve, 10000));
    }
  }
  
  throw new Error('Código no recibido en 2 minutos');
}

export default { getEmailAddress, getVerificationCode };
