// node --test tests/   g.na e o aviso de silêncio do modo tutorial com voz: só as funções puras do locucao.mjs, sem navegador.
import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { acharPalavra, instanteDaPalavra, linhaDoTempo, silencios, ENTRA, NA_ANTES, SILENCIO_MAX, util } from '../scripts/tutorial/locucao.mjs'

// uma fala de mentira no formato da narration.json (references/voice-tutorial.md): palavras com ini/fim desde o início do arquivo
function fala(n, texto, { inicio = 0.06, passo = 0.42 } = {}) {
  const palavras = texto.split(' ').map((t, i) => ({ texto: t, ini: +(inicio + i * passo).toFixed(3), fim: +(inicio + i * passo + passo - 0.05).toFixed(3) }))
  return { id: `p${n}`, onde: { passo: n }, texto, arquivo: `lines/p${n}.wav`, duracao: palavras.at(-1).fim + 0.1, inicio_voz: inicio, palavras }
}
const barra = fala(4, 'The bottom bar leads to Sales, Network and Wallet.')
const repetida = fala(2, 'Tap on Network, and then on Network again.')

describe('g.na: finding the word in the line', () => {
  test('one word, without case and without punctuation', () => {
    assert.deepEqual(acharPalavra(barra, 'Sales'), { ini: 5, fim: 6 })
    assert.deepEqual(acharPalavra(barra, 'wallet'), { ini: 8, fim: 9 })
  })

  test('a sequence of two words', () => {
    assert.deepEqual(acharPalavra(barra, 'bottom bar'), { ini: 1, fim: 3 })
    assert.deepEqual(acharPalavra(barra, 'Sales Network'), { ini: 5, fim: 7 })
  })

  test('a repeated word: looking after the last one matched, takes the 2nd', () => {
    const a = acharPalavra(repetida, 'Network')
    assert.equal(a.ini, 2)
    const b = acharPalavra(repetida, 'Network', a.fim)
    assert.equal(b.ini, 6)
    assert.throws(() => acharPalavra(repetida, 'Network', b.fim), /has no more of that word after "Network"/)
  })

  test('a missing word: an error with the step, the word and the line', () => {
    assert.throws(() => acharPalavra(barra, 'Wallets'), {
      message: `g.na('Wallets'): step 4's line does not have that word ("The bottom bar leads to Sales, Network and Wallet.")`,
    })
    assert.throws(() => acharPalavra(barra, '  '), /step 4/)
  })
})

describe('g.na: the moment of the word', () => {
  test('matches the time linhaDoTempo gives the word in the video', () => {
    const A = 2.4, tPasso = 11.37
    const loc = { abertura: null, fechamento: null, passos: new Map([[4, barra]]) }
    const log = { eventos: [{ tipo: 'passo', n: 1, t: 0.5 }, { tipo: 'passo', n: 2, t: 4 }, { tipo: 'passo', n: 3, t: 7.2 }, { tipo: 'passo', n: 4, t: tPasso }] }
    const [x] = linhaDoTempo(loc, log, { A, D: 40 })
    for (const i of [0, 5, 6, 8]) assert.ok(Math.abs(x.palavras[i].ini - (A + instanteDaPalavra(barra, i, tPasso))) < 0.001, `word ${i}`)
    // e a 1ª palavra cai no primeiro som, ENTRA depois da troca de legenda
    assert.ok(Math.abs(instanteDaPalavra(barra, 0, tPasso) - (tPasso + ENTRA)) < 1e-9)
  })

  test('the default lead lets the pointer arrive before the word', () => {
    assert.ok(NA_ANTES >= 0.45 && NA_ANTES <= 0.8)
  })
})

describe('silence warning', () => {
  const passos = new Map([[1, fala(1, 'Open the app.')], [2, barra], [4, fala(4, 'Done, saved.')]])
  const fimDa = (n, t) => t + ENTRA + util(passos.get(n))

  test('from the end of the line to the 1st sound of the next one, skipping a step without a line; the last goes to the end of the recording', () => {
    const t1 = 0.5, t2 = 5, t3 = 18, t4 = 21
    const eventos = [
      { t: t1, tipo: 'passo', n: 1 }, { t: 2.2, tipo: 'toque' },
      { t: t2, tipo: 'passo', n: 2 }, ...[9.5, 11, 12.6, 14.1].map((t) => ({ t, tipo: 'toque' })),
      { t: t3, tipo: 'passo', n: 3 }, { t: 19, tipo: 'toque' },
      { t: t4, tipo: 'passo', n: 4 },
    ]
    const fim = fimDa(4, t4) + 1.0
    const s = silencios(eventos, passos, fim)
    const s1 = +(t2 + ENTRA - fimDa(1, t1)).toFixed(3)
    const s2 = +(t4 + ENTRA - fimDa(2, t2)).toFixed(3)
    assert.ok(s1 > SILENCIO_MAX && s2 > 10)
    assert.deepEqual(s, [{ n: 1, seg: s1, toques: 1 }, { n: 2, seg: s2, toques: 5 }])
    assert.ok(!s.some((x) => x.n === 4))
  })

  test('a tap during the line does not count; a short stretch does not warn', () => {
    const eventos = [{ t: 0.5, tipo: 'passo', n: 1 }, { t: 0.9, tipo: 'toque' }, { t: fimDa(1, 0.5) + 1.2, tipo: 'passo', n: 2 }]
    assert.deepEqual(silencios(eventos, passos, fimDa(2, eventos[2].t) + 3.4), [{ n: 2, seg: 3.4, toques: 0 }])
  })
})
