// server.js - Backend Node.js para KraveAI (Karmean) en Render

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

// Verificar variables de entorno esenciales
if (!process.env.OPENAI_API_KEY) {
  console.error("⚠️  OPENAI_API_KEY no está configurada en .env");
}
if (!process.env.BITLY_TOKEN) {
  console.error("⚠️  BITLY_TOKEN no está configurado en .env");
}
if (!process.env.IG_USER || !process.env.IG_PASS) {
  console.error("⚠️  IG_USER/IG_PASS no están configurados en .env");
}

// Ruta /api/chat: conexión con ChatGPT (OpenAI)
app.post('/api/chat', async (req, res) => {
  try {
    const { message, messages, prompt } = req.body;
    let messagesToSend;
    if (messages) {
      messagesToSend = messages;
    } else if (message) {
      messagesToSend = [{ role: 'user', content: message }];
    } else if (prompt) {
      messagesToSend = [{ role: 'user', content: prompt }];
    } else {
      return res.status(400).json({ error: 'No se proporcionó mensaje de entrada.' });
    }
    console.log("[Chat] Consulta del usuario recibida.");
    // Llamar a la API de OpenAI para obtener la respuesta del chat
    const openaiResponse = await axios.post(
      'https://api.openai.com/v1/chat/completions',
      {
        model: process.env.OPENAI_MODEL || 'gpt-3.5-turbo',
        messages: messagesToSend
      },
      {
        headers: {
          'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
          'Content-Type': 'application/json'
        }
      }
    );
    const assistantMessage = openaiResponse.data.choices[0].message.content;
    console.log("[Chat] Respuesta de OpenAI recibida con éxito.");
    res.json({ message: assistantMessage });
  } catch (error) {
    console.error("[Chat] Error al obtener respuesta de OpenAI:", error.response?.data || error.message);
    res.status(500).json({ error: 'Error al procesar la solicitud de chat.' });
  }
});

// Ruta /voz-prueba: generación de voz usando OpenAI TTS
app.get('/voz-prueba', async (req, res) => {
  const text = req.query.text || "Hola, esta es una prueba de voz generada por IA.";
  try {
    console.log("[Voz] Generando voz para el texto:", text);
    const ttsResponse = await axios.post(
      'https://api.openai.com/v1/audio/speech',
      {
        model: 'tts-1',
        input: text,
        voice: 'alloy'
      },
      {
        headers: {
          'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
          'Content-Type': 'application/json'
        },
        responseType: 'arraybuffer'
      }
    );
    console.log("[Voz] Audio generado correctamente. Enviando respuesta...");
    res.set('Content-Type', 'audio/mpeg');
    res.send(ttsResponse.data);
  } catch (error) {
    console.error("[Voz] Error al generar audio:", error.response?.data || error.message);
    res.status(500).json({ error: 'Error al generar la voz.' });
  }
});

// También permitir POST en /voz-prueba para enviar texto por JSON
app.post('/voz-prueba', async (req, res) => {
  const text = req.body.text || "Hola, esta es una prueba de voz generada por IA.";
  try {
    console.log("[Voz] Generando voz para el texto:", text);
    const ttsResponse = await axios.post(
      'https://api.openai.com/v1/audio/speech',
      {
        model: 'tts-1',
        input: text,
        voice: 'alloy'
      },
      {
        headers: {
          'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
          'Content-Type': 'application/json'
        },
        responseType: 'arraybuffer'
      }
    );
    console.log("[Voz] Audio generado correctamente. Enviando respuesta...");
    res.set('Content-Type', 'audio/mpeg');
    res.send(ttsResponse.data);
  } catch (error) {
    console.error("[Voz] Error al generar audio:", error.response?.data || error.message);
    res.status(500).json({ error: 'Error al generar la voz.' });
  }
});

// Ruta /bitly-prueba: acortamiento de URL con Bitly
app.get('/bitly-prueba', async (req, res) => {
  const longUrl = req.query.url;
  if (!longUrl) {
    return res.status(400).json({ error: 'No se proporcionó una URL para acortar.' });
  }
  try {
    console.log("[Bitly] Acortando URL:", longUrl);
    const bitlyResponse = await axios.post(
      'https://api-ssl.bitly.com/v4/shorten',
      { long_url: longUrl },
      {
        headers: {
          'Authorization': `Bearer ${process.env.BITLY_TOKEN}`,
          'Content-Type': 'application/json'
        }
      }
    );
    const shortUrl = bitlyResponse.data.link;
    console.log("[Bitly] URL acortada:", shortUrl);
    res.json({ shortUrl });
  } catch (error) {
    console.error("[Bitly] Error al acortar URL:", error.response?.data || error.message);
    res.status(500).json({ error: 'Error al acortar la URL.' });
  }
});

// También permitir POST en /bitly-prueba 
app.post('/bitly-prueba', async (req, res) => {
  const longUrl = req.body.url;
  if (!longUrl) {
    return res.status(400).json({ error: 'No se proporcionó una URL para acortar.' });
  }
  try {
    console.log("[Bitly] Acortando URL:", longUrl);
    const bitlyResponse = await axios.post(
      'https://api-ssl.bitly.com/v4/shorten',
      { long_url: longUrl },
      {
        headers: {
          'Authorization': `Bearer ${process.env.BITLY_TOKEN}`,
          'Content-Type': 'application/json'
        }
      }
    );
    const shortUrl = bitlyResponse.data.link;
    console.log("[Bitly] URL acortada:", shortUrl);
    res.json({ shortUrl });
  } catch (error) {
    console.error("[Bitly] Error al acortar URL:", error.response?.data || error.message);
    res.status(500).json({ error: 'Error al acortar la URL.' });
  }
});

