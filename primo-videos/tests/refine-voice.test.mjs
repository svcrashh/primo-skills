// O refino da voz contra os defeitos que já aconteceram: a palavra que nasce dentro da pausa (a animação acendia antes
// da voz), o silêncio sobrando no fim do take e a voz apagada num Reels. Fala sintética com o gabarito exato
// (tests/voice-signals.mjs) e, no Mac, fala de verdade do `say`. node --test tests/refine-voice.test.mjs (sem rede; ffmpeg)
// Casos gravados de verdade (fora do repositório): PRIMO_VIDEOS_VOICE_CASES=<pasta com casos.json e os .flac> liga o
// último bloco; sem a variável, ele é pulado.
import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { lerWav, acertarPelaVoz, pausasDaVoz, apararFim, expressividade, validarLocucao, inicioVoz, fimDaVoz, ritmo } from '../scripts/voice.mjs'
import { refinarLocucao, julgarExpressao, PISO_REELS } from '../scripts/refine/locucao.mjs'
import { falaSintetica, falaDoWav, falaDoSay, temSay } from './voice-signals.mjs'

const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'refine-voice-'))
const ini = (fala, texto, vez = 1) => fala.palavras.filter((p) => p.texto === texto)[vez - 1].ini

// "No Vyrta, nove e noventa e nove! Uns dez reais a menos.": o som de verdade (as rajadas) e o alinhamento como a
// ElevenLabs devolve, com "nove" e "Uns" começando onde a palavra anterior acabou, dentro da pausa.
const C2 = [['No', 0.2, 0.4], ['Vyrta,', 0.45, 0.95], ['nove', 1.5, 1.85], ['e', 1.9, 2.0], ['noventa', 2.05, 2.55], ['e', 2.6, 2.7], ['nove!', 2.75, 3.3],
  ['Uns', 3.8, 4.0], ['dez', 4.05, 4.35], ['reais', 4.4, 4.8], ['a', 4.85, 4.92], ['menos.', 4.97, 5.4]]
const C2_CRU = C2.map(([t, a, b], i) => [t, t === 'nove' && i === 2 ? 0.96 : t === 'Uns' ? 3.31 : a, b])
// "Termina em segundos.": a voz acaba em 1,5 s e o take segue mudo até 3,6 s; o alinhamento estica a última palavra até o fim.
const C1 = [['Termina', 0.2, 0.6], ['em', 0.65, 0.8], ['segundos.', 0.85, 1.5]]
const C1_CRU = C1.map(([t, a, b], i) => [t, a, i === C1.length - 1 ? 3.6 : b])
const som = (ps) => ps.map(([, a, b]) => [a, b])

describe('animation before the word: the alignment by the real pauses', () => {
  test('"nove" and "Uns", born inside the pause, now start when the voice comes back (±30 ms)', () => {
    const d = tmp(), arq = path.join(d, 'c2.wav')
    falaSintetica(arq, som(C2))
    const w = lerWav(arq)
    const original = C2_CRU.map(([texto, a, b]) => ({ texto, ini: a, fim: b }))
    const { palavras, mudancas } = acertarPelaVoz(original, w.amostras, w.taxa)
    for (const [t, certo] of [['nove', 1.5], ['Uns', 3.8]]) {
      const p = palavras.find((x) => x.texto === t)
      assert.ok(certo - original.find((x) => x.texto === t).ini >= 0.14, `${t}: the raw alignment was early`)
      assert.ok(Math.abs(p.ini - certo) <= 0.03, `${t}: ${p.ini} s, the sound starts at ${certo} s`)
      assert.ok(mudancas.some((m) => m.texto === t && m.campo === 'ini'))
    }
    assert.equal(mudancas.filter((m) => m.campo === 'ini').length, 2, 'only the two words after a pause move')
    palavras.forEach((p, i) => { assert.ok(p.ini <= p.fim); if (i) assert.ok(p.ini >= palavras[i - 1].ini) })
  })

  test('a pause inside a word (an address read in two pieces) does not pull the word forward', () => {
    const d = tmp(), arq = path.join(d, 'site.wav')
    falaSintetica(arq, [[0.2, 0.5], [0.55, 0.9], [1.05, 1.5]])
    const w = lerWav(arq)
    assert.equal(pausasDaVoz(w.amostras, w.taxa).length, 1, 'the 0.15 s gap is a pause')
    const { palavras, mudancas } = acertarPelaVoz([{ texto: 'Open', ini: 0.2, fim: 0.5 }, { texto: 'vyrta.app!', ini: 0.55, fim: 1.5 }], w.amostras, w.taxa)
    assert.equal(palavras[1].ini, 0.55)
    assert.deepEqual(mudancas, [])
  })
})

