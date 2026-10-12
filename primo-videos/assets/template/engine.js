/* Motor de motion design.
 * Tudo é função pura do tempo: renderAt(t) desenha o quadro do instante t. Nada de animação CSS,
 * Date.now() ou requestAnimationFrame nas cenas — é isso que deixa o render determinístico e permite
 * motion blur por subquadros.
 *
 * Ordem de carga (index.html): video.js → brand.js → engine.js → scenes.js → iniciar()
 * Formato pela URL: index.html?f=9x16 (padrão: VIDEO.formatos[0]). Prévia ao vivo: index.html?play
 */

// ---------- formato ----------
const FORMATOS = { '16x9': [1920, 1080], '19x9': [2280, 1080], '21x9': [2520, 1080], '9x16': [1080, 1920], '1x1': [1080, 1080], '4x5': [1080, 1350] }
const Q = new URLSearchParams(location.search)
const FMT = Q.get('f') || (VIDEO.formatos && VIDEO.formatos[0]) || '16x9'
if (!FORMATOS[FMT]) throw new Error(`unknown format: ${FMT}`)
const [W, H] = FORMATOS[FMT]
const CX = W / 2, CY = H / 2
const VERTICAL = H > W
const HORIZONTAL = W > H
/** Formatos mais largos que o 16:9 (19:9, 21:9): sem chave própria, herdam o valor do 16:9. */
const LARGO = W / H > 16 / 9 + 0.01
/** Valor por formato: L({ '16x9': 960, '9x16': 540 }). Sem a chave do formato: 19:9 e 21:9 usam o do 16:9; os
 *  outros (9:16, 4:5, 1:1) caem no 'padrao' e depois no primeiro valor, como sempre. */
const L = (o) => {
  if (o[FMT] !== undefined) return o[FMT]
  if (LARGO && o['16x9'] !== undefined) return o['16x9']
  return o.padrao !== undefined ? o.padrao : Object.values(o)[0]
}

