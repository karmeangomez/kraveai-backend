const express = require('express');
const puppeteer = require('puppeteer-core');
const chromium = require('@sparticuz/chromium');
const { Configuration, OpenAIApi } = require('openai');
const axios = require('axios');
const multer = require('multer');
const fs = require('fs');

const app = express();
app.use(express.json());

// Configurar OpenAI
const openaiConfig = new Configuration({ apiKey: process.env.OPENAI_API_KEY });
const openai = new OpenAIApi(openaiConfig);

// Configurar Multer para manejar archivos en /voz-prueba
const upload = multer();

/**
 * GET /api/scrape
 * Realiza login en Instagram y obtiene datos (ej. URLs de imágenes) del perfil objetivo.
 */
app.get('/api/scrape', async (req, res) => {
  try {
    // Lanzar navegador Chromium headless usando puppeteer-core + Sparticuz
    const browser = await puppeteer.launch({
      args: puppeteer.defaultArgs({ args: chromium.args, headless: "shell" }).concat([
        "--no-sandbox",
        "--disable-setuid-sandbox"
      ]),
      defaultViewport: { width: 1280, height: 800 },
      executablePath: await chromium.executablePath(),
      headless: "shell"
    });
    const page = await browser.newPage();

    // Navegar a Instagram e iniciar sesión
    await page.goto('https://www.instagram.com/', { waitUntil: 'networkidle2' });
    await page.type('input[name="username"]', process.env.INSTAGRAM_USER, { delay: 100 });
    await page.type('input[name="password"]', process.env.INSTAGRAM_PASS, { delay: 100 });
    await page.click('button[type="submit"]');
    await page.waitForNavigation({ waitUntil: 'networkidle2' });

    // Omitir diálogos "Save Your Login Info?" y "Turn on Notifications" (clic en "Not Now")
    for (let i = 0; i < 2; i++) {
      const [notNowBtn] = await page.$x("//button[contains(., 'Not Now') or contains(., 'Ahora no')]");
      if (notNowBtn) {
        await notNowBtn.click();
        await page.waitForTimeout(500);
      }
    }

    // Ir al perfil objetivo (por defecto, el propio usuario de INSTAGRAM_USER)
    const targetUser = req.query.user || process.env.INSTAGRAM_USER;
    await page.goto(`https://www.instagram.com/${targetUser}/`, { waitUntil: 'networkidle2' });
    await page.waitForSelector('article', { timeout: 10000 });

    // Extraer URLs de imágenes de las publicaciones (ignorando foto de perfil u otras)
    const data = await page.evaluate(() => {
      const imgElements = Array.from(document.querySelectorAll('img'));
      const postImages = imgElements
        .filter(img => img.src && img.src.includes('cdninstagram') && !img.alt.toLowerCase().includes('profile picture'))
        .map(img => img.src);
      return { images: postImages };
    });

    await browser.close();
    res.json({ success: true, scraped: data });
  } catch (error) {
    console.error('Error en /api/scrape:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/chat
 * Envía un mensaje a la API de OpenAI y devuelve la respuesta del chatbot.
 * Se espera un JSON en el cuerpo con { "message": "texto del usuario" }.
 */
app.post('/api/chat', async (req, res) => {
  try {
    const userMessage = req.body.message || req.query.message;
    if (!userMessage) {
      return res.status(400).json({ error: 'No message provided' });
    }
    // Llamar a ChatGPT (GPT-3.5 Turbo) con el mensaje del usuario
    const completion = await openai.createChatCompletion({
      model: 'gpt-3.5-turbo',
      messages: [{ role: 'user', content: userMessage }]
    });
    const reply = completion.data.choices[0].message.content;
    res.json({ success: true, reply });
  } catch (error) {
    console.error('Error en /api/chat:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /bitly-prueba
 * Acorta una URL utilizando la API de Bitly. Requiere BITLY_TOKEN en env.
 * Parámetro opcional: ?url=https://...
 */
app.get('/bitly-prueba', async (req, res) => {
  try {
    const longUrl = req.query.url || 'https://www.google.com';
    const response = await axios.post(
      'https://api-ssl.bitly.com/v4/shorten',
      { long_url: longUrl },
      { headers: { Authorization: `Bearer ${process.env.BITLY_TOKEN}` } }
    );
    const shortUrl = response.data.link;
    res.json({ success: true, longUrl, shortUrl });
  } catch (error) {
    console.error('Error en /bitly-prueba:', error.response?.data || error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /voz-prueba
 * Procesa un archivo de audio enviado y devuelve la transcripción usando OpenAI Whisper.
 * Enviar el audio como form-data bajo el campo "audio".
 */
app.post('/voz-prueba', upload.single('audio'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No audio file uploaded' });
    }
    // Guardar el buffer de audio en un archivo temporal
    const audioPath = '/tmp/input_audio';
    fs.writeFileSync(audioPath, req.file.buffer);
    // Llamar a la API de transcripción (Whisper)
    const transcription = await openai.createTranscription(
      fs.createReadStream(audioPath),
      'whisper-1'
    );
    res.json({ success: true, transcription: transcription.data.text });
  } catch (error) {
    console.error('Error en /voz-prueba:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Iniciar el servidor
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
