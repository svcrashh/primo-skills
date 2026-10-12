#!/usr/bin/env node
// Monta e renderiza um vídeo before-after a partir de um JSON de parâmetros.
//   node render.mjs <parametros.json> --screens <folder das capturas> --out <folder>
//        [--narration voice/narration.json] [--formats 16x9,19x9,21x9,9x16,1x1] [--mode final|draft] [--variation corte|zoom-out] [--no-soundtrack]
// Sai em <output>: <name>-<format>.mp4 (com a voz, se houver locução; sem ela, com a trilha da skill como
// protagonista e o clique no corte), sheet-<name>-<format>.png e projeto/ (o HTML do vídeo, para prévia:
// projeto/index.html?f=9x16&t=4). A locução é gerada antes, fora do molde.
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { spawnSync, execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { acharPython } from '../../scripts/where.cjs'
import { aberturaDoJson, relatar } from '../../scripts/opening.mjs'

const aqui = path.dirname(fileURLToPath(import.meta.url))
const skill = path.resolve(aqui, '..', '..')
const argv = process.argv.slice(2)
const arg = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 ? argv[i + 1] : d }
const exp = (p) => (p && p.startsWith('~') ? path.join(os.homedir(), p.slice(1)) : p)
const jsonP = path.resolve(argv[0] || '')
if (!argv[0] || !fs.existsSync(jsonP)) { console.error('usage: node render.mjs <parametros.json> --screens <folder> --out <folder> [--narration …]'); process.exit(1) }
const cfg = JSON.parse(fs.readFileSync(jsonP, 'utf8'))
const base = path.dirname(jsonP)
const telas = path.resolve(exp(arg('screens', path.join(base, 'telas'))))
const saida = path.resolve(exp(arg('out', path.join(base, 'out'))))
const modo = arg('mode', 'final')
const formatos = arg('formats', '16x9,9x16').split(',')
const locP = arg('narration') ? path.resolve(exp(arg('narration'))) : null
const proj = path.join(saida, 'project')
fs.mkdirSync(path.join(proj, 'telas'), { recursive: true })
fs.mkdirSync(path.join(proj, 'media'), { recursive: true })
// Formatos aceitos. Um horizontal sem entrada própria em "formatos" (19:9, 21:9) herda a do 16:9, como o L() do
// motor; a cena recompõe o foco para a largura da janela.
const TAMANHOS = { '16x9': [1920, 1080], '19x9': [2280, 1080], '21x9': [2520, 1080], '9x16': [1080, 1920], '1x1': [1080, 1080], '4x5': [1080, 1350] }
function entradaDoFormato(formatos, F) {
  const [w, h] = TAMANHOS[F] || []
  if (!w) return { erro: `unknown format: ${F} (accepted: ${Object.keys(TAMANHOS).join(', ')})` }
  if (formatos[F]) return { fc: formatos[F] }
  if (w > h && formatos['16x9']) return { fc: formatos['16x9'], herdado: '16x9' }
  return { erro: `the JSON has no formatos.${F}` }
}
const run = (cmd, a) => { const r = spawnSync(cmd, a, { stdio: 'inherit' }); if (r.status !== 0) { console.error(`failed: ${cmd} ${a.join(' ')}`); process.exit(r.status || 1) } }

// 1. molde + motor + telas + logo
fs.copyFileSync(path.join(aqui, 'template', 'index.html'), path.join(proj, 'index.html'))
fs.copyFileSync(path.join(aqui, 'template', 'scene.js'), path.join(proj, 'scene.js'))
fs.copyFileSync(path.join(skill, 'assets', 'template', 'engine.js'), path.join(proj, 'engine.js'))
for (const f of fs.readdirSync(telas).filter((f) => f.endsWith('.png'))) fs.copyFileSync(path.join(telas, f), path.join(proj, 'telas', f))
const marca = { ...cfg.marca }
if (marca.logo) { const dst = 'media/logo' + path.extname(marca.logo); fs.copyFileSync(path.resolve(base, marca.logo), path.join(proj, dst)); marca.logo = dst }
// fundo opcional (formas | simbolo): o PNG do símbolo vai para media/, como o logo
const fundo = cfg.fundo ? { ...cfg.fundo } : null
if (fundo?.png) { const dst = 'media/fundo' + path.extname(fundo.png); fs.copyFileSync(path.resolve(base, fundo.png), path.join(proj, dst)); fundo.png = dst }

