// Molde card-bento: o que vale no navegador (antes do engine) e no Node (render.mjs e testes).
// validar(P) → lista de erros (vazia = ok), cada um dizendo o que trocar · empacotar(tamanhos, colunas) → a grade bento
// sem buraco · planejar(P) → a linha do tempo: monta → visita cada cartão → recua para a grade → fecho só com o logo.
;(function (raiz) {
  const TAMANHOS = { pequeno: [1, 1], largo: [2, 1], alto: [1, 2], grande: [2, 2] }
  // o mini-visual de cada cartão: o tipo e os campos que ele exige
  const VISUAIS = { barras: ['valores'], cores: ['cores'], numero: ['valor'], linhas: [], slides: [], play: [], onda: [], letras: [], imagens: ['imagens'] }
  const CAMERAS = ['zoom', 'travelling']
  const MONTAGENS = ['antes', 'no-caminho']
  const ENTRADAS = ['pop', 'sobe']
  const TRANSICOES = ['zoom-through', 'push', 'whip', 'mascara', 'virada', 'corte']
  // entrada = intervalo entre um cartão e o próximo na montagem; visita = cada cartão em foco (o movimento incluso);
  // recuo = a grade inteira no fim; transicao = da grade para o fecho; logo = o logo parado depois da transição
  const RITMOS = {
    calmo: { entrada: 0.22, visita: 2.2, movimento: 0.8, recuo: 1.8, transicao: 0.8, logo: 2.2 },
    medio: { entrada: 0.16, visita: 1.6, movimento: 0.65, recuo: 1.4, transicao: 0.7, logo: 2.0 },
    rapido: { entrada: 0.12, visita: 1.25, movimento: 0.5, recuo: 1.2, transicao: 0.55, logo: 1.9 },
  }
  const MIN_CARTOES = 2, MAX_CARTOES = 9, MAX_PALAVRAS = 7
  const HEX = /^#[0-9a-fA-F]{6}$/
  const lista = (xs) => xs.join(', ')
  const palavras = (s) => String(s).trim().split(/\s+/).filter(Boolean).length

  function validar(P) {
    const e = []
    if (!P || typeof P !== 'object') return ['the parameters file is a JSON object (see the template\'s example.json)']
    const M = P.marca
    if (!M || typeof M !== 'object') e.push('missing "marca": { nome, cores: { fundo, cartao, texto, destaque }, fontes: { titulo: { familia } } }')
    else {
      if (!M.cores || !HEX.test(M.cores.fundo || '') || !HEX.test(M.cores.texto || '')) e.push('marca.cores needs "fundo" and "texto" as #RRGGBB (e.g. "fundo": "#F5F5F5")')
      for (const k of Object.keys(M.cores || {})) if (!HEX.test(M.cores[k])) e.push(`marca.cores.${k} "${M.cores[k]}": use #RRGGBB`)
      if (!M.fontes || !M.fontes.titulo || !M.fontes.titulo.familia) e.push('marca.fontes.titulo.familia: missing the title font (e.g. { "familia": "Inter", "peso": 700 })')
      if (M.cartoes != null && (!Array.isArray(M.cartoes) || !M.cartoes.length)) e.push('marca.cartoes: list of card colors, "#hex" or { "fundo", "texto" }')
    }
    const cs = P.cartoes
    if (!Array.isArray(cs) || cs.length < MIN_CARTOES || cs.length > MAX_CARTOES) {
      e.push(`cartoes: the bento takes ${MIN_CARTOES} to ${MAX_CARTOES} cards (got ${Array.isArray(cs) ? cs.length : 'none'}); with more, split into two videos or pass "visitar" with the ones the camera visits`)
      return e
    }
    cs.forEach((c, i) => {
      const onde = `cartoes[${i}]`
      if (!c || typeof c !== 'object') { e.push(`${onde}: each card is an object { titulo, texto, icone, tamanho, visual }`); return }
      if (!c.titulo || !String(c.titulo).trim()) e.push(`${onde}.titulo: missing the title`)
      else if (palavras(c.titulo) > MAX_PALAVRAS) e.push(`${onde}.titulo has ${palavras(c.titulo)} words: the title takes up to ${MAX_PALAVRAS} (the detail goes in "texto")`)
      if (c.texto != null && palavras(c.texto) > 2 * MAX_PALAVRAS) e.push(`${onde}.texto has ${palavras(c.texto)} words: the card fits up to ${2 * MAX_PALAVRAS} (two lines)`)
      if (c.tamanho != null && !TAMANHOS[c.tamanho]) e.push(`${onde}.tamanho "${c.tamanho}" does not exist: use ${lista(Object.keys(TAMANHOS))}`)
      if (c.cor != null && !HEX.test(c.cor)) e.push(`${onde}.cor "${c.cor}": use #RRGGBB`)
      if (c.visual != null) {
        const v = c.visual
        if (!v || !VISUAIS[v.tipo]) e.push(`${onde}.visual.tipo "${v && v.tipo}" does not exist: use ${lista(Object.keys(VISUAIS))}`)
        else for (const campo of VISUAIS[v.tipo]) if (v[campo] == null || (Array.isArray(v[campo]) && !v[campo].length)) e.push(`${onde}.visual (${v.tipo}) needs "${campo}"`)
        if (v && v.tipo === 'imagens' && Array.isArray(v.imagens) && v.imagens.length > 6) e.push(`${onde}.visual.imagens: up to 6 images per card (got ${v.imagens.length})`)
      }
    })
    const cam = P.camera || {}
    if (cam.modo != null && !CAMERAS.includes(cam.modo)) e.push(`camera.modo "${cam.modo}" does not exist: use ${lista(CAMERAS)}`)
    if (P.montagem != null && !MONTAGENS.includes(P.montagem)) e.push(`montagem "${P.montagem}" does not exist: use ${lista(MONTAGENS)} (antes = the grid builds first and then the camera visits; no-caminho = each card comes in when the camera arrives)`)
    if (P.entrada != null && !ENTRADAS.includes(P.entrada)) e.push(`entrada "${P.entrada}" does not exist: use ${lista(ENTRADAS)}`)
    if (P.ritmo != null && typeof P.ritmo === 'string' && !RITMOS[P.ritmo]) e.push(`ritmo "${P.ritmo}" does not exist: use ${lista(Object.keys(RITMOS))} or an object { visita, movimento, … }`)
    if (P.ritmo && typeof P.ritmo === 'object') for (const [k, v] of Object.entries(P.ritmo)) if (!(k in RITMOS.medio) || !(v > 0)) e.push(`ritmo.${k}: use a number of seconds greater than zero in ${lista(Object.keys(RITMOS.medio))}`)
    if (P.visitar != null && (!Array.isArray(P.visitar) || !P.visitar.length || P.visitar.some((i) => !Number.isInteger(i) || i < 0 || i >= cs.length))) e.push(`visitar: list of card indexes, from 0 to ${cs.length - 1} (e.g. [0, 2, 3])`)
    const F = P.fecho || {}
    if (F.transicao != null && !TRANSICOES.includes(F.transicao)) e.push(`fecho.transicao "${F.transicao}" does not exist: use ${lista(TRANSICOES)}`)
    if (F.fundo != null && !HEX.test(F.fundo)) e.push(`fecho.fundo "${F.fundo}": use #RRGGBB`)
    if (F.cor != null && !HEX.test(F.cor)) e.push(`fecho.cor "${F.cor}" (the color of the name, when there is no logo): use #RRGGBB`)
    if (!F.logo && !(M && M.nome)) e.push('fecho.logo: missing the closing logo (PNG); without a logo, set at least marca.nome')
    return e
  }

  /** Empacota os cartões numa grade de `colunas`, na ordem, no primeiro lugar livre; depois estica o cartão vizinho para
   *  dentro de cada buraco que sobrou (à direita, senão para baixo). → { pos: [{ c, l, w, h }], colunas, linhas } */
  function empacotar(tamanhos, colunas) {
    const C = Math.max(1, colunas)
    const ocup = []
    const livre = (c, l) => !(ocup[l] && ocup[l][c] != null)
    const marca = (p, i) => { for (let l = p.l; l < p.l + p.h; l++) { ocup[l] = ocup[l] || []; for (let c = p.c; c < p.c + p.w; c++) ocup[l][c] = i } }
    const pos = tamanhos.map((t, i) => {
      let [w, h] = TAMANHOS[t] || TAMANHOS.pequeno
      w = Math.min(w, C)
      for (let l = 0; ; l++) for (let c = 0; c + w <= C; c++) {
        let ok = true
        for (let y = l; y < l + h && ok; y++) for (let x = c; x < c + w && ok; x++) ok = livre(x, y)
        if (ok) { const p = { c, l, w, h }; marca(p, i); return p }
      }
    })
    const linhas = Math.max(...pos.map((p) => p.l + p.h))
    for (let mudou = true; mudou;) {
      mudou = false
      for (let l = 0; l < linhas; l++) for (let c = 0; c < C; c++) {
        if (!livre(c, l)) continue
        const esq = c > 0 && ocup[l] ? ocup[l][c - 1] : null
        if (esq != null) {
          const p = pos[esq]
          let ok = p.c + p.w === c
          for (let y = p.l; y < p.l + p.h && ok; y++) ok = livre(c, y)
          if (ok) { p.w++; marca(p, esq); mudou = true; continue }
        }
        const cima = l > 0 && ocup[l - 1] ? ocup[l - 1][c] : null
        if (cima != null) {
          const p = pos[cima]
          let ok = p.l + p.h === l
          for (let x = p.c; x < p.c + p.w && ok; x++) ok = livre(x, l)
          if (ok) { p.h++; marca(p, cima); mudou = true }
        }
      }
    }
    return { pos, colunas: C, linhas }
  }

  const r3 = (x) => Math.round(x * 1000) / 1000

  /** A linha do tempo (igual em todo formato). */
  function planejar(P) {
    const R = { ...RITMOS[typeof P.ritmo === 'string' ? P.ritmo : 'medio'], ...(P.ritmo && typeof P.ritmo === 'object' ? P.ritmo : {}) }
    const n = P.cartoes.length
    const montagem = P.montagem || 'antes'
    const ordem = P.visitar || P.cartoes.map((_, i) => i)
    const entradas = new Array(n).fill(null)
    const secoes = []
    let t = 0
    if (montagem === 'antes') {
      P.cartoes.forEach((_, i) => { entradas[i] = r3(0.12 + i * R.entrada) })
      t = r3(0.12 + (n - 1) * R.entrada + 0.6)
      secoes.push({ tipo: 'monta', t0: 0, t1: t })
    }
    const visitas = ordem.map((i, k) => {
      const mov = montagem === 'no-caminho' && k === 0 ? 0 : R.movimento
      const v = { tipo: 'visita', i, k, t0: t, chega: r3(t + mov), t1: r3(t + R.visita) }
      if (montagem === 'no-caminho' && entradas[i] == null) entradas[i] = r3(t + (k === 0 ? 0.05 : 0.02))
      t = v.t1
      secoes.push(v)
      return v
    })
    const recuo = { tipo: 'recuo', t0: t, mov: r3(R.movimento * 1.2), t1: r3(t + R.recuo) }
    // cartão que a câmera não visita entra (no-caminho) quando ela recua
    let j = 0
    for (let i = 0; i < n; i++) if (entradas[i] == null) entradas[i] = r3(recuo.t0 + 0.15 + j++ * R.entrada)
    secoes.push(recuo)
    const F = P.fecho || {}
    const transicao = F.transicao || 'zoom-through'
    const tr = transicao === 'corte' ? 0 : R.transicao
    const tFecho = recuo.t1
    // quando o logo aparece inteiro: no meio do zoom, no fim do deslize, no começo da máscara
    const emLogo = { 'zoom-through': 0.5, push: 0.75, whip: 0.6, mascara: 0.35, virada: 0.5, corte: 0 }[transicao]
    const fecho = { tipo: 'fecho', t0: tFecho, t1: r3(tFecho + tr + (F.dur || R.logo)), transicao, tr, tLogo: r3(tFecho + tr * emLogo) }
    secoes.push(fecho)
    return { dur: fecho.t1, ritmo: R, montagem, entradas, visitas, recuo, fecho, secoes }
  }

  // no navegador fica em BENTO (o engine.js já tem globais como TRANSICOES)
  const API = { TAMANHOS, VISUAIS, CAMERAS, MONTAGENS, ENTRADAS, TRANSICOES, RITMOS, MAX_PALAVRAS, validar, empacotar, planejar }
  if (typeof module !== 'undefined' && module.exports) module.exports = API
  else raiz.BENTO = API
})(typeof window !== 'undefined' ? window : globalThis)
