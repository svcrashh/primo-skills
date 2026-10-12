#!/usr/bin/env node
// Molde photo-mosaic: confere os parâmetros, calcula a linha do tempo (na grade da trilha) e o encaixe das fotos em
// cada mosaico, e monta a obra (a cena pronta para o navegador), sem renderizar. O render.mjs chama isto; os testes
// também.
//   node assemble.mjs <parametros.json> <folder-da-obra>        (monta e diz os tempos; para olhar com frames.cjs)
// Nada de marca aqui: cores, fonte, fotos, logo e textos vêm do JSON. O que cada campo faz: TEMPLATE.md.
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const AQUI = path.dirname(fileURLToPath(import.meta.url))
const SKILL = path.resolve(AQUI, '..', '..')

export const OPCOES = {
  ritmo: ['calmo', 'medio', 'rapido'],
  leiaute: ['mosaico', 'dividido'],
  camera: ['estatica', 'travelling', 'guided-zoom'],
  etapa: ['mosaico', 'destaque'],
  formato: ['16x9', '19x9', '21x9', '9x16', '1x1', '4x5'],
}
export const PADRAO = { bpm: 120, ritmo: 'medio', leiaute: 'mosaico', camera: 'estatica', formatos: ['16x9'], raio: 40, vao: 18, fonte: { familia: 'Inter' } }
const MOV = { calmo: 1.0, medio: 0.8, rapido: 0.55 }      // s que cada foto leva para ir ao lugar novo
const ESCALA = { calmo: 0.07, medio: 0.05, rapido: 0.035 } // s entre uma foto e a próxima, quando o mosaico se reorganiza
const BATIDAS = { calmo: 5, medio: 6, rapido: 4 }          // batidas de cada etapa, sem "batidas" no JSON
const MAX_PALAVRAS = 7
const HEX = /^#[0-9a-fA-F]{6}$/

export class Falha extends Error {}

const expandir = (p) => (typeof p === 'string' && p.startsWith('~') ? path.join(os.homedir(), p.slice(1)) : p)
const lista = (v) => v.join(' | ')
const palavras = (s) => String(s).trim().split(/\s+/).filter((w) => w && !/^[·•|\-–—]$/.test(w))
const r3 = (x) => Math.round(x * 1000) / 1000

/** As fotos viram { arquivo, foco }; os padrões preenchidos. Não confere nada. */
export function normalizar(P0) {
  const P = JSON.parse(JSON.stringify(P0 || {}))
  for (const k of ['bpm', 'ritmo', 'leiaute', 'camera', 'formatos', 'raio', 'vao']) P[k] ??= PADRAO[k]
  P.fonte = { ...PADRAO.fonte, ...(P.fonte || {}) }
  P.cores = P.cores || {}
  P.fotos = (P.fotos || []).map((f) => (typeof f === 'string' ? { arquivo: f } : { ...f }))
  P.fotos.forEach((f) => { f.foco ??= [50, 50] })
  P.etapas = (P.etapas || []).map((e) => ({ ...e }))
  return P
}

/** Encaixa as fotos numa grade c×r, na ordem dada, as "grandes" ocupando 2×2 (cada uma na 1ª casa livre que couber). */
export function encaixar(c, r, ordem, grandes = []) {
  const livre = Array.from({ length: r }, () => Array(c).fill(true))
  const pos = {}
  for (const p of ordem) {
    const s = grandes.includes(p) ? 2 : 1
    let achou = null
    for (let y = 0; y < r && !achou; y++) for (let x = 0; x < c && !achou; x++) {
      if (x + s > c || y + s > r) continue
      let ok = true
      for (let dy = 0; dy < s && ok; dy++) for (let dx = 0; dx < s && ok; dx++) if (!livre[y + dy][x + dx]) ok = false
      if (ok) achou = [x, y]
    }
    if (!achou) return { erro: `photo ${p}${s === 2 ? ' (large)' : ''} did not fit in the ${c}×${r} grid` }
    for (let dy = 0; dy < s; dy++) for (let dx = 0; dx < s; dx++) livre[achou[1] + dy][achou[0] + dx] = false
    pos[p] = { x: achou[0], y: achou[1], s }
  }
  return { pos, buracos: livre.flat().filter(Boolean).length }
}

/** A grade padrão para n fotos com g grandes: deitada (mais colunas que linhas), sem buraco quando dá. */
export function gradePadrao(n, g) {
  const casas = n + 3 * g
  let melhor = null
  for (let r = g ? 2 : 1; r <= 4; r++) for (let c = Math.max(r, g ? 2 : 1); c <= 7; c++) {
    if (c * r < casas) continue
    const nota = Math.abs(c / r - 2.2) + 1.5 * (c * r - casas)
    if (!melhor || nota < melhor.nota) melhor = { c, r, nota }
  }
  return melhor ? [melhor.c, melhor.r] : [Math.ceil(casas / 2), 2]
}

