#!/usr/bin/env node
// Molde infinite-zoom: zoom contínuo em 3 ou 4 níveis; o detalhe de cada tela vira a tela seguinte, sem corte.
//   node render.mjs <parametros.json> --out <folder> [--mode draft|final] [--formats 16x9,9x16] [--no-sound]
//                       [--capture <folder>] [--recapture] [--assemble-only] [--no-check]
// 1. confere o JSON (cada erro diz o que fazer; params.mjs);
// 2. as telas: <captura>/niveis.json e nivel-<n>.jpg (padrão <output>/capture-<name>); se não existem, ou se a captura ou
//    os níveis do JSON mudaram (a assinatura no niveis.json), ou com --recapture, captura de novo (capture.mjs);
// 3. monta a obra em <output>/.work-<name>/ (index.html?f=9x16&t=4 mostra um instante; ?play toca sem som): engine.js da
//    skill, scene.js, params.js, video.js, media/ (as telas e o logo) e fonts/ (a família do JSON: o fonts.css que já
//    estiver lá vale; senão o scripts/fonts.mjs baixa);
// 4. checa cada formato (scripts/frames.cjs --check: texto sobre a tela, colisão, área segura; --no-check pula);
// 5. a trilha da skill (assets/audio/arrange_series.py) como protagonista, com um whoosh em cada mergulho e o acento no
//    logo (precisa de Python com numpy e scipy; --no-sound sai mudo);
// 6. render de cada formato (scripts/render.cjs), som junto e conferido (scripts/finalize.mjs) e a folha de quadros.
// Sai <output>/<name>-<format>[-draft].mp4 e <output>/<name>-<format>[-draft]-sheet.png. OLHE a folha.
// Nada da marca aqui: cores, fonte, logo e textos vêm do JSON.
import fs from 'node:fs'
import path from 'node:path'
import { spawnSync, execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { acharPython } from '../../scripts/where.cjs'
import { conferir, caminho, linhaDoTempo, folhaDaTrilha, assinaturaCaptura } from './params.mjs'
import { aberturaDoJson, relatar } from '../../scripts/opening.mjs'

const AQUI = path.dirname(fileURLToPath(import.meta.url)), SKILL = path.resolve(AQUI, '..', '..')
const a = process.argv.slice(2), arg = (k, d) => { const i = a.indexOf('--' + k); return i >= 0 ? a[i + 1] : d }, tem = (k) => a.includes('--' + k)
const arq = a.find((x) => x.endsWith('.json'))
const USO = 'usage: node render.mjs <parametros.json> --out <folder> [--mode draft|final] [--formats 16x9,9x16] [--no-sound] [--capture <folder>] [--recapture] [--assemble-only] [--no-check]'
if (!arq || !arg('out')) { console.error(USO); process.exit(1) }
const base = path.dirname(path.resolve(arq))
const falha = (m) => { console.error('✗ ' + m); process.exit(1) }
let P
try { P = JSON.parse(fs.readFileSync(arq, 'utf8')) } catch (e) { falha(`could not read ${arq}: ${e.message}`) }
if (arg('formats')) P = { ...P, formatos: arg('formats').split(',') }
const { erros, cfg } = conferir(P, base)
if (erros.length) { for (const e of erros) console.error('✗ ' + e); process.exit(1) }
const modo = arg('mode', 'draft'), saida = path.resolve(arg('out'))
if (!['draft', 'final'].includes(modo)) falha('--mode draft | final')

// ── capturas ──────────────────────────────────────────────────────────────────────────────────────
const pastaCap = path.resolve(arg('capture', path.join(saida, `capture-${cfg.nome}`)))
const manifesto = path.join(pastaCap, 'niveis.json')
const atual = fs.existsSync(manifesto) ? JSON.parse(fs.readFileSync(manifesto, 'utf8')) : null
let niveis = atual?.niveis
if (tem('recapture') || !atual || atual.assinatura !== assinaturaCaptura(cfg)) {
  console.log(`${atual ? 'the capture changed in the JSON: ' : ''}capturing ${cfg.niveis.length} levels in ${pastaCap} …`)
  const { capturar } = await import('./capture.mjs')
  try { niveis = await capturar(cfg, base, pastaCap) } catch (e) { falha(e.message) }
}
const LN = linhaDoTempo(cfg, niveis)

// ── obra ──────────────────────────────────────────────────────────────────────────────────────────
const obra = path.join(saida, `.work-${cfg.nome}`)
fs.mkdirSync(path.join(obra, 'media'), { recursive: true })
for (const f of ['index.html', 'scene.js']) fs.copyFileSync(path.join(AQUI, f), path.join(obra, f))
fs.copyFileSync(path.join(SKILL, 'assets', 'template', 'engine.js'), path.join(obra, 'engine.js'))
for (const n of niveis) fs.copyFileSync(path.join(pastaCap, n.arquivo), path.join(obra, 'media', n.arquivo))
const logoArq = caminho(base, cfg.fecho.logo)
fs.copyFileSync(logoArq, path.join(obra, 'media', 'logo.png'))
const tamPng = (f) => { const b = fs.readFileSync(f); return b.toString('ascii', 1, 4) === 'PNG' ? [b.readUInt32BE(16), b.readUInt32BE(20)] : null }
const tl = tamPng(logoArq)
const css = path.join(obra, 'fonts', 'fonts.css')
fs.mkdirSync(path.dirname(css), { recursive: true })
if (cfg.marca.fonte && !(fs.existsSync(css) && fs.readFileSync(css, 'utf8').includes(`"${cfg.marca.fonte}"`))) {
  const r = spawnSync(process.execPath, [path.join(SKILL, 'scripts', 'fonts.mjs'), obra, cfg.marca.fonte], { stdio: 'inherit' })
  if (r.status !== 0) falha(`the font did not download: ${cfg.marca.fonte} (for the examples' Inter, with no network, run first: node ${path.join(SKILL, 'scripts', 'example-fonts.mjs')} ${obra})`)
}
if (!fs.existsSync(css)) fs.writeFileSync(css, '/* no custom font: the system one */\n')
const PARAMS = { nome: cfg.nome, leiaute: cfg.leiaute, indice: !!cfg.indice, aspectoJanela: cfg.aspectoJanela, textos: cfg.textos, marca: cfg.marca,
  fecho: { ...cfg.fecho, logo: 'media/logo.png', proporcao: tl ? tl[0] / tl[1] : 4 } }
fs.writeFileSync(path.join(obra, 'params.js'), `// generated by render.mjs from ${path.basename(arq)}: edit the JSON, not this file\nconst PARAMS = ${JSON.stringify(PARAMS)}\nconst LINHA = ${JSON.stringify(LN)}\n`)
const VIDEO = { titulo: cfg.nome, duracao: LN.dur, formatos: cfg.formatos, plataforma: { '16x9': 'youtube', '19x9': 'youtube', '21x9': 'youtube', '9x16': 'reels', '1x1': 'feed' },
  fontes: cfg.marca.fonte ? [cfg.marca.fonte] : [], fundo: cfg.marca.cores.fundo, grao: 0, impactos: [], texto: 'fora-da-imagem', audio: 'audio/soundtrack.wav' }
fs.writeFileSync(path.join(obra, 'video.js'), `const VIDEO = ${JSON.stringify(VIDEO)}\n`)
console.log(`build: ${obra}\nduration ${LN.dur.toFixed(2)} s · ${niveis.length} levels · dives at ${LN.parte.map((t) => t.toFixed(2)).join(', ')} s · closing at ${LN.fechoChega.toFixed(2)} s`)
if (tem('assemble-only')) process.exit(0)

// ── checagem: texto sobre a tela, colisão e área segura ───────────────────────────────────────────
if (!tem('no-check')) for (const f of cfg.formatos) {
  const r = spawnSync(process.execPath, [path.join(SKILL, 'scripts', 'frames.cjs'), '--project', obra, '--check', '--format', f], { stdio: 'inherit' })
  if (r.status !== 0) falha(`the ${f} check flagged something (above): fix it before the render, or run with --no-check to see the video anyway`)
}

// ── trilha ────────────────────────────────────────────────────────────────────────────────────────
let trilha = false
if (!tem('no-sound')) {
  const PY = acharPython()
  if (!PY) console.error(`WARNING: no Python with numpy and scipy, the video comes out silent. Run once: node ${path.join(SKILL, 'scripts', 'environment.mjs')} --fix`)
  else {
    const { folha, ident } = folhaDaTrilha(cfg, LN)
    if (!cfg.trilha?.identidade) console.log('soundtrack: no "trilha.identidade" in the JSON, using a neutral identity (declare the audience\'s music genre: assets/audio/API.md)')
    const dir = path.join(obra, 'audio')
    fs.mkdirSync(dir, { recursive: true })
    fs.rmSync(path.join(dir, 'soundtrack.wav'), { force: true })
    fs.writeFileSync(path.join(dir, 'sheet.json'), JSON.stringify(folha, null, 1) + '\n')
    fs.writeFileSync(path.join(dir, 'identity.json'), JSON.stringify(ident, null, 2) + '\n')
    const r = spawnSync(PY, [path.join(SKILL, 'assets', 'audio', 'arrange_series.py'), 'identity.json', 'sheet.json'], { cwd: dir, stdio: 'inherit' })
    if (r.status !== 0 || !fs.existsSync(path.join(dir, 'soundtrack.wav'))) falha('the soundtrack did not come out (see above); run with --no-sound to output a silent video')
    trilha = true
  }
}

// ── render, som e folha ───────────────────────────────────────────────────────────────────────────
for (const f of cfg.formatos) {
  const mudo = path.join(obra, 'out', `${f}-${modo}.mp4`)
  const extra = modo === 'final' ? ['--sub', String(cfg.sub ?? 4), '--crf', '16', '--preset', 'medium'] : []
  const r = spawnSync(process.execPath, [path.join(SKILL, 'scripts', 'render.cjs'), '--project', obra, '--mode', modo, '--format', f, '--out', `out/${f}-${modo}.mp4`, '--no-sheet', ...extra], { stdio: 'inherit' })
  if (r.status !== 0) { console.error(`✗ ${f}: render exited with ${r.status}`); process.exitCode = 1; continue }
  const final = path.join(saida, `${cfg.nome}-${f}${modo === 'final' ? '' : '-draft'}.mp4`)
  if (trilha) {
    const v = spawnSync(process.execPath, [path.join(SKILL, 'scripts', 'finalize.mjs'), '--project', obra, '--video', mudo, '--audio', 'audio/soundtrack.wav', '--out', final], { stdio: 'inherit', timeout: 180000 })
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
