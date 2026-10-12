#!/usr/bin/env node
// Junta vídeo final + trilha, gera o pôster e VERIFICA a entrega.
//   node finalize.mjs --project . --video out/final-16x9.mp4 --audio audio/soundtrack.wav --out ~/Desktop/marca-video/marca-16x9.mp4
// Checagens: resolução/fps, duração de vídeo = áudio = VIDEO.duracao (±1 quadro), loudness e true peak,
// e — se houver audio/sheet.json — silêncio real nas janelas de "silencios" e som logo depois delas
// (prova de que a sincronia sobreviveu ao AAC). Código de saída 0 = tudo ok; 1 = algo falhou.
// Folha com "voz": o teto de true peak passa a ser o da folha, e cada fala é conferida no áudio já em AAC —
// o 1º som no tempo da folha (±1 quadro) e a voz destacada do que toca debaixo dela (prova de que a trilha cedeu).
import { execFileSync, spawnSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'

const argv = process.argv.slice(2)
const arg = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 ? argv[i + 1] : d }
const exp = (p) => (p && p.startsWith('~') ? path.join(os.homedir(), p.slice(1)) : p)
const projeto = path.resolve(arg('project', '.'))
const video = path.resolve(projeto, exp(arg('video')))
const audio = path.resolve(projeto, exp(arg('audio', 'audio/soundtrack.wav')))
const saida = path.resolve(exp(arg('out', path.join(projeto, 'out', 'delivery.mp4'))))
const folhaP = path.resolve(projeto, arg('sheet', 'audio/sheet.json'))
const folha = fs.existsSync(folhaP) ? JSON.parse(fs.readFileSync(folhaP, 'utf8')) : null
const ff = (a) => execFileSync('ffmpeg', ['-hide_banner', '-nostats', ...a], { stdio: ['ignore', 'pipe', 'pipe'] })
// medições (ebur128, volumedetect) saem no stderr do ffmpeg, com código 0
const ffErr = (a) => { const r = spawnSync('ffmpeg', ['-hide_banner', '-nostats', ...a], { encoding: 'utf8' }); return (r.stderr || '') + (r.stdout || '') }
const probe = (f) => JSON.parse(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'stream=codec_type,width,height,r_frame_rate,duration,sample_rate:format=duration', '-of', 'json', f]).toString())

fs.mkdirSync(path.dirname(saida), { recursive: true })
ff(['-loglevel', 'error', '-y', '-i', video, '-i', audio, '-map', '0:v', '-map', '1:a', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '320k', '-ar', '48000', '-movflags', '+faststart', saida])
const pr = probe(saida)
const v = pr.streams.find((s) => s.codec_type === 'video'), a = pr.streams.find((s) => s.codec_type === 'audio')
const fpsN = eval(v.r_frame_rate), dv = +v.duration, da = +a.duration
const dur = folha ? folha.duracao : dv
const poster = saida.replace(/\.mp4$/i, '') + '-poster.png'
ff(['-loglevel', 'error', '-y', '-ss', String(Math.max(0, dur - 0.1)), '-i', saida, '-frames:v', '1', poster])

const falhas = []
const ok = (cond, msg) => { console.log(`${cond ? '✓' : '✗'} ${msg}`); if (!cond) falhas.push(msg) }
console.log(`file: ${saida} (${(fs.statSync(saida).size / 1e6).toFixed(1)} MB)`)
ok(true, `video ${v.width}×${v.height} at ${fpsN.toFixed(2)} fps`)
ok(Math.abs(dv - dur) <= 1.5 / fpsN, `video duration ${dv.toFixed(3)} s (expected ${dur} s)`)
ok(Math.abs(da - dur) <= 0.03, `audio duration ${da.toFixed(3)} s`)
const eb = ffErr(['-i', saida, '-vn', '-af', 'ebur128=peak=true', '-f', 'null', '-'])
const I = +(eb.match(/I:\s+(-?[\d.]+) LUFS/g) || []).pop()?.match(/-?[\d.]+/)[0]
const TP = +(eb.match(/Peak:\s+(-?[\d.]+) dBFS/g) || []).pop()?.match(/-?[\d.]+/)[0]
const alvo = folha ? folha.loudness_lufs : -14
ok(Math.abs(I - alvo) <= 1.5, `loudness ${I} LUFS (target ${alvo})`)
const voz = folha && folha.voz
const teto = voz ? folha.teto_dbtp : -0.5
ok(TP <= teto, `true peak ${TP} dBTP` + (voz ? ` (sheet ceiling ${teto})` : ''))
const maxVol = (de, dur2) => +(ffErr(['-ss', String(de), '-t', String(dur2), '-i', saida, '-vn', '-af', 'volumedetect', '-f', 'null', '-']).match(/max_volume:\s+(-?[\d.]+)/) || [0, 0])[1]
for (const [s0, s1] of (folha && folha.silencios) || []) {
  const d = s1 - s0
  if (d < 0.03) continue
  const dentro = maxVol(s0 + 0.01, d - 0.02), depois = maxVol(s1, 0.08)
  ok(dentro <= -60, `silence ${s0}–${s1} s: peak ${dentro} dB`)
  ok(depois >= -30, `sound back at ${s1} s: peak ${depois} dB`)
}
if (voz) conferirVoz()
console.log(`poster: ${poster}`)
console.log(falhas.length ? `\n${falhas.length} problem(s) — fix them before delivering.` : '\ndelivery verified.')
process.exit(falhas.length ? 1 : 0)