// ---------- matemática ----------
const clamp = (x, a = 0, b = 1) => (x < a ? a : x > b ? b : x)
const lerp = (a, b, t) => a + (b - a) * t
/** Progresso 0→1 de t entre a e b (com trava). */
const P = (t, a, b) => clamp((t - a) / (b - a))
const E = {
  lin: (t) => t,
  inQuad: (t) => t * t,
  outQuad: (t) => 1 - (1 - t) * (1 - t),
  inCubic: (t) => t * t * t,
  outCubic: (t) => 1 - Math.pow(1 - t, 3),
  inOutCubic: (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
  outQuart: (t) => 1 - Math.pow(1 - t, 4),
  inOutQuart: (t) => (t < 0.5 ? 8 * t ** 4 : 1 - Math.pow(-2 * t + 2, 4) / 2),
  outQuint: (t) => 1 - Math.pow(1 - t, 5),
  inQuint: (t) => t ** 5,
  inOutQuint: (t) => (t < 0.5 ? 16 * t ** 5 : 1 - Math.pow(-2 * t + 2, 5) / 2),
  outExpo: (t) => (t >= 1 ? 1 : 1 - Math.pow(2, -10 * t)),
  inExpo: (t) => (t <= 0 ? 0 : Math.pow(2, 10 * t - 10)),
  inOutExpo: (t) => (t <= 0 ? 0 : t >= 1 ? 1 : t < 0.5 ? Math.pow(2, 20 * t - 10) / 2 : (2 - Math.pow(2, -20 * t + 10)) / 2),
  outBack: (t, s = 1.70158) => 1 + (s + 1) * Math.pow(t - 1, 3) + s * Math.pow(t - 1, 2),
  inBack: (t, s = 1.70158) => (s + 1) * t * t * t - s * t * t,
  inOutSine: (t) => -(Math.cos(Math.PI * t) - 1) / 2,
  outSine: (t) => Math.sin((t * Math.PI) / 2),
}
/** cubic-bezier(x1, y1, x2, y2) de verdade (o mesmo do CSS e do After Effects), resolvido por Newton com
 *  bisseção de reserva. Use para seguir as curvas de um manual de marca: const acende = bez(0.16, 1, 0.3, 1). */
function bez(x1, y1, x2, y2) {
  const bx = (s) => 3 * (1 - s) * (1 - s) * s * x1 + 3 * (1 - s) * s * s * x2 + s * s * s
  const by = (s) => 3 * (1 - s) * (1 - s) * s * y1 + 3 * (1 - s) * s * s * y2 + s * s * s
  return (t) => {
    if (t <= 0) return 0
    if (t >= 1) return 1
    let s = t
    for (let i = 0; i < 8; i++) {
      const x = bx(s) - t, dx = 3 * (1 - s) * (1 - s) * x1 + 6 * (1 - s) * s * (x2 - x1) + 3 * s * s * (1 - x2)
      if (Math.abs(x) < 1e-7) return by(s)
      if (Math.abs(dx) < 1e-6) break
      s = clamp(s - x / dx)
    }
    let lo = 0, hi = 1
    for (let i = 0; i < 40; i++) { s = (lo + hi) / 2; if (bx(s) < t) lo = s; else hi = s }
    return by(s)
  }
}
E.bez = bez
/** Resposta de mola (0→1 com overshoot). dt = t - início; f = frequência (Hz); z = amortecimento. */
function spring(dt, f = 2.2, z = 0.45) {
  if (dt <= 0) return 0
  const w = 2 * Math.PI * f
  if (z < 1) {
    const wd = w * Math.sqrt(1 - z * z)
    return 1 - Math.exp(-z * w * dt) * (Math.cos(wd * dt) + ((z * w) / wd) * Math.sin(wd * dt))
  }
  return 1 - Math.exp(-w * dt) * (1 + w * dt)
}
/** Oscilação amortecida que começa em 0 (tremor, squash). */
const wob = (dt, f = 3, d = 6) => (dt < 0 ? 0 : Math.exp(-d * dt) * Math.sin(2 * Math.PI * f * dt))
/** Pulso de escala que começa em 1+amp e assenta em 1 (acender um nó, bater num beat). */
const pulse = (dt, amp = 0.3, f = 2.5, d = 7) => (dt < 0 ? 1 : 1 + amp * Math.exp(-d * dt) * Math.cos(2 * Math.PI * f * dt))
/** Gerador pseudoaleatório com semente — nunca use Math.random nas cenas. */
function rng(seed) {
  return function () {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
const hex2rgb = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)]
/** Mistura duas cores hex. Cuidado: entre matizes distantes o meio fica sujo — prefira troca com "pop". */
function mix(a, b, t) {
  const x = hex2rgb(a), y = hex2rgb(b)
  return `rgb(${Math.round(lerp(x[0], y[0], t))},${Math.round(lerp(x[1], y[1], t))},${Math.round(lerp(x[2], y[2], t))})`
}
const rgba = (h, a) => { const x = hex2rgb(h); return `rgba(${x[0]},${x[1]},${x[2]},${a})` }

// ---------- DOM ----------
const stage = document.getElementById('stage')
stage.style.width = W + 'px'; stage.style.height = H + 'px'
document.documentElement.style.setProperty('--W', W + 'px')
document.documentElement.style.setProperty('--H', H + 'px')
if (VIDEO.fundo) stage.style.background = VIDEO.fundo
const NS = 'http://www.w3.org/2000/svg'
function el(tag, props = {}, parent) {
  const e = document.createElement(tag)
  for (const k in props) {
    if (k === 'style') Object.assign(e.style, props.style)
    else if (k === 'text') e.textContent = props.text
    else if (k === 'html') e.innerHTML = props.html
    else if (k === 'cls') e.className = props.cls
    else e.setAttribute(k, props[k])
  }
  if (parent) parent.appendChild(e)
  return e
}
function sv(tag, attrs = {}, parent) {
  const e = document.createElementNS(NS, tag)
  for (const k in attrs) e.setAttribute(k, attrs[k])
  if (parent) parent.appendChild(e)
  return e
}
/** SVG do tamanho do quadro, posicionado no canto — camada de desenho livre. */
function svgQuadro(parent) { const s = sv('svg', { width: W, height: H }, parent); Object.assign(s.style, { position: 'absolute', left: '0', top: '0' }); return s }
const px = (v) => v + 'px'
function place(e, x, y, w, h) {
  e.style.left = px(x); e.style.top = px(y)
  if (w != null) e.style.width = px(w)
  if (h != null) e.style.height = px(h)
}
const T = (e, s) => { e.style.transform = s }
const O = (e, o) => { e.style.opacity = o }
/** Retângulo em coordenadas do quadro. Meça na construção, antes de aplicar transformações. */
function rectOf(e) {
  const r = e.getBoundingClientRect(), s = stage.getBoundingClientRect()
  return { x: r.left - s.left, y: r.top - s.top, w: r.width, h: r.height, cx: r.left - s.left + r.width / 2, cy: r.top - s.top + r.height / 2 }
}
/** Centraliza horizontalmente um elemento absoluto em x (padrão: centro do quadro). */
function centrarX(e, x = CX) { e.style.left = px(x - rectOf(e).w / 2) }

// ---------- texto ----------
/** Linha de texto com máscara por palavra e span por letra.
 *  parts: [{ t: 'texto', style: {...} }] — cada parte pode ter estilo próprio (ênfase). */
function textLine(parent, parts, style) {
  const line = el('div', { cls: 'line', style }, parent)
  line.dataset.colisao = 'texto'   // alvo da checagem de colisão e de área segura (marcar(line, false) desliga)
  const words = [], chars = []
  for (const part of parts) {
    for (const tok of part.t.split(/( )/)) {
      if (tok === '') continue
      if (tok === ' ') { el('span', { text: ' ', style: { whiteSpace: 'pre', ...(part.style || {}) } }, line); continue }
      const mask = el('span', { cls: 'mask' }, line)
      const inner = el('span', { cls: 'inner', style: part.style || {} }, mask)
      const wc = []
      for (const ch of tok) { const s = el('span', { cls: 'ch', text: ch }, inner); wc.push(s); chars.push(s) }
      words.push({ mask, inner, chars: wc, part })
    }
  }
  return { line, words, chars }
}
/** Várias linhas centradas (ou alinhadas) a partir de um topo. linhas: [[parts], [parts]] */
function bloco(parent, linhas, { top, entrelinha, style, alinhar = 'centro', x = CX }) {
  return linhas.map((parts, i) => {
    const l = textLine(parent, parts, { ...style, left: '0', top: px(top + i * entrelinha) })
    if (alinhar === 'centro') centrarX(l.line, x)
    else l.line.style.left = px(x)
    return l
  })
}
const palavras = (ls) => ls.flatMap((l) => l.words)
const letras = (ls) => ls.flatMap((l) => l.chars)
/** Palavras sobem de dentro da máscara. */
function riseWords(words, t, t0, stagger = 0.06, dur = 0.55, ease = E.outExpo) {
  words.forEach((w, i) => {
    const e = ease(P(t, t0 + i * stagger, t0 + i * stagger + dur))
    T(w.inner, `translateY(${(1 - e) * 115}%)`)
  })
}
function riseChars(chars, t, t0, stagger = 0.025, dur = 0.5, ease = E.outExpo, from = 115) {
  chars.forEach((c, i) => {
    const e = ease(P(t, t0 + i * stagger, t0 + i * stagger + dur))
    T(c, `translateY(${(1 - e) * from}%)`)
  })
}
function exitWords(words, t, t0, stagger = 0.03, dur = 0.3) {
  words.forEach((w, i) => {
    const e = E.inCubic(P(t, t0 + i * stagger, t0 + i * stagger + dur))
    if (e > 0) T(w.inner, `translateY(${-e * 115}%)`)
  })
}
/** Letras caem com gravidade (depois de riscadas, por exemplo). A máscara precisa ficar visível. */
function quedaLetras(words, chars, t, t0, seed = 7) {
  const R = rng(seed)
  words.forEach((w) => { w.mask.style.overflow = t > t0 - 0.1 ? 'visible' : 'hidden' })
  chars.forEach((c, k) => {
    const vx = (R() - 0.5) * 260, vr = (R() - 0.5) * 420, g = 4200 + R() * 1800
    const tau = t - t0 - k * 0.018
    if (tau > 0) { T(c, `translate(${vx * tau}px, ${0.5 * g * tau * tau}px) rotate(${vr * tau}deg)`); c.style.opacity = 1 - P(tau, 0.12, 0.42) }
    else c.style.opacity = 1
  })
}
/** Digitação: revela n letras entre t0 e t1 (use com spans já posicionados, sem reflow). */
function digita(chars, t, t0, t1) {
  const n = Math.floor(chars.length * P(t, t0, t1))
  chars.forEach((c, i) => { c.style.opacity = i < n ? 1 : 0 })
  return n
}
/** Número que conta de a até b entre t0 e t1. */
/** Tempo do quadro de 60 fps que contém t: use em todo texto que muda com o tempo (número, relógio, "1,3×"). */
function quadroDe(t) { return Math.floor(t * 60 + 1e-4) / 60 }
function conta(e, t, t0, t1, a, b, casas = 0, ease = E.outCubic) {
  // o número fica preso ao quadro de 60 fps: no final com motion blur, cada subquadro mostraria um número
  // diferente e a média sai como dígito fantasma ("3779 × 2128" borrado). Vale também para texto que muda com t.
  t = quadroDe(t)
  e.textContent = lerp(a, b, ease(P(t, t0, t1))).toFixed(casas).replace('.', ',')
}

// ---------- traços ----------
/** Prepara um path para "desenhar" com dashoffset; devolve função (progresso 0→1). */
function traco(path) {
  const len = path.getTotalLength()
  path.setAttribute('stroke-dasharray', `${len} ${len}`)
  return (p) => path.setAttribute('stroke-dashoffset', len * (1 - p))
}
const STAR = 'M0,-1 C0.12,-0.12 0.12,-0.12 1,0 C0.12,0.12 0.12,0.12 0,1 C-0.12,0.12 -0.12,0.12 -1,0 C-0.12,-0.12 -0.12,-0.12 0,-1Z'

// ---------- formas orgânicas (morph por reamostragem) ----------
const hiddenSvg = sv('svg', { width: 0, height: 0, style: 'position:absolute' }, document.body)
const sampler = sv('path', {}, hiddenSvg)
function samplePath(d, n = 96) {
  sampler.setAttribute('d', d)
  const len = sampler.getTotalLength(), pts = []
  for (let i = 0; i < n; i++) { const p = sampler.getPointAtLength((len * i) / n); pts.push([p.x, p.y]) }
  return pts
}
function alignPts(a, b) {
  let best = 0, bd = Infinity
  const n = a.length
  for (let off = 0; off < n; off++) {
    let d = 0
    for (let i = 0; i < n; i += 3) { const q = b[(i + off) % n]; d += (a[i][0] - q[0]) ** 2 + (a[i][1] - q[1]) ** 2 }
    if (d < bd) { bd = d; best = off }
  }
  return b.map((_, i) => b[(i + best) % n])
}
function ptsToPath(pts) {
  const n = pts.length
  let d = `M${pts[0][0].toFixed(1)},${pts[0][1].toFixed(1)}`
  for (let i = 0; i < n; i++) {
    const p0 = pts[(i - 1 + n) % n], p1 = pts[i], p2 = pts[(i + 1) % n], p3 = pts[(i + 2) % n]
    d += `C${(p1[0] + (p2[0] - p0[0]) / 6).toFixed(1)},${(p1[1] + (p2[1] - p0[1]) / 6).toFixed(1)} ${(p2[0] - (p3[0] - p1[0]) / 6).toFixed(1)},${(p2[1] - (p3[1] - p1[1]) / 6).toFixed(1)} ${p2[0].toFixed(1)},${p2[1].toFixed(1)}`
  }
  return d + 'Z'
}
/** Forma orgânica procedural (viewBox 0 0 400 400), determinística pela semente. */
function formaOrganica(seed, lobos = 6, irregular = 0.22) {
  const R = rng(seed), n = 96, fases = Array.from({ length: 3 }, () => R() * Math.PI * 2)
  const amp = [irregular, irregular * 0.5, irregular * 0.25]
  const pts = []
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2
    const r = 150 * (1 + amp[0] * Math.sin(a * 2 + fases[0]) + amp[1] * Math.sin(a * 3 + fases[1]) + amp[2] * Math.sin(a * lobos + fases[2]))
    pts.push([200 + r * Math.cos(a), 200 + r * Math.sin(a)])
  }
  return pts
}
/** Formas da marca (paths em viewBox 400×400) ou procedurais, todas alinhadas para morph. */
const FORMAS = (() => {
  const src = (window.MARCA && MARCA.formas && MARCA.formas.length) ? MARCA.formas.map((d) => samplePath(d)) : Array.from({ length: 6 }, (_, i) => formaOrganica(11 + i * 7))
  return src.map((p, i) => (i === 0 ? p : alignPts(src[0], p)))
})()
function formaPts(a, b, m) {
  const A = FORMAS[a % FORMAS.length], B = FORMAS[b % FORMAS.length]
  return A.map((p, i) => [lerp(p[0], B[i][0], m), lerp(p[1], B[i][1], m)])
}
/** Blob: forma chapada (+ traço fino deslocado opcional). */
function makeBlob(parent, size, color, lineColor) {
  const s = sv('svg', { viewBox: '0 0 400 400', width: size, height: size }, parent)
  s.style.position = 'absolute'
  const line = lineColor ? sv('path', { fill: 'none', stroke: lineColor, 'stroke-width': 2.4, 'vector-effect': 'non-scaling-stroke' }, s) : null
  const fill = sv('path', { fill: color }, s)
  return {
    s, fill, line, size,
    set(x, y, sc, rot, a, b, m, col, lineOp = 1) {
      this.s.style.left = px(x - size / 2); this.s.style.top = px(y - size / 2)
      T(this.s, `rotate(${rot}deg) scale(${Math.max(sc, 0.0001)})`)
      const d = ptsToPath(formaPts(a, b, m))
      this.fill.setAttribute('d', d)
      if (col) this.fill.setAttribute('fill', col)
      if (this.line) {
        this.line.setAttribute('d', d)
        this.line.setAttribute('transform', 'translate(222 196) rotate(8) scale(1.1) translate(-200 -200)')
        this.line.style.opacity = lineOp
      }
    },
  }
}
/** Blob "respirando": deriva e morph lento entre formas vizinhas. */
function breathe(blob, t, x, y, sc, rot, a, phase = 0, col, lineOp) {
  const m = 0.5 + 0.5 * Math.sin(t * 1.1 + phase)
  blob.set(x + Math.sin(t * 0.7 + phase) * 10, y + Math.cos(t * 0.6 + phase) * 10, sc, rot + Math.sin(t * 0.5 + phase) * 4, a, a + 1, m * 0.35, col, lineOp)
}

// ---------- logo em partes ----------
/** Monta as partes de um logo (MARCA.logo.partes = [{ d, fill, nome }]) dentro de um <g>.
 *  Cada parte ganha um <g> próprio para ser animada em torno do próprio centro. */