describe('leftover silence at the end of the line: trimmed on its own', () => {
  test('2.1 s of silence after the voice: cut at the last sound + 0.12 s, and the last word ends at the last sound', () => {
    const d = tmp(), arq = path.join(d, 'c1.wav')
    falaSintetica(arq, som(C1), { total: 3.6 })
    assert.equal(lerWav(arq).n / 48000, 3.6)
    const cortado = apararFim(arq)
    assert.ok(cortado > 1.9 && cortado < 2.05, `cut ${cortado} s`)
    const w = lerWav(arq)
    assert.ok(Math.abs(w.n / w.taxa - (1.5 + 0.12)) <= 0.02, `${w.n / w.taxa} s left`)
    const { palavras } = acertarPelaVoz(C1_CRU.map(([texto, a, b]) => ({ texto, ini: a, fim: Math.min(b, w.n / w.taxa) })), w.amostras, w.taxa)
    assert.ok(Math.abs(palavras.at(-1).fim - 1.5) <= 0.02, `"segundos." ends at ${palavras.at(-1).fim}`)
    assert.equal(apararFim(arq), 0, 'trimming again does not touch it')
  })

  test('a line without leftover silence is not touched', () => {
    const d = tmp(), arq = path.join(d, 'c2.wav')
    falaSintetica(arq, som(C2))
    const antes = fs.readFileSync(arq)
    assert.equal(apararFim(arq), 0)
    assert.deepEqual(fs.readFileSync(arq), antes)
  })
})

describe('flat voice: energy and pitch movement against the approved voice', () => {
  const medir = (viva) => { const arq = path.join(tmp(), 'v.wav'); falaSintetica(arq, som(C2), { viva }); const w = lerWav(arq); return expressividade(w.amostras, w.taxa) }
  const animada = medir(true), apagada = medir(false)
  test('the lively read passes against itself and against the Reels floor', () => {
    assert.ok(animada.tom >= PISO_REELS.tom && animada.energia >= PISO_REELS.energia, JSON.stringify(animada))
    assert.equal(julgarExpressao(animada, animada).nivel, null)
    assert.equal(julgarExpressao(animada, PISO_REELS).nivel, null)
  })
  test('the flat read fails in a Reels, against the approved one and against the floor', () => {
    assert.ok(apagada.tom < animada.tom * 0.8, `pitch ${apagada.tom} × ${animada.tom}`)
    assert.equal(julgarExpressao(apagada, animada).nivel, 'erro')
    assert.equal(julgarExpressao(apagada, PISO_REELS).nivel, 'erro')
  })
})

describe('refinarLocucao: fixes the narration.json and keeps the original', () => {
  function projeto() {
    const d = tmp(), dir = path.join(d, 'voice', 'v1')
    falaSintetica(path.join(dir, 'lines', 'c2.wav'), som(C2))
    falaSintetica(path.join(dir, 'lines', 'c1.wav'), som(C1), { total: 3.6 })
    const falas = [
      falaDoWav(dir, 'lines/c2.wav', { id: 'f0', onde: 'abertura', palavras: C2_CRU }),
      falaDoWav(dir, 'lines/c1.wav', { id: 'f1', onde: 'fechamento', palavras: C1_CRU }),
    ]
    const loc = { versao: 1, idioma: 'pt-BR', voz: { nome: 'Invented Voice' }, falas }
    assert.deepEqual(validarLocucao(loc, dir), [])
    fs.writeFileSync(path.join(dir, 'narration.json'), JSON.stringify(loc))
    return path.join(dir, 'narration.json')
  }

  test('check only: points it out, touches nothing, and returns the fixed lines in memory', () => {
    const arq = projeto(), antes = fs.readFileSync(arq, 'utf8')
    const r = refinarLocucao(arq, { corrigir: false, perfil: 'reels' })
    assert.equal(fs.readFileSync(arq, 'utf8'), antes)
    assert.ok(!fs.existsSync(path.join(path.dirname(arq), 'narration.before-refine.json')))
    assert.ok(r.achados.some((a) => a.checagem === 'silencio-fim' && a.nivel === 'erro' && a.fala === 'f1'))
    assert.ok(r.achados.some((a) => a.checagem === 'alinhamento' && /"nove" 0\.5\d s early/.test(a.msg)), JSON.stringify(r.achados.map((a) => a.msg)))
    assert.ok(Math.abs(ini(r.falas[0], 'nove') - 1.5) < 0.03)
    assert.ok(!r.achados.some((a) => a.checagem === 'voz-apagada'), 'the lively read passes the Reels floor')
  })

  test('fixing: the narration.json passes the contract, the leftover take is trimmed and nothing is lost', () => {
    const arq = projeto(), dir = path.dirname(arq)
    refinarLocucao(arq, { corrigir: true })
    const loc = JSON.parse(fs.readFileSync(arq, 'utf8'))
    assert.deepEqual(validarLocucao(loc, dir), [])
    assert.ok(Math.abs(loc.falas[1].duracao - 1.62) <= 0.02, String(loc.falas[1].duracao))
    assert.ok(Math.abs(ini(loc.falas[0], 'Uns') - 3.8) < 0.03)
    assert.ok(fs.existsSync(path.join(dir, 'narration.before-refine.json')))
    assert.equal(lerWav(path.join(dir, 'lines', '_before-refine', 'c1.wav')).n, 3.6 * 48000)
    const r2 = refinarLocucao(arq, { corrigir: true })
    assert.deepEqual(r2.achados.filter((a) => a.nivel === 'erro'), [])
  })
})

