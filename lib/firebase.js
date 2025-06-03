const admin = require('firebase-admin');

let serviceAccount;
try {
  serviceAccount = JSON.parse(process.env.FIREBASE_CREDENTIALS);
} catch (err) {
  console.error("❌ Error al parsear FIREBASE_CREDENTIALS:", err.message);
}

if (!admin.apps.length && serviceAccount) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const db = admin.apps.length ? admin.firestore() : null;
module.exports = db;