// ---------------------------------------------------------------- voz: sincronia e destaque no AAC
// A voz da folha (voz.wav, a mesma que o compose.mjs pôs na linha do tempo) é o gabarito. Em cada trecho:
//  1. 1º som: janela de 10 ms a partir do instante, passo de 1 ms, acima de −45 dBFS na voz da folha (a mesma
//     régua do inicio_voz da locução);
//  2. atraso: correlação cruzada, em 300–3400 Hz a 8 kHz, entre o áudio do MP4 e a voz da folha. O 1º som no
//     MP4 é o 1º som da voz + o atraso, e tem de cair a ±1 quadro do início do trecho;
//  3. destaque: com o gabarito alinhado, compara o áudio nos momentos em que a voz está forte (até 6 dB abaixo
//     do pico dela) com os vãos entre as palavras (30 dB abaixo), onde só sobra a trilha. Precisa de ≥ 15 dB:
//     os 12 dB da garantia do mix mais os ~3 dB entre a sílaba forte e a média. Trilha que não cedeu fica
//     por volta de 9 dB.
function conferirVoz() {
  const DESTAQUE_MIN = 15
  const vozP = path.resolve(path.dirname(folhaP), voz.arquivo || 'voz.wav')
  if (!fs.existsSync(vozP)) { ok(false, `sheet voice not found: ${vozP}`); return }
  const quadro = 1 / fpsN
  const F = 'highpass=f=300,lowpass=f=3400'
  const dec = (f, sr, filtro) => {
    const b = execFileSync('ffmpeg', ['-v', 'error', '-i', f, '-vn', '-ac', '1', '-ar', String(sr), ...(filtro ? ['-af', filtro] : []), '-f', 'f32le', '-'],
      { maxBuffer: 1 << 30, stdio: ['ignore', 'pipe', 'pipe'] })
    const x = new Float32Array(b.length >> 2)
    for (let i = 0; i < x.length; i++) x[i] = b.readFloatLE(i << 2)
    return x
  }
  const quad = (x) => { const c = new Float64Array(x.length + 1); for (let i = 0; i < x.length; i++) c[i + 1] = c[i] + x[i] * x[i]; return c }
  const v48 = dec(vozP, 48000), c48 = quad(v48)
  const v8 = dec(vozP, 8000, F), m8 = dec(saida, 8000, F)
  const env = (x, c, sh, i0, i1) => {                 // RMS de 20 ms em dB, passo de 5 ms, de i0 a i1 (amostras a 8 kHz)
    const out = []
    for (let i = i0; i < i1; i += 40) {
      const a = Math.max(0, i - 80 - sh), b = Math.min(x.length, i + 80 - sh)
      out.push(b > a ? 10 * Math.log10((c[b] - c[a]) / (b - a) + 1e-14) : -140)
    }
    return out
  }
  const mediana = (a) => { const s = [...a].sort((p, q) => p - q); return s.length ? s[s.length >> 1] : NaN }
  const cv8 = quad(v8), cm8 = quad(m8)
  const lim = 10 ** (-45 / 20)
  voz.trechos.forEach(([a, b], k) => {
    let i = Math.max(0, Math.round((a - 0.1) * 48000))
    const fimB = Math.round(b * 48000)
    while (i + 480 < v48.length && i < fimB && Math.sqrt((c48[i + 480] - c48[i]) / 480) < lim) i += 48
    const on = i / 48000
    const L = Math.round(0.15 * 8000), j0 = Math.round((a - 0.2) * 8000), j1 = Math.round((b + 0.05) * 8000)
    let melhor = -Infinity, lag = 0
    for (let d = -L; d <= L; d++) {
      let s = 0
      for (let j = Math.max(0, j0, -d); j < Math.min(j1, v8.length, m8.length - d); j++) s += m8[j + d] * v8[j]
      if (s > melhor) { melhor = s; lag = d }
    }
    const atraso = lag / 8000, noMp4 = on + atraso
    ok(Math.abs(noMp4 - a) <= quadro + 1e-6, `line ${k + 1} at ${a.toFixed(3)} s: 1st sound in the MP4 at ${noMp4.toFixed(3)} s ` +
      `(${((noMp4 - a) * 1000).toFixed(1)} ms; tolerance ±1 frame = ${(quadro * 1000).toFixed(0)} ms)` +
      (Math.abs(noMp4 - a) > quadro ? ' — the voice in the audio is not where the sheet says' : ''))
    const i0 = Math.round((a + atraso) * 8000), i1 = Math.round((b + atraso) * 8000)
    const ev = env(v8, cv8, lag, i0, i1), em = env(m8, cm8, 0, i0, i1)
    const pico = [...ev].sort((p, q) => p - q)[Math.floor(0.95 * (ev.length - 1))]
    const forte = em.filter((_, n) => ev[n] >= pico - 6), vao = em.filter((_, n) => ev[n] <= pico - 30)
    if (vao.length < 3) { console.log(`  line ${k + 1}: no gap between words to measure the prominence`); return }
    const D = mediana(forte) - mediana(vao)
    ok(D >= DESTAQUE_MIN, `line ${k + 1}: the voice sits ${D.toFixed(1)} dB above what plays under it (minimum ${DESTAQUE_MIN})` +
      (D < DESTAQUE_MIN ? ' — the soundtrack did not duck under the voice' : ''))
  })
}
