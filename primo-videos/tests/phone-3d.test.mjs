// node --test tests/phone-3d.test.mjs   (sem rede; a parte de composição precisa do Playwright)
// O que este arquivo trava, no molde phone-3d:
//   · os exemplos de formato e o mínimo (só a captura e o logo) passam na conferência, com o padrão de cada campo;
//   · parâmetro errado dá mensagem que diz o que fazer;
//   · a linha do tempo sai da gravação (passos, focos da câmera, toques, fecho);
//   · compõe sem render completo, a partir de uma gravação sintética da página de exemplo (assets/example/page.html),
//     em 16:9, 19:9, 21:9, 9:16 e 1:1: a página fica
//     pronta sem erro, a checagem do motor não acha texto sobre a tela do celular (nem colisão, nem área segura) em
//     toda a linha do tempo, e o fecho é só o logo (centrado, inteiro, nada de texto).
import { test, describe, before, after } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { createRequire } from 'node:module'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { conferir, linhaDoTempo, folhaDaTrilha, PADRAO, RITMOS } from '../templates/phone-3d/params.mjs'

const require = createRequire(import.meta.url)
const SKILL = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const MOLDE = path.join(SKILL, 'templates', 'phone-3d')
const LOGO = path.join(SKILL, 'assets', 'example', 'logo-placeholder.png')
const PAGINA = path.join(SKILL, 'assets', 'example', 'page.html')
const temPlaywright = require('../scripts/playwright.cjs').candidatos().length > 0
const ler = (f) => JSON.parse(fs.readFileSync(path.join(MOLDE, f), 'utf8'))

let tmp
before(() => { tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'phone-3d-')) })
after(() => fs.rmSync(tmp, { recursive: true, force: true }))

const minimo = (extra = {}) => ({ captura: { pagina: PAGINA, jornada: [{ passo: 'Role a lista' }, { rola: 300 }] }, fecho: { logo: LOGO }, ...extra })
const conferirMin = (extra) => conferir(minimo(extra), tmp, { arquivos: false })

