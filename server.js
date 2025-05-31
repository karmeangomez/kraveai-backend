// server.js – Backend de KraveAI (Express)
require('dotenv').config();               // Carga variables de entorno en desarrollo
const fs = require('fs');
const express = require('express');
const axios = require('axios');
const puppeteer = require('puppeteer-core');
const { Configuration, OpenAIApi } = require('openai');

const app = express();
app.use(express.json());

// Configuración de OpenAI API
const openai = new OpenAIApi(new Configuration({
  apiKey: process.env.OPENAI_API_KEY
}));

// Endpoint de salud (estado del backend)
app.get('/health', (req, res) => {
  res.send('Backend is running');
});

// Endpoint de scraping (/api/scrape) – inicia sesión en Instagram y extrae información
app.post('/api/scrape', async (req, res) => {
  const instagramProfile = req.body.usuario || req.query.usuario || '';  // perfil a scrapear
  let browser;
  try {
    // Opciones de lanzamiento para Puppeteer
    const chromePath = '/usr/bin/chromium';
    const launchOptions = {
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--no-zygote',
        '--disable-gpu'
      ]
    };
    if (fs.existsSync(chromePath)) {
      launchOptions.executablePath = chromePath;
    }
    browser = await puppeteer.launch(launchOptions);

    const page = await browser.newPage();
    await page.goto('https://www.instagram.com/accounts/login/', { waitUntil: 'networkidle2' });

    // Iniciar sesión en Instagram con credenciales de entorno
    await page.type('input[name=username]', process.env.IG_USER, { delay: 100 });
    await page.type('input[name=password]', process.env.IG_PASSWORD, { delay: 100 });
    await Promise.all([
      page.click('button[type=submit]'),
      page.waitForNavigation({ waitUntil: 'networkidle2' })
    ]);

    // Navegar al perfil objetivo si se proporcionó uno
    if (instagramProfile) {
      await page.goto(`https://www.instagram.com/${instagramProfile}/?__a=1`, { waitUntil: 'networkidle2' });
      const content = await page.content();
      // (Aquí se podría parsear `content` o usar page.evaluate para extraer datos JSON del perfil)
      res.status(200).send(content);  // Envía el HTML/JSON del perfil para propósitos de prueba
    } else {
      res.status(200).send('Login successful. No profile specified.');
    }
  } catch (err) {
    console.error('Error en /api/scrape:', err);
    res.status(500).send('Error al hacer scraping de Instagram');
  } finally {
    if (browser) await browser.close();
  }
});

// Endpoint de chat (/api/chat) – consulta a OpenAI GPT
app.post('/api/chat', async (req, res) => {
  try {
    const userMessage = req.body.mensaje || req.body.prompt;
    if (!userMessage) {
      return res.status(400).json({ error: 'Falta el mensaje del usuario' });
    }
    // Llamada a la API de OpenAI (ChatGPT)
    const completion = await openai.createChatCompletion({
      model: 'gpt-3.5-turbo',  // o el modelo configurado deseado
      messages: [{ role: 'user', content: userMessage }]
    });
    const respuestaAI = completion.data.choices[0].message.content;
    res.json({ respuesta: respuestaAI });
  } catch (error) {
    console.error('Error en /api/chat:', error);
    res.status(500).json({ error: 'Error al procesar la solicitud de chat' });
  }
});

// Endpoint de voz de prueba (/voz-prueba) – prueba de síntesis de voz IA
app.get('/voz-prueba', (req, res) => {
  // En un caso real, aquí iría la lógica para generar o reproducir voz usando alguna API o librería
  res.send('Endpoint de voz IA funcionando (prueba)');
});

// Endpoint de Bitly de prueba (/bitly-prueba) – acorta un enlace de ejemplo usando Bitly
app.get('/bitly-prueba', async (req, res) => {
  try {
    const longUrl = 'https://example.com/';  // URL larga de ejemplo a acortar
    const response = await axios.post(
      'https://api-ssl.bitly.com/v4/shorten',
      { long_url: longUrl },
      { headers: { Authorization: `Bearer ${process.env.BITLY_API_KEY}` } }
    );
    const shortUrl = response.data.link;
    res.send(`URL acortada: ${shortUrl}`);
  } catch (error) {
    console.error('Error en /bitly-prueba:', error.response ? error.response.data : error.message);
    res.status(500).send('Error al acortar URL con Bitly');
  }
});

// Iniciar el servidor
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`✅ Servidor iniciado en el puerto ${PORT}`);
});
