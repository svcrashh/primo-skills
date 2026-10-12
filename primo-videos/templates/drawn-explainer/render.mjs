#!/usr/bin/env node
// Renderiza o molde "explicação desenhada" a partir de um video.json (marca, cenas, voz, trilha) e de um scenes.js.
//   node render.mjs <video.json> --out <folder> [--formats 16x9,19x9,21x9,9x16,4x5,1x1] [--mode draft|final]
//        [--no-voice] [--no-sound] [--from s --to s] [--check-only] [-- <opções do render.cjs, ex. --sub 4 --workers 6>]
// Sai <output>/<name>-<format>.mp4 e <output>/<name>-<format>-sheet.jpg (OLHE a folha). A obra montada fica em
// <output>/.work-<name>/: index.html?f=9x16&t=4.2 mostra um instante parado; ?play toca sem som.
// Motor portado do explainroo (MIT, © 2026 Vincent Schmalbach): LICENSE-explainroo.txt nesta pasta.
//
// O caminho:
// 1. monta a obra: o motor (scene/engine), rough.js e Lucide vendorizados, o scenes.js, as fontes da marca
//    (scripts/fonts.mjs) e a mídia embutida (nada de rede nem de CDN no render);
// 2. a linha do tempo: com voz, cada cena dura a fala dela no narration.json mais o respiro; sem voz (com --no-voice, sem
//    "voz" no JSON, ou no pacote da skill sem narração), cada cena dura o `min` ou o tempo de ler o `texto`;
// 3. abre a obra no Chromium do scripts/playwright.cjs (GPU no Mac) e imprime o renderer do WebGL, checa cada
//    formato (texto fora do quadro ou da área segura, sobreposto, pequeno, cena parada) e junta os marcos de som
//    de cada entrada;
// 4. o som: a trilha da skill (assets/audio/arrange_series.py) com os marcos como efeitos do sounds.py e, com voz, o
//    mix_voz.py (a trilha cede sob a voz, Contrato M), medida pelo verify.py;
// A narração (cortar os trechos, escrever a voz e a legenda) mora em voice/narracao.mjs, que só os pacotes com voz levam:
// sem ele, o vídeo anda por duração e a trilha é a protagonista.
// 5. render de cada formato pelo scripts/render.cjs (draft 30 fps; final 60 fps com 8 subquadros de motion blur),
//    junta o som (scripts/finalize.mjs confere a entrega) e tira a folha de quadros.
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { spawnSync, execFileSync } from 'node:child_process'
import { createRequire } from 'node:module'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { acharPython } from '../../scripts/where.cjs'
import { montarLinha, trechoDaFala } from './timeline.mjs'
import { FORMATOS } from './scene/engine/layout.js'
import { aberturaDoJson, relatar } from '../../scripts/opening.mjs'

const AQUI = path.dirname(fileURLToPath(import.meta.url))
const SKILL = path.resolve(AQUI, '..', '..')
const AUDIO = path.join(SKILL, 'assets', 'audio')
const require = createRequire(import.meta.url)
const NARRACAO = path.join(AQUI, 'voice', 'narracao.mjs')
const narra = fs.existsSync(NARRACAO)   // os níveis da skill com narração

const todos = process.argv.slice(2)
const corte = todos.indexOf('--')
const argv = corte >= 0 ? todos.slice(0, corte) : todos
const extra = corte >= 0 ? todos.slice(corte + 1) : []
const opt = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 ? argv[i + 1] : d }
const tem = (k) => argv.includes('--' + k)
const exp = (p) => (p && p.startsWith('~') ? path.join(os.homedir(), p.slice(1)) : p)
const arqJson = argv[0] && !argv[0].startsWith('--') ? path.resolve(exp(argv[0])) : null
if (!arqJson || !opt('out')) {
  console.error(`usage: node render.mjs <video.json> --out <folder> [--formats ${Object.keys(FORMATOS).join(',')}] [--mode draft|final] [--no-voice] [--no-sound] [--from s --to s] [--check-only] [-- render.cjs options]`)
  process.exit(1)
}
const base = path.dirname(arqJson)
const P = JSON.parse(fs.readFileSync(arqJson, 'utf8'))
const nome = P.nome || path.basename(arqJson, '.json')
const saida = path.resolve(exp(opt('out')))
const modo = opt('mode', 'draft')
const formatos = (opt('formats') || (P.formatos || ['16x9', '9x16']).join(',')).split(',').map((f) => f.trim())
for (const f of formatos) if (!FORMATOS[f]) { console.error(`format "${f}" does not exist: ${Object.keys(FORMATOS).join(', ')}`); process.exit(1) }
const obra = path.join(saida, `.work-${nome}`)
fs.mkdirSync(path.join(obra, 'engine'), { recursive: true })
fs.mkdirSync(path.join(obra, 'vendor'), { recursive: true })

