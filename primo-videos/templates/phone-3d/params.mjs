// Molde phone-3d: o padrão de cada parâmetro, a conferência (cada erro diz o que fazer) e a linha do tempo.
// Usado pelo render.mjs e pelos testes; a cena (scene.js) só desenha o que sai daqui.
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import crypto from 'node:crypto'

export const FORMATOS = { '16x9': [1920, 1080], '19x9': [2280, 1080], '21x9': [2520, 1080], '9x16': [1080, 1920], '1x1': [1080, 1080] }
export const CAMERAS = ['orbita', 'dolly']
export const LEIAUTES = ['right-column', 'left-column', 'dividido']
export const TRANSICOES = ['mascara', 'push', 'corte']
export const FUNDOS = ['liso', 'simbolo']
// abertura: o celular inteiro antes de a câmera chegar perto (s); vel: velocidade da gravação; recuo: a câmera volta ao
// celular inteiro (s); orbita: o celular inteiro girando antes do fecho (s); troca: a transição para o fecho (s)
export const RITMOS = {
  calmo: { abertura: 1.8, vel: 0.9, recuo: 1.0, orbita: 1.3, troca: 0.8 },
  medio: { abertura: 1.4, vel: 1.0, recuo: 0.9, orbita: 1.0, troca: 0.7 },
  rapido: { abertura: 1.0, vel: 1.2, recuo: 0.7, orbita: 0.7, troca: 0.5 },
}
const ACOES = ['passo', 'rola', 'toque', 'pausa', 'sucesso']
// cores neutras: a marca vem do JSON (marca.cores, aparelho, fecho)
export const PADRAO = {
  formatos: ['16x9'], camera: 'orbita', leiaute: 'right-column', transicao: 'mascara', ritmo: 'medio', zoomLeitura: 2.0,
  textos: { rotulo: '', titulo: '', passos: {} },
  fundo: { tipo: 'liso' },
  marca: {
    fonte: null,
    cores: { fundo: '#F2F2F0', painel: null, texto: '#161616', rotuloFundo: '#161616', rotuloTexto: '#F2F2F0', toque: '#161616' },
    corpo: { titulo: 84, texto: 64, rotulo: 30 }, pesos: { titulo: 700, texto: 700, rotulo: 600 },
  },
  aparelho: { corpo: '#1C1C1E', borda: '#4A4A50', vidro: '#000000' },
  fecho: { logo: null, fundo: null, largura: 640, dur: 2.4 },
  captura: { tema: 'claro', aparelho: 'phone', inicio: null, leituraMin: 3.0 },
}
const HEX = /^#[0-9a-fA-F]{6}$/
const palavras = (s) => String(s).trim().split(/\s+/).filter(Boolean).length
const exp = (p) => (p && p.startsWith('~') ? path.join(os.homedir(), p.slice(1)) : p)
/** Caminho de arquivo do JSON, relativo à pasta do JSON (aceita ~). */
export const caminho = (base, p) => (p ? path.resolve(base, exp(p)) : null)
const umDe = (campo, v, lista) => (lista.includes(v) ? null : `${campo} ${JSON.stringify(v)} does not exist: use ${lista.map((x) => `"${x}"`).join(', ')}`)

