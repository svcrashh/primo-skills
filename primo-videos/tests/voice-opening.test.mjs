// node --test tests/voice-opening.test.mjs   (sem rede; ffmpeg; a legenda na imagem precisa do Chromium do Playwright)
// A abertura com o logo (scripts/opening.mjs) põe ~1 s antes do vídeo, depois do finalize. Com voz, a fala anda esse
// tanto no MP4: a legenda .srt ao lado do vídeo e as palavras da legenda na imagem (captions/caption.mjs, que lê a folha
// e a locução, ambas de antes da abertura) têm de andar junto, senão ficam 1 s adiantadas.
import { test, describe, before, after } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { execFileSync, spawnSync } from 'node:child_process'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import { aplicarAbertura, aberturaDe, deslocarSrt } from '../scripts/opening.mjs'

const AQUI = path.dirname(fileURLToPath(import.meta.url))
const LOGO = path.join(AQUI, '..', 'assets', 'example', 'logo-placeholder.png')
const CAPTION = path.join(AQUI, '..', 'scripts', 'captions', 'caption.mjs')
const temPlaywright = createRequire(import.meta.url)('../scripts/playwright.cjs').candidatos().length > 0
const SRT = '1\n00:00:00,800 --> 00:00:01,500\nOpen the app.\n'
let base, video

// O primeiro instante, a partir de `de`, em que o áudio passa de −30 dBFS (RMS de 10 ms): onde a voz começa no MP4.
function primeiroSom(arq, de) {
  const b = execFileSync('ffmpeg', ['-v', 'error', '-i', arq, '-vn', '-ac', '1', '-ar', '16000', '-f', 'f32le', '-'], { maxBuffer: 1 << 28 })
  const x = new Float32Array(b.buffer, b.byteOffset, b.length / 4), J = 160
  for (let i = Math.round(de * 16000); i + J < x.length; i += 16) {
    let s = 0
    for (let k = i; k < i + J; k++) s += x[k] * x[k]
    if (Math.sqrt(s / J) > 10 ** (-30 / 20)) return i / 16000
  }
  return null
}

