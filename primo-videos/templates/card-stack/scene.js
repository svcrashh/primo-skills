/* Molde "pilha de cartões". Nenhuma marca aqui dentro: cores, fontes, logo, ícones e textos vêm de PARAMS.
 * Cartões empilhados, um por dica ou passo: o de cima fica o tempo de ler e sai (swipe ou flip), o de baixo sobe para o
 * lugar dele e o contador "2/5" anda. Fecho só com o logo.
 * Ordem: pilha (fundo + cabeçalho + cartões) → fecho (logo) por cima, entrando pela transição escolhida. */
const MP = PARAMS.marca
const COR = { fundo: '#FFFFFF', cartao: '#F4F4F4', texto: '#111111', ...MP.cores }
COR.titulo = COR.titulo || COR.texto
COR.cabecalho = COR.cabecalho || COR.texto
COR.ladrilho = COR.ladrilho || COR.cartao
COR.contador = COR.contador || COR.cartao
COR.contadorTexto = COR.contadorTexto || COR.texto
COR.ponto = COR.ponto || COR.cabecalho
COR.pontoApagado = COR.pontoApagado || rgba(COR.cabecalho, 0.35)
const PILHA_CORES = MP.pilha && MP.pilha.length ? MP.pilha : [mixHex(COR.cartao, COR.fundo, 0.25), mixHex(COR.cartao, COR.fundo, 0.5)]
const FTIT = MP.fontes.titulo, FTXT = MP.fontes.texto || MP.fontes.titulo
const fT = (s, w) => `${w || FTIT.peso || 700} ${Math.round(s)}px "${FTIT.familia}"`
const fX = (s, w) => `${w || FTXT.peso || 500} ${Math.round(s)}px "${FTXT.familia}"`
const LEI = PARAMS.leiaute || 'centro'
const SAI = PARAMS.saida || 'swipe'
const CAM = PARAMS.camera || 'estatica'
const INCL = PARAMS.inclina || 0
const N = PARAMS.cartoes.length
const R = PLANO.ritmo
function mixHex(a, b, t) { const x = hex2rgb(a), y = hex2rgb(b); return '#' + x.map((v, i) => Math.round(lerp(v, y[i], t)).toString(16).padStart(2, '0')).join('') }

// ---------- utilidades ----------
const _cv = document.createElement('canvas').getContext('2d')
const medir = (s, font) => { _cv.font = font; return _cv.measureText(s).width }
function linhasQueCabem(s, font, w, max) {
  const out = []; let cur = ''
  for (const p of String(s).split(/\s+/)) {
    const n = cur ? cur + ' ' + p : p
    if (medir(n, font) > w && cur) { out.push(cur); cur = p } else cur = n
  }
  if (cur) out.push(cur)
  return out.length <= max && out.every((l) => medir(l, font) <= w) ? out : null
}
const div = (parent, style = {}, text) => el('div', { cls: 'abs', style, ...(text != null ? { text } : {}) }, parent)

// ---------- leiaute ----------
const SA = areaSegura()
SA.w = SA.x1 - SA.x0; SA.h = SA.y1 - SA.y0
const LADO = HORIZONTAL && LEI === 'dividido'
const PEEK = Math.round(L({ '16x9': 26, '9x16': 30, '1x1': 22, '4x5': 26 }))
// cabeçalho (título da série e contador) e a caixa do cartão de cima
const LAY = (() => {
  if (HORIZONTAL && LEI === 'dividido') {
    const colX = SA.x0 + Math.round(W * 0.035), colW = Math.round(W * 0.32)
    const cw = Math.min(Math.round(W * 0.52), 1000), ch = Math.round(cw * 0.64)
    return { col: { x: colX, w: colW }, card: { x: SA.x1 - 10 - cw, y: Math.round(H / 2 - PEEK - ch / 2), w: cw, h: ch } }
  }
  if (HORIZONTAL) {
    const top = SA.y0 + 26, hdr = 64
    const cw = Math.min(Math.round(W * 0.52), 1000), ch = Math.round(Math.min(cw * 0.6, SA.y1 - 20 - 2 * PEEK - (top + hdr + 44)))
    const y0 = top + hdr + 44, y1 = SA.y1 - 20 - 2 * PEEK
    return { topo: { y: top, h: hdr }, card: { x: Math.round(W / 2 - cw / 2), y: Math.round((y0 + y1) / 2 - ch / 2), w: cw, h: ch } }
  }
  const top = SA.y0 + 12, hdr = L({ '9x16': 150, '1x1': 92, '4x5': 120 })
  const cw = Math.round(SA.w * L({ '9x16': 0.96, '1x1': 0.84, '4x5': 0.9 }))
  const y0 = top + hdr + L({ '9x16': 48, '1x1': 30, '4x5': 40 }), y1 = SA.y1 - 16 - 2 * PEEK
  const ch = Math.round(Math.min(y1 - y0, cw * L({ '9x16': 1.15, '1x1': 0.82, '4x5': 0.95 })))
  return { topo: { y: top, h: hdr }, card: { x: Math.round(SA.x0 + (SA.w - cw) / 2), y: Math.round((y0 + y1) / 2 - ch / 2), w: cw, h: ch } }
})()
const CARD = LAY.card
CARD.cx = CARD.x + CARD.w / 2; CARD.cy = CARD.y + CARD.h / 2

