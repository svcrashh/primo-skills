// node --test tests/   (sem rede): a explicação desenhada com a voz — a narração do molde
// (templates/drawn-explainer/voice/narracao.mjs) corta o trecho de cada cena falada, mede o primeiro som dele, monta a
// locução da obra (o que o refino mede) e escreve a voz no tempo do vídeo, a legenda e o bloco "voz" da folha.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { montarLinha, trechoDaFala } from '../templates/drawn-explainer/timeline.mjs'
import { cortarTrechos, escreverNarracao, LEGENDA } from '../templates/drawn-explainer/voice/narracao.mjs'
import { validarLocucao, lerWav } from '../scripts/voice.mjs'
import { falaSintetica, falaDoWav } from './voice-signals.mjs'

// uma fala inventada, cortada em duas cenas: "Paste the link. The card fills itself in seconds."
const PALAVRAS = [['Paste', 0.2, 0.5], ['the', 0.55, 0.65], ['link.', 0.7, 1.1], ['The', 1.6, 1.75], ['card', 1.8, 2.1], ['fills', 2.15, 2.45], ['itself', 2.5, 2.9], ['in', 2.95, 3.05], ['seconds.', 3.1, 3.7]]
const ROTEIRO = [
  { id: 'field', fala: 'l1', de: 0, ate: 1.3, texto: 'Paste the link.' },
  { id: 'card', fala: 'l1', de: 1.3, texto: 'The card fills itself in seconds.' },
  { id: 'closing', texto: 'Try it.' },
]
function narracao() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'drawn-voice-'))
  falaSintetica(path.join(dir, 'lines', 'l1.wav'), PALAVRAS.map(([, a, b]) => [a, b]))
  const loc = { versao: 1, idioma: 'en-US', voz: { nome: 'Invented Voice' }, falas: [falaDoWav(dir, 'lines/l1.wav', { id: 'l1', onde: { capitulo: 1 }, palavras: PALAVRAS })] }
  assert.deepEqual(validarLocucao(loc, dir), [])
  return { dir, loc }
}

test('each spoken scene gets its excerpt of the line, with the words on the scene clock', () => {
  const { loc } = narracao()
  const a = trechoDaFala(loc, ROTEIRO[0]), b = trechoDaFala(loc, ROTEIRO[1])
  assert.equal(a.texto, 'Paste the link.')
  assert.equal(b.texto, 'The card fills itself in seconds.')
  assert.equal(b.palavras[0].start, 0.3, 'The starts 0.3 s into its excerpt (1.6 − 1.3)')
  const tl = montarLinha(ROTEIRO, loc)
  assert.deepEqual(tl.voz.map((v) => v.cena), ['field', 'card'])
})

test('the narration cuts each spoken scene, measures its first sound and builds the narration of the build (Contract L)', () => {
  const { dir, loc } = narracao()
  const obra = fs.mkdtempSync(path.join(os.tmpdir(), 'drawn-build-'))
  try {
    const { inicios, wavs } = cortarTrechos({ roteiro: ROTEIRO, locucao: loc, dirLoc: dir, obra, trechoDaFala })
    assert.deepEqual(Object.keys(wavs).sort(), ['card', 'field'])
    assert.ok(Math.abs(inicios.field - 0.2) < 0.02, `field starts at ${inicios.field}`)
    assert.ok(Math.abs(inicios.card - 0.3) < 0.02, `card starts at ${inicios.card}`)
    const arq = path.join(obra, 'voice', 'obra', 'narration.json')
    const l = JSON.parse(fs.readFileSync(arq, 'utf8'))
    assert.deepEqual(validarLocucao(l, path.dirname(arq)), [], 'the build narration (what the refine measures) passes Contract L')
    assert.deepEqual(l.falas.map((f) => f.id), ['field', 'card'])

    // na hora do som: a voz inteira no tempo do vídeo, a legenda e o bloco da folha
    const tl = montarLinha(ROTEIRO, loc, { inicios })
    const falas = tl.voz.map((v) => ({ id: v.cena, texto: v.texto, caminho: wavs[v.cena], inicioArquivo: v.inicio, som: v.som, fim: v.fim }))
    const dirAudio = path.join(obra, 'audio')
    fs.mkdirSync(dirAudio, { recursive: true })
    const bloco = escreverNarracao({ falas, duracao: tl.duration, dirAudio, obra, perfil: 'reels' })
    assert.equal(bloco.arquivo, 'voz.wav')
    assert.equal(bloco.perfil, 'reels')
    assert.equal(bloco.trechos.length, 2)
    const w = lerWav(path.join(dirAudio, 'voz.wav'))
    assert.ok(Math.abs(w.n / w.taxa - tl.duration) < 0.001)
    const srt = fs.readFileSync(path.join(obra, LEGENDA), 'utf8')
    assert.match(srt, /^1\n\d\d:\d\d:\d\d,\d{3} --> \d\d:\d\d:\d\d,\d{3}\nPaste the link\.\n/)
  } finally { fs.rmSync(obra, { recursive: true, force: true }) }
})
