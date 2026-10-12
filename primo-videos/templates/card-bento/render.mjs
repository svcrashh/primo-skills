#!/usr/bin/env node
// Molde card-bento: monta e renderiza a grade bento que se monta peça a peça, com a câmera visitando cada cartão.
//   node render.mjs <parametros.json> --out <folder> [--mode draft|final] [--formats 16x9,9x16] [--no-sound] [--assemble-only]
//   (formatos: 16x9, 19x9, 21x9, 9x16, 1x1, 4x5; padrão: os do JSON, ou 16x9)
// Confere os parâmetros antes de tudo (plan.js → validar: cada erro diz o que trocar) e as imagens (logo, ícones, as do
// visual "imagens"); monta <output>/.work-<name>/ (index.html, plan.js, video.js, scene.js, o engine.js da skill,
// params.js, fonts/, media/); compõe a trilha da skill (assets/audio/arrange_series.py, papel protagonista, um acento em
// cada chegada da câmera e no logo), renderiza cada formato, junta e confere com o scripts/finalize.mjs e tira a folha
// de quadros. Sai <output>/<name>-<format>[-draft].mp4 e <…>-sheet.png: OLHE a folha.
// --assemble-only: só a obra (para a prévia, o frames.cjs e os testes). --no-sound: mudo (sem Python com numpy e scipy,
// também sai mudo, com aviso). A fonte vem de <obra>/fonts/fonts.css; sem a família, o scripts/fonts.mjs baixa.
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { spawnSync, execFileSync } from 'node:child_process'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import { acharPython } from '../../scripts/where.cjs'
import { aberturaDoJson, relatar } from '../../scripts/opening.mjs'

const AQUI = path.dirname(fileURLToPath(import.meta.url)), SKILL = path.resolve(AQUI, '..', '..')
const require = createRequire(import.meta.url)
const B = require('./plan.js')
const a = process.argv.slice(2), arg = (k, d) => { const i = a.indexOf('--' + k); return i >= 0 ? a[i + 1] : d }
const tem = (k) => a.includes('--' + k)
const USO = 'usage: node render.mjs <params.json> --out <folder> [--mode draft|final] [--formats 16x9,9x16] [--no-sound] [--assemble-only]'
const arq = a.find((x) => x.endsWith('.json'))
if (!arq || !arg('out')) { console.error(USO); process.exit(1) }
if (!fs.existsSync(arq)) { console.error(`file not found: ${arq}`); process.exit(1) }
let P
try { P = JSON.parse(fs.readFileSync(arq, 'utf8')) } catch (e) { console.error(`${arq} is not valid JSON: ${e.message}`); process.exit(1) }
const erros = B.validar(P)
if (erros.length) { console.error(`parameters with problems in ${arq}:\n${erros.map((e) => `  - ${e}`).join('\n')}`); process.exit(1) }
const modo = arg('mode', 'draft')
if (!['draft', 'final'].includes(modo)) { console.error(`--mode "${modo}": use draft or final`); process.exit(1) }
const FOLHA = { '16x9': ['480:-1', '6x4'], '19x9': ['570:-1', '6x4'], '21x9': ['630:-1', '6x4'], '9x16': ['270:-1', '8x3'], '1x1': ['360:-1', '6x4'], '4x5': ['324:-1', '6x4'] }
const formatos = arg('formats', (P.formatos || ['16x9']).join(',')).split(',')
const fora = formatos.filter((f) => !FOLHA[f])
if (fora.length) { console.error(`format this template doesn't support: ${fora.join(', ')}. Use ${Object.keys(FOLHA).join(', ')}.`); process.exit(1) }

// imagens: todo caminho do JSON é relativo ao arquivo; a que falta para tudo antes de montar
const base = path.dirname(path.resolve(arq))
const cam = (p) => path.resolve(base, String(p).replace(/^~(?=$|\/)/, os.homedir()))
const imagens = []   // [{ onde, get, set }]
const ref = (onde, obj, k) => imagens.push({ onde, src: obj[k], set: (v) => { obj[k] = v } })
if (P.fecho && P.fecho.logo) ref('fecho.logo', P.fecho, 'logo')
P.cartoes.forEach((c, i) => {
  if (c.icone) ref(`cartoes[${i}].icone`, c, 'icone')
  if (c.visual && c.visual.tipo === 'imagens') c.visual.imagens = c.visual.imagens.map((x, j) => {
    const o = typeof x === 'string' ? { src: x } : { ...x }
    ref(`cartoes[${i}].visual.imagens[${j}]`, o, 'src')
    return o
  })
})
const faltam = imagens.filter((x) => !fs.existsSync(cam(x.src)))
if (faltam.length) { console.error(`missing image:\n${faltam.map((x) => `  - ${x.onde}: ${x.src} (looked in ${cam(x.src)})`).join('\n')}`); process.exit(1) }