// ---------- o cartão ----------
function montarCartao(parent, c, i) {
  const w = CARD.w, h = CARD.h
  const e = div(parent, { left: px(CARD.x), top: px(CARD.y), width: px(w), height: px(h), borderRadius: px(Math.min(MP.raio ?? 40, Math.min(w, h) * 0.08)), background: PILHA_CORES[0], transformOrigin: '50% 100%', backfaceVisibility: 'hidden' })
  const cont = div(e, { width: px(w), height: px(h) })
  const m = Math.min(w, h), pad = Math.round(m * 0.085), gap = Math.round(pad * 0.5)
  const tile = c.icone ? Math.round(m * L({ '16x9': 0.19, '9x16': 0.17, '1x1': 0.18, '4x5': 0.17 })) : 0
  const tw = w - 2 * pad
  let tf = L({ '16x9': 76, '9x16': 84, '1x1': 68, '4x5': 74 }), tl = null
  let xf = 0, xl = null
  for (; tf >= 40; tf -= 2) {
    tl = linhasQueCabem(c.titulo, fT(tf), tw, 3)
    if (!tl) continue
    xf = Math.max(L({ '16x9': 34, '9x16': 38, '1x1': 32, '4x5': 34 }), Math.round(tf * 0.58)); xl = null
    if (c.texto) for (; xf >= 28 && !(xl = linhasQueCabem(c.texto, fX(xf), tw, 3)); xf -= 2);
    const alto = tl.length * tf * 1.08 + (xl ? gap * 1.4 + xl.length * xf * 1.28 : 0)
    if ((!c.texto || xl) && alto <= h - 2 * pad - (tile ? tile + gap * 2 : 0)) break
  }
  tl = tl || [c.titulo]
  if (c.texto && !xl) console.warn(`card "${c.titulo}": the text did not fit in this format (${FMT}) and was left out`)
  const altoTit = tl.length * tf * 1.08, altoTxt = xl ? gap * 1.4 + xl.length * xf * 1.28 : 0
  // ícone no alto; título e texto encostados embaixo
  let tileEl = null
  if (tile) {
    tileEl = div(cont, { left: px(pad), top: px(pad), width: px(tile), height: px(tile), borderRadius: px(tile * 0.28), background: COR.ladrilho, transformOrigin: '50% 50%' })
    const ip = tile * 0.14
    marcarImagem(imagem(tileEl, c.icone, { left: px(ip), top: px(ip), width: px(tile - 2 * ip), height: px(tile - 2 * ip), objectFit: 'contain' }), `the icon of "${c.titulo}"`)
  }
  const y0 = h - pad - altoTit - altoTxt
  const tit = tl.map((s, j) => { const l = textLine(cont, [{ t: s }], { font: fT(tf), color: c.tinta || COR.titulo, left: px(pad), top: px(y0 + j * tf * 1.08) }); marcar(l.line, 'texto', c.titulo); return l })
  const txt = (xl || []).map((s, j) => { const l = textLine(cont, [{ t: s }], { font: fX(xf), color: COR.texto, left: px(pad), top: px(y0 + altoTit + gap * 1.4 + j * xf * 1.28) }); marcar(l.line, 'texto', c.texto); return l })
  return { e, cont, tileEl, palTit: palavras(tit), palTxt: palavras(txt), i }
}