/** Junta o JSON com o padrão e confere. Devolve { erros: [...], cfg }. base = pasta do JSON (caminhos relativos). */
export function conferir(P, base = process.cwd(), { arquivos = true } = {}) {
  const erros = []
  if (!P || typeof P !== 'object') return { erros: ['the parameters file is a JSON object (copy an example*.json from this template)'], cfg: null }
  const cfg = {
    ...PADRAO, ...P,
    textos: { ...PADRAO.textos, ...(P.textos || {}) },
    fundo: { ...PADRAO.fundo, ...(P.fundo || {}) },
    marca: { ...PADRAO.marca, ...(P.marca || {}), cores: { ...PADRAO.marca.cores, ...(P.marca?.cores || {}) }, corpo: { ...PADRAO.marca.corpo, ...(P.marca?.corpo || {}) }, pesos: { ...PADRAO.marca.pesos, ...(P.marca?.pesos || {}) } },
    aparelho: { ...PADRAO.aparelho, ...(P.aparelho || {}) },
    fecho: { ...PADRAO.fecho, ...(P.fecho || {}) },
    captura: { ...PADRAO.captura, ...(P.captura || {}) },
  }
  cfg.nome = P.nome || 'phone-3d'
  if (!/^[\w.-]+$/.test(cfg.nome)) erros.push(`nome ${JSON.stringify(cfg.nome)}: only letters, numbers, dot, - and _ (it becomes the file names)`)
  if (!Array.isArray(cfg.formatos) || !cfg.formatos.length) erros.push(`formatos is a list, e.g. ["16x9", "9x16"] (accepted: ${Object.keys(FORMATOS).join(', ')})`)
  else for (const f of cfg.formatos) if (!FORMATOS[f]) erros.push(`format ${JSON.stringify(f)} does not exist: use ${Object.keys(FORMATOS).join(', ')}`)
  for (const [campo, lista] of [['camera', CAMERAS], ['leiaute', LEIAUTES], ['transicao', TRANSICOES]]) { const e = umDe(campo, cfg[campo], lista); if (e) erros.push(e) }
  if (!RITMOS[cfg.ritmo]) erros.push(umDe('ritmo', cfg.ritmo, Object.keys(RITMOS)))
  if (!(cfg.zoomLeitura >= 1.2 && cfg.zoomLeitura <= 3)) erros.push(`zoomLeitura ${cfg.zoomLeitura}: between 1.2 and 3 (how close the camera gets to the screen; 2 turns the app's 16 px letters into 32 px in the video)`)
  for (const [k, v] of Object.entries(cfg.marca.cores)) if (v != null && !HEX.test(v)) erros.push(`marca.cores.${k} ${JSON.stringify(v)} is not a #RRGGBB color`)
  for (const [k, v] of Object.entries(cfg.aparelho)) if (!HEX.test(v)) erros.push(`aparelho.${k} ${JSON.stringify(v)} is not a #RRGGBB color`)
  if (cfg.fecho.fundo != null && !HEX.test(cfg.fecho.fundo)) erros.push(`fecho.fundo ${JSON.stringify(cfg.fecho.fundo)} is not a #RRGGBB color`)
  for (const [k, v] of Object.entries(cfg.marca.corpo)) if (!(v >= 28 && v <= 200)) erros.push(`marca.corpo.${k} ${v}: between 28 and 200 px (below 28 the video can't be read)`)
  const e = umDe('fundo.tipo', cfg.fundo.tipo, FUNDOS); if (e) erros.push(e)
  // textos: até 7 palavras por linha, sem frase longa (a tela é lida num relance)
  const textos = [['textos.titulo', cfg.textos.titulo], ['textos.rotulo', cfg.textos.rotulo], ...Object.entries(cfg.textos.passos || {}).map(([n, f]) => [`textos.passos.${n}`, f])]
  for (const [campo, s] of textos) if (s && palavras(s) > 10) erros.push(`${campo} has ${palavras(s)} words: at most 10 (two lines of up to 7), the screen is read at a glance`)
  // captura: de onde vem a tela e a jornada
  const c = cfg.captura
  if (!c.pagina && !c.url) erros.push('captura.pagina (a local HTML, relative to this JSON) or captura.url: the screen the phone shows')
  if (!['claro', 'escuro'].includes(c.tema)) erros.push(umDe('captura.tema', c.tema, ['claro', 'escuro']))
  if (!Array.isArray(c.jornada) || !c.jornada.some((s) => s && s.passo)) erros.push('captura.jornada is a list of actions and needs at least one { "passo": "step sentence" } (e.g. [{ "passo": "Scroll to the plans" }, { "rola": "#plans" }, { "toque": ".menu" }])')
  else c.jornada.forEach((s, i) => {
    const k = s && Object.keys(s).find((x) => ACOES.includes(x))
    if (!k) erros.push(`captura.jornada[${i}] ${JSON.stringify(s)}: each item is one of ${ACOES.map((a) => `{ "${a}": … }`).join(', ')}`)
    else if (k === 'passo' && palavras(s.passo) > 10) erros.push(`captura.jornada[${i}].passo has ${palavras(s.passo)} words: at most 10`)
    else if (k === 'pausa' && !(s.pausa > 0 && s.pausa <= 5000)) erros.push(`captura.jornada[${i}].pausa ${s.pausa}: in ms, from 1 to 5000`)
  })
  if (arquivos) {
    if (!cfg.fecho.logo) erros.push('fecho.logo: the logo PNG (the closing is only the logo, centered and still)')
    else if (!fs.existsSync(caminho(base, cfg.fecho.logo))) erros.push(`fecho.logo: not found: ${caminho(base, cfg.fecho.logo)}`)
    if (cfg.fundo.tipo === 'simbolo') {
      if (!cfg.fundo.imagem) erros.push('fundo.imagem: the symbol PNG (fundo.tipo "simbolo")')
      else if (!fs.existsSync(caminho(base, cfg.fundo.imagem))) erros.push(`fundo.imagem: not found: ${caminho(base, cfg.fundo.imagem)}`)
    }
    if (c.pagina && !/^[a-z]+:/i.test(c.pagina) && !fs.existsSync(caminho(base, c.pagina.split('#')[0]))) erros.push(`captura.pagina: not found: ${caminho(base, c.pagina.split('#')[0])}`)
  }
  return { erros, cfg }
}

