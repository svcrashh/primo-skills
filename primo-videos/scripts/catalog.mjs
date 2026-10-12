#!/usr/bin/env node
// The style catalog: the list of the styles the engine can make (what each one is, what it is for, what it needs from
// the person and the template that makes it), and the pages that show them next to what the person has in THEIR brand.
// The skill ships no sample gallery and no brand: a style is shown as a still made in the person's brand, on demand
// (SKILL.md, "show it before you make it"), and those stills are what these pages open.
//
//   node catalog.mjs list [--format text|md|json]
//        the styles: name, what it is for, what it needs, the template
//   node catalog.mjs show <style>
//        one style: what it is, what it is for, what it needs, the template, the card and the format example
//   node catalog.mjs open [--folder <video-folder>] [--brand <brand>] [--no-open] [--out <file>]
//        writes the list as a page and opens it. Under each style it shows what the person already has of it:
//        the stills of the video project (<video-folder>/stills/<style>*.png|jpg|webp|gif|mp4|webm|mov, or the still
//        of a direction-*.json of that style) and, with --brand, the brand's delivered videos in that style
//        (~/Documents/VideoStudio/Brands/<brand>/videos.json, written by variety.mjs record)
//   node catalog.mjs open --directions a.json,b.json… --folder <video-folder> [--no-open]
//        writes <folder>/directions.html (Portuguese: directions-pt.html): the proposed directions side by side, each
//        with its still and its ten axes, opens it and prints the table for the chat. The still of a direction is the
//        picture or the clip with the same name as its JSON (direction-1.png), next to it or in stills/, or the file
//        its "still" field points to. A direction without a still is marked: make the still before asking
//   All of them take --lang en|pt (default en; also en-US and pt-BR).
//
// Usage error, unknown style, invalid direction or unreadable file: exit code 2, saying what to do.
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { spawn } from 'node:child_process'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { EIXOS, validar, lerHistorico, ordenar } from './variety.mjs'
import { slug } from './kit.mjs'
import { ESTILOS, TIPOS, estilo } from './styles.mjs'

const AQUI = path.dirname(fileURLToPath(import.meta.url))
const SKILL = path.resolve(AQUI, '..')

export class Falha extends Error {
  constructor(msg, codigo = 2) { super(msg); this.codigo = codigo }
}

const casa = (p) => (p && p.startsWith(os.homedir()) ? '~' + p.slice(os.homedir().length) : p)
const expandir = (p) => (p && /^~[\\/]/.test(p) ? path.join(os.homedir(), p.slice(2)) : p)
const escHtml = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c])
const celula = (s) => String(s ?? '').replace(/\|/g, '\\|').replace(/\s*\n\s*/g, ' ')

