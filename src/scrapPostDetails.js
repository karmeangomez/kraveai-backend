// scrapPostDetails.js
import puppeteer from 'puppeteer-extra'
import StealthPlugin from 'puppeteer-extra-plugin-stealth'
import fs from 'fs'
import path from 'path'

puppeteer.use(StealthPlugin())

const url = process.argv[2]
if (!url) {
  console.log("❌ Debes pasar la URL del post como argumento.")
  process.exit(1)
}

const delay = ms => new Promise(r => setTimeout(r, ms))

function deducirApodo(username) {
  if (!username) return null
  const base = username.replace(/[0-9._]/g, '')
  return base.length > 5 ? base.slice(0, 4) : base
}

function cargarInfoUsuario(username) {
  const ruta = './usuarios_info.json'
  if (!fs.existsSync(ruta)) return null
  const base = JSON.parse(fs.readFileSync(ruta))
  return base[username] || null
}

const scrap = async () => {
  const browser = await puppeteer.launch({
    headless: false,
    args: ['--no-sandbox'],
    executablePath: '/usr/bin/chromium-browser'
  })

  const page = await browser.newPage()
  await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 })
  await delay(2000)

  const username = await page.evaluate(() => {
    const el = document.querySelector('header a[href^="/"][role="link"]')
    return el ? el.textContent.trim().replace('@', '') : null
  })

  if (!username) {
    console.log("❌ No se pudo extraer el nombre de usuario.")
    await browser.close()
    return
  }

  const imageUrl = await page.evaluate(() => {
    const img = document.querySelector('img[decoding="auto"]') || document.querySelector('video')
    return img ? img.src : null
  })

  if (!imageUrl) {
    console.log("❌ No se pudo extraer imagen del post.")
    await browser.close()
    return
  }

  const imagePath = `temp/post_${username}.jpg`
  const view = await page.goto(imageUrl)
  fs.mkdirSync('temp', { recursive: true })
  fs.writeFileSync(imagePath, await view.buffer())

  const baseInfo = cargarInfoUsuario(username)
  const apodo = baseInfo?.apodo || deducirApodo(username)

  const resultado = {
    username,
    apodo,
    imagePath,
    estilo: baseInfo?.estilo || null,
    actividad: baseInfo?.actividad || null,
    ejemplos: baseInfo?.comentarios_predefinidos || []
  }

  console.log("✅ Resultado extraído:")
  console.log(JSON.stringify(resultado, null, 2))
  await browser.close()
}

scrap()