// node --test tests/opening.test.mjs   (sem rede; precisa do ffmpeg; o sopro precisa do Python da trilha)
// A abertura com o logo (scripts/opening.mjs): o vídeo ganha ~1 s com o logo centrado sobre o fundo e continua igual
// depois do corte; tamanho e fps não mudam; o quadro 0 já tem o logo; não aplica duas vezes; o --json só age com
// "aberturaLogo"; cor ou logo errados saem com código 2 dizendo o que fazer.
import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { spawnSync, execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const AQUI = path.dirname(fileURLToPath(import.meta.url))
const SCRIPT = path.join(AQUI, '..', 'scripts', 'opening.mjs')
const LOGO = path.join(AQUI, '..', 'assets', 'example', 'logo-placeholder.png')
let base, video
const roda = (...a) => spawnSync(process.execPath, [SCRIPT, ...a], { encoding: 'utf8' })
const sonda = (f) => JSON.parse(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'stream=codec_type,width,height,r_frame_rate:format=duration', '-of', 'json', f]).toString())
// a cor média de um recorte w×h em (x, y) no instante t, em RGB (decodificando como BT.709, como o vídeo foi gravado)
function cor(f, t, x, y, w = 8, h = 8) {
  const b = execFileSync('ffmpeg', ['-v', 'error', '-ss', String(t), '-i', f, '-frames:v', '1', '-vf', `scale=in_color_matrix=bt709:in_range=tv,crop=${w}:${h}:${x}:${y}`, '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-'])
  const s = [0, 0, 0]
  for (let i = 0; i < b.length; i += 3) for (let k = 0; k < 3; k++) s[k] += b[i + k]
  return s.map((v) => Math.round(v / (b.length / 3)))
}
const perto = (a, b, tol = 10) => a.every((v, i) => Math.abs(v - b[i]) <= tol)
const FUNDO = [0xf5, 0xf5, 0xf5]   // o fundo padrão da abertura: um claro neutro

before(() => {
  base = fs.mkdtempSync(path.join(os.tmpdir(), 'abertura-'))
  video = path.join(base, 'conteudo.mp4')
  execFileSync('ffmpeg', ['-v', 'error', '-y', '-f', 'lavfi', '-i', 'color=c=0x1D1D1F:s=640x360:r=30:d=2', '-f', 'lavfi', '-i', 'sine=frequency=440:duration=2:sample_rate=48000',
    '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-ac', '2', video])
})
after(() => fs.rmSync(base, { recursive: true, force: true }))

test('põe ~1 s de logo sobre o fundo claro antes do vídeo, sem mudar tamanho nem fps', () => {
  const saida = path.join(base, 'com-abertura.mp4')
  const r = roda(video, '--logo', LOGO, '--out', saida)
  assert.equal(r.status, 0, r.stderr)
  assert.match(r.stdout, /logo opening: \+1\.00 s/)
  const p = sonda(saida)
  const v = p.streams.find((s) => s.codec_type === 'video')
  assert.equal(v.width, 640)
  assert.equal(v.height, 360)
  assert.equal(v.r_frame_rate, '30/1')
  assert.ok(Math.abs(+p.format.duration - 3) < 0.06, `duração ${p.format.duration}`)
  assert.ok(p.streams.some((s) => s.codec_type === 'audio'), 'o som do vídeo continua')
  assert.ok(perto(cor(saida, 0.5, 2, 2), FUNDO), 'o fundo da abertura é o claro padrão')
  const meio = cor(saida, 0.8, 300, 170, 40, 20)
  assert.ok(meio[1] < FUNDO[1] - 15, `no meio está o logo, mais escuro que o fundo (${meio})`)
  assert.ok(perto(cor(saida, 1.5, 2, 2), [0x1d, 0x1d, 0x1f]), 'depois do corte, o vídeo de antes')
  // o quadro 0 já mostra o logo (não abre num quadro vazio)
  const q0 = cor(saida, 0, 300, 170, 40, 20)
  assert.ok(q0[1] < FUNDO[1] - 8, `o quadro 0 já tem o logo (${q0})`)
})

test('não aplica duas vezes no mesmo vídeo', () => {
  const saida = path.join(base, 'duas.mp4')
  assert.equal(roda(video, '--logo', LOGO, '--out', saida).status, 0)
  const r = roda(saida, '--logo', LOGO)
  assert.equal(r.status, 0, r.stderr)
  assert.match(r.stdout, /already had the logo opening/)
  assert.ok(Math.abs(+sonda(saida).format.duration - 3) < 0.06)
})

test('--json: só age com "aberturaLogo"; o logo é relativo ao JSON', () => {
  const sem = path.join(base, 'sem.json')
  fs.writeFileSync(sem, JSON.stringify({ nome: 'x' }))
  const copia = path.join(base, 'copia.mp4')
  fs.copyFileSync(video, copia)
  const r = roda(copia, '--json', sem)
  assert.equal(r.status, 0, r.stderr)
  assert.equal(r.stdout, '')
  assert.ok(Math.abs(+sonda(copia).format.duration - 2) < 0.06, 'sem aberturaLogo o vídeo fica igual')
  const dir = path.join(base, 'template')
  fs.mkdirSync(dir)
  const com = path.join(dir, 'p.json')
  fs.writeFileSync(com, JSON.stringify({ aberturaLogo: { logo: path.relative(dir, LOGO), fundo: '#F5F5F5', dur: 1 } }))
  const r2 = roda(copia, '--json', com)
  assert.equal(r2.status, 0, r2.stderr)
  assert.ok(Math.abs(+sonda(copia).format.duration - 3) < 0.06, 'com aberturaLogo, troca o próprio vídeo')
})

test('cor ou logo errados: código 2, dizendo o que fazer', () => {
  let r = roda(video, '--logo', LOGO, '--background', 'branco', '--out', path.join(base, 'x.mp4'))
  assert.equal(r.status, 2)
  assert.match(r.stderr, /is not a #rrggbb color/)
  r = roda(video, '--logo', path.join(base, 'nao-existe.png'), '--out', path.join(base, 'y.mp4'))
  assert.equal(r.status, 2)
  assert.match(r.stderr, /opening logo not found/)
  r = roda(video, '--out', path.join(base, 'z.mp4'))
  assert.equal(r.status, 2)
  assert.match(r.stderr, /the opening logo is missing/)
})
