// node --test tests/card-bento.test.mjs   (sem rede; a parte de composição precisa do Playwright; a marca dos exemplos
// são os marcadores de assets/example)
// O que este arquivo trava, no molde card-bento:
//   · os exemplos de formato (o claro com zoom, o escuro com travelling) e uma outra marca montada aqui passam no validar e têm linha
//     do tempo coerente;
//   · parâmetro errado dá mensagem que diz o que trocar, e o render.mjs para antes de montar qualquer pasta;
//   · a grade bento não sobrepõe cartões e não deixa buraco nos exemplos, em 2, 3 e 4 colunas;
//   · a obra montada (--assemble-only, sem render) compõe em 16:9, 9:16, 1:1, 19:9 e 21:9 e passa na checagem de quadros do motor
//     (colisão, área segura, texto sobre imagem);
//   · o fecho é só o logo: uma cena visível, uma imagem, nenhum texto;
//   · a checagem "texto fora da imagem" está ligada: texto posto sobre o ícone é reprovado.
import { test, describe, before, after } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { createRequire } from 'node:module'
import { pathToFileURL, fileURLToPath } from 'node:url'

const require = createRequire(import.meta.url)
const SKILL = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const MOLDE = path.join(SKILL, 'templates', 'card-bento')
const B = require(path.join(MOLDE, 'plan.js'))
const copia = (o) => JSON.parse(JSON.stringify(o))
// uma outra marca, com cores e fontes que não são as dos exemplos, sem logo (o fecho escreve o nome) e sem ícone: prova
// que nada da marca está no código. Usa o que os exemplos não usam: cartão grande, barras e fecho por máscara.
const NEUTRO = {
  nome: 'marca-bento', formatos: ['16x9', '9x16'],
  marca: {
    nome: 'Marca',
    cores: { fundo: '#0F2A1C', texto: '#1D2B22', destaque: '#FF4F87', ladrilho: '#FFFFFF', vazio: '#EBD9BF' },
    cartoes: [{ fundo: '#FFF8EC', texto: '#1D2B22' }, { fundo: '#F3E6D0', texto: '#1D2B22' }],
    fontes: { titulo: { familia: 'Bricolage Grotesque', peso: 700 }, texto: { familia: 'Space Grotesk', peso: 500 } },
    raio: 32,
  },
  camera: { modo: 'zoom' }, montagem: 'antes', entrada: 'pop', ritmo: 'medio',
  cartoes: [
    { titulo: 'Painel da semana', texto: 'Tudo o que mudou, num lugar só', tamanho: 'grande',
      visual: { tipo: 'cores', cores: ['#FF8A3D', '#FF4F87', '#7BC67E', '#F4D35E', '#9B5DE5', '#E63946', '#2A9D8F', '#F4A261'] } },
    { titulo: 'Equipes', texto: 'Na mesma conta', tamanho: 'pequeno', visual: { tipo: 'numero', valor: 48 } },
    { titulo: 'Busca', texto: 'Ache o que precisa', tamanho: 'pequeno', visual: { tipo: 'linhas', linhas: 3 } },
    { titulo: 'Relatórios', texto: 'Um por semana, pronto', tamanho: 'largo', visual: { tipo: 'slides' } },
    { titulo: 'Acessos por dia', texto: 'A semana inteira', tamanho: 'largo', visual: { tipo: 'barras', valores: [5, 8, 6, 9, 7, 4, 3], cores: ['#FF8A3D', '#FF4F87'] } },
  ],
  fecho: { fundo: '#FFF8EC', cor: '#0F2A1C', transicao: 'mascara' },
  trilha: { semente: 41, identidade: { genero: 'acustico', bpm: [96, 104], modos: ['maior'], tons: ['C', 'D', 'G'] } },
}
const ler = (f) => (f === 'neutro' ? copia(NEUTRO) : JSON.parse(fs.readFileSync(path.join(MOLDE, f), 'utf8')))
const EXEMPLOS = ['example.json', 'example-travelling.json', 'neutro']
const pw = require(path.join(SKILL, 'scripts', 'playwright.cjs'))
const temPlaywright = pw.candidatos().length > 0

