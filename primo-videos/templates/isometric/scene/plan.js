// Molde isometrico: confere os parâmetros e calcula a linha do tempo (cada camada cai, pousa e é nomeada). Nenhuma
// marca aqui: tudo vem de PARAMS.
// Roda no navegador (antes do engine.js) e no Node (render.mjs e testes), para os dois verem os mesmos tempos.

const ISO_RITMOS = {
  calmo: { passo: 2.0, queda: 0.6, nomeia: 0.22, final: 1.8 },
  medio: { passo: 1.5, queda: 0.5, nomeia: 0.18, final: 1.4 },
  rapido: { passo: 1.05, queda: 0.42, nomeia: 0.15, final: 1.1 },
}
const ISO_OPCOES = {
  rotulos: ['direita', 'esquerda'],
  camera: ['orbita', 'dolly-3d'],
  transicao: ['cut-on-beat', 'mascara'],
}
const ISO_TRANSICAO = { 'cut-on-beat': 0, mascara: 0.6 }
const ISO_CORES = ['fundo', 'texto', 'linha']
const ISO_MODOS = ['pilha', 'aparelho']
const ISO_HORIZONTAIS = ['16x9', '19x9', '21x9']
// campos do visual antigo (o chão e a camada translúcida): um JSON velho continua valendo, e eles são ignorados
const ISO_IGNORADOS = ['chao']
const ISO_MIN = 2, ISO_MAX = 6

/** Confere os parâmetros e devolve a lista de erros, cada um dizendo o que fazer (lista vazia = ok). */
function validarIso(P) {
  const erros = []
  if (!P || typeof P !== 'object') return ['the parameters JSON must be an object: see example.json']
  const hex = (v) => typeof v === 'string' && /^#[0-9a-fA-F]{6}$/.test(v)
  const tripla = (c, onde) => {
    if (!c || typeof c !== 'object') { erros.push(`${onde} needs { "topo", "frente", "lado" }, three #RRGGBB colors (the top, front and side faces)`); return }
    for (const k of ['topo', 'frente', 'lado']) if (!hex(c[k])) erros.push(`${onde}.${k} must be a #RRGGBB color${c[k] ? ` (got "${c[k]}")` : ''}`)
  }
  for (const [k, vals] of Object.entries(ISO_OPCOES)) if (P[k] != null && !vals.includes(P[k])) erros.push(`"${k}": "${P[k]}" does not exist: use ${vals.join(' | ')}`)
  if (P.modo != null && !ISO_MODOS.includes(P.modo)) erros.push(`"modo": "${P.modo}" does not exist: use pilha (the stack of layers) | aparelho (the device: tray, keys and screen)`)
  if (P.modo === 'aparelho') erros.push(...validarAparelho(P))
  if (P.ritmo != null && typeof P.ritmo === 'string' && !ISO_RITMOS[P.ritmo]) erros.push(`"ritmo": "${P.ritmo}" does not exist: use calmo | medio | rapido (or an object with passo, queda, nomeia, final in seconds)`)
  const M = P.marca
  if (!M || typeof M !== 'object') erros.push('missing "marca": { "nome", "fonte", "cores": { fundo, texto, linha } }')
  else {
    if (!M.fonte) erros.push('missing "marca.fonte": the font family of the text (e.g. "Inter")')
    const C = M.cores || {}
    for (const k of ISO_CORES) if (!hex(C[k])) erros.push(`"marca.cores.${k}" must be a #RRGGBB color${C[k] ? ` (got "${C[k]}")` : ''}`)
    for (const [k, v] of Object.entries(C)) if (!ISO_CORES.includes(k) && !ISO_IGNORADOS.includes(k) && v != null && !hex(v)) erros.push(`"marca.cores.${k}" must be a #RRGGBB color (got "${v}")`)
  }
  const cs = Array.isArray(P.camadas) ? P.camadas : null
  if (!cs || cs.length < ISO_MIN) erros.push(`"camadas" needs ${ISO_MIN} to ${ISO_MAX} layers, from the bottom up: [{ "rotulo": "The base", "cor": { "topo", "frente", "lado" } }, …]`)
  else {
    if (cs.length > ISO_MAX) erros.push(`${cs.length} layers don't fit with a readable label: at most ${ISO_MAX}. Merge layers or split the video`)
    cs.forEach((c, i) => {
      const onde = `layer ${i + 1}${c && c.rotulo ? ` ("${c.rotulo}")` : ''}`
      if (!c || !c.rotulo) erros.push(`${onde}: missing "rotulo" (the name shown next to the layer)`)
      else if (String(c.rotulo).split(/\s+/).length > 5) erros.push(`${onde}: the label has more than 5 words; put the rest in "detalhe"`)
      if (c && c.detalhe && String(c.detalhe).split(/\s+/).length > 9) erros.push(`${onde}: the detail has more than 9 words; on-screen text is short and informative`)
      tripla(c && c.cor, `${onde}: "cor"`)
      if (c && c.partes != null && !(Number.isInteger(c.partes) && c.partes >= 1 && c.partes <= 9)) erros.push(`${onde}: "partes" is a whole number from 1 to 9 (the layer's side-by-side blocks)`)
      if (c && c.largura != null && !(c.largura >= 0.3 && c.largura <= 1)) erros.push(`${onde}: "largura" goes from 0.3 to 1 (the fraction of the base)`)
      if (c && c.altura != null && !(c.altura >= 0.4 && c.altura <= 3)) erros.push(`${onde}: "altura" goes from 0.4 to 3 (1 = the default thickness)`)
    })
  }
  if (P.destaque != null) tripla(P.destaque, '"destaque"')
  const F = P.fecho
  if (!F || !F.logo) erros.push('missing "fecho": { "logo": "path/logo.png", "fundo": "#RRGGBB" }: the video closes with only the logo')
  else {
    for (const k of ['texto', 'bordao', 'slogan', 'url', 'frase', 'titulo']) if (F[k] != null) erros.push(`"fecho.${k}": the closing is only the logo, still; remove "${k}" (no sentence, slogan or address)`)
    if (F.fundo != null && !hex(F.fundo)) erros.push(`"fecho.fundo" must be a #RRGGBB color (got "${F.fundo}")`)
  }
  return erros
}

