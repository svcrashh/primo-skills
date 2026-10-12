// 19:9 e 21:9 nos moldes before-after e real-screen-camera: o formato é aceito, herda o 16:9 recomposto pela
// largura, o texto fica na área segura (5%) e fora da captura, e o 16:9 dá os mesmos números de antes.
// Sem navegador e sem rede: o leiaute dos moldes é avaliado num contexto vm com o cabeçalho de formato do motor.
import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'
import { fileURLToPath } from 'node:url'

const SKILL = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const ler = (p) => fs.readFileSync(path.join(SKILL, p), 'utf8')
const AD = 'templates/before-after', TR = 'templates/real-screen-camera'
const LARGOS = { '19x9': [2280, 1080], '21x9': [2520, 1080] }

// O trecho "formato" do motor (FORMATOS, FMT, W, H, HORIZONTAL, L) roda de verdade, com ?f=<format>.
const motor = ler('assets/template/engine.js')
const fimFormato = motor.indexOf('// ---------- matemática')
assert.ok(fimFormato > 0, 'engine.js mudou: não achei o marcador "// ---------- matemática"')
const cabecalho = motor.slice(0, fimFormato)
const apoio = `const clamp = (x, a = 0, b = 1) => (x < a ? a : x > b ? b : x)
const lerp = (a, b, t) => a + (b - a) * t
const P = (t, a, b) => clamp((t - a) / (b - a))
const E = { inOutCubic: (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2) }
const cena = () => {}`

function contexto(fmt, globais, arquivo) {
  const ctx = vm.createContext({ location: { search: `?f=${fmt}` }, URLSearchParams, Math, Object, JSON, console, ...globais })
  vm.runInContext(cabecalho, ctx)
  vm.runInContext(apoio, ctx)
  vm.runInContext(ler(arquivo), ctx)
  return (expr) => JSON.parse(JSON.stringify(vm.runInContext(expr, ctx)))   // objetos do vm → objetos daqui
}
const area = (W, H) => ({ x0: W * 0.05, x1: W * 0.95, y0: H * 0.05, y1: H * 0.95 })

// ── before-after ───────────────────────────────────────────────────────────────────────────────────
const renderizar = ler(`${AD}/render.mjs`)
const trecho = renderizar.match(/const TAMANHOS = [^\n]+\n/)?.[0] + renderizar.match(/function entradaDoFormato[\s\S]*?\n}\n/)?.[0]
const { TAMANHOS, entradaDoFormato } = new Function(`${trecho}; return { TAMANHOS, entradaDoFormato }`)()
// Fixture neutro, sem marca: só o que o molde lê. A captura de computador (1120×800) com o foco na tela inteira é
// mais estreita que a janela do 19:9 e do 21:9: o caso em que o foco herdado vira uma faixa presa no topo.
const ENTRADA = {
  captura: { telas: { desk: { w: 1120, h: 800, escala: 2 }, cel: { w: 390, h: 844, escala: 3 } } },
  formatos: {
    '16x9': { tela: 'desk', foco: [0, 0, 1120, 800], detalhe: [560, 330], zoomDetalhe: 2.2 },
    '9x16': { tela: 'cel', foco: [0, 0, 390, 480], detalhe: [195, 380], zoomDetalhe: 2 },
    '1x1': { tela: 'desk', foco: [60, 0, 1000, 800], detalhe: [560, 330], zoomDetalhe: 2 },
  },
}

test('before-after: 19x9 e 21x9 estão na tabela de formatos com o tamanho certo', () => {
  for (const [f, wh] of Object.entries(LARGOS)) assert.deepEqual(TAMANHOS[f], wh)
  assert.deepEqual(TAMANHOS['16x9'], [1920, 1080])
})

test('before-after: horizontal sem entrada própria herda a do 16x9; os outros não mudam', () => {
  for (const f of Object.keys(LARGOS)) {
    const r = entradaDoFormato(ENTRADA.formatos, f)
    assert.equal(r.fc, ENTRADA.formatos['16x9'])
    assert.equal(r.herdado, '16x9')
  }
  assert.deepEqual(entradaDoFormato(ENTRADA.formatos, '16x9'), { fc: ENTRADA.formatos['16x9'] })
  const proprio = { ...ENTRADA.formatos, '21x9': { tela: 'desk', foco: [0, 0, 1120, 560] } }
  assert.deepEqual(entradaDoFormato(proprio, '21x9'), { fc: proprio['21x9'] })
  assert.match(entradaDoFormato(ENTRADA.formatos, '4x5').erro, /has no formatos\.4x5/)
  assert.match(entradaDoFormato(ENTRADA.formatos, '7x3').erro, /unknown format: 7x3/)
})

const fc16 = ENTRADA.formatos['16x9']
const telaDesk = ENTRADA.captura.telas[fc16.tela]
const paramAD = (herdado) => ({ marca: { cores: {}, fontes: {} }, textos: {}, tempos: {},
  formato: { foco: fc16.foco, detalhe: fc16.detalhe, w: telaDesk.w, h: telaDesk.h, ...(herdado ? { herdado: '16x9' } : {}) } })
const ad = (fmt, herdado) => contexto(fmt, { PARAM: paramAD(herdado), VIDEO: { duracao: 1 } }, `${AD}/template/scene.js`)

