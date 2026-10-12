// node --test tests/variety.test.mjs   (sem rede) a trava de variedade: valida a direção, reprova a que repete os
// últimos vídeos da marca, sugere trocas que resolvem, e guarda o histórico sem duplicar. Tudo num diretório temporário
// (VIDEOSTUDIO_BRANDS): o histórico real nunca é tocado.
import { test, describe, before, after } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { EIXOS, TRIO, validar, comparar, ordenar } from '../scripts/variety.mjs'

const AQUI = path.dirname(fileURLToPath(import.meta.url))
const SCRIPT = path.join(AQUI, '..', 'scripts', 'variety.mjs')
const MATRIZ = path.join(AQUI, '..', 'references', 'catalog', 'variety.md')
let base, marcas
const roda = (...a) => spawnSync(process.execPath, [SCRIPT, ...a], { encoding: 'utf8', env: { ...process.env, VIDEOSTUDIO_BRANDS: marcas } })

const BASE = { style: 'panel-tutorial', structure: 'step-by-step', layout: 'left-column', transition: 'flip', topic: 'chapter-card', camera: 'guided-zoom', palette: 'main-color', background: 'plain', pace: 'medium', soundtrack: 'house 124' }
const com = (mud) => ({ ...BASE, ...mud })
const video = (titulo, data, direcao) => ({ title: titulo, date: data, video: `/v/${titulo}.mp4`, direction: direcao, recorded: `${data}T12:00:00.000Z` })
// muda 6 eixos, nenhum do trio
const LONGE = { structure: 'chapters', topic: 'list', camera: 'orbit', palette: 'secondary-color', background: 'grid', pace: 'fast' }

let n = 0
function arquivo(conteudo, nome = `d${++n}.json`) {
  const a = path.join(base, nome)
  fs.writeFileSync(a, typeof conteudo === 'string' ? conteudo : JSON.stringify(conteudo))
  return a
}
const mp4 = (nome) => arquivo('mp4', `${nome}.mp4`)
const historico = (marca) => JSON.parse(fs.readFileSync(path.join(marcas, marca, 'videos.json'), 'utf8'))

before(() => {
  base = fs.mkdtempSync(path.join(os.tmpdir(), 'variedade-'))
  marcas = path.join(base, 'Brands')
  process.env.VIDEOSTUDIO_BRANDS = marcas
})
after(() => fs.rmSync(base, { recursive: true, force: true }))

