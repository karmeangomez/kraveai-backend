const admin = require('firebase-admin');

let serviceAccount;

try {
  if (!process.env.FIREBASE_CREDENTIALS) {
    throw new Error('❌ Variable FIREBASE_CREDENTIALS no encontrada en el entorno');
  }

  serviceAccount = JSON.parse(process.env.FIREBASE_CREDENTIALS);

  if (!admin.apps.length) {
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount)
    });
    console.log("✅ Firebase inicializado correctamente desde variable FIREBASE_CREDENTIALS");
  }
} catch (err) {
  console.error("❌ Error al inicializar Firebase:", err.message);
}

const db = admin.apps.length ? admin.firestore() : null;

module.exports = db;
