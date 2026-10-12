// voice.mjs listen --mix: a transcrição do MP4 final contra o roteiro. Sem rede: uma transcrição montada aqui, no
// formato da resposta da API, e a API falsa em 127.0.0.1; precisa do ffmpeg.
// node --test tests/voice-mix.test.mjs
import { test, describe, before, after } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { spawn, execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { julgarMix, falasParaOuvir, faltasNaEscuta, alinharFichas } from '../scripts/voice.mjs'
import { readCosts } from '../scripts/costs.mjs'
import { subirApiFalsa } from './fake-api.mjs'

const AQUI = path.dirname(fileURLToPath(import.meta.url))
const VOZ = path.join(AQUI, '..', 'scripts', 'voice.mjs')
const CHAVE = 'sk_test_SECRET_0123456789abcdef'
const TEXTO = 'Pick a seat on the map. In seconds, the ticket shows up.'
const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'voice-mix-'))
const escrever = (arq, dados) => { fs.mkdirSync(path.dirname(arq), { recursive: true }); fs.writeFileSync(arq, JSON.stringify(dados, null, 1)) }
const fala = (id, texto, ditos = {}) => ({ id, palavras: texto.split(' ').map((t) => ({ texto: t, ...(ditos[t] ? { dito: ditos[t] } : {}) })) })
// uma resposta no formato da API a partir de pedaços [texto, início, fim]
const resposta = (...ps) => ({ language_code: 'eng', text: ps.map((p) => p[0]).join(' '), words: ps.flatMap(([t, a, b], i) => [...(i ? [{ text: ' ', start: a, end: a, type: 'spacing' }] : []), { text: t, start: a, end: b, type: 'word' }]) })
// a transcrição do mix inteiro, com a pausa entre as duas frases
const OUVIDO = resposta(['Pick', 1.0, 1.2], ['a', 1.22, 1.28], ['seat', 1.3, 1.6], ['on', 1.62, 1.72], ['the', 1.74, 1.82], ['map.', 1.84, 2.2],
  ['In', 2.8, 2.9], ['seconds,', 2.92, 3.4], ['the', 3.42, 3.5], ['ticket', 3.52, 3.9], ['shows', 3.92, 4.2], ['up.', 4.22, 4.5])
// a mesma transcrição sem algumas palavras (pela posição na lista de palavras)
const sem = (...tirar) => {
  const ws = OUVIDO.words.filter((w) => w.type === 'word').filter((_, i) => !tirar.includes(i))
  return resposta(...ws.map((w) => [w.text, w.start, w.end]))
}

