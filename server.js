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

// 🚀 Endpoint de Chat GPT-4o
app.post("/api/chat", async (req, res) => {
  const { message } = req.body;
  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [{ role: "user", content: message }]
    });
    res.json({ response: completion.choices[0].message.content });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error en /api/chat", details: err.message });
  }
});

// 🚀 Generador de Audio (Voz Masculina Juvenil)
async function generarAudio(texto) {
  const response = await openai.audio.speech.create({
    model: "tts-1-hd",
    voice: "onyx",
    input: texto,
  });
  const audioBuffer = Buffer.from(await response.arrayBuffer());
  return audioBuffer;
}

app.get("/voz-prueba", async (req, res) => {
  try {
    const audioBuffer = await generarAudio("Hola Karmean, esta es tu IA juvenil masculina integrada correctamente.");
    res.set({
      "Content-Type": "audio/mpeg",
      "Content-Disposition": "attachment; filename='respuesta.mp3'"
    });
    res.send(audioBuffer);
  } catch (error) {
    console.error(error);
    res.status(500).send("Error generando audio.");
  }
});

// 🚀 Generador de Enlaces Bitly
async function generarLinkBitly(urlLarga) {
  const BITLY_API_KEY = process.env.BITLY_API_KEY;
  const response = await fetch("https://api-ssl.bitly.com/v4/shorten", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${BITLY_API_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ long_url: urlLarga })
  });
  const data = await response.json();
  if (response.ok) return data.link;
  console.error("Error en Bitly:", data);
  throw new Error("Error generando enlace Bitly.");
}

app.get("/bitly-prueba", async (req, res) => {
  try {
    const enlaceOriginal = "https://instagram.com";
    const enlaceAcortado = await generarLinkBitly(enlaceOriginal);
    res.json({ enlaceOriginal, enlaceAcortado });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
});

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
      "--lang=es-ES,es",
      `--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64)`
    ],
    headless: "new",
    timeout: 30000
  });

  try {
    const page = await browser.newPage();
    await page.goto(`https://www.instagram.com/${username}/`, { waitUntil: "networkidle2", timeout: 45000 });

    const data = await page.evaluate(() => {
      const og = (p) => document.querySelector(`meta[property="${p}"]`)?.content;
      const desc = og("og:description") || "";
      const match = desc.match(/([\d,.]+) seguidores/);
      return {
        username: document.title.split("(")[0].trim().replace("• Instagram", ""),
        profileImage: og("og:image"),
        followers: match ? match[1] : null,
        isVerified: !!document.querySelector('svg[aria-label="Cuenta verificada"]'),
        bio: document.querySelector("header section div")?.innerText || null,
        lastScraped: new Date().toISOString()
      };
    });

    return data;
  } finally {
    await browser.close();
  }
}

// 🚀 Endpoint de Health Check
app.get("/health", (req, res) => {
  res.json({ status: "OK", redis: "disabled" });
});

// 🚀 Iniciar servidor en Render
app.listen(PORT, () => {
  console.log(`Servidor activo en puerto ${PORT}`);
});
