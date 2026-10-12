#!/usr/bin/env node
// Molde isometrico: blocos modelados em 3D (WebGL, câmera ortográfica isométrica, cantos arredondados, cada face numa
// cor chapada da marca) que se empilham em camadas, com o rótulo de cada uma ao lado, fora dos blocos. Com "modo":
// "aparelho", as três partes viram um aparelho (bandeja, teclas com os ícones da marca e monitor com a tela de progresso), com luz
// de estúdio suave (scene/device.js).
//   node render.mjs <parametros.json> --out <folder> [--mode draft|final] [--formats 16x9,9x16] [--no-sound]
//                       [--no-check] [--assemble-only]
// Formatos: 16x9, 19x9, 21x9, 9x16, 1x1, 4x5. Os parâmetros estão no TEMPLATE.md (exemplo: example.json).
// O caminho:
// 1. confere o JSON (scene/plan.js) e para antes de criar qualquer coisa, dizendo o que corrigir;
// 2. monta a obra em <output>/.work-<name>/ (index.html, plan.js, video.js, iso.js, o engine.js e o three.bundle.js da
//    skill, params.js, media/ com o logo, fonts/: baixa pelo scripts/fonts.mjs se o fonts.css não tiver a família);
// 3. checa cada formato no Chromium (scripts/frames.cjs --check: texto coberto, fora da área segura ou sobre um bloco);
// 4. compõe a trilha da skill (assets/audio/arrange_series.py, protagonista: o vídeo não tem voz) com os marcos do
//    plano (o baque de cada camada que pousa, um blip que sobe a cada camada nomeada, whoosh na transição, acento no
//    logo) e mede (verify.py);
// 5. renderiza (scripts/render.cjs: o WebGL na placa de vídeo, a linha "WebGL:" diz qual), junta e confere a entrega
//    (scripts/finalize.mjs) e tira a folha de quadros.
// Sai <output>/<name>-<format>[-draft].mp4 e <output>/<name>-<format>[-draft]-sheet.jpg: OLHE a folha.
// Código 1 = parâmetro errado ou falha no render; 4 = a checagem achou problema (o vídeo sai do mesmo jeito, para ver).
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { spawnSync, execFileSync } from 'node:child_process'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import { acharPython } from '../../scripts/where.cjs'
import { aberturaDoJson, relatar } from '../../scripts/opening.mjs'

const AQUI = path.dirname(fileURLToPath(import.meta.url))
const SKILL = path.resolve(AQUI, '..', '..')
const require = createRequire(import.meta.url)
const { validarIso, planejarIso } = require(path.join(AQUI, 'scene', 'plan.js'))

const argv = process.argv.slice(2)
const opt = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 ? argv[i + 1] : d }
const tem = (k) => argv.includes('--' + k)
const exp = (p) => (p && p.startsWith('~') ? path.join(os.homedir(), p.slice(1)) : p)
const arq = argv[0] && !argv[0].startsWith('--') ? path.resolve(exp(argv[0])) : null
const USO = 'usage: node render.mjs <params.json> --out <folder> [--mode draft|final] [--formats 16x9,9x16] [--no-sound] [--no-check] [--assemble-only]'
if (!arq || !opt('out')) { console.error(USO); process.exit(1) }
if (!fs.existsSync(arq)) { console.error(`parameters JSON not found: ${arq}`); process.exit(1) }
let P
try { P = JSON.parse(fs.readFileSync(arq, 'utf8')) } catch (e) { console.error(`the parameters JSON does not open (${e.message}): check commas and quotes in ${arq}`); process.exit(1) }
// escala de cada quadro e grade da folha (o 19:9 e o 21:9 com a altura do 16:9)
const FOLHA = { '16x9': ['480:-1', '6x4'], '19x9': ['570:-1', '6x4'], '21x9': ['630:-1', '6x4'], '9x16': ['270:-1', '8x3'], '1x1': ['360:-1', '6x4'], '4x5': ['324:-1', '6x4'] }
const formatos = opt('formats', (P.formatos || ['16x9']).join(',')).split(',').map((f) => f.trim())
const modo = opt('mode', 'draft')
const erros = validarIso(P)
for (const f of formatos) if (!FOLHA[f]) erros.push(`format "${f}" does not exist: use ${Object.keys(FOLHA).join(', ')}`)
  else if (P.modo === 'aparelho' && !['16x9', '19x9', '21x9'].includes(f)) erros.push(`format "${f}": the aparelho mode is horizontal only (16x9, 19x9, 21x9)`)
