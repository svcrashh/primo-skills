#!/usr/bin/env node
// A variedade entre os vídeos da mesma marca: o histórico das direções e a trava que reprova a direção que repete os
// últimos. A matriz (os dez eixos e os valores) e a regra estão em references/catalog/variety.md; o histórico mora em
// ~/Documents/VideoStudio/Brands/<brand>/videos.json (VIDEOSTUDIO_BRANDS troca a raiz, como no kit.mjs).
//
//   node variety.mjs check --brand <slug> --direction <direction.json> [--allow-repeat]
//        código 0 = varia o bastante; 1 = repete (diz em quê e quais eixos trocar)
//        --allow-repeat aceita repetir (exceção a pedido do dono), com aviso
//   node variety.mjs record --brand <slug> --direction <direction.json> --video <mp4> --title "…" [--date AAAA-MM-DD]
//        acrescenta ao histórico; o mesmo --video de novo atualiza a entrada dele (nunca apaga nada)
//   node variety.mjs list --brand <slug>        os vídeos da marca, o mais novo primeiro, com os eixos
//
// Erro de uso, direção inválida ou histórico ilegível: código 2, dizendo o que fazer.
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { raizMarcas, slug } from './kit.mjs'

const AQUI = path.dirname(fileURLToPath(import.meta.url))
const MATRIZ = path.join(AQUI, '..', 'references', 'catalog', 'variety.md')

// a tabela de references/catalog/variety.md (o teste confere que as duas batem); trilha é texto livre
export const EIXOS = {
  style: ['panel-tutorial', 'real-screen-camera', 'drawn-explainer', 'chapters-with-index', 'rolling-list', 'counting-number', 'before-after', 'light-trail-teaser', 'typing-text', 'typing-terminal',
    'kinetic-typography', 'card-bento', 'card-stack', 'chat-bubbles', 'ticking-checklist', 'growing-chart', 'timeline', 'phone-3d', 'infinite-zoom', 'drawn-flow', 'isometric', 'photo-mosaic'],
  structure: ['step-by-step', 'chapters', 'problem-solution', 'before-after', 'questions-answers', 'a-day-with', 'top-n', 'single-scene', 'dos-and-donts'],
  layout: ['left-column', 'right-column', 'bottom-strip', 'full-screen', 'split', 'mosaic', 'object-3d'],
  transition: ['flip', 'whip', 'mask', 'zoom-through', 'push', 'cut-on-beat', 'morph', 'blade-wipe'],
  topic: ['chapter-card', 'big-number', 'index-pill', 'list', 'diagram', 'typed-text', 'caption'],
  camera: ['guided-zoom', 'tracking', 'dolly-3d', 'orbit', 'static'],
  palette: ['main-color', 'secondary-color', 'accent-color', 'light-neutral', 'dark-neutral'],
  background: ['plain', 'shapes', 'giant-symbol', 'photo', 'grid'],
  pace: ['calm', 'medium', 'fast'],
  soundtrack: null,
}
const NOMES = Object.keys(EIXOS)
export const TRIO = ['style', 'layout', 'transition']
export const MIN_EIXOS = 3
export const JANELA = 3
// a ordem das trocas sugeridas, no empate: das mais baratas de fazer às mais caras (estilo muda o vídeo inteiro)
const ORDEM_TROCA = ['transition', 'layout', 'camera', 'background', 'palette', 'topic', 'pace', 'structure', 'style']

export class Falha extends Error {
  constructor(msg, codigo = 2) { super(msg); this.codigo = codigo }
}

const casa = (p) => (p && p.startsWith(os.homedir()) ? '~' + p.slice(os.homedir().length) : p)
const expandir = (p) => (p && /^~[\\/]/.test(p) ? path.join(os.homedir(), p.slice(2)) : p)   // ~/ e ~\ (Windows)
const doisDig = (n) => String(n).padStart(2, '0')
const hoje = (d = new Date()) => `${d.getFullYear()}-${doisDig(d.getMonth() + 1)}-${doisDig(d.getDate())}`
const dataValida = (s) => /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s)) && new Date(s).toISOString().slice(0, 10) === s
const exemploTrilha = 'genre and BPM as text (e.g. "house 124")'

