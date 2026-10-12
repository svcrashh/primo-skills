// O que já se aprendeu sobre a voz, preso em teste: a voz sempre humana no Voice Design e a comparação de timbre.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { descricaoHumana, HUMANA, timbre, distanciaTimbre } from '../scripts/voice.mjs'

test('every Voice Design description asks for a human voice, only once', () => {
  const d = descricaoHumana('young woman from the city, warm')
  assert.ok(d.startsWith('young woman from the city, warm'))
  assert.ok(d.includes(HUMANA))
  assert.equal(descricaoHumana(d), d)
})

test('the timbre of a voice against itself gives distance zero, and against another gives more', () => {
  const sr = 16000, n = sr * 2
  const voz = (f0) => Float32Array.from({ length: n }, (_, i) => { const t = i / sr; return 0.3 * Math.sin(2 * Math.PI * f0 * t) + 0.15 * Math.sin(2 * Math.PI * 2 * f0 * t) + 0.08 * Math.sin(2 * Math.PI * 3 * f0 * t) })
  const a = timbre(voz(220)), b = timbre(voz(220)), c = timbre(voz(330))
  assert.equal(distanciaTimbre(a, b), 0)
  assert.ok(distanciaTimbre(a, c) > 5)
  assert.ok(Math.abs(a.f0 - 220) < 15)
})
