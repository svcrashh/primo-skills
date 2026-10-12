#!/usr/bin/env node
// Recomenda o estilo do vídeo pela tabela objetivo × canal × tipo de produto (references/catalog/choosing.md).
//   node recommend-style.mjs --goal update --channel reels --product young [--items 8] [--name "Produto"] [--text-box]
//                              [--explain] [--concept] [--approved <style>] [--last <style>] [--json]
//   node recommend-style.mjs record --name "Produto" --style <style> [--video <folder>] [--approved]
// --approved <style>: o dono aprovou um vídeo anterior deste produto nesse estilo (ou mostrou um como referência:
//   "quero algo nesse nível"). Ele é a régua e vem primeiro, mesmo que seja capítulos de novo.
// --explain: o pedido pede explicação ("dá uma explicada", "mostra como funciona") — pede estilos que se constroem em
//   etapas com a voz (capítulos, tela real), não a lista de painéis parados (que não explica: parece tudo a mesma coisa).
//   A explicação desenhada entra como alternativa, sem tirar o primeiro lugar.
// --concept: o vídeo explica uma ideia, um fluxo ou como algo funciona por dentro (não onde clicar) — pede a
//   explicação desenhada; com --explain junto, a explicação é de conceito e o empurrão do --explain vai para ela.
//   node recommend-style.mjs styles
// O histórico (último estilo por produto) fica em ~/Documents/VideoStudio/Brands/style-history.json (VIDEOSTUDIO_BRANDS
// troca a pasta): é o que impede
// "capítulos com índice" de ser recomendado duas vezes seguidas para o mesmo produto.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { raizMarcas } from './kit.mjs'
import { ESTILOS as TODOS } from './styles.mjs'

const skill = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const historicoArq = path.join(raizMarcas(), 'style-history.json')

// Os estilos que a tabela recomenda: os da lista da skill (styles.mjs) que têm ficha em references/catalog/styles/.
export const ESTILOS = Object.fromEntries(Object.entries(TODOS).filter(([, e]) => e.ficha !== false))

export const DO_CATALOGO = ['kinetic-typography', 'card-bento', 'card-stack', 'chat-bubbles', 'ticking-checklist', 'growing-chart', 'timeline', 'phone-3d', 'infinite-zoom', 'drawn-flow', 'isometric', 'photo-mosaic']

export const OBJETIVOS = { teach: 'teaching how to do it', update: 'announcing news', launch: 'launching / selling', attention: 'grabbing attention', results: 'reporting results' }
export const CANAIS = { site: 'the site, help center or YouTube', whatsapp: 'WhatsApp', reels: 'Reels, TikTok or Shorts (9:16)', feed: 'the feed or LinkedIn (1:1, 4:5)', 'big-screen': 'the big screen at an event (16:9, no sound)' }
export const PRODUTOS = {
  b2b: { nome: 'serious B2B (SaaS, ERP, dashboard)', puxe: ['real-screen-camera', 'before-after', 'counting-number', 'drawn-explainer'], evite: [], tom: 'one highlight color, 2 s per item (no bursts), the why before the number' },
  young: { nome: 'young consumer', puxe: ['typing-text', 'rolling-list'], evite: ['chapters-with-index'], tom: 'saturated color, 0.8–1.2 s per item, a joke every 3–4 items' },
  layperson: { nome: 'school, public service, layperson', puxe: ['real-screen-camera', 'drawn-explainer'], evite: ['light-trail-teaser'], tom: 'full sentence at each step, slow pace, "Done! That\'s all." at the end' },
  finance: { nome: 'bank / finance', puxe: ['real-screen-camera', 'counting-number', 'drawn-explainer'], evite: ['light-trail-teaser'], tom: 'restrained; numbers always with context; nothing that looks like a promise of gains' },
  creator: { nome: 'creator, DJ, personal brand', puxe: ['chapters-with-index', 'rolling-list', 'counting-number'], evite: [], tom: 'the person\'s own photos and numbers, never made up' },
  game: { nome: 'game / community', puxe: ['before-after', 'light-trail-teaser', 'rolling-list'], evite: [], tom: 'fast speech is fine, the season\'s color, the season number fixed in the opening' },
  retail: { nome: 'store, retail, delivery', puxe: ['counting-number', 'before-after'], evite: [], tom: 'giant price and deadline, repeated refrain' },
  other: { nome: 'other', puxe: [], evite: [], tom: '' },
}

