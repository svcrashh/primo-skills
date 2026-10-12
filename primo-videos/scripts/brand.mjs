#!/usr/bin/env node
// As opções de cada marca: o que muda de uma marca para outra e a skill precisa lembrar entre um vídeo e o próximo. Moram
// em ~/Documents/VideoStudio/Brands/<slug>/brand.json, ao lado do kit, do gabarito e do histórico da variedade
// (VIDEOSTUDIO_BRANDS troca a raiz). O que cada opção faz no vídeo está em references/brand.md, "The brand's options".
//
//   node brand.mjs show <brand> [--json]     as opções da marca (sem arquivo: os padrões)
//   node brand.mjs set <brand> [--name "Nome"] [--opening-logo on|off] [--closing-logo on|off]
//                              [--slogan "…"|none] [--cta "…"|none] [--language <pt-BR|en-US|…>|auto]
//   node brand.mjs list                      as marcas desta máquina que têm opções guardadas
//
// Erro de uso: código 2, dizendo o que fazer.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { raizMarcas, slug } from './kit.mjs'

// O logo da marca abre e fecha o vídeo; slogan e chamada só quando a marca tem e a pessoa pede; língua: a do produto.
export const PADRAO = { openingLogo: true, closingLogo: true, slogan: null, cta: null, language: null }

export class Falha extends Error {}

const arquivoDe = (marca) => path.join(raizMarcas(), slug(marca), 'brand.json')

/** As opções da marca, com os padrões no que não foi guardado. → { name, slug, openingLogo, closingLogo, slogan, cta, language, saved } */
export function lerOpcoes(marca) {
  const s = slug(marca)
  if (!s) throw new Falha('missing the brand: node brand.mjs show "<brand>"')
  const arq = arquivoDe(marca)
  let g = {}
  if (fs.existsSync(arq)) {
    try { g = JSON.parse(fs.readFileSync(arq, 'utf8')) } catch (e) { throw new Falha(`${arq} is not valid JSON (${e.message}): fix it or delete it to go back to the defaults`) }
  }
  const o = { name: g.name || String(marca), slug: s }
  for (const [k, v] of Object.entries(PADRAO)) o[k] = g[k] ?? v
  return { ...o, saved: fs.existsSync(arq) }
}

const ligado = (v, opcao) => {
  if (/^(on|yes|true|1)$/i.test(v)) return true
  if (/^(off|no|false|0)$/i.test(v)) return false
  throw new Falha(`--${opcao} takes on or off; got ${JSON.stringify(v)}`)
}
const texto = (v, vazio) => (new RegExp(`^(${vazio})$`, 'i').test(v.trim()) ? null : v.trim())

/** Guarda as opções que vieram (as outras ficam como estavam). → as opções da marca */
export function gravarOpcoes(marca, mudancas = {}) {
  const atual = lerOpcoes(marca)
  const novo = { version: 1, name: mudancas.name ?? atual.name }
  for (const k of Object.keys(PADRAO)) novo[k] = k in mudancas ? mudancas[k] : atual[k]
  novo.updated = new Date().toISOString().slice(0, 10)
  const arq = arquivoDe(marca)
  fs.mkdirSync(path.dirname(arq), { recursive: true })
  fs.writeFileSync(arq, JSON.stringify(novo, null, 2) + '\n')
  return lerOpcoes(marca)
}

/** As linhas do `show`: uma por opção, dizendo o que ela faz no vídeo. */
export function relatorio(o) {
  const sn = (v) => (v ? 'on' : 'off')
  return [
    `${o.name} (${o.slug})${o.saved ? '' : ': nothing saved yet, these are the defaults'}`,
    `  opening logo: ${sn(o.openingLogo)}${o.openingLogo ? ' (the logo is the first frame, ~1 s, then the content)' : ' (the video starts on the content)'}`,
    `  closing logo: ${sn(o.closingLogo)}${o.closingLogo ? ' (the last scene is the logo, still for 1.5 to 2.5 s)' : ' (the video ends on the last content scene)'}`,
    `  slogan: ${o.slogan ? JSON.stringify(o.slogan) + ' (word for word, next to the closing logo)' : 'none (the closing is the logo alone)'}`,
    `  call to action: ${o.cta ? JSON.stringify(o.cta) : 'none'}`,
    `  language: ${o.language || 'auto (the language of the product\'s screens and site)'}`,
  ].join('\n')
}

function opt(args, k) { const i = args.indexOf('--' + k); return i >= 0 && args[i + 1] != null && !args[i + 1].startsWith('--') ? args[i + 1] : undefined }

function principal(args) {
  const [cmd, marca] = args
  if (cmd === 'list') {
    const raiz = raizMarcas()
    const tem = fs.existsSync(raiz) ? fs.readdirSync(raiz).filter((s) => fs.existsSync(path.join(raiz, s, 'brand.json'))) : []
    console.log(tem.length ? tem.map((s) => { const o = lerOpcoes(s); return `${o.name} (${s})` }).join('\n') : `no brand options saved in ${raiz}`)
    return 0
  }
  if ((cmd !== 'show' && cmd !== 'set') || !marca || marca.startsWith('--')) {
    console.error('usage: node brand.mjs show <brand> [--json]\n       node brand.mjs set <brand> [--name "Name"] [--opening-logo on|off] [--closing-logo on|off] [--slogan "…"|none] [--cta "…"|none] [--language <code>|auto]\n       node brand.mjs list')
    return 2
  }
  let o
  if (cmd === 'set') {
    const m = {}
    const v = (k) => opt(args, k)
    if (v('name') != null) m.name = v('name')
    if (v('opening-logo') != null) m.openingLogo = ligado(v('opening-logo'), 'opening-logo')
    if (v('closing-logo') != null) m.closingLogo = ligado(v('closing-logo'), 'closing-logo')
    if (v('slogan') != null) m.slogan = texto(v('slogan'), 'none|off')
    if (v('cta') != null) m.cta = texto(v('cta'), 'none|off')
    if (v('language') != null) m.language = texto(v('language'), 'auto')
    if (!Object.keys(m).length) throw new Falha('nothing to set: pass at least one of --name, --opening-logo, --closing-logo, --slogan, --cta, --language')
    o = gravarOpcoes(marca, m)
  } else o = lerOpcoes(marca)
  console.log(args.includes('--json') ? JSON.stringify(o, null, 2) : relatorio(o))
  return 0
}

// caminho real dos dois lados: a skill é instalada por link simbólico, e aí o argv[1] não bate com o import.meta.url
if (process.argv[1] && (() => { try { return fs.realpathSync(process.argv[1]) === fs.realpathSync(fileURLToPath(import.meta.url)) } catch { return false } })()) {
  try { process.exit(principal(process.argv.slice(2))) } catch (e) {
    if (!(e instanceof Falha)) throw e
    console.error(e.message); process.exit(2)
  }
}