/** O modo aparelho: exatamente 3 camadas (a bandeja, as teclas, o monitor), 2 a 6 teclas com cor e ícone, tela neutra. */
function validarAparelho(P) {
  const erros = [], hex = (v) => typeof v === 'string' && /^#[0-9a-fA-F]{6}$/.test(v)
  const cs = Array.isArray(P.camadas) ? P.camadas : []
  if (cs.length !== 3) erros.push(`"modo": "aparelho" takes exactly 3 layers, from the bottom up: the tray, the keys and the monitor (got ${cs.length})`)
  const teclas = cs[1] && cs[1].pecas
  if (cs.length === 3 && !(Array.isArray(teclas) && teclas.length >= 2 && teclas.length <= 6)) erros.push('"modo": "aparelho": layer 2 (the keys) needs "pecas": 2 to 6 keys, [{ "cor": "#RRGGBB", "icone": "path/icon.png" }, …]')
  else if (cs.length === 3) teclas.forEach((q, j) => {
    if (!q || !hex(q.cor)) erros.push(`"modo": "aparelho": key ${j + 1} needs "cor", a #RRGGBB color`)
    if (q && q.icone != null && (typeof q.icone !== 'string' || !/\.png$/i.test(q.icone))) erros.push(`"modo": "aparelho": key ${j + 1} "icone" must be the path of a PNG (the brand's icon, used as it is)`)
  })
  const T = P.tela
  if (T != null) {
    if (typeof T !== 'object') erros.push('"tela" is { "fundo", "texto", "cheio", "vazio", "carregando", "pronto" }')
    else {
      for (const k of ['fundo', 'texto', 'cheio', 'vazio']) if (T[k] != null && !hex(T[k])) erros.push(`"tela.${k}" must be a #RRGGBB color (got "${T[k]}")`)
      for (const k of ['carregando', 'pronto']) if (T[k] != null && (typeof T[k] !== 'string' || T[k].split(/\s+/).length > 4)) erros.push(`"tela.${k}" is a short status of up to 4 words (no slogan)`)
    }
  }
  const fs = P.formatos || []
  for (const f of fs) if (!ISO_HORIZONTAIS.includes(f)) erros.push(`"modo": "aparelho" is horizontal only: use ${ISO_HORIZONTAIS.join(', ')} (got "${f}")`)
  return erros
}

