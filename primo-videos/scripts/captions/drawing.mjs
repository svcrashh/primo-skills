// Desenha a legenda: uma página transparente por estado (linha + palavra atual), no Chromium do motor.
// Fonte e cores são as do projeto (series.json + brand.js + fonts/fonts.css). Contorno grosso em vez de placa: lê em
// qualquer fundo e cobre só as letras, não um retângulo inteiro do aparelho.
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { lerMarca, contraste } from '../tutorial/visual.mjs'

const aqui = path.dirname(fileURLToPath(import.meta.url))
const require = createRequire(import.meta.url)

const hex = (h) => (/^#[0-9a-f]{3}$/i.test(h) ? '#' + [...h.slice(1)].map((c) => c + c).join('') : h)

/** Estilo vindo da marca: letra clara, contorno escuro, palavra atual na cor de acento. */
export function estiloDaMarca(serieDir) {
  const serie = JSON.parse(fs.readFileSync(path.join(serieDir, 'series.json'), 'utf8'))
  const marca = lerMarca(path.join(serieDir, 'brand.js'))
  const c = marca.cores || {}
  const acento = hex(c.acento || c.marca)
  if (!/^#[0-9a-f]{6}$/i.test(acento || '')) throw new Error(`MARCA.cores.acento (or .marca) must be a hex, got ${JSON.stringify(c.acento || c.marca)}`)
  // contorno: o escuro da marca (navy ou tinta); letra: branco. O acento tem de se ler sobre o contorno (≥ 3:1)
  const escuros = [c.navy, c.tinta, '#111111'].filter(Boolean).map(hex).filter((h) => /^#[0-9a-f]{6}$/i.test(h))
  const contorno = escuros.find((h) => contraste('#FFFFFF', h) >= 7 && contraste(acento, h) >= 3) || '#111111'
  const familia = serie.fonteTitulo || serie.fonteTexto
  if (!familia) throw new Error('series.json has no fonteTitulo/fonteTexto: the caption uses the brand font')
  const css = path.join(serieDir, 'fonts', 'fonts.css')
  return { familia, fontesCss: fs.existsSync(css) ? css : null, letra: '#FFFFFF', contorno, acento, peso: 700 }
}

const esc = (s) => s.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c])

function pagina(est, W, H, { tam, topoPx, linha, atual, col = { x0: 0.05, x1: 0.95 } }) {
  const folhaFontes = est.fontesCss ? `<link rel="stylesheet" href="${pathToFileURL(est.fontesCss).href}">` : ''
  const palavras = linha.map((t, i) => `<span class="${i === atual ? 'a' : ''}" style="visibility:${i <= atual ? 'visible' : 'hidden'}">${esc(t)}</span>`).join(' ')
  return `<!doctype html><meta charset="utf-8">${folhaFontes}<style>
html,body{margin:0;width:${W}px;height:${H}px;background:transparent;overflow:hidden}
#c{position:absolute;left:${Math.round(W * col.x0)}px;width:${Math.round(W * (col.x1 - col.x0))}px;top:${Math.round(topoPx)}px;text-align:center;
  font-family:"${est.familia}",system-ui,sans-serif;font-weight:${est.peso};font-size:${tam}px;line-height:1.12;color:${est.letra};
  paint-order:stroke fill;-webkit-text-stroke:${Math.round(tam * 0.13)}px ${est.contorno};text-shadow:0 ${Math.round(tam * 0.05)}px ${Math.round(tam * 0.18)}px rgba(0,0,0,.45);
  stroke-linejoin:round;text-wrap:balance}
#c .a{color:${est.acento}}
</style><div id="c">${palavras}</div>`
}

/** Tamanho da letra: 9:16 em 7,4% da largura; 16:9 em 5,6% da altura. */
export const tamanhoDaLetra = (W, H) => Math.round(H > W ? W * 0.078 : H * 0.056)

/** Abre o Chromium e devolve { medir(linha) → altura em fração, desenhar(arquivo, estado, topo) , fechar() }. */
export async function abrirDesenho(est, W, H, projeto) {
  const { abrirNavegador } = require(path.join(aqui, '..', 'playwright.cjs'))
  const { browser } = await abrirNavegador(projeto)
  const ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 1 })
  const p = await ctx.newPage()
  const tam = tamanhoDaLetra(W, H)
  const carregar = async (opts) => {
    await p.setContent(pagina(est, W, H, opts), { waitUntil: 'load' })
    await p.evaluate(() => document.fonts.ready)
  }
  return {
    tam,
    async medir(linha, col) {
      await carregar({ tam, topoPx: 0, linha, atual: linha.length - 1, col })
      const r = await p.evaluate(() => { const b = document.getElementById('c').getBoundingClientRect(); return { h: b.height } })
      return r.h / H
    },
    async desenhar(arquivo, linha, atual, topoFrac, col) {
      await carregar({ tam, topoPx: topoFrac * H, linha, atual, col })
      await p.screenshot({ path: arquivo, omitBackground: true })
      const caixa = await p.evaluate(() => {
        const out = []
        for (const s of document.querySelectorAll('#c span')) if (s.style.visibility === 'visible') for (const r of s.getClientRects()) out.push([r.left, r.top, r.right, r.bottom])
        return out
      })
      return caixa
    },
    async fechar() { await browser.close() },
  }
}
