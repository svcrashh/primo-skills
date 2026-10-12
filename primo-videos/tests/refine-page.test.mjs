// node --test tests/refine-page.test.mjs   (sem rede; precisa do Playwright com Chromium — sem ele, os testes pulam)
// Um projeto de mentira com uma cena por caso: cada página segue o contrato do motor (VIDEO, FMT, __ready, renderAt).
import { test, describe, before } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { createRequire } from 'node:module'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { checarPaginas } from '../scripts/refine/page.mjs'

const AQUI = path.dirname(fileURLToPath(import.meta.url))
const FONTES = pathToFileURL(path.join(AQUI, 'cases', 'page')).href
const require = createRequire(import.meta.url)

// "Kit Reta" só tem a face normal 800; "Kit Italica" só tem a itálica 700.
function pagina(video, corpo) {
  return `<!doctype html><html><head><meta charset="utf-8"><style>
@font-face { font-family: "Kit Reta"; src: url(${FONTES}/saira-condensed-latin-normal-800.woff2) format("woff2"); font-style: normal; font-weight: 800; }
@font-face { font-family: "Kit Italica"; src: url(${FONTES}/quantico-latin-italic-700.woff2) format("woff2"); font-style: italic; font-weight: 700; }
html, body { margin: 0; background: #000; }
#stage { position: relative; overflow: hidden; width: 1080px; height: 1920px; }
.abs { position: absolute; white-space: nowrap; }
</style></head><body><div id="stage">${corpo}</div><script>
const VIDEO = ${JSON.stringify({ duracao: 1, formatos: ['9x16'], plataforma: 'tiktok', ...video })}
const FMT = new URLSearchParams(location.search).get('f') || VIDEO.formatos[0]
// o que tem data-anda corre 600 px/s para a direita: está na zona, mas em movimento
window.renderAt = (t) => { document.querySelectorAll('[data-anda]').forEach((e) => { e.style.left = (900 + 600 * t) + 'px' }) }
Promise.all([...document.fonts].map((f) => f.load().catch(() => null))).then(() => { renderAt(0); window.__ready = true })
</script></body></html>`
}

const TXT = 'style="left:100px; top:500px; font-size:90px; color:#fff;'
const CENAS = {
  '01-reserva': [{ fontes: ['Fonte Que Nao Existe'] }, `<div class="abs" ${TXT} font-family:'Fonte Que Nao Existe'; font-weight:400">Olá, conta</div>`],
  '02-fora': [{ fontes: ['Kit Reta'] }, `<div class="abs" ${TXT} font-family:'Times New Roman'">Olá, conta</div>`],
  '03-italico-falso': [{ fontes: ['Kit Reta'] }, `<div class="abs" ${TXT} font:italic 800 90px 'Kit Reta'">MARCA</div>`],
  '04-face-certa': [{ fontes: ['Kit Reta', 'Kit Italica'] },
    `<div class="abs" ${TXT} font:italic 700 90px 'Kit Italica'">MARCA</div>
     <div class="abs" style="left:100px; top:700px; color:#fff; font:800 90px 'Kit Reta'">MARCA</div>`],
  '05-area': [{ fontes: ['Kit Reta'] },
    `<div class="abs" style="left:0; top:0; width:1080px; height:1920px; background:#123456"></div>
     <div class="abs" id="botoes" style="left:960px; top:1000px; width:100px; height:200px; background:#222; color:#fff; font:800 40px 'Kit Reta'">OI</div>
     <div class="abs" style="left:1040px; top:10px; width:30px; height:30px; background:#F00"></div>
     <div class="abs" style="left:300px; top:1600px; width:400px; height:200px; background:#333"></div>
     <div class="abs" data-colisao="false" style="left:60px; top:20px; color:#fff; font:800 90px 'Kit Reta'">FUNDO</div>
     <div class="abs" data-anda style="top:1200px; width:120px; height:120px; background:#0F0"></div>`],
}

