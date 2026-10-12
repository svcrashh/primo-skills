// node --test tests/   (sem rede: a API é a falsa, em 127.0.0.1; precisa do ffmpeg)
// A voz em off (scripts/voice.mjs): texto, pronúncia, cache de take, Contrato L, o caderno de gastos (teto antes de
// chamar, custo real depois), a chave que nunca aparece, a conta inativa, o JSON do painel e o script pelo link.
import { test, describe, before, after } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import {
  aplicarPronuncia, palavrasDoAlinhamento, agrupar, montarFala, inicioVoz, chaveTake, lerRoteiro, planejar,
  validarLocucao, motivoFora, comoPorChave, lerWav, mp3ParaWav, limparInicio, Falha, julgarEscuta, porExtenso,
  marcacoes, ditasForcadas, medirAudio, MODELO, acharProjeto, avisoConta, contaAtiva, quadroDaVoz,
} from '../scripts/voice.mjs'
import { readCosts, writeCaps } from '../scripts/costs.mjs'
import { subirApiFalsa, alinhamentoFalso } from './fake-api.mjs'

const AQUI = path.dirname(fileURLToPath(import.meta.url))
const VOZ = path.join(AQUI, '..', 'scripts', 'voice.mjs')
const CHAVE = 'sk_test_SECRET_0123456789abcdef'
const tmp = (nome) => fs.mkdtempSync(path.join(os.tmpdir(), `voice-${nome}-`))
const escrever = (arq, dados) => { fs.mkdirSync(path.dirname(arq), { recursive: true }); fs.writeFileSync(arq, typeof dados === 'string' || Buffer.isBuffer(dados) ? dados : JSON.stringify(dados, null, 1)) }

function wavSintetico(arq, { silencio = 0.25, tom = 1.0, taxa = 48000, canais = 1 } = {}) {
  const n = Math.round((silencio + tom) * taxa)
  const b = Buffer.alloc(44 + n * 2 * canais)
  b.write('RIFF', 0); b.writeUInt32LE(36 + n * 2 * canais, 4); b.write('WAVE', 8); b.write('fmt ', 12)
  b.writeUInt32LE(16, 16); b.writeUInt16LE(1, 20); b.writeUInt16LE(canais, 22); b.writeUInt32LE(taxa, 24)
  b.writeUInt32LE(taxa * 2 * canais, 28); b.writeUInt16LE(2 * canais, 32); b.writeUInt16LE(16, 34); b.write('data', 36); b.writeUInt32LE(n * 2 * canais, 40)
  for (let i = 0; i < n; i++) {
    const t = i / taxa
    const v = t < silencio ? 0 : Math.round(16000 * Math.sin(2 * Math.PI * 220 * (t - silencio)))
    for (let c = 0; c < canais; c++) b.writeInt16LE(v, 44 + (i * canais + c) * 2)
  }
  escrever(arq, b)
  return n / taxa
}

function rodar(args, { env = {}, semChave = false, home, script = VOZ } = {}) {
  return new Promise((resolve) => {
    const casa = home || tmp('home')
    const e = { PATH: process.env.PATH, HOME: casa, USERPROFILE: casa, ...env }
    if (!semChave && !e.ELEVENLABS_API_KEY) e.ELEVENLABS_API_KEY = CHAVE
    const p = spawn(process.execPath, [script, ...args], { env: e })
    let out = '', err = ''
    p.stdout.on('data', (d) => (out += d)); p.stderr.on('data', (d) => (err += d))
    p.on('close', (code) => resolve({ code, out, err, tudo: out + err }))
  })
}

// todo arquivo de texto de uma pasta, para conferir que a chave não foi gravada em lugar nenhum
const textos = (dir) => fs.readdirSync(dir, { recursive: true }).map((f) => path.join(dir, f)).filter((f) => fs.statSync(f).isFile() && /\.(json|jsonl|md|srt|txt)$/.test(f)).map((f) => fs.readFileSync(f, 'utf8')).join('\n')

// ── unidade ──────────────────────────────────────────────────────────────────────────────────────
describe('text, pronunciation and words', () => {
  test('words come out split by spaces, with the punctuation attached', () => {
    const p = palavrasDoAlinhamento(alinhamentoFalso('Tap Save.'))
    assert.deepEqual(p.map((x) => x.texto), ['Tap', 'Save.'])
    assert.equal(p[0].ini, 0)
  })

  test('pronunciation: the voice gets the swap, the caption keeps the script text (invented case)', () => {
    const pr = aplicarPronuncia('Export the PDF in Vyrta.', { PDF: 'pee dee eff', Vyrta: 'Veerta' })
    assert.equal(pr.falado, 'Export the pee dee eff in Veerta.')
    assert.deepEqual(pr.grupos, [1, 1, 3, 1, 1])
    assert.deepEqual(pr.usadas, { PDF: 'pee dee eff', Vyrta: 'Veerta' })
    const ditas = palavrasDoAlinhamento(alinhamentoFalso(pr.falado))
    const pal = agrupar(ditas, pr.grupos, pr.exibidas)
    assert.deepEqual(pal.map((x) => x.texto), ['Export', 'the', 'PDF', 'in', 'Vyrta.'])
    assert.equal(pal[2].ini, ditas[2].ini, '"PDF" lights up when "pee" starts')
    assert.equal(pal[2].fim, ditas[4].fim, 'and goes off when "eff" ends')
  })

  test('pronunciation: the key is the word without punctuation and with the same case', () => {
    assert.equal(aplicarPronuncia('Open the (PDF), not the pdf.', { PDF: 'pee dee eff' }).falado, 'Open the (pee dee eff), not the pdf.')
    assert.equal(aplicarPronuncia('  Many   spaces  ', {}).falado, 'Many spaces')
  })

  test('agrupar refuses when the alignment does not match the text', () => {
    assert.equal(agrupar([{ ini: 0, fim: 1 }], [1, 1], ['a', 'b']), null)
  })
})

describe('audio', () => {
  test('inicio_voz: the first 10 ms RMS above −45 dBFS', () => {
    const d = tmp('wav')
    wavSintetico(path.join(d, 'a.wav'), { silencio: 0.25 })
    const w = lerWav(path.join(d, 'a.wav'))
    const iv = inicioVoz(w.amostras, w.taxa)
    assert.ok(iv >= 0.239 && iv <= 0.25, `measured ${iv}`)
  })

  function wavComEstalo(arq, { estalo = 0.015, nivelDb = -40, silencio = 0.075, taxa = 48000 } = {}) {
    const n = Math.round((estalo + silencio + 1) * taxa), x = new Int16Array(n)
    const amp = 32768 * 10 ** (nivelDb / 20) * Math.SQRT2
    for (let i = 0; i < n; i++) {
      const t = i / taxa
      x[i] = t < estalo ? Math.round(amp * Math.sin(2 * Math.PI * 3000 * t)) : t < estalo + silencio ? 0 : Math.round(16000 * Math.sin(2 * Math.PI * 220 * t))
    }
    const b = Buffer.alloc(44 + n * 2)
    b.write('RIFF', 0); b.writeUInt32LE(36 + n * 2, 4); b.write('WAVE', 8); b.write('fmt ', 12); b.writeUInt32LE(16, 16); b.writeUInt16LE(1, 20)
    b.writeUInt16LE(1, 22); b.writeUInt32LE(taxa, 24); b.writeUInt32LE(taxa * 2, 28); b.writeUInt16LE(2, 32); b.writeUInt16LE(16, 34); b.write('data', 36); b.writeUInt32LE(n * 2, 40)
    Buffer.from(x.buffer).copy(b, 44)
    escrever(arq, b)
    return estalo + silencio
  }

  test('a short click before the silence, at the start: zeroed, and the first sound becomes the voice', () => {
    const d = tmp('click'), arq = path.join(d, 'a.wav')
    const voz = wavComEstalo(arq)
    let w = lerWav(arq)
    assert.ok(inicioVoz(w.amostras, w.taxa) < 0.005, 'without cleaning, the click fools the measure')
    const zerado = limparInicio(arq)
    assert.ok(zerado > 0.06 && zerado <= voz, `zeroed ${zerado} s`)
    w = lerWav(arq)
    const iv = inicioVoz(w.amostras, w.taxa)
    assert.ok(iv > voz - 0.012 && iv <= voz, `first sound ${iv}, voice at ${voz}`)
    assert.equal(w.n, Math.round((voz + 1) * 48000), 'the duration does not change')
  })

  test('does not zero what may be speech: a long burst, or one followed by a short pause', () => {
    const d = tmp('click')
    for (const [nome, o] of [['long', { estalo: 0.08 }], ['short-pause', { silencio: 0.03 }]]) {
      const arq = path.join(d, `${nome}.wav`)
      wavComEstalo(arq, o)
      const antes = fs.readFileSync(arq)
      assert.equal(limparInicio(arq), 0, nome)
      assert.ok(fs.readFileSync(arq).equals(antes), nome)
    }
  })

  test('inicio_voz of a silent file is null', () => {
    assert.equal(inicioVoz(new Int16Array(48000), 48000), null)
  })

  test('mp3ParaWav gives a 16-bit PCM WAV, 48 kHz, mono', () => {
    const d = tmp('mp3')
    wavSintetico(path.join(d, 'a.wav'), { taxa: 44100, canais: 2 })
    mp3ParaWav(path.join(d, 'a.wav'), path.join(d, 'b.wav'))
    const w = lerWav(path.join(d, 'b.wav'))
    assert.deepEqual([w.pcm16, w.taxa, w.canais], [true, 48000, 1])
  })
})

