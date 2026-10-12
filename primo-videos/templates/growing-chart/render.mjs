#!/usr/bin/env node
// Molde growing-chart: monta e renderiza o vídeo de um ou mais gráficos (barras, colunas, linha, rosca).
//   node render.mjs <parametros.json> --out <folder> [--mode draft|final] [--formats 16x9,9x16]
//                       [--no-sound] [--no-check] [--assemble-only]
// Formatos: 16x9, 19x9, 21x9, 9x16, 1x1, 4x5. Parâmetros: TEMPLATE.md (example.json, example-split.json).
// Passos: confere os parâmetros (para antes de criar qualquer pasta, dizendo o campo e o que pôr) → monta
// <output>/.work-<name>/ (molde + assets/template/engine.js + params.js + fonts/ + media/) → trilha (arrange_series.py,
// protagonista, um acento em cada corte e um obrigatório quando o logo assenta) → checagem de quadros (frames.cjs
// --check: colisão, área segura, texto sobre imagem) → render de cada formato → finalize.mjs (duração, loudness,
// pico, já em AAC) → folha de quadros. Sai <output>/<name>-<format>[-draft].mp4 e ...-sheet.png. OLHE a folha.
// A Inter dos exemplos: rode antes node <skill>/scripts/example-fonts.mjs <output>/.work-<name> (senão as fontes
// do JSON são baixadas pelo scripts/fonts.mjs). --assemble-only só monta a obra (para frames.cjs e os testes).
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { spawnSync, execFileSync } from 'node:child_process'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import { acharPython } from '../../scripts/where.cjs'
import { aberturaDoJson, relatar } from '../../scripts/opening.mjs'

const aqui = path.dirname(fileURLToPath(import.meta.url)), skill = path.resolve(aqui, '..', '..')
const require = createRequire(import.meta.url)
const { planejar } = require(path.join(aqui, 'template', 'plan.js'))
const a = process.argv.slice(2), arg = (k, d) => { const i = a.indexOf('--' + k); return i >= 0 ? a[i + 1] : d }, tem = (k) => a.includes('--' + k)
const arq = a.find((x) => x.endsWith('.json'))
if (!arq || !arg('out')) { console.error('usage: node render.mjs <params.json> --out <folder> [--mode draft|final] [--formats 16x9,9x16] [--no-sound] [--no-check] [--assemble-only]'); process.exit(1) }
const base = path.dirname(path.resolve(arq))
const cam = (p) => path.resolve(base, String(p).replace(/^~(?=$|[\\/])/, os.homedir()))
const P = JSON.parse(fs.readFileSync(arq, 'utf8'))
const modo = arg('mode', 'draft'), saida = path.resolve(arg('out').replace(/^~(?=$|[\\/])/, os.homedir()))
if (!['draft', 'final'].includes(modo)) { console.error(`--mode ${modo}: use draft or final`); process.exit(1) }
const formatos = arg('formats', (P.formatos || ['16x9']).join(',')).split(',')
const FOLHA = { '16x9': ['480:-1', '6x4'], '19x9': ['570:-1', '6x4'], '21x9': ['630:-1', '6x4'], '9x16': ['270:-1', '8x3'], '1x1': ['360:-1', '6x4'], '4x5': ['324:-1', '6x4'] }
const fora = formatos.filter((f) => !FOLHA[f])
if (fora.length) { console.error(`format this template doesn't support: ${fora.join(', ')}. Use ${Object.keys(FOLHA).join(', ')}.`); process.exit(1) }
let plano
try { plano = planejar(P) } catch (e) { console.error(e.message); process.exit(1) }
const nome = P.nome || path.basename(arq, '.json')

// a mídia (logo, ícones) tem de existir antes de montar qualquer coisa
const midias = [P.marca.logo, P.fecho && P.fecho.logo, ...P.cenas.flatMap((c) => (c.itens || []).map((it) => it.icone))].filter(Boolean)
const faltam = midias.filter((m) => !fs.existsSync(cam(m)))
if (faltam.length) { console.error(`image not found: ${faltam.map((m) => `${m} (looked in ${cam(m)})`).join('; ')}`); process.exit(1) }

