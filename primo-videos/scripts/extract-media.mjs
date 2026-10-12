#!/usr/bin/env node
// Colhe a mídia REAL de uma página pública (perfil, loja, página do produto) para redesenhar a interface com ela:
// imagens, vídeos e as respostas JSON da API (rótulos, números, ordem), mais prints de referência.
//   node extract-media.mjs <url> --out <project>/media/<name> [--click "texto"] [--scroll 6] [--computer] [--no-screenshots]
// - Antes de abrir a página, bloqueia as chamadas de métrica (visita, clique, curtida, pixel, analytics): nada que a
//   gravação faça conta como visita de verdade. O relatório lista cada chamada bloqueada.
// - Os prints servem para conferir rótulo, cor e ordem. NÃO entram no vídeo como painel parado: um print encolhido ou
//   parado dentro de uma moldura foi recusado ("ficou esquisito", "tudo a mesma coisa"). O vídeo redesenha a interface,
//   grande e animada, com as imagens e os dados daqui (references/chapters.md §5 e §6).
// - Vídeo de fundo vira sequência de quadros com ffmpeg (exemplo no fim do relatório) e entra com `sequencia()`.
// - Só página pública e com autorização do dono da conta de exemplo. Nunca use dado privado (visitantes, e-mail).
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'

const require = createRequire(import.meta.url)
const aqui = path.dirname(fileURLToPath(import.meta.url))
const args = process.argv.slice(2)
const opt = (k, d) => { const i = args.indexOf('--' + k); return i >= 0 ? args[i + 1] : d }
const url = args.find((a) => /^https?:\/\//.test(a))
const saida = opt('out')
if (!url || !saida) { console.error('usage: node extract-media.mjs <url> --out <project>/media/<name> [--click "text"] [--scroll 6] [--computer] [--no-screenshots]'); process.exit(1) }

// métrica, curtida, pixel e rastreador de terceiros: abortados antes de sair do navegador
const METRICA = /\/(analytics|track|tracking|collect|beacon|pixel|metrics|telemetry|events?|hit|view|views|visit|visits|like|likes|impression)s?(\/|\?|$)|google-analytics|googletagmanager|gtag\/js|doubleclick|facebook\.(net|com\/tr)|connect\.facebook|hotjar|clarity\.ms|segment\.(io|com)|mixpanel|amplitude|posthog|plausible|umami|matomo|tiktok\.com\/i18n\/pixel|analytics\.tiktok/i

const { abrirNavegador } = require(path.join(aqui, 'playwright.cjs'))
const dir = path.resolve(saida)
fs.mkdirSync(path.join(dir, 'imagens'), { recursive: true })
fs.mkdirSync(path.join(dir, 'api'), { recursive: true })

const { browser } = await abrirNavegador(dir).catch((e) => { console.error(e.message); process.exit(2) })
const celular = !args.includes('--computer')   // celular é o padrão: perfil e bio são vistos no celular
const ctx = await browser.newContext(celular
  ? { viewport: { width: 430, height: 932 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true, userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1' }
  : { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 })
const bloqueadas = [], imagens = new Map(), videos = new Set(), jsons = []
await ctx.route('**/*', (r) => {
  const u = r.request().url()
  if (METRICA.test(u) && !/\.(png|jpe?g|webp|gif|svg|mp4|webm|woff2?)(\?|$)/i.test(u)) { bloqueadas.push(`${r.request().method()} ${u}`); return r.abort() }
  return r.continue()
})
const p = await ctx.newPage()
p.on('response', async (res) => {
  const u = res.url(), tipo = res.headers()['content-type'] || ''
  try {
    if (tipo.startsWith('image/') || /\.(png|jpe?g|webp|gif|svg)(\?|$)/i.test(u)) imagens.set(u, tipo)
    else if (tipo.startsWith('video/') || /\.(mp4|webm|mov)(\?|$)/i.test(u)) videos.add(u)
    else if (tipo.includes('json') && res.request().method() === 'GET') {
      const corpo = await res.text()
      const nome = (new URL(u).pathname.replace(/^\/+/, '').replace(/[^\w.-]+/g, '_') || 'raiz').slice(0, 80) + '.json'
      fs.writeFileSync(path.join(dir, 'api', nome), corpo)
      jsons.push({ url: u, arquivo: `api/${nome}` })
      for (const m of corpo.matchAll(/https?:\/\/[^"\s]+?\.(mp4|webm)/gi)) videos.add(m[0])
    }
  } catch {}
})
await p.goto(url, { waitUntil: 'networkidle', timeout: 60000 }).catch((e) => console.error(`warning: ${e.message.split('\n')[0]}`))
await p.waitForTimeout(2000)
const clicar = opt('click')
if (clicar) { const e = p.getByText(new RegExp(clicar, 'i')).first(); if (await e.count()) { await e.click().catch(() => {}); await p.waitForTimeout(2500) } }
const semPrints = args.includes('--no-screenshots')
if (!semPrints) await p.screenshot({ path: path.join(dir, 'print-00.png') })
for (let i = 1; i <= +opt('scroll', 6); i++) {
  await p.evaluate(() => window.scrollBy(0, Math.round(window.innerHeight * 0.75)))
  await p.waitForTimeout(1200)
  if (!semPrints) await p.screenshot({ path: path.join(dir, `print-${String(i).padStart(2, '0')}.png`) })
}
await browser.close()

// baixa as imagens e os vídeos (cada um uma vez, com o nome do arquivo de origem)
const nomeDe = (u, i) => `${String(i).padStart(2, '0')}-${path.basename(new URL(u).pathname).replace(/[^\w.-]+/g, '_').slice(0, 60) || 'arquivo'}`
const baixados = []
let i = 0
for (const u of [...imagens.keys(), ...videos]) {
  i++
  try {
    const r = await fetch(u)
    if (!r.ok) continue
    const sub = videos.has(u) ? '' : 'imagens'
    const arq = path.join(dir, sub, nomeDe(u, i))
    fs.writeFileSync(arq, Buffer.from(await r.arrayBuffer()))
    baixados.push({ url: u, arquivo: path.relative(dir, arq) })
  } catch {}
}
const rel = [`# Media from ${url}`, '', `Collected on ${new Date().toISOString()} with the metrics calls blocked (${bloqueadas.length}):`,
  ...bloqueadas.map((b) => `- ${b}`), '', '## Files', ...baixados.map((b) => `- \`${b.arquivo}\` ← ${b.url}`), '', '## API responses (data for the redesign)',
  ...jsons.map((j) => `- \`${j.arquivo}\` ← ${j.url}`), '',
  'Animated GIF → 1st frame: `ffmpeg -i x.gif -frames:v 1 x.png` · WEBP → PNG: `ffmpeg -i x.webp x.png`',
  'Background video inside the phone (portrait, 30 fps, 9 s): `ffmpeg -ss 2 -t 9 -i video.mp4 -vf "crop=ih*390/844:ih,scale=480:-2,fps=30" -q:v 3 video/q%04d.jpg` and, in the scene, `sequencia(tela, quadros)` + `.set(t)`.',
  'The screenshots are a reference for labels, color and order: the video redesigns the interface with this data.']
fs.writeFileSync(path.join(dir, 'MIDIA.md'), rel.join('\n') + '\n')
console.log(`✓ ${baixados.length} files, ${jsons.length} JSON responses, ${bloqueadas.length} metrics calls blocked → ${path.join(dir, 'MIDIA.md')}`)
