const admin = require('firebase-admin');

let serviceAccount;

try {
  if (process.env.FIREBASE_CREDENTIALS) {
    serviceAccount = JSON.parse(process.env.FIREBASE_CREDENTIALS);
  } else {
    throw new Error("FIREBASE_CREDENTIALS no está definido en .env ni en Railway.");
  }
} catch (err) {
  console.error("❌ Error al cargar Firebase credentials:", err.message);
}

if (!admin.apps.length && serviceAccount) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const db = admin.apps.length ? admin.firestore() : null;

module.exports = db;
