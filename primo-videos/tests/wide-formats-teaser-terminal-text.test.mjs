// node --test tests/   (sem rede, sem render) os formatos largos 19:9 (2280×1080) e 21:9 (2520×1080) nos moldes
// light-trail-teaser, typing-terminal e typing-text: aceitos, leiaute proporcional à largura, texto dentro
// dos 5% da área segura, e o 16:9 com os mesmos números de antes.
// O teaser e o texto são lidos com o começo real do engine.js (FORMATOS, W, H, HORIZONTAL, L) e o bloco de geometria
// do molde; o terminal tem motor próprio e roda inteiro, com um DOM de mentira.
import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'
import { fileURLToPath } from 'node:url'

const SKILL = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
const ler = (p) => fs.readFileSync(path.join(SKILL, p), 'utf8')
const LARGOS = { '19x9': [2280, 1080], '21x9': [2520, 1080] }
const trecho = (txt, de, ate, onde) => {
  const a = txt.indexOf(de), b = txt.indexOf(ate, a)
  assert.ok(a >= 0 && b > a, `não achei o trecho "${de}" … "${ate}" em ${onde}`)
  return txt.slice(a, b)
}

// o começo do engine.js: formato, W/H, HORIZONTAL e L (sem DOM)
const CABECA = trecho(ler('assets/template/engine.js'), '// ---------- formato', '// ---------- matemática', 'engine.js')
function geometria(arquivo, de, ate, fmt) {
  const ctx = vm.createContext({ location: { search: `?f=${fmt}` }, URLSearchParams, VIDEO: { formatos: [fmt] } })
  vm.runInContext(CABECA, ctx)
  vm.runInContext(trecho(ler(arquivo), de, ate, arquivo), ctx)
  return vm.runInContext('({ G, KX, W, H })', ctx)
}

describe('light-trail-teaser: 19:9 e 21:9', () => {
  const geo = (f) => geometria('templates/light-trail-teaser/teaser.js', '// ── geometria por formato', '\ncena(0, D', f)

  test('16:9 com os números de antes', () => {
    const { G } = geo('16x9')
    assert.deepEqual(
      [G.visW, G.folga, G.nomeW, G.cel.cx, G.cel.fechoX, G.fecho.x, G.fecho.w, G.leg.w, G.leg.x, G.prom.x],
      [1060, 40, 640, 960, 1330, 130, 860, 1500, 210, 96])
  })

  for (const [f, [w, h]] of Object.entries(LARGOS)) {
    test(`${f}: ${w}×${h}, leiaute proporcional e texto dentro dos 5%`, () => {
      const { G, KX, W, H } = geo(f)
      assert.deepEqual([W, H], [w, h])
      assert.equal(KX, w / 1920)
      const x0 = 0.05 * W, x1 = 0.95 * W
      assert.ok(Math.abs(G.visW / W - 1060 / 1920) < 1e-9, 'o fragmento ocupa a mesma fração da largura que no 16:9')
      assert.ok(Math.abs(G.cel.fechoX / W - 1330 / 1920) < 1e-9, 'o celular do fecho fica no mesmo ponto relativo')
      assert.equal(G.cel.cx, W / 2, 'a revelação é no centro do quadro')
      assert.equal(G.leg.x + G.leg.w / 2, W / 2, 'a legenda fica centrada')
      assert.ok(G.prom.x >= x0, 'sobretítulo dentro dos 5%')
      assert.ok(G.fecho.x >= x0, 'fecho dentro dos 5%')
      assert.ok(G.pad + G.folga >= x0, 'conteúdo do fragmento dentro dos 5%')
      assert.ok(110 * KX >= x0 && W - 100 * KX <= x1, 'nome do fragmento dentro dos 5% dos dois lados')
      const celW = Math.round(G.cel.h * 390 / 844)
      assert.ok(G.cel.fechoX + celW / 2 <= x1, 'o celular do fecho cabe no quadro')
      assert.equal(G.cel.h, 930, 'alturas como no 16:9')
    })
  }
})

