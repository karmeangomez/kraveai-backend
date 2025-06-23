// src/accounts/sessionManager.js
import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

puppeteer.use(StealthPlugin());
const __dirname = path.dirname(fileURLToPath(import.meta.url));

export async function restoreInstagramSession(username) {
  // 1. Buscar la cuenta en el registro
  const accountsData = JSON.parse(fs.readFileSync(path.join(__dirname, '../cuentas_creadas.json'), 'utf8'));
  const account = accountsData.find(acc => acc.username === username);
  
  if (!account) throw new Error(`Cuenta ${username} no encontrada`);
  
  // 2. Cargar cookies
  const cookiesPath = path.join(__dirname, `../${account.cookiesPath}`);
  if (!fs.existsSync(cookiesPath)) {
    throw new Error(`Cookies no encontradas para ${username}`);
  }
  
  const cookies = JSON.parse(fs.readFileSync(cookiesPath, 'utf8'));
  
  // 3. Configurar proxy
  const proxyArgs = account.proxy ? [`--proxy-server=${account.proxy}`] : [];
  
  // 4. Iniciar navegador con sesión restaurada
  const browser = await puppeteer.launch({
    headless: false,
    args: [
      ...proxyArgs,
      '--no-sandbox',
      '--disable-setuid-sandbox'
    ]
  });
  
  const page = await browser.newPage();
  await page.setCookie(...cookies);
  
  // 5. Verificar sesión
  await page.goto('https://www.instagram.com/', { waitUntil: 'networkidle2' });
  
  const isLoggedIn = await page.evaluate(() => {
    return !!document.querySelector('a[href*="/accounts/logout/"]');
  });
  
  if (!isLoggedIn) {
    await browser.close();
    throw new Error('❌ La sesión no pudo restaurarse');
  }
  
  console.log(`✅ Sesión restaurada para @${username}`);
  return { browser, page, account };
}

// Función para realizar acciones en la cuenta
export async function performAccountAction(username, actionCallback) {
  const { browser, page, account } = await restoreInstagramSession(username);
  
  try {
    // Ejecutar la acción personalizada
    await actionCallback(page, account);
    
    // Actualizar cookies
    const updatedCookies = await page.cookies();
    fs.writeFileSync(
      path.join(__dirname, `../${account.cookiesPath}`),
      JSON.stringify(updatedCookies, null, 2)
    );
  } finally {
    await browser.close();
  }
}
