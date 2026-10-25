// visual.painel.letra: a letra pequena de leitura do app, que decide o zoom de leitura do painel (references/tutorial.md,
// "painel"). Um app denso (tabela em 12 px) pede 12; o padrão continua 16.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { resolverVisual } from '../scripts/tutorial/visual.mjs'

const AQUI = path.dirname(fileURLToPath(import.meta.url))
const MARCA = { cores: { fundo: '#F7F8FA', tinta: '#14171C', marca: '#1E3A58', acento: '#D8F35A' } }
const visual = (painel) => ({
  fundo: { tipo: 'liso', cor: 'fundo' },
  moldura: { tipo: 'navegador', cor: '#DEDEDE', tinta: 'tinta', raio: 16, sombra: 'longa' },
  legenda: { tipo: 'faixa', lado: 'baixo', fundo: '#FFFFFF', tinta: 'tinta', rotulo: 'pilula', troca: 'subir' },
  selo: { tipo: 'nenhum' },
  titulo: { caixa: 'normal', peso: 700, espaco: -0.02, entrada: 'palavras', tinta: 'tinta' },
  abertura: { saida: 'mergulho' },
  fechamento: { entrada: 'cortina', fundo: 'fundo', tinta: 'tinta', logo: 'cores', ordem: 'logo' },
  realce: { tipo: 'sublinhado', cor: 'marca', espessura: 6, raio: 3 },
  indicador: { tinta: 'tinta', contorno: '#FFFFFF' },
  ...(painel ? { painel } : {}),
})
const resolve = (painel) => resolverVisual({ versao: 2, visual: visual(painel) }, MARCA).visual

test('sem letra, o painel segue como sempre (o motor usa 16 px)', () => {
  assert.equal(resolve().painel.letra, undefined)
  assert.equal(resolve({ movimento: 'travelling' }).painel.letra, undefined)
})

test('letra 12 passa e chega ao motor', () => {
  assert.equal(resolve({ movimento: 'travelling', letra: 12 }).painel.letra, 12)
})

test('letra fora de 10 a 24, ou que não é número, é recusada dizendo o que é', () => {
  for (const ruim of [8, 30, '12']) assert.throws(() => resolve({ movimento: 'respira', letra: ruim }), /painel\.letra is the app's small reading text/)
})

test('o motor do tutorial lê a letra no zoom de leitura do painel', () => {
  const js = fs.readFileSync(path.join(AQUI, '../scripts/tutorial/tutorial.js'), 'utf8')
  assert.match(js, /const LETRA = \(V && V\.painel && V\.painel\.letra\) \|\| 16/)
  assert.match(js, /PAINEL && !SEM_ZOOM \? Math\.min\(ZMAX \/ 1\.06, 34 \/ \(LETRA \* k\)\)/)
})

test('painel.zoom aceita leitura ou nenhum, e o motor deixa a câmera na tela inteira com nenhum', () => {
  assert.equal(resolve({ movimento: 'plano', zoom: 'nenhum' }).painel.zoom, 'nenhum')
  assert.throws(() => resolve({ movimento: 'plano', zoom: 'perto' }), /painel\.zoom = "perto" does not exist/)
  const js = fs.readFileSync(path.join(AQUI, '../scripts/tutorial/tutorial.js'), 'utf8')
  assert.match(js, /const SEM_ZOOM = !!\(PAINEL && V && V\.painel && V\.painel\.zoom === 'nenhum'\)/)
  assert.match(js, /if \(SEM_ZOOM\) \{ const c = \{ t: A \+ t, x: CX, y: CY, z: 1, dur \}/)
  // a respiração da câmera não aproxima a tela inteira (cortaria a borda da página): quem respira é o painel, só para trás
  assert.match(js, /if \(PAINEL && SEM_ZOOM\) return c/)
  const dr = fs.readFileSync(path.join(AQUI, '../scripts/tutorial/drawing.js'), 'utf8')
  assert.match(dr, /if \(MOV === 'plano' && SEM_ZOOM_P\)/)
  assert.match(dr, /tz = -12 \* \(1 \+ Math\.sin\(t \* 0\.8\)\) - 6 \* \(1 \+ Math\.sin/)
  assert.match(js, /if \(PAINEL && !SEM_ZOOM\) \{/)
})

test('legenda.sobre é true ou false, e com ela a tela fica com a área segura inteira', () => {
  const v = resolverVisual({ versao: 2, visual: { ...visual(), legenda: { tipo: 'faixa', lado: 'baixo', arranjo: 'linha', fundo: '#FFFFFF', tinta: 'tinta', rotulo: 'pilula', troca: 'subir', sobre: true } } }, MARCA).visual
  assert.equal(v.legenda.sobre, true)
  assert.throws(() => resolverVisual({ versao: 2, visual: { ...visual(), legenda: { tipo: 'faixa', lado: 'baixo', fundo: '#FFFFFF', tinta: 'tinta', rotulo: 'pilula', troca: 'subir', sobre: 'sim' } } }, MARCA), /legenda\.sobre must be true or false/)
  const js = fs.readFileSync(path.join(AQUI, '../scripts/tutorial/tutorial.js'), 'utf8')
  assert.match(js, /R = sobre \? \{ x0: S\.x0, x1: S\.x1, y0: S\.y0, y1: S\.y1 \}/)
})

test('a lupa aberta flutua de leve, para não virar quadro parado', () => {
  const dr = fs.readFileSync(path.join(AQUI, '../scripts/tutorial/drawing.js'), 'utf8')
  assert.match(dr, /\(1 \+ 0\.018 \* Math\.sin\(fl \* 2\.6\)\)/)
  assert.match(dr, /lh \/ 2 \+ 7 \* Math\.sin\(fl \* 1\.9\)\)/)
})

test('com legenda.sobre embaixo, a página gravada ganha folga no pé para a rolagem passar da faixa', () => {
  const rec = fs.readFileSync(path.join(AQUI, '../scripts/tutorial/record.mjs'), 'utf8')
  assert.match(rec, /return lg\.sobre && \(lado \|\| 'baixo'\) === 'baixo' \? 200 : 0/)
  assert.match(rec, /folgaBaixo: folgaDaLegenda\(video\)/)
  const pg = fs.readFileSync(path.join(AQUI, '../scripts/tutorial/page.js'), 'utf8')
  assert.match(pg, /body \{ padding-bottom: \$\{cfg\.folgaBaixo\}px !important; \}/)
})
