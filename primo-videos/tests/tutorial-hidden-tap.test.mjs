// node --test tests/   o toque oculto (g.toque(…, { oculto: true })): o toque de quem é atendido, num vídeo de venda, não
// ganha som de toque na folha de sincronia nem dedo, onda, realce ou câmera na composição.
import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { folhaDoVideo } from '../scripts/tutorial/compose.mjs'

const log = (eventos) => ({ versao: 'phone', duracao: 12, aparelho: { toque: true, formato: '9x16' }, eventos })
const toque = (t, extra = {}) => ({ t, tipo: 'toque', alvo: 'button "manda"', ret: { x: 10, y: 700, w: 200, h: 50 }, ponto: [110, 725], realce: true, checagem: [], ...extra })
const marcos = (eventos) => folhaDoVideo({ id: 'v' }, log(eventos), { A: 2, F: 2, semente: 1, serie: {} }).marcos

describe('toque oculto', () => {
  test('o toque de sempre ganha o som de toque no instante dele', () => {
    const m = marcos([toque(3)])
    assert.equal(m.filter((x) => x.efeito === 'toque').length, 1)
    assert.equal(m.find((x) => x.efeito === 'toque').t, 5)
  })

  test('o toque oculto não ganha som', () => {
    const m = marcos([toque(3, { oculto: true, realce: false }), toque(6)])
    assert.deepEqual(m.filter((x) => x.efeito === 'toque').map((x) => x.t), [8])
  })

  test('o gravador grava o toque oculto sem realce e sem mover o indicador', () => {
    const src = fs.readFileSync(new URL('../scripts/tutorial/record.mjs', import.meta.url), 'utf8')
    assert.match(src, /oculto = false/)
    assert.match(src, /if \(!oculto\) await mover\(c1\.pt, rapido\)/)
    assert.match(src, /realce: realce && !oculto/)
    assert.match(src, /\.\.\.\(oculto \? \{ oculto: true \} : \{\}\)/)
  })

  test('o aponta sem dedo não move o indicador', () => {
    const src = fs.readFileSync(new URL('../scripts/tutorial/record.mjs', import.meta.url), 'utf8')
    assert.match(src, /async aponta\(alvo, \{ ponto = null, ms = 1100, realce = true, dedo = true, lupa = null, margem = null \} = \{\}\)/)
    assert.match(src, /if \(dedo\) await mover\(pt\)/)
  })

  test('a composição não leva a câmera nem desenha dedo e onda no toque oculto', () => {
    const src = fs.readFileSync(new URL('../scripts/tutorial/tutorial.js', import.meta.url), 'utf8')
    assert.match(src, /const toques = ev\.filter\(\(e\) => e\.tipo === 'toque' && !e\.oculto\)/)
    assert.match(src, /e\.tipo === 'aponta' \|\| e\.tipo === 'prova'\) && e\.ret && !e\.oculto\)/)
    assert.match(src, /test\(e\.tipo\) && e\.ret && !e\.oculto\)/)
  })
})
