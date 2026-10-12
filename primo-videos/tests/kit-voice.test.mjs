// node --test tests/   (sem rede) a voz é opcional e quem pede é o vídeo, não o kit: o kit new-video só liga a voz com
// --voice. As quatro combinações (kit com e sem voz aprovada × vídeo com e sem voz): onde ficam as falas (texts.json ou
// voice/v1/script.json), o que o REQUEST.md manda fazer, o que o video.mjs lê e a etapa voice do cronômetro. Nenhuma voz
// é gerada de verdade: a ElevenLabs é a falsa de tests/fake-api.mjs, em 127.0.0.1 (precisa do ffmpeg).
import { test, describe, before, after } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { spawn, spawnSync } from 'node:child_process'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { lerLocucao, lerRoteiroComoLocucao, conferirTextos } from '../scripts/tutorial/locucao.mjs'
import { subirApiFalsa } from './fake-api.mjs'

const AQUI = path.dirname(fileURLToPath(import.meta.url))
const KIT = path.join(AQUI, '..', 'scripts', 'kit.mjs')
const PROGRESSO = path.join(AQUI, '..', 'scripts', 'progress.mjs')
const VOZ = path.join(AQUI, '..', 'scripts', 'voice.mjs')
const CHAVE = 'sk_test_SECRET_0123456789abcdef'
const FALAS = { abertura: 'See the new button.', p1: 'Tap the new button on the home screen.', fechamento: 'Done. The button is live.' }
let base, marcas, api
const roda = (script, ...a) => spawnSync(process.execPath, [script, ...a], { encoding: 'utf8', env: { ...process.env, VIDEOSTUDIO_BRANDS: marcas } })
// o voice.mjs fala com a API falsa, que mora neste processo: não pode ser spawnSync
const voz = (...a) => new Promise((resolve) => {
  const casa = path.join(base, 'home')
  const p = spawn(process.execPath, [VOZ, ...a], { env: { PATH: process.env.PATH, HOME: casa, USERPROFILE: casa, ELEVENLABS_API_KEY: CHAVE, ELEVENLABS_API_BASE: api.url } })
  let tudo = ''
  p.stdout.on('data', (d) => (tudo += d)); p.stderr.on('data', (d) => (tudo += d))
  p.on('close', (code) => resolve({ code, tudo }))
})
const etapaVoz = (pasta) => JSON.parse(fs.readFileSync(path.join(pasta, 'progress.json'), 'utf8')).etapas.previa.find((x) => x.id === 'voice').estado
const lerJson = (arq) => JSON.parse(fs.readFileSync(arq, 'utf8'))

function videoAprovado(nome, { comVoz }) {
  const video = path.join(base, nome)
  fs.mkdirSync(path.join(video, 'recording'), { recursive: true })
  fs.writeFileSync(path.join(video, 'recording', 'base.mjs'), 'export const base = (o) => ({ versoes: [o.versao], url: o.origem + "/login" })\nexport const fechar = async () => 0\n')
  fs.writeFileSync(path.join(video, 'recording', 'recipe.json'), JSON.stringify({ url: 'https://example.com', inicio: '/' }))
  fs.writeFileSync(path.join(video, 'video.mjs'), `export default { id: '${nome}', titulo: 'Title', pasta: ${JSON.stringify(video)}, serie: '../serie', semente: 7, idioma: 'en-US', versoes: ['computer'], aparelhos: { computer: { viewport: { width: 1280, height: 800 }, dsf: 3, toque: false, formato: '16x9' } } }\n`)
  if (comVoz) {
    fs.mkdirSync(path.join(video, 'voice', 'v1'), { recursive: true })
    fs.writeFileSync(path.join(video, 'voice', 'v1', 'script.json'), JSON.stringify({ idioma: 'en-US', perfil: 'calmo', voz: { id: 'VOICE1', nome: 'Invented Voice', modelo: 'eleven_multilingual_v2' }, falas: [] }))
    fs.mkdirSync(path.join(video, 'voice', '_takes', 'abc123'), { recursive: true })
    fs.writeFileSync(path.join(video, 'voice', '_takes', 'abc123', 'take.mp3'), 'mp3')
    fs.writeFileSync(path.join(video, 'voice', '_takes', 'abc123', 'take.json'), '{}')
  }
  return video
}

