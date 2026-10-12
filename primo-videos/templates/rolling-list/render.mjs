#!/usr/bin/env node
// Renderiza o molde rolling-list a partir de um arquivo de parâmetros (ex.: example.json).
//   node render.mjs <params.json> --out <folder> [--name lista] [--formats 16x9,9x16] [--mode final|draft]
//                   (formatos: 16x9, 19x9, 21x9, 9x16, 1x1, 4x5)
//                   [--speed rajada|lista|cartaz] [--items 1,2,3] [--script] [--no-voice] [--no-soundtrack] [--assemble-only]
// Monta <output>/<name>/ (index.html, engine.js, params.js, fonts/, media/), lê a locução que já estiver em
// <name>/voice/v1/narration.json (o molde não gera voz; --script só escreve <name>/voice/script.json e sai), compõe a
// trilha, renderiza cada formato e tira a folha de quadros. Sem locução, a trilha é a protagonista e os cortes
// continuam marcados nela. Sai <output>/<name>-<format>.mp4 e <output>/sheet-<name>-<format>.png. OLHE as folhas.
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
const { planejar } = require(path.join(AQUI, 'template', 'plan.js'))

const argv = process.argv.slice(2)
const opt = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 ? argv[i + 1] : d }
const tem = (k) => argv.includes('--' + k)
const exp = (p) => (p && p.startsWith('~') ? path.join(os.homedir(), p.slice(1)) : p)
const arqParams = argv[0] && !argv[0].startsWith('--') ? path.resolve(argv[0]) : null
if (!arqParams || !opt('out')) { console.error('usage: node render.mjs <params.json> --out <folder> [--name x] [--formats 16x9,9x16] [--mode final|draft] [--speed v] [--items 1,2,3] [--script] [--no-voice]'); process.exit(1) }

const P = JSON.parse(fs.readFileSync(arqParams, 'utf8'))
if (opt('speed')) P.velocidade = opt('speed')
if (opt('items')) {   // só alguns itens: os outros vão para o muro, para o tamanho da atualização continuar verdadeiro
  const quero = opt('items').split(',').map((n) => +n - 1)
  const fora = P.itens.filter((_, i) => !quero.includes(i)).map((it) => it.etiqueta)
  P.itens = quero.map((i) => P.itens[i])
  if (P.muro) P.muro.extras = [...fora, ...(P.muro.extras || [])]
}
const nome = opt('name', `${path.basename(arqParams, '.json')}-${P.velocidade || 'lista'}`)
const saida = path.resolve(exp(opt('out')))
const proj = path.join(saida, nome)
const modo = opt('mode', 'final')
const formatos = opt('formats', '16x9,9x16').split(',')
// escala de cada quadro e grade da folha, por formato (o 19:9 e o 21:9 guardam a altura do 16:9: 270 px)
const FOLHA = { '16x9': ['480:-1', '6x4'], '19x9': ['570:-1', '6x4'], '21x9': ['630:-1', '6x4'], '9x16': ['270:-1', '8x3'], '1x1': ['360:-1', '6x4'], '4x5': ['324:-1', '6x4'] }
const semFolha = formatos.filter((f) => !FOLHA[f])
if (semFolha.length) { console.error(`unknown format for this template: ${semFolha.join(', ')}. Use ${Object.keys(FOLHA).join(', ')}.`); process.exit(1) }
const dirParams = path.dirname(arqParams)
fs.mkdirSync(path.join(proj, 'media'), { recursive: true })

// 1. arquivos do molde + o motor da skill
for (const f of ['index.html', 'plan.js', 'video.js', 'list.js']) fs.copyFileSync(path.join(AQUI, 'template', f), path.join(proj, f))
fs.copyFileSync(path.join(SKILL, 'assets', 'template', 'engine.js'), path.join(proj, 'engine.js'))