function logoPartes(g, partes) {
  return partes.map((pt) => {
    const wrap = sv('g', {}, g)
    const p = sv('path', { d: pt.d, fill: pt.fill, ...(pt.transform ? { transform: pt.transform } : {}) }, wrap)
    return { wrap, p, nome: pt.nome }
  })
}
/** Chame depois que o SVG estiver no DOM e visível (getBBox precisa de layout). O centro é medido no
 *  espaço do <g> da parte (já com o transform próprio da parte aplicado). */
function medirPartes(ps) { for (const q of ps) { const bb = q.wrap.getBBox(); q.c = [bb.x + bb.width / 2, bb.y + bb.height / 2]; q.bb = bb } }
function setParte(q, dx, dy, rot, sx, sy = sx) {
  const [cx, cy] = q.c
  q.wrap.setAttribute('transform', `translate(${cx + dx} ${cy + dy}) rotate(${rot}) scale(${sx} ${sy}) translate(${-cx} ${-cy})`)
}
/** Ponto mais "gordo" dentro de um path (para mergulhar a câmera nele sem vazar pela borda). */
function pontoInterno(path) {
  const bb = path.getBBox()
  let best = { x: bb.x + bb.width / 2, y: bb.y + bb.height / 2, r: 0 }
  for (let gx = bb.x; gx < bb.x + bb.width; gx += bb.width / 22) {
    for (let gy = bb.y; gy < bb.y + bb.height; gy += bb.height / 16) {
      if (!path.isPointInFill(new DOMPoint(gx, gy))) continue
      let r = 5
      fora: for (; r < 400; r += 5) {
        for (let a = 0; a < 16; a++) {
          if (!path.isPointInFill(new DOMPoint(gx + r * Math.cos((a * Math.PI) / 8), gy + r * Math.sin((a * Math.PI) / 8)))) break fora
        }
      }
      if (r > best.r) best = { x: gx, y: gy, r }
    }
  }
  return best
}
/** Raio que cobre o quadro inteiro a partir de (x, y) — para íris e expansões. */
const raioCobre = (x, y) => Math.max(Math.hypot(x, y), Math.hypot(W - x, y), Math.hypot(x, H - y), Math.hypot(W - x, H - y)) * 1.02
/** Íris: recorta um elemento num círculo que cresce. */
function iris(e, r, x, y) { e.style.clipPath = r >= raioCobre(x, y) ? 'none' : `circle(${Math.max(0, r)}px at ${x}px ${y}px)` }

// ---------- imagens e trechos de vídeo ----------
// O render captura quadros de forma síncrona, então toda imagem precisa estar decodificada ANTES do
// primeiro quadro. imagem() e clipe() registram a espera; iniciar() aguarda tudo.
// Sequências longas (tela gravada, centenas de quadros grandes) não cabem na memória: trocam o src a
// cada quadro e põem a decodificação em ESPERA_QUADRO — o renderAt(t) devolve uma Promise e o render
// só captura depois que a imagem do instante t decodificou.
const ESPERAR = []
const ESPERA_QUADRO = []
/** <img> absoluto já carregado (foto, print, ilustração). Use object-fit/transform para enquadrar. */
function imagem(parent, src, style = {}) {
  const im = el('img', { src, style: { position: 'absolute', left: '0', top: '0', ...style } }, parent)
  ESPERAR.push(im.decode().catch(() => console.error('IMAGE DID NOT LOAD: ' + src)))
  return im
}
/** Trecho de vídeo como sequência de quadros (extraia antes com
 *    ffmpeg -i gravacao.mp4 -vf "fps=30,scale=1080:-1" media/clipe/q%04d.jpg
 *  e passe os nomes). Devolve { el, set(t, t0) } — mostra o quadro de (t - t0) * fps, deterministicamente. */
function clipe(parent, arquivos, fps = 30, style = {}) {
  const box = el('div', { style: { position: 'absolute', overflow: 'hidden', ...style } }, parent)
  const ims = arquivos.map((src) => imagem(box, src, { width: '100%', height: '100%', objectFit: 'cover', display: 'none' }))
  let atual = -1
  return {
    el: box,
    set(t, t0 = 0) {
      const i = clamp(Math.floor((t - t0) * fps), 0, ims.length - 1)
      if (i !== atual) { if (atual >= 0) ims[atual].style.display = 'none'; ims[i].style.display = 'block'; atual = i }
    },
  }
}
/** Sequência longa de quadros (tela gravada): um <img> só, que troca de arquivo conforme o tempo.
 *  quadros = [[arquivo, tempo], …] em ordem de tempo. set(tv) mostra o quadro de tempo ≤ tv. */
function sequencia(parent, quadros, style = {}) {
  const im = el('img', { style: { position: 'absolute', left: '0', top: '0', ...style } }, parent)
  const ts = quadros.map((q) => q[1])
  let atual = null
  return {
    el: im,
    set(tv) {
      let lo = 0, hi = ts.length - 1
      while (lo < hi) { const m = (lo + hi + 1) >> 1; if (ts[m] <= tv) lo = m; else hi = m - 1 }
      const src = quadros[lo][0]
      if (src !== atual) { atual = src; im.src = src; ESPERA_QUADRO.push(im.decode().catch(() => console.error('FRAME DID NOT LOAD: ' + src))) }
      return lo
    },
  }
}

// ---------- câmera ----------
/** Câmera sobre um conteúdo cw×ch mostrado numa janela vw×vh (foto, print, tela gravada, o quadro todo).
 *  chaves = [{ t, x, y, z, dur? }]: no instante t a câmera está centrada no ponto (x, y) do conteúdo com
 *  zoom z (1 = o conteúdo cobre a janela). `dur` é quanto tempo leva para chegar nessa chave (padrão 0,7 s),
 *  com easing E.inOutCubic (ou `ease` da chave); zoom interpolado em escala logarítmica.
 *  O zoom fica em [1, zmax] e o centro é travado para a janela nunca mostrar fora do conteúdo.
 *  zmax = resolução de origem ÷ tamanho na tela (acima disso a imagem amolece). Devolve (t) => {x, y, z}. */
function camera(chaves, { cw = W, ch = H, vw = cw, vh = ch, zmax = 3 } = {}) {
  const ks = chaves.slice().sort((a, b) => a.t - b.t)
  const base = Math.max(vw / cw, vh / ch)
  const trava = (x, y, z) => {
    z = clamp(z, 1, zmax)
    const hw = vw / (2 * base * z), hh = vh / (2 * base * z)
    return { x: clamp(x, Math.min(hw, cw / 2), Math.max(cw - hw, cw / 2)), y: clamp(y, Math.min(hh, ch / 2), Math.max(ch - hh, ch / 2)), z }
  }
  const fn = (t) => {
    if (!ks.length) return trava(cw / 2, ch / 2, 1)
    let cur = trava(ks[0].x, ks[0].y, ks[0].z)
    for (let i = 1; i < ks.length; i++) {
      const k = ks[i], d = k.dur != null ? k.dur : 0.7
      if (t < k.t - d) break
      const alvo = trava(k.x, k.y, k.z)
      const e = (k.ease || E.inOutCubic)(P(t, k.t - d, k.t))
      cur = { x: lerp(cur.x, alvo.x, e), y: lerp(cur.y, alvo.y, e), z: Math.exp(lerp(Math.log(cur.z), Math.log(alvo.z), e)) }
    }
    return trava(cur.x, cur.y, cur.z)
  }
  fn.base = base; fn.opts = { cw, ch, vw, vh, zmax }
  return fn
}
/** Aplica o estado da câmera num elemento (transformOrigin 0 0) que contém o conteúdo cw×ch. */
function aplicarCamera(e, cam, t) {
  const { x, y, z } = cam(t), { vw, vh } = cam.opts, s = cam.base * z
  e.style.transformOrigin = '0 0'
  T(e, `translate(${vw / 2}px,${vh / 2}px) scale(${s}) translate(${-x}px,${-y}px)`)
  return { x, y, z }
}

/** Ken Burns: zoom/pan lento numa imagem entre t0 e t1 (de/para = [escala, x%, y%]). */
function kenBurns(e, t, t0, t1, de = [1.0, 50, 50], para = [1.12, 50, 45]) {
  const k = E.inOutSine(P(t, t0, t1))
  e.style.transformOrigin = `${lerp(de[1], para[1], k)}% ${lerp(de[2], para[2], k)}%`
  T(e, `scale(${lerp(de[0], para[0], k)})`)
}

// ---------- transições ----------
/* Toda transição tem dois lados, chamados no update das duas cenas, que se sobrepõem no tempo:
 *   TR.whip.sai(camA, t, t0, dur, opts)     no update da cena que sai
 *   TR.whip.entra(camB, t, t0, dur, opts)   no update da cena que entra (registrada depois = fica por cima)
 * A camada é uma div de tela cheia dentro do root, com o fundo da cena: const cam = camada(root, cor).
 * O root fica SEM fundo (ele recebe o tremor e cobriria a outra cena; o motor acusa no console).
 * Chame sempre, sem if: antes de t0 o `entra` esconde a camada, depois de t0+dur o `sai` esconde, e fora da
 * janela nada é pintado. A camada é da transição: o motor devolve transform, filtro, recorte e opacidade dela
 * ao original a cada quadro — anime o que está DENTRO dela. Cada chamada registra { nome, t0, dur } em
 * TRANSICOES (a folha de contato automática acha os cortes por aí). Catálogo e sons: references/transitions.md */
const TRANSICOES = []
const _chavesTr = new Set()
/** Registra uma transição feita à mão para a folha --auto e para a checagem de colisão (que não acusa
 *  cobertura dentro da janela de uma transição). As do TR já se registram sozinhas. */