// ── vocabulário: os rótulos que a pessoa lê ─────────────────────────────────────────────────────────────────────────────
const NOMES_EIXOS = {
  en: [['style', 'Style'], ['structure', 'Structure'], ['layout', 'Layout'], ['transition', 'Transition'], ['topic', 'Topic'],
    ['camera', 'Camera'], ['palette', 'Palette'], ['background', 'Background'], ['pace', 'Pace'], ['soundtrack', 'Soundtrack']],
  pt: [['style', 'Estilo'], ['structure', 'Estrutura'], ['layout', 'Leiaute'], ['transition', 'Transição'], ['topic', 'Tópico'],
    ['camera', 'Câmera'], ['palette', 'Paleta'], ['background', 'Fundo'], ['pace', 'Ritmo'], ['soundtrack', 'Trilha']],
}
const ROTULOS = {
  en: {
    structure: { 'step-by-step': 'Step by step', chapters: 'Chapters', 'problem-solution': 'Problem and solution', 'before-after': 'Before and after', 'questions-answers': 'Questions and answers', 'a-day-with': 'A day with', 'top-n': 'Top N', 'single-scene': 'Single scene', 'dos-and-donts': "Do's and don'ts" },
    layout: { 'left-column': 'Left column', 'right-column': 'Right column', 'bottom-strip': 'Bottom strip', 'full-screen': 'Full screen', split: 'Split', mosaic: 'Mosaic', 'object-3d': '3D object' },
    transition: { flip: 'Flip', whip: 'Whip', mask: 'Mask', 'zoom-through': 'Zoom through', push: 'Push', 'cut-on-beat': 'Cut on the beat', morph: 'Morph', 'blade-wipe': 'Blade wipe' },
    topic: { 'chapter-card': 'Chapter card', 'big-number': 'Big number', 'index-pill': 'Index pill', list: 'List', diagram: 'Diagram', 'typed-text': 'Typed text', caption: 'Caption' },
    camera: { 'guided-zoom': 'Guided zoom', tracking: 'Tracking', 'dolly-3d': '3D dolly', orbit: 'Orbit', static: 'Static' },
    palette: { 'main-color': "The brand's main color", 'secondary-color': "The brand's secondary color", 'accent-color': "The brand's accent color", 'light-neutral': 'Light neutral', 'dark-neutral': 'Dark neutral' },
    background: { plain: 'Plain', shapes: 'Shapes', 'giant-symbol': 'Giant symbol', photo: 'Photo', grid: 'Grid' },
    pace: { calm: 'Calm', medium: 'Medium', fast: 'Fast' },
    tipo: { 'product-screen': 'Product screen', concept: 'Concept', numbers: 'Numbers', 'chat-and-command': 'Chat and command', announcement: 'Announcement' },
  },
  pt: {
    structure: { 'step-by-step': 'Passo a passo', chapters: 'Capítulos', 'problem-solution': 'Problema e solução', 'before-after': 'Antes e depois', 'questions-answers': 'Perguntas e respostas', 'a-day-with': 'Um dia com', 'top-n': 'Top N', 'single-scene': 'Cena única', 'dos-and-donts': 'Faz e não faz' },
    layout: { 'left-column': 'Coluna à esquerda', 'right-column': 'Coluna à direita', 'bottom-strip': 'Faixa embaixo', 'full-screen': 'Tela cheia', split: 'Dividido', mosaic: 'Mosaico', 'object-3d': 'Objeto 3D' },
    transition: { flip: 'Virada', whip: 'Chicote', mask: 'Máscara', 'zoom-through': 'Zoom através', push: 'Empurrão', 'cut-on-beat': 'Corte no tempo', morph: 'Morph', 'blade-wipe': 'Lâmina' },
    topic: { 'chapter-card': 'Cartão de capítulo', 'big-number': 'Número grande', 'index-pill': 'Pílula de índice', list: 'Lista', diagram: 'Diagrama', 'typed-text': 'Texto digitado', caption: 'Legenda' },
    camera: { 'guided-zoom': 'Zoom guiado', tracking: 'Travelling', 'dolly-3d': 'Dolly 3D', orbit: 'Órbita', static: 'Estática' },
    palette: { 'main-color': 'A cor principal da marca', 'secondary-color': 'A cor secundária da marca', 'accent-color': 'A cor de destaque da marca', 'light-neutral': 'Neutro claro', 'dark-neutral': 'Neutro escuro' },
    background: { plain: 'Liso', shapes: 'Formas', 'giant-symbol': 'Símbolo gigante', photo: 'Foto', grid: 'Grade' },
    pace: { calm: 'Calmo', medium: 'Médio', fast: 'Rápido' },
    tipo: { 'product-screen': 'Tela do produto', concept: 'Conceito', numbers: 'Números', 'chat-and-command': 'Conversa e comando', announcement: 'Anúncio' },
  },
}
/** O que a pessoa lê para o valor de um eixo (o estilo vem da lista de estilos). */
export const rotulo = (eixo, v, lingua = 'en') => (eixo === 'style' ? estilo(v, lingua)?.nome : ROTULOS[lingua]?.[eixo]?.[v]) ?? String(v ?? '').replace(/-/g, ' ')

/** 'en' | 'pt', from en, en-US, pt, pt-BR (case-insensitive). Anything else: Falha saying what to use. */
export function normalizarLingua(v = 'en') {
  const s = String(v ?? '').trim().toLowerCase()
  if (s === 'en' || s === 'en-us') return 'en'
  if (s === 'pt' || s === 'pt-br') return 'pt'
  throw new Falha(`--lang ${s ? `"${v}" is not a language here` : 'needs a value'}: use en (the default; also en-US) or pt (also pt-BR)`)
}

