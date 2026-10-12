// node --test tests/drawn-flow.test.mjs   (sem rede): o molde drawn-flow.
// O plano (scene/plan.js) roda no Node: validação com mensagem útil, camadas do grafo, tempos e marcos de som.
// O render.mjs recusa parâmetro errado antes de criar qualquer pasta. Com o Chromium da skill (scripts/playwright.cjs),
// a obra monta sem render (--assemble-only, com a Inter dos exemplos) e compõe em 16:9, 9:16 e 1:1 sem problema na checagem de
// quadros, com o JSON mínimo (parâmetros padrão) e com o exemplo; no fecho, só o logo aparece.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { createRequire } from 'node:module'
import { fileURLToPath, pathToFileURL } from 'node:url'

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const MOLDE = path.join(RAIZ, 'templates', 'drawn-flow')
const require = createRequire(import.meta.url)
const { validarFluxo, camadasFluxo, planejarFluxo } = require(path.join(MOLDE, 'scene', 'plan.js'))
const ler = (f) => JSON.parse(fs.readFileSync(path.join(MOLDE, f), 'utf8'))
const EXEMPLOS = fs.readdirSync(MOLDE).filter((f) => /^example.*\.json$/.test(f))
const LOGO = path.join(RAIZ, 'assets', 'example', 'logo-placeholder.png')

// o mínimo que o molde pede: o resto fica no padrão (leiaute full-screen, fluxo deitado, câmera estática, corte seco, ritmo médio)
const minimo = () => ({
  nome: 'teste-minimo',
  marca: { fonte: 'Inter', cores: { fundo: '#F5F5F5', texto: '#1D1D1D', ladrilho: '#DEDEDE', linha: '#1D1D1D', aceso: '#848484' } },
  nos: [{ id: 'a', rotulo: 'Entrada' }, { id: 'b', rotulo: 'Meio', detalhe: 'o que acontece aqui' }, { id: 'c', rotulo: 'Saída' }],
  setas: [{ de: 'a', para: 'b' }, { de: 'b', para: 'c' }],
  fecho: { logo: LOGO, fundo: '#F5F5F5' },
})

// outra marca (escura, outra fonte, nós sem ícone): o grafo ramifica e junta de novo, deitado, rápido, em máscara
const ramificaEJunta = () => ({
  nome: 'teste-ramifica',
  formatos: ['16x9', '9x16'],
  chamada: 'Do pedido à entrega',
  leiaute: 'full-screen', direcao: 'horizontal', camera: 'estatica', transicao: 'mascara', ritmo: 'rapido',
  marca: {
    nome: 'Marca', fonte: 'Rubik', pesos: { rotulo: 600, detalhe: 400, chamada: 500 },
    cores: {
      fundo: '#101820', texto: '#F5F0E6', apoio: '#F5F0E6', ladrilho: '#22303C', linha: '#F5F0E6', aceso: '#E07A1F', pacote: '#E07A1F',
      chamadaFundo: '#E07A1F', chamadaTexto: '#101820',
    },
    linhaAlfa: 0.45, apagado: 0.6,
  },
  nos: [
    { id: 'entrada', rotulo: 'O pedido', detalhe: 'chega uma vez' },
    { id: 'fila', rotulo: 'A fila', detalhe: 'um endereço só' },
    { id: 'a', rotulo: 'Canal A', detalhe: 'na primeira tela' },
    { id: 'b', rotulo: 'Canal B', detalhe: 'no perfil' },
    { id: 'saida', rotulo: 'A entrega', detalhe: 'no app que já usam' },
  ],
  setas: [{ de: 'entrada', para: 'fila' }, { de: 'fila', para: 'a' }, { de: 'fila', para: 'b' }, { de: 'a', para: 'saida' }, { de: 'b', para: 'saida' }],
  fecho: { logo: 'logo.png', fundo: '#101820', largura: 620, dur: 2.2 },
})

test('os exemplos passam na validação e o plano anda em ordem (desenho, percurso, fecho)', () => {
  const CASOS = [...EXEMPLOS.map((f) => [f, ler(f)]), ['ramifica e junta (outra marca)', ramificaEJunta()]]
  assert.ok(EXEMPLOS.length >= 2 && CASOS.length >= 3, `esperava os 2 exemplos ou mais e a outra marca, achei ${EXEMPLOS.join(', ')}`)
  for (const [f, P] of CASOS) {
    assert.deepEqual(validarFluxo(P), [], f)
    const pl = planejarFluxo(P)
    assert.ok(pl.dur >= 6 && pl.dur <= 15, `${f}: ${pl.dur} s fora de 6–15 s`)
    for (const n of pl.nos) {
      assert.ok(n.desenha < pl.inicio, `${f}: o nó ${n.id} se desenha depois do pacote sair`)
      if (n.aceso != null) assert.ok(n.aceso >= pl.inicio && n.aceso < pl.fimPercurso, `${f}: ${n.id} acende fora do percurso`)
    }
    assert.ok(Math.min(...pl.nos.map((n) => n.desenha)) <= 0, `${f}: o quadro 0 tem de ter o primeiro nó se desenhando`)
    assert.ok(pl.fecho.dur >= 2, `${f}: o logo fica parado pelo menos 2 s`)
    const ts = pl.marcos.map((m) => m.t)
    assert.deepEqual(ts, [...ts].sort((a, b) => a - b), `${f}: marcos fora de ordem`)
    const ult = pl.marcos[pl.marcos.length - 1]
    assert.equal(ult.som, 'acento', `${f}: o último som é o acento do logo`)
    assert.equal(ult.t, pl.fecho.logoEm)
    for (const m of pl.marcos) if (!m.opcional) assert.ok(['blip', 'toque', 'acento'].includes(m.som), `${f}: marco obrigatório com som de ataque lento: ${m.som}`)
  }
})

