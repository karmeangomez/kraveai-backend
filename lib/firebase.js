const admin = require('firebase-admin');

let firebaseConfig = JSON.parse(process.env.FIREBASE_CREDENTIALS);

if (admin.apps.length === 0) {
  admin.initializeApp({
    credential: admin.credential.cert(firebaseConfig),
    databaseURL: 'https://kraveai.firebaseio.com'
  });
}

module.exports = admin.firestore();
