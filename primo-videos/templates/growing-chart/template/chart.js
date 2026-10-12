// Molde growing-chart: barras horizontais, colunas, linha ou rosca que se desenham com os números contando.
// Nada da marca aqui dentro: cores, fontes, logo, textos e números vêm de PARAMS (params.js, do JSON).
// Cada cena: título e nota desde o primeiro quadro, o gráfico se desenha, a câmera chega 10% mais perto no primeiro
// segundo e meio e depois mais 2,5% até o corte (nada fica parado). Eixo, rótulos e valores ficam sempre fora das barras; o ícone (opcional) fica ao lado do
// rótulo, nunca debaixo de texto. Fecho: só o logo, centrado.

const MK = PARAMS.marca
// o "of" embaixo do número da rosca ("of 128"); outro idioma: "textos": { "de": "de" } no JSON
const DE = (PARAMS.textos && PARAMS.textos.de) || 'of'
const CR = (() => {
  const c = MK.cores, serie = [].concat(c.serie || c.texto)
  return { apoio: c.texto, eixo: c.texto, destaque: serie[0], trilho: mix(c.fundo, c.texto, 0.18), ...c, serie, divisor: c.divisor || c.eixo || c.texto }
})()
const FT = MK.fontes.titulo, FX = MK.fontes.texto || FT, FN = MK.fontes.numero || FT
const PS = { titulo: 700, texto: 500, rotulo: 600, numero: 700, ...(MK.pesos || {}) }
const fTit = (s) => `${PS.titulo} ${s}px "${FT}"`
const fTxt = (s, w = PS.texto) => `${w} ${s}px "${FX}"`
const fNum = (s) => `${PS.numero} ${s}px "${FN}"`
const { ENTRA, ESCALONA, CRESCE } = GRAFICO

// ---------- leiaute por formato ----------
// Horizontal (16:9, 19:9, 21:9): margem em fração da largura (120 px no 16:9), altura como no 16:9. Retrato e quadrado
// empilham: título em cima, gráfico embaixo (o "dividido" vira "em-cima"). Tudo dentro da área segura do motor.
const RET = W / H < 1.1
const MX = Math.round((W * 120) / 1920)
const AREA = HORIZONTAL ? { x0: MX, x1: W - MX, y0: 100, y1: 980 }
  // no quadrado e no 4:5, 30 px de folga em cima: a câmera chega 2,5% mais perto e fonte alta (Oswald) passa da caixa
  : L({ '9x16': { x0: 90, x1: 930, y0: 290, y1: 1420 }, '1x1': { x0: 80, x1: 1000, y0: 92, y1: 1000 }, '4x5': { x0: 80, x1: 1000, y0: 100, y1: 1260 } })
AREA.w = AREA.x1 - AREA.x0; AREA.h = AREA.y1 - AREA.y0
const TAM = L({
  // rótulo e nota com folga sobre o mínimo de leitura do refino (28 px de altura de letra), já que a câmera abre a 90%
  '16x9': { titulo: 76, nota: 34, rotulo: 52, valor: 60, grande: 64, centro: 170, gap: 56, barra: 92 },
  '9x16': { titulo: 72, nota: 38, rotulo: 50, valor: 56, grande: 60, centro: 160, gap: 56, barra: 80 },
  '1x1': { titulo: 60, nota: 32, rotulo: 42, valor: 48, grande: 52, centro: 130, gap: 40, barra: 64 },
  '4x5': { titulo: 64, nota: 34, rotulo: 44, valor: 50, grande: 56, centro: 140, gap: 44, barra: 72 },
})

