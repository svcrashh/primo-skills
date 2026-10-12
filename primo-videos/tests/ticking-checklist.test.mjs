// node --test tests/ticking-checklist.test.mjs   (sem rede; a parte que compõe precisa do Playwright com Chromium, sem
// ele ela pula; a marca dos exemplos são os marcadores de assets/example). Compõe a cena no navegador, sem render de vídeo.
// O que este arquivo trava, no molde ticking-checklist:
//   · os exemplos de formato (o de colunas e o de lista) e uma outra marca montada aqui planejam sem erro, de 6 a 15 s, cada item com a sua marca e o seu som,
//     e o fecho por último;
//   · parâmetro errado dá mensagem que diz o que fazer (no plano e no render.mjs, antes de criar pasta);
//   · a cena compõe em 16:9, 9:16, 1:1, 19:9 e 21:9 e passa na checagem do motor (colisão, área segura, texto sobre imagem);
//   · antes do fecho, todo item está na tela, opaco e dentro da área segura, e o contador chegou ao total;
//   · o fecho é só o logo: nenhum texto visível, uma imagem só, a do logo, centrada;
//   · o molde não põe imagem no conteúdo (nada a cruzar), e a checagem "fora-da-imagem" fica ligada para quem puser.
import { test, describe, before, after } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import zlib from 'node:zlib'
import { spawnSync } from 'node:child_process'
import { createRequire } from 'node:module'
import { fileURLToPath, pathToFileURL } from 'node:url'

const require = createRequire(import.meta.url)
const SKILL = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const MOLDE = path.join(SKILL, 'templates', 'ticking-checklist')
const { CHECKLIST, validarChecklist, planejarChecklist } = require(path.join(MOLDE, 'scene', 'plan.js'))
// uma outra marca, escura, com cores e fonte que não são as dos exemplos (o logo é um PNG gerado no teste): prova que
// nada da marca está no código, e usa o que os exemplos não usam: um ✕ no meio da lista (a marca do item) e o push.
const NEUTRO = {
  nome: 'marca-checklist', formatos: ['16x9', '9x16'],
  estrutura: 'lista', ritmo: 'medio', camera: 'parada', transicao: 'push',
  lista: { titulo: 'Antes de publicar', itens: ['Texto revisado', 'Imagens em alta', { t: 'Senha à mostra', marca: 'nao' }, 'Link conferido'] },
  contador: { rotulo: 'prontos' },
  marca: {
    nome: 'Marca', logo: 'logo.png',
    cores: {
      fundo: '#14213D', texto: '#F4F1EA', contador: '#FCA311', cartao: '#22335A', sobreCartao: '#F4F1EA',
      ok: '#FCA311', sobreOk: '#14213D', nao: '#F4F1EA', sobreNao: '#14213D', vazio: '#14213D', destaque: '#1B2A4A',
    },
    fontes: { texto: 'Rubik' },
  },
  fecho: { fundo: '#14213D' },
  trilha: { semente: 1202, identidade: { genero: 'house', bpm: [118, 122] } },
}
const ler = (f) => (f === 'neutro' ? structuredClone(NEUTRO) : JSON.parse(fs.readFileSync(path.join(MOLDE, f), 'utf8')))
const EXEMPLOS = ['example-columns.json', 'example.json', 'neutro']

// PNG de cor chapada (o logo da marca neutra, sem depender de arquivo de fora)
function png(w, h, rgb) {
  const T = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0 })
  const crc = (b) => { let c = 0xffffffff; for (const x of b) c = T[(c ^ x) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0 }
  const bloco = (tipo, dados) => { const n = Buffer.alloc(4); n.writeUInt32BE(dados.length); const td = Buffer.concat([Buffer.from(tipo), dados]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([n, td, c]) }
  const ih = Buffer.alloc(13); ih.writeUInt32BE(w, 0); ih.writeUInt32BE(h, 4); ih[8] = 8; ih[9] = 2
  const linha = Buffer.concat([Buffer.from([0]), Buffer.from(Array.from({ length: w * 3 }, (_, i) => rgb[i % 3]))])
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), bloco('IHDR', ih), bloco('IDAT', zlib.deflateSync(Buffer.concat(Array(h).fill(linha)))), bloco('IEND', Buffer.alloc(0))])
}
const temPlaywright = require('../scripts/playwright.cjs').candidatos().length > 0
const FORMATOS = { '16x9': [1920, 1080], '9x16': [1080, 1920], '1x1': [1080, 1080], '19x9': [2280, 1080], '21x9': [2520, 1080] }

