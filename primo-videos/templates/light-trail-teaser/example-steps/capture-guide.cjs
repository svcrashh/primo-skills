// Regrava o print da revelação do example-steps a partir da página de amostra da skill (assets/example/page.html,
// tema claro), com o Playwright da skill:
//   page-phone-how-it-works.jpg   a seção "How it works" em largura de celular (390 px, DPR 2), com a barra da página no
//                                 alto e 1800 px CSS de altura (780×3600)
// Uso: node capture-guide.cjs [<page.html>]   (padrão: assets/example/page.html desta skill)
// Num vídeo de verdade, o print é da tela do produto da pessoa.
const path = require('path')
const { pathToFileURL } = require('url')
const { abrirNavegador } = require(path.join(__dirname, '..', '..', '..', 'scripts', 'playwright.cjs'))
const pagina = path.resolve(process.argv[2] || path.join(__dirname, '..', '..', '..', 'assets', 'example', 'page.html'))

;(async () => {
  const { browser } = await abrirNavegador()
  const cel = await browser.newPage({ viewport: { width: 390, height: 1800 }, deviceScaleFactor: 2, colorScheme: 'light' })
  await cel.goto(pathToFileURL(pagina).href); await cel.waitForTimeout(800)
  // o título da seção 76 px abaixo do alto, onde a própria página o deixa ao seguir o link (scroll-padding-top)
  await cel.evaluate(() => scrollTo({ top: Math.round(document.getElementById('how-it-works').getBoundingClientRect().top + scrollY) - 76, behavior: 'instant' }))
  await cel.waitForTimeout(300)
  await cel.screenshot({ path: path.join(__dirname, 'page-phone-how-it-works.jpg'), type: 'jpeg', quality: 90 })
  await browser.close()
  console.log('capture saved in ' + __dirname)
})().catch((e) => { console.error(e); process.exit(1) })