describe('cache', () => {
  const base = { texto: 'Tap Save.', voz: 'v1', modelo: 'm', ajustes: { speed: 1, stability: 0.5 }, formato: 'mp3_44100_128', anterior: 'a', seguinte: 'b', dicionario: {} }
  test('the key does not depend on the order of the fields', () => {
    assert.equal(chaveTake(base), chaveTake({ ...base, ajustes: { stability: 0.5, speed: 1 } }))
  })
  test('the key changes with everything that changes the sound', () => {
    const k = chaveTake(base)
    for (const [campo, valor] of [['texto', 'Tap Send.'], ['voz', 'v2'], ['modelo', 'other'], ['ajustes', { speed: 1.1, stability: 0.5 }],
      ['formato', 'mp3_44100_192'], ['anterior', 'x'], ['seguinte', 'y'], ['dicionario', { PDF: 'pee dee eff' }]]) {
      assert.notEqual(chaveTake({ ...base, [campo]: valor }), k, campo)
    }
  })
})

describe('script', () => {
  const r = (dados) => { const d = tmp('script'); escrever(path.join(d, 'r.json'), dados); return path.join(d, 'r.json') }
  const ok = { idioma: 'en-US', perfil: 'calmo', voz: { id: 'v1' }, falas: [
    { id: 'fechamento', onde: 'fechamento', texto: 'Done.' }, { id: 'p2', onde: { passo: 2 }, texto: 'Pick the time.' },
    { id: 'abertura', onde: 'abertura', texto: 'Booking a ride.' }, { id: 'p1', onde: { passo: 1 }, texto: 'Tap   on Book.' }] }

  test('orders as the video speaks and applies the profile; the default model is multilingual v2', () => {
    const rot = lerRoteiro(r(ok))
    assert.deepEqual(rot.falas.map((f) => f.id), ['abertura', 'p1', 'p2', 'fechamento'])
    assert.equal(rot.falas[1].texto, 'Tap on Book.')
    assert.equal(rot.ajustes.speed, 0.95)
    assert.equal(rot.modelo, MODELO)
    assert.equal(MODELO, 'eleven_multilingual_v2')
    const pl = planejar(rot)
    assert.equal(pl[1].pedido.anterior, 'Booking a ride.')
    assert.equal(pl[1].pedido.seguinte, 'Pick the time.')
    assert.equal(pl[0].pedido.anterior, '')
  })

  test('voz.modelo picks another model', () => {
    assert.equal(lerRoteiro(r({ ...ok, voz: { id: 'v1', modelo: 'eleven_v3' } })).modelo, 'eleven_v3')
  })

  test('refuses a script with problems and says which', () => {
    const ruim = { idioma: 'en-US', perfil: 'fast', falas: [{ id: 'p1', onde: { passo: 1 }, texto: 'a' }, { id: 'p1', onde: { passo: 1 }, texto: '' }], pronuncia: { 'two words': 'x' }, ajustes: { speed: 2 } }
    assert.throws(() => lerRoteiro(r(ruim)), (e) => e instanceof Falha && /perfil/.test(e.message) && /voz\.id/.test(e.message) && /repeated id/.test(e.message)
      && /step 1 appears in more than one line/.test(e.message) && /the text is missing/.test(e.message) && /a single word/.test(e.message) && /speed/.test(e.message))
  })

  test('chapter video: { capitulo: n } orders like passo, and does not mix with passo', () => {
    const cap = { idioma: 'en-US', perfil: 'reels', voz: { id: 'v1' }, falas: [
      { id: 'closing', onde: 'fechamento', texto: 'All live.' }, { id: 'c2', onde: { capitulo: 2 }, texto: 'New colors.' },
      { id: 'open', onde: 'abertura', texto: 'What is new.' }, { id: 'c1', onde: { capitulo: 1 }, texto: 'New layouts.' }] }
    assert.deepEqual(lerRoteiro(r(cap)).falas.map((f) => f.id), ['open', 'c1', 'c2', 'closing'])
    const mistura = { ...cap, falas: [...cap.falas, { id: 'p1', onde: { passo: 1 }, texto: 'Tap.' }] }
    assert.throws(() => lerRoteiro(r(mistura)), /mixes passo and capitulo/)
    assert.throws(() => lerRoteiro(r({ ...cap, falas: [{ id: 'c0', onde: { capitulo: 0 }, texto: 'x' }] })), /capitulo/)
  })

  test('samples accepts a script without a voice', () => {
    const { voz, ...semVoz } = ok
    assert.equal(lerRoteiro(r(semVoz), { precisaVoz: false }).falas.length, 4)
  })
})

describe('the project folder of the cost notebook', () => {
  test('--project wins; otherwise the folder above voice/ in the path; otherwise it asks (code 2)', () => {
    assert.equal(acharProjeto('/x/my-video'), path.resolve('/x/my-video'))
    assert.equal(acharProjeto(null, '/x/my-video/voice/v1'), path.resolve('/x/my-video'))
    assert.equal(acharProjeto(null, null, '/x/my-video/voice/v1/script.json'), path.resolve('/x/my-video'))
    assert.equal(acharProjeto(null, '/x/my-video/voice/_takes/abc/take.json'), path.resolve('/x/my-video'))
    assert.throws(() => acharProjeto(null, '/x/somewhere/out'), (e) => e instanceof Falha && e.codigo === 2 && /--project/.test(e.message))
  })
})

describe('account status', () => {
  test('active, trialing and free are active; past_due says clearly that generation may be refused', () => {
    assert.equal(contaAtiva({ status: 'active' }), true)
    assert.equal(contaAtiva({ status: 'trialing' }), true)
    assert.equal(contaAtiva({ status: 'free' }), true)
    assert.equal(avisoConta({ status: 'active' }), null)
    const aviso = avisoConta({ status: 'past_due', next_character_count_reset_unix: 1700000000 }, Date.UTC(2026, 9, 12))
    assert.match(aviso, /NOT active: status past_due \(the last payment did not go through\)/)
    assert.match(aviso, /the renewal was due on 2023-11-14 and did not happen/)
    assert.match(aviso, /may be refused/)
  })
})

