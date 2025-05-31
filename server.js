const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");
const puppeteer = require("puppeteer-core");
const helmet = require("helmet");
require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors());
app.use(bodyParser.json());

app.get("/health", (req, res) => {
  res.status(200).json({ status: "OK" });
});

app.get("/api/scrape", async (req, res) => {
  const { username } = req.query;
  if (!username) return res.status(400).json({ error: "Se requiere ?username=" });

  try {
    const data = await scrapeInstagram(username);
    res.json(data);
  } catch (error) {
    console.error(`[SCRAPE ERROR] @${username}:`, error.message);
    res.status(500).json({ error: "Scraping fallido", details: error.message });
  }
});

async function scrapeInstagram(targetUsername) {
  const browser = await puppeteer.launch({
    executablePath: process.env.CHROMIUM_PATH || "/usr/bin/chromium",
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-gpu",
      "--single-process",
      "--lang=es-ES,es"
    ],
    headless: true,
    timeout: 60000
  });

  try {
    const page = await browser.newPage();

    // 1. Ir a Instagram login
    await page.goto("https://www.instagram.com/accounts/login/", {
      waitUntil: "networkidle2"
    });

    // 2. Login
    await page.waitForSelector('input[name="username"]', { timeout: 10000 });
    await page.type('input[name="username"]', process.env.IG_USER, { delay: 50 });
    await page.type('input[name="password"]', process.env.IG_PASSWORD, { delay: 50 });
    await page.click('button[type="submit"]');

    // 3. Esperar redirección
    await page.waitForNavigation({ waitUntil: "networkidle2", timeout: 20000 });

    // 4. Visitar perfil destino
    await page.goto(`https://www.instagram.com/${targetUsername}/`, {
      waitUntil: "networkidle2",
      timeout: 30000
    });

    // 5. Extraer datos
    const data = await page.evaluate(() => {
      const getMeta = (property) =>
        document.querySelector(`meta[property="${property}"]`)?.content;

      const desc = getMeta("og:description") || "";
      const match = desc.match(/([\d,.]+)\sseguidores/);

      return {
        username: document.title.split("(")[0].trim().replace("• Instagram", ""),
        profileImage: getMeta("og:image"),
        followers: match ? match[1] : null,
        isVerified: !!document.querySelector('svg[aria-label="Cuenta verificada"]'),
      };
    });

    return data;
  } finally {
    await browser.close();
  }
}

app.listen(PORT, () => {
  console.log(`Servidor activo en puerto ${PORT}`);
});
