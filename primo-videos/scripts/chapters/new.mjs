#!/usr/bin/env node
// Cria a pasta de um vídeo em capítulos a partir do molde (references/chapters.md §11 e §13).
//   node new.mjs <destination> [--fonts "Título,Texto,Mono"] [--formats 9x16] [--force]
// --formats: os formatos do vídeo em todas as cenas (Reels/TikTok = 9x16; celular deitado = 19x9; ultrawide ou
// telão = 21x9; padrão 16x9,9x16).
// Resultado: template/ (engine, kit, índice, fontes), scenes/00-opening, 01-example, 99-closing, media/, audio/ (síntese),
// tools/ (render, quadros, finalizar), out/ e, nos pacotes com narração, voice/ e o mix com voz em audio/.
import fs from 'node:fs'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const aqui = path.dirname(fileURLToPath(import.meta.url))
const skill = path.resolve(aqui, '..', '..')
const args = process.argv.slice(2)
const opt = (k, d) => { const i = args.indexOf('--' + k); return i >= 0 ? args[i + 1] : d }
const destino = args.find((a, i) => !a.startsWith('--') && !(i > 0 && args[i - 1].startsWith('--') && args[i - 1] !== '--force'))
if (!destino) { console.error('usage: node new.mjs <destination> [--fonts "Title,Text,Mono"] [--force]'); process.exit(1) }
const dest = path.resolve(destino)
if (fs.existsSync(dest) && fs.readdirSync(dest).length && !args.includes('--force')) {
  console.error(`${dest} already exists and is not empty. Use another folder, or --force to overwrite the template files.`)
  process.exit(1)
}
const FORMATOS = ['16x9', '19x9', '21x9', '9x16', '1x1', '4x5']
const errados = (opt('formats') || '').split(',').map((s) => s.trim()).filter((f) => f && !FORMATOS.includes(f))
if (errados.length) { console.error(`unknown format: ${errados.join(', ')}. Use ${FORMATOS.join(', ')} (e.g. --formats 16x9,21x9)`); process.exit(1) }
const fontes = opt('fonts', 'Barlow Condensed,Inter,JetBrains Mono').split(',').map((s) => s.trim()).filter(Boolean)
// A narração só vem nos pacotes com voz (scripts/chapters/falas.mjs): sem ela, o vídeo é trilha e texto na tela.
const comVoz = fs.existsSync(path.join(aqui, 'falas.mjs'))

const molde = path.join(skill, 'assets', 'chapters')
fs.cpSync(molde, dest, { recursive: true, filter: (f) => !/^example-/.test(path.relative(molde, f)) })
fs.copyFileSync(path.join(skill, 'assets', 'template', 'engine.js'), path.join(dest, 'template', 'engine.js'))
for (const d of ['media', ...(comVoz ? ['voice'] : []), 'audio', 'tools', 'out']) fs.mkdirSync(path.join(dest, d), { recursive: true })
for (const f of ['playwright.cjs', 'frames.cjs', 'render.cjs', 'finalize.mjs']) fs.copyFileSync(path.join(skill, 'scripts', f), path.join(dest, 'tools', f))
for (const f of ['synth.py', 'verify.py', 'sounds.py', 'series.py', 'arrange_series.py', ...(comVoz ? ['mix_voz.py'] : []), 'API.md']) fs.copyFileSync(path.join(skill, 'assets', 'audio', f), path.join(dest, 'audio', f))

if (opt('fonts')) {
  const [t, x, m] = fontes
  const kit = path.join(dest, 'template', 'kit.js')
  fs.writeFileSync(kit, fs.readFileSync(kit, 'utf8').replace(/const FONTE = \{[^}]*\}/, `const FONTE = { titulo: ${JSON.stringify(t)}, texto: ${JSON.stringify(x || t)}, mono: ${JSON.stringify(m || x || t)} }`))
  for (const c of fs.readdirSync(path.join(dest, 'scenes'))) {
    const v = path.join(dest, 'scenes', c, 'video.js')
    if (fs.existsSync(v)) fs.writeFileSync(v, fs.readFileSync(v, 'utf8').replace(/fontes: \[[^\]]*\]/, `fontes: ${JSON.stringify([...new Set(fontes)]).replace(/"/g, "'").replace(/,/g, ', ')}`))
  }
}
if (opt('formats')) {
  const fs2 = opt('formats').split(',').map((s) => `'${s.trim()}'`).join(', ')
  for (const c of fs.readdirSync(path.join(dest, 'scenes'))) {
    const v = path.join(dest, 'scenes', c, 'video.js')
    if (fs.existsSync(v)) fs.writeFileSync(v, fs.readFileSync(v, 'utf8').replace(/formatos: \[[^\]]*\]/, `formatos: [${fs2}]`))
  }
}
const r = spawnSync(process.execPath, [path.join(skill, 'scripts', 'fonts.mjs'), path.join(dest, 'template'), ...new Set(fontes)], { stdio: 'inherit' })
if (r.status !== 0) console.error(`warning: the fonts did not download (${fontes.join(', ')}). Run again: node ${path.join(skill, 'scripts', 'fonts.mjs')} ${path.join(dest, 'template')} "Family" …`)

console.log(`\nchapter video created in ${dest}
  1. change the tokens and the logo in template/kit.js and the index in template/index.js (from the reading);
  2. make ONE whole chapter (copy scenes/01-example) and render it: node ${path.join(aqui, 'render.mjs')} ${dest} 01-example --mode draft;
  3. look at out/sheet-*.png for each format; only then the other chapters, in parallel, with CONTRACT.md filled in;
     (01-example stays out of the assembly; delete it once the first real chapter exists)
  4. assemble (with --soundtrack --deliver <folder> it composes, measures and finalizes): node ${path.join(aqui, 'assemble.mjs')} ${dest} --soundtrack --deliver <folder>${comVoz ? '\n     (with a voiceover: add --narration voice/<version>/narration.json, after chapters/tempos.mjs and the scene renders)' : ''}`)