function registrarTransicao(nome, t0, dur) {
  const k = `${nome}@${t0}+${dur}`
  if (_chavesTr.has(k)) return
  _chavesTr.add(k); TRANSICOES.push({ nome, t0, dur })
}
const TOCADOS = new Map()
/** Escreve um estilo guardando o valor original, que volta no começo de cada renderAt. */
function tocar(e, prop, v) {
  let o = TOCADOS.get(e)
  if (!o) { o = {}; TOCADOS.set(e, o) }
  if (!(prop in o)) o[prop] = e.style[prop]
  e.style[prop] = v
}
function _restaurarTocados() { for (const [e, o] of TOCADOS) for (const k in o) e.style[k] = o[k] }
/** Camada de tela cheia (com fundo) dentro do root: é nela que as transições atuam. */
function camada(root, fundo) { return el('div', { cls: 'layer', style: fundo ? { background: fundo } : {} }, root) }
const raizDe = (e) => (e.closest && e.closest('.scene')) || e
const _alfa = (c) => { if (!c || c === 'transparent' || c === 'none') return 0; const m = c.match(/rgba?\(([^)]+)\)/); if (!m) return 1; const v = m[1].split(/[\s,/]+/).filter(Boolean); return v.length > 3 ? parseFloat(v[3]) : 1 }
const _conferidas = new WeakSet()
function _conferirRaiz(e, nome) {
  if (_conferidas.has(e)) return
  _conferidas.add(e)
  const r = raizDe(e)
  if (r === e) return
  const cs = getComputedStyle(r)
  if (_alfa(cs.backgroundColor) > 0 || cs.backgroundImage !== 'none') {
    const c = CENAS.find((x) => x.root === r)
    console.error(`TRANSITION ${nome}: the root of scene ${c ? `"${c.nome || c.t0 + '–' + c.t1 + ' s'}"` : ''} has its own background and covers the other scene during the transition — put the background on a layer: const cam = camada(root, cor)`)
  }
}
function _lado(nome, lado, fn) {
  return (e, t, t0, dur, o = {}) => {
    const sub = o.forma || o.tipo
    registrarTransicao(sub ? `${nome}/${sub}` : nome, t0, dur)
    _conferirRaiz(e, nome)
    if (t < t0) { if (lado === 'entra') tocar(e, 'display', 'none'); return }
    if (t >= t0 + dur) { if (lado === 'sai') tocar(e, 'display', 'none'); return }
    fn(e, t, t0, dur, o, (t - t0) / dur, lado)
  }
}
/** Elemento extra de uma transição (lâmina, forma, sombra): nasce escondido e só aparece dentro da janela. */
function _extra(chave, e, criar) {
  e.__extras = e.__extras || {}
  if (!e.__extras[chave]) { const x = criar(); x.style.display = 'none'; e.__extras[chave] = x }
  const x = e.__extras[chave]
  tocar(x, 'display', 'block')
  return x
}
let _nFiltro = 0
function _blurDirecional(e, bx, by) {
  if (bx < 0.3 && by < 0.3) return tocar(e, 'filter', 'none')
  if (!e.__blur) {
    const id = 'trblur' + _nFiltro++
    const f = sv('filter', { id, x: '-20%', y: '-20%', width: '140%', height: '140%', 'color-interpolation-filters': 'sRGB' }, hiddenSvg)
    e.__blur = { id, g: sv('feGaussianBlur', { stdDeviation: '0 0' }, f) }
  }
  e.__blur.g.setAttribute('stdDeviation', `${bx.toFixed(2)} ${by.toFixed(2)}`)
  tocar(e, 'filter', `url(#${e.__blur.id})`)
}
const _DIRS = { esquerda: [-1, 0], direita: [1, 0], cima: [0, -1], baixo: [0, 1] }
function _desliza(e, t, t0, dur, o, p, lado, blur) {
  const ease = o.ease || (blur ? E.inOutExpo : E.inOutCubic)
  const [dx, dy] = _DIRS[o.dir || 'esquerda'] || _DIRS.esquerda, dist = dx ? W : H
  const pos = (tt) => ease(P(tt, t0, t0 + dur))
  const k = pos(t), rec = lado === 'sai' && o.recuo != null ? o.recuo : 1
  const off = lado === 'sai' ? k * dist * rec : -(1 - k) * dist
  tocar(e, 'transform', `translate3d(${(dx * off).toFixed(2)}px,${(dy * off).toFixed(2)}px,0)`)
  if (lado === 'sai' && rec < 1) tocar(e, 'filter', `brightness(${(1 - 0.45 * k).toFixed(3)})`)
  if (!blur) return
  // desfoque na direção do movimento, proporcional à velocidade (px/s): o draft já sai com cara de chicote
  const h = 1 / 240, v = Math.abs((pos(t + h) - pos(t - h)) / (2 * h)) * dist
  const b = Math.min(o.blurMax != null ? o.blurMax : 70, v * 0.0022 * (o.blur != null ? o.blur : 1))
  _blurDirecional(e, dx ? b : 0, dy ? b : 0)
  // a camada de baixo estende o fundo por trás da emenda; sem isso as duas bordas desfocadas deixam o palco vazar
  if (lado === 'sai' && b >= 0.3) {
    if (e.__fundo === undefined) e.__fundo = getComputedStyle(e).backgroundColor
    if (_alfa(e.__fundo) > 0) { const ext = Math.min(3 * b, 240); tocar(e, 'boxShadow', `${(-dx * ext).toFixed(1)}px ${(-dy * ext).toFixed(1)}px 0 0 ${e.__fundo}`) }
  }
}
const TR = {}
/** whip-pan: A sai e B entra lado a lado, com desfoque direcional pela velocidade.
 *  opts: dir 'esquerda'|'direita'|'cima'|'baixo' (para onde o conteúdo vai), ease (E.inOutExpo), blur (fator, 1), blurMax (70 px). */
TR.whip = { sai: _lado('whip', 'sai', (e, t, t0, dur, o, p) => _desliza(e, t, t0, dur, o, p, 'sai', true)),
            entra: _lado('whip', 'entra', (e, t, t0, dur, o, p) => _desliza(e, t, t0, dur, o, p, 'entra', true)) }
/** push: B empurra A, sem desfoque. opts: dir, ease (E.inOutCubic), recuo (só no sai: 0,3 = A anda 30% e escurece, B passa por cima). */
TR.push = { sai: _lado('push', 'sai', (e, t, t0, dur, o, p) => _desliza(e, t, t0, dur, o, p, 'sai', false)),
            entra: _lado('push', 'entra', (e, t, t0, dur, o, p) => _desliza(e, t, t0, dur, o, p, 'entra', false)) }
/** zoom-through: A cresce exponencialmente no ponto (x, y) e B nasce de dentro (escala `nasce` → 1), por cima, com cruzamento no meio.
 *  opts: x, y (CX, CY — escolha um ponto com sentido, ex. pontoInterno de uma forma), raio (px da forma em volta do ponto: calcula
 *  zmax = 1,25·raioCobre/raio para a cor da forma encher a tela), zmax (14 sem raio), nasce (0,6), blur (6 px), ease (E.inCubic, só no A). */