describe('parâmetros e linha do tempo', () => {
  test('os exemplos passam no validar e duram de 6 a 15 s, com as seções encadeadas', () => {
    for (const f of EXEMPLOS) {
      const P = ler(f)
      assert.deepEqual(B.validar(P), [], f)
      const pl = B.planejar(P)
      assert.ok(pl.dur >= 6 && pl.dur <= 15, `${f}: ${pl.dur} s`)
      for (let i = 1; i < pl.secoes.length; i++) assert.ok(Math.abs(pl.secoes[i].t0 - pl.secoes[i - 1].t1) < 1e-6, `${f}: seção ${i} não começa onde a anterior acaba`)
      assert.ok(pl.entradas.every((e) => e != null && e >= 0 && e < pl.fecho.t0), `${f}: cartão sem hora de entrar`)
      assert.equal(pl.visitas.length, P.cartoes.length, f)
      assert.ok(pl.fecho.t1 - pl.fecho.tLogo >= 1.5, `${f}: o logo fica parado menos de 1,5 s`)
    }
  })

  test('sem os opcionais, o padrão é montagem antes, câmera zoom, ritmo médio e fecho por zoom através', () => {
    const P = ler('neutro')
    for (const k of ['camera', 'montagem', 'entrada', 'ritmo', 'colunas', 'visitar']) delete P[k]
    delete P.fecho.transicao
    assert.deepEqual(B.validar(P), [])
    const pl = B.planejar(P)
    assert.equal(pl.montagem, 'antes')
    assert.equal(pl.fecho.transicao, 'zoom-through')
    assert.deepEqual(pl.ritmo, B.RITMOS.medio)
  })

  test('"visitar" escolhe os cartões em close; os outros entram no recuo (no caminho)', () => {
    const P = { ...ler('example-travelling.json'), visitar: [0, 2] }
    const pl = B.planejar(P)
    assert.deepEqual(pl.visitas.map((v) => v.i), [0, 2])
    for (const i of [1, 3, 4, 5, 6]) assert.ok(pl.entradas[i] >= pl.recuo.t0, `cartão ${i} entra antes do recuo`)
  })

  test('parâmetro errado dá mensagem que diz o que trocar', () => {
    const base = ler('example.json')
    const casos = [
      [(P) => { P.cartoes[0].tamanho = 'enorme' }, /cartoes\[0\]\.tamanho "enorme" does not exist: use pequeno, largo, alto, grande/],
      [(P) => { P.cartoes[1].visual.tipo = 'pizza' }, /cartoes\[1\]\.visual\.tipo "pizza" does not exist: use barras, cores, numero/],
      [(P) => { P.cartoes[0].visual = { tipo: 'cores' } }, /cartoes\[0\]\.visual \(cores\) needs "cores"/],
      [(P) => { P.cartoes[2].titulo = 'um dois três quatro cinco seis sete oito nove' }, /cartoes\[2\]\.titulo has 9 words: the title takes up to 7/],
      [(P) => { P.cartoes = P.cartoes.slice(0, 1) }, /takes 2 to 9 cards \(got 1\)/],
      [(P) => { P.camera = { modo: 'drone' } }, /camera\.modo "drone" does not exist: use zoom, travelling/],
      [(P) => { P.montagem = 'depois' }, /montagem "depois" does not exist: use antes, no-caminho/],
      [(P) => { P.fecho.transicao = 'explosao' }, /fecho\.transicao "explosao" does not exist: use zoom-through, push/],
      [(P) => { P.ritmo = 'turbo' }, /ritmo "turbo" does not exist: use calmo, medio, rapido/],
      [(P) => { P.visitar = [0, 9] }, /visitar: list of card indexes, from 0 to 3/],
      [(P) => { delete P.marca.cores.fundo }, /marca\.cores needs "fundo" and "texto"/],
      [(P) => { P.marca.cores.destaque = 'cinza' }, /marca\.cores\.destaque "cinza": use #RRGGBB/],
      [(P) => { delete P.fecho.logo; delete P.marca.nome }, /fecho\.logo: missing the closing logo/],
    ]
    for (const [muda, re] of casos) {
      const P = copia(base)
      muda(P)
      const erros = B.validar(P)
      assert.ok(erros.some((e) => re.test(e)), `esperava ${re}, veio: ${JSON.stringify(erros)}`)
    }
  })
})

describe('a grade bento', () => {
  // toda célula ocupada no máximo uma vez, e (nos exemplos) exatamente uma vez
  function confere(tams, C, semBuraco) {
    const { pos, colunas, linhas } = B.empacotar(tams, C)
    const ocup = Array.from({ length: linhas }, () => new Array(colunas).fill(0))
    for (const p of pos) {
      assert.ok(p.c >= 0 && p.c + p.w <= colunas && p.l >= 0, `cartão fora da grade: ${JSON.stringify(p)}`)
      for (let l = p.l; l < p.l + p.h; l++) for (let c = p.c; c < p.c + p.w; c++) ocup[l][c]++
    }
    assert.ok(ocup.flat().every((n) => n <= 1), `cartões sobrepostos em ${C} colunas: ${JSON.stringify(pos)}`)
    if (semBuraco) assert.ok(ocup.flat().every((n) => n === 1), `buraco na grade de ${C} colunas: ${JSON.stringify(ocup)}`)
    return { pos, linhas }
  }
  test('os exemplos encaixam sem sobrepor e sem buraco em 4, 3 e 2 colunas', () => {
    for (const f of EXEMPLOS) for (const C of [4, 3, 2]) confere(ler(f).cartoes.map((c) => c.tamanho || 'pequeno'), C, true)
  })
  test('qualquer mistura de tamanhos encaixa sem sobrepor (buraco pode sobrar, nunca sobreposição)', () => {
    const T = Object.keys(B.TAMANHOS)
    for (let s = 1; s <= 200; s++) {
      const n = 2 + (s % 8), tams = Array.from({ length: n }, (_, i) => T[(s * 7 + i * 3 + (s >> 2)) % T.length])
      for (const C of [2, 3, 4]) confere(tams, C, false)
    }
  })
  test('o exemplo claro é a grade 4×2 do 16:9 (alto, largo, pequenos, largo)', () => {
    const { linhas, pos } = confere(ler('example.json').cartoes.map((c) => c.tamanho), 4, true)
    assert.equal(linhas, 2)
    assert.deepEqual(pos[0], { c: 0, l: 0, w: 1, h: 2 })
  })
})

describe('a linha de comando', () => {
  let tmp, neutro
  before(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'bento-cli-'))
    neutro = path.join(tmp, 'neutro.json'); fs.writeFileSync(neutro, JSON.stringify(NEUTRO))
  })
  after(() => fs.rmSync(tmp, { recursive: true, force: true }))
  const rodar = (...args) => spawnSync(process.execPath, [path.join(MOLDE, 'render.mjs'), ...args], { encoding: 'utf8' })

  test('sem --out, mostra o uso', () => {
    const r = rodar(neutro)
    assert.equal(r.status, 1)
    assert.match(r.stderr, /usage: node render\.mjs <params\.json> --out <folder>/)
  })
  test('formato desconhecido para antes de montar a pasta', () => {
    const r = rodar(neutro, '--out', path.join(tmp, 'a'), '--formats', '16x9,3x2')
    assert.equal(r.status, 1)
    assert.match(r.stderr, /format this template doesn't support: 3x2\. Use 16x9, 19x9, 21x9, 9x16, 1x1, 4x5\./)
    assert.ok(!fs.existsSync(path.join(tmp, 'a')))
  })
  test('parâmetro errado lista os problemas e não monta nada', () => {
    const P = ler('neutro'); P.cartoes[0].tamanho = 'gigante'; P.camera = { modo: 'grua' }
    const arq = path.join(tmp, 'errado.json'); fs.writeFileSync(arq, JSON.stringify(P))
    const r = rodar(arq, '--out', path.join(tmp, 'b'))
    assert.equal(r.status, 1)
    assert.match(r.stderr, /parameters with problems/)
    assert.match(r.stderr, /tamanho "gigante" does not exist/)
    assert.match(r.stderr, /camera\.modo "grua" does not exist/)
    assert.ok(!fs.existsSync(path.join(tmp, 'b')))
  })
  test('imagem que falta é dita com o caminho procurado, antes de montar', () => {
    const P = ler('neutro'); P.cartoes[1].icone = 'nao-existe.png'
    const arq = path.join(tmp, 'sem-icone.json'); fs.writeFileSync(arq, JSON.stringify(P))
    const r = rodar(arq, '--out', path.join(tmp, 'c'))
    assert.equal(r.status, 1)
    assert.match(r.stderr, /missing image:\n {2}- cartoes\[1\]\.icone: nao-existe\.png \(looked in /)
    assert.ok(!fs.existsSync(path.join(tmp, 'c')))
  })
})