/** Os tempos do aparelho (a cena fixa do modo: bandeja, teclas uma a uma, monitor abrindo, digitação, "pronto"). */
function planejarAparelho(P) {
  const r3 = (x) => Math.round(x * 1000) / 1000
  const n = P.camadas[1].pecas.length
  const bandeja = { entra: -0.3, pousa: 0.3, nomeia: 0.5 }
  const teclas = Array.from({ length: n }, (_, j) => ({ entra: r3(0.66 + j * 0.14), pousa: r3(1.16 + j * 0.14) }))
  const teclasNomeia = r3(teclas[n - 1].pousa + 0.22)
  const dobradica = r3(teclasNomeia + 0.1)
  const monitor = { dobradica, abre: r3(dobradica + 0.1), aberto: r3(dobradica + 0.85), nomeia: r3(dobradica + 0.95) }
  // a digitação: 10 toques, um a cada 0,2 s, numa ordem que passeia pelas teclas; cada toque leva a barra 10% adiante
  const ordem = Array.from({ length: 10 }, (_, i) => [0, 2, 1, 3, 2, 0, 3, 1, 2, 3][i] % n)
  const toques = ordem.map((k, i) => ({ tecla: k, t: r3(monitor.nomeia + 0.15 + i * 0.2) }))
  const checado = r3(toques[toques.length - 1].t + 0.25)
  const fecho = { em: r3(checado + 1.55), logoEm: r3(checado + 1.55), dur: (P.fecho && P.fecho.dur) ?? 2.4 }
  const dur = r3(fecho.em + fecho.dur)
  const [cb, ct, cm] = P.camadas
  const camadas = [
    { ...cb, i: 0, entra: bandeja.entra, pousa: bandeja.pousa, nomeia: bandeja.nomeia, partes: 1, largura: 1, altura: 1 },
    { ...ct, i: 1, entra: teclas[0].entra, pousa: teclas[n - 1].pousa, nomeia: teclasNomeia, partes: n, pousos: teclas.map((q) => q.pousa), largura: 1, altura: 1 },
    { ...cm, i: 2, entra: monitor.dobradica, pousa: monitor.aberto, nomeia: monitor.nomeia, partes: 1, largura: 1, altura: 1 },
  ]
  const marcos = [
    { t: bandeja.pousa, evento: `lands ${cb.rotulo}`, som: 'baque', efeito: 'baque', opcional: false },
    ...teclas.map((q, j) => ({ t: q.pousa, evento: `key ${j + 1} lands`, som: 'baque', efeito: 'baque', opcional: j > 0 })),
    ...camadas.map((c) => ({ t: c.nomeia, evento: `names ${c.rotulo}`, som: 'blip', efeito: 'blip', passo: c.i, opcional: false })),
    { t: r3(monitor.abre + 0.3), evento: 'the monitor opens', som: 'whoosh', efeito: 'whoosh', dur: 0.5, opcional: true },
    ...toques.map((q, i) => ({ t: q.t, evento: `key press ${i + 1}`, som: 'clique', efeito: 'clique', opcional: i > 0 })),
    { t: checado, evento: 'ready', som: 'sucesso', efeito: 'sucesso', opcional: false },
    { t: fecho.logoEm, evento: 'the closing logo comes in', som: 'acento', opcional: false },
  ].sort((a, b) => a.t - b.t)
  const secoes = [
    { nome: 'opening', de: 0, ate: bandeja.nomeia },
    { nome: 'build-up', de: bandeja.nomeia, ate: fecho.em },
    { nome: 'closing', de: fecho.em, ate: dur },
  ]
  return { modo: 'aparelho', aparelho: { bandeja, teclas, teclasNomeia, monitor, toques, checado }, camadas, fimMontagem: fecho.em, transicao: 'cut-on-beat', durTr: 0,
    fecho, dur, secoes, marcos, rotulos: 'direita', camera: 'orbita', ritmo: ISO_RITMOS.calmo, luz: 'estudio' }
}