// ---------- 1. a obra ----------
for (const f of fs.readdirSync(path.join(AQUI, 'scene', 'engine'))) fs.copyFileSync(path.join(AQUI, 'scene', 'engine', f), path.join(obra, 'engine', f))
fs.copyFileSync(path.join(AQUI, 'scene', 'index.html'), path.join(obra, 'index.html'))
fs.copyFileSync(path.join(AQUI, 'scene', 'package.json'), path.join(obra, 'package.json'))
fs.copyFileSync(path.join(AQUI, 'LICENSE-explainroo.txt'), path.join(obra, 'LICENSE-explainroo.txt'))
for (const f of ['rough.esm.js', 'LICENSE-roughjs.txt', 'LICENSE-lucide.txt']) fs.copyFileSync(path.join(AQUI, 'scene', 'vendor', f), path.join(obra, 'vendor', f))
const lucideJs = path.join(obra, 'vendor', 'lucide.js')
if (!fs.existsSync(lucideJs) || fs.statSync(lucideJs).mtimeMs < fs.statSync(path.join(AQUI, 'scene', 'vendor', 'lucide.json')).mtimeMs) {
  const ic = JSON.parse(fs.readFileSync(path.join(AQUI, 'scene', 'vendor', 'lucide.json'), 'utf8'))
  const tags = JSON.parse(fs.readFileSync(path.join(AQUI, 'scene', 'vendor', 'lucide-tags.json'), 'utf8'))
  fs.writeFileSync(lucideJs, `// Lucide icons ${ic.version} (ISC, LICENSE-lucide.txt), as 24×24 SVG paths, generated by render.mjs\nexport default ${JSON.stringify({ versao: ic.version, icones: ic.icons, aliases: ic.aliases || {}, tags })}\n`)
}
const arqCenas = path.resolve(base, exp(P.cenas || 'scenes.js'))
if (!fs.existsSync(arqCenas)) { console.error(`scenes.js does not exist: ${arqCenas} ("cenas" in video.json)`); process.exit(1) }
fs.copyFileSync(arqCenas, path.join(obra, 'scenes.js'))

// a mídia vai embutida (data URL): sem file:// nem rede no canvas, e a folha pode ser lida do canvas
const MIME = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.gif': 'image/gif', '.svg': 'image/svg+xml' }
const midia = {}
const embute = (src) => {
  const abs = path.resolve(base, exp(src))
  if (!fs.existsSync(abs)) { console.error(`MISSING MEDIA: ${src} (looked in ${abs})`); process.exit(1) }
  const mime = MIME[path.extname(abs).toLowerCase()]
  if (!mime) { console.error(`media ${src}: use PNG, JPG, WebP, GIF or SVG`); process.exit(1) }
  const chave = 'media/' + path.basename(abs)
  midia[chave] = `data:${mime};base64,${fs.readFileSync(abs).toString('base64')}`
  return chave
}
const marca = JSON.parse(JSON.stringify(P.marca || {}))
if (!marca.cores || !marca.fontes) { console.error('"marca" needs "cores" (fundo, texto, destaque…) and "fontes" (titulo, texto…): copy them from the product reading'); process.exit(1) }
// o logo: PNG/SVG embutido, ou o traçado da marca (JSON no formato do MARCA.logo do tutorial: { viewBox, partes })
if (typeof marca.logo === 'string' && /\.json$/i.test(marca.logo)) {
  const arq = path.resolve(base, exp(marca.logo))
  if (!fs.existsSync(arq)) { console.error(`MISSING LOGO: ${marca.logo} (looked in ${arq})`); process.exit(1) }
  const L = JSON.parse(fs.readFileSync(arq, 'utf8'))
  if (!L.viewBox || !Array.isArray(L.partes) || !L.partes.every((p) => p.d)) { console.error(`${marca.logo}: the traced logo needs "viewBox" and "partes": [{ "d", "fill" }]`); process.exit(1) }
  marca.logo = { viewBox: L.viewBox, partes: L.partes.map((p) => ({ d: p.d, fill: p.fill })) }
} else if (marca.logo) marca.logo = embute(marca.logo)
for (const m of P.midia || []) embute(m)
fs.writeFileSync(path.join(obra, 'media.js'), `// video media embedded by render.mjs\nexport default ${JSON.stringify(midia)}\n`)

