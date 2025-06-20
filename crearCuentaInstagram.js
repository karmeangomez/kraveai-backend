const { cambiarIdentidad } = require('./cambiarIdentidad');
const { humanType, humanMouseMove } = require('./humanBehavior');

module.exports = async (datosUsuario, fingerprint) => {
  const browser = await puppeteer.launch({
    headless: "new",
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  const page = await browser.newPage();
  await cambiarIdentidad(page, fingerprint);
  
  try {
    // 1. Navegación inicial con retraso humano
    await page.goto('https://instagram.com', {
      waitUntil: 'networkidle2',
      timeout: 60000
    });
    await page.waitForTimeout(2000 + Math.random() * 3000);
    
    // 2. Comportamiento humano previo
    await humanMouseMove(page);
    
    // 3. Ir a página de registro
    await page.click('a[href="/accounts/emailsignup/"]');
    await page.waitForTimeout(1000 + Math.random() * 2000);
    
    // 4. Rellenar formulario con técnica rusa
    const fields = [
      { selector: 'input[name="email"]', value: datosUsuario.email },
      { selector: 'input[name="fullName"]', value: datosUsuario.nombre },
      { selector: 'input[name="username"]', value: datosUsuario.username },
      { selector: 'input[name="password"]', value: datosUsuario.password }
    ];
    
    for (const field of fields) {
      await page.waitForSelector(field.selector, { timeout: 5000 });
      await humanType(page, field.selector, field.value);
      await page.waitForTimeout(500 + Math.random() * 1000);
    }
    
    // 5. Click humano en botón de registro
    await humanMouseMove(page, 350, 200);
    await page.click('button[type="submit"]', {
      delay: 100 + Math.random() * 200
    });
    
    // ... (resto del proceso de verificación)
  } finally {
    await browser.close();
  }
};
