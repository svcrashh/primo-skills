#!/usr/bin/env node
// Molde kinetic-typography: confere os parâmetros, calcula a linha do tempo na grade da trilha e monta a obra (a cena
// pronta para o navegador), sem renderizar. O render.mjs chama isto; os testes também.
//   node assemble.mjs <parametros.json> <folder-da-obra>        (monta e diz os tempos; para olhar com frames.cjs)
// Nada de marca aqui: cores, fonte, formas, logo e textos vêm do JSON. O que cada campo faz: TEMPLATE.md.
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const AQUI = path.dirname(fileURLToPath(import.meta.url))
const SKILL = path.resolve(AQUI, '..', '..')

export const OPCOES = {
  ritmo: ['calmo', 'medio', 'rapido'],
  transicao: ['cut-on-beat', 'push', 'mascara', 'whip'],
  leiaute: ['full-screen', 'left-column', 'right-column'],
  camera: ['estatica', 'guided-zoom'],
  entra: ['sobe', 'gira', 'escala', 'desliza'],
  reorganiza: ['linha'],
  forma: ['circulo', 'pilula', 'losango', 'imagem'],
  formato: ['16x9', '19x9', '21x9', '9x16', '1x1', '4x5'],
}
export const PADRAO = {
  bpm: 120, ritmo: 'medio', transicao: 'cut-on-beat', leiaute: 'full-screen', camera: 'estatica', pulso: 0.03,
  formatos: ['16x9'], fonte: { familia: 'Inter', peso: 700, pesoDestaque: 700, minimo: 64 },
}
const PASSO = { calmo: 2, medio: 1, rapido: 0.5 }   // batidas entre a entrada de uma linha e a da próxima
const ESPERA = { calmo: 3, medio: 2, rapido: 2 }    // batidas com a frase inteira na tela, para ler
const MAX_PALAVRAS = 7
const MAX_LINHAS = 5
const MAX_FRASES = 8
const DUR_TR = { 'cut-on-beat': 0, push: 0.55, mascara: 0.6, whip: 0.45 }
const HEX = /^#[0-9a-fA-F]{6}$/

export class Falha extends Error {}

const expandir = (p) => (typeof p === 'string' && p.startsWith('~') ? path.join(os.homedir(), p.slice(1)) : p)
const lista = (v) => v.join(' | ')
const palavras = (s) => String(s).replace(/\*/g, '').trim().split(/\s+/).filter((w) => w && !/^[·•|\-–—]$/.test(w))
const semAsterisco = (s) => String(s).replace(/\*/g, '')
/** "18 *cores*" → [{ t: '18 ' }, { t: 'cores', destaque: true }] */
export function partes(s) {
  return String(s).split(/(\*[^*]+\*)/).filter(Boolean).map((x) => (x.startsWith('*') && x.endsWith('*') ? { t: x.slice(1, -1), destaque: true } : { t: x }))
}

/** Os parâmetros com os padrões preenchidos; cada linha vira { t, partes, peso, entra?, pilula? }. Não confere nada. */
export function normalizar(P0) {
  const P = JSON.parse(JSON.stringify(P0 || {}))
  for (const k of ['bpm', 'ritmo', 'transicao', 'leiaute', 'camera', 'pulso', 'formatos']) P[k] ??= PADRAO[k]
  P.fonte = { ...PADRAO.fonte, ...(P.fonte || {}) }
  P.cores = P.cores || {}
  P.frases = (P.frases || []).map((f) => {
    const fr = { ...f, cores: { ...P.cores, ...(f.cores || {}) } }
    fr.linhas = (f.linhas || []).map((l) => {
      const o = typeof l === 'string' ? { t: l } : { ...l }
      o.partes = partes(o.t ?? '')
      o.peso ??= P.fonte.peso
      return o
    })
    fr.formas = f.formas ?? P.formas ?? []
    return fr
  })
  return P
}

