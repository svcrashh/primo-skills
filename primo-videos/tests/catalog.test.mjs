// node --test tests/catalog.test.mjs   (sem rede, sem navegador): o catálogo de estilos. A skill não traz galeria nem
// marca: o catálogo é a lista dos estilos que o motor sabe fazer e as páginas que mostram, ao lado deles, o que a pessoa
// já tem na marca DELA (as imagens paradas do projeto, os vídeos entregues, as direções propostas).
import { test, describe, before, after } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { EIXOS } from '../scripts/variety.mjs'
import { ESTILOS, TIPOS } from '../scripts/styles.mjs'
import { listar, estilos, rotulo, paginaEstilos, midiaDoProjeto, stillDaDirecao } from '../scripts/catalog.mjs'

const SKILL = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
const SCRIPT = path.join(SKILL, 'scripts', 'catalog.mjs')
const EMPRESA = /magenta|purple/i
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64')
const DIRECAO = { style: 'card-bento', structure: 'single-scene', layout: 'mosaic', transition: 'zoom-through', topic: 'diagram', camera: 'guided-zoom', palette: 'main-color', background: 'plain', pace: 'medium', soundtrack: 'house 122' }

let base, marcas
const roda = (...a) => spawnSync(process.execPath, [SCRIPT, ...a], { encoding: 'utf8', env: { ...process.env, VIDEOSTUDIO_BRANDS: marcas } })
const pasta = (nome) => { const p = path.join(base, nome); fs.mkdirSync(path.join(p, 'stills'), { recursive: true }); return p }
const grava = (arq, o) => { fs.mkdirSync(path.dirname(arq), { recursive: true }); fs.writeFileSync(arq, typeof o === 'string' || Buffer.isBuffer(o) ? o : JSON.stringify(o)) }

before(() => { base = fs.mkdtempSync(path.join(os.tmpdir(), 'catalogo-')); marcas = path.join(base, 'Brands') })
after(() => fs.rmSync(base, { recursive: true, force: true }))

describe('a lista dos estilos', () => {
  test('é a mesma do eixo style da variedade: todo estilo que o motor faz está na lista, e só eles', () => {
    assert.deepEqual(Object.keys(ESTILOS).sort(), [...EIXOS.style].sort())
    assert.equal(estilos().length, EIXOS.style.length)
  })

  test('cada estilo diz o que é, para que serve e o que precisa, em inglês e em português, e aponta para um molde e um exemplo de formato que existem', () => {
    for (const lg of ['en', 'pt']) for (const e of estilos(lg)) {
      for (const k of ['nome', 'frase', 'serve', 'precisa']) assert.ok(typeof e[k] === 'string' && e[k].trim().length > 3, `${e.id}.${k} (${lg})`)
      assert.ok(TIPOS.includes(e.tipo), `${e.id}: tipo ${e.tipo}`)
      assert.ok(fs.existsSync(path.join(SKILL, e.molde)), `${e.id}: falta o molde ${e.molde}`)
      assert.ok(fs.existsSync(path.join(SKILL, e.exemplo)), `${e.id}: falta o exemplo de formato ${e.exemplo}`)
      assert.doesNotMatch(JSON.stringify(e), EMPRESA, `${e.id} (${lg}) traz marca`)
    }
    assert.notEqual(estilos('pt')[0].serve, estilos('en')[0].serve)
  })

  test('list --format md é a tabela do chat, uma linha por estilo; --lang pt sai em português; json é lido por máquina', () => {
    const md = roda('list', '--format', 'md')
    assert.equal(md.status, 0, md.stderr)
    const linhas = md.stdout.trim().split('\n')
    assert.equal(linhas[0], '| Style | id | For | Needs | Template |')
    assert.equal(linhas.length, 2 + EIXOS.style.length)
    for (const id of EIXOS.style) assert.ok(linhas.some((l) => l.includes(`| \`${id}\` |`)), `falta ${id}`)
    assert.match(roda('list', '--format', 'md', '--lang', 'pt').stdout, /^\| Estilo \| id \| Serve para \| Precisa de \| Molde \|/)
    assert.equal(JSON.parse(roda('list', '--format', 'json').stdout).length, EIXOS.style.length)
    assert.match(listar(), /Bento grid \(card-bento\)\n  for: /)
  })

  test('show mostra um estilo com o molde, a ficha e o exemplo de formato; estilo que não existe: código 2, com os que existem', () => {
    const r = roda('show', 'card-bento')
    assert.equal(r.status, 0, r.stderr)
    assert.match(r.stdout, /Bento grid \(card-bento\)[\s\S]*for: [\s\S]*needs: [\s\S]*TEMPLATE\.md[\s\S]*card: .*card-bento\.md[\s\S]*format example \(greys and placeholder texts, no brand\): .*example\.json/)
    const x = roda('show', 'holograma')
    assert.equal(x.status, 2)
    assert.match(x.stderr, /style "holograma" does not exist: use one of .*card-bento/)
  })

  test('o eixo da paleta diz o papel da cor na marca da pessoa, não uma cor', () => {
    assert.deepEqual(EIXOS.palette, ['main-color', 'secondary-color', 'accent-color', 'light-neutral', 'dark-neutral'])
    assert.equal(rotulo('palette', 'main-color'), "The brand's main color")
    assert.equal(rotulo('palette', 'accent-color', 'pt'), 'A cor de destaque da marca')
    assert.equal(rotulo('style', 'card-bento', 'pt'), 'Bento de cartões')
  })
})

