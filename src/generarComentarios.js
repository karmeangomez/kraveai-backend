// generarComentarios.js
import fs from 'fs'
import path from 'path'
import { readFile } from 'fs/promises'
import readline from 'readline'

// Modo CLI: node src/generarComentarios.js resultado.json 50
const inputPath = process.argv[2]
const cantidad = parseInt(process.argv[3]) || 50

if (!inputPath || !fs.existsSync(inputPath)) {
  console.log("❌ Debes pasar la ruta al JSON generado por scrapPostDetails.")
  process.exit(1)
}

const data = JSON.parse(await readFile(inputPath, 'utf-8'))

const { username, apodo, imagePath, estilo, actividad, ejemplos } = data

// Simulación de generación por ChatGPT usando prompt personalizado
// Aquí en producción real tú me das el imagePath y yo genero directamente.
const generarComentarios = async () => {
  const prompt = `
Analiza la imagen del archivo "${imagePath}" y genera ${cantidad} comentarios estilo TikTok/Instagram para un post de @${username}.
Nombre o apodo: "${apodo}"
Estilo del contenido: "${estilo || 'desconocido'}"
Actividad: "${actividad || 'desconocida'}"
Ejemplos previos: ${ejemplos?.slice(0, 3).join('\n') || 'Ninguno'}

Crea comentarios como si fueran reales de seguidores.
Haz que:
- El 70% tengan emojis y errores emocionales ("gera 😩😭🔥")
- El 30% sean más casuales sin emojis
- Todos suenen humanos, desordenados, tipo TikTok
- Algunos usen expresiones mexicanas si encajan

Entrega solo los comentarios, uno debajo del otro, sin numerar y sin explicación.
  `

  // 🔄 Aquí usarías ChatGPT o un generador automático
  // Simulación local:
  console.log("🧠 Prompt generado para IA:")
  console.log(prompt)
  console.log("⏳ Esperando generación...")

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
  const comentarios = []
  let count = 0

  console.log(`📝 Escribe ${cantidad} comentarios (uno por línea):`)
  for await (const line of rl) {
    if (line.trim()) comentarios.push(line.trim())
    count++
    if (count >= cantidad) {
      rl.close()
    }
  }

  fs.writeFileSync(`temp/comentarios_${username}.json`, JSON.stringify(comentarios, null, 2))
  console.log(`✅ ${comentarios.length} comentarios guardados en temp/comentarios_${username}.json`)
}

generarComentarios()