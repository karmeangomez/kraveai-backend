// server.js (al inicio del archivo)
const path = require('path');

// Ruta absoluta para Chromium
const chromiumPath = path.join(process.cwd(), 'chromium', 'chrome');

// Verificar existencia (para debug)
const fs = require('fs');
console.log('Chromium exists?', fs.existsSync(chromiumPath));