/** Os erros dos parâmetros (lista vazia = ok). base = a pasta do JSON (os caminhos de arquivo são relativos a ela). */
export function validar(P0, base = process.cwd()) {
  const erros = []
  if (!P0 || typeof P0 !== 'object' || Array.isArray(P0)) return ['the parameters must be a JSON object (see example.json)']
  const P = normalizar(P0)
  const opcao = (campo, v, valores) => { if (!valores.includes(v)) erros.push(`${campo} ${JSON.stringify(v)} does not exist: use ${lista(valores)}`) }
  opcao('ritmo', P.ritmo, OPCOES.ritmo)
  opcao('leiaute', P.leiaute, OPCOES.leiaute)
  opcao('camera', P.camera, OPCOES.camera)
  if (!(typeof P.bpm === 'number' && P.bpm >= 60 && P.bpm <= 180)) erros.push(`bpm ${JSON.stringify(P.bpm)}: a number from 60 to 180 (the grid of the stages and the soundtrack; e.g. 120)`)
  if (!Array.isArray(P.formatos) || !P.formatos.length) erros.push(`formatos: a list, e.g. ["16x9"] (use ${lista(OPCOES.formato)})`)
  else for (const f of P.formatos) opcao('formato', f, OPCOES.formato)
  if (!(P.raio >= 0 && P.raio <= 120)) erros.push('raio: 0 to 120 px (the corner radius of the photos)')
  if (!(P.vao >= 0 && P.vao <= 80)) erros.push('vao: 0 to 80 px (the space between the photos)')
  const existe = (campo, arq) => {
    if (typeof arq !== 'string' || !arq) { erros.push(`${campo}: the file path (relative to the JSON)`); return }
    const abs = path.resolve(base, expandir(arq))
    if (!fs.existsSync(abs)) erros.push(`${campo}: could not find ${abs}`)
  }
  const pares = Array.isArray(P0.pares) ? P0.pares : null
  const conferirPar = (onde, fundo, texto) => {
    if (!HEX.test(fundo || '') || !HEX.test(texto || '') || !pares) return
    const p = pares.find((x) => String(x[0]).toUpperCase() === fundo.toUpperCase() && String(x[1]).toUpperCase() === texto.toUpperCase())
    if (!p) erros.push(`${onde}: the text ${texto} on the background ${fundo} is not an approved pair ("pares"); change one of the two colors`)
    else if (p[2] === 'AA18') erros.push(`${onde}: ${texto} on ${fundo} is AA18 (large bold titles only), and the label is reading text: use an AA or AAA pair`)
  }
  const C = P.cores
  for (const k of ['fundo', 'rotulo']) if (!HEX.test(C[k] || '')) erros.push(`cores.${k}: #RRGGBB (the video background and the label color)`)
  if (C.faixa && !HEX.test(C.faixa)) erros.push('cores.faixa: #RRGGBB (the background of the label band; without it, the video background)')
  if (C.painel && !HEX.test(C.painel)) erros.push('cores.painel: #RRGGBB (the background of the label panel, in the dividido layout)')
  const fundoRotulo = P.leiaute === 'dividido' ? C.painel || C.fundo : C.faixa || C.fundo
  conferirPar('the label', fundoRotulo, C.rotulo)
  if (P.etiqueta !== undefined) {
    if (typeof P.etiqueta !== 'string' || !P.etiqueta.trim() || palavras(P.etiqueta).length > 4) erros.push('etiqueta: up to 4 words (the fixed pill above the label, e.g. "Photo library")')
    if (!C.etiqueta || !HEX.test(C.etiqueta.fundo || '') || !HEX.test(C.etiqueta.texto || '')) erros.push('cores.etiqueta: { "fundo": "#…", "texto": "#…" } (the tag pill)')
    else conferirPar('the tag', C.etiqueta.fundo, C.etiqueta.texto)
  }

  const n = P.fotos.length
  if (n < 3 || n > 12) erros.push(`fotos: 3 to 12 (has ${n}); each one "path.jpg" or { "arquivo": "…", "foco": [x%, y%] }`)
  P.fotos.forEach((f, i) => {
    existe(`fotos[${i}]`, f.arquivo)
    if (!Array.isArray(f.foco) || f.foco.length !== 2 || f.foco.some((v) => !(v >= 0 && v <= 100))) erros.push(`fotos[${i}].foco: [x, y] in % (0 to 100), the point of the photo that must stay inside the crop`)
  })
  if (!P.etapas.length || P.etapas.length > 6) erros.push('etapas: 1 to 6 (e.g. [{ "tipo": "mosaico", "rotulo": "128 photos of your brand" }, { "tipo": "destaque", "foto": 2, "rotulo": "…" }])')
  P.etapas.forEach((e, k) => {
    const oe = `etapas[${k}]`
    opcao(`${oe}.tipo`, e.tipo, OPCOES.etapa)
    const rot = String(e.rotulo ?? '').trim()
    if (!rot) erros.push(`${oe}.rotulo: the band text (informative: name, number, fact), up to ${MAX_PALAVRAS} words`)
    else {
      if (palavras(rot).length > MAX_PALAVRAS) erros.push(`${oe}.rotulo "${rot}": up to ${MAX_PALAVRAS} words (has ${palavras(rot).length})`)
      if (/!/.test(rot)) erros.push(`${oe}.rotulo "${rot}": no exclamation mark. The label is informative (name, number, fact), never a catchphrase`)
      if (rot.length > 48) erros.push(`${oe}.rotulo "${rot}": ${rot.length} characters; up to 48`)
    }
    if (e.batidas !== undefined && !(Number.isInteger(e.batidas) && e.batidas >= 2 && e.batidas <= 24)) erros.push(`${oe}.batidas: an integer from 2 to 24`)
    if (e.tipo === 'destaque' && !(Number.isInteger(e.foto) && e.foto >= 0 && e.foto < n)) erros.push(`${oe}.foto: the index of the highlighted photo, 0 to ${n - 1}`)
    if (e.tipo === 'mosaico' && n >= 3) {
      const ordem = e.ordem ?? [...Array(n).keys()]
      const grandes = e.grandes ?? []
      if (!Array.isArray(ordem) || ordem.length !== n || new Set(ordem).size !== n || ordem.some((p) => !(Number.isInteger(p) && p >= 0 && p < n))) {
        erros.push(`${oe}.ordem: all the photos, each one once (indices 0 to ${n - 1})`)
        return
      }
      if (!Array.isArray(grandes) || grandes.some((p) => !(Number.isInteger(p) && p >= 0 && p < n))) { erros.push(`${oe}.grandes: photo indices (0 to ${n - 1})`); return }
      if (e.grade !== undefined && !(Array.isArray(e.grade) && e.grade.length === 2 && e.grade.every((v) => Number.isInteger(v) && v >= 1 && v <= 8))) {
        erros.push(`${oe}.grade: [columns, rows], e.g. [5, 2]`)
        return
      }
      const [c, r] = e.grade ?? gradePadrao(n, grandes.length)
      const casas = n + 3 * grandes.length
      const enc = encaixar(c, r, ordem, grandes)
      if (enc.erro) erros.push(`${oe}: ${enc.erro}; change the "ordem", the "grandes" or the "grade"`)
      else if (e.grade && enc.buracos) erros.push(`${oe}.grade ${c}×${r}: has ${c * r} cells and the photos take ${casas} (each large one counts as 4): leaves ${enc.buracos} hole(s)`)
    }
  })

  const F = P0.fecho
  if (!F || typeof F !== 'object') erros.push('fecho: { "logo": "path/logo.png", "fundo": "#RRGGBB" } (the closing is the logo only, centered and still)')
  else {
    const extra = ['frase', 'bordao', 'texto', 'url', 'endereco', 'data', 'botao', 'rotulo'].filter((k) => F[k] !== undefined)
    if (extra.length) erros.push(`fecho: remove ${extra.map((k) => `"${k}"`).join(', ')}. The closing is the logo only: no tagline, sentence, date or address`)
    existe('fecho.logo', F.logo)
    if (!HEX.test(F.fundo || '')) erros.push('fecho.fundo: the color behind the logo (#RRGGBB; the logo must be the right color for it)')
    if (F.batidas !== undefined && !(Number.isInteger(F.batidas) && F.batidas >= 3 && F.batidas <= 12)) erros.push('fecho.batidas: an integer from 3 to 12 (the logo holds still ~2 s)')
  }
  return erros
}