// posição do cartão na pilha: 0 = em cima; 1, 2 = atrás (descendo e encolhendo, com giro alternado se "inclina")
const GIRO = [0, -INCL, INCL * 0.8, -INCL * 0.6]
function poseNaPilha(s) {
  const j = Math.min(3, Math.floor(s)), f = s - j
  const giro = lerp(GIRO[j], GIRO[Math.min(3, j + 1)], f)
  return `translateY(${s * PEEK}px) scale(${1 - s * 0.055}) rotate(${giro}deg)`
}
function corNaPilha(s, topo) {
  if (s <= 0) return topo
  if (s < 1) return mix(PILHA_CORES[0], topo, 1 - s)
  const a = PILHA_CORES[Math.min(PILHA_CORES.length - 1, Math.floor(s) - 1)], b = PILHA_CORES[Math.min(PILHA_CORES.length - 1, Math.floor(s))]
  return mix(a, b, s - Math.floor(s))
}
const sobe = (t, k) => E.inOutCubic(P(t, PLANO.saidas[k].t0 + 0.15 * R.saida, PLANO.saidas[k].t1))
const avancou = (t) => PLANO.saidas.reduce((a, _, k) => a + sobe(t, k), 0)
// para onde o swipe leva: para longe do cabeçalho
const DIR = LADO ? 1 : -1

// ---------- contador "n/N" ----------
function contador(parent, px0, cor, fundo) {
  const caixa = el('div', { cls: 'abs', style: { display: 'flex', alignItems: 'center', whiteSpace: 'nowrap', font: fT(px0), color: cor, lineHeight: '1', fontVariantNumeric: 'tabular-nums', ...(fundo ? { background: fundo, borderRadius: px(px0), padding: `${px(px0 * 0.32)} ${px(px0 * 0.62)}` } : {}) } }, parent)
  const larg = Math.max(...Array.from({ length: N }, (_, j) => medir(String(j + 1), fT(px0))))
  const mascara = el('div', { style: { position: 'relative', width: px(larg), height: px(px0 * 1.1), overflow: 'hidden' } }, caixa)
  const nums = Array.from({ length: N }, (_, j) => { const d = div(mascara, { width: px(larg), textAlign: 'right', lineHeight: px(px0 * 1.1) }, String(j + 1)); marcar(d, 'texto', 'counter'); return d })
  const total = el('div', { text: `/${N}` }, caixa)
  marcar(total, 'texto', 'counter')
  return {
    caixa,
    update(t) {
      const f = PLANO.trocas.reduce((a, tc) => a + E.inOutCubic(P(t, tc - 0.12, tc + 0.18)), 0)
      nums.forEach((d, j) => { T(d, `translateY(${(j - f) * px0 * 1.1}px)`); O(d, clamp(1 - Math.abs(j - f) * 1.6)) })
    },
  }
}

