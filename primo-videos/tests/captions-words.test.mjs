// Palavras no tempo do vídeo, linhas curtas e estados da legenda, com a fala de um tutorial de app.
// node --test tests/captions-words.test.mjs
import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { palavrasDoVideo, escrita, agrupar, estados } from '../scripts/captions/words.mjs'
import { ZONAS, COLUNAS, COLUNAS_DO_FORMATO, formatoDe, escolherTopo, acentoPorLinha } from '../scripts/captions/placement.mjs'
import { cuesDaFolha } from '../scripts/captions/sounds.mjs'

const loc = {
  falas: [
    { id: 'abertura', inicio_voz: 0.087, palavras: [{ texto: 'Conhecendo', ini: 0.087, fim: 0.743 }, { texto: 'o', ini: 0.778, fim: 0.801 }, { texto: 'app.', ini: 0.917, fim: 1.309 }] },
    { id: 'p1', inicio_voz: 0.1, palavras: [{ texto: 'O', ini: 0.1, fim: 0.135 }, { texto: 'Início', ini: 0.2, fim: 0.7 }, { texto: 'é', ini: 0.75, fim: 0.8 }, { texto: 'o', ini: 0.85, fim: 0.9 }, { texto: 'resumo', ini: 0.95, fim: 1.4 }, { texto: 'do', ini: 1.45, fim: 1.5 }, { texto: 'mês:', ini: 1.55, fim: 2.0 }] },
  ],
}
const folha = { voz: { falas: [{ id: 'abertura', t: 0.3 }, { id: 'p1', t: 3.051 }] } }

describe('palavrasDoVideo', () => {
  test('o início do arquivo é t da folha − inicio_voz: a 1ª palavra cai em t', () => {
    const p = palavrasDoVideo(loc, folha)
    assert.equal(p[0].ini, 0.3)
    assert.equal(p[0].texto, 'Conhecendo')
    assert.equal(p.find((x) => x.texto === 'O').ini, 3.051)
    assert.equal(p.find((x) => x.texto === 'Início').ini, 3.151)
  })
  test('fala que a folha não tem fica de fora', () => {
    assert.equal(palavrasDoVideo(loc, { voz: { falas: [{ id: 'p1', t: 3 }] } }).every((x) => x.fala === 'p1'), true)
  })
})

describe('a pronúncia fica de fora', () => {
  test('"Ákmi" volta a ser "Acme", com a pontuação e a caixa do escrito', () => {
    const p = escrita([{ texto: 'Ákmi,', ini: 0, fim: 1, fala: 'x' }, { texto: 'ákmi', ini: 1, fim: 2, fala: 'x' }, { texto: 'app.', ini: 2, fim: 3, fala: 'x' }], { Acme: 'Ákmi' })
    assert.deepEqual(p.map((x) => x.texto), ['Acme,', 'Acme', 'app.'])
  })
  test('sem mapa, nada muda', () => {
    const p = [{ texto: 'Ákmi', ini: 0, fim: 1, fala: 'x' }]
    assert.deepEqual(escrita(p), p)
  })
})

describe('agrupar e estados', () => {
  const p = palavrasDoVideo(loc, folha)
  test('quebra em ponto e entre falas; nunca mais que 3 palavras; nunca palavra solta quando dá', () => {
    const l = agrupar(p)
    assert.equal(l[0].map((x) => x.texto).join(' '), 'Conhecendo o app.')
    assert.ok(l.every((x) => x.length <= 3))
    assert.equal(l.flat().length, p.length)
  })
  test('cada palavra tem um estado que começa no ini dela e mostra as anteriores da linha', () => {
    const l = agrupar(p), e = estados(l)
    assert.equal(e.length, p.length)
    e.forEach((s, i) => assert.equal(s.ini, p[i].ini))
    assert.deepEqual(e[1].textos, ['Conhecendo', 'o'])
    assert.equal(e[2].palavra, 2)
  })
  test('os estados não se sobrepõem e a linha sai antes da próxima começar', () => {
    const e = estados(agrupar(p))
    for (let i = 0; i + 1 < e.length; i++) assert.ok(e[i].fim <= e[i + 1].ini + 1e-9, `${i}: ${e[i].fim} > ${e[i + 1].ini}`)
  })
})