// fontes dentro da obra
const familias = [...new Set(Object.values(marca.fontes).filter(Boolean))]
const css = path.join(obra, 'fonts', 'fonts.css')
if (!fs.existsSync(css) || familias.some((f) => !fs.readFileSync(css, 'utf8').includes(`"${f}"`))) {
  const r = spawnSync(process.execPath, [path.join(SKILL, 'scripts', 'fonts.mjs'), obra, ...familias], { stdio: 'inherit' })
  if (r.status !== 0) { console.error('the fonts did not load: ' + familias.join(', ')); process.exit(1) }
}

// ---------- 2. voz e linha do tempo ----------
if (P.voz && P.voz.locucao && !narra && !tem('no-voice')) console.log('this copy of the skill has no voice module (templates/drawn-explainer/voice/narracao.mjs is missing): the scenes move at reading pace and the soundtrack leads.')
const semVoz = tem('no-voice') || !P.voz || !P.voz.locucao || !narra
let locucao = null
let dirLoc = null
if (P.voz && P.voz.locucao) {
  // com --no-voice o narration.json ainda serve: as cenas leem o texto das falas no tempo de leitura
  const arqLoc = path.resolve(base, exp(P.voz.locucao))
  if (fs.existsSync(arqLoc)) { locucao = JSON.parse(fs.readFileSync(arqLoc, 'utf8')); dirLoc = path.dirname(arqLoc) }
  else if (!semVoz) { console.error(`narration.json does not exist: ${arqLoc}. Generate the voice before rendering (the voice step in SKILL.md, with the approved script), or run with --no-voice`); process.exit(1) }
}
const ritmo = P.ritmo || {}
// cada trecho de fala é cortado primeiro, e o primeiro som dele é medido (Contrato L)
let inicios = {}
let wavs = {}
const N = !semVoz && locucao ? await import(pathToFileURL(NARRACAO).href) : null
if (!N) fs.rmSync(path.join(obra, 'voice'), { recursive: true, force: true })   // a voz de um render anterior não vale mais
if (N) {
  try { ({ inicios, wavs } = N.cortarTrechos({ roteiro: P.roteiro || [], locucao, dirLoc, obra, trechoDaFala })) } catch (e) { console.error(e.message); process.exit(1) }
}
let linha
try {
  linha = montarLinha(P.roteiro || [], locucao, { semVoz, inicios, ...ritmo })
} catch (e) { console.error(e.message); process.exit(1) }
if (!linha.scenes.length) { console.error('"roteiro" (the list of scenes) is empty in video.json'); process.exit(1) }
const falas = linha.voz.map((v) => ({ id: v.cena, texto: v.texto, caminho: wavs[v.cena], inicioArquivo: v.inicio, som: v.som, fim: v.fim }))
// o mapa do vídeo para o refine.mjs da obra: onde cada cena e cada fala (o id da cena) caem no tempo do vídeo
fs.mkdirSync(path.join(obra, 'out'), { recursive: true })
fs.writeFileSync(path.join(obra, 'out', 'assembly.json'), JSON.stringify({ versao: 1, molde: 'drawn-explainer', nome, formatos, duracao: linha.duration,
  cenas: linha.scenes.map((sc) => ({ nome: sc.id, ini: sc.start, fim: +(sc.start + sc.dur).toFixed(3) })),
  falas: falas.map((f) => ({ id: f.id, som: f.som, fim: f.fim })) }, null, 1) + '\n')
