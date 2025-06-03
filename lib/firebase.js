const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

// Cargar el archivo JSON directamente
const serviceAccount = JSON.parse(fs.readFileSync(path.join(__dirname, '../kraveai-firebase-adminsdk-fbsvc-01b7fc6517.json'), 'utf8'));

if (admin.apps.length === 0) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL: 'https://kraveai.firebaseio.com'
  });
}

module.exports = admin.firestore();