if (!['draft', 'final'].includes(modo)) erros.push(`--mode "${modo}" does not exist: use draft or final`)
const base = path.dirname(arq)
const origem = (src) => path.resolve(base, exp(src))
if (P.fecho && P.fecho.logo && !fs.existsSync(origem(P.fecho.logo))) erros.push(`"fecho.logo" does not exist (${P.fecho.logo}, looked in ${origem(P.fecho.logo)})`)
for (const [i, c] of (Array.isArray(P.camadas) ? P.camadas : []).entries()) for (const [j, q] of (Array.isArray(c && c.pecas) ? c.pecas : []).entries())
  if (q && typeof q.icone === 'string' && !fs.existsSync(origem(q.icone))) erros.push(`layer ${i + 1}, piece ${j + 1}: "icone" does not exist (${q.icone}, looked in ${origem(q.icone)})`)
if (erros.length) { console.error(`isometrico parameters (${path.basename(arq)}):\n  - ${erros.join('\n  - ')}`); process.exit(1) }

const nome = P.nome || path.basename(arq, '.json')
const saida = path.resolve(exp(opt('out')))
const obra = path.join(saida, `.work-${nome}`)
fs.mkdirSync(path.join(obra, 'media'), { recursive: true })

// ---------- 1. a obra ----------
for (const f of ['index.html', 'plan.js', 'video.js', 'iso.js', 'device.js']) fs.copyFileSync(path.join(AQUI, 'scene', f), path.join(obra, f))
fs.copyFileSync(path.join(SKILL, 'assets', 'template', 'engine.js'), path.join(obra, 'engine.js'))
fs.copyFileSync(path.join(SKILL, 'assets', '3d', 'three.bundle.js'), path.join(obra, 'three.bundle.js'))
const copia = (src) => {
  const abs = origem(src)
  // a pasta de cima entra no nome: o mesmo desenho em duas cores (uma pasta por cor) não se sobrescreve
  const dst = `media/${path.basename(path.dirname(abs))}-${path.basename(abs)}`   // o caminho que a página lê: com /, também no Windows
  fs.copyFileSync(abs, path.join(obra, dst))
  return dst
}
const Pobra = JSON.parse(JSON.stringify(P))
Pobra.fecho.logo = copia(P.fecho.logo)
for (const c of Pobra.camadas || []) for (const q of (Array.isArray(c.pecas) ? c.pecas : [])) if (typeof q.icone === 'string') q.icone = copia(q.icone)
const png = fs.readFileSync(path.join(obra, Pobra.fecho.logo))   // PNG: largura e altura no IHDR, para centrar o logo antes de carregar
if (png.toString('ascii', 1, 4) === 'PNG') Pobra.fecho.logoAspecto = png.readUInt32BE(16) / png.readUInt32BE(20)
else if (!Pobra.fecho.logoAspecto) { console.error('the closing logo is not a PNG: put "fecho.logoAspecto" (width ÷ height) in the JSON'); process.exit(1) }
Pobra.formatos = formatos
delete Pobra._sobre
fs.writeFileSync(path.join(obra, 'params.js'), `// generated by render.mjs from ${path.basename(arq)}: edit the JSON, not this file\nconst PARAMS = ${JSON.stringify(Pobra, null, 1)}\n`)

