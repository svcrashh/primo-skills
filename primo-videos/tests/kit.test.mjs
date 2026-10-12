// node --test tests/   (sem rede) o kit do produto: salvar a partir de um vídeo, mostrar, e o novo-video que cria a pasta
// já com video.mjs, recording/, a série e o cronômetro ligados (a voz, que só entra com --voice, está em kit-voice.test.mjs).
import { test, describe, before, after } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath, pathToFileURL } from 'node:url'

const AQUI = path.dirname(fileURLToPath(import.meta.url))
const KIT = path.join(AQUI, '..', 'scripts', 'kit.mjs')
let base, video, marcas
const roda = (...a) => spawnSync(process.execPath, [KIT, ...a], { encoding: 'utf8', env: { ...process.env, VIDEOSTUDIO_BRANDS: marcas } })

before(() => {
  base = fs.mkdtempSync(path.join(os.tmpdir(), 'kit-'))
  marcas = path.join(base, 'Brands')
  // um vídeo aprovado: a série ao lado, a leitura da série num caminho relativo, a voz com um take, a receita
  const serie = path.join(base, 'serie')
  fs.mkdirSync(path.join(serie, 'fonts'), { recursive: true })
  fs.writeFileSync(path.join(base, 'leitura-product.md'), '# Leitura do produto\n')
  fs.writeFileSync(path.join(serie, 'series.json'), JSON.stringify({ versao: 2, leitura: '../leitura-product.md', niveis: { sucesso: false } }))
  fs.writeFileSync(path.join(serie, 'brand.js'), 'const MARCA = {}\n')
  fs.writeFileSync(path.join(serie, 'identity.json'), JSON.stringify({ genero: 'house', papel: 'fundo', bpm: [120, 122] }))
  video = path.join(base, 'video-aprovado')
  fs.mkdirSync(path.join(video, 'voice', 'v1'), { recursive: true })
  fs.mkdirSync(path.join(video, 'voice', '_takes', 'abc123'), { recursive: true })
  fs.writeFileSync(path.join(video, 'voice', '_takes', 'abc123', 'take.mp3'), 'mp3')
  fs.writeFileSync(path.join(video, 'voice', '_takes', 'abc123', 'take.json'), '{}')
  fs.writeFileSync(path.join(video, 'voice', 'v1', 'script.json'), JSON.stringify({ idioma: 'pt-BR', perfil: 'calmo', voz: { id: 'VOZ1', nome: 'Locutor', modelo: 'eleven_multilingual_v2' }, ajustes: { speed: 1.02 }, pronuncia: { Acme: 'Ákmi' }, falas: [] }))
  fs.writeFileSync(path.join(video, 'thesis.md'), '# Tese\n')
  fs.mkdirSync(path.join(video, 'recording'))
  fs.writeFileSync(path.join(video, 'recording', 'base.mjs'), 'export const base = (o) => ({ versoes: [o.versao], url: o.origem + "/login" })\nexport const fechar = async () => 0\n')
  fs.writeFileSync(path.join(video, 'recording', 'journey.mjs'), '// a jornada deste vídeo, que não vai para o kit\n')
  fs.writeFileSync(path.join(video, 'recording', 'recipe.json'), JSON.stringify({ url: 'https://exemplo.com', inicio: '/painel', login: { email: 'teste@exemplo.com', senha: 'EXEMPLO_SENHA' }, antes: { porta: 8191 } }))
  fs.writeFileSync(path.join(video, 'video.mjs'), `export default { id: 'aprovado', titulo: 'Título', pasta: ${JSON.stringify(video)}, serie: '../serie', semente: 72, idioma: 'pt-BR', versoes: ['computer'], aparelhos: { computer: { viewport: { width: 1280, height: 800 }, dsf: 3, toque: false, formato: '16x9' } } }\n`)
})
after(() => fs.rmSync(base, { recursive: true, force: true }))