// 2. mídia: todo caminho de imagem do JSON é copiado para media/ e reescrito
const copia = (src) => {
  const abs = path.resolve(dirParams, exp(src))
  if (!fs.existsSync(abs)) { console.error(`MISSING IMAGE: ${src} (looked in ${abs})`); process.exit(1) }
  const dst = path.join('media', path.basename(abs))
  fs.copyFileSync(abs, path.join(proj, dst))
  return dst
}
if (P.marca.logo) {
  P.marca.logo = copia(P.marca.logo)
  const b = fs.readFileSync(path.join(proj, P.marca.logo))   // PNG: largura e altura no IHDR, para centrar antes de a imagem carregar
  if (b.toString('ascii', 1, 4) === 'PNG') P.marca.logoAspecto = b.readUInt32BE(16) / b.readUInt32BE(20)
  else if (!P.marca.logoAspecto) { console.error('the logo is not a PNG: add "logoAspecto" (width ÷ height) to "marca"'); process.exit(1) }
}
for (const it of P.itens) if (it.prova && it.prova.src) it.prova.src = copia(it.prova.src)

// 3. fontes dentro do projeto (sem depender de rede no render)
const familias = [...new Set(Object.values(P.marca.fontes))]
if (!fs.existsSync(path.join(proj, 'fonts', 'fonts.css')) || familias.some((f) => !fs.readFileSync(path.join(proj, 'fonts', 'fonts.css'), 'utf8').includes(`"${f}"`))) {
  const r = spawnSync(process.execPath, [path.join(SKILL, 'scripts', 'fonts.mjs'), proj, ...familias], { stdio: 'inherit' })
  if (r.status !== 0) { console.error('the fonts did not download: see the message above'); process.exit(1) }
}