// Ruta /api/scrape: scraping de perfil de Instagram con Puppeteer
app.get('/api/scrape', async (req, res) => {
  const igUsername = req.query.username;
  if (!igUsername) {
    return res.status(400).json({ error: 'No se proporcionó el nombre de usuario de Instagram.' });
  }
  // Verificar credenciales de Instagram antes de continuar
  if (!process.env.IG_USER || !process.env.IG_PASS) {
    console.error("[Scrape] Credenciales de Instagram no configuradas.");
    return res.status(500).json({ error: 'Credenciales de Instagram no configuradas en el servidor.' });
  }
  console.log("[Scrape] Iniciando scraping para el perfil:", igUsername);
  let browser;
  try {
    // Lanzar navegador Puppeteer con configuración compatible con Docker/Render
    browser = await puppeteer.launch({
      headless: 'new',  // Modo headless (usar 'new' en Puppeteer v20+)
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
      executablePath: process.env.CHROME_BINARY_PATH || puppeteer.executablePath()
    });
    const page = await browser.newPage();
    // Establecer user-agent para simular navegador real
    await page.setUserAgent('Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/100 Safari/537.36');
    console.log("[Scrape] Navegando a la página de login de Instagram...");
    await page.goto('https://www.instagram.com/accounts/login/', { waitUntil: 'networkidle0' });
    // Iniciar sesión en Instagram
    await page.waitForSelector('input[name="username"]');
    await page.type('input[name="username"]', process.env.IG_USER, { delay: 100 });
    await page.type('input[name="password"]', process.env.IG_PASS, { delay: 100 });
    await page.click('button[type="submit"]');
    console.log("[Scrape] Credenciales ingresadas, esperando inicio de sesión...");
    // Esperar navegación después del login (con un timeout máximo para continuar)
    await page.waitForNavigation({ waitUntil: 'networkidle0', timeout: 10000 }).catch(e => {/* Si no navega, continuamos */});
    // Navegar al perfil de Instagram solicitado
    console.log(`[Scrape] Accediendo al perfil del usuario "${igUsername}"...`);
    await page.goto(`https://www.instagram.com/${igUsername}/`, { waitUntil: 'networkidle0' });
    // Comprobar si la página indica perfil no encontrado/privado
    const pageContent = await page.content();
    if (pageContent.includes("Página no disponible") || pageContent.includes("Page not found")) {
      throw new Error("Perfil de Instagram no encontrado o inaccesible.");
    }
    // Extraer información del perfil con script en la página
    await page.waitForSelector('header');
    const profileData = await page.evaluate(() => {
      const usernameElem = document.querySelector('header section h2') || document.querySelector('header section h1');
      const username = usernameElem ? usernameElem.textContent : null;
      const nameElem = document.querySelector('header section h1');
      const fullName = nameElem ? nameElem.textContent : null;
      // Contadores de publicaciones, seguidores, seguidos
      let posts = null, followers = null, following = null;
      const countSpans = document.querySelectorAll('header > section > ul > li span');
      if (countSpans.length >= 3) {
        posts = countSpans[0].textContent;
        followers = countSpans[1].textContent;
        following = countSpans[2].textContent;
      }
      if (posts) posts = posts.replace(/,/g, '');
      if (followers) followers = followers.replace(/,/g, '');
      if (following) following = following.replace(/,/g, '');
      // Verificar insignia de cuenta verificada
      let isVerified = false;
      const verifiedBadge = document.querySelector('header section [aria-label="Verificado"]') 
                           || document.querySelector('header section [aria-label="Verified"]');
      if (verifiedBadge) {
        isVerified = true;
      }
      // Verificar si la cuenta es privada
      let isPrivate = false;
      const privateMarker = document.querySelector('h2[role="presentation"]');
      if (privateMarker) {
        const txt = privateMarker.textContent.toLowerCase();
        if (txt.includes("privada") || txt.includes("private")) {
          isPrivate = true;
        }
      }
      // Obtener texto de la biografía
      let bio = "";
      const bioSpans = document.querySelectorAll('header section span');
      for (let span of bioSpans) {
        if (!span.closest('ul') && (!nameElem || !nameElem.contains(span))) {
          bio += span.textContent + "\n";
        }
      }
      bio = bio.trim();
      // Enlace externo en la bio (si existe)
      let bioUrl = "";
      let bioUrlDisplay = "";
      const bioLinkElem = document.querySelector('header section div a[href*="l.instagram.com"]');
      if (bioLinkElem) {
        bioUrl = bioLinkElem.getAttribute('href');
        bioUrlDisplay = bioLinkElem.textContent;
      }
      // Imagen de perfil (URL)
      let profilePic = "";
      const imgElem = document.querySelector('header img');
      if (imgElem) {
        profilePic = imgElem.getAttribute('src');
      }
      return { username, fullName, posts, followers, following, isVerified, isPrivate, bio, bioUrl, bioUrlDisplay, profilePic };
    });
    console.log("[Scrape] Datos obtenidos para el perfil:", profileData);
    res.json({ profile: profileData });
  } catch (error) {
    console.error("[Scrape] Error al hacer scraping:", error.message);
    res.status(500).json({ error: error.message || 'Error al realizar el scraping de Instagram.' });
  } finally {
    if (browser) {
      await browser.close();
    }
  }
});

// Iniciar el servidor en el puerto especificado por Render o 3001 por defecto
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Servidor listo y escuchando en el puerto ${PORT}`);
});
