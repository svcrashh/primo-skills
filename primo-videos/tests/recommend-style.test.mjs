// node --test tests/   (sem rede)
import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { recomendar, ESTILOS, OBJETIVOS, CANAIS, PRODUTOS } from '../scripts/recommend-style.mjs'

const SCRIPT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'scripts', 'recommend-style.mjs')
const combinacoes = []
for (const objetivo of Object.keys(OBJETIVOS)) for (const canal of Object.keys(CANAIS)) for (const produto of Object.keys(PRODUTOS)) for (const itens of [0, 8]) for (const caixaDeTexto of [false, true]) combinacoes.push({ objetivo, canal, produto, itens, caixaDeTexto })

test('toda combinação dá um recomendado, o porquê e duas ou três alternativas, sem repetir', () => {
  for (const c of combinacoes) {
    const r = recomendar(c)
    assert.ok(ESTILOS[r.recomendado.id], JSON.stringify(c))
    assert.ok(r.porque.length > 10, JSON.stringify(c))
    assert.ok(r.alternativas.length >= 2 && r.alternativas.length <= 3, `${JSON.stringify(c)} → ${r.alternativas.length} alternativas`)
    const ids = [r.recomendado.id, ...r.alternativas.map((a) => a.id)]
    assert.equal(new Set(ids).size, ids.length)
  }
})

test('capítulos com índice nunca é recomendado duas vezes seguidas para o mesmo produto', () => {
  let apareceu = 0
  for (const c of combinacoes) {
    if (recomendar(c).recomendado.id === 'chapters-with-index') apareceu++
    assert.notEqual(recomendar({ ...c, ultimo: 'chapters-with-index' }).recomendado.id, 'chapters-with-index', JSON.stringify(c))
  }
  assert.ok(apareceu > 0, 'capítulos com índice precisa ser recomendado em algum caso')
})

test('casos do guia de escolha', () => {
  assert.equal(recomendar({ objetivo: 'teach', canal: 'site', produto: 'layperson' }).recomendado.id, 'real-screen-camera')
  assert.equal(recomendar({ objetivo: 'teach', canal: 'whatsapp', produto: 'b2b' }).recomendado.id, 'real-screen-camera')
  assert.equal(recomendar({ objetivo: 'launch', canal: 'site', produto: 'b2b', caixaDeTexto: true }).recomendado.id, 'typing-text')
  assert.equal(recomendar({ objetivo: 'update', canal: 'reels', produto: 'young' }).recomendado.id, 'rolling-list')
  assert.equal(recomendar({ objetivo: 'update', canal: 'site', produto: 'creator', itens: 8 }).recomendado.id, 'chapters-with-index')
  assert.equal(recomendar({ objetivo: 'update', canal: 'site', produto: 'creator', itens: 8, ultimo: 'chapters-with-index' }).recomendado.id, 'rolling-list')
  assert.equal(recomendar({ objetivo: 'attention', canal: 'big-screen', produto: 'game' }).recomendado.id, 'light-trail-teaser')
  assert.equal(recomendar({ objetivo: 'results', canal: 'feed', produto: 'retail' }).recomendado.id, 'counting-number')
  assert.equal(recomendar({ objetivo: 'attention', canal: 'reels', produto: 'game' }).recomendado.id, 'before-after')
})

test('o que o tipo de produto manda evitar não é recomendado', () => {
  for (const c of combinacoes) for (const id of PRODUTOS[c.produto].evite) assert.notEqual(recomendar(c).recomendado.id, id, JSON.stringify(c))
  for (const c of combinacoes.filter((c) => c.objetivo === 'teach' && c.canal !== 'big-screen')) assert.notEqual(recomendar(c).recomendado.id, 'light-trail-teaser')
})

test('registrar guarda o último estilo e a recomendação seguinte respeita', () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'recomendar-'))
  const rodar = (...a) => spawnSync(process.execPath, [SCRIPT, ...a], { env: { ...process.env, HOME: home, USERPROFILE: home }, encoding: 'utf8' })
  const pedido = ['--goal', 'update', '--channel', 'site', '--product', 'creator', '--items', '8', '--name', 'Produto X']
  assert.match(rodar(...pedido).stdout, /^Recommended: Chapters with index/)
  assert.equal(rodar('record', '--name', 'Produto X', '--style', 'chapters-with-index').status, 0)
  const depois = rodar(...pedido)
  assert.match(depois.stdout, /^Recommended: Rolling list/)
  assert.match(depois.stdout, /I don't repeat it twice in a row/)
  assert.equal(rodar('--goal', 'xyz', '--channel', 'site').status, 1)
})

