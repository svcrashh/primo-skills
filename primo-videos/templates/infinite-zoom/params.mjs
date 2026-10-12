// Molde infinite-zoom: o padrão de cada parâmetro, a conferência (cada erro diz o que fazer) e a linha do tempo.
// Usado pelo render.mjs e pelos testes; a cena (scene.js) só desenha o que sai daqui.
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import crypto from 'node:crypto'

export const FORMATOS = { '16x9': [1920, 1080], '19x9': [2280, 1080], '21x9': [2520, 1080], '9x16': [1080, 1920], '1x1': [1080, 1080] }
export const LEIAUTES = ['left-column', 'right-column', 'bottom-strip', 'faixa-em-cima']
// primeira: quanto a tela geral fica antes do primeiro mergulho (s; a letra da tela inteira é pequena: a primeira mais
// ~60% do mergulho ficam abaixo dos 2,6 s de plano geral que o refino aceita);
// segura: quanto cada nível fica antes de mergulhar no próximo (a câmera nunca para: empurra devagar); zoom: o mergulho
export const RITMOS = {
  calmo: { primeira: 0.9, segura: 1.7, zoom: 2.0 },
  medio: { primeira: 1.0, segura: 1.1, zoom: 1.5 },
  rapido: { primeira: 0.7, segura: 0.7, zoom: 1.0 },
}
// cores neutras: a marca vem do JSON (marca.cores, fecho)
export const PADRAO = {
  formatos: ['16x9'], leiaute: 'left-column', ritmo: 'medio', indice: false, aspectoJanela: 1.6,
  textos: { rotulo: '' },
  marca: {
    fonte: null,
    cores: { fundo: '#F2F2F0', texto: '#161616', pilulaFundo: '#161616', pilulaTexto: '#F2F2F0', janela: '#FFFFFF' },
    corpo: { titulo: 72, rotulo: 30, indice: 30 }, pesos: { titulo: 700, rotulo: 600, indice: 600 },
  },
  fecho: { logo: null, fundo: null, largura: 640, dur: 2.4 },
  captura: { tema: 'claro', dsf: 4, margem: 76 },
}
const HEX = /^#[0-9a-fA-F]{6}$/
const palavras = (s) => String(s).trim().split(/\s+/).filter(Boolean).length
const exp = (p) => (p && p.startsWith('~') ? path.join(os.homedir(), p.slice(1)) : p)
export const caminho = (base, p) => (p ? path.resolve(base, exp(p)) : null)
const umDe = (campo, v, lista) => `${campo} ${JSON.stringify(v)} does not exist: use ${lista.map((x) => `"${x}"`).join(', ')}`