const TEXTOS = {
  en: {
    titulo: 'Video styles', lead: (n) => `The ${n} styles the engine can make. None of them carries a brand: the colors, the font, the logo and the content come from your product. Each direction is shown to you as a still in your brand before anything is animated.`,
    serve: 'For', precisa: 'Needs', molde: 'Template', seus: 'Yours in this style', nenhum: 'No still of yours in this style yet.',
    fora: 'A style that is not here? Describe it or show a reference: the skill names the closest template or builds from your reference.',
    todos: 'All', deProjeto: 'still of this project', daMarca: 'delivered', direcoes: 'Proposed directions',
    leadDir: 'Each direction with its still, made in your brand. Pick one, mix two, or ask for another.',
    semStill: 'No still yet: the still comes before the question.', eixos: 'The ten axes', porque: 'Why',
    colunas: ['', 'Direction', 'Style', 'Palette', 'Still'], semStillCurto: 'no still yet', listaEstilos: 'All the styles',
  },
  pt: {
    titulo: 'Estilos de vídeo', lead: (n) => `Os ${n} estilos que o motor sabe fazer. Nenhum traz marca: as cores, a fonte, o logo e o conteúdo vêm do seu produto. Cada direção é mostrada a você como imagem parada na sua marca antes de qualquer animação.`,
    serve: 'Serve para', precisa: 'Precisa de', molde: 'Molde', seus: 'Os seus neste estilo', nenhum: 'Ainda não há imagem sua neste estilo.',
    fora: 'Um estilo que não está aqui? Descreva ou mostre uma referência: a skill diz o molde mais próximo ou monta a partir da sua referência.',
    todos: 'Todos', deProjeto: 'imagem deste projeto', daMarca: 'entregue', direcoes: 'Direções propostas',
    leadDir: 'Cada direção com a sua imagem parada, feita na sua marca. Escolha uma, misture duas ou peça outra.',
    semStill: 'Ainda sem imagem: a imagem vem antes da pergunta.', eixos: 'Os dez eixos', porque: 'Por quê',
    colunas: ['', 'Direção', 'Estilo', 'Paleta', 'Imagem'], semStillCurto: 'ainda sem imagem', listaEstilos: 'Todos os estilos',
  },
}

// ── a lista ──────────────────────────────────────────────────────────────────────────────────────────────────────────
const IDS = Object.keys(ESTILOS)
/** Os estilos na língua pedida, na ordem da lista. */
export const estilos = (lingua = 'en') => IDS.map((id) => estilo(id, lingua))

function estiloOuFalha(id) {
  if (!id || !ESTILOS[id]) throw new Falha(`${id ? `style "${id}" does not exist` : 'missing the style'}: use one of ${IDS.join(' · ')}`)
  return id
}

/** listar: a lista dos estilos como texto, tabela markdown (para o chat) ou JSON. */
export function listar({ formato = 'text', lingua = 'en' } = {}) {
  const lg = normalizarLingua(lingua), T = TEXTOS[lg], es = estilos(lg)
  if (formato === 'json') return JSON.stringify(es, null, 2)
  if (formato === 'md') {
    const cab = lg === 'pt' ? ['Estilo', 'id', 'Serve para', 'Precisa de', 'Molde'] : ['Style', 'id', 'For', 'Needs', 'Template']
    return [`| ${cab.join(' | ')} |`, `|${cab.map(() => '---').join('|')}|`, ...es.map((e) => `| ${celula(e.nome)} | \`${e.id}\` | ${celula(e.serve)} | ${celula(e.precisa)} | \`${e.molde}\` |`)].join('\n')
  }
  if (formato !== 'text') throw new Falha(`--format ${formato}: use text (the default), md or json`)
  return es.map((e) => `${e.nome} (${e.id})\n  ${T.serve.toLowerCase()}: ${e.serve}\n  ${T.precisa.toLowerCase()}: ${e.precisa}\n  ${T.molde.toLowerCase()}: ${e.molde}`).join('\n')
}

