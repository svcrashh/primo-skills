#!/usr/bin/env node
// Molde photo-mosaic: do JSON ao vídeo entregue, com trilha, num formato ou em vários.
//   node render.mjs <parametros.json> --out <folder> [--mode draft|final] [--formats 16x9,9x16] [--no-sound]
// Passos: assemble.mjs (confere os parâmetros e monta a obra em <folder>/.work-<name>) → a trilha da skill
// (arrange_series.py, protagonista, BPM preso ao do vídeo: as fotos se reorganizam na batida) → render.cjs de cada formato →
// finalize.mjs (confere duração, loudness e pico no AAC) → folha de quadros <folder>/<name>-<format>-sheet.png.
// Sem um Python com numpy e scipy (ou com --no-sound), o vídeo sai mudo, e o script avisa.
// A fonte: o montar baixa pelo scripts/fonts.mjs quando falta; para a Inter dos exemplos, rode antes
// node scripts/example-fonts.mjs <folder>/.work-<name> (sem rede).
import fs from 'node:fs'
import path from 'node:path'
import { spawnSync, execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { acharPython } from '../../scripts/where.cjs'
import { montar, trilhaDe, Falha } from './assemble.mjs'
import { aberturaDoJson, relatar } from '../../scripts/opening.mjs'

const aqui = path.dirname(fileURLToPath(import.meta.url)), skill = path.resolve(aqui, '..', '..')
const a = process.argv.slice(2), arg = (k, d) => { const i = a.indexOf('--' + k); return i >= 0 ? a[i + 1] : d }
const arq = a.find((x) => x.endsWith('.json'))
const USO = 'usage: node render.mjs <parametros.json> --out <folder> [--mode draft|final] [--formats 16x9,9x16] [--no-sound]'
if (!arq || !arg('out')) { console.error(USO); process.exit(1) }
const modo = arg('mode', 'draft')
if (!['draft', 'final'].includes(modo)) { console.error(`--mode ${modo}: use draft or final\n${USO}`); process.exit(1) }
const P0 = JSON.parse(fs.readFileSync(arq, 'utf8'))
const nome = P0.nome || path.basename(arq, '.json')
const saida = path.resolve(arg('out'))
const formatos = arg('formats', (P0.formatos || ['16x9']).join(',')).split(',').map((s) => s.trim()).filter(Boolean)
const obra = path.join(saida, `.work-${nome}`)

let montado
try { montado = montar(arq, obra, { nome, formatos }) } catch (e) {
  console.error(e.message)
  process.exit(e instanceof Falha ? 2 : 1)
}
const { linha } = montado
console.log(`build: ${obra} · ${linha.duracao} s · ${linha.bpm} BPM · ` + linha.etapas.map((e) => `${e.tipo} ${e.t0.toFixed(2)}`).join(' · ') + ` · logo ${linha.fecho.tLogo.toFixed(2)}`)

// a trilha: as seções e os marcos saem da linha do tempo (cada etapa começa na batida; o logo é o acento final)
let trilha = false
if (!a.includes('--no-sound')) {
  const PY = acharPython()
  if (!PY) console.error(`WARNING: no Python with numpy and scipy, the video comes out silent. Run once: node ${path.join(skill, 'scripts', 'environment.mjs')} --fix`)
  else {
    const { folha, ident } = trilhaDe(P0, linha, nome)
    if (!P0.trilha?.identidade) console.log('soundtrack: no "trilha.identidade" in the JSON, using a neutral identity (declare the audience\'s music genre: assets/audio/API.md)')
    const dirAudio = path.join(obra, 'audio')
    fs.mkdirSync(dirAudio, { recursive: true })
    fs.rmSync(path.join(dirAudio, 'soundtrack.wav'), { force: true })
    fs.writeFileSync(path.join(dirAudio, 'sheet.json'), JSON.stringify(folha, null, 1) + '\n')
    fs.writeFileSync(path.join(dirAudio, 'identity.json'), JSON.stringify(ident, null, 2) + '\n')
    const r = spawnSync(PY, [path.join(skill, 'assets', 'audio', 'arrange_series.py'), 'identity.json', 'sheet.json'], { cwd: dirAudio, stdio: 'inherit' })
    if (r.status !== 0 || !fs.existsSync(path.join(dirAudio, 'soundtrack.wav'))) { console.error('the soundtrack did not come out (see above); run with --no-sound to output a silent video'); process.exit(1) }
    trilha = true
  }
}

for (const f of formatos) {
  const extra = modo === 'final' ? ['--sub', '4', '--crf', '16', '--preset', 'medium'] : []
  const r = spawnSync(process.execPath, [path.join(skill, 'scripts', 'render.cjs'), '--project', obra, '--mode', modo, '--format', f, '--out', `out/${f}.mp4`, '--no-sheet', ...extra], { stdio: 'inherit' })
  if (r.status !== 0) { console.error(`✗ ${f}: render exited with ${r.status}`); process.exitCode = 1; continue }
  const mudo = path.join(obra, 'out', `${f}.mp4`)
  const final = path.join(saida, `${nome}-${f}${modo === 'final' ? '' : '-draft'}.mp4`)
  if (trilha) {   // junta e confere a entrega (duração, loudness, pico), já em AAC
    const v = spawnSync(process.execPath, [path.join(skill, 'scripts', 'finalize.mjs'), '--project', obra, '--video', mudo, '--audio', 'audio/soundtrack.wav', '--out', final], { stdio: 'inherit', timeout: 180000 })
    if (v.status !== 0) { console.error(`WARNING: finalizar flagged something in the ${f} delivery (above)`); process.exitCode = 1 }
  } else fs.copyFileSync(mudo, final)
  if (P0.aberturaLogo) {   // o logo no começo (scripts/opening.mjs), antes da folha
    try { console.log(relatar(aberturaDoJson(final, P0.aberturaLogo, path.dirname(path.resolve(arq))))) } catch (e) { console.error(`✗ ${f}: ${e.message}`); process.exitCode = 1 }
  }
  const dur = +execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', final]).toString().trim()
  const [esc, grade] = f === '9x16' ? ['270:-1', '8x3'] : f === '1x1' || f === '4x5' ? ['360:-1', '6x4'] : ['480:-1', '6x4']
  const folhaPng = final.replace(/\.mp4$/, '-sheet.png')
  execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', final, '-vf', `fps=24/${dur},scale=${esc},tile=${grade}`, '-frames:v', '1', folhaPng])
  console.log(`✓ ${final} · ${dur.toFixed(2)} s · LOOK at the sheet: ${folhaPng}`)
}
