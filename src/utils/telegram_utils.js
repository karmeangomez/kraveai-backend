// telegram_utils.js - Centro de notificaciones funcionales para KraveAI
import dotenv from 'dotenv';
import axios from 'axios';
import fs from 'fs';
import FormData from 'form-data';

dotenv.config();

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const CHAT_ID = process.env.TELEGRAM_CHAT_ID;
const BASE_URL = `https://api.telegram.org/bot${BOT_TOKEN}`;

function validarCredenciales() {
  if (!BOT_TOKEN || !CHAT_ID) {
    console.error('❌ TELEGRAM_BOT_TOKEN o TELEGRAM_CHAT_ID no configurados');
    return false;
  }
  return true;
}

export async function notifyTelegram(message) {
  if (!validarCredenciales()) return;
  try {
    await axios.post(`${BASE_URL}/sendMessage`, {
      chat_id: CHAT_ID,
      text: message,
      parse_mode: 'Markdown'
    });
    console.log('📲 Notificación enviada a Telegram.');
  } catch (err) {
    console.error(`❌ Error al enviar mensaje: ${err.message}`);
  }
}

export async function notifyTelegramWithImage(filePath, caption) {
  if (!validarCredenciales()) return;
  try {
    const form = new FormData();
    form.append('chat_id', CHAT_ID);
    form.append('caption', caption);
    form.append('photo', fs.createReadStream(filePath));

    await axios.post(`${BASE_URL}/sendPhoto`, form, {
      headers: form.getHeaders()
    });
  } catch (err) {
    console.error(`❌ Error al enviar imagen: ${err.message}`);
  }
}

export async function notifyCuentaExitosa(data) {
  const msg = `✅ *Cuenta creada:*
👤 Usuario: @${data.username}
📧 Email: ${data.email}
🌍 Proxy: ${data.proxy || 'sin proxy'}
🔗 https://instagram.com/${data.username}`;
  await notifyTelegram(msg);
  if (data.screenshotPath) {
    await notifyTelegramWithImage(data.screenshotPath, `📸 Captura de @${data.username}`);
  }
}

export async function notifyErrorCuenta(data, motivo) {
  const msg = `❌ *Error creando cuenta:*
👤 Usuario: @${data.username}
📧 Email: ${data.email}
🌍 Proxy: ${data.proxy || 'sin proxy'}
💥 Motivo: ${motivo}`;
  await notifyTelegram(msg);
}

export async function notifyResumenFinal({ total, success, fail, tiempo }) {
  const msg = `📊 *Resumen de ejecución:*
🧪 Total intentos: ${total}
✅ Éxitos: ${success}
❌ Fallos: ${fail}
⏱️ Duración: ${tiempo}`;
  await notifyTelegram(msg);
}

export async function notifyCaptchaDetected(usuario) {
  await notifyTelegram(`⚠️ *CAPTCHA detectado* para @${usuario}`);
}

export async function notifyCookiesGuardadas(path) {
  await notifyTelegram(`💾 Cookies guardadas en: ${path}`);
}

export async function notifyProxyFallido(proxy) {
  await notifyTelegram(`🚫 Proxy marcado como fallido:
${proxy}`);
}

export async function notifyInstanciaIniciada({ hora, entorno }) {
  await notifyTelegram(`👋 Hola Karmean, tu sistema se ha iniciado.
🕒 Hora: ${hora}
🧠 Entorno: ${entorno}`);
}