describe('listen (julgarEscuta)', () => {
  const fala = { palavras: [{ texto: 'Meet' }, { texto: 'the' }, { texto: 'Vyrta,', dito: 'Veerta,' }, { texto: 'on' }, { texto: 'Instagram.' }] }
  test('risk word heard: passes, without case, accent or punctuation', () => {
    assert.equal(julgarEscuta(fala, 'meet the vyrta on instagram', ['Instagram']).falhou, false)
  })
  test('risk word swapped: fails and says which', () => {
    const j = julgarEscuta(fala, 'Meet the Virgo on Instagram.', ['Instagram'])
    assert.equal(j.falhou, true)
    assert.deepEqual(j.faltas, [{ texto: 'Vyrta,', esperado: 'Veerta,', risco: true }])
  })
  test('the transcription writes the real word, not the spelling of the map: that counts too', () => {
    const marca = { palavras: [{ texto: 'Meet' }, { texto: 'the' }, { texto: 'Nuvo', dito: 'Noovo' }, { texto: 'One.', dito: 'Wan.' }] }
    assert.equal(julgarEscuta(marca, 'Meet the Nuvo One.').falhou, false)
    assert.equal(julgarEscuta(marca, 'Meet the Novo On.').falhou, true)
    assert.equal(julgarEscuta(marca, 'Meet the NuvoOne.').falhou, false, 'two words glued together in the transcription')
  })
  test('number spelled out in the speech and digits in the transcription (Portuguese): counts', () => {
    const num = { palavras: [{ texto: 'Doze', dito: 'Doze' }, { texto: 'novidades,' }, { texto: 'mil' }, { texto: 'duzentas', dito: 'duzentas' }, { texto: 'e' }, { texto: 'quarenta' }, { texto: 'e' }, { texto: 'oito', dito: 'oito' }, { texto: 'fãs.' }] }
    assert.equal(julgarEscuta(num, '12 novidades, 1.248 fãs.').falhou, false)
    assert.equal(julgarEscuta(num, '13 novidades, 1.248 fãs.').falhou, true)
    assert.equal(porExtenso(2026), 'dois mil e vinte e seis')
    assert.equal(porExtenso(1500), 'mil e quinhentos')
    assert.equal(porExtenso(100), 'cem')
  })
  test('an address spelled with one letter less by the transcription: counts; with another word, not', () => {
    const site = { palavras: [{ texto: 'Visit' }, { texto: 'vyrtaapp.com/7', dito: 'veerta app dot com slash seven' }] }
    assert.equal(julgarEscuta(site, 'Visit vyrtapp.com/7').falhou, false)
    assert.equal(julgarEscuta(site, 'Visit vyrtapp.com/8').falhou, true)
    assert.equal(julgarEscuta(site, 'Visit vortex.com/7').falhou, true)
  })
  test('a common word that does not appear is only informative', () => {
    const j = julgarEscuta(fala, 'Meet Veerta on Instagram')
    assert.equal(j.falhou, false)
    assert.deepEqual(j.faltas.map((f) => f.texto), ['the'])
  })
})

describe('Contract L (validate)', () => {
  function locucaoValida() {
    const d = tmp('loc')
    const dur = wavSintetico(path.join(d, 'lines', 'p1.wav'), { silencio: 0.1, tom: 1.4 })
    const w = lerWav(path.join(d, 'lines', 'p1.wav'))
    const iv = Math.round(inicioVoz(w.amostras, w.taxa) * 1000) / 1000
    const loc = { versao: 1, idioma: 'en-US', voz: { provedor: 'elevenlabs' }, falas: [{ id: 'p1', onde: { passo: 1 }, texto: 'Tap on Save.', arquivo: 'lines/p1.wav',
      duracao: Math.round(dur * 1000) / 1000, inicio_voz: iv, palavras: [{ texto: 'Tap', ini: iv, fim: 0.5 }, { texto: 'on', ini: 0.55, fim: 0.7 }, { texto: 'Save.', ini: 0.75, fim: 1.4 }] }] }
    return { d, loc }
  }
  test('a correct narration passes', () => {
    const { d, loc } = locucaoValida()
    assert.deepEqual(validarLocucao(loc, d), [])
  })
  test('each break of the contract becomes a message', () => {
    const casos = [
      [(l) => { l.versao = 2 }, /versao/],
      [(l) => { l.falas[0].palavras[2].texto = 'Saved.' }, /is not "Save\."/],
      [(l) => { l.falas[0].palavras.pop() }, /2 words, but the text has 3/],
      [(l) => { l.falas[0].palavras[0].ini = 0 }, /starts before the first sound/],
      [(l) => { l.falas[0].inicio_voz = 0.3; l.falas[0].palavras[0].ini = 0.3 }, /first sound measured/],
      [(l) => { l.falas[0].duracao = 3 }, /the WAV has/],
      [(l) => { l.falas[0].onde = { passo: 0 } }, /onde must be/],
      [(l) => { l.falas.push({ ...l.falas[0], id: 'p1b' }) }, /step 1 appears in more than one line/],
      [(l) => { l.falas[0].arquivo = 'lines/missing.wav' }, /could not find/],
      [(l) => { l.falas[0].palavras[1].ini = 0.05 }, /starts before the previous one/],
    ]
    for (const [quebrar, esperado] of casos) {
      const { d, loc } = locucaoValida()
      quebrar(loc)
      const e = validarLocucao(loc, d)
      assert.ok(e.some((m) => esperado.test(m)), `${esperado} → ${JSON.stringify(e)}`)
    }
  })
  test('a WAV outside the format is refused', () => {
    const { d, loc } = locucaoValida()
    wavSintetico(path.join(d, 'lines', 'p1.wav'), { silencio: 0.1, tom: 1.4, taxa: 44100 })
    assert.ok(validarLocucao(loc, d).some((m) => /48000 Hz, mono/.test(m)))
  })
})

describe('library rules', () => {
  const v = { category: 'professional', notice_period: 365, rate: 1, fiat_rate: null, live_moderation_enabled: false }
  test('only voices with notice ≥ 180 days, no custom rate, no live moderation and no celebrity pass', () => {
    assert.equal(motivoFora(v), null)
    assert.match(motivoFora({ ...v, notice_period: 0 }), /no notice/)
    assert.match(motivoFora({ ...v, notice_period: null }), /no notice/)
    assert.match(motivoFora({ ...v, notice_period: 90 }), /90-day notice/)
    assert.match(motivoFora({ ...v, fiat_rate: 0.3 }), /custom rate/)
    assert.match(motivoFora({ ...v, rate: 2 }), /custom rate/)
    assert.match(motivoFora({ ...v, live_moderation_enabled: true }), /moderation/)
    assert.match(motivoFora({ ...v, category: 'famous' }), /celebrity/)
  })
})

