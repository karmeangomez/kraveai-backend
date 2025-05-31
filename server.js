const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");
const puppeteer = require("puppeteer-core");
const helmet = require("helmet");
require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 3000;

// 🚀 Seguridad y configuración
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors());
app.use(bodyParser.json());

// 🚀 Endpoint de verificación de salud para Render
app.get("/health", (req, res) => {
  res.status(200).json({ status: "OK" });
});

// 🚀 Scraping de Instagram
app.get("/api/scrape", async (req, res) => {
  const { username } = req.query;
  if (!username) return res.status(400).json({ error: "?username= requerido" });

  try {
    const data = await scrapeInstagram(username);
    res.json(data);
  } catch (error) {
    console.error(`[ERROR] @${username}:`, error.message);
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
      "--single-process",
      "--disable-software-rasterizer",
      "--disable-background-networking",
      "--disable-web-security",
      "--disable-default-apps",
      "--lang=es-ES,es",
      `--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36`
    ],
    headless: true,
    timeout: 60000
  });

  try {
    const page = await browser.newPage();
    await page.goto(`https://www.instagram.com/${username}/`, { waitUntil: "networkidle2", timeout: 45000 });

    const data = await page.evaluate(() => {
      const og = (p) => document.querySelector(`meta[property="${p}"]`)?.content;
      return {
        username: document.title.split("(")[0].trim().replace("• Instagram", ""),
        profileImage: og("og:image"),
        followers: document.querySelector("span[title]")?.innerText || null,
        isVerified: !!document.querySelector('svg[aria-label="Cuenta verificada"]'),
      };
    });

    return data;
  } finally {
    await browser.close();
  }
}

// 🚀 Iniciar servidor en Render
app.listen(PORT, () => {
  console.log(`Servidor activo en puerto ${PORT}`);
});