describe('real speech (the Mac `say`, the Windows voices)', { skip: !temSay() && 'no speech synthesizer here (it uses the Mac `say` or the Windows voices)' }, () => {
  test('first sound, the pause at the period, last sound and the measures come out of a real voice', () => {
    const arq = falaDoSay(path.join(tmp(), 'say.wav'), 'Open the app and tap on Book. Then pick the time you want.')
    assert.ok(arq, 'the synthesizer produced audio')
    const w = lerWav(arq)
    const iv = inicioVoz(w.amostras, w.taxa), fv = fimDaVoz(w.amostras, w.taxa)
    assert.ok(iv != null && iv < 0.5, `first sound ${iv}`)
    assert.ok(fv > iv + 2 && fv <= w.n / w.taxa, `last sound ${fv}`)
    const pausas = pausasDaVoz(w.amostras, w.taxa, { minimo: 0.2 })
    assert.ok(pausas.length >= 1, 'the period makes a pause')
    const e = expressividade(w.amostras, w.taxa), rt = ritmo(w.amostras, w.taxa)
    assert.ok(e.f0 > 60 && e.f0 < 400 && e.quadros > 50, JSON.stringify(e))
    assert.ok(rt.silabas > 8 && rt.silabasPorSeg > 2 && rt.silabasPorSeg < 9, JSON.stringify(rt))
  })
})

// Os casos gravados (fora do repositório): casos.json { casos: { <nome>: { original, corrigido_a_mao } } } e <nome>.flac.
const CASOS = process.env.PRIMO_VIDEOS_VOICE_CASES
describe('recorded cases (outside the repository)', { skip: !(CASOS && fs.existsSync(path.join(CASOS, 'casos.json'))) && 'PRIMO_VIDEOS_VOICE_CASES is not set' }, () => {
  test('every word the hand correction moved ≥ 0.14 s lands within ±30 ms of it', () => {
    const { casos } = JSON.parse(fs.readFileSync(path.join(CASOS, 'casos.json'), 'utf8'))
    let conferidas = 0
    for (const [nome, c] of Object.entries(casos)) {
      if (!c.original || !c.corrigido_a_mao || !fs.existsSync(path.join(CASOS, `${nome}.flac`))) continue
      const arq = path.join(tmp(), `${nome}.wav`)
      assert.equal(spawnSync('ffmpeg', ['-v', 'error', '-y', '-i', path.join(CASOS, `${nome}.flac`), '-c:a', 'pcm_s16le', arq]).status, 0)
      const w = lerWav(arq)
      if (Math.abs(w.n / w.taxa - c.original.duracao) > 0.01) continue   // o take sem aparar: o teste do fim cobre
      const { palavras } = acertarPelaVoz(c.original.palavras, w.amostras, w.taxa)
      c.original.palavras.forEach((p, i) => {
        const certo = c.corrigido_a_mao.palavras[i]?.ini
        if (certo == null || certo - p.ini < 0.14) return
        conferidas++
        assert.ok(Math.abs(palavras[i].ini - certo) <= 0.03, `${nome} word ${i + 1}: ${palavras[i].ini} s, by hand ${certo} s`)
      })
    }
    assert.ok(conferidas > 0, 'the cases have words the hand correction moved')
  })
})
