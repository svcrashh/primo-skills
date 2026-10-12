#!/usr/bin/env node
// A escrita do vídeo sem tique de IA: as regras do texto da tela (todo nível) e as da fala (os níveis com narração).
//   node writing.mjs review <file.json | .md | .txt | .js> [--json]   o texto da tela de um arquivo
//   node writing.mjs review --text "…" [--json]                        uma frase
//   … [--lang pt]   as regras de expressão do português (o padrão é 'en': só pontuação e tamanho)
//   … [--accept "Seu som. Sua cena. Seu link."]   a frase que fica de propósito (repita a opção para mais de uma)
// O slogan da marca, copiado do site, é assinatura e não tique: num JSON com "marca": { "slogan": "…" } (ou uma lista),
// o texto igual a ele passa sem revisão, com ou sem o *destaque*.
// Erro = o que tem troca óbvia, e reprova (código 1). Aviso = heurística que pode errar: olhe e decida (código 0).
// Na tela valem só as regras de texto: travessão, "não é X, é Y", revelação com dois-pontos, slogan, enchimento e
// chamada vazia ("vamos lá"). As de fala (três curtas em fila, 8 a 18 palavras, lista falada, 150 palavras por minuto)
// só valem com { fala: true }. As de expressão são do português; em outro idioma, só as de pontuação e tamanho.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

export const PPM = 150
export const MIN_PALAVRAS = 8
export const MAX_PALAVRAS = 18
const CURTA = 5

export const REGRAS = {
  travessao: 'dash between sentences',
  'nao-e-x-e-y': '"não é X, é Y" (it is not X, it is Y)',
  'nao-x-mas-y': '"não X, mas Y" (not X, but Y)',
  revelacao: 'reveal with a colon',
  slogan: 'slogan instead of the fact',
  enchimento: 'filler word',
  chamada: 'empty call-out',
  'tres-curtas': 'three short sentences in a row',
  tamanho: 'sentence outside 8 to 18 words',
  'lista-falada': 'spoken list',
  tempo: 'does not fit the time',
}
const NIVEL = { erro: 'error', aviso: 'warning' }

const L = '\\p{L}\\p{N}'
const palavra = (s) => new RegExp(`(?<![${L}])(?:${s})(?![${L}])`, 'iu')
const dobrar = (s) => String(s ?? '').normalize('NFD').replace(/\p{M}/gu, '').toLowerCase()
export const palavrasDe = (t) => String(t ?? '').split(/\s+/).filter((w) => /[\p{L}\p{N}]/u.test(w))