const nome = P.nome || path.basename(arq, '.json')
const saida = path.resolve(arg('out').replace(/^~(?=$|\/)/, os.homedir()))
const obra = path.join(saida, `.work-${nome}`)
fs.mkdirSync(path.join(obra, 'media'), { recursive: true })
for (const f of ['index.html', 'plan.js', 'video.js', 'scene.js']) fs.copyFileSync(path.join(AQUI, f), path.join(obra, f))
fs.copyFileSync(path.join(SKILL, 'assets', 'template', 'engine.js'), path.join(obra, 'engine.js'))

/** largura ÷ altura de um PNG (IHDR) ou JPEG (SOF); null se não souber */
function aspecto(arqImg) {
  const b = fs.readFileSync(arqImg)
  if (b.toString('ascii', 1, 4) === 'PNG') return b.readUInt32BE(16) / b.readUInt32BE(20)
  if (b[0] === 0xff && b[1] === 0xd8) {
    for (let i = 2; i < b.length - 9;) {
      if (b[i] !== 0xff) { i++; continue }
      const m = b[i + 1], len = b.readUInt16BE(i + 2)
      if (m >= 0xc0 && m <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(m)) return b.readUInt16BE(i + 7) / b.readUInt16BE(i + 5)
      i += 2 + len
    }
  }
  return null
}
const copiadas = new Map()
imagens.forEach((x) => {
  const abs = cam(x.src)
  if (!copiadas.has(abs)) {
    const dst = `media/${copiadas.size}-${path.basename(abs).replace(/[^\w.-]+/g, '-')}`
    fs.copyFileSync(abs, path.join(obra, dst))
    copiadas.set(abs, dst)
  }
  x.set(copiadas.get(abs))
})
if (P.fecho && P.fecho.logo) {
  const asp = aspecto(path.join(obra, P.fecho.logo)) || P.fecho.logoAspecto
  if (!asp) { console.error('fecho.logo: could not read the image size; use PNG or JPEG, or put "logoAspecto" (width ÷ height) in "fecho"'); process.exit(1) }
  P.fecho.logoAspecto = asp
}

// fontes dentro da obra (sem rede no render): a família que falta no fonts.css vem do scripts/fonts.mjs
const familias = [...new Set([P.marca.fontes.titulo.familia, (P.marca.fontes.texto || P.marca.fontes.titulo).familia])]
const css = path.join(obra, 'fonts', 'fonts.css')
if (!fs.existsSync(css) || familias.some((f) => !fs.readFileSync(css, 'utf8').includes(`"${f}"`))) {
  const r = spawnSync(process.execPath, [path.join(SKILL, 'scripts', 'fonts.mjs'), obra, ...familias], { stdio: 'inherit' })
  if (r.status !== 0) { console.error(`the fonts did not load (${familias.join(', ')}): see above`); process.exit(1) }
}
fs.writeFileSync(path.join(obra, 'params.js'), `// generated by render.mjs from ${path.basename(arq)}: edit the JSON, not this file\nconst PARAMS = ${JSON.stringify(P, null, 2)}\n`)

const plano = B.planejar(P)
const r3 = (x) => +x.toFixed(3)
const SECAO = { monta: 'assemble', visita: 'visit', recuo: 'pull back', fecho: 'closing' }
console.log(`plan · ${P.cartoes.length} cards · montagem ${plano.montagem} · camera ${(P.camera && P.camera.modo) || 'zoom'} · closing ${plano.fecho.transicao} · ${plano.dur} s`)
for (const s of plano.secoes) console.log(`  ${s.t0.toFixed(2).padStart(6)}–${s.t1.toFixed(2).padEnd(6)} ${SECAO[s.tipo] || s.tipo}${s.tipo === 'visita' ? ` ${s.i + 1} "${P.cartoes[s.i].titulo}"` : ''}`)
if (tem('assemble-only')) { console.log(`build assembled: ${obra} (preview: ${path.join(obra, 'index.html')}?f=16x9&play)`); process.exit(0) }