/** mostrar: um estilo, com a ficha e o exemplo de formato quando existem. */
export function mostrar({ id, lingua = 'en' } = {}) {
  const lg = normalizarLingua(lingua), T = TEXTOS[lg], e = estilo(estiloOuFalha(id), lg)
  const ficha = path.join('references', 'catalog', 'styles', `${e.id}.md`)
  const L = [`${e.nome} (${e.id})`, `  ${e.frase}`, `  ${T.serve.toLowerCase()}: ${e.serve}`, `  ${T.precisa.toLowerCase()}: ${e.precisa}`, `  ${T.molde.toLowerCase()}: ${path.join(SKILL, e.molde)}`]
  if (fs.existsSync(path.join(SKILL, ficha))) L.push(`  card: ${path.join(SKILL, ficha)}`)
  if (fs.existsSync(path.join(SKILL, e.exemplo))) L.push(`  format example (greys and placeholder texts, no brand): ${path.join(SKILL, e.exemplo)}`)
  return L.join('\n')
}

// ── o que a pessoa já tem: as imagens do projeto e os vídeos entregues da marca ─────────────────────────────────────────
const IMAGEM = /\.(png|jpe?g|webp|gif)$/i
const VIDEO = /\.(mp4|webm|mov)$/i
const ehMidia = (f) => IMAGEM.test(f) || VIDEO.test(f)
const midia = (arq, origem, titulo) => ({ arq, tipo: VIDEO.test(arq) ? 'video' : 'image', origem, titulo: titulo ?? path.basename(arq) })
// o estilo pelo começo do nome do arquivo: card-bento-2.png é do card-bento (o id mais longo primeiro)
const estiloDoNome = (nome) => [...IDS].sort((a, b) => b.length - a.length).find((id) => nome === id || nome.startsWith(`${id}-`) || nome.startsWith(`${id}.`) || nome.startsWith(`${id}_`)) ?? null

function lerJson(arq) {
  try { return JSON.parse(fs.readFileSync(arq, 'utf8')) } catch (e) { throw new Falha(`${arq} is not valid JSON (${e.message})`) }
}

/** A imagem (ou o clipe) de uma direção: o campo "still" do JSON, ou o arquivo com o mesmo nome ao lado dele ou em stills/. */
export function stillDaDirecao(arqJson, d = null, pasta = null) {
  const dir = path.dirname(arqJson), base = path.basename(arqJson).replace(/\.json$/i, '')
  const declarado = (d ?? {}).still
  if (typeof declarado === 'string' && declarado.trim()) {
    const a = path.resolve(dir, expandir(declarado.trim()))
    if (fs.existsSync(a)) return a
  }
  for (const onde of [dir, path.join(dir, 'stills'), ...(pasta ? [path.join(pasta, 'stills'), pasta] : [])]) {
    if (!fs.existsSync(onde)) continue
    const achado = fs.readdirSync(onde).filter((f) => ehMidia(f) && f.replace(/\.[^.]+$/, '') === base).sort((a, b) => Number(VIDEO.test(a)) - Number(VIDEO.test(b)))[0]
    if (achado) return path.join(onde, achado)
  }
  return null
}

/** As imagens do projeto por estilo: { <style>: [midia…] }. Pasta que não existe é erro (o --folder pode estar errado). */
export function midiaDoProjeto(pasta) {
  const p = path.resolve(expandir(pasta))
  if (!fs.existsSync(p) || !fs.statSync(p).isDirectory()) throw new Falha(`video folder not found at ${p}: check --folder`)
  const por = {}
  const por_ = (id, m) => { if (!(por[id] ||= []).some((x) => x.arq === m.arq)) por[id].push(m) }
  for (const onde of [path.join(p, 'stills'), p]) {
    if (!fs.existsSync(onde)) continue
    for (const f of fs.readdirSync(onde).sort()) {
      const arq = path.join(onde, f)
      if (ehMidia(f)) { const id = estiloDoNome(f.toLowerCase()); if (id) por_(id, midia(arq, 'project')) }
      else if (/^direction.*\.json$/i.test(f)) {
        let d
        try { d = JSON.parse(fs.readFileSync(arq, 'utf8')) } catch { continue }
        const still = ESTILOS[d?.style] ? stillDaDirecao(arq, d, p) : null
        if (still) por_(d.style, midia(still, 'project', d.name))
      }
    }
  }
  return por
}

