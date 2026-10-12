// node --test tests/infinite-zoom.test.mjs   (sem rede; a parte de captura e composição precisa do Playwright)
// O que este arquivo trava, no molde infinite-zoom:
//   · os exemplos de formato e o mínimo (captura, níveis e logo) passam na conferência, com o padrão de cada campo;
//   · parâmetro errado dá mensagem que diz o que fazer (inclusive o detalhe que não existe, fica fora da tela ou é grande
//     demais para haver mergulho);
//   · a linha do tempo: cada nível chega, segura e mergulha no seguinte; o último mergulha no fecho;
//   · captura da página de exemplo (assets/example/page.html) e compõe sem render completo em 16:9, 19:9, 21:9, 9:16 e
//     1:1: a página fica pronta
//     sem erro, a checagem do motor não acha texto sobre a tela (nem colisão, nem área segura) em toda a linha do tempo,
//     o mergulho é contínuo (o detalhe vira a tela seguinte sem corte) e o fecho é só o logo (centrado, inteiro).
import { test, describe, before, after } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { createRequire } from 'node:module'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { conferir, linhaDoTempo, folhaDaTrilha, assinaturaCaptura, PADRAO, RITMOS } from '../templates/infinite-zoom/params.mjs'

const require = createRequire(import.meta.url)
const SKILL = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const MOLDE = path.join(SKILL, 'templates', 'infinite-zoom')
const LOGO = path.join(SKILL, 'assets', 'example', 'logo-placeholder.png')
const PAGINA = path.join(SKILL, 'assets', 'example', 'page.html')
const temPlaywright = require('../scripts/playwright.cjs').candidatos().length > 0
const ler = (f) => JSON.parse(fs.readFileSync(path.join(MOLDE, f), 'utf8'))

let tmp
before(() => { tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'infinite-zoom-')) })
after(() => fs.rmSync(tmp, { recursive: true, force: true }))

const NIVEIS = [
  { nome: 'Geral', texto: 'A página inteira', tela: { largura: 1000, altura: 800 }, entrar: '#contents a[href="#plans"]' },
  { nome: 'Seção', texto: 'A seção dos planos', tela: { largura: 560, altura: 440, rolar: '#plans' }, entrar: '#plan-team th' },
  { nome: 'Detalhe', texto: 'A tabela de perto', tela: { largura: 560, altura: 440, rolar: '#details' }, entrar: '#detail-items code' },
]
const minimo = (extra = {}) => ({ captura: { pagina: PAGINA, dsf: 1 }, niveis: NIVEIS, fecho: { logo: LOGO }, ...extra })
const conferirMin = (extra) => conferir(minimo(extra), tmp, { arquivos: false })

