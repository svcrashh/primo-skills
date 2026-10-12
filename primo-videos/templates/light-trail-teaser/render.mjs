#!/usr/bin/env node
// Renderiza o light-trail-teaser de um arquivo de parâmetros: monta o projeto, faz a trilha (com a voz, se a locução já
// está em <folder>/project/voice/pt/narration.json; sem ela, a trilha é a protagonista), renderiza cada formato a 60 fps,
// junta o som e tira a folha.
//   node templates/light-trail-teaser/render.mjs meu.json ~/Desktop/teaser [16x9 9x16 19x9 21x9]
//   MODO=draft node templates/light-trail-teaser/render.mjs …     → 30 fps rápido, para olhar (PowerShell: $env:MODO='draft')
//   SUB=1 … → 60 fps sem motion blur (4× mais rápido que o padrão de 4 subquadros)
// O molde não gera voz: a locução, quando há, vem antes, do passo de voz da skill (scripts/voice.mjs generate … --out
// <folder>/project/voice/pt), com uma fala por item de "falas" do JSON (mesmo id; ela toca a partir do "em").
// O Python da trilha (numpy e scipy): o do scripts/where.cjs (o que o `node <skill>/scripts/environment.mjs --fix`
// gravou: ~/.videostudio/venv, ou $VIDEOSTUDIO_HOME/venv), senão o do sistema. PYTHON ou VIDEOSTUDIO_PYTHON forçam outro.
// Sem shell: cada programa é chamado direto, igual no Mac e no Windows.
import fs from 'node:fs'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { acharPython } from '../../scripts/where.cjs'

const M = path.dirname(fileURLToPath(import.meta.url)), SKILL = path.resolve(M, '..', '..')
const [J, S, ...resto] = process.argv.slice(2)
if (!J) { console.error('usage: node render.mjs <parametros.json> <folder> [formatos]'); process.exit(1) }
if (!S) { console.error('missing the output folder'); process.exit(1) }
const FORMATOS = resto.filter(Boolean).length ? resto.filter(Boolean) : ['16x9', '9x16'], MODO = process.env.MODO || 'final'
const existe = (p) => fs.existsSync(p)

// como o set -e do script de antes: um passo que falha encerra tudo com o código dele
const rodar = (cmd, args, opcoes = {}) => {
  const r = spawnSync(cmd, args, { stdio: 'inherit', ...opcoes })
  if (r.error) console.error(`${cmd}: ${r.error.message}`)
  return r.status ?? 1
}
const exigir = (...a) => { const s = rodar(...a); if (s !== 0) process.exit(s) }
const duracao = (v) => {
  const r = spawnSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', v], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'] })
  if (r.status !== 0) { if (r.error) console.error(`ffprobe: ${r.error.message}`); process.exit(r.status ?? 1) }
  return r.stdout.trim()
}

const PY = acharPython()
fs.mkdirSync(S, { recursive: true })
const P = path.join(S, 'project')
exigir(process.execPath, [path.join(M, 'assemble.mjs'), J, P])
const NOME = path.basename(J, path.extname(J))
let LOC = path.join(P, 'voice', 'pt', 'narration.json')
if (existe(LOC) && !existe(path.join(SKILL, 'scripts', 'tutorial', 'locucao.mjs'))) {
  console.log(`This copy of the skill has no voice module (scripts/tutorial/locucao.mjs is missing): the voiceover in ${path.join(P, 'voice', 'pt')} is ignored and the soundtrack is the lead.`)
  LOC = '-'
}
if (!existe(LOC)) LOC = '-'
const MIX = path.join(P, 'audio', 'mix.wav')
if (PY) {
  fs.mkdirSync(path.join(P, 'audio'), { recursive: true })
  exigir(PY, [path.join(M, 'soundtrack.py'), J, LOC, MIX], { env: { ...process.env, PYTHONUTF8: '1' } })
} else {
  fs.rmSync(MIX, { force: true })
  console.log(`WARNING: no Python with numpy and scipy, the video comes out silent. Run once: node ${path.join(SKILL, 'scripts', 'environment.mjs')} --fix`)
}
// escala de cada quadro e grade da folha; os quadros da folha são colunas × linhas
const FOLHA = { '16x9': ['480:-1', '6x4'], '19x9': ['480:-1', '4x6'], '21x9': ['480:-1', '4x6'], '9x16': ['270:-1', '8x3'] }
for (const F of FORMATOS) {
  const EXTRA = MODO === 'final' ? ['--sub', process.env.SUB || '4', '--crf', '16', '--preset', 'medium'] : []
  exigir(process.execPath, [path.join(SKILL, 'scripts', 'render.cjs'), '--project', P, '--mode', MODO, '--format', F, '--out', `out/${F}.mp4`, '--no-sheet', ...EXTRA])
  const V = path.join(P, 'out', `${F}.mp4`), OUT = path.join(S, `${NOME}-${F}.mp4`)
  if (existe(MIX)) exigir('ffmpeg', ['-v', 'error', '-y', '-i', V, '-i', MIX, '-map', '0:v', '-map', '1:a', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '256k', '-shortest', '-movflags', '+faststart', OUT])
  else fs.copyFileSync(V, OUT)
  if (rodar(process.execPath, [path.join(SKILL, 'scripts', 'opening.mjs'), OUT, '--json', J]) !== 0) console.log('WARNING: the logo opening flagged something above')   // o "aberturaLogo" do JSON
  const D = duracao(OUT)
  const [SC, TL] = FOLHA[F] || ['360:-1', '6x4'], [col, lin] = TL.split('x').map(Number)
  const folha = path.join(S, `sheet-${NOME}-${F}.png`)
  exigir('ffmpeg', ['-v', 'error', '-y', '-i', OUT, '-vf', `fps=${col * lin}/${D},scale=${SC},tile=${TL}`, '-frames:v', '1', folha])
  console.log(`video: ${OUT} · contact sheet: ${folha} (${D} s)`)
}