// ── ponta a ponta, contra a API falsa ────────────────────────────────────────────────────────────
describe('voice.mjs against the fake API', () => {
  let api, env
  before(async () => {
    api = await subirApiFalsa({ chave: CHAVE })
    env = { ELEVENLABS_API_BASE: api.url }
    api.estado.vozes.v1 = { voice_id: 'v1', name: 'Invented Voice', category: 'professional', is_owner: false, sharing: { disable_at_unix: null, notice_period: 365 } }
  })
  after(() => api.fechar())

  function video(roteiroExtra = {}) {
    const d = tmp('video')
    const rot = { idioma: 'en-US', perfil: 'calmo', voz: { id: 'v1', nome: 'Invented Voice' }, pronuncia: { Vyrta: 'Veerta' }, falas: [
      { id: 'abertura', onde: 'abertura', texto: 'Booking a bike.' },
      { id: 'p1', onde: { passo: 1 }, texto: 'Open Vyrta and tap on Book.' },
      { id: 'fechamento', onde: 'fechamento', texto: 'Done. Enjoy the ride.' }], ...roteiroExtra }
    escrever(path.join(d, 'voice', 'phone', 'script.json'), rot)
    return { d, rot: path.join(d, 'voice', 'phone', 'script.json'), saida: path.join(d, 'voice', 'phone') }
  }

  test('generate: one request per line, with the neighbours; the narration passes the contract and the real cost goes in the notebook', async () => {
    const v = video()
    api.zerar()
    const r = await rodar(['generate', v.rot, '--out', v.saida], { env })
    assert.equal(r.code, 0, r.tudo)
    const tts = api.tts()
    assert.equal(tts.length, 3)
    assert.deepEqual(tts.map((p) => p.json.text), ['Booking a bike.', 'Open Veerta and tap on Book.', 'Done. Enjoy the ride.'])
    assert.equal(tts[1].json.previous_text, 'Booking a bike.')
    assert.equal(tts[1].json.next_text, 'Done. Enjoy the ride.')
    assert.equal(tts[0].json.previous_text, undefined)
    assert.equal(tts[0].consulta.get('output_format'), 'mp3_44100_128')
    assert.equal(tts[0].json.voice_settings.speed, 0.95)
    assert.equal(tts[0].json.model_id, 'eleven_multilingual_v2')
    assert.match(r.out, /3 to generate · 64 new characters · about 64 credits/)
    assert.match(r.out, /balance: plan starter · credits used/)
    assert.match(r.out, /real cost \(character-cost header\): 25\.6 for 64 characters · noted in .*costs\.jsonl/)
    const loc = JSON.parse(fs.readFileSync(path.join(v.saida, 'narration.json'), 'utf8'))
    assert.deepEqual(validarLocucao(loc, v.saida), [])
    const p1 = loc.falas.find((f) => f.id === 'p1')
    assert.equal(p1.texto, 'Open Vyrta and tap on Book.')
    assert.equal(p1.arquivo, 'lines/p1.wav')
    assert.deepEqual(p1.palavras[1], { ...p1.palavras[1], texto: 'Vyrta', dito: 'Veerta' })
    assert.deepEqual(loc.falas.map((f) => f.onde), ['abertura', { passo: 1 }, 'fechamento'])
    assert.ok(loc.falas.every((f) => Math.abs(f.inicio_voz - 0.12) < 0.03), 'the measured first sound, not the 0.000 of the alignment')
    const val = await rodar(['validate', path.join(v.saida, 'narration.json')])
    assert.equal(val.code, 0, val.tudo)
    const reg = fs.readFileSync(path.join(v.d, 'voice', '_takes', 'calls.jsonl'), 'utf8')
    assert.equal(reg.trim().split('\n').length, 5, 'subscription + voice + 3 lines')
    const takes = fs.readdirSync(path.join(v.d, 'voice', '_takes')).filter((f) => /^[0-9a-f]{64}$/.test(f))
    assert.equal(takes.length, 3)
    // o caderno do vídeo: uma linha por fala paga, com o custo do header e o take
    const gastos = readCosts(v.d)
    assert.equal(gastos.length, 3, 'one line per paid line')
    assert.ok(gastos.every((x) => x.kind === 'voice' && x.provider === 'elevenlabs' && x.model === 'eleven_multilingual_v2' && x.credits > 0 && x.files.length === 1 && x.files[0].startsWith('voice/_takes/')))
    assert.equal(Math.round(gastos.reduce((s, x) => s + x.credits, 0) * 10) / 10, 25.6)
    const info = JSON.parse(fs.readFileSync(path.join(v.d, 'voice', '_takes', takes[0], 'take.json'), 'utf8'))
    for (const campo of ['request_id', 'data', 'custo', 'alinhamento', 'pedido']) assert.ok(info[campo] != null, campo)

    // 2ª rodada: tudo do cache, nenhuma chamada, nenhum gasto novo, a mesma narração
    const antes = fs.readFileSync(path.join(v.saida, 'narration.json'), 'utf8')
    api.zerar()
    const r2 = await rodar(['generate', v.rot, '--out', v.saida], { env })
    assert.equal(r2.code, 0, r2.tudo)
    assert.equal(api.pedidos.length, 0)
    assert.match(r2.out, /API calls: 0/)
    assert.equal(fs.readFileSync(path.join(v.saida, 'narration.json'), 'utf8'), antes)
    assert.equal(readCosts(v.d).length, 3, 'a line that did not change is not paid again')

    // --redo: só aquela fala, e o take antigo fica guardado
    api.zerar()
    const r3 = await rodar(['generate', v.rot, '--out', v.saida, '--redo', 'p1'], { env })
    assert.equal(r3.code, 0, r3.tudo)
    assert.deepEqual(api.tts().map((p) => p.json.text), ['Open Veerta and tap on Book.'])
    assert.match(r3.out, /old take kept in [0-9a-f]{64}[\\/]antigos/)
    assert.equal(readCosts(v.d).length, 4)

    // mudar uma frase regera ela e as vizinhas (o vizinho entra na chave)
    const rot = JSON.parse(fs.readFileSync(v.rot, 'utf8'))
    rot.falas[1].texto = 'Open Vyrta and tap on New ride.'
    escrever(v.rot, rot)
    api.zerar()
    const r4 = await rodar(['generate', v.rot, '--out', v.saida], { env })
    assert.equal(r4.code, 0, r4.tudo)
    assert.equal(api.tts().length, 3)
  })

  test('cap: a request that goes past the video cap stops BEFORE calling the API (code 5, no request)', async () => {
    const v = video()
    writeCaps(v.d, { voiceCredits: 50 })
    api.zerar()
    const r = await rodar(['generate', v.rot, '--out', v.saida], { env })
    assert.equal(r.code, 5, r.tudo)
    assert.match(r.err, /voice cap is 50 credits/)
    assert.match(r.err, /costs\.mjs cap <project> --voice-credits/)
    assert.equal(api.pedidos.length, 0, 'not even the subscription is asked')
    assert.equal(readCosts(v.d).length, 0)
    writeCaps(v.d, { voiceCredits: 1500 })
    const r2 = await rodar(['generate', v.rot, '--out', v.saida], { env })
    assert.equal(r2.code, 0, r2.tudo)
  })

  test('cap: what was already spent counts — a second video in the same folder stops when the notebook is full', async () => {
    const v = video()
    writeCaps(v.d, { voiceCredits: 80 })
    assert.equal((await rodar(['generate', v.rot, '--out', v.saida], { env })).code, 0)
    const rot = JSON.parse(fs.readFileSync(v.rot, 'utf8'))
    rot.falas[1].texto = 'Open Vyrta and tap on New ride, then confirm the time.'
    escrever(v.rot, rot)
    api.zerar()
    const r = await rodar(['generate', v.rot, '--out', v.saida], { env })
    assert.equal(r.code, 5, r.tudo)
    assert.equal(api.pedidos.length, 0)
  })

  test('a paid command without a project asks for --project (code 2) and calls nothing', async () => {
    const d = tmp('loose')
    escrever(path.join(d, 'script.json'), JSON.parse(fs.readFileSync(video().rot, 'utf8')))
    api.zerar()
    const r = await rodar(['generate', path.join(d, 'script.json'), '--out', path.join(d, 'out')], { env })
    assert.equal(r.code, 2, r.tudo)
    assert.match(r.err, /--project/)
    assert.equal(api.pedidos.length, 0)
    const r2 = await rodar(['generate', path.join(d, 'script.json'), '--out', path.join(d, 'out'), '--project', d], { env })
    assert.equal(r2.code, 0, r2.tudo)
    assert.equal(readCosts(d).length, 3)
  })

  test('without a key: teaches how to create the file on Mac and Windows, without calling the API', async () => {
    const v = video()
    api.zerar()
    const r = await rodar(['generate', v.rot, '--out', v.saida], { env, semChave: true })
    assert.equal(r.code, 1)
    assert.match(r.err, /elevenlabs\.env/)
    assert.match(r.err, /read -rs k/)
    assert.match(r.err, /Read-Host .* -AsSecureString/)
    assert.equal(api.pedidos.length, 0)
    assert.ok(comoPorChave().includes('Never paste the key'))
  })

  test('the key comes from ~/.claude/secrets/elevenlabs.env, also as Notepad saves it (BOM, UTF-16, CRLF)', async () => {
    const bom = (b, texto, cod) => Buffer.concat([Buffer.from(b), Buffer.from(texto, cod)])
    for (const [jeito, conteudo] of Object.entries({
      'UTF-8, LF': `# comment\nELEVENLABS_API_KEY="${CHAVE}"\n`,
      'UTF-8 with BOM, CRLF': bom([0xef, 0xbb, 0xbf], `ELEVENLABS_API_KEY=${CHAVE}\r\n`, 'utf8'),
      'UTF-16 LE ("Unicode"), CRLF': bom([0xff, 0xfe], `# comment\r\nELEVENLABS_API_KEY=${CHAVE}\r\n`, 'utf16le'),
    })) {
      const casa = tmp('home')
      escrever(path.join(casa, '.claude', 'secrets', 'elevenlabs.env'), conteudo)
      const r = await rodar(['account'], { env, semChave: true, home: casa })
      assert.equal(r.code, 0, `${jeito}: ${r.tudo}`)
    }
  })

  test('the key never shows up: not in stdout, stderr, the log, the notebook or any file written — not even when the API returns it', async () => {
    const v = video()
    const r0 = await rodar(['generate', v.rot, '--out', v.saida, '--log', path.join(v.d, 'log.jsonl')], { env })
    assert.equal(r0.code, 0, r0.tudo)
    assert.ok(!r0.tudo.includes(CHAVE))
    api.estado.devolverChaveNo401 = true
    try {
      const rot = JSON.parse(fs.readFileSync(v.rot, 'utf8'))
      rot.falas[0].texto = 'Booking a bike today.'
      escrever(v.rot, rot)
      const r = await rodar(['generate', v.rot, '--out', v.saida, '--log', path.join(v.d, 'log.jsonl')], { env })
      assert.equal(r.code, 1)
      assert.match(r.err, /refused the key \(401\)/)
      assert.match(r.err, /«key»/)
      assert.ok(!r.tudo.includes(CHAVE))
    } finally { api.estado.devolverChaveNo401 = false }
    const tudo = textos(v.d)
    assert.ok(tudo.includes('voice/_takes/'), 'the walk saw the files')
    assert.ok(!tudo.includes(CHAVE), 'no file written has the key')
  })

  test('account: plan, credits and, on the free plan, what changes', async () => {
    let r = await rodar(['account'], { env })
    assert.equal(r.code, 0, r.tudo)
    assert.match(r.out, /plan starter · credits used/)
    assert.match(r.out, /status active \(active\)/)
    api.estado.tier = 'free'
    try {
      r = await rodar(['account'], { env })
      assert.match(r.out, /no commercial use/)
      assert.match(r.out, /attribution required/)
      assert.match(r.out, /default voices/)
    } finally { api.estado.tier = 'starter' }
  })

  test('account not active (past_due, renewal overdue): says clearly that generation may be refused, also before spending', async () => {
    api.estado.status = 'past_due'
    api.estado.renova = Math.floor(Date.now() / 1000) - 5 * 86400
    try {
      const r = await rodar(['account'], { env })
      assert.equal(r.code, 0, r.tudo)
      assert.match(r.out, /NOT active: status past_due \(the last payment did not go through\)/)
      assert.match(r.out, /the renewal was due on \d{4}-\d\d-\d\d and did not happen/)
      assert.match(r.out, /may be refused \(402\)/)
      const j = JSON.parse((await rodar(['account', '--json'], { env })).out)
      assert.equal(j.active, false)
      assert.equal(j.status, 'past_due')
      const v = video()
      const g = await rodar(['generate', v.rot, '--out', v.saida], { env })
      assert.match(g.out, /NOT active: status past_due/)
    } finally { api.estado.status = null; api.estado.renova = 1790000000 }
  })

  test('search: sends the filters and drops the voices that do not work in a video', async () => {
    const base = { category: 'professional', rate: 1, fiat_rate: null, live_moderation_enabled: false, gender: 'female', age: 'young', accent: 'american', language: 'en', locale: 'en-US', descriptive: 'calm', use_case: 'informative_educational', verified_languages: [{ language: 'en', model_id: 'eleven_multilingual_v2', accent: 'american', locale: 'en-US' }] }
    api.estado.biblioteca = [
      { ...base, voice_id: 'good', name: 'Invented Serene', notice_period: 365 },
      { ...base, voice_id: 'short', name: 'Short Notice', notice_period: 30 },
      { ...base, voice_id: 'pricey', name: 'High Rate', notice_period: 365, fiat_rate: 0.5 },
      { ...base, voice_id: 'watched', name: 'Moderated', notice_period: 365, live_moderation_enabled: true },
    ]
    api.zerar()
    const r = await rodar(['search', '--language', 'en', '--locale', 'en-US', '--gender', 'female', '--use-case', 'informative_educational', '--descriptive', 'calm'], { env })
    assert.equal(r.code, 0, r.tudo)
    const q = api.pedidos.find((p) => p.caminho === '/v1/shared-voices').consulta
    assert.equal(q.get('language'), 'en')
    assert.equal(q.get('locale'), 'en-US')
    assert.equal(q.get('gender'), 'female')
    assert.equal(q.get('use_cases'), 'informative_educational')
    assert.equal(q.get('descriptives'), 'calm')
    assert.equal(q.get('min_notice_period_days'), '180')
    assert.equal(q.get('include_custom_rates'), 'false')
    assert.equal(q.get('include_live_moderated'), 'false')
    assert.equal(q.get('sort'), 'usage_character_count_1y')
    assert.match(r.out, /4 voices in the search · 1 usable/)
    assert.match(r.out, /Invented Serene {2}\[good\]/)
    assert.doesNotMatch(r.out, /Short Notice|High Rate|Moderated/)
    const ruim = await rodar(['search', '--sort', 'popular'], { env })
    assert.equal(ruim.code, 2)
    assert.match(ruim.err, /--sort must be/)
  })

  test('search on the free plan shows the default voices', async () => {
    api.estado.tier = 'free'
    api.estado.padrao = [{ voice_id: 'pd1', name: 'Default One', category: 'premade', labels: { accent: 'american', gender: 'male' }, verified_languages: [{ language: 'en', model_id: 'eleven_multilingual_v2' }] }]
    try {
      api.zerar()
      const r = await rodar(['search', '--language', 'en'], { env })
      assert.equal(r.code, 0, r.tudo)
      assert.equal(api.pedidos.find((p) => p.caminho === '/v2/voices').consulta.get('voice_type'), 'default')
      assert.match(r.out, /Default One {2}\[pd1\]/)
      assert.ok(!api.pedidos.some((p) => p.caminho === '/v1/shared-voices'))
    } finally { api.estado.tier = 'starter' }
  })

  test('samples: the first real sentence of the script read by three voices, saved in the project with samples.json; the 2nd round comes from the cache', async () => {
    const v = video()
    for (const id of ['a1', 'a2', 'a3']) api.estado.vozes[id] = { voice_id: id, name: `Candidate ${id}`, category: 'professional', is_owner: false, sharing: {} }
    api.zerar()
    const r = await rodar(['samples', '--script', v.rot, '--voices', 'a1,a2,a3'], { env })
    assert.equal(r.code, 0, r.tudo)
    assert.deepEqual(api.tts().map((p) => [p.caminho.split('/')[3], p.json.text]), [['a1', 'Booking a bike.'], ['a2', 'Booking a bike.'], ['a3', 'Booking a bike.']])
    const pasta = path.join(v.saida, 'samples')
    assert.deepEqual(fs.readdirSync(pasta).filter((f) => f.endsWith('.mp3')).sort(), ['1-candidate-a1.mp3', '2-candidate-a2.mp3', '3-candidate-a3.mp3'])
    const am = JSON.parse(fs.readFileSync(path.join(pasta, 'samples.json'), 'utf8'))
    assert.equal(am.phrase, 'Booking a bike.')
    assert.deepEqual(am.options.map((o) => o.audio), ['voice/phone/samples/1-candidate-a1.mp3', 'voice/phone/samples/2-candidate-a2.mp3', 'voice/phone/samples/3-candidate-a3.mp3'])
    assert.ok(am.options.every((o) => o.seconds > 0 && fs.existsSync(path.join(v.d, o.audio))))
    assert.match(r.out, /Nobody has listened/)
    assert.equal(readCosts(v.d).length, 3, 'each sample is paid and noted')
    api.zerar()
    const r2 = await rodar(['samples', '--script', v.rot, '--voices', 'a1,a2,a3'], { env })
    assert.equal(r2.code, 0, r2.tudo)
    assert.equal(api.pedidos.length, 0)
  })

  test('board: the script, the lines and the voices as JSON for the review board, from ready to generated to stale', async () => {
    const v = video()
    let b = quadroDaVoz(v.rot)
    assert.equal(b.script.state, 'ready')
    assert.equal(b.script.file, 'voice/phone/script.json')
    assert.equal(b.script.words, 13)
    assert.ok(b.script.seconds > 0)
    assert.deepEqual(b.script.voice, { id: 'v1', name: 'Invented Voice', model: 'eleven_multilingual_v2', profile: 'calmo' })
    assert.deepEqual(b.lines.map((l) => [l.id, l.scene, l.audio, l.cached, l.estimated]), [['abertura', 0, null, false, true], ['p1', 1, null, false, true], ['fechamento', 99, null, false, true]])
    assert.equal(b.script.credits, b.script.creditsToSpend)
    assert.ok((await rodar(['generate', v.rot, '--out', v.saida], { env })).code === 0)
    for (const id of ['a1', 'a2']) api.estado.vozes[id] = { voice_id: id, name: `Candidate ${id}`, category: 'professional', is_owner: false, sharing: {} }
    assert.equal((await rodar(['samples', '--script', v.rot, '--voices', 'a1,a2'], { env })).code, 0)
    const r = await rodar(['board', v.rot])
    assert.equal(r.code, 0, r.tudo)
    b = JSON.parse(r.out)
    assert.equal(b.script.state, 'generated')
    assert.equal(b.script.creditsToSpend, 0)
    assert.deepEqual(b.lines.map((l) => l.audio), ['voice/phone/lines/abertura.wav', 'voice/phone/lines/p1.wav', 'voice/phone/lines/fechamento.wav'])
    assert.ok(b.lines.every((l) => l.cached && !l.estimated && l.credits > 0 && l.seconds > 0 && l.text))
    assert.deepEqual(b.options.map((o) => o.name), ['Candidate a1', 'Candidate a2'])
    assert.ok(b.options.every((o) => o.audio.startsWith('voice/phone/samples/') && o.audio.endsWith('.mp3')))
    const rot = JSON.parse(fs.readFileSync(v.rot, 'utf8'))
    rot.falas[2].texto = 'Done — enjoy the ride.'
    escrever(v.rot, rot)
    b = quadroDaVoz(v.rot)
    assert.equal(b.script.state, 'needs-fix', 'the dash is a writing error')
    assert.equal(b.lines[2].review[0].rule, 'travessao')
    rot.falas[2].texto = 'Done, enjoy the ride.'
    escrever(v.rot, rot)
    b = quadroDaVoz(v.rot)
    assert.equal(b.script.state, 'stale')
    assert.equal(b.lines[2].audio, null)
    assert.ok(b.lines[2].estimated)
  })

  test('check: passes with the alignment in place, exits with code 1 with the voice shifted 120 ms, and notes the alignment cost', async () => {
    const v = video()
    await rodar(['generate', v.rot, '--out', v.saida], { env })
    const loc = path.join(v.saida, 'narration.json')
    const antes = readCosts(v.d).length
    api.zerar()
    const r = await rodar(['check', loc], { env })
    assert.equal(r.code, 0, r.tudo)
    assert.match(r.out, /✓ 3 of 3 lines with every word within ±80 ms/)
    const fa = api.pedidos.filter((p) => p.caminho === '/v1/forced-alignment')
    assert.equal(fa.length, 3)
    assert.equal(fa[1].texto, 'Open Veerta and tap on Book.', 'the forced alignment gets what was said')
    assert.equal(readCosts(v.d).length, antes + 3)
    api.estado.desvio = 0.12
    try {
      const r2 = await rodar(['check', loc], { env })
      assert.equal(r2.code, 1, r2.tudo)
      assert.match(r2.out, /starts 1\d\d ms after/)
    } finally { api.estado.desvio = 0 }
  })

  test('listen: transcribes each line without keyterms and exits with code 1 if the risk word was not heard', async () => {
    const v = video()
    await rodar(['generate', v.rot, '--out', v.saida], { env })
    const loc = path.join(v.saida, 'narration.json')
    Object.assign(api.estado.ouvido, { 'abertura.wav': 'Booking a bike.', 'p1.wav': 'Open Vyrta and tap on book.', 'fechamento.wav': 'Done, enjoy the ride.' })
    api.zerar()
    const r = await rodar(['listen', loc], { env })
    assert.equal(r.code, 0, r.tudo)
    const stt = api.pedidos.filter((p) => p.caminho === '/v1/speech-to-text')
    assert.equal(stt.length, 3)
    assert.equal(stt[0].modelo, 'scribe_v2')
    assert.equal(stt[0].idioma, 'en')
    assert.equal(stt[0].keyterms, null, 'keyterms would bias the transcription toward the right word')
    assert.match(fs.readFileSync(path.join(v.saida, 'heard.md'), 'utf8'), /\| p1 \| Vyrta \|/)
    api.estado.ouvido['p1.wav'] = 'Open Virgo and tap on book.'
    try {
      const r2 = await rodar(['listen', loc], { env })
      assert.equal(r2.code, 1, r2.tudo)
      assert.match(r2.out, /RISK "Vyrta" \(said "Veerta"\) does not appear/)
      const r3 = await rodar(['listen', loc, '--line', 'abertura', '--words', 'bike'], { env })
      assert.equal(r3.code, 0, r3.tudo)
    } finally { api.estado.ouvido = {} }
  })

  test('a voice leaving the library: generate warns the date', async () => {
    api.estado.vozes.leaves = { voice_id: 'leaves', name: 'Leaving Voice', category: 'professional', is_owner: false, sharing: { disable_at_unix: Math.floor(Date.now() / 1000) + 40 * 86400, notice_period: 180 } }
    const v = video({ voz: { id: 'leaves' } })
    const r = await rodar(['generate', v.rot, '--out', v.saida], { env })
    assert.equal(r.code, 0, r.tudo)
    assert.match(r.out, /leaves the library on .* \(in 40 days/)
    const r2 = await rodar(['generate', v.rot, '--out', v.saida], { env })
    assert.match(r2.out, /leaves the library/, 'warns also when everything comes from the cache')
  })

  test('a library voice not used yet: asks again after the 1st line and keeps the leaving date', async () => {
    api.estado.vozes.fresh = { voice_id: 'fresh', name: 'Fresh Library Voice', category: 'professional', is_owner: null, sharing: { status: 'copied', disable_at_unix: Math.floor(Date.now() / 1000) + 200 * 86400, notice_period: 730 } }
    api.estado.naoUsadas.add('fresh')
    const v = video({ voz: { id: 'fresh' } })
    api.zerar()
    const r = await rodar(['generate', v.rot, '--out', v.saida], { env })
    assert.equal(r.code, 0, r.tudo)
    assert.deepEqual(api.pedidos.map((p) => `${p.metodo} ${p.caminho.replace(/\/with-timestamps$/, '')}`), [
      'GET /v1/user/subscription', 'GET /v1/voices/fresh', 'POST /v1/text-to-speech/fresh', 'GET /v1/voices/fresh', 'POST /v1/text-to-speech/fresh', 'POST /v1/text-to-speech/fresh'])
    assert.match(r.out, /"Fresh Library Voice" leaves the library on .* \(in 200 days/)
    const loc = JSON.parse(fs.readFileSync(path.join(v.saida, 'narration.json'), 'utf8'))
    assert.equal(loc.voz.nome, 'Fresh Library Voice', 'the name comes from the check made after the use')
  })

  test('a clone without written consent: refused before spending; with it, generates', async () => {
    api.estado.vozes.clone = { voice_id: 'clone', name: 'Clone of Someone', category: 'cloned', is_owner: true, sharing: null }
    const v = video({ voz: { id: 'clone' } })
    api.zerar()
    const r = await rodar(['generate', v.rot, '--out', v.saida], { env })
    assert.equal(r.code, 1)
    assert.match(r.err, /written consent/)
    assert.equal(api.tts().length, 0)
    escrever(path.join(v.saida, 'consent.txt'), 'I, an invented person, authorize the use of my voice in this video. Signed.')
    const rot = JSON.parse(fs.readFileSync(v.rot, 'utf8'))
    rot.voz.autorizacao = 'consent.txt'
    escrever(v.rot, rot)
    const r2 = await rodar(['generate', v.rot, '--out', v.saida], { env })
    assert.equal(r2.code, 0, r2.tudo)
  })

  test('the takes do not live inside output/', async () => {
    const v = video()
    const r = await rodar(['generate', v.rot, '--out', v.saida, '--takes', path.join(v.d, 'output', 'phone', '_takes')], { env })
    assert.equal(r.code, 1)
    assert.match(r.err, /cannot live inside an output\/ folder/)
  })

  test('design: three previews, paid and noted; the description always asks for a human voice', async () => {
    const v = video()
    api.zerar()
    const r = await rodar(['design', '--description', 'young woman, warm', '--script', v.rot], { env })
    assert.equal(r.code, 0, r.tudo)
    const p = api.pedidos.find((x) => x.caminho === '/v1/text-to-voice/design')
    assert.match(p.json.voice_description, /not an announcer/)
    assert.ok(p.json.text.length >= 100)
    assert.deepEqual(fs.readdirSync(path.join(v.d, 'voice', 'design')).filter((f) => f.endsWith('.mp3')).sort(), ['design-1.mp3', 'design-2.mp3', 'design-3.mp3'])
    const g = readCosts(v.d)
    assert.equal(g.length, 1)
    assert.equal(g[0].files.length, 3)
  })
})

// ── voz humana: v3/v4, marcação, tempo forçado e medidas ─────────────────────────────────────────
function rajadas(arq, rajs, { taxa = 48000, total } = {}) {
  const fim = total ?? rajs.at(-1)[0] + rajs.at(-1)[1] + 0.3
  const n = Math.round(fim * taxa), b = Buffer.alloc(44 + n * 2)
  b.write('RIFF', 0); b.writeUInt32LE(36 + n * 2, 4); b.write('WAVE', 8); b.write('fmt ', 12)
  b.writeUInt32LE(16, 16); b.writeUInt16LE(1, 20); b.writeUInt16LE(1, 22); b.writeUInt32LE(taxa, 24)
  b.writeUInt32LE(taxa * 2, 28); b.writeUInt16LE(2, 32); b.writeUInt16LE(16, 34); b.write('data', 36); b.writeUInt32LE(n * 2, 40)
  for (const [t0, dur] of rajs) {
    for (let i = Math.round(t0 * taxa); i < Math.min(n, Math.round((t0 + dur) * taxa)); i++) {
      const t = i / taxa - t0
      b.writeInt16LE(Math.round(16000 * Math.sin(Math.PI * t / dur) ** 2 * Math.sin(2 * Math.PI * 220 * t)), 44 + i * 2)
    }
  }
  escrever(arq, b)
}
const seq = (n, ini, intervalo) => { let t = ini; return Array.from({ length: n }, (_, i) => { const r = [t, 0.12]; t += typeof intervalo === 'function' ? intervalo(i) : intervalo; return r }) }

describe('v3 and v4 markup', () => {
  test('the markup goes to the voice and stays out of the caption and the words, including the multi-word one', () => {
    const pr = aplicarPronuncia('[warm] Hi, I am Lia. [strong French accent] From Vyrta… [pause] Done.', { Vyrta: 'Veerta' })
    assert.deepEqual(pr.exibidas, ['Hi,', 'I', 'am', 'Lia.', 'From', 'Vyrta…', 'Done.'])
    assert.equal(pr.falado, '[warm] Hi, I am Lia. [strong French accent] From Veerta… [pause] Done.')
    assert.equal(pr.grupos.length, 7)
    assert.deepEqual(marcacoes(['[a]', 'b', '[c', 'd]', 'e']), [true, false, true, true, false])
  })
  test('a bracket that never closes, or glued to the word, is text and does not swallow the rest', () => {
    assert.deepEqual(marcacoes(['[no', 'end', 'here']), [false, false, false])
    assert.deepEqual(marcacoes(['[a]b', 'c']), [false, false])
  })
  test('montarFala: the markup leaves the caption and the alignment; the Contract L text does not carry it', () => {
    const d = tmp('markup'), wav = path.join(d, 'f.wav')
    wavSintetico(wav, { silencio: 0.12, tom: 2.0 })
    const texto = '[warm] Hi, I am Lia. [pause] Done.'
    const pron = aplicarPronuncia(texto, {})
    const f = montarFala({ fala: { id: 'f', onde: 'abertura', texto }, pron, alinhamento: alinhamentoFalso(pron.falado), wav, arquivo: 'f.wav' })
    assert.equal(f.texto, 'Hi, I am Lia. Done.')
    assert.deepEqual(f.palavras.map((p) => p.texto), ['Hi,', 'I', 'am', 'Lia.', 'Done.'])
  })
  test('montarFala with the forced times uses the forced ones, not the voice ones', () => {
    const d = tmp('forced'), wav = path.join(d, 'f.wav')
    wavSintetico(wav, { silencio: 0.12, tom: 1.5 })
    const pron = aplicarPronuncia('[calm] Test now.', {})
    const forcado = [{ texto: 'Test', ini: 0.5, fim: 0.9 }, { texto: 'now.', ini: 1.0, fim: 1.4 }]
    const f = montarFala({ fala: { id: 'f', onde: 'abertura', texto: '' }, pron, alinhamento: alinhamentoFalso(pron.falado), forcado, wav, arquivo: 'f.wav' })
    assert.deepEqual(f.palavras.map((p) => [p.ini, p.fim]), [[0.5, 0.9], [1.0, 1.4]])
  })
  test('ditasForcadas: drops what is not a word (punctuation only) and returns null when it does not match', () => {
    const w = (text, start) => ({ text, start, end: start + 0.2 })
    assert.deepEqual(ditasForcadas([w('Hi', 0), w('…', 0.3), w('now', 0.5)], 2).map((x) => x.texto), ['Hi', 'now'])
    assert.equal(ditasForcadas([w('Hi', 0), w('now', 0.5)], 3), null)
  })
})

describe('measure (no network)', () => {
  test('the 0.6 s pause between two stretches of speech shows up, and only it', () => {
    const d = tmp('measure'), arq = path.join(d, 'a.wav')
    rajadas(arq, [...seq(6, 0.2, 0.22), ...seq(6, 2.0, 0.22)])
    const m = medirAudio(arq)
    assert.equal(m.pausas.length, 1)
    assert.ok(m.pausas[0][1] - m.pausas[0][0] > 0.4 && m.pausas[0][1] - m.pausas[0][0] < 0.9, JSON.stringify(m.pausas))
    assert.ok(m.duracao > 2.8 && m.duracao < 3.4, String(m.duracao))
  })
  test('pace: syllables every 0.22 s give ~4.5 per second and a low CV; alternating intervals give a higher CV', () => {
    const d = tmp('pace'), reg = path.join(d, 'reg.wav'), irr = path.join(d, 'irr.wav')
    rajadas(reg, seq(14, 0.2, 0.22))
    rajadas(irr, seq(14, 0.2, (i) => (i % 2 ? 0.28 : 0.14)))
    const a = medirAudio(reg), b = medirAudio(irr)
    assert.ok(a.silabas >= 12 && a.silabas <= 16, String(a.silabas))
    assert.ok(Math.abs(a.silabasPorSeg - 4.5) < 0.6, String(a.silabasPorSeg))
    assert.ok(a.cv < 0.2, String(a.cv))
    assert.ok(b.cv > a.cv + 0.2, `${b.cv} against ${a.cv}`)
  })
  test('silent audio: says it is silent', () => {
    const arq = path.join(tmp('silent'), 'm.wav')
    rajadas(arq, [], { total: 1 })
    assert.throws(() => medirAudio(arq), /silent/)
  })
})

describe('generate with v4 against the fake API', () => {
  let api, env
  before(async () => {
    api = await subirApiFalsa({ chave: CHAVE })
    env = { ELEVENLABS_API_BASE: api.url }
    api.estado.vozes.v1 = { voice_id: 'v1', name: 'Invented Voice', category: 'professional', is_owner: false, sharing: { disable_at_unix: null, notice_period: 365 } }
  })
  after(() => api.fechar())

  function projeto(modelo) {
    const d = tmp('v4')
    const rot = path.join(d, 'voice', 'opening', 'script.json')
    escrever(rot, { idioma: 'en-US', perfil: 'reels', voz: { id: 'v1', ...(modelo ? { modelo } : {}) }, pronuncia: { Vyrta: 'Veerta' }, falas: [
      { id: 'abertura', onde: 'abertura', texto: '[warm] Hi, I am Lia, from Vyrta. [pause] Today I will show you one thing.' },
      { id: 'fechamento', onde: 'fechamento', texto: 'See you soon.' }] })
    return { d, rot, saida: path.dirname(rot) }
  }

  test('with voz.modelo eleven_v4: the markup goes to the voice, the times come from the forced alignment (paid and noted) and stay in the cache', async () => {
    const v = projeto('eleven_v4')
    api.zerar()
    const r = await rodar(['generate', v.rot, '--out', v.saida], { env })
    assert.equal(r.code, 0, r.tudo)
    const tts = api.tts()
    assert.deepEqual(tts.map((p) => p.json.model_id), ['eleven_v4', 'eleven_v4'])
    assert.equal(tts[0].json.text, '[warm] Hi, I am Lia, from Veerta. [pause] Today I will show you one thing.')
    assert.equal(tts[1].json.previous_text, 'Hi, I am Lia, from Veerta. Today I will show you one thing.', 'v4 gets the neighbouring line, without the markup')
    const forcadas = api.pedidos.filter((p) => p.caminho === '/v1/forced-alignment')
    assert.deepEqual(forcadas.map((p) => p.texto), ['Hi, I am Lia, from Veerta. Today I will show you one thing.', 'See you soon.'])
    const loc = JSON.parse(fs.readFileSync(path.join(v.saida, 'narration.json'), 'utf8'))
    assert.deepEqual(validarLocucao(loc, v.saida), [])
    assert.equal(loc.voz.modelo, 'eleven_v4')
    assert.equal(loc.falas[0].texto, 'Hi, I am Lia, from Vyrta. Today I will show you one thing.')
    assert.equal(loc.falas[0].palavras.length, 13)
    assert.equal(loc.falas[0].palavras[5].dito, 'Veerta.')
    const gastos = readCosts(v.d)
    assert.deepEqual(gastos.map((g) => g.model), ['eleven_v4', 'eleven_v4', 'forced-alignment', 'forced-alignment'])

    api.zerar()
    const r2 = await rodar(['generate', v.rot, '--out', v.saida], { env })
    assert.equal(r2.code, 0, r2.tudo)
    assert.equal(api.pedidos.length, 0, 'the forced alignment also stays in the take')
  })

  test('without voz.modelo: v2, no forced alignment', async () => {
    const v = projeto(null)
    const rot = JSON.parse(fs.readFileSync(v.rot, 'utf8'))
    rot.falas[0].texto = 'Hi, I am Lia, from Vyrta. Today I will show you one thing.'
    escrever(v.rot, rot)
    api.zerar()
    const r = await rodar(['generate', v.rot, '--out', v.saida], { env })
    assert.equal(r.code, 0, r.tudo)
    assert.deepEqual(api.tts().map((p) => p.json.model_id), ['eleven_multilingual_v2', 'eleven_multilingual_v2'])
    assert.equal(api.pedidos.filter((p) => p.caminho === '/v1/forced-alignment').length, 0)
  })

  test('measure --align: aligns each reading to its text, without the markup, only once', async () => {
    const v = projeto('eleven_v4')
    const saida = path.join(v.d, 'voice', 'samples')
    const a = await rodar(['samples', '--phrase', '[warm] Hi, all good today?', '--voices', 'v1', '--model', 'eleven_v4', '--out', saida], { env })
    assert.equal(a.code, 0, a.tudo)
    const mp3 = fs.readdirSync(saida).find((f) => f.endsWith('.mp3'))
    api.zerar()
    const m = await rodar(['measure', '--align', path.join(saida, mp3)], { env })
    assert.equal(m.code, 0, m.tudo)
    assert.deepEqual(api.pedidos.filter((p) => p.caminho === '/v1/forced-alignment').map((p) => p.texto), ['Hi, all good today?'])
    assert.match(m.out, /\| file \| duration \| pitch/)
    const take = fs.readdirSync(path.join(saida, '_takes')).find((f) => /^[0-9a-f]{64}$/.test(f))
    const info = JSON.parse(fs.readFileSync(path.join(saida, '_takes', take, 'take.json'), 'utf8'))
    assert.deepEqual(info.forcado.map((x) => x.texto), ['Hi,', 'all', 'good', 'today?'])
    api.zerar()
    const m2 = await rodar(['measure', '--align', path.join(saida, mp3)], { env })
    assert.equal(m2.code, 0, m2.tudo)
    assert.equal(api.pedidos.length, 0)
  })

  test('samples --phrase: v2 by default, --model asks for another', async () => {
    const v = projeto()
    api.zerar()
    const a = await rodar(['samples', '--phrase', 'Hi, all good?', '--voices', 'v1', '--project', v.d], { env })
    assert.equal(a.code, 0, a.tudo)
    assert.equal(api.tts()[0].json.model_id, 'eleven_multilingual_v2')
    assert.ok(fs.existsSync(path.join(v.d, 'voice', 'samples', 'samples.json')))
    api.zerar()
    const b = await rodar(['samples', '--phrase', '[warm] Hi, all good?', '--voices', 'v1', '--model', 'eleven_v3', '--out', path.join(v.d, 'voice', 'samples-v3')], { env })
    assert.equal(b.code, 0, b.tudo)
    assert.equal(api.tts()[0].json.model_id, 'eleven_v3')
  })
})

describe('called through the skill link', () => {
  let base, link
  before(() => {
    base = tmp('link')
    link = path.join(base, 'skills', 'primo-videos')
    fs.mkdirSync(path.dirname(link), { recursive: true })
    fs.symlinkSync(path.join(AQUI, '..'), link, 'dir')
  })
  after(() => fs.rmSync(base, { recursive: true, force: true }))

  test('voice.mjs and chapters/tempos.mjs answer through the link (they do not exit silently)', async () => {
    const r = await rodar(['nope'], { script: path.join(link, 'scripts', 'voice.mjs') })
    assert.equal(r.code, 2)
    assert.match(r.err, /usage: node voice\.mjs <account\|search\|samples\|generate/)
    const t = await rodar([], { script: path.join(link, 'scripts', 'chapters', 'tempos.mjs') })
    assert.match(t.err, /usage: node tempos\.mjs <project>/)
  })
})
