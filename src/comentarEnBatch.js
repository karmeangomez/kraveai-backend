// comentarEnBatch.js
import fs from 'fs'
import puppeteer from 'puppeteer-extra'
import StealthPlugin from 'puppeteer-extra-plugin-stealth'

puppeteer.use(StealthPlugin())

const delay = (ms) => new Promise(r => setTimeout(r, ms))
const shuffle = (arr) => arr.sort(() => Math.random() - 0.5)

const username = process.argv[2]
const postURL = process.argv[3]

if (!username || !postURL) {
  console.log("❌ Debes pasar el nombre de usuario objetivo y la URL del post.")
  process.exit(1)
}

const pathComentarios = `temp/comentarios_${username}.json`
if (!fs.existsSync(pathComentarios)) {
  console.log("❌ No se encontraron comentarios generados.")
  process.exit(1)
}

const pathCuentas = `cuentas_logueadas.json`
if (!fs.existsSync(pathCuentas)) {
  console.log("❌ No se encontraron cuentas activas.")
  process.exit(1)
}

const comentarios = shuffle(JSON.parse(fs.readFileSync(pathComentarios)))
const cuentas = shuffle(JSON.parse(fs.readFileSync(pathCuentas)))

const comentariosPublicados = []

const comentar = async (cuenta, comentario) => {
  const cookiesPath = `cookies/${cuenta}.json`
  if (!fs.existsSync(cookiesPath)) {
    console.log(`⚠️ No hay cookies para ${cuenta}, se omite.`)
    return false
  }

  const cookies = JSON.parse(fs.readFileSync(cookiesPath))
  const browser = await puppeteer.launch({
    headless: false,
    args: ['--no-sandbox'],
    executablePath: '/usr/bin/chromium-browser'
  })

  const page = await browser.newPage()
  await page.setCookie(...cookies)

  try {
    await page.goto(postURL, { waitUntil: 'networkidle2', timeout: 60000 })
    await delay(3000)

    // Si es respuesta, clic en "Responder" al azar
    if (comentario.respuesta && comentariosPublicados.length > 0) {
      const objetivo = comentariosPublicados[Math.floor(Math.random() * comentariosPublicados.length)]
      const replyButton = await page.$x(`//span[contains(text(), "${objetivo.cuenta}")]//ancestor::ul//button[contains(., "Responder")]`)
      if (replyButton.length > 0) {
        await replyButton[0].click()
        await delay(1000)
      }
    } else {
      // Scroll al campo normal
      const commentBox = await page.$('textarea') || await page.$('form textarea')
      if (!commentBox) throw new Error('No se encontró el campo de comentario')
      await commentBox.click()
      await delay(500)
    }

    await page.keyboard.type(comentario.texto, { delay: 60 })
    await delay(500)
    await page.keyboard.press('Enter')
    console.log(`✅ ${cuenta} comentó: "${comentario.texto}"`)

    comentariosPublicados.push({ cuenta, texto: comentario.texto })
    await delay(3000)

    // Dar like aleatoriamente a otro comentario
    if (comentariosPublicados.length > 1 && Math.random() < 0.5) {
      const likeButtons = await page.$$('svg[aria-label="Me gusta"]')
      if (likeButtons.length > 0) {
        const btn = likeButtons[Math.floor(Math.random() * likeButtons.length)]
        await btn.click()
        console.log(`❤️ ${cuenta} dio like a otro comentario`)
      }
    }

  } catch (err) {
    console.log(`❌ ${cuenta} falló: ${err.message}`)
  }

  await browser.close()
}

const distribuir = async () => {
  const disponibles = cuentas.map(c => ({ cuenta: c, usados: 0 }))
  for (const c of comentarios) {
    const disponible = disponibles.find(c => c.usados < 3)
    if (!disponible) break

    await comentar(disponible.cuenta, c)
    disponible.usados++
    await delay(Math.random() * 5000 + 3000)
  }

  console.log("✅ Finalizado.")
}

distribuir()