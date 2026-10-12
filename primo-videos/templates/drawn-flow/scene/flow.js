/* Molde drawn-flow: um diagrama de nós e setas que se desenham, e um pacote que percorre o caminho acendendo cada
 * nó por onde passa. Nenhuma marca aqui dentro: cores, fonte, ícones, logo e textos vêm de PARAMS; o grafo e os tempos
 * vêm do plan.js (PLANO). Fecho só com o logo.
 * Ordem: quadro 0 (a chamada) → o desenho (nó a nó, camada a camada, e as setas) → o percurso → transição → fecho. */
const M = PARAMS.marca
const C = { apoio: M.cores.texto, pacote: M.cores.aceso, trava: M.cores.texto, ...M.cores }
const PESO = { titulo: 700, rotulo: 700, detalhe: 500, chamada: 600, ...(M.pesos || {}) }
const fnt = (tam, peso) => `${peso} ${tam}px "${M.fonte}"`
const APAGADO = M.apagado ?? 0.45
const LINHA_ALFA = M.linhaAlfa ?? 1
const RET = !HORIZONTAL                       // retrato ou quadrado: o fluxo desce, sem coluna lateral
const DIR = RET ? 'vertical' : PLANO.direcao
const DIVIDIDO = !RET && PLANO.leiaute === 'dividido'
const SEGUE = PLANO.camera === 'travelling'
const AREA = areaSegura()
const N = Object.fromEntries(PLANO.nos.map((n) => [n.id, n]))

// ---------- medidas por formato (o 19:9 e o 21:9 usam as do 16:9, com a largura a mais no leiaute) ----------
const Z0 = L({
  '16x9': { S: 150, rot: 44, det: 32, cham: 40, tit: 84, lw: 5, gap: 22 },
  '9x16': { S: 132, rot: 46, det: 36, cham: 44, tit: 84, lw: 5, gap: 26 },
  '1x1': { S: 104, rot: 38, det: 30, cham: 36, tit: 72, lw: 4, gap: 20 },
  padrao: { S: 116, rot: 40, det: 32, cham: 38, tit: 76, lw: 4, gap: 22 },
})
// o fluxo em pé num quadro deitado (o leiaute dividido) tem altura de sobra: tudo um quarto maior
const GRANDE = HORIZONTAL && PLANO.direcao === 'vertical'
const Z = GRANDE ? { ...Z0, S: 180, rot: 54, det: 38, tit: 104 } : Z0
const temCham = !!PARAMS.chamada
const topoCham = L({ '9x16': AREA.y0 + 12, padrao: AREA.y0 + 16 })
// a coluna fica 24 px para dentro da área segura (o marcador da lista, lido pelo OCR, encostava na borda)
const COL = DIVIDIDO ? { x0: AREA.x0 + 24, x1: AREA.x0 + Math.round((AREA.x1 - AREA.x0) * 0.38) } : null
// área do diagrama
const DA = (() => {
  if (DIVIDIDO) return { x0: COL.x1 + 70, x1: AREA.x1, y0: AREA.y0 + 30, y1: AREA.y1 - 20 }
  const y0 = temCham ? topoCham + Z.cham * 2 + L({ '9x16': 60, padrao: 44 }) : AREA.y0 + 20
  return { x0: AREA.x0 + L({ '9x16': 10, padrao: 0 }), x1: AREA.x1 - L({ '9x16': 10, padrao: 0 }), y0, y1: AREA.y1 - 14 }
})()
// a câmera estática abre recuando de 1,06 e respira (até 1,035): o diagrama fica um pouco para dentro, para nada sair
// da área segura
const RESPIRO = SEGUE ? 0 : 0.06
DA.x0 += (CX - DA.x0) * RESPIRO; DA.x1 -= (DA.x1 - CX) * RESPIRO; DA.y0 += (CY - DA.y0) * RESPIRO; DA.y1 -= (DA.y1 - CY) * RESPIRO
DA.w = DA.x1 - DA.x0; DA.h = DA.y1 - DA.y0
// a faixa em que o texto pode aparecer inteiro (fora dela, com a câmera andando, o texto esmaece em vez de cortar)
// (a pílula da chamada tem ~2 corpos de altura: a zona começa 34 px abaixo dela)
const ZONA = { x0: AREA.x0, x1: AREA.x1, y0: DIVIDIDO || !temCham ? AREA.y0 : topoCham + Z.cham * 2 + 34, y1: AREA.y1 }
// fluxo em pé com a câmera que segue: o diagrama sobe até o topo, então a chamada sai quando o pacote parte
const CHAM_SAI = SEGUE && DIR === 'vertical' && temCham
const ZONA_Y0 = ZONA.y0

