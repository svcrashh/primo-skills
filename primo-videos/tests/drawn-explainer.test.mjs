// node --test tests/   (sem rede): o molde explicação desenhada — linha do tempo pela voz e sem voz, marcas, tema da
// marca, áreas seguras da skill, busca de ícones, os sons do motor no catálogo do sounds.py e os exemplos montando.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { acharPython } from '../scripts/where.cjs'
import { montarLinha, resolverMarcas, PADRAO } from '../templates/drawn-explainer/timeline.mjs'
import { temaDaMarca, TEXTURAS, colorOf } from '../templates/drawn-explainer/scene/engine/brand.js'
import { layoutAreas, areaSegura, FORMATOS } from '../templates/drawn-explainer/scene/engine/layout.js'
import { Stage } from '../templates/drawn-explainer/scene/engine/stage.js'
import { carregar, buscar } from '../templates/drawn-explainer/icons.mjs'

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const MOLDE = path.join(RAIZ, 'templates', 'drawn-explainer')
const LOC = {
  falas: [{
    id: 'f1', arquivo: 'falas/f1.wav', duracao: 4.0, inicio_voz: 0.05,
    palavras: [
      { texto: 'O', ini: 0.05, fim: 0.12 }, { texto: 'pedido', ini: 0.15, fim: 0.5 }, { texto: 'vai', ini: 0.55, fim: 0.7 },
      { texto: 'para', ini: 0.72, fim: 0.9 }, { texto: 'a', ini: 0.92, fim: 0.96 }, { texto: 'fila.', ini: 1.0, fim: 1.4 },
      { texto: 'A', ini: 1.9, fim: 1.95 }, { texto: 'fila', ini: 2.0, fim: 2.3 }, { texto: 'responde.', ini: 2.35, fim: 3.0 },
    ],
  }],
}
const marca = { nome: 'Teste', cores: { fundo: '#0b1020', texto: '#f5f0e6', destaque: '#ff7a00' }, fontes: { titulo: 'Oswald', texto: 'Rubik' } }
const quase = (a, b, tol = 1e-6) => assert.ok(Math.abs(a - b) <= tol, `${a} ≠ ${b}`)

test('com voz, a cena dura o respiro, o trecho da fala e o respiro de depois, e as palavras andam com o lead', () => {
  const tl = montarLinha([{ id: 'a', fala: 'f1', de: 0, ate: 1.5 }, { id: 'b', fala: 'f1', de: 1.5, ate: 3.1, marcas: { volta: 'fila', fim: 'responde' } }], LOC)
  const [a, b] = tl.scenes
  quase(a.dur, Math.round((PADRAO.lead + 1.5 + PADRAO.hold) * 30) / 30)
  quase(a.words[1].start, PADRAO.lead + 0.15, 1e-3)
  assert.equal(a.words.length, 6)
  assert.equal(b.words[0].text, 'A')
  quase(b.words[0].start, PADRAO.lead + 0.4, 1e-3)
  quase(b.marks.volta, PADRAO.lead + 0.5, 1e-3)
  quase(b.marks.fim, PADRAO.lead + 0.85, 1e-3)
  quase(b.dur, Math.round((PADRAO.lead + 1.6 + PADRAO.hold + PADRAO.end) * 30) / 30)   // a última cena ganha o fim
  assert.equal(tl.voz.length, 2)
  quase(tl.voz[1].inicio, b.start + PADRAO.lead, 1e-3)
  quase(tl.voz[1].som, tl.voz[1].inicio + 0.4, 1e-3)
  assert.equal(a.transition, 'none')
  assert.equal(b.transition, 'auto')
  quase(tl.duration, b.start + b.dur, 1e-6)
})

test('o trecho que começa no meio de uma fala começa no primeiro som medido, não onde o alinhamento pôs a palavra', () => {
  const tl = montarLinha([{ id: 'a', fala: 'f1', de: 1.5, ate: 3.1 }], LOC, { inicios: { a: 0.47 } })
  const [a] = tl.scenes
  quase(a.words[0].start, PADRAO.lead + 0.47, 1e-3)
  quase(tl.voz[0].som, tl.voz[0].inicio + 0.47, 1e-3)
  const cedo = montarLinha([{ id: 'a', fala: 'f1', de: 1.5, ate: 3.1 }], LOC, { inicios: { a: 0.2 } })
  quase(cedo.scenes[0].words[0].start, PADRAO.lead + 0.4, 1e-3)   // a palavra fica; o som (um respiro) vem antes dela
  quase(cedo.voz[0].som, cedo.voz[0].inicio + 0.2, 1e-3)
})