/** Os vídeos entregues da marca por estilo (o histórico da variedade), só os que ainda estão no disco. */
export function videosDaMarca(marca) {
  const s = slug(marca)
  if (!s) throw new Falha('--brand needs the brand: --brand "<brand>"')
  let videos
  try { videos = ordenar(lerHistorico(s).hist.videos) } catch (e) { throw new Falha(e.message) }
  const por = {}
  for (const v of videos) {
    const id = v.direction?.style, arq = v.video && path.resolve(expandir(String(v.video)))
    if (ESTILOS[id] && arq && fs.existsSync(arq)) (por[id] ||= []).push(midia(arq, 'brand', [v.title, v.date].filter(Boolean).join(' · ')))
  }
  return por
}

// ── as páginas ───────────────────────────────────────────────────────────────────────────────────────────────────────
// Sem marca: cinzas, a fonte do sistema, claro e escuro pelo sistema de quem abre.
const CSS = `:root{color-scheme:light dark;--fundo:#f5f5f5;--painel:#ebebeb;--painel2:#dedede;--tinta:#1d1d1d;--apagado:#666;--linha:#c7c7c7;--forte:#1d1d1d;--sobre-forte:#f5f5f5}
@media (prefers-color-scheme:dark){:root{--fundo:#1d1d1d;--painel:#2c2c2c;--painel2:#383838;--tinta:#f5f5f5;--apagado:#a8a8a8;--linha:#505050;--forte:#f5f5f5;--sobre-forte:#1d1d1d}}
*{box-sizing:border-box}body{margin:0;background:var(--fundo);color:var(--tinta);font:16px/1.5 system-ui,-apple-system,"Segoe UI",Roboto,"Helvetica Neue",Arial,sans-serif}
main{max-width:1180px;margin:0 auto;padding:40px 24px 96px}h1{margin:0 0 12px;font-size:40px;line-height:1.05;letter-spacing:-.02em}h2{margin:0 0 4px;font-size:22px;line-height:1.2}
.lead{max-width:760px;margin:0 0 24px;color:var(--apagado);font-size:18px}.fora{max-width:760px;margin:40px 0 0;color:var(--apagado)}
.filtros{display:flex;flex-wrap:wrap;gap:8px;margin:0 0 28px}.filtros button{font:inherit;font-weight:600;color:inherit;height:36px;padding:0 14px;border:0;border-radius:18px;background:var(--painel);cursor:pointer}
.filtros button[aria-pressed="true"]{background:var(--forte);color:var(--sobre-forte)}
.grade{display:grid;grid-template-columns:repeat(auto-fill,minmax(340px,1fr));gap:16px}.cartao{padding:22px;border-radius:20px;background:var(--painel);display:flex;flex-direction:column;gap:10px}
.id{font:13px/1.4 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;color:var(--apagado)}.frase{margin:0}
dl{margin:0;display:grid;grid-template-columns:auto 1fr;gap:4px 12px;font-size:15px}dt{color:var(--apagado)}dd{margin:0}code{font:13px/1.4 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;word-break:break-all}
.seus{margin-top:6px;padding-top:12px;border-top:1px solid var(--linha)}.seus p{margin:0 0 8px;font-size:13px;font-weight:600;color:var(--apagado)}.vazio{font-weight:400!important}
.midias{display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:8px}figure{margin:0}figure img,figure video{display:block;width:100%;border-radius:10px;background:var(--painel2)}
figcaption{margin-top:4px;font-size:12px;color:var(--apagado);overflow-wrap:anywhere}
.direcoes{display:grid;grid-template-columns:repeat(auto-fit,minmax(320px,1fr));gap:20px;align-items:start}.direcao{padding:22px;border-radius:20px;background:var(--painel)}
.letra{display:inline-grid;place-items:center;width:36px;height:36px;margin-bottom:10px;border-radius:50%;background:var(--forte);color:var(--sobre-forte);font-weight:700}
.still{margin:14px 0}.still img,.still video{display:block;width:100%;border-radius:12px;background:var(--painel2)}
.sem-still{margin:14px 0;padding:36px 16px;border:2px dashed var(--linha);border-radius:12px;text-align:center;color:var(--apagado)}
table{width:100%;border-collapse:collapse;font-size:14px}th,td{padding:6px 0;text-align:left;border-top:1px solid var(--linha);vertical-align:top}th{width:38%;font-weight:400;color:var(--apagado)}
.rodape{margin-top:32px;color:var(--apagado)}.rodape a{color:inherit}[hidden]{display:none!important}`

