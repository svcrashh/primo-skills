// node --test tests/photo-mosaic.test.mjs   (sem rede; a composição precisa do Playwright; logo e fotos são os de assets/example)
// O molde photo-mosaic, sem render completo:
//   · os parâmetros padrão funcionam (um JSON mínimo valida, ganha os padrões, a grade padrão encaixa as fotos e a linha do
//     tempo fica na grade da batida);
//   · parâmetro errado dá mensagem que diz o que fazer (grade com buraco, foto que não existe, rótulo de slogan…);
//   · a obra compõe no navegador (exemplos e o mínimo) em 16:9, 9:16 e 1:1, sem erro no console e passando na checagem
//     do motor, com as fotos marcadas e VIDEO.texto = "fora-da-imagem": nenhum texto cruza uma foto;
//   · o fecho é só o logo: nenhum texto, uma imagem só, a do logo.
import { test, describe, before, after } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import { validar, normalizar, linhaDoTempo, trilhaDe, montar, encaixar, gradePadrao, Falha } from '../templates/photo-mosaic/assemble.mjs'

const require = createRequire(import.meta.url)
const SKILL = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const MOLDE = path.join(SKILL, 'templates', 'photo-mosaic')
const LOGO = path.join(SKILL, 'assets', 'example', 'logo-placeholder.png')
const FOTO = (n) => path.join(SKILL, 'assets', 'example', 'photos', n)
const temPlaywright = require('../scripts/playwright.cjs').candidatos().length > 0
const FOTOS = ['photo-placeholder-01.jpg', 'photo-placeholder-02.jpg', 'photo-placeholder-03.jpg', 'photo-placeholder-04.jpg', 'photo-placeholder-05.jpg'].map(FOTO)
const MINIMO = {
  fotos: FOTOS, cores: { fundo: '#F5F5F5', rotulo: '#1D1D1D' },
  etapas: [{ tipo: 'mosaico', rotulo: '5 fotos da marca' }, { tipo: 'destaque', foto: 2, rotulo: 'A terceira' }],
  fecho: { logo: LOGO, fundo: '#F5F5F5' },
}
const com = (troca) => ({ ...JSON.parse(JSON.stringify(MINIMO)), ...troca })
// na batida, a menos do arredondamento de 1 ms dos tempos
const naBatida = (t, bpm) => { const b = 60 / bpm; return Math.abs(t - Math.round(t / b) * b) < 0.002 }

let base
before(() => { base = fs.mkdtempSync(path.join(os.tmpdir(), 'mosaico-')) })
after(() => fs.rmSync(base, { recursive: true, force: true }))

describe('o encaixe da grade', () => {
  test('as grandes ocupam 2×2 na 1ª casa livre, e a grade transposta (em pé) também encaixa', () => {
    const e = encaixar(5, 2, [1, 0, 2, 3, 4, 5, 6], [1])
    assert.deepEqual([e.pos[1], e.pos[0], e.pos[6], e.buracos], [{ x: 0, y: 0, s: 2 }, { x: 2, y: 0, s: 1 }, { x: 4, y: 1, s: 1 }, 0])
    assert.equal(encaixar(2, 5, [1, 0, 2, 3, 4, 5, 6], [1]).buracos, 0)
    assert.match(encaixar(3, 1, [0, 1], [0]).erro, /photo 0 \(large\) did not fit in the 3×1 grid/)
  })
  test('a grade padrão é deitada e sem buraco quando dá', () => {
    for (const [n, g] of [[5, 0], [6, 0], [7, 1], [8, 0], [10, 2], [12, 0]]) {
      const [c, r] = gradePadrao(n, g)
      assert.ok(c >= r, `${n} fotos: ${c}×${r} não é deitada`)
      assert.ok(c * r >= n + 3 * g, `${n} fotos e ${g} grande(s) não cabem em ${c}×${r}`)
    }
    assert.deepEqual(gradePadrao(6, 0), [3, 2])
  })
})