test('camadas: ramificação e junção ficam em camadas, e a trava para o pacote antes do nó', () => {
  const nos = ['a', 'b', 'c', 'd', 'e'].map((id) => ({ id, rotulo: id.toUpperCase() }))
  const g = camadasFluxo(nos, [{ de: 'a', para: 'b' }, { de: 'a', para: 'c' }, { de: 'b', para: 'd' }, { de: 'c', para: 'd' }, { de: 'a', para: 'e' }])
  assert.deepEqual(g.camadas.map((c) => [...c].sort()), [['a'], ['b', 'c', 'e'], ['d']])
  const P = { ...minimo(), nos, setas: [{ de: 'a', para: 'b' }, { de: 'b', para: 'c' }, { de: 'b', para: 'd', trava: true }, { de: 'c', para: 'e' }] }
  const pl = planejarFluxo(P)
  const n = Object.fromEntries(pl.nos.map((x) => [x.id, x]))
  assert.equal(n.d.aceso, null, 'o nó atrás da trava não acende')
  assert.ok(n.d.travado > n.b.aceso, 'o pacote chega no portão depois de sair do nó de antes')
  assert.ok(n.d.travado > n.c.aceso, 'a trava vem depois do irmão que passa')
  assert.ok(pl.marcos.some((m) => m.som === 'toque' && m.t === n.d.travado), 'a trava tem o seu toque')
})

test('parâmetro errado dá uma mensagem que diz o que fazer', () => {
  const casos = [
    [(P) => { P.setas.push({ de: 'c', para: 'a' }) }, /cycle between .*Remove the arrow that goes back/],
    [(P) => { P.setas[0].para = 'x' }, /"para": "x" is not the id of any node \(ids: a, b, c\)/],
    [(P) => { P.fecho.bordao = 'Tudo pronto.' }, /the closing is only the logo/],
    [(P) => { delete P.fecho }, /closes with only the logo/],
    [(P) => { P.marca.cores.aceso = 'rosa' }, /marca\.cores\.aceso" must be a #RRGGBB color \(got "rosa"\)/],
    [(P) => { P.leiaute = 'grade' }, /"leiaute": "grade" does not exist: use full-screen \| dividido/],
    [(P) => { P.camera = 'orbita' }, /use estatica \| travelling/],
    [(P) => { P.ritmo = 'lento' }, /use calmo \| medio \| rapido/],
    [(P) => { P.nos = Array.from({ length: 9 }, (_, i) => ({ id: `n${i}`, rotulo: `N${i}` })); P.setas = [{ de: 'n0', para: 'n1' }] }, /at most 8/],
    [(P) => { P.nos.push({ id: 'a', rotulo: 'de novo' }) }, /appears twice/],
    [(P) => { P.nos[0].rotulo = 'um rótulo comprido demais para a tela' }, /more than 5 words/],
  ]
  for (const [muda, re] of casos) {
    const P = minimo()
    muda(P)
    const erros = validarFluxo(P)
    assert.ok(erros.some((e) => re.test(e)), `esperava ${re} em:\n${erros.join('\n')}`)
    assert.throws(() => planejarFluxo(P), re)
  }
})

test('o renderizar recusa parâmetro e formato errados antes de criar qualquer pasta', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'fluxo-'))
  const arq = path.join(tmp, 'p.json')
  fs.writeFileSync(arq, JSON.stringify({ ...minimo(), fecho: { logo: LOGO, slogan: 'Bora.' } }))
  let r = spawnSync(process.execPath, [path.join(MOLDE, 'render.mjs'), arq, '--out', path.join(tmp, 'output')], { encoding: 'utf8' })
  assert.equal(r.status, 1)
  assert.match(r.stderr, /the closing is only the logo/)
  fs.writeFileSync(arq, JSON.stringify(minimo()))
  r = spawnSync(process.execPath, [path.join(MOLDE, 'render.mjs'), arq, '--out', path.join(tmp, 'output'), '--formats', '16x9,3x2'], { encoding: 'utf8' })
  assert.equal(r.status, 1)
  assert.match(r.stderr, /format "3x2" does not exist: use 16x9, 19x9, 21x9, 9x16, 1x1, 4x5/)
  r = spawnSync(process.execPath, [path.join(MOLDE, 'render.mjs'), arq], { encoding: 'utf8' })
  assert.equal(r.status, 1)
  assert.match(r.stderr, /usage: node render\.mjs/)
  assert.ok(!fs.existsSync(path.join(tmp, 'output')), 'criou a pasta antes de recusar')
  fs.rmSync(tmp, { recursive: true, force: true })
})