/** Os erros da direção (lista vazia = válida): os dez eixos presentes, cada valor da lista dele; trilha é texto. */
export function validar(direcao) {
  if (!direcao || typeof direcao !== 'object' || Array.isArray(direcao)) return [`the direction is a JSON object with the ten axes: ${NOMES.join(', ')}`]
  const erros = []
  for (const [eixo, valores] of Object.entries(EIXOS)) {
    const v = direcao[eixo]
    if (v == null || v === '') erros.push(`missing axis ${eixo}: ${valores ? `use one of ${valores.join(' · ')}` : exemploTrilha}`)
    else if (!valores) { if (typeof v !== 'string' || !v.trim()) erros.push(`soundtrack is free text, ${exemploTrilha}; got ${JSON.stringify(v)}`) }
    else if (!valores.includes(v)) erros.push(`${eixo} ${JSON.stringify(v)} does not exist: use one of ${valores.join(' · ')}`)
  }
  return erros
}

const normTrilha = (s) => String(s ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\s+/g, ' ').trim()
const mesmo = (eixo, a, b) => (eixo === 'soundtrack' ? normTrilha(a) === normTrilha(b) : a === b)

/** O histórico do mais novo para o mais velho (pela data; no mesmo dia, pelo registro). */
export const ordenar = (videos) => [...videos].sort((a, b) => String(b.date ?? '').localeCompare(String(a.date ?? '')) || String(b.recorded ?? '').localeCompare(String(a.recorded ?? '')))

function avaliar(direcao, videos) {
  const ultimos = ordenar(videos).slice(0, JANELA)
  const comparados = ultimos.map((v) => {
    const difere = NOMES.filter((e) => !mesmo(e, direcao[e], v.direction?.[e]))
    return { titulo: v.title, data: v.date, video: v.video, difere, repete: NOMES.filter((e) => !difere.includes(e)), falta: Math.max(0, MIN_EIXOS - difere.length) }
  })
  const ult = ultimos[0]
  const trio = ult && TRIO.every((e) => mesmo(e, direcao[e], ult.direction?.[e]))
    ? { titulo: ult.title, data: ult.date, valores: Object.fromEntries(TRIO.map((e) => [e, direcao[e]])) } : null
  return { ok: !trio && comparados.every((c) => c.falta === 0), comparados, trio }
}

// Trocas concretas: cada uma põe no eixo um valor que nenhum dos últimos vídeos usou (de preferência nunca usado na
// marca). Primeiro o mínimo que resolve (guloso: o eixo que mais destrava), depois até 3, com eixos que ainda repetem.
function sugerir(direcao, videos, { comparados, trio }) {
  const ultimos = ordenar(videos).slice(0, JANELA)
  const cands = ORDEM_TROCA.map((eixo) => {
    const livres = EIXOS[eixo].filter((x) => x !== direcao[eixo] && !ultimos.some((v) => v.direction?.[eixo] === x))
    const para = livres.find((x) => !videos.some((v) => v.direction?.[eixo] === x)) ?? livres[0]
    return para ? { eixo, de: direcao[eixo], para } : null
  }).filter(Boolean)
  const deficit = comparados.map((c) => ({ repete: c.repete, falta: c.falta }))
  let trioAberto = !!trio
  const pontos = (c) => deficit.filter((d) => d.falta > 0 && d.repete.includes(c.eixo)).length + (trioAberto && TRIO.includes(c.eixo) ? 1 : 0)
  const trocas = []
  while (trioAberto || deficit.some((d) => d.falta > 0)) {
    const melhor = cands.filter((c) => !trocas.includes(c)).reduce((m, c) => (pontos(c) > (m ? pontos(m) : 0) ? c : m), null)
    if (!melhor) break
    trocas.push(melhor)
    for (const d of deficit) if (d.repete.includes(melhor.eixo)) d.falta--
    if (TRIO.includes(melhor.eixo)) trioAberto = false
  }
  const basta = trocas.length
  const repeteEm = (c) => comparados.filter((k) => k.repete.includes(c.eixo)).length
  const extras = cands.filter((c) => !trocas.includes(c) && repeteEm(c) > 0).sort((a, b) => repeteEm(b) - repeteEm(a))
  trocas.push(...extras.slice(0, Math.max(0, 3 - trocas.length)))
  const aplicada = { ...direcao, ...Object.fromEntries(trocas.slice(0, basta).map((t) => [t.eixo, t.para])) }
  return { trocas, basta, resolve: avaliar(aplicada, videos).ok }
}

