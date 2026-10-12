// node --test tests/   (sem rede) a voz é opcional: com o módulo de voz instalado, o kit e o cronômetro só ligam a voz quando
// o vídeo tem voz. Um kit salvo de um vídeo sem voz cria o vídeo novo sem voz, como sempre (texts.json, sem voice/);
// um kit com voz aprovada cria com o roteiro de voz; o progress.mjs só põe a etapa voice na régua com --voice.
import { test, describe, before, after } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const AQUI = path.dirname(fileURLToPath(import.meta.url))
const KIT = path.join(AQUI, '..', 'scripts', 'kit.mjs')
const PROGRESSO = path.join(AQUI, '..', 'scripts', 'progress.mjs')
let base, marcas
const roda = (script, ...a) => spawnSync(process.execPath, [script, ...a], { encoding: 'utf8', env: { ...process.env, VIDEOSTUDIO_BRANDS: marcas } })
const etapaVoz = (pasta) => JSON.parse(fs.readFileSync(path.join(pasta, 'progress.json'), 'utf8')).etapas.previa.find((x) => x.id === 'voice').estado

function videoAprovado(nome, { comVoz }) {
  const video = path.join(base, nome)
  fs.mkdirSync(path.join(video, 'recording'), { recursive: true })
  fs.writeFileSync(path.join(video, 'recording', 'base.mjs'), 'export const base = (o) => ({ versoes: [o.versao], url: o.origem + "/login" })\nexport const fechar = async () => 0\n')
  fs.writeFileSync(path.join(video, 'recording', 'recipe.json'), JSON.stringify({ url: 'https://example.com', inicio: '/' }))
  fs.writeFileSync(path.join(video, 'video.mjs'), `export default { id: '${nome}', titulo: 'Title', pasta: ${JSON.stringify(video)}, serie: '../serie', semente: 7, idioma: 'en-US', versoes: ['computer'], aparelhos: { computer: { viewport: { width: 1280, height: 800 }, dsf: 3, toque: false, formato: '16x9' } } }\n`)
  if (comVoz) {
    fs.mkdirSync(path.join(video, 'voice', 'v1'), { recursive: true })
    fs.writeFileSync(path.join(video, 'voice', 'v1', 'script.json'), JSON.stringify({ idioma: 'en-US', perfil: 'calmo', voz: { id: 'VOICE1', nome: 'Invented Voice', modelo: 'eleven_multilingual_v2' }, falas: [] }))
  }
  return video
}

before(() => {
  base = fs.mkdtempSync(path.join(os.tmpdir(), 'kit-voice-'))
  marcas = path.join(base, 'Brands')
  const serie = path.join(base, 'serie')
  fs.mkdirSync(path.join(serie, 'fonts'), { recursive: true })
  fs.writeFileSync(path.join(serie, 'series.json'), JSON.stringify({ versao: 2 }))
  fs.writeFileSync(path.join(serie, 'brand.js'), 'const MARCA = {}\n')
  fs.writeFileSync(path.join(serie, 'identity.json'), JSON.stringify({ genero: 'house', papel: 'fundo', bpm: [120, 122] }))
})
after(() => fs.rmSync(base, { recursive: true, force: true }))

describe('kit new-video', () => {
  test('a kit saved from a video without voice makes the new video without voice, as always', async () => {
    assert.equal(roda(KIT, 'save', 'No Voice', '--from', videoAprovado('silent', { comVoz: false })).status, 0)
    const kit = JSON.parse(fs.readFileSync(path.join(marcas, 'no-voice', 'kit', 'kit.json'), 'utf8'))
    assert.equal(kit.voz, null)
    const nova = path.join(base, 'new-silent')
    const r = roda(KIT, 'new-video', 'No Voice', nova, '--request', 'Show the new button')
    assert.equal(r.status, 0, r.stderr)
    assert.match(r.stdout, /only missing: recording\/journey\.mjs and texts\.json/)
    assert.doesNotMatch(r.stdout, /voice take/)
    assert.ok(fs.existsSync(path.join(nova, 'texts.json')))
    assert.ok(!fs.existsSync(path.join(nova, 'voice')), 'no voice folder')
    const src = fs.readFileSync(path.join(nova, 'video.mjs'), 'utf8')
    assert.match(src, /'texts\.json'/)
    assert.doesNotMatch(src, /narration\.json|voice\/v1|'voice'/)
    await assert.rejects(import(path.join(nova, 'video.mjs')), /write the lines abertura, p1, fechamento in texts\.json/)
    assert.equal(etapaVoz(nova), 'pulada', 'the stopwatch has no voice stage')
  })

  test('a kit with an approved voice makes the new video with the voice script, and the stopwatch counts the voice', async () => {
    assert.equal(roda(KIT, 'save', 'With Voice', '--from', videoAprovado('voiced', { comVoz: true })).status, 0)
    const nova = path.join(base, 'new-voiced')
    const r = roda(KIT, 'new-video', 'With Voice', nova, '--request', 'Show the new button')
    assert.equal(r.status, 0, r.stderr)
    assert.match(r.stdout, /only missing: recording\/journey\.mjs and voice\/v1\/script\.json/)
    assert.equal(JSON.parse(fs.readFileSync(path.join(nova, 'voice', 'v1', 'script.json'), 'utf8')).voz.id, 'VOICE1')
    assert.ok(!fs.existsSync(path.join(nova, 'texts.json')))
    await assert.rejects(import(path.join(nova, 'video.mjs')), /write the lines abertura, p1, fechamento in voice\/v1\/script\.json/)
    assert.equal(etapaVoz(nova), 'pendente')
  })
})

describe('progress.mjs start', () => {
  test('without --voice the voice stage is skipped; with it, it counts', () => {
    const sem = fs.mkdtempSync(path.join(os.tmpdir(), 'progress-silent-')), com = fs.mkdtempSync(path.join(os.tmpdir(), 'progress-voiced-'))
    assert.equal(roda(PROGRESSO, 'start', sem).status, 0)
    assert.equal(etapaVoz(sem), 'pulada')
    assert.equal(roda(PROGRESSO, 'start', com, '--voice').status, 0)
    assert.equal(etapaVoz(com), 'pendente')
  })
})