// 4. voz: o roteiro sai das falas do JSON; a locução (gerada antes, fora do molde) dá os tempos de cada palavra
const plano = planejar(P)
const legendas = {}
let falasAudio = []
const dirVoz = path.join(proj, 'voice', 'v1')
const arqLoc = path.join(dirVoz, 'narration.json')
const narra = fs.existsSync(path.join(SKILL, 'scripts', 'tutorial', 'locucao.mjs'))   // os níveis da skill com narração
const comFalas = !!(P.falas && P.falas.length) && !tem('no-voice')
if (comFalas && narra) {
  const V = P.voz || {}
  if (!V.voz || !V.voz.id) { console.error('the lines ("falas") need "voz": { "voz": { "id": … } } in the JSON (or run with --no-voice)'); process.exit(1) }
  const roteiro = { idioma: P.idioma || 'en-US', perfil: V.perfil || 'reels', voz: V.voz, ...(V.ajustes ? { ajustes: V.ajustes } : {}), pronuncia: V.pronuncia || {},
    falas: P.falas.map((f) => ({ id: f.id, onde: f.onde === 'abertura' ? 'abertura' : (f.onde === 'fecho' || f.onde === 'muro') ? 'fechamento' : { passo: (f.onde && f.onde.item) || 1 }, texto: f.texto })) }
  fs.mkdirSync(path.join(proj, 'voice'), { recursive: true })
  fs.writeFileSync(path.join(proj, 'voice', 'script.json'), JSON.stringify(roteiro, null, 2))
}
if (tem('script')) {
  if (!comFalas || !narra) { console.error(narra ? 'the JSON has no "falas": there is no voice script to write' : 'this skill has no voiceover.'); process.exit(1) }
  console.log(`script: ${path.join(proj, 'voice', 'script.json')} (the voiceover goes to ${dirVoz})`)
  process.exit(0)
}
if (comFalas && !fs.existsSync(arqLoc)) {
  // Falas no JSON e nenhuma locução neste projeto: sem aviso, o vídeo sairia sem a voz (aconteceu ao renderizar o
  // final numa --out nova, longe da voz do draft). Para, e diz como reaproveitar a voz sem gastar de novo.
  if (narra) {
    console.error(`the lines ("falas") exist but ${path.relative(process.cwd(), arqLoc)} does not: the video would come out without the voice.\n` +
      `  the script is in ${path.join(proj, 'voice', 'script.json')}: generate the voiceover in ${dirVoz} before the render (the voice step in SKILL.md),\n` +
      `  or copy the voice/ folder from the draft project to ${path.join(proj, 'voice')} (the takes in voice/_takes are not paid for again),\n` +
      `  or run with --no-voice if the video really has no voice (the soundtrack becomes the lead).`)
    process.exit(1)
  }
  console.log('this skill has no voiceover: the "falas" in the JSON become captions only, timed from the text, and the soundtrack is the lead.')
}
if (comFalas && fs.existsSync(arqLoc)) {
  if (!narra) { console.error(`this video has a voiceover (${arqLoc}), but this skill has no voiceover. Run with --no-voice to output with the soundtrack only`); process.exit(1) }
  const loc = JSON.parse(fs.readFileSync(arqLoc, 'utf8'))
  for (const f of plano.falas) {
    const lf = loc.falas.find((x) => x.id === f.id)
    if (!lf) continue
    legendas[f.id] = lf.palavras.map((w) => ({ texto: w.texto, ini: w.ini, fim: w.fim }))
    const fim = f.em + lf.duracao
    const prox = plano.falas.find((g) => g.em > f.em)
    if (fim > plano.dur - 0.2) { console.error(`LINE "${f.id}" DOES NOT FIT: it ends at ${fim.toFixed(2)} s and the video is ${plano.dur} s long. Shorten the sentence or lengthen the wall/closing in "ritmo".`); process.exit(1) }
    if (prox && fim > prox.em - 0.1) { console.error(`LINE "${f.id}" RUNS INTO "${prox.id}": it ends at ${fim.toFixed(2)} s, the next one starts at ${prox.em} s.`); process.exit(1) }
    const iv = lf.inicio_voz || 0
    falasAudio.push({ arq: path.join(dirVoz, lf.arquivo), em: f.em, dur: lf.duracao, id: f.id, texto: lf.texto, som: f.em + iv, fim: f.em + lf.palavras[lf.palavras.length - 1].fim })
  }
}
fs.writeFileSync(path.join(proj, 'params.js'), `// generated by render.mjs from ${path.basename(arqParams)}\nconst PARAMS = ${JSON.stringify({ ...P, legendas }, null, 2)}\n`)
const voz = plano.falas.reduce((a, f) => a + (falasAudio.find((x) => x.em === f.em)?.dur || 0), 0)
console.log(`plan · ${plano.velocidade} · ${P.itens.length} items · ${plano.dur} s · voice ${voz.toFixed(1)} s (${Math.round((voz / plano.dur) * 100)}% of the time)`)
for (const s of plano.secoes) console.log(`  ${s.t0.toFixed(2).padStart(6)}–${s.t1.toFixed(2).padEnd(6)} ${s.tipo}${s.i != null ? ' ' + (s.i + 1) : ''}`)

