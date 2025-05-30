const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");
const OpenAI = require("openai");
const puppeteer = require("puppeteer-core");
const rateLimit = require("express-rate-limit");
const helmet = require("helmet");

require("dotenv").config();
const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));

const app = express();
const PORT = process.env.PORT || 3000;
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// 🚀 Seguridad y configuración
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors());
app.use(bodyParser.json());

// 🚀 Rate limiting
const apiLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 100,
  message: "Demasiadas solicitudes desde esta IP",
  standardHeaders: true
});
app.use("/api/scrape", apiLimiter);

// 🚀 Scraping real desde Instagram (SIN Redis)
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
      `--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/117.0.0.0 Safari/537.36`
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
