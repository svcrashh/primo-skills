// node --test tests/kinetic-typography.test.mjs   (sem rede; a composição precisa do Playwright)
// O molde kinetic-typography, sem render completo:
//   · os parâmetros padrão funcionam (um JSON mínimo valida, ganha os padrões e a linha do tempo fica na grade da batida);
//   · parâmetro errado dá mensagem que diz o que fazer;
//   · a obra compõe no navegador (exemplos e o mínimo) em 16:9, 9:16 e 1:1, sem erro no console e passando na checagem
//     do motor (colisão, área segura e texto sobre imagem, com VIDEO.texto = "fora-da-imagem");
//   · o fecho é só o logo: nenhum texto, uma imagem só, a do logo.
import { test, describe, before, after } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import { validar, normalizar, linhaDoTempo, trilhaDe, montar, Falha } from '../templates/kinetic-typography/assemble.mjs'

const require = createRequire(import.meta.url)
const SKILL = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const MOLDE = path.join(SKILL, 'templates', 'kinetic-typography')
const LOGO = path.join(SKILL, 'assets', 'example', 'logo-placeholder.png')
const temPlaywright = require('../scripts/playwright.cjs').candidatos().length > 0
const MINIMO = { frases: [{ linhas: ['4 novidades'] }, { linhas: ['Site', 'e aplicativo móvel'] }], cores: { fundo: '#F5F5F5', texto: '#1D1D1D' }, fecho: { logo: LOGO, fundo: '#F5F5F5' } }
const com = (troca) => ({ ...JSON.parse(JSON.stringify(MINIMO)), ...troca })
// na batida, a menos do arredondamento de 1 ms dos tempos
const naBatida = (t, bpm) => { const b = 60 / bpm; return Math.abs(t - Math.round(t / b) * b) < 0.002 }

let base
before(() => { base = fs.mkdtempSync(path.join(os.tmpdir(), 'tipografia-')) })
after(() => fs.rmSync(base, { recursive: true, force: true }))

describe('os parâmetros padrão', () => {
  test('um JSON mínimo valida e ganha os padrões', () => {
    assert.deepEqual(validar(MINIMO), [])
    const P = normalizar(MINIMO)
    assert.deepEqual([P.bpm, P.ritmo, P.transicao, P.leiaute, P.camera, P.formatos], [120, 'medio', 'cut-on-beat', 'full-screen', 'estatica', ['16x9']])
    assert.deepEqual([P.fonte.familia, P.fonte.peso, P.fonte.minimo], ['Inter', 700, 64])
    assert.deepEqual(P.frases[1].linhas.map((l) => l.t), ['Site', 'e aplicativo móvel'])
  })
  test('a linha do tempo fica na grade da batida, o quadro 0 já tem texto e o logo fica parado ~2 s', () => {
    for (const P of [MINIMO, com({ bpm: 128, ritmo: 'rapido', transicao: 'mascara' }), com({ bpm: 92, ritmo: 'calmo', transicao: 'push' })]) {
      const L = linhaDoTempo(P)
      assert.ok(L.frases[0].entradas[0] <= 0, 'a 1ª linha já está entrando no quadro 0')
      for (const f of L.frases) { assert.ok(naBatida(f.t0, L.bpm) && naBatida(f.tSai, L.bpm), `frase ${f.i + 1} fora da batida`) }
      assert.ok(naBatida(L.fecho.tLogo, L.bpm), 'o logo entra numa batida')
      const parado = L.duracao - (L.fecho.tLogo + 0.45)
      assert.ok(parado >= 1.8 && parado <= 2.5, `o logo fica parado ${parado.toFixed(2)} s`)
      const { folha, ident } = trilhaDe(P, L, 'teste')
      assert.deepEqual(ident.bpm, [P.bpm ?? 120, P.bpm ?? 120], 'a trilha usa o BPM do vídeo')
      assert.ok(folha.marcos.some((m) => m.t === L.fecho.tLogo && m.opcional === false), 'o logo é o acento obrigatório da trilha')
      folha.secoes.slice(1).forEach((s, k) => assert.equal(s.de, folha.secoes[k].ate, 'seções emendadas'))
    }
  })
})

