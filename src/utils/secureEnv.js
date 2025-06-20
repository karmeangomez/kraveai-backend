// src/utils/secureEnv.js
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

// 1. Generar claves de cifrado (ejecutar solo una vez)
export function generateKeys() {
  const key = crypto.randomBytes(32); // Clave AES-256
  const iv = crypto.randomBytes(16);  // Vector de inicialización
  return { key: key.toString('hex'), iv: iv.toString('hex') };
}

// 2. Cifrar texto
export function encrypt(text, keyHex, ivHex) {
  const key = Buffer.from(keyHex, 'hex');
  const iv = Buffer.from(ivHex, 'hex');
  const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return encrypted;
}

// 3. Descifrar texto
export function decrypt(encryptedText, keyHex, ivHex) {
  const key = Buffer.from(keyHex, 'hex');
  const iv = Buffer.from(ivHex, 'hex');
  const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
  let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

// 4. Guardar .env cifrado
export function saveEncryptedEnv(credentials) {
  const envContent = `
    IONOS_USER="${credentials.user}"
    IONOS_PASS="${credentials.pass}"
  `;
  
  // Obtener claves de GitHub Secrets
  const key = process.env.CRYPTO_KEY;
  const iv = process.env.CRYPTO_IV;
  
  if (!key || !iv) {
    throw new Error('Faltan claves de cifrado en los secrets');
  }
  
  const encrypted = encrypt(envContent, key, iv);
  fs.writeFileSync('.env.enc', encrypted);
  console.log('🔐 .env cifrado guardado');
}

// 5. Cargar y descifrar .env
export function loadDecryptedEnv() {
  if (!fs.existsSync('.env.enc')) {
    throw new Error('No existe archivo .env cifrado');
  }
  
  const encrypted = fs.readFileSync('.env.enc', 'utf8');
  const key = process.env.CRYPTO_KEY;
  const iv = process.env.CRYPTO_IV;
  
  const decrypted = decrypt(encrypted, key, iv);
  fs.writeFileSync('.env', decrypted);
  console.log('🔓 .env descifrado y cargado');
}
