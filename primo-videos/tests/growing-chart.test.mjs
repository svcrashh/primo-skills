// node --test tests/growing-chart.test.mjs   (sem rede; a parte que compõe precisa do Playwright)
// O que este arquivo trava, no molde growing-chart:
//   · os exemplos e os parâmetros mínimos (só o obrigatório, o resto no padrão) planejam sem erro, na duração esperada;
//   · parâmetro errado dá mensagem que diz o campo e o que pôr no lugar, e o render.mjs para antes de criar pasta;
//   · compõe (sem render) em 16:9, 19:9, 21:9, 9:16 e 1:1, os quatro tipos de gráfico, e a checagem do motor
//     (checarQuadro: colisão, área segura, texto sobre imagem) não acha nada;
//   · o fecho é só o logo: no último quadro, nenhum texto visível, uma imagem marcada como logo;
//   · com ícone (imagem) ao lado do rótulo, texto nenhum cruza a imagem; e a checagem acusa quando cruza (controle).
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
const MOLDE = path.join(SKILL, 'templates', 'growing-chart')
const EXEMPLO = path.join(SKILL, 'assets', 'example')
const G = require(path.join(MOLDE, 'template', 'plan.js'))
const ler = (f) => JSON.parse(fs.readFileSync(path.join(MOLDE, f), 'utf8'))
const PW = require('../scripts/playwright.cjs')
const temPlaywright = PW.candidatos().length > 0
const LOGO = path.join(EXEMPLO, 'logo-placeholder.png')
const ICONE = path.join(EXEMPLO, 'icon-placeholder.png')

const minimo = () => ({
  marca: { nome: 'Teste', logo: LOGO, cores: { fundo: '#F5F5F5', texto: '#1D1D1D' }, fontes: { titulo: 'Inter' } },
  cenas: [{ tipo: 'barras', titulo: 'O produto em números', itens: [{ rotulo: 'itens', valor: 240 }, { rotulo: 'usuários', valor: 160 }] }],
})
const erros = (P) => G.validar(P).join('\n')
// uma marca de fora (escura, duas fontes): linha e barras com destaque, em cima, whip entre as cenas
const outraMarca = () => ({
  nome: 'teste-outra-marca',
  formatos: ['16x9', '9x16'],
  leiaute: 'em-cima',
  transicao: 'whip',
  marca: {
    nome: 'Marca', logo: 'logo.png',
    cores: { fundo: '#101820', texto: '#F5F0E6', apoio: '#F5F0E6', eixo: '#22303C', serie: ['#22303C'], destaque: '#E07A1F', trilho: '#22303C' },
    fontes: { titulo: 'Oswald', texto: 'Rubik' },
    pesos: { titulo: 700, texto: 400, rotulo: 500, numero: 600 },
  },
  cenas: [
    {
      tipo: 'linha', titulo: 'Pedidos por mês', nota: 'Primeiro semestre',
      itens: [{ rotulo: 'jan', valor: 120 }, { rotulo: 'fev', valor: 168 }, { rotulo: 'mar', valor: 151 }, { rotulo: 'abr', valor: 236 }, { rotulo: 'mai', valor: 290 }, { rotulo: 'jun', valor: 342 }],
    },
    {
      tipo: 'barras', titulo: 'Por onde o pedido chega', nota: 'Junho, em % dos pedidos', sufixo: '%', destaque: 0,
      itens: [{ rotulo: 'Canal A', valor: 46 }, { rotulo: 'Canal B', valor: 27 }, { rotulo: 'E-mail', valor: 18 }, { rotulo: 'Outros', valor: 9 }],
    },
  ],
  fecho: { dur: 2.4 },
})

