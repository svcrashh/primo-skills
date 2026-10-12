// Molde card-stack: o que vale no navegador (antes do engine) e no Node (render.mjs e testes).
// validar(P) → lista de erros (vazia = ok), cada um dizendo o que trocar · planejar(P) → a linha do tempo: a pilha chega →
// cada cartão fica o tempo de ler e sai (swipe ou flip), o de baixo sobe e o contador anda → fecho só com o logo.
;(function (raiz) {
  const LEIAUTES = ['centro', 'dividido']
  const SAIDAS = ['swipe', 'flip']
  const CAMERAS = ['estatica', 'aproxima']
  const TRANSICOES = ['whip', 'virada', 'push', 'mascara', 'zoom-through', 'corte']
  // leitura de cada cartão = base + porPalavra × palavras (título + texto), entre min e max; saida = o cartão saindo;
  // entrada = a pilha chegando; transicao = para o fecho; logo = o logo parado depois dela
  const RITMOS = {
    calmo: { base: 1.0, porPalavra: 0.2, min: 2.2, max: 3.6, saida: 0.6, entrada: 1.0, transicao: 0.7, logo: 2.2 },
    medio: { base: 0.8, porPalavra: 0.17, min: 1.9, max: 3.1, saida: 0.5, entrada: 0.9, transicao: 0.6, logo: 2.0 },
    rapido: { base: 0.6, porPalavra: 0.14, min: 1.5, max: 2.6, saida: 0.42, entrada: 0.75, transicao: 0.5, logo: 1.9 },
  }
  const MIN_CARTOES = 2, MAX_CARTOES = 8, MAX_PALAVRAS = 7
  const HEX = /^#[0-9a-fA-F]{6}$/
  const lista = (xs) => xs.join(', ')
  const palavras = (s) => (s ? String(s).trim().split(/\s+/).filter(Boolean).length : 0)

  function validar(P) {
    const e = []
    if (!P || typeof P !== 'object') return ['the parameters file must be a JSON object (see the template\'s example.json)']
    const M = P.marca
    if (!M || typeof M !== 'object') e.push('missing "marca": { nome, cores: { fundo, cartao, texto }, pilha: ["#hex"], fontes: { titulo: { familia } } }')
    else {
      if (!M.cores || !HEX.test(M.cores.fundo || '') || !HEX.test(M.cores.texto || '') || !HEX.test(M.cores.cartao || '')) e.push('marca.cores needs "fundo", "cartao" and "texto" in #RRGGBB (e.g. "cartao": "#F5F5F5")')
      for (const k of Object.keys(M.cores || {})) if (!HEX.test(M.cores[k])) e.push(`marca.cores.${k} "${M.cores[k]}": use #RRGGBB`)
      if (M.pilha != null && (!Array.isArray(M.pilha) || !M.pilha.length || M.pilha.some((c) => !HEX.test(c)))) e.push('marca.pilha: the colors of the cards behind, from nearest to farthest, in #RRGGBB (e.g. ["#C7C7C7", "#EFEFEF"])')
      if (!M.fontes || !M.fontes.titulo || !M.fontes.titulo.familia) e.push('marca.fontes.titulo.familia: missing the title font (e.g. { "familia": "Inter", "peso": 700 })')
    }
    if (P.titulo != null && palavras(P.titulo) > MAX_PALAVRAS) e.push(`titulo has ${palavras(P.titulo)} words: the series title takes up to ${MAX_PALAVRAS}`)
    const cs = P.cartoes
    if (!Array.isArray(cs) || cs.length < MIN_CARTOES || cs.length > MAX_CARTOES) {
      e.push(`cartoes: the stack takes ${MIN_CARTOES} to ${MAX_CARTOES} cards (got ${Array.isArray(cs) ? cs.length : 'none'}); with more, split it into two videos`)
      return e
    }
    cs.forEach((c, i) => {
      const onde = `cartoes[${i}]`
      if (!c || typeof c !== 'object') { e.push(`${onde}: each card is an object { titulo, texto, icone }`); return }
      if (!c.titulo || !String(c.titulo).trim()) e.push(`${onde}.titulo: missing the title (the tip or the step, in up to ${MAX_PALAVRAS} words)`)
      else if (palavras(c.titulo) > MAX_PALAVRAS) e.push(`${onde}.titulo has ${palavras(c.titulo)} words: the title takes up to ${MAX_PALAVRAS} (the detail goes in "texto")`)
      if (palavras(c.texto) > 2 * MAX_PALAVRAS) e.push(`${onde}.texto has ${palavras(c.texto)} words: the card fits up to ${2 * MAX_PALAVRAS} (two lines of ${MAX_PALAVRAS})`)
      if (c.cor != null && !HEX.test(c.cor)) e.push(`${onde}.cor "${c.cor}": use #RRGGBB`)
      if (c.dur != null && !(c.dur >= 1)) e.push(`${onde}.dur: reading seconds, 1 or more`)
    })
    if (P.leiaute != null && !LEIAUTES.includes(P.leiaute)) e.push(`leiaute "${P.leiaute}" does not exist: use ${lista(LEIAUTES)} (centro = the stack in the middle, counter in a pill; dividido = title and big counter on one side, the stack on the other)`)
    if (P.saida != null && !SAIDAS.includes(P.saida)) e.push(`saida "${P.saida}" does not exist: use ${lista(SAIDAS)} (swipe = the card slides to the side; flip = it flips up like a notepad page)`)
    if (P.camera != null && !CAMERAS.includes(P.camera)) e.push(`camera "${P.camera}" does not exist: use ${lista(CAMERAS)}`)
    if (P.inclina != null && !(Math.abs(P.inclina) <= 10)) e.push('inclina: rotation in degrees of the cards behind, from -10 to 10')
    if (P.ritmo != null && typeof P.ritmo === 'string' && !RITMOS[P.ritmo]) e.push(`ritmo "${P.ritmo}" does not exist: use ${lista(Object.keys(RITMOS))} or an object { porPalavra, saida, … }`)
    if (P.ritmo && typeof P.ritmo === 'object') for (const [k, v] of Object.entries(P.ritmo)) if (!(k in RITMOS.medio) || !(v >= 0)) e.push(`ritmo.${k}: use a number of seconds, in one of ${lista(Object.keys(RITMOS.medio))}`)
    const F = P.fecho || {}
    if (F.transicao != null && !TRANSICOES.includes(F.transicao)) e.push(`fecho.transicao "${F.transicao}" does not exist: use ${lista(TRANSICOES)}`)
    if (F.fundo != null && !HEX.test(F.fundo)) e.push(`fecho.fundo "${F.fundo}": use #RRGGBB`)
    if (F.cor != null && !HEX.test(F.cor)) e.push(`fecho.cor "${F.cor}" (the color of the name, when there is no logo): use #RRGGBB`)
    if (!F.logo && !(M && M.nome)) e.push('fecho.logo: missing the closing logo (PNG); without a logo, set at least marca.nome')
    return e
  }

  const r3 = (x) => Math.round(x * 1000) / 1000

  /** A linha do tempo (igual em todo formato). leituras[k] = { ini, fim } (o cartão k no topo, legível); saidas[k] = o
   *  cartão k saindo; trocas[k] = quando o contador passa de k+1 para k+2. */
  function planejar(P) {
    const R = { ...RITMOS[typeof P.ritmo === 'string' ? P.ritmo : 'medio'], ...(P.ritmo && typeof P.ritmo === 'object' ? P.ritmo : {}) }
    const n = P.cartoes.length
    const leituras = [], saidas = [], trocas = []
    let t = r3(R.entrada - 0.35)
    P.cartoes.forEach((c, k) => {
      const dur = c.dur || Math.min(R.max, Math.max(R.min, R.base + R.porPalavra * (palavras(c.titulo) + palavras(c.texto))))
      const l = { ini: t, fim: r3(t + dur) }
      leituras.push(l)
      saidas.push({ t0: l.fim, t1: r3(l.fim + R.saida) })
      if (k < n - 1) trocas.push(r3(l.fim + R.saida * 0.5))
      t = r3(l.fim + R.saida * 0.5)   // o próximo já está no topo no meio da saída
    })
    const F = P.fecho || {}
    const transicao = F.transicao || 'whip'
    const tr = transicao === 'corte' ? 0 : R.transicao
    const tFecho = r3(leituras[n - 1].fim + R.saida * 0.5)
    const emLogo = { whip: 0.6, virada: 0.5, push: 0.75, mascara: 0.35, 'zoom-through': 0.5, corte: 0 }[transicao]
    const fecho = { t0: tFecho, t1: r3(tFecho + tr + (F.dur || R.logo)), transicao, tr, tLogo: r3(tFecho + tr * emLogo) }
    const secoes = [{ tipo: 'entrada', t0: 0, t1: leituras[0].ini }, ...leituras.map((l, k) => ({ tipo: 'cartao', k, t0: k ? saidas[k - 1].t0 : l.ini, t1: l.fim })), { tipo: 'fecho', t0: leituras[n - 1].fim, t1: fecho.t1 }]
    return { dur: fecho.t1, ritmo: R, leituras, saidas, trocas, fecho, secoes }
  }

  // no navegador fica em PILHA (o engine.js já tem globais como TRANSICOES)
  const API = { LEIAUTES, SAIDAS, CAMERAS, TRANSICOES, RITMOS, MAX_PALAVRAS, validar, planejar, palavras }
  if (typeof module !== 'undefined' && module.exports) module.exports = API
  else raiz.PILHA = API
})(typeof window !== 'undefined' ? window : globalThis)