/** A linha do tempo na grade da trilha, e o encaixe de cada mosaico (deitado e em pé, a grade transposta). */
export function linhaDoTempo(P0) {
  const P = normalizar(P0)
  const b = 60 / P.bpm, n = P.fotos.length
  const mov = MOV[P.ritmo], esc = ESCALA[P.ritmo]
  let t = 0
  const etapas = P.etapas.map((e, k) => {
    const t0 = t
    const ler = palavras(e.rotulo || '').length * 0.25 + 0.8
    const minimo = (k === 0 ? 0.6 : mov + (n - 1) * esc) + ler
    const batidas = Math.max(e.batidas ?? BATIDAS[P.ritmo], Math.ceil(minimo / b - 1e-6))
    t = t0 + batidas * b
    const ex = { k, tipo: e.tipo, t0: r3(t0), t1: r3(t), batidas, rotulo: e.rotulo }
    if (e.tipo === 'destaque') ex.foto = e.foto
    else {
      const ordem = e.ordem ?? [...Array(n).keys()], grandes = e.grandes ?? []
      const [c, r] = e.grade ?? gradePadrao(n, grandes.length)
      ex.deitada = { c, r, pos: encaixar(c, r, ordem, grandes).pos }
      ex.empe = { c: r, r: c, pos: encaixar(r, c, ordem, grandes).pos }
    }
    return ex
  })
  const tF = t
  const tLogo = tF + Math.ceil(0.85 / b - 1e-6) * b
  const batFecho = P0.fecho?.batidas ?? Math.ceil(2.5 / b - 1e-6)
  const duracao = Math.round((tLogo + batFecho * b) * 60) / 60
  // as fotos saem logo antes do logo entrar (o quadro nunca fica vazio entre uma coisa e outra)
  const tSai = Math.max(tF, tLogo - 0.55)
  const fecho = { t0: r3(tF), tSai: r3(tSai), tr: { t0: r3(tSai + 0.2), dur: 0.55 }, tLogo: r3(tLogo), t1: r3(duracao) }
  const secoes = [
    { nome: 'abertura', de: 0, ate: etapas[0].t1, energia: 'media' },
    ...etapas.slice(1).map((e) => ({ nome: `${e.tipo}-${e.k + 1}`, de: e.t0, ate: e.t1, energia: 'media' })),
    { nome: 'para-o-logo', de: r3(tF), ate: r3(tLogo), energia: 'media' },
    { nome: 'fechamento', de: r3(tLogo), ate: r3(duracao), energia: 'media' },
  ]
  const marcos = [
    ...etapas.slice(1).map((e) => ({ t: r3(e.t0 + Math.min(0.35, mov / 2)), evento: `the photos rearrange (${e.tipo})`, som: 'whoosh', efeito: 'whoosh', variante: 'medio', opcional: true })),
    ...etapas.slice(1).map((e) => ({ t: e.t0, evento: `stage ${e.k + 1}: ${e.rotulo}`, som: 'acento', opcional: true })),
    { t: r3(tLogo), evento: 'the closing logo comes in', som: 'acento', opcional: false },
  ].sort((a, c) => a.t - c.t)
  return { b: r3(b), bpm: P.bpm, mov, esc, etapas, fecho, duracao: r3(duracao), secoes, marcos }
}