describe('typing-text: 19:9 e 21:9', () => {
  const geo = (f) => geometria('templates/typing-text/scene/template.js', '// geometria por formato', '// ── fundo único', f)

  test('16:9 e 1:1 com os números de antes', () => {
    const a = geo('16x9').G, b = geo('1x1').G
    assert.deepEqual([a.campoW, a.tituloW, a.areaW, a.legW, a.fraseW, a.campoFs, a.topoY], [1240, 1500, 1240, 1500, 1500, 50, 150])
    assert.deepEqual([b.campoW, b.tituloW, b.areaW, b.legW, b.fraseW], [940, 900, 940, 900, 900])
  })

  for (const [f, [w, h]] of Object.entries(LARGOS)) {
    test(`${f}: ${w}×${h}, larguras crescem com W, corpo como no 16:9`, () => {
      const { G, W, H } = geo(f)
      assert.deepEqual([W, H], [w, h])
      const k = W / 1920
      assert.deepEqual([G.campoW, G.tituloW, G.areaW, G.legW, G.fraseW].map((x) => +(x / k).toFixed(6)), [1240, 1500, 1240, 1500, 1500])
      assert.deepEqual([G.campoFs, G.tituloFs, G.fraseFs, G.campoH, G.cy], [50, 66, 116, 132, 560])
      for (const larg of [G.campoW, G.tituloW, G.areaW, G.legW, G.fraseW]) assert.ok((W - larg) / 2 >= 0.05 * W, 'centrado e dentro dos 5%')
    })
  }
})

describe('typing-terminal: 19:9 e 21:9', () => {
  // DOM de mentira: só o que o template.js toca
  function rodar(fmt) {
    const els = {}
    const elem = () => ({ style: { cssText: '' }, textContent: '', innerHTML: '', insertBefore() {}, lastElementChild: null, getBoundingClientRect: () => ({ height: 0 }) })
    const ctx = vm.createContext({
      URLSearchParams, location: { search: `?f=${fmt}` },
      document: { getElementById: (id) => (els[id] ??= elem()), createElement: elem },
      PARAMS: { nome: 't', formatos: [fmt], cores: { fundo: '#fff', janela: '#000', barra: '#111', texto: '#ddd', comando: '#fff', prompt: '#0f0', cursor: '#ddd', legenda: '#222' },
        terminal: { titulo: 't', prompt: '$', comandos: [{ cmd: 'ls', legenda: 'Lista', saida: [{ t: 0.1, texto: 'a' }] }] } },
    })
    ctx.window = ctx
    vm.runInContext(ler('templates/typing-terminal/template.js'), ctx)
    const n = (e, k) => parseFloat(els[e].style[k])
    return { W: vm.runInContext('W', ctx), H: vm.runInContext('H', ctx), win: ['left', 'top', 'width', 'height'].map((k) => n('win', k)), leg: { top: n('leg', 'top'), fs: n('leg', 'fontSize') }, ctx }
  }

  test('16:9 com os números de antes', () => {
    const r = rodar('16x9')
    assert.deepEqual(r.win, [110, 90, 1700, 900])
    assert.equal(r.leg.top, 996)
  })

  for (const [f, [w, h]] of Object.entries(LARGOS)) {
    test(`${f}: ${w}×${h}, janela esticada na largura e legenda dentro dos 5%`, () => {
      const r = rodar(f)
      assert.deepEqual([r.W, r.H], [w, h])
      const [x, y, larg, alt] = r.win
      assert.equal(x, Math.round(110 * w / 1920))
      assert.equal(x + larg + x, w, 'janela centrada, ocupando a largura')
      assert.ok(x + 36 >= 0.05 * w, 'texto do terminal dentro dos 5%')
      assert.ok(y + alt <= r.leg.top, 'a legenda fica abaixo da janela, sem sobrepor')
      assert.ok(r.leg.top + r.leg.fs * 1.2 <= 0.95 * h, 'legenda dentro dos 5% de baixo')
    })
  }

  test('formato desconhecido recusa com mensagem clara', () => {
    assert.throws(() => rodar('3x2'), /unknown format: 3x2 \(use .*19x9, 21x9/)
  })
})
