/* Molde "bento de cartões". Nenhuma marca aqui dentro: cores, fontes, logo, ícones, textos e imagens vêm de PARAMS.
 * Uma grade bento (cartões de tamanhos diferentes) se monta peça a peça; a câmera visita cada cartão, o mini-visual dele
 * anima quando ela chega, e no fim ela recua para a grade inteira. Fecho só com o logo.
 * Ordem: grade (fundo + mundo que a câmera move) → fecho (logo) por cima, entrando pela transição escolhida. */
const MB = PARAMS.marca
const COR = { fundo: '#FFFFFF', cartao: '#EEEEEE', texto: '#111111', destaque: '#3366FF', ladrilho: '#FFFFFF', ...MB.cores }
COR.vazio = COR.vazio || rgba(COR.texto, 0.12)
const FTIT = MB.fontes.titulo, FTXT = MB.fontes.texto || MB.fontes.titulo
const fT = (s, w) => `${w || FTIT.peso || 700} ${Math.round(s)}px "${FTIT.familia}"`
const fX = (s, w) => `${w || FTXT.peso || 500} ${Math.round(s)}px "${FTXT.familia}"`
const CAM = { modo: 'zoom', zoomMax: 2.6, ...(PARAMS.camera || {}) }
const RET = !HORIZONTAL

// ---------- a grade ----------
// área da grade no plano geral; o centro dela é a âncora: a câmera traz o cartão em foco para lá (no 9:16, o centro da
// área segura do Reels, longe dos botões da direita)
const GA = HORIZONTAL ? (() => { const x0 = Math.round(W * 0.06); return { x0, x1: W - x0, y0: 70, y1: H - 70 } })()
  : L({ '9x16': { x0: 80, x1: 940, y0: 270, y1: 1430 }, '1x1': { x0: 70, x1: 1010, y0: 70, y1: 1010 }, '4x5': { x0: 70, x1: 1010, y0: 80, y1: 1270 } })
GA.w = GA.x1 - GA.x0; GA.h = GA.y1 - GA.y0; GA.cx = (GA.x0 + GA.x1) / 2; GA.cy = (GA.y0 + GA.y1) / 2
const COLS = (PARAMS.colunas && PARAMS.colunas[FMT]) || L({ '16x9': 4, '9x16': 2, '1x1': 3, '4x5': 3 })
const PAC = BENTO.empacotar(PARAMS.cartoes.map((c) => c.tamanho || 'pequeno'), COLS)
const GAP = L({ '16x9': 26, '9x16': 22, '1x1': 22, '4x5': 22 })
const CEL = (() => {
  let w = (GA.w - (COLS - 1) * GAP) / COLS, h = (GA.h - (PAC.linhas - 1) * GAP) / PAC.linhas
  // célula nem alta nem larga demais: o que sobra vira margem, com a grade centrada
  h = Math.min(h, w * 1.25); w = Math.min(w, h * 2)
  return { w, h }
})()
const GW = COLS * CEL.w + (COLS - 1) * GAP, GH = PAC.linhas * CEL.h + (PAC.linhas - 1) * GAP
const RECTS = PAC.pos.map((p) => {
  const x = GA.cx - GW / 2 + p.c * (CEL.w + GAP), y = GA.cy - GH / 2 + p.l * (CEL.h + GAP)
  const w = p.w * CEL.w + (p.w - 1) * GAP, h = p.h * CEL.h + (p.h - 1) * GAP
  return { x, y, w, h, cx: x + w / 2, cy: y + h / 2 }
})
const U = Math.min(CEL.w, CEL.h)
// corpo mínimo do texto no plano geral (a câmera aproxima depois): 28 px no horizontal, como pede o refino
const MIN_T = HORIZONTAL ? 30 : 24, MIN_X = HORIZONTAL ? 28 : 22

// ---------- utilidades ----------
const _cv = document.createElement('canvas').getContext('2d')
const medir = (s, font) => { _cv.font = font; return _cv.measureText(s).width }
/** Quebra em até `max` linhas que cabem em `w`; null se não couber. */
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
/** progresso do item j de n dentro de k (0→1): cada um anda uma fatia `larg`, escalonado */
const escalona = (k, j, n, larg = 0.45) => { const a = n > 1 ? (j / (n - 1)) * (1 - larg) : 0; return P(k, a, a + larg) }
const numBR = (v) => String(Math.round(v)).replace(/\B(?=(\d{3})+(?!\d))/g, ',')
const PAL = (MB.cartoes && MB.cartoes.length ? MB.cartoes : [COR.cartao]).map((c) => (typeof c === 'string' ? { fundo: c } : c))

