// node --test tests/timeline.test.mjs   (sem rede; a parte que compõe precisa do Playwright)
// O que este arquivo trava, no molde timeline:
//   · os exemplos e os parâmetros mínimos (só o obrigatório, o resto no padrão) planejam sem erro, na duração esperada,
//     com as seções da trilha cobrindo o vídeo inteiro;
//   · parâmetro errado dá mensagem que diz o campo e o que pôr no lugar, e o render.mjs para antes de criar pasta;
//   · compõe (sem render) em 16:9, 19:9, 21:9, 9:16 e 1:1, nas duas orientações e nas duas câmeras, e a checagem do
//     motor (checarQuadro: colisão, área segura, texto sobre imagem) não acha nada; na viagem vertical, o marco que
//     sobe não cruza o título;
//   · o fecho é só o logo: no último quadro, nenhum texto visível, uma imagem marcada como logo;
//   · com ícone (imagem) ao lado do texto, texto nenhum cruza a imagem; e a checagem acusa quando cruza (controle).
import { test, describe, before, after } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'

const require = createRequire(import.meta.url)
const SKILL = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const MOLDE = path.join(SKILL, 'templates', 'timeline')
const LT = require(path.join(MOLDE, 'template', 'plan.js'))
const ler = (f) => JSON.parse(fs.readFileSync(path.join(MOLDE, f), 'utf8'))
const PW = require('../scripts/playwright.cjs')
const temPlaywright = PW.candidatos().length > 0
const LOGO = path.join(SKILL, 'assets', 'example', 'logo-placeholder.png')

const minimo = () => ({
  marca: { nome: 'Teste', logo: LOGO, cores: { fundo: '#F5F5F5', texto: '#1D1D1D' }, fontes: { titulo: 'Inter' } },
  marcos: [{ etapa: 'Pedido', texto: 'O que mostrar e para quem' }, { etapa: 'Render', texto: 'Trilha e vídeo no Mac' }, { etapa: 'Entrega', texto: 'O vídeo pronto' }],
})
const erros = (P) => LT.validar(P).join('\n')
// uma marca de fora (escura, duas fontes): vertical com travelling (6 marcos não cabem parados) e máscara para o fecho
const verticalComViagem = () => ({
  nome: 'teste-vertical',
  formatos: ['16x9', '9x16'],
  titulo: 'Um pedido em seis passos',
  orientacao: 'vertical',
  camera: 'travelling',
  passo: 1.5,
  transicao: 'mascara',
  marca: {
    nome: 'Marca', logo: 'logo.png',
    cores: { fundo: '#101820', texto: '#F5F0E6', eixo: '#22303C', ponto: '#22303C', progresso: '#E07A1F', aceso: '#E07A1F', etiqueta: '#E07A1F', etiquetaTexto: '#101820' },
    fontes: { titulo: 'Oswald', texto: 'Rubik' },
    pesos: { titulo: 700, texto: 400, etiqueta: 600 },
  },
  marcos: [
    { etapa: 'Cadastro', texto: 'Nome e cidade' }, { etapa: 'Fotos', texto: 'Até 12 fotos em alta' },
    { etapa: 'Conteúdo', texto: 'Textos e links' }, { etapa: 'Agenda', texto: 'Datas livres do mês' },
    { etapa: 'Revisão', texto: 'Prévia no celular e no computador' }, { etapa: 'No ar', texto: 'Um link para mandar a quem pediu' },
  ],
  fecho: { fundo: '#22303C', dur: 2.4 },
})