TR.zoom = {
  sai: _lado('zoom', 'sai', (e, t, t0, dur, o, p) => {
    const x = o.x != null ? o.x : CX, y = o.y != null ? o.y : CY
    const zmax = o.zmax || (o.raio ? (1.25 * raioCobre(x, y)) / o.raio : 14)
    const z = Math.exp(Math.log(zmax) * (o.ease || E.inCubic)(P(p, 0, 0.5)))   // enche a tela na metade; aí B nasce   // já está fundo quando B surge
    tocar(e, 'transformOrigin', '0 0')
    tocar(e, 'transform', `translate(${x}px,${y}px) scale(${z.toFixed(4)}) translate(${-x}px,${-y}px)`)
    const b = (o.blur != null ? o.blur : 6) * E.inQuad(P(p, 0, 0.5))
    tocar(e, 'filter', b > 0.2 ? `blur(${b.toFixed(2)}px)` : 'none')
  }),
  entra: _lado('zoom', 'entra', (e, t, t0, dur, o, p) => {
    const x = o.x != null ? o.x : CX, y = o.y != null ? o.y : CY
    const s = lerp(o.nasce != null ? o.nasce : 0.6, 1, E.outCubic(P(p, 0.5, 1)))
    tocar(e, 'transformOrigin', '0 0')
    tocar(e, 'transform', `translate(${x}px,${y}px) scale(${s.toFixed(4)}) translate(${-x}px,${-y}px)`)
    tocar(e, 'opacity', E.inOutSine(P(p, 0.5, 0.72)).toFixed(3))
    const b = (o.blur != null ? o.blur : 6) * (1 - E.outCubic(P(p, 0.5, 0.85)))
    tocar(e, 'filter', b > 0.2 ? `blur(${b.toFixed(2)}px)` : 'none')
  }),
}
const _poli = (pts) => `polygon(${pts.map(([x, y]) => `${x.toFixed(1)}px ${y.toFixed(1)}px`).join(',')})`
function _recorte(o, p, lado) {
  const forma = o.forma || 'circulo'
  if (forma === 'circulo') {
    const x = o.x != null ? o.x : CX, y = o.y != null ? o.y : CY, k = (o.ease || E.inOutCubic)(p)
    return `circle(${(raioCobre(x, y) * (lado === 'entra' ? k : 1 - k)).toFixed(1)}px at ${x}px ${y}px)`
  }
  if (forma === 'diagonal') {
    const a = ((o.angulo != null ? o.angulo : 20) * Math.PI) / 180, d = [Math.cos(a), Math.sin(a)], n = [-d[1], d[0]]
    const pr = [[0, 0], [W, 0], [0, H], [W, H]].map(([x, y]) => x * d[0] + y * d[1])
    const c = lerp(Math.min(...pr) - 2, Math.max(...pr) + 2, (o.ease || E.inOutCubic)(p)), M = 3 * (W + H), s = lado === 'entra' ? -1 : 1
    const q = [c * d[0], c * d[1]]
    return _poli([[q[0] + M * n[0], q[1] + M * n[1]], [q[0] - M * n[0], q[1] - M * n[1]],
      [q[0] - M * n[0] + s * M * d[0], q[1] - M * n[1] + s * M * d[1]], [q[0] + M * n[0] + s * M * d[0], q[1] + M * n[1] + s * M * d[1]]])
  }
  if (forma === 'barras') {
    const n = o.n || 5, vert = o.direcao === 'vertical', esp = o.escalonar != null ? o.escalonar : 0.45, ease = o.ease || E.inOutCubic
    const L0 = vert ? H : W, lg = (vert ? W : H) / n
    let d = ''
    for (let i = 0; i < n; i++) {
      const a = n > 1 ? (i * esp) / (n - 1) : 0, k = ease(P(p, a, a + 1 - esp))
      const inv = o.alterna && i % 2 === 1
      let u0 = lado === 'entra' ? 0 : k * L0, u1 = lado === 'entra' ? k * L0 : L0
      if (inv) [u0, u1] = [L0 - u1, L0 - u0]
      if (u1 - u0 < 0.5) continue
      const v0 = i * lg - 0.5, v1 = (i + 1) * lg + 0.5
      const [x0, y0, x1, y1] = vert ? [v0, u0, v1, u1] : [u0, v0, u1, v1]
      d += `M${x0.toFixed(1)} ${y0.toFixed(1)}H${x1.toFixed(1)}V${y1.toFixed(1)}H${x0.toFixed(1)}Z`
    }
    return d ? `path("${d}")` : 'polygon(0 0,0 0,0 0)'
  }
  throw new Error(`TR.mascara: unknown shape "${forma}" (circulo, diagonal, barras, lamina)`)
}
/** Instante (0–1) em que uma curva passa de 0,5 — é o corte da lâmina. */
function _meioDaCurva(ease) { let lo = 0, hi = 1; for (let i = 0; i < 30; i++) { const m = (lo + hi) / 2; if (ease(m) < 0.5) lo = m; else hi = m } return (lo + hi) / 2 }
function _lamina(e, t, t0, dur, o, p, lado) {
  const ease = o.ease || E.inOutCubic, pc = _meioDaCurva(ease)
  if (p >= pc) { if (lado === 'sai') tocar(e, 'display', 'none') } else if (lado === 'entra') tocar(e, 'display', 'none')
  if (lado === 'sai') return
  const ang = ((o.angulo != null ? o.angulo : 30) * Math.PI) / 180, k = (Math.tan(ang) * H) / 2
  const bw = W + 2 * k + 40, c0 = -(bw / 2 + k) - 10, c1 = W + bw / 2 + k + 10
  const esq = o.dir === 'esquerda'
  const poli = (c) => _poli([[c - bw / 2 + k, 0], [c + bw / 2 + k, 0], [c + bw / 2 - k, H], [c - bw / 2 - k, H]].map(([x, y]) => [esq ? W - x : x, y]))
  const mk = () => el('div', { cls: 'layer' })
  const frente = _extra('laminaFrente', e, () => { const d = mk(); e.after(d); return d })   // fina, na frente
  const corpo = _extra('laminaCorpo', e, () => { const d = mk(); frente.after(d); return d })  // cobre o quadro no corte
  frente.style.background = o.cor2 || (window.MARCA && MARCA.cores && MARCA.cores.a) || '#FF6B4A'
  corpo.style.background = o.cor || (window.MARCA && MARCA.cores && (MARCA.cores.tinta || MARCA.cores.escuro)) || '#111'
  const atraso = o.atraso != null ? o.atraso : 0.07 * dur
  frente.style.clipPath = poli(lerp(c0, c1, ease(P(t + atraso, t0, t0 + dur))))
  corpo.style.clipPath = poli(lerp(c0, c1, ease(p)))
}
/** máscara: B (por cima) é revelada por uma forma. opts.forma:
 *  'circulo'  íris a partir de (x, y) — um ponto com sentido (botão, palavra, notificação)
 *  'diagonal' wipe reto; angulo = direção do avanço em graus (0 = da esquerda pra direita, 90 = de cima pra baixo; padrão 20)
 *  'barras'   n faixas (5) escalonadas; direcao 'horizontal'|'vertical', escalonar (0,45), alterna (bool)
 *  'lamina'   lâmina dupla inclinada (angulo 30) na cor `cor`, com a lâmina fina `cor2` na frente; cobre o quadro
 *             inteiro exatamente no corte (meio da curva) — B aparece ali. dir 'direita'|'esquerda', atraso (s).
 *  `sai` é o inverso, para quando a cena que sai está por cima (se recolhe na mesma forma); na lâmina, esconde A no corte. */
TR.mascara = {
  sai: _lado('mascara', 'sai', (e, t, t0, dur, o, p) => (o.forma === 'lamina' ? _lamina(e, t, t0, dur, o, p, 'sai') : tocar(e, 'clipPath', _recorte(o, p, 'sai')))),
  entra: _lado('mascara', 'entra', (e, t, t0, dur, o, p) => (o.forma === 'lamina' ? _lamina(e, t, t0, dur, o, p, 'entra') : tocar(e, 'clipPath', _recorte(o, p, 'entra')))),
}
function _cartao(e, p, o, lado) {
  const th = 180 * (o.ease || E.inOutCubic)(p), frente = th < 90
  if (lado === 'sai' ? !frente : frente) return tocar(e, 'display', 'none')
  const a = (lado === 'sai' ? th : th - 180) * (o.dir === 'esquerda' ? -1 : 1), M = Math.max(W, H)
  const persp = o.perspectiva || 2.4 * M, rec = (o.recuo != null ? o.recuo : 0.35) * M * Math.sin(Math.PI * p)
  tocar(e, 'transformOrigin', '50% 50%'); tocar(e, 'backfaceVisibility', 'hidden')
  tocar(e, 'transform', `perspective(${persp}px) translateZ(${(-rec).toFixed(1)}px) ${o.eixo === 'x' ? 'rotateX' : 'rotateY'}(${a.toFixed(3)}deg)`)
  tocar(e, 'filter', `brightness(${(1 - 0.3 * Math.abs(Math.sin((a * Math.PI) / 180))).toFixed(3)})`)
  if (o.fundo && lado === 'sai') { const f = _extra('fundoCartao', e, () => { const d = el('div', { cls: 'layer' }); e.before(d); return d }); f.style.background = o.fundo }
}
function _pagina(e, p, o, lado) {
  const esq = o.dir !== 'direita', th = 90 * (o.ease || ((x) => x * (0.55 + 0.45 * x)))(p), rad = (th * Math.PI) / 180
  const sn = Math.sin(rad), persp = o.perspectiva || 4 * W
  if (lado === 'sai') {
    tocar(raizDe(e), 'zIndex', '5')   // a página que vira fica por cima da que está embaixo
    tocar(e, 'transformOrigin', esq ? '0% 50%' : '100% 50%')
    tocar(e, 'transform', `perspective(${persp}px) rotateY(${(esq ? -th : th).toFixed(3)}deg)`)
    const luz = _extra('luzPagina', e, () => el('div', { cls: 'layer', style: { pointerEvents: 'none' } }, e))
    luz.style.background = `linear-gradient(${esq ? 'to right' : 'to left'}, rgba(255,255,255,${(0.5 * sn).toFixed(3)}) 0%, rgba(255,255,255,0) 6%, rgba(0,0,0,0) 30%, rgba(0,0,0,${(0.35 * sn).toFixed(3)}) 100%)`
  } else {
    // borda livre da página que vira, projetada (a partir da lombada): a sombra nasce ali
    const xe = (W * Math.cos(rad) * persp) / (persp - W * sn), base = 0.3 * (1 - p), forte = Math.min(0.75, base + 0.45 * sn)
    const sombra = _extra('sombraPagina', e, () => el('div', { cls: 'layer', style: { pointerEvents: 'none' } }, e))
    sombra.style.background = `linear-gradient(${esq ? 'to right' : 'to left'}, rgba(0,0,0,${forte.toFixed(3)}) ${Math.max(0, xe).toFixed(0)}px, rgba(0,0,0,${base.toFixed(3)}) ${(Math.max(0, xe) + 0.35 * W).toFixed(0)}px)`
  }
}
/** virada: opts.tipo
 *  'cartao' a tela vira como um cartão (A é a frente, B o verso), recuando no meio. dir 'direita'|'esquerda', eixo 'y'|'x',
 *           recuo (0,35), perspectiva, fundo (cor atrás do cartão; padrão: o fundo do palco), ease (E.inOutCubic).
 *  'pagina' A vira como página em torno da lombada (dir 'esquerda' = lombada à esquerda), por cima de B, com brilho na
 *           dobra e sombra na página de baixo. ease (quase linear, arranque suave), perspectiva (4·W). */