const _cv = document.createElement('canvas').getContext('2d')
const largura = (s, font) => { _cv.font = font; return _cv.measureText(s).width }
/** Quebra o texto no menor número de linhas que cabe em w, com as linhas equilibradas (nada de palavra sozinha embaixo). */
function quebrar(texto, font, w) {
  const ps = String(texto).split(/\s+/)
  const gulosa = (lim) => { const out = []; let cur = ''; for (const p of ps) { const n = cur ? cur + ' ' + p : p; if (largura(n, font) > lim && cur) { out.push(cur); cur = p } else cur = n } if (cur) out.push(cur); return out }
  const base = gulosa(w)
  if (base.length < 2) return base
  let lim = w, melhor = base
  while (lim > 40) { lim -= 8; const q = gulosa(lim); if (q.length > base.length) break; melhor = q }
  return melhor
}

// ---------- geometria: onde fica cada nó ----------
const R = PLANO.R
const maxCam = Math.max(...PLANO.camadas.map((c) => c.length))
let S = Z.S
if (DIR === 'horizontal') S = Math.min(S, Math.round((DA.w / R) * 0.46))
else S = Math.min(S, Math.round((DA.h / R) * 0.56))
const ENTRE = Math.round(S * 0.16)            // do ladrilho ao texto
// o texto é medido na hora de montar a cena (as fontes já carregaram): antes disso a medida sai com a fonte reserva
let LBL, MED, MED_W, CAM
function geometria() {
LBL = (() => {
  const mostraDet = (n) => !DIVIDIDO && n.detalhe
  if (DIR === 'horizontal') {
    const maxW = Math.min(420, DA.w / R - 24)
    const medidas = PLANO.nos.map((n) => {
      const r = quebrar(n.rotulo, fnt(Z.rot, PESO.rotulo), maxW), d = mostraDet(n) ? quebrar(n.detalhe, fnt(Z.det, PESO.detalhe), maxW) : []
      return { id: n.id, r, d, h: r.length * Z.rot * 1.12 + (d.length ? 10 + d.length * Z.det * 1.22 : 0) }
    })
    return { maxW, medidas, hMax: Math.max(...medidas.map((m) => m.h)) }
  }
  // cada nó quebra o texto na largura da célula dele (a camada com um nó só tem a largura toda)
  const maxW = Math.min(560, DA.w / maxCam - S - ENTRE - 18)
  const medidas = PLANO.nos.map((n) => {
    const mw = Math.min(560, DA.w / n.nCamada - S - ENTRE - 18)
    const r = quebrar(n.rotulo, fnt(Z.rot, PESO.rotulo), mw), d = mostraDet(n) ? quebrar(n.detalhe, fnt(Z.det, PESO.detalhe), mw) : []
    const w = Math.max(...r.map((s) => largura(s, fnt(Z.rot, PESO.rotulo))), ...d.map((s) => largura(s, fnt(Z.det, PESO.detalhe))))
    return { id: n.id, r, d, w, h: r.length * Z.rot * 1.12 + (d.length ? 8 + d.length * Z.det * 1.22 : 0) }
  })
  return { maxW, medidas, wMax: Math.max(...medidas.map((m) => m.w)) }
})()
MED = Object.fromEntries(LBL.medidas.map((m) => [m.id, m]))
MED_W = Object.fromEntries(LBL.medidas.map((m) => [m.id, m.w || 0]))
for (const n of PLANO.nos) {
  if (DIR === 'horizontal') {
    const cw = DA.w / R, ch = DA.h / n.nCamada, bloco = S + ENTRE + LBL.hMax
    n.x = DA.x0 + cw * (n.rank + 0.5)
    n.y = DA.y0 + ch * (n.ordem + 0.5) - bloco / 2 + S / 2
  } else {
    // o grupo (ladrilho + texto) é o mesmo para todos: os nós de camadas com a mesma posição ficam na mesma coluna
    const ch = DA.h / R, grupo = S + ENTRE + Math.min(LBL.wMax, DA.w / n.nCamada - S - ENTRE - 18)
    n.y = DA.y0 + ch * (n.rank + 0.5)
    n.x = clamp(DA.x0 + DA.w * n.v - grupo / 2 + S / 2, DA.x0 + S / 2, DA.x1 - S / 2 - ENTRE - MED_W[n.id])
  }
}
CAM = camera(chavesCamera(), { zmax: 2 })
}