/** O plano: a geometria da pilha (em unidades da base) e os tempos de cada camada. */
function planejarIso(P) {
  const erros = validarIso(P)
  if (erros.length) throw new Error('isometrico parameters:\n  - ' + erros.join('\n  - '))
  if (P.modo === 'aparelho') return planejarAparelho(P)
  const ritmo = { ...ISO_RITMOS[typeof P.ritmo === 'string' ? P.ritmo : 'medio'], ...(typeof P.ritmo === 'object' && P.ritmo ? P.ritmo : {}) }
  const r3 = (x) => Math.round(x * 1000) / 1000
  const n = P.camadas.length
  // a base pousa logo no começo (o quadro 0 já tem a pilha começando); as outras caem a cada passo
  const camadas = P.camadas.map((c, i) => {
    const entra = r3(0.08 - ritmo.queda + i * ritmo.passo), pousa = r3(entra + ritmo.queda), nomeia = r3(pousa + ritmo.nomeia)
    return { ...c, i, entra, pousa, nomeia, partes: c.partes || 1, largura: c.largura ?? Math.max(0.5, 1 - 0.13 * i), altura: c.altura ?? 1 }
  })
  const fimMontagem = r3(camadas[n - 1].nomeia + ritmo.final)
  const transicao = P.transicao || 'cut-on-beat'
  const durTr = ISO_TRANSICAO[transicao]
  const F = P.fecho
  const fecho = { em: fimMontagem, logoEm: r3(fimMontagem + durTr * 0.55), dur: F.dur ?? 2.4 }
  const dur = r3(fimMontagem + durTr + fecho.dur)
  const secoes = [
    { nome: 'opening', de: 0, ate: camadas[0].nomeia },
    { nome: 'build-up', de: camadas[0].nomeia, ate: fimMontagem },
    { nome: 'closing', de: fimMontagem, ate: dur },
  ]
  // os sons: o baque de cada camada que pousa, um blip que sobe a cada camada nomeada, whoosh na transição, acento no logo
  const marcos = []
  for (const c of camadas) {
    if (c.pousa > 0.05) marcos.push({ t: c.pousa, evento: `lands ${c.rotulo}`, som: 'baque', efeito: 'baque', opcional: false })
    marcos.push({ t: c.nomeia, evento: `names ${c.rotulo}`, som: 'blip', efeito: 'blip', passo: Math.min(c.i, 7), opcional: false })
  }
  if (durTr) marcos.push({ t: r3(fimMontagem + durTr * 0.5), evento: `transition (${transicao})`, som: 'whoosh', efeito: 'whoosh', dur: 0.5, opcional: true })
  marcos.push({ t: fecho.logoEm, evento: 'the closing logo comes in', som: 'acento', opcional: false })
  marcos.sort((a, b) => a.t - b.t)
  return { modo: 'pilha', ritmo, camadas, fimMontagem, transicao, durTr, fecho, dur, secoes, marcos, rotulos: P.rotulos || 'direita', camera: P.camera || 'orbita' }
}

if (typeof module !== 'undefined') module.exports = { validarIso, planejarIso, ISO_RITMOS, ISO_OPCOES, ISO_MODOS }
