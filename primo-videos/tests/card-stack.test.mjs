// node --test tests/card-stack.test.mjs   (sem rede; a parte de composição precisa do Playwright; a marca dos exemplos
// são os marcadores de assets/example)
// O que este arquivo trava, no molde card-stack:
//   · os exemplos de formato (o dividido com swipe, o centro com flip) e uma outra marca montada aqui passam no validar e têm linha do tempo coerente: a leitura
//     cresce com as palavras, o contador troca no meio de cada saída, o logo fica parado no fim;
//   · parâmetro errado dá mensagem que diz o que trocar, e o render.mjs para antes de montar qualquer pasta;
//   · a obra montada (--assemble-only, sem render) compõe em 16:9, 9:16, 1:1 e 21:9 e passa na checagem de quadros do motor
//     (colisão, área segura, texto sobre imagem);
//   · o contador mostra o cartão de cima ("2/4" na leitura do segundo);
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
const MOLDE = path.join(SKILL, 'templates', 'card-stack')
const B = require(path.join(MOLDE, 'plan.js'))
const copia = (o) => JSON.parse(JSON.stringify(o))
// uma outra marca, com cores e fontes que não são as dos exemplos, sem logo (o fecho escreve o nome) e sem ícone: prova
// que nada da marca está no código. Usa o que os exemplos não usam: centro com swipe, ritmo "medio" e máscara.
const NEUTRO = {
  nome: 'marca-pilha', formatos: ['16x9', '9x16'],
  marca: {
    nome: 'Marca',
    cores: { fundo: '#0F2A1C', cartao: '#FFF8EC', texto: '#1D2B22', titulo: '#0F2A1C', cabecalho: '#FFF6E6', contador: '#FF8A3D', contadorTexto: '#0F2A1C' },
    pilha: ['#FFD2B0', '#FF8A3D'],
    fontes: { titulo: { familia: 'Bricolage Grotesque', peso: 700 }, texto: { familia: 'Space Grotesk', peso: 500 } },
    raio: 32,
  },
  titulo: 'Como começar',
  leiaute: 'centro', saida: 'swipe', camera: 'estatica', ritmo: 'medio',
  cartoes: [
    { titulo: 'Crie a sua conta', texto: 'Com o e-mail do trabalho.' },
    { titulo: 'Escolha o que acompanhar', texto: 'Dá para mudar depois, quando quiser.' },
    { titulo: 'Convide o time', texto: 'Um link, e todo mundo entra.' },
  ],
  fecho: { fundo: '#FFF8EC', cor: '#0F2A1C', transicao: 'mascara' },
  trilha: { semente: 42, identidade: { genero: 'acustico', bpm: [96, 104], modos: ['maior'], tons: ['C', 'D', 'G'] } },
}
const ler = (f) => (f === 'neutro' ? copia(NEUTRO) : JSON.parse(fs.readFileSync(path.join(MOLDE, f), 'utf8')))
const EXEMPLOS = ['example-split.json', 'example.json', 'neutro']
const pw = require(path.join(SKILL, 'scripts', 'playwright.cjs'))
const temPlaywright = pw.candidatos().length > 0