/** As frases de um texto: corta depois de . ! ? … quando vem espaço e uma maiúscula ou número ("tema… do" não corta). */
export function frasesDe(texto) {
  return String(texto ?? '').replace(/\s+/g, ' ').trim().split(/(?<=[.!?…]["”')]?)\s+(?=["“'(¿¡]?[\p{Lu}\p{N}])/u).filter(Boolean)
}

// Os pedaços de uma frase entre vírgula, ponto e vírgula ou travessão (vírgula de número, "1,50", não corta).
const pedacos = (f) => f.replace(/[.!?…"”]+$/u, '').split(/[,;]\s+|\s+[–—-]\s+/u).map((p) => p.trim()).filter(Boolean)

// ── as regras de texto (tela e fala) ─────────────────────────────────────────────────────────────
function travessao(f) {
  return /\p{L}[,.;!?…"”)]?\s*—\s*["“(]?[\p{L}\p{N}]|\p{N}\s*—\s*["“(]?\p{L}/u.test(f) || /\p{L}[,.;!?…"”)]?\s+[–-]\s+["“(]?\p{L}/u.test(f)
}

const NAO_E = /(?<![\p{L}])n[ãa]o\s+(é|são|era|eram|foi|foram|está|estão|tá|fica|ficou)\s+(?:só\s+|apenas\s+|somente\s+|sobre\s+)?[^.;:!?]{1,80}?[,.;]\s+(?:mas\s+)?\1(?![\p{L}])/iu
const NAO_SO = /(?<![\p{L}])n[ãa]o\s+(?:é\s+|são\s+)?(?:só|apenas|somente)\s+[^.;:!?]{1,80}?,?\s+(?:mas(?:\s+também)?|como\s+também)(?![\p{L}])/iu
const E_SIM = /(?<![\p{L}])n[ãa]o\s+[^.;:!?]{1,80}?,?\s+e\s+sim(?![\p{L}])/iu
const NAO_MAS = /(?<![\p{L}])n[ãa]o\s+[^.;:!?]{1,80}?,\s*mas(?![\p{L}])/iu

// Dois-pontos seguido de espaço (12:30 e https:// não contam). Na fala é sempre revelação; na tela, "Antes: 3 cliques"
// é rótulo, e só reprova quando antes dos dois-pontos há duas palavras ou mais.
function revelacao(f, fala) {
  for (const m of f.matchAll(/:\s+\S/gu)) {
    if (fala) return true
    const antes = f.slice(0, m.index).split(/[.!?…]\s+|\s*[·•|]\s*/u).at(-1)
    if (palavrasDe(antes).length >= 2) return true
  }
  return false
}

// O slogan: dois ou três pedaços curtos (2 a 4 palavras: "8h – 10h" é faixa de horário) e paralelos que começam pela mesma classe de palavra ("Três pedidos, três no
// ar.", "Menos cliques. Mais vendas.", "Seu link, sua cara."), sem verbo que diga o que aconteceu.
const CLASSES = [
  ['N', 'um uma dois duas tres quatro cinco seis sete oito nove dez cem mil zero'],
  ['mais', 'mais'], ['menos', 'menos'], ['sem', 'sem'], ['com', 'com'], ['nada', 'nada'], ['tudo', 'tudo'], ['cada', 'cada'],
  ['so', 'so'], ['sempre', 'sempre'], ['nunca', 'nunca'], ['todo', 'todo toda todos todas'], ['nenhum', 'nenhum nenhuma'],
  ['novo', 'novo nova novos novas'], ['seu', 'seu sua seus suas'], ['teu', 'teu tua teus tuas'], ['nosso', 'nosso nossa nossos nossas'],
  ['outro', 'outro outra outros outras'], ['mesmo', 'mesmo mesma mesmos mesmas'], ['antes', 'antes'], ['agora', 'agora'],
  ['depois', 'depois'], ['ontem', 'ontem'], ['hoje', 'hoje'],
]
const CLASSE = new Map(CLASSES.flatMap(([c, ws]) => ws.split(' ').map((w) => [w, c])))
const PARES = [['menos', 'mais'], ['sem', 'com'], ['antes', 'agora'], ['antes', 'depois'], ['ontem', 'hoje']]
const classeDe = (p) => { const w = dobrar(palavrasDe(p)[0]).replace(/[^\p{L}\p{N}]/gu, ''); return /^\d/.test(w) ? 'N' : CLASSE.get(w) ?? null }
function paralelos(ps) {
  if (ps.length < 2 || ps.length > 3 || ps.some((p) => { const n = palavrasDe(p).length; return n < 2 || n > 4 })) return false
  const cs = ps.map(classeDe)
  if (cs.some((c) => !c)) return false
  if (cs.every((c) => c === cs[0])) return true
  return ps.length === 2 && PARES.some(([a, b]) => (cs[0] === a && cs[1] === b) || (cs[0] === b && cs[1] === a))
}
const BORDAO = /^(?:simples|fácil|facil|rápido|rapido) assim[.!]*$/iu

const ENCHIMENTO = ['simplesmente', 'basicamente', 'na verdade', 'literalmente', 'realmente']
const CHAMADA = palavra('vamo?s? l[áa]|bora|fi(?:ca|que|car) ligad[oa]s?')

// ── as regras só da fala ─────────────────────────────────────────────────────────────────────────
// Lista de 3 itens ou mais: "A, B e C" (o pedaço com o "e"/"ou" começa com um item de até 3 palavras, e os pedaços antes
// dele têm até 4: "Ele aceita Instagram, TikTok e YouTube no mesmo campo"), ou três pedaços ou mais de até 2 palavras sem
// conjunção ("Rápido, simples, seguro").
function listaFalada(f) {
  const ps = f.replace(/[.!?…"”]+$/u, '').split(/,\s+/u).map((p) => p.trim()).filter(Boolean)
  const n = (p) => palavrasDe(p).length
  let melhor = 0
  for (let j = 1; j < ps.length; j++) {
    const conj = /^(.+?)\s+(?:e|ou|and|or)\s+\S/iu.exec(ps[j])
    if (!conj || n(conj[1]) > 3) continue
    let i = j
    while (i > 0 && n(ps[i - 1]) <= 4) i--
    if (j - i >= 1) melhor = Math.max(melhor, j - i + 2)
  }
  for (let i = 0; i < ps.length; ) {
    let j = i
    while (j < ps.length && n(ps[j]) <= 2) j++
    if (j - i >= 3) melhor = Math.max(melhor, j - i)
    i = Math.max(j, i + 1)
  }
  return melhor >= 3 ? melhor : 0
}

/** Segundos de fala de um texto pela conta de 150 palavras por minuto, pausas incluídas. */
export const segundosDe = (palavras, ppm = PPM) => Math.round((palavras / ppm) * 600) / 10

// ── revisar ──────────────────────────────────────────────────────────────────────────────────────
/**
 * revisarTexto(texto | [textos], { fala, tutorial, segundos, idioma }) → [{ nivel: 'erro'|'aviso', regra, frase, oque_trocar }]
 * - fala: true soma as regras da fala; sem ela, só as do texto da tela.
 * - tutorial: uma ação por passo, a frase curta é o certo; só o teto de 18 palavras vale.
 * - segundos: o tempo de fala planejado; o texto todo passa dele em mais de 10% → aviso com quantas palavras cortar.
 * - idioma ('en' por padrão): as regras de expressão ("não é X, é Y", enchimento, chamada, slogan) só valem com 'pt'.
 * Uma lista de textos é revisada um por um (cada fala, cada texto da tela), e o tempo soma todos.
 */
export function revisarTexto(entrada, { fala = false, tutorial = false, segundos = null, idioma = 'en' } = {}) {
  const textos = (Array.isArray(entrada) ? entrada : [entrada]).map((t) => {
    const s = String(t ?? '')
    return (fala ? s.replace(/\[[^\]\s][^\]]*\]/gu, ' ') : s).replace(/\s+/g, ' ').trim()
  }).filter(Boolean)
  const pt = /^pt/i.test(idioma || '')
  const achados = [], vistos = new Set()
  const achar = (nivel, regra, frase, oque_trocar) => {
    const k = `${regra}\u0000${frase}`
    if (vistos.has(k)) return
    vistos.add(k)
    achados.push({ nivel, regra, frase, oque_trocar })
  }
  for (const texto of textos) {
    const frases = frasesDe(texto)
    const daFrase = (i0, i1 = i0) => frases.slice(i0, i1 + 1).join(' ')
    // o texto já vem com um espaço só entre as palavras: as frases somam o texto, com um espaço entre elas
    const ondeEsta = (idx) => { let fim = -1; for (let i = 0; i < frases.length; i++) { fim += frases[i].length + 1; if (idx < fim) return i } return frases.length - 1 }

    for (const f of frases) {
      if (travessao(f)) achar('erro', 'travessao', f, 'Change the dash to a comma or a period: one sentence with a comma, or two sentences.')
      if (revelacao(f, fala)) achar('erro', 'revelacao', f, 'No suspense with a colon: state the fact in a single sentence, with the verb (who did what), without announcing it first.')
      if (!pt) continue
      for (const w of ENCHIMENTO) if (palavra(w.replace(' ', '\\s+')).test(f)) achar('erro', 'enchimento', f, `Remove "${w}": the sentence says the same without it.`)
      const ch = CHAMADA.exec(f)
      if (ch) achar('erro', 'chamada', f, `Remove "${ch[0]}": say the next thing directly, without calling out to the viewer.`)
      if (BORDAO.test(f.trim()) || paralelos(pedacos(f))) achar('erro', 'slogan', f, 'Change the slogan to a sentence that says what happened, with who did it and the verb (e.g. "os três ajustes já estão no ar", the three fixes are already live).')
    }
    if (pt) {
      // slogan em frases separadas: "Três pedidos. Três no ar."
      for (let i = 0; i + 1 < frases.length; i++) {
        for (const n of [3, 2]) {
          const grupo = frases.slice(i, i + n)
          if (grupo.length === n && grupo.every((f) => pedacos(f).length === 1) && paralelos(grupo.map((f) => pedacos(f)[0]))) {
            achar('erro', 'slogan', daFrase(i, i + n - 1), 'Change the slogan to a sentence that says what happened, with who did it and the verb (e.g. "os três ajustes já estão no ar", the three fixes are already live).')
            break
          }
        }
      }
      const naoE = NAO_E.exec(texto) || NAO_SO.exec(texto) || E_SIM.exec(texto)
      if (naoE) {
        const i = ondeEsta(naoE.index), j = ondeEsta(naoE.index + naoE[0].length - 1)
        achar('erro', 'nao-e-x-e-y', daFrase(i, j), 'Say only what it is: drop the "não é X" (it is not X) and keep the Y, in a sentence with a verb.')
      } else {
        const mas = NAO_MAS.exec(texto)
        if (mas) achar('aviso', 'nao-x-mas-y', daFrase(ondeEsta(mas.index)), 'If the "mas" (but) only flips it around (not X, but Y), say the Y directly. If it is a real caveat, leave it.')
      }
    }
    if (!fala) continue

    for (let i = 0; i < frases.length; ) {
      let j = i
      while (j < frases.length && palavrasDe(frases[j]).length <= CURTA) j++
      if (j - i >= 3) achar('aviso', 'tres-curtas', daFrase(i, j - 1), 'Short sentences in a row sound like a slogan: join two into a single sentence, with a verb, one idea of 8 to 18 words.')
      i = Math.max(j, i + 1)
    }
    for (const f of frases) {
      const n = palavrasDe(f).length
      if (n > MAX_PALAVRAS) achar('aviso', 'tamanho', f, `${n} words: split it into two sentences, one idea each (8 to 18 words).`)
      else if (n < MIN_PALAVRAS && !tutorial) achar('aviso', 'tamanho', f, `${n} words: join it with the next one or state the whole fact (8 to 18 words, one idea each).`)
      const itens = listaFalada(f)
      if (itens) achar('aviso', 'lista-falada', f, `Spoken list of ${itens} items: check that each item appears on screen when it is said. If it does not, say only the main one.`)
    }
  }
  if (fala && segundos > 0) {
    const n = textos.reduce((s, t) => s + palavrasDe(t).length, 0), est = segundosDe(n)
    if (est > segundos * 1.1) {
      const cortar = n - Math.floor((segundos * PPM) / 60)
      achar('aviso', 'tempo', `${n} words ≈ ${est} s (150 per minute, with the pauses) for ${segundos} s planned`, `Cut about ${cortar} words, or plan ${Math.ceil(est)} s of speech.`)
    }
  }
  return achados
}

// ── o texto da tela de um arquivo ────────────────────────────────────────────────────────────────
// JSON: toda string com um espaço, com o caminho dela, menos as notas (chave que começa com _) e o que é código (CSS,
// HTML, JS). .md/.txt: cada linha (e cada célula de tabela), sem blocos de
// código. .js/.mjs/.cjs: as strings entre aspas com um espaço, fora de comentário.
export function textosDoArquivo(arq) {
  const s = fs.readFileSync(arq, 'utf8'), ext = path.extname(arq).toLowerCase(), out = []
  const prosa = (t) => /\s/.test(t.trim()) && /\p{L}/u.test(t) && !/[{}<>]|=>|;\s*$/.test(t)
  if (ext === '.json') {
    const andar = (v, onde) => {
      if (typeof v === 'string') { if (prosa(v)) out.push({ onde, texto: v }) }
      else if (Array.isArray(v)) v.forEach((x, i) => andar(x, `${onde}[${i}]`))
      else if (v && typeof v === 'object') for (const [k, x] of Object.entries(v)) if (!k.startsWith('_')) andar(x, onde ? `${onde}.${k}` : k)
    }
    andar(JSON.parse(s), '')
  } else if (['.js', '.mjs', '.cjs'].includes(ext)) {
    s.split('\n').forEach((l, i) => {
      if (/^\s*(\/\/|\*|\/\*)/.test(l)) return
      for (const m of l.matchAll(/(['"`])((?:\\.|(?!\1)[^\\])*)\1/g)) if (!m[2].includes('${') && prosa(m[2])) out.push({ onde: `line ${i + 1}`, texto: m[2] })
    })
  } else {
    let codigo = false
    s.split('\n').forEach((l, i) => {
      if (/^\s*```/.test(l)) { codigo = !codigo; return }
      if (codigo || /^\s*\|?\s*:?-{3,}/.test(l)) return
      const celulas = l.includes('|') ? l.split('|') : [l]
      for (const c of celulas) {
        const t = c.replace(/^\s*(?:#+|[-*>]|\d+[.)])\s+/, '').trim()
        if (prosa(t)) out.push({ onde: `line ${i + 1}`, texto: t })
      }
    })
  }
  return out
}

// A comparação com o que é aceito: sem *destaque*, sem acento, sem pontuação, sem caixa.
const comparavel = (t) => dobrar(String(t).replace(/\*/g, '')).replace(/[^\p{L}\p{N}]+/gu, ' ').trim()

/** O slogan declarado da marca num JSON ("marca": { "slogan": "…" | ["…"] }): o que fica de propósito. */
export function aceitosDoArquivo(arq) {
  if (path.extname(arq).toLowerCase() !== '.json') return []
  try { return [JSON.parse(fs.readFileSync(arq, 'utf8'))?.marca?.slogan].flat().filter((x) => typeof x === 'string' && x.trim()) } catch { return [] }
}

function cmdRevisar(argv) {
  const json = argv.includes('--json')
  const i = argv.indexOf('--text')
  const comValor = ['--text', '--accept', '--lang']
  const k = argv.indexOf('--lang')
  if (k >= 0 && (argv[k + 1] == null || argv[k + 1].startsWith('--'))) throw new Error('--lang needs a language code, e.g. --lang pt')
  const idioma = k >= 0 ? argv[k + 1] : undefined
  const arq = argv.find((x, k) => !x.startsWith('--') && !comValor.includes(argv[k - 1]))
  const aceitos = argv.flatMap((x, k) => (x === '--accept' && argv[k + 1] != null ? [argv[k + 1]] : []))
  let textos
  if (i >= 0) {
    if (argv[i + 1] == null) throw new Error('--text needs the sentence')
    textos = [{ onde: 'text', texto: argv[i + 1] }]
  } else if (arq) {
    if (!fs.existsSync(arq)) throw new Error(`File not found: ${arq}.`)
    textos = textosDoArquivo(arq)
    aceitos.push(...aceitosDoArquivo(arq))
  } else throw new Error('usage: node writing.mjs review <file.json | .md | .txt | .js> [--json] [--lang pt]  or  review --text "…"')
  const aceitar = new Set(aceitos.map(comparavel))
  const deixados = textos.filter((t) => aceitar.has(comparavel(t.texto)))
  textos = textos.filter((t) => !aceitar.has(comparavel(t.texto)))
  const achados = textos.flatMap((t) => revisarTexto(t.texto, { idioma }).map((a) => ({ onde: t.onde, ...a })))
  const erros = achados.filter((a) => a.nivel === 'erro').length, avisos = achados.length - erros
  if (json) console.log(JSON.stringify(achados, null, 1))
  else {
    for (const a of achados) console.log(`${a.nivel === 'erro' ? '✗' : '⚠'} ${a.onde} · ${NIVEL[a.nivel]} · ${REGRAS[a.regra]}\n    "${a.frase}"\n    → ${a.oque_trocar}`)
    console.log(`${erros ? '✗' : '✓'} ${textos.length} text(s) · ${erros} error(s) · ${avisos} warning(s)${deixados.length ? ` · ${deixados.length} accepted on purpose (the brand slogan or --accept)` : ''}${erros ? ' · an error fails: change the sentence' : ''}`)
  }
  return erros ? 1 : 0
}

export function principal(argv) {
  const [cmd, ...resto] = argv
  try {
    if (cmd === 'review') return cmdRevisar(resto)
    console.error('usage: node writing.mjs review <file.json | .md | .txt | .js> [--json] [--lang pt] [--accept "sentence"]  or  review --text "…"')
    return 1
  } catch (e) { console.error(e.message); return 1 }
}

if (process.argv[1] && (() => { try { return fs.realpathSync(process.argv[1]) === fs.realpathSync(fileURLToPath(import.meta.url)) } catch { return false } })()) process.exitCode = principal(process.argv.slice(2))