TR.virada = {
  sai: _lado('virada', 'sai', (e, t, t0, dur, o, p) => (o.tipo === 'pagina' ? _pagina : _cartao)(e, p, o, 'sai')),
  entra: _lado('virada', 'entra', (e, t, t0, dur, o, p) => (o.tipo === 'pagina' ? _pagina : _cartao)(e, p, o, 'entra')),
}
function _dadosMorph(e, o) {
  const de = o.de
  const chave = typeof de === 'string' ? de : `${de.x},${de.y},${de.w},${de.h},${de.r}`
  if (e.__morph && e.__morph.chave === chave) return e.__morph
  let d0, cx, cy
  if (typeof de === 'string') d0 = de
  else {
    const r = Math.min(de.r != null ? de.r : Math.min(de.w, de.h) / 2, de.w / 2, de.h / 2), x = de.x, y = de.y, w = de.w, h = de.h
    d0 = `M${x + r},${y}H${x + w - r}A${r},${r} 0 0 1 ${x + w},${y + r}V${y + h - r}A${r},${r} 0 0 1 ${x + w - r},${y + h}H${x + r}A${r},${r} 0 0 1 ${x},${y + h - r}V${y + r}A${r},${r} 0 0 1 ${x + r},${y}Z`
  }
  const pts0 = samplePath(d0)
  const xs = pts0.map((q) => q[0]), ys = pts0.map((q) => q[1])
  cx = (Math.min(...xs) + Math.max(...xs)) / 2; cy = (Math.min(...ys) + Math.max(...ys)) / 2
  const r0 = Math.sqrt(((Math.max(...xs) - Math.min(...xs)) * (Math.max(...ys) - Math.min(...ys))) / Math.PI)
  let cpts = samplePath(`M${cx - r0},${cy}a${r0},${r0} 0 1,1 ${2 * r0},0a${r0},${r0} 0 1,1 ${-2 * r0},0Z`, pts0.length)
  const area = (ps) => ps.reduce((a, q, i) => { const n = ps[(i + 1) % ps.length]; return a + q[0] * n[1] - n[0] * q[1] }, 0)
  if (Math.sign(area(cpts)) !== Math.sign(area(pts0))) cpts = cpts.reverse()   // mesmo sentido, senão o meio do morph torce
  const circ = alignPts(pts0, cpts)
  e.__morph = { chave, pts0, cx, cy, r0, u: circ.map(([x, y]) => [(x - cx) / r0, (y - cy) / r0]), R: raioCobre(cx, cy) }
  return e.__morph
}
/** morph: uma forma (o retângulo medido de um botão, ou um path em coordenadas do quadro) vira círculo e cresce até cobrir
 *  o quadro na cor da próxima cena; B aparece de dentro dessa cor.
 *  opts: de ({x, y, w, h, r?} de rectOf — meça no build da cena A e guarde numa variável — ou 'M…'), cor (padrão: o fundo
 *  da camada de B), corInicial (troca seca para `cor` no meio do morph, sem mistura suja), origem (elemento que some enquanto a forma
 *  está no lugar dele). No `sai`, A avança 4% em direção à forma. */
TR.morph = {
  sai: _lado('morph', 'sai', (e, t, t0, dur, o, p) => {
    const m = _dadosMorph(e, o), s = 1 + 0.04 * E.inOutCubic(p)   // avança (recuar abriria borda com o palco)
    tocar(e, 'transformOrigin', `${m.cx}px ${m.cy}px`); tocar(e, 'transform', `scale(${s.toFixed(4)})`)
    if (o.origem) tocar(o.origem, 'visibility', 'hidden')
  }),
  entra: _lado('morph', 'entra', (e, t, t0, dur, o, p) => {
    const m = _dadosMorph(e, o)
    if (o.origem) tocar(o.origem, 'visibility', 'hidden')
    if (e.__fundo === undefined) e.__fundo = getComputedStyle(e).backgroundColor
    const cor = o.cor || e.__fundo
    const svg = _extra('formaMorph', e, () => { const s = sv('svg', { width: W, height: H }); Object.assign(s.style, { position: 'absolute', left: '0', top: '0' }); sv('path', {}, s); e.before(s); return s })
    const k = E.inOutCubic(P(p, 0, 0.4)), R = lerp(m.r0, m.R, E.inCubic(P(p, 0.15, 0.75)))
    const pts = m.pts0.map((q, i) => [lerp(q[0], m.cx + m.u[i][0] * R, k), lerp(q[1], m.cy + m.u[i][1] * R, k)])
    const path = svg.firstChild
    path.setAttribute('d', ptsToPath(pts))
    path.setAttribute('fill', o.corInicial && k < 0.5 ? o.corInicial : cor)
    const b = E.outCubic(P(p, 0.72, 0.95))
    tocar(e, 'opacity', b.toFixed(3))
    tocar(e, 'transformOrigin', `${m.cx}px ${m.cy}px`); tocar(e, 'transform', `scale(${lerp(0.94, 1, E.outCubic(P(p, 0.72, 1))).toFixed(4)})`)
  }),
}

// ---------- checagem: "tem algo na frente?" e área segura ----------
/** Marca um elemento como alvo da checagem: tipo 'texto' | 'logo' | 'legenda'. textLine/bloco já marcam cada linha
 *  como 'texto'. marcar(e, false) desmarca (texto decorativo que passa por baixo de propósito). nome = rótulo nas mensagens. */
function marcar(e, tipo = 'texto', nome) {
  if (tipo) { e.dataset.colisao = tipo; if (nome) e.dataset.colisaoNome = nome } else delete e.dataset.colisao
  return e
}
/** Marca a imagem que texto nenhum pode cruzar (a tela gravada, o painel, a prévia). Com VIDEO.texto = 'fora-da-imagem',
 *  checarQuadro reprova o texto marcado (tipo texto ou legenda) cujo retângulo cruza o retângulo visível dela. */
function marcarImagem(e, nome = 'the image') { e.dataset.imagem = nome; return e }
/** Retângulo seguro do formato atual: VIDEO.plataforma ('reels'|'tiktok'|'shorts'|'stories'|'feed'|'youtube'|'app'|null,
 *  ou por formato: { '9x16': 'stories', '16x9': 'youtube' }). Números em references/formats.md. */