/**
 * Compara a direção com os 3 últimos vídeos do histórico. Passa se difere de cada um em pelo menos 3 eixos e não repete
 * o trio style+layout+transition do último. Reprovada, traz as trocas sugeridas.
 * → { ok, comparados: [{ titulo, data, video, difere, repete, falta }], trio, trocas: [{ eixo, de, para }], basta, resolve }
 */
export function comparar(direcao, videos = []) {
  const r = avaliar(direcao, videos)
  return r.ok ? { ...r, trocas: [], basta: 0, resolve: true } : { ...r, ...sugerir(direcao, videos, r) }
}

const nomeVideo = (c) => `"${c.titulo}" (${c.data})`
const plural = (n, s, p = `${s}s`) => `${n} ${n === 1 ? s : p}`
const eixos = (n) => plural(n, 'axis', 'axes')

/** O texto do checar para o resultado do comparar. */
export function relatorio(r, { marca, igual = false } = {}) {
  if (!r.comparados.length) return `ok, no history for ${marca}: nothing to compare.`
  if (r.ok) return `ok, it varies: differs from ${r.comparados.map((c) => `${nomeVideo(c)} in ${eixos(c.difere.length)}`).join(', from ')}; the style+layout+transition trio is new.`
  const L = [igual
    ? `warning: the direction repeats the latest videos of ${marca}, and passes only because --allow-repeat was given (an exception the owner asked for: say so in the prompt).`
    : `failed: the direction repeats the latest videos of ${marca}.`]
  for (const c of r.comparados) {
    if (!c.falta) { L.push(`  ✓ ${nomeVideo(c)}: differs in ${eixos(c.difere.length)}.`); continue }
    const quanto = c.difere.length ? `differs in only ${eixos(c.difere.length)} (${c.difere.join(', ')})` : 'is the same in every axis'
    L.push(`  ✗ ${nomeVideo(c)}: ${quanto}; it needs ${MIN_EIXOS}. Repeats: ${c.repete.join(', ')}.`)
  }
  if (r.trio) L.push(`  ✗ the trio is the same as the last one, ${nomeVideo(r.trio)}: ${TRIO.map((e) => `${e} ${r.trio.valores[e]}`).join(' + ')}.`)
  if (igual) return L.join('\n')
  if (r.trocas.length) {
    const n = r.trocas.length
    L.push(r.basta < n
      ? `Change (${r.basta === 1 ? 'the first one already solves it' : `the first ${r.basta} already solve it`}; the others move further from the latest):`
      : `Change ${n === 1 ? 'this axis' : `these ${n} axes`} (with ${n === 1 ? 'it' : 'them'}, it passes):`)
    for (const t of r.trocas) L.push(`  ${t.eixo}: ${t.de} → ${t.para}`)
  }
  if (!r.resolve) L.push('  That alone is not enough: also change other axes from the "Repeats" list.')
  L.push('Then run check again. Repeat on purpose only when the owner asks ("same as the last one"): --allow-repeat, and say so in the prompt.')
  return L.join('\n')
}

// ── histórico ────────────────────────────────────────────────────────────────────────────────────────────────────────
const arquivoDe = (marca) => path.join(raizMarcas(), marca, 'videos.json')

