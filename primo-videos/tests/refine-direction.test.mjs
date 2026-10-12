// A crítica de direção: séries sintéticas de composição (sem MP4) para a nota e cada sinal; no fim, um MP4 gerado pelo
// ffmpeg passa pela CLI e pelo refine.mjs. node --test tests/refine-direction.test.mjs (sem rede; ffmpeg)
import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { medirDirecao, julgarDirecao, blocos, distancia, seriesDe, lerMiniaturas, LIMIARES, QPS } from '../scripts/refine/direction.mjs'

const AQUI = path.dirname(fileURLToPath(import.meta.url))
const DIRECAO = path.join(AQUI, '..', 'scripts', 'refine', 'direction.mjs')
const REFINAR = path.join(AQUI, '..', 'scripts', 'refine.mjs')
const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'direcao-'))
const ff = (args) => assert.equal(spawnSync('ffmpeg', ['-v', 'error', '-y', ...args]).status, 0)

// A composição de um quadro: 28 blocos (4 × 7, o 9:16) todos com o mesmo valor, mais um desenho fixo.
const N = 28
const comp = (v, desenho = 0) => Float32Array.from({ length: N }, (_, i) => v + (i % 4 === desenho % 4 ? 40 : 0))
const s = (seg) => Math.round(seg * QPS)

// Monta uma série a partir de trechos: { parado: s, valor } fica igual; { mexe: s, valor, amplitude } oscila de leve
// (o tutorial de sempre: a tela respira, a mão toca); { anima: s, de, para } vai de uma composição a outra.
function serie(trechos) {
  const grosso = []
  for (const t of trechos) {
    if (t.parado != null) for (let i = 0; i < s(t.parado); i++) grosso.push(comp(t.valor, t.desenho))
    if (t.mexe != null) for (let i = 0; i < s(t.mexe); i++) grosso.push(comp(t.valor + (t.amplitude ?? 2) * Math.sin(i / 3), t.desenho))
    if (t.anima != null) {
      const n = s(t.anima)
      for (let i = 1; i <= n; i++) {
        const e = i / n, a = comp(t.de, t.desenhoDe), b = comp(t.para, t.desenhoPara)
        grosso.push(a.map((x, j) => x + (b[j] - x) * e))
      }
    }
    if (t.corte != null) grosso.push(comp(t.corte, t.desenho))
  }
  return { qps: QPS, grosso }
}

// O vídeo com direção: abre se montando, troca de composição com uma transição a cada 3 s e fecha com o logo se
// montando em 1 s e 1,5 s parado.
function comDirecao({ abertura = 'anima' } = {}) {
  const trechos = abertura === 'anima'
    ? [{ anima: 1, de: 20, para: 120, desenhoPara: 1 }, { mexe: 1, valor: 120, desenho: 1 }]
    : [{ parado: 2, valor: 120, desenho: 1 }]
  let v = 120
  for (let k = 0; k < 10; k++) {
    const p = v === 120 ? 60 : 120
    trechos.push({ anima: 0.5, de: v, para: p, desenhoDe: k + 1, desenhoPara: k + 2 }, { mexe: 2.5, valor: p, desenho: k + 2 })
    v = p
  }
  trechos.push({ anima: 1, de: v, para: 30, desenhoDe: 11, desenhoPara: 0 }, { parado: 1.5, valor: 30, desenho: 0 })
  return serie(trechos)
}

// O tutorial recusado: título parado, 30 s da mesma tela que respira, corte seco para o cartão e 3,2 s parado.
function tutorialSemGraca() {
  return serie([{ parado: 2, valor: 200 }, { mexe: 30, valor: 200, amplitude: 3 }, { corte: 40 }, { parado: 3.2, valor: 40 }])
}