describe('parâmetros e linha do tempo', () => {
  test('os exemplos passam no validar e duram de 6 a 15 s; o contador troca no meio de cada saída', () => {
    for (const f of EXEMPLOS) {
      const P = ler(f)
      assert.deepEqual(B.validar(P), [], f)
      const pl = B.planejar(P), n = P.cartoes.length
      assert.ok(pl.dur >= 6 && pl.dur <= 15, `${f}: ${pl.dur} s`)
      assert.equal(pl.leituras.length, n)
      assert.equal(pl.trocas.length, n - 1)
      pl.trocas.forEach((tc, k) => {
        const s = pl.saidas[k]
        assert.ok(Math.abs(tc - (s.t0 + s.t1) / 2) < 1e-3, `${f}: troca ${k} fora do meio da saída`)
        assert.ok(pl.leituras[k + 1].ini <= tc + 1e-6, `${f}: o cartão ${k + 2} começa depois da troca`)
      })
      for (let k = 1; k < n; k++) assert.ok(pl.leituras[k].ini >= pl.leituras[k - 1].fim, `${f}: leituras ${k} e ${k + 1} se sobrepõem`)
      assert.ok(pl.fecho.t1 - pl.fecho.tLogo >= 1.5, `${f}: o logo fica parado menos de 1,5 s`)
    }
  })

  test('sem os opcionais, o padrão é leiaute centro, swipe, câmera parada, ritmo médio e fecho por whip', () => {
    const P = ler('neutro')
    for (const k of ['leiaute', 'saida', 'camera', 'ritmo', 'inclina', 'titulo']) delete P[k]
    delete P.fecho.transicao
    assert.deepEqual(B.validar(P), [])
    const pl = B.planejar(P)
    assert.equal(pl.fecho.transicao, 'whip')
    assert.deepEqual(pl.ritmo, B.RITMOS.medio)
  })

  test('a leitura cresce com as palavras, fica entre o mínimo e o máximo, e "dur" vence', () => {
    const P = ler('neutro')
    P.cartoes = [{ titulo: 'Um' }, { titulo: 'Um dois três quatro', texto: 'cinco seis sete oito nove dez' }, { titulo: 'a b c d e f g', texto: 'a b c d e f g h i j k l m n' }, { titulo: 'Fixo', dur: 4 }]
    const pl = B.planejar(P), R = B.RITMOS.medio, d = pl.leituras.map((l) => +(l.fim - l.ini).toFixed(3))
    assert.equal(d[0], R.min)
    assert.ok(d[1] > R.min && d[1] < R.max, `${d[1]}`)
    assert.equal(d[2], R.max)
    assert.equal(d[3], 4)
  })

  test('parâmetro errado dá mensagem que diz o que trocar', () => {
    const base = ler('example-split.json')
    const casos = [
      [(P) => { P.leiaute = 'grade' }, /leiaute "grade" does not exist: use centro, dividido/],
      [(P) => { P.saida = 'voa' }, /saida "voa" does not exist: use swipe, flip/],
      [(P) => { P.camera = 'drone' }, /camera "drone" does not exist: use estatica, aproxima/],
      [(P) => { P.cartoes[1].titulo = 'um dois três quatro cinco seis sete oito' }, /cartoes\[1\]\.titulo has 8 words: the title takes up to 7/],
      [(P) => { P.cartoes[0].texto = Array.from({ length: 16 }, (_, i) => `p${i}`).join(' ') }, /cartoes\[0\]\.texto has 16 words: the card fits up to 14/],
      [(P) => { P.cartoes = P.cartoes.slice(0, 1) }, /takes 2 to 8 cards \(got 1\)/],
      [(P) => { P.cartoes = Array.from({ length: 9 }, () => ({ titulo: 'Dica' })) }, /takes 2 to 8 cards \(got 9\)/],
      [(P) => { P.marca.pilha = ['rosa'] }, /marca\.pilha: the colors of the cards behind/],
      [(P) => { delete P.marca.cores.cartao }, /marca\.cores needs "fundo", "cartao" and "texto"/],
      [(P) => { P.marca.cores.titulo = 'preto' }, /marca\.cores\.titulo "preto": use #RRGGBB/],
      [(P) => { P.fecho.transicao = 'explosao' }, /fecho\.transicao "explosao" does not exist: use whip, virada/],
      [(P) => { P.inclina = 20 }, /inclina: rotation in degrees of the cards behind, from -10 to 10/],
      [(P) => { P.ritmo = { porPalavra: -1 } }, /ritmo\.porPalavra: use a number of seconds/],
      [(P) => { P.cartoes[2].dur = 0.2 }, /cartoes\[2\]\.dur: reading seconds, 1 or more/],
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

describe('a linha de comando', () => {
  let tmp, neutro
  before(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'pilha-cli-'))
    neutro = path.join(tmp, 'neutro.json'); fs.writeFileSync(neutro, JSON.stringify(NEUTRO))
  })
  after(() => fs.rmSync(tmp, { recursive: true, force: true }))
  const rodar = (...args) => spawnSync(process.execPath, [path.join(MOLDE, 'render.mjs'), ...args], { encoding: 'utf8' })

  test('sem --out, mostra o uso', () => {
    const r = rodar(neutro)
    assert.equal(r.status, 1)
    assert.match(r.stderr, /usage: node render\.mjs <parametros\.json> --out <folder>/)
  })
  test('formato desconhecido para antes de montar a pasta', () => {
    const r = rodar(neutro, '--out', path.join(tmp, 'a'), '--formats', '9x16,2x1')
    assert.equal(r.status, 1)
    assert.match(r.stderr, /unknown format for this template: 2x1\. Use 16x9, 19x9, 21x9, 9x16, 1x1, 4x5\./)
    assert.ok(!fs.existsSync(path.join(tmp, 'a')))
  })
  test('parâmetro errado lista os problemas e não monta nada', () => {
    const P = ler('neutro'); P.saida = 'cai'; P.leiaute = 'lado'
    const arq = path.join(tmp, 'errado.json'); fs.writeFileSync(arq, JSON.stringify(P))
    const r = rodar(arq, '--out', path.join(tmp, 'b'))
    assert.equal(r.status, 1)
    assert.match(r.stderr, /parameters with problems/)
    assert.match(r.stderr, /saida "cai" does not exist/)
    assert.match(r.stderr, /leiaute "lado" does not exist/)
    assert.ok(!fs.existsSync(path.join(tmp, 'b')))
  })
  test('imagem que falta é dita com o caminho procurado, antes de montar', () => {
    const P = ler('neutro'); P.cartoes[2].icone = 'sumiu.png'
    const arq = path.join(tmp, 'sem-icone.json'); fs.writeFileSync(arq, JSON.stringify(P))
    const r = rodar(arq, '--out', path.join(tmp, 'c'))
    assert.equal(r.status, 1)
    assert.match(r.stderr, /missing image:\n {2}- cartoes\[2\]\.icone: sumiu\.png \(looked in /)
    assert.ok(!fs.existsSync(path.join(tmp, 'c')))
  })
})

describe('a obra montada, no navegador (sem render)', { skip: !temPlaywright ? 'sem Playwright' : false }, () => {
  let tmp, browser
  const obras = {}
  before(async () => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'pilha-obra-'))
    for (const [chave, f, nome] of [['dividido', 'example-split.json', 'card-stack-example-split'], ['centro', 'example.json', 'card-stack-example']]) {
      const obra = path.join(tmp, `.work-${nome}`)
      const f1 = spawnSync(process.execPath, [path.join(SKILL, 'scripts', 'example-fonts.mjs'), obra], { encoding: 'utf8' })
      assert.equal(f1.status, 0, f1.stderr)
      const r = spawnSync(process.execPath, [path.join(MOLDE, 'render.mjs'), path.join(MOLDE, f), '--out', tmp, '--assemble-only'], { encoding: 'utf8' })
      assert.equal(r.status, 0, r.stderr)
      obras[chave] = obra
    }
    ;({ browser } = await pw.abrirNavegador(tmp))
  })
  after(async () => { if (browser) await browser.close(); fs.rmSync(tmp, { recursive: true, force: true }) })

  const TAM = { '16x9': [1920, 1080], '9x16': [1080, 1920], '1x1': [1080, 1080], '21x9': [2520, 1080] }
  async function abrir(obra, fmt) {
    const page = await browser.newPage({ viewport: { width: TAM[fmt][0], height: TAM[fmt][1] }, deviceScaleFactor: 1 })
    const erros = []
    page.on('pageerror', (e) => erros.push(e.message))
    page.on('console', (m) => { if (m.type() === 'error') erros.push(m.text()) })
    await page.goto(pathToFileURL(path.join(obra, 'index.html')).href + `?f=${fmt}`)
    await page.waitForFunction('window.__ready === true', null, { timeout: 60000 })
    return { page, erros }
  }

  for (const chave of ['dividido', 'centro']) for (const fmt of ['16x9', '9x16', '1x1', '21x9']) {
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

  test('o contador mostra o cartão de cima: "k/N" no meio da leitura do cartão k', async () => {
    for (const chave of ['dividido', 'centro']) {
      const { page } = await abrir(obras[chave], '16x9')
      const lidos = await page.evaluate(async () => {
        const out = []
        for (const l of PLANO.leituras) {
          await renderAt((l.ini + l.fim) / 2)
          const vis = [...document.querySelectorAll('[data-colisao-nome="counter"]')].filter((e) => parseFloat(getComputedStyle(e).opacity) > 0.9)
          out.push(vis.map((e) => e.textContent).join(''))
        }
        return out
      })
      const n = lidos.length
      assert.deepEqual(lidos, Array.from({ length: n }, (_, k) => `${k + 1}/${n}`), chave)
      await page.close()
    }
  })

  test('o fecho é só o logo: uma cena visível, uma imagem (o PNG do logo), nenhum texto', async () => {
    for (const chave of ['dividido', 'centro']) for (const fmt of ['16x9', '9x16']) {
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

  test('com ícone no cartão, a checagem "texto fora da imagem" está ligada e reprova texto posto sobre o ícone', async () => {
    const { page } = await abrir(obras.centro, '16x9')
    const r = await page.evaluate(async () => {
      const l = PLANO.leituras[0], t = (l.ini + l.fim) / 2
      const antes = (await checarQuadro(t)).filter((a) => a.tipo === 'imagem').length
      const img = document.querySelector('[data-imagem]')
      const tit = [...document.querySelectorAll('[data-colisao="texto"]')].find((e) => e.textContent.startsWith('First tip'))
      const ri = img.getBoundingClientRect(), rt = tit.getBoundingClientRect(), s = rt.width / tit.offsetWidth
      tit.style.left = (parseFloat(tit.style.left) + (ri.left - rt.left) / s) + 'px'
      tit.style.top = (parseFloat(tit.style.top) + (ri.top - rt.top) / s) + 'px'
      const depois = (await checarQuadro(t)).filter((a) => a.tipo === 'imagem').map((a) => a.msg)
      return { texto: VIDEO.texto, antes, depois }
    })
    assert.equal(r.texto, 'fora-da-imagem')
    assert.equal(r.antes, 0)
    assert.ok(r.depois.some((m) => /TEXT OVER IMAGE/.test(m) && /First tip/.test(m)), JSON.stringify(r.depois))
    await page.close()
  })
})
