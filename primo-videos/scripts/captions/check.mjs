#!/usr/bin/env node
// Confere um vídeo legendado contra o mesmo trecho sem legenda:
//   node check.mjs --on a.mp4 --base b.mp4 --report a.json --sheet comp/audio/sheet.json --voice comp/audio/voz.wav [--tol 0.08]
// 1. cada palavra aparece a no máximo `tol` s do tempo dela (a diferença contra o vídeo sem legenda, no retângulo da palavra);
// 2. cobertura: o que há por baixo da legenda no vídeo sem legenda (detalhe do retângulo contra a média do quadro, e pixels
//    da cor de acento — o realce e o dedo do app — que a legenda taparia);
// 3. volume: o finalize.mjs do motor (loudness, true peak, 1º som de cada fala e a voz ≥ 15 dB acima do que toca debaixo).
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { probe } from './caption.mjs'

const aqui = path.dirname(fileURLToPath(import.meta.url))
const argv = process.argv.slice(2)
const arg = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 ? argv[i + 1] : d }
const r3 = (x) => Math.round(x * 1000) / 1000
const falhas = []
const ok = (c, m) => { console.log(`${c ? '✓' : '✗'} ${m}`); if (!c) falhas.push(m) }

function quadros(video, { t0, dur, x, y, w, h, fps, cor = false }) {
  const r = spawnSync('ffmpeg', ['-v', 'error', '-ss', String(Math.max(0, t0)), '-t', String(dur), '-i', video, '-vf', `fps=${fps},crop=${w}:${h}:${x}:${y},format=${cor ? 'rgb24' : 'gray'}`, '-f', 'rawvideo', '-'], { maxBuffer: 1 << 28 })
  const n = (cor ? 3 : 1) * w * h
  return Array.from({ length: Math.floor(r.stdout.length / n) }, (_, i) => r.stdout.subarray(i * n, (i + 1) * n))
}

const ligado = path.resolve(arg('on')), base = path.resolve(arg('base'))
const rel = JSON.parse(fs.readFileSync(path.resolve(arg('report')), 'utf8'))
const tol = +arg('tol', 0.08)
const info = probe(ligado)
const fps = info.fps

// 1 · aparição de cada palavra
const desvios = []
for (const e of rel.estados) {
  const [a, b, c, d] = e.caixa
  const x = Math.max(0, Math.floor(a) - 2), y = Math.max(0, Math.floor(b) - 2)
  const w = Math.min(info.w - x, Math.ceil(c - a) + 4) & ~1, h = Math.min(info.h - y, Math.ceil(d - b) + 4) & ~1
  const t0 = Math.max(0, e.ini - 0.25), dur = 0.6
  // O miolo da palavra: os pixels claros que a legenda pintou (contra o vídeo sem legenda) logo depois do tempo dela, em
  // ini + tolerância, quando ela é a palavra em destaque. O instante é o primeiro quadro em que 70% desse miolo já está
  // com a mesma cor. Contar só "pixels que mudaram" atribuía à palavra a linha anterior, quando ela ocupa o mesmo
  // retângulo e entra dentro da janela (linha de 0,26 s: "Eu sou" antes de "a apresentadora," acusava o "a" 233 ms adiantado); e
  // comparar a mancha inteira (letra e contorno) não separa um texto do outro, porque o contorno enche o retângulo.
  const L = quadros(ligado, { t0, dur, x, y, w, h, fps, cor: true }), B = quadros(base, { t0, dur, x, y, w, h, fps, cor: true })
  const dist = (q, r, k) => Math.abs(q[k] - r[k]) + Math.abs(q[k + 1] - r[k + 1]) + Math.abs(q[k + 2] - r[k + 2])
  const brilho = (q, k) => 0.299 * q[k] + 0.587 * q[k + 1] + 0.114 * q[k + 2]
  const ultimo = Math.min(L.length, B.length) - 1
  const iRef = ultimo < 0 ? -1 : Math.min(ultimo, Math.round((e.ini + tol - t0) * fps))
  const miolo = []
  if (iRef >= 0) for (let k = 0; k < L[iRef].length; k += 3) if (dist(L[iRef], B[iRef], k) > 120 && brilho(L[iRef], k) > 140) miolo.push(k)
  const i = miolo.length < 12 ? -1 : L.findIndex((q, n) => n <= ultimo && miolo.filter((k) => dist(q, L[iRef], k) < 90).length >= miolo.length * 0.7)
  desvios.push({ palavra: e.textos[e.palavra], esperado: e.ini, visto: i < 0 ? null : r3(t0 + i / fps), pixels: miolo.length })
}
const d = desvios.map((v) => (v.visto == null ? Infinity : Math.abs(v.visto - v.esperado)))
const pior = Math.max(...d), media = d.reduce((s, v) => s + v, 0) / d.length
const ruins = desvios.filter((v, i) => d[i] > tol)
ok(ruins.length === 0, `${desvios.length} words: the worst appears ${(pior * 1000).toFixed(0)} ms from its time, average ${(media * 1000).toFixed(0)} ms (tolerance ${tol * 1000} ms)${ruins.length ? ' — outside: ' + ruins.map((v) => `${v.palavra}@${v.esperado}→${v.visto}`).join(', ') : ''}`)