describe('medidas e nota com séries sintéticas', () => {
  test('o tutorial monótono dá fraco, com os quatro sinais e o que usar em cada um', () => {
    const m = medirDirecao(tutorialSemGraca())
    const j = julgarDirecao(m)
    assert.equal(j.nota, 'fraco')
    assert.deepEqual(j.sinais, ['gancho', 'monotonia', 'momentos', 'fecho'])
    assert.ok(m.gancho.mudanca < LIMIARES.ganchoMin)
    assert.ok(m.monotonia.maior >= 30, `monotonia ${m.monotonia.maior}`)
    assert.equal(m.fecho.entrada, 'corte')
    assert.ok(Math.abs(m.fecho.parado - 3.2) <= 0.11, `parado ${m.fecho.parado}`)
    for (const a of j.achados) {
      assert.equal(a.checagem, 'direcao')
      assert.equal(a.nivel, 'aviso')
      assert.ok(a.msg && a.oQueFazer, a.sinal)
    }
    const porSinal = Object.fromEntries(j.achados.map((a) => [a.sinal, a]))
    assert.match(porSinal.monotonia.msg, /^3\d\.\d s with the same composition/)
    assert.equal(porSinal.monotonia.t, 0)
    assert.match(porSinal.monotonia.oQueFazer, /motion transition/)
    assert.match(porSinal.fecho.msg, /hard cut and stays still for 3\.\d s/)
    assert.match(porSinal.fecho.oQueFazer, /3D logo/)
  })

  test('o vídeo com picos regulares, abertura que se monta e logo animado no fim dá forte, sem aviso', () => {
    const m = medirDirecao(comDirecao())
    const j = julgarDirecao(m)
    assert.equal(j.nota, 'forte', JSON.stringify(m))
    assert.deepEqual(j.achados, [])
    assert.ok(m.gancho.mudanca >= LIMIARES.ganchoMin)
    assert.ok(m.momentos.maiorIntervalo <= 3.1, `intervalo ${m.momentos.maiorIntervalo}`)
    assert.ok(m.momentos.porDezS >= 3, `por 10 s ${m.momentos.porDezS}`)
    assert.ok(m.monotonia.maior <= 3.1, `monotonia ${m.monotonia.maior}`)
    assert.equal(m.fecho.entrada, 'animada')
    assert.ok(m.fecho.parado <= 1.6)
  })

  test('abertura parada gera o aviso do gancho, nos 2 primeiros segundos, e sozinha deixa a nota em ok', () => {
    const j = julgarDirecao(medirDirecao(comDirecao({ abertura: 'parada' })))
    assert.deepEqual(j.sinais, ['gancho'])
    assert.equal(j.nota, 'ok')
    const [a] = j.achados
    assert.equal(a.t, 0)
    assert.equal(a.fim, 2)
    assert.match(a.msg, /static opening/)
    assert.match(a.oQueFazer, /3D phone.*"cinema": "moldura"/)
  })

  test('dois sinais já é fraco: abertura parada e cartão parado 3 s', () => {
    const base = comDirecao({ abertura: 'parada' })
    const fim = serie([{ parado: 3, valor: 30, desenho: 0 }])
    const j = julgarDirecao(medirDirecao({ qps: QPS, grosso: [...base.grosso, ...fim.grosso] }))
    assert.deepEqual(j.sinais, ['gancho', 'fecho'])
    assert.equal(j.nota, 'fraco')
    assert.match(j.achados[1].msg, /still closing: the end card stays 4\.\d s with nothing moving/)
  })

  test('o maior intervalo sem momento forte conta do começo até o 1º pico e do último pico até o cartão', () => {
    const m = medirDirecao(serie([
      { mexe: 4, valor: 100 }, { anima: 0.3, de: 100, para: 20 }, { mexe: 17, valor: 20 }, { anima: 0.3, de: 20, para: 100 }, { mexe: 3, valor: 100 },
    ]))
    assert.equal(m.momentos.total, 2)
    assert.ok(Math.abs(m.momentos.maiorIntervalo - 17.3) <= 0.11, `intervalo ${m.momentos.maiorIntervalo}`)
    assert.ok(Math.abs(m.momentos.ini - 4) <= 0.11 && Math.abs(m.momentos.fim - 21.3) <= 0.11, `${m.momentos.ini}–${m.momentos.fim}`)
    assert.deepEqual(julgarDirecao(m).sinais.filter((x) => x === 'momentos'), ['momentos'])
  })

  test('a composição que deriva devagar quebra o trecho: deriva não é monotonia', () => {
    const grosso = Array.from({ length: s(30) }, (_, i) => comp(20 + i * 0.6))
    const m = medirDirecao({ qps: QPS, grosso })
    assert.ok(m.monotonia.maior < LIMIARES.monotoniaMax, `monotonia ${m.monotonia.maior}`)
  })

  test('o grão que mexe o quadro inteiro não conta como movimento do cartão: o fim parado sai do fino', () => {
    const base = tutorialSemGraca()
    const fino = base.grosso.map((g, i) => (i ? distancia(g, base.grosso[i - 1]) : 0) + 0.1)
    const m = medirDirecao({ ...base, fino })
    assert.ok(Math.abs(m.fecho.parado - 3.2) <= 0.11, `parado ${m.fecho.parado}`)
    const comGrao = medirDirecao({ ...base, fino: fino.map((v) => v + 0.3) })
    assert.equal(comGrao.fecho.parado, 0)
    assert.equal(comGrao.fecho.entrada, 'sem cartão parado')
  })

  test('limiares por opção mudam a régua sem tocar no padrão', () => {
    const m = medirDirecao(tutorialSemGraca(), { monotoniaMax: 60 })
    assert.equal(m.monotonia.maximo, 60)
    assert.ok(!julgarDirecao(m).sinais.includes('monotonia'))
    assert.equal(LIMIARES.monotoniaMax, 12)
  })
})