/** Os erros dos parâmetros (lista vazia = ok). base = a pasta do JSON (os caminhos de arquivo são relativos a ela). */
export function validar(P0, base = process.cwd()) {
  const erros = []
  if (!P0 || typeof P0 !== 'object' || Array.isArray(P0)) return ['the parameters must be a JSON object (see example-left-column.json)']
  const P = normalizar(P0)
  const opcao = (campo, v, valores) => { if (!valores.includes(v)) erros.push(`${campo} ${JSON.stringify(v)} does not exist: use ${lista(valores)}`) }
  opcao('ritmo', P.ritmo, OPCOES.ritmo)
  opcao('transicao', P.transicao, OPCOES.transicao)
  opcao('leiaute', P.leiaute, OPCOES.leiaute)
  opcao('camera', P.camera, OPCOES.camera)
  if (!(typeof P.bpm === 'number' && P.bpm >= 60 && P.bpm <= 180)) erros.push(`bpm ${JSON.stringify(P.bpm)}: a number from 60 to 180 (the grid of the words and the soundtrack; e.g. 120)`)
  if (!Array.isArray(P.formatos) || !P.formatos.length) erros.push(`formatos: a list, e.g. ["16x9"] (use ${lista(OPCOES.formato)})`)
  else for (const f of P.formatos) opcao('formato', f, OPCOES.formato)
  if (typeof P.fonte.familia !== 'string' || !P.fonte.familia.trim()) erros.push('fonte.familia: the family name (e.g. "Inter")')
  if (P0.entradas !== undefined) {
    if (!Array.isArray(P0.entradas) || !P0.entradas.length) erros.push(`entradas: a list, e.g. ["sobe", "gira"] (use ${lista(OPCOES.entra)})`)
    else P0.entradas.forEach((x, k) => opcao(`entradas[${k}]`, x, OPCOES.entra))
  }
  if (!(typeof P.pulso === 'number' && P.pulso >= 0 && P.pulso <= 0.1)) erros.push(`pulso ${JSON.stringify(P.pulso)}: 0 to 0.1 (how much the lines grow on the beat; 0 turns it off)`)
  const existe = (campo, arq) => {
    if (typeof arq !== 'string' || !arq) { erros.push(`${campo}: the file path (relative to the JSON)`); return }
    const abs = path.resolve(base, expandir(arq))
    if (!fs.existsSync(abs)) erros.push(`${campo}: could not find ${abs}`)
  }
  const pares = Array.isArray(P0.pares) ? P0.pares : null
  const nota = (fundo, texto) => {
    if (!pares) return 'livre'
    const p = pares.find((x) => String(x[0]).toUpperCase() === String(fundo).toUpperCase() && String(x[1]).toUpperCase() === String(texto).toUpperCase())
    return p ? p[2] || 'AAA' : null
  }
  const conferirPar = (onde, fundo, texto, peso) => {
    if (!HEX.test(fundo || '') || !HEX.test(texto || '')) return
    const n = nota(fundo, texto)
    if (n === null) erros.push(`${onde}: the text ${texto} on the background ${fundo} is not an approved pair ("pares"); change one of the two colors`)
    else if (n === 'AA18' && peso < 700) erros.push(`${onde}: ${texto} on ${fundo} is AA18 (large bold titles only): use "peso": 700`)
  }

  if (!Array.isArray(P0.frases) || !P0.frases.length || P0.frases.length > MAX_FRASES) {
    erros.push(`frases: 1 to ${MAX_FRASES}, each with 1 to ${MAX_LINHAS} lines (e.g. [{ "linhas": ["4 features"] }])`)
  }
  P.frases.forEach((f, i) => {
    const onde = `frases[${i}]`
    if (!f.linhas.length || f.linhas.length > MAX_LINHAS) erros.push(`${onde}.linhas: 1 to ${MAX_LINHAS} short lines (e.g. ["Website", "and mobile app"])`)
    for (const k of ['fundo', 'texto']) if (!HEX.test(f.cores[k] || '')) erros.push(`${onde}: missing the color "${k}" (#RRGGBB), in "cores" or in the phrase itself`)
    if (f.cores.destaque && !HEX.test(f.cores.destaque)) erros.push(`${onde}: cores.destaque ${JSON.stringify(f.cores.destaque)} is not #RRGGBB`)
    if (f.ritmo !== undefined) opcao(`${onde}.ritmo`, f.ritmo, OPCOES.ritmo)
    if (f.reorganiza !== undefined) opcao(`${onde}.reorganiza`, f.reorganiza, OPCOES.reorganiza)
    if (f.batidas !== undefined && !(Number.isInteger(f.batidas) && f.batidas >= 2 && f.batidas <= 32)) erros.push(`${onde}.batidas: an integer from 2 to 32 (how long the phrase lasts, in beats)`)
    f.linhas.forEach((l, j) => {
      const ol = `${onde}.linhas[${j}]`
      const txt = semAsterisco(l.t ?? '').trim()
      if (!txt) { erros.push(`${ol}: empty text`); return }
      const n = palavras(l.t).length
      if (n > MAX_PALAVRAS) erros.push(`${ol} "${txt}": up to ${MAX_PALAVRAS} words per line (has ${n}); split it into two lines or two phrases`)
      if (/!/.test(txt)) erros.push(`${ol} "${txt}": no exclamation mark. The text is informative (name, number, fact), never a catchphrase`)
      if (txt.length > 28) erros.push(`${ol} "${txt}": ${txt.length} characters do not fit large; up to 28 per line`)
      if (![400, 500, 600, 700].includes(l.peso)) erros.push(`${ol}.peso ${JSON.stringify(l.peso)}: use 400, 500, 600 or 700`)
      if (l.entra !== undefined) opcao(`${ol}.entra`, l.entra, OPCOES.entra)
      if (l.pilula) {
        const pl = f.cores.pilula
        if (!pl || !HEX.test(pl.fundo || '') || !HEX.test(pl.texto || '')) erros.push(`${ol}: "pilula": true needs cores.pilula = { "fundo": "#…", "texto": "#…" }`)
        else conferirPar(`${ol} (pill)`, pl.fundo, pl.texto, l.peso)
      } else {
        if (l.partes.some((p) => !p.destaque)) conferirPar(ol, f.cores.fundo, f.cores.texto, l.peso)
        if (l.partes.some((p) => p.destaque)) conferirPar(`${ol} (*highlight*)`, f.cores.fundo, f.cores.destaque || f.cores.texto, P.fonte.pesoDestaque)
      }
    })
    if (f.reorganiza === 'linha') {
      const n = f.linhas.reduce((s, l) => s + palavras(l.t).length, 0)
      if (n > MAX_PALAVRAS) erros.push(`${onde}.reorganiza "linha": the lines join into a single line, with ${n} words (up to ${MAX_PALAVRAS})`)
      if (f.linhas.length < 2) erros.push(`${onde}.reorganiza "linha": needs 2 lines or more`)
    }
    if (!Array.isArray(f.formas)) erros.push(`${onde}.formas: a list (it can be empty)`)
    else f.formas.forEach((s, k) => {
      const of = `${onde}.formas[${k}]`
      opcao(`${of}.tipo`, s.tipo, OPCOES.forma)
      if (s.tipo === 'imagem') existe(`${of}.arquivo`, s.arquivo)
      else if (OPCOES.forma.includes(s.tipo) && !HEX.test(s.cor || '')) erros.push(`${of}.cor: #RRGGBB`)
      if (s.tamanho !== undefined && !(s.tamanho > 0 && s.tamanho <= 2)) erros.push(`${of}.tamanho: 0 to 2 (fraction of the frame height)`)
    })
  })

  const F = P0.fecho
  if (!F || typeof F !== 'object') erros.push('fecho: { "logo": "path/logo.png", "fundo": "#RRGGBB" } (the closing is the logo only, centered and still)')
  else {
    const extra = ['frase', 'bordao', 'texto', 'url', 'endereco', 'data', 'botao', 'linhas'].filter((k) => F[k] !== undefined)
    if (extra.length) erros.push(`fecho: remove ${extra.map((k) => `"${k}"`).join(', ')}. The closing is the logo only: no tagline, sentence, date or address`)
    existe('fecho.logo', F.logo)
    if (!HEX.test(F.fundo || '')) erros.push('fecho.fundo: the color behind the logo (#RRGGBB; the logo must be the right color for it)')
    if (F.batidas !== undefined && !(Number.isInteger(F.batidas) && F.batidas >= 3 && F.batidas <= 12)) erros.push('fecho.batidas: an integer from 3 to 12 (the logo holds still ~2 s)')
  }
  return erros
}