// Estilos em ordem de preferência para cada objetivo × canal (o primeiro é o mais indicado).
export const TABELA = {
  teach: {
    site: ['real-screen-camera', 'drawn-explainer', 'before-after', 'typing-text', 'card-stack', 'infinite-zoom'],
    whatsapp: ['real-screen-camera', 'before-after', 'rolling-list', 'card-stack'],
    reels: ['real-screen-camera', 'rolling-list', 'before-after', 'drawn-explainer', 'card-stack', 'phone-3d'],
    feed: ['rolling-list', 'real-screen-camera', 'drawn-explainer', 'before-after', 'card-stack', 'ticking-checklist'],
    'big-screen': ['rolling-list', 'counting-number', 'before-after', 'ticking-checklist'],
  },
  update: {
    site: ['rolling-list', 'chapters-with-index', 'before-after', 'counting-number', 'card-bento', 'timeline'],
    whatsapp: ['counting-number', 'before-after', 'rolling-list', 'card-stack'],
    reels: ['rolling-list', 'before-after', 'counting-number', 'phone-3d', 'kinetic-typography'],
    feed: ['rolling-list', 'before-after', 'counting-number', 'card-bento'],
    'big-screen': ['light-trail-teaser', 'rolling-list', 'counting-number', 'kinetic-typography', 'card-bento'],
  },
  launch: {
    site: ['rolling-list', 'typing-text', 'light-trail-teaser', 'chapters-with-index', 'drawn-explainer', 'chat-bubbles', 'card-bento'],
    whatsapp: ['counting-number', 'typing-text', 'before-after', 'chat-bubbles'],
    reels: ['typing-text', 'counting-number', 'rolling-list', 'phone-3d', 'chat-bubbles'],
    feed: ['rolling-list', 'typing-text', 'counting-number', 'drawn-explainer', 'chat-bubbles', 'card-bento'],
    'big-screen': ['light-trail-teaser', 'rolling-list', 'counting-number', 'kinetic-typography', 'photo-mosaic'],
  },
  attention: {
    site: ['light-trail-teaser', 'before-after', 'typing-text', 'infinite-zoom', 'kinetic-typography'],
    whatsapp: ['before-after', 'counting-number', 'typing-text', 'kinetic-typography'],
    reels: ['before-after', 'typing-text', 'counting-number', 'kinetic-typography', 'phone-3d'],
    feed: ['counting-number', 'before-after', 'light-trail-teaser', 'kinetic-typography', 'photo-mosaic'],
    'big-screen': ['light-trail-teaser', 'counting-number', 'before-after', 'kinetic-typography', 'photo-mosaic'],
  },
  results: {
    site: ['counting-number', 'rolling-list', 'chapters-with-index', 'before-after', 'growing-chart', 'timeline'],
    whatsapp: ['counting-number', 'before-after', 'rolling-list', 'growing-chart'],
    reels: ['counting-number', 'before-after', 'rolling-list', 'growing-chart'],
    feed: ['counting-number', 'rolling-list', 'before-after', 'growing-chart', 'ticking-checklist'],
    'big-screen': ['counting-number', 'rolling-list', 'light-trail-teaser', 'growing-chart', 'kinetic-typography'],
  },
}

export function lerHistorico(arq = historicoArq) {
  try { return JSON.parse(fs.readFileSync(arq, 'utf8')) } catch { return {} }
}

const chave = (nome) => String(nome || '').trim().toLowerCase()

export function ultimoAprovado(nome, hist = lerHistorico()) {
  const lista = (hist[chave(nome)] || []).filter((r) => r.aprovado)
  return lista.length ? lista[lista.length - 1].estilo : null
}

export function ultimoEstilo(nome, hist = lerHistorico()) {
  const lista = hist[chave(nome)] || []
  return lista.length ? lista[lista.length - 1].estilo : null
}

// O exemplo de cada estilo é o exemplo de FORMATO do molde (cinzas e textos de marcador, sem marca): mostra os parâmetros.
// Como o estilo fica na marca da pessoa se vê na imagem parada, feita sob demanda (catalog.mjs open --directions).
function exemplo(id) {
  const arq = path.join(skill, ESTILOS[id].exemplo)
  return fs.existsSync(arq) ? arq : null
}