describe('o plano', () => {
  test('os exemplos planejam sem erro, de 6 a 15 s, marcos em ordem e seções cobrindo o vídeo', () => {
    const casos = [...['example.json', 'example-vertical.json'].map((f) => [f, ler(f)]), ['vertical com viagem (marca de fora)', verticalComViagem()]]
    for (const [f, P] of casos) {
      const p = LT.planejar(P)
      assert.ok(p.dur >= 6 && p.dur <= 15, `${f}: ${p.dur} s`)
      assert.equal(p.fecho.t1, p.dur, f)
      p.marcos.forEach((m, i) => { if (i) assert.ok(m.t > p.marcos[i - 1].t, f) })
      assert.ok(p.marcos[p.marcos.length - 1].t + 0.8 <= p.cena.t1, `${f}: o último marco tem tempo de ser lido`)
      assert.equal(p.secoes[0].de, 0, f)
      p.secoes.forEach((s, i) => { if (i) assert.equal(s.de, p.secoes[i - 1].ate, `${f}: seção ${s.nome} não emenda na anterior`) })
      assert.equal(p.secoes[p.secoes.length - 1].nome, 'fechamento')
      assert.equal(p.secoes[p.secoes.length - 1].ate, p.dur)
      assert.ok(p.fecho.logoEm >= p.fecho.t0 && p.fecho.logoEm <= p.fecho.t0 + 0.6, f)
    }
  })
  test('os parâmetros padrão: horizontal, câmera em travelling, corte seco, 1,4 s por marco, fecho de 2,4 s', () => {
    const p = LT.planejar(minimo())
    assert.equal(p.orientacao, 'horizontal')
    assert.equal(p.camera, 'travelling')
    assert.equal(p.transicao, 'corte')
    assert.equal(p.passo, 1.4)
    assert.equal(p.fecho.dur, 2.4)
    assert.deepEqual(p.marcos.map((m) => m.t), [0.4, 1.8, 3.2])
    assert.equal(p.fecho.de, p.fecho.t0, 'no corte seco a linha e o fecho não se sobrepõem')
  })
  test('câmera guiada (desligada por padrão): aceita, com o limite de marcos da câmera parada', () => {
    const P = minimo(); P.camera = 'guiada'
    assert.equal(LT.planejar(P).camera, 'guiada')
    assert.equal(LT.planejar(minimo()).camera, 'travelling')
    P.marcos = Array.from({ length: 5 }, (_, i) => ({ etapa: `Etapa ${i + 1}`, texto: 'Uma linha curta' }))
    assert.match(erros(P), /5 milestones do not fit with the whole axis in the frame \(camera guiada\) in the horizontal orientation \(up to 4\): use "camera": "travelling"/)
  })
  test('os dois exemplos mudam a orientação e a câmera entre si', () => {
    const a = LT.planejar(ler('example.json')), b = LT.planejar(ler('example-vertical.json'))
    assert.notEqual(a.orientacao, b.orientacao)
    assert.notEqual(a.camera, b.camera)
  })
})

describe('parâmetro errado: a mensagem diz o campo e o que pôr', () => {
  test('orientação, câmera e transição que não existem listam as que existem', () => {
    const P = minimo(); P.orientacao = 'diagonal'; P.camera = 'drone'; P.transicao = 'fade'
    const e = erros(P)
    assert.match(e, /orientacao "diagonal" does not exist: use horizontal or vertical/)
    assert.match(e, /camera "drone" does not exist: use travelling \(moves along the axis\), estatica \(the whole axis in the frame\) or guiada/)
    assert.match(e, /transicao "fade" does not exist: use corte, push, whip, mascara, zoom/)
  })
  test('marco sem etapa nem data, texto longo, passo fora da faixa', () => {
    const P = minimo()
    P.marcos[1] = { texto: 'Sem rótulo' }
    P.marcos[2].texto = 'Um texto comprido demais para caber numa linha só'
    P.passo = 0.3
    const e = erros(P)
    assert.match(e, /milestone 2: missing "etapa" or "data"/)
    assert.match(e, /milestone 3: the text has 9 words; at most 7/)
    assert.match(e, /passo 0.3 s: use 1 to 4 s per milestone/)
  })
  test('muitos marcos com a câmera parada sugerem o travelling; fecho com texto não passa', () => {
    const P = minimo(); P.camera = 'estatica'
    P.marcos = Array.from({ length: 5 }, (_, i) => ({ etapa: `Etapa ${i + 1}`, texto: 'Uma linha curta' }))
    P.fecho = { slogan: 'Uma frase de efeito' }
    const e = erros(P)
    assert.match(e, /5 milestones do not fit with the whole axis in the frame \(camera estatica\) in the horizontal orientation \(up to 4\): use "camera": "travelling"/)
    assert.match(e, /fecho\.slogan: this template's closing is the logo only, no text/)
    assert.throws(() => LT.planejar(P), /parameters with problems:/)
  })
  test('o render.mjs para com a mensagem antes de criar a pasta (parâmetro e formato)', () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'linha-erro-'))
    const P = minimo(); P.orientacao = 'diagonal'
    fs.writeFileSync(path.join(tmp, 'p.json'), JSON.stringify(P))
    let r = spawnSync(process.execPath, [path.join(MOLDE, 'render.mjs'), path.join(tmp, 'p.json'), '--out', path.join(tmp, 'output')], { encoding: 'utf8' })
    assert.equal(r.status, 1)
    assert.match(r.stderr, /orientacao "diagonal" does not exist/)
    r = spawnSync(process.execPath, [path.join(MOLDE, 'render.mjs'), path.join(MOLDE, 'example.json'), '--out', path.join(tmp, 'output'), '--formats', '16x9,3x2'], { encoding: 'utf8' })
    assert.equal(r.status, 1)
    assert.match(r.stderr, /unknown format for this template: 3x2\. Use 16x9, 19x9, 21x9, 9x16, 1x1, 4x5/)
    assert.ok(!fs.existsSync(path.join(tmp, 'output')), 'criou a pasta antes de recusar')
    fs.rmSync(tmp, { recursive: true, force: true })
  })
})