describe('parâmetros', () => {
  test('os exemplos de formato passam na conferência, com os arquivos (logo, página) achados', () => {
    for (const f of ['example.json', 'example-bottom-strip.json']) {
      const { erros, cfg } = conferir(ler(f), MOLDE)
      assert.deepEqual(erros, [], f)
      assert.ok(cfg.niveis.length >= 3 && cfg.niveis.length <= 4, `${f}: 3 ou 4 níveis`)
    }
    const [a, b] = ['example.json', 'example-bottom-strip.json'].map(ler)
    assert.notEqual(a.leiaute, b.leiaute)
    assert.notEqual(a.ritmo, b.ritmo)
  })

  test('o padrão: só a captura, os níveis e o logo bastam, e o resto vem do padrão', () => {
    const { erros, cfg } = conferirMin()
    assert.deepEqual(erros, [])
    assert.equal(cfg.leiaute, PADRAO.leiaute)
    assert.equal(cfg.ritmo, 'medio')
    assert.equal(cfg.indice, false)
    assert.deepEqual(cfg.formatos, ['16x9'])
    assert.equal(cfg.marca.fonte, null, 'sem fonte no JSON, a do sistema (nada da marca no código)')
    assert.equal(cfg.captura.tema, 'claro')
  })

  test('parâmetro errado dá mensagem que diz o que fazer', () => {
    const casos = [
      [{ leiaute: 'centro' }, /leiaute "centro" does not exist: use "left-column", "right-column", "bottom-strip", "faixa-em-cima"/],
      [{ ritmo: 'lento' }, /ritmo "lento" does not exist: use "calmo", "medio", "rapido"/],
      [{ formatos: ['4x3'] }, /formato "4x3" does not exist: use 16x9, 19x9, 21x9, 9x16, 1x1/],
      [{ marca: { cores: { texto: 'verde' } } }, /marca\.cores\.texto "verde" is not a #RRGGBB color/],
      [{ marca: { corpo: { titulo: 20 } } }, /marca\.corpo\.titulo 20: between 28 and 200 px/],
      [{ niveis: [NIVEIS[0]] }, /niveis is a list of 2 to 5 screens \(3 or 4 is best\)/],
      [{ niveis: [NIVEIS[0], { ...NIVEIS[1], entrar: undefined }] }, /niveis\[1\]\.entrar: the selector of the detail the camera dives into \(on the last level, it becomes the closing\)/],
      [{ niveis: [{ ...NIVEIS[0], tela: { largura: 50, altura: 40 } }, NIVEIS[1]] }, /niveis\[0\]\.tela: \{ "largura": px, "altura": px \}/],
      [{ niveis: [{ ...NIVEIS[0], texto: 'um dois três quatro cinco seis sete oito nove dez onze' }, NIVEIS[1]] }, /niveis\[0\]\.texto has 11 words: at most 10/],
      [{ indice: true, niveis: [{ ...NIVEIS[0], nome: '' }, NIVEIS[1]] }, /niveis\[0\]\.nome: with "indice": true, each level has a name of up to 3 words/],
      [{ captura: { tema: 'sepia', pagina: 'p.html' } }, /captura\.tema "sepia" does not exist: use "claro", "escuro"/],
      [{ captura: { dsf: 1 }, niveis: NIVEIS }, /captura\.pagina .* or captura\.url/],
    ]
    for (const [extra, re] of casos) {
      const { erros } = conferirMin(extra)
      assert.ok(erros.some((e) => re.test(e)), `${JSON.stringify(extra)} → ${JSON.stringify(erros)}`)
    }
    const semLogo = conferir({ captura: minimo().captura, niveis: NIVEIS }, tmp)
    assert.ok(semLogo.erros.some((e) => /fecho\.logo: the logo PNG \(the closing is only the logo/.test(e)))
  })

  test('a assinatura da captura muda quando a captura ou um nível muda (e só aí)', () => {
    const { cfg } = conferirMin()
    const a = assinaturaCaptura(cfg)
    assert.equal(assinaturaCaptura(conferirMin({ ritmo: 'calmo' }).cfg), a, 'o ritmo não pede captura nova')
    assert.notEqual(assinaturaCaptura(conferirMin({ captura: { pagina: PAGINA, dsf: 1, tema: 'escuro' } }).cfg), a)
    assert.notEqual(assinaturaCaptura(conferirMin({ niveis: [NIVEIS[0], { ...NIVEIS[1], entrar: '#plans' }, NIVEIS[2]] }).cfg), a)
  })
})

describe('linha do tempo', () => {
  test('cada nível chega, segura e mergulha; o último mergulha no fecho, que fica parado o tempo dele', () => {
    const { cfg } = conferirMin()
    const capt = NIVEIS.map((n, k) => ({ arquivo: `nivel-${k + 1}.jpg`, w: n.tela.largura, h: n.tela.altura, dsf: 1, alvo: { x: 10, y: 10, w: 40, h: 20 } }))
    const LN = linhaDoTempo(cfg, capt), R = RITMOS.medio
    assert.equal(LN.chega[0], 0)
    assert.equal(LN.parte[0], R.primeira)
    for (let k = 1; k < 3; k++) {
      assert.ok(Math.abs(LN.chega[k] - (LN.parte[k - 1] + R.zoom)) < 1e-3)
      assert.ok(Math.abs(LN.parte[k] - (LN.chega[k] + R.segura)) < 1e-3)
    }
    assert.ok(Math.abs(LN.dur - (LN.fechoChega + cfg.fecho.dur)) < 1e-3)
    assert.equal(LN.niveis[1].texto, 'A seção dos planos')
    const { folha } = folhaDaTrilha(cfg, LN)
    assert.equal(folha.marcos.filter((m) => m.efeito === 'whoosh').length, 3, 'um whoosh por mergulho')
    assert.ok(folha.marcos.some((m) => m.som === 'acento' && m.t === LN.fechoChega), 'a trilha resolve no logo')
  })
})

describe('captura e composição', { skip: !temPlaywright && 'sem Playwright' }, () => {
  let obras
  before(() => {
    const jsons = {
      padrao: minimo({ nome: 'padrao' }),
      faixa: minimo({ nome: 'faixa', leiaute: 'bottom-strip', ritmo: 'rapido', indice: true, textos: { rotulo: 'Rótulo · teste' }, marca: { cores: { fundo: '#202020', texto: '#F5F5F5', pilulaFundo: '#F5F5F5', pilulaTexto: '#202020', janela: '#202020' } } }),
    }
    obras = {}
    for (const [k, j] of Object.entries(jsons)) {
      fs.writeFileSync(path.join(tmp, `${k}.json`), JSON.stringify(j))
      const r = spawnSync(process.execPath, [path.join(MOLDE, 'render.mjs'), path.join(tmp, `${k}.json`), '--out', path.join(tmp, 'output'), '--assemble-only'], { encoding: 'utf8' })
      assert.equal(r.status, 0, r.stderr + r.stdout)
      obras[k] = path.join(tmp, 'output', `.work-${j.nome}`)
    }
  })

  test('a captura grava um print por nível e o retângulo do detalhe; a mesma captura é reaproveitada', () => {
    const m = JSON.parse(fs.readFileSync(path.join(tmp, 'output', 'capture-padrao', 'niveis.json'), 'utf8'))
    assert.equal(m.niveis.length, 3)
    for (const n of m.niveis) {
      assert.ok(fs.existsSync(path.join(tmp, 'output', 'capture-padrao', n.arquivo)))
      assert.ok(n.alvo.w > 0 && n.alvo.x >= 0 && n.alvo.x + n.alvo.w <= n.w && n.alvo.y >= 0 && n.alvo.y + n.alvo.h <= n.h, 'o detalhe fica dentro da tela')
    }
    const r = spawnSync(process.execPath, [path.join(MOLDE, 'render.mjs'), path.join(tmp, 'padrao.json'), '--out', path.join(tmp, 'output'), '--assemble-only'], { encoding: 'utf8' })
    assert.equal(r.status, 0)
    assert.doesNotMatch(r.stdout, /capturing/, 'nada mudou: a captura não é refeita')
  })

  test('detalhe que não existe ou fica fora da tela: a captura para e diz o que mudar', () => {
    for (const [entrar, re] of [['#nao-existe', /niveis\[1\]\.entrar: "#nao-existe" does not exist on the level 2 screen/], ['#questions', /niveis\[1\]\.entrar: "#questions" is outside the captured screen .*change tela\.rolar, tela\.margem or the screen size/],
      ['#plans', /niveis\[1\]\.entrar: "#plans" takes \d+% of the width .*pick a smaller detail/]]) {
      fs.writeFileSync(path.join(tmp, 'errado.json'), JSON.stringify(minimo({ nome: 'errado', niveis: [NIVEIS[0], { ...NIVEIS[1], entrar }, NIVEIS[2]] })))
      const r = spawnSync(process.execPath, [path.join(MOLDE, 'render.mjs'), path.join(tmp, 'errado.json'), '--out', path.join(tmp, 'saida-errada'), '--assemble-only'], { encoding: 'utf8' })
      assert.equal(r.status, 1)
      assert.match(r.stderr, re)
    }
  })

  for (const fmt of ['16x9', '19x9', '21x9', '9x16', '1x1']) {
    test(`${fmt}: sem texto sobre a tela, sem colisão, na área segura, mergulho sem corte e o fecho só com o logo`, async () => {
      const { abrirNavegador } = require('../scripts/playwright.cjs')
      const { browser } = await abrirNavegador(tmp)
      try {
        for (const [k, obra] of Object.entries(obras)) {
          const [w, h] = { '16x9': [1920, 1080], '19x9': [2280, 1080], '21x9': [2520, 1080], '9x16': [1080, 1920], '1x1': [1080, 1080] }[fmt]
          const p = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 1 })
          const erros = []
          p.on('pageerror', (e) => erros.push(e.message))
          p.on('console', (m) => { if (m.type() === 'error') erros.push(m.text()) })
          await p.goto(pathToFileURL(path.join(obra, 'index.html')).href + `?f=${fmt}`)
          await p.waitForFunction('window.__ready === true', null, { timeout: 60000 })
          const r = await p.evaluate(async () => {
            const probs = []
            for (let t = 0; t < VIDEO.duracao; t += 0.25) probs.push(...(await checarQuadro(t)).map((x) => x.msg))
            // sem corte: em cada mergulho, a janela nunca fica vazia (algum nível visível e opaco cobre o centro dela)
            const logo = document.querySelector('[data-colisao="logo"]'), fecho = logo.parentElement
            const rj = document.querySelector('[data-imagem]').getBoundingClientRect(), buracos = []
            for (let t = 0; t < LINHA.fechoChega; t += 1 / 30) {
              await renderAt(t)
              const e = document.elementFromPoint(rj.x + rj.width / 2, rj.y + rj.height / 2)
              if (!e || !(e.tagName === 'IMG' || fecho.contains(e))) buracos.push(`${t.toFixed(2)} ${e ? e.tagName + '.' + e.className : 'nada'}`)
            }
            await renderAt(VIDEO.duracao - 0.2)
            const fora = []
            for (let gy = 0; gy < 5; gy++) for (let gx = 0; gx < 9; gx++) {
              const x = ((gx + 0.5) / 9) * W, y = ((gy + 0.5) / 5) * H, e = document.elementFromPoint(x, y)
              if (!e || !fecho.contains(e)) fora.push(`${Math.round(x)},${Math.round(y)} ${e ? e.tagName + '.' + e.className : 'nada'}`)
            }
            const rl = logo.getBoundingClientRect()
            return { probs, buracos: buracos.slice(0, 5), fora, textoNoFecho: fecho.textContent.trim(), opLogo: _opacEfetiva(logo), centro: [rl.x + rl.width / 2 - CX, rl.y + rl.height / 2 - CY],
              textosMarcados: [...document.querySelectorAll('[data-colisao="texto"]')].filter((e) => _opacEfetiva(e) > 0.05 && e.getBoundingClientRect().width > 0).map((e) => e.textContent) }
          })
          await p.close()
          assert.deepEqual(erros, [], `${k} ${fmt}: erro na página`)
          assert.deepEqual(r.probs, [], `${k} ${fmt}: a checagem achou problema`)
          assert.deepEqual(r.buracos, [], `${k} ${fmt}: a janela ficou vazia no meio de um mergulho (corte)`)
          assert.deepEqual(r.fora, [], `${k} ${fmt}: no fecho, algo além do fecho aparece`)
          assert.equal(r.textoNoFecho, '', `${k} ${fmt}: o fecho tem texto`)
          assert.deepEqual(r.textosMarcados, [], `${k} ${fmt}: texto visível no fecho`)
          assert.ok(r.opLogo > 0.99, `${k} ${fmt}: o logo não está inteiro no fecho`)
          assert.ok(Math.hypot(...r.centro) < 2, `${k} ${fmt}: o logo não está centrado (${r.centro})`)
        }
      } finally { await browser.close() }
    })
  }
})