/** O que a trilha precisa: sheet.json (seções e marcos na grade) e identity.json (BPM preso ao do vídeo). */
export function trilhaDe(P0, linha, nome) {
  const P = normalizar(P0)
  const folha = {
    titulo: `${nome} · photo mosaic`, duracao: linha.duracao, bpm: P.bpm, compasso: 4, taxa: 48000, saida: 'soundtrack.wav',
    loudness_lufs: -14.0, teto_dbtp: -1.5, semente: P.trilha?.semente ?? 7, silencios: [], fade: [r3(linha.duracao - 0.8), linha.duracao],
    secoes: linha.secoes, marcos: linha.marcos,
  }
  const ident = {
    versao: 2, nome: `${nome} · photo mosaic`, papel: 'protagonista', densidade: 'baixa', loudness_lufs: -14.0,
    modos: ['maior', 'mixolidio'], tons: ['C', 'D', 'F', 'G', 'A'],
    instrumentos: { harmonia: ['epiano', 'piano'], baixo: ['bass_note'], percussao: ['kick', 'clap', 'hat', 'shaker'], melodia: ['pluck'], textura: ['pad_note'] },
    ...(P.trilha?.identidade || {}),
    bpm: [P.bpm, P.bpm],   // as etapas caem na batida: o BPM é o do vídeo, sempre
  }
  return { folha, ident }
}

const FONTES_OK = (obra, fam) => { const css = path.join(obra, 'fonts', 'fonts.css'); return fs.existsSync(css) && fs.readFileSync(css, 'utf8').includes(`"${fam}"`) }

