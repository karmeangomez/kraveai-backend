const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");
const { Configuration, OpenAIApi } = require("openai");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(bodyParser.json());

const configuration = new Configuration({
  apiKey: process.env.OPENAI_API_KEY,
});
const openai = new OpenAIApi(configuration);

// Ruta de IA principal (usa GPT-4o)
app.post("/api/chat", async (req, res) => {
  try {
    const userMessage = req.body.message;
    const completion = await openai.createChatCompletion({
      model: "gpt-4o",
      messages: [{ role: "user", content: userMessage }],
    });
    const aiResponse = completion.data.choices[0].message.content;
    res.json({ response: aiResponse });
  } catch (err) {
    res.status(500).json({ error: "Error en /api/chat", details: err.message });
  }
});

// Ruta especial para expansión futura
app.post("/api/ordenes-avanzadas", async (req, res) => {
  const orden = req.body.orden;
  const respuesta = `Recibido: "${orden}". Estoy lista para expandir el sistema automáticamente cuando se active.`;
  res.json({ status: "preparado", message: respuesta });
});

app.get("/", (req, res) => {
  res.send("KraveAI backend está activo.");
});

app.listen(PORT, () => {
  console.log(`Servidor en puerto ${PORT}`);
});