/** O vídeo novo de um kit: a pasta, o que o comando disse, o pedido gerado e a fonte do video.mjs. */
function novo(kit, nome, ...flags) {
  const pasta = path.join(base, nome)
  const r = roda(KIT, 'new-video', kit, pasta, '--request', 'Show the new button', ...flags)
  assert.equal(r.status, 0, r.stderr)
  return { pasta, saida: r.stdout, pedido: fs.readFileSync(path.join(pasta, 'REQUEST.md'), 'utf8'), fonte: fs.readFileSync(path.join(pasta, 'video.mjs'), 'utf8') }
}
function escreverFalas(arq) {
  const j = lerJson(arq)
  for (const f of j.falas) f.texto = FALAS[f.id]
  fs.writeFileSync(arq, JSON.stringify(j, null, 2))
}
const semFalas = (pasta) => import(pathToFileURL(path.join(pasta, 'video.mjs')).href)
const comFalas = async (pasta) => (await import(`${pathToFileURL(path.join(pasta, 'video.mjs')).href}?falas`)).default

/** O vídeo sem voz: as falas em texts.json, nada de voice/, e o pedido, o video.mjs e o cronômetro dizem o mesmo. */
async function confereSemVoz(v) {
  assert.match(v.saida, /created with the kit \(series computer-16x9-en, without voice\)/)
  assert.match(v.saida, /only missing: recording\/journey\.mjs and texts\.json/)
  assert.ok(fs.existsSync(path.join(v.pasta, 'texts.json')))
  assert.ok(!fs.existsSync(path.join(v.pasta, 'voice')), 'no voice folder')
  assert.doesNotMatch(v.pedido, /<!--|\{\{/)
  assert.match(v.pedido, /Write the texts in `texts\.json`/)
  assert.doesNotMatch(v.pedido, /voice\/v1|voice\.mjs|narration\.json/, 'the request of a video without voice does not send anyone to the voice files')
  assert.doesNotMatch(v.fonte, /narration\.json|voice\/v1|'voice'/)
  await assert.rejects(semFalas(v.pasta), /write the lines abertura, p1, fechamento in texts\.json/)
  escreverFalas(path.join(v.pasta, 'texts.json'))
  const video = await comFalas(v.pasta)
  assert.ok(fs.existsSync(path.join(video.serie, 'series.json')), `the kit series, from video.mjs: ${video.serie}`)
  assert.equal(video.voz, undefined)
  assert.equal(video.titulo, FALAS.abertura)
  assert.equal(etapaVoz(v.pasta), 'pulada', 'the stopwatch has no voice stage')
}

/** O vídeo com voz: as falas em voice/v1/script.json, e o pedido, o video.mjs, o --check do gravador e o cronômetro
 *  leem de lá. Devolve o video.mjs carregado e o caminho do roteiro. */
async function confereComVoz(v) {
  const script = path.join(v.pasta, 'voice', 'v1', 'script.json')
  assert.match(v.saida, /only missing: recording\/journey\.mjs and voice\/v1\/script\.json/)
  assert.ok(fs.existsSync(script))
  assert.ok(!fs.existsSync(path.join(v.pasta, 'texts.json')))
  assert.doesNotMatch(v.pedido, /<!--|\{\{/)
  assert.match(v.pedido, /Write the lines in `voice\/v1\/script\.json`, not in `texts\.json`/)
  assert.doesNotMatch(v.pedido, /Write the texts in `texts\.json`/)
  // os comandos da voz saem com o caminho pronto
  assert.ok(v.pedido.includes(`voice.mjs review ${script}`), 'review with the path')
  assert.ok(v.pedido.includes(`voice.mjs generate ${script} --out ${path.dirname(script)}`), 'generate with the path')
  assert.match(v.fonte, /voz: \{ locucao: 'voice\/v1\/narration\.json', roteiro: 'voice\/v1\/script\.json', perfil: 'calmo' \}/)
  await assert.rejects(semFalas(v.pasta), /write the lines abertura, p1, fechamento in voice\/v1\/script\.json/)
  escreverFalas(script)
  const video = await comFalas(v.pasta)
  assert.ok(fs.existsSync(path.join(video.serie, 'series.json')), `the kit series, from video.mjs: ${video.serie}`)
  assert.deepEqual(video.voz, { locucao: 'voice/v1/narration.json', roteiro: 'voice/v1/script.json', perfil: 'calmo' })
  // antes de a voz existir, o --check do gravador lê as falas de onde o kit as pôs, e a abertura é o título
  const rot = lerRoteiroComoLocucao(video, 'computer')
  assert.deepEqual([rot.abertura.texto, rot.passos.get(1).texto, rot.fechamento.texto], Object.values(FALAS))
  conferirTextos(rot, video)
  const rev = await voz('review', script)
  assert.equal(rev.code, 0, rev.tudo)
  assert.equal(etapaVoz(v.pasta), 'pendente', 'the stopwatch counts the voice')
  return { video, script }
}

before(async () => {
  base = fs.mkdtempSync(path.join(os.tmpdir(), 'kit-voice-'))
  marcas = path.join(base, 'Brands')
  const serie = path.join(base, 'serie')
  fs.mkdirSync(path.join(serie, 'fonts'), { recursive: true })
  fs.writeFileSync(path.join(serie, 'series.json'), JSON.stringify({ versao: 2 }))
  fs.writeFileSync(path.join(serie, 'brand.js'), 'const MARCA = {}\n')
  fs.writeFileSync(path.join(serie, 'identity.json'), JSON.stringify({ genero: 'house', papel: 'fundo', bpm: [120, 122] }))
  assert.equal(roda(KIT, 'save', 'No Voice', '--from', videoAprovado('silent', { comVoz: false })).status, 0)
  assert.equal(roda(KIT, 'save', 'With Voice', '--from', videoAprovado('voiced', { comVoz: true })).status, 0)
  api = await subirApiFalsa({ chave: CHAVE })
  api.estado.vozes.VOICE1 = { voice_id: 'VOICE1', name: 'Invented Voice', category: 'professional', is_owner: false, sharing: { disable_at_unix: null, notice_period: 365 } }
})
after(async () => { await api.fechar(); fs.rmSync(base, { recursive: true, force: true }) })

describe('kit new-video: the voice is the video\'s choice (--voice), never the kit\'s', () => {
  test('kit without voice × video without voice: texts.json, as always (the default, and --no-voice says the same)', async () => {
    assert.equal(lerJson(path.join(marcas, 'no-voice', 'kit', 'kit.json')).voz, null)
    const v = novo('No Voice', 'silent-kit-silent-video')
    await confereSemVoz(v)
    assert.doesNotMatch(v.saida + v.pedido, /approved voice/, 'nothing to offer: the kit has no voice')
    await confereSemVoz(novo('No Voice', 'silent-kit-no-voice-flag', '--no-voice'))
  })

  test('kit without voice × video with voice (--voice): the voice script without a voice yet, and generate refuses before spending', async () => {
    const v = novo('No Voice', 'silent-kit-voiced-video', '--voice')
    assert.match(v.saida, /with a voiceover, the voice still to be chosen/)
    const { script } = await confereComVoz(v)
    const rot = lerJson(script)
    assert.deepEqual({ idioma: rot.idioma, perfil: rot.perfil, voz: rot.voz }, { idioma: 'en-US', perfil: 'calmo', voz: undefined })
    assert.ok(!fs.existsSync(path.join(v.pasta, 'voice', '_takes')), 'no takes: the kit has no cache')
    // o pedido manda escolher a voz de ouvido, com o caminho pronto
    assert.match(v.pedido, /The kit has no approved voice yet/)
    assert.ok(v.pedido.includes(`voice.mjs samples --script ${script} --voices`), 'samples with the path')
    api.zerar()
    const g = await voz('generate', script, '--out', path.dirname(script))
    assert.notEqual(g.code, 0)
    assert.match(g.tudo, /voz\.id: the chosen voice is missing/)
    assert.equal(api.pedidos.length, 0, 'no call before the voice is chosen')
  })

  test('kit with voice × video without voice: the default leaves the kit\'s voice out, and says how to ask for it', async () => {
    assert.equal(lerJson(path.join(marcas, 'with-voice', 'kit', 'kit.json')).voz.id, 'VOICE1')
    const v = novo('With Voice', 'voiced-kit-silent-video')
    await confereSemVoz(v)
    assert.match(v.saida, /the kit holds an approved voice \(Invented Voice\).*--voice/)
    assert.match(v.pedido, /The kit holds an approved voice \(Invented Voice \(VOICE1, eleven_multilingual_v2\)\)[\s\S]*`--voice`/)
    // com --no-voice a pessoa já escolheu: o comando não oferece a voz de novo (o pedido continua dizendo que ela existe)
    const calado = novo('With Voice', 'voiced-kit-no-voice-flag', '--no-voice')
    await confereSemVoz(calado)
    assert.doesNotMatch(calado.saida, /approved voice/)
    assert.match(calado.pedido, /The kit holds an approved voice/)
    // um vídeo sem voz aprovado e salvo de volta não apaga a voz que o kit guardou
    assert.equal(roda(KIT, 'save', 'With Voice', '--from', videoAprovado('approved-silent', { comVoz: false })).status, 0)
    assert.equal(lerJson(path.join(marcas, 'with-voice', 'kit', 'kit.json')).voz.id, 'VOICE1')
  })

  test('kit with voice × video with voice (--voice): the kit\'s voice and takes, and the generated narration is where video.mjs reads it', async () => {
    const v = novo('With Voice', 'voiced-kit-voiced-video', '--voice')
    assert.match(v.saida, /with the kit's voice \(Invented Voice\), 1 voice take\(s\) in the cache/)
    const { video, script } = await confereComVoz(v)
    assert.deepEqual(lerJson(script).voz, { id: 'VOICE1', nome: 'Invented Voice', modelo: 'eleven_multilingual_v2' })
    assert.ok(fs.existsSync(path.join(v.pasta, 'voice', '_takes', 'abc123', 'take.json')), 'the kit takes in the video cache')
    assert.match(v.pedido, /The voice is the kit's approved one, Invented Voice \(VOICE1, eleven_multilingual_v2\)[\s\S]*1\s+approved take\(s\)/)
    assert.doesNotMatch(v.pedido, /no approved voice yet|voice\.mjs samples/)
    // ponta a ponta, contra a API falsa: o generate do pedido escreve a narração que o motor aceita
    api.zerar()
    const g = await voz('generate', script, '--out', path.dirname(script))
    assert.equal(g.code, 0, g.tudo)
    assert.deepEqual(api.tts().map((p) => p.json.text), Object.values(FALAS))
    const loc = lerLocucao(video, 'computer')
    assert.equal(loc.rel, path.join('voice', 'v1', 'narration.json'))
    assert.deepEqual([loc.abertura.texto, loc.passos.get(1).texto, loc.fechamento.texto], Object.values(FALAS))
    conferirTextos(loc, video)
  })

  test('--voice with --no-voice is refused, and nothing is created', () => {
    const pasta = path.join(base, 'both-flags')
    const r = roda(KIT, 'new-video', 'With Voice', pasta, '--request', 'x', '--voice', '--no-voice')
    assert.equal(r.status, 2)
    assert.match(r.stderr, /--voice or --no-voice, not both/)
    assert.ok(!fs.existsSync(pasta))
  })

  test('a copy of the skill without the voice module refuses --voice, says what to do and creates nothing', () => {
    const copia = path.join(base, 'skill-without-voice', 'scripts')
    fs.mkdirSync(copia, { recursive: true })
    fs.copyFileSync(KIT, path.join(copia, 'kit.mjs'))
    fs.cpSync(path.join(path.dirname(KIT), 'kit'), path.join(copia, 'kit'), { recursive: true })
    const pasta = path.join(base, 'no-module')
    const r = roda(path.join(copia, 'kit.mjs'), 'new-video', 'With Voice', pasta, '--request', 'x', '--voice')
    assert.equal(r.status, 2)
    assert.match(r.stderr, /has no voice module \(scripts\/tutorial\/locucao\.mjs is missing\).*without --voice/)
    assert.ok(!fs.existsSync(pasta))
  })
})

describe('progress.mjs start', () => {
  test('without --voice the voice stage is skipped; with it, it counts', () => {
    const sem = path.join(base, 'progress-silent'), com = path.join(base, 'progress-voiced')
    assert.equal(roda(PROGRESSO, 'start', sem).status, 0)
    assert.equal(etapaVoz(sem), 'pulada')
    assert.equal(roda(PROGRESSO, 'start', com, '--voice').status, 0)
    assert.equal(etapaVoz(com), 'pendente')
  })
})
