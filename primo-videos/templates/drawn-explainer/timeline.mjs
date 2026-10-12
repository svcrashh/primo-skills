// explicação desenhada · a linha do tempo: quanto cada cena dura e quando cada palavra é dita.
// Com voz, os tempos saem do narration.json da skill (a voz gerada e medida): a cena dura o respiro antes da voz
// (lead), a fala e o respiro depois (hold). Sem voz, a cena dura `min` (ou o tempo de ler o `texto` dela), e as
// palavras do texto ganham tempos de leitura, para `at: 'palavra'` continuar funcionando nas cenas.
// A conta é a do explainroo (src/timeline.js, https://github.com/vincentsch/explainroo, commit 5347905; MIT,
// © 2026 Vincent Schmalbach, licença em LICENSE-explainroo.txt), com a voz e as marcas da skill.
import { normWord, suggest } from './scene/engine/util.js'

export const PADRAO = { fps: 30, lead: 0.35, hold: 0.7, end: 1.4, minimo: 3, leitura: 2.6, transicao: 0.7, pace: 1 }
export const TRANSICOES = ['auto', 'fade', 'slide', 'wipe', 'zoom', 'brush', 'cut', 'push', 'none']

const r3 = (x) => Math.round(x * 1000) / 1000

// A fala (ou o pedaço dela, de `de` a `ate` segundos) que a cena usa, com as palavras no tempo do pedaço.
export function trechoDaFala(locucao, cena) {
  const f = (locucao.falas || []).find((x) => x.id === cena.fala)
  if (!f) throw new Error(`scene "${cena.id}": the line "${cena.fala}" is not in narration.json (lines: ${(locucao.falas || []).map((x) => x.id).join(', ') || 'none'})`)
  const de = cena.de ?? 0
  const ultima = f.palavras.filter((p) => p.ini >= de - 0.01 && (cena.ate === undefined || p.fim <= cena.ate + 0.01)).at(-1)
  const ate = cena.ate ?? Math.min(f.duracao, (ultima ? ultima.fim : f.duracao) + 0.05)
  if (!(ate > de)) throw new Error(`scene "${cena.id}": the excerpt of the line "${cena.fala}" (from ${de} to ${ate} s) is empty`)
  const palavras = f.palavras.filter((p) => p.ini >= de - 0.01 && p.fim <= ate + 0.01).map((p) => ({ text: p.texto, start: r3(Math.max(0, p.ini - de)), end: r3(Math.max(0, p.fim - de)) }))
  if (!palavras.length) throw new Error(`scene "${cena.id}": no word of the line "${cena.fala}" falls between ${de} and ${ate} s`)
  return { fala: f, de, ate, dur: r3(ate - de), palavras, texto: palavras.map((p) => p.text).join(' ') }
}

// Palavras com tempo de leitura para uma cena sem voz: `leitura` palavras por segundo a partir do lead.
export function palavrasDeLeitura(texto, lead, leitura) {
  const ws = String(texto || '').split(/\s+/).filter(Boolean)
  return ws.map((w, i) => ({ text: w, start: r3(lead + i / leitura), end: r3(lead + (i + 0.8) / leitura) }))
}

// marcas: { nome: 'palavra' | 'palavra#2' | 'duas palavras' | segundos | { palavra, n, mais } } → segundos na cena.
export function resolverMarcas(cena, palavras) {
  const out = {}
  for (const [nome, v] of Object.entries(cena.marcas || {})) {
    if (typeof v === 'number') { out[nome] = v; continue }
    const o = typeof v === 'string' ? { palavra: v } : v
    let alvo = String(o.palavra)
    let n = o.n ?? 1
    const m = /^(.*)#(\d+)$/.exec(alvo)
    if (m) { alvo = m[1]; n = +m[2] }
    const want = alvo.split(/\s+/).map(normWord).filter(Boolean)
    const norms = palavras.map((w) => normWord(w.text))
    let visto = 0
    let achou = null
    for (let i = 0; i + want.length <= norms.length && !achou; i++) {
      if (want.every((wd, k) => norms[i + k] === wd) && ++visto === n) achou = palavras[i]
    }
    if (!achou) throw new Error(`scene "${cena.id}": the mark "${nome}" asks for "${alvo}"${n > 1 ? ` (occurrence ${n})` : ''}, which is not in the line. Similar words: ${suggest(want[0] || alvo, [...new Set(norms)], 5).join(', ')}`)
    out[nome] = r3(achou.start + (o.mais ?? 0))
  }
  return out
}

