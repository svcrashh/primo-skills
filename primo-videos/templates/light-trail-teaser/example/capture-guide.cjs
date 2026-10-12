// Regrava os dois prints do example a partir da página de amostra da skill (assets/example/page.html, tema claro),
// com o Playwright da skill:
//   page-card.jpg    close do cartão "Feature three" da seção "Overview", com o título da seção seguinte (1440 px, DPR 2: 768×528)
//   page-phone.jpg   o topo da página em largura de celular (390 px, DPR 2, 2200 px CSS de altura: 780×4400)
// Uso: node capture-guide.cjs [<page.html>]   (padrão: assets/example/page.html desta skill)
// Num vídeo de verdade, os prints são da tela do produto da pessoa.
const path = require('path')
const { pathToFileURL } = require('url')
const { abrirNavegador } = require(path.join(__dirname, '..', '..', '..', 'scripts', 'playwright.cjs'))
const pagina = path.resolve(process.argv[2] || path.join(__dirname, '..', '..', '..', 'assets', 'example', 'page.html'))
const jpg = (nome) => ({ path: path.join(__dirname, nome), type: 'jpeg', quality: 90 })

;(async () => {
  const { browser } = await abrirNavegador()
  const pc = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2, colorScheme: 'light' })
  await pc.goto(pathToFileURL(pagina).href); await pc.waitForTimeout(800)
  const c = await pc.evaluate(() => { const b = document.getElementById('card-three').getBoundingClientRect(); return { x: Math.round(b.left + scrollX), y: Math.round(b.top + scrollY) } })
  // o cartão com 6 px de margem dos lados, 14 px acima (sem o cartão de cima) e o título "How it works" embaixo
  await pc.screenshot({ ...jpg('page-card.jpg'), fullPage: true, clip: { x: c.x - 6, y: c.y - 14, width: 384, height: 264 } })
  const cel = await browser.newPage({ viewport: { width: 390, height: 2200 }, deviceScaleFactor: 2, colorScheme: 'light' })
  await cel.goto(pathToFileURL(pagina).href); await cel.waitForTimeout(800)
  await cel.screenshot(jpg('page-phone.jpg'))
  await browser.close()
  console.log('captures saved in ' + __dirname)
})().catch((e) => { console.error(e); process.exit(1) })