// ---------- mini-visuais: (caixa, v, R = { w, h }, x = cores e unidade) → (k, t, kq, tk) ----------
// k = progresso da animação de foco (0 = esqueleto, 1 = pronto); kq = o mesmo preso ao quadro de 60 fps (texto que muda);
// tk = segundos desde que k chegou a 1 (o que continua mexendo depois)
const VIS = {}

VIS.cores = (box, v, R, x) => {
  const rows = Array.isArray(v.cores[0]) ? v.cores : (() => {
    const n = v.cores.length, cols = v.colunas || Math.ceil(Math.sqrt((n * R.w) / R.h)), out = []
    for (let i = 0; i < n; i += cols) out.push(v.cores.slice(i, i + cols))
    return out
  })()
  const nl = rows.length, nc = Math.max(...rows.map((r) => r.length))
  const passo = Math.min(R.w / nc, R.h / nl), d = passo * 0.8
  const ox = (R.w - nc * passo) / 2, oy = (R.h - nl * passo) / 2
  const bolas = []
  rows.forEach((row, l) => row.forEach((cor, c) => {
    const b = div(box, { left: px(ox + c * passo + (passo - d) / 2), top: px(oy + l * passo + (passo - d) / 2), width: px(d), height: px(d), borderRadius: '50%', background: x.vazio })
    bolas.push({ b, cor })
  }))
  return (k) => bolas.forEach(({ b, cor }, j) => {
    const kj = escalona(k, j, bolas.length, 0.35)
    b.style.background = kj > 0.02 ? cor : x.vazio
    T(b, `scale(${0.55 + 0.45 * E.outBack(kj)})`)
  })
}

VIS.barras = (box, v, R, x) => {
  const vals = v.valores, n = vals.length, max = Math.max(...vals)
  const g = (R.w / n) * 0.3, bw = (R.w - g * (n - 1)) / n
  const cores = v.cores && v.cores.length ? v.cores : [x.destaque]
  const bs = vals.map((_, j) => div(box, { left: px(j * (bw + g)), width: px(bw), borderRadius: `${px(bw * 0.28)} ${px(bw * 0.28)} ${px(bw * 0.12)} ${px(bw * 0.12)}` }))
  return (k, t) => bs.forEach((b, j) => {
    const kj = escalona(k, j, n, 0.5)
    const vivo = k >= 1 ? 0.03 * Math.sin(t * 2.4 + j * 1.3) : 0
    const h = R.h * Math.max(0.08, lerp(0.12, vals[j] / max, E.outCubic(kj)) + vivo)
    b.style.height = px(h); b.style.top = px(R.h - h)
    b.style.background = kj > 0 ? cores[j % cores.length] : x.vazio
  })
}

VIS.numero = (box, v, R, x) => {
  const suf = v.sufixo || ''
  const temAnel = v.de > 0
  const dm = temAnel ? Math.min(R.h, R.w * 0.42) : 0
  const xt = temAnel ? dm + R.w * 0.06 : 0, wt = R.w - xt
  let s = Math.min(R.h * (temAnel ? 0.5 : 0.78), 400)
  const final = numBR(v.valor) + suf
  while (s > 20 && medir(final, fT(s)) > wt) s -= 2
  const n = div(box, { font: fT(s), color: v.cor || x.tinta, lineHeight: '1', whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }, final)
  marcar(n, 'texto', 'number')
  let rot = null
  const rs = Math.max(MIN_X, Math.round(s * 0.3))
  if (v.rotulo || temAnel) rot = div(box, { font: fX(rs, 600), color: x.tinta, whiteSpace: 'nowrap', lineHeight: '1.1' }, v.rotulo || `of ${numBR(v.de)}`)
  const hTot = s + (rot ? rs * 1.1 + s * 0.12 : 0)
  place(n, xt, (R.h - hTot) / 2)
  if (rot) { place(rot, xt + s * 0.04, (R.h - hTot) / 2 + s + s * 0.12); marcar(rot, 'texto') }
  let arco = null, comp = 0
  if (temAnel) {
    const sw = dm * 0.13, r = (dm - sw) / 2
    const s2 = sv('svg', { width: dm, height: dm }, box)
    Object.assign(s2.style, { position: 'absolute', left: '0', top: px((R.h - dm) / 2) })
    sv('circle', { cx: dm / 2, cy: dm / 2, r, fill: 'none', stroke: x.vazio, 'stroke-width': sw }, s2)
    arco = sv('circle', { cx: dm / 2, cy: dm / 2, r, fill: 'none', stroke: x.destaque, 'stroke-width': sw, 'stroke-linecap': 'round', transform: `rotate(-90 ${dm / 2} ${dm / 2})` }, s2)
    comp = 2 * Math.PI * r
    arco.setAttribute('stroke-dasharray', `${comp} ${comp}`)
  }
  return (k, t, kq) => {
    n.textContent = numBR(lerp(v.inicio || 0, v.valor, E.outCubic(P(kq, 0, 0.85)))) + suf
    if (arco) arco.setAttribute('stroke-dashoffset', comp * (1 - (v.valor / v.de) * E.outCubic(P(k, 0, 0.85))))
    if (rot) O(rot, E.outCubic(P(k, 0.35, 0.7)))
  }
}