// ---------- no Chromium: compõe sem render ----------
let navegador = null
try { navegador = require(path.join(RAIZ, 'scripts', 'playwright.cjs')) } catch { navegador = null }
const FORMATOS = { '16x9': [1920, 1080], '9x16': [1080, 1920], '1x1': [1080, 1080] }

async function compor(P, nome) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'fluxo-obra-'))
  const arq = path.join(tmp, `${nome}.json`)
  // os caminhos relativos do exemplo valem a partir da pasta do molde
  const abs = JSON.parse(JSON.stringify(P))
  for (const n of abs.nos) if (n.icone) n.icone = path.resolve(MOLDE, n.icone)
  abs.fecho.logo = path.resolve(MOLDE, abs.fecho.logo)
  abs.nome = nome
  fs.writeFileSync(arq, JSON.stringify(abs))
  const obra = path.join(tmp, 'output', `.work-${nome}`)
  let r = spawnSync(process.execPath, [path.join(RAIZ, 'scripts', 'example-fonts.mjs'), obra], { encoding: 'utf8' })
  assert.equal(r.status, 0, r.stderr)
  r = spawnSync(process.execPath, [path.join(MOLDE, 'render.mjs'), arq, '--out', path.join(tmp, 'output'), '--assemble-only'], { encoding: 'utf8' })
  assert.equal(r.status, 0, r.stderr)
  return { tmp, obra, plano: planejarFluxo(abs) }
}

async function conferir(t, obra, plano, rotulo) {
  let abrir
  try { abrir = await navegador.abrirNavegador(obra) } catch (e) { t.skip(`sem Chromium: ${e.message.split('\n')[0]}`); return }
  const { browser } = abrir
  try {
    for (const [f, [W, H]] of Object.entries(FORMATOS)) {
      const pg = await browser.newPage({ viewport: { width: W, height: H } })
      const erros = []
      pg.on('pageerror', (e) => erros.push(e.message)); pg.on('console', (m) => { if (m.type() === 'error') erros.push(m.text()) })
      await pg.goto(pathToFileURL(path.join(obra, 'index.html')).href + `?f=${f}`)
      await pg.waitForFunction('window.__ready === true', null, { timeout: 60000 })
      assert.deepEqual(erros, [], `${rotulo} ${f}: erro na página`)
      const tempos = Array.from({ length: 24 }, (_, k) => +(((k + 0.5) * plano.dur) / 24).toFixed(2))
      const probs = []
      for (const tt of tempos) probs.push(...(await pg.evaluate((x) => window.checarQuadro(x), tt)))
      assert.deepEqual(probs.map((p) => p.msg), [], `${rotulo} ${f}: a checagem de quadros achou problema`)
      // no fecho, depois que o logo entra: nenhum texto visível e uma imagem só, a do logo
      const fecho = await pg.evaluate(async (tt) => {
        await window.renderAt(tt)
        const vis = (e) => { for (let x = e; x && x.id !== 'stage'; x = x.parentElement) { const cs = getComputedStyle(x); if (cs.display === 'none' || cs.visibility === 'hidden' || +cs.opacity < 0.05) return false } return true }
        const textos = [...document.querySelectorAll('#stage *')].filter((e) => [...e.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim()) && vis(e)).map((e) => e.textContent.trim())
        const imgs = [...document.querySelectorAll('#stage img')].filter(vis).map((i) => decodeURIComponent(i.src.split('/').pop()))
        return { textos, imgs }
      }, +(plano.dur - 0.4).toFixed(2))
      assert.deepEqual(fecho.textos, [], `${rotulo} ${f}: texto no fecho`)
      assert.equal(fecho.imgs.length, 1, `${rotulo} ${f}: o fecho mostra ${fecho.imgs.join(', ')}`)
      assert.match(fecho.imgs[0], /logo/, `${rotulo} ${f}: a imagem do fecho não é o logo`)
      await pg.close()
    }
  } finally { await browser.close() }
}

test('compõe sem render com os parâmetros padrão: 16:9, 9:16 e 1:1 passam na checagem e o fecho é só o logo', { skip: !navegador && 'sem scripts/playwright.cjs', timeout: 240000 }, async (t) => {
  const { tmp, obra, plano } = await compor(minimo(), 'minimo')
  try { await conferir(t, obra, plano, 'mínimo') } finally { fs.rmSync(tmp, { recursive: true, force: true }) }
})

test('compõe sem render o exemplo ramificado (dividido, trava, máscara): 16:9, 9:16 e 1:1 passam na checagem', { skip: !navegador && 'sem scripts/playwright.cjs', timeout: 240000 }, async (t) => {
  const { tmp, obra, plano } = await compor(ler('example-vertical.json'), 'vertical')
  try { await conferir(t, obra, plano, 'exemplo vertical') } finally { fs.rmSync(tmp, { recursive: true, force: true }) }
})
