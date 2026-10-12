// voice.mjs review e a revisão do texto antes de o generate gastar: sem rede (a API é a falsa, em 127.0.0.1; precisa do ffmpeg).
// As regras de expressão ("não é X, é Y", slogan, chamada) são do português: o roteiro aqui é pt-BR, de propósito.
// node --test tests/voice-review.test.mjs
import { test, describe, before, after } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { revisarFalas, lerRoteiro } from '../scripts/voice.mjs'
import { subirApiFalsa } from './fake-api.mjs'

const VOZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'scripts', 'voice.mjs')
const CHAVE = 'sk_test_SECRET_0123456789abcdef'
const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'voice-review-'))
const escrever = (arq, dados) => { fs.mkdirSync(path.dirname(arq), { recursive: true }); fs.writeFileSync(arq, JSON.stringify(dados, null, 1)) }
function rodar(args, env = {}) {
  return new Promise((resolve) => {
    const casa = tmp()
    const p = spawn(process.execPath, [VOZ, ...args], { env: { PATH: process.env.PATH, HOME: casa, USERPROFILE: casa, ELEVENLABS_API_KEY: CHAVE, ...env } })
    let out = '', err = ''
    p.stdout.on('data', (d) => (out += d)); p.stderr.on('data', (d) => (err += d))
    p.on('close', (code) => resolve({ code, out, err, tudo: out + err }))
  })
}

const TIQUES = [
  { id: 'c1', onde: { capitulo: 1 }, texto: 'O time pediu, tá no ar: três ajustes no editor.' },
  { id: 'c2', onde: { capitulo: 2 }, texto: 'Três pedidos, três no ar.' },
]
const REESCRITAS = [
  { id: 'c1', onde: { capitulo: 1 }, texto: 'O time pediu três ajustes no editor de fotos, e os três já estão no ar.' },
  { id: 'c2', onde: { capitulo: 2 }, texto: 'Abre o editor de fotos do app e confere as três mudanças por lá.' },
]
const roteiro = (falas, extra = {}) => {
  const d = tmp(), arq = path.join(d, 'voice', 'v1', 'script.json')
  escrever(arq, { idioma: 'pt-BR', perfil: 'reels', voz: { id: 'v1', nome: 'Invented Voice' }, falas, ...extra })
  return { d, arq, saida: path.dirname(arq) }
}

describe('revisarFalas', () => {
  test('each finding says the line; the tutorial accepts a short sentence; the v4 markup does not count', () => {
    const { arq } = roteiro([
      { id: 'abertura', onde: 'abertura', texto: 'Reservar uma bicicleta.' },
      { id: 'p1', onde: { passo: 1 }, texto: 'Toque em Reservar — e escolha a estação.' },
      { id: 'fechamento', onde: 'fechamento', texto: 'Bora pedalar.' }])
    const a = revisarFalas(lerRoteiro(arq))
    assert.deepEqual(a.map((x) => [x.fala, x.nivel, x.regra]), [['p1', 'erro', 'travessao'], ['fechamento', 'erro', 'chamada']])
    const v4 = roteiro([{ id: 'c1', onde: { capitulo: 1 }, texto: '[warm] O time pediu três ajustes no editor de fotos, e os três já estão no ar.' }])
    assert.deepEqual(revisarFalas(lerRoteiro(v4.arq)), [])
  })
})