VIS.linhas = (box, v, R, x) => {
  let y = 0
  let caret = null
  const els = []
  if (v.busca !== false) {
    const bh = Math.min(R.h * 0.24, U * 0.15)
    const b = div(box, { width: px(R.w), height: px(bh), borderRadius: px(bh / 2), background: x.ladrilho })
    const ls = bh * 0.42, s = sv('svg', { width: ls, height: ls }, b)
    Object.assign(s.style, { position: 'absolute', left: px(bh * 0.38), top: px((bh - ls) / 2) })
    sv('circle', { cx: ls * 0.42, cy: ls * 0.42, r: ls * 0.3, fill: 'none', stroke: x.tinta, 'stroke-width': ls * 0.12 }, s)
    sv('line', { x1: ls * 0.64, y1: ls * 0.64, x2: ls * 0.92, y2: ls * 0.92, stroke: x.tinta, 'stroke-width': ls * 0.13, 'stroke-linecap': 'round' }, s)
    caret = div(b, { left: px(bh * 0.38 + ls + bh * 0.25), top: px(bh * 0.28), width: px(Math.max(2, bh * 0.05)), height: px(bh * 0.44), background: x.tinta })
    els.push({ e: b, tipo: 'busca' })
    y = bh + R.h * 0.1
  }
  const n = v.linhas || 4, larg = [0.62, 0.94, 0.8, 0.88, 0.56, 0.74]
  const passo = (R.h - y) / n, lh = Math.min(passo * 0.42, U * 0.05)
  const ls = []
  for (let j = 0; j < n; j++) {
    const h = j === 0 ? lh * 1.35 : lh
    ls.push({ e: div(box, { top: px(y + j * passo + (passo - h) / 2), height: px(h), borderRadius: px(h / 2), background: j === 0 ? x.destaque : rgba(x.tinta, 0.22) }), w: R.w * larg[j % larg.length] })
  }
  return (k, t, kq, tk) => {
    ls.forEach((l, j) => { const kj = escalona(k, j, n, 0.5); l.e.style.width = px(Math.max(l.w * 0.08, l.w * E.outCubic(kj))) })
    if (caret) O(caret, k >= 1 ? (Math.floor(tk * 2.5) % 2 ? 0 : 1) : 1)
  }
}

VIS.slides = (box, v, R, x) => {
  const sh = Math.min(R.h * 0.74, R.w * 0.42 * (9 / 16)), sw = (sh * 16) / 9
  const cx = R.w / 2 - sw / 2, cy = R.h / 2 - sh / 2
  const lados = [-1, 1, 0]   // o do meio por último: fica por cima
  const th = lados.map((lado) => {
    const d = div(box, { left: px(cx), top: px(cy), width: px(sw), height: px(sh), borderRadius: px(sh * 0.08), background: v.fundo || x.ladrilho, overflow: 'hidden', transformOrigin: '50% 90%' })
    div(d, { left: '9%', top: '14%', width: '50%', height: '11%', borderRadius: px(sh * 0.04), background: x.tinta })
    div(d, { left: '9%', top: '36%', width: '36%', height: '6%', borderRadius: px(sh * 0.03), background: rgba(x.tinta, 0.25) })
    div(d, { left: '9%', top: '48%', width: '28%', height: '6%', borderRadius: px(sh * 0.03), background: rgba(x.tinta, 0.25) })
    div(d, { left: '58%', top: '14%', width: '33%', height: '68%', borderRadius: px(sh * 0.06), background: lado === 0 ? x.destaque : x.vazio })
    return { d, lado }
  })
  return (k, t) => th.forEach(({ d, lado }) => {
    const e = E.outBack(P(k, 0.05, 0.75), 1.2)
    const vivo = k >= 1 ? Math.sin(t * 1.4 + lado) * 1.2 : 0
    T(d, `translateX(${lado * sw * 0.52 * e}px) translateY(${(lado === 0 ? -sh * 0.06 : sh * 0.04) * e}px) rotate(${lado * 9 * e + vivo}deg)`)
  })
}