describe('parâmetros', () => {
  test('os exemplos de formato passam na conferência, com os arquivos (logo, símbolo, página) achados', () => {
    for (const f of ['example-orbit.json', 'example.json']) {
      const { erros, cfg } = conferir(ler(f), MOLDE)
      assert.deepEqual(erros, [], f)
      assert.ok(cfg.fecho.logo && cfg.marca.fonte === 'Inter', f)
    }
    // os dois exemplos mudam a câmera e o leiaute (cada um mostra um jeito do molde)
    const [a, b] = ['example-orbit.json', 'example.json'].map(ler)
    assert.notEqual(a.camera, b.camera)
    assert.notEqual(a.leiaute, b.leiaute)
  })

  test('o padrão: só a captura e o logo bastam, e o resto vem do padrão', () => {
    const { erros, cfg } = conferirMin()
    assert.deepEqual(erros, [])
    assert.equal(cfg.camera, PADRAO.camera)
    assert.equal(cfg.leiaute, 'right-column')
    assert.equal(cfg.transicao, 'mascara')
    assert.equal(cfg.ritmo, 'medio')
    assert.deepEqual(cfg.formatos, ['16x9'])
    assert.equal(cfg.zoomLeitura, 2)
    assert.equal(cfg.marca.fonte, null, 'sem fonte no JSON, a do sistema (nada da marca no código)')
    assert.equal(cfg.captura.aparelho, 'phone')
  })

  test('parâmetro errado dá mensagem que diz o que fazer', () => {
    const casos = [
      [{ camera: 'zoom' }, /camera "zoom" does not exist: use "orbita", "dolly"/],
      [{ leiaute: 'centro' }, /leiaute "centro" does not exist: use "right-column", "left-column", "dividido"/],
      [{ transicao: 'fade' }, /transicao "fade" does not exist: use "mascara", "push", "corte"/],
      [{ ritmo: 'lento' }, /ritmo "lento" does not exist: use "calmo", "medio", "rapido"/],
      [{ formatos: ['18x9'] }, /format "18x9" does not exist: use 16x9, 19x9, 21x9, 9x16, 1x1/],
      [{ zoomLeitura: 5 }, /zoomLeitura 5: between 1\.2 and 3/],
      [{ marca: { cores: { fundo: 'red' } } }, /marca\.cores\.fundo "red" is not a #RRGGBB color/],
      [{ marca: { corpo: { texto: 18 } } }, /marca\.corpo\.texto 18: between 28 and 200 px/],
      [{ fundo: { tipo: 'foto' } }, /fundo\.tipo "foto" does not exist: use "liso", "simbolo"/],
      [{ textos: { titulo: 'um dois três quatro cinco seis sete oito nove dez onze' } }, /textos\.titulo has 11 words: at most 10/],
      [{ captura: { pagina: 'p.html', jornada: [{ rola: 300 }] } }, /needs at least one \{ "passo": "step sentence" \}/],
      [{ captura: { pagina: 'p.html', jornada: [{ passo: 'A' }, { clica: '#x' }] } }, /captura\.jornada\[1\] .*each item is one of/],
      [{ captura: { jornada: [{ passo: 'A' }] } }, /captura\.pagina .* or captura\.url/],
      [{ nome: 'meu vídeo' }, /nome "meu vídeo": only letters, numbers/],
    ]
    for (const [extra, re] of casos) {
      const { erros } = conferirMin(extra)
      assert.ok(erros.some((e) => re.test(e)), `${JSON.stringify(extra)} → ${JSON.stringify(erros)}`)
    }
    const semLogo = conferir({ captura: minimo().captura }, tmp)
    assert.ok(semLogo.erros.some((e) => /fecho\.logo: the logo PNG \(the closing is only the logo/.test(e)), JSON.stringify(semLogo.erros))
    const naoAchou = conferir(minimo({ fecho: { logo: 'nao-existe.png' } }), tmp)
    assert.ok(naoAchou.erros.some((e) => /fecho\.logo: not found: .*nao-existe\.png/.test(e)))
  })
})

// uma gravação sintética no formato do gravador da skill (events.json, frames.json, frames/)
const EVENTOS = {
  id: 'teste', versao: 'phone', aparelho: { nome: 'phone', viewport: { width: 390, height: 844 }, dsf: 1, toque: true }, duracao: 4.6,
  eventos: [
    { t: 0.03, tipo: 'passo', n: 1, legenda: 'Role a lista' },
    { t: 0.5, t1: 1.3, tipo: 'rola', dy: 300 },
    { t: 2.0, tipo: 'passo', n: 2, legenda: 'Toque no botão' },
    { t: 2.1, t1: 2.5, tipo: 'move', de: [195, 600], para: [195, 420] },
    { t: 2.8, tipo: 'toque', alvo: 'button', ret: { x: 120, y: 400, w: 150, h: 44 }, ponto: [195, 422] },
    { t: 3.4, tipo: 'sucesso', ret: { x: 20, y: 300, w: 350, h: 200 } },
  ],
}

describe('linha do tempo', () => {
  test('sai da gravação: abertura, passos, focos da câmera espaçados, o toque e o fecho', () => {
    const { cfg } = conferirMin()
    const LN = linhaDoTempo(cfg, EVENTOS)
    const R = RITMOS.medio
    assert.equal(LN.A, R.abertura)
    assert.equal(LN.passos.length, 2)
    assert.equal(LN.passos[0].frase, 'Role a lista')
    assert.ok(LN.passos[1].v0 > LN.passos[0].v0)
    assert.ok(Math.abs(LN.recFim - (R.abertura + (3.4 + 1.2 - 0) / R.vel)) < 0.06)
    assert.ok(Math.abs(LN.F - (LN.recFim + R.recuo + R.orbita)) < 1e-6)
    assert.ok(Math.abs(LN.dur - (LN.F + R.troca + cfg.fecho.dur)) < 1e-3)
    for (let i = 1; i < LN.focos.length; i++) assert.ok(LN.focos[i].v - LN.focos[i - 1].v >= 0.449, 'focos colados')
    assert.equal(LN.toques.length, 1)
    assert.ok(LN.focos.some((f) => f.tipo === 'toque' && f.v < LN.toques[0].v), 'a câmera chega antes do toque')
    // a frase do passo pode ser trocada no JSON sem regravar
    const { cfg: c2 } = conferirMin({ textos: { passos: { 2: 'Toque em Enviar' } } })
    assert.equal(linhaDoTempo(c2, EVENTOS).passos[1].frase, 'Toque em Enviar')
    const { folha } = folhaDaTrilha(cfg, LN)
    assert.equal(folha.duracao, LN.dur)
    assert.ok(folha.marcos.some((m) => m.efeito === 'toque'))
    assert.ok(folha.marcos.some((m) => m.som === 'acento' && Math.abs(m.t - (LN.F + LN.troca)) < 1e-3), 'a trilha resolve no logo')
  })
})

describe('compõe e passa na checagem', { skip: !temPlaywright && 'sem Playwright' }, () => {
  let obras
  before(async () => {
    const { abrirNavegador } = require('../scripts/playwright.cjs')
    const G = path.join(tmp, 'captura', 'output', 'phone')
    fs.mkdirSync(path.join(G, 'frames'), { recursive: true })
    const { browser } = await abrirNavegador(tmp)
    const p = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 })
    await p.goto(pathToFileURL(PAGINA).href)
    const quadros = []
    for (const [i, y] of [0, 150, 300].entries()) {
      await p.evaluate((y) => window.scrollTo({ top: y, behavior: 'instant' }), y)
      const nome = String(i + 1).padStart(5, '0') + '.jpg'
      await p.screenshot({ path: path.join(G, 'frames', nome), type: 'jpeg', quality: 70 })
      quadros.push([nome, i * 0.7])
    }
    await browser.close()
    fs.writeFileSync(path.join(G, 'frames.json'), JSON.stringify(quadros))
    fs.writeFileSync(path.join(G, 'events.json'), JSON.stringify(EVENTOS))
    // dois jeitos: o mínimo (todo o padrão: órbita, coluna à direita, máscara) e o outro extremo (dolly, dividido, push,
    // cartão de painel, símbolo de fundo, título e rótulo)
    const jsons = {
      padrao: minimo({ nome: 'padrao', textos: { titulo: 'Título do teste' } }),
      outro: minimo({ nome: 'outro', camera: 'dolly', leiaute: 'dividido', transicao: 'push', ritmo: 'calmo',
        textos: { rotulo: 'Rótulo · teste', titulo: 'O teste no celular' }, marca: { cores: { painel: '#DDDDDD' } }, fundo: { tipo: 'simbolo', imagem: LOGO, tamanho: 600 } }),
    }
    obras = {}
    for (const [k, j] of Object.entries(jsons)) {
      fs.writeFileSync(path.join(tmp, `${k}.json`), JSON.stringify(j))
      const r = spawnSync(process.execPath, [path.join(MOLDE, 'render.mjs'), path.join(tmp, `${k}.json`), '--out', path.join(tmp, 'output'), '--capture', path.join(tmp, 'captura'), '--assemble-only'], { encoding: 'utf8' })
      assert.equal(r.status, 0, r.stderr + r.stdout)
      obras[k] = path.join(tmp, 'output', `.work-${j.nome}`)
    }
  })

  test('parâmetro errado: o renderizar para antes de montar e diz o que fazer', () => {
    fs.writeFileSync(path.join(tmp, 'errado.json'), JSON.stringify(minimo({ camera: 'zoom' })))
    const r = spawnSync(process.execPath, [path.join(MOLDE, 'render.mjs'), path.join(tmp, 'errado.json'), '--out', path.join(tmp, 'saida-errada'), '--assemble-only'], { encoding: 'utf8' })
    assert.equal(r.status, 1)
    assert.match(r.stderr, /✗ camera "zoom" does not exist: use "orbita", "dolly"/)
    assert.equal(fs.existsSync(path.join(tmp, 'saida-errada')), false, 'nada é montado com parâmetro errado')
  })

  for (const fmt of ['16x9', '19x9', '21x9', '9x16', '1x1']) {
    test(`${fmt}: sem texto sobre a tela, sem colisão, na área segura, e o fecho é só o logo`, async () => {
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
            // o fecho: no fim, todo ponto do quadro é do fecho; nele não há texto; o logo está inteiro e centrado
            const t = VIDEO.duracao - 0.2
            await renderAt(t)
            const logo = document.querySelector('[data-colisao="logo"]'), fecho = logo.parentElement
            const fora = []
            for (let gy = 0; gy < 5; gy++) for (let gx = 0; gx < 9; gx++) {
              const x = ((gx + 0.5) / 9) * W, y = ((gy + 0.5) / 5) * H, e = document.elementFromPoint(x, y)
              if (!e || !fecho.contains(e)) fora.push(`${Math.round(x)},${Math.round(y)} ${e ? e.tagName + '.' + e.className : 'nada'}`)
            }
            const rl = logo.getBoundingClientRect()
            return { probs, fora, textoNoFecho: fecho.textContent.trim(), opLogo: _opacEfetiva(logo), centro: [rl.x + rl.width / 2 - CX, rl.y + rl.height / 2 - CY], textosMarcados: [...document.querySelectorAll('[data-colisao="texto"]')].filter((e) => _opacEfetiva(e) > 0.05).map((e) => e.textContent) }
          })
          await p.close()
          assert.deepEqual(erros, [], `${k} ${fmt}: erro na página`)
          assert.deepEqual(r.probs, [], `${k} ${fmt}: a checagem achou problema`)
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