// ---------- câmera ----------
function chavesCamera() {
  const F = PLANO.fimPercurso
  // estática: abre recuando (1,06 → 1, o quadro inteiro se mexe desde o quadro 0) e depois respira até 1,035
  if (!SEGUE) return [{ t: 0, x: CX, y: CY, z: 1.06 }, { t: 1.4, x: CX, y: CY, z: 1, dur: 1.4, ease: E.outCubic }, { t: F, x: CX, y: CY, z: 1.035, dur: F - 1.4, ease: E.inOutSine }]
  const zoom = PARAMS.zoom ?? L({ '16x9': 1.45, '9x16': 1.2, padrao: 1.3 })
  const ZONA_Y1_TOPO = CHAM_SAI ? AREA.y0 : ZONA.y0
  const ks = [{ t: 0, x: CX, y: CY, z: 1 }]
  // os momentos do percurso (nós que acendem ou travam juntos viram um ponto só, no meio deles)
  const evs = PLANO.nos.filter((n) => n.aceso != null || n.travado != null).map((n) => ({ t: n.aceso ?? n.travado, n })).sort((a, b) => a.t - b.t)
  const grupos = []
  for (const e of evs) { const g = grupos[grupos.length - 1]; if (g && e.t - g.t < 0.35) g.ns.push(e.n); else grupos.push({ t: e.t, ns: [e.n] }) }
  grupos.forEach((g, k) => {
    // fluxo em pé: a câmera mira o meio do grupo (ladrilho + texto), não só o ladrilho, para o texto caber
    const meio = (n) => (DIR === 'vertical' ? n.x - S / 2 + (S + ENTRE + Math.min(LBL.wMax, DA.w / n.nCamada - S - ENTRE - 18)) / 2 : n.x)
    const x = g.ns.reduce((a, n) => a + meio(n), 0) / g.ns.length, y = g.ns.reduce((a, n) => a + n.y, 0) / g.ns.length
    // em cada nó, a câmera chega junto com o pacote; no primeiro, um pouco antes de ele sair
    // o ponto mirado cai no meio da zona do texto (no 9:16 ela não é o meio do quadro: x 70–940, y 250–1450)
    const zx = (ZONA.x0 + ZONA.x1) / 2, zy = (ZONA_Y1_TOPO + ZONA.y1) / 2
    ks.push({ t: k === 0 ? g.t + 0.15 : g.t, x: x - (zx - CX) / zoom, y: y - (zy - CY) / zoom, z: zoom, dur: k === 0 ? 0.9 : PLANO.ritmo.viagem + PLANO.ritmo.pausa * 0.5, ease: E.inOutSine })
  })
  ks.push({ t: F - 0.1, x: CX, y: CY, z: 1, dur: Math.min(1.2, PLANO.ritmo.final * 0.85), ease: E.inOutCubic })
  return ks
}
const naTela = (x, y, cs) => ({ x: CX + (x - cs.x) * cs.z, y: CY + (y - cs.y) * cs.z })
/** Esmaece o que a câmera empurra para fora da zona do texto (nunca corta letra na borda). */
function foraDaZona(r, cs, soTopo = false) {
  const a = naTela(r.x0, r.y0, cs), b = naTela(r.x1, r.y1, cs)
  const sobra = soTopo ? (temCham && !DIVIDIDO ? ZONA.y0 - a.y : 0) : Math.max(0, ZONA.x0 - a.x, b.x - ZONA.x1, ZONA.y0 - a.y, b.y - ZONA.y1)
  return clamp(1 - sobra / 28)
}