test('sem voz, a cena que tinha fala lê o mesmo texto (os cues continuam valendo) e a cena muda dura o min', () => {
  const tl = montarLinha([{ id: 'a', fala: 'f1', de: 0, ate: 1.5, marcas: { fila: 'fila' } }, { id: 'b', min: 2.4 }], LOC, { semVoz: true })
  const [a, b] = tl.scenes
  assert.equal(a.voice, null)
  assert.equal(a.sintetico, true)
  assert.deepEqual(a.words.map((w) => w.text), ['O', 'pedido', 'vai', 'para', 'a', 'fila.'])
  quase(a.marks.fila, PADRAO.lead + 5 / PADRAO.leitura, 1e-3)
  assert.equal(tl.voz.length, 0)
  quase(b.dur, Math.round((2.4 + PADRAO.end) * 30) / 30)
  const so = montarLinha([{ id: 'c', texto: 'uma duas três quatro cinco seis sete oito nove dez onze doze' }], null)
  assert.ok(so.scenes[0].dur >= PADRAO.lead + 12 / PADRAO.leitura, 'a cena dura pelo menos o tempo de ler o texto')
})

test('marca por palavra, pela vez em que ela é dita, por frase e em segundos; palavra que não existe dá erro com sugestão', () => {
  const ws = [{ text: 'a', start: 1 }, { text: 'fila', start: 2 }, { text: 'anda,', start: 3 }, { text: 'a', start: 4 }, { text: 'fila', start: 5 }]
  assert.deepEqual(resolverMarcas({ id: 'x', marcas: { um: 'fila', dois: 'fila#2', frase: 'a fila', fixo: 1.25, depois: { palavra: 'anda', mais: 0.3 } } }, ws), { um: 2, dois: 5, frase: 1, fixo: 1.25, depois: 3.3 })
  assert.throws(() => resolverMarcas({ id: 'x', marcas: { m: 'filas' } }, ws), /is not in the line.*fila/)
  assert.throws(() => montarLinha([{ id: 'a', fala: 'nao-existe' }], LOC), /is not in narration\.json/)
  assert.throws(() => montarLinha([{ id: 'a' }, { id: 'a' }], null), /appears twice/)
  assert.throws(() => montarLinha([{ id: 'a', transicao: 'girar' }], null), /does not exist/)
  assert.throws(() => montarLinha([{ id: 'com-hifen' }], null), /function name/)
})

test('a marca vira o tema: cores, fontes e escuro da marca; a textura só muda traço, entrada e sons', () => {
  const t = temaDaMarca(marca, 'papel')
  assert.equal(t.bg, '#0b1020')
  assert.equal(t.dark, true)
  assert.equal(colorOf(t, 'accent'), '#ff7a00')
  assert.equal(colorOf(t, 'destaque'), '#ff7a00')
  assert.equal(t.fonts.display.family, 'Oswald')
  assert.equal(t.fonts.hand.family, 'Rubik', 'sem fonte de mão, a da marca')
  assert.equal(t.stroke.rough, true)
  assert.equal(t.sfx.shape, 'rabisco')
  assert.equal(temaDaMarca(marca, 'giz').sfx.shape, 'giz')
  assert.equal(temaDaMarca(marca, 'nenhuma').stroke.rough, false)
  assert.equal(temaDaMarca({ ...marca, cores: { ...marca.cores, fundo: '#fbf7ef', texto: '#1d2b22' } }).dark, false)
  assert.equal(temaDaMarca({ ...marca, paleta: ['#111111', '#222222'] }).colors.green, '#222222')
  assert.throws(() => temaDaMarca(marca, 'cartoon'), /textura/)
  assert.throws(() => temaDaMarca({ ...marca, cores: { ...marca.cores, destaque: 'laranja' } }), /destaque/)
  assert.throws(() => temaDaMarca({ ...marca, fontes: {} }), /fontes/)
})

