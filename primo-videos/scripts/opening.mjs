#!/usr/bin/env node
// A abertura com o logo: ~1 s com o logo centrado sobre a cor de fundo, antes do vídeo. Por padrão o vídeo abre e
// fecha com o logo da marca (a opção openingLogo de cada marca: scripts/brand.mjs); os moldes chamam este passo quando o JSON tem "aberturaLogo", depois de o finalize.mjs conferir a
// entrega, e a folha de quadros já sai com ela.
//   node opening.mjs <video.mp4> --logo <png> [--background #F5F5F5] [--dur 1] [--width 620] [--out <mp4>] [--crf 16]
//   node opening.mjs <video.mp4> --json <parametros.json>     (o "aberturaLogo" do JSON do molde; sem ele, não faz nada)
// Sem --out, troca o próprio vídeo. O logo sobe um pouco e aparece em 0,45 s e fica até o corte; o som é um sopro
// curto (o whoosh da skill) que chega no logo, e a trilha do vídeo começa no corte, como estava. `largura` é em px num
// quadro de 1080 de lado menor (620 = o logo do fecho dos moldes) e acompanha o tamanho do quadro. Vídeo que já tem a
// abertura (a etiqueta "abertura=logo" no MP4) fica como está.
// Com voz, tudo o que estava no tempo do vídeo anda `dur` junto com ele: a legenda .srt ao lado do MP4 (<vídeo>.srt) sai
// deslocada ao lado da saída, e o MP4 guarda quanto a abertura somou (a etiqueta abertura_s), que o captions/caption.mjs
// soma às palavras e aos sons da folha.
// Confere: tamanho e fps iguais e duração = a do vídeo + dur (±1 quadro). Código 0 = ok; 1 = falhou; 2 = uso ou arquivo.
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'

const AQUI = path.dirname(fileURLToPath(import.meta.url))
const AUDIO = path.join(AQUI, '..', 'assets', 'audio')
const { acharPython } = createRequire(import.meta.url)('./where.cjs')

export class Falha extends Error {
  constructor(msg, codigo = 2) { super(msg); this.codigo = codigo }
}

const PADRAO = { fundo: '#F5F5F5', dur: 1, largura: 620, crf: 16 }
const ENTRADA = 0.45          // s: o logo sobe e aparece
const ANTES = 0.12            // s de entrada que já passaram no quadro 0: ele nunca sai vazio
const ETIQUETA = 'logo'

function sondar(arq) {
  const r = spawnSync('ffprobe', ['-v', 'error', '-show_entries', 'stream=codec_type,width,height,r_frame_rate,sample_rate:format=duration:format_tags=abertura,abertura_s', '-of', 'json', arq], { encoding: 'utf8' })
  if (r.status !== 0) throw new Falha(`could not read ${arq} with ffprobe (${String(r.stderr || r.error?.message || '').trim().split('\n')[0]}): check the file and whether ffmpeg is installed (brew install ffmpeg)`)
  const j = JSON.parse(r.stdout)
  const v = (j.streams || []).find((s) => s.codec_type === 'video')
  if (!v) throw new Falha(`${arq} has no video stream`)
  const [n, d] = String(v.r_frame_rate).split('/').map(Number)
  return {
    largura: v.width, altura: v.height, fpsTxt: v.r_frame_rate, fps: n / (d || 1),
    duracao: Number(j.format?.duration), audio: (j.streams || []).some((s) => s.codec_type === 'audio'),
    jaTem: (j.format?.tags?.abertura ?? j.format?.tags?.ABERTURA) === ETIQUETA,
    segundos: Number(j.format?.tags?.abertura_s ?? j.format?.tags?.ABERTURA_S) || 0,
  }
}

/** Quantos segundos a abertura com o logo somou no começo deste MP4 (0 = não tem, ou é de antes da etiqueta abertura_s). */
export const aberturaDe = (arq) => sondar(arq).segundos

const ts = (ms) => `${String(Math.floor(ms / 3600000)).padStart(2, '0')}:${String(Math.floor(ms / 60000) % 60).padStart(2, '0')}:${String(Math.floor(ms / 1000) % 60).padStart(2, '0')},${String(ms % 1000).padStart(3, '0')}`
/** Cada deixa de uma legenda .srt `seg` segundos depois. */
export const deslocarSrt = (texto, seg) => texto.replace(/(\d{2}):(\d{2}):(\d{2}),(\d{3})/g, (_, h, m, s, ms) => ts(Math.max(0, ((+h * 60 + +m) * 60 + +s) * 1000 + +ms + Math.round(seg * 1000))))

// A legenda ao lado do vídeo de entrada (<vídeo>.srt) vai, deslocada, para o lado da saída. → o caminho, ou null.
function deslocarLegenda(entrada, saida, seg) {
  const de = entrada.replace(/\.mp4$/i, '.srt'), para = saida.replace(/\.mp4$/i, '.srt')
  if (de === entrada || !fs.existsSync(de)) return null
  fs.writeFileSync(para, deslocarSrt(fs.readFileSync(de, 'utf8'), seg))
  return para
}