function marcaDe(m) {
  const s = slug(m)
  if (!s) throw new Falha('missing --brand <slug> (e.g. --brand my-product)')
  return s
}

function marcasComHistorico() {
  const raiz = raizMarcas()
  if (!fs.existsSync(raiz)) return []
  return fs.readdirSync(raiz).filter((n) => fs.existsSync(path.join(raiz, n, 'videos.json')))
}

/** O histórico da marca: { arq, hist: { version, brand, videos } }. Ilegível é erro: nunca se regrava por cima. */
export function lerHistorico(marca) {
  const arq = arquivoDe(marca)
  if (!fs.existsSync(arq)) return { arq, hist: { version: 1, brand: marca, videos: [] } }
  let hist
  try { hist = JSON.parse(fs.readFileSync(arq, 'utf8')) } catch (e) {
    throw new Falha(`${arq} is not valid JSON (${e.message}): fix the file by hand; the script does not rewrite an unreadable history`)
  }
  if (!Array.isArray(hist?.videos)) throw new Falha(`${arq} has no "videos" list: fix the file by hand; the script does not rewrite an unreadable history`)
  return { arq, hist }
}

function gravar(arq, hist) {
  fs.mkdirSync(path.dirname(arq), { recursive: true })
  const tmp = `${arq}.${process.pid}.tmp`
  fs.writeFileSync(tmp, JSON.stringify(hist, null, 2) + '\n')
  fs.renameSync(tmp, arq)
}

function lerDirecao(arq) {
  if (!arq) throw new Falha('missing --direction <direction.json> (the ten axes; see references/catalog/variety.md)')
  const a = path.resolve(expandir(arq))
  if (!fs.existsSync(a)) throw new Falha(`direction not found at ${a}: write direction.json with the ten axes from ${MATRIZ}`)
  let d
  try { d = JSON.parse(fs.readFileSync(a, 'utf8')) } catch (e) { throw new Falha(`${a} is not valid JSON (${e.message})`) }
  const erros = validar(d)
  if (erros.length) throw new Falha(`invalid direction in ${a}:\n${erros.map((e) => `  - ${e}`).join('\n')}\nThe axes and values are in ${MATRIZ}.`)
  return d
}

const direcaoLimpa = (d) => ({
  ...Object.fromEntries(NOMES.map((e) => [e, e === 'soundtrack' ? d[e].trim() : d[e]])),
  ...(d.name ? { name: d.name } : {}),
  ...(d.why ? { why: d.why } : {}),
})

/** checar: { codigo: 0 | 1, texto }. */
export function checar({ marca, direcao, igual = false }) {
  const m = marcaDe(marca)
  const d = lerDirecao(direcao)
  const { arq, hist } = lerHistorico(m)
  if (!hist.videos.length) {
    const outras = marcasComHistorico().filter((x) => x !== m)
    return { codigo: 0, texto: `ok, no history for ${m} (${casa(arq)}): it is the first video, nothing to compare.${outras.length ? ` Brands with history: ${outras.join(', ')}; check --brand.` : ''}` }
  }
  const r = comparar(d, hist.videos)
  return { codigo: r.ok || igual ? 0 : 1, texto: relatorio(r, { marca: m, igual }) }
}