// ---------- utilidades ----------
const _cv = document.createElement('canvas').getContext('2d')
const largura = (s, f) => { _cv.font = f; return _cv.measureText(String(s)).width }
/** Quebra o texto em linhas que cabem em w (por palavra). */
function quebrar(texto, font, w) {
  const out = []; let cur = ''
  for (const p of String(texto).split(' ')) { const n = cur ? cur + ' ' + p : p; if (largura(n, font) > w && cur) { out.push(cur); cur = p } else cur = n }
  if (cur) out.push(cur)
  return out
}
/** Duas linhas de largura parecida (sem a palavra sozinha na segunda): a melhor quebra entre as possíveis. */
function equilibrar(linhas, font) {
  if (linhas.length !== 2) return linhas
  const ws = linhas.join(' ').split(' ')
  let melhor = linhas, pior = Math.max(...linhas.map((l) => largura(l, font)))
  for (let k = 1; k < ws.length; k++) {
    const a = ws.slice(0, k).join(' '), b = ws.slice(k).join(' '), m = Math.max(largura(a, font), largura(b, font))
    if (m < pior) { pior = m; melhor = [a, b] }
  }
  return melhor
}
/** Número em inglês por padrão: 1920 → "1,920" (ou "1920" com milhar ""), 2.5 com casas 1 → "2.5". Em português:
 *  "milhar": "." (a vírgula decimal vem junto) ou "decimal": "," no JSON. */
function fmt(v, c) {
  const casas = c.casas || 0, milhar = c.milhar != null ? c.milhar : PARAMS.milhar != null ? PARAMS.milhar : ','
  const decimal = c.decimal != null ? c.decimal : PARAMS.decimal != null ? PARAMS.decimal : milhar === '.' ? ',' : '.'
  const [i, d] = Math.abs(v).toFixed(casas).split('.')
  return (c.prefixo || '') + (v < 0 ? '−' : '') + i.replace(/\B(?=(\d{3})+(?!\d))/g, milhar) + (d ? decimal + d : '') + (c.sufixo || '')
}
const div = (parent, style = {}, text) => el('div', { cls: 'abs', style, ...(text != null ? { text } : {}) }, parent)
const destacado = (c, i) => c.destaque != null && [].concat(c.destaque).includes(i)
const corItem = (c, i) => (destacado(c, i) ? CR.destaque : CR.serie[i % CR.serie.length])
/** Ícone (PNG) num ladrilho opcional (marca.cores.ladrilho). Marcado como imagem: texto nenhum pode cruzá-lo. */
function icone(parent, src, tam, x, y) {
  const box = div(parent, { left: px(x), top: px(y), width: px(tam), height: px(tam), borderRadius: px(tam * 0.28), background: CR.ladrilho || 'transparent', overflow: 'hidden' })
  const pad = CR.ladrilho ? tam * 0.16 : 0
  imagem(box, src, { left: px(pad), top: px(pad), width: px(tam - 2 * pad), height: px(tam - 2 * pad), objectFit: 'contain' })
  marcarImagem(box, 'the icon')
  return box
}
/** Texto parado (título, nota, rótulo), marcado para a checagem de colisão e de área segura. */
function texto(parent, s, font, cor, nome) {
  const e = div(parent, { font, color: cor, whiteSpace: 'nowrap', lineHeight: '1.08' }, s)
  marcar(e, 'texto', nome)
  return e
}

// Título (até 2 linhas, encolhe se precisar) e nota (a fonte do dado). Devolve a altura.
function blocoTitulo(parent, c, x, y, w, alinha, k = 1) {
  const tam0 = Math.round(TAM.titulo * k)
  let tam = tam0, linhas = quebrar(c.titulo, fTit(tam), w)
  while ((linhas.length > 2 || linhas.some((l) => largura(l, fTit(tam)) > w)) && tam > tam0 * 0.6) { tam -= 2; linhas = quebrar(c.titulo, fTit(tam), w) }
  linhas = equilibrar(linhas, fTit(tam))
  const els = []
  let yy = y
  for (const s of linhas) { const e = texto(parent, s, fTit(tam), CR.texto, 'title'); els.push(e); place(e, x, yy); yy += tam * 1.08 }
  if (c.nota) {
    yy += Math.round(TAM.nota * 0.6)
    for (const s of quebrar(c.nota, fTxt(TAM.nota), w)) { const e = texto(parent, s, fTxt(TAM.nota), CR.apoio, 'note'); els.push(e); place(e, x, yy); yy += TAM.nota * 1.25 }
  }
  if (alinha === 'centro') for (const e of els) e.style.left = px(x + (w - rectOf(e).w) / 2)
  return { h: yy - y, els }
}

