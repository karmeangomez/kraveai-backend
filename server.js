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
  res.status(200).json({ status: "OK", timestamp: new Date().toISOString() });
});

app.get("/api/scrape", async (req, res) => {
  const { username } = req.query;
  if (!username) return res.status(400).json({ error: "Falta el parámetro ?username=" });

  try {
    const data = await scrapeInstagram(username);
    res.json(data);
  } catch (error) {
    console.error("[SCRAPE ERROR]", error.message);
    res.status(500).json({ error: "Scraping fallido", details: error.message });
  }
});

async function scrapeInstagram(username) {
  const browser = await puppeteer.launch({
    executablePath: process.env.CHROMIUM_PATH || "/usr/bin/chromium",
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-gpu",
      "--disable-dev-shm-usage",
      "--single-process",
      "--lang=es-ES",
      "--window-size=1920,1080",
      `--user-agent=Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1`
    ],
    headless: true,
    timeout: 60000
  });

  try {
    const page = await browser.newPage();
    await page.goto("https://www.instagram.com/accounts/login/", {
      waitUntil: "networkidle2",
      timeout: 25000
    });

    await page.waitForSelector('input[name="username"]', { timeout: 10000 });
    await page.type('input[name="username"]', process.env.IG_USER, { delay: 50 });
    await page.type('input[name="password"]', process.env.IG_PASSWORD, { delay: 50 });
    await page.click('button[type="submit"]');

    await page.waitForNavigation({ waitUntil: "networkidle2", timeout: 20000 });

    await page.goto(`https://www.instagram.com/${username}/`, {
      waitUntil: "networkidle2",
      timeout: 25000
    });

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

    return data;
  } finally {
    await browser.close();
  }
}

app.listen(PORT, () => {
  console.log(`🚀 Servidor activo en puerto ${PORT}`);
});
