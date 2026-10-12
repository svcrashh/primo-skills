// node --test tests/wide-formats-list-number.test.mjs   (sem rede, sem navegador): os moldes rolling-list e
// counting-number aceitam 19:9 (2280×1080) e 21:9 (2520×1080) com o leiaute esticado na largura e o texto dentro da
// área segura de 5%, e os formatos de antes (16:9, 9:16, 1:1, 4:5) saem com os mesmos números de sempre.
// O código de leiaute roda de verdade: o cabeçalho de formato do engine.js (FORMATOS, W, H, HORIZONTAL, L) e o
// list.js / template.js inteiros, num vm, com o DOM trocado por stubs (as cenas não são montadas).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import vm from 'node:vm'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const LISTA = path.join(RAIZ, 'templates', 'rolling-list')
const NUMERO = path.join(RAIZ, 'templates', 'counting-number')
const ler = (...p) => fs.readFileSync(path.join(...p), 'utf8')
const ENGINE = ler(RAIZ, 'assets', 'template', 'engine.js')
const MARCO = '// ---------- matemática'
const CABECALHO = ENGINE.slice(0, ENGINE.indexOf(MARCO))
const STUBS = `
const rgba = (h, a) => 'rgba(' + h + ',' + a + ')'
function cena() {}
`
const LARGOS = { '19x9': [2280, 1080], '21x9': [2520, 1080] }

function rodar(fmt, partes, saida) {
  const ctx = { location: { search: `?f=${fmt}` }, URLSearchParams, console,
    document: { createElement: () => ({ getContext: () => ({ font: '', measureText: (s) => ({ width: s.length * 10 }) }) }) } }
  vm.createContext(ctx)
  vm.runInContext(partes.join('\n;\n') + `\n;this.SAIDA = { W, H, ${saida} }`, ctx)
  return JSON.parse(JSON.stringify(ctx.SAIDA))
}

const paramsLista = JSON.parse(ler(LISTA, 'example.json'))
const lista = (fmt) => rodar(fmt, [`const PARAMS = ${JSON.stringify(paramsLista)}`, ler(LISTA, 'template', 'plan.js'), ler(LISTA, 'template', 'video.js'),
  CABECALHO, STUBS, ler(LISTA, 'template', 'list.js')], 'LAY, FORMATOS_VIDEO: VIDEO.formatos')

const paramsNumero = JSON.parse(ler(NUMERO, 'example.json'))
const numero = (fmt) => rodar(fmt, [`const PARAMS = ${JSON.stringify(paramsNumero)}`, ler(NUMERO, 'video.js'), CABECALHO, STUBS, ler(NUMERO, 'template.js')], 'AREA, SOBRA')

test('o cabeçalho de formato do engine.js está onde o teste espera', () => {
  assert.ok(ENGINE.includes(MARCO), `o engine.js não tem mais a linha "${MARCO}": ajuste o teste`)
})

// ---------- rolling-list ----------
// os leiautes de antes, copiados do list.js original: estes formatos não podem mudar
const LISTA_ANTES = {
  '16x9': { m: 120, painel: { x: 200, y: 56, w: 1520, h: 730 }, faixa: { x: 120, y: 818, w: 1680, h: 160 }, leg: { y: 1004, px: 38 },
    frase: 76, linhas: 1, badge: 96, etq: 26, cartaz: 118, bloco: { x: 1240, y: 0, w: 680, h: 1080 }, muroX: 60 },
  '9x16': { m: 90, painel: { x: 60, y: 250, w: 960, h: 900 }, faixa: { x: 90, y: 1190, w: 900, h: 310 }, leg: { y: 1580, px: 44 },
    frase: 84, linhas: 2, badge: 96, etq: 28, cartaz: 112, bloco: { x: 0, y: 760, w: 1080, h: 420 } },
  '1x1': { m: 80, painel: { x: 70, y: 56, w: 940, h: 630 }, faixa: { x: 80, y: 716, w: 920, h: 220 }, leg: { y: 978, px: 34 },
    frase: 60, linhas: 2, badge: 76, etq: 22, cartaz: 92, bloco: { x: 0, y: 420, w: 1080, h: 290 } },
  '4x5': { m: 80, painel: { x: 70, y: 70, w: 940, h: 800 }, faixa: { x: 80, y: 900, w: 920, h: 240 }, leg: { y: 1214, px: 36 },
    frase: 66, linhas: 2, badge: 84, etq: 24, cartaz: 100, bloco: { x: 0, y: 540, w: 1080, h: 340 } },
}

test('rolling-list: 16:9, 9:16, 1:1 e 4:5 com os números de sempre', () => {
  for (const [fmt, antes] of Object.entries(LISTA_ANTES)) assert.deepEqual(lista(fmt).LAY, antes, fmt)
})

