const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

let serviceAccount;
try {
  const filePath = path.join(__dirname, '../credentials/firebase-key.json');
  const file = fs.readFileSync(filePath, 'utf8');
  serviceAccount = JSON.parse(file);
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