test('áreas seguras da skill: Reels no 9:16, 60 px no 4:5 e no 1:1, 5% no 16:9, e a legenda fora do conteúdo', () => {
  assert.deepEqual(areaSegura('9x16', 'reels', 1080, 1920), { left: 70, top: 250, right: 940, bottom: 1450, nome: 'reels', app: true })
  assert.equal(areaSegura('9x16', null, 1080, 1920).bottom, 1450)
  assert.equal(areaSegura('9x16', 'stories', 1080, 1920).bottom, 1580)
  assert.equal(areaSegura('4x5', null, 1080, 1350).left, 60)
  assert.equal(areaSegura('16x9', null, 1920, 1080).left, 96)
  const v = layoutAreas({ formato: '9x16', plataforma: 'reels', captions: true }, 1080, 1920)
  assert.ok(v.safe.left >= 70 && v.safe.right <= 940 && v.safe.top >= 250)
  assert.ok(v.captions.bottom <= 1450 && v.safe.bottom < v.band.top, 'a legenda senta dentro da área do Reels e o conteúdo acaba acima dela')
  const h = layoutAreas({ formato: '16x9', plataforma: null, captions: false }, 1920, 1080)
  assert.equal(h.safe.left, 96, 'a mais estrita das duas: 5% da largura (skill) contra 7% da altura (motor original)')
  assert.equal(h.safe.top, Math.round(1080 * 0.07))
})

test('19:9 e 21:9: horizontais com a altura do 16:9, 5% de margem, valores do 16:9 no s.L e o renderizar aceita os dois', () => {
  assert.deepEqual(FORMATOS['19x9'], [2280, 1080])
  assert.deepEqual(FORMATOS['21x9'], [2520, 1080])
  assert.deepEqual(areaSegura('19x9', null, 2280, 1080), { left: 114, top: 54, right: 2166, bottom: 1026, nome: '19:9 (5%)' })
  assert.deepEqual(areaSegura('21x9', { '9x16': 'reels' }, 2520, 1080), { left: 126, top: 54, right: 2394, bottom: 1026, nome: '21:9 (5%)' })
  assert.equal(layoutAreas({ formato: '21x9', plataforma: null, captions: false }, 2520, 1080).safe.left, 126)
  const L = (formato, W, H, o) => Stage.prototype.L.call({ formato, horizontal: W > H, vertical: H > W }, o)
  const o = { '16x9': 118, '9x16': 122, padrao: 96 }
  assert.equal(L('19x9', 2280, 1080, o), 118, 'o 19:9 sem chave usa o do 16:9')
  assert.equal(L('21x9', 2520, 1080, { ...o, '21x9': 130 }), 130, 'a chave própria vence')
  assert.equal(L('4x5', 1080, 1350, o), 96, 'o 4:5 continua no padrao, como antes')
  assert.equal(L('9x16', 1080, 1920, o), 122)
  const r = spawnSync(process.execPath, [path.join(MOLDE, 'render.mjs'), path.join(MOLDE, 'example.json'), '--out', path.join(MOLDE, 'nao-cria'), '--formats', '32x9'], { encoding: 'utf8' })
  assert.equal(r.status, 1)
  assert.match(r.stderr, /format "32x9" does not exist: .*19x9, 21x9/)
  assert.ok(!fs.existsSync(path.join(MOLDE, 'nao-cria')), 'formato recusado não monta obra')
})

test('a busca de ícones acha pelo nome, pelas tags e pela palavra em português', () => {
  const lib = carregar()
  assert.ok(lib.nomes.length > 1800)
  assert.ok(buscar('dinheiro', lib).achados.some((a) => a.nome === 'banknote'))
  assert.equal(buscar('server', lib).achados[0].nome, 'server')
  assert.ok(buscar('banco de dados', lib).achados.some((a) => a.nome === 'database'))
})

test('o porte guarda os créditos: licenças do motor original, do rough.js e do Lucide, e o crédito no topo de cada arquivo portado', () => {
  assert.match(fs.readFileSync(path.join(MOLDE, 'LICENSE-explainroo.txt'), 'utf8'), /MIT License[\s\S]*Vincent Schmalbach/)
  assert.match(fs.readFileSync(path.join(MOLDE, 'scene', 'vendor', 'LICENSE-roughjs.txt'), 'utf8'), /MIT License[\s\S]*Preet Shihn/)
  assert.match(fs.readFileSync(path.join(MOLDE, 'scene', 'vendor', 'LICENSE-lucide.txt'), 'utf8'), /ISC License/)
  for (const f of fs.readdirSync(path.join(MOLDE, 'scene', 'engine'))) {
    const topo = fs.readFileSync(path.join(MOLDE, 'scene', 'engine', f), 'utf8').split('\n').slice(0, 8).join('\n')
    assert.match(topo, /explainroo[\s\S]*MIT, © 2026 Vincent Schmalbach/, `${f} sem o crédito no topo`)
    assert.equal(spawnSync(process.execPath, ['--check', path.join(MOLDE, 'scene', 'engine', f)]).status, 0, `${f} não passa no node --check`)
  }
})