const figura = (m, T) => {
  const src = escHtml(pathToFileURL(m.arq).href)
  const quadro = m.tipo === 'video' ? `<video src="${src}" muted loop playsinline preload="metadata" controls></video>` : `<img src="${src}" alt="${escHtml(m.titulo)}" loading="lazy">`
  return `<figure>${quadro}<figcaption>${escHtml(m.titulo)} · ${escHtml(m.origem === 'brand' ? T.daMarca : T.deProjeto)}</figcaption></figure>`
}
const esqueleto = (lingua, titulo, corpo) => `<!doctype html>
<html lang="${lingua === 'pt' ? 'pt-BR' : 'en'}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escHtml(titulo)}</title>
<style>${CSS}</style>
</head>
<body>
<main>
${corpo}
</main>
</body>
</html>
`

/** A página dos estilos, com o que a pessoa já tem de cada um. `meus` = { <style>: [midia…] }. */
export function paginaEstilos({ lingua = 'en', meus = {} } = {}) {
  const lg = normalizarLingua(lingua), T = TEXTOS[lg], es = estilos(lg)
  const temMeus = Object.values(meus).some((l) => l.length)
  const cartao = (e) => {
    const lista = meus[e.id] ?? []
    const seus = temMeus ? `<div class="seus"><p${lista.length ? '' : ' class="vazio"'}>${escHtml(lista.length ? T.seus : T.nenhum)}</p>${lista.length ? `<div class="midias">${lista.map((m) => figura(m, T)).join('')}</div>` : ''}</div>` : ''
    return `<article class="cartao" data-tipo="${e.tipo}" id="${e.id}"><div><h2>${escHtml(e.nome)}</h2><span class="id">${e.id} · ${escHtml(rotulo('tipo', e.tipo, lg))}</span></div><p class="frase">${escHtml(e.frase)}</p><dl><dt>${escHtml(T.serve)}</dt><dd>${escHtml(e.serve)}</dd><dt>${escHtml(T.precisa)}</dt><dd>${escHtml(e.precisa)}</dd><dt>${escHtml(T.molde)}</dt><dd><code>${escHtml(e.molde)}</code></dd></dl>${seus}</article>`
  }
  const filtros = `<div class="filtros"><button type="button" data-filtro="" aria-pressed="true">${escHtml(T.todos)}</button>${TIPOS.map((t) => `<button type="button" data-filtro="${t}" aria-pressed="false">${escHtml(rotulo('tipo', t, lg))}</button>`).join('')}</div>`
  const script = `<script>(function(){var b=[].slice.call(document.querySelectorAll('[data-filtro]')),c=[].slice.call(document.querySelectorAll('.cartao'));b.forEach(function(x){x.addEventListener('click',function(){b.forEach(function(y){y.setAttribute('aria-pressed',String(y===x))});c.forEach(function(k){k.hidden=!!x.dataset.filtro&&k.dataset.tipo!==x.dataset.filtro})})})})()</script>`
  return esqueleto(lg, T.titulo, `<h1>${escHtml(T.titulo)}</h1>\n<p class="lead">${escHtml(T.lead(es.length))}</p>\n${filtros}\n<div class="grade">\n${es.map(cartao).join('\n')}\n</div>\n<p class="fora">${escHtml(T.fora)}</p>\n${script}`)
}

/** Lê e valida as direções: [{ arq, d, letra, still }]. */
export function lerDirecoes(lista, pasta = null) {
  const arqs = String(lista ?? '').split(',').map((s) => s.trim()).filter(Boolean)
  if (!arqs.length) throw new Falha('--directions needs the files: --directions direction-1.json,direction-2.json')
  return arqs.map((a, i) => {
    const arq = path.resolve(pasta && !path.isAbsolute(expandir(a)) && !fs.existsSync(path.resolve(expandir(a))) ? path.join(pasta, a) : expandir(a))
    if (!fs.existsSync(arq)) throw new Falha(`direction not found at ${arq}: write it with the ten axes (references/catalog/variety.md)`)
    const d = lerJson(arq)
    const erros = validar(d)
    if (erros.length) throw new Falha(`invalid direction in ${arq}:\n${erros.map((e) => `  - ${e}`).join('\n')}\nThe axes and values are in references/catalog/variety.md.`)
    return { arq, d, letra: String.fromCharCode(65 + i), still: stillDaDirecao(arq, d, pasta) }
  })
}

