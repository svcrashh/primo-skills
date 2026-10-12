// node --test tests/tutorial-variants.test.mjs   (sem rede; a parte de composição precisa do Playwright e do ffmpeg)
// O que este arquivo trava:
//   · os parâmetros novos do visual: visual.secao (cor, tinta, entrada, letreiro), visual.painel (movimento),
//     legenda.arranjo ("linha") e o fundo "simbolo"; sem eles, o desenho é o de antes (os padrões);
//   · os tempos e os sons do cartão de capítulo em cada entrada (a diagonal é a de sempre);
//   · o logo PNG pela tabela de logo por fundo da marca (MARCA.pngPorFundo): uma cor que leva outro logo, uma que não
//     leva nenhum;
//   · as variantes da série de exemplo de computador (assets/example/computer-tutorial-series/variants): cada uma com o
//     direction.json válido nos dez eixos, diferentes entre si, e com as regras que não mudam (19:9, texto fora da imagem,
//     Inter, fecho só com o logo PNG na versão certa, pares da marca);
//   · cada variante, aplicada como a receita manda (a série de base e a pasta da variante por cima), compõe sem render em
//     19:9, 16:9 e 9:16 sem colisão nem texto sobre a imagem;
//   · uma exceção no desenho (ERRO NA PÁGINA) reprova a composição em vez de dar ✓.
import { test, describe, before, after } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { execFileSync, spawnSync } from 'node:child_process'
import { createRequire } from 'node:module'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { resolverVisual, lerMarca, temposDaSecao, sonsDaSecao, digitacaoDaSecao } from '../scripts/tutorial/visual.mjs'
import { folhaDoVideo, comporVersao, pngsDaMarca, logoPngPara, conferirPngs, pythonDaTrilha } from '../scripts/tutorial/compose.mjs'

const require = createRequire(import.meta.url)
const AQUI = path.dirname(fileURLToPath(import.meta.url))
const SKILL = path.resolve(AQUI, '..')
const SERIE = path.join(SKILL, 'assets', 'example', 'computer-tutorial-series')
const VARIANTES = path.join(SERIE, 'variants')
const temPlaywright = require('../scripts/playwright.cjs').candidatos().length > 0
const temFfmpeg = (() => { try { execFileSync('ffmpeg', ['-version'], { stdio: 'ignore' }); return true } catch { return false } })()
const calado = async (f) => { const l = console.log; console.log = () => {}; try { return await f() } finally { console.log = l } }
const lerJson = (f) => JSON.parse(fs.readFileSync(f, 'utf8'))

const marca = lerMarca(path.join(SERIE, 'brand.js'))
const base = lerJson(path.join(SERIE, 'series.json'))
const com = (troca) => ({ ...base, visual: { ...base.visual, ...troca } })

let tmp
before(() => { tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'tut-variantes-')) })
after(() => fs.rmSync(tmp, { recursive: true, force: true }))