const r3 = (x) => Math.round(x * 1000) / 1000

/** A linha do tempo, na grade da trilha (toda frase, transição e o logo começam numa batida). */
export function linhaDoTempo(P0) {
  const P = normalizar(P0)
  const b = 60 / P.bpm
  const trDur = Math.min(DUR_TR[P.transicao] ?? 0, b * 1.25)
  let t = 0
  const frases = P.frases.map((f, i) => {
    const ritmo = f.ritmo || P.ritmo
    const passo = PASSO[ritmo] * b
    const t0 = t
    const atraso = i === 0 ? 0 : trDur > 0 ? b / 2 : 0                // a 1ª palavra chega com a cor nova abrindo
    const ini = i === 0 ? -0.18 : t0 + atraso                          // no quadro 0 a 1ª linha já está entrando
    const entradas = f.linhas.map((_, k) => r3(ini + k * passo))
    const entraDur = Math.min(0.55, Math.max(0.26, passo * 1.1))
    const prontas = entradas[entradas.length - 1] + entraDur
    let tReorg = null, fimMov = prontas
    if (f.reorganiza) { tReorg = t0 + Math.ceil((prontas - t0) / b + 1) * b; fimMov = tReorg + 0.6 }
    const nPal = f.linhas.reduce((s, l) => s + palavras(l.t).length, 0)
    const ler = Math.max(ESPERA[ritmo] * b, nPal * 0.2)
    let batidas = Math.ceil((fimMov + ler - t0) / b - 1e-6)
    if (f.batidas) batidas = Math.max(batidas, f.batidas)
    const tSai = t0 + batidas * b
    t = tSai
    return { i, t0: r3(t0), tSai: r3(tSai), passo: r3(passo), entraDur: r3(entraDur), entradas, tReorg: tReorg == null ? null : r3(tReorg), batidas,
      entrada: i === 0 ? null : { tipo: P.transicao, t0: r3(t0), dur: r3(trDur) } }
  })
  frases.forEach((f, i) => { f.t1 = r3(f.tSai + trDur); f.saida = { tipo: P.transicao, t0: f.tSai, dur: r3(trDur) } })
  const tF = t
  const tLogo = tF + (trDur > 0 ? b : 0)
  const batFecho = P0.fecho?.batidas ?? Math.ceil(2.5 / b)
  const duracao = Math.round((tLogo + batFecho * b) * 60) / 60
  const fecho = { t0: r3(tF), tLogo: r3(tLogo), t1: r3(duracao), entrada: { tipo: P.transicao, t0: r3(tF), dur: r3(trDur) } }
  const secoes = [
    { nome: 'abertura', de: 0, ate: frases[0].tSai, energia: 'media' },
    ...frases.slice(1).map((f) => ({ nome: `frase-${f.i + 1}`, de: f.t0, ate: f.tSai, energia: 'media' })),
    ...(tLogo > tF ? [{ nome: 'para-o-logo', de: r3(tF), ate: r3(tLogo), energia: 'media' }] : []),
    { nome: 'fechamento', de: r3(tLogo), ate: r3(duracao), energia: 'media' },
  ]
  const marcos = [
    ...frases.slice(1).map((f) => ({ t: f.t0, evento: `phrase ${f.i + 1} comes in`, som: 'acento', opcional: true })),
    ...(trDur > 0 ? [...frases.slice(1).map((f) => f.t0), r3(tF)].map((x) => ({ t: r3(x + trDur / 2), evento: `transition ${P.transicao}`, som: 'whoosh', efeito: 'whoosh', variante: 'curto', opcional: true })) : []),
    { t: r3(tLogo), evento: 'the closing logo comes in', som: 'acento', opcional: false },
  ].sort((a, c) => a.t - c.t)
  return { b: r3(b), bpm: P.bpm, frases, fecho, duracao: r3(duracao), secoes, marcos }
}