/** A assinatura do que a gravação depende: mudou a captura no JSON (página, tema, jornada…), grava de novo. */
export function assinaturaCaptura(cfg) {
  return crypto.createHash('sha1').update(JSON.stringify(cfg.captura)).digest('hex').slice(0, 12)
}

const r3 = (x) => +x.toFixed(3)

/** A linha do tempo do vídeo a partir da gravação (events.json do gravador da skill). */
export function linhaDoTempo(cfg, ev) {
  const R = RITMOS[cfg.ritmo] || RITMOS.medio
  const eventos = ev.eventos.slice().sort((a, b) => a.t - b.t)
  const passosEv = eventos.filter((e) => e.tipo === 'passo')
  if (!passosEv.length) throw new Error('the recording has no step: put { "passo": "sentence" } in captura.jornada and record again (--recapture)')
  const vp = ev.aparelho.viewport
  const sucesso = eventos.find((e) => e.tipo === 'sucesso')
  const r0 = Math.max(0, passosEv[0].t - 0.05)
  const r1 = Math.min(ev.duracao, sucesso ? sucesso.t + 1.2 : ev.duracao)
  const A = R.abertura, vel = R.vel
  const vDe = (r) => A + (Math.min(Math.max(r, r0), r1) - r0) / vel
  const recFim = vDe(r1)
  const F = recFim + R.recuo + R.orbita
  const dur = r3(F + R.troca + cfg.fecho.dur)
  const passos = passosEv.map((p, i) => ({ n: p.n, frase: (cfg.textos.passos && cfg.textos.passos[p.n]) || p.legenda,
    v0: r3(i === 0 ? A + 0.25 : vDe(p.t)), v1: r3(i + 1 < passosEv.length ? vDe(passosEv[i + 1].t) : F) }))
  // a câmera chega perto: no começo de cada passo, no meio da tela; antes de cada toque, no ponto do toque; no sucesso, nele
  const clampY = (y) => Math.min(Math.max(y, vp.height * 0.2), vp.height * 0.8)
  const clampX = (x) => Math.min(Math.max(x, vp.width * 0.3), vp.width * 0.7)
  const focos = []
  const pos = (v, x, y, tipo) => focos.push({ v: r3(v), x: r3(clampX(x)), y: r3(clampY(y)), tipo })
  for (const e of eventos) {
    if (e.t > r1) break
    if (e.tipo === 'passo') pos(e === passosEv[0] ? A + 0.75 : vDe(e.t) + 0.5, vp.width / 2, vp.height * 0.46, 'passo')
    else if (e.tipo === 'toque' && e.ponto) pos(vDe(e.t) - 0.3, e.ponto[0], e.ponto[1], 'toque')
    else if (e.tipo === 'sucesso' && e.ret) pos(vDe(e.t) + 0.35, e.ret.x + e.ret.w / 2, e.ret.y + Math.min(e.ret.h, vp.height * 0.5) / 2, 'sucesso')
  }
  // dois focos a menos de 0,45 s um do outro: fica o que importa mais (o toque, depois o sucesso, depois o passo)
  focos.sort((a, b) => a.v - b.v)
  const PESO = { toque: 3, sucesso: 2, passo: 1 }
  for (let i = 1; i < focos.length;) {
    if (focos[i].v - focos[i - 1].v >= 0.45) { i++; continue }
    focos.splice(PESO[focos[i].tipo] > PESO[focos[i - 1].tipo] ? i - 1 : i, 1)
  }
  focos.forEach((f, i) => { f.dur = r3(Math.min(0.9, i ? f.v - focos[i - 1].v : f.v - A)) })
  const toques = eventos.filter((e) => e.tipo === 'toque' && e.ponto && e.t <= r1 && !e.oculto).map((e) => ({ v: r3(vDe(e.t)), x: e.ponto[0], y: e.ponto[1] }))
  const rolas = eventos.filter((e) => e.tipo === 'rola' && e.t <= r1).map((e) => ({ v0: r3(vDe(e.t)), v1: r3(vDe(e.t1 || e.t)) }))
  return { tela: { w: vp.width, h: vp.height, dsf: ev.aparelho.dsf }, A, vel, r0: r3(r0), r1: r3(r1), recFim: r3(recFim), recuo: R.recuo, F: r3(F), troca: R.troca, dur, passos, focos, toques, rolas }
}

