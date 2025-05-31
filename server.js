const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");
const puppeteer = require("puppeteer-core");
const helmet = require("helmet");
const OpenAI = require("openai");
require("dotenv").config();

const fetch = (...args) => import("node-fetch").then(({ default: fetch }) => fetch(...args));
const app = express();
const PORT = process.env.PORT || 3000;

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors());
app.use(bodyParser.json());

// ✅ HEALTH
app.get("/health", (req, res) => {
  res.status(200).json({
    status: "OK",
    port: PORT,
    environment: process.env.NODE_ENV || "production",
    timestamp: new Date().toISOString()
  });
});

// ✅ IA CHAT
app.post("/api/chat", async (req, res) => {
  try {
    const { message } = req.body;
    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [{ role: "user", content: message }]
    });
    res.json({ response: completion.choices[0].message.content });
  } catch (err) {
    res.status(500).json({ error: "Error IA GPT", details: err.message });
  }
});

// ✅ VOZ IA
app.get("/voz-prueba", async (req, res) => {
  try {
    const speech = await openai.audio.speech.create({
      model: "tts-1",
      voice: "onyx",
      input: "Hola Karmean, esta es tu voz masculina inteligente integrada correctamente."
    });
    const buffer = Buffer.from(await speech.arrayBuffer());
    res.set({
      "Content-Type": "audio/mpeg",
      "Content-Disposition": "attachment; filename=voz.mp3"
    });
    res.send(buffer);
  } catch (err) {
    res.status(500).send("Error generando audio");
  }
});

// ✅ BITLY
app.get("/bitly-prueba", async (req, res) => {
  try {
    const enlaceOriginal = "https://instagram.com";
    const response = await fetch("https://api-ssl.bitly.com/v4/shorten", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.BITLY_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ long_url: enlaceOriginal })
    });

    const data = await response.json();
    res.json({ enlaceOriginal, enlaceAcortado: data.link || null });
  } catch (err) {
    res.status(500).json({ error: "Error Bitly", details: err.message });
  }
});

// ✅ SCRAPER LOGIN INSTAGRAM
app.get("/api/scrape", async (req, res) => {
  const { username } = req.query;
  if (!username) return res.status(400).json({ error: "Se requiere ?username=" });

  try {
    const data = await scrapeInstagram(username);
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: "Scraping fallido", details: err.message });
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

    // Iniciar sesión
    await page.goto("https://www.instagram.com/accounts/login/", { waitUntil: "networkidle2" });
    await page.waitForSelector('input[name="username"]', { timeout: 10000 });
    await page.type('input[name="username"]', process.env.IG_USER, { delay: 50 });
    await page.type('input[name="password"]', process.env.IG_PASSWORD, { delay: 50 });
    await page.click('button[type="submit"]');
    await page.waitForNavigation({ waitUntil: "networkidle2", timeout: 20000 });

    // Ir al perfil objetivo
    await page.goto(`https://www.instagram.com/${targetUsername}/`, {
      waitUntil: "networkidle2",
      timeout: 30000
    });

    // Extraer info
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
  console.log(`Servidor activo en puerto ${PORT}`);
});
