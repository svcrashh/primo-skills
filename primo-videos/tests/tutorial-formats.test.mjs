// node --test tests/tutorial-formats.test.mjs   (sem rede; a parte de composição precisa do Playwright e do ffmpeg)
// O que este arquivo trava:
//   · o tutorial compõe em qualquer formato (16:9, 19:9, 21:9, 9:16, 4:5, 1:1), pela orientação e não por "é 16:9";
//   · o formato vem do --format, do video.mjs ou da série, e o nome do arquivo ganha o formato pedido;
//   · a série de exemplo de computador (assets/example/computer-tutorial-series) passa na própria checagem em todos eles;
//   · o desenho antigo (série sem "versao") também compõe em 19:9 e 21:9;
//   · a checagem "texto fora da imagem" reprova texto marcado que cruza a imagem marcada, respeita o recorte e só vale
//     com VIDEO.texto = "fora-da-imagem";
//   · o logo PNG (MARCA.png) é achado na pasta da série (e os marcadores da série de exemplo, em assets/example), e o que
//     se lê sobre o fundo é o escolhido;
//   · os pares de cor da marca (MARCA.pares) são exigidos; g.secao ganha som e a virada "virar" pede o painel do computador;
//   · o índice das seções (abertura.indice): só com 2 ou mais g.secao, a abertura cresce para caber, cada pílula ganha um
//     pop, e as pílulas numeradas aparecem na coluna sem cruzar a tela (a checagem do texto fora da imagem passa).
import { test, describe, before, after } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { execFileSync, spawnSync } from 'node:child_process'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import { resolverVisual, lerMarca } from '../scripts/tutorial/visual.mjs'
import {
  TAMANHOS, deitado, formatoDe, textoDe, conferirFontes, conferirPngs, acharPng, pngsDaMarca, logoPngPara, conferirAparelho, folhaDoVideo, comporVersao, planoDoIndice, INDICE,
} from '../scripts/tutorial/compose.mjs'
import { SECAO_MAX } from '../scripts/tutorial/rules.mjs'

const require = createRequire(import.meta.url)
const AQUI = path.dirname(fileURLToPath(import.meta.url))
const SKILL = path.resolve(AQUI, '..')
const SERIE = path.join(SKILL, 'assets', 'example', 'computer-tutorial-series')
const temPlaywright = require('../scripts/playwright.cjs').candidatos().length > 0
const temFfmpeg = (() => { try { execFileSync('ffmpeg', ['-version'], { stdio: 'ignore' }); return true } catch { return false } })()
const calado = async (f) => { const l = console.log; console.log = () => {}; try { return await f() } finally { console.log = l } }

let base
before(() => { base = fs.mkdtempSync(path.join(os.tmpdir(), 'tut-formatos-')) })
after(() => fs.rmSync(base, { recursive: true, force: true }))

describe('o formato do tutorial', () => {
  test('os seis formatos existem, e a orientação vem da largura × altura', () => {
    assert.deepEqual(Object.keys(TAMANHOS).sort(), ['16x9', '19x9', '1x1', '21x9', '4x5', '9x16'])
    assert.deepEqual(TAMANHOS['19x9'], [2280, 1080])
    assert.deepEqual(TAMANHOS['21x9'], [2520, 1080])
    for (const f of ['16x9', '19x9', '21x9']) assert.equal(deitado(f), true, f)
    for (const f of ['9x16', '4x5', '1x1']) assert.equal(deitado(f), false, f)
  })
  test('vence o --format, depois o video.mjs, depois a série, depois o aparelho; por versão também', () => {
    const ap = { formato: '16x9' }
    assert.equal(formatoDe({ aparelho: ap }), '16x9')
    assert.equal(formatoDe({ serie: { formato: '19x9' }, aparelho: ap }), '19x9')
    assert.equal(formatoDe({ video: { formato: '21x9' }, serie: { formato: '19x9' }, aparelho: ap }), '21x9')
    assert.equal(formatoDe({ cli: '9x16', video: { formato: '21x9' }, aparelho: ap }), '9x16')
    assert.equal(formatoDe({ video: { formato: { computer: '19x9', padrao: '16x9' } }, versao: 'computer', aparelho: ap }), '19x9')
    assert.equal(formatoDe({ video: { formato: { computer: '19x9', padrao: '4x5' } }, versao: 'tablet', aparelho: ap }), '4x5')
    assert.throws(() => formatoDe({ cli: '18x9' }), /format "18x9" does not exist: use 16x9, 19x9, 21x9/)
  })
  test('o lado da legenda aceita uma chave por formato, inclusive os deitados novos', () => {
    const marca = lerMarca(path.join(SERIE, 'brand.js'))
    const serie = JSON.parse(fs.readFileSync(path.join(SERIE, 'series.json'), 'utf8'))
    const v = { ...serie.visual, legenda: { ...serie.visual.legenda, lado: { '19x9': 'esquerda', '21x9': 'direita', '9x16': 'cima', padrao: 'esquerda' } } }
    assert.doesNotThrow(() => resolverVisual({ versao: 2, visual: v }, marca))
    assert.throws(() => resolverVisual({ versao: 2, visual: { ...v, legenda: { ...v.legenda, lado: { '18x9': 'esquerda' } } } }, marca), /format "18x9" does not exist/)
  })
})

