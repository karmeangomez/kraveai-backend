/**
 * IMPORTANTE:
 * 1. Asegúrate de tener instaladas las dependencias: express, cors, axios, openai, puppeteer (o puppeteer-extra y puppeteer-extra-plugin-stealth).
 * 2. En Docker/Render, instala la librería del sistema libgbm1 (y otras dependencias de Chromium si es necesario) para evitar errores al lanzar Puppeteer.
 * 3. Configura las variables de entorno necesarias:
 *    - OPENAI_API_KEY: clave de OpenAI para usar en las rutas /api/chat y /voz-prueba.
 *    - BITLY_TOKEN: token de acceso de Bitly para la ruta /bitly-prueba.
 */
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const axios = require('axios');

// Usar puppeteer con plugin stealth para evitar detección antibot
const puppeteer = require('puppeteer-extra');
try {
  const StealthPlugin = require('puppeteer-extra-plugin-stealth');
  puppeteer.use(StealthPlugin());
} catch (err) {
  console.warn('puppeteer-extra-plugin-stealth no encontrado. Ejecutando sin stealth.');
}
// Si prefieres no usar puppeteer-extra, puedes usar directamente:
// const puppeteer = require('puppeteer');

const { Configuration, OpenAIApi } = require('openai');
const configuration = new Configuration({
  apiKey: process.env.OPENAI_API_KEY
});
const openai = new OpenAIApi(configuration);

const app = express();
app.use(cors());
app.use(express.json());

// Ruta de scraping de perfil de Instagram
app.get('/api/scrape', async (req, res) => {
  const username = req.query.username;
  if (!username) {
    return res.status(400).json({ error: "Debe proporcionar el nombre de usuario en 'username'." });
  }
  const profileUrl = `https://www.instagram.com/${username}/`;
  let browser;
  try {
    browser = await puppeteer.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu'
      ]
    });
    const page = await browser.newPage();
    // Opcional: establecer viewport y user-agent para parecer un navegador normal
    await page.setViewport({ width: 1366, height: 768 });
    await page.setUserAgent('Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/110.0.4472.114 Safari/537.36');

    // Navegar al perfil
    const response = await page.goto(profileUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
    // Si Instagram devuelve 404 directamente
    if (response && response.status() === 404) {
      return res.status(404).json({ error: "Perfil no encontrado o no existe." });
    }
    // Comprobar si nos redirigieron a login o a challenge (bloqueo)
    const currentUrl = page.url();
    if (currentUrl.includes('/accounts/login') || currentUrl.includes('/challenge/')) {
      return res.status(403).json({ error: "Instagram solicitó inicio de sesión o verificación (challenge). Scraping bloqueado." });
    }
    // Obtener contenido HTML para buscar indicadores de bloqueo
    const html = await page.content();
    if (html.includes("Please wait a few minutes") || html.includes("few minutes before trying again")) {
      return res.status(429).json({ error: "Instagram está limitando las solicitudes (rate limit). Intenta de nuevo más tarde." });
    }
    if (html.includes("Sorry, this page isn't available.") || html.includes("esta página no está disponible")) {
      return res.status(404).json({ error: "Perfil no disponible o no existe." });
    }

    // Extraer datos del perfil mediante DOM
    const data = await page.evaluate(() => {
      const result = {};
      // Nombre de usuario (handle)
      result.username = document.querySelector('header section h1')?.textContent || "";
      // Cuenta verificada (icono insignia verificada presente)
      result.is_verified = !!document.querySelector('header section svg[aria-label="Verified"]') 
                         || !!document.getElementsByClassName('coreSpriteVerifiedBadge')[0];
      // Foto de perfil URL
      result.profile_pic_url = document.querySelector('header img')?.src || "";
      // Número de publicaciones, seguidores, seguidos
      const stats = document.querySelectorAll('header section ul li');
      if (stats.length >= 3) {
        // Publicaciones
        let postsText = stats[0].querySelector('span')?.textContent || "";
        result.posts_count = postsText.replace(/,/g, '') || "";
        // Seguidores
        let followersSpan = stats[1].querySelector('span');
        // Instagram a veces pone el número exacto de seguidores en el atributo title
        let followers = followersSpan?.getAttribute('title') || followersSpan?.textContent || "";
        result.followers_count = followers.replace(/,/g, '') || "";
        // Seguidos
        let followingText = stats[2].querySelector('span')?.textContent || "";
        result.following_count = followingText.replace(/,/g, '') || "";
      } else {
        result.posts_count = result.followers_count = result.following_count = "";
      }
      // Nombre completo (puede estar en el segundo <h1> o en <h2>, según el diseño actual)
      let nameElem = document.querySelector('header section h1 + h2') || document.querySelectorAll('header section h1')[1];
      result.full_name = nameElem?.textContent || "";
      // Bio (descripción del perfil)
      let bioElem = document.querySelector('header section h1 + h2') 
                    ? document.querySelector('header section h1 + h2')?.nextElementSibling 
                    : document.querySelectorAll('header section div span')[0];
      result.bio = bioElem?.textContent || "";
      // Enlace en la bio
      let linkElem = document.querySelector('header section div a[href^="http"]');
      result.external_url = linkElem?.href || "";
      result.external_url_display = linkElem?.textContent || "";
      // Cuenta privada (mensaje de "Account is Private")
      result.is_private = false;
      const h2Elem = document.getElementsByTagName('h2')[0];
      if (h2Elem) {
        const h2Text = h2Elem.textContent;
        if (h2Text.includes("Account is Private") || h2Text.includes("Cuenta privada") || h2Text.includes("cuenta es privada")) {
          result.is_private = true;
        }
      }
      // Posts recientes (URLs y miniaturas de las primeras publicaciones visibles)
      result.recent_posts = [];
      document.querySelectorAll('article a[href^="/p/"]').forEach(postLink => {
        const url = postLink.href;
        const thumb = postLink.querySelector('img')?.src || "";
        result.recent_posts.push({ url, thumbnail: thumb });
      });
      return result;
    });
    return res.json(data);
  } catch (error) {
    console.error("Error en scraping:", error);
    return res.status(500).json({ error: "Error al obtener datos de Instagram." });
  } finally {
    if (browser) {
      try { await browser.close(); } catch {}
    }
  }
});