const vozTotal = falas.reduce((a, f) => a + (f.fim - f.som), 0)
console.log(`timeline · ${linha.scenes.length} scenes · ${linha.duration.toFixed(2)} s · ${semVoz ? 'no voice (scenes by duration)' : `voice ${vozTotal.toFixed(1)} s (${Math.round((vozTotal / linha.duration) * 100)}% of the time)`}`)
for (const sc of linha.scenes) console.log(`  ${sc.start.toFixed(2).padStart(6)}–${(sc.start + sc.dur).toFixed(2).padEnd(6)} ${sc.id}${sc.voice ? ` · line ${sc.voice.fala} ${sc.voice.dur.toFixed(2)} s` : sc.text ? ' · reading' : ''}${Object.keys(sc.marks).length ? ' · marks ' + Object.entries(sc.marks).map(([k, v]) => `${k}@${v}`).join(' ') : ''}`)

// o catálogo de sons de verdade (nome, nível, âncora, ataque seco, sino), lido do sounds.py
const PY = acharPython()
let catalogo = null
if (PY) {
  const r = spawnSync(PY, ['-c', `import sys, json; sys.path.insert(0, ${JSON.stringify(AUDIO)}); import sounds as sons; print(json.dumps({k: {kk: v[kk] for kk in ('nivel_db', 'ancora', 'ataque_seco', 'sino', 'dur') if kk in v} for k, v in sons.CATALOGO.items()}))`], { encoding: 'utf8' })
  if (r.status === 0) catalogo = JSON.parse(r.stdout.trim().split('\n').pop())
}
const params = {
  nome, idioma: P.idioma || 'en-US', formatos, plataforma: P.plataforma ?? null, marca, textura: P.textura || 'nenhuma', transicao: P.transicao || null,
  legenda: P.legenda ?? 'auto', legendaPeso: P.legendaPeso, sons: P.sons ?? true, semSino: P.semSino === true, semente: P.semente ?? 1, boil: P.boil ?? 0,
  dados: P.dados || {}, linha, sonsCatalogo: catalogo,
}
fs.writeFileSync(path.join(obra, 'params.js'), `// generated by render.mjs from ${path.basename(arqJson)}\nexport default ${JSON.stringify(params, null, 1)}\n`)

// ---------- 3. a obra no navegador: GPU, checagem, marcos de som ----------
const { abrirNavegador } = require(path.join(SKILL, 'scripts', 'playwright.cjs'))
let marcos = []
let problemas = 0
{
  const { browser } = await abrirNavegador(obra)
  const erros = []
  for (const [i, f] of formatos.entries()) {
    const [W, H] = FORMATOS[f]
    const pg = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 })
    pg.on('console', (m) => { if (m.type() === 'error') erros.push(m.text()) })
    pg.on('pageerror', (e) => erros.push(e.message))
    await pg.goto(pathToFileURL(path.join(obra, 'index.html')).href + `?f=${f}`)
    const pronto = await pg.waitForFunction('window.__ready === true', null, { timeout: 60000 }).then(() => true).catch(() => false)
    if (!pronto) { console.error(`the build was not ready (${f}):\n${erros.join('\n') || 'no error in the console'}`); await browser.close(); process.exit(3) }
    if (i === 0) {
      const gpu = await pg.evaluate(() => window.explicacao.renderer())
      console.log(`GPU (UNMASKED_RENDERER_WEBGL): ${gpu}`)
      if (/swiftshader|llvmpipe|software/i.test(gpu)) console.error('WARNING: Chromium is drawing on the CPU (SwiftShader). On a Mac, without VIDEOSTUDIO_NO_GPU, it should be Metal; the render comes out the same, only slower')
      const r = await pg.evaluate(() => window.explicacao.marcos())
      marcos = r.marcos
      for (const e of r.erros) { console.error(`SCENE ERROR "${e.scene}" at ${e.t.toFixed(2)} s: ${e.message}`); problemas++ }
    }
    const lista = await pg.evaluate(() => window.explicacao.checar(0.25))
    const n = { erro: 0, aviso: 0, dica: 0 }
    const NIVEL = { erro: 'ERROR', aviso: 'WARNING', dica: 'TIP' }
    for (const q of lista) {
      n[q.nivel]++
      const quando = q.t === null ? '' : ` at ${q.t.toFixed(2)} s`
      ;(q.nivel === 'erro' ? console.error : console.log)(`  ${f} · ${NIVEL[q.nivel] || q.nivel.toUpperCase()} · scene ${q.cena}${quando}: ${q.msg}`)
    }
    console.log(`check ${f}: ${n.erro} error(s), ${n.aviso} warning(s), ${n.dica} tip(s)`)
    problemas += n.erro
    await pg.close()
  }
  await browser.close()
  if (erros.length) { console.error('BUILD ERROR:\n' + [...new Set(erros)].join('\n')); process.exit(3) }
}
fs.writeFileSync(path.join(obra, 'marcos.json'), JSON.stringify(marcos, null, 1) + '\n')
console.log(`sounds: ${marcos.length} marks (${[...new Set(marcos.map((m) => m.som))].join(', ') || 'none'})`)
if (tem('check-only')) process.exit(problemas ? 4 : 0)