describe('validar', () => {
  test('os eixos e os valores do script são os da tabela do variety.md', () => {
    const tabela = {}
    for (const l of fs.readFileSync(MATRIZ, 'utf8').split('\n')) {
      const m = /^\|\s*`([a-z]+)`[^|]*\|(.*)\|\s*$/.exec(l)
      if (m) tabela[m[1]] = m[1] === 'soundtrack' ? null : [...m[2].matchAll(/`([^`]+)`/g)].map((x) => x[1])
    }
    assert.deepEqual(tabela, EIXOS, 'a tabela de references/catalog/variety.md e EIXOS em scripts/variety.mjs se desencontraram: atualize os dois juntos')
  })

  test('direção com os dez eixos válidos passa; trilha é texto livre', () => {
    assert.deepEqual(validar(BASE), [])
    assert.deepEqual(validar(com({ soundtrack: 'lo-fi 84, piano' })), [])
  })

  test('falta de eixo, valor fora da lista e trilha vazia são erro, todos de uma vez', () => {
    const { camera, ...semCamera } = BASE
    const erros = validar({ ...semCamera, layout: 'layout-x', soundtrack: '  ' })
    assert.equal(erros.length, 3, erros.join('\n'))
    assert.match(erros.join('\n'), /missing axis camera: use one of guided-zoom/)
    assert.match(erros.join('\n'), /layout "layout-x" does not exist: use one of left-column/)
    assert.match(erros.join('\n'), /soundtrack is free text/)
    assert.equal(validar([]).length, 1)
  })
})

describe('comparar', () => {
  test('sem histórico passa', () => {
    assert.equal(comparar(BASE, []).ok, true)
  })

  test('repetir o trio style+layout+transition do último reprova, mesmo diferindo em 6 eixos', () => {
    const r = comparar(com(LONGE), [video('A', '2026-10-01', BASE)])
    assert.equal(r.ok, false)
    assert.equal(r.comparados[0].falta, 0)
    assert.deepEqual(r.trio.valores, { style: 'panel-tutorial', layout: 'left-column', transition: 'flip' })
    assert.ok(TRIO.includes(r.trocas[0].eixo), 'a primeira troca quebra o trio')
    assert.equal(r.basta, 1)
    assert.equal(r.resolve, true)
    assert.ok(r.trocas.length >= 2 && r.trocas.length <= 3, `${r.trocas.length} trocas`)
  })

  test('o trio só conta contra o último; contra os anteriores vale a regra dos 3 eixos', () => {
    const hist = [video('Velho', '2026-09-01', BASE), video('Novo', '2026-10-01', com({ style: 'light-trail-teaser', layout: 'full-screen', transition: 'whip' }))]
    assert.equal(comparar(com(LONGE), hist).ok, true)
  })

  test('diferir em só 2 eixos de um dos 3 últimos reprova, e diz qual e o que repete', () => {
    const terceiro = com({ style: 'rolling-list', layout: 'mosaic', transition: 'push', topic: 'big-number', camera: 'static', palette: 'accent-color', background: 'photo', pace: 'calm' })
    const hist = [
      video('Terceiro', '2026-09-20', terceiro),
      video('Segundo', '2026-09-25', com({ style: 'light-trail-teaser', layout: 'full-screen', transition: 'whip' })),
      video('Último', '2026-10-01', com({ style: 'before-after', layout: 'split', transition: 'morph' })),
    ]
    const dir = { ...terceiro, style: 'counting-number', pace: 'fast' }
    const r = comparar(dir, hist)
    assert.equal(r.ok, false)
    assert.equal(r.trio, null)
    const t = r.comparados.find((c) => c.titulo === 'Terceiro')
    assert.deepEqual(t.difere, ['style', 'pace'])
    assert.equal(t.falta, 1)
    assert.ok(r.comparados.filter((c) => c.titulo !== 'Terceiro').every((c) => c.falta === 0))
    // as trocas usam valores que nenhum dos 3 últimos usou, e as que bastam fazem passar
    for (const tr of r.trocas) assert.ok(!hist.some((v) => v.direction[tr.eixo] === tr.para), `${tr.eixo} → ${tr.para} já foi usado`)
    const aplicada = { ...dir, ...Object.fromEntries(r.trocas.slice(0, r.basta).map((x) => [x.eixo, x.para])) }
    assert.equal(comparar(aplicada, hist).ok, true)
    assert.equal(comparar({ ...dir, ...Object.fromEntries(r.trocas.map((x) => [x.eixo, x.para])) }, hist).ok, true)
  })

  test('diferir em 3+ eixos de cada um dos 3 últimos passa; o 4º mais velho não conta', () => {
    const hist = [
      video('Quarto', '2026-09-01', com(LONGE)),
      video('Terceiro', '2026-09-20', BASE),
      video('Segundo', '2026-09-25', com({ style: 'light-trail-teaser', layout: 'full-screen', transition: 'whip' })),
      video('Último', '2026-10-01', com({ style: 'before-after', layout: 'split', transition: 'morph' })),
    ]
    const r = comparar(com({ ...LONGE, transition: 'mask' }), hist)
    assert.equal(r.ok, true, JSON.stringify(r.comparados))
    assert.deepEqual(r.comparados.map((c) => c.titulo), ['Último', 'Segundo', 'Terceiro'])
    assert.ok(r.comparados.every((c) => c.difere.length >= 3))
  })

  test('trilha compara sem caixa, acento nem espaço a mais; idêntica reprova com 3 trocas que resolvem', () => {
    const r = comparar(com({ soundtrack: 'House  124 ' }), [video('A', '2026-10-01', BASE)])
    assert.equal(r.comparados[0].difere.length, 0)
    assert.equal(r.basta, 3)
    assert.equal(r.resolve, true)
  })

  test('ordenar: o mais novo primeiro, pela data e, no mesmo dia, pelo registro', () => {
    const v = [video('b', '2026-10-01', BASE), video('a', '2026-09-01', BASE), { ...video('c', '2026-10-01', BASE), recorded: '2026-10-01T18:00:00.000Z' }]
    assert.deepEqual(ordenar(v).map((x) => x.title), ['c', 'b', 'a'])
  })
})

describe('linha de comando', () => {
  test('checar sem histórico: código 0', () => {
    const r = roda('check', '--brand', 'vazia', '--direction', arquivo(BASE))
    assert.equal(r.status, 0, r.stderr)
    assert.match(r.stdout, /^ok, no history for vazia/)
    assert.ok(!fs.existsSync(path.join(marcas, 'vazia')), 'checar não cria nada')
  })

  test('checar que repete o último: código 1, diz em quê e o que trocar; com --allow-repeat passa com aviso', () => {
    const reg = roda('record', '--brand', 'rep', '--direction', arquivo(BASE), '--video', mp4('rep1'), '--title', 'Vídeo A', '--date', '2026-10-06')
    assert.equal(reg.status, 0, reg.stderr)
    const dir = arquivo(com({ palette: 'secondary-color' }))
    const r = roda('check', '--brand', 'rep', '--direction', dir)
    assert.equal(r.status, 1, r.stdout + r.stderr)
    assert.match(r.stdout, /^failed/)
    assert.match(r.stdout, /✗ "Vídeo A" \(2026-10-06\): differs in only 1 axis \(palette\); it needs 3/)
    assert.match(r.stdout, /✗ the trio is the same as the last one/)
    assert.match(r.stdout, /Change \(the first 2 already solve it; the others move further from the latest\):\n {2}transition: flip → whip\n {2}layout: left-column → right-column\n {2}camera: guided-zoom → tracking\n/)
    assert.match(r.stdout, /--allow-repeat/)
    const i = roda('check', '--brand', 'rep', '--direction', dir, '--allow-repeat')
    assert.equal(i.status, 0, i.stderr)
    assert.match(i.stdout, /^warning: .*--allow-repeat/)
    assert.doesNotMatch(i.stdout, /Change/)
  })

  test('checar que varia o bastante: código 0, em quantos eixos difere de cada um', () => {
    roda('record', '--brand', 'var', '--direction', arquivo(BASE), '--video', mp4('var1'), '--title', 'Um', '--date', '2026-10-01')
    roda('record', '--brand', 'var', '--direction', arquivo(com({ style: 'light-trail-teaser', layout: 'full-screen', transition: 'whip' })), '--video', mp4('var2'), '--title', 'Dois', '--date', '2026-10-02')
    const r = roda('check', '--brand', 'var', '--direction', arquivo(com({ ...LONGE, transition: 'mask' })))
    assert.equal(r.status, 0, r.stdout + r.stderr)
    assert.match(r.stdout, /^ok, it varies: differs from "Dois" \(2026-10-02\) in 9 axes, from "Um" \(2026-10-01\) in 7 axes/)
  })

  test('direção inválida: código 2, com todos os erros e onde estão os valores', () => {
    const { background, ...semFundo } = BASE
    const r = roda('check', '--brand', 'inv', '--direction', arquivo({ ...semFundo, pace: 'lento' }))
    assert.equal(r.status, 2)
    assert.match(r.stderr, /invalid direction/)
    assert.match(r.stderr, /missing axis background/)
    assert.match(r.stderr, /pace "lento" does not exist: use one of calm · medium · fast/)
    assert.match(r.stderr, /variety\.md/)
    assert.equal(roda('check', '--brand', 'inv').status, 2)
    assert.equal(roda('nada').status, 2)
  })

  test('registrar não duplica: o mesmo vídeo atualiza a entrada (e guarda a data); outro vídeo acrescenta', () => {
    const v1 = mp4('dup1')
    assert.equal(roda('record', '--brand', 'dup', '--direction', arquivo(BASE), '--video', v1, '--title', 'Primeiro', '--date', '2026-09-30').status, 0)
    const r = roda('record', '--brand', 'dup', '--direction', arquivo(com(LONGE)), '--video', v1, '--title', 'Primeiro, revisto')
    assert.equal(r.status, 0, r.stderr)
    assert.match(r.stdout, /✓ updated/)
    let h = historico('dup')
    assert.equal(h.videos.length, 1)
    assert.equal(h.videos[0].title, 'Primeiro, revisto')
    assert.equal(h.videos[0].date, '2026-09-30')
    assert.equal(h.videos[0].direction.camera, 'orbit')
    assert.ok(h.videos[0].updated)
    assert.equal(roda('record', '--brand', 'dup', '--direction', arquivo(BASE), '--video', mp4('dup2'), '--title', 'Segundo').status, 0)
    h = historico('dup')
    assert.equal(h.videos.length, 2)
    assert.deepEqual(Object.keys(h.videos[1].direction), Object.keys(EIXOS))
    assert.equal(h.brand, 'dup')
  })

  test('registrar avisa quando a direção repete, e registra assim mesmo', () => {
    roda('record', '--brand', 'av', '--direction', arquivo(BASE), '--video', mp4('av1'), '--title', 'A', '--date', '2026-10-01')
    const r = roda('record', '--brand', 'av', '--direction', arquivo(BASE), '--video', mp4('av2'), '--title', 'B', '--date', '2026-10-02')
    assert.equal(r.status, 0, r.stderr)
    assert.match(r.stdout, /warning: recorded anyway/)
    assert.equal(historico('av').videos.length, 2)
  })

  test('registrar recusa vídeo que não existe e data fora do formato', () => {
    const a = roda('record', '--brand', 'rec', '--direction', arquivo(BASE), '--video', path.join(base, 'nao-existe.mp4'), '--title', 'X')
    assert.equal(a.status, 2)
    assert.match(a.stderr, /does not exist/)
    const b = roda('record', '--brand', 'rec', '--direction', arquivo(BASE), '--video', mp4('rec1'), '--title', 'X', '--date', '08/10/2026')
    assert.equal(b.status, 2)
    assert.match(b.stderr, /use YYYY-MM-DD/)
    assert.ok(!fs.existsSync(path.join(marcas, 'rec', 'videos.json')))
  })

  test('listar: o mais novo primeiro, com os eixos', () => {
    roda('record', '--brand', 'lis', '--direction', arquivo(BASE), '--video', mp4('lis1'), '--title', 'Meio', '--date', '2026-09-15')
    roda('record', '--brand', 'lis', '--direction', arquivo(com(LONGE)), '--video', mp4('lis2'), '--title', 'Novo', '--date', '2026-10-08')
    roda('record', '--brand', 'lis', '--direction', arquivo(BASE), '--video', mp4('lis3'), '--title', 'Velho', '--date', '2026-08-01')
    const r = roda('list', '--brand', 'lis')
    assert.equal(r.status, 0, r.stderr)
    const linhas = r.stdout.split('\n')
    assert.match(linhas[0], /^date\s+title\s+style\s+structure\s+layout\s+transition\s+topic\s+camera\s+palette\s+background\s+pace\s+soundtrack\s+video$/)
    assert.deepEqual(linhas.slice(2, 5).map((l) => l.split(/\s{2,}/)[1]), ['Novo', 'Meio', 'Velho'])
    assert.match(linhas[2], /2026-10-08\s+Novo\s+panel-tutorial\s+chapters\s+left-column\s+flip\s+list\s+orbit/)
    assert.match(r.stdout, /3 videos of lis/)
    assert.match(roda('list', '--brand', 'ninguem').stdout, /no videos of ninguem/)
  })

  test('histórico ilegível: código 2, e o arquivo fica como estava', () => {
    const arq = path.join(marcas, 'rota', 'videos.json')
    fs.mkdirSync(path.dirname(arq), { recursive: true })
    fs.writeFileSync(arq, '{ "videos": [ quebrado')
    const r = roda('record', '--brand', 'rota', '--direction', arquivo(BASE), '--video', mp4('rota1'), '--title', 'X')
    assert.equal(r.status, 2)
    assert.match(r.stderr, /is not valid JSON.*fix the file by hand/)
    assert.equal(fs.readFileSync(arq, 'utf8'), '{ "videos": [ quebrado')
    assert.equal(roda('check', '--brand', 'rota', '--direction', arquivo(BASE)).status, 2)
  })

  test('sem histórico na marca pedida, lembra as marcas que têm (o --brand pode estar errado)', () => {
    const r = roda('check', '--brand', 'welhub', '--direction', arquivo(BASE))
    assert.equal(r.status, 0)
    assert.match(r.stdout, /Brands with history: .*rep.*; check --brand/)
  })
})