// 2. fontes da marca dentro do projeto (o render não depende de rede nem de fonte instalada)
const familias = [...new Set([marca.fontes.titulo, marca.fontes.texto, marca.fontes.mono].filter(Boolean))]
if (!fs.existsSync(path.join(proj, 'fonts', 'fonts.css')) || familias.some((f) => !fs.readFileSync(path.join(proj, 'fonts', 'fonts.css'), 'utf8').includes(`"${f}"`)))
  run(process.execPath, [path.join(skill, 'scripts', 'fonts.mjs'), proj, ...familias])

// 3. tempos: a voz manda. Sem locução, estima 0,38 s por palavra.
const loc = locP ? JSON.parse(fs.readFileSync(locP, 'utf8')) : null
const falaDe = (id) => {
  const f = loc?.falas.find((x) => x.id === id)
  if (f) return { dur: f.duracao, palavras: f.palavras.map((p) => ({ t: p.texto, ini: p.ini })), arquivo: path.resolve(path.dirname(locP), f.arquivo) }
  const txt = cfg.falas.find((x) => x.id === id)?.texto || ''
  const ws = txt.split(/\s+/).filter(Boolean)
  return { dur: ws.length * 0.38, palavras: ws.map((t, i) => ({ t, ini: i * 0.38 })), arquivo: null }
}
const fA = falaDe('antes'), fD = falaDe('depois')
// ritmo "calmo" (opcional): as folgas entre o fim da fala e o clique, depois do clique e na cortina ficam 30% maiores
const K = cfg.ritmo === 'calmo' ? 1.3 : 1
const tp = { a: 0.5 }
tp.gatilho = Math.max(1.6, tp.a + fA.dur - 0.6)
tp.clique = tp.a + fA.dur + 1.1 * K
tp.d = tp.clique + 0.25
tp.cortina = Math.max(tp.d + fD.dur + 0.4 * K, tp.clique + 3 * K)
tp.fecho = tp.cortina + 2.6 * K
let dur = Math.max(12, tp.fecho + 3.2)
if (dur > 20) console.error(`warning: ${dur.toFixed(1)} s is over 20 s — shorten the lines`)
dur = Math.round(dur * 60) / 60

// legendas = a fala, em pedaços de até 6 palavras, no tempo de cada palavra
const legendas = []
for (const [f, t0] of [[fA, tp.a], [fD, tp.d]]) {
  const ps = f.palavras
  for (let i = 0; i < ps.length; i += 6) {
    const g = ps.slice(i, i + 6)
    const prox = ps[i + 6]
    legendas.push({ texto: g.map((p) => p.t).join(' '), de: t0 + g[0].ini - 0.05, ate: prox ? t0 + prox.ini - 0.05 : t0 + f.dur + 0.5 })
  }
}

