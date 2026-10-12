// A regra do tempo de tela: no roteiro, cada cena diz quem trabalha nela (o produto ou uma pessoa), e num vídeo de
// venda a cena-prova é a maior parte do tempo de produto. Aqui se lê a tabela do roteiro, se faz a conta e se decide
// se o roteiro passa ou volta. recipes/thesis.md → "A regra do tempo de tela"
//   import { lerRoteiro, contar, julgar, textoConta } from './thesis/count.mjs'
export const LIMITES = { provaMin: 0.5, pessoaMax: 0.25 }
export const MARCA_INI = '<!-- count:start -->', MARCA_FIM = '<!-- count:end -->'

const semAcento = (s) => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
const cru = (s) => semAcento(s).replace(/[*`_]/g, '').trim()
const r1 = (v) => Math.round(v * 10) / 10
const fmt = (v) => String(r1(v))
const pct = (v) => `${Math.round(v * 100)}%`

const celulas = (linha) => linha.trim().replace(/^\|/, '').replace(/\|$/, '').split(/(?<!\\)\|/).map((c) => c.trim())
const ehDivisor = (linha) => /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$/.test(linha)

/** As tabelas Markdown de um texto: [{ cabecalho, linhas, ini, fim }] (ini e fim são linhas do texto). */
export function tabelas(md) {
  const L = String(md).replace(/\r/g, '').split('\n'), out = []
  for (let i = 0; i + 1 < L.length; i++) {
    if (!L[i].includes('|') || !ehDivisor(L[i + 1])) continue
    const t = { cabecalho: celulas(L[i]), linhas: [], ini: i, fim: i + 1 }
    let j = i + 2
    for (; j < L.length && L[j].includes('|') && L[j].trim(); j++) t.linhas.push(celulas(L[j]))
    t.fim = j - 1
    out.push(t)
    i = j - 1
  }
  return out
}

// a coluna se chama "Who does the work" (recipes/thesis.md); o nome em português também vale
const ehTempo = (c) => /^(s|seg|segs|segundos|tempo|duracao|sec|secs|seconds|time|duration)$/.test(cru(c).replace(/[().]/g, ''))
const ehTrabalha = (c) => /quem trabalha|^trabalha|who does the work|^who works/.test(cru(c))

/** "~5", "3,5 s", "4–6 s", "2.8" → segundos (a faixa vira a média). Vazio ou "—" → null. */
export function tempoDe(celula) {
  const t = cru(celula).replace(/[~≈]|cerca de|about/g, '').replace(/\bs\b|seg\w*|sec\w*/g, '').trim()
  if (!t || /^[-–—]+$/.test(t)) return null
  const n = [...t.matchAll(/\d+(?:[.,]\d+)?/g)].map((m) => +m[0].replace(',', '.'))
  if (!n.length) return null
  return n.length >= 2 && /\d\s*(?:[-–—a]|to)\s*\d/.test(t) ? (n[0] + n[1]) / 2 : n[0]
}

/** A célula "Quem trabalha": 'prova' | 'produto' | 'pessoa' | 'ninguem'; null se não deu para entender. */
export function quemDe(celula) {
  const t = cru(celula)
  if (/pessoa|person/.test(t)) return 'pessoa'
  if (/prova|proof/.test(t)) return 'prova'
  if (/produto|product/.test(t)) return 'produto'
  if (!t || /^[-–—]+$/.test(t) || /ninguem|nobody/.test(t)) return 'ninguem'
  return null
}

/**
 * Lê a tabela do roteiro: a que tem a coluna "Quem trabalha"; sem ela, a primeira com coluna de tempo ("s").
 * Devolve { cenas: [{ n, quem, s, texto }], temColuna, faltas, tabela } ou null se não há tabela de roteiro.
 */
export function lerRoteiro(md) {
  const todas = tabelas(md)
  const t = todas.find((x) => x.cabecalho.some(ehTrabalha)) || todas.find((x) => x.cabecalho.some(ehTempo))
  if (!t) return null
  const iT = t.cabecalho.findIndex(ehTempo), iQ = t.cabecalho.findIndex(ehTrabalha), iN = t.cabecalho.findIndex((c) => cru(c) === '#')
  const cenas = [], faltas = []
  t.linhas.forEach((c, k) => {
    const n = (iN >= 0 && c[iN]) || String(k + 1)
    const s = iT >= 0 ? tempoDe(c[iT] ?? '') : null
    const quem = iQ >= 0 ? quemDe(c[iQ] ?? '') : null
    if (s == null) faltas.push(`scene ${n}: no time in the "s" column`)
    if (iQ >= 0 && quem == null) faltas.push(`scene ${n}: could not tell who does the work ("${c[iQ]}"). Use prova, produto, pessoa or —`)
    cenas.push({ n, quem, s: s ?? 0, texto: c.join(' ') })
  })
  if (iT < 0) faltas.unshift('the table has no time column ("s")')
  return { cenas, temColuna: iQ >= 0, faltas, tabela: t }
}

/** A conta: segundos por quem trabalha, o tempo de produto e as frações dele. */
export function contar(cenas) {
  const soma = { prova: 0, produto: 0, pessoa: 0, ninguem: 0 }
  for (const c of cenas) if (c.quem) soma[c.quem] += c.s
  const tela = soma.prova + soma.produto + soma.pessoa
  const total = cenas.reduce((a, c) => a + c.s, 0)
  const fr = (v) => (tela > 0 ? v / tela : 0)
  return { total, tela, ...soma, sozinho: soma.prova + soma.produto, fracao: { prova: fr(soma.prova), sozinho: fr(soma.prova + soma.produto), pessoa: fr(soma.pessoa) } }
}

const PASSO_N_DE_M = /\bpasso\s+(\d+|\{n\})\s+de\s+(\d+|\{n\})|\bstep\s+(\d+|\{n\})\s+of\s+(\d+|\{n\})/i

/** O veredito. Em `sell`, a regra vale; em `teach` e `update`, a conta sai sem veredito. Devolve { passa, motivos, veredito }. */
export function julgar(roteiro, intencao, limites = LIMITES) {
  const motivos = []
  if (intencao !== 'sell') return { passa: true, motivos, veredito: 'no verdict' }
  if (!roteiro.temColuna) motivos.push('the script does not say who does the work in each scene: add the "Who does the work" column (proof, product, person or —)')
  motivos.push(...roteiro.faltas)
  const c = contar(roteiro.cenas)
  if (roteiro.temColuna) {
    if (c.tela <= 0) motivos.push('there is no product time: a sales video needs the proof scene on screen')
    else {
      if (c.prova <= 0) motivos.push('no scene is the proof scene: mark as "prova" the scene in which the product does the work of the sentence on its own')
      else if (c.fracao.prova < limites.provaMin) motivos.push(`the proof scene is ${pct(c.fracao.prova)} of product time (${fmt(c.prova)} of ${fmt(c.tela)} s); the minimum is ${pct(limites.provaMin)}`)
      if (c.fracao.pessoa > limites.pessoaMax) motivos.push(`a person works during ${pct(c.fracao.pessoa)} of product time (${fmt(c.pessoa)} of ${fmt(c.tela)} s); the maximum is ${pct(limites.pessoaMax)}`)
    }
  }
  const texto = roteiro.cenas.map((x) => x.texto).join('\n')
  if (PASSO_N_DE_M.test(texto)) motivos.push('the sales script has "Step N of M": that is tutorial format')
  return { passa: !motivos.length, motivos, veredito: motivos.length ? 'goes back' : 'passes' }
}

/** O texto da conta, para o roteiro e para a tela. */
export function textoConta(roteiro, intencao, julgamento, limites = LIMITES) {
  const c = contar(roteiro.cenas)
  const L = []
  if (!roteiro.temColuna) L.push(`**The count (${intencao}):** cannot be done: the script does not say who does the work in each scene.`)
  else if (c.tela <= 0) L.push(`**The count (${intencao}):** product time 0 s of ${fmt(c.total)} s.`)
  else {
    const regra = intencao === 'sell'
    L.push(`**The count (${intencao}):** product time ${fmt(c.tela)} s of ${fmt(c.total)} s · proof scene ${fmt(c.prova)} s (${pct(c.fracao.prova)}${regra ? `; minimum ${pct(limites.provaMin)}` : ''}) · product in another scene ${fmt(c.produto)} s · person working ${fmt(c.pessoa)} s (${pct(c.fracao.pessoa)}${regra ? `; maximum ${pct(limites.pessoaMax)}` : ''})`)
  }
  if (intencao === 'sell') L.push(julgamento.passa ? '**Passes.**' : `**Goes back:** ${julgamento.motivos.join('; ')}.`)
  else L.push(`No verdict: in "${intencao}" the screen-time rule does not send the script back.`)
  return L.join('\n')
}

/** Põe (ou troca) a conta no roteiro, entre os marcadores, logo depois da tabela. Devolve o texto novo. */
export function gravarConta(md, roteiro, bloco) {
  const novo = `${MARCA_INI}\n${bloco}\n${MARCA_FIM}`
  const a = md.indexOf(MARCA_INI), b = md.indexOf(MARCA_FIM)
  if (a >= 0 && b > a) return md.slice(0, a) + novo + md.slice(b + MARCA_FIM.length)
  const L = md.replace(/\r/g, '').split('\n')
  L.splice(roteiro.tabela.fim + 1, 0, '', novo)
  return L.join('\n')
}