// ---------- a cena do diagrama ----------
const ULTIMO = (() => {
  const acesos = PLANO.nos.filter((n) => n.aceso != null).sort((a, b) => a.aceso - b.aceso || a.i - b.i)
  return N[(PARAMS.fecho && PARAMS.fecho.de) || acesos[acesos.length - 1].id]
})()
let PONTO_FECHO = { x: CX, y: CY, r: 60 }

cena(0, PLANO.fecho.em + PLANO.durTr + (PLANO.durTr ? 0 : 0.0001), (root) => {
  geometria()
  const camA = camada(root, C.fundo)
  const mundo = el('div', { cls: 'layer' }, camA)
  const svg = svgQuadro(mundo)
  const gBase = sv('g', {}, svg), gAnel = sv('g', {}, svg), gLuz = sv('g', {}, svg), gPac = sv('g', {}, svg)
  const defs = sv('defs', {}, svg)
  const LW = Z.lw

  // ---- setas ----
  const setas = PLANO.setas.map((s) => {
    const a = N[s.de], b = N[s.para], m = 14
    let p0, p1, d
    if (DIR === 'horizontal') {
      p0 = [a.x + S / 2 + m, a.y]; p1 = [b.x - S / 2 - m, b.y]
      const k = (p1[0] - p0[0]) * 0.5
      d = Math.abs(p0[1] - p1[1]) < 1 ? `M ${p0[0]} ${p0[1]} L ${p1[0]} ${p1[1]}` : `M ${p0[0]} ${p0[1]} C ${p0[0] + k} ${p0[1]} ${p1[0] - k} ${p1[1]} ${p1[0]} ${p1[1]}`
    } else {
      p0 = [a.x, a.y + S / 2 + m]; p1 = [b.x, b.y - S / 2 - m]
      const k = (p1[1] - p0[1]) * 0.5
      d = Math.abs(p0[0] - p1[0]) < 1 ? `M ${p0[0]} ${p0[1]} L ${p1[0]} ${p1[1]}` : `M ${p0[0]} ${p0[1]} C ${p0[0]} ${p0[1] + k} ${p1[0]} ${p1[1] - k} ${p1[0]} ${p1[1]}`
    }
    const h = LW * 2.8, cab = DIR === 'horizontal'
      ? `M ${p1[0] - h} ${p1[1] - h * 0.85} L ${p1[0]} ${p1[1]} L ${p1[0] - h} ${p1[1] + h * 0.85}`
      : `M ${p1[0] - h * 0.85} ${p1[1] - h} L ${p1[0]} ${p1[1]} L ${p1[0] + h * 0.85} ${p1[1] - h}`
    const estilo = { fill: 'none', 'stroke-width': LW, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }
    let base, desenha
    if (s.tracejada || s.trava) {
      // tracejada: a máscara (traço cheio) se desenha e revela o tracejado por baixo
      const id = `msk${s.i}`
      const mk = sv('mask', { id, maskUnits: 'userSpaceOnUse', x: 0, y: 0, width: W, height: H }, defs)
      const mp = sv('path', { d, ...estilo, stroke: '#ffffff', 'stroke-width': LW + 6 }, mk)
      base = sv('path', { d, ...estilo, stroke: C.linha, 'stroke-dasharray': `${LW * 0.1} ${LW * 3.2}`, opacity: LINHA_ALFA, mask: `url(#${id})` }, gBase)
      desenha = traco(mp)
    } else {
      base = sv('path', { d, ...estilo, stroke: C.linha, opacity: LINHA_ALFA }, gBase)
      desenha = traco(base)
    }
    const ponta = sv('path', { d: cab, ...estilo, stroke: C.linha, opacity: 0 }, gBase)
    const luz = sv('path', { d, ...estilo, stroke: C.aceso, 'stroke-width': LW + 1.5 }, gLuz)
    const acende = traco(luz)
    const pontaLuz = sv('path', { d: cab, ...estilo, stroke: C.aceso, 'stroke-width': LW + 1.5, opacity: 0 }, gLuz)
    const len = base.getTotalLength(), amostras = []
    for (let i = 0; i <= 120; i++) { const q = base.getPointAtLength((len * i) / 120); amostras.push([q.x, q.y]) }
    const em = (p) => { const f = clamp(p) * 120, i = Math.min(119, Math.floor(f)), r = f - i; return [lerp(amostras[i][0], amostras[i + 1][0], r), lerp(amostras[i][1], amostras[i + 1][1], r)] }
    let portao = null
    if (s.trava) {
      const q = em(0.56), q2 = em(0.57), ang = Math.atan2(q2[1] - q[1], q2[0] - q[0]) + Math.PI / 2, gl = S * 0.32
      portao = sv('path', { d: `M ${q[0] - Math.cos(ang) * gl} ${q[1] - Math.sin(ang) * gl} L ${q[0] + Math.cos(ang) * gl} ${q[1] + Math.sin(ang) * gl}`, ...estilo, stroke: C.trava, 'stroke-width': LW + 3, opacity: 0 }, gBase)
      portao.style.transformBox = 'fill-box'; portao.style.transformOrigin = '50% 50%'
    }
    const pontos = s.trava ? [] : [0, 1, 2].map(() => sv('circle', { r: LW * 0.95, fill: C.aceso, opacity: 0 }, gLuz))
    return { s, base, desenha, ponta, luz, acende, pontaLuz, len, em, portao, pontos }
  })

  // ---- nós: o traço do contorno, o ladrilho (com o ícone) e o texto ao lado ----
  const nos = PLANO.nos.map((n) => {
    const rr = S * 0.26
    const contorno = sv('rect', { x: n.x - S / 2, y: n.y - S / 2, width: S, height: S, rx: rr, fill: 'none', stroke: C.linha, 'stroke-width': LW, opacity: LINHA_ALFA }, gBase)
    const desenha = traco(contorno)
    const anel = sv('rect', { fill: 'none', stroke: C.aceso, 'stroke-width': LW, opacity: 0 }, gAnel)
    const lad = el('div', { cls: 'abs', style: { left: px(n.x - S / 2), top: px(n.y - S / 2), width: px(S), height: px(S), borderRadius: px(rr), background: C.ladrilho, opacity: 0 } }, mundo)
    marcarImagem(lad, `node "${n.rotulo}"`)
    let ic = null
    if (n.icone) {
      const lado = S * 0.68
      ic = imagem(lad, n.icone, { left: px((S - lado) / 2), top: px((S - lado) / 2), width: px(lado), height: px(lado), objectFit: 'contain' })
    } else {
      ic = el('div', { cls: 'abs', style: { left: px(S * 0.36), top: px(S * 0.36), width: px(S * 0.28), height: px(S * 0.28), borderRadius: '50%', background: C.linha } }, lad)
    }
    // o texto: embaixo do ladrilho (fluxo deitado) ou ao lado (fluxo em pé)
    const m = MED[n.id], linhas = []
    const fR = fnt(Z.rot, PESO.rotulo), fD = fnt(Z.det, PESO.detalhe)
    let y = DIR === 'horizontal' ? n.y + S / 2 + ENTRE : n.y - m.h / 2
    const x = DIR === 'horizontal' ? n.x : n.x + S / 2 + ENTRE
    const pos = (l, w, yy) => { place(l.line, DIR === 'horizontal' ? x - w / 2 : x, yy) }
    for (const s of m.r) { const l = textLine(mundo, [{ t: s }], { font: fR, color: C.texto }); pos(l, largura(s, fR), y); linhas.push({ l, tipo: 'rotulo', y }); y += Z.rot * 1.12 }
    if (m.d.length) y += DIR === 'horizontal' ? 10 : 8
    for (const s of m.d) { const l = textLine(mundo, [{ t: s }], { font: fD, color: C.apoio }); pos(l, largura(s, fD), y); linhas.push({ l, tipo: 'detalhe', y }); y += Z.det * 1.22 }
    const caixa = (l, tam) => { const w = largura(l.line.textContent, l.line.style.font); const x0 = DIR === 'horizontal' ? x - w / 2 : x; return { x0, x1: x0 + w, y0: parseFloat(l.line.style.top), y1: parseFloat(l.line.style.top) + tam * 1.15 } }
    for (const k of linhas) k.caixa = caixa(k.l, k.tipo === 'rotulo' ? Z.rot : Z.det)
    const ladCaixa = { x0: n.x - S / 2, x1: n.x + S / 2, y0: n.y - S / 2, y1: n.y + S / 2 }
    return { n, contorno, desenha, anel, lad, ic, linhas, ladCaixa }
  })

  // ---- o pacote: a bolinha e o rastro ----
  const pacotes = setas.map((st) => {
    const g = sv('g', { opacity: 0 }, gPac)
    const rastro = [0.18, 0.32, 0.5].map((a, k) => sv('circle', { r: LW * (1.5 - k * 0.3), fill: C.pacote, opacity: a }, g)).reverse()
    const cab = sv('circle', { r: LW * 3, fill: C.pacote }, g)
    return { st, g, rastro, cab }
  })

  // ---- por cima, fora da câmera: a chamada e (no dividido) a coluna com o título e a lista ----
  const cima = el('div', { cls: 'layer' }, camA)
  let cham = null
  if (temCham) {
    const comPilula = !!C.chamadaFundo
    cham = el('div', { cls: 'abs', text: PARAMS.chamada, style: { font: fnt(Z.cham, PESO.chamada), color: comPilula ? C.chamadaTexto || C.texto : C.texto, whiteSpace: 'nowrap',
      ...(comPilula ? { background: C.chamadaFundo, padding: `${Math.round(Z.cham * 0.38)}px ${Math.round(Z.cham * 0.7)}px`, borderRadius: px(Z.cham * 2) } : {}) } }, cima)
    marcar(cham, 'texto', 'headline')
    const rc = rectOf(cham)
    place(cham, RET ? CX - rc.w / 2 : (DIVIDIDO ? COL.x0 : AREA.x0), topoCham)
  }
  let titulo = [], lista = []
  if (DIVIDIDO) {
    const cw = COL.x1 - COL.x0
    const fT = fnt(Z.tit, PESO.titulo), fD = fnt(Math.round(Z.det * 1.08), PESO.detalhe), lh = Math.round(Z.det * 1.08 * 1.25), mk = Math.round(Z.det * 0.75)
    const linT = PARAMS.titulo ? quebrar(PARAMS.titulo, fT, cw) : []
    const itens = PLANO.ordemAcende.map((id) => N[id]).filter((n) => n.detalhe)
    const altura = linT.length * Z.tit * 1.04 + (linT.length ? 64 : 0) + itens.reduce((a, n) => a + quebrar(n.detalhe, fD, cw - mk - 24).length * lh + Math.round(Z.det * 0.9), 0)
    // o título e a lista centrados na altura, abaixo da pílula
    let y = Math.max(topoCham + (temCham ? Z.cham * 2 + 70 : 20), Math.round((AREA.y0 + AREA.y1) / 2 - altura / 2))
    for (const s of linT) { const l = textLine(cima, [{ t: s }], { font: fT, color: C.texto }); place(l.line, COL.x0, y); titulo.push(l); y += Z.tit * 1.04 }
    if (linT.length) y += 64
    for (const id of PLANO.ordemAcende) {
      const n = N[id]
      if (!n.detalhe) continue
      const marca = el('div', { cls: 'abs', style: { left: px(COL.x0), top: px(y + (lh - mk) / 2), width: px(mk), height: px(mk), borderRadius: px(mk * 0.3), boxSizing: 'border-box',
        ...(n.aceso != null ? { background: C.aceso } : { border: `${Math.max(3, LW - 1)}px solid ${C.trava}` }) } }, cima)
      const ls = quebrar(n.detalhe, fD, cw - mk - 24).map((s, k) => { const l = textLine(cima, [{ t: s }], { font: fD, color: C.apoio }); place(l.line, COL.x0 + mk + 24, y + k * lh); return l })
      lista.push({ n, marca, ls, t: n.aceso ?? n.travado })
      y += ls.length * lh + Math.round(Z.det * 0.9)
    }
  }

  const ritmo = PLANO.ritmo
  return (t) => {
    const cs = aplicarCamera(mundo, CAM, t)
    if (CHAM_SAI) {
      const sai = E.inOutCubic(P(t, PLANO.inicio - 0.1, PLANO.inicio + 0.35))
      O(cham, 1 - sai)
      ZONA.y0 = sai >= 1 ? AREA.y0 : ZONA_Y0
    }
    // setas: o traço se desenha, a ponta aparece no fim; a luz segue o pacote; depois, pontinhos correndo
    for (const st of setas) {
      const s = st.s
      const pd = E.inOutCubic(P(t, s.desenha, s.desenhada))
      st.desenha(pd)
      O(st.ponta, s.trava ? 0 : E.outCubic(P(t, s.desenhada - 0.08, s.desenhada + 0.12)) * LINHA_ALFA)
      if (st.portao) {
        const pp = E.outBack(P(t, lerp(s.desenha, s.desenhada, 0.56), lerp(s.desenha, s.desenhada, 0.56) + 0.3))
        O(st.portao, clamp(pp)); T(st.portao, `scale(${0.4 + 0.6 * pp + (s.chega != null ? 0.25 * wob(t - s.chega, 4, 7) : 0)})`)
      }
      let pv = 0
      if (s.parte != null) pv = s.trava ? 0.5 * E.outCubic(P(t, s.parte, s.chega)) - 0.04 * wob(t - s.chega, 3, 6) : E.inOutCubic(P(t, s.parte, s.chega))
      st.acende(Math.max(0, pv))
      O(st.luz, s.parte != null && t >= s.parte ? 1 : 0)
      O(st.pontaLuz, !s.trava && s.chega != null ? E.outCubic(P(t, s.chega - 0.05, s.chega + 0.1)) : 0)
      st.pontos.forEach((c, k) => {
        if (s.chega == null || t < s.chega + 0.15) { O(c, 0); return }
        const f = ((t - s.chega - 0.15) * (220 / st.len) + k / 3) % 1
        const [x, y] = st.em(f)
        c.setAttribute('cx', x); c.setAttribute('cy', y)
        O(c, 0.9 * E.outCubic(P(t, s.chega + 0.15, s.chega + 0.5)) * Math.min(1, f * 8, (1 - f) * 8))
      })
    }
    // o pacote anda pela seta (e para no portão da trava)
    for (const pk of pacotes) {
      const s = pk.st.s
      if (s.parte == null || t < s.parte - 0.05) { O(pk.g, 0); continue }
      const sai = s.trava ? s.chega + 0.55 : s.chega + 0.12
      O(pk.g, (1 - E.inCubic(P(t, sai - 0.15, sai))) * E.outCubic(P(t, s.parte - 0.05, s.parte + 0.08)))
      const pv = s.trava ? 0.5 * E.outCubic(P(t, s.parte, s.chega)) - 0.04 * wob(t - s.chega, 3, 6) : E.inOutCubic(P(t, s.parte, s.chega))
      const [x, y] = pk.st.em(Math.max(0, pv))
      pk.cab.setAttribute('cx', x); pk.cab.setAttribute('cy', y)
      pk.rastro.forEach((c, k) => { const [rx, ry] = pk.st.em(Math.max(0, pv - (k + 1) * (16 / pk.st.len))); c.setAttribute('cx', rx); c.setAttribute('cy', ry) })
    }
    // nós: o contorno se desenha, o ladrilho enche apagado; o pacote chega e ele acende (pulso e anel)
    for (const q of nos) {
      const n = q.n
      q.desenha(E.inOutCubic(P(t, n.desenha, n.desenha + 0.35)))
      const enche = E.outCubic(P(t, n.desenha + 0.25, n.desenha + 0.55))
      const luz = n.aceso != null ? E.outCubic(P(t, n.aceso, n.aceso + 0.18)) : 0
      // o ladrilho some debaixo da pílula da chamada (a câmera que segue o pacote o leva para cima); nas bordas, corta
      const topo = foraDaZona(q.ladCaixa, cs, true)
      O(q.lad, enche * lerp(APAGADO, 1, luz) * topo)
      O(q.contorno, LINHA_ALFA * topo)
      let sc = 0.85 + 0.15 * E.outBack(P(t, n.desenha + 0.25, n.desenha + 0.6))
      if (n.aceso != null) sc *= pulse(t - n.aceso, 0.12, 2.4, 6)
      const treme = n.travado != null ? 7 * wob(t - n.travado, 5, 6) : 0
      T(q.lad, `translateX(${treme}px) scale(${sc})`)
      if (n.aceso != null) {
        const pa = P(t, n.aceso, n.aceso + 0.7)
        const a = S / 2 + lerp(4, ENTRE * 0.8, E.outCubic(pa))
        for (const [k, v] of Object.entries({ x: n.x - a, y: n.y - a, width: 2 * a, height: 2 * a, rx: S * 0.26 + (a - S / 2) })) q.anel.setAttribute(k, v)
        O(q.anel, pa > 0 && pa < 1 ? 1 - E.inCubic(pa) : 0)
      }
      // texto: o rótulo sobe com o desenho; o detalhe, quando o nó acende (ou trava)
      const tDet = n.aceso ?? n.travado
      let kr = 0
      for (const k of q.linhas) {
        if (k.tipo === 'rotulo') riseWords(k.l.words, t, n.desenha + 0.3 + 0.08 * kr++, 0.05)
        else if (tDet != null) riseWords(k.l.words, t, tDet + 0.1, 0.04)
        else riseWords(k.l.words, t, 1e9)
        O(k.l.line, foraDaZona(k.caixa, cs))
      }
    }
    // a coluna do leiaute dividido: o título está no quadro 0; cada item entra quando o nó dele acende
    titulo.forEach((l, k) => riseWords(l.words, t, -0.6 + 0.08 * k, 0.05))
    for (const it of lista) {
      const pm = E.outBack(P(t, it.t, it.t + 0.35))
      O(it.marca, clamp(pm * 1.4)); T(it.marca, `scale(${0.3 + 0.7 * pm})`)
      it.ls.forEach((l, k) => riseWords(l.words, t, it.t + 0.08 + 0.06 * k, 0.04))
    }
    // onde o fecho vai nascer: o último nó aceso, na tela
    const u = naTela(ULTIMO.x, ULTIMO.y, cs)
    PONTO_FECHO = { x: u.x, y: u.y, r: (S / 2) * cs.z }
    if (PLANO.transicao === 'zoom-through') TR.zoom.sai(camA, t, PLANO.fecho.em, PLANO.durTr, { x: PONTO_FECHO.x, y: PONTO_FECHO.y, raio: PONTO_FECHO.r })
  }
}, 'diagrama')

