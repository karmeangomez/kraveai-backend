const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");
const OpenAI = require("openai");
require('dotenv').config();

const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));

const app = express();
const PORT = process.env.PORT || 3000;

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

app.use(cors());
app.use(bodyParser.json());

// 🔥 IA Chat (GPT-4o)
app.post("/api/chat", async (req, res) => {
  const { message } = req.body;

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [{ role: "user", content: message }]
    });

    const aiResponse = completion.choices[0].message.content;
    res.json({ response: aiResponse });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error en /api/chat", details: err.message });
  }
});

// 🎙️ IA con Voz juvenil masculina ("onyx")
async function generarAudio(texto) {
  const response = await openai.audio.speech.create({
    model: 'tts-1-hd',
    voice: 'onyx',
    input: texto,
  });
  const audioBuffer = Buffer.from(await response.arrayBuffer());
  return audioBuffer;
}

// 🎙️ Ruta de prueba para IA Voz juvenil masculina
app.get('/voz-prueba', async (req, res) => {
  try {
    const audioBuffer = await generarAudio("Hola Karmean, esta es tu IA juvenil masculina integrada correctamente.");
    res.set({
      'Content-Type': 'audio/mpeg',
      'Content-Disposition': 'attachment; filename="respuesta.mp3"'
    });
    res.send(audioBuffer);
  } catch (error) {
    console.error(error);
    res.status(500).send('Error generando audio.');
  }
});

// 🔗 Bitly API para generar enlaces acortados
async function generarLinkBitly(urlLarga) {
  const BITLY_API_KEY = process.env.BITLY_API_KEY;
  const response = await fetch('https://api-ssl.bitly.com/v4/shorten', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${BITLY_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ long_url: urlLarga })
  });

  const data = await response.json();
  if (response.ok) {
    return data.link;
  } else {
    console.error('Error en Bitly:', data);
    throw new Error('Error generando enlace Bitly.');
  }
}

// 🔗 Ruta de prueba para Bitly API
app.get('/bitly-prueba', async (req, res) => {
  try {
    const enlaceOriginal = "https://instagram.com";
    const enlaceAcortado = await generarLinkBitly(enlaceOriginal);
    res.json({ enlaceOriginal, enlaceAcortado });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
});

// 🚀 Inicio del servidor
app.listen(PORT, () => {
  console.log(`Servidor activo en puerto ${PORT}`);
});