test('before-after: o 16:9 dá exatamente os números de antes', () => {
  const v = ad('16x9')
  const { etq, ...ly } = v('LY')
  assert.deepEqual(ly, { tx: 100, tTop: 150, tPx: 86, txW: 520, win: { x: 660, y: 90, w: 1180, h: 900 },
    leg: { modo: 'coluna', x: 100, y: 640, w: 500, px: 40 }, gat: 'canto' })
  assert.equal(etq, 'dentro')
  assert.deepEqual(v('FOCO'), fc16.foco)
  assert.equal(ad('9x16')('LY.tx'), 70)
  assert.equal(ad('1x1')('LY.tx'), 60)
})

for (const [f, [W, H]] of Object.entries(LARGOS)) {
  test(`before-after ${f}: coluna e janela proporcionais à largura, texto na área segura e fora da captura`, () => {
    const v = ad(f, true), LY = v('LY'), win = LY.win, a = area(W, H)
    assert.equal(v('W'), W)
    assert.ok(LY.tx >= a.x0, `coluna em x ${LY.tx} < ${a.x0}`)
    assert.ok(LY.tx + LY.txW < win.x, 'a coluna de texto invade a janela')
    assert.ok(LY.leg.x >= a.x0 && LY.leg.x + LY.leg.w < win.x, 'a legenda invade a janela ou sai da área segura')
    assert.ok(W - (win.x + win.w) <= a.x0, `sobra ${W - (win.x + win.w)} px vazios à direita da janela`)
    assert.ok(win.x + win.w - 28 <= a.x1, 'a etiqueta da direita sai da área segura')
    assert.ok(win.y + win.h <= a.y1)
    assert.equal(LY.etq, 'fora')
    assert.ok(win.y - 90 >= a.y0, 'não cabe a faixa das etiquetas acima da janela')
    assert.ok(win.w > 1180, 'a janela não cresceu com a largura')
  })

  test(`before-after ${f}: o foco herdado ganha a proporção da janela, sem perder o topo nem o detalhe`, () => {
    const v = ad(f, true), win = v('WIN'), [x, y, w, h] = v('FOCO')
    assert.ok(Math.abs(w / h - win.w / win.h) < 1e-9, 'o foco não tem a proporção da janela')
    assert.ok(x >= 0 && y >= 0 && x + w <= telaDesk.w + 1e-9 && y + h <= telaDesk.h + 1e-9, 'o foco sai da captura')
    assert.equal(y, 0, 'o cabeçalho da tela foi cortado')
    const [dx, dy] = fc16.detalhe
    assert.ok(dx >= x && dx <= x + w && dy >= y && dy <= y + h, 'o detalhe ficou fora do foco')
    assert.deepEqual(ad(f, false)('FOCO'), fc16.foco, 'entrada própria do formato é usada como veio')
  })
}

// ── real-screen-camera ─────────────────────────────────────────────────────────────────────────────
const TELA = { w: 1280, h: 800, dsf: 3 }
const dados = (focos) => ({ tela: TELA, marca: { cores: {}, fontes: { titulo: {}, texto: {} } }, textos: {},
  linha: { geral1: 2.8, focos, passos: [], trechos: [], cursor: [], toques: [], falas: [], inters: [], fim: { v0: 9, v1: 10 }, dur: 10 } })
const tr = (fmt, focos = []) => contexto(fmt, { DADOS: dados(focos), VIDEO: { duracao: 10 } }, `${TR}/scene.js`)

test('tela-real: o 16:9 dá exatamente os números de antes', () => {
  assert.deepEqual(tr('16x9')('LAY'), { card: { x: 72, y: 540, w: 560, ancora: 'meio' }, livre: { x: 680, y: 70, w: 1180, h: 800 },
    cobre: { x: 660, y: 0, w: 1260, h: 1080 }, geral: { cx: 960, cy: 572, w: 1440 }, leg: { y: 1080 - 64, w: 1500, px: 44 },
    sMin: 1.9, frase: 46, rot: 22, titulo: 104, inter: 120 })
  assert.equal(tr('9x16')('LAY.card.x'), 70)
})

for (const [f, [W, H]] of Object.entries(LARGOS)) {
  test(`tela-real ${f}: cartão na margem, área livre e tela ampliada até a direita, plano geral no centro`, () => {
    const LAY = tr(f)('LAY'), a = area(W, H)
    assert.ok(LAY.card.x + 40 >= a.x0, `texto do cartão em x ${LAY.card.x + 40} < ${a.x0}`)
    assert.ok(LAY.card.x + LAY.card.w < LAY.livre.x, 'o cartão invade a área livre do campo')
    assert.ok(LAY.leg.y <= a.y1, 'a legenda passa da área segura embaixo')
    assert.equal(LAY.cobre.x + LAY.cobre.w, W, 'a tela ampliada não vai até a borda direita')
    assert.ok(LAY.livre.w > 1180, 'a área livre não cresceu com a largura')
    assert.equal(LAY.geral.cx, W / 2)
    assert.deepEqual([LAY.frase, LAY.titulo, LAY.inter, LAY.card.w], [46, 104, 120, 560], 'corpos de letra do 16:9')
  })

  test(`tela-real ${f}: com zoom num campo da borda direita do app, a tela cobre até a borda do quadro`, () => {
    const v = tr(f, [{ v: 5, dur: 0.85, reg: { x: 1000, y: 100, w: 260, h: 220 } }])
    const k = v('cam(5)'), LAY = v('LAY')
    assert.ok(k.s >= LAY.sMin && k.s <= TELA.dsf * 1.1 + 1e-9)
    assert.ok(k.tx <= LAY.cobre.x + 0.5, 'sobra vazio à esquerda da faixa coberta')
    assert.ok(k.tx + TELA.w * k.s >= W - 0.5, 'sobra vazio à direita do quadro')
  })
}