describe('lugar da legenda', () => {
  test('formato pelo tamanho; formato estranho é erro, não palpite', () => {
    assert.equal(formatoDe(1080, 1920), '9x16')
    assert.equal(formatoDe(1920, 1080), '16x9')
    assert.throws(() => formatoDe(1000, 1300), /no caption zone/)
  })
  test('9:16 fica acima do terço de baixo; 16:9 embaixo', () => {
    assert.ok(ZONAS['9x16'].base <= 2 / 3 + 1e-9)
    assert.ok(ZONAS['16x9'].topo >= 0.55 && ZONAS['16x9'].base <= 0.95)
  })
  test('escolhe a faixa de menos detalhe dentro da zona e respeita a histerese', () => {
    const det = new Float64Array(100).fill(10)
    for (let y = 40; y < 50; y++) det[y] = 1            // um buraco quieto de 10%
    const e = escolherTopo(det, 0.1, { topo: 0.1, base: 0.66 })
    assert.ok(Math.abs(e.topo - 0.4) < 0.011)
    // a faixa anterior custa pouco mais: fica onde estava
    const quase = det.map((v, y) => (y >= 20 && y < 30 ? 1.1 : v))
    assert.ok(Math.abs(escolherTopo(quase, 0.1, { topo: 0.1, base: 0.66 }, 0.2).topo - 0.2) < 0.011)
  })
  test('nunca sai da zona', () => {
    const det = new Float64Array(100).fill(10)
    for (let y = 80; y < 90; y++) det[y] = 0           // o mais quieto está no terço de baixo
    assert.ok(escolherTopo(det, 0.1, ZONAS['9x16']).topo + 0.1 <= 2 / 3 + 0.011)
  })
})

describe('sons: cues da folha', () => {
  test('só toque, troca de tela e fecho entram; o whoosh vira curto; o nível é da camada', () => {
    const c = cuesDaFolha({ marcos: [
      { t: 1, efeito: 'toque', nivel: -8 }, { t: 2, efeito: 'whoosh', dur: 0.4 }, { t: 3, efeito: 'whoosh' },
      { t: 4, efeito: 'riser' }, { t: 5, efeito: 'sucesso' }, { t: 6, efeito: 'impacto' },
    ] })
    assert.deepEqual(c.map((x) => x.efeito), ['toque', 'whoosh', 'whoosh', 'impacto'])
    assert.equal(c[2].variante, 'curto')
    assert.equal(c[1].dur, 0.4)
    assert.ok(c.every((x) => x.nivel === undefined))
  })
})

describe('colunas e realce', () => {
  test('só o formato largo usa as laterais; o 9:16 fica no centro', () => {
    assert.deepEqual(COLUNAS_DO_FORMATO['9x16'], ['seguro'])
    assert.ok(COLUNAS.seguro.x0 * 1080 >= 70 - 1e-9 && COLUNAS.seguro.x1 * 1080 <= 940 + 1e-9, 'a coluna do 9:16 cabe na área segura da rede')
    assert.ok(COLUNAS_DO_FORMATO['16x9'].includes('esquerda'))
  })
  test('o realce na cor de acento custa: o pico entre os quadros, não a média', () => {
    const w = 10, h = 4, quadro = (comAcento) => { const q = new Uint8Array(w * h * 3).fill(255); if (comAcento) for (let x = 0; x < w; x++) { q[(1 * w + x) * 3] = 254; q[(1 * w + x) * 3 + 1] = 82; q[(1 * w + x) * 3 + 2] = 0 } return q }
    const a = acentoPorLinha({ w, h, quadros: [quadro(false), quadro(true), quadro(false)] }, '#FE5200', { x0: 0, x1: 1 })
    assert.deepEqual([...a], [0, 1, 0, 0])
  })
})