VIS.play = (box, v, R, x) => {
  const bh = Math.max(6, U * 0.035), g = R.h * 0.08
  const w = Math.min(R.w, ((R.h - bh - g) * 16) / 9), h = (w * 9) / 16
  const x0 = (R.w - w) / 2, y0 = (R.h - (h + g + bh)) / 2
  const tela = div(box, { left: px(x0), top: px(y0), width: px(w), height: px(h), borderRadius: px(h * 0.08), background: v.tela || x.tinta })
  const ts = h * 0.34, s = sv('svg', { width: ts, height: ts }, tela)
  Object.assign(s.style, { position: 'absolute', left: px((w - ts) / 2 + ts * 0.06), top: px((h - ts) / 2), transformOrigin: '50% 50%' })
  sv('path', { d: `M ${ts * 0.18} ${ts * 0.08} L ${ts * 0.92} ${ts * 0.5} L ${ts * 0.18} ${ts * 0.92} Z`, fill: v.icone || x.ladrilho, 'stroke-linejoin': 'round', stroke: v.icone || x.ladrilho, 'stroke-width': ts * 0.08 }, s)
  const trilho = div(box, { left: px(x0), top: px(y0 + h + g), width: px(w), height: px(bh), borderRadius: px(bh / 2), background: x.vazio })
  const ench = div(trilho, { height: '100%', borderRadius: px(bh / 2), background: x.destaque })
  return (k, t, kq, tk) => {
    T(s, `scale(${0.6 + 0.4 * E.outBack(P(k, 0, 0.45))})`)
    ench.style.width = `${Math.min(1, 0.06 + 0.5 * E.outCubic(P(k, 0.15, 1)) + 0.09 * tk) * 100}%`
  }
}

VIS.onda = (box, v, R, x) => {
  const trava = !!v.travada
  const ls = trava ? Math.min(R.h * 0.66, R.w * 0.26) : 0
  const ww = R.w - (trava ? ls + R.w * 0.07 : 0)
  const n = v.barras || 24, g = (ww / n) * 0.42, bw = (ww - g * (n - 1)) / n
  const bs = Array.from({ length: n }, (_, j) => div(box, { left: px(j * (bw + g)), width: px(bw), borderRadius: px(bw / 2), background: trava ? rgba(x.tinta, 0.3) : x.destaque }))
  let cad = null
  if (trava) {
    cad = sv('svg', { width: ls, height: ls }, box)
    Object.assign(cad.style, { position: 'absolute', left: px(R.w - ls), top: px((R.h - ls) / 2), transformOrigin: '50% 60%' })
    const bw2 = ls * 0.74, bh2 = ls * 0.56, bx = (ls - bw2) / 2, by = ls * 0.4
    sv('path', { d: `M ${ls * 0.3} ${by} V ${ls * 0.27} A ${ls * 0.2} ${ls * 0.2} 0 0 1 ${ls * 0.7} ${ls * 0.27} V ${by}`, fill: 'none', stroke: x.destaque, 'stroke-width': ls * 0.1, 'stroke-linecap': 'round' }, cad)
    sv('rect', { x: bx, y: by, width: bw2, height: bh2, rx: ls * 0.1, fill: x.destaque }, cad)
    sv('circle', { cx: ls / 2, cy: by + bh2 * 0.42, r: ls * 0.065, fill: x.fundo }, cad)
    sv('rect', { x: ls / 2 - ls * 0.03, y: by + bh2 * 0.42, width: ls * 0.06, height: bh2 * 0.3, rx: ls * 0.03, fill: x.fundo }, cad)
  }
  return (k, t) => {
    bs.forEach((b, j) => {
      const a = 0.22 + 0.78 * Math.abs(Math.sin(t * 3.3 + j * 0.73) * Math.sin(t * 1.9 + j * 0.29 + 1))
      const f = trava ? lerp(1, 0.14, E.inOutCubic(P(k, 0, 0.6))) : lerp(0.15, 1, E.outCubic(k))
      const h = Math.max(bw, R.h * 0.86 * a * f)
      b.style.height = px(h); b.style.top = px((R.h - h) / 2)
    })
    if (cad) { const e = P(k, 0.25, 0.7); O(cad, e > 0 ? 1 : 0); T(cad, `scale(${0.4 + 0.6 * E.outBack(e)}) rotate(${wob(k - 0.7, 3, 7) * 12}deg)`) }
  }
}