// ---------- "percorrer": o destaque passa de item em item depois de crescer ----------
// slot = o item aceso agora (-1 = ninguém: antes do percurso ou depois dele, a cor de sempre); dt = tempo desde a
// troca. A cor troca seca, com o pulo do número (misturar destaque e série daria um meio-termo fora da paleta).
function percurso(c, n, tl) {
  const t0 = GRAFICO.inicioPercurso(c), passo = GRAFICO.PERCORRE.item, k = Math.floor((tl - t0) / passo)
  if (tl < t0) return { slot: -1, ant: -1, dt: 99 }
  if (k >= n) return { slot: -1, ant: n - 1, dt: tl - t0 - n * passo }
  return { slot: k, ant: k - 1, dt: tl - t0 - k * passo }
}
function corNoPercurso(c, j, p) {
  return p.slot < 0 ? corItem(c, j) : j === p.slot ? CR.destaque : CR.serie[j % CR.serie.length]
}
const pulo = (p, j) => (p.slot === j ? 1 + 0.22 * Math.sin(Math.PI * P(p.dt, 0, 0.34)) : 1)

// ---------- os gráficos: (g, c, R) → { foco: [x, y], update(t) } ----------
// R = retângulo do gráfico; t = tempo absoluto (o texto que conta fica preso ao quadro de 60 fps: quadroDe).
const GRAFICOS = {}

GRAFICOS.barras = (g, c, R) => {
  const n = c.itens.length, fR = fTxt(TAM.rotulo, PS.rotulo)
  let tv = TAM.valor
  const fV = () => fNum(tv)
  const temIc = c.itens.some((it) => it.icone)
  const valW = () => Math.max(...c.itens.map((it) => largura(fmt(it.valor, c), fV())))
  const vmax = Math.max(...c.itens.map((it) => it.valor)) || 1
  const gapL = 28, gapV = 24
  const passo = R.h / n
  // no retrato e no quadrado o rótulo fica em cima da barra (do lado ela sobraria curta); no horizontal, à esquerda
  const emCima = RET
  const ic = temIc ? Math.round(emCima ? TAM.rotulo * 1.3 : Math.min(TAM.barra, passo * 0.6) * 0.95) : 0
  const labW = Math.max(...c.itens.map((it) => largura(it.rotulo, fR)))
  const x0 = emCima ? R.x : R.x + (ic ? ic + 20 : 0) + labW + gapL
  // folga de 6% no valor (o canvas mede sem os dígitos tabulares) e de 24 px na ponta (a câmera chega 2,5% mais perto)
  const folga = () => gapV + valW() * 1.06 * (c.percorrer ? 1.22 : 1) + 24   // com percorrer, o número pula 22%
  while (R.x + R.w - x0 - folga() < R.w * 0.3 && tv > 30) tv -= 2
  const comp = R.x + R.w - x0 - folga()
  const labH = emCima ? Math.max(TAM.rotulo * 1.1, ic) + 14 : 0
  const esp = Math.max(18, Math.min(TAM.barra, (passo - labH) * (emCima ? 0.62 : 0.58)))
  const raio = Math.min(esp / 2, 40)
  const eixo = div(g, { left: px(x0 - 4), top: px(R.y), width: '4px', height: px(R.h), background: CR.eixo, borderRadius: '2px', transformOrigin: '50% 0' })
  const linhas = c.itens.map((it, i) => {
    const yRow = R.y + passo * i, cy = emCima ? yRow + labH + (passo - labH) / 2 : yRow + passo / 2
    const rot = texto(g, it.rotulo, fR, CR.texto, it.rotulo)
    const rr = rectOf(rot)
    let im = null
    if (emCima) {
      if (it.icone) im = icone(g, it.icone, ic, x0 + 16, cy - esp / 2 - 14 - ic)
      place(rot, x0 + 16 + (ic ? ic + 16 : 0), cy - esp / 2 - 14 - (ic ? (ic + rr.h) / 2 : rr.h))
    } else {
      place(rot, x0 - gapL - rr.w, cy - rr.h / 2)
      if (it.icone) im = icone(g, it.icone, ic, x0 - gapL - rr.w - 20 - ic, cy - ic / 2)
    }
    const barra = div(g, { left: px(x0), top: px(cy - esp / 2), height: px(esp), width: '0px', background: corItem(c, i), borderRadius: `0 ${raio}px ${raio}px 0` })
    const val = texto(g, fmt(it.valor, c), fV(), CR.texto, 'value')
    val.style.fontVariantNumeric = 'tabular-nums'
    val.style.top = px(cy - rectOf(val).h / 2)
    return { rot, im, barra, val, comp: (comp * it.valor) / vmax, cy, t0: ENTRA + i * ESCALONA, v: it.valor }
  })
  const fi = c.destaque != null ? [].concat(c.destaque)[0] : linhas.reduce((a, b, i) => (b.v > linhas[a].v ? i : a), 0)
  return {
    foco: [x0 + linhas[fi].comp, linhas[fi].cy],
    update(t) {
      const tl = t - c.t0, tq = quadroDe(t) - c.t0
      T(eixo, `scaleY(${E.outCubic(P(tl, 0, ENTRA))})`)
      for (const b of linhas) {
        const k = E.outCubic(P(tl, b.t0, b.t0 + CRESCE)), kq = E.outCubic(P(tq, b.t0, b.t0 + CRESCE))
        const ke = E.outCubic(P(tl, b.t0 - 0.3, b.t0 + 0.1))
        O(b.rot, ke); T(b.rot, `translateY(${(1 - ke) * 16}px)`)
        if (b.im) { O(b.im, ke); T(b.im, `translateY(${(1 - ke) * 16}px)`) }
        b.barra.style.width = px(b.comp * k)
        b.val.style.left = px(x0 + b.comp * k + gapV)
        b.val.textContent = fmt(c.casas ? b.v * kq : Math.round(b.v * kq), c)
        O(b.val, P(tl, b.t0, b.t0 + 0.15))
      }
      if (c.percorrer) {
        const p = percurso(c, n, tl)
        linhas.forEach((b, j) => { b.barra.style.background = corNoPercurso(c, j, p); b.val.style.transformOrigin = '0% 55%'; T(b.val, `scale(${pulo(p, j)})`) })
      }
    },
  }
}