// ---------- 4. o som: trilha da skill + efeitos dos marcos + voz por cima ----------
let trilha = null
const dirAudio = path.join(obra, 'audio')
if (!tem('no-sound')) {
  if (!PY && P.trilha !== false) console.error('WARNING: without Python with numpy and scipy: no soundtrack or effects' + (falas.length ? '; the video comes out with the voice only' : '; the video comes out silent') + `. Run once: node ${path.join(SKILL, 'scripts', 'environment.mjs')} --fix`)
  if (PY && P.trilha !== false) {
    fs.mkdirSync(dirAudio, { recursive: true })
    for (const f of ['soundtrack.wav']) fs.rmSync(path.join(dirAudio, f), { force: true })
    const T = P.trilha || {}
    const semente = T.semente ?? P.semente ?? 7
    const PADRAO_ID = {
      nenhuma: { genero: 'house', bpm: [118, 124], modos: ['dorico', 'menor', 'mixolidio'], instrumentos: { harmonia: ['epiano', 'piano'], baixo: ['bass_note'], percussao: ['kick', 'clap', 'hat', 'hat_aberto', 'shaker'], melodia: ['pluck'], textura: ['pad_note'] } },
      noite: { genero: 'techno', bpm: [122, 128], modos: ['menor', 'dorico'], instrumentos: { harmonia: ['pad_note', 'epiano'], baixo: ['baixo_serra', 'bass_note'], percussao: ['kick', 'clap', 'hat', 'hat_aberto'], melodia: ['pluck'], textura: ['pad_note'] } },
      papel: { genero: 'acustico', bpm: [88, 100], modos: ['maior', 'lidio'], instrumentos: { harmonia: ['corda', 'piano'], baixo: ['bass_note'], percussao: ['kick', 'shaker', 'aro'], melodia: ['pluck', 'pling'], textura: ['pad_note'] } },
      giz: { genero: 'acustico', bpm: [84, 96], modos: ['maior', 'mixolidio'], instrumentos: { harmonia: ['piano', 'corda'], baixo: ['bass_note'], percussao: ['kick', 'shaker', 'aro'], melodia: ['pluck'], textura: ['pad_note'] } },
      planta: { genero: 'acustico', bpm: [96, 108], modos: ['dorico', 'mixolidio'], instrumentos: { harmonia: ['epiano', 'piano'], baixo: ['bass_note'], percussao: ['kick', 'shaker', 'hat'], melodia: ['pluck'], textura: ['pad_note'] } },
    }[params.textura] || {}
    const ident = { versao: 2, nome: `${marca.nome || nome} · drawn explainer`, papel: 'fundo', densidade: 'baixa', loudness_lufs: falas.length ? -14.0 : -16.0, tons: ['C', 'D', 'Eb', 'F', 'G', 'A'], ...PADRAO_ID, ...(T.identidade || {}) }
    if (!T.identidade) console.log('soundtrack: no "trilha.identidade" in video.json, using the texture\'s (declare the audience genre: assets/audio/API.md)')
    fs.writeFileSync(path.join(dirAudio, 'identity.json'), JSON.stringify(ident, null, 2) + '\n')
    // a tônica da peça, para o blip e o brilho soarem no tom da trilha (sounds.py lê "tonica" da folha)
    let tonica = null
    const mo = spawnSync(PY, [path.join(AUDIO, 'series.py'), '--show', path.join(dirAudio, 'identity.json'), String(semente)], { encoding: 'utf8' })
    if (mo.status === 0) { try { const v = JSON.parse(mo.stdout); tonica = 60 + v.tonica_pc; console.log(`soundtrack: ${v.tom} ${v.modo}, ${v.bpm} BPM (${v.genero || 'v1'})`) } catch {} }
    const dur = linha.duration
    const ultima = falas.length ? falas.at(-1).fim : 0
    const folha = {
      titulo: `${marca.nome || nome} · drawn explainer`, duracao: dur, bpm: 120, compasso: 4, taxa: 48000, saida: 'soundtrack.wav',
      loudness_lufs: ident.loudness_lufs, teto_dbtp: -1.5, semente, silencios: [],
      fade: [+Math.min(dur - 0.2, Math.max(dur - 0.9, ultima + 0.05)).toFixed(3), dur],
      secoes: linha.scenes.map((sc, i) => ({ nome: i === 0 ? 'opening' : i === linha.scenes.length - 1 ? 'closing' : sc.id, de: sc.start, ate: +(sc.start + sc.dur).toFixed(3), energia: i === 0 || i === linha.scenes.length - 1 ? 'media' : 'baixa' })),
      marcos,
      ...(tonica !== null ? { tonica } : {}),
    }
    if (falas.length) folha.voz = N.escreverNarracao({ falas, duracao: dur, dirAudio, obra, perfil: P.voz && P.voz.perfil })
    for (const lufs of falas.length ? [-14, -16] : [ident.loudness_lufs]) {
      folha.loudness_lufs = lufs
      fs.writeFileSync(path.join(dirAudio, 'sheet.json'), JSON.stringify(folha, null, 1) + '\n')
      const r = spawnSync(PY, [path.join(AUDIO, 'arrange_series.py'), 'identity.json', 'sheet.json'], { cwd: dirAudio, encoding: 'utf8' })
      fs.writeFileSync(path.join(dirAudio, 'arranjo.log'), (r.stdout || '') + (r.stderr || ''))
      if (r.status !== 0 || !fs.existsSync(path.join(dirAudio, 'soundtrack.wav'))) { console.error(`the soundtrack was not created (audio/arranjo.log):\n${(r.stderr || r.stdout || '').split('\n').slice(-12).join('\n')}`); process.exit(1) }
      const m = spawnSync(PY, [path.join(AUDIO, 'verify.py'), 'sheet.json'], { cwd: dirAudio, encoding: 'utf8' })
      fs.writeFileSync(path.join(dirAudio, 'verifica.log'), (m.stdout || '') + (m.stderr || ''))
      if (m.status === 0) { console.log(`soundtrack: verify.py all OK at ${lufs} LUFS (marks, ${falas.length ? 'voice above the soundtrack, ' : ''}loudness, peak) · audio/verifica.log`); break }
      console.error(`soundtrack at ${lufs} LUFS failed verify.py (audio/verifica.log):\n${(m.stdout || '').split('\n').filter((l) => /FAILED|✗/.test(l)).join('\n')}`)
      if (lufs === -16 || !falas.length) { console.error('WARNING: the soundtrack failed the check; read audio/verifica.log before delivering'); process.exitCode = 1 }
    }
    trilha = path.join(dirAudio, 'soundtrack.wav')
  }
}
if (!trilha && falas.length && !tem('no-sound')) {
  // sem Python (ou "trilha": false): só a voz, normalizada em -16 LUFS
  trilha = path.join(dirAudio, 'voz-so.wav')
  fs.mkdirSync(dirAudio, { recursive: true })
  const ins = falas.flatMap((f) => ['-i', f.caminho])
  const atrasos = falas.map((f, i) => `[${i}:a]aresample=48000,aformat=channel_layouts=stereo,adelay=${Math.round(f.inicioArquivo * 1000)}:all=1[a${i}]`).join(';')
  execFileSync('ffmpeg', ['-v', 'error', '-y', ...ins, '-filter_complex', `${atrasos};${falas.map((_, i) => `[a${i}]`).join('')}amix=inputs=${falas.length}:normalize=0,apad,atrim=0:${linha.duration},loudnorm=I=-16:TP=-1.5:LRA=11,aresample=48000[o]`, '-map', '[o]', '-ar', '48000', trilha])
}