VIS.letras = (box, v, R, x) => {
  const txt = v.texto || 'Aa', pesos = v.pesos || [400, 500, 600, 700]
  const lado = R.w / R.h >= 1.25
  let s = Math.min(R.h * (lado ? 0.95 : 0.62), 520)
  while (s > 24 && medir(txt, fT(s, 700)) > R.w * (lado ? 0.55 : 0.95)) s -= 2
  const grande = textLine(box, [{ t: txt }], { font: fT(s, 700), color: x.tinta, left: '0', top: '0' })
  marcar(grande.line, 'texto', txt)
  const gw = medir(txt, fT(s, 700))
  const ps = Math.max(MIN_X, Math.round(lado ? Math.min(s * 0.3, (R.h - 20) / 2.6) : Math.min(s * 0.36, R.w / (pesos.length * 1.9))))
  const pequenos = pesos.map((p) => { const e = div(box, { font: fT(ps, p), color: x.tinta, whiteSpace: 'nowrap', lineHeight: '1' }, txt); marcar(e, 'texto'); return e })
  if (lado) {
    place(grande.line, 0, (R.h - s) / 2)
    const x0 = gw + R.w * 0.07, colw = (R.w - x0) / 2, lh = ps * 1.35
    pequenos.forEach((e, j) => place(e, x0 + (j % 2) * colw, (R.h - 2 * lh) / 2 + Math.floor(j / 2) * lh))
  } else {
    const hTot = s + ps * 1.4
    place(grande.line, (R.w - gw) / 2, (R.h - hTot) / 2)
    const pw = R.w / pesos.length
    pequenos.forEach((e, j) => place(e, j * pw + (pw - medir(txt, fT(ps, pesos[j]))) / 2, (R.h - hTot) / 2 + s + ps * 0.4))
  }
  return (k) => {
    riseWords(grande.words, k * 1.1, 0, 0, 0.5)
    pequenos.forEach((e, j) => { const kj = escalona(P(k, 0.3, 1), j, pequenos.length, 0.5); O(e, kj > 0 ? Math.max(0.001, E.outCubic(kj)) : 0); T(e, `translateY(${(1 - E.outCubic(kj)) * ps * 0.5}px)`) })
  }
}

VIS.imagens = (box, v, R, x) => {
  const ims = v.imagens.map((a) => (typeof a === 'string' ? { src: a } : a))
  const n = ims.length, cols = v.colunas || (n <= 3 ? n : Math.ceil(n / 2)), rows = Math.ceil(n / cols)
  const g = U * 0.05
  let tw = (R.w - g * (cols - 1)) / cols, th = (R.h - g * (rows - 1)) / rows
  if (v.proporcao) { const p = v.proporcao; if (tw / th > p) tw = th * p; else th = tw / p }
  const ox = (R.w - (cols * tw + (cols - 1) * g)) / 2, oy = (R.h - (rows * th + (rows - 1) * g)) / 2
  const cobre = v.ajuste === 'cobre'
  const ts = ims.map((im, j) => {
    const fundo = im.fundo || v.fundo || null
    const d = div(box, { left: px(ox + (j % cols) * (tw + g)), top: px(oy + Math.floor(j / cols) * (th + g)), width: px(tw), height: px(th), borderRadius: px(v.forma === 'livre' ? 0 : Math.min(tw, th) * 0.14), overflow: 'hidden', background: fundo ? x.vazio : 'transparent' })
    const pad = fundo && !cobre ? Math.min(tw, th) * (im.respiro ?? 0.2) : 0
    const img = imagem(d, im.src, { left: px(pad), top: px(pad), width: px(tw - 2 * pad), height: px(th - 2 * pad), objectFit: cobre ? 'cover' : 'contain', objectPosition: im.posicao || '50% 50%' })
    marcarImagem(img, `image ${j + 1} of "${v._cartao}"`)
    return { d, img, fundo }
  })
  return (k, t) => ts.forEach(({ d, img, fundo }, j) => {
    const kj = escalona(k, j, n, 0.55)
    if (fundo) d.style.background = kj > 0 ? fundo : x.vazio
    O(img, kj > 0 ? Math.max(0.001, E.outCubic(kj)) : 0)
    T(img, `scale(${(0.7 + 0.3 * E.outBack(kj)) * (cobre ? 1 + 0.012 * t : 1)})`)
  })
}

