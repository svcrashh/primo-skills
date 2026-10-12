#!/usr/bin/env node
// Renderiza o molde "texto que se digita" a partir de um arquivo de parâmetros.
//   node render.mjs <parametros.json> --out <folder> [--formats 16x9,9x16,1x1] [--mode final|draft] [--no-sound] [--no-soundtrack] [-- <opções do render.cjs, ex. --sub 4>]
// Sai em <folder>/<name>-<format>.mp4 e <folder>/<name>-<format>-sheet.png. Com voz (trechos de uma locução já
// gerada, fora do molde): voz, teclas e efeitos. Sem voz: a trilha da skill como protagonista, com as teclas e os
// efeitos da cena marcados nela (--no-soundtrack: só as teclas e os efeitos).
// A obra (cena montada, para prévia no navegador) fica em <folder>/.work-<name>/index.html?f=9x16&t=3.
// Som: precisa de um Python com numpy e scipy (o do scripts/where.cjs: o que o environment.mjs --fix gravou).
import fs from 'node:fs'
import path from 'node:path'
import { spawnSync, execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { acharPython } from '../../scripts/where.cjs'
import { createRequire } from 'node:module'
import { aberturaDoJson, relatar } from '../../scripts/opening.mjs'

const aqui = path.dirname(fileURLToPath(import.meta.url))
const skill = path.resolve(aqui, '..', '..')
const todos = process.argv.slice(2), corte = todos.indexOf('--')
const args = corte >= 0 ? todos.slice(0, corte) : todos, extra = corte >= 0 ? todos.slice(corte + 1) : []
const opt = (k, d) => { const i = args.indexOf('--' + k); return i >= 0 ? args[i + 1] : d }
const arq = args.find((a, i) => !a.startsWith('--') && !(i > 0 && args[i - 1].startsWith('--') && !['--no-sound', '--no-soundtrack'].includes(args[i - 1])))
if (!arq || !opt('out')) { console.error('usage: node render.mjs <parametros.json> --out <folder> [--formats 16x9,9x16] [--mode final|draft] [--no-sound] [--no-soundtrack]'); process.exit(1) }
const base = path.dirname(path.resolve(arq))
const P = JSON.parse(fs.readFileSync(arq, 'utf8'))
const saida = path.resolve(opt('out')), modo = opt('mode', 'final')
const nome = P.nome || path.basename(arq, '.json')
const formatos = opt('formats', (P.formatos || ['16x9', '9x16']).join(',')).split(',')
const obra = path.join(saida, `.work-${nome}`)
fs.mkdirSync(path.join(obra, 'media'), { recursive: true })

// 1. a cena: index, molde, motor da skill
for (const f of ['index.html', 'template.js']) fs.copyFileSync(path.join(aqui, 'scene', f), path.join(obra, f))
fs.copyFileSync(path.join(skill, 'assets', 'template', 'engine.js'), path.join(obra, 'engine.js'))
if (P.marca.logo?.arquivo) fs.copyFileSync(path.resolve(base, P.marca.logo.arquivo_origem || P.marca.logo.arquivo), path.join(obra, 'media', P.marca.logo.arquivo))

// 2. a voz: trechos de falas já geradas (a narration.json), com os tempos de cada palavra para a legenda
const falas = []
const narra = fs.existsSync(path.join(skill, 'scripts', 'tutorial', 'locucao.mjs'))   // os níveis da skill com narração
const semLocucao = (P.voz?.trechos || []).map((tr) => path.resolve(base, tr.locucao || P.voz.locucao)).filter((a) => !fs.existsSync(a))
if (semLocucao.length && narra) { console.error(`could not find the voiceover ${semLocucao[0]}: generate the voice before the render (the voice step in SKILL.md), or remove "voz" from the JSON to output with the soundtrack`); process.exit(1) }
if (semLocucao.length) console.log('this skill has no voiceover: the voice excerpts in the JSON are left out and the soundtrack is the lead.')
for (const tr of semLocucao.length ? [] : P.voz?.trechos || []) {
  const locArq = path.resolve(base, tr.locucao || P.voz.locucao)
  const loc = JSON.parse(fs.readFileSync(locArq, 'utf8'))
  const f = loc.falas.find((x) => x.id === tr.fala)
  if (!f) throw new Error(`line ${tr.fala} is not in ${locArq}`)
  const de = tr.de ?? 0, ate = tr.ate ?? f.palavras.at(-1).fim + 0.05
  const ps = f.palavras.filter((p) => p.ini >= de - 0.01 && p.fim <= ate + 0.01).map((p) => ({ texto: p.texto, ini: +(p.ini - de).toFixed(3), fim: +(p.fim - de).toFixed(3) }))
  falas.push({ em: tr.em, texto: ps.map((p) => p.texto).join(' '), palavras: ps, wav: path.resolve(path.dirname(locArq), f.arquivo), de, ate })
}
const total = P.cenas.reduce((s, c) => s + c.dur, 0)
for (const f of falas) if (f.em + (f.ate - f.de) > total - 0.3) throw new Error(`the line "${f.texto}" runs past the end of the video (${total} s): move "em" earlier or lengthen a block`)
const fontes = [...new Set([P.marca.fontes.titulo, P.marca.fontes.texto, P.marca.fontes.mono].filter(Boolean))]
const VIDEO = { titulo: nome, duracao: +total.toFixed(3), formatos, plataforma: P.plataforma || null, fontes, fundo: P.marca.cores.fundo, grao: P.grao ?? 0.03, impactos: [], selo: null }
fs.writeFileSync(path.join(obra, 'params.js'), `const PARAMS = ${JSON.stringify({ ...P, falas: falas.map(({ wav, de, ate, ...f }) => f) }, null, 1)}\nconst VIDEO = ${JSON.stringify(VIDEO)}\n`)

// 3. fontes dentro da obra (sem rede no render)
if (!fs.existsSync(path.join(obra, 'fonts', 'fonts.css')) || fontes.some((f) => !fs.readFileSync(path.join(obra, 'fonts', 'fonts.css'), 'utf8').includes(`"${f}"`))) {
  const r = spawnSync(process.execPath, [path.join(skill, 'scripts', 'fonts.mjs'), obra, ...fontes], { stdio: 'inherit' })
  if (r.status !== 0) { console.error('the fonts did not download: ' + fontes.join(', ')); process.exit(1) }
}

// 4. os sons que a cena marcou (teclas, cliques, whoosh, sucesso)
const require = createRequire(import.meta.url)
const { abrirNavegador } = require(path.join(skill, 'scripts', 'playwright.cjs'))
const { browser } = await abrirNavegador(obra)
const pg = await browser.newPage()
const erros = []
pg.on('console', (m) => { if (m.type() === 'error') erros.push(m.text()) })
pg.on('pageerror', (e) => erros.push(e.message))
await pg.goto('file://' + path.join(obra, 'index.html') + `?f=${formatos[0]}`)
await pg.waitForFunction('window.__ready === true', null, { timeout: 60000 }).catch(() => {})
const sons = await pg.evaluate(() => window.SONS || [])
await browser.close()
if (erros.length) { console.error('SCENE ERROR:\n' + erros.join('\n')); process.exit(3) }

// 5. o som: com voz, voz + efeitos, voz por cima (mix.py); sem voz, a trilha da skill (arrange_series.py) como
// protagonista, com os sons da cena como marcos dela (sem o bloco "voz" na folha)
let wav = null, trilha = false
if (!args.includes('--no-sound')) {
  const py = acharPython()
  if (!py) console.error(`warning: no Python with numpy and scipy, the video comes out silent. Run once: node ${path.join(skill, 'scripts', 'environment.mjs')} --fix`)
  else if (!falas.length && !args.includes('--no-soundtrack')) {
    const r3 = (x) => +x.toFixed(3)
    const inicios = P.cenas.reduce((a, c) => [...a, a[a.length - 1] + c.dur], [0])
    const ultima = P.cenas.length - 1
    // a música resolve quando o logo entra (o whoosh "medio" do fecho); abre até o 1º pedido começar a se escrever
    const tLogo = P.cenas[ultima].tipo === 'fecho' ? sons.filter((x) => x.som === 'whoosh' && x.t >= inicios[ultima]).at(-1)?.t : null
    const tFecho = tLogo ?? inicios[ultima]
    const tAbre = Math.min(P.cenas[0].em ?? 1.0, P.cenas[0].dur, tFecho - 1)
    const secoes = [{ nome: 'abertura', de: 0, ate: r3(tAbre), energia: 'media' },
      ...P.cenas.map((c, i) => ({ nome: `${c.tipo}-${i + 1}`, de: r3(Math.max(tAbre, inicios[i])), ate: r3(Math.min(tFecho, inicios[i + 1])), energia: 'media' })).filter((x) => x.ate - x.de > 0.05),
      { nome: 'fechamento', de: r3(tFecho), ate: +total.toFixed(3), energia: 'media' }]
    const PARAMS_SOM = ['dur', 'variante', 'teclado', 'teclas', 'enter', 'direcao', 'soltar', 'notas']
    const marcos = sons.map((x) => ({ t: r3(Math.max(0, x.t)), evento: x.som, som: x.som, ...(x.som === 'acento' ? {} : { efeito: x.som }),
      ...Object.fromEntries(PARAMS_SOM.filter((k) => k in x).map((k) => [k, x[k]])), opcional: x.som === 'whoosh' || x.som === 'acento' })).sort((a, b) => a.t - b.t)
    const folha = { titulo: `${nome} · self-typing text`, duracao: +total.toFixed(3), bpm: 120, compasso: 4, taxa: 48000, saida: 'soundtrack.wav', loudness_lufs: -14.0, teto_dbtp: -1.5,
      semente: P.trilha?.semente ?? 7, silencios: [], fade: [r3(total - 0.8), +total.toFixed(3)], secoes, marcos }
    const ident = { versao: 2, nome: `${P.marca.nome} · self-typing text`, papel: 'protagonista', densidade: 'baixa', loudness_lufs: -14.0, bpm: [100, 112],
      modos: ['maior', 'mixolidio', 'dorico'], tons: ['C', 'D', 'F', 'G', 'A'],
      instrumentos: { harmonia: ['epiano', 'piano'], baixo: ['bass_note'], percussao: ['kick', 'clap', 'hat', 'shaker'], melodia: ['pluck'], textura: ['pad_note'] },
      ...(P.trilha?.identidade || {}) }
    if (!P.trilha?.identidade) console.log('soundtrack: no "trilha.identidade" in the JSON, using a neutral identity (declare the audience\'s music genre: assets/audio/API.md)')
    const dirAudio = path.join(obra, 'audio')
    fs.mkdirSync(dirAudio, { recursive: true })
    fs.rmSync(path.join(dirAudio, 'soundtrack.wav'), { force: true })
    fs.writeFileSync(path.join(dirAudio, 'sheet.json'), JSON.stringify(folha, null, 1) + '\n')
    fs.writeFileSync(path.join(dirAudio, 'identity.json'), JSON.stringify(ident, null, 2) + '\n')
    const r = spawnSync(py, [path.join(skill, 'assets', 'audio', 'arrange_series.py'), 'identity.json', 'sheet.json'], { cwd: dirAudio, stdio: 'inherit' })
    if (r.status !== 0 || !fs.existsSync(path.join(dirAudio, 'soundtrack.wav'))) { console.error('the soundtrack did not come out (see above); run with --no-soundtrack to output with only the keys and the effects'); process.exit(1) }
    wav = path.join(dirAudio, 'soundtrack.wav'); trilha = true
  } else {
    wav = path.join(obra, 'som.wav')
    fs.writeFileSync(path.join(obra, 'som.json'), JSON.stringify({ duracao: total, sons, falas: falas.map(({ wav, de, ate, em }) => ({ wav, de, ate, em })), saida: wav, audio: path.join(skill, 'assets', 'audio') }, null, 1))
    const r = spawnSync(py, [path.join(aqui, 'mix.py'), path.join(obra, 'som.json')], { stdio: 'inherit' })
    if (r.status !== 0) { console.error('the sound failed: the video comes out silent'); wav = null }
  }
}

// 6. render por formato, som junto, folha de quadros
for (const f of formatos) {
  const r = spawnSync(process.execPath, [path.join(skill, 'scripts', 'render.cjs'), '--project', obra, '--mode', modo, '--format', f, '--out', `out/${f}.mp4`, '--no-sheet', ...extra], { stdio: 'inherit' })
  if (r.status !== 0) { console.error(`✗ ${f}: render exited with ${r.status}`); process.exitCode = 1; continue }
  const mudo = path.join(obra, 'out', `${f}.mp4`), final = path.join(saida, `${nome}-${f}.mp4`)
  if (trilha) {   // junta e confere a entrega (duração, loudness, pico), já em AAC
    const v = spawnSync(process.execPath, [path.join(skill, 'scripts', 'finalize.mjs'), '--project', obra, '--video', mudo, '--audio', 'audio/soundtrack.wav', '--out', final], { stdio: 'inherit', timeout: 180000 })
    if (v.status !== 0) console.error(`WARNING: finalizar flagged something in the ${f} delivery (above)`)
  } else if (wav) execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', mudo, '-i', wav, '-map', '0:v', '-map', '1:a', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k', '-shortest', final])
  else fs.copyFileSync(mudo, final)
  if (P.aberturaLogo) {   // o logo no começo (scripts/opening.mjs), antes da folha
    try { console.log(relatar(aberturaDoJson(final, P.aberturaLogo, path.dirname(path.resolve(arq))))) } catch (e) { console.error(`✗ ${f}: ${e.message}`); process.exitCode = 1 }
  }
  const dur = +execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', final]).toString().trim()
  const [esc, grade] = f === '9x16' ? ['270:-1', '8x3'] : f === '1x1' ? ['360:-1', '6x4'] : ['480:-1', '6x4']
  const folha = path.join(saida, `${nome}-${f}-sheet.png`)
  execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', final, '-vf', `fps=24/${dur},scale=${esc},tile=${grade}`, '-frames:v', '1', folha])
  console.log(`✓ ${final} · ${dur.toFixed(2)} s · LOOK at the sheet: ${folha}`)
}