// cenas: [{ id, fala?, de?, ate?, texto?, min?, hold?, lead?, transicao?, marcas? }] na ordem do vídeo.
// locucao: o narration.json (ou null para o vídeo sem voz). opcoes: { semVoz, fps, lead, hold, end, leitura, pace,
// inicios: { [cena]: segundos } }. `inicios` é o primeiro som medido no trecho cortado (a régua do inicioVoz do
// Contrato L): um trecho do meio de uma fala começa onde a voz soa, não onde o alinhamento pôs a palavra.
export function montarLinha(cenas, locucao, opcoes = {}) {
  const op = { ...PADRAO, ...opcoes }
  const pace = op.pace || 1
  const snap = (t) => Math.round(t * op.fps) / op.fps
  const ids = new Set()
  const scenes = []
  const voz = []
  let t = 0
  cenas.forEach((cena, index) => {
    if (!cena.id || !/^[A-Za-z_$][\w$]*$/.test(cena.id)) throw new Error(`scene ${index + 1}: "id" must be a function name (letters, numbers, _), got ${JSON.stringify(cena.id)}`)
    if (ids.has(cena.id)) throw new Error(`the scene "${cena.id}" appears twice`)
    ids.add(cena.id)
    if (cena.transicao && !TRANSICOES.includes(cena.transicao)) throw new Error(`scene "${cena.id}": transition "${cena.transicao}" does not exist (${TRANSICOES.join(', ')})`)
    const comVoz = !!(cena.fala && locucao && !op.semVoz)
    const isLast = index === cenas.length - 1
    const tr = comVoz ? trechoDaFala(locucao, cena) : null
    // sem voz, a cena que tinha fala lê o texto dela (as mesmas palavras), para os cues continuarem valendo
    const leitura = !comVoz && cena.fala && locucao ? trechoDaFala(locucao, cena).texto : null
    const lead = (cena.lead ?? op.lead) / pace
    const hold = ((cena.hold ?? op.hold) + (isLast ? op.end : 0)) / pace
    let palavras, dur
    const medido = tr && op.inicios ? op.inicios[cena.id] : undefined
    if (tr && medido !== undefined && medido !== null && tr.palavras[0].start < medido) {
      tr.palavras[0].start = r3(medido)
      tr.palavras[0].end = Math.max(tr.palavras[0].end, r3(medido + 0.02))
    }
    if (tr) {
      palavras = tr.palavras.map((w) => ({ text: w.text, start: r3(lead + w.start), end: r3(lead + w.end) }))
      dur = lead + tr.dur + hold
    } else {
      const texto = cena.texto || leitura || ''
      palavras = palavrasDeLeitura(texto, lead, op.leitura * pace)
      const ler = palavras.length ? palavras.at(-1).end + hold : 0
      dur = Math.max(((cena.min ?? op.minimo) + (isLast ? op.end : 0)) / pace, ler)
    }
    if (cena.min) dur = Math.max(dur, cena.min / pace)
    dur = Math.max(snap(dur), 1)
    const start = snap(t)
    const marks = resolverMarcas(cena, palavras)
    const sc = {
      id: cena.id, index, start, dur, lead,
      text: tr ? tr.texto : cena.texto || leitura || '',
      transition: index === 0 ? 'none' : cena.transicao || 'auto',
      voice: tr ? { start: r3(start + lead), dur: tr.dur, fala: cena.fala, de: tr.de, ate: tr.ate } : null,
      sintetico: !tr,
      words: palavras,
      marks,
    }
    if (tr) {
      const ini = start + lead
      const primeiro = medido !== undefined && medido !== null ? medido : tr.palavras[0].start
      voz.push({ cena: cena.id, fala: cena.fala, de: tr.de, ate: tr.ate, arquivo: tr.fala.arquivo, inicio: r3(ini), som: r3(ini + primeiro), fim: r3(ini + tr.palavras.at(-1).end), texto: tr.texto })
    }
    scenes.push(sc)
    t = start + dur
  })
  const duration = snap(t)
  return { fps: op.fps, duration, frames: Math.round(duration * op.fps), transitionSeconds: op.transicao / pace, pace, scenes, voz }
}