// 5. áudio: trilha original da skill (arrange_series.py), com um acento em cada corte de trecho. Com locução, a folha
// leva o bloco "voz" e a trilha cede à fala (Contrato M); sem locução, a folha não tem "voz" e a trilha é a
// protagonista. Sem Python com numpy/scipy (ou com --no-soundtrack): só a voz, normalizada em -16 LUFS, ou mudo.
let wav = null, comTrilha = false
const PY = tem('no-soundtrack') ? null : acharPython()
if (!tem('no-soundtrack') && !PY) console.error(`WARNING: no Python with numpy and scipy, the video comes out ${falasAudio.length ? 'with the voice only, no soundtrack' : 'silent'}. Run once: node ${path.join(SKILL, 'scripts', 'environment.mjs')} --fix`)
if (!tem('no-soundtrack') && PY) {
  const dirAudio = path.join(proj, 'audio')
  fs.mkdirSync(dirAudio, { recursive: true })
  for (const f of ['soundtrack.wav', 'final.wav']) fs.rmSync(path.join(dirAudio, f), { force: true })
  const { escreverVozWav, blocoFolha, srt } = falasAudio.length ? await import(path.join(SKILL, 'scripts', 'tutorial', 'locucao.mjs')) : {}
  const falas = falasAudio.map((f) => ({ id: f.id, texto: f.texto, caminho: f.arq, inicioArquivo: f.em, som: +f.som.toFixed(3), fim: +f.fim.toFixed(3) }))
  if (falas.length) escreverVozWav(falas, plano.dur, path.join(dirAudio, 'voz.wav'))
  const T = P.trilha || {}
  const rajada = plano.velocidade === 'rajada'
  const nomeSecao = (s) => (s.tipo === 'fecho' ? 'fechamento' : s.tipo === 'item' ? `item-${s.i + 1}` : s.tipo)
  const folha = {
    titulo: `${P.marca.nome} · running list (${plano.velocidade})`, duracao: plano.dur, bpm: 120, compasso: 4, taxa: 48000, saida: 'soundtrack.wav',
    loudness_lufs: -14.0, teto_dbtp: -1.5, semente: T.semente ?? P.semente ?? 7, silencios: [], fade: [+Math.min(plano.dur - 0.2, Math.max(plano.dur - 0.8, falas.length ? falas[falas.length - 1].fim + 0.05 : 0)).toFixed(3), plano.dur],   // o fade não come a última palavra
    secoes: plano.secoes.map((s) => ({ nome: nomeSecao(s), de: s.t0, ate: s.t1, energia: s.tipo === 'abertura' || s.tipo === 'fecho' ? 'media' : rajada || s.tipo === 'muro' ? 'alta' : 'media' })),
    // cada corte (entra item, muro, fecho) é um acento musical na amostra exata; na rajada ele é obrigatório (a batida do corte)
    marcos: plano.secoes.slice(1).map((s) => ({ t: s.t0, evento: `enters ${nomeSecao(s)}`, som: 'acento no corte', opcional: !rajada })),
    ...(falas.length ? { voz: blocoFolha(falas, (P.voz && P.voz.perfil) || 'reels') } : {}),
  }
  const BPM = { rajada: [118, 128], lista: [100, 112], cartaz: [88, 100] }[plano.velocidade]
  const ident = { versao: 2, nome: `${P.marca.nome} · running list`, papel: falas.length ? 'fundo' : 'protagonista', densidade: 'baixa', loudness_lufs: -14.0,
    bpm: BPM, modos: ['maior', 'mixolidio', 'dorico'], tons: ['C', 'D', 'F', 'G', 'A'],
    instrumentos: { harmonia: ['epiano', 'piano'], baixo: ['bass_note'], percussao: ['kick', 'clap', 'hat', 'shaker'], melodia: ['pluck'], textura: ['pad_note'] },
    ...(T.identidade || {}) }
  if (!T.identidade) console.log('soundtrack: no "trilha.identidade" in the JSON, using a neutral identity (declare the audience\'s music genre: assets/audio/API.md)')
  fs.writeFileSync(path.join(dirAudio, 'identity.json'), JSON.stringify(ident, null, 2) + '\n')
  if (falas.length) fs.writeFileSync(path.join(proj, 'legenda.srt'), srt(falas))
  // compõe e mede (verify.py). A −14 LUFS, com pouca voz e cama esparsa, o limiter do master chega a 7 dB e
  // aperta uma fala mais que a outra (medido numa rajada com falas): aí recompõe a −16, o nível que o molde já usava.
  for (const lufs of [-14, -16]) {
    folha.loudness_lufs = lufs
    fs.writeFileSync(path.join(dirAudio, 'sheet.json'), JSON.stringify(folha, null, 1) + '\n')
    const r = spawnSync(PY, [path.join(SKILL, 'assets', 'audio', 'arrange_series.py'), 'identity.json', 'sheet.json'], { cwd: dirAudio, stdio: 'inherit' })
    if (r.status !== 0 || !fs.existsSync(path.join(dirAudio, 'soundtrack.wav'))) { console.error(`the soundtrack did not come out (see above); run with --no-soundtrack to output ${falas.length ? 'with the voice only' : 'a silent video'}`); process.exit(1) }
    const m = spawnSync(PY, [path.join(SKILL, 'assets', 'audio', 'verify.py'), 'sheet.json'], { cwd: dirAudio, encoding: 'utf8' })
    const falhas = (m.stdout || '').split('\n').filter((l) => /FAILED/.test(l))
    if (m.status === 0) { console.log(`soundtrack: verify.py all OK at ${lufs} LUFS (markers, voice above the soundtrack, loudness, peak)`); break }
    console.error(`soundtrack at ${lufs} LUFS failed verify.py:\n${falhas.join('\n')}`)
    if (lufs === -16) { console.error('WARNING: the soundtrack failed the check; read audio/sheet.json and run verify.py by hand'); process.exitCode = 1 }
  }
  wav = path.join(dirAudio, 'soundtrack.wav')
  comTrilha = true
}
if (falasAudio.length && !comTrilha) {
  wav = path.join(proj, 'audio', 'final.wav')
  fs.mkdirSync(path.dirname(wav), { recursive: true })
  const ins = falasAudio.flatMap((f) => ['-i', f.arq])
  const atrasos = falasAudio.map((f, i) => `[${i}:a]aresample=48000,aformat=channel_layouts=stereo,adelay=${Math.round(f.em * 1000)}:all=1[a${i}]`).join(';')
  const mix = `${atrasos};${falasAudio.map((_, i) => `[a${i}]`).join('')}amix=inputs=${falasAudio.length}:normalize=0,apad,atrim=0:${plano.dur},loudnorm=I=-16:TP=-1.5:LRA=11,aresample=48000[o]`
  execFileSync('ffmpeg', ['-v', 'error', '-y', ...ins, '-filter_complex', mix, '-map', '[o]', '-ar', '48000', wav])
}
if (tem('assemble-only')) process.exit(0)