const obra = path.join(saida, `.work-${nome}`)
fs.mkdirSync(path.join(obra, 'media'), { recursive: true })
for (const f of ['index.html', 'plan.js', 'video.js', 'chart.js']) fs.copyFileSync(path.join(aqui, 'template', f), path.join(obra, f))
fs.copyFileSync(path.join(skill, 'assets', 'template', 'engine.js'), path.join(obra, 'engine.js'))
const copia = (src) => {
  const abs = cam(src), dst = `media/${path.basename(abs)}`   // o caminho que a página lê: com /, também no Windows
  fs.copyFileSync(abs, path.join(obra, dst))
  return dst
}
// PNG: largura ÷ altura no IHDR, para o logo ficar na proporção do arquivo antes de a imagem carregar
const aspecto = (rel) => { const b = fs.readFileSync(path.join(obra, rel)); return b.toString('ascii', 1, 4) === 'PNG' ? b.readUInt32BE(16) / b.readUInt32BE(20) : null }
const Q = JSON.parse(JSON.stringify(P))
if (Q.marca.logo) { Q.marca.logo = copia(Q.marca.logo); Q.marca.logoAspecto ??= aspecto(Q.marca.logo) }
Q.fecho = Q.fecho || {}
if (Q.fecho.logo) { Q.fecho.logo = copia(Q.fecho.logo); Q.fecho.logoAspecto ??= aspecto(Q.fecho.logo) }
else if (Q.marca.logoAspecto) Q.fecho.logoAspecto ??= Q.marca.logoAspecto
if (!Q.fecho.logoAspecto) { console.error('the logo is not a PNG: put "logoAspecto" (width ÷ height) in "fecho"'); process.exit(1) }
for (const c of Q.cenas) for (const it of c.itens || []) if (it.icone) it.icone = copia(it.icone)
delete Q._sobre
fs.writeFileSync(path.join(obra, 'params.js'), `// generated by render.mjs from ${path.basename(arq)}: edit the JSON, not this file\nconst PARAMS = ${JSON.stringify(Q, null, 2)}\n`)

// fontes dentro da obra (sem rede no render): a Inter dos exemplos já posta pelo example-fonts.mjs, ou o Google Fonts
const familias = [...new Set(Object.values(P.marca.fontes))]
const css = path.join(obra, 'fonts', 'fonts.css')
if (!fs.existsSync(css) || familias.some((f) => !fs.readFileSync(css, 'utf8').includes(`"${f}"`))) {
  const r = spawnSync(process.execPath, [path.join(skill, 'scripts', 'fonts.mjs'), obra, ...familias], { stdio: 'inherit' })
  if (r.status !== 0) { console.error(`the fonts did not load (${familias.join(', ')}); for the examples' Inter: node ${path.join(skill, 'scripts', 'example-fonts.mjs')} ${obra}`); process.exit(1) }
}
console.log(`plan · ${plano.dur} s · transition ${plano.transicao} · ` + plano.cenas.map((c) => `${c.tipo} ${c.t0.toFixed(2)}–${c.t1.toFixed(2)}`).join(' · ') + ` · closing ${plano.fecho.t0.toFixed(2)}–${plano.fecho.t1.toFixed(2)}`)