describe('o plano (sem navegador)', () => {
  test('os exemplos planejam: de 6 a 15 s, um item de cada vez, a marca e o som de cada um, e o fecho por último', () => {
    for (const f of EXEMPLOS) {
      const P = ler(f), p = planejarChecklist(P)
      assert.ok(p.dur >= 6 && p.dur <= 15, `${f}: ${p.dur} s`)
      const n = p.grupos.reduce((a, g) => a + g.itens.length, 0)
      assert.equal(p.marcas.length, n, `${f}: um tempo por item`)
      p.marcas.forEach((m, i) => { if (i) assert.ok(m.t > p.marcas[i - 1].t, `${f}: item ${i + 1} fora de ordem`) })
      assert.equal(p.sons.filter((s) => s.som === 'blip').length, p.marcas.filter((m) => m.marca === 'ok').length, `${f}: um "blip" por ✓`)
      assert.equal(p.sons.filter((s) => s.som === 'toque').length, p.marcas.filter((m) => m.marca === 'nao').length, `${f}: um toque por ✕`)
      assert.ok(p.tSai > p.marcas.at(-1).t + 0.4, `${f}: o fecho começa antes da última marca terminar`)
      assert.ok(p.dur - p.tLogo >= 1.6, `${f}: o logo fica só ${(p.dur - p.tLogo).toFixed(2)} s`)
      p.secoes.forEach((s, i) => { if (i) assert.ok(Math.abs(s.de - p.secoes[i - 1].ate) < 1e-9, `${f}: seção ${s.nome} não emenda`) })
    }
    const v = planejarChecklist(ler('example-columns.json'))
    assert.deepEqual(v.marcas.map((m) => m.marca), ['ok', 'ok', 'ok', 'ok', 'nao', 'nao', 'nao'])
    const neutro = planejarChecklist(ler('neutro'))
    assert.equal(neutro.marcas[2].marca, 'nao', 'a marca do item vence a da lista')
  })
  test('os parâmetros padrão: só marca e uma lista já formam um vídeo (lista, médio, parada, corte, contador)', () => {
    const P = { marca: { nome: 'X', logo: 'x.png', cores: { fundo: '#111111', texto: '#ebebeb', cartao: '#222222', sobreCartao: '#ffffff', ok: '#33aa55', sobreOk: '#ffffff' }, fontes: { texto: 'Inter' } },
      lista: { itens: ['a', 'b', 'c'] } }
    const p = planejarChecklist(P)
    assert.deepEqual([p.estrutura, p.camera, p.transicao, p.total], ['lista', 'parada', 'corte', 3])
    assert.equal(p.marcas[1].t - p.marcas[0].t, CHECKLIST.RITMOS.medio.passo)
    assert.ok(p.marcas.every((m) => m.marca === 'ok'))
    assert.ok(p.dur >= 6)
  })
  test('parâmetro errado: a mensagem diz o que fazer', () => {
    const colunas = ler('example-columns.json'), lista = ler('example.json')
    const erro = (base, mudar) => { const P = structuredClone(base); mudar(P); return validarChecklist(P).join('\n') }
    assert.match(erro(lista, (P) => { P.estrutura = 'grade' }), /estrutura "grade" does not exist: use "lista" .* or "colunas"/)
    assert.match(erro(lista, (P) => { P.ritmo = 'turbo' }), /ritmo "turbo" does not exist: use "rapido", "medio", "calmo"/)
    assert.match(erro(lista, (P) => { P.camera = 'orbita' }), /camera "orbita" does not exist: use "parada", "segue"/)
    assert.match(erro(colunas, (P) => { P.colunas.pop() }), /estrutura "colunas" requires "colunas" with 2 columns/)
    assert.match(erro(colunas, (P) => { P.colunas[1].marca = 'x' }), /colunas\[1\]\.marca "x" does not exist: use "ok" \(✓, ticks\) or "nao" \(✕, strikes out\)/)
    assert.match(erro(lista, (P) => { P.lista.itens = Array(9).fill('item') }), /9 items don't fit; up to 8 per list/)
    assert.match(erro(lista, (P) => { P.lista.itens = [] }), /lista\.itens: from 1 to 8 items/)
    assert.match(erro(lista, (P) => { delete P.marca.logo }), /missing marca\.logo: the closing is only the logo/)
    assert.match(erro(lista, (P) => { P.fecho.endereco = 'yourproduct.com' }), /fecho\.endereco: this template's closing is only the logo/)
    assert.match(erro(colunas, (P) => { P.colunas[0].cores.ok = 'verde' }), /colunas\[0\]\.cores\.ok "verde" is not a #rrggbb color/)
    assert.match(erro(colunas, (P) => { P.contador = { modo: 'total' } }), /contador\.modo "total" is for the list: with columns the counter goes in the header/)
    assert.match(erro(lista, (P) => { P.contador = { modo: 'rodape' } }), /contador\.modo "rodape" does not exist: use "total" .* or "coluna"/)
    assert.throws(() => planejarChecklist({ ...lista, estrutura: 'grade' }), /ticking-checklist template parameters:\n {2}- estrutura "grade"/)
  })
  test('o render.mjs recusa parâmetro errado e formato desconhecido antes de criar qualquer pasta', () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'checklist-erro-'))
    const arq = path.join(MOLDE, `.teste-erro-${process.pid}.json`)
    fs.writeFileSync(arq, JSON.stringify({ ...ler('example.json'), ritmo: 'turbo' }))
    try {
      const r = spawnSync(process.execPath, [path.join(MOLDE, 'render.mjs'), arq, '--out', path.join(tmp, 'x')], { encoding: 'utf8' })
      assert.equal(r.status, 1); assert.match(r.stderr, /ritmo "turbo" does not exist/)
      const r2 = spawnSync(process.execPath, [path.join(MOLDE, 'render.mjs'), path.join(MOLDE, 'example-columns.json'), '--out', path.join(tmp, 'y'), '--formats', '16x9,3x2'], { encoding: 'utf8' })
      assert.equal(r2.status, 1); assert.match(r2.stderr, /format this template doesn't support: 3x2\. Use 16x9, 19x9, 21x9, 9x16, 1x1, 4x5/)
      assert.ok(!fs.existsSync(path.join(tmp, 'x')) && !fs.existsSync(path.join(tmp, 'y')), 'o renderizar criou pasta antes de recusar')
    } finally { fs.rmSync(arq, { force: true }); fs.rmSync(tmp, { recursive: true, force: true }) }
  })
})

describe('a cena composta no navegador (sem render)', { skip: !temPlaywright ? 'sem Playwright' : false }, () => {
  let tmp, browser
  const obras = {}
  const montar = (nome, P) => {
    const arq = path.join(tmp, `${nome}.json`), saida = path.join(tmp, nome)
    P.marca.logo = path.resolve(MOLDE, P.marca.logo)
    fs.writeFileSync(arq, JSON.stringify({ ...P, nome, marca: { ...P.marca, fontes: { texto: 'Inter' } } }))
    const obra = path.join(saida, `.work-${nome}`)
    spawnSync(process.execPath, [path.join(SKILL, 'scripts', 'example-fonts.mjs'), obra], { encoding: 'utf8' })
    const r = spawnSync(process.execPath, [path.join(MOLDE, 'render.mjs'), arq, '--out', saida, '--assemble-only'], { encoding: 'utf8' })
    assert.equal(r.status, 0, r.stderr)
    return obra
  }
  async function abrir(obra, fmt) {
    const [w, h] = FORMATOS[fmt]
    const p = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 1 })
    const erros = []
    p.on('console', (m) => { if (m.type() === 'error') erros.push(m.text()) })
    p.on('pageerror', (e) => erros.push(e.message))
    const quebrou = new Promise((_, nao) => p.on('pageerror', (e) => nao(new Error(`a cena quebrou no ${fmt}: ${e.message}`))))
    await p.goto(pathToFileURL(path.join(obra, 'index.html')).href + `?f=${fmt}`)
    await Promise.race([p.waitForFunction('window.__ready === true', null, { timeout: 60000 }), quebrou])
    return { p, erros }
  }
  const checar = (p) => p.evaluate(async () => {
    const out = []
    for (let t = 0; t < VIDEO.duracao; t += 0.1) out.push(...(await checarQuadro(t)).map((q) => q.msg))
    return [...new Set(out)]
  })
  const opaco = `(e) => { let o = 1; for (let x = e; x && x !== document.documentElement; x = x.parentElement) { const cs = getComputedStyle(x); if (cs.display === 'none') return 0; o *= +cs.opacity } return o }`

  before(async () => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'checklist-cena-'))
    obras.colunas = montar('colunas', ler('example-columns.json'))
    obras.lista = montar('lista', ler('example.json'))
    // a marca neutra, com um ✕ no meio da lista e o push; o logo é um PNG claro gerado aqui
    fs.writeFileSync(path.join(tmp, 'logo.png'), png(640, 120, [244, 241, 234]))
    const N = ler('neutro'); N.marca.logo = path.join(tmp, 'logo.png')
    obras['outra-marca'] = montar('outra-marca', N)
    browser = (await require('../scripts/playwright.cjs').abrirNavegador(tmp)).browser
  })
  after(async () => { if (browser) await browser.close(); if (tmp) fs.rmSync(tmp, { recursive: true, force: true }) })

  for (const ex of ['colunas', 'lista', 'outra-marca']) {
    test(`${ex}: compõe nos cinco formatos, sem erro no console e sem problema na checagem do motor`, async () => {
      for (const fmt of Object.keys(FORMATOS)) {
        const { p, erros } = await abrir(obras[ex], fmt)
        const probs = await checar(p)
        await p.close()
        assert.deepEqual(erros, [], `${ex} ${fmt}: erro no console`)
        assert.deepEqual(probs, [], `${ex} ${fmt}: a checagem acusou`)
      }
    })
    test(`${ex}: antes do fecho todo item está na tela e o contador chegou ao total; o fecho é só o logo, centrado`, async () => {
      for (const fmt of ['16x9', '9x16', '1x1']) {
        const { p } = await abrir(obras[ex], fmt)
        const r = await p.evaluate(async (opaco) => {
          const op = eval(opaco)
          await renderAt(PLANO.tSai - 0.05)
          const a = areaSegura()
          const itens = [...document.querySelectorAll('[data-colisao-nome^="item "]')].map((e) => { const q = e.getBoundingClientRect(); return { t: e.textContent, o: op(e), dentro: q.left >= a.x0 && q.right <= a.x1 && q.top >= a.y0 && q.bottom <= a.y1 } })
          const contadores = [...document.querySelectorAll('[data-colisao-nome="counter"], [data-colisao-nome="column counter"]')].map((e) => e.textContent.replace(/\s+/g, ' ').trim())
          const imagensNoConteudo = [...document.querySelectorAll('#stage img, [data-imagem]')].filter((e) => e.dataset.colisao !== 'logo').length
          await renderAt(VIDEO.duracao - 0.3)
          const visiveis = [...document.querySelectorAll('#stage *')].filter((e) => op(e) > 0.05)
          const textos = visiveis.filter((e) => [...e.childNodes].some((c) => c.nodeType === 3 && c.textContent.trim())).map((e) => e.textContent.trim())
          const imgs = visiveis.filter((e) => e.tagName === 'IMG').map((e) => { const q = e.getBoundingClientRect(); return { logo: e.dataset.colisao === 'logo', cx: q.left + q.width / 2, cy: q.top + q.height / 2 } })
          return { itens, contadores, imagensNoConteudo, textos, imgs, W, H, total: PLANO.total, grupos: PLANO.grupos.map((g) => g.itens.length), texto: VIDEO.texto, de: PARAMS.textos && PARAMS.textos.de }
        }, opaco)
        await p.close()
        assert.equal(r.itens.length, r.total, `${ex} ${fmt}: itens marcados na cena`)
        for (const it of r.itens) { assert.ok(it.o >= 0.9, `${ex} ${fmt}: "${it.t}" esmaecido (${it.o.toFixed(2)})`); assert.ok(it.dentro, `${ex} ${fmt}: "${it.t}" sai da área segura`) }
        const de = r.de || 'of'   // o conector do contador: textos.de no JSON, "of" por padrão
        const esperado = r.contadores.length === 1 ? [`${r.total} ${de} ${r.total}`] : r.grupos.map((n) => `${n} ${de} ${n}`)
        assert.deepEqual(r.contadores, esperado, `${ex} ${fmt}: o contador não chegou ao total`)
        assert.equal(r.imagensNoConteudo, 0, `${ex} ${fmt}: imagem no conteúdo`)
        assert.equal(r.texto, 'fora-da-imagem')
        assert.deepEqual(r.textos, [], `${ex} ${fmt}: texto no fecho`)
        assert.equal(r.imgs.length, 1, `${ex} ${fmt}: o fecho tem ${r.imgs.length} imagens`)
        assert.ok(r.imgs[0].logo, `${ex} ${fmt}: a imagem do fecho não é o logo`)
        assert.ok(Math.abs(r.imgs[0].cx - r.W / 2) < 2 && Math.abs(r.imgs[0].cy - r.H / 2) < 2, `${ex} ${fmt}: o logo não está centrado`)
      }
    })
  }

  test('lista de 8 itens com título longo no 9:16: o texto encolhe (nunca abaixo de 28 px) e tudo cabe, sem problema', async () => {
    const P = ler('example.json')
    P.lista.itens = ['Folha olhada', 'Refino passando', 'Texto revisado', 'Crítico independente', 'Formatos conferidos', 'Trilha medida', 'Fecho só com o logo', 'Pasta entregue']
    P.titulo = 'A conferência inteira antes de entregar'
    const { p, erros } = await abrir(montar('longa', P), '9x16')
    const probs = await checar(p)
    const corpos = await p.evaluate(() => [...document.querySelectorAll('[data-colisao-nome^="item "]')].map((e) => parseFloat(getComputedStyle(e).fontSize)))
    await p.close()
    assert.deepEqual(erros, []); assert.deepEqual(probs, [])
    assert.equal(corpos.length, 8); assert.ok(Math.min(...corpos) >= 28, `corpo ${Math.min(...corpos)} px`)
  })
  test('duas colunas de 8 itens no 1:1 não cabem: o erro diz o que fazer', async () => {
    const P = ler('example-columns.json')
    P.colunas.forEach((c) => { c.itens = Array.from({ length: 8 }, (_, k) => `Item ${k + 1}`) })
    const { p, erros } = await abrir(montar('colunas-longas', P), '1x1')
    await p.close()
    assert.ok(erros.some((e) => /THE COLUMNS DO NOT FIT in 1:1: .*Shorten the lists \(fewer items\) or remove the title/.test(e)), erros.join('\n'))
  })
})