/** O que a trilha precisa: sheet.json (seções e marcos na grade) e identity.json (BPM preso ao do vídeo). */
export function trilhaDe(P0, linha, nome) {
  const P = normalizar(P0)
  const folha = {
    titulo: `${nome} · kinetic typography`, duracao: linha.duracao, bpm: P.bpm, compasso: 4, taxa: 48000, saida: 'soundtrack.wav',
    loudness_lufs: -14.0, teto_dbtp: -1.5, semente: P.trilha?.semente ?? 7, silencios: [], fade: [r3(linha.duracao - 0.8), linha.duracao],
    secoes: linha.secoes, marcos: linha.marcos,
  }
  const ident = {
    versao: 2, nome: `${nome} · kinetic typography`, papel: 'protagonista', densidade: 'media', loudness_lufs: -14.0,
    modos: ['maior', 'mixolidio'], tons: ['C', 'D', 'F', 'G', 'A'],
    instrumentos: { harmonia: ['epiano', 'piano'], baixo: ['bass_note'], percussao: ['kick', 'clap', 'hat', 'shaker'], melodia: ['pluck'], textura: ['pad_note'] },
    ...(P.trilha?.identidade || {}),
    bpm: [P.bpm, P.bpm],   // a grade das palavras é a da música: o BPM é o do vídeo, sempre
  }
  return { folha, ident }
}