// ---------- a pilha (fundo + cabeçalho + cartões) ----------
const FE = PLANO.fecho, TRANS = FE.transicao, TRF = FE.tr
const PR = 18   // diâmetro dos pontos de progresso (leiaute dividido)
cena(0, FE.t0 + TRF + (TRF ? 0 : 0.001), (root) => {
  const fundo = camada(root, COR.fundo)
  const cab = el('div', { cls: 'layer' }, fundo)
  const palco = el('div', { cls: 'layer', style: { transformOrigin: `${CARD.cx}px ${CARD.cy}px` } }, fundo)
  // cabeçalho
  let cont, pontos = [], titLs = []
  if (LADO) {
    const C0 = LAY.col
    let tpx = 112, tl = null
    if (PARAMS.titulo) {   // uma linha até 80 px; senão, duas
      for (; tpx >= 80 && !(tl = linhasQueCabem(PARAMS.titulo, fT(tpx), C0.w, 1)); tpx -= 4);
      if (!tl) for (tpx = 112; tpx >= 56 && !(tl = linhasQueCabem(PARAMS.titulo, fT(tpx), C0.w, 2)); tpx -= 4);
      tl = tl || [PARAMS.titulo]
    }
    const cpx = 150, pr = PR
    const alto = (tl ? tl.length * tpx * 1.02 + 54 : 0) + cpx * 1.1 + 56 + pr
    let y = H / 2 - alto / 2
    if (tl) { titLs = tl.map((s, j) => { const l = textLine(cab, [{ t: s }], { font: fT(tpx), color: COR.cabecalho, left: px(C0.x), top: px(y + j * tpx * 1.02) }); marcar(l.line, 'texto', PARAMS.titulo); return l }); y += tl.length * tpx * 1.02 + 54 }
    cont = contador(cab, cpx, COR.cabecalho, null)
    place(cont.caixa, C0.x, y); y += cpx * 1.1 + 56
    pontos = Array.from({ length: N }, (_, j) => div(cab, { left: px(C0.x + j * pr * 2.2), top: px(y), width: px(pr), height: px(pr), borderRadius: px(pr / 2), background: COR.pontoApagado }))
  } else {
    const T0 = LAY.topo
    const grande = LEI === 'dividido'
    const cpx = grande ? L({ '16x9': 64, '9x16': 110, '1x1': 72, '4x5': 96 }) : L({ '16x9': 44, '9x16': 48, '1x1': 40, '4x5': 44 })
    cont = contador(cab, cpx, grande ? COR.cabecalho : COR.contadorTexto, grande ? null : COR.contador)
    const rc = rectOf(cont.caixa)
    if (PARAMS.titulo) {
      const maxW = (HORIZONTAL ? CARD.w : SA.w - 24) - rc.w - 40
      let tpx = L({ '16x9': 56, '9x16': 64, '1x1': 50, '4x5': 56 }), tl = null
      for (; tpx >= 32 && !(tl = linhasQueCabem(PARAMS.titulo, fT(tpx), maxW, HORIZONTAL ? 1 : 2)); tpx -= 2);
      tl = tl || [PARAMS.titulo]
      const x0 = HORIZONTAL ? CARD.x : SA.x0 + 12
      const altoT = tl.length * tpx * 1.05
      titLs = tl.map((s, j) => { const l = textLine(cab, [{ t: s }], { font: fT(tpx), color: COR.cabecalho, left: px(x0), top: px(T0.y + (Math.max(T0.h, rc.h) - altoT) / 2 + j * tpx * 1.05) }); marcar(l.line, 'texto', PARAMS.titulo); return l })
      place(cont.caixa, (HORIZONTAL ? CARD.x + CARD.w : SA.x1 - 12) - rc.w, T0.y + (Math.max(T0.h, rc.h) - rc.h) / 2)
    } else place(cont.caixa, (HORIZONTAL ? W / 2 : SA.x0 + SA.w / 2) - rc.w / 2, T0.y)
  }
  // cartões: o primeiro por cima
  const cards = PARAMS.cartoes.map((c, i) => montarCartao(palco, c, i))
  cards.forEach((c) => { c.e.style.zIndex = String(100 - c.i) })
  // cada saída é uma transição: a checagem não acusa o cartão passando por cima do cabeçalho
  PLANO.saidas.forEach((s, k) => registrarTransicao(`saida-${SAI}-${k + 1}`, s.t0, s.t1 - s.t0))
  const persp = 2.4 * Math.max(W, H)
  return (t) => {
    // cabeçalho sobe na entrada
    const kc = E.outExpo(P(t, 0.1, 0.65))
    T(cab, `translateY(${(1 - kc) * 40}px)`); O(cab, kc)
    titLs.forEach((l) => riseWords(l.words, t, 0.12, 0.06, 0.5))
    cont.update(t)
    if (pontos.length) {   // o ponto do cartão de cima vira pílula
      const f = PLANO.trocas.reduce((a, tc) => a + E.inOutCubic(P(t, tc - 0.12, tc + 0.18)), 0)
      let x = LAY.col.x
      pontos.forEach((p, j) => {
        const a = clamp(1 - Math.abs(j - f)), w = PR * (1 + 1.6 * a)
        p.style.background = a > 0.5 ? COR.ponto : COR.pontoApagado
        p.style.left = px(x); p.style.width = px(w); x += w + PR * 1.2
      })
    }
    // câmera: parada com um respiro leve, ou aproxima devagar durante a leitura e volta na saída
    if (CAM === 'aproxima') {
      const a = PLANO.leituras.reduce((m, l, k) => Math.max(m, E.inOutSine(P(t, l.ini, l.fim)) * (1 - E.inOutCubic(P(t, PLANO.saidas[k].t0, PLANO.saidas[k].t1)))), 0)
      T(palco, `scale(${1 + 0.05 * a})`)
    } else T(palco, `translateY(${6 * Math.sin((2 * Math.PI * t) / 2.6)}px) rotate(${0.35 * Math.sin((2 * Math.PI * t) / 3.4)}deg)`)
    const av = avancou(t)
    for (const c of cards) {
      const { e, cont: ct, tileEl, palTit, palTxt, i } = c
      const L0 = PLANO.leituras[i], S0 = PLANO.saidas[i]
      // entrada: os três primeiros chegam de baixo, o de trás primeiro
      let voo = ''
      if (i <= 2) { const a = 0.05 + (2 - i) * 0.1, k = P(t, a, a + 0.6); voo = `translateY(${(1 - E.outQuart(k)) * H * 0.9}px) rotate(${(1 - k) * (i % 2 ? -8 : 8)}deg) ` }
      const s = i - av
      const topo = PARAMS.cartoes[i].cor || COR.cartao
      if (t >= S0.t0) {
        const k = P(t, S0.t0, S0.t1)
        e.style.background = topo
        tocar(e, 'zIndex', '200')
        if (SAI === 'flip') {
          tocar(e, 'transformOrigin', '50% 0%')
          T(e, `perspective(${persp}px) translateY(${-CARD.h * 0.04 * E.inQuad(k)}px) rotateX(${118 * E.inCubic(k)}deg)`)
          e.style.filter = `brightness(${1 - 0.1 * k})`
          O(e, k < 0.98 ? 1 : 0)
        } else {
          const dist = DIR > 0 ? W - CARD.x + 60 : CARD.x + CARD.w + 60
          T(e, `translateX(${DIR * dist * E.inCubic(k)}px) translateY(${-H * 0.05 * E.inQuad(k)}px) rotate(${DIR * 18 * E.inQuad(k)}deg)`)
          e.style.filter = 'none'
          O(e, k < 1 ? 1 : 0)
        }
      } else {
        e.style.filter = 'none'
        e.style.background = corNaPilha(Math.max(0, s), topo)
        T(e, voo + poseNaPilha(Math.max(0, s)))
        O(e, s <= 2 ? 1 : clamp(3 - s))
      }
      // conteúdo: só no cartão de cima
      const kc2 = P(t, L0.ini - 0.12, L0.ini + 0.15)
      O(ct, t < L0.ini - 0.12 ? 0 : Math.max(0.001, kc2))
      riseWords(palTit, t, L0.ini - 0.08, 0.05, 0.5)
      riseWords(palTxt, t, L0.ini + 0.18, 0.03, 0.45)
      if (tileEl) T(tileEl, `scale(${0.5 + 0.5 * E.outBack(P(t, L0.ini - 0.1, L0.ini + 0.35))})`)
    }
    if (TRANS === 'zoom-through') TR.zoom.sai(fundo, t, FE.t0, TRF, { x: CX, y: CY })
    else if (TRANS === 'push') TR.push.sai(fundo, t, FE.t0, TRF, { dir: 'esquerda' })
    else if (TRANS === 'whip') TR.whip.sai(fundo, t, FE.t0, TRF, { dir: DIR > 0 ? 'direita' : 'esquerda' })
    else if (TRANS === 'virada') TR.virada.sai(fundo, t, FE.t0, TRF, { tipo: 'cartao', eixo: 'x', fundo: (PARAMS.fecho && PARAMS.fecho.fundo) || COR.fundo })
  }
}, 'stack')