// trilha: a da skill, protagonista; cada chegada da câmera é um acento, e o logo do fecho, obrigatório
let trilha = false
if (!tem('no-sound')) {
  const PY = acharPython()
  if (!PY) console.error(`WARNING: without Python with numpy and scipy, the video comes out silent. Run once: node ${path.join(SKILL, 'scripts', 'environment.mjs')} --fix`)
  else {
    const T = P.trilha || {}
    const nomeSecao = (s) => (s.tipo === 'monta' ? 'opening' : s.tipo === 'visita' ? `card-${s.k + 1}` : s.tipo === 'recuo' ? 'grid' : 'closing')
    const folha = {
      titulo: `${P.marca.nome || nome} · bento grid`, duracao: plano.dur, bpm: 120, compasso: 4, taxa: 48000, saida: 'soundtrack.wav',
      loudness_lufs: -14.0, teto_dbtp: -1.5, semente: T.semente ?? 7, silencios: [], fade: [r3(plano.dur - 0.8), plano.dur],
      secoes: plano.secoes.map((s) => ({ nome: nomeSecao(s), de: r3(s.t0), ate: r3(s.t1), energia: s.tipo === 'visita' ? 'alta' : 'media' })),
      marcos: [
        ...plano.visitas.filter((v) => v.chega > 0.2).map((v) => ({ t: r3(v.chega), evento: `the camera reaches card ${v.i + 1}`, som: 'acento', opcional: true })),
        { t: r3(plano.recuo.t0 + plano.recuo.mov), evento: 'the whole grid', som: 'acento', opcional: true },
        { t: r3(plano.fecho.tLogo), evento: 'the closing logo', som: 'acento', opcional: false },
      ],
    }
    const BPM = { calmo: [96, 108], medio: [116, 122], rapido: [122, 126] }[typeof P.ritmo === 'string' ? P.ritmo : 'medio']
    const ident = { versao: 2, nome: `${P.marca.nome || nome} · bento grid`, papel: 'protagonista', densidade: 'baixa', loudness_lufs: -14.0, bpm: BPM,
      modos: ['maior', 'mixolidio'], tons: ['C', 'D', 'F', 'G', 'A'],
      instrumentos: { harmonia: ['epiano', 'piano'], baixo: ['bass_note'], percussao: ['kick', 'clap', 'hat', 'shaker'], melodia: ['pluck'], textura: ['pad_note'] },
      ...(T.identidade || {}) }
    if (!T.identidade) console.log('soundtrack: no "trilha.identidade" in the JSON, using a neutral identity (declare the audience genre: assets/audio/API.md)')
    const dirAudio = path.join(obra, 'audio')
    fs.mkdirSync(dirAudio, { recursive: true })
    fs.rmSync(path.join(dirAudio, 'soundtrack.wav'), { force: true })
    fs.writeFileSync(path.join(dirAudio, 'identity.json'), JSON.stringify(ident, null, 2) + '\n')
    for (const lufs of [-14, -16]) {   // como no rolling-list: reprovada a −14 no verify.py, recompõe a −16
      folha.loudness_lufs = lufs
      fs.writeFileSync(path.join(dirAudio, 'sheet.json'), JSON.stringify(folha, null, 1) + '\n')
      const r = spawnSync(PY, [path.join(SKILL, 'assets', 'audio', 'arrange_series.py'), 'identity.json', 'sheet.json'], { cwd: dirAudio, stdio: 'inherit' })
      if (r.status !== 0 || !fs.existsSync(path.join(dirAudio, 'soundtrack.wav'))) { console.error('the soundtrack was not created (see above); run with --no-sound for a silent video'); process.exit(1) }
      const m = spawnSync(PY, [path.join(SKILL, 'assets', 'audio', 'verify.py'), 'sheet.json'], { cwd: dirAudio, encoding: 'utf8' })
      if (m.status === 0) { console.log(`soundtrack: verify.py all OK at ${lufs} LUFS (marks, loudness, peak)`); break }
      console.error(`soundtrack at ${lufs} LUFS failed verify.py:\n${(m.stdout || '').split('\n').filter((l) => /FAILED/.test(l)).join('\n')}`)
      if (lufs === -16) { console.error('WARNING: the soundtrack failed the check; read audio/sheet.json and run verify.py by hand'); process.exitCode = 1 }
    }
    trilha = true
  }
}

for (const f of formatos) {
  const mudo = path.join(obra, 'out', `${f}.mp4`)
  const r = spawnSync(process.execPath, [path.join(SKILL, 'scripts', 'render.cjs'), '--project', obra, '--mode', modo, '--format', f, '--out', `out/${f}.mp4`, '--no-sheet'], { stdio: 'inherit' })
  if (r.status !== 0) { console.error(`✗ ${f}: render exited with code ${r.status}`); process.exitCode = 1; continue }
  const final = path.join(saida, `${nome}-${f}${modo === 'final' ? '' : '-draft'}.mp4`)
  if (trilha) {   // junta e confere a entrega (duração, loudness, pico), já em AAC
    const v = spawnSync(process.execPath, [path.join(SKILL, 'scripts', 'finalize.mjs'), '--project', obra, '--video', mudo, '--audio', 'audio/soundtrack.wav', '--out', final], { stdio: 'inherit', timeout: 180000 })
    if (v.status !== 0) { console.error(`WARNING: finalizar flagged a problem in the ${f} delivery (above)`); process.exitCode = 1 }
  } else fs.copyFileSync(mudo, final)
  if (P.aberturaLogo) {   // o logo no começo (scripts/opening.mjs), antes da folha
    try { console.log(relatar(aberturaDoJson(final, P.aberturaLogo, path.dirname(path.resolve(arq))))) } catch (e) { console.error(`✗ ${f}: ${e.message}`); process.exitCode = 1 }
  }
  const dur = +execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', final]).toString().trim()
  const [esc, grade] = FOLHA[f]
  const folhaPng = final.replace(/\.mp4$/, '-sheet.png')
  execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', final, '-vf', `fps=24/${dur},scale=${esc},tile=${grade}`, '-frames:v', '1', folhaPng])
  console.log(`✓ ${final} · ${dur.toFixed(2)} s · LOOK at the sheet: ${folhaPng}`)
}