describe('parâmetro errado dá mensagem útil', () => {
  const erro = (P, re) => { const e = validar(P); assert.ok(e.some((x) => re.test(x)), `esperava ${re} em:\n${e.join('\n')}`) }
  test('valores fora da lista dizem quais existem', () => {
    erro(com({ transicao: 'girar' }), /transicao "girar" does not exist: use cut-on-beat \| push \| mascara \| whip/)
    erro(com({ ritmo: 'lento' }), /ritmo "lento" does not exist: use calmo \| medio \| rapido/)
    erro(com({ bpm: 300 }), /bpm 300: a number from 60 to 180/)
    erro(com({ formatos: ['18x9'] }), /formato "18x9" does not exist/)
  })
  test('o texto é informativo e curto: exclamação e linha longa são recusadas', () => {
    erro(com({ frases: [{ linhas: ['Transforme sua marca agora!'] }] }), /no exclamation mark.*never a catchphrase/)
    erro(com({ frases: [{ linhas: ['um dois três quatro cinco seis sete oito nove'] }] }), /up to 7 words per line \(has 9\)/)
    erro(com({ frases: [{ linhas: ['Site', 'e aplicativo móvel', 'no navegador e no celular também'], reorganiza: 'linha' }] }), /join into a single line, with \d+ words/)
    erro(com({ frases: [] }), /frases: 1 to 8/)
  })
  test('o fecho é só o logo, e o logo tem de existir', () => {
    erro(com({ fecho: { logo: LOGO, fundo: '#F5F5F5', frase: 'Tudo isso já está no ar.' } }), /fecho: remove "frase". The closing is the logo only/)
    erro(com({ fecho: { logo: 'nao-existe.png', fundo: '#F5F5F5' } }), /fecho.logo: could not find .*nao-existe\.png/)
    erro(com({ fecho: { logo: LOGO } }), /fecho.fundo: the color behind the logo/)
  })
  test('com "pares", cor fora dos pares aprovados é erro, e o par AA18 pede negrito', () => {
    const pares = [['#F5F5F5', '#1D1D1D', 'AAA'], ['#848484', '#F5F5F5', 'AA18']]
    erro(com({ pares, cores: { fundo: '#F5F5F5', texto: '#979797' } }), /#979797 on the background #F5F5F5 is not an approved pair/)
    erro(com({ pares, cores: { fundo: '#848484', texto: '#F5F5F5' }, fonte: { peso: 500 } }), /is AA18 \(large bold titles only\): use "peso": 700/)
    assert.deepEqual(validar(com({ pares, cores: { fundo: '#848484', texto: '#F5F5F5' } })), [])
  })
  test('formas: tipo que não existe e imagem sem arquivo', () => {
    erro(com({ formas: [{ tipo: 'estrela', cor: '#848484' }] }), /formas\[0\]\.tipo "estrela" does not exist: use circulo \| pilula \| losango \| imagem/)
    erro(com({ formas: [{ tipo: 'imagem', arquivo: 'sumiu.png' }] }), /formas\[0\]\.arquivo: could not find/)
  })
  test('o montar recusa (Falha) com a lista toda, antes de escrever a obra', () => {
    const obra = path.join(base, 'recusada')
    assert.throws(() => montar(com({ transicao: 'girar', ritmo: 'lento' }), obra, { baixarFontes: false }), (e) => e instanceof Falha && /transicao/.test(e.message) && /ritmo/.test(e.message))
    assert.equal(fs.existsSync(path.join(obra, 'index.html')), false)
  })
})

describe('compõe no navegador', { skip: !temPlaywright && 'sem Playwright' }, () => {
  const { abrirNavegador } = require('../scripts/playwright.cjs')
  const TAM = { '16x9': [1920, 1080], '9x16': [1080, 1920], '1x1': [1080, 1080] }
  const casos = [
    ['mínimo', MINIMO, SKILL],
    ['coluna-esquerda', JSON.parse(fs.readFileSync(path.join(MOLDE, 'example-left-column.json'), 'utf8')), MOLDE],
    ['tela-cheia', JSON.parse(fs.readFileSync(path.join(MOLDE, 'example.json'), 'utf8')), MOLDE],
  ]
  let browser
  before(async () => { ({ browser } = await abrirNavegador(SKILL)) })
  after(async () => { await browser?.close() })

  for (const [nome, P, raiz] of casos) {
    test(`${nome}: 16:9, 9:16 e 1:1 sem erro, sem colisão, dentro da área segura e sem texto sobre imagem; fecho só com o logo`, async () => {
      const obra = path.join(base, nome)
      fs.mkdirSync(obra, { recursive: true })
      assert.equal(spawnSync(process.execPath, [path.join(SKILL, 'scripts', 'example-fonts.mjs'), obra]).status, 0)
      const { linha } = montar(P, obra, { base: raiz, baixarFontes: false })
      for (const f of ['16x9', '9x16', '1x1']) {
        const pg = await browser.newPage({ viewport: { width: TAM[f][0], height: TAM[f][1] }, deviceScaleFactor: 1 })
        const erros = []
        pg.on('pageerror', (e) => erros.push(e.message))
        pg.on('console', (m) => { if (m.type() === 'error') erros.push(m.text()) })
        await pg.goto('file://' + path.join(obra, 'index.html') + `?f=${f}`)
        await pg.waitForFunction('window.__ready === true', null, { timeout: 60000 })
        assert.equal(await pg.evaluate('VIDEO.texto'), 'fora-da-imagem')
        const tempos = []
        for (let t = 0; t < linha.duracao; t += 0.2) tempos.push(+t.toFixed(2))
        const achados = await pg.evaluate(async (ts) => { const out = []; for (const t of ts) out.push(...(await checarQuadro(t)).map((x) => x.msg)); return out }, tempos)
        assert.deepEqual(achados, [], `${f}: a checagem do motor achou problema`)
        // o fecho, com o logo já parado: nenhum texto visível, uma imagem só, a do logo
        for (const t of [linha.fecho.tLogo + 0.6, linha.duracao - 0.05]) {
          const v = await pg.evaluate(async (t) => {
            await renderAt(t)
            const vis = (e) => { for (let x = e; x && x !== document.body; x = x.parentElement) { const cs = getComputedStyle(x); if (cs.display === 'none' || cs.visibility === 'hidden' || parseFloat(cs.opacity) < 0.05) return false } return true }
            const textos = [...stage.querySelectorAll('*')].filter((e) => [...e.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim()) && vis(e)).map((e) => e.textContent.trim())
            const imgs = [...stage.querySelectorAll('img')].filter(vis).map((i) => decodeURIComponent(i.src.split('/').pop()))
            return { textos, imgs }
          }, t)
          assert.deepEqual(v.textos, [], `${f} t=${t}: o fecho tem texto`)
          assert.deepEqual(v.imgs, [path.basename(P.fecho.logo)], `${f} t=${t}: o fecho mostra só o logo`)
        }
        assert.deepEqual(erros, [], `${f}: erro no console`)
        await pg.close()
      }
    })
  }
})