/** Monta a obra: index.html, motor, cena, fotos e logo em media/, params.js (PARAMS e LINHA) e video.js. */
export function montar(arqOuParams, obra, { base = null, nome = null, formatos = null, baixarFontes = true } = {}) {
  const deArquivo = typeof arqOuParams === 'string'
  const P0 = deArquivo ? JSON.parse(fs.readFileSync(arqOuParams, 'utf8')) : arqOuParams
  const raiz = base || (deArquivo ? path.dirname(path.resolve(arqOuParams)) : process.cwd())
  const erros = validar(P0, raiz)
  if (erros.length) throw new Falha(`Parameters with problems:\n  - ${erros.join('\n  - ')}`)
  const P = normalizar(P0)
  if (formatos) {
    const ruins = formatos.filter((f) => !OPCOES.formato.includes(f))
    if (ruins.length) throw new Falha(`formato ${ruins.join(', ')} does not exist: use ${lista(OPCOES.formato)}`)
    P.formatos = formatos
  }
  fs.mkdirSync(path.join(obra, 'media'), { recursive: true })
  const usados = new Map()
  const copiar = (arq) => {
    const src = path.resolve(raiz, expandir(arq))
    if (!usados.has(src)) {
      let nomeArq = path.basename(src).replace(/\s+/g, '-')
      while ([...usados.values()].includes(`media/${nomeArq}`)) nomeArq = `x-${nomeArq}`
      fs.copyFileSync(src, path.join(obra, 'media', nomeArq))
      usados.set(src, `media/${nomeArq}`)
    }
    return usados.get(src)
  }
  P.fotos = P.fotos.map((f) => ({ ...f, arquivo: copiar(f.arquivo) }))
  P.fecho = { ...P.fecho, logo: copiar(P.fecho.logo) }
  const linha = linhaDoTempo(P0)
  const VIDEO = {
    titulo: P.titulo || nome || 'Photo mosaic', duracao: linha.duracao, formatos: P.formatos, plataforma: P.plataforma || null,
    fontes: [P.fonte.familia], fundo: P.cores.fundo, grao: P.grao ?? 0, impactos: [], selo: null, audio: 'audio/soundtrack.wav',
    texto: 'fora-da-imagem',   // a checagem reprova texto que cruza foto (a regra: rótulo nunca sobre a foto)
  }
  const origem = deArquivo ? path.basename(arqOuParams) : 'parameters'
  fs.writeFileSync(path.join(obra, 'video.js'), `// generated by assemble.mjs from ${origem}: edit the JSON, not this file\nconst VIDEO = ${JSON.stringify(VIDEO, null, 2)}\n`)
  fs.writeFileSync(path.join(obra, 'params.js'), `// generated by assemble.mjs from ${origem}: edit the JSON, not this file\nconst PARAMS = ${JSON.stringify(P, null, 1)}\nconst LINHA = ${JSON.stringify(linha, null, 1)}\n`)
  for (const f of ['index.html', 'template.js']) fs.copyFileSync(path.join(AQUI, 'scene', f), path.join(obra, f))
  fs.copyFileSync(path.join(SKILL, 'assets', 'template', 'engine.js'), path.join(obra, 'engine.js'))
  let aviso = null
  if (!FONTES_OK(obra, P.fonte.familia)) {
    if (!baixarFontes) aviso = `the font "${P.fonte.familia}" is not in ${path.join(obra, 'fonts')}`
    else {
      const r = spawnSync(process.execPath, [path.join(SKILL, 'scripts', 'fonts.mjs'), obra, P.fonte.familia], { stdio: 'inherit' })
      if (r.status !== 0) throw new Falha(`the font "${P.fonte.familia}" did not download: run scripts/fonts.mjs ${obra} "${P.fonte.familia}" (or, for the examples' Inter, scripts/example-fonts.mjs ${obra})`)
    }
  }
  return { P, linha, VIDEO, aviso }
}

if (process.argv[1] && fs.realpathSync(process.argv[1]) === fs.realpathSync(fileURLToPath(import.meta.url))) {
  const [arq, obra] = process.argv.slice(2)
  if (!arq || !obra) { console.error('usage: node assemble.mjs <parametros.json> <build-folder>'); process.exit(1) }
  try {
    const { linha } = montar(arq, path.resolve(obra))
    console.log(`build ready: ${path.resolve(obra)} · ${linha.duracao} s · ${linha.bpm} BPM`)
    console.log(linha.etapas.map((e) => `${e.tipo} ${e.t0.toFixed(2)}–${e.t1.toFixed(2)}`).join(' · ') + ` · logo ${linha.fecho.tLogo.toFixed(2)}`)
  } catch (e) { console.error(e.message); process.exit(e instanceof Falha ? 2 : 1) }
}