function areaSegura() {
  const pl = VIDEO.plataforma && typeof VIDEO.plataforma === 'object' ? VIDEO.plataforma[FMT] || null : VIDEO.plataforma || null
  const m = (mx, my, nome) => ({ x0: mx, y0: my, x1: W - mx, y1: H - my, nome })
  if (FMT === '9x16' && (pl === 'reels' || pl === 'tiktok' || pl === 'shorts')) return { x0: 70, y0: 250, x1: 940, y1: 1450, nome: pl }
  if (FMT === '9x16' && pl === 'stories') return { x0: 60, y0: 250, x1: 1020, y1: 1580, nome: 'stories' }
  if (pl === 'feed') return m(60, 60, 'feed (60 px)')
  if (pl === 'app') return m(60, 60, 'app (60 px)')   // player dentro do product/site, sem interface de rede por cima
  if (pl === 'youtube') return m(W * 0.05, H * 0.05, 'youtube (5%)')
  if (HORIZONTAL) return m(W * 0.05, H * 0.05, `${FMT.replace('x', ':')} (5%)`)
  if (FMT === '9x16') return { x0: 70, y0: 250, x1: 940, y1: 1450, nome: '9:16 (reels/tiktok/shorts)' }
  return m(60, 60, `${FMT.replace('x', ':')} (60 px)`)
}
function _opacEfetiva(e) {
  let o = 1
  for (let x = e; x && x !== document.documentElement; x = x.parentElement) {
    const cs = getComputedStyle(x)
    if (cs.display === 'none') return 0
    if (x === e && cs.visibility !== 'visible') return 0
    o *= parseFloat(cs.opacity)
    if (o < 0.01) return 0
  }
  return o
}
const _FORMAS_SVG = /^(path|circle|rect|ellipse|polygon|polyline|line|text|tspan|textpath|image|use|foreignobject)$/
/** Retângulo (coordenadas do quadro) do que o alvo mostra: letras visíveis (recortadas pela máscara), formas do SVG ou o texto. */
function _retAlvo(a) {
  const S = stage.getBoundingClientRect(), rs = []
  const ok = (r) => r.width > 0.5 && r.height > 0.5
  const chs = a.querySelectorAll('.ch')
  if (chs.length) {
    const cortes = new Map()
    for (const c of chs) {
      if (parseFloat(c.style.opacity || 1) < 0.05) continue
      let r = c.getBoundingClientRect()
      const m = c.closest('.mask')
      if (m && a.contains(m)) {
        if (!cortes.has(m)) cortes.set(m, getComputedStyle(m).overflow !== 'visible' ? m.getBoundingClientRect() : null)
        const q = cortes.get(m)
        if (q) {
          const x0 = Math.max(r.left, q.left), y0 = Math.max(r.top, q.top), x1 = Math.min(r.right, q.right), y1 = Math.min(r.bottom, q.bottom)
          if (y1 - y0 < 0.3 * r.height) continue   // lasca da caixa no padding da máscara: a letra ainda não aparece
          r = { left: x0, top: y0, right: x1, bottom: y1, width: x1 - x0, height: y1 - y0 }
        }
      }
      if (ok(r)) rs.push(r)
    }
  } else if (a instanceof SVGElement) {
    for (const f of a.querySelectorAll('*')) if (_FORMAS_SVG.test(f.tagName.toLowerCase())) { const r = f.getBoundingClientRect(); if (ok(r)) rs.push(r) }
  } else if (a.textContent.trim()) {
    const rg = document.createRange(); rg.selectNodeContents(a)
    for (const r of rg.getClientRects()) if (ok(r)) rs.push(r)
  }
  if (!rs.length && !chs.length) { const r = a.getBoundingClientRect(); if (ok(r)) rs.push(r) }
  if (!rs.length) return null
  return { x0: Math.min(...rs.map((r) => r.left)) - S.left, y0: Math.min(...rs.map((r) => r.top)) - S.top, x1: Math.max(...rs.map((r) => r.right)) - S.left, y1: Math.max(...rs.map((r) => r.bottom)) - S.top }
}
const _hex = (c) => { const m = c && c.match(/rgba?\(([^)]+)\)/); if (!m) return c; const v = m[1].split(/[\s,/]+/).filter(Boolean).slice(0, 3).map((n) => Math.round(+n).toString(16).padStart(2, '0')); return '#' + v.join('').toUpperCase() }
const _curto = (s, n = 40) => { s = s.replace(/\s+/g, ' ').trim(); return s.length > n ? s.slice(0, n - 1) + '…' : s }
function _textoProprioEm(e, x, y) {
  for (const n of e.childNodes) {
    if (n.nodeType !== 3 || !n.textContent.trim()) continue
    const rg = document.createRange(); rg.selectNodeContents(n)
    for (const r of rg.getClientRects()) if (x >= r.left && x <= r.right && y >= r.top && y <= r.bottom) return true
  }
  return false
}
/** O que `e` pinta no ponto (coordenadas da página)? Devolve a descrição, ou null se não pinta nada ali. */
function _pintaEm(e, x, y) {
  const tag = e.tagName.toLowerCase(), cs = getComputedStyle(e)
  if (e instanceof SVGElement) {
    if (!_FORMAS_SVG.test(tag)) return null
    const f = cs.fill, s = cs.stroke
    const temF = f && f !== 'none' && _alfa(f) * parseFloat(cs.fillOpacity || 1) > 0.05, temS = s && s !== 'none' && _alfa(s) * parseFloat(cs.strokeOpacity || 1) > 0.05
    if (!temF && !temS && !/^(image|use|text|tspan|textpath|foreignobject)$/.test(tag)) return null
    return `${tag} (${temF ? 'fill ' + _hex(f) : temS ? 'stroke ' + _hex(s) : 'svg'})`
  }
  const nome = tag + (e.className && typeof e.className === 'string' && e.className.trim() ? '.' + e.className.trim().split(/\s+/)[0] : '')
  if (tag === 'img' || tag === 'canvas' || tag === 'video') return `${nome}${tag === 'img' && e.src ? ` (${decodeURIComponent(e.src.split('/').pop()).slice(0, 40)})` : ''}`
  if (_alfa(cs.backgroundColor) >= 0.35) return `${nome} (background ${_hex(cs.backgroundColor)})`
  if (cs.backgroundImage !== 'none') return `${nome} (background image or gradient)`
  if (_textoProprioEm(e, x, y)) return `${nome} "${_curto(e.textContent, 24)}"`
  return null
}
const _tSeg = (t) => t.toFixed(2)
// o tipo do alvo (data-colisao) como sai nas mensagens
const _TIPO_MSG = { texto: 'text', legenda: 'caption', logo: 'logo' }
const _tipoMsg = (tipo) => _TIPO_MSG[tipo] || tipo
// O retângulo da imagem que se VÊ no quadro: o que ela ocupa (com 3D, a caixa da projeção), cortado pelo recorte de
// cada ancestral (overflow que corta, clip-path inset). null = não aparece.
function _inset(e) {
  const m = /^inset\(([^)]*)\)/.exec(getComputedStyle(e).clipPath || '')
  if (!m) return null
  const v = m[1].split(/\s+round\s+/)[0].trim().split(/\s+/).map((x) => parseFloat(x) || 0)
  const [t, r = t, b = t, l = r] = v
  const q = e.getBoundingClientRect()
  return { left: q.left + l, top: q.top + t, right: q.right - r, bottom: q.bottom - b }
}
function _retImagem(img) {
  if (_opacEfetiva(img) < 0.05) return null
  const S = stage.getBoundingClientRect(), q = img.getBoundingClientRect()
  let x0 = q.left, y0 = q.top, x1 = q.right, y1 = q.bottom
  for (let a = img; a && a !== stage; a = a.parentElement) {
    const cs = getComputedStyle(a), cortes = []
    if (a !== img && /(hidden|clip)/.test(cs.overflow + cs.overflowX + cs.overflowY)) cortes.push(a.getBoundingClientRect())
    const ins = _inset(a)
    if (ins) cortes.push(ins)
    for (const c of cortes) { x0 = Math.max(x0, c.left); y0 = Math.max(y0, c.top); x1 = Math.min(x1, c.right); y1 = Math.min(y1, c.bottom) }
  }
  x0 = Math.max(x0 - S.left, 0); y0 = Math.max(y0 - S.top, 0); x1 = Math.min(x1 - S.left, W); y1 = Math.min(y1 - S.top, H)
  return x1 - x0 > 1 && y1 - y0 > 1 ? { x0, y0, x1, y1 } : null
}
/** Texto marcado (texto ou legenda) que cruza uma imagem marcada (marcarImagem). Só com VIDEO.texto = 'fora-da-imagem'.
 *  Vale o texto visível (opacidade ≥ 0,5), parado ou não; fora das janelas de transição registradas. */
function _textoSobreImagem(t, alvos) {
  if (!VIDEO || VIDEO.texto !== 'fora-da-imagem') return []
  if (TRANSICOES.find((x) => t >= x.t0 && t < x.t0 + x.dur)) return []
  const imgs = [...stage.querySelectorAll('[data-imagem]')].map((e) => ({ nome: e.dataset.imagem, r: _retImagem(e) })).filter((x) => x.r)
  if (!imgs.length) return []
  const out = []
  for (const a of alvos) {
    const tipo = a.dataset.colisao
    if (tipo !== 'texto' && tipo !== 'legenda') continue
    if (_opacEfetiva(a) < 0.5) continue
    const r = _retAlvo(a)
    if (!r) continue
    const rot = `${_tipoMsg(tipo)} "${_curto(a.dataset.colisaoNome || a.textContent || _tipoMsg(tipo))}"`
    for (const im of imgs) {
      const w = Math.min(r.x1, im.r.x1) - Math.max(r.x0, im.r.x0), h = Math.min(r.y1, im.r.y1) - Math.max(r.y0, im.r.y0)
      if (w <= 2 || h <= 2) continue
      out.push({ tipo: 'imagem', t, chave: `imagem|${rot}|${im.nome}`, rotulo: rot, capa: im.nome,
        msg: `TEXT OVER IMAGE t=${_tSeg(t)} s: ${rot} crosses ${im.nome} (text spans x ${Math.round(r.x0)} to ${Math.round(r.x1)}; image spans x ${Math.round(im.r.x0)} to ${Math.round(im.r.x1)}, y ${Math.round(im.r.y0)} to ${Math.round(im.r.y1)})` })
      break
    }
  }
  return out
}
/** Checa o instante t: cada alvo marcado, PARADO (mexeu ≤ 2 px até t+1/30) e OPACO (≥ 0,9), não pode estar coberto
 *  em ≥ 20% dos pontos de uma grade 5×3 (fora das janelas de transição) nem sair da área segura. Deixa a página em t.
 *  Devolve [{ tipo: 'colisao'|'area', t, chave, msg, … }]. Precisa de viewport do tamanho do quadro (frames.cjs cuida). */
async function checarQuadro(t) {
  const alvos = [...stage.querySelectorAll('[data-colisao]')]
  if (!alvos.length) { await renderAt(t); return [] }
  await renderAt(t + 1 / 30)
  const depois = alvos.map(_retAlvo)
  await renderAt(t)
  const est = document.createElement('style')
  est.textContent = '#stage, #stage * { pointer-events: auto !important; }'
  document.head.appendChild(est)
  const S = stage.getBoundingClientRect(), area = areaSegura(), out = []
  const emTransicao = TRANSICOES.find((x) => t >= x.t0 && t < x.t0 + x.dur)
  try {
    alvos.forEach((a, i) => {
      const r = _retAlvo(a), q = depois[i]
      if (!r || !q) return
      if (Math.max(Math.abs(r.x0 - q.x0), Math.abs(r.y0 - q.y0), Math.abs(r.x1 - q.x1), Math.abs(r.y1 - q.y1)) > 2) return
      if (_opacEfetiva(a) < 0.9) return
      if (r.x1 <= 0 || r.y1 <= 0 || r.x0 >= W || r.y0 >= H) return
      const tipo = a.dataset.colisao
      const rot = `${_tipoMsg(tipo)} "${_curto(a.dataset.colisaoNome || a.textContent || a.getAttribute('aria-label') || _tipoMsg(tipo))}"`
      let visto = 0, cobertos = 0
      const quem = new Map()
      for (let gy = 0; gy < 3; gy++) for (let gx = 0; gx < 5; gx++) {
        const x = r.x0 + ((gx + 0.5) / 5) * (r.x1 - r.x0), y = r.y0 + ((gy + 0.5) / 3) * (r.y1 - r.y0)
        if (x < 0 || y < 0 || x >= W || y >= H) continue
        let chegou = false, capa = null
        for (const e of document.elementsFromPoint(S.left + x, S.top + y)) {
          if (e === a || a.contains(e)) { chegou = true; break }
          if (capa || e.contains(a) || e === grain || e === stage) continue
          if (e.tagName.toLowerCase() === 'svg' && !e.ownerSVGElement) continue   // svg raiz: vale a geometria das formas
          if (_opacEfetiva(e) < 0.05) continue
          const d = _pintaEm(e, S.left + x, S.top + y)
          if (d) capa = d
        }
        if (!chegou) continue    // recortado ou fora: aqui o alvo não aparece, nem coberto nem livre
        visto++
        if (capa) { cobertos++; quem.set(capa, (quem.get(capa) || 0) + 1) }
      }
      if (!visto) return
      if (!emTransicao && cobertos / visto >= 0.2) {
        const capa = [...quem.entries()].sort((x, y) => y[1] - x[1])[0][0], pct = Math.round((100 * cobertos) / visto)
        out.push({ tipo: 'colisao', t, pct, chave: `colisao|${rot}|${capa}`, rotulo: rot, capa, msg: `COLLISION t=${_tSeg(t)} s: ${rot} covered by ${capa} at ${pct}% of the points` })
      }
      const fora = []
      if (r.x0 < area.x0 - 1) fora.push(`x ${Math.round(r.x0)} < ${Math.round(area.x0)}`)
      if (r.x1 > area.x1 + 1) fora.push(`x ${Math.round(r.x1)} > ${Math.round(area.x1)}`)
      if (r.y0 < area.y0 - 1) fora.push(`y ${Math.round(r.y0)} < ${Math.round(area.y0)}`)
      if (r.y1 > area.y1 + 1) fora.push(`y ${Math.round(r.y1)} > ${Math.round(area.y1)}`)
      if (fora.length) out.push({ tipo: 'area', t, chave: `area|${rot}|${fora.map((f) => f.split(' ').slice(0, 2).join('')).join(',')}`, rotulo: rot, fora, msg: `SAFE AREA t=${_tSeg(t)} s: ${rot} leaves the ${area.nome} safe area (${fora.join('; ')})` })
    })
    out.push(..._textoSobreImagem(t, alvos))
  } finally { est.remove() }
  return out
}

