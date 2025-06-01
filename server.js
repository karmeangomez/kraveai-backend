require("dotenv").config();
const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");
const helmet = require("helmet");
const puppeteer = require("puppeteer");
const OpenAI = require("openai");

const app = express();
const PORT = process.env.PORT || 3000;
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const fetch = (...args) => import("node-fetch").then(({ default: fetch }) => fetch(...args));

app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors());
app.use(bodyParser.json());

// 🔐 Variables de entorno
console.log("🔐 IG_USER:", process.env.IG_USER ? "✅ CARGADO" : "❌ VACÍO");
console.log("🔐 IG_PASSWORD:", process.env.IG_PASSWORD ? "✅ CARGADO" : "❌ VACÍO");

// Health Check
app.get("/health", (req, res) => {
  res.status(200).json({ status: "OK", port: PORT, timestamp: new Date().toISOString() });
});

// Bitly Test
app.get("/bitly-prueba", async (req, res) => {
  try {
    const response = await fetch("https://api-ssl.bitly.com/v4/shorten", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.BITLY_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ long_url: "https://instagram.com" }),
    });
    const data = await response.json();
    res.json({ original: "https://instagram.com", shortened: data.link || null });
  } catch (err) {
    res.status(500).json({ error: "Error Bitly", details: err.message });
  }
});

// GPT-4o Chat
app.post("/api/chat", async (req, res) => {
  try {
    const { message } = req.body;
    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [{ role: "user", content: message }],
    });
    res.json({ response: completion.choices[0].message.content });
  } catch (err) {
    res.status(500).json({ error: "Error IA GPT", details: err.message });
  }
});

// OpenAI Voz
app.get("/voz-prueba", async (req, res) => {
  try {
    const speech = await openai.audio.speech.create({
      model: "tts-1",
      voice: "onyx",
      input: "Hola Karmean, esta es tu voz lista para ayudarte.",
    });
    const buffer = Buffer.from(await speech.arrayBuffer());
    res.set({ "Content-Type": "audio/mpeg", "Content-Disposition": 'attachment; filename="voz.mp3"' });
    res.send(buffer);
  } catch (err) {
    res.status(500).send("Error generando voz");
  }
});

// Scraping de Instagram con Chromium ya instalado en Docker
app.get("/api/scrape", async (req, res) => {
  const { username } = req.query;
  if (!username) return res.status(400).json({ error: "?username= requerido" });

  try {
    const data = await scrapeInstagram(username);
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: "Scraping fallido", details: err.message });
  }
});

async function scrapeInstagram(targetUsername) {
  const browser = await puppeteer.launch({
    headless: true,
    executablePath: process.env.PUPPETEER_EXECUTABLE_PATH,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
    timeout: 60000,
  });

  try {
    const page = await browser.newPage();
    await page.goto("https://www.instagram.com/accounts/login/", { waitUntil: "networkidle2" });

    await page.waitForSelector('input[name="username"]', { timeout: 10000 });
    await page.type('input[name="username"]', process.env.IG_USER, { delay: 50 });
    await page.type('input[name="password"]', process.env.IG_PASSWORD, { delay: 50 });
    await page.click('button[type="submit"]');
    await page.waitForNavigation({ waitUntil: "networkidle2", timeout: 20000 });

    await page.goto(`https://www.instagram.com/${targetUsername}/`, {
      waitUntil: "networkidle2",
      timeout: 30000,
    });

    const data = await page.evaluate(() => {
      const getMeta = (p) => document.querySelector(`meta[property="${p}"]`)?.content;
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

// Arrancar servidor
app.listen(PORT, () => {
  console.log(`🚀 Servidor activo en puerto ${PORT}`);
});