describe('a série de exemplo de tutorial de computador', () => {
  const serie = JSON.parse(fs.readFileSync(path.join(SERIE, 'series.json'), 'utf8'))
  const marca = lerMarca(path.join(SERIE, 'brand.js'))
  test('é versão 2, 19:9, texto fora da imagem, cinema, fecho só com o logo PNG, e passa nos pares da marca', () => {
    assert.equal(serie.versao, 2)
    assert.equal(serie.formato, '19x9')
    assert.equal(serie.texto, 'fora-da-imagem')
    assert.equal(serie.cinema, 'moldura')
    assert.ok(serie.bpm >= 112 && serie.bpm <= 118)
    const { visual } = resolverVisual(serie, marca)
    assert.equal(visual.fechamento.ordem, 'so-logo')
    assert.equal(visual.fechamento.logo, 'png')
    assert.equal(visual.abertura.saida, 'virar')
    assert.equal(visual.legenda.rotulo, 'pilula')
    assert.equal(visual.selo.fundo, '#D6D6D6')
    assert.equal(visual.selo.cor, '#383838')
    const ident = JSON.parse(fs.readFileSync(path.join(SERIE, 'identity.json'), 'utf8'))
    assert.deepEqual(ident.bpm, [112, 118])
  })
  test('um par de cor fora do MARCA.pares é erro, e o AA18 só vale para texto grande', () => {
    const v = (troca) => ({ ...serie, visual: { ...serie.visual, ...troca } })
    // a cor principal sobre o fundo claro é AA18: vale no título, nunca na legenda
    assert.throws(() => resolverVisual(v({ legenda: { ...serie.visual.legenda, tinta: 'marca' } }), marca), /AA18 in the brand, only for a large title/)
    assert.doesNotThrow(() => resolverVisual(v({ titulo: { ...serie.visual.titulo, tinta: 'marca' } }), marca))
    // o texto escuro sobre a segunda cor se lê, mas não é par aprovado (o par dela é com o tom escuro dela)
    assert.throws(() => resolverVisual(v({ selo: { tipo: 'pilula', cor: 'escuro', fundo: 'acento' } }), marca), /is not an approved brand pair/)
  })
  test('o modo de texto é "fora-da-imagem" ou "livre"', () => {
    assert.equal(textoDe({}, serie), 'fora-da-imagem')
    assert.equal(textoDe({ texto: 'livre' }, serie), 'livre')
    assert.equal(textoDe({}, {}), 'livre')
    assert.throws(() => textoDe({ texto: 'por-cima' }, {}), /"texto": "por-cima" does not exist/)
  })
  test('sem a Inter no fonts.css da série, o compor manda rodar o example-fonts.mjs', () => {
    const d = path.join(base, 'sem-fonte')
    fs.mkdirSync(d, { recursive: true })
    assert.match(conferirFontes(serie, d)[0], /example-fonts\.mjs/)
  })
  test('o logo PNG de marcador é achado em assets/example, e o que se lê sobre o fundo é o escolhido', () => {
    const pngs = pngsDaMarca(marca, path.join(base, 'serie-vazia'))
    assert.equal(pngs.logo.w, 1590)
    assert.equal(pngs.logo.rel, 'media/logo-placeholder.png')
    assert.equal(logoPngPara('#F5F5F5', pngs).chave, 'logo')        // fundo claro: o marcador escuro
    assert.equal(logoPngPara('#848484', pngs).chave, 'logoClaro')   // cor principal: o marcador claro
    assert.equal(logoPngPara('#F5F5F5', {}), null)
  })
  test('o logo PNG vem da pasta da série (o caminho do brand.js ou <série>/media/); fora dela, só os marcadores de exemplo', () => {
    const d = path.join(base, 'serie-com-logo')
    fs.mkdirSync(path.join(d, 'media'), { recursive: true })
    const marcador = path.join(SKILL, 'assets', 'example', 'logo-placeholder.png')
    // o logo de uma marca não é procurado fora da série: sem o arquivo lá, o erro diz onde pôr
    assert.equal(acharPng(d, 'media/my-logo.png'), null)
    const { visual } = resolverVisual(serie, marca)
    const erros = conferirPngs(visual, { ...marca, png: { logo: 'media/my-logo.png', logoClaro: 'media/my-logo-light.png' } }, d, 'moldura').join('\n')
    assert.match(erros, /no PNG logo that reads on #F5F5F5\. MARCA\.png in brand\.js \(media\/my-logo\.png, media\/my-logo-light\.png\): put the logo PNG in the series folder, at that path or in .*serie-com-logo.media\/$/m)
    // o caminho do brand.js, e o nome solto achado em <série>/media/
    fs.copyFileSync(marcador, path.join(d, 'media', 'my-logo.png'))
    fs.copyFileSync(marcador, path.join(d, 'logo-at-the-root.png'))
    assert.equal(acharPng(d, 'media/my-logo.png'), path.join(d, 'media', 'my-logo.png'))
    assert.equal(acharPng(d, 'logo-at-the-root.png'), path.join(d, 'logo-at-the-root.png'))
    assert.equal(acharPng(d, 'my-logo.png'), path.join(d, 'media', 'my-logo.png'))
    // o marcador da série de exemplo vem de assets/example; o arquivo que a série tiver com esse nome vence
    assert.equal(acharPng(d, 'media/logo-placeholder.png'), marcador)
    fs.copyFileSync(marcador, path.join(d, 'media', 'logo-placeholder.png'))
    assert.equal(acharPng(d, 'media/logo-placeholder.png'), path.join(d, 'media', 'logo-placeholder.png'))
  })
  test('a saída "virar" é do painel do computador em modo cinema', () => {
    const { visual } = resolverVisual(serie, marca)
    assert.deepEqual(conferirAparelho({ visual, cinema: 'moldura', toque: false, viewport: { width: 1440, height: 900 } }), [])
    assert.throws(() => conferirAparelho({ visual, cinema: 'nenhum', toque: false, viewport: { width: 1440, height: 900 } }), /"virar" is the 3D panel of the computer/)
    assert.throws(() => conferirAparelho({ visual, cinema: 'moldura', toque: true, viewport: { width: 390, height: 844 } }), /"virar" is the 3D panel of the computer/)
  })
  test('g.secao: nome curto, e a seção nova ganha som (o cartão entra e sai no modo cinema)', () => {
    assert.ok(SECAO_MAX >= 23)   // "Relatórios e exportação"
    const { visual } = resolverVisual(serie, marca)
    const log = { versao: 'computer', duracao: 12, aparelho: { toque: false, formato: '16x9' }, eventos: [
      { t: 0.02, tipo: 'secao', nome: 'Busca' }, { t: 0.03, tipo: 'passo', n: 1 }, { t: 6, tipo: 'secao', nome: 'Sumário' }, { t: 6, tipo: 'passo', n: 2 }] }
    const m = folhaDoVideo({ id: 'v' }, log, { A: 2.8, F: 3, semente: 1, serie, visual, cinema: 'moldura' }).marcos
    const sec = m.filter((x) => /^section:/.test(x.evento))
    assert.equal(sec.length, 2, JSON.stringify(sec))   // a 1ª seção (colada na abertura) não tem som; a 2ª, entrada e saída
    assert.ok(sec.every((x) => x.efeito === 'whoosh'))
  })
})

// ---------- a checagem "texto fora da imagem", direto no motor ----------
function projetoMinimo(nome, { texto = 'fora-da-imagem', x = 850, recorte = null } = {}) {
  const d = path.join(base, nome)
  fs.mkdirSync(path.join(d, 'fonts'), { recursive: true })
  for (const f of ['engine.js', 'index.html']) fs.copyFileSync(path.join(SKILL, 'assets', 'template', f), path.join(d, f))
  fs.writeFileSync(path.join(d, 'fonts', 'fonts.css'), '')
  fs.writeFileSync(path.join(d, 'brand.js'), 'const MARCA = { cores: {} }\n')
  fs.writeFileSync(path.join(d, 'video.js'), `const VIDEO = ${JSON.stringify({ duracao: 1, formatos: ['19x9'], fontes: [], ...(texto ? { texto } : {}) })}\n`)
  fs.writeFileSync(path.join(d, 'scenes.js'), `cena(0, 1, (root) => {
  root.style.background = '#F5F5F5'
  const caixa = el('div', { style: { position: 'absolute', left: '0', top: '0', width: '2280px', height: '1080px'${recorte ? `, clipPath: '${recorte}'` : ''} } }, root)
  marcarImagem(el('div', { style: { position: 'absolute', left: '800px', top: '100px', width: '1300px', height: '800px', background: '#DDDDDD' } }, caixa), 'the recorded screen')
  marcar(el('div', { text: 'Abra o sumário', style: { position: 'absolute', left: '${x}px', top: '400px', font: '700 48px sans-serif', color: '#111111', whiteSpace: 'nowrap' } }, root), 'legenda')
  return () => {}
})
`)
  return d
}
const checar = (d) => spawnSync(process.execPath, [path.join(SKILL, 'scripts', 'frames.cjs'), '--project', d, '--check', '--qps', '2'], { encoding: 'utf8' })

describe('o índice das seções (abertura.indice)', () => {
  const secs = (n) => Array.from({ length: n }, (_, i) => ({ nome: `Seção ${i + 1}` }))
  test('só existe com 2 ou mais seções; numera 01, 02…; a abertura cresce o bastante para ler', () => {
    assert.equal(planoDoIndice(secs(1), 2.8), null)
    assert.equal(planoDoIndice([], 2.8), null)
    const p = planoDoIndice(secs(5), 2.8)
    assert.deepEqual(p.itens.map((x) => x.num), ['01', '02', '03', '04', '05'])
    assert.equal(p.passo, 0.15)
    assert.ok(p.ini > p.t0, 'as pílulas entram depois de o título sair')
    // da última pílula assentada até a abertura acabar: o tempo de ler, mais a saída
    const assentada = p.ini + 4 * INDICE.passo + INDICE.entra
    assert.ok(p.A - assentada >= p.leitura, `${p.A} − ${assentada} < ${p.leitura}`)
    assert.ok(p.leitura >= 2, 'cinco seções pedem ≥ 2 s de leitura')
    const p2 = planoDoIndice(secs(2), 2.8)
    assert.ok(p2.A > 2.8 && p2.A < p.A)
  })
  test('a série de exemplo liga o índice; o campo é booleano; a pílula passa nos pares da marca', () => {
    const serie = JSON.parse(fs.readFileSync(path.join(SERIE, 'series.json'), 'utf8'))
    const marca = lerMarca(path.join(SERIE, 'brand.js'))
    assert.equal(resolverVisual(serie, marca).visual.abertura.indice, true)
    assert.throws(() => resolverVisual({ ...serie, visual: { ...serie.visual, abertura: { ...serie.visual.abertura, indice: 'sim' } } }, marca), /abertura\.indice = "sim": it is true/)
    const semIndice = { ...serie, visual: { ...serie.visual, abertura: { saida: 'virar', previa: 'resultado', painel: 'marca' } } }
    assert.equal(resolverVisual(semIndice, marca).visual.abertura.indice, false)
  })
  test('cada pílula ganha um pop na folha de sincronia', () => {
    const serie = JSON.parse(fs.readFileSync(path.join(SERIE, 'series.json'), 'utf8'))
    const { visual } = resolverVisual(serie, lerMarca(path.join(SERIE, 'brand.js')))
    const indice = planoDoIndice(secs(3), 2.8)
    const log = { versao: 'computer', duracao: 12, aparelho: { toque: false, formato: '16x9' }, eventos: [{ t: 0.03, tipo: 'passo', n: 1 }] }
    const m = folhaDoVideo({ id: 'v' }, log, { A: indice.A, F: 3, semente: 1, serie, visual, cinema: 'moldura', indice }).marcos
    assert.deepEqual(m.filter((x) => /^index:/.test(x.evento)).map((x) => x.efeito), ['pop', 'pop', 'pop'])
  })
})

describe('a checagem do texto fora da imagem (frames.cjs --check)', { skip: !temPlaywright && 'sem Playwright nesta máquina' }, () => {
  test('texto marcado sobre a imagem marcada reprova (código 4), com o tempo e o texto', () => {
    const r = checar(projetoMinimo('sobre'))
    assert.equal(r.status, 4, r.stdout + r.stderr)
    assert.match(r.stderr, /TEXT OVER IMAGE t=0\.00–0\.50 s: caption "Abra o sumário" crosses the recorded screen/)
  })
  test('texto ao lado da imagem passa', () => {
    const r = checar(projetoMinimo('ao-lado', { x: 120 }))
    assert.equal(r.status, 0, r.stdout + r.stderr)
    assert.match(r.stdout, /no text over the image/)
  })
  test('vale a parte da imagem que se vê: o recorte (clip-path) do ancestral conta', () => {
    const r = checar(projetoMinimo('recortada', { recorte: 'inset(0 0 0 1300px)' }))
    assert.equal(r.status, 0, r.stdout + r.stderr)
  })
  test('sem VIDEO.texto = "fora-da-imagem", a checagem não roda', () => {
    const r = checar(projetoMinimo('livre', { texto: null }))
    assert.equal(r.status, 0, r.stdout + r.stderr)
  })
})

// ---------- o tutorial composto em cada formato (sem render: a folha de eventos e a checagem) ----------
function gravacaoFalsa(pasta, serie, extra = {}) {
  const dir = path.join(pasta, 'output', 'computer')
  fs.mkdirSync(path.join(dir, 'frames'), { recursive: true })
  execFileSync('ffmpeg', ['-v', 'error', '-y', '-f', 'lavfi', '-i', 'testsrc=s=1440x900:r=4:d=2', '-q:v', '5', path.join(dir, 'frames', '%05d.jpg')])
  const qs = fs.readdirSync(path.join(dir, 'frames')).sort().map((f, i) => [f, +(i * 0.8).toFixed(3)])
  fs.writeFileSync(path.join(dir, 'frames.json'), JSON.stringify(qs))
  const eventos = [
    { t: 0.02, tipo: 'secao', nome: 'Busca' }, { t: 0.03, tipo: 'passo', n: 1, legenda: 'Digite o assunto na busca do topo.' },
    { t: 0.3, t1: 0.8, tipo: 'move', de: [720, 450], para: [1200, 29] },
    { t: 1.0, tipo: 'toque', alvo: 'input#busca', ret: { x: 1040, y: 10, w: 320, h: 38 }, ponto: [1200, 29], realce: true, checagem: [] },
    { t: 3.2, tipo: 'secao', nome: 'Relatórios e exportação' }, { t: 3.2, tipo: 'passo', n: 2, legenda: 'Abra a seção pelo sumário.' },
    { t: 3.6, t1: 4.0, tipo: 'move', de: [1200, 29], para: [220, 160] },
    { t: 4.2, tipo: 'toque', alvo: 'a "Instalar"', ret: { x: 160, y: 145, w: 256, h: 32 }, ponto: [220, 160], realce: true, checagem: [] },
    { t: 4.3, tipo: 'tela', url: '/guia#instalar' },
    { t: 5.0, tipo: 'sucesso', ret: { x: 488, y: 80, w: 400, h: 60 } },
  ]
  fs.writeFileSync(path.join(dir, 'events.json'), JSON.stringify({ id: 'tut', titulo: 'Achar no guia', versao: 'computer',
    aparelho: { nome: 'computer', viewport: { width: 1440, height: 900 }, dsf: 3, toque: false, formato: '16x9' },
    captura: { metodo: 'screencast', qps: 4, qpsPico: 4, largura: 4320, altura: 2700, quadros: 'frames.json' }, duracao: 6.5, eventos }))
  return { id: 'tut', titulo: 'Achar no guia', pasta, serie, versoes: ['computer'], url: 'https://exemplo.invalid/', ...extra }
}

describe('o tutorial composto em todo formato', { skip: (!temPlaywright || !temFfmpeg) && 'precisa do Playwright e do ffmpeg' }, () => {
  let serieEx, serieAntiga
  before(() => {
    serieEx = path.join(base, 'serie-exemplo')
    fs.cpSync(SERIE, serieEx, { recursive: true })
    execFileSync(process.execPath, [path.join(SKILL, 'scripts', 'example-fonts.mjs'), serieEx], { stdio: 'ignore' })
    serieAntiga = path.join(base, 'serie-antiga')
    fs.mkdirSync(serieAntiga, { recursive: true })
    fs.writeFileSync(path.join(serieAntiga, 'brand.js'), 'const MARCA = { cores: { marca: "#FF6A1F", tinta: "#111111", fundo: "#FFFFFF", acento: "#2F6FEB" } }\n')
    fs.writeFileSync(path.join(serieAntiga, 'identity.json'), '{}\n')
    fs.writeFileSync(path.join(serieAntiga, 'series.json'), '{}\n')
  })

  for (const formato of ['19x9', '21x9', '16x9', '9x16', '4x5', '1x1']) {
    test(`série de exemplo em ${formato}: compõe, e a checagem (com texto fora da imagem) não acha nada`, async () => {
      const pasta = path.join(base, `exemplo-${formato}`)
      const video = gravacaoFalsa(pasta, serieEx)
      const r = await calado(() => comporVersao(video, 'computer', { semRender: true, formato }))
      assert.ok(fs.existsSync(r.folha), r.folha)
      // o formato pedido vai para o nome (o padrão da série é 19x9)
      assert.equal(path.basename(r.folha), formato === '19x9' ? 'tut-computer-sheet.png' : `tut-computer-${formato}-sheet.png`)
      const dados = fs.readFileSync(path.join(pasta, 'output', 'computer', 'comp', 'video.js'), 'utf8')
      assert.match(dados, new RegExp(`"formatos": \\[\\s*"${formato}"`))
      assert.match(dados, /"texto": "fora-da-imagem"/)
      // o índice das duas seções da gravação foi para o desenho, e a abertura cresceu para ele
      const tu = fs.readFileSync(path.join(pasta, 'output', 'computer', 'comp', 'data.js'), 'utf8')
      assert.match(tu, /"indice":\{[^}]*"t0"/)
      assert.match(tu, /"itens":\[\{"num":"01","nome":"Busca"\},\{"num":"02","nome":"Relatórios e exportação"\}\]/)
      assert.ok(Number(/"A":([0-9.]+)/.exec(tu)[1]) > 2.8)
      // o logo PNG foi para o projeto do motor
      assert.ok(fs.existsSync(path.join(pasta, 'output', 'computer', 'comp', 'media', 'logo-placeholder.png')))
    })
  }

  for (const formato of ['19x9', '21x9']) {
    test(`desenho antigo (série sem "versao") em ${formato}: compõe sem colisão`, async () => {
      const pasta = path.join(base, `antiga-${formato}`)
      const video = gravacaoFalsa(pasta, serieAntiga)
      const r = await calado(() => comporVersao(video, 'computer', { semRender: true, formato }))
      assert.ok(fs.existsSync(r.folha))
      assert.equal(r.colisao, false)
    })
  }
})
