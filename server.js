require('dotenv').config();
const express = require('express');
const axios = require('axios');
const puppeteer = require('puppeteer');
const cors = require('cors');
const helmet = require('helmet');

const app = express();
app.use(express.json());
app.use(cors());
app.use(helmet());

if (!process.env.IG_USER || !process.env.IG_PASS) {
  console.error("⚠️ IG_USER/IG_PASS no están configurados.");
}
if (!process.env.OPENAI_API_KEY) {
  console.error("⚠️ OPENAI_API_KEY no está configurada.");
}
if (!process.env.BITLY_TOKEN) {
  console.error("⚠️ BITLY_TOKEN no está configurado.");
}

app.post('/api/chat', async (req, res) => {
  try {
    const { message } = req.body;
    console.log("[Chat] Mensaje recibido:", message);
    const response = await axios.post(
      'https://api.openai.com/v1/chat/completions',
      {
        model: 'gpt-4o',
        messages: [{ role: 'user', content: message }]
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
          'Content-Type': 'application/json'
        }
      }
    );
    res.json({ message: response.data.choices[0].message.content });
  } catch (err) {
    console.error("[Chat] Error:", err.message);
    res.status(500).json({ error: "Error al procesar la solicitud de IA." });
  }
});

app.get('/voz-prueba', async (req, res) => {
  try {
    const text = req.query.text || "Hola Karmean, tu voz está activa.";
    console.log("[Voz] Generando voz para:", text);
    const response = await axios.post(
      'https://api.openai.com/v1/audio/speech',
      {
        model: 'tts-1',
        voice: 'onyx',
        input: text
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
          'Content-Type': 'application/json'
        },
        responseType: 'arraybuffer'
      }
    );
    res.set('Content-Type', 'audio/mpeg');
    res.send(response.data);
  } catch (err) {
    console.error("[Voz] Error:", err.message);
    res.status(500).send("Error generando voz.");
  }
});

app.get('/bitly-prueba', async (req, res) => {
  try {
    const longUrl = req.query.url || "https://instagram.com";
    console.log("[Bitly] Acortando:", longUrl);
    const response = await axios.post(
      'https://api-ssl.bitly.com/v4/shorten',
      { long_url: longUrl },
      {
        headers: {
          Authorization: `Bearer ${process.env.BITLY_TOKEN}`,
          'Content-Type': 'application/json'
        }
      }
    );
    res.json({ shortUrl: response.data.link });
  } catch (err) {
    console.error("[Bitly] Error:", err.message);
    res.status(500).json({ error: "Error al acortar URL." });
  }
});

app.get('/api/scrape', async (req, res) => {
  const igUsername = req.query.username;
  if (!igUsername) return res.status(400).json({ error: 'Falta ?username=' });

  console.log(`🔍 Iniciando scraping para ${igUsername}`);
  let browser;
  try {
    browser = await puppeteer.launch({
      headless: true,
      executablePath: process.env.CHROME_BINARY_PATH || puppeteer.executablePath(),
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const page = await browser.newPage();
    console.log("🌐 Cargando página de login de Instagram...");
    await page.goto("https://www.instagram.com/accounts/login/", { waitUntil: "networkidle2" });

    console.log("✏️ Escribiendo usuario...");
    await page.type('input[name="username"]', process.env.IG_USER, { delay: 100 });
    console.log("✏️ Escribiendo contraseña...");
    await page.type('input[name="password"]', process.env.IG_PASS, { delay: 100 });
    await page.click('button[type="submit"]');
    console.log("⏳ Esperando post-login...");
    await page.waitForNavigation({ waitUntil: "networkidle2", timeout: 15000 }).catch(() => {
      console.log("⏭️ Login rápido, sin redirección");
    });

    console.log(`📄 Cargando perfil de ${igUsername}...`);
    await page.goto(`https://www.instagram.com/${igUsername}/`, { waitUntil: "networkidle2", timeout: 20000 });

    console.log("🔍 Esperando selector <header> del perfil...");
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

    console.log("✅ Perfil obtenido:", data.username);
    res.json({ profile: data });
  } catch (err) {
    console.error("❌ Error en scraping:", err.message);
    res.status(500).json({ error: err.message });
  } finally {
    if (browser) await browser.close();
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Servidor activo en puerto ${PORT}`);
});