/** Junta o JSON com o padrão e confere. Devolve { erros: [...], cfg }. base = pasta do JSON (caminhos relativos). */
export function conferir(P, base = process.cwd(), { arquivos = true } = {}) {
  const erros = []
  if (!P || typeof P !== 'object') return { erros: ['the parameters file must be a JSON object (copy an example*.json from this template)'], cfg: null }
  const cfg = {
    ...PADRAO, ...P,
    textos: { ...PADRAO.textos, ...(P.textos || {}) },
    marca: { ...PADRAO.marca, ...(P.marca || {}), cores: { ...PADRAO.marca.cores, ...(P.marca?.cores || {}) }, corpo: { ...PADRAO.marca.corpo, ...(P.marca?.corpo || {}) }, pesos: { ...PADRAO.marca.pesos, ...(P.marca?.pesos || {}) } },
    fecho: { ...PADRAO.fecho, ...(P.fecho || {}) },
    captura: { ...PADRAO.captura, ...(P.captura || {}) },
  }
  cfg.nome = P.nome || 'infinite-zoom'
  if (!/^[\w.-]+$/.test(cfg.nome)) erros.push(`nome ${JSON.stringify(cfg.nome)}: only letters, numbers, dot, - and _ (it becomes the file names)`)
  if (!Array.isArray(cfg.formatos) || !cfg.formatos.length) erros.push(`formatos is a list, e.g. ["16x9", "9x16"] (accepted: ${Object.keys(FORMATOS).join(', ')})`)
  else for (const f of cfg.formatos) if (!FORMATOS[f]) erros.push(`formato ${JSON.stringify(f)} does not exist: use ${Object.keys(FORMATOS).join(', ')}`)
  if (!LEIAUTES.includes(cfg.leiaute)) erros.push(umDe('leiaute', cfg.leiaute, LEIAUTES))
  if (!RITMOS[cfg.ritmo]) erros.push(umDe('ritmo', cfg.ritmo, Object.keys(RITMOS)))
  if (!(cfg.aspectoJanela >= 1 && cfg.aspectoJanela <= 2.4)) erros.push(`aspectoJanela ${cfg.aspectoJanela}: between 1 and 2.4 (width ÷ height of the window in the band layouts)`)
  for (const [k, v] of Object.entries(cfg.marca.cores)) if (v != null && !HEX.test(v)) erros.push(`marca.cores.${k} ${JSON.stringify(v)} is not a #RRGGBB color`)
  if (cfg.fecho.fundo != null && !HEX.test(cfg.fecho.fundo)) erros.push(`fecho.fundo ${JSON.stringify(cfg.fecho.fundo)} is not a #RRGGBB color`)
  for (const [k, v] of Object.entries(cfg.marca.corpo)) if (!(v >= 28 && v <= 200)) erros.push(`marca.corpo.${k} ${v}: between 28 and 200 px (below 28 the video cannot be read)`)
  if (cfg.textos.rotulo && palavras(cfg.textos.rotulo) > 7) erros.push(`textos.rotulo has ${palavras(cfg.textos.rotulo)} words: at most 7`)
  const c = cfg.captura
  if (!c.pagina && !c.url) erros.push('captura.pagina (a local HTML, relative to this JSON) or captura.url: the screen the levels come from')
  if (!['claro', 'escuro'].includes(c.tema)) erros.push(umDe('captura.tema', c.tema, ['claro', 'escuro']))
  if (!(c.dsf >= 1 && c.dsf <= 5)) erros.push(`captura.dsf ${c.dsf}: 1 to 5 (pixels per CSS px; 4 gives a deep zoom without going soft)`)
  const N = cfg.niveis
  if (!Array.isArray(N) || N.length < 2 || N.length > 5) erros.push('niveis is a list of 2 to 5 screens (3 or 4 is best), from the overview to the detail: [{ "texto": "…", "tela": { "largura": 1136, "altura": 896 }, "entrar": "#detail-selector" }, …]')
  else N.forEach((n, i) => {
    const q = `niveis[${i}]`
    if (!n || typeof n !== 'object') return erros.push(`${q}: an object { texto, tela, entrar }`)
    if (!n.texto) erros.push(`${q}.texto: the sentence that goes with this screen (up to 7 words per line)`)
    else if (palavras(n.texto) > 10) erros.push(`${q}.texto has ${palavras(n.texto)} words: at most 10 (two lines of up to 7)`)
    if (cfg.indice && (!n.nome || palavras(n.nome) > 3)) erros.push(`${q}.nome: with "indice": true, each level has a name of up to 3 words (the index pill)`)
    if (!n.tela || !(n.tela.largura >= 240 && n.tela.largura <= 2560) || !(n.tela.altura >= 180 && n.tela.altura <= 1600)) erros.push(`${q}.tela: { "largura": px, "altura": px } of the browser window in this capture (width 240–2560, height 180–1600; the proportion of the video window avoids cropping)`)
    if (!n.entrar || typeof n.entrar !== 'string') erros.push(`${q}.entrar: the selector of the detail the camera dives into${i === N.length - 1 ? ' (on the last level, it becomes the closing)' : ' (it becomes the next screen)'}`)
  })
  if (arquivos) {
    if (!cfg.fecho.logo) erros.push('fecho.logo: the logo PNG (the closing is only the logo, centered and still)')
    else if (!fs.existsSync(caminho(base, cfg.fecho.logo))) erros.push(`fecho.logo: could not find ${caminho(base, cfg.fecho.logo)}`)
    if (c.pagina && !/^[a-z]+:/i.test(c.pagina) && !fs.existsSync(caminho(base, c.pagina.split('#')[0]))) erros.push(`captura.pagina: could not find ${caminho(base, c.pagina.split('#')[0])}`)
  }
  return { erros, cfg }
}

