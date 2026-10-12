#!/usr/bin/env node
// Monta o vídeo em capítulos: junta as cenas na ordem, por formato, e põe a voz no lugar.
//   node assemble.mjs <project> [--narration voice/<version>/narration.json] [--profile reels|calmo] [--speech-at 1.4]
//                   [--formats 16x9,19x9,21x9,9x16] [--bpm 120] [--soundtrack] [--deliver <folder> [--name base]]
// Sem --formats: os formatos que TODAS as cenas já têm renderizados (um Reels só 9:16 não pede 16:9).
// --soundtrack: compõe a trilha sobre a folha (audio/identity.json + arrange_series.py), mede (verify.py; a −14 LUFS e,
// se reprovar, a −16) e, com --deliver, roda o finalize.mjs de cada formato: o vídeo sai pronto e conferido.
// Cenas: as pastas scenes/NN-nome com out/<format>.mp4, em ordem. 00-… é a abertura, 99-… o fecho, NN o capítulo
// NN (a fala { "capitulo": NN } da locução). Cada fala começa em <início da cena> + --speech-at.
// Sai: out/assembled-<format>.mp4 (mudo), audio/voz.wav, audio/sheet.json (duração, bloco voz, whoosh em cada
// passagem de capítulo) e out/assembly.json (onde cada cena e cada fala caem). Depois: a trilha
// (references/soundtrack.md, com mix_voz) e o finalize.mjs de cada formato.
// Com <project>/opening-logo.json ({ "logo": "media/…png", "fundo": "#…", "dur": 1 }), cada entrega ganha a abertura com
// o logo (scripts/opening.mjs) depois de conferida.
import fs from 'node:fs'
import path from 'node:path'
import { execFileSync, spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { acharPython } from '../where.cjs'
import { aberturaDoJson, relatar } from '../opening.mjs'

const args = process.argv.slice(2)
const opt = (k, d) => { const i = args.indexOf('--' + k); return i >= 0 ? args[i + 1] : d }
const proj = args.find((a, i) => !a.startsWith('--') && !(i > 0 && args[i - 1].startsWith('--')))
if (!proj) { console.error('usage: node assemble.mjs <project> [--narration voice/<version>/narration.json] [--profile reels] [--speech-at 1.4]'); process.exit(1) }
const projeto = path.resolve(proj)
const falaEm = +opt('speech-at', 1.4)
const SAIDA = 0.5
const r3 = (v) => Math.round(v * 1000) / 1000
const duracao = (f) => +execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', f]).toString().trim()
const erro = (m) => { console.error(m); process.exit(1) }
// A narração só vem nos pacotes com voz: sem scripts/chapters/falas.mjs, o vídeo em capítulos sai com a trilha e o
// texto da tela.
const FALAS = new URL('./falas.mjs', import.meta.url)
// Ponto de extensão opcional: sem scripts/app/canal.mjs no pacote, nada é avisado para fora.
const CANAL = new URL('../app/canal.mjs', import.meta.url)
const vb = fs.existsSync(CANAL) ? await import(CANAL.href) : null
await vb?.checarDono({ onde: `assemble ${path.basename(projeto)}` })
await vb?.avisar('montagem', `assembling ${path.basename(projeto)}`)

// a cena de exemplo do molde (01-example) nunca entra no vídeo
const cenas = fs.readdirSync(path.join(projeto, 'scenes')).filter((c) => /^\d\d-/.test(c) && !/-example$/.test(c)).sort().map((nome) => ({ nome, n: +nome.slice(0, 2) }))
if (!cenas.length) erro(`there are no NN-name scenes in ${path.join(projeto, 'scenes')}`)
const temTodas = (f) => cenas.every((c) => fs.existsSync(path.join(projeto, 'scenes', c.nome, 'out', `${f}.mp4`)))
const formatos = opt('formats') ? opt('formats').split(',') : ['16x9', '19x9', '21x9', '9x16', '1x1', '4x5'].filter(temTodas)
if (!formatos.length) erro('no format is rendered in every scene: run render.mjs for each one (the same --formats in all)')
const faltam = cenas.flatMap((c) => formatos.filter((f) => !fs.existsSync(path.join(projeto, 'scenes', c.nome, 'out', `${f}.mp4`))).map((f) => `${c.nome}/out/${f}.mp4`))
if (faltam.length) erro(`missing renders (node render.mjs ${projeto} <scene>):\n  ${faltam.join('\n  ')}`)

// a linha do tempo sai do primeiro formato; os outros têm de bater com ela
let t = 0
for (const c of cenas) {
  c.dur = duracao(path.join(projeto, 'scenes', c.nome, 'out', `${formatos[0]}.mp4`))
  for (const f of formatos.slice(1)) {
    const d = duracao(path.join(projeto, 'scenes', c.nome, 'out', `${f}.mp4`))
    if (Math.abs(d - c.dur) > 0.02) erro(`${c.nome}: ${formatos[0]} is ${c.dur.toFixed(3)} s and ${f} is ${d.toFixed(3)} s. Render both with the same duracao.`)
  }
  c.ini = r3(t); t += c.dur
}
const total = r3(t)

fs.mkdirSync(path.join(projeto, 'out'), { recursive: true })
for (const f of formatos) {
  const lista = path.join(projeto, 'out', `lista-${f}.txt`)
  fs.writeFileSync(lista, cenas.map((c) => `file '${path.join(projeto, 'scenes', c.nome, 'out', `${f}.mp4`).replace(/'/g, "'\\''")}'`).join('\n') + '\n')
  const saida = path.join(projeto, 'out', `assembled-${f}.mp4`)
  execFileSync('ffmpeg', ['-v', 'error', '-y', '-f', 'concat', '-safe', '0', '-i', lista, '-c', 'copy', '-an', '-movflags', '+faststart', saida])
  fs.rmSync(lista)
  const d = duracao(saida)
  if (Math.abs(d - total) > 0.05) erro(`out/assembled-${f}.mp4 is ${d.toFixed(3)} s, the sum of the scenes is ${total} s: the scenes do not share the same fps/codec. Render all of them in the same --mode.`)
  console.log(`✓ out/assembled-${f}.mp4 · ${cenas.length} scenes · ${d.toFixed(2)} s`)
  await vb?.mostrar(saida, `Assembled, no sound yet: ${path.basename(projeto)} ${f}`)
}

let falas = [], LV = null
const locArg = opt('narration')
if (locArg) {
  if (!fs.existsSync(FALAS)) erro('--narration is for voiceover, and this skill has no voice: remove --narration (the video comes out with the soundtrack and the on-screen text).')
  const [F, L] = await Promise.all([import(FALAS.href), import(new URL('../tutorial/locucao.mjs', import.meta.url).href)])
  LV = L
  try { falas = F.colocarFalas(path.resolve(projeto, locArg), cenas, { falaEm, saida: SAIDA }) } catch (e) { erro(e.message) }
  const semFala = cenas.filter((c) => c.n !== 0 && c.n !== 99 && !falas.some((f) => f.onde?.capitulo === c.n))
  if (semFala.length) console.log(`  warning: chapter with no voiceover line: ${semFala.map((c) => c.nome).join(', ')}`)
  fs.mkdirSync(path.join(projeto, 'audio'), { recursive: true })
  LV.escreverVozWav(falas, total, path.join(projeto, 'audio', 'voz.wav'))
  console.log(`✓ audio/voz.wav · ${falas.length} lines in place (scene start + ${falaEm} s)`)
}

const folhaP = path.join(projeto, 'audio', 'sheet.json')
const folha = fs.existsSync(folhaP) ? JSON.parse(fs.readFileSync(folhaP, 'utf8')) : {
  titulo: path.basename(projeto), bpm: +opt('bpm', 120), compasso: 4, taxa: 48000, saida: 'soundtrack.wav',
  semente: Math.floor(Date.now() / 1000) % 100000000, silencios: [], secoes: [], marcos: [],
}
folha.duracao = total
// o fade nunca começa antes de a última palavra terminar (a 2,5 s do fim ele comia o "link." do fecho)
const fimFala = falas.length ? Math.max(...falas.map((f) => f.fim)) : 0
folha.fade = [r3(Math.min(total - 0.5, Math.max(total - 2.5, fimFala + 0.3))), total]
// 20 ms de zero digital no começo: a cama começava na amostra 0 com valor alto e o verify.py acusava clique
if (!(folha.silencios || []).some(([a]) => a === 0)) folha.silencios = [[0, 0.02], ...(folha.silencios || [])]
// a passagem do cartão do índice é a transição: um whoosh no pico dela, em cada capítulo
folha.marcos = [...(folha.marcos || []).filter((m) => m.auto !== 'montar'),
  ...cenas.slice(1).map((c) => ({ t: r3(c.ini + 0.3), evento: `index card: ${c.nome}`, efeito: 'whoosh', opcional: true, auto: 'montar' }))]
  .sort((a, b) => a.t - b.t)
if (falas.length) Object.assign(folha, { loudness_lufs: -14, teto_dbtp: -1.0, voz: LV.blocoFolha(falas, opt('profile', 'reels')) })
else Object.assign(folha, { loudness_lufs: folha.loudness_lufs ?? -14, teto_dbtp: folha.teto_dbtp ?? -1.5 })
fs.writeFileSync(folhaP, JSON.stringify(folha, null, 2) + '\n')
fs.writeFileSync(path.join(projeto, 'out', 'assembly.json'), JSON.stringify({
  duracao: total, fala_em: falaEm,
  cenas: cenas.map((c) => ({ nome: c.nome, ini: c.ini, dur: r3(c.dur) })),
  falas: falas.map((f) => ({ id: f.id, som: r3(f.som), fim: r3(f.fim), texto: f.texto })),
}, null, 1) + '\n')
console.log(`✓ audio/sheet.json · ${total} s · ${folha.marcos.length} markers${falas.length ? ' · voice block' : ''}`)

if (args.includes('--soundtrack')) {
  const dirA = path.join(projeto, 'audio')
  if (!fs.existsSync(path.join(dirA, 'identity.json'))) erro('--soundtrack needs audio/identity.json: the audience\'s genre, in schema v2 (assets/audio/API.md). Write it before assembling.')
  const PY = acharPython({ extras: [path.join(projeto, '.venv', 'bin', 'python'), path.join(projeto, '..', '.venv', 'bin', 'python')] })
  if (!PY) erro(`--soundtrack needs a Python with numpy and scipy, and I found none. Run once: node ${fileURLToPath(new URL('../environment.mjs', import.meta.url))} --fix`)
  let ok = false
  for (const lufs of [-14, -16]) {
    folha.loudness_lufs = lufs
    fs.writeFileSync(folhaP, JSON.stringify(folha, null, 2) + '\n')
    const r = spawnSync(PY, ['arrange_series.py', 'identity.json', 'sheet.json'], { cwd: dirA, encoding: 'utf8' })
    if (r.status !== 0) erro(`the soundtrack did not come out (${PY}):\n${(r.stderr || r.stdout || '').slice(-1500)}`)
    const v = spawnSync(PY, ['verify.py', 'sheet.json'], { cwd: dirA, encoding: 'utf8' })
    fs.writeFileSync(path.join(dirA, 'verifica.txt'), v.stdout || '')
    if (v.status === 0) { console.log(`✓ audio/soundtrack.wav · verify.py all OK at ${lufs} LUFS`); ok = true; break }
    console.log(`  soundtrack at ${lufs} LUFS failed: ${(v.stdout || '').split('\n').filter((l) => /FAILED|FALHOU/.test(l)).join(' | ')}`)
  }
  if (!ok) erro('the soundtrack failed both attempts: read audio/verifica.txt')
  const entrega = opt('deliver')
  if (entrega) {
    fs.mkdirSync(path.resolve(entrega), { recursive: true })
    for (const f of formatos) {
      const destino = path.resolve(entrega, `${opt('name', path.basename(projeto))}-${f}.mp4`)
      const v = spawnSync(process.execPath, [path.join(projeto, 'tools', 'finalize.mjs'), '--project', projeto, '--video', `out/assembled-${f}.mp4`, '--audio', 'audio/soundtrack.wav', '--out', destino], { encoding: 'utf8', timeout: 300000 })
      if (!/delivery verified\.|entrega verificada\./.test(v.stdout || '')) erro(`finalizar flagged a problem in ${f}:\n${(v.stdout || '') + (v.stderr || '')}`)
      console.log(`✓ ${destino} · delivery verified`)
      const arqAbertura = path.join(projeto, 'opening-logo.json')
      if (fs.existsSync(arqAbertura)) {
        try { console.log(relatar(aberturaDoJson(destino, JSON.parse(fs.readFileSync(arqAbertura, 'utf8')), projeto))) } catch (e) { erro(`the logo opening failed in ${f}: ${e.message}`) }
      }
      await vb?.mostrar(destino, `Final: ${path.basename(destino)}`)
    }
  }
  process.exit(0)
}
console.log(`  next: the soundtrack over the cue sheet (references/soundtrack.md §4${falas.length ? ', with mix_voz' : ''}) → audio/soundtrack.wav, and then, per format:
  node ${path.join(projeto, 'tools', 'finalize.mjs')} --project ${projeto} --video out/assembled-${formatos[0]}.mp4 --audio audio/soundtrack.wav --out <delivery>
  (or run again with --soundtrack --deliver <folder>: it composes, measures and finalizes on its own)`)