// ---------- fecho: só o logo, centrado e parado ----------
cena(FE.t0, PLANO.dur, (root) => {
  const F = PARAMS.fecho || {}
  const cam = camada(root, F.fundo || COR.fundo)
  let logo
  if (F.logo) {
    const lw = F.largura || L({ '16x9': 620, '9x16': 640, '1x1': 560, '4x5': 600 })
    const lh = lw / (F.logoAspecto || 4)
    logo = imagem(cam, F.logo, { left: px(CX - lw / 2), top: px(CY - lh / 2), width: px(lw), height: px(lh) })
  } else {
    logo = div(cam, { font: fT(L({ '16x9': 140, '9x16': 130, '1x1': 110, '4x5': 120 })), color: F.cor || COR.texto, whiteSpace: 'nowrap', lineHeight: '1' }, MP.nome)
    const r = rectOf(logo); place(logo, CX - r.w / 2, CY - r.h / 2)
  }
  marcar(logo, 'logo', MP.nome)
  logo.style.transformOrigin = '50% 50%'
  return (t) => {
    if (TRANS === 'zoom-through') TR.zoom.entra(cam, t, FE.t0, TRF, { x: CX, y: CY })
    else if (TRANS === 'push') TR.push.entra(cam, t, FE.t0, TRF, { dir: 'esquerda' })
    else if (TRANS === 'whip') TR.whip.entra(cam, t, FE.t0, TRF, { dir: DIR > 0 ? 'direita' : 'esquerda' })
    else if (TRANS === 'mascara') TR.mascara.entra(cam, t, FE.t0, TRF, { forma: 'circulo', x: CX, y: CY })
    else if (TRANS === 'virada') TR.virada.entra(cam, t, FE.t0, TRF, { tipo: 'cartao', eixo: 'x' })
    else { const k = spring(t - FE.t0, 2, 0.6); T(logo, `scale(${0.9 + 0.1 * k})`); O(logo, E.outCubic(P(t, FE.t0, FE.t0 + 0.2))) }
  }
}, 'closing')