// ---------- o cartão ----------
function montarCartao(mundo, c, i) {
  const R = RECTS[i]
  const p = PAL[i % PAL.length]
  const fundo = c.cor || p.fundo, tinta = c.tinta || p.texto || COR.texto
  const card = div(mundo, { left: px(R.x), top: px(R.y), width: px(R.w), height: px(R.h), background: fundo, borderRadius: px(Math.min(MB.raio ?? 40, U * 0.14)), transformOrigin: '50% 50%' })
  const cont = div(card, { width: px(R.w), height: px(R.h) })
  const cab = div(cont, { width: px(R.w), height: px(R.h) })   // ícone, título e texto (some quando a câmera percorre o cartão)
  const pad = Math.round(U * 0.085), gap = Math.round(pad * 0.6)
  const tile = c.icone ? Math.round(U * 0.21) : 0
  const lado = R.w / R.h >= 1.75
  const colW = lado ? Math.round(R.w * (R.w / R.h >= 3 ? 0.36 : 0.44)) : R.w
  // título e texto: o maior corpo que cabe em 2 linhas; o texto sai se não couber nem no mínimo
  const txW = lado ? colW - pad - gap : R.w - 2 * pad - (tile ? tile + gap : 0)
  let tf = Math.max(MIN_T, Math.min(64, Math.round(U * 0.1))), tl = null
  for (; tf >= MIN_T * 0.8 && !(tl = linhasQueCabem(c.titulo, fT(tf), txW, 2)); tf -= 2);
  tl = tl || [c.titulo]
  let sf = Math.max(MIN_X, Math.round(tf * 0.74)), sl = null
  if (c.texto) for (; sf >= MIN_X * 0.85 && !(sl = linhasQueCabem(c.texto, fX(sf), txW, 2)); sf -= 2);
  const hTit = tl.length * tf * 1.12, hSub = sl ? gap * 0.6 + sl.length * sf * 1.25 : 0
  let tx, ty, vis
  if (lado) {
    tx = pad; ty = pad + (tile ? tile + gap : 0)
    if (sl && ty + hTit + hSub > R.h - pad) sl = null
    vis = { x: colW, y: pad, w: R.w - colW - pad, h: R.h - 2 * pad }
  } else {
    tx = pad + (tile ? tile + gap : 0)
    const hh = Math.max(tile, hTit + hSub)
    ty = pad + (hTit + hSub < tile ? (tile - hTit - hSub) / 2 : 0)
    vis = { x: pad, y: pad + hh + pad * 0.75, w: R.w - 2 * pad, h: R.h - (pad + hh + pad * 0.75) - pad }
  }
  if (c.texto && !sl) console.warn(`card "${c.titulo}": the text did not fit in this format (${FMT}) and was left out`)
  // onde o zoom-através do fecho mergulha: no ladrilho do ícone, acima do desenho (cor lisa); sem ícone, no meio do cartão
  const mergulho = tile ? { x: R.x + pad + tile / 2, y: R.y + pad + tile * 0.08, raio: tile * 0.08 } : { x: R.cx, y: R.cy, raio: Math.min(R.w, R.h) / 2 }
  if (tile) {
    const tb = div(cab, { left: px(pad), top: px(pad), width: px(tile), height: px(tile), borderRadius: px(tile * 0.28), background: COR.ladrilho })
    const ip = tile * 0.16
    marcarImagem(imagem(tb, c.icone, { left: px(ip), top: px(ip), width: px(tile - 2 * ip), height: px(tile - 2 * ip), objectFit: 'contain' }), `the icon of "${c.titulo}"`)
  }
  tl.forEach((s, j) => marcar(div(cab, { left: px(tx), top: px(ty + j * tf * 1.12), font: fT(tf), color: tinta, whiteSpace: 'nowrap', lineHeight: '1.12' }, s), 'texto', c.titulo))
  if (sl) sl.forEach((s, j) => marcar(div(cab, { left: px(tx), top: px(ty + hTit + gap * 0.6 + j * sf * 1.25), font: fX(sf), color: tinta, whiteSpace: 'nowrap', lineHeight: '1.25' }, s), 'texto', c.texto))
  let anima = null
  if (c.visual && vis.h >= U * 0.22 && vis.w >= U * 0.3) {
    const box = div(cont, { left: px(vis.x), top: px(vis.y), width: px(vis.w), height: px(vis.h) })
    anima = VIS[c.visual.tipo](box, { ...c.visual, _cartao: c.titulo }, { w: vis.w, h: vis.h }, { tinta, fundo, destaque: c.visual.destaque || COR.destaque, vazio: c.visual.vazio || COR.vazio, ladrilho: COR.ladrilho })
  } else if (c.visual) console.warn(`card "${c.titulo}": no room for the visual in this format (${FMT})`)
  return { card, cont, cab, anima, i, mergulho }
}