describe('o plano', () => {
  test('os exemplos planejam sem erro, de 6 a 15 s, com o fecho de 1,9 a 3,2 s no fim', () => {
    const casos = [...['example.json', 'example-split.json'].map((f) => [f, ler(f)]), ['linha e barras (marca de fora)', outraMarca()]]
    for (const [f, P] of casos) {
      const p = G.planejar(P)
      assert.ok(p.dur >= 6 && p.dur <= 15, `${f}: ${p.dur} s`)
      assert.equal(p.fecho.t1, p.dur, f)
      assert.ok(p.fecho.dur >= 1.9 && p.fecho.dur <= 3.2, f)
      assert.equal(p.cortes.length, p.cenas.length, `${f}: um corte depois de cada gráfico`)
      assert.ok(p.fecho.logoEm >= p.fecho.t0 && p.fecho.logoEm <= p.fecho.t0 + 0.6, `${f}: o logo assenta logo depois do corte (a trilha resolve ali)`)
      for (const c of p.cenas) assert.ok(c.dur >= c.desenhado + 0.6, `${f}: a cena ${c.i + 1} acaba antes de o gráfico se desenhar`)
    }
  })
  test('os parâmetros padrão: só o obrigatório, o resto no padrão (em cima, corte seco, fecho de 2,4 s)', () => {
    const p = G.planejar(minimo())
    assert.equal(p.transicao, 'corte')
    assert.equal(p.dTransicao, 0)
    assert.equal(p.cenas[0].leiaute, 'em-cima')
    assert.equal(p.cenas[0].dur, G.durPadrao(minimo().cenas[0]))
    assert.equal(p.fecho.dur, 2.4)
    assert.equal(p.cenas[0].de, 0)
    assert.equal(p.fecho.de, p.fecho.t0, 'no corte seco as cenas não se sobrepõem')
    for (const tipo of G.TIPOS) {
      const P = minimo()
      P.cenas = [tipo === 'rosca' ? { tipo, titulo: 'Itens', valor: 96, total: 128, rotulo: 'já estão prontos' }
        : { tipo, titulo: 'Itens', itens: [{ rotulo: 'a', valor: 1 }, { rotulo: 'b', valor: 2 }, { rotulo: 'c', valor: 3 }] }]
      assert.doesNotThrow(() => G.planejar(P), tipo)
    }
  })
  test('percorrer (desligado por padrão): a cena dura o percurso do destaque, e só vale em barras e colunas', () => {
    const P = minimo()
    const base = G.fimDoDesenho(P.cenas[0])
    assert.equal(P.cenas[0].percorrer, undefined)
    P.cenas[0].percorrer = true
    const n = P.cenas[0].itens.length, { pausa, item, volta } = G.PERCORRE
    assert.ok(Math.abs(G.fimDoDesenho(P.cenas[0]) - (base + pausa + item * n + volta)) < 1e-9)
    assert.ok(G.durPadrao(P.cenas[0]) >= G.fimDoDesenho(P.cenas[0]) + 0.6)
    assert.equal(G.validar(P).length, 0)
    P.cenas[0].percorrer = 'sim'
    assert.match(erros(P), /"percorrer" is true or false/)
    P.cenas = [{ tipo: 'rosca', titulo: 'Itens', valor: 96, total: 128, rotulo: 'já estão prontos', percorrer: true }]
    assert.match(erros(P), /scene 1: "percorrer" only works with barras and colunas \(the scene is rosca\)/)
  })
  test('com transição, cada cena fica meia janela antes e depois do corte', () => {
    const p = G.planejar(ler('example-split.json'))
    assert.equal(p.transicao, 'push')
    assert.equal(p.cenas[0].ate, +(p.cenas[0].t1 + 0.3).toFixed(3))
    assert.equal(p.cenas[1].de, +(p.cenas[1].t0 - 0.3).toFixed(3))
    assert.equal(p.fecho.de, +(p.fecho.t0 - 0.3).toFixed(3))
  })
})