describe('os parâmetros padrão', () => {
  test('um JSON mínimo valida e ganha os padrões', () => {
    assert.deepEqual(validar(MINIMO), [])
    const P = normalizar(MINIMO)
    assert.deepEqual([P.bpm, P.ritmo, P.leiaute, P.camera, P.formatos, P.raio, P.vao, P.fonte.familia], [120, 'medio', 'mosaico', 'estatica', ['16x9'], 40, 18, 'Inter'])
    assert.deepEqual(P.fotos[0].foco, [50, 50])
  })
  test('a linha do tempo fica na grade da batida e o logo fica parado ~2 s', () => {
    for (const P of [MINIMO, com({ bpm: 96, ritmo: 'calmo' }), com({ bpm: 128, ritmo: 'rapido', leiaute: 'dividido', camera: 'travelling' })]) {
      const L = linhaDoTempo(P)
      for (const e of L.etapas) assert.ok(naBatida(e.t0, L.bpm) && naBatida(e.t1, L.bpm), `etapa ${e.k + 1} fora da batida`)
      assert.ok(naBatida(L.fecho.tLogo, L.bpm), 'o logo entra numa batida')
      assert.ok(L.fecho.tSai >= L.fecho.t0 && L.fecho.tSai < L.fecho.tLogo, 'as fotos saem logo antes do logo')
      const parado = L.duracao - (L.fecho.tLogo + 0.45)
      assert.ok(parado >= 1.8 && parado <= 2.5, `o logo fica parado ${parado.toFixed(2)} s`)
      const m = L.etapas[0]
      assert.equal(Object.keys(m.deitada.pos).length, FOTOS.length, 'o mosaico padrão encaixa todas as fotos')
      const { folha, ident } = trilhaDe(P, L, 'teste')
      assert.deepEqual(ident.bpm, [P.bpm ?? 120, P.bpm ?? 120], 'a trilha usa o BPM do vídeo')
      assert.ok(folha.marcos.some((x) => x.t === L.fecho.tLogo && x.opcional === false), 'o logo é o acento obrigatório da trilha')
    }
  })
})