describe('julgarMix', () => {
  test('the mixed video: the 12 words heard, the risk ones too, it goes to the person', () => {
    const j = julgarMix([fala('s1', TEXTO)], OUVIDO, ['map', 'ticket'])
    assert.equal(j.total, 12)
    assert.equal(j.ouvidas, 12)
    assert.equal(j.reprovou, false)
    assert.deepEqual(j.riscos, ['map.', 'ticket'])
    assert.deepEqual(j.trechos, [])
  })

  test('three words in a row lost (an effect on top): fails and says between which times', () => {
    const j = julgarMix([fala('s1', TEXTO)], sem(6, 7, 8))
    assert.equal(j.reprovou, true)
    assert.equal(j.ouvidas, 9)
    assert.deepEqual(j.trechos, [{ falas: ['s1'], palavras: ['In', 'seconds,', 'the'], risco: [], de: 2.2, ate: 3.52 }])
    assert.match(j.motivos.join(' | '), /75% of the script's words heard, below 90%/)
    assert.match(j.motivos.join(' | '), /1 stretch\(es\) with 3 or more words in a row lost/)
  })

  test('a common word lost: 91.7% passes, and the stretch shows up; if it is a risk word, it fails', () => {
    const j = julgarMix([fala('s1', TEXTO)], sem(9))
    assert.equal(j.reprovou, false)
    assert.equal(Math.round(j.pct * 1000), 917)
    assert.deepEqual(j.trechos.map((t) => [t.palavras, t.de, t.ate]), [[['ticket'], 3.5, 3.92]])
    const r = julgarMix([fala('s1', TEXTO)], sem(9), ['Ticket'])
    assert.equal(r.reprovou, true)
    assert.deepEqual(r.faltaRisco, ['ticket'])
  })

  test('threshold: below 90% fails even without a long stretch or a risk word', () => {
    const j = julgarMix([fala('s1', TEXTO)], sem(1, 11))
    assert.equal(Math.round(j.pct * 1000), 833)
    assert.equal(j.reprovou, true)
    assert.equal(julgarMix([fala('s1', TEXTO)], sem(1, 11), [], { limiar: 0.8 }).reprovou, false)
  })

  test('a number spelled out in the script and digits in the transcription, and the other way around (Portuguese)', () => {
    const f = fala('c1', 'São sete mil cento e vinte e nove seguidores e 70 no TikTok.')
    const j = julgarMix([f], resposta(['São', 1, 1.2], ['7.129', 1.2, 2], ['seguidores', 2, 2.5], ['e', 2.5, 2.6], ['setenta', 2.6, 3], ['no', 3, 3.1], ['TikTok.', 3.1, 3.5]))
    assert.equal(j.ouvidas, j.total, JSON.stringify(j.trechos))
  })

  test('the spoken word instead of the written one, the one glued to its neighbour and the address with one letter less', () => {
    const f = fala('c1', 'Open Vyrta and the Acme Notes at acmenotes.com/7 now.', { Vyrta: 'Veerta' })
    const j = julgarMix([f], resposta(['Open', 0, 0.2], ['Veerta', 0.2, 0.6], ['and', 0.6, 0.7], ['the', 0.7, 0.8], ['AcmeNotes', 0.8, 1.2], ['at', 1.2, 1.3], ['acmnotes.com/7', 1.3, 2], ['now.', 2, 2.3]))
    assert.equal(j.ouvidas, j.total, JSON.stringify(j.trechos))
    assert.equal(j.reprovou, false)
  })

  test('the video plays the pieces of a line out of order: counts, and the lost one still has a time', () => {
    const f = fala('c04', 'Your numbers on top, added in one total. Paste the link the way it comes.')
    const ouv = resposta(['Paste', 0.9, 1.1], ['the', 1.1, 1.2], ['link', 1.2, 1.5], ['the', 1.5, 1.6], ['way', 1.6, 1.9], ['it', 1.9, 2], ['comes.', 2, 2.4],
      ['Your', 6.4, 6.6], ['numbers', 6.6, 7], ['on', 7, 7.1], ['top,', 7.1, 7.4], ['added', 7.6, 8], ['one', 8.3, 8.5], ['total.', 8.5, 8.9])
    const j = julgarMix([f], ouv)
    assert.equal(j.ouvidas, j.total - 1)
    assert.deepEqual(j.trechos.map((t) => [t.palavras, t.de, t.ate]), [[['in'], 8, 8.3]])
  })

  test('falasParaOuvir reads the script (with the pronunciation becoming "dito") and the narration', () => {
    const d = tmp()
    escrever(path.join(d, 'script.json'), { idioma: 'en-US', perfil: 'reels', pronuncia: { Vyrta: 'Veerta' }, falas: [{ id: 'c1', onde: { capitulo: 1 }, texto: '[warm] Open the Vyrta.' }] })
    assert.deepEqual(falasParaOuvir(path.join(d, 'script.json')), { idioma: 'en-US', falas: [{ id: 'c1', palavras: [{ texto: 'Open' }, { texto: 'the' }, { texto: 'Vyrta.', dito: 'Veerta.' }] }] })
    escrever(path.join(d, 'narration.json'), { versao: 1, idioma: 'en-US', falas: [{ id: 'c1', palavras: [{ texto: 'Open', ini: 0, fim: 1 }, { texto: 'Vyrta.', ini: 1, fim: 2, dito: 'Veerta.' }] }] })
    assert.deepEqual(falasParaOuvir(path.join(d, 'narration.json')).falas, [{ id: 'c1', palavras: [{ texto: 'Open' }, { texto: 'Vyrta.', dito: 'Veerta.' }] }])
  })

  test('alinharFichas gives the index of each token, and faltasNaEscuta stays the same', () => {
    assert.deepEqual(alinharFichas(['a', 'b', 'c'], ['a', 'x', 'c']), [0, -1, 2])
    assert.deepEqual(faltasNaEscuta(['a', 'b', 'c'], ['a', 'x', 'c']), [true, false, true])
  })
})

function rodar(args, env) {
  return new Promise((resolve) => {
    const casa = tmp()
    const p = spawn(process.execPath, [VOZ, ...args], { env: { PATH: process.env.PATH, HOME: casa, USERPROFILE: casa, ELEVENLABS_API_KEY: CHAVE, ...env } })
    let out = '', err = ''
    p.stdout.on('data', (d) => (out += d)); p.stderr.on('data', (d) => (err += d))
    p.on('close', (code) => resolve({ code, out, err, tudo: out + err }))
  })
}
const mp4 = (arq, { audio = true } = {}) => execFileSync('ffmpeg', ['-hide_banner', '-v', 'error', '-y', '-f', 'lavfi', '-i', 'color=c=black:s=64x64:d=1',
  ...(audio ? ['-f', 'lavfi', '-i', 'sine=frequency=220:duration=1', '-c:a', 'aac'] : []), '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-shortest', arq])

describe('voice.mjs listen --mix against the fake API', () => {
  let api, env, d, rot
  before(async () => {
    api = await subirApiFalsa({ chave: CHAVE })
    env = { ELEVENLABS_API_BASE: api.url }
    d = tmp()
    rot = path.join(d, 'voice', 'script.json')
    escrever(rot, { idioma: 'en-US', perfil: 'reels', voz: { id: 'v1' }, pronuncia: {}, falas: [{ id: 's1', onde: { capitulo: 1 }, texto: TEXTO }] })
    mp4(path.join(d, 'demo-9x16.mp4'))
  })
  after(() => api.fechar())

  test('passes: a single call, no keyterms, in the script language; writes the .md and the transcription next to the MP4, and notes the cost', async () => {
    api.estado.ouvido['demo-9x16.wav'] = OUVIDO
    api.zerar()
    const r = await rodar(['listen', '--mix', path.join(d, 'demo-9x16.mp4'), '--script', rot, '--words', 'map,ticket'], env)
    assert.equal(r.code, 0, r.tudo)
    const stt = api.pedidos.filter((p) => p.caminho === '/v1/speech-to-text')
    assert.equal(api.pedidos.length, 1)
    assert.deepEqual([stt[0].modelo, stt[0].idioma, stt[0].keyterms], ['scribe_v2', 'en', null])
    assert.match(r.out, /demo-9x16\.mp4: 1\.0 s of audio · estimated cost ~1 credit\(s\)/)
    assert.match(r.out, /✓ mix: 12 of 12 script words heard \(100%, threshold 90%\) · risk: 2 of 2 heard/)
    const md = fs.readFileSync(path.join(d, 'demo-9x16.heard-mix.md'), 'utf8')
    assert.match(md, /\| verdict \| ✓ goes to the person \|/)
    assert.deepEqual(JSON.parse(fs.readFileSync(path.join(d, 'demo-9x16.heard-mix.json'), 'utf8')), OUVIDO)
    assert.ok(!r.tudo.includes(CHAVE))
    const g = readCosts(d)
    assert.equal(g.length, 1)
    assert.deepEqual([g[0].kind, g[0].model, g[0].credits], ['voice', 'scribe_v2', 2])
  })

  test('fails with code 1: the stretch and the time where it lost words, and what to do', async () => {
    api.estado.ouvido['demo-9x16.wav'] = sem(6, 7, 8)
    const r = await rodar(['listen', '--mix', path.join(d, 'demo-9x16.mp4'), '--script', rot], env)
    assert.equal(r.code, 1, r.tudo)
    assert.match(r.out, /✗ mix: 9 of 12 script words heard \(75%, threshold 90%\) · does not go to the person/)
    assert.match(r.out, /lost between 2\.20 s and 3\.52 s \(s1\): "In seconds, the"/)
    assert.match(r.out, /lower the soundtrack under the speech/)
    assert.match(r.out, /remove the marker or move it/)
    assert.match(r.out, /Redo the mix/)
    assert.match(fs.readFileSync(path.join(d, 'demo-9x16.heard-mix.md'), 'utf8'), /\| between 2\.20 s and 3\.52 s \| s1 \| In seconds, the \| — \|/)
  })

  test('the narration instead of the script, --line and --threshold; a video without audio and a wrong usage say what to do', async () => {
    api.estado.ouvido['demo-9x16.wav'] = sem(1, 11)
    const loc = path.join(d, 'voice', 'narration.json')
    escrever(loc, { versao: 1, idioma: 'en-US', falas: [{ id: 's1', palavras: TEXTO.split(' ').map((t) => ({ texto: t })) }, { id: 's2', palavras: [{ texto: 'Outside.' }] }] })
    assert.equal((await rodar(['listen', '--mix', path.join(d, 'demo-9x16.mp4'), '--script', loc, '--line', 's1'], env)).code, 1)
    assert.equal((await rodar(['listen', '--mix', path.join(d, 'demo-9x16.mp4'), '--script', loc, '--line', 's1', '--threshold', '80'], env)).code, 0)
    mp4(path.join(d, 'silent.mp4'), { audio: false })
    api.zerar()
    const mudo = await rodar(['listen', '--mix', path.join(d, 'silent.mp4'), '--script', rot], env)
    assert.equal(mudo.code, 1)
    assert.match(mudo.err, /Does the video have an audio track\?/)
    assert.equal(api.pedidos.length, 0)
    const uso = await rodar(['listen', '--mix', path.join(d, 'demo-9x16.mp4')], env)
    assert.equal(uso.code, 2)
    assert.match(uso.err, /usage: voice\.mjs listen --mix/)
  })
})