// 2 · cobertura: o que a legenda tapa no vídeo sem legenda
let acento = 0, relDetalhe = []
const cobertas = []
for (const e of rel.estados) {
  const [a, b, c, dd] = e.caixa
  // o retângulo da palavra inclui a folga da entrelinha: a cobertura vale para o miolo (18% a menos em cima e embaixo)
  const folga = (dd - b) * 0.18
  const x = Math.max(0, Math.floor(a)), y = Math.max(0, Math.floor(b + folga))
  const w = Math.min(info.w - x, Math.ceil(c - a)) & ~1, h = Math.min(info.h - y, Math.ceil(dd - b - 2 * folga)) & ~1
  const q = quadros(base, { t0: e.ini + 0.03, dur: 0.1, x, y, w, h, fps, cor: true })[0]
  if (!q) continue
  let n = 0
  for (let k = 0; k < q.length; k += 3) { const [R, G, Bl] = [q[k], q[k + 1], q[k + 2]]; if (R > 225 && G > 50 && G < 140 && Bl < 70) n++ }
  acento += n
  if (n > 30) cobertas.push(`${e.textos[e.palavra]}@${e.ini}: ${n} px`)
}
for (const p of rel.plano) relDetalhe.push(p.custo / Math.max(1e-6, p.custoMedio))
const mediaRel = relDetalhe.reduce((s, v) => s + v, 0) / relDetalhe.length
ok(cobertas.length === 0, `coverage: no highlight or app finger (accent color) covered by the caption${cobertas.length ? ' — covered: ' + cobertas.join('; ') : ''} (${acento} accent px in the rectangles, total)`)
console.log(`  detail under the caption = ${(mediaRel * 100).toFixed(0)}% of the average detail of the frame (below 100% = the caption sat in a quieter band than the average); columns: ${[...new Set(rel.plano.map((p) => p.coluna))].join(', ')}`)

// 3 · volume, pelo finalize.mjs do motor, com a folha cortada para o trecho
if (arg('sheet')) {
  const folha = JSON.parse(fs.readFileSync(path.resolve(arg('sheet')), 'utf8'))
  const dur = r3(rel.ate - rel.de)
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'conferir-'))
  const sh = (t) => r3(t - rel.de)
  const falas = folha.voz.falas.filter((f, i) => folha.voz.trechos[i][0] >= rel.de && folha.voz.trechos[i][1] <= rel.ate)
  const idx = folha.voz.falas.map((f, i) => i).filter((i) => folha.voz.trechos[i][0] >= rel.de && folha.voz.trechos[i][1] <= rel.ate)
  const cortada = { ...folha, duracao: dur, silencios: [[0, 0.02]], fade: [r3(dur - 1.2), dur], secoes: [], marcos: [],
    voz: { ...folha.voz, arquivo: 'voz.wav', trechos: idx.map((i) => folha.voz.trechos[i].map(sh)), falas: falas.map((f) => ({ ...f, t: sh(f.t) })) } }
  fs.writeFileSync(path.join(tmp, 'sheet.json'), JSON.stringify(cortada))
  const vz = path.resolve(arg('voice'))
  spawnSync('ffmpeg', ['-v', 'error', '-y', '-ss', String(rel.de), '-t', String(dur), '-i', vz, '-c:a', 'pcm_s16le', path.join(tmp, 'voz.wav')])
  spawnSync('ffmpeg', ['-v', 'error', '-y', '-i', ligado, '-vn', '-c:a', 'pcm_s16le', '-ar', '48000', path.join(tmp, 'audio.wav')])
  const f = spawnSync('node', [path.join(aqui, '..', 'finalize.mjs'), '--project', tmp, '--video', ligado, '--audio', path.join(tmp, 'audio.wav'), '--sheet', path.join(tmp, 'sheet.json'), '--out', path.join(tmp, 'final.mp4')], { encoding: 'utf8' })
  const saidaF = (f.stdout || '') + (f.stderr || '')
  for (const l of saidaF.split('\n').filter((l) => /^[✓✗]/.test(l))) { console.log('  finalizar ' + l); if (l.startsWith('✗')) falhas.push(l) }
  ok(f.status === 0 && /delivery verified/.test(saidaF), `engine finalize.mjs: ${f.status === 0 ? 'delivery verified' : 'failed'}`)
  fs.rmSync(tmp, { recursive: true, force: true })
}
if (arg('out')) fs.writeFileSync(path.resolve(arg('out')), JSON.stringify({ desvios, pior_ms: Math.round(pior * 1000), media_ms: Math.round(media * 1000), acento_px: acento, detalhe_relativo: r3(mediaRel), falhas }, null, 1))
process.exit(falhas.length ? 1 : 0)