const SKILL = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')

test('o vídeo que explica uma ideia (--concept) vai para a explicação desenhada', () => {
  assert.equal(recomendar({ objetivo: 'teach', canal: 'site', produto: 'b2b', conceito: true }).recomendado.id, 'drawn-explainer')
  assert.equal(recomendar({ objetivo: 'teach', canal: 'feed', produto: 'finance', conceito: true }).recomendado.id, 'drawn-explainer')
  assert.match(recomendar({ objetivo: 'teach', canal: 'site', produto: 'b2b', conceito: true }).porque, /works inside/)
})

test('sem --concept o tutorial continua na tela real, com a explicação desenhada entre as alternativas', () => {
  const r = recomendar({ objetivo: 'teach', canal: 'site', produto: 'b2b' })
  assert.equal(r.recomendado.id, 'real-screen-camera')
  assert.ok(r.alternativas.some((a) => a.id === 'drawn-explainer'), r.alternativas.map((a) => a.id).join(', '))
  const e = recomendar({ objetivo: 'teach', canal: 'reels', produto: 'other', explicar: true })
  assert.equal(e.recomendado.id, 'real-screen-camera')
  assert.ok(e.alternativas.some((a) => a.id === 'drawn-explainer'), e.alternativas.map((a) => a.id).join(', '))
})

test('sem --concept (e sem aprovação do dono) a explicação desenhada nunca é a recomendada', () => {
  for (const c of combinacoes) for (const explicar of [false, true]) for (const ultimo of [null, 'chapters-with-index']) {
    assert.notEqual(recomendar({ ...c, explicar, ultimo }).recomendado.id, 'drawn-explainer', JSON.stringify({ ...c, explicar, ultimo }))
  }
})

test('com --concept toda combinação ainda dá duas ou três alternativas, sem repetir', () => {
  for (const c of combinacoes) for (const explicar of [false, true]) {
    const r = recomendar({ ...c, explicar, conceito: true })
    assert.ok(ESTILOS[r.recomendado.id], JSON.stringify(c))
    assert.ok(r.porque.length > 10, JSON.stringify(c))
    assert.ok(r.alternativas.length >= 2 && r.alternativas.length <= 3, `${JSON.stringify({ ...c, explicar })} → ${r.alternativas.length} alternativas`)
    const ids = [r.recomendado.id, ...r.alternativas.map((a) => a.id)]
    assert.equal(new Set(ids).size, ids.length)
  }
})

test('--concept na linha de comando recomenda a explicação desenhada', () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'recomendar-'))
  const r = spawnSync(process.execPath, [SCRIPT, '--goal', 'teach', '--channel', 'site', '--product', 'b2b', '--concept'], { env: { ...process.env, HOME: home, USERPROFILE: home }, encoding: 'utf8' })
  assert.equal(r.status, 0, r.stderr)
  assert.match(r.stdout, /^Recommended: Drawn explainer \(drawn-explainer\)/)
})

test('todo estilo tem ficha no catálogo, e a explicação desenhada aponta para o molde dela', () => {
  for (const id of Object.keys(ESTILOS)) assert.ok(fs.existsSync(path.join(SKILL, 'references', 'catalog', 'styles', `${id}.md`)), `falta a ficha de ${id}`)
  assert.equal(ESTILOS['drawn-explainer'].molde, 'templates/drawn-explainer/TEMPLATE.md')
  assert.ok(PRODUTOS.b2b.puxe.includes('drawn-explainer') && PRODUTOS.layperson.puxe.includes('drawn-explainer') && PRODUTOS.finance.puxe.includes('drawn-explainer'))
})

test('o exemplo de todo estilo é o exemplo de formato do molde dele, que existe e não traz marca', () => {
  for (const canal of Object.keys(CANAIS)) for (const id of Object.keys(ESTILOS)) {
    const ex = recomendar({ objetivo: 'update', canal, aprovado: id }).recomendado.exemplo
    assert.ok(ex, `${id} sem exemplo`)
    // ex é o caminho do sistema, para abrir; o exemplo do estilo é o relativo da skill, sempre com /
    assert.equal(path.relative(SKILL, ex), path.normalize(ESTILOS[id].exemplo), id)
    assert.ok(fs.existsSync(ex), ex)
    assert.doesNotMatch(path.relative(SKILL, ex), /gallery|sample\.mp4/)
  }
})
