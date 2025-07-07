// generarComentarios.js
import fs from 'fs'
import path from 'path'

const inputPath = process.argv[2] // JSON de scrapPostDetails
const cantidad = parseInt(process.argv[3]) || 50
const mencionesReales = ['@karmeangomez'] // Puedes editar este array

if (!inputPath || !fs.existsSync(inputPath)) {
  console.log("❌ Debes pasar el JSON extraído por scrapPostDetails.")
  process.exit(1)
}

const datos = JSON.parse(fs.readFileSync(inputPath, 'utf-8'))
const { username, apodo, estilo, actividad, ejemplos } = datos

const comentarios = []
const mencionesEntreCuentas = ['@cuenta1', '@cuenta2', '@cuenta3'] // nombres reales o falsos de tus cuentas

for (let i = 0; i < cantidad; i++) {
  const incluirEmoji = Math.random() < 0.7
  const usarMencionReal = Math.random() < 0.2
  const responderOtroComentario = Math.random() < 0.3

  let comentarioBase = ''

  if (ejemplos?.length && Math.random() < 0.3) {
    comentarioBase = ejemplos[Math.floor(Math.random() * ejemplos.length)]
  } else {
    const partes = [
      `hermos${apodo.slice(-1) === 'a' ? 'aaa' : 'ooo'}`,
      `no no nooo ${apodo}`,
      `${apodo} 😩🔥🔥🔥`,
      `broo estasss 😭😭😭`,
      `reinaa ${apodo} 😍`,
      `🔥🔥🔥`,
      `🥹💖`,
      `el más guapo`,
      `te pasaste`,
      `mira esto`,
      `bomba`,
      `pfff`
    ]
    comentarioBase = partes[Math.floor(Math.random() * partes.length)]
  }

  // Randommente añadir una mención
  if (usarMencionReal) {
    const mencion = mencionesReales[Math.floor(Math.random() * mencionesReales.length)]
    comentarioBase = `${mencion} ${comentarioBase}`
  } else if (Math.random() < 0.2) {
    const cuenta = mencionesEntreCuentas[Math.floor(Math.random() * mencionesEntreCuentas.length)]
    comentarioBase = `${cuenta} ${comentarioBase}`
  }

  comentarios.push({
    texto: comentarioBase,
    respuesta: responderOtroComentario
  })
}

fs.writeFileSync(`temp/comentarios_${username}.json`, JSON.stringify(comentarios, null, 2))
console.log(`✅ Comentarios generados con menciones y respuestas: temp/comentarios_${username}.json`)