// o sopro da abertura, do catálogo de sons da skill, com o pico quando o logo termina de entrar
function somDaAbertura(dur, wav) {
  const py = acharPython()
  if (!py) return false
  const codigo = `
import sys
sys.path.insert(0, sys.argv[1])
import numpy as np, sounds as sons
from scipy.io import wavfile
dur, pico, saida = float(sys.argv[2]), float(sys.argv[3]), sys.argv[4]
SR = 48000
y = np.zeros((2, int(round(dur * SR))))
w, anc = sons.som_ancorado('whoosh', semente=7, dur=0.7)
w = w if w.ndim == 2 else np.stack([w, w])
i0 = int(round(pico * SR)) - anc
a, b = max(0, i0), min(y.shape[1], i0 + w.shape[1])
y[:, a:b] = w[:, a - i0:b - i0] * 10 ** (8 / 20)
wavfile.write(saida, SR, (np.clip(y.T, -1, 1) * 32767).astype(np.int16))
`
  const r = spawnSync(py, ['-c', codigo, AUDIO, String(dur), String(ENTRADA), wav], { encoding: 'utf8' })
  return r.status === 0 && fs.existsSync(wav)
}

const hex = (c) => {
  const m = /^#?([0-9a-f]{6})$/i.exec(String(c ?? '').trim())
  if (!m) throw new Falha(`background "${c}" is not a #rrggbb color (e.g. #F5F5F5)`)
  return m[1].toUpperCase()
}

/**
 * Põe a abertura com o logo no começo do vídeo. → { saida, dur, antes, depois } (ou { saida, jaTinha: true }).
 * `base`: a pasta contra a qual um `logo` relativo se resolve (a do JSON do molde).
 */
export function aplicarAbertura(video, { logo, fundo = PADRAO.fundo, dur = PADRAO.dur, largura = PADRAO.largura, saida = null, crf = PADRAO.crf, base = process.cwd() } = {}) {
  const entrada = path.resolve(video)
  if (!fs.existsSync(entrada)) throw new Falha(`video not found: ${entrada}`)
  if (!logo) throw new Falha('the opening logo is missing ("aberturaLogo": { "logo": "…/logo.png" } in the JSON, or --logo <png>)')
  const arqLogo = path.resolve(base, logo)
  if (!fs.existsSync(arqLogo)) throw new Falha(`opening logo not found at ${arqLogo}: check the path (relative to the template's JSON)`)
  const cor = hex(fundo)
  if (!(Number(dur) > 0.3 && Number(dur) <= 3)) throw new Falha(`dur ${dur}: the opening must last between 0.3 and 3 s (the default is 1)`)
  const v = sondar(entrada)
  const out = path.resolve(saida ?? entrada)
  if (v.jaTem) {
    if (out !== entrada) fs.copyFileSync(entrada, out)
    return { saida: out, jaTinha: true }
  }
  const quadros = Math.max(1, Math.round(Number(dur) * v.fps))
  const d = quadros / v.fps
  const lado = Math.min(v.largura, v.altura)
  const lw = Math.min(v.largura - 2 * Math.round(0.08 * v.largura), Math.round((Number(largura) * lado) / 1080 / 2) * 2)
  const sobe = Math.round(0.022 * v.altura)
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'abertura-'))
  const wav = path.join(tmp, 'abertura.wav')
  const comSom = v.audio && somDaAbertura(d, wav)
  const partes = [
    `[2:v]format=rgba,scale=${lw}:-1:flags=lanczos,fade=t=in:st=0:d=${ENTRADA + ANTES}:alpha=1,trim=start=${ANTES},setpts=PTS-STARTPTS[lg]`,
    `[1:v]format=rgba[bg]`,
    `[bg][lg]overlay=x=(W-w)/2:y=(H-h)/2+${sobe}*pow(1-min((t+${ANTES})/${ENTRADA + ANTES}\\,1)\\,3):shortest=1,` +
      'scale=out_color_matrix=bt709:out_range=limited:flags=accurate_rnd+full_chroma_int+full_chroma_inp,format=yuv420p,setsar=1[ab]',
    '[0:v]format=yuv420p,setsar=1[cv]',
  ]
  const fmtA = 'aformat=sample_fmts=fltp:sample_rates=48000:channel_layouts=stereo'
  if (v.audio) {
    partes.push(comSom ? `[3:a]${fmtA}[aa]` : `anullsrc=r=48000:cl=stereo,atrim=duration=${d.toFixed(6)},${fmtA}[aa]`)
    partes.push(`[0:a]${fmtA}[ca]`, '[ab][aa][cv][ca]concat=n=2:v=1:a=1[v][a]')
  } else partes.push('[ab][cv]concat=n=2:v=1:a=0[v]')
  const tmpOut = path.join(path.dirname(out), `.${path.basename(out, '.mp4')}.abertura-${process.pid}.mp4`)
  const args = ['-v', 'error', '-y', '-i', entrada,
    '-f', 'lavfi', '-i', `color=c=0x${cor}:s=${v.largura}x${v.altura}:r=${v.fpsTxt}:d=${d.toFixed(6)}`,
    '-loop', '1', '-framerate', v.fpsTxt, '-t', (d + ANTES).toFixed(6), '-i', arqLogo,
    ...(comSom ? ['-i', wav] : []),
    '-filter_complex', partes.join(';'), '-map', '[v]', ...(v.audio ? ['-map', '[a]'] : []),
    '-r', v.fpsTxt, '-c:v', 'libx264', '-crf', String(crf), '-preset', 'medium', '-pix_fmt', 'yuv420p',
    '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709', '-color_range', 'tv',
    ...(v.audio ? ['-c:a', 'aac', '-b:a', '320k', '-ar', '48000'] : []),
    '-metadata', `abertura=${ETIQUETA}`, '-metadata', `abertura_s=${d.toFixed(6)}`, '-movflags', '+faststart+use_metadata_tags', tmpOut]
  const r = spawnSync('ffmpeg', args, { encoding: 'utf8' })
  fs.rmSync(tmp, { recursive: true, force: true })
  if (r.status !== 0 || !fs.existsSync(tmpOut)) {
    fs.rmSync(tmpOut, { force: true })
    throw new Falha(`ffmpeg did not build the opening: ${String(r.stderr || r.error?.message || '').trim().split('\n').slice(-3).join(' | ')}`, 1)
  }
  const n = sondar(tmpOut)
  const erros = []
  if (n.largura !== v.largura || n.altura !== v.altura) erros.push(`size ${n.largura}×${n.altura} (was ${v.largura}×${v.altura})`)
  if (Math.abs(n.fps - v.fps) > 0.01) erros.push(`fps ${n.fps} (was ${v.fps})`)
  if (Math.abs(n.duracao - (v.duracao + d)) > 1.5 / v.fps) erros.push(`duration ${n.duracao.toFixed(3)} s (expected ${(v.duracao + d).toFixed(3)} s)`)
  if (erros.length) { fs.rmSync(tmpOut, { force: true }); throw new Falha(`the opening came out wrong: ${erros.join('; ')}`, 1) }
  fs.renameSync(tmpOut, out)
  const legenda = deslocarLegenda(entrada, out, d)
  return { saida: out, dur: d, antes: v.duracao, depois: n.duracao, som: comSom, ...(legenda ? { legenda } : {}) }
}