describe('visual.secao: o cartão de capítulo', () => {
  test('sem ele, a diagonal com o título, na cor do painel da abertura e na tinta que a marca aprova sobre ela', () => {
    const { visual } = resolverVisual(base, marca)
    assert.deepEqual(visual.secao, { entrada: 'diagonal', letreiro: 'titulo', cor: '#848484', tinta: '#F5F5F5' })
    assert.equal(visual.painel.movimento, 'respira')
    assert.equal(visual.legenda.arranjo, 'pilha')
  })
  test('entrada, letreiro, cor e tinta; o que não existe é erro com as opções', () => {
    const v = resolverVisual(com({ secao: { entrada: 'whip', cor: 'apoio', tinta: 'apoioEscuro', letreiro: 'digitado' } }), marca).visual
    assert.deepEqual(v.secao, { entrada: 'whip', cor: '#D6D6D6', tinta: '#383838', letreiro: 'digitado' })
    // sem tinta, a do par da marca para a cor
    assert.equal(resolverVisual(com({ secao: { entrada: 'empurrar', cor: 'acento' } }), marca).visual.secao.tinta, '#1B1B1B')
    assert.throws(() => resolverVisual(com({ secao: { entrada: 'zoom' } }), marca), /visual\.secao\.entrada = "zoom" does not exist\. Options: diagonal \| empurrar \| whip \| mascara/)
    assert.throws(() => resolverVisual(com({ secao: { entrada: 'whip', letreiro: 'grande' } }), marca), /visual\.secao\.letreiro = "grande" does not exist/)
  })
  test('a tinta do cartão passa nos pares da marca, como texto grande (o AA18 vale)', () => {
    // o tom forte da segunda cor sobre a terceira cor se lê (5,5:1), mas não é par da marca
    assert.throws(() => resolverVisual(com({ secao: { entrada: 'whip', cor: 'apoio', tinta: 'acentoForte' } }), marca), /section card: #505050 on #D6D6D6 is not an approved brand pair/)
    assert.doesNotThrow(() => resolverVisual(com({ secao: { entrada: 'mascara', cor: 'marca', tinta: 'claro' } }), marca))
  })
  test('os tempos de cada entrada: entra, cobre, sai e o painel volta, nessa ordem; a diagonal é a de sempre', () => {
    const v = (entrada) => ({ secao: { entrada } })
    assert.deepEqual(temposDaSecao(v('diagonal')), { de0: -0.5, de1: -0.12, ate0: 0.45, ate1: 0.9, volta: 1.0 })
    assert.deepEqual(temposDaSecao({}), temposDaSecao(v('diagonal')))
    for (const e of ['diagonal', 'empurrar', 'whip', 'mascara']) {
      const t = temposDaSecao(v(e))
      assert.ok(t.de0 < t.de1 && t.de1 < 0 && 0 < t.ate0 && t.ate0 < t.ate1 && t.ate1 <= t.volta, `${e}: ${JSON.stringify(t)}`)
      // o painel volta antes do primeiro toque típico depois da seção (~1,1 s)
      assert.ok(t.volta <= 1.05, `${e}: o painel volta em ${t.volta} s`)
    }
  })
  test('os sons: a diagonal tem os dois whoosh de antes; o chicote é curto; o datilografado ganha as teclas', () => {
    const vd = resolverVisual(base, marca).visual
    assert.deepEqual(sonsDaSecao(vd, 10, 'Sumário').map((s) => [s.efeito, s.t, s.extra.dur, s.extra.direcao]), [['whoosh', 9.6, 0.45, undefined], ['whoosh', 10.5, 0.5, -1]])
    const vw = resolverVisual(com({ secao: { entrada: 'whip' } }), marca).visual
    assert.ok(sonsDaSecao(vw, 10, 'Sumário').every((s) => s.efeito === 'whoosh' && s.extra.variante === 'curto'))
    const vm = resolverVisual(com({ secao: { entrada: 'mascara', cor: 'claro', tinta: 'escuro', letreiro: 'digitado' } }), marca).visual
    const dig = sonsDaSecao(vm, 10, 'Sumário').find((s) => s.efeito === 'digitacao')
    assert.equal(dig.extra.teclas, 7)
    const j = digitacaoDaSecao(vm, 'Sumário')
    assert.equal(+(dig.t - 10).toFixed(3), j.t0)
    // as letras terminam antes de o cartão começar a sair
    assert.ok(j.t1 < temposDaSecao(vm).ate0 - 0.2, JSON.stringify(j))
  })
  test('a folha de sincronia usa os sons da entrada escolhida', () => {
    const visual = resolverVisual(com({ secao: { entrada: 'empurrar', cor: 'acento', letreiro: 'numero' } }), marca).visual
    const log = { versao: 'computer', duracao: 12, aparelho: { toque: false, formato: '16x9' }, eventos: [
      { t: 0.02, tipo: 'secao', nome: 'Busca' }, { t: 0.03, tipo: 'passo', n: 1 }, { t: 6, tipo: 'secao', nome: 'Sumário' }, { t: 6, tipo: 'passo', n: 2 }] }
    const m = folhaDoVideo({ id: 'v' }, log, { A: 2.8, F: 3, semente: 1, serie: base, visual, cinema: 'moldura' }).marcos
    assert.deepEqual(m.filter((x) => /^section:/.test(x.evento)).map((x) => x.evento), ['section: the card "Sumário" rises and pushes the panel', 'section: the card leaves at the top and the panel comes back'])
  })
})

describe('visual.painel, legenda.arranjo, legenda.recuo e o fundo "simbolo"', () => {
  // o palco escuro (texto claro): o fundo escuro do símbolo tem par com a legenda dele
  const escuro = lerJson(path.join(VARIANTES, 'dark-stage', 'series.json'))
  const noEscuro = (fundo) => ({ ...escuro, visual: { ...escuro.visual, fundo } })
  test('o movimento do painel: respira, plano, travelling ou orbita', () => {
    for (const m of ['respira', 'plano', 'travelling', 'orbita']) assert.equal(resolverVisual(com({ painel: { movimento: m } }), marca).visual.painel.movimento, m)
    assert.throws(() => resolverVisual(com({ painel: { movimento: 'giro' } }), marca), /visual\.painel\.movimento = "giro" does not exist\. Options: respira \| plano \| travelling \| orbita/)
  })
  test('o arranjo da legenda: pilha (o de sempre) ou linha', () => {
    assert.equal(resolverVisual(com({ legenda: { ...base.visual.legenda, arranjo: 'linha' } }), marca).visual.legenda.arranjo, 'linha')
    assert.throws(() => resolverVisual(com({ legenda: { ...base.visual.legenda, arranjo: 'grade' } }), marca), /visual\.legenda\.arranjo = "grade" does not exist/)
  })
  test('o recuo da coluna: px de 0 a 200, padrão 0 (a série de base não muda)', () => {
    assert.equal(resolverVisual(base, marca).visual.legenda.recuo, 0)
    assert.equal(resolverVisual(com({ legenda: { ...base.visual.legenda, recuo: 24 } }), marca).visual.legenda.recuo, 24)
    assert.throws(() => resolverVisual(com({ legenda: { ...base.visual.legenda, recuo: -5 } }), marca), /visual\.legenda\.recuo = -5/)
    assert.throws(() => resolverVisual(com({ legenda: { ...base.visual.legenda, recuo: '24' } }), marca), /visual\.legenda\.recuo must be a number/)
  })
  test('o fundo "simbolo" pede a chave do PNG, e o símbolo entra inteiro (forca 1)', () => {
    assert.throws(() => resolverVisual(noEscuro({ tipo: 'simbolo', cor: 'escuro' }), marca), /visual\.fundo \(simbolo\) needs "png"/)
    const v = resolverVisual(noEscuro({ tipo: 'simbolo', cor: 'escuro', png: 'simbolo', forca: 0.2 }), marca).visual
    assert.equal(v.fundo.forca, 1)
  })
  test('o PNG do símbolo tem de existir', () => {
    const v = resolverVisual(noEscuro({ tipo: 'simbolo', cor: 'escuro', png: 'simboloInexistente' }), marca).visual
    assert.match(conferirPngs(v, marca, SERIE, 'moldura').join('\n'), /fundo "simbolo": the PNG "simboloInexistente"/)
    const ok = resolverVisual(noEscuro({ tipo: 'simbolo', cor: 'escuro', png: 'simbolo' }), marca).visual
    assert.deepEqual(conferirPngs(ok, marca, SERIE, 'moldura'), [])
  })
})

// A tabela de logo por fundo da marca de exemplo, escrita à mão (qual marcador vai sobre qual cinza): o motor tem de
// bater com ela. `logo` é o logo-placeholder.png (o escuro) e `logoClaro`, o logo-placeholder-light.png (o claro).
const LOGO_DA_MARCA = {
  '#F5F5F5': 'logo', '#EBEBEB': 'logo', '#DEDEDE': 'logo', '#E8E8E8': 'logo', '#EFEFEF': 'logo', '#E6E6E6': 'logo', '#D6D6D6': 'logo',
  // os dois cinzas médios em que o escuro se lê melhor que o claro: quem manda é a tabela da marca, contra a regra
  '#979797': 'logo', '#A8A8A8': 'logo',
  '#848484': 'logoClaro', '#1D1D1D': 'logoClaro', '#1B1B1B': 'logoClaro', '#505050': 'logoClaro', '#383838': 'logoClaro', '#2C2C2C': 'logoClaro',
}

describe('o logo PNG pela tabela de logo por fundo da marca', () => {
  const pngs = () => pngsDaMarca(marca, path.join(tmp, 'serie-vazia'))
  // a marca que não tem logo para uma cor diz isso com null na tabela
  const semLogoNaSegundaCor = { ...marca, pngPorFundo: { ...marca.pngPorFundo, '#979797': null } }
  test('a segunda cor leva o logo escuro; a cor com null não tem logo; o resto segue o claro e o escuro', () => {
    const p = pngs()
    assert.equal(logoPngPara('#979797', p, marca.pngPorFundo).chave, 'logo')
    assert.equal(logoPngPara('#979797', p, semLogoNaSegundaCor.pngPorFundo), null)
    // sem a tabela, a regra de antes (o teste antigo continua valendo)
    assert.equal(logoPngPara('#979797', p).chave, 'logoClaro')
    for (const [f, k] of Object.entries(LOGO_DA_MARCA)) assert.equal(logoPngPara(f, p, marca.pngPorFundo).chave, k, f)
  })
  test('o fecho numa cor sem logo horizontal é erro que diz para trocar a cor', () => {
    const v = resolverVisual(com({ fechamento: { ...base.visual.fechamento, fundo: 'acento' } }), marca).visual
    assert.deepEqual(conferirPngs(v, marca, SERIE, 'moldura'), [])
    assert.match(conferirPngs(v, semLogoNaSegundaCor, SERIE, 'moldura').join('\n'), /has no horizontal logo for #979797 \(MARCA\.pngPorFundo\): use another color/)
  })
})

// ---------- as variantes da série ----------
const NOMES = fs.existsSync(VARIANTES) ? fs.readdirSync(VARIANTES).filter((d) => fs.statSync(path.join(VARIANTES, d)).isDirectory()).sort() : []
/** A série da variante como a receita monta: a série de base e a pasta da variante por cima (arquivo inteiro, sem mesclar). */
function serieDaVariante(nome) {
  const s = { ...base }
  const arq = path.join(VARIANTES, nome, 'series.json')
  return fs.existsSync(arq) ? lerJson(arq) : s
}

describe('as variantes da série de exemplo de computador', () => {
  test('existem as quatro: a de base (left-column) e três novas', () => {
    assert.deepEqual(NOMES, ['bottom-strip', 'dark-stage', 'left-column', 'right-column'])
    // a de base só ganha a direção: o resto é a série como ela é
    assert.deepEqual(fs.readdirSync(path.join(VARIANTES, 'left-column')), ['direction.json'])
    for (const n of NOMES.filter((x) => x !== 'left-column')) {
      assert.deepEqual(fs.readdirSync(path.join(VARIANTES, n)).sort(), ['direction.json', 'identity.json', 'reading.md', 'series.json'], n)
    }
  })
  test('cada direction.json é válido nos dez eixos (o scripts/variety.mjs aceita)', async () => {
    const { validar } = await import(pathToFileURL(path.join(SKILL, 'scripts', 'variety.mjs')).href)
    for (const n of NOMES) assert.deepEqual(validar(lerJson(path.join(VARIANTES, n, 'direction.json'))), [], n)
  })
  test('as quatro são diferentes de verdade: cada par difere em 5 ou mais eixos e nenhum repete o trio estilo + leiaute + transição', () => {
    const eixos = ['style', 'structure', 'layout', 'transition', 'topic', 'camera', 'palette', 'background', 'pace', 'soundtrack']
    const ds = NOMES.map((n) => [n, lerJson(path.join(VARIANTES, n, 'direction.json'))])
    for (let i = 0; i < ds.length; i++) for (let j = i + 1; j < ds.length; j++) {
      const [a, da] = ds[i], [b, db] = ds[j]
      const difere = eixos.filter((e) => da[e] !== db[e])
      assert.ok(difere.length >= 5, `${a} × ${b}: só ${difere.join(', ')}`)
      assert.ok(da.transition !== db.transition || da.layout !== db.layout, `${a} × ${b}: mesmo trio`)
    }
    // o leiaute da série é o que o nome diz
    for (const [n, d] of ds) if (n !== 'dark-stage') assert.equal(d.layout, n)
  })
  for (const nome of NOMES) {
    test(`${nome}: as regras que não mudam (19:9, texto fora da imagem, Inter, cinema, fecho só com o logo PNG certo, pares da marca)`, () => {
      const s = serieDaVariante(nome)
      assert.equal(s.versao, 2)
      assert.equal(s.formato, '19x9')
      assert.equal(s.texto, 'fora-da-imagem')
      assert.equal(s.cinema, 'moldura')
      assert.deepEqual(s.fontes, ['Inter'])
      assert.equal(s.fonteTitulo, 'Inter')
      assert.equal(s.aparelhos.computer.dsf, 3)
      assert.equal(s.loudness_lufs, -14)
      const { visual } = resolverVisual(s, marca)   // lança se um par não for aprovado
      assert.equal(visual.fechamento.ordem, 'so-logo')
      assert.equal(visual.fechamento.logo, 'png')
      assert.equal(visual.abertura.indice, true)
      const pngs = pngsDaMarca(marca, SERIE)
      for (const [onde, fundo] of [['fecho', visual.fechamento.fundo], ['painel da abertura', visual.abertura.painel]]) {
        const lg = logoPngPara(fundo, pngs, marca.pngPorFundo)
        assert.ok(lg && lg.chave === LOGO_DA_MARCA[fundo], `${nome}, ${onde}: ${fundo} → ${lg && lg.chave}; a tabela da marca pede ${LOGO_DA_MARCA[fundo]}`)
      }
      assert.deepEqual(conferirPngs(visual, marca, SERIE, 'moldura'), [])
    })
  }
  test('a trilha de cada variante é uma identidade válida, com o BPM do series.json dentro da faixa dela', { skip: !pythonDaTrilha([SKILL]) && 'sem o Python da trilha' }, () => {
    const py = pythonDaTrilha([SKILL])
    for (const n of NOMES.filter((x) => x !== 'left-column')) {
      const arq = path.join(VARIANTES, n, 'identity.json')
      const r = spawnSync(py, ['-c', `import series as serie; serie.carregar_identidade(${JSON.stringify(arq)})`], { cwd: path.join(SKILL, 'assets', 'audio'), encoding: 'utf8' })
      assert.equal(r.status, 0, `${n}: ${r.stderr}`)
      const [lo, hi] = lerJson(arq).bpm, bpm = serieDaVariante(n).bpm
      assert.ok(bpm >= lo && bpm <= hi, `${n}: ${bpm} fora de ${lo}–${hi}`)
    }
  })
})

// ---------- compor cada variante (sem render): a folha de eventos e a checagem ----------
function gravacaoFalsa(pasta, serie) {
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
  return { id: 'tut', titulo: 'Achar no guia', pasta, serie, versoes: ['computer'], url: 'https://exemplo.invalid/' }
}

describe('cada variante compõe (sem render), aplicada como a receita manda', { skip: (!temPlaywright || !temFfmpeg) && 'precisa do Playwright e do ffmpeg' }, () => {
  const series = {}
  before(() => {
    for (const n of NOMES.filter((x) => x !== 'left-column')) {
      // a receita: cp -R <série> _serie && cp <série>/variants/<name>/* _serie/
      const d = path.join(tmp, `serie-${n}`)
      fs.cpSync(SERIE, d, { recursive: true })
      for (const f of fs.readdirSync(path.join(VARIANTES, n))) fs.copyFileSync(path.join(VARIANTES, n, f), path.join(d, f))
      execFileSync(process.execPath, [path.join(SKILL, 'scripts', 'example-fonts.mjs'), d], { stdio: 'ignore' })
      series[n] = d
    }
  })
  for (const n of NOMES.filter((x) => x !== 'left-column')) {
    for (const formato of ['19x9', '16x9', '9x16']) {
      test(`${n} em ${formato}: compõe, e a checagem (colisão, área segura, texto fora da imagem) não acha nada`, async () => {
        const pasta = path.join(tmp, `${n}-${formato}`)
        const video = gravacaoFalsa(pasta, series[n])
        const r = await calado(() => comporVersao(video, 'computer', { semRender: true, formato }))
        assert.ok(fs.existsSync(r.folha), r.folha)
        assert.equal(r.colisao, false)
        const tu = fs.readFileSync(path.join(pasta, 'output', 'computer', 'comp', 'data.js'), 'utf8')
        const s = lerJson(path.join(series[n], 'series.json'))
        // o desenho recebe a entrada, os tempos e o movimento da variante
        assert.match(tu, new RegExp(`"secao":\\{"entrada":"${s.visual.secao.entrada}"[^}]*"tempos":\\{`))
        assert.match(tu, new RegExp(`"painel":\\{"movimento":"${s.visual.painel.movimento}"\\}`))
        if (s.visual.fundo.tipo === 'simbolo') assert.match(tu, /"fundo":\{"src":"media\/symbol-placeholder\.png"/)
      })
    }
  }
  test('uma exceção no desenho reprova a composição (nunca um ✓ com a página quebrada)', async () => {
    const d = path.join(tmp, 'serie-quebrada')
    fs.cpSync(SERIE, d, { recursive: true })
    execFileSync(process.execPath, [path.join(SKILL, 'scripts', 'example-fonts.mjs'), d], { stdio: 'ignore' })
    const s = lerJson(path.join(d, 'series.json'))
    s.visual.fundo = { tipo: 'proprio', cor: 'claro' }
    fs.writeFileSync(path.join(d, 'series.json'), JSON.stringify(s))
    // (a exceção solta no carregamento do script: a página fica pronta e o erro aparece, como num erro de digitação no desenho)
    fs.writeFileSync(path.join(d, 'visual.js'), "VISUAL_PROPRIO.fundo = () => () => {}\nthrow new Error('desenho quebrado de propósito')\n")
    const video = gravacaoFalsa(path.join(tmp, 'quebrada'), d)
    await assert.rejects(calado(() => comporVersao(video, 'computer', { semRender: true })), /the video design broke in the browser \(PAGE ERROR/)
  })
})