GRAFICOS.colunas = (g, c, R) => {
  const n = c.itens.length, slot = R.w / n
  let tr = TAM.rotulo, tv = TAM.valor
  while (Math.max(...c.itens.map((it) => largura(it.rotulo, fTxt(tr, PS.rotulo)))) > slot * 0.92 && tr > 28) tr -= 2
  while (Math.max(...c.itens.map((it) => largura(fmt(it.valor, c), fNum(tv)))) > slot * 0.92 && tv > 28) tv -= 2
  const fR = fTxt(tr, PS.rotulo), fV = fNum(tv)
  const ic = c.itens.some((it) => it.icone) ? Math.round(Math.min(slot * 0.5, TAM.barra)) : 0
  const baseY = R.y + R.h - tr * 1.1 - 22 - (ic ? ic + 18 : 0)
  const topo = R.y + tv * 1.1 + 20
  const hmax = baseY - topo
  const larg = Math.min(slot * 0.56, TAM.barra * 1.6), raio = Math.min(larg / 2, 40)
  const vmax = Math.max(...c.itens.map((it) => it.valor)) || 1
  const eixo = div(g, { left: px(R.x), top: px(baseY), width: px(R.w), height: '4px', background: CR.eixo, borderRadius: '2px', transformOrigin: '0 50%' })
  const cols = c.itens.map((it, i) => {
    const cx = R.x + slot * (i + 0.5), h = (hmax * it.valor) / vmax
    const col = div(g, { left: px(cx - larg / 2), width: px(larg), top: px(baseY), height: '0px', background: corItem(c, i), borderRadius: `${raio}px ${raio}px 0 0` })
    const rot = texto(g, it.rotulo, fR, CR.texto, it.rotulo)
    place(rot, cx - rectOf(rot).w / 2, baseY + 22)
    const im = it.icone ? icone(g, it.icone, ic, cx - ic / 2, baseY + 22 + tr * 1.1 + 18) : null
    const val = texto(g, fmt(it.valor, c), fV, CR.texto, 'value')
    val.style.fontVariantNumeric = 'tabular-nums'
    const rv = rectOf(val)
    return { col, rot, im, val, cx, h, vw: rv.w, vh: rv.h, t0: ENTRA + i * ESCALONA, v: it.valor }
  })
  const fi = c.destaque != null ? [].concat(c.destaque)[0] : cols.reduce((a, b, i) => (b.v > cols[a].v ? i : a), 0)
  return {
    foco: [cols[fi].cx, baseY - cols[fi].h],
    update(t) {
      const tl = t - c.t0, tq = quadroDe(t) - c.t0
      T(eixo, `scaleX(${E.outCubic(P(tl, 0, ENTRA))})`)
      for (const b of cols) {
        const k = E.outCubic(P(tl, b.t0, b.t0 + CRESCE)), kq = E.outCubic(P(tq, b.t0, b.t0 + CRESCE))
        const ke = E.outCubic(P(tl, b.t0 - 0.3, b.t0 + 0.1))
        O(b.rot, ke); T(b.rot, `translateY(${(1 - ke) * -14}px)`)
        if (b.im) O(b.im, ke)
        b.col.style.height = px(b.h * k); b.col.style.top = px(baseY - b.h * k)
        b.val.textContent = fmt(c.casas ? b.v * kq : Math.round(b.v * kq), c)
        b.val.style.left = px(b.cx - b.val.offsetWidth / 2)   // a largura de layout (a câmera escala o grupo)
        b.val.style.top = px(baseY - b.h * k - 16 - b.vh)
        O(b.val, P(tl, b.t0, b.t0 + 0.15))
      }
      if (c.percorrer) {
        const p = percurso(c, n, tl)
        cols.forEach((b, j) => { b.col.style.background = corNoPercurso(c, j, p); b.val.style.transformOrigin = '50% 100%'; T(b.val, `scale(${pulo(p, j)})`) })
      }
    },
  }
}