// 4. trilha sem voz: a da skill (arrange_series.py), protagonista, com o clique no corte e a cortina passando
let trilha = false
if (!fA.arquivo && !fD.arquivo && !argv.includes('--no-soundtrack')) {
  const PY = acharPython()
  if (!PY) console.error(`WARNING: no Python with numpy and scipy: no voice and no soundtrack, the video comes out silent. Run once: node ${path.join(skill, 'scripts', 'environment.mjs')} --fix`)
  else {
    const r3 = (x) => +x.toFixed(3)
    const folha = { titulo: `${cfg.nome} · before and after`, duracao: dur, bpm: 120, compasso: 4, taxa: 48000, saida: 'soundtrack.wav', loudness_lufs: -14.0, teto_dbtp: -1.5,
      semente: cfg.trilha?.semente ?? 7, silencios: [], fade: [r3(dur - 0.8), dur],
      secoes: [{ nome: 'abertura', de: 0, ate: r3(tp.clique), energia: 'media' }, { nome: 'depois', de: r3(tp.clique), ate: r3(tp.cortina), energia: 'media' },
        { nome: 'cortina', de: r3(tp.cortina), ate: r3(tp.fecho), energia: 'media' }, { nome: 'fechamento', de: r3(tp.fecho), ate: dur, energia: 'media' }],
      marcos: [{ t: r3(tp.clique), evento: 'click = cut to the after', som: 'clique', efeito: 'clique', opcional: false },
        { t: r3(tp.cortina + 0.55), evento: 'curtain passes', som: 'whoosh', efeito: 'whoosh', dur: 1.0, opcional: true },
        { t: r3(tp.fecho), evento: 'closing', som: 'acento', opcional: true }] }
    const ident = { versao: 2, nome: `${cfg.nome} · before and after`, papel: 'protagonista', densidade: 'baixa', loudness_lufs: -14.0, bpm: [100, 112],
      modos: ['maior', 'mixolidio', 'dorico'], tons: ['C', 'D', 'F', 'G', 'A'],
      instrumentos: { harmonia: ['epiano', 'piano'], baixo: ['bass_note'], percussao: ['kick', 'clap', 'hat', 'shaker'], melodia: ['pluck'], textura: ['pad_note'] },
      ...(cfg.trilha?.identidade || {}) }
    if (!cfg.trilha?.identidade) console.log('soundtrack: no "trilha.identidade" in the JSON, using a neutral identity (declare the audience\'s music genre: assets/audio/API.md)')
    const dirAudio = path.join(proj, 'audio')
    fs.mkdirSync(dirAudio, { recursive: true })
    fs.rmSync(path.join(dirAudio, 'soundtrack.wav'), { force: true })
    fs.writeFileSync(path.join(dirAudio, 'sheet.json'), JSON.stringify(folha, null, 1) + '\n')
    fs.writeFileSync(path.join(dirAudio, 'identity.json'), JSON.stringify(ident, null, 2) + '\n')
    const r = spawnSync(PY, [path.join(skill, 'assets', 'audio', 'arrange_series.py'), 'identity.json', 'sheet.json'], { cwd: dirAudio, stdio: 'inherit' })
    if (r.status !== 0 || !fs.existsSync(path.join(dirAudio, 'soundtrack.wav'))) { console.error('the soundtrack did not come out (see above); run with --no-soundtrack to output a silent video'); process.exit(1) }
    trilha = true
  }
}

