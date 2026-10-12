// Molde drawn-flow: confere os parâmetros, põe o grafo em camadas e calcula a linha do tempo (o desenho, o
// pacote que anda e cada nó que acende). Nenhuma marca aqui: tudo vem de PARAMS.
// Roda no navegador (antes do engine.js) e no Node (render.mjs e testes), para os dois verem os mesmos tempos.

const FLUXO_RITMOS = {
  calmo: { desenho: 0.3, traco: 0.55, pausa: 0.6, viagem: 0.95, final: 1.5 },
  medio: { desenho: 0.22, traco: 0.45, pausa: 0.45, viagem: 0.75, final: 1.2 },
  rapido: { desenho: 0.15, traco: 0.35, pausa: 0.3, viagem: 0.5, final: 1.0 },
}
const FLUXO_OPCOES = {
  leiaute: ['full-screen', 'dividido'],
  direcao: ['horizontal', 'vertical'],
  camera: ['estatica', 'travelling'],
  transicao: ['cut-on-beat', 'mascara', 'zoom-through'],
}
const FLUXO_TRANSICAO = { 'cut-on-beat': 0, mascara: 0.6, 'zoom-through': 0.7 }
const FLUXO_CORES = ['fundo', 'texto', 'ladrilho', 'linha', 'aceso']
const FLUXO_MAX_NOS = 8
const FLUXO_MAX_POR_CAMADA = 3

/** Confere os parâmetros e devolve a lista de erros, cada um dizendo o que fazer (lista vazia = ok). */
function validarFluxo(P) {
  const erros = []
  if (!P || typeof P !== 'object') return ['the parameters JSON must be an object: see example.json']
  const hex = (v) => typeof v === 'string' && /^#[0-9a-fA-F]{6}$/.test(v)
  for (const [k, vals] of Object.entries(FLUXO_OPCOES)) if (P[k] != null && !vals.includes(P[k])) erros.push(`"${k}": "${P[k]}" does not exist: use ${vals.join(' | ')}`)
  if (P.ritmo != null && typeof P.ritmo === 'string' && !FLUXO_RITMOS[P.ritmo]) erros.push(`"ritmo": "${P.ritmo}" does not exist: use calmo | medio | rapido (or an object with desenho, traco, pausa, viagem, final in seconds)`)
  const M = P.marca
  if (!M || typeof M !== 'object') erros.push('missing "marca": { "nome", "fonte", "cores": { fundo, texto, ladrilho, linha, aceso } }')
  else {
    if (!M.fonte) erros.push('missing "marca.fonte": the font family of the text (e.g. "Inter")')
    const C = M.cores || {}
    for (const k of FLUXO_CORES) if (!hex(C[k])) erros.push(`"marca.cores.${k}" must be a #RRGGBB color${C[k] ? ` (got "${C[k]}")` : ''}`)
    for (const [k, v] of Object.entries(C)) if (!FLUXO_CORES.includes(k) && v != null && !hex(v)) erros.push(`"marca.cores.${k}" must be a #RRGGBB color (got "${v}")`)
  }
  const nos = Array.isArray(P.nos) ? P.nos : null
  if (!nos || nos.length < 2) erros.push('"nos" needs 2 or more nodes: [{ "id": "a", "rotulo": "What it is" }, …]')
  else {
    if (nos.length > FLUXO_MAX_NOS) erros.push(`${nos.length} nodes don't fit in a readable frame: at most ${FLUXO_MAX_NOS}. Split into two videos or merge steps`)
    const vistos = new Set()
    nos.forEach((n, i) => {
      if (!n || !n.id || typeof n.id !== 'string') erros.push(`node ${i + 1}: missing "id" (short text, no spaces)`)
      else if (vistos.has(n.id)) erros.push(`node "${n.id}" appears twice in "nos": each id is unique`)
      else vistos.add(n.id)
      if (!n || !n.rotulo) erros.push(`node ${n && n.id ? `"${n.id}"` : i + 1}: missing "rotulo" (the name shown next to the node)`)
      else if (String(n.rotulo).split(/\s+/).length > 5) erros.push(`node "${n.id}": the label "${n.rotulo}" has more than 5 words; put the rest in "detalhe"`)
      if (n && n.detalhe && String(n.detalhe).split(/\s+/).length > 9) erros.push(`node "${n.id}": the detail has more than 9 words; on-screen text is short and informative`)
    })
    const setas = Array.isArray(P.setas) ? P.setas : null
    if (!setas || !setas.length) erros.push('"setas" needs 1 or more arrows: [{ "de": "a", "para": "b" }, …]')
    else {
      setas.forEach((s, i) => {
        if (!s || !vistos.has(s.de)) erros.push(`arrow ${i + 1}: "de": "${s && s.de}" is not the id of any node (ids: ${[...vistos].join(', ')})`)
        if (!s || !vistos.has(s.para)) erros.push(`arrow ${i + 1}: "para": "${s && s.para}" is not the id of any node (ids: ${[...vistos].join(', ')})`)
        if (s && s.de === s.para) erros.push(`arrow ${i + 1}: "${s.de}" points to itself`)
      })
      if (!erros.length) {
        try {
          const g = camadasFluxo(nos, setas)
          const cheia = g.camadas.find((c) => c.length > FLUXO_MAX_POR_CAMADA)
          if (cheia) erros.push(`the layer with ${cheia.join(', ')} has ${cheia.length} nodes side by side: at most ${FLUXO_MAX_POR_CAMADA}. Chain some of them (an arrow between them) or split the video`)
        } catch (e) { erros.push(e.message) }
      }
    }
  }
  const F = P.fecho
  if (!F || !F.logo) erros.push('missing "fecho": { "logo": "path/logo.png", "fundo": "#RRGGBB" }: the video closes with only the logo')
  else {
    for (const k of ['texto', 'bordao', 'slogan', 'url', 'frase', 'titulo']) if (F[k] != null) erros.push(`"fecho.${k}": the closing is only the logo, still; remove "${k}" (no sentence, slogan or address)`)
    if (F.fundo != null && !hex(F.fundo)) erros.push(`"fecho.fundo" must be a #RRGGBB color (got "${F.fundo}")`)
  }
  return erros
}