const css = path.join(obra, 'fonts', 'fonts.css')
if (!fs.existsSync(css) || !fs.readFileSync(css, 'utf8').includes(`"${P.marca.fonte}"`)) {
  const r = spawnSync(process.execPath, [path.join(SKILL, 'scripts', 'fonts.mjs'), obra, P.marca.fonte], { stdio: 'inherit' })
  if (r.status !== 0) { console.error(`the font did not load: ${P.marca.fonte}`); process.exit(1) }
}

// ---------- 2. o plano ----------
const plano = planejarIso(Pobra)
console.log(`isometric · ${plano.camadas.length} layers · labels on the ${{ direita: 'right', esquerda: 'left' }[plano.rotulos] || plano.rotulos}, camera ${plano.camera}, ${plano.transicao} · ${plano.dur.toFixed(2)} s`)
for (const c of plano.camadas) console.log(`  ${String(c.rotulo).padEnd(24)} comes in ${c.entra.toFixed(2)} s · lands ${c.pousa.toFixed(2)} s · named ${c.nomeia.toFixed(2)} s`)
console.log(`  closing ${plano.fecho.em.toFixed(2)} s (logo ${plano.fecho.logoEm.toFixed(2)} s) · end ${plano.dur.toFixed(2)} s`)
if (tem('assemble-only')) { console.log(`build assembled: ${obra} (index.html?f=9x16&t=4.2 shows a still instant; ?play plays it)`); process.exit(0) }

// ---------- 3. a checagem de cada formato ----------
let problemas = 0
if (!tem('no-check')) {
  for (const f of formatos) {
    const r = spawnSync(process.execPath, [path.join(SKILL, 'scripts', 'frames.cjs'), '--project', obra, '--format', f, '--check'], { stdio: 'inherit' })
    if (r.status === 4) problemas++
    else if (r.status !== 0) { console.error(`✗ the ${f} check did not run (code ${r.status})`); process.exit(1) }
  }
}

// ---------- 4. o som: a trilha da skill, protagonista, com os marcos do plano ----------
let trilha = false
if (!tem('no-sound')) {
  const PY = acharPython()
  if (!PY) console.error(`WARNING: without Python with numpy and scipy, the video comes out silent. Run once: node ${path.join(SKILL, 'scripts', 'environment.mjs')} --fix`)
  else {
    const dirAudio = path.join(obra, 'audio')
    fs.mkdirSync(dirAudio, { recursive: true })
    fs.rmSync(path.join(dirAudio, 'soundtrack.wav'), { force: true })
    const T = P.trilha || {}
    const folha = {
      titulo: `${P.marca.nome || nome} · isometric`, duracao: plano.dur, bpm: 120, compasso: 4, taxa: 48000, saida: 'soundtrack.wav',
      loudness_lufs: -14.0, teto_dbtp: -1.5, semente: T.semente ?? 7, silencios: [], fade: [+(plano.dur - 0.6).toFixed(3), plano.dur],
      secoes: plano.secoes.map((s) => ({ ...s, energia: s.nome === 'build-up' ? 'media' : 'baixa' })),
      marcos: plano.marcos,
    }
    const ident = { versao: 2, nome: `${P.marca.nome || nome} · isometric`, papel: 'protagonista', densidade: 'baixa', loudness_lufs: -14.0,
      genero: 'house', bpm: [116, 122], modos: ['maior', 'mixolidio'], tons: ['C', 'D', 'F', 'G', 'A'],
      instrumentos: { harmonia: ['epiano', 'piano'], baixo: ['bass_note'], percussao: ['kick', 'clap', 'hat', 'shaker'], melodia: ['pluck'], textura: ['pad_note'] },
      ...(T.identidade || {}) }
    if (!T.identidade) console.log('soundtrack: no "trilha.identidade" in the JSON, using a neutral identity (declare the audience genre: assets/audio/API.md)')
    fs.writeFileSync(path.join(dirAudio, 'identity.json'), JSON.stringify(ident, null, 2) + '\n')
    for (const lufs of [-14, -16]) {
      folha.loudness_lufs = lufs
      fs.writeFileSync(path.join(dirAudio, 'sheet.json'), JSON.stringify(folha, null, 1) + '\n')
      const r = spawnSync(PY, [path.join(SKILL, 'assets', 'audio', 'arrange_series.py'), 'identity.json', 'sheet.json'], { cwd: dirAudio, encoding: 'utf8' })
      fs.writeFileSync(path.join(dirAudio, 'arranjo.log'), (r.stdout || '') + (r.stderr || ''))
      if (r.status !== 0 || !fs.existsSync(path.join(dirAudio, 'soundtrack.wav'))) { console.error(`the soundtrack was not created (audio/arranjo.log):\n${(r.stderr || r.stdout || '').split('\n').slice(-12).join('\n')}\nRun with --no-sound for a silent video.`); process.exit(1) }
      const m = spawnSync(PY, [path.join(SKILL, 'assets', 'audio', 'verify.py'), 'sheet.json'], { cwd: dirAudio, encoding: 'utf8' })
      fs.writeFileSync(path.join(dirAudio, 'verifica.log'), (m.stdout || '') + (m.stderr || ''))
      if (m.status === 0) { console.log(`soundtrack: verify.py all OK at ${lufs} LUFS (marks, loudness, peak) · audio/verifica.log`); break }
      console.error(`soundtrack at ${lufs} LUFS failed verify.py (audio/verifica.log):\n${(m.stdout || '').split('\n').filter((l) => /FAILED|✗/.test(l)).join('\n')}`)
      if (lufs === -16) { console.error('WARNING: the soundtrack failed the check; read audio/verifica.log before delivering'); process.exitCode = 1 }
    }
    trilha = true
  }
}