/** A assinatura do que a captura depende: muda o JSON da captura ou dos níveis, a captura é refeita. */
export function assinaturaCaptura(cfg) {
  const s = JSON.stringify({ captura: cfg.captura, niveis: (cfg.niveis || []).map((n) => ({ tela: n.tela, entrar: n.entrar })) })
  return crypto.createHash('sha1').update(s).digest('hex').slice(0, 12)
}

const r3 = (x) => +x.toFixed(3)

/** A linha do tempo: quando cada nível chega, quando a câmera mergulha e quando o fecho assenta. */
export function linhaDoTempo(cfg, niveis) {
  const R = RITMOS[cfg.ritmo] || RITMOS.medio, n = niveis.length
  const chega = [0], parte = [R.primeira]
  for (let k = 1; k < n; k++) { chega.push(parte[k - 1] + R.zoom); parte.push(chega[k] + R.segura) }
  const fechoChega = parte[n - 1] + R.zoom * 1.05
  const dur = r3(fechoChega + cfg.fecho.dur)
  return { zoom: R.zoom, chega: chega.map(r3), parte: parte.map(r3), fechoChega: r3(fechoChega), dur,
    niveis: niveis.map((nv, k) => ({ ...nv, texto: cfg.niveis[k].texto, nome: cfg.niveis[k].nome || '' })) }
}

/** A folha da trilha (seções e marcos) e a identidade, no esquema do assets/audio/arrange_series.py. */
export function folhaDaTrilha(cfg, LN) {
  const n = LN.niveis.length
  const secoes = LN.niveis.map((_, k) => ({ nome: k === 0 ? 'abertura' : `nivel-${k + 1}`, de: k === 0 ? 0 : r3(LN.parte[k - 1] + LN.zoom * 0.5), ate: r3(LN.parte[k] + LN.zoom * 0.5), energia: 'media' }))
  secoes.push({ nome: 'fechamento', de: r3(LN.parte[n - 1] + LN.zoom * 0.5), ate: LN.dur, energia: 'media' })
  const marcos = [
    ...LN.parte.map((t, k) => ({ t: r3(t + LN.zoom * 0.55), evento: k < n - 1 ? `dives into level ${k + 2}` : 'dives into the closing', som: 'whoosh', efeito: 'whoosh', dur: r3(Math.min(0.9, LN.zoom * 0.6)), opcional: true })),
    { t: LN.fechoChega, evento: 'the closing logo settles', som: 'acento', opcional: false },
  ]
  const folha = { titulo: `${cfg.nome} · infinite zoom`, duracao: LN.dur, bpm: 120, compasso: 4, taxa: 48000, saida: 'soundtrack.wav', loudness_lufs: -14.0, teto_dbtp: -1.5,
    semente: cfg.trilha?.semente ?? 7, silencios: [], fade: [r3(LN.dur - 0.8), LN.dur], secoes, marcos }
  const ident = { versao: 2, nome: `${cfg.nome} · infinite zoom`, papel: 'protagonista', densidade: 'baixa', loudness_lufs: -14.0, bpm: [100, 112],
    modos: ['maior', 'mixolidio', 'dorico'], tons: ['C', 'D', 'F', 'G', 'A'],
    instrumentos: { harmonia: ['epiano', 'piano'], baixo: ['bass_note'], percussao: ['kick', 'clap', 'hat', 'shaker'], melodia: ['pluck'], textura: ['pad_note'] },
    ...(cfg.trilha?.identidade || {}) }
  return { folha, ident }
}