/** As camadas do grafo: camada = o caminho mais longo desde uma fonte; dentro da camada, a ordem que menos cruza. */
function camadasFluxo(nos, setas) {
  const ids = nos.map((n) => n.id)
  const ent = new Map(ids.map((i) => [i, []])), sai = new Map(ids.map((i) => [i, []]))
  for (const s of setas) { sai.get(s.de).push(s.para); ent.get(s.para).push(s.de) }
  const grau = new Map(ids.map((i) => [i, ent.get(i).length]))
  const fila = ids.filter((i) => grau.get(i) === 0), topo = []
  while (fila.length) {
    const u = fila.shift(); topo.push(u)
    for (const v of sai.get(u)) { grau.set(v, grau.get(v) - 1); if (grau.get(v) === 0) fila.push(v) }
  }
  if (topo.length < ids.length) {
    const presos = ids.filter((i) => !topo.includes(i))
    throw new Error(`the arrows close a cycle between ${presos.join(', ')}: the flow goes one way only. Remove the arrow that goes back`)
  }
  const rank = new Map(ids.map((i) => [i, 0]))
  for (const u of topo) for (const v of sai.get(u)) rank.set(v, Math.max(rank.get(v), rank.get(u) + 1))
  const R = Math.max(...rank.values()) + 1
  const camadas = Array.from({ length: R }, (_, r) => ids.filter((i) => rank.get(i) === r))
  // baricentro: duas descidas e uma subida bastam para até 8 nós
  const pos = () => new Map(camadas.flatMap((c) => c.map((id, k) => [id, (k + 0.5) / c.length])))
  const ordenar = (c, viz) => {
    const p = pos()
    const b = (id) => { const vs = viz.get(id).map((x) => p.get(x)); return vs.length ? vs.reduce((a, x) => a + x, 0) / vs.length : p.get(id) }
    const ini = new Map(c.map((id, k) => [id, k]))
    c.sort((a, z) => b(a) - b(z) || ini.get(a) - ini.get(z))
  }
  for (let it = 0; it < 2; it++) {
    for (let r = 1; r < R; r++) ordenar(camadas[r], ent)
    for (let r = R - 2; r >= 0; r--) ordenar(camadas[r], sai)
  }
  for (let r = 1; r < R; r++) ordenar(camadas[r], ent)
  return { rank, camadas, R, topo, ent, sai }
}

