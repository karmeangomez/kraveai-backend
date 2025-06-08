const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');

puppeteer.use(StealthPlugin());

function generarCorreoInstAddr() {
  const alias = `krave${Date.now()}`;
  const dominio = 'chokujou.com'; // También puedes usar: glambda.com, baryku.com, etc.
  return {
    alias,
    email: `${alias}@${dominio}`,
  };
}

async function obtenerCodigoInstAddr(alias) {
  const bandejaUrl = `https://instaddr.cc/m/#/inbox/${alias}@chokujou.com`;
  const browser = await puppeteer.launch({
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
    ]
  });

  const page = await browser.newPage();
  await page.goto(bandejaUrl, { waitUntil: 'networkidle2' });

  console.log("⏳ Esperando código de Instagram...");

  let codigo = null;
  const maxIntentos = 20;

  for (let i = 0; i < maxIntentos; i++) {
    const correos = await page.$$eval('.msglist .msg', elements =>
      elements.map(el => el.innerText.toLowerCase())
    );

    const index = correos.findIndex(c => c.includes('instagram'));
    if (index >= 0) {
      await page.click(`.msglist .msg:nth-child(${index + 1})`);
      await page.waitForSelector('.msgdetail .content');
      const contenido = await page.$eval('.msgdetail .content', el => el.innerText);
      const match = contenido.match(/\b\d{6}\b/);
      codigo = match ? match[0] : null;
      break;
    }

    await page.reload({ waitUntil: 'networkidle2' });
    await page.waitForTimeout(3000);
  }

  await browser.close();

  if (!codigo) throw new Error('Código no encontrado en instAddr.');
  return codigo;
}

module.exports = { generarCorreoInstAddr, obtenerCodigoInstAddr };