// 5. render por formato
const variacao = arg('variation', cfg.variacao || 'corte')
fs.mkdirSync(saida, { recursive: true })
for (const F of formatos) {
  const { fc, herdado, erro } = entradaDoFormato(cfg.formatos, F)
  if (erro) { console.error(erro); continue }
  if (herdado) console.log(`${F}: no formatos.${F} in the JSON, using the ${herdado} one recomposed for the width`)
  const vp = cfg.captura?.telas?.[fc.tela] || fc.viewport
  const formato = { antes: `telas/${fc.tela}-antes.png`, depois: `telas/${fc.tela}-depois.png`, w: vp.w, h: vp.h, foco: fc.foco, detalhe: fc.detalhe, zoomDetalhe: fc.zoomDetalhe, ...(herdado ? { herdado } : {}), ...(fc.origem ? { origem: fc.origem } : {}) }
  // opcionais (TEMPLATE.md): só entram no PARAM quando o JSON pede; sem eles, o vídeo sai no padrão
  const opc = Object.fromEntries(['lado', 'transicao', 'camera', 'ritmo'].filter((k) => cfg[k]).map((k) => [k, cfg[k]]))
  const PARAM = { marca, textos: cfg.textos, gatilho: cfg.gatilho, variacao, formato, ...(cfg.fecho ? { fecho: cfg.fecho } : {}), ...(cfg.respiro ? { respiro: true } : {}), ...(cfg.textoFora ? { textoFora: true } : {}),
    ...opc, ...(fundo ? { fundo } : {}),
    tempos: { gatilho: tp.gatilho, clique: tp.clique, cortina: tp.cortina, fecho: tp.fecho }, legendas }
  fs.writeFileSync(path.join(proj, 'video.js'), `// generated by render.mjs from ${path.basename(jsonP)} — do not edit\n` +
    `const VIDEO = ${JSON.stringify({ titulo: cfg.nome, duracao: dur, formatos: [F], plataforma: null, fontes: familias, fundo: marca.cores.fundo, grao: 0, impactos: [], selo: null, ...(cfg.textoFora ? { texto: 'fora-da-imagem' } : {}) }, null, 1)}\n` +
    `const PARAM = ${JSON.stringify(PARAM, null, 1)}\n`)
  const mudo = path.join(proj, 'out', `${F}.mp4`)
  const extra = modo === 'final' ? ['--sub', '4', '--crf', '16', '--preset', 'medium'] : []
  if (fs.existsSync(mudo)) fs.rmSync(mudo)
  const r = spawnSync(process.execPath, [path.join(skill, 'scripts', 'render.cjs'), '--project', proj, '--mode', modo, '--format', F, '--out', `out/${F}.mp4`, '--no-sheet', ...extra], { stdio: 'inherit' })
  if (!fs.existsSync(mudo)) { console.error(`the ${F} render did not come out`); process.exit(r.status || 1) }
  if (r.status !== 0) console.error(`WARNING: the ${F} render finished with console warnings (above) — fix them before delivering`)
  const final = path.join(saida, `${cfg.nome}-${variacao === 'corte' ? '' : variacao + '-'}${F}.mp4`)
  const falas = [[fA, tp.a], [fD, tp.d]].filter(([f]) => f.arquivo)
  if (falas.length) {
    const ins = falas.flatMap(([f]) => ['-i', f.arquivo])
    const fil = falas.map(([, t0], i) => `[${i + 1}:a]aresample=48000,adelay=${Math.round(t0 * 1000)}|${Math.round(t0 * 1000)}[a${i}]`).join(';') +
      `;${falas.map((_, i) => `[a${i}]`).join('')}amix=inputs=${falas.length}:normalize=0,apad,atrim=0:${dur}[voz]`
    execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', mudo, ...ins, '-filter_complex', fil, '-map', '0:v', '-map', '[voz]', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '256k', '-shortest', '-movflags', '+faststart', final])
  } else if (trilha) {   // junta e confere a entrega (duração, loudness, pico), já em AAC
    const v = spawnSync(process.execPath, [path.join(skill, 'scripts', 'finalize.mjs'), '--project', proj, '--video', mudo, '--audio', 'audio/soundtrack.wav', '--out', final], { stdio: 'inherit', timeout: 180000 })
    if (v.status !== 0) console.error(`WARNING: finalizar flagged something in the ${F} delivery (above)`)
  } else fs.copyFileSync(mudo, final)
  if (cfg.aberturaLogo) {   // o logo no começo (scripts/opening.mjs), antes da folha
    try { console.log(relatar(aberturaDoJson(final, cfg.aberturaLogo, path.dirname(path.resolve(jsonP))))) } catch (e) { console.error(`✗ ${F}: ${e.message}`); process.exitCode = 1 }
  }
  const D = execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', final]).toString().trim()
  const [S, Tl] = TAMANHOS[F][0] > TAMANHOS[F][1] ? ['480:-1', '6x4'] : F === '9x16' ? ['270:-1', '8x3'] : ['360:-1', '6x4']
  const folha = path.join(saida, `sheet-${path.basename(final, '.mp4')}.png`)
  execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', final, '-vf', `fps=24/${D},scale=${S},tile=${Tl}`, '-frames:v', '1', folha])
  console.log(`✓ ${final} (${(+D).toFixed(2)} s)  contact sheet: ${folha}`)
}
console.log(`times: click ${tp.clique.toFixed(2)} s · curtain ${tp.cortina.toFixed(2)} s · closing ${tp.fecho.toFixed(2)} s · total ${dur.toFixed(2)} s`)
