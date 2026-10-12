#!/usr/bin/env node
// Cria a pasta de um vídeo novo a partir do molde da skill.
// Uso: node new-project.mjs <destination> [--title "Nome"] [--duration 40] [--bpm 120] [--formats 16x9,9x16] [--project "Marca"]
// Resultado: index.html, video.js, brand.js, engine.js, scenes.js (demo), fonts/, audio/ (synth.py,
// verify.py, sheet.json), tools/ (render, quadros, finalizar) — pasta autocontida, re-renderizável.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
// O marcador de pasta de trabalho é opcional: sem
// scripts/marcador.mjs no pacote, ninguém marca pasta.
const MARCADOR = new URL('./marcador.mjs', import.meta.url)
const { marcar } = fs.existsSync(MARCADOR) ? await import(MARCADOR.href) : {}
const skill = path.resolve(here, '..')
const args = process.argv.slice(2)
const opt = (k, d) => { const i = args.indexOf('--' + k); return i >= 0 ? args[i + 1] : d }
const destino = args.find((a, i) => !a.startsWith('--') && !(i > 0 && args[i - 1].startsWith('--')))
if (!destino) { console.error('usage: node new-project.mjs <destination> [--title ..] [--duration 40] [--bpm 120] [--formats 16x9,9x16]'); process.exit(1) }
const dest = path.resolve(destino)
if (fs.existsSync(dest) && fs.readdirSync(dest).length && !args.includes('--force')) {
  console.error(`${dest} already exists and is not empty. Use another folder (or --force to overwrite the template files).`)
  process.exit(1)
}
const titulo = opt('title', 'Video'), duracao = +opt('duration', 40), bpm = +opt('bpm', 120)
const formatos = opt('formats', '16x9').split(',').map((s) => s.trim())

fs.cpSync(path.join(skill, 'assets', 'template'), dest, { recursive: true })
fs.mkdirSync(path.join(dest, 'audio'), { recursive: true })
for (const f of ['synth.py', 'verify.py', 'sounds.py', 'series.py', 'arrange_series.py']) {
  const src = path.join(skill, 'assets', 'audio', f)
  if (fs.existsSync(src)) fs.copyFileSync(src, path.join(dest, 'audio', f)); else console.error(`warning: ${f} not found in the skill`)
}
fs.mkdirSync(path.join(dest, 'tools'), { recursive: true })
for (const f of ['playwright.cjs', 'frames.cjs', 'render.cjs', 'finalize.mjs']) fs.copyFileSync(path.join(here, f), path.join(dest, 'tools', f))

const vj = path.join(dest, 'video.js')
let v = fs.readFileSync(vj, 'utf8')
v = v.replace(/titulo: '.*?'/, `titulo: ${JSON.stringify(titulo).replace(/"/g, "'")}`)
  .replace(/duracao: [\d.]+/, `duracao: ${duracao}`)
  .replace(/bpm: \d+/, `bpm: ${bpm}`)
  .replace(/formatos: \[.*?\]/, `formatos: [${formatos.map((f) => `'${f}'`).join(', ')}]`)
fs.writeFileSync(vj, v)

const folha = {
  titulo, duracao, bpm, compasso: 4, taxa: 48000, saida: 'soundtrack.wav', loudness_lufs: -14.0, teto_dbtp: -1.5,
  semente: Math.floor(Date.now() / 1000) % 100000000,
  silencios: [], fade: [Math.max(0, duracao - 2), duracao], secoes: [], marcos: [],
}
fs.writeFileSync(path.join(dest, 'audio', 'sheet.json'), JSON.stringify(folha, null, 2) + '\n')

const marca = marcar?.(dest, { projeto: opt('project', null), o_que: `video "${titulo}"` })
console.log(`project created in ${dest}`)
if (marca && !marca.marcou && marca.motivo.startsWith('está')) console.log(`  no working-folder marker: ${marca.motivo}`)
console.log(`  ${titulo} · ${duracao} s · ${bpm} BPM (bar = ${(240 / bpm).toFixed(3)} s) · formats ${formatos.join(', ')}`)
console.log('  scenes.js is only the engine demo — replace it with the video\'s scenes.')
