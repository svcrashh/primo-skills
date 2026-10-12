#!/usr/bin/env node
// Coloca as fontes do vídeo dentro do projeto (fonts/*.woff2 + fonts/fonts.css), para o render não
// depender de rede nem de fonte instalada no sistema.
// Uso: node fonts.mjs <project> "Família 1" "Família 2" [--search <folder> ...]
// 1º procura @fontsource(-variable) em node_modules das pastas de busca (padrão: pasta atual e pais);
// 2º baixa do Google Fonts (latin + latin-ext, normal e itálico, pesos variáveis quando existirem).
import fs from 'node:fs'
import path from 'node:path'

const args = process.argv.slice(2)
const busca = []
const pos = []
for (let i = 0; i < args.length; i++) { if (args[i] === '--search') busca.push(path.resolve(args[++i])); else pos.push(args[i]) }
const [projeto, ...familias] = pos
if (!projeto || !familias.length) { console.error('usage: node fonts.mjs <project> "Family" ["Family 2"] [--search folder]'); process.exit(1) }
const outDir = path.join(path.resolve(projeto), 'fonts')
fs.mkdirSync(outDir, { recursive: true })
const cssPath = path.join(outDir, 'fonts.css')
let css = fs.existsSync(cssPath) ? fs.readFileSync(cssPath, 'utf8') : ''
if (!busca.length) { let d = process.cwd(); for (let k = 0; k < 4; k++) { busca.push(d); d = path.dirname(d) } }
const slug = (f) => f.toLowerCase().replace(/\s+/g, '-')
// Faixas oficiais dos subconjuntos (as mesmas do Google Fonts/fontsource). Sem elas, o arquivo latin-ext
// declarado depois "ganharia" do latin para todas as letras e o texto cairia na fonte reserva.
const FAIXA = {
  latin: 'U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD',
  'latin-ext': 'U+0100-02BA, U+02BD-02C5, U+02C7-02CC, U+02CE-02D7, U+02DD-02FF, U+0304, U+0308, U+0329, U+1D00-1DBF, U+1E00-1E9F, U+1EF2-1EFF, U+2020, U+20A0-20AB, U+20AD-20C0, U+2113, U+2C60-2C7F, U+A720-A7FF',
}

function local(fam) {
  const s = slug(fam), faces = []
  for (const base of busca) {
    let nm
    try { nm = fs.readdirSync(base).includes('node_modules') ? path.join(base, 'node_modules') : null } catch { continue }
    if (!nm) continue
    const v = path.join(nm, '@fontsource-variable', s, 'files')
    if (fs.existsSync(v)) {
      for (const sub of ['latin', 'latin-ext']) for (const st of ['normal', 'italic']) {
        const cand = fs.readdirSync(v).filter((f) => f.startsWith(`${s}-${sub}-`) && f.endsWith(`-${st}.woff2`) && /-(wght|full|standard)-/.test(f))
        const f = cand.find((x) => x.includes('-wght-')) || cand[0]
        if (f) faces.push({ src: path.join(v, f), style: st, weight: '100 1000', sub })
      }
      if (faces.length) return faces
    }
    const st = path.join(nm, '@fontsource', s, 'files')
    if (fs.existsSync(st)) {
      for (const f of fs.readdirSync(st)) {
        const m = f.match(new RegExp(`^${s}-(latin|latin-ext)-(\\d{3})-(normal|italic)\\.woff2$`))
        if (m) faces.push({ src: path.join(st, f), style: m[3], weight: m[2], sub: m[1] })
      }
      if (faces.length) return faces
    }
  }
  return null
}

const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36'
async function google(fam) {
  const q = encodeURIComponent(fam).replace(/%20/g, '+')
  const tentativas = [`ital,wght@0,100..900;1,100..900`, `wght@100..900`, `ital,wght@0,400;0,500;0,600;0,700;0,800;0,900;1,400;1,700`, `ital,wght@0,400;0,700;1,400;1,700`, `wght@400;700`, null]
  for (const ax of tentativas) {
    const url = `https://fonts.googleapis.com/css2?family=${q}${ax ? ':' + ax : ''}&display=block`
    const r = await fetch(url, { headers: { 'User-Agent': UA } })
    if (!r.ok) continue
    const txt = await r.text()
    const faces = []
    for (const m of txt.matchAll(/\/\*\s*([\w-]+)\s*\*\/\s*@font-face\s*{([^}]*)}/g)) {
      if (!['latin', 'latin-ext'].includes(m[1])) continue
      const b = m[2]
      faces.push({ url: b.match(/url\((.*?)\)/)[1], style: b.match(/font-style:\s*(\w+)/)[1], weight: b.match(/font-weight:\s*([\d ]+)/)[1].trim(), sub: m[1], range: (b.match(/unicode-range:\s*([^;]+);/) || [])[1] })
    }
    if (faces.length) return faces
  }
  return null
}

for (const fam of familias) {
  let faces = local(fam), origem = 'local'
  if (!faces) { faces = await google(fam).catch(() => null); origem = 'Google Fonts' }
  if (!faces) { console.error(`✗ ${fam}: not found in node_modules or on Google Fonts. Bring the .woff2 and declare it in fonts.css.`); process.exitCode = 1; continue }
  css = css.replace(new RegExp(`/\\* ${fam} \\*/[\\s\\S]*?/\\* fim ${fam} \\*/\\n?`, 'g'), '')
  let bloco = `/* ${fam} */\n`
  for (const f of faces) {
    const nome = `${slug(fam)}-${f.sub}-${f.style}-${f.weight.replace(/ /g, '_')}.woff2`
    if (f.src) fs.copyFileSync(f.src, path.join(outDir, nome))
    else fs.writeFileSync(path.join(outDir, nome), Buffer.from(await (await fetch(f.url)).arrayBuffer()))
    bloco += `@font-face { font-family: "${fam}"; src: url(${nome}) format("woff2"); font-style: ${f.style}; font-weight: ${f.weight}; font-display: block;${(f.range || FAIXA[f.sub]) ? ` unicode-range: ${f.range || FAIXA[f.sub]};` : ''} }\n`
  }
  css += bloco + `/* fim ${fam} */\n`
  console.log(`✓ ${fam}: ${faces.length} file(s) from ${origem}`)
}
fs.writeFileSync(cssPath, css)
console.log(`\nfonts in ${outDir}. Put in video.js: fontes: [${familias.map((f) => `'${f}'`).join(', ')}]`)