// 6. render de cada formato + folha de quadros
let falhou = 0
for (const f of formatos) {
  const r = spawnSync(process.execPath, [path.join(SKILL, 'scripts', 'render.cjs'), '--project', proj, '--mode', modo, '--format', f, '--out', `out/${f}.mp4`, '--no-sheet', ...(opt('sub') ? ['--sub', opt('sub')] : [])], { stdio: 'inherit' })
  if (r.status !== 0) { console.error(`✗ ${f}: the render exited with code ${r.status}`); falhou++; continue }
  const mp4 = path.join(proj, 'out', `${f}.mp4`), final = path.join(saida, `${nome}-${f}.mp4`)
  if (comTrilha) {   // junta e confere a entrega: duração, loudness, pico, e cada fala no tempo e acima da trilha, já em AAC
    // timeout: já vi o node travar no process.exit do finalizar (depois de imprimir o resultado), uma vez em três
    const v = spawnSync(process.execPath, [path.join(SKILL, 'scripts', 'finalize.mjs'), '--project', proj, '--video', `out/${f}.mp4`, '--audio', 'audio/soundtrack.wav', '--out', final],
      { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: 180000 })
    process.stdout.write(v.stdout || ''); process.stderr.write(v.stderr || '')
    if (v.status !== 0 && !/delivery verified\./.test(v.stdout || '')) { console.error(`✗ ${f}: finalizar flagged a problem in the delivery (above)`); falhou++ }
  } else if (wav) execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', mp4, '-i', wav, '-map', '0:v', '-map', '1:a', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '256k', '-shortest', '-movflags', '+faststart', final])
  else fs.copyFileSync(mp4, final)
  if (P.aberturaLogo) {   // o logo no começo (scripts/opening.mjs), antes da folha
    try { console.log(relatar(aberturaDoJson(final, P.aberturaLogo, path.dirname(arqParams)))) } catch (e) { console.error(`✗ ${f}: ${e.message}`); falhou++ }
  }
  const dur = +execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', final]).toString().trim()
  const [escala, grade] = FOLHA[f]
  const folha = path.join(saida, `sheet-${nome}-${f}.png`)
  execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', final, '-vf', `fps=24/${dur},scale=${escala},tile=${grade}`, '-frames:v', '1', folha])
  console.log(`✓ ${nome} ${f} · ${dur.toFixed(2)} s · LOOK at the sheet: ${folha}`)
}
process.exitCode = falhou ? 1 : process.exitCode || 0