describe('miniaturas', () => {
  test('blocos tira a média de cada bloco; distância é a diferença média', () => {
    const w = 32, h = 16, q = new Uint8Array(w * h)
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) q[y * w + x] = x < 16 ? 10 : 210
    assert.deepEqual([...blocos(q, w, h, 16)], [10, 210])
    assert.equal(distancia(Float32Array.from([10, 210]), Float32Array.from([20, 190])), 15)
  })

  test('seriesDe: fino é a mudança da miniatura inteira, grosso a composição em blocos', () => {
    const w = 16, h = 16
    const a = new Uint8Array(w * h).fill(0), b = new Uint8Array(w * h).fill(0)
    b.fill(255, 0, 16)
    const r = seriesDe({ w, h, qps: QPS, quadros: [a, a, b] })
    assert.deepEqual(r.fino.map((v) => Math.round(v * 100) / 100), [0, 0, 15.94])
    assert.equal(r.grosso.length, 3)
    assert.ok(Math.abs(r.grosso[2][0] - 15.94) < 0.01)
  })
})

describe('no MP4', () => {
  test('lerMiniaturas: 64 px no lado curto, 10 por segundo; a CLI dá fraco num quadro parado', () => {
    const p = tmp(), mp4 = path.join(p, 'parado.mp4')
    ff(['-f', 'lavfi', '-i', 'color=c=0x223344:s=1080x1920:r=30:d=4', '-pix_fmt', 'yuv420p', mp4])
    const mi = lerMiniaturas(mp4)
    assert.deepEqual([mi.w, mi.h], [64, 114])
    assert.ok(Math.abs(mi.quadros.length - 40) <= 1, `${mi.quadros.length} quadros`)
    const r = spawnSync(process.execPath, [DIRECAO, mp4, '--json'], { encoding: 'utf8' })
    assert.equal(r.status, 0, r.stderr)
    const j = JSON.parse(r.stdout)
    assert.equal(j.nota, 'fraco')
    assert.deepEqual(j.medidas.sinais, ['gancho', 'fecho'])
    const texto = spawnSync(process.execPath, [DIRECAO, mp4], { encoding: 'utf8' })
    assert.match(texto.stdout, /^DIRECTION: weak \(2 of 4 signals: hook, closing\)/)
  })

  test('refine.mjs: PASSOU continua PASSOU com DIREÇÃO fraco; a seção Direção sai no relatório; --no-direction pula', () => {
    const p = tmp(), mp4 = path.join(p, 'testsrc.mp4')
    // testsrc2 se mexe o tempo todo (passa no parado e no vazio), mas é sempre a mesma composição por 20 s
    ff(['-f', 'lavfi', '-i', 'testsrc2=s=540x960:r=30:d=20', '-pix_fmt', 'yuv420p', '-c:v', 'libx264', '-preset', 'ultrafast', mp4])
    const saida = path.join(p, 'rel')
    const r = spawnSync(process.execPath, [REFINAR, mp4, '--no-ocr', '--out', saida], { encoding: 'utf8' })
    assert.equal(r.status, 0, r.stdout + r.stderr)
    assert.match(r.stdout, /DIRECTION weak \(hook, monotony, moments\)/)
    const j = JSON.parse(fs.readFileSync(path.join(saida, 'refine.json'), 'utf8'))
    assert.equal(j.aprovado, true)
    assert.equal(j.direcao[0].nota, 'fraco')
    assert.ok(!j.achados.some((a) => a.checagem === 'direcao'), 'a direção não entra na conta dos avisos')
    const md = fs.readFileSync(path.join(saida, 'refine.md'), 'utf8')
    assert.match(md, /\*\*Passed\*\*/)
    assert.match(md, /\*\*DIRECTION: weak \(hook, monotony, moments\)\*\*: the video is dull/)
    assert.match(md, /## Direction[\s\S]*- monotony: 20\.0 s with the same composition[\s\S]*- \*\*moments\*\* · 0:00\.00–0:20\.00/)
    const sem = path.join(p, 'sem')
    const r2 = spawnSync(process.execPath, [REFINAR, mp4, '--no-ocr', '--no-direction', '--out', sem], { encoding: 'utf8' })
    assert.equal(r2.status, 0, r2.stderr)
    assert.equal(JSON.parse(fs.readFileSync(path.join(sem, 'refine.json'), 'utf8')).direcao, null)
    assert.doesNotMatch(fs.readFileSync(path.join(sem, 'refine.md'), 'utf8'), /Direction/)
  })
})
