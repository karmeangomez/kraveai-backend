const fs = require('fs');
const path = require('path');

// Función para verificar y encontrar Chromium
async function verifyChromium() {
  const possiblePaths = [
    '/usr/bin/chromium-browser',
    '/usr/bin/chromium',
    '/usr/bin/google-chrome',
    '/usr/bin/chrome',
    process.env.CHROMIUM_PATH,
    process.env.PUPPETEER_EXECUTABLE_PATH
  ].filter(Boolean);

  console.log('Buscando Chromium en las rutas:');
  
  for (const chromiumPath of possiblePaths) {
    console.log(`- ${chromiumPath}`);
    try {
      if (fs.existsSync(chromiumPath)) {
        console.log(`✅ Chromium encontrado en: ${chromiumPath}`);
        return chromiumPath;
      }
    } catch (err) {
      console.log(`⚠️ Error verificando ${chromiumPath}: ${err.message}`);
    }
  }

  console.error('❌ Chromium no encontrado en ninguna ruta conocida');
  console.log('Contenido de /usr/bin:');
  const usrBinFiles = fs.readdirSync('/usr/bin');
  console.log(usrBinFiles.filter(file => file.includes('chrom')));
  
  throw new Error('Chromium no encontrado en el sistema');
}