// ---------- fecho: só o logo, centrado e parado ----------
cena(PLANO.fecho.em, PLANO.dur, (root) => {
  const F = PARAMS.fecho
  const camB = camada(root, F.fundo || C.fundo)
  const lw = F.largura ?? L({ '16x9': 640, '9x16': 620, padrao: 560 })
  const lh = lw / (F.logoAspecto || 4)
  const logo = imagem(camB, F.logo, { width: px(lw), left: px(CX - lw / 2), top: px(CY - lh / 2) })
  marcar(logo, 'logo', 'closing logo')
  const anel = PLANO.transicao === 'mascara' ? sv('circle', { fill: 'none', stroke: C.aceso, 'stroke-width': Z.lw + 2, opacity: 0 }, svgQuadro(root)) : null
  const t0 = PLANO.fecho.em, d = PLANO.durTr
  return (t) => {
    const k = E.outCubic(P(t, PLANO.fecho.logoEm, PLANO.fecho.logoEm + 0.45))
    O(logo, k); T(logo, `translateY(${(1 - k) * 24}px)`)
    if (PLANO.transicao === 'mascara') {
      TR.mascara.entra(camB, t, t0, d, { forma: 'circulo', x: PONTO_FECHO.x, y: PONTO_FECHO.y })
      const p = P(t, t0, t0 + d)
      anel.setAttribute('cx', PONTO_FECHO.x); anel.setAttribute('cy', PONTO_FECHO.y)
      anel.setAttribute('r', raioCobre(PONTO_FECHO.x, PONTO_FECHO.y) * E.inOutCubic(p))
      O(anel, p > 0 && p < 1 ? 1 : 0)
    } else if (PLANO.transicao === 'zoom-through') TR.zoom.entra(camB, t, t0, d, { x: PONTO_FECHO.x, y: PONTO_FECHO.y, raio: PONTO_FECHO.r })
  }
}, 'fecho')