describe('abrir os estilos', () => {
  test('sem nada da pessoa: abre a lista assim mesmo e diz como fazer as imagens paradas', () => {
    const saida = path.join(base, 'so-lista.html')
    const r = roda('open', '--no-open', '--out', saida)
    assert.equal(r.status, 0, r.stderr)
    assert.match(r.stdout, new RegExp(`ready \\(not opened\\): ${saida.replace(/[.\\/]/g, '\\$&')}`))
    assert.match(r.stdout, /22 styles, with no still of the person yet\. A style is shown as a still made in their brand: .*direction-<n>\.json.*direction-<n>\.png.*open --directions/)
    const html = fs.readFileSync(saida, 'utf8')
    for (const id of EIXOS.style) assert.ok(html.includes(`id="${id}"`), `falta ${id} na página`)
    assert.doesNotMatch(html, /Yours in this style|No still of yours/)
  })

  test('a página é autocontida e sem marca: nada de fora, nenhuma cor ou nome de empresa, fonte do sistema', () => {
    const html = paginaEstilos()
    assert.doesNotMatch(html, /https?:\/\//)
    assert.doesNotMatch(html, EMPRESA)
    assert.match(html, /font:16px\/1\.5 system-ui/)
    assert.match(html, /<html lang="en">/)
    assert.match(paginaEstilos({ lingua: 'pt' }), /<html lang="pt-BR">[\s\S]*Estilos de vídeo/)
  })

  test('com a pasta do vídeo: a imagem cujo nome começa pelo estilo e a imagem de uma direção aparecem no estilo delas; a página vai para a pasta', () => {
    const p = pasta('video-a')
    grava(path.join(p, 'stills', 'card-bento-a.png'), PNG)
    grava(path.join(p, 'stills', 'timeline.mp4'), '')
    grava(path.join(p, 'stills', 'solta.png'), PNG)
    grava(path.join(p, 'direction-1.json'), { ...DIRECAO, style: 'drawn-flow', name: 'The path of a request' })
    grava(path.join(p, 'direction-1.png'), PNG)
    const por = midiaDoProjeto(p)
    assert.deepEqual(Object.keys(por).sort(), ['card-bento', 'drawn-flow', 'timeline'])
    assert.equal(por.timeline[0].tipo, 'video')
    assert.equal(por['drawn-flow'][0].titulo, 'The path of a request')
    const r = roda('open', '--folder', p, '--no-open')
    assert.equal(r.status, 0, r.stderr)
    assert.match(r.stdout, /ready \(not opened\): .*video-a[\\/]styles\.html\n$/)
    const html = fs.readFileSync(path.join(p, 'styles.html'), 'utf8')
    const cartao = (id) => html.slice(html.indexOf(`id="${id}"`), html.indexOf('</article>', html.indexOf(`id="${id}"`)))
    assert.ok(cartao('card-bento').includes(pathToFileURL(path.join(p, 'stills', 'card-bento-a.png')).href))
    assert.match(cartao('card-bento'), /Yours in this style/)
    assert.match(cartao('timeline'), /<video src="file:.*timeline\.mp4"/)
    assert.match(cartao('drawn-flow'), /The path of a request · still of this project/)
    assert.match(cartao('isometric'), /No still of yours in this style yet\./)
    assert.ok(!html.includes('solta.png'))
    assert.equal(roda('open', '--folder', p, '--no-open', '--lang', 'pt').status, 0)
    assert.match(fs.readFileSync(path.join(p, 'styles-pt.html'), 'utf8'), /Os seus neste estilo/)
  })

  test('com --brand: os vídeos entregues da marca entram no estilo deles, e só os que ainda estão no disco', () => {
    const mp4 = path.join(base, 'entregue.mp4')
    grava(mp4, '')
    grava(path.join(marcas, 'padaria-sol', 'videos.json'), { version: 1, brand: 'padaria-sol', videos: [
      { title: 'Novo cardápio', date: '2026-09-01', video: mp4, direction: { ...DIRECAO, style: 'rolling-list' } },
      { title: 'Sumiu', date: '2026-08-01', video: path.join(base, 'nao-existe.mp4'), direction: { ...DIRECAO, style: 'timeline' } },
    ] })
    const saida = path.join(base, 'marca.html')
    const r = roda('open', '--brand', 'Padaria Sol', '--no-open', '--out', saida)
    assert.equal(r.status, 0, r.stderr)
    const html = fs.readFileSync(saida, 'utf8')
    assert.match(html, /Novo cardápio · 2026-09-01 · delivered/)
    assert.doesNotMatch(html, /Sumiu/)
  })

  test('pasta que não existe e língua que não existe: código 2, dizendo o que fazer', () => {
    const r = roda('open', '--folder', path.join(base, 'nao-ha'), '--no-open')
    assert.equal(r.status, 2)
    assert.match(r.stderr, /video folder not found at .*nao-ha: check --folder/)
    const l = roda('list', '--lang', 'fr')
    assert.equal(l.status, 2)
    assert.match(l.stderr, /--lang "fr" is not a language here: use en .* or pt/)
    assert.equal(roda().status, 2)
    assert.match(roda('list', '--format', 'pdf').stderr, /--format pdf: use text \(the default\), md or json/)
  })
})

describe('as direções propostas', () => {
  test('lado a lado, cada uma com a sua imagem e os dez eixos; a tabela do chat sai com as letras; a direção sem imagem é avisada', () => {
    const p = pasta('video-b')
    grava(path.join(p, 'direction-1.json'), { ...DIRECAO, name: 'Grid of features', why: 'Four features at once.', pt: { name: 'Grade de funções', why: 'Quatro funções de uma vez.' } })
    grava(path.join(p, 'stills', 'direction-1.png'), PNG)
    grava(path.join(p, 'direction-2.json'), { ...DIRECAO, style: 'timeline', palette: 'dark-neutral', name: 'The stages <b>' })
    grava(path.join(p, 'direction-3.json'), { ...DIRECAO, style: 'isometric', name: 'Layers', still: 'feita/camadas.jpg' })
    grava(path.join(p, 'feita', 'camadas.jpg'), PNG)
    assert.equal(stillDaDirecao(path.join(p, 'direction-1.json'), null, p), path.join(p, 'stills', 'direction-1.png'))
    const r = roda('open', '--directions', 'direction-1.json,direction-2.json,direction-3.json', '--folder', p, '--no-open')
    assert.equal(r.status, 0, r.stderr)
    assert.match(r.stdout, /ready \(not opened\): .*video-b[\\/]directions\.html/)
    assert.match(r.stdout, /\| A \| Grid of features \| Bento grid \| The brand's main color \| .*stills[\\/]direction-1\.png \|/)
    assert.match(r.stdout, /\| B \| The stages <b> \| Timeline \| Dark neutral \| no still yet \|/)
    assert.match(r.stdout, /no still yet: B\. Make the still of each direction in the person's brand and open again before asking\./)
    assert.match(r.stdout, /All the styles: .*video-b[\\/]styles\.html/)
    const html = fs.readFileSync(path.join(p, 'directions.html'), 'utf8')
    assert.ok(html.includes(pathToFileURL(path.join(p, 'stills', 'direction-1.png')).href))
    assert.ok(html.includes(pathToFileURL(path.join(p, 'feita', 'camadas.jpg')).href))
    assert.match(html, /No still yet: the still comes before the question\./)
    assert.match(html, /The stages &lt;b&gt;/)
    assert.doesNotMatch(html, /The stages <b>/)
    for (const eixo of ['Style', 'Structure', 'Layout', 'Transition', 'Topic', 'Camera', 'Palette', 'Background', 'Pace', 'Soundtrack']) assert.ok(html.includes(`<th>${eixo}</th>`), eixo)
    assert.match(html, /<td>house 122<\/td>/)
    assert.doesNotMatch(html, /https?:\/\//)
    assert.equal(roda('open', '--directions', 'direction-1.json', '--folder', p, '--no-open', '--lang', 'pt').status, 0)
    const pt = fs.readFileSync(path.join(p, 'directions-pt.html'), 'utf8')
    assert.match(pt, /Grade de funções[\s\S]*Quatro funções de uma vez\.[\s\S]*A cor principal da marca/)
    assert.ok(fs.existsSync(path.join(p, 'directions.html')), 'a página em inglês continua lá')
  })

  test('direção inválida, que não existe ou sem --folder: código 2, dizendo o eixo e o que usar', () => {
    const p = pasta('video-c')
    grava(path.join(p, 'ruim.json'), { ...DIRECAO, palette: 'magenta' })
    const r = roda('open', '--directions', 'ruim.json', '--folder', p, '--no-open')
    assert.equal(r.status, 2)
    assert.match(r.stderr, /invalid direction in .*ruim\.json:\n  - palette "magenta" does not exist: use one of main-color · secondary-color · accent-color · light-neutral · dark-neutral/)
    assert.match(roda('open', '--directions', 'nao-ha.json', '--folder', p, '--no-open').stderr, /direction not found at .*nao-ha\.json/)
    const s = roda('open', '--directions', 'ruim.json', '--no-open')
    assert.equal(s.status, 2)
    assert.match(s.stderr, /--directions needs --folder <video-folder>/)
    assert.match(roda('open', '--directions', '--folder', p, '--no-open').stderr, /--directions needs the files/)
  })
})
