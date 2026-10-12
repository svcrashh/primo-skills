#!/usr/bin/env node
// Molde typing-terminal: monta e renderiza o vídeo de um programa de linha de comando.
//   node render.mjs <parametros.json> --out <folder> [--mode draft|final] [--formats 16x9,9x16] [--no-sound]
// parametros.json: { "nome": "meu-cli", "formatos": ["16x9","9x16"], "gravacao": "terminal.json", "cps": 13, "duracao": 10,
//                    "cores": { fundo, janela, barra, texto, comando, prompt, cursor, legenda } }   (cores têm padrão neutro)
// Opcionais, todos desligados por padrão: "titulo" (troca o da gravação; "" = barra sem título), "moldura": false (sem
// sombra e sem os três botões da janela), "areaSegura": true (no 16:9, janela 12 px mais curta e legenda dentro dos 5%
// de baixo, como no 19:9 e no 21:9), "linhaMin" (s entre as linhas da saída; padrão 0,05), "mono" (família instalada
// do texto do terminal, ex.: "Menlo"), "fonte" (família da legenda e do título; a obra usa <obra>/fonts/fonts.css e
// baixa pelo scripts/fonts.mjs se faltar) e
// "fecho": { "logo": "x.png", "fundo": "#hex", "dur": 2.2, "largura": px } (depois do terminal, corte para o fundo
// com o logo centrado, entrando e parado; a trilha resolve nele), "coluna": "esquerda" (a legenda numa coluna grande à
// esquerda, a janela à direita) e "camera": { "de": 0.85, "origem": [x, y] } (a janela chega perto devagar).
// A gravação vem do scripts/product/record-terminal.mjs. Sem marca dentro. O som é a trilha da skill (arrange_series.py)
// como protagonista, com as teclas de cada comando marcadas nela (precisa de Python com numpy e scipy; --no-sound: mudo).
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { spawnSync, execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { acharPython } from '../../scripts/where.cjs'
import { createRequire } from 'node:module'
import { aberturaDoJson, relatar } from '../../scripts/opening.mjs'

const aqui = path.dirname(fileURLToPath(import.meta.url)), skill = path.resolve(aqui, '..', '..')
const a = process.argv.slice(2), arg = (k, d) => { const i = a.indexOf('--' + k); return i >= 0 ? a[i + 1] : d }
const arq = a.find((x) => x.endsWith('.json'))
if (!arq || !arg('out')) { console.error('usage: node render.mjs <parametros.json> --out <folder> [--mode draft|final] [--formats 16x9,9x16] [--no-sound]'); process.exit(1) }
const base = path.dirname(path.resolve(arq))
const cam = (p) => path.resolve(base, p.replace(/^~(?=$|\/)/, os.homedir()))
const P = JSON.parse(fs.readFileSync(arq, 'utf8'))
const modo = arg('mode', 'draft'), saida = path.resolve(arg('out'))
const formatos = arg('formats', (P.formatos || ['16x9']).join(',')).split(',')
const nome = P.nome || path.basename(arq, '.json')
const G = JSON.parse(fs.readFileSync(cam(P.gravacao), 'utf8'))
const cores = { fundo: '#EFEAE0', janela: '#16181D', barra: '#22252C', texto: '#D8DCE3', comando: '#FFFFFF', prompt: '#7EE787', cursor: '#D8DCE3', legenda: '#1E2A22', ...P.cores }
const obra = path.join(saida, `.work-${nome}`)
fs.mkdirSync(obra, { recursive: true })
let html = fs.readFileSync(path.join(aqui, 'index.html'), 'utf8')
if (P.fonte) {   // a família da legenda e do título dentro da obra, sem rede no render
  html = html.replace('</title>', '</title><link rel="stylesheet" href="fonts/fonts.css">')
  const css = path.join(obra, 'fonts', 'fonts.css')
  if (!fs.existsSync(css) || !fs.readFileSync(css, 'utf8').includes(`"${P.fonte}"`)) {
    const r = spawnSync(process.execPath, [path.join(skill, 'scripts', 'fonts.mjs'), obra, P.fonte], { stdio: 'inherit' })
    if (r.status !== 0) { console.error(`the font did not download: ${P.fonte}`); process.exit(1) }
  }
}
fs.writeFileSync(path.join(obra, 'index.html'), html)
fs.copyFileSync(path.join(aqui, 'template.js'), path.join(obra, 'template.js'))
let fecho = null
if (P.fecho) {
  const origem = cam(P.fecho.logo)
  if (!fs.existsSync(origem)) { console.error(`could not find the closing logo: ${origem}`); process.exit(1) }
  fs.mkdirSync(path.join(obra, 'media'), { recursive: true })
  fs.copyFileSync(origem, path.join(obra, 'media', path.basename(origem)))
  fecho = { logo: `media/${path.basename(origem)}`, fundo: P.fecho.fundo || '#FFFFFF', dur: P.fecho.dur ?? 2.2, largura: P.fecho.largura }
}
const terminal = { titulo: P.titulo ?? G.titulo, prompt: G.prompt, comandos: G.comandos.map((c) => ({ cmd: c.cmd, legenda: c.legenda, saida: c.saida })), cps: P.cps, duracao: P.duracao, pausa: P.pausa, inicio: P.inicio, linhaMin: P.linhaMin }
fs.writeFileSync(path.join(obra, 'params.js'), `const PARAMS = ${JSON.stringify({ nome, formatos, cores, terminal, ...(P.moldura === false ? { moldura: false } : {}), ...(P.areaSegura ? { areaSegura: true } : {}), ...(P.mono ? { mono: P.mono } : {}), ...(P.fonte ? { fonte: P.fonte } : {}), ...(P.coluna ? { coluna: P.coluna } : {}), ...(P.camera ? { camera: P.camera } : {}), ...(fecho ? { fecho } : {}) })}\n`)

// som: a linha do tempo dos comandos sai da própria cena (template.js), e cada comando vira um marco de digitação na
// folha da trilha (sem o bloco "voz": a trilha é a protagonista)
let trilha = false
if (!a.includes('--no-sound')) {
  const PY = acharPython()
  if (!PY) console.error(`WARNING: no Python with numpy and scipy, the video comes out silent. Run once: node ${path.join(skill, 'scripts', 'environment.mjs')} --fix`)
  else {
    const { abrirNavegador } = createRequire(import.meta.url)(path.join(skill, 'scripts', 'playwright.cjs'))
    const { browser } = await abrirNavegador(obra)
    const pg = await browser.newPage()
    await pg.goto('file://' + path.join(obra, 'index.html') + `?f=${formatos[0]}`)
    await pg.waitForFunction('window.__ready === true', null, { timeout: 60000 })
    const L = await pg.evaluate('({ dur: VIDEO.duracao, fecho: VIDEO.fechoEm ?? null, cmds: cmds.map((c) => ({ ini: c.ini, enter: c.enter, acabou: c.acabou })) })')
    await browser.close()
    const r3 = (x) => +x.toFixed(3), C = L.cmds, ult = C.length - 1
    // com fecho, a música resolve quando o logo entra (um acento obrigatório ali); sem ele, no fim da última saída
    const tResolve = L.fecho ?? C[ult].acabou
    const folha = { titulo: `${nome} · self-typing terminal`, duracao: L.dur, bpm: 120, compasso: 4, taxa: 48000, saida: 'soundtrack.wav', loudness_lufs: -14.0, teto_dbtp: -1.5,
      semente: P.trilha?.semente ?? 7, silencios: [], fade: [r3(L.dur - 0.8), L.dur],
      secoes: [{ nome: 'abertura', de: 0, ate: r3(C[0].ini), energia: 'media' },
        ...C.map((c, i) => ({ nome: `comando-${i + 1}`, de: r3(c.ini), ate: r3(i < ult ? C[i + 1].ini : tResolve), energia: 'media' })),
        { nome: 'fechamento', de: r3(tResolve), ate: L.dur, energia: 'media' }],
      marcos: [...C.map((c, i) => ({ t: r3(c.ini), evento: `types command ${i + 1}`, som: 'digitação', efeito: 'digitacao', dur: r3(c.enter - c.ini + 0.1), enter: true, teclado: P.teclado || 'notebook', opcional: false })),
        ...(L.fecho != null ? [{ t: r3(L.fecho), evento: 'the closing logo comes in', som: 'acento', opcional: false }] : [])] }
    const ident = { versao: 2, nome: `${nome} · self-typing terminal`, papel: 'protagonista', densidade: 'baixa', loudness_lufs: -14.0, bpm: [100, 112],
      modos: ['maior', 'mixolidio', 'dorico'], tons: ['C', 'D', 'F', 'G', 'A'],
      instrumentos: { harmonia: ['epiano', 'piano'], baixo: ['bass_note'], percussao: ['kick', 'clap', 'hat', 'shaker'], melodia: ['pluck'], textura: ['pad_note'] },
      ...(P.trilha?.identidade || {}) }
    if (!P.trilha?.identidade) console.log('soundtrack: no "trilha.identidade" in the JSON, using a neutral identity (declare the audience\'s music genre: assets/audio/API.md)')
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
  const mudo = path.join(obra, 'out', `${f}.mp4`)
  const r = spawnSync(process.execPath, [path.join(skill, 'scripts', 'render.cjs'), '--project', obra, '--mode', modo, '--format', f, '--out', `out/${f}.mp4`, '--no-sheet'], { stdio: 'inherit' })
  if (r.status !== 0) { console.error(`✗ ${f}: render exited with ${r.status}`); process.exitCode = 1; continue }
  const final = path.join(saida, `${nome}-${f}${modo === 'final' ? '' : '-draft'}.mp4`)
  if (trilha) {   // junta e confere a entrega (duração, loudness, pico), já em AAC
    const v = spawnSync(process.execPath, [path.join(skill, 'scripts', 'finalize.mjs'), '--project', obra, '--video', mudo, '--audio', 'audio/soundtrack.wav', '--out', final], { stdio: 'inherit', timeout: 180000 })
    if (v.status !== 0) console.error(`WARNING: finalizar flagged something in the ${f} delivery (above)`)
  } else fs.copyFileSync(mudo, final)
  if (P.aberturaLogo) {   // o logo no começo (scripts/opening.mjs), antes da folha
    try { console.log(relatar(aberturaDoJson(final, P.aberturaLogo, path.dirname(path.resolve(arq))))) } catch (e) { console.error(`✗ ${f}: ${e.message}`); process.exitCode = 1 }
  }
  const dur = +execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', final]).toString().trim()
  const [esc, grade] = f === '9x16' ? ['270:-1', '8x3'] : f === '1x1' ? ['360:-1', '6x4'] : ['480:-1', '6x4']
  const folha = final.replace(/\.mp4$/, '-sheet.png')
  execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', final, '-vf', `fps=24/${dur},scale=${esc},tile=${grade}`, '-frames:v', '1', folha])
  console.log(`✓ ${final} · ${dur.toFixed(2)} s · LOOK at the sheet: ${folha}`)
}
