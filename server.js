const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const OpenAI = require('openai');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(bodyParser.json());

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

app.post('/api/chat', async (req, res) => {
  const { userMessage } = req.body;

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [{ role: "user", content: userMessage }]
    });

    const aiResponse = completion.choices[0].message.content;
    res.json({ response: aiResponse });
  } catch (err) {
    res.status(500).json({ error: "Error en /api/chat", details: err.message });
  }
});

app.post("/api/ordenes-avanzadas", async (req, res) => {
  const orden = req.body.orden;
  const respuesta = `Recibido: "${orden}". Listo para expandir el sistema automáticamente cuando se active.`;
  res.json({ status: "preparado", message: respuesta });
});

app.get("/", (req, res) => {
  res.send("KraveAI backend está activo.");
});

app.listen(PORT, () => {
  console.log(`Servidor en puerto ${PORT}`);
});