export function recomendar({ objetivo, canal, produto = 'other', itens = 0, caixaDeTexto = false, ultimo = null, explicar = false, conceito = false, aprovado = null }) {
  if (!TABELA[objetivo]) throw new Error(`unknown objective: ${objetivo}. Use one of: ${Object.keys(OBJETIVOS).join(', ')}`)
  if (!TABELA[objetivo][canal]) throw new Error(`unknown channel: ${canal}. Use one of: ${Object.keys(CANAIS).join(', ')}`)
  const prod = PRODUTOS[produto] || PRODUTOS.other
  const base = TABELA[objetivo][canal]
  const pontos = {}
  const motivos = {}
  for (const id of Object.keys(ESTILOS)) { pontos[id] = 0; motivos[id] = [] }
  // 10 pontos por degrau da célula. A explicação desenhada entrou nas células sem mexer nos pontos dos outros sete (as
  // recomendações deles ficam como eram): ela não conta como degrau e vale meio degrau acima do estilo logo abaixo dela.
  // Os doze estilos novos do catálogo (DO_CATALOGO) entram no fim das células do mesmo jeito: não contam como degrau
  // e valem 4 pontos, então aparecem como alternativa sem tirar o lugar de ninguém.
  const degrau = (x) => x !== 'drawn-explainer' && !DO_CATALOGO.includes(x)
  base.forEach((id, i) => {
    const abaixo = base.slice(i + 1).filter(degrau).length
    pontos[id] += DO_CATALOGO.includes(id) ? 4 : id === 'drawn-explainer' ? abaixo * 10 + 5 : (abaixo + 1) * 10
    if (i === 0) motivos[id].push(`it is the first in the table for ${OBJETIVOS[objetivo]} on ${CANAIS[canal]}`)
  })
  for (const id of prod.puxe) { pontos[id] += 6; motivos[id].push(`it fits the audience: ${prod.nome}`) }
  for (const id of prod.evite) { pontos[id] -= 25; motivos[id].push(`it does not fit the audience: ${prod.nome}`) }
  if (caixaDeTexto && objetivo !== 'teach') { pontos['typing-text'] += 25; motivos['typing-text'].unshift('the product has a text box, and the question written at frame 0 is almost always the best opening') }
  if (objetivo === 'teach' && canal !== 'big-screen') { pontos['light-trail-teaser'] -= 30 }
  if (['update', 'launch', 'results'].includes(objetivo) && canal === 'site' && itens >= 6) { pontos['chapters-with-index'] += 20; motivos['chapters-with-index'].unshift(`there are ${itens} new features to watch calmly on the site: chapters with index organize 6 to 12`) }
  if (itens >= 6 && canal !== 'site') { pontos['rolling-list'] += 8; motivos['rolling-list'].push(`${itens} items fit in a rolling list`) }
  if (explicar && conceito) {
    pontos['drawn-explainer'] += 35; motivos['drawn-explainer'].unshift('the request asks for an explanation, and it is of an idea, not of where to click: each piece draws itself in stages, on the word of the line')
  } else if (explicar) {
    const alvo = objetivo === 'teach' ? 'real-screen-camera' : 'chapters-with-index'
    pontos[alvo] += 35; motivos[alvo].unshift('the request asks for an explanation: each new feature builds up in stages, on the word where the voice mentions it')
    pontos['drawn-explainer'] += 15; motivos['drawn-explainer'].push('the request asks for an explanation: if it is of an idea, not of where to click, the drawing on the word of the line explains it')
  }
  if (explicar) { pontos['rolling-list'] -= 20; motivos['rolling-list'].push('a list of panels does not explain: when the request is an explanation, it all looks the same') }
  if (conceito) { pontos['drawn-explainer'] += 40; motivos['drawn-explainer'].unshift('the video explains an idea or how something works inside: the drawing is born on the word of the line') }
  if (aprovado && ESTILOS[aprovado]) { pontos[aprovado] += 100; motivos[aprovado].unshift('the owner approved a video of this product in this style: it is the benchmark') }

  const ordem = Object.keys(ESTILOS).filter((id) => pontos[id] > 0).sort((a, b) => pontos[b] - pontos[a] || base.indexOf(a) - base.indexOf(b))
  const avisos = []
  if (objetivo === 'teach' && canal === 'big-screen') avisos.push('a tutorial does not work on a big screen without sound: the suggestion becomes one poster card per step, with no camera or speech')
  // sem --concept a tabela não sabe se a explicação é de uma ideia ou de onde clicar: a explicação desenhada fica como
  // alternativa, e só é a recomendada com --concept ou quando o dono já a aprovou
  const candidatos = ordem.filter((id) => id !== 'drawn-explainer' || conceito || aprovado === id)
  let recomendado = candidatos[0]
  if (recomendado === 'chapters-with-index' && ultimo === 'chapters-with-index' && aprovado !== 'chapters-with-index') {
    recomendado = candidatos[1]
    avisos.push('the last video of this product was already "chapters with index": I don\'t repeat it twice in a row')
  }
  const alternativas = ordem.filter((id) => id !== recomendado).slice(0, 3)
  const porque = motivos[recomendado].length ? motivos[recomendado].join('; ') : `it is the best fit for ${OBJETIVOS[objetivo]} on ${CANAIS[canal]}`
  const ficha = (id) => ({
    id, nome: ESTILOS[id].nome, frase: ESTILOS[id].frase,
    ficha: path.join(skill, 'references', 'catalog', 'styles', `${id}.md`),
    molde: path.join(skill, ESTILOS[id].molde),
    exemplo: exemplo(id),
    ...(id === ultimo ? { foiOUltimo: true } : {}),
  })
  return { recomendado: ficha(recomendado), porque, alternativas: alternativas.map(ficha), tom: prod.tom, avisos }
}