// trilha: a protagonista (sem voz), um acento em cada corte e um obrigatório quando o logo assenta (a música resolve ali)
let trilha = false
if (!tem('no-sound')) {
  const PY = acharPython()
  if (!PY) console.error(`WARNING: without Python with numpy and scipy, the video comes out silent. Run once: node ${path.join(skill, 'scripts', 'environment.mjs')} --fix`)
  else {
    const r3 = (x) => +x.toFixed(3)
    const folha = { titulo: `${nome} · growing chart`, duracao: plano.dur, bpm: 120, compasso: 4, taxa: 48000, saida: 'soundtrack.wav', loudness_lufs: -14.0, teto_dbtp: -1.5,
      semente: P.trilha?.semente ?? 7, silencios: [], fade: [r3(plano.dur - 0.8), plano.dur],
      secoes: plano.secoes.map((s) => ({ ...s, energia: 'media' })),
      marcos: [...plano.cenas.slice(1).map((c) => ({ t: c.t0, evento: `chart ${c.i + 1} comes in (${c.tipo})`, som: 'acento no corte', opcional: true })),
        { t: plano.fecho.logoEm, evento: 'the closing logo settles', som: 'acento', opcional: false }] }
    const ident = { versao: 2, nome: `${nome} · growing chart`, papel: 'protagonista', densidade: 'baixa', loudness_lufs: -14.0, bpm: [100, 112],
      modos: ['maior', 'mixolidio', 'dorico'], tons: ['C', 'D', 'F', 'G', 'A'],
      instrumentos: { harmonia: ['epiano', 'piano'], baixo: ['bass_note'], percussao: ['kick', 'clap', 'hat', 'shaker'], melodia: ['pluck'], textura: ['pad_note'] },
      ...(P.trilha?.identidade || {}) }
    if (!P.trilha?.identidade) console.log('soundtrack: no "trilha.identidade" in the JSON, using a neutral identity (declare the audience genre: assets/audio/API.md)')
    const dirAudio = path.join(obra, 'audio')
    fs.mkdirSync(dirAudio, { recursive: true })
    fs.rmSync(path.join(dirAudio, 'soundtrack.wav'), { force: true })
    fs.writeFileSync(path.join(dirAudio, 'sheet.json'), JSON.stringify(folha, null, 1) + '\n')
    fs.writeFileSync(path.join(dirAudio, 'identity.json'), JSON.stringify(ident, null, 2) + '\n')
    const r = spawnSync(PY, [path.join(skill, 'assets', 'audio', 'arrange_series.py'), 'identity.json', 'sheet.json'], { cwd: dirAudio, stdio: 'inherit' })
    if (r.status !== 0 || !fs.existsSync(path.join(dirAudio, 'soundtrack.wav'))) { console.error('the soundtrack was not created (see above); run with --no-sound for a silent video'); process.exit(1) }
    trilha = true
  }
}
if (tem('assemble-only')) { console.log(`build assembled: ${obra} (preview: ${path.join(obra, 'index.html')}?f=16x9&play)`); process.exit(0) }

// checagem de quadros antes do render: texto coberto, fora da área segura ou sobre imagem (ícone) reprova
let problemas = 0
if (!tem('no-check')) for (const f of formatos) {
  const r = spawnSync(process.execPath, [path.join(skill, 'scripts', 'frames.cjs'), '--project', obra, '--format', f, '--check'], { stdio: 'inherit' })
  if (r.status !== 0) { console.error(`✗ ${f}: the frame check flagged a problem (above)`); problemas++ }
}

for (const f of formatos) {
  const mudo = path.join(obra, 'out', `${f}.mp4`)
  const r = spawnSync(process.execPath, [path.join(skill, 'scripts', 'render.cjs'), '--project', obra, '--mode', modo, '--format', f, '--out', `out/${f}.mp4`, '--no-sheet'], { stdio: 'inherit' })
  if (r.status !== 0) { console.error(`✗ ${f}: render exited with ${r.status}`); process.exitCode = 1; continue }
  const final = path.join(saida, `${nome}-${f}${modo === 'final' ? '' : '-draft'}.mp4`)
  if (trilha) {   // junta e confere a entrega (duração, loudness, pico), já em AAC
    const v = spawnSync(process.execPath, [path.join(skill, 'scripts', 'finalize.mjs'), '--project', obra, '--video', mudo, '--audio', 'audio/soundtrack.wav', '--out', final], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: 180000 })
    process.stdout.write(v.stdout || ''); process.stderr.write(v.stderr || '')
    if (v.status !== 0 && !/delivery verified\./.test(v.stdout || '')) { console.error(`✗ ${f}: finalizar flagged a problem in the delivery (above)`); process.exitCode = 1 }
  } else fs.copyFileSync(mudo, final)
  if (P.aberturaLogo) {   // o logo no começo (scripts/opening.mjs), antes da folha
    try { console.log(relatar(aberturaDoJson(final, P.aberturaLogo, path.dirname(path.resolve(arq))))) } catch (e) { console.error(`✗ ${f}: ${e.message}`); process.exitCode = 1 }
  }
  const dur = +execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', final]).toString().trim()
  const [esc, grade] = FOLHA[f]
  const folha = final.replace(/\.mp4$/, '-sheet.png')
  execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', final, '-vf', `fps=24/${dur},scale=${esc},tile=${grade}`, '-frames:v', '1', folha])
  console.log(`✓ ${final} · ${dur.toFixed(2)} s · LOOK at the sheet: ${folha}`)
}
if (problemas) { console.error(`${problemas} format(s) with problems in the frame check: fix them before delivering`); process.exitCode = 4 }