describe('kit', () => {
  test('salvar guarda a leitura, a tese, a série (com a leitura dela), a voz, os takes, a trilha e a receita', () => {
    const r = roda('save', 'Produto Teste', '--from', video, '--series-id', 'computer-16x9-pt')
    assert.equal(r.status, 0, r.stderr)
    const dir = path.join(marcas, 'produto-teste', 'kit')
    const kit = JSON.parse(fs.readFileSync(path.join(dir, 'kit.json'), 'utf8'))
    assert.equal(kit.produto, 'Produto Teste')
    assert.equal(kit.series['computer-16x9-pt'].padrao, true)
    assert.deepEqual(kit.series['computer-16x9-pt'].aparelho.viewport, { width: 1280, height: 800 })
    // a leitura da série vem junto, e o caminho passa a ser o da cópia
    const sj = JSON.parse(fs.readFileSync(path.join(dir, 'series', 'computer-16x9-pt', 'series.json'), 'utf8'))
    assert.equal(sj.leitura, 'reading.md')
    assert.ok(fs.existsSync(path.join(dir, 'series', 'computer-16x9-pt', 'reading.md')))
    assert.equal(kit.voz.id, 'VOZ1')
    assert.deepEqual(kit.voz.pronuncia, { Acme: 'Ákmi' })
    assert.ok(fs.existsSync(path.join(dir, 'voice', '_takes', 'abc123', 'take.mp3')))
    assert.deepEqual({ semente: kit.trilha.semente, sem_sino: kit.trilha.sem_sino, genero: kit.trilha.genero }, { semente: 72, sem_sino: true, genero: 'house' })
    assert.deepEqual(kit.receita.arquivos, ['recipe/base.mjs'])
    assert.equal(kit.receita.login.senha, 'EXEMPLO_SENHA')
    assert.match(roda('show', 'produto-teste').stdout, /password in the variable EXEMPLO_SENHA/)
    assert.match(roda('list').stdout, /Produto Teste \(produto-teste\)/)
  })

  test('sem idioma no video.mjs, a série do kit sai em inglês (en-US); o pt-BR pedido no vídeo continua valendo', () => {
    const semIdioma = path.join(base, 'video-sem-idioma')
    fs.mkdirSync(semIdioma, { recursive: true })
    fs.writeFileSync(path.join(semIdioma, 'video.mjs'), `export default { id: 'sem-idioma', titulo: 'Title', serie: '../serie', versoes: ['computer'], aparelhos: { computer: { formato: '16x9' } } }\n`)
    const r = roda('save', 'Produto EN', '--from', semIdioma)
    assert.equal(r.status, 0, r.stderr)
    const kit = JSON.parse(fs.readFileSync(path.join(marcas, 'produto-en', 'kit', 'kit.json'), 'utf8'))
    assert.deepEqual(Object.keys(kit.series), ['computer-16x9-en'])
    assert.equal(kit.series['computer-16x9-en'].idioma, 'en-US')
    const pt = JSON.parse(fs.readFileSync(path.join(marcas, 'produto-teste', 'kit', 'kit.json'), 'utf8'))
    assert.equal(pt.series['computer-16x9-pt'].idioma, 'pt-BR')
  })

  test('a receita que guarda a senha em vez do nome da variável é recusada', () => {
    const rec = path.join(base, 'receita-ruim')
    fs.mkdirSync(rec, { recursive: true })
    fs.writeFileSync(path.join(rec, 'base.mjs'), 'export const base = () => ({})\n')
    fs.writeFileSync(path.join(rec, 'recipe.json'), JSON.stringify({ login: { senha: 'minha senha 123' } }))
    const r = roda('save', 'Outro', '--from', video, '--recipe', rec)
    assert.equal(r.status, 2)
    assert.match(r.stderr, /never the password/)
  })

  test('novo-video cria a pasta pronta: só faltam a jornada e o roteiro', async () => {
    const nova = path.join(base, 'novo')
    const r = roda('new-video', 'Produto Teste', nova, '--request', 'Mostre o botão novo')
    assert.equal(r.status, 0, r.stderr)
    for (const f of ['video.mjs', 'recording/base.mjs', 'recording/journey.mjs', 'REQUEST.md', 'thesis.md', 'progress.json']) assert.ok(fs.existsSync(path.join(nova, f)), f)
    const pedido = fs.readFileSync(path.join(nova, 'REQUEST.md'), 'utf8')
    assert.doesNotMatch(pedido, /<!--|\{\{/)
    assert.match(pedido, /Mostre o botão novo/)
    // o que o novo-video escreve nasce em inglês
    assert.match(pedido, /^# Produto Teste · the request\n/)
    assert.match(pedido, /\n## The fast path \(each step with the progress line\)\n/)
    assert.match(fs.readFileSync(path.join(nova, 'recording', 'journey.mjs'), 'utf8'), /^\/\/ The journey of this video \(Produto Teste\): Mostre o botão novo\n/)
    const src = fs.readFileSync(path.join(nova, 'video.mjs'), 'utf8')
    assert.match(src, /^\/\/ novo — Produto Teste\. Created by kit new-video \(\d{4}-\d{2}-\d{2}\): Mostre o botão novo\n/)
    assert.match(src, /semente: 72/)
    // a série com o caminho inteiro e escrito como literal JSON: no Windows, num '…', o \ do caminho viraria escape
    assert.ok(src.includes(`serie: ${JSON.stringify(path.join(marcas, 'produto-teste', 'kit', 'series', 'computer-16x9-pt'))},`), 'serie com o caminho da série do kit')
    assert.match(src, /inicio: '\/painel'/)
    // o cronômetro começou com a meta do kit
    const pg = JSON.parse(fs.readFileSync(path.join(nova, 'progress.json'), 'utf8'))
    assert.equal(pg.meta_min, 10)
    // as falas ainda dizem TODO: o video.mjs não carrega sem elas. Sem --voice o vídeo novo não tem voz, mesmo vindo de
    // um kit que guardou uma (kit com e sem voz × vídeo com e sem voz: kit-voice.test.mjs)
    await assert.rejects(import(pathToFileURL(path.join(nova, 'video.mjs')).href), /write the lines abertura, p1, fechamento in texts\.json/)
    assert.ok(!fs.existsSync(path.join(nova, 'voice')), 'sem --voice, nada de voice/')
    // pasta que já tem coisa não é sobrescrita
    assert.match(roda('new-video', 'Produto Teste', nova, '--request', 'x').stderr, /already exists and is not empty/)
    assert.match(roda('new-video', 'Sem Kit', path.join(base, 'z'), '--request', 'x').stderr, /there is no kit for "Sem Kit"/)
  })
})
