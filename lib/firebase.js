const admin = require('firebase-admin');
const path = require('path');
const fs = require('fs');

let serviceAccount;

try {
  if (process.env.FIREBASE_CREDENTIALS) {
    serviceAccount = JSON.parse(process.env.FIREBASE_CREDENTIALS);
  } else if (process.env.USE_LOCAL_FIREBASE_KEY === 'true') {
    const filePath = path.join(__dirname, 'firebase-key.json');
    const file = fs.readFileSync(filePath, 'utf8');
    serviceAccount = JSON.parse(file);
  } else {
    throw new Error('No Firebase credentials provided.');
  }
} catch (err) {
  console.error("❌ No se pudo cargar credenciales Firebase:", err.message);
}

if (!admin.apps.length && serviceAccount) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const db = admin.apps.length ? admin.firestore() : null;

module.exports = db;