// ---------- câmera ----------
// estado { x, y, z }: o ponto (x, y) do mundo fica na âncora, com zoom z; o plano geral é a identidade
const ANC = { x: GA.cx, y: GA.cy }
const GERAL = { x: ANC.x, y: ANC.y, z: 1 }
const TRAV = CAM.modo === 'travelling'
const Z_TRAV = CAM.zoom || L({ '16x9': 1.8, '9x16': 1.6, '1x1': 1.6, '4x5': 1.6 })
/** O enquadramento de um cartão: { ini, fim }. O cartão cabe em 90% × 86% da área com o maior zoom (até zoomMax; no
 *  travelling, até o zoom dele). Zoom mínimo 1,3: o cartão que não cabe nele (o que ocupa a altura ou a largura inteira
 *  da grade) é percorrido durante a parada, do cabeçalho (em cima ou à esquerda) para o outro lado. */
function foco(i) {
  const r = RECTS[i], bw = GA.w * 0.9, bh = GA.h * 0.86
  let z = Math.min(bw / r.w, bh / r.h, CAM.zoomMax)
  if (TRAV) z = Math.min(z, Z_TRAV)
  z = Math.max(z, Math.min(1.3, CAM.zoomMax, TRAV ? Z_TRAV : 9))
  const sx = Math.max(0, r.w / 2 - bw / (2 * z)), sy = Math.max(0, r.h / 2 - bh / (2 * z))
  return { ini: { x: r.cx - sx, y: r.cy - sy, z }, fim: { x: r.cx + sx, y: r.cy + sy, z }, percorre: sx > 0 || sy > 0 }
}
const SEG = []
const seg = (t0, t1, de, para, ease, dip = 0) => SEG.push({ t0, t1, de, para, ease, dip })
let _c
if (PLANO.montagem === 'antes') { const m = PLANO.secoes[0]; _c = { ...GERAL, z: 1.06 }; seg(0, m.t1, _c, GERAL, E.inOutSine); _c = GERAL }
else _c = foco(PLANO.visitas[0].i).ini
for (const v of PLANO.visitas) {
  const f = foco(v.i)
  if (v.chega > v.t0) {
    const dist = Math.hypot(f.ini.x - _c.x, f.ini.y - _c.y)
    seg(v.t0, v.chega, _c, f.ini, TRAV ? E.inOutSine : E.inOutCubic, TRAV ? 0 : Math.min(0.2, dist / (W * 1.8)))
  }
  // parada: percorre o cartão grande; senão o zoom empurra devagar, e o travelling segue na direção do próximo
  const prox = PLANO.visitas[v.k + 1]
  let fim = f.percorre ? f.fim : { ...f.ini, z: f.ini.z * 1.035 }
  if (TRAV && prox && !f.percorre) { const g = foco(prox.i).ini; fim = { x: lerp(f.ini.x, g.x, 0.1), y: lerp(f.ini.y, g.y, 0.1), z: f.ini.z * 1.015 } }
  seg(v.chega, v.t1, f.ini, fim, E.inOutSine)
  _c = fim
}
const RC = PLANO.recuo, FE = PLANO.fecho
seg(RC.t0, RC.t0 + RC.mov, _c, GERAL, E.inOutCubic)
seg(RC.t0 + RC.mov, FE.t0 + FE.tr + 0.01, GERAL, { ...GERAL, z: 0.965 }, E.inOutSine)
function camAt(t) {
  let s = SEG[0]
  for (const x of SEG) { if (t >= x.t0) s = x; else break }
  const k = s.ease(P(t, s.t0, s.t1))
  let z = Math.exp(lerp(Math.log(s.de.z), Math.log(s.para.z), k))
  if (s.dip) z *= 1 - s.dip * Math.sin(Math.PI * k)
  return { x: lerp(s.de.x, s.para.x, k), y: lerp(s.de.y, s.para.y, k), z }
}
const naTela = (pt, c) => ({ x: ANC.x + (pt.x - c.x) * c.z, y: ANC.y + (pt.y - c.y) * c.z })

// quanto do conteúdo de cada cartão aparece: tudo no plano geral; na visita, só o do cartão em foco (os vizinhos que a
// câmera pega na borda ficam só com a cor, sem texto cortado fora da área segura)
function alfa(i, t) {
  const vs = PLANO.visitas
  let a = PLANO.montagem === 'antes' ? 1 - P(t, vs[0].t0, vs[0].t0 + 0.3) : 0
  for (const v of vs) if (v.i === i) a += P(t, v.t0 + 0.05, v.t0 + 0.4) * (1 - P(t, v.t1, v.t1 + 0.3))
  a += P(t, RC.t0 + 0.05, RC.t0 + 0.45)
  return clamp(a)
}
// o cartão grande que a câmera percorre: o cabeçalho sai do quadro no caminho, então some antes de a câmera parar com ele
// cortado na borda; volta no recuo
function alfaCabecalho(i, t) {
  const v = PLANO.visitas.find((x) => x.i === i)
  if (!v || !foco(i).percorre) return 1
  const d = v.t1 - v.chega
  return 1 - P(t, v.chega + 0.2 * d, v.chega + 0.55 * d) * (1 - P(t, v.t1 + 0.3, v.t1 + 0.35))
}
function progresso(i, t) {
  const v = PLANO.visitas.find((x) => x.i === i)
  return v ? P(t, v.chega - 0.12, v.chega + 0.95) : P(t, RC.t0 + 0.2, RC.t0 + 1.1)
}
const fimProgresso = (i) => { const v = PLANO.visitas.find((x) => x.i === i); return v ? v.chega + 0.95 : RC.t0 + 1.1 }