GRAFICOS.linha = (g, c, R) => {
  const n = c.itens.length
  let tr = TAM.rotulo
  const passoX = (R.w - 40) / (n - 1 + 1)
  while (Math.max(...c.itens.map((it) => largura(it.rotulo, fTxt(tr, PS.rotulo)))) > passoX * 0.9 && tr > 28) tr -= 2
  const fR = fTxt(tr, PS.rotulo), fV = fNum(TAM.valor)
  const meiaW = Math.max(...c.itens.map((it) => Math.max(largura(it.rotulo, fR), largura(fmt(it.valor, c), fV)))) / 2
  const baseY = R.y + R.h - tr * 1.1 - 22
  const topo = R.y + TAM.valor * 1.1 + 34
  const vals = c.itens.map((it) => it.valor)
  const vmin = c.zero === false ? Math.min(...vals) : 0, vmax = Math.max(...vals)
  const xs = (i) => R.x + meiaW + 8 + ((R.w - 2 * meiaW - 16) * i) / (n - 1)
  const ys = (v) => baseY - 24 - ((baseY - 24 - topo) * (v - vmin)) / (vmax - vmin || 1)
  const pts = c.itens.map((it, i) => [xs(i), ys(it.valor)])
  const s = svgQuadro(g)
  const eixo = sv('line', { x1: R.x, y1: baseY, x2: R.x + R.w, y2: baseY, stroke: CR.eixo, 'stroke-width': 4, 'stroke-linecap': 'round' }, s)
  const desenhaEixo = traco(eixo)
  const caminho = sv('path', { d: 'M' + pts.map((p) => p.join(' ')).join(' L '), fill: 'none', stroke: CR.destaque, 'stroke-width': 8, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, s)
  const desenha = traco(caminho)
  // em que fração do comprimento cada ponto é alcançado (a linha anda por comprimento, não por x)
  const seg = pts.slice(1).map((p, i) => Math.hypot(p[0] - pts[i][0], p[1] - pts[i][1]))
  const tot = seg.reduce((a, b) => a + b, 0)
  const frac = pts.map((_, i) => seg.slice(0, i).reduce((a, b) => a + b, 0) / tot)
  const tLinha0 = ENTRA, tLinha1 = ENTRA + 0.25 * n + 0.8
  const media = vals.reduce((a, b) => a + b, 0) / n
  const marcos = c.itens.map((it, i) => {
    const [x, y] = pts[i]
    const ponto = sv('circle', { cx: x, cy: y, r: 13, fill: destacado(c, i) ? CR.destaque : CR.serie.length > 1 ? corItem(c, i) : CR.destaque }, s)
    const rot = texto(g, it.rotulo, fR, CR.texto, it.rotulo)
    place(rot, x - rectOf(rot).w / 2, baseY + 22)
    const val = texto(g, fmt(it.valor, c), fV, CR.texto, 'value')
    val.style.fontVariantNumeric = 'tabular-nums'
    const rv = rectOf(val)
    // valor em cima do ponto; embaixo só quando o ponto é um vale e há espaço até o eixo
    const vizinhos = [vals[i - 1], vals[i + 1]].filter((v) => v != null)
    const vale = vizinhos.length && vizinhos.every((v) => v > it.valor) && y + 26 + rv.h < baseY - 10
    place(val, x - rv.w / 2, vale ? y + 26 : y - 26 - rv.h)
    // o ponto acende quando a linha chega nele: inverte a curva da linha (inOutSine) na fração do comprimento
    const tp = lerp(tLinha0, tLinha1, Math.acos(1 - 2 * frac[i]) / Math.PI)
    return { ponto, rot, val, tp, v: it.valor }
  })
  const fi = c.destaque != null ? [].concat(c.destaque)[0] : n - 1
  return {
    foco: pts[fi],
    update(t) {
      const tl = t - c.t0, tq = quadroDe(t) - c.t0
      desenhaEixo(E.outCubic(P(tl, 0, ENTRA)))
      const kl = E.inOutSine(P(tl, tLinha0, tLinha1))
      desenha(kl); O(caminho, kl > 0.002 ? 1 : 0)
      for (const m of marcos) {
        const ke = E.outCubic(P(tl, 0.1, 0.5))
        O(m.rot, ke)
        const kp = P(tl, m.tp, m.tp + 0.35)
        O(m.ponto, kp > 0 ? 1 : 0); m.ponto.setAttribute('r', (13 * E.outBack(kp)).toFixed(2))
        O(m.val, P(tl, m.tp, m.tp + 0.15))
        m.val.textContent = fmt(c.casas ? m.v * E.outCubic(P(tq, m.tp, m.tp + 0.5)) : Math.round(m.v * E.outCubic(P(tq, m.tp, m.tp + 0.5))), c)
      }
    },
  }
}

GRAFICOS.rosca = (g, c, R) => {
  const largo = R.w >= 1.45 * R.h
  const D = largo ? Math.min(R.h * 0.92, R.w * 0.5) : Math.min(R.w * 0.8, R.h * 0.7)
  const esp = Math.round(D * 0.13), r = (D - esp) / 2
  const fG = fTit(TAM.grande)
  const wRot = largo ? R.x + R.w - (R.x + D + 10 + TAM.gap) : R.w
  const linhas = quebrar(c.rotulo, fG, wRot)
  const hRot = linhas.length * TAM.grande * 1.08
  const cx = largo ? R.x + D / 2 + 10 : R.x + R.w / 2
  const cy = largo ? R.y + R.h / 2 : R.y + (R.h - (D + TAM.gap * 0.6 + hRot)) / 2 + D / 2
  const s = svgQuadro(g)
  const trilho = sv('circle', { cx, cy, r, fill: 'none', stroke: CR.trilho, 'stroke-width': esp }, s)
  const arco = sv('circle', { cx, cy, r, fill: 'none', stroke: CR.destaque, 'stroke-width': esp, 'stroke-linecap': 'round', transform: `rotate(-90 ${cx} ${cy})` }, s)
  const circ = 2 * Math.PI * r
  arco.setAttribute('stroke-dasharray', `${circ} ${circ}`)
  // o número no miolo (fora do anel), e "de <total>" embaixo dele
  const miolo = (D - 2 * esp) * 0.7
  let tc = TAM.centro
  while (largura(fmt(c.total, c), fNum(tc)) > miolo && tc > 40) tc -= 4
  const num = texto(g, fmt(c.valor, c), fNum(tc), CR.texto, 'value')
  num.style.fontVariantNumeric = 'tabular-nums'
  const rn = rectOf(num)
  const de = texto(g, `${DE} ${fmt(c.total, c)}`, fTxt(TAM.rotulo, PS.rotulo), CR.apoio, 'total')
  const rd = rectOf(de)
  const hMiolo = rn.h * 0.86 + rd.h
  place(num, cx - rn.w / 2, cy - hMiolo / 2 - rn.h * 0.07)
  place(de, cx - rd.w / 2, cy - hMiolo / 2 + rn.h * 0.86)
  // o rótulo: ao lado do anel (gráfico largo) ou embaixo dele
  const rots = linhas.map((l) => texto(g, l, fG, CR.texto, 'label'))
  rots.forEach((e, i) => {
    if (largo) place(e, cx + D / 2 + TAM.gap, cy - hRot / 2 + i * TAM.grande * 1.08)
    else place(e, cx - rectOf(e).w / 2, cy + D / 2 + TAM.gap * 0.6 + i * TAM.grande * 1.08)
  })
  const ang = (2 * Math.PI * c.valor) / c.total
  const t0 = ENTRA + 0.2, t1 = ENTRA + 1.8
  return {
    foco: [cx + r * Math.sin(ang), cy - r * Math.cos(ang)],
    update(t) {
      const tl = t - c.t0, tq = quadroDe(t) - c.t0
      const kt = E.outCubic(P(tl, 0, ENTRA)), ka = 0.75 + 0.25 * E.outCubic(P(tl, 0, ENTRA + 0.5))
      O(trilho, kt); trilho.setAttribute('stroke-width', (esp * kt).toFixed(2))
      const cresce = `translate(${cx} ${cy}) scale(${ka.toFixed(4)}) translate(${-cx} ${-cy})`
      trilho.setAttribute('transform', cresce); arco.setAttribute('transform', `${cresce} rotate(-90 ${cx} ${cy})`)
      const k = E.outCubic(P(tl, t0, t1)), kq = E.outCubic(P(tq, t0, t1))
      arco.setAttribute('stroke-dashoffset', (circ * (1 - (k * c.valor) / c.total)).toFixed(2))
      O(arco, k > 0.004 ? 1 : 0)
      num.textContent = fmt(c.casas ? c.valor * kq : Math.round(c.valor * kq), c)
      num.style.left = px(cx - num.offsetWidth / 2)
      O(num, P(tl, t0 - 0.1, t0 + 0.1)); O(de, E.outCubic(P(tl, t0, t0 + 0.4)))
      rots.forEach((e, i) => { const ke = E.outCubic(P(tl, ENTRA + 0.9 + i * 0.12, ENTRA + 1.4 + i * 0.12)); O(e, ke); T(e, `translateY(${(1 - ke) * 22}px)`) })
    },
  }
}

// ---------- transições: uma janela centrada em cada corte (PLANO.cortes), com a cena de antes e a de depois ----------
const TRN = PLANO.transicao
const FOCOS = []
function opcoes(j) {
  const [x, y] = FOCOS[j] || [CX, CY]
  if (TRN === 'mascara') return { forma: 'circulo', x, y }
  if (TRN === 'zoom') return { x, y, blur: 0 }   // desfocada, a borda da cena que sai mostraria o fundo do palco
  return { dir: 'esquerda' }
}
function transicao(lado, cam, t, j) {
  if (TRN === 'corte' || j < 0 || j >= PLANO.cortes.length) return
  if (lado === 'sai' && TRN === 'mascara') return   // a cena de depois se revela por cima; a de antes só fica embaixo
  const cr = PLANO.cortes[j]
  TR[TRN][lado](cam, t, cr.a, cr.d, opcoes(j))
}

// ---------- as cenas ----------
PLANO.cenas.forEach((c, k) => {
  cena(c.de, c.ate, (root) => {
    const cam = camada(root, CR.fundo)
    const g = div(cam, { width: px(W), height: px(H), transformOrigin: `${(AREA.x0 + AREA.x1) / 2}px ${(AREA.y0 + AREA.y1) / 2}px` })
    let R
    if (c.leiaute === 'dividido' && !RET) {
      const gw = Math.round(AREA.w * 0.56), gap = Math.round(AREA.w * 0.08), tw = AREA.w - gw - gap
      const dir = c.lado === 'direita'
      const gx = dir ? AREA.x1 - gw : AREA.x0, tx = dir ? AREA.x0 : AREA.x0 + gw + gap
      const tit = blocoTitulo(g, c, tx, 0, tw, 'esquerda', 1.18)
      const yT = AREA.y0 + (AREA.h - tit.h) / 2
      for (const e of tit.els) e.style.top = px(parseFloat(e.style.top) + yT)
      const dx = dir ? AREA.x0 + tw + gap / 2 : AREA.x0 + gw + gap / 2
      const linha = div(g, { left: px(dx - 2), top: px(AREA.y0 + 80), width: '4px', height: px(AREA.h - 160), background: CR.divisor, borderRadius: '2px', transformOrigin: '50% 50%' })
      linha.dataset.divisor = '1'
      R = { x: gx, y: AREA.y0 + 30, w: gw, h: AREA.h - 60 }
    } else {
      const tit = blocoTitulo(g, c, AREA.x0, AREA.y0, AREA.w, 'esquerda')
      const y = AREA.y0 + tit.h + TAM.gap
      R = { x: AREA.x0, y, w: AREA.w, h: AREA.y1 - y }
    }
    const gr = GRAFICOS[c.tipo](g, c, R)
    FOCOS[k] = gr.foco
    const divisor = g.querySelector('[data-divisor]')
    return (t) => {
      gr.update(t)
      if (divisor) T(divisor, `scaleY(${E.outCubic(P(t - c.t0, 0, ENTRA + 0.2))})`)
      // a câmera chega: 5% mais perto no primeiro segundo da cena (o gancho), depois respira mais 2,5% até o corte
      T(g, `scale(${(0.9 + 0.1 * E.outCubic(P(t, c.t0, c.t0 + 1.4))) * (1 + 0.025 * P(t, c.de, c.ate))})`)
      transicao('entra', cam, t, k - 1)
      transicao('sai', cam, t, k)
    }
  }, `${c.tipo} ${k + 1}`)
})

// ---------- fecho: só o logo, centrado, parado até o fim ----------
cena(PLANO.fecho.de, PLANO.dur + 0.001, (root) => {
  const F = PARAMS.fecho || {}
  const cam = camada(root, F.fundo || CR.fundo)
  const lw = F.largura || L({ '16x9': 640, '9x16': 620, '1x1': 560, '4x5': 580 })
  const lh = lw / (F.logoAspecto || MK.logoAspecto || 5)
  const lg = imagem(cam, F.logo || MK.logo, { left: px((W - lw) / 2), top: px((H - lh) / 2), width: px(lw), height: px(lh) })
  marcar(lg, 'logo', MK.nome)
  lg.style.transformOrigin = '50% 50%'
  const f0 = PLANO.fecho.t0
  return (t) => {
    // no corte seco o logo entra sozinho (sobe e assenta); nas outras transições ele chega com o fundo do fecho
    if (TRN === 'corte') { const k = spring(t - f0, 2.2, 0.6); O(lg, E.outCubic(P(t, f0, f0 + 0.2))); T(lg, `translateY(${(1 - Math.min(1, k)) * 24}px) scale(${0.94 + 0.06 * Math.min(1, k)})`) }
    transicao('entra', cam, t, PLANO.cortes.length - 1)
  }
}, 'fecho')
