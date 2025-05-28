const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");
const OpenAI = require("openai");
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

app.use(cors());
app.use(bodyParser.json());

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

// ↓↓↓ NUEVA FUNCIÓN PARA IA JUVENIL MASCULINA ↓↓↓

async function generarAudio(texto) {
    const response = await openai.audio.speech.create({
        model: 'tts-1-hd',
        voice: 'onyx',
        input: texto,
    });
    const audioBuffer = Buffer.from(await response.arrayBuffer());
    return audioBuffer;
}

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

// INICIO DEL SERVIDOR
app.listen(PORT, () => {
  console.log(`Servidor activo en puerto ${PORT}`);
});