// ---------- 5. render, som e folha de cada formato ----------
const de = opt('from'), ate = opt('to')
const parcial = de !== undefined || ate !== undefined
const suf = parcial ? `-${String(de ?? 0).replace('.', ',')}-${String(ate ?? linha.duration).replace('.', ',')}` : ''
let falhou = 0
for (const f of formatos) {
  const mudo = path.join(obra, 'out', `${f}${suf}.mp4`)
  const r = spawnSync(process.execPath, [path.join(SKILL, 'scripts', 'render.cjs'), '--project', obra, '--mode', modo, '--format', f, '--out', `out/${f}${suf}.mp4`, '--no-sheet',
    ...(de !== undefined ? ['--from', de] : []), ...(ate !== undefined ? ['--to', ate] : []), ...extra], { stdio: 'inherit' })
  if (r.status !== 0) { console.error(`✗ ${f}: render exited with code ${r.status}`); falhou++; continue }
  const final = path.join(saida, `${nome}-${f}${modo === 'final' ? '' : '-draft'}${suf}.mp4`)
  if (trilha && !parcial && path.basename(trilha) === 'soundtrack.wav') {
    const v = spawnSync(process.execPath, [path.join(SKILL, 'scripts', 'finalize.mjs'), '--project', obra, '--video', path.relative(obra, mudo), '--audio', 'audio/soundtrack.wav', '--out', final],
      { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: 180000 })
    process.stdout.write(v.stdout || ''); process.stderr.write(v.stderr || '')
    if (v.status !== 0 && !/delivery verified\./.test(v.stdout || '')) { console.error(`✗ ${f}: finalizar flagged a problem in the delivery (above)`); falhou++ }
  } else if (trilha) {
    const ss = parcial ? ['-ss', String(de ?? 0), ...(ate !== undefined ? ['-to', String(ate)] : [])] : []
    execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', mudo, ...ss, '-i', trilha, '-map', '0:v', '-map', '1:a', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '256k', '-shortest', '-movflags', '+faststart', final])
  } else fs.copyFileSync(mudo, final)
  // a legenda da voz ao lado do vídeo; a abertura com o logo, logo abaixo, a desloca junto
  if (N && falas.length && !parcial && fs.existsSync(path.join(obra, N.LEGENDA))) fs.copyFileSync(path.join(obra, N.LEGENDA), final.replace(/\.mp4$/i, '.srt'))
  if (P.aberturaLogo && !parcial) {   // o logo no começo (scripts/opening.mjs), antes da folha
    try { console.log(relatar(aberturaDoJson(final, P.aberturaLogo, path.dirname(path.resolve(arqJson))))) } catch (e) { console.error(`✗ ${f}: ${e.message}`); process.exitCode = 1 }
  }
  // a folha: 24 instantes do trecho, com cena e tempo embaixo de cada um
  const { browser } = await abrirNavegador(obra)
  const [W, H] = FORMATOS[f]
  const pg = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 })
  await pg.goto(pathToFileURL(path.join(obra, 'index.html')).href + `?f=${f}`)
  await pg.waitForFunction('window.__ready === true', null, { timeout: 60000 })
  const a = +(de ?? 0), b = +(ate ?? linha.duration)
  const n = 24
  const tempos = Array.from({ length: n }, (_, i) => +(a + ((i + 0.5) * (b - a)) / n).toFixed(3))
  const rotulos = tempos.map((t) => { const sc = [...linha.scenes].reverse().find((s) => t >= s.start); return `${sc.id} · ${t.toFixed(2)} s` })
  // horizontal: 6 colunas com a altura do 16:9 (225 px), mais largas no 19:9 e no 21:9; 9:16: 8 colunas; 4:5 e 1:1: 6
  const cols = f === '9x16' ? 8 : 6
  const largura = W > H ? Math.round((225 * W) / H) : f === '9x16' ? 240 : 300
  const url = await pg.evaluate((o) => window.explicacao.folha(o), { tempos, rotulos, cols, largura })
  await browser.close()
  const folha = path.join(saida, `${nome}-${f}${modo === 'final' ? '' : '-draft'}${suf}-sheet.jpg`)
  fs.writeFileSync(folha, Buffer.from(url.split(',')[1], 'base64'))
  const dur = +execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', final]).toString().trim()
  console.log(`✓ ${final} · ${dur.toFixed(2)} s · LOOK at the sheet: ${folha}`)
}
if (problemas) console.error(`${problemas} layout problem(s) above: fix them before showing (code 4)`)
process.exitCode = falhou ? 1 : problemas ? 4 : process.exitCode || 0