/** O plano do vídeo: nós com camada e posição (u ao longo do fluxo, v de través, de 0 a 1), setas e os tempos. */
function planejarFluxo(P) {
  const erros = validarFluxo(P)
  if (erros.length) throw new Error('drawn-flow parameters:\n  - ' + erros.join('\n  - '))
  const ritmo = { ...FLUXO_RITMOS[typeof P.ritmo === 'string' ? P.ritmo : 'medio'], ...(typeof P.ritmo === 'object' && P.ritmo ? P.ritmo : {}) }
  const g = camadasFluxo(P.nos, P.setas)
  const r3 = (x) => Math.round(x * 1000) / 1000
  const nos = P.nos.map((n, i) => {
    const r = g.rank.get(n.id), c = g.camadas[r], k = c.indexOf(n.id)
    return { ...n, i, rank: r, ordem: k, nCamada: c.length, u: g.R === 1 ? 0.5 : r / (g.R - 1), v: (k + 0.5) / c.length }
  })
  const no = Object.fromEntries(nos.map((n) => [n.id, n]))
  // o desenho: camada a camada, cada nó e depois as setas que saem dele
  // o primeiro nó já está se desenhando no quadro 0 (nada de quadro vazio esperando)
  for (const n of nos) n.desenha = r3(-0.15 + n.rank * ritmo.desenho + n.ordem * 0.08)
  const setas = P.setas.map((s, i) => {
    const a = no[s.de], b = no[s.para], salto = b.rank - a.rank
    const desenha = r3(a.desenha + 0.35)
    return { ...s, i, salto, desenha, desenhada: r3(desenha + ritmo.traco * salto) }
  })
  const inicio = r3(Math.max(...setas.map((s) => s.desenhada), ...nos.map((n) => n.desenha + 0.45)) + 0.25)
  // o pacote: sai das fontes, espera a pausa em cada nó, viaja; trava = para no meio do caminho e o nó não acende
  for (const n of nos) { n.aceso = null; n.travado = null }
  const fontes = nos.filter((n) => !P.setas.some((s) => s.para === n.id))
  for (const n of fontes) n.aceso = inicio
  for (const id of g.topo) {
    const a = no[id]
    if (a.aceso == null) continue
    for (const s of setas.filter((x) => x.de === id)) {
      const b = no[s.para]
      s.parte = r3(a.aceso + ritmo.pausa * (fontes.includes(a) ? 0.7 : 1))
      if (s.trava) {
        // devagar até o portão: chega depois dos irmãos que passam, e o nó travado fica por último
        s.chega = r3(s.parte + ritmo.viagem * 1.15)
        b.travado = b.travado == null ? s.chega : Math.min(b.travado, s.chega)
      } else {
        s.chega = r3(s.parte + ritmo.viagem * s.salto)
        b.aceso = b.aceso == null ? s.chega : Math.min(b.aceso, s.chega)
      }
    }
  }
  const eventos = nos.flatMap((n) => [n.aceso, n.travado]).filter((x) => x != null)
  const fimPercurso = r3(Math.max(...eventos) + ritmo.final)
  const transicao = P.transicao || 'cut-on-beat'
  const durTr = FLUXO_TRANSICAO[transicao]
  const F = P.fecho
  const fecho = { em: fimPercurso, logoEm: r3(fimPercurso + durTr * 0.55), dur: F.dur ?? 2.4 }
  const dur = r3(fimPercurso + durTr + fecho.dur)
  // a ordem em que os nós acendem (a lista do leiaute dividido e o passo do blip)
  const ordemAcende = nos.filter((n) => n.aceso != null || n.travado != null)
    .sort((a, b) => (a.aceso ?? a.travado) - (b.aceso ?? b.travado) || a.i - b.i)
  ordemAcende.forEach((n, k) => { n.passo = k })
  const secoes = [
    { nome: 'opening', de: 0, ate: inicio },
    { nome: 'path', de: inicio, ate: fimPercurso },
    { nome: 'closing', de: fimPercurso, ate: dur },
  ]
  // os sons: um blip que sobe a cada nó que acende, um toque na trava, whoosh na transição, acento no logo
  const marcos = []
  const juntos = new Map()
  for (const n of nos) if (n.aceso != null && n.aceso > inicio - 1e-6) { const k = n.aceso.toFixed(3); if (!juntos.has(k)) juntos.set(k, n) }
  let passo = 0
  for (const [k, n] of [...juntos.entries()].sort((a, b) => +a[0] - +b[0])) {
    marcos.push({ t: +k, evento: `lights up ${n.rotulo}`, som: 'blip', efeito: 'blip', passo: Math.min(passo++, 7), opcional: false })
  }
  for (const n of nos) if (n.travado != null) marcos.push({ t: n.travado, evento: `the packet stops before ${n.rotulo}`, som: 'toque', efeito: 'toque', opcional: false })
  if (durTr) marcos.push({ t: r3(fimPercurso + durTr * 0.5), evento: `transition (${transicao})`, som: 'whoosh', efeito: 'whoosh', dur: 0.5, opcional: true })
  marcos.push({ t: fecho.logoEm, evento: 'the closing logo comes in', som: 'acento', opcional: false })
  marcos.sort((a, b) => a.t - b.t)
  return {
    ritmo, nos, setas, R: g.R, camadas: g.camadas, inicio, fimPercurso, transicao, durTr, fecho, dur, secoes, marcos,
    leiaute: P.leiaute || 'full-screen', direcao: P.direcao || 'horizontal', camera: P.camera || 'estatica', ordemAcende: ordemAcende.map((n) => n.id),
  }
}

if (typeof module !== 'undefined') module.exports = { validarFluxo, camadasFluxo, planejarFluxo, FLUXO_RITMOS, FLUXO_OPCOES }