describe('voice.mjs review (no network)', () => {
  test('the two lines with tics fail with an error (code 1), with the sentence and what to change', async () => {
    const { arq } = roteiro(TIQUES)
    const r = await rodar(['review', arq])
    assert.equal(r.code, 1, r.tudo)
    assert.match(r.out, /✗ c1 · error · reveal with a colon\n {4}"O time pediu, tá no ar: três ajustes no editor\."\n {4}→ No suspense with a colon/)
    assert.match(r.out, /✗ c2 · error · slogan instead of the fact\n {4}"Três pedidos, três no ar\."\n {4}→ Change the slogan/)
    assert.match(r.out, /✗ 2 lines · 2 error\(s\) · 1 warning\(s\) · an error stops generate/)
    assert.doesNotMatch(r.tudo, /API calls/, 'review does not talk to the API')
  })

  test('the rewrites pass with no error and no warning, with the 150 words per minute estimate', async () => {
    const { arq } = roteiro(REESCRITAS)
    const r = await rodar(['review', arq])
    assert.equal(r.code, 0, r.tudo)
    assert.match(r.out, /time: 30 words ≈ 12 s at 150 words per minute, with the pauses \(c1 16 · c2 14\)/)
    assert.match(r.out, /✓ 2 lines · 0 error\(s\) · 0 warning\(s\)/)
  })

  test('--seconds: not fitting becomes a warning with how many words to cut; the narration next to it gives the measured time', async () => {
    const { arq, saida } = roteiro(REESCRITAS)
    const r = await rodar(['review', arq, '--seconds', '10'])
    assert.equal(r.code, 0, r.tudo)
    assert.match(r.out, /⚠ script · warning · does not fit the time\n {4}"30 words ≈ 12 s \(150 per minute, with the pauses\) for 10 s planned"\n {4}→ Cut about 5 words/)
    const fala = (f, fim) => ({ id: f.id, onde: f.onde, texto: f.texto, inicio_voz: 0.1, palavras: [{ texto: 'x', ini: 0.1, fim }] })
    escrever(path.join(saida, 'narration.json'), { versao: 1, falas: [fala(REESCRITAS[0], 5.1), fala(REESCRITAS[1], 4.1)] })
    const m = await rodar(['review', arq, '--seconds', '8', '--json'])
    const j = JSON.parse(m.out)
    assert.equal(j.medido, 9)
    assert.deepEqual(j.achados.map((x) => x.frase).filter((f) => /generated voice/.test(f)), ['the generated voice lasts 9 s for 8 s planned'])
    escrever(path.join(saida, 'narration.json'), { versao: 1, falas: [fala({ ...REESCRITAS[0], texto: 'Outro texto.' }, 5.1), fala(REESCRITAS[1], 4.1)] })
    const outra = await rodar(['review', arq])
    assert.match(outra.out, /the narration\.json next to it is from another text/)
    assert.equal((await rodar(['review', arq, '--seconds', 'zero'])).code, 2)
  })
})

describe('generate: the review before spending', () => {
  let api, env
  before(async () => {
    api = await subirApiFalsa({ chave: CHAVE })
    env = { ELEVENLABS_API_BASE: api.url }
    api.estado.vozes.v1 = { voice_id: 'v1', name: 'Invented Voice', category: 'professional', is_owner: false, sharing: { disable_at_unix: null, notice_period: 365 } }
  })
  after(() => api.fechar())

  test('a writing error in a new line: stops with code 3, without any call, and says the sentence and --accept-text', async () => {
    const v = roteiro(TIQUES)
    api.zerar()
    const r = await rodar(['generate', v.arq, '--out', v.saida], env)
    assert.equal(r.code, 3, r.tudo)
    assert.equal(api.pedidos.length, 0, 'not even the subscription was asked')
    assert.match(r.err, /The text of 2 line\(s\) has a writing tic, and nothing was spent/)
    assert.match(r.err, /"O time pediu, tá no ar: três ajustes no editor\."/)
    assert.match(r.err, /--accept-text/)
    assert.ok(!fs.existsSync(path.join(v.d, 'costs.jsonl')))
  })

  test('--accept-text generates on purpose; afterwards, everything from the cache does not stop, even without the flag', async () => {
    const v = roteiro(TIQUES)
    api.zerar()
    const r = await rodar(['generate', v.arq, '--out', v.saida, '--accept-text'], env)
    assert.equal(r.code, 0, r.tudo)
    assert.match(r.out, /text accepted on purpose \(--accept-text\): 2 writing error\(s\)/)
    assert.equal(api.tts().length, 2)
    api.zerar()
    const r2 = await rodar(['generate', v.arq, '--out', v.saida], env)
    assert.equal(r2.code, 0, r2.tudo)
    assert.equal(api.pedidos.length, 0)
    assert.doesNotMatch(r2.out, /writing tic|text review/)
  })

  test('a clean text generates without a warning; a warning does not stop generate', async () => {
    const v = roteiro(REESCRITAS)
    const r = await rodar(['generate', v.arq, '--out', v.saida], env)
    assert.equal(r.code, 0, r.tudo)
    assert.doesNotMatch(r.out, /text review/)
    const c = roteiro([{ id: 'c1', onde: { capitulo: 1 }, texto: 'Ele aceita Instagram, TikTok e YouTube no mesmo campo de links.' }])
    const r2 = await rodar(['generate', c.arq, '--out', c.saida], env)
    assert.equal(r2.code, 0, r2.tudo)
    assert.match(r2.out, /text review: 1 warning\(s\), which do not stop generate/)
  })
})