let r = null, semPw = null, saida
describe('checarPaginas', () => {
  before(async () => {
    try { require('../scripts/playwright.cjs').carregar() } catch (e) { semPw = e.message.split('\n')[0]; return }
    const proj = fs.mkdtempSync(path.join(os.tmpdir(), 'refino-pagina-'))
    for (const [nome, [video, corpo]] of Object.entries(CENAS)) {
      fs.mkdirSync(path.join(proj, 'scenes', nome), { recursive: true })
      fs.writeFileSync(path.join(proj, 'scenes', nome, 'index.html'), pagina(video, corpo))
      fs.writeFileSync(path.join(proj, 'scenes', nome, 'scene.js'), '')
    }
    fs.mkdirSync(path.join(proj, 'scenes', '_gabarito'))   // não é cena: fica de fora
    saida = path.join(proj, 'frames')
    try { r = await checarPaginas(proj, { saidaQuadros: saida }) } catch (e) {
      if (e.code === 'SEM_PLAYWRIGHT' || e.code === 'SEM_CHROMIUM') { semPw = e.message.split('\n')[0]; return }
      throw e
    }
  })
  const de = (cena, checagem) => r.achados.filter((a) => a.cena === cena && (!checagem || a.checagem === checagem))

  test('família que não existe: o texto caiu na fonte reserva (prova por medida)', (t) => {
    if (semPw) return t.skip(semPw)
    const a = de('01-reserva')
    assert.equal(a.length, 1, JSON.stringify(a))
    assert.equal(a[0].checagem, 'fonte'); assert.equal(a[0].nivel, 'erro'); assert.equal(a[0].formato, '9x16')
    assert.match(a[0].msg, /fallback font/)
    assert.equal(a[0].t, 0); assert.ok(a[0].fim > 0.9)    // agrupado: do primeiro ao último aparecimento
  })

  test('família fora do kit: erro com o nome da família', (t) => {
    if (semPw) return t.skip(semPw)
    const a = de('02-fora')
    assert.equal(a.length, 1, JSON.stringify(a))
    assert.equal(a[0].nivel, 'erro')
    assert.match(a[0].msg, /Times New Roman.*outside the brand kit/)
  })

  test('itálico pedido de uma família só com face normal: itálico falso', (t) => {
    if (semPw) return t.skip(semPw)
    const a = de('03-italico-falso')
    assert.equal(a.length, 1, JSON.stringify(a))
    assert.equal(a[0].nivel, 'erro')
    assert.match(a[0].msg, /fake italic/)
    assert.ok(a[0].caixas.length >= 1)
  })

  test('o mesmo texto com a face certa (itálica de verdade, normal no peso que existe): nada', (t) => {
    if (semPw) return t.skip(semPw)
    assert.deepEqual(de('04-face-certa'), [])
    const fam = r.medidas['04-face-certa']['9x16'].familias
    assert.ok(fam['Kit Italica 700 italic'] && fam['Kit Reta 800'], JSON.stringify(fam))
  })

  test('área segura: caixa com texto sob os botões do TikTok é erro; fundo, cantinho, decorativo e o que passa correndo, não', (t) => {
    if (semPw) return t.skip(semPw)
    assert.deepEqual(de('05-area', 'fonte'), [])
    const a = de('05-area', 'area-segura')
    const erros = a.filter((x) => x.nivel === 'erro'), avisos = a.filter((x) => x.nivel === 'aviso')
    assert.equal(erros.length, 1, JSON.stringify(a))
    assert.match(erros[0].msg, /tiktok button strip/)
    assert.match(erros[0].msg, /OI/)
    assert.deepEqual(erros[0].caixas[0], { x: 960, y: 1000, w: 100, h: 200 })
    // a caixa só pintada que entra na base é aviso, não erro
    assert.equal(avisos.length, 1, JSON.stringify(a))
    assert.match(avisos[0].msg, /bottom of the tiktok interface/)
    assert.equal(a.length, 2)
  })

  test('quadro marcado de cada achado e medidas por cena', (t) => {
    if (semPw) return t.skip(semPw)
    for (const a of r.achados) {
      assert.ok(a.quadro && fs.existsSync(a.quadro), a.msg)
      assert.match(path.basename(a.quadro), /^(fonte|area-segura)-\d\d-[a-z-]+-9x16-\d+\.\d\d(-\d+)?\.png$/)
    }
    assert.deepEqual(Object.keys(r.medidas).sort(), Object.keys(CENAS))
    const m = r.medidas['05-area']['9x16']
    assert.equal(m.amostras, 3); assert.equal(m.plataforma, 'tiktok'); assert.ok(m.elementos >= 4)
  })
})