describe('a obra montada, no navegador (sem render)', { skip: !temPlaywright ? 'sem Playwright' : false }, () => {
  let tmp, browser
  const obras = {}
  before(async () => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'bento-obra-'))
    for (const [chave, f, nome] of [['claro', 'example.json', 'card-bento-example'], ['escuro', 'example-travelling.json', 'card-bento-example-travelling']]) {
      const obra = path.join(tmp, `.work-${nome}`)
      // a Inter dos exemplos antes: a montagem não baixa nada
      const f1 = spawnSync(process.execPath, [path.join(SKILL, 'scripts', 'example-fonts.mjs'), obra], { encoding: 'utf8' })
      assert.equal(f1.status, 0, f1.stderr)
      const r = spawnSync(process.execPath, [path.join(MOLDE, 'render.mjs'), path.join(MOLDE, f), '--out', tmp, '--assemble-only'], { encoding: 'utf8' })
      assert.equal(r.status, 0, r.stderr)
      obras[chave] = obra
    }
    ;({ browser } = await pw.abrirNavegador(tmp))
  })
  after(async () => { if (browser) await browser.close(); fs.rmSync(tmp, { recursive: true, force: true }) })

  const TAM = { '16x9': [1920, 1080], '9x16': [1080, 1920], '1x1': [1080, 1080], '19x9': [2280, 1080], '21x9': [2520, 1080] }
  async function abrir(obra, fmt) {
    const page = await browser.newPage({ viewport: { width: TAM[fmt][0], height: TAM[fmt][1] }, deviceScaleFactor: 1 })
    const erros = []
    page.on('pageerror', (e) => erros.push(e.message))
    page.on('console', (m) => { if (m.type() === 'error') erros.push(m.text()) })
    await page.goto(pathToFileURL(path.join(obra, 'index.html')).href + `?f=${fmt}`)
    await page.waitForFunction('window.__ready === true', null, { timeout: 60000 })
    return { page, erros }
  }

  for (const chave of ['claro', 'escuro']) for (const fmt of ['16x9', '9x16', '1x1', '19x9', '21x9']) {
    test(`${chave} ${fmt}: compõe sem erro e passa na checagem de quadros (colisão, área segura, texto sobre imagem)`, async () => {
      const { page, erros } = await abrir(obras[chave], fmt)
      const achados = await page.evaluate(async () => {
        const out = []
        for (let t = 0; t < VIDEO.duracao; t += 0.4) out.push(...(await checarQuadro(t)).map((a) => a.msg))
        return out
      })
      assert.deepEqual(erros, [])
      assert.deepEqual(achados, [])
      await page.close()
    })
  }

  test('o fecho é só o logo: uma cena visível, uma imagem (o PNG do logo), nenhum texto', async () => {
    for (const chave of ['claro', 'escuro']) for (const fmt of ['16x9', '9x16']) {
      const { page } = await abrir(obras[chave], fmt)
      const fecho = await page.evaluate(async () => {
        await renderAt(VIDEO.duracao - 0.5)
        const vis = [...document.querySelectorAll('#stage .scene')].filter((s) => getComputedStyle(s).display !== 'none')
        const els = vis.flatMap((s) => [...s.querySelectorAll('*')]).filter((e) => getComputedStyle(e).display !== 'none')
        return { cenas: vis.length, imgs: els.filter((e) => e.tagName === 'IMG').map((e) => decodeURIComponent(e.src.split('/').pop())), texto: vis.map((s) => s.textContent.trim()).join(''), marcados: els.filter((e) => e.dataset.colisao).map((e) => e.dataset.colisao) }
      })
      assert.equal(fecho.cenas, 1, `${chave} ${fmt}`)
      assert.equal(fecho.imgs.length, 1, `${chave} ${fmt}: ${fecho.imgs}`)
      assert.match(fecho.imgs[0], /logo-placeholder(-light)?\.png$/)
      assert.equal(fecho.texto, '', `${chave} ${fmt}: texto no fecho`)
      assert.deepEqual(fecho.marcados, ['logo'])
      await page.close()
    }
  })

  test('com imagem no cartão, a checagem "texto fora da imagem" está ligada e reprova texto posto sobre o ícone', async () => {
    const { page } = await abrir(obras.claro, '16x9')
    const r = await page.evaluate(async () => {
      const t = PLANO.visitas[1].t1 - 0.2   // o 2º cartão em foco, parado
      const antes = (await checarQuadro(t)).filter((a) => a.tipo === 'imagem').length
      const img = [...document.querySelectorAll('[data-imagem]')].find((e) => /Feature two/.test(e.dataset.imagem))
      const tit = [...document.querySelectorAll('[data-colisao="texto"]')].find((e) => e.textContent === 'Feature two')
      // leva o título para cima do ícone (os dois estão no mundo que a câmera escala)
      const ri = img.getBoundingClientRect(), rt = tit.getBoundingClientRect(), s = rt.width / tit.offsetWidth
      tit.style.left = (parseFloat(tit.style.left) + (ri.left - rt.left) / s) + 'px'
      tit.style.top = (parseFloat(tit.style.top) + (ri.top - rt.top) / s) + 'px'
      const depois = (await checarQuadro(t)).filter((a) => a.tipo === 'imagem').map((a) => a.msg)
      return { texto: VIDEO.texto, imagens: document.querySelectorAll('[data-imagem]').length, cartoes: document.querySelectorAll('[data-imagem^="the icon of"]').length, antes, depois }
    })
    assert.equal(r.texto, 'fora-da-imagem')
    // um ícone marcado por cartão do exemplo (4 cartões: os quatro recursos)
    assert.ok(r.cartoes >= 4 && r.imagens >= r.cartoes, `só ${r.imagens} imagens marcadas (${r.cartoes} ícones)`)
    assert.equal(r.antes, 0)
    assert.ok(r.depois.some((m) => /TEXT OVER IMAGE/.test(m) && /Feature two/.test(m)), JSON.stringify(r.depois))
    await page.close()
  })
})