// ---------- 5. render, entrega conferida e folha de cada formato ----------
let falhou = 0
for (const f of formatos) {
  const mudo = path.join(obra, 'out', `${f}.mp4`)
  const r = spawnSync(process.execPath, [path.join(SKILL, 'scripts', 'render.cjs'), '--project', obra, '--mode', modo, '--format', f, '--out', `out/${f}.mp4`, '--no-sheet'], { stdio: 'inherit' })
  if (r.status !== 0) { console.error(`✗ ${f}: render exited with code ${r.status}`); falhou++; continue }
  const final = path.join(saida, `${nome}-${f}${modo === 'final' ? '' : '-draft'}.mp4`)
  if (trilha) {
    const v = spawnSync(process.execPath, [path.join(SKILL, 'scripts', 'finalize.mjs'), '--project', obra, '--video', `out/${f}.mp4`, '--audio', 'audio/soundtrack.wav', '--out', final],
      { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: 180000 })
    process.stdout.write(v.stdout || ''); process.stderr.write(v.stderr || '')
    if (v.status !== 0 && !/delivery verified\./.test(v.stdout || '')) { console.error(`✗ ${f}: finalizar flagged a problem in the delivery (above)`); falhou++ }
  } else fs.copyFileSync(mudo, final)
  if (P.aberturaLogo) {   // o logo no começo (scripts/opening.mjs), antes da folha
    try { console.log(relatar(aberturaDoJson(final, P.aberturaLogo, path.dirname(path.resolve(arq))))) } catch (e) { console.error(`✗ ${f}: ${e.message}`); process.exitCode = 1 }
  }
  const dur = +execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', final]).toString().trim()
  const [escala, grade] = FOLHA[f]
  const folha = final.replace(/\.mp4$/, '-sheet.jpg')
  execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', final, '-vf', `fps=24/${dur},scale=${escala},tile=${grade}`, '-frames:v', '1', '-q:v', '4', folha])
  console.log(`✓ ${final} · ${dur.toFixed(2)} s · LOOK at the sheet: ${folha}`)
}
if (problemas) console.error(`the check found problems in ${problemas} format(s) (above): fix them before showing (code 4)`)
process.exitCode = falhou ? 1 : problemas ? 4 : process.exitCode || 0