const FONTES_OK = (obra, fam) => { const css = path.join(obra, 'fonts', 'fonts.css'); return fs.existsSync(css) && fs.readFileSync(css, 'utf8').includes(`"${fam}"`) }

/** Monta a obra: index.html, motor, cena, mídia, params.js (PARAMS e LINHA) e video.js. Recusa parâmetro errado (Falha). */
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
      let n = path.basename(src)
      while ([...usados.values()].includes(`media/${n}`)) n = `x-${n}`
      fs.copyFileSync(src, path.join(obra, 'media', n))
      usados.set(src, `media/${n}`)
    }
    return usados.get(src)
  }
  P.fecho = { ...P.fecho, logo: copiar(P.fecho.logo) }
  for (const f of P.frases) f.formas = f.formas.map((s) => (s.tipo === 'imagem' ? { ...s, arquivo: copiar(s.arquivo) } : s))
  delete P.formas
  const linha = linhaDoTempo(P0)
  const titulo = P.titulo || nome || 'Kinetic typography'
  const VIDEO = {
    titulo, duracao: linha.duracao, formatos: P.formatos, plataforma: P.plataforma || null, fontes: [P.fonte.familia],
    fundo: P.frases[0].cores.fundo, grao: P.grao ?? 0, impactos: [], selo: null, audio: 'audio/soundtrack.wav', texto: 'fora-da-imagem',
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
      if (r.status !== 0) throw new Falha(`the font "${P.fonte.familia}" did not download: run scripts/fonts.mjs ${obra} "${P.fonte.familia}" (or, for the format examples, scripts/example-fonts.mjs ${obra})`)
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
    console.log(linha.frases.map((f) => `phrase ${f.i + 1} ${f.t0.toFixed(2)}–${f.tSai.toFixed(2)}`).join(' · ') + ` · logo ${linha.fecho.tLogo.toFixed(2)}`)
  } catch (e) { console.error(e.message); process.exit(e instanceof Falha ? 2 : 1) }
}