function opt(args, k, d) { const i = args.indexOf('--' + k); return i >= 0 && args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : d }

function principal(args) {
  if (args[0] === 'styles') {
    for (const [id, e] of Object.entries(ESTILOS)) console.log(`${id.padEnd(22)} ${e.frase}`)
    return 0
  }
  if (args[0] === 'record') {
    const nome = opt(args, 'name'), estilo = opt(args, 'style')
    if (!nome || !ESTILOS[estilo]) { console.error(`usage: record --name "Product" --style <${Object.keys(ESTILOS).join('|')}> [--video <folder>]`); return 1 }
    const hist = lerHistorico()
    ;(hist[chave(nome)] ||= []).push({ estilo, data: new Date().toISOString().slice(0, 10), video: opt(args, 'video') || null, aprovado: args.includes('--approved') })
    fs.mkdirSync(path.dirname(historicoArq), { recursive: true })
    fs.writeFileSync(historicoArq, JSON.stringify(hist, null, 2) + '\n')
    console.log(`recorded: ${nome} → ${estilo}${args.includes('--approved') ? ' (approved by the owner: it becomes the benchmark for the next one)' : ''}`)
    return 0
  }
  const objetivo = opt(args, 'goal'), canal = opt(args, 'channel')
  if (!objetivo || !canal) {
    console.error('usage: node recommend-style.mjs --goal <o> --channel <c> [--product <p>] [--items N] [--name "Product"] [--text-box] [--explain] [--concept] [--approved <style>] [--last <style>] [--json]')
    console.error(`  objectives: ${Object.keys(OBJETIVOS).join(', ')}\n  channels:   ${Object.keys(CANAIS).join(', ')}\n  products:   ${Object.keys(PRODUTOS).join(', ')}`)
    return 1
  }
  const produto = opt(args, 'product', 'other')
  if (!PRODUTOS[produto]) { console.error(`unknown product: ${produto}. Use one of: ${Object.keys(PRODUTOS).join(', ')}`); return 1 }
  const nome = opt(args, 'name')
  const ultimo = opt(args, 'last') || (nome ? ultimoEstilo(nome) : null)
  let r
  const aprovado = opt(args, 'approved') || (nome ? ultimoAprovado(nome) : null)
  if (aprovado && !ESTILOS[aprovado]) { console.error(`--approved ${aprovado}: unknown style (${Object.keys(ESTILOS).join(', ')})`); return 1 }
  try { r = recomendar({ objetivo, canal, produto, itens: Number(opt(args, 'items', 0)) || 0, caixaDeTexto: args.includes('--text-box'), ultimo, explicar: args.includes('--explain'), conceito: args.includes('--concept'), aprovado }) } catch (e) { console.error(e.message); return 1 }
  if (args.includes('--json')) { console.log(JSON.stringify({ ...r, ultimo }, null, 2)); return 0 }
  const linha = (e, i) => `  ${i}. ${e.nome} (${e.id}) — ${e.frase}${e.foiOUltimo ? ' [was the last one for this product]' : ''}\n     format example (no brand): ${e.exemplo || 'none'}`
  console.log(`Recommended: ${r.recomendado.nome} (${r.recomendado.id}) — ${r.porque}.`)
  console.log(linha(r.recomendado, 1))
  r.alternativas.forEach((e, i) => console.log(linha(e, i + 2)))
  if (r.tom) console.log(`Tone (${PRODUTOS[produto].nome}): ${r.tom}.`)
  for (const a of r.avisos) console.log(`Warning: ${a}.`)
  if (ultimo) console.log(`Last style for this product: ${ultimo}.`)
  if (aprovado) console.log(`Style the owner approved before: ${aprovado} (the benchmark).`)
  return 0
}

// caminho real dos dois lados: a skill pode ser chamada por um symlink (outra pasta de skills apontando para ~/.claude/skills), e aí o
// argv[1] não bate com o import.meta.url e o script sai calado, sem erro nenhum
if (process.argv[1] && (() => { try { return fs.realpathSync(process.argv[1]) === fs.realpathSync(fileURLToPath(import.meta.url)) } catch { return false } })()) process.exit(principal(process.argv.slice(2)))