/** A folha da trilha (seções e marcos) e a identidade, no esquema do assets/audio/arrange_series.py. */
export function folhaDaTrilha(cfg, LN) {
  const r3 = (x) => +x.toFixed(3)
  const secoes = [{ nome: 'opening', de: 0, ate: LN.passos[0].v0, energia: 'media' },
    ...LN.passos.map((p, i) => ({ nome: `step-${i + 1}`, de: p.v0, ate: i + 1 < LN.passos.length ? LN.passos[i + 1].v0 : LN.F, energia: 'media' })),
    { nome: 'closing', de: LN.F, ate: LN.dur, energia: 'media' }].map((s) => ({ ...s, de: r3(s.de), ate: r3(s.ate) }))
  const marcos = [
    ...LN.toques.map((q) => ({ t: r3(q.v), evento: 'tap on the screen', som: 'toque', efeito: 'toque', variante: 'macio', opcional: false })),
    ...LN.rolas.filter((r) => r.v1 - r.v0 > 0.25).map((r) => ({ t: r3(r.v0 + 0.15), evento: 'the screen scrolls', som: 'whoosh', efeito: 'whoosh', variante: 'curto', opcional: true })),
    ...(cfg.transicao !== 'corte' ? [{ t: r3(LN.F + LN.troca * 0.5), evento: 'transition to the closing', som: 'whoosh', efeito: 'whoosh', variante: 'medio', opcional: true }] : []),
    { t: r3(LN.F + LN.troca), evento: 'the closing logo comes in', som: 'acento', opcional: false },
  ].sort((a, b) => a.t - b.t)
  const folha = { titulo: `${cfg.nome} · 3D phone`, duracao: LN.dur, bpm: 120, compasso: 4, taxa: 48000, saida: 'soundtrack.wav', loudness_lufs: -14.0, teto_dbtp: -1.5,
    semente: cfg.trilha?.semente ?? 7, silencios: [], fade: [r3(LN.dur - 0.8), LN.dur], secoes, marcos }
  const ident = { versao: 2, nome: `${cfg.nome} · 3D phone`, papel: 'protagonista', densidade: 'baixa', loudness_lufs: -14.0, bpm: [100, 112],
    modos: ['maior', 'mixolidio', 'dorico'], tons: ['C', 'D', 'F', 'G', 'A'],
    instrumentos: { harmonia: ['epiano', 'piano'], baixo: ['bass_note'], percussao: ['kick', 'clap', 'hat', 'shaker'], melodia: ['pluck'], textura: ['pad_note'] },
    ...(cfg.trilha?.identidade || {}) }
  return { folha, ident }
}