before(() => {
  base = fs.mkdtempSync(path.join(os.tmpdir(), 'voice-opening-'))
  video = path.join(base, 'delivery-16x9.mp4')
  // a "voz": silêncio até 0,8 s, um tom até 1,5 s, silêncio até 2 s; e a legenda dela ao lado
  execFileSync('ffmpeg', ['-v', 'error', '-y', '-f', 'lavfi', '-i', 'color=c=0x1D1D1F:s=640x360:r=30:d=2',
    '-f', 'lavfi', '-i', 'sine=frequency=440:sample_rate=48000:duration=0.7', '-filter_complex', '[1:a]adelay=800|800,apad=whole_dur=2[a]',
    '-map', '0:v', '-map', '[a]', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-ac', '2', '-t', '2', video])
  fs.writeFileSync(video.replace(/\.mp4$/, '.srt'), SRT)
})
after(() => fs.rmSync(base, { recursive: true, force: true }))

describe('the logo opening with a voice', () => {
  test('the problem: the voice moves ~1 s in the MP4 — the .srt next to it moves with it, and the MP4 keeps how much', () => {
    assert.ok(Math.abs(primeiroSom(video, 0) - 0.8) < 0.03, 'the voice starts at 0.8 s before the opening')
    const saida = path.join(base, 'with-opening-16x9.mp4')
    const r = aplicarAbertura(video, { logo: LOGO, saida })
    assert.equal(r.dur, 1)
    const voz = primeiroSom(saida, r.dur)
    assert.ok(Math.abs(voz - 1.8) < 0.03, `the voice now starts at ${voz} s`)
    assert.equal(r.legenda, saida.replace(/\.mp4$/, '.srt'))
    assert.equal(fs.readFileSync(r.legenda, 'utf8'), '1\n00:00:01,800 --> 00:00:02,500\nOpen the app.\n', 'the caption starts with the voice')
    assert.equal(fs.readFileSync(video.replace(/\.mp4$/, '.srt'), 'utf8'), SRT, 'the input caption is untouched')
    assert.equal(aberturaDe(saida), 1)
    assert.equal(aberturaDe(video), 0)
  })

  test('in place, the caption is shifted once; applying the opening again changes nothing', () => {
    const v = path.join(base, 'in-place-16x9.mp4')
    fs.copyFileSync(video, v)
    fs.writeFileSync(v.replace(/\.mp4$/, '.srt'), SRT)
    aplicarAbertura(v, { logo: LOGO })
    const uma = fs.readFileSync(v.replace(/\.mp4$/, '.srt'), 'utf8')
    assert.match(uma, /00:00:01,800 --> 00:00:02,500/)
    assert.equal(aplicarAbertura(v, { logo: LOGO }).jaTinha, true)
    assert.equal(fs.readFileSync(v.replace(/\.mp4$/, '.srt'), 'utf8'), uma)
  })

  test('a video without a caption next to it: nothing is written', () => {
    const v = path.join(base, 'no-caption.mp4')
    fs.copyFileSync(video, v)
    const r = aplicarAbertura(v, { logo: LOGO, saida: path.join(base, 'no-caption-out.mp4') })
    assert.equal(r.legenda, undefined)
    assert.ok(!fs.existsSync(path.join(base, 'no-caption-out.srt')))
  })

  test('deslocarSrt moves every cue, hours included', () => {
    assert.equal(deslocarSrt('1\n00:59:59,500 --> 01:00:00,250\nx\n', 1.25), '1\n01:00:00,750 --> 01:00:01,500\nx\n')
  })
})

describe('captions/caption.mjs on a video that already has the opening', { skip: !temPlaywright && 'no Playwright on this machine' }, () => {
  test('the words light up with the voice, shifted by what the opening added', () => {
    const d = fs.mkdtempSync(path.join(os.tmpdir(), 'voice-opening-captions-'))
    const serie = path.join(d, 'series')
    fs.mkdirSync(serie)
    fs.writeFileSync(path.join(serie, 'series.json'), JSON.stringify({ fonteTitulo: 'Arial' }))
    fs.writeFileSync(path.join(serie, 'brand.js'), 'const MARCA = { cores: { marca: "#FF6A1F", tinta: "#111111", fundo: "#FFFFFF" } }\n')
    const loc = path.join(d, 'narration.json'), folha = path.join(d, 'sheet.json')
    fs.writeFileSync(loc, JSON.stringify({ versao: 1, idioma: 'en-US', falas: [{ id: 'l1', onde: { capitulo: 1 }, texto: 'Open the app.', inicio_voz: 0.1, palavras: [{ texto: 'Open', ini: 0.1, fim: 0.3 }, { texto: 'the', ini: 0.32, fim: 0.42 }, { texto: 'app.', ini: 0.45, fim: 0.8 }] }] }))
    fs.writeFileSync(folha, JSON.stringify({ duracao: 2, voz: { arquivo: 'voz.wav', trechos: [[0.8, 1.5]], perfil: 'reels', falas: [{ id: 'l1', t: 0.8, texto: 'Open the app.' }] } }))
    const comAbertura = path.join(base, 'with-opening-16x9.mp4')
    if (!fs.existsSync(comAbertura)) aplicarAbertura(video, { logo: LOGO, saida: comAbertura })
    const legendar = (v, rel) => {
      const r = spawnSync(process.execPath, [CAPTION, '--video', v, '--narration', loc, '--sheet', folha, '--series', serie, '--out', path.join(d, `${rel}.mp4`), '--captions', '--report', path.join(d, `${rel}.json`)], { encoding: 'utf8' })
      assert.equal(r.status, 0, r.stdout + r.stderr)
      return { saida: r.stdout, plano: JSON.parse(fs.readFileSync(path.join(d, `${rel}.json`), 'utf8')).plano }
    }
    const sem = legendar(video, 'plain'), com = legendar(comAbertura, 'opened')
    assert.ok(Math.abs(sem.plano[0].ini - 0.8) < 0.13, `without the opening the first line starts at ${sem.plano[0].ini}`)
    assert.ok(Math.abs(com.plano[0].ini - sem.plano[0].ini - 1) < 0.001, `with it, 1 s later (${com.plano[0].ini})`)
    assert.match(com.saida, /the video has the logo opening \(\+1\.00 s\)/)
  })
})