// uma demo com fala, sem marca: sem voz, as cenas faladas andam pelo texto delas e as marcas saem das palavras dele
const DEMO = [
  { id: 'pergunta', min: 3.2, texto: 'De onde vem o seu total?' },
  { id: 'numeros', fala: 'f1', de: 0, ate: 3.52, texto: 'Seus números no alto, dois canais, somados num total.', hold: 1.7, transicao: 'brush' },
  { id: 'grafico', min: 4.2, transicao: 'cut' },
  { id: 'campo', fala: 'f1', de: 3.52, ate: 6.4, texto: 'Cole o link do jeito que vier, que o campo limpa sozinho.', lead: 1.1, hold: 1.5, transicao: 'zoom', marcas: { cola: 'Cole', limpa: 'limpa', fim: 'sozinho' } },
  { id: 'fecho', min: 3.4, transicao: 'cut' },
]

test('os exemplos montam sem voz (cada cena do roteiro tem função no scenes.js, o logo existe) e a demo com fala anda pelo texto: as marcas saem do texto e o vídeo fica entre 15 e 30 s', async () => {
  const EXEMPLOS = fs.readdirSync(MOLDE).filter((f) => /^example.*\.json$/.test(f))
  assert.ok(EXEMPLOS.length >= 3, `esperava 3 exemplos ou mais, achei ${EXEMPLOS.join(', ')}`)
  for (const f of EXEMPLOS) {
    const P = JSON.parse(fs.readFileSync(path.join(MOLDE, f), 'utf8'))
    const tl = montarLinha(P.roteiro, null, { semVoz: true })
    const cenas = (await import(pathToFileURL(path.join(MOLDE, P.cenas)).href)).default
    for (const sc of tl.scenes) assert.equal(typeof cenas[sc.id], 'function', `${f}: falta a cena ${sc.id}`)
    assert.equal(tl.voz.length, 0, f)
    for (const c of P.roteiro.filter((x) => x.fala)) assert.ok(c.texto, `${f}: a cena falada "${c.id}" precisa de "texto" para andar sem a voz`)
    assert.ok(fs.existsSync(path.resolve(MOLDE, P.marca.logo)), `${f}: o logo não existe (${P.marca.logo})`)
    // toda imagem que os dados citam ("media/arquivo") é embutida pelo render: vem do "midia" ou do logo da marca
    for (const m of P.midia || []) assert.ok(fs.existsSync(path.resolve(MOLDE, m)), `${f}: a mídia não existe (${m})`)
    const embutidas = new Set([P.marca.logo, ...(P.midia || [])].map((m) => 'media/' + path.basename(m)))
    for (const m of JSON.stringify(P.dados || {}).match(/media\/[^"\\]+/g) || []) assert.ok(embutidas.has(m), `${f}: os dados citam "${m}", que não está no "midia"`)
  }
  const tl = montarLinha(DEMO, null, { semVoz: true })
  assert.ok(tl.duration >= 15 && tl.duration <= 30, `${tl.duration} s`)
  assert.equal(tl.voz.length, 0)
  assert.deepEqual(Object.keys(tl.scenes.find((s) => s.id === 'campo').marks), ['cola', 'limpa', 'fim'])
})

test('os sons que o motor pede existem no catálogo do sounds.py', (t) => {
  // o Python que a skill usa (scripts/where.cjs: o do ~/.videostudio/environment.json, o venv dele no Mac e no Windows)
  const py = acharPython()
  if (!py) return t.skip('sem Python com numpy e scipy (node scripts/environment.mjs --fix monta o da skill)')
  const r = spawnSync(py, ['-c', `import sys, json; sys.path.insert(0, ${JSON.stringify(path.join(RAIZ, 'assets', 'audio'))}); import sounds as sons; print(json.dumps(list(sons.CATALOGO)))`], { encoding: 'utf8' })
  assert.equal(r.status, 0, r.stderr)
  const cat = new Set(JSON.parse(r.stdout.trim().split('\n').pop()))
  const usados = new Set(['sucesso', 'clique', 'digitacao', 'whoosh', 'pop', 'baque', 'acento'])
  for (const T of Object.values(TEXTURAS)) for (const s of Object.values(T.sfx)) if (s) usados.add(s)
  for (const s of usados) assert.ok(cat.has(s), `o som "${s}" não está no sons.CATALOGO`)
})