// Ruta de chat GPT-4 (IA de OpenAI)
app.post('/api/chat', async (req, res) => {
  const { message } = req.body;
  if (!message) {
    return res.status(400).json({ error: "Debe proporcionar el mensaje en el cuerpo de la solicitud (JSON: { \"message\": \"...\" })." });
  }
  try {
    const completion = await openai.createChatCompletion({
      model: 'gpt-4',
      messages: [{ role: 'user', content: message }]
    });
    // Enviar solo la respuesta de la IA
    const reply = completion.data.choices[0]?.message?.content || "";
    return res.json({ success: true, response: reply });
  } catch (error) {
    console.error("Error en /api/chat:", error.response?.data || error.message);
    return res.status(500).json({ error: "Error al obtener respuesta de la IA." });
  }
});

// Ruta de Text-to-Speech (voz) con OpenAI
app.get('/voz-prueba', async (req, res) => {
  const text = req.query.text;
  if (!text) {
    return res.status(400).json({ error: "Debe proporcionar el texto a convertir a voz en 'text'." });
  }
  try {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error("No hay API Key de OpenAI configurada.");
    }
    const voice = req.query.voice || 'es-ES-Standard';  // Voz por defecto (español estándar)
    const ttsResponse = await axios.post(
      'https://api.openai.com/v1/tts',
      { text, voice },
      {
        headers: {
          'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
          'Content-Type': 'application/json'
        },
        responseType: 'arraybuffer'  // obtener respuesta binaria (audio)
      }
    );
    const contentType = ttsResponse.headers['content-type'] || 'audio/mpeg';
    res.set('Content-Type', contentType);
    return res.send(ttsResponse.data);
  } catch (error) {
    console.error("Error en TTS:", error.response?.data || error.message);
    return res.status(500).json({ error: "Error al generar voz." });
  }
});

// Ruta de acortador de enlaces con Bitly
app.get('/bitly-prueba', async (req, res) => {
  const longUrl = req.query.url;
  if (!longUrl) {
    return res.status(400).json({ error: "Debe proporcionar la URL larga en 'url'." });
  }
  if (!process.env.BITLY_TOKEN) {
    return res.status(500).json({ error: "Falta configurar BITLY_TOKEN en las variables de entorno." });
  }
  try {
    const response = await axios.post(
      'https://api-ssl.bitly.com/v4/shorten',
      { long_url: longUrl },
      { headers: { Authorization: `Bearer ${process.env.BITLY_TOKEN}`, 'Content-Type': 'application/json' } }
    );
    const shortLink = response.data.link;
    return res.json({ shortUrl: shortLink });
  } catch (error) {
    console.error("Error en Bitly:", error.response?.data || error.message);
    return res.status(500).json({ error: "No se pudo acortar la URL." });
  }
});

// Iniciar servidor (puedes ajustar el puerto según necesidad, Render suele usar process.env.PORT)
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Servidor escuchando en puerto ${PORT}`);
});