describe('parâmetro errado: a mensagem diz o campo e o que pôr', () => {
  test('tipo, leiaute, transição e lado que não existem listam os que existem', () => {
    const P = minimo()
    P.cenas[0].tipo = 'pizza'
    assert.match(erros(P), /scene 1: tipo "pizza" does not exist: use barras, colunas, linha, rosca/)
    const Q = minimo(); Q.leiaute = 'grade'; Q.transicao = 'fade'; Q.lado = 'cima'
    const e = erros(Q)
    assert.match(e, /leiaute "grade" does not exist: use em-cima or dividido/)
    assert.match(e, /transicao "fade" does not exist: use corte, push, whip, mascara, zoom/)
    assert.match(e, /lado "cima" does not exist: use esquerda or direita/)
  })
  test('rosca com valor maior que o total, valor que não é número, poucos itens', () => {
    const P = minimo()
    P.cenas = [{ tipo: 'rosca', titulo: 'Itens', valor: 140, total: 128, rotulo: 'já estão prontos' }]
    assert.match(erros(P), /donut with valor 140 and total 128: the value must be between 0 and the total/)
    const Q = minimo()
    Q.cenas[0].itens[1].valor = '160'
    assert.match(erros(Q), /scene 1, item 2: "valor" must be a number \(got "160"\)/)
    const R = minimo()
    R.cenas[0].itens = [{ rotulo: 'só um', valor: 1 }]
    assert.match(erros(R), /barras needs 2 to 8 items/)
  })
  test('texto longo e fecho com texto (o fecho é só o logo)', () => {
    const P = minimo()
    P.cenas[0].titulo = 'Um título comprido demais para caber numa linha só'
    P.fecho = { bordao: 'Tudo isso já está no ar.' }
    const e = erros(P)
    assert.match(e, /the title has 9 words; at most 7/)
    assert.match(e, /fecho\.bordao: this template's closing is only the logo, with no text/)
  })
  test('dur curta demais diz o mínimo e o padrão; sem logo diz onde pôr', () => {
    const P = minimo()
    P.cenas[0].dur = 1
    assert.match(erros(P), /scene 1: dur 1 s is not enough time for the chart to draw: use [\d.]+ s or more \(or remove "dur": the default is [\d.]+ s\)/)
    const Q = minimo(); delete Q.marca.logo
    assert.match(erros(Q), /missing the logo: "marca\.logo" \(PNG\) or "fecho\.logo"/)
    assert.throws(() => G.planejar(P), /parameters with problems:/)
  })
  test('o render.mjs para com a mensagem antes de criar a pasta (parâmetro e formato)', () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'grafico-erro-'))
    const P = minimo(); P.cenas[0].tipo = 'pizza'
    fs.writeFileSync(path.join(tmp, 'p.json'), JSON.stringify(P))
    let r = spawnSync(process.execPath, [path.join(MOLDE, 'render.mjs'), path.join(tmp, 'p.json'), '--out', path.join(tmp, 'output')], { encoding: 'utf8' })
    assert.equal(r.status, 1)
    assert.match(r.stderr, /tipo "pizza" does not exist/)
    r = spawnSync(process.execPath, [path.join(MOLDE, 'render.mjs'), path.join(MOLDE, 'example-split.json'), '--out', path.join(tmp, 'output'), '--formats', '16x9,3x2'], { encoding: 'utf8' })
    assert.equal(r.status, 1)
    assert.match(r.stderr, /format this template doesn't support: 3x2\. Use 16x9, 19x9, 21x9, 9x16, 1x1, 4x5/)
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
// os exemplos com o caminho do logo absoluto (o JSON vai para a pasta temporária)
const absoluto = (P) => {
  const Q = JSON.parse(JSON.stringify(P))
  Q.marca.logo = path.resolve(MOLDE, Q.marca.logo)
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
/** checarQuadro a 5 por segundo, a linha do tempo inteira: devolve as mensagens. */
const varrer = (pg) => pg.evaluate(async () => {
  const out = []
  for (let t = 0; t < VIDEO.duracao; t += 0.2) for (const q of await checarQuadro(Math.min(t, VIDEO.duracao - 0.001))) out.push(q.msg)
  return [...new Set(out)]
})
/** O que aparece no último quadro: textos visíveis e as imagens marcadas. */
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
    base = fs.mkdtempSync(path.join(os.tmpdir(), 'grafico-compoe-'))
    obras.escuro = montar(absoluto(ler('example.json')), 'escuro')
    obras.dividido = montar(absoluto(ler('example-split.json')), 'dividido')
    // os quatro tipos numa obra só, com ícones ao lado dos rótulos, e o padrão de tudo (corte seco)
    const P = minimo()
    P.marca.cores = { fundo: '#F5F5F5', texto: '#1D1D1D', serie: ['#DEDEDE'], destaque: '#848484', ladrilho: '#EBEBEB' }
    P.cenas = [
      { tipo: 'barras', titulo: 'O produto em números', destaque: 0, itens: [{ rotulo: 'itens', valor: 240, icone: ICONE }, { rotulo: 'usuários', valor: 160, icone: ICONE }, { rotulo: 'novidades', valor: 60, icone: ICONE }] },
      { tipo: 'colunas', titulo: 'Itens de cada grupo', milhar: '', itens: [{ rotulo: 'Um', valor: 1600, icone: ICONE }, { rotulo: 'Dois', valor: 1200, icone: ICONE }, { rotulo: 'Três', valor: 1000, icone: ICONE }] },
      { tipo: 'linha', titulo: 'Uma série qualquer', itens: [{ rotulo: 'jan', valor: 3 }, { rotulo: 'fev', valor: 5 }, { rotulo: 'mar', valor: 4 }, { rotulo: 'abr', valor: 8 }] },
      { tipo: 'rosca', titulo: 'Uma parte do todo', valor: 96, total: 128, rotulo: 'itens já estão prontos' },
    ]
    obras.tipos = montar(P, 'tipos')
    browser = (await PW.abrirNavegador(base)).browser
  })
  after(async () => { if (browser) await browser.close(); if (base) fs.rmSync(base, { recursive: true, force: true }) })

  for (const nome of ['escuro', 'dividido', 'tipos']) {
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

  test('percorrer: depois de crescer, o destaque passa barra a barra com o número pulando, e volta ao de sempre', async () => {
    const { pg } = await abrir(obras.escuro, '16x9')
    const r = await pg.evaluate(async () => {
      const c = PLANO.cenas[0], n = c.itens.length, t0 = GRAFICO.inicioPercurso(c), passo = GRAFICO.PERCORRE.item
      const barras = () => [...document.querySelectorAll('.scene div')].filter((e) => e.style.borderRadius.startsWith('0px') && parseFloat(e.style.height) > 30)
      const valores = () => [...document.querySelectorAll('[data-colisao-nome="value"]')]
      const out = []
      for (let k = 0; k < n; k++) {
        await renderAt(c.t0 + t0 + k * passo + 0.17)
        out.push({ cores: barras().map((b) => getComputedStyle(b).backgroundColor), escala: valores().map((v) => v.style.transform) })
      }
      await renderAt(c.t0 + t0 + n * passo + 0.2)
      const depois = barras().map((b) => getComputedStyle(b).backgroundColor)
      return { out, depois, destaque: c.destaque }
    })
    await pg.close()
    const DESTAQUE = 'rgb(132, 132, 132)'   // o "destaque" do example.json (#848484)
    r.out.forEach((q, k) => {
      assert.deepEqual(q.cores.map((c, j) => c === DESTAQUE), q.cores.map((_, j) => j === k), `no passo ${k} só a barra ${k} fica no destaque`)
      assert.match(q.escala[k], /scale\(1\.[1-9]/, `o número da barra ${k} não pulou`)
    })
    assert.deepEqual(r.depois.map((c) => c === DESTAQUE), r.depois.map((_, j) => j === r.destaque), 'no fim volta ao destaque de sempre')
  })

  test('com ícone, a checagem de texto sobre imagem está ligada e acusa quando um rótulo cruza o ícone (controle)', async () => {
    const { pg } = await abrir(obras.tipos, '16x9')
    const r = await pg.evaluate(async () => {
      const t = 3.0
      await renderAt(t)
      const ic = document.querySelector('[data-imagem]'), rot = [...document.querySelectorAll('[data-colisao="texto"]')].find((e) => e.textContent === 'usuários')
      const antes = (await checarQuadro(t)).filter((q) => q.tipo === 'imagem').length
      const ri = ic.getBoundingClientRect(), s = stage.getBoundingClientRect()
      rot.style.left = (ri.left - s.left) + 'px'; rot.style.top = (ri.top - s.top + 10) + 'px'   // põe o rótulo em cima do ícone
      const depois = (await checarQuadro(t)).filter((q) => q.tipo === 'imagem').map((q) => q.msg)
      return { texto: VIDEO.texto, imagens: document.querySelectorAll('[data-imagem]').length, antes, depois }
    })
    await pg.close()
    assert.equal(r.texto, 'fora-da-imagem')
    assert.ok(r.imagens >= 3, 'os ícones estão marcados como imagem')
    assert.equal(r.antes, 0)
    assert.ok(r.depois.length >= 1 && /TEXT OVER IMAGE/.test(r.depois[0]), 'a checagem não acusou o rótulo sobre o ícone')
  })
})