/** Para os moldes: aplica a abertura do JSON (`P.aberturaLogo`) no vídeo entregue, se houver. → resultado ou null. */
export function aberturaDoJson(video, abertura, dirJson) {
  if (!abertura) return null
  return aplicarAbertura(video, { ...abertura, saida: null, base: dirJson })
}

/** Linha para o terminal do molde. */
export const relatar = (r) => (r.jaTinha ? `opening: ${r.saida} already had the logo opening` : `✓ logo opening: +${r.dur.toFixed(2)} s (${r.depois.toFixed(2)} s total)${r.som === false ? ', without the whoosh (the soundtrack\'s Python is missing)' : ''} · ${r.saida}${r.legenda ? `\n  captions shifted with it: ${r.legenda}` : ''}`)

function principal(argv) {
  const opt = (k) => { const i = argv.indexOf(`--${k}`); return i >= 0 && argv[i + 1] != null && !argv[i + 1].startsWith('--') ? argv[i + 1] : null }
  const video = argv.find((x, i) => !x.startsWith('--') && !(i > 0 && argv[i - 1].startsWith('--')))
  if (!video) {
    console.error('usage: node opening.mjs <video.mp4> --logo <png> [--background #F5F5F5] [--dur 1] [--width 620] [--out <mp4>] [--crf 16]\n' +
      '       node opening.mjs <video.mp4> --json <parametros.json>')
    return 2
  }
  if (opt('json')) {
    const arq = path.resolve(opt('json'))
    let P
    try { P = JSON.parse(fs.readFileSync(arq, 'utf8')) } catch (e) { throw new Falha(`could not read ${arq} (${e.message}): check the path and the JSON`) }
    if (!P.aberturaLogo) return 0
    console.log(relatar(aplicarAbertura(video, { ...P.aberturaLogo, saida: opt('out'), base: path.dirname(arq) })))
    return 0
  }
  const r = aplicarAbertura(video, {
    logo: opt('logo'), fundo: opt('background') ?? PADRAO.fundo, dur: Number(opt('dur') ?? PADRAO.dur),
    largura: Number(opt('width') ?? PADRAO.largura), saida: opt('out'), crf: Number(opt('crf') ?? PADRAO.crf),
  })
  console.log(relatar(r))
  return 0
}

if (process.argv[1] && (() => { try { return fs.realpathSync(process.argv[1]) === fs.realpathSync(fileURLToPath(import.meta.url)) } catch { return false } })()) {
  try { process.exitCode = principal(process.argv.slice(2)) } catch (e) {
    console.error(`abertura: ${e.message}`)
    process.exitCode = e instanceof Falha ? e.codigo : 1
  }
}
