#!/usr/bin/env node
// Do parâmetro ao vídeo entregue, com trilha (e a voz, se a locução já existe), num formato ou em vários.
//   node templates/counting-number/render.mjs <parametros.json> <video-folder> [formatos] [draft|final]
//   ex.: node render.mjs example.json ~/Desktop/numeros 16x9,9x16 final
// Passos: preparar (com falas, escreve voice/script.json para o passo de voz da skill) → preparar com a locução, se
// <folder>/voice/pt/narration.json existe → trilha (arranjo_serie: com o bloco voz, cede à fala; sem ele, é a
// protagonista) → render de cada formato → finalizar (confere a entrega) → folha de quadros.
// O molde não gera voz: com falas e sem locução ele para e diz o que fazer. SEM_VOZ=1 sai só com a trilha.
// O Python da trilha (numpy e scipy): o do scripts/where.cjs (o que o `node <skill>/scripts/environment.mjs --fix`
// gravou: ~/.videostudio/venv, ou $VIDEOSTUDIO_HOME/venv), senão o do sistema. PYTHON ou VIDEOSTUDIO_PYTHON forçam outro.
// Sem shell: cada programa é chamado direto, igual no Mac e no Windows.
import fs from 'node:fs'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { acharPython } from '../../scripts/where.cjs'

const M = path.dirname(fileURLToPath(import.meta.url)), SKILL = path.resolve(M, '..', '..'), S = path.join(SKILL, 'scripts')
const [a1, a2, a3, a4] = process.argv.slice(2)
const PJ = path.resolve(a1 || ''), D = path.resolve(a2 || ''), FMTS = a3 || '16x9,9x16', MODO = a4 || 'final'
const existe = (p) => fs.existsSync(p)
if (!fs.statSync(PJ, { throwIfNoEntry: false })?.isFile() || !a2) { console.log('usage: node render.mjs <parametros.json> <video-folder> [16x9,9x16] [draft|final]'); process.exit(1) }

// como o set -e do script de antes: um passo que falha encerra tudo com o código dele
const rodar = (cmd, args, opcoes = {}) => {
  const r = spawnSync(cmd, args, { stdio: 'inherit', ...opcoes })
  if (r.error) console.error(`${cmd}: ${r.error.message}`)
  return r.status ?? 1
}
const exigir = (...a) => { const s = rodar(...a); if (s !== 0) process.exit(s) }
const node = (script, ...args) => exigir(process.execPath, [script, ...args])
const duracao = (v) => {
  const r = spawnSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', v], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'] })
  if (r.status !== 0) { if (r.error) console.error(`ffprobe: ${r.error.message}`); process.exit(r.status ?? 1) }
  return r.stdout.trim()
}

node(path.join(M, 'prepare.mjs'), PJ, D)
const LOC = path.join(D, 'voice', 'pt', 'narration.json')
const comVoz = !process.env.SEM_VOZ && existe(LOC)
if (comVoz) node(path.join(M, 'prepare.mjs'), PJ, D, '--narration', LOC)
else if (!process.env.SEM_VOZ && existe(path.join(D, 'voice', 'script.json'))) {
  console.log(`the lines (falas) exist, but ${LOC} does not: generate the voiceover from ${path.join(D, 'voice', 'script.json')} in ${path.join(D, 'voice', 'pt')} before the render (the voice step in SKILL.md), or run with SEM_VOZ=1 to output with the soundtrack only`)
  process.exit(1)
}
fs.rmSync(path.join(D, 'audio', 'soundtrack.wav'), { force: true })
const PY = acharPython()
if (PY) exigir(PY, [path.join(SKILL, 'assets', 'audio', 'arrange_series.py'), 'identity.json', 'sheet.json'], { cwd: path.join(D, 'audio'), env: { ...process.env, PYTHONUTF8: '1' } })
else if (comVoz) {   // com voz não sai mudo: para
  console.error(`no Python with numpy and scipy: the voiceover needs the soundtrack step. Run once: node ${path.join(S, 'environment.mjs')} --fix`)
  process.exit(1)
} else console.log(`WARNING: no Python with numpy and scipy, the video comes out silent. Run once: node ${path.join(S, 'environment.mjs')} --fix`)

// escala de cada quadro e grade da folha (o 19:9 e o 21:9 com a altura do 16:9)
const FOLHA = { '16x9': ['480:-1', '6x4'], '19x9': ['570:-1', '6x4'], '21x9': ['630:-1', '6x4'], '9x16': ['270:-1', '8x3'] }
const NOME = path.basename(D)
fs.mkdirSync(path.join(D, 'delivery'), { recursive: true })
for (const F of FMTS.split(',').filter(Boolean)) {
  const EXTRA = MODO === 'final' ? ['--sub', '4', '--crf', '16', '--preset', 'medium'] : []
  node(path.join(S, 'render.cjs'), '--project', D, '--mode', MODO, '--format', F, '--out', `out/${F}.mp4`, '--no-sheet', ...EXTRA)
  const [SC, TL] = FOLHA[F] || ['360:-1', '6x4']
  let V = path.join(D, 'out', `${F}.mp4`)
  if (existe(path.join(D, 'audio', 'soundtrack.wav'))) {
    const entrega = path.join(D, 'delivery', `${NOME}-${F}.mp4`)
    if (rodar(process.execPath, [path.join(S, 'finalize.mjs'), '--project', D, '--video', `out/${F}.mp4`, '--audio', 'audio/soundtrack.wav', '--out', entrega]) !== 0) console.log('WARNING: finalizar flagged something above')
    V = entrega
  }
  if (rodar(process.execPath, [path.join(S, 'opening.mjs'), V, '--json', PJ]) !== 0) console.log('WARNING: the logo opening flagged something above')   // o "aberturaLogo" do JSON
  const DUR = duracao(V), folha = path.join(D, 'delivery', `sheet-${F}.png`)
  exigir('ffmpeg', ['-v', 'error', '-y', '-i', V, '-vf', `fps=24/${DUR},scale=${SC},tile=${TL}`, '-frames:v', '1', folha])
  console.log(`✓ ${V}  ·  contact sheet: ${folha}`)
}