/** A página das direções propostas, lado a lado, cada uma com a sua imagem e os dez eixos. */
export function paginaDirecoes({ direcoes, lingua = 'en', estilosHref = null } = {}) {
  const lg = normalizarLingua(lingua), T = TEXTOS[lg]
  const bloco = (x) => {
    const e = estilo(x.d.style, lg)
    const still = x.still
      ? `<div class="still">${VIDEO.test(x.still) ? `<video src="${escHtml(pathToFileURL(x.still).href)}" muted loop playsinline controls preload="metadata"></video>` : `<img src="${escHtml(pathToFileURL(x.still).href)}" alt="${escHtml(x.d.name ?? x.letra)}">`}</div>`
      : `<div class="sem-still">${escHtml(T.semStill)}</div>`
    const linhas = NOMES_EIXOS[lg].map(([eixo, nome]) => `<tr><th>${escHtml(nome)}</th><td>${escHtml(eixo === 'soundtrack' ? x.d[eixo] : rotulo(eixo, x.d[eixo], lg))}</td></tr>`).join('')
    const nome = (lg === 'pt' && x.d.pt?.name) || x.d.name || e.nome
    const porque = (lg === 'pt' && x.d.pt?.why) || x.d.why
    return `<article class="direcao"><span class="letra">${x.letra}</span><h2>${escHtml(nome)}</h2><span class="id">${escHtml(e.nome)} · ${e.id}</span>${still}${porque ? `<p><strong>${escHtml(T.porque)}:</strong> ${escHtml(porque)}</p>` : ''}<p class="frase">${escHtml(e.frase)}</p><table aria-label="${escHtml(T.eixos)}">${linhas}</table></article>`
  }
  const rodape = estilosHref ? `<p class="rodape"><a href="${escHtml(estilosHref)}">${escHtml(T.listaEstilos)}</a></p>` : ''
  return esqueleto(lg, T.direcoes, `<h1>${escHtml(T.direcoes)}</h1>\n<p class="lead">${escHtml(T.leadDir)}</p>\n<div class="direcoes">\n${direcoes.map(bloco).join('\n')}\n</div>\n${rodape}`)
}

/** A tabela das direções para o chat (markdown). */
export function tabelaDirecoes(direcoes, lingua = 'en') {
  const lg = normalizarLingua(lingua), T = TEXTOS[lg]
  const L = [`| ${T.colunas.join(' | ')} |`, `|${T.colunas.map(() => '---').join('|')}|`]
  for (const x of direcoes) L.push(`| ${x.letra} | ${celula((lg === 'pt' && x.d.pt?.name) || x.d.name || '')} | ${celula(rotulo('style', x.d.style, lg))} | ${celula(rotulo('palette', x.d.palette, lg))} | ${x.still ? celula(casa(x.still)) : T.semStillCurto} |`)
  return L.join('\n')
}

// No Windows, o explorer abre o arquivo no programa padrão sem passar pelo cmd (o `start` leria &, ^ e % do caminho).
// As aspas vão por nossa conta, sem o Node mexer: o explorer corta o caminho sem aspas na vírgula, e nome de arquivo no
// Windows não tem aspas.
function abrirNoNavegador(arq) {
  const aviso = `couldn't open it myself: open it in the browser ${arq}`
  const [cmd, args, extra] = process.platform === 'darwin' ? ['open', [arq]] : process.platform === 'win32' ? ['explorer.exe', [`"${arq}"`], { windowsVerbatimArguments: true }] : ['xdg-open', [arq]]
  try {
    const p = spawn(cmd, args, { detached: true, stdio: 'ignore', ...extra })
    p.on('error', () => console.error(aviso))
    p.unref()
  } catch { console.error(aviso) }
}

const sufixo = (lg) => (lg === 'pt' ? '-pt' : '')