/** registrar: valida e grava; o mesmo vídeo de novo atualiza a entrada dele. → { arq, entrada, atualizou, aviso } */
export function registrar({ marca, direcao, video, titulo, data = null, igual = false, agora = new Date() }) {
  const m = marcaDe(marca)
  const d = lerDirecao(direcao)
  if (!video) throw new Falha('missing --video <path of the delivered mp4>')
  const abs = path.resolve(expandir(video))
  if (!fs.existsSync(abs)) throw new Falha(`the video ${abs} does not exist: pass the path of the delivered mp4`)
  if (!titulo || !String(titulo).trim()) throw new Falha('missing --title "…" (the video\'s name, as the owner calls it)')
  if (data != null && !dataValida(data)) throw new Falha(`--date ${data}: use YYYY-MM-DD (e.g. ${hoje(agora)})`)
  const { arq, hist } = lerHistorico(m)
  const chave = casa(abs)
  const antes = hist.videos.find((v) => v.video === chave)
  const entrada = {
    title: String(titulo).trim(), date: data ?? antes?.date ?? hoje(agora), video: chave, direction: direcaoLimpa(d),
    recorded: antes?.recorded ?? agora.toISOString(), ...(antes ? { updated: agora.toISOString() } : {}),
  }
  const anteriores = hist.videos.filter((v) => v !== antes && String(v.date ?? '') <= entrada.date)
  hist.videos = antes ? hist.videos.map((v) => (v === antes ? entrada : v)) : [...hist.videos, entrada]
  gravar(arq, { version: hist.version ?? 1, brand: hist.brand ?? m, ...hist })
  const r = comparar(d, anteriores)
  const aviso = r.ok ? null : `${relatorio(r, { marca: m, igual: true }).split('\n').slice(1).join('\n')}\n${igual
    ? 'warning: recorded as an exception the owner asked for (--allow-repeat).'
    : 'warning: recorded anyway (the history needs to know what went out), but this direction repeats the latest ones: check should have been run first.'}`
  return { arq, entrada, atualizou: !!antes, aviso }
}

/** listar: a tabela dos vídeos da marca, o mais novo primeiro. */
export function listar(marca) {
  const m = marcaDe(marca)
  const { arq, hist } = lerHistorico(m)
  if (!hist.videos.length) return `no videos of ${m} in the history (${casa(arq)}).`
  const cab = ['date', 'title', ...NOMES, 'video']
  const linhas = ordenar(hist.videos).map((v) => [v.date, v.title, ...NOMES.map((e) => v.direction?.[e] ?? '?'), v.video].map((x) => String(x ?? '?')))
  const larg = cab.map((c, i) => Math.max(c.length, ...linhas.map((l) => l[i].length)))
  const fmt = (l) => l.map((x, i) => x.padEnd(larg[i])).join('  ').trimEnd()
  return [fmt(cab), fmt(larg.map((n) => '─'.repeat(n))), ...linhas.map(fmt), '', `${plural(linhas.length, 'video')} of ${m} · ${casa(arq)}`].join('\n')
}

// ── linha de comando ─────────────────────────────────────────────────────────────────────────────────────────────────
const USO = `usage:
  node variety.mjs check --brand <slug> --direction <direction.json> [--allow-repeat]
  node variety.mjs record --brand <slug> --direction <direction.json> --video <mp4> --title "…" [--date YYYY-MM-DD] [--allow-repeat]
  node variety.mjs list --brand <slug>`

function principal(argv) {
  const opt = (k) => { const i = argv.indexOf(`--${k}`); return i >= 0 && argv[i + 1] != null && !argv[i + 1].startsWith('--') ? argv[i + 1] : null }
  const [cmd] = argv
  const igual = argv.includes('--allow-repeat')
  if (cmd === 'check') {
    const r = checar({ marca: opt('brand'), direcao: opt('direction'), igual })
    console.log(r.texto)
    return r.codigo
  }
  if (cmd === 'record') {
    const r = registrar({ marca: opt('brand'), direcao: opt('direction'), video: opt('video'), titulo: opt('title'), data: opt('date'), igual })
    console.log(`✓ ${r.atualizou ? 'updated' : 'recorded'} in the history: "${r.entrada.title}" (${r.entrada.date}) · ${casa(r.arq)}`)
    if (r.aviso) console.log(r.aviso)
    return 0
  }
  if (cmd === 'list') { console.log(listar(opt('brand'))); return 0 }
  console.error(USO)
  return 2
}

if (process.argv[1] && (() => { try { return fs.realpathSync(process.argv[1]) === fs.realpathSync(fileURLToPath(import.meta.url)) } catch { return false } })()) {
  try { process.exitCode = principal(process.argv.slice(2)) } catch (e) {
    console.error(`variety: ${e.message}`)
    process.exitCode = e instanceof Falha ? e.codigo : 2
  }
}
