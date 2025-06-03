const admin = require('firebase-admin');
const path = require('path');
const fs = require('fs');

let serviceAccount;

try {
  // Intenta desde variable .env (Railway)
  serviceAccount = JSON.parse(process.env.FIREBASE_CREDENTIALS || '');
} catch (err) {
  try {
    // Si falla, busca archivo local
    const filePath = path.join(__dirname, '../firebase-key.json');
    const file = fs.readFileSync(filePath, 'utf8');
    serviceAccount = JSON.parse(file);
  } catch (err2) {
    console.error("❌ No se pudo cargar credenciales Firebase desde archivo ni .env");
  }
}

if (!admin.apps.length && serviceAccount) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const db = admin.apps.length ? admin.firestore() : null;

module.exports = db;
