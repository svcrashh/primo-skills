// A tese do vídeo (thesis.md): ler as cinco partes, conferir que estão todas lá e resumir em cinco linhas.
// Aqui só se confere o formato; quem escreve é a conversa nova (write.mjs) ou quem faz o vídeo. recipes/thesis.md
//   import { lerTese, validarTese, resumoTese, acharTese } from './thesis/read.mjs'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

export const INTENCOES = ['sell', 'teach', 'update']
export const FORMATOS = { sell: 'hook, the proof, call to action', teach: 'tutorial, with steps', update: 'the before and the after' }
// a tese escrita em português também se lê: a intenção vira o id em inglês
const INTENCAO_PT = { vender: 'sell', ensinar: 'teach', novidade: 'update' }
export const MAX_PALAVRAS_FRASE = 30

// Os títulos da receita ficam em inglês (recipes/thesis.md); os equivalentes em português também valem.
export const PARTES = [
  { id: 'vende', n: 1, nome: 'What the product sells', en: 'what the product sells', re: /\bvende\b|\bsells\b/ },
  { id: 'compra', n: 2, nome: 'Who buys, and what pain they have', en: 'who buys, and what pain they have', re: /\bcompra\b|\bbuys\b/ },
  { id: 'prova', n: 3, nome: 'The proof scene', en: 'the proof scene', re: /cena[- ]prova|proof[- ]scene/ },
  { id: 'fora', n: 4, nome: 'What the video does not show', en: 'what the video does not show', re: /nao mostra|(does not|doesn'?t) show/ },
  { id: 'intencao', n: 5, nome: 'The intent', en: 'the intent', re: /intencao|\bintent\b/ },
]

const semAcento = (s) => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
const limpo = (s) => String(s ?? '').replace(/\*\*/g, '').replace(/^["“”'\s]+|["“”'\s]+$/g, '').trim()

/**
 * O valor de um campo `**Nome:** valor` (o resto da linha e as linhas seguintes, até um vazio, outro campo ou um item de
 * lista). `nome` pode ser uma lista de nomes (o rótulo em português e o em inglês).
 */
export function campo(corpo, nome) {
  const linhas = String(corpo ?? '').split('\n')
  const alvos = [].concat(nome).map(semAcento)
  for (let i = 0; i < linhas.length; i++) {
    const m = /^\s*(?:[-*]\s+)?\*\*([^*]+?):?\*\*:?\s*(.*)$/.exec(linhas[i])
    if (!m || !alvos.some((alvo) => semAcento(m[1]).startsWith(alvo))) continue
    const partes = [m[2]]
    for (let j = i + 1; j < linhas.length; j++) {
      const l = linhas[j]
      if (!l.trim() || /^\s*(?:[-*]\s+)?\*\*[^*]+\*\*/.test(l) || /^\s*[-*]\s+/.test(l) || /^#/.test(l)) break
      partes.push(l.trim())
    }
    return partes.join(' ').trim()
  }
  return ''
}

/** As evidências de um trecho: `caminho:linha` entre crases, ou um endereço. */
export function evidencias(corpo) {
  const t = String(corpo ?? '')
  return [...t.matchAll(/`([^`\s]+:\d+(?:\s*[-–]\s*\d+)?)`/g)].map((m) => m[1]).concat([...t.matchAll(/https?:\/\/[^\s)`"]+/g)].map((m) => m[0]))
}

/** A frase do campo "Frase": se ela vem entre aspas com um comentário depois, vale só o que está entre as aspas. */
export function fraseDe(valor) {
  const v = String(valor ?? '').replace(/\*\*/g, '').trim()
  const m = /^["“]([^"”]{8,})["”]/.exec(v)
  return m && v.length > m[0].length ? m[1].trim() : limpo(v)
}

const itens = (corpo) => String(corpo ?? '').split('\n').filter((l) => /^[-*]\s+\S/.test(l)).map((l) => l.replace(/^[-*]\s+/, '').replace(/\*\*/g, '').trim())

/** Lê o texto de um thesis.md. Devolve as partes pelo id, os campos principais e o que ficou em aberto ("o que não deu para saber"). */
export function lerTese(texto) {
  const t = String(texto ?? '').replace(/\r/g, '')
  const titulo = (/^#\s+(.+)$/m.exec(t) || [])[1] || ''
  const produto = titulo.includes('·') ? titulo.split('·').slice(1).join('·').trim() : ''
  const partes = {}
  const blocos = t.split(/^##\s+/m).slice(1)
  for (const b of blocos) {
    const nl = b.indexOf('\n')
    const cab = semAcento(nl < 0 ? b : b.slice(0, nl)), corpo = nl < 0 ? '' : b.slice(nl + 1).trim()
    const p = PARTES.find((x) => x.re.test(cab) && !(x.id in partes))
    if (p) partes[p.id] = corpo
    else if (/nao deu para saber|could not be found out/.test(cab)) partes.duvidas = corpo
  }
  const intencaoBruta = campo(partes.intencao, ['Intenção', 'Intent'])
  const palavra = (semAcento(limpo(intencaoBruta)).replace(/`/g, '').match(/[a-z]+/) || [''])[0]
  const intencao = INTENCAO_PT[palavra] ?? palavra
  return {
    titulo, produto, partes,
    frase: fraseDe(campo(partes.vende, ['Frase', 'Sentence'])),
    deOnde: evidencias(partes.vende),
    categoria: limpo(campo(partes.vende, ['Categoria', 'Category'])),
    quemCompra: limpo(campo(partes.compra, ['Quem compra', 'Who buys'])),
    dor: limpo(campo(partes.compra, ['Dor', 'Pain'])),
    cena: limpo(campo(partes.prova, ['Cena', 'Scene'])),
    onde: limpo(campo(partes.prova, ['Onde', 'Where'])),
    quemTrabalha: limpo(campo(partes.prova, ['Quem trabalha', 'Who does the work'])),
    detalhe: limpo(campo(partes.prova, ['O detalhe que convence', 'The convincing detail'])),
    terminaEm: limpo(campo(partes.prova, ['Termina', 'Ends'])),
    fora: itens(partes.fora),
    intencao, intencaoBruta: limpo(intencaoBruta),
    porque: limpo(campo(partes.intencao, ['Por qu', 'Why'])),
  }
}

/** Confere que a tese tem as cinco partes, a frase com a fonte e uma intenção das três. Devolve { ok, erros, avisos }. */
export function validarTese(tese) {
  const erros = [], avisos = []
  for (const p of PARTES) if (!tese.partes[p.id]?.trim()) erros.push(`missing part ${p.n}, "${p.nome}": a "## ${p.n}. ${p.nome}" heading with the content below it`)
  if (tese.partes.vende != null) {
    if (!tese.frase) erros.push('missing the sentence of what the product sells ("**Sentence:** …")')
    else {
      const n = tese.frase.split(/\s+/).length
      if (n > MAX_PALAVRAS_FRASE) erros.push(`the sentence has ${n} words: it is a single sentence, of up to ${MAX_PALAVRAS_FRASE}`)
    }
    if (!tese.deOnde.length) erros.push('the sentence does not say where it came from: put the `arquivo:linha` (file:line, or the URL) and the copied passage under "**Source:**"')
    if (!tese.categoria) avisos.push('no "**Category (not the sale):**" line: the category may be passing for the sale')
  }
  if (tese.partes.compra != null) {
    if (!tese.quemCompra) erros.push('missing "**Who buys:**"')
    if (!tese.dor) erros.push('missing "**Pain:**"')
  }
  if (tese.partes.prova != null) {
    if (!tese.cena) erros.push('missing "**Scene:**" in the proof scene (starts, happens, ends)')
    if (!tese.onde) erros.push('the proof scene does not say where it is on screen ("**Where, on screen:**")')
    if (!tese.quemTrabalha) erros.push('the proof scene does not say who does the work ("**Who does the work:**")')
    if (!tese.detalhe) avisos.push('the proof scene does not name the convincing detail ("**The convincing detail:**"): what shows the work came out well done')
    if (tese.onde && !evidencias(tese.partes.prova).length) avisos.push('the proof scene does not point to an `arquivo:linha` (file:line): check that the screen exists before promising it in the script')
  }
  if (tese.partes.fora != null && !tese.fora.length) erros.push('"What the video does not show" needs at least one list item')
  if (tese.partes.intencao != null) {
    if (!tese.intencaoBruta) erros.push('missing "**Intent:**"')
    else if (!INTENCOES.includes(tese.intencao)) erros.push(`the intent must be exactly one of ${INTENCOES.join(', ')} (got "${tese.intencaoBruta}")`)
  }
  return { ok: !erros.length, erros, avisos }
}

const corta = (s, n) => (s.length > n ? s.slice(0, n - 1).trimEnd() + '…' : s)

/** As cinco linhas que se mostram ao dono. */
export function resumoTese(tese) {
  return [
    `Sells:     "${tese.frase}"${tese.deOnde[0] ? ` (${tese.deOnde[0]})` : ''}`,
    `Buyer:     ${corta(tese.quemCompra, 110)} · pain: ${corta(tese.dor, 130)}`,
    `Proof:     ${corta(tese.cena, 240)}`,
    `Not shown: ${corta(tese.fora.join('; '), 240)}`,
    `Intent:    ${tese.intencao}${FORMATOS[tese.intencao] ? ` → ${FORMATOS[tese.intencao]}` : ''}`,
  ].join('\n')
}

/** O thesis.md de um vídeo ou de um roteiro: o explícito, ou o da pasta dele, ou de até 3 pastas acima (nunca acima da casa). */
export function acharTese(arquivo, explicita) {
  if (explicita) return path.resolve(explicita)
  let dir = path.dirname(path.resolve(arquivo))
  const casa = os.homedir()
  for (let i = 0; i < 4; i++) {
    const c = path.join(dir, 'thesis.md')
    if (fs.existsSync(c)) return c
    const pai = path.dirname(dir)
    if (pai === dir || dir === casa) break
    dir = pai
  }
  return null
}