// ---------- a grade (fundo + mundo) ----------
const TRANS = FE.transicao, TRF = FE.tr
let CARTOES = []
/** O ponto (na tela, no início do fecho) em que o zoom-através mergulha: o ladrilho do ícone do cartão fecho.cartao. */
function pontoDoMergulho() {
  const m = CARTOES[(PARAMS.fecho && PARAMS.fecho.cartao) || 0].mergulho, c = camAt(FE.t0)
  return { ...naTela(m, c), raio: m.raio * c.z }
}
cena(0, FE.t0 + TRF + (TRF ? 0 : 0.001), (root) => {
  const fundo = camada(root, COR.fundo)
  const mundo = el('div', { cls: 'layer', style: { transformOrigin: '0 0' } }, fundo)
  const cards = CARTOES = PARAMS.cartoes.map((c, i) => montarCartao(mundo, c, i))
  const ent = PARAMS.entrada || 'pop'
  const oZoom = pontoDoMergulho()
  return (t) => {
    const c = camAt(t)
    T(mundo, `translate(${ANC.x}px,${ANC.y}px) scale(${c.z}) translate(${-c.x}px,${-c.y}px)`)
    for (const { card, cont, cab, anima, i } of cards) {
      const e = PLANO.entradas[i]
      if (t < e) { O(card, 0); continue }
      O(card, E.outCubic(P(t, e, e + 0.2)))
      T(card, ent === 'sobe' ? `translateY(${(1 - E.outExpo(P(t, e, e + 0.5))) * U * 0.35}px)` : `scale(${0.86 + 0.14 * spring(t - e, 2.4, 0.55)})`)
      O(cont, alfa(i, t))
      O(cab, alfaCabecalho(i, t))
      if (anima) { const fp = fimProgresso(i); anima(progresso(i, t), t, progresso(i, quadroDe(t)), Math.max(0, t - fp)) }
    }
    if (TRANS === 'zoom-through') TR.zoom.sai(fundo, t, FE.t0, TRF, { x: oZoom.x, y: oZoom.y, raio: oZoom.raio })
    else if (TRANS === 'push') TR.push.sai(fundo, t, FE.t0, TRF, { dir: 'esquerda' })
    else if (TRANS === 'whip') TR.whip.sai(fundo, t, FE.t0, TRF, { dir: 'esquerda' })
    else if (TRANS === 'virada') TR.virada.sai(fundo, t, FE.t0, TRF, { tipo: 'cartao', fundo: (PARAMS.fecho && PARAMS.fecho.fundo) || COR.fundo })
  }
}, 'grade')

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
    logo = div(cam, { font: fT(L({ '16x9': 140, '9x16': 130, '1x1': 110, '4x5': 120 })), color: F.cor || COR.texto, whiteSpace: 'nowrap', lineHeight: '1' }, MB.nome)
    const r = rectOf(logo); place(logo, CX - r.w / 2, CY - r.h / 2)
  }
  marcar(logo, 'logo', MB.nome)
  logo.style.transformOrigin = '50% 50%'
  const oZoom = pontoDoMergulho()
  return (t) => {
    if (TRANS === 'zoom-through') TR.zoom.entra(cam, t, FE.t0, TRF, { x: oZoom.x, y: oZoom.y })
    else if (TRANS === 'push') TR.push.entra(cam, t, FE.t0, TRF, { dir: 'esquerda' })
    else if (TRANS === 'whip') TR.whip.entra(cam, t, FE.t0, TRF, { dir: 'esquerda' })
    else if (TRANS === 'mascara') TR.mascara.entra(cam, t, FE.t0, TRF, { forma: 'circulo', x: CX, y: CY })
    else if (TRANS === 'virada') TR.virada.entra(cam, t, FE.t0, TRF, { tipo: 'cartao' })
    else { const k = spring(t - FE.t0, 2, 0.6); T(logo, `scale(${0.9 + 0.1 * k})`); O(logo, E.outCubic(P(t, FE.t0, FE.t0 + 0.2))) }
  }
}, 'fecho')
