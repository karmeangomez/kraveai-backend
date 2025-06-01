// (código original no incluido por longitud) — solo se corrige scrapeInstagram

// ...tu código intacto arriba...

// Ruta /api/scrape: scraping de perfil de Instagram con Puppeteer
app.get('/api/scrape', async (req, res) => {
  const igUsername = req.query.username;
  if (!igUsername) {
    return res.status(400).json({ error: 'No se proporcionó el nombre de usuario de Instagram.' });
  }

  if (!process.env.IG_USER || !process.env.IG_PASS) {
    console.error("[Scrape] Credenciales de Instagram no configuradas.");
    return res.status(500).json({ error: 'Credenciales de Instagram no configuradas en el servidor.' });
  }

  console.log("[Scrape] Iniciando scraping para el perfil:", igUsername);
  let browser;

  try {
    browser = await puppeteer.launch({
      headless: true,
      executablePath: process.env.CHROME_BINARY_PATH || puppeteer.executablePath(),
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const page = await browser.newPage();
    console.log("[Scrape] Navegando a login...");
    await page.goto('https://www.instagram.com/accounts/login/', { waitUntil: 'networkidle2' });

    await page.waitForSelector('input[name="username"]', { timeout: 10000 });
    await page.type('input[name="username"]', process.env.IG_USER, { delay: 100 });
    await page.type('input[name="password"]', process.env.IG_PASS, { delay: 100 });
    await page.click('button[type="submit"]');
    console.log("[Scrape] Esperando navegación tras login...");
    await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 15000 }).catch(() => {
      console.log("[Scrape] No hubo navegación posterior, continuamos...");
    });

    console.log(`[Scrape] Accediendo a perfil ${igUsername}...`);
    await page.goto(`https://www.instagram.com/${igUsername}/`, { waitUntil: 'networkidle2', timeout: 20000 });

    console.log("[Scrape] Esperando <header>...");
    await page.waitForSelector('header', { timeout: 60000 });

    const data = await page.evaluate(() => {
      const getMeta = (p) => document.querySelector(`meta[property="${p}"]`)?.content;
      const desc = getMeta("og:description") || "";
      const match = desc.match(/([\d,.]+)\sseguidores/);
      return {
        username: document.title.split("(")[0].trim().replace("• Instagram", ""),
        profileImage: getMeta("og:image"),
        followers: match ? match[1] : null,
        isVerified: !!document.querySelector('svg[aria-label="Cuenta verificada"]')
      };
    });

    console.log("[Scrape] Datos obtenidos:", data);
    res.json(data);
  } catch (error) {
    console.error("[Scrape] Error durante scraping:", error.message);
    res.status(500).json({ error: error.message || 'Error durante scraping' });
  } finally {
    if (browser) await browser.close();
  }
});
