// Lições da escolha de estilo, presas em teste: quando o pedido é explicação, e quando o dono já aprovou um vídeo do produto.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { recomendar } from '../scripts/recommend-style.mjs'

test('pedido que pede explicação vai para capítulos, não para a lista de painéis', () => {
  const r = recomendar({ objetivo: 'update', canal: 'reels', produto: 'creator', itens: 8, explicar: true })
  assert.equal(r.recomendado.id, 'chapters-with-index')
  const t = recomendar({ objetivo: 'teach', canal: 'reels', produto: 'other', explicar: true })
  assert.equal(t.recomendado.id, 'real-screen-camera')
})

test('o estilo aprovado pelo dono é a régua, mesmo que seja capítulos de novo', () => {
  const r = recomendar({ objetivo: 'update', canal: 'reels', produto: 'young', ultimo: 'chapters-with-index', aprovado: 'chapters-with-index' })
  assert.equal(r.recomendado.id, 'chapters-with-index')
  const s = recomendar({ objetivo: 'update', canal: 'site', produto: 'creator', itens: 8, ultimo: 'chapters-with-index' })
  assert.notEqual(s.recomendado.id, 'chapters-with-index')
})