/** abrir: escreve a página (os estilos, ou as direções) e abre. → { caminho, tabela, semStill, estilos } */
export function abrir({ direcoes = null, pasta = null, marca = null, saida = null, semAbrir = false, lingua = 'en' } = {}) {
  const lg = normalizarLingua(lingua)
  const p = pasta ? path.resolve(expandir(pasta)) : null
  const meus = {}
  if (p) for (const [id, l] of Object.entries(midiaDoProjeto(p))) (meus[id] ||= []).push(...l)
  if (marca) for (const [id, l] of Object.entries(videosDaMarca(marca))) (meus[id] ||= []).push(...l)
  const arqEstilos = saida && direcoes == null ? path.resolve(expandir(saida)) : path.join(p ?? os.tmpdir(), `${p ? 'styles' : 'primo-videos-styles'}${sufixo(lg)}.html`)
  fs.mkdirSync(path.dirname(arqEstilos), { recursive: true })
  fs.writeFileSync(arqEstilos, paginaEstilos({ lingua: lg, meus }))
  if (direcoes == null) {
    if (!semAbrir) abrirNoNavegador(arqEstilos)
    return { caminho: arqEstilos, tabela: null, semStill: [], estilos: arqEstilos, meus: Object.values(meus).reduce((n, l) => n + l.length, 0) }
  }
  if (!p) throw new Falha('--directions needs --folder <video-folder>: the page is written there, next to the stills')
  if (!fs.existsSync(p)) throw new Falha(`video folder not found at ${p}: check --folder`)
  const ds = lerDirecoes(direcoes, p)
  const caminho = saida ? path.resolve(expandir(saida)) : path.join(p, `directions${sufixo(lg)}.html`)
  fs.writeFileSync(caminho, paginaDirecoes({ direcoes: ds, lingua: lg, estilosHref: pathToFileURL(arqEstilos).href }))
  if (!semAbrir) abrirNoNavegador(caminho)
  return { caminho, tabela: tabelaDirecoes(ds, lg), semStill: ds.filter((x) => !x.still).map((x) => x.letra), estilos: arqEstilos, meus: 0 }
}

const USO = `usage: node catalog.mjs list [--format text|md|json] [--lang en|pt]
       node catalog.mjs show <style> [--lang en|pt]
       node catalog.mjs open [--folder <video-folder>] [--brand <brand>] [--no-open] [--out <file>] [--lang en|pt]
       node catalog.mjs open --directions a.json,b.json --folder <video-folder> [--no-open] [--lang en|pt]`

function principal(argv) {
  const opt = (k) => { const i = argv.indexOf(`--${k}`); return i >= 0 && argv[i + 1] != null && !argv[i + 1].startsWith('--') ? argv[i + 1] : null }
  const [cmd, alvo] = argv
  const lingua = argv.includes('--lang') ? normalizarLingua(opt('lang') ?? '') : 'en'
  if (cmd === 'list') { console.log(listar({ formato: opt('format') ?? 'text', lingua })); return 0 }
  if (cmd === 'show') { console.log(mostrar({ id: alvo && !alvo.startsWith('--') ? alvo : null, lingua })); return 0 }
  if (cmd === 'open') {
    const semAbrir = argv.includes('--no-open')
    const r = abrir({ direcoes: argv.includes('--directions') ? opt('directions') ?? '' : null, pasta: opt('folder'), marca: opt('brand'), saida: opt('out'), semAbrir, lingua })
    console.log(`${semAbrir ? 'ready (not opened)' : 'opened'}: ${r.caminho}`)
    if (r.tabela) {
      console.log(`\n${r.tabela}`)
      if (r.semStill.length) console.log(`\nno still yet: ${r.semStill.join(', ')}. Make the still of each direction in the person's brand and open again before asking.`)
      console.log(`\nAll the styles: ${r.estilos}`)
    } else if (!r.meus) {
      console.log(`${IDS.length} styles, with no still of the person yet. A style is shown as a still made in their brand: write each proposed direction as direction-<n>.json, save its still as direction-<n>.png next to it, and run: node ${path.join(AQUI, 'catalog.mjs')} open --directions direction-1.json,direction-2.json --folder <video-folder>`)
    }
    return 0
  }
  console.error(USO)
  return 2
}

if (process.argv[1] && (() => { try { return fs.realpathSync(process.argv[1]) === fs.realpathSync(fileURLToPath(import.meta.url)) } catch { return false } })()) {
  try { process.exitCode = principal(process.argv.slice(2)) } catch (e) {
    console.error(`catalog: ${e.message}`)
    process.exitCode = e instanceof Falha ? e.codigo : 2
  }
}

export { EIXOS, IDS }