// ---------- compondo de verdade, no Chromium (sem render) ----------
const FMTS = { '16x9': [1920, 1080], '19x9': [2280, 1080], '21x9': [2520, 1080], '9x16': [1080, 1920], '1x1': [1080, 1080] }
let base, browser
function montar(P, nome) {
  const arq = path.join(base, `${nome}.json`)
  fs.writeFileSync(arq, JSON.stringify({ ...P, nome }))
  const saida = path.join(base, nome)
  spawnSync(process.execPath, [path.join(SKILL, 'scripts', 'example-fonts.mjs'), path.join(saida, `.work-${nome}`)], { encoding: 'utf8' })
  const r = spawnSync(process.execPath, [path.join(MOLDE, 'render.mjs'), arq, '--out', saida, '--no-sound', '--assemble-only'], { encoding: 'utf8' })
  assert.equal(r.status, 0, r.stderr)
  return path.join(saida, `.work-${nome}`)
}
const absoluto = (P) => {
  const Q = JSON.parse(JSON.stringify(P))
  Q.marca.logo = path.resolve(MOLDE, Q.marca.logo)
  for (const m of Q.marcos) if (m.icone) m.icone = path.resolve(MOLDE, m.icone)
  return Q
}
async function abrir(obra, fmt) {
  const [w, h] = FMTS[fmt]
  const pg = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 1 })
  const erros = []
  pg.on('pageerror', (e) => erros.push(e.message))
  pg.on('console', (m) => { if (m.type() === 'error') erros.push(m.text()) })
  await pg.goto('file://' + path.join(obra, 'index.html') + `?f=${fmt}`)
  await pg.waitForFunction('window.__ready === true', null, { timeout: 60000 })
  return { pg, erros }
}
const varrer = (pg) => pg.evaluate(async () => {
  const out = []
  for (let t = 0; t < VIDEO.duracao; t += 0.2) for (const q of await checarQuadro(Math.min(t, VIDEO.duracao - 0.001))) out.push(q.msg)
  return [...new Set(out)]
})
const ultimoQuadro = (pg) => pg.evaluate(async () => {
  await renderAt(VIDEO.duracao - 0.02)
  const vis = (e) => { for (let x = e; x && x !== document.body; x = x.parentElement) { const cs = getComputedStyle(x); if (cs.display === 'none' || cs.visibility === 'hidden' || +cs.opacity < 0.05) return false } return true }
  const textos = [...stage.querySelectorAll('*')].filter((e) => [...e.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim()) && vis(e)).map((e) => e.textContent.trim())
  const logos = [...stage.querySelectorAll('[data-colisao="logo"]')].filter(vis).map((e) => e.tagName)
  return { textos, logos }
})