describe('parâmetro errado dá mensagem útil', () => {
  const erro = (P, re) => { const e = validar(P); assert.ok(e.some((x) => re.test(x)), `esperava ${re} em:\n${e.join('\n')}`) }
  test('valores fora da lista dizem quais existem', () => {
    erro(com({ leiaute: 'grade' }), /leiaute "grade" does not exist: use mosaico \| dividido/)
    erro(com({ camera: 'drone' }), /camera "drone" does not exist: use estatica \| travelling \| guided-zoom/)
    erro(com({ etapas: [{ tipo: 'carrossel', rotulo: 'x' }] }), /etapas\[0\]\.tipo "carrossel" does not exist: use mosaico \| destaque/)
  })
  test('fotos: quantidade, arquivo e foco', () => {
    erro(com({ fotos: FOTOS.slice(0, 2) }), /fotos: 3 to 12 \(has 2\)/)
    erro(com({ fotos: [...FOTOS, 'banco-de-imagem.jpg'] }), /fotos\[5\]: could not find .*banco-de-imagem\.jpg/)
    erro(com({ fotos: [...FOTOS.slice(0, 4), { arquivo: FOTOS[4], foco: [120, 50] }] }), /fotos\[4\]\.foco: \[x, y\] in %/)
  })
  test('a grade: buraco, grande que não cabe, ordem incompleta, destaque sem foto', () => {
    erro(com({ etapas: [{ tipo: 'mosaico', grade: [4, 2], rotulo: 'x' }] }), /grade 4×2: has 8 cells and the photos take 5 \(each large one counts as 4\): leaves 3 hole/)
    erro(com({ etapas: [{ tipo: 'mosaico', grade: [8, 1], grandes: [0], rotulo: 'x' }] }), /photo 0 \(large\) did not fit in the 8×1 grid; change the "ordem", the "grandes" or the "grade"/)
    erro(com({ etapas: [{ tipo: 'mosaico', ordem: [0, 1, 2], rotulo: 'x' }] }), /ordem: all the photos, each one once/)
    erro(com({ etapas: [{ tipo: 'destaque', rotulo: 'x' }] }), /etapas\[0\]\.foto: the index of the highlighted photo, 0 to 4/)
  })
  test('o rótulo é informativo e curto', () => {
    erro(com({ etapas: [{ tipo: 'mosaico', rotulo: 'Uma frase de efeito aqui!' }] }), /no exclamation mark.*never a catchphrase/)
    erro(com({ etapas: [{ tipo: 'mosaico', rotulo: 'um dois três quatro cinco seis sete oito' }] }), /up to 7 words \(has 8\)/)
    erro(com({ etapas: [{ tipo: 'mosaico' }] }), /etapas\[0\]\.rotulo: the band text/)
  })
  test('com "pares", rótulo fora dos pares é erro, e AA18 não serve para rótulo', () => {
    const pares = [['#F5F5F5', '#1D1D1D', 'AAA'], ['#F5F5F5', '#848484', 'AA18']]
    erro(com({ pares, cores: { fundo: '#F5F5F5', rotulo: '#979797' } }), /#979797 on the background #F5F5F5 is not an approved pair/)
    erro(com({ pares, cores: { fundo: '#F5F5F5', rotulo: '#848484' } }), /is AA18.*the label is reading text/)
    assert.deepEqual(validar(com({ pares })), [])
  })
  test('o fecho é só o logo, e o logo tem de existir', () => {
    erro(com({ fecho: { logo: LOGO, fundo: '#F5F5F5', bordao: 'Uma frase de efeito' } }), /fecho: remove "bordao". The closing is the logo only/)
    erro(com({ fecho: { logo: 'sumiu.png', fundo: '#F5F5F5' } }), /fecho.logo: could not find/)
  })
  test('o montar recusa (Falha) com a lista toda, antes de escrever a obra', () => {
    const obra = path.join(base, 'recusada')
    assert.throws(() => montar(com({ leiaute: 'grade', camera: 'drone' }), obra, { baixarFontes: false }), (e) => e instanceof Falha && /leiaute/.test(e.message) && /camera/.test(e.message))
    assert.equal(fs.existsSync(path.join(obra, 'index.html')), false)
  })
})

describe('compõe no navegador', { skip: !temPlaywright && 'sem Playwright' }, () => {
  const { abrirNavegador } = require('../scripts/playwright.cjs')
  const TAM = { '16x9': [1920, 1080], '9x16': [1080, 1920], '1x1': [1080, 1080] }
  const casos = [
    ['mínimo', MINIMO, SKILL],
    ['mínimo dividido, travelling', com({ leiaute: 'dividido', camera: 'travelling', cores: { fundo: '#E8E8E8', painel: '#383838', rotulo: '#D6D6D6' } }), SKILL],
    ['exemplo (mosaico, câmera estática)', JSON.parse(fs.readFileSync(path.join(MOLDE, 'example.json'), 'utf8')), MOLDE],
    ['exemplo dividido (travelling)', JSON.parse(fs.readFileSync(path.join(MOLDE, 'example-split.json'), 'utf8')), MOLDE],
  ]
  let browser
  before(async () => { ({ browser } = await abrirNavegador(SKILL)) })
  after(async () => { await browser?.close() })

  for (const [nome, P, raiz] of casos) {
    test(`${nome}: 16:9, 9:16 e 1:1 sem erro, sem colisão, dentro da área segura e sem texto sobre foto; fecho só com o logo`, async () => {
      const obra = path.join(base, nome.replace(/\W+/g, '-'))
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
        assert.equal(await pg.evaluate('stage.querySelectorAll("[data-imagem]").length'), P.fotos.length, 'cada foto marcada para a checagem')
        const tempos = []
        for (let t = 0; t < linha.duracao; t += 0.2) tempos.push(+t.toFixed(2))
        const achados = await pg.evaluate(async (ts) => { const out = []; for (const t of ts) out.push(...(await checarQuadro(t)).map((x) => x.msg)); return out }, tempos)
        assert.deepEqual(achados, [], `${f}: a checagem do motor achou problema`)
        // com o mosaico inteiro na tela, o texto marcado de fato não cruza nenhuma foto (a checagem mede isto)
        const meio = (linha.etapas[0].t0 + linha.etapas[0].t1) / 2
        const cruza = await pg.evaluate(async (t) => {
          await renderAt(t)
          // o que se vê de cada foto (recortada pela janela) e de cada texto visível, como a checagem do motor mede
          const fotos = [...stage.querySelectorAll('[data-imagem]')].map(_retImagem).filter(Boolean)
          const textos = [...stage.querySelectorAll('[data-colisao="texto"]')].filter((e) => _opacEfetiva(e) >= 0.5).map(_retAlvo).filter(Boolean)
          if (fotos.length < 3 || !textos.length) return 'sem fotos ou sem texto na tela'
          return textos.some((a) => fotos.some((b) => a.x0 < b.x1 && a.x1 > b.x0 && a.y0 < b.y1 && a.y1 > b.y0))
        }, meio)
        assert.equal(cruza, false, `${f}: texto sobre foto`)
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