test('rolling-list: 19:9 e 21:9 no tamanho certo, aceitos pelo video.js, com o leiaute esticado na largura', () => {
  for (const [fmt, [w, h]] of Object.entries(LARGOS)) {
    const { W, H, LAY, FORMATOS_VIDEO } = lista(fmt)
    assert.deepEqual([W, H], [w, h], fmt)
    assert.ok(FORMATOS_VIDEO.includes(fmt), `${fmt} fora de VIDEO.formatos`)
    const x0 = W * 0.05, x1 = W * 0.95, y1 = H * 0.95
    // painel centrado e na mesma fração da largura que no 16:9 (1520/1920), nada de 16:9 com sobra à direita
    assert.equal(LAY.painel.x * 2 + LAY.painel.w, W, `${fmt}: painel fora do centro`)
    assert.ok(Math.abs(LAY.painel.w / W - 1520 / 1920) < 0.002, `${fmt}: painel com ${LAY.painel.w} px`)
    assert.equal(LAY.bloco.x + LAY.bloco.w, W, `${fmt}: o bloco do cartaz não chega na borda direita`)
    // texto: margem, faixa (número, etiqueta, frase) e pílulas do muro dentro da área segura de 5%
    assert.ok(LAY.m >= x0, `${fmt}: margem ${LAY.m} < ${x0}`)
    assert.ok(LAY.faixa.x >= x0 && LAY.faixa.x + LAY.faixa.w <= x1, `${fmt}: faixa ${LAY.faixa.x}–${LAY.faixa.x + LAY.faixa.w} fora de ${x0}–${x1}`)
    assert.ok(LAY.muroX >= x0, `${fmt}: pílulas do muro a ${LAY.muroX} px da borda (< ${x0})`)
    // a legenda (38 px) tem as letras até 55 px abaixo do topo da pílula (medido no quadro): cabe até 0,95·H
    assert.ok(LAY.leg.y + 55 <= y1, `${fmt}: legenda até ${LAY.leg.y + 55} > ${y1}`)
    // e não encosta na frase (a frase de 76 px termina ~137 px abaixo do topo da faixa): respiro de 30 px ou mais
    assert.ok(LAY.leg.y - (LAY.faixa.y + 137) >= 30, `${fmt}: legenda a ${LAY.leg.y - (LAY.faixa.y + 137)} px da frase`)
    assert.ok(LAY.painel.y + LAY.painel.h + 32 <= LAY.faixa.y, `${fmt}: painel encosta na faixa`)
    // o que depende da altura fica como no 16:9
    for (const k of ['frase', 'linhas', 'badge', 'etq', 'cartaz']) assert.equal(LAY[k], LISTA_ANTES['16x9'][k], `${fmt}: ${k}`)
  }
})

test('rolling-list: o render.mjs aceita 19x9 e 21x9 e recusa formato desconhecido antes de montar qualquer coisa', () => {
  const saida = fs.mkdtempSync(path.join(os.tmpdir(), 'lista-fmt-'))
  const r = spawnSync(process.execPath, [path.join(LISTA, 'render.mjs'), path.join(LISTA, 'example.json'), '--out', path.join(saida, 'x'), '--formats', '19x9,3x2'], { encoding: 'utf8' })
  assert.equal(r.status, 1)
  assert.match(r.stderr, /unknown format for this template: 3x2\./)
  assert.match(r.stderr, /16x9, 19x9, 21x9, 9x16, 1x1, 4x5/)
  assert.ok(!fs.existsSync(path.join(saida, 'x')), 'o render criou a pasta antes de recusar o formato')
  fs.rmSync(saida, { recursive: true, force: true })
})

// ---------- counting-number ----------
// as áreas de antes, medidas no template.js original (o 4:5 é vertical: o LF dá a ele a área do 9:16)
const AREA_ANTES = {
  '16x9': { x0: 110, x1: 1810, y0: 150, y1: 860 },
  '9x16': { x0: 140, x1: 940, y0: 300, y1: 1250 },
  '1x1': { x0: 90, x1: 990, y0: 150, y1: 880 },
  '4x5': { x0: 140, x1: 940, y0: 300, y1: 1250 },
}
const comDerivados = (a) => ({ ...a, w: a.x1 - a.x0, h: a.y1 - a.y0, cx: (a.x0 + a.x1) / 2, cy: (a.y0 + a.y1) / 2 })

test('counting-number: 16:9, 9:16, 1:1 e 4:5 com a mesma área de sempre e nenhuma sobra', () => {
  for (const [fmt, a] of Object.entries(AREA_ANTES)) {
    const r = numero(fmt)
    assert.deepEqual(r.AREA, comDerivados(a), fmt)
    assert.equal(r.SOBRA, 0, fmt)
  }
})

test('counting-number: 19:9 e 21:9 com a área esticada na largura, centrada e dentro dos 5%', () => {
  for (const [fmt, [w, h]] of Object.entries(LARGOS)) {
    const { W, H, AREA, SOBRA } = numero(fmt)
    assert.deepEqual([W, H], [w, h], fmt)
    assert.equal(SOBRA, W - 1920, fmt)
    assert.ok(AREA.x0 >= W * 0.05 && AREA.x1 <= W * 0.95, `${fmt}: área ${AREA.x0}–${AREA.x1} fora de ${W * 0.05}–${W * 0.95}`)
    assert.equal(AREA.cx, W / 2, `${fmt}: área fora do centro`)
    assert.ok(Math.abs(AREA.w / W - 1700 / 1920) < 0.002, `${fmt}: área com ${AREA.w} px`)
    assert.deepEqual([AREA.y0, AREA.y1], [150, 860], `${fmt}: a altura útil é a do 16:9`)
  }
})

test('counting-number: a folha do render.sh tem escala para 19x9 e 21x9 (270 px de altura, como o 16:9)', () => {
  const sh = ler(NUMERO, 'render.sh')
  assert.match(sh, /19x9\) SC=570:-1; TL=6x4;;/)
  assert.match(sh, /21x9\) SC=630:-1; TL=6x4;;/)
})