describe('compõe no Chromium', { skip: !temPlaywright ? 'sem Playwright' : false }, () => {
  const obras = {}
  before(async () => {
    base = fs.mkdtempSync(path.join(os.tmpdir(), 'linha-compoe-'))
    const viagem = absoluto(ler('example.json'))
    obras.viagem = montar(viagem, 'viagem')
    obras.guiada = montar(absoluto(ler('example-vertical.json')), 'guiada')
    // a viagem vertical com título e ícones (o marco sobe até o título), e a horizontal parada, no padrão do resto
    obras.vertical = montar({ ...viagem, orientacao: 'vertical', transicao: 'mascara' }, 'vertical')
    obras.parada = montar({ ...minimo(), titulo: 'Três etapas', camera: 'estatica' }, 'parada')
    browser = (await PW.abrirNavegador(base)).browser
  })
  after(async () => { if (browser) await browser.close(); if (base) fs.rmSync(base, { recursive: true, force: true }) })

  for (const nome of ['viagem', 'guiada', 'vertical', 'parada']) {
    test(`${nome}: compõe em 16:9, 19:9, 21:9, 9:16 e 1:1 sem colisão, sem sair da área segura e sem texto sobre imagem`, async () => {
      for (const fmt of Object.keys(FMTS)) {
        const { pg, erros } = await abrir(obras[nome], fmt)
        const problemas = await varrer(pg)
        await pg.close()
        assert.deepEqual(erros, [], `${nome} ${fmt}: erro na página`)
        assert.deepEqual(problemas, [], `${nome} ${fmt}`)
      }
    })
    test(`${nome}: o fecho é só o logo (nenhum texto visível no último quadro)`, async () => {
      for (const fmt of ['16x9', '9x16']) {
        const { pg } = await abrir(obras[nome], fmt)
        const u = await ultimoQuadro(pg)
        await pg.close()
        assert.deepEqual(u.textos, [], `${nome} ${fmt}: texto no fecho`)
        assert.deepEqual(u.logos, ['IMG'], `${nome} ${fmt}: o logo PNG, uma vez`)
      }
    })
  }

  test('câmera guiada: abre com o eixo inteiro, aproxima no marco da vez e recua antes do fecho', async () => {
    const { pg } = await abrir(obras.guiada, '16x9')
    const r = await pg.evaluate(async () => {
      const lente = document.querySelector('.scene .abs > .abs[style*="transform-origin: 0px 0px"]') || [...document.querySelectorAll('.scene div')].find((e) => e.style.transformOrigin === '0px 0px')
      const z = async (t) => { await renderAt(t); const m = /scale\(([\d.]+)\)/.exec(lente.style.transform || ''); return m ? +m[1] : 1 }
      const ms = PLANO.marcos.map((m) => m.t)
      return { camera: PLANO.camera, abre: await z(0), marcos: await Promise.all([]).then(async () => { const o = []; for (const t of ms) o.push(await z(t + 0.05)); return o }), fim: await z(PLANO.corte.a) }
    })
    await pg.close()
    assert.equal(r.camera, 'guiada')
    assert.ok(Math.abs(r.abre - 1) < 0.01, `no quadro 0 a lente está aberta (escala ${r.abre})`)
    r.marcos.slice(1).forEach((z, i) => assert.ok(z > 1.1, `no marco ${i + 2} a lente não aproximou (escala ${z})`))
    assert.ok(Math.abs(r.fim - 1) < 0.02, `antes do fecho a lente não recuou (escala ${r.fim})`)
  })

  test('com ícone, a checagem de texto sobre imagem está ligada e acusa quando um texto cruza o ícone (controle)', async () => {
    const { pg } = await abrir(obras.viagem, '16x9')
    const r = await pg.evaluate(async () => {
      const t = 1.6
      await renderAt(t)
      const ic = document.querySelector('[data-imagem]'), tx = [...document.querySelectorAll('[data-colisao="texto"]')].find((e) => e.textContent === 'Step 1')
      const antes = (await checarQuadro(t)).filter((q) => q.tipo === 'imagem').length
      const ri = ic.getBoundingClientRect(), rt = tx.getBoundingClientRect()
      tx.style.left = (parseFloat(tx.style.left) + ri.left - rt.left) + 'px'; tx.style.top = (parseFloat(tx.style.top) + ri.top - rt.top + 10) + 'px'
      const depois = (await checarQuadro(t)).filter((q) => q.tipo === 'imagem').map((q) => q.msg)
      return { texto: VIDEO.texto, imagens: document.querySelectorAll('[data-imagem]').length, antes, depois }
    })
    await pg.close()
    assert.equal(r.texto, 'fora-da-imagem')
    assert.equal(r.imagens, 7, 'os sete ícones marcados como imagem')
    assert.equal(r.antes, 0)
    assert.ok(r.depois.length >= 1 && /TEXT OVER IMAGE/.test(r.depois[0]), 'a checagem não acusou o texto sobre o ícone')
  })
})
