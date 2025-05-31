const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");
const helmet = require("helmet");
const puppeteer = require("puppeteer-core");
const OpenAI = require("openai");
require("dotenv").config();

const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));

const app = express();
const PORT = process.env.PORT || 3000;
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors());
app.use(bodyParser.json());

// 🚀 Health check
app.get("/health", (req, res) => {
  res.status(200).json({
    status: "OK",
    port: PORT.toString(),
    environment: process.env.NODE_ENV || "development",
    timestamp: new Date().toISOString()
  });
});

// 🧠 ChatGPT-4o
app.post("/api/chat", async (req, res) => {
  const { message } = req.body;
  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [{ role: "user", content: message }]
    });
    res.json({ response: completion.choices[0].message.content });
  } catch (err) {
    res.status(500).json({ error: "Error en /api/chat", details: err.message });
  }
});

// 🔊 Voz juvenil masculina (Onyx)
app.get("/voz-prueba", async (req, res) => {
  try {
    const audio = await openai.audio.speech.create({
      model: "tts-1-hd",
      voice: "onyx",
      input: "Hola Karmean, tu sistema ya tiene voz juvenil masculina activa."
    });
    const buffer = Buffer.from(await audio.arrayBuffer());
    res.set({ "Content-Type": "audio/mpeg" });
    res.send(buffer);
  } catch (err) {
    res.status(500).json({ error: "Error generando audio", details: err.message });
  }
});

// 🔗 Bitly
app.get("/bitly-prueba", async (req, res) => {
  try {
    const bitlyRes = await fetch("https://api-ssl.bitly.com/v4/shorten", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.BITLY_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ long_url: "https://instagram.com" })
    });
    const data = await bitlyRes.json();
    res.json({ shortUrl: data.link });
  } catch (err) {
    res.status(500).json({ error: "Error generando enlace Bitly", details: err.message });
  }
});

// 🔎 Scraping de Instagram
app.get("/api/scrape", async (req, res) => {
  const { username } = req.query;
  if (!username) return res.status(400).json({ error: "Se requiere ?username=" });

  try {
    const browser = await puppeteer.launch({
      executablePath: process.env.CHROMIUM_PATH || "/usr/bin/chromium",
      args: [
        "--no-sandbox", "--disable-setuid-sandbox", "--disable-gpu",
        "--single-process", "--lang=es-ES,es",
        "--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64)"
      ],
      headless: true,
      timeout: 60000
    });

    const page = await browser.newPage();
    await page.goto(`https://www.instagram.com/${username}/`, {
      waitUntil: "networkidle2", timeout: 45000
    });

    const data = await page.evaluate(() => {
      const meta = (p) => document.querySelector(`meta[property="${p}"]`)?.content;
      return {
        username: document.title.split("(")[0].trim().replace("• Instagram", ""),
        profileImage: meta("og:image"),
        followers: document.querySelector("span[title]")?.innerText || null,
        isVerified: !!document.querySelector('svg[aria-label="Cuenta verificada"]')
      };
    });

    await browser.close();
    res.json(data);
  } catch (error) {
    res.status(500).json({
      error: "Scraping fallido",
      details: error.message
    });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Backend activo en puerto ${PORT}`);
});