// ---------- cenas ----------
const CENAS = []
/** Registra uma cena ativa em [t0, t1). build(root, cena) monta o DOM e devolve update(t). */
function cena(t0, t1, build, nome = '') { CENAS.push({ t0, t1, build, nome }) }

let grain = null, selo = null
function renderAt(t) {
  let sx = 0, sy = 0
  for (const [ht, a] of VIDEO.impactos || []) {
    const d = t - ht
    if (d >= 0 && d < 0.5) { sx += a * wob(d, 9, 9); sy += a * 0.7 * wob(d + 0.02, 7, 9) }
  }
  const shakeT = sx || sy ? `translate(${sx}px,${sy}px) scale(1.02)` : ''
  _restaurarTocados()
  for (const c of CENAS) {
    const on = t >= c.t0 && t < c.t1
    c.root.style.display = on ? 'block' : 'none'
    if (on) { c.update(t); c.root.style.transform = shakeT }
  }
  if (selo) {
    const s = VIDEO.selo
    const o = E.outCubic(P(t, s.de, s.de + 0.4)) * (1 - P(t, s.ate - 0.25, s.ate))
    selo.style.opacity = o; selo.style.display = o > 0 ? 'block' : 'none'
  }
  if (grain) { const f = Math.floor(t * 12); grain.style.backgroundPosition = `${(f * 73) % 256}px ${(f * 151) % 256}px` }
  if (ESPERA_QUADRO.length) return Promise.all(ESPERA_QUADRO.splice(0))
}

async function iniciar() {
  const fontes = VIDEO.fontes || []
  // Carrega TODA face declarada das famílias (todo peso e estilo do fonts.css), não só a 400: um título em 700
  // medido antes de a 700 chegar sai com a largura da fonte reserva, e a checagem de largura mente.
  const nomeFam = (f) => f.replace(/^["']|["']$/g, '')
  const faces = [...document.fonts].filter((ff) => fontes.includes(nomeFam(ff.family)))
  await Promise.all([
    ...faces.map((ff) => ff.load().catch(() => null)),
    ...fontes.flatMap((f) => [`normal 400 64px "${f}"`, `italic 400 64px "${f}"`].map((s) => document.fonts.load(s).catch(() => []))),
  ])
  // document.fonts.check diz "ok" mesmo quando o glifo cai na fonte reserva: medir é o que prova.
  const cv = document.createElement('canvas').getContext('2d')
  const larg = (fonte) => { cv.font = fonte; return cv.measureText('Ágil façanha 0123 — Wy').width }
  const faltando = fontes.filter((f) => !document.fonts.check(`64px "${f}"`) || (Math.abs(larg(`64px "${f}", monospace`) - larg('64px monospace')) < 0.5 && Math.abs(larg(`64px "${f}", serif`) - larg('64px serif')) < 0.5))
  if (faltando.length) console.error('FONT DID NOT LOAD: ' + faltando.join(', ') + ' — check the @font-face rules in index.html')

  // Constrói tudo visível (medições precisam de layout), depois esconde no primeiro renderAt.
  for (const c of CENAS) {
    c.root = el('div', { cls: 'scene' }, stage)
    c.root.style.display = 'block'
    c.update = c.build(c.root, c) || (() => {})
  }
  await Promise.all(ESPERAR)
  // um update de cada cena no próprio início registra as transições (TRANSICOES) para a folha --auto e a checagem
  for (const c of CENAS) c.update(c.t0)
  if (VIDEO.selo && window.MARCA && MARCA.logo) {
    const s = VIDEO.selo, lg = MARCA.simbolo || MARCA.logo
    selo = sv('svg', { viewBox: lg.viewBox, width: s.w, height: s.h }, stage)
    Object.assign(selo.style, { position: 'absolute', left: px(L(s.x)), top: px(L(s.y)), zIndex: 19 })
    const g = sv('g', { transform: lg.transform || '' }, selo)
    for (const pt of lg.partes) sv('path', { d: pt.d, fill: pt.fill, ...(pt.transform ? { transform: pt.transform } : {}) }, g)
  }
  if (VIDEO.grao) {
    const gc = document.createElement('canvas'); gc.width = gc.height = 256
    const gx = gc.getContext('2d'), gd = gx.createImageData(256, 256), GR = rng(99)
    for (let i = 0; i < gd.data.length; i += 4) { const v = 128 + (GR() - 0.5) * 90; gd.data[i] = gd.data[i + 1] = gd.data[i + 2] = v; gd.data[i + 3] = 255 }
    gx.putImageData(gd, 0, 0)
    grain = el('div', { cls: 'layer', style: { backgroundImage: `url(${gc.toDataURL()})`, mixBlendMode: 'overlay', opacity: VIDEO.grao, pointerEvents: 'none', zIndex: 20 } }, stage)
  }
  await renderAt(Number(Q.get('t')) || 0)
  window.renderAt = renderAt
  window.checarQuadro = checarQuadro
  window.__ready = true
  if (Q.has('play')) previa()
}

// ---------- prévia ao vivo (index.html?play) ----------
// Toca a trilha (VIDEO.audio) em sincronia. Espaço pausa, ←/→ pula 1 s, 0 volta ao início.
function previa() {
  document.body.style.overflow = 'hidden'
  const escala = () => Math.min(innerWidth / W, (innerHeight - 40) / H)
  const ajusta = () => { stage.style.transformOrigin = '0 0'; stage.style.transform = `scale(${escala()})` }
  ajusta(); addEventListener('resize', ajusta)
  const barra = el('div', { style: { position: 'fixed', left: '0', right: '0', bottom: '0', height: '40px', background: '#111', color: '#eee', font: '14px system-ui', display: 'flex', alignItems: 'center', gap: '12px', padding: '0 12px', zIndex: 9 } }, document.body)
  const info = el('span', { text: 'click to play' }, barra)
  const trilho = el('div', { style: { flex: '1', height: '6px', background: '#333', borderRadius: '3px', position: 'relative', cursor: 'pointer' } }, barra)
  const cab = el('div', { style: { position: 'absolute', left: '0', top: '-3px', width: '12px', height: '12px', borderRadius: '50%', background: '#fff' } }, trilho)
  const audio = VIDEO.audio ? new Audio(VIDEO.audio) : null
  let t0 = null, pausado = true, tp = 0
  const agora = () => (audio ? audio.currentTime : pausado ? tp : (performance.now() - t0) / 1000)
  const tocar = () => { pausado = false; if (audio) audio.play(); else t0 = performance.now() - tp * 1000 }
  const pausar = () => { tp = agora(); pausado = true; if (audio) audio.pause() }
  const ir = (s) => { tp = clamp(s, 0, VIDEO.duracao - 0.001); if (audio) audio.currentTime = tp; else t0 = performance.now() - tp * 1000 }
  addEventListener('click', (e) => { if (e.target === trilho || e.target === cab) return; pausado ? tocar() : pausar() })
  trilho.addEventListener('click', (e) => { const r = trilho.getBoundingClientRect(); ir(((e.clientX - r.left) / r.width) * VIDEO.duracao) })
  addEventListener('keydown', (e) => {
    if (e.code === 'Space') { e.preventDefault(); pausado ? tocar() : pausar() }
    if (e.code === 'ArrowRight') ir(agora() + 1)
    if (e.code === 'ArrowLeft') ir(agora() - 1)
    if (e.key === '0') ir(0)
  })
  const loop = () => {
    let t = agora()
    if (t >= VIDEO.duracao) { ir(0); t = 0; if (!audio) { pausado = true; tp = 0 } }
    renderAt(t)
    info.textContent = `${t.toFixed(2)} s / ${VIDEO.duracao} s · ${FMT}${pausado ? ' · paused (click or space)' : ''}`
    cab.style.left = `calc(${(t / VIDEO.duracao) * 100}% - 6px)`
    requestAnimationFrame(loop)
  }
  requestAnimationFrame(loop)
}
