/* Molde phone-3d: um celular em CSS 3D (cantos arredondados, espessura e laterais que pegam luz, sem marca de
 * fabricante) com a tela real gravada. O celular gira e orbita (camera "orbita") ou a câmera se aproxima dele
 * (camera "dolly"); perto, a letra do app fica legível. O texto fica ao lado, nunca sobre a tela: coluna à direita ou à
 * esquerda, metade da tela (leiaute "dividido") ou faixa no alto (9:16 e 1:1). Fecho só com o logo.
 * Nenhuma marca aqui dentro: cores, fonte, logo e textos vêm de PARAMS; a linha do tempo, de LINHA (params.js, escrito
 * pelo render.mjs a partir do JSON e da gravação). */
const PR = PARAMS, LN = LINHA, C = PR.marca.cores, AP = PR.aparelho, CORPO = PR.marca.corpo, PESO = PR.marca.pesos
const FAM = (PR.marca.fonte ? `"${PR.marca.fonte}", ` : '') + '-apple-system, "Helvetica Neue", Arial, sans-serif'
const fonte = (px, peso) => `${peso} ${px}px ${FAM}`
const ORBITA = PR.camera === 'orbita'

// ---------- o aparelho (unidades = px CSS da tela gravada) ----------
const TW = LN.tela.w, TH = LN.tela.h, BZ = 13, BW = TW + 2 * BZ, BH = TH + 2 * BZ, RB = 58, RT = 46, ESP = 34

// ---------- leiaute por formato ----------
// Todo horizontal (16:9, 19:9, 21:9) é a mesma conta pela largura W; vertical e quadrado: texto numa faixa no alto.
const _cv = document.createElement('canvas').getContext('2d')
// sem kerning: o texto da cena é letra por letra (inline-block), e cada letra solta perde o kerning do par
const largura = (s, f) => { _cv.font = f; _cv.fontKerning = 'none'; return _cv.measureText(s).width }
/** quebra em linhas que cabem em w, com no máximo 7 palavras por linha (a tela é lida num relance) */
function quebraGulosa(ps, f, w) {
  const out = []; let cur = []
  for (const p of ps) {
    const n = [...cur, p]
    if (cur.length && (largura(n.join(' '), f) > w || n.length > 7)) { out.push(cur.join(' ')); cur = [p] } else cur = n
  }
  if (cur.length) out.push(cur.join(' '))
  return out
}
// equilibrada: o mesmo número de linhas da gulosa, na menor largura que ainda cabe (nada de palavra sozinha embaixo)
function quebrar(texto, f, w) {
  const ps = String(texto).split(/\s+/).filter(Boolean), n = quebraGulosa(ps, f, w).length
  let lo = 0, hi = w
  for (let i = 0; i < 18; i++) { const m = (lo + hi) / 2; if (quebraGulosa(ps, f, m).length > n) lo = m; else hi = m }
  return quebraGulosa(ps, f, hi)
}
// O leiaute mede o texto: ele é montado na construção da cena, depois de o motor carregar as fontes (medido antes,
// com a fonte reserva, a quebra de linha sai mais estreita que a letra de verdade).
let corpoT, corpoX, corpoR, LAY, ITENS, ALT_PILULA, VAO, ALT_SLOT, REG, RW, RH, RJ, CARTAO, ANCORA, S_GERAL, S_PERTO, KS
function montarLeiaute() {
  corpoT = L({ '16x9': CORPO.titulo, '9x16': CORPO.titulo, '1x1': Math.round(CORPO.titulo * 0.86) })
  corpoX = L({ '16x9': CORPO.texto, '9x16': CORPO.texto, '1x1': Math.max(64, Math.round(CORPO.texto * 0.9)) })
  corpoR = CORPO.rotulo
  // A janela do celular é um retângulo arredondado dentro da área segura: o celular nunca sai dela, nem de perto (o texto
  // da tela gravada fica, assim, dentro da área segura do formato). Com marca.cores.painel, a janela é um cartão chapado
  // nessa cor; sem ele, ela só recorta. Coluna: a janela ocupa o que sobra da coluna de texto. Dividido: a janela é a
  // metade do quadro (o cartão de um lado, o texto do outro); no 9:16 e no 1:1, o texto em cima e a janela embaixo.
  LAY = (() => {
    const dividido = PR.leiaute === 'dividido'
    if (HORIZONTAL) {
      // a janela fica 16 px para dentro da área segura: letra cortada na borda dela não encosta no limite
      const m = Math.round(W * 0.05), my = Math.round(H * 0.05) + 16
      if (dividido) {
        const meio = Math.round(W * 0.5), tx = meio + Math.round(W * 0.055)
        return { janela: { x0: m + 16, x1: meio - Math.round(m * 0.5), y0: my, y1: H - my }, texto: { x: tx, w: W - m - tx } }
      }
      const colW = Math.round(Math.max(560, W * 0.3)), dir = PR.leiaute !== 'left-column'
      const tx = dir ? W - m - colW : m
      return { janela: dir ? { x0: m + 16, x1: tx - 64, y0: my, y1: H - my } : { x0: tx + colW + 64, x1: W - m - 16, y0: my, y1: H - my }, texto: { x: tx, w: colW } }
    }
    const x0 = VERTICAL ? 70 : 60, x1 = VERTICAL ? 940 : W - 60
    return { faixa: true, texto: { x: x0, w: x1 - x0, y: VERTICAL ? 250 : 60 } }
  })()

  // os textos da coluna: o título (a promessa, já no quadro 0) e a frase de cada passo, no mesmo lugar
  ITENS = [
    ...(PR.textos.titulo ? [{ texto: PR.textos.titulo, px: corpoT, peso: PESO.titulo, de: -1, ate: LN.passos[0].v0 }] : []),
    ...LN.passos.map((p, i) => ({ texto: p.frase, px: corpoX, peso: PESO.texto, de: p.v0, ate: i + 1 < LN.passos.length ? LN.passos[i + 1].v0 : LN.F })),
  ].map((it) => ({ ...it, linhas: quebrar(it.texto, fonte(it.px, it.peso), LAY.texto.w) }))
  ALT_PILULA = PR.textos.rotulo ? Math.round(corpoR * 1.7) : 0, VAO = PR.textos.rotulo ? Math.round(corpoR * 0.9) : 0
  ALT_SLOT = Math.max(...ITENS.map((it) => it.linhas.length * it.px * 1.1 + it.px * 0.22))   // + o descendente da última linha
  if (HORIZONTAL) LAY.texto.y = Math.round(H / 2 - (ALT_PILULA + VAO + ALT_SLOT) / 2)
  if (LAY.faixa) {
    const fim = Math.round(LAY.texto.y + ALT_PILULA + VAO + ALT_SLOT)
    LAY.janela = { x0: LAY.texto.x + 16, x1: LAY.texto.x + LAY.texto.w - 16, y0: fim + 28, y1: (VERTICAL ? 1450 : H - 60) - 16 }
  }
  REG = LAY.janela, RW = REG.x1 - REG.x0, RH = REG.y1 - REG.y0, RJ = L({ '16x9': 40, '9x16': 44, '1x1': 36 })
  CARTAO = !!C.painel
  // a âncora puxa um pouco para o lado do texto (no plano de perto, a trava da janela manda)
  ANCORA = { x: LAY.faixa || PR.leiaute === 'dividido' ? (REG.x0 + REG.x1) / 2 : PR.leiaute === 'left-column' ? REG.x0 + RW * 0.45 : REG.x0 + RW * 0.55, y: (REG.y0 + REG.y1) / 2 }
  // escala do celular inteiro (cabe na janela) e de perto (a letra do app legível), sem passar da janela na largura
  S_GERAL = Math.min((RH * 0.93) / BH, (RW * 0.92) / BW)
  S_PERTO = Math.max(S_GERAL * 1.2, Math.min(PR.zoomLeitura, (RW * 0.98) / BW))

  // ---------- câmera: pose do celular no tempo ----------
  KS = [{ v: 0, s: S_GERAL * (ORBITA ? 0.9 : 0.74), x: TW / 2, y: TH / 2 }, { v: LN.A, dur: LN.A, s: S_GERAL, x: TW / 2, y: TH / 2 }]
  for (const f of LN.focos) KS.push({ v: f.v, dur: f.dur, s: S_PERTO, x: f.x, y: f.y })
  KS.push({ v: LN.recFim + LN.recuo, dur: LN.recuo, s: S_GERAL, x: TW / 2, y: TH / 2 })
  KS.push({ v: LN.F + LN.troca, dur: LN.F + LN.troca - (LN.recFim + LN.recuo), s: S_GERAL * (ORBITA ? 1.03 : 1.1), x: TW / 2, y: TH / 2, ease: E.inOutSine })
}

function pose(t) {
  let c = { s: KS[0].s, x: KS[0].x, y: KS[0].y }
  for (let i = 1; i < KS.length; i++) {
    const k = KS[i], d = k.dur || 0.8
    if (t < k.v - d) break
    const e = (k.ease || (i === 1 ? E.outCubic : E.inOutCubic))(P(t, k.v - d, k.v))
    c = { s: Math.exp(lerp(Math.log(c.s), Math.log(k.s), e)), x: lerp(c.x, k.x, e), y: lerp(c.y, k.y, e) }
  }
  // giro: na órbita o celular passa de um lado para o outro; no dolly ele quase não gira, a câmera é que chega. Uma
  // curva só do fim da abertura ao fecho (sem parar no meio: o refino reprova quadro parado), e a câmera respira junto
  const a = E.outCubic(P(t, 0, LN.A)), u = P(t, LN.A, LN.F + LN.troca), b = E.inOutSine(u), onda = Math.sin(Math.PI * u)
  if (ORBITA) {
    c.ay = lerp(-46, -22, a) + 54 * b
    c.ax = lerp(12, 6, a) - 7 * onda + 2 * b
    c.az = lerp(-4, 0, a) + 1.5 * b
  } else {
    c.ay = lerp(-20, -11, a) + 22 * b
    c.ax = lerp(9, 4, a) - 2 * onda + 1 * b
    c.az = lerp(-2, 0, a)
  }
  c.s *= 1 + 0.04 * E.inOutSine(P(t, LN.A, LN.F + LN.troca))
  return c
}
const RAD = Math.PI / 180
function matriz(ax, ay, az) {   // a mesma conta do CSS: rotateX · rotateY · rotateZ
  const [cx, sx, cy, sy, cz, sz] = [Math.cos(ax * RAD), Math.sin(ax * RAD), Math.cos(ay * RAD), Math.sin(ay * RAD), Math.cos(az * RAD), Math.sin(az * RAD)]
  const X = [[1, 0, 0], [0, cx, -sx], [0, sx, cx]], Y = [[cy, 0, sy], [0, 1, 0], [-sy, 0, cy]], Z = [[cz, -sz, 0], [sz, cz, 0], [0, 0, 1]]
  const mul = (A, B) => A.map((r) => [0, 1, 2].map((j) => r[0] * B[0][j] + r[1] * B[1][j] + r[2] * B[2][j]))
  return mul(mul(X, Y), Z)
}
const aplica = (M, v) => [M[0][0] * v[0] + M[0][1] * v[1] + M[0][2] * v[2], M[1][0] * v[0] + M[1][1] * v[1] + M[1][2] * v[2], M[2][0] * v[0] + M[2][1] * v[1] + M[2][2] * v[2]]
const perspectiva = (s) => (ORBITA ? 3.4 * s * BH : 2600)
/** caixa (no quadro) do celular projetado, com a âncora em (ox, oy) */
function caixaProjetada(M, p, ox, oy) {
  const px0 = BZ + p.x - BW / 2, py0 = BZ + p.y - BH / 2, D = perspectiva(p.s)
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity
  for (const cx of [-BW / 2, BW / 2]) for (const cy of [-BH / 2, BH / 2]) for (const cz of [-ESP / 2, ESP / 2]) {
    const v = aplica(M, [(cx - px0) * p.s, (cy - py0) * p.s, cz * p.s]), k = D / (D - v[2])
    x0 = Math.min(x0, ox + v[0] * k); x1 = Math.max(x1, ox + v[0] * k); y0 = Math.min(y0, oy + v[1] * k); y1 = Math.max(y1, oy + v[1] * k)
  }
  return { x0, y0, x1, y1 }
}

// ---------- o perímetro arredondado do corpo: as faces da lateral ----------
function perimetro() {
  const segs = [], n = 12, hw = BW / 2, hh = BH / 2, r = RB
  const cantos = [[hw - r, -hh + r, -90], [hw - r, hh - r, 0], [-hw + r, hh - r, 90], [-hw + r, -hh + r, 180]]
  const retas = [[[-hw + r, -hh], [hw - r, -hh], [0, -1]], [[hw, -hh + r], [hw, hh - r], [1, 0]], [[hw - r, hh], [-hw + r, hh], [0, 1]], [[-hw, hh - r], [-hw, -hh + r], [-1, 0]]]
  retas.forEach(([a, b, nn], i) => {
    segs.push({ a, b, n: nn })
    const [ccx, ccy, a0] = cantos[i]
    for (let k = 0; k < n; k++) {
      const t0 = (a0 + (90 * k) / n) * RAD, t1 = (a0 + (90 * (k + 1)) / n) * RAD, tm = (t0 + t1) / 2
      segs.push({ a: [ccx + r * Math.cos(t0), ccy + r * Math.sin(t0)], b: [ccx + r * Math.cos(t1), ccy + r * Math.sin(t1)], n: [Math.cos(tm), Math.sin(tm)] })
    }
  })
  return segs
}
const LUZ = (() => { const v = [-0.55, -0.5, 0.67], m = Math.hypot(...v); return v.map((x) => x / m) })()
/** a cor da lateral com a luz: k escurece (< 1) ou clareia (> 1); brilho puxa para o branco (o reflexo) */
const tinge = (hex, k, brilho) => { const f = (v) => Math.round(Math.min(255, Math.min(255, v * k) + (255 - Math.min(255, v * k)) * brilho)); const [r, g, b] = hex2rgb(hex); return `rgb(${f(r)},${f(g)},${f(b)})` }
const MEIO = (() => { const v = [LUZ[0], LUZ[1], LUZ[2] + 1], m = Math.hypot(...v); return v.map((x) => x / m) })()

// ---------- fundo ----------
cena(0, VIDEO.duracao, (root) => {
  montarLeiaute()
  const principal = el('div', { cls: 'layer' }, root)
  const fundo = el('div', { cls: 'layer', style: { background: C.fundo } }, principal)
  // com painel, a janela é um cartão chapado de canto arredondado; o símbolo, se houver, mora dentro dele
  const cartao = CARTAO ? el('div', { cls: 'abs', style: { left: px(REG.x0), top: px(REG.y0), width: px(RW), height: px(RH), borderRadius: px(RJ), background: C.painel, overflow: 'hidden' } }, fundo) : null
  let simbolo = null
  if (PR.fundo.tipo === 'simbolo') {
    const tam = PR.fundo.tamanho || 1000, ox = cartao ? REG.x0 : 0, oy = cartao ? REG.y0 : 0
    simbolo = imagem(cartao || fundo, 'media/simbolo.png', { width: px(tam), height: 'auto', left: px(W * (PR.fundo.x ?? 0.1) - tam / 2 - ox), top: px(H * (PR.fundo.y ?? 0.9) - tam / 2 - oy), transformOrigin: '50% 50%' })
  }

  // ---------- o celular ----------
  const palco = el('div', { cls: 'layer', style: { overflow: 'hidden', perspectiveOrigin: '0 0', clipPath: `inset(${REG.y0}px ${W - REG.x1}px ${H - REG.y1}px ${REG.x0}px round ${RJ}px)` } }, principal)
  const PX = 0, PY = 0
  const cel = el('div', { cls: 'abs', style: { transformStyle: 'preserve-3d', transformOrigin: '0 0', width: '0', height: '0' } }, palco)
  const lados = perimetro().map((sg) => {
    const L0 = Math.hypot(sg.b[0] - sg.a[0], sg.b[1] - sg.a[1]) + 0.8, mx = (sg.a[0] + sg.b[0]) / 2, my = (sg.a[1] + sg.b[1]) / 2
    const th = Math.atan2(sg.b[1] - sg.a[1], sg.b[0] - sg.a[0])
    const f = el('div', { cls: 'abs', style: { width: px(L0), height: px(ESP), transformOrigin: '0 0', background: AP.borda,
      transform: `translate3d(${mx}px,${my}px,0) rotateZ(${th}rad) rotateX(90deg) translate(${-L0 / 2}px,${-ESP / 2}px)` } }, cel)
    return { f, n: [sg.n[0], sg.n[1], 0] }
  })
  // botões na lateral (volume à esquerda, liga à direita), sem marca de fabricante
  for (const [lado, y0, y1] of [[-1, 168, 228], [-1, 246, 306], [1, 206, 296]]) {
    const L0 = y1 - y0, x = lado * (BW / 2 + 1.6), my = -BH / 2 + (y0 + y1) / 2, hz = ESP * 0.42
    const f = el('div', { cls: 'abs', style: { width: px(L0), height: px(hz), transformOrigin: '0 0', background: AP.borda, borderRadius: px(hz / 2),
      transform: `translate3d(${x}px,${my}px,0) rotateZ(90deg) rotateX(90deg) translate(${-L0 / 2}px,${-hz / 2}px)` } }, cel)
    lados.push({ f, n: [lado, 0, 0] })
  }
  el('div', { cls: 'abs', style: { width: px(BW), height: px(BH), borderRadius: px(RB), background: AP.corpo, transformOrigin: '50% 50%',
    transform: `translate3d(${-BW / 2}px,${-BH / 2}px,${-ESP / 2}px) rotateY(180deg)` } }, cel)
  const frente = el('div', { cls: 'abs', style: { width: px(BW), height: px(BH), borderRadius: px(RB), background: AP.corpo,
    transform: `translate3d(${-BW / 2}px,${-BH / 2}px,${ESP / 2}px)` } }, cel)
  el('div', { cls: 'abs', style: { left: px(BW / 2 - 26), top: px(4.5), width: '52px', height: '4px', borderRadius: '2px', background: AP.vidro } }, frente)
  const tela = el('div', { cls: 'abs', style: { left: px(BZ), top: px(BZ), width: px(TW), height: px(TH), borderRadius: px(RT), overflow: 'hidden', background: AP.vidro } }, frente)
  const seq = sequencia(tela, LN.quadros, { width: px(TW), height: px(TH) })
  marcarImagem(tela, 'the phone screen')
  // o toque: um ponto que aparece, aperta e solta uma onda
  const toques = LN.toques.map((q) => {
    const d = el('div', { cls: 'abs', style: { width: '40px', height: '40px', borderRadius: '50%', background: rgba(C.toque, 0.28), border: `3px solid ${rgba(C.toque, 0.7)}`, boxSizing: 'border-box', left: px(q.x - 20), top: px(q.y - 20) } }, tela)
    const o = el('div', { cls: 'abs', style: { width: '40px', height: '40px', borderRadius: '50%', border: `3px solid ${rgba(C.toque, 0.8)}`, boxSizing: 'border-box', left: px(q.x - 20), top: px(q.y - 20) } }, tela)
    return { q, d, o }
  })

  // ---------- texto ao lado ----------
  const texto = el('div', { cls: 'layer' }, principal)
  let pilula = null
  if (PR.textos.rotulo) {
    pilula = el('div', { cls: 'abs', text: PR.textos.rotulo, style: { left: px(LAY.texto.x), top: px(LAY.texto.y), height: px(ALT_PILULA), lineHeight: px(ALT_PILULA), padding: `0 ${Math.round(corpoR * 0.75)}px`,
      borderRadius: px(ALT_PILULA / 2), background: C.rotuloFundo, color: C.rotuloTexto, font: fonte(corpoR, PESO.rotulo), whiteSpace: 'nowrap' } }, texto)
    marcar(pilula, 'texto', 'label')
  }
  const slotY = LAY.texto.y + ALT_PILULA + VAO
  const itens = ITENS.map((it) => {
    const ls = bloco(texto, it.linhas.map((s) => [{ t: s }]), { top: slotY, entrelinha: Math.round(it.px * 1.1), alinhar: 'esquerda', x: LAY.texto.x,
      style: { font: fonte(it.px, it.peso), color: C.texto, lineHeight: '1.1' } })
    return { it, ls, ws: palavras(ls) }
  })

  // ---------- fecho: só o logo ----------
  const fecho = el('div', { cls: 'layer', style: { background: PR.fecho.fundo || C.fundo, zIndex: 5 } }, root)
  const lw = Math.min(PR.fecho.largura, W * 0.6), lh = lw / (PR.fecho.proporcao || 4)
  const logo = imagem(fecho, 'media/logo.png', { width: px(lw), left: px(CX - lw / 2), top: px(CY - lh / 2) })
  marcar(logo, 'logo', 'logo')
  registrarTransicao(PR.transicao, LN.F, LN.troca)

  const ultimo = { x: ANCORA.x, y: ANCORA.y }
  return (t) => {
    // a tela: a gravação no tempo dela
    seq.set(LN.r0 + clamp((t - LN.A) * LN.vel, 0, LN.r1 - LN.r0))
    const p = pose(t), M = matriz(p.ax, p.ay, p.az)
    // a âncora fica no centro da região; se o celular projetado passar da região na largura (ou subir na faixa do
    // texto), ela anda o que falta: o texto nunca fica sobre a tela
    let ox = ANCORA.x, oy = ANCORA.y
    const bx = caixaProjetada(M, p, ox, oy)
    if (bx.x1 - bx.x0 <= RW) { if (bx.x0 < REG.x0) ox += REG.x0 - bx.x0; else if (bx.x1 > REG.x1) ox -= bx.x1 - REG.x1 }
    // na altura: inteiro, ele fica dentro da janela; maior que ela (de perto), ele a cobre de cima a baixo, sem sobra
    if (bx.y1 - bx.y0 <= RH) { if (bx.y0 < REG.y0) oy += REG.y0 - bx.y0; else if (bx.y1 > REG.y1) oy -= bx.y1 - REG.y1 }
    else { if (bx.y0 > REG.y0) oy -= bx.y0 - REG.y0; else if (bx.y1 < REG.y1) oy += REG.y1 - bx.y1 }
    ultimo.x = ox; ultimo.y = oy
    const D = perspectiva(p.s), pvx = BZ + p.x - BW / 2, pvy = BZ + p.y - BH / 2
    palco.style.perspective = px(D); palco.style.perspectiveOrigin = `${ox - PX}px ${oy - PY}px`
    cel.style.left = px(ox - PX); cel.style.top = px(oy - PY)
    T(cel, `rotateX(${p.ax.toFixed(3)}deg) rotateY(${p.ay.toFixed(3)}deg) rotateZ(${p.az.toFixed(3)}deg) scale3d(${p.s.toFixed(4)},${p.s.toFixed(4)},${p.s.toFixed(4)}) translate3d(${-pvx}px,${-pvy}px,0)`)
    for (const l of lados) {
      const n = aplica(M, l.n)
      if (n[2] < -0.02) { l.f.style.display = 'none'; continue }
      l.f.style.display = 'block'
      const lam = Math.max(0, n[0] * LUZ[0] + n[1] * LUZ[1] + n[2] * LUZ[2]), esp = Math.pow(Math.max(0, n[0] * MEIO[0] + n[1] * MEIO[1] + n[2] * MEIO[2]), 30)
      l.f.style.background = tinge(AP.borda, 0.45 + 0.75 * lam, 0.55 * esp)
    }
    for (const { q, d, o } of toques) {
      const a = P(t, q.v - 0.35, q.v - 0.1), aperta = P(t, q.v - 0.05, q.v + 0.08), sai = P(t, q.v + 0.35, q.v + 0.6)
      O(d, a * (1 - sai)); T(d, `scale(${(0.6 + 0.4 * E.outBack(a)) * (1 - 0.18 * aperta * (1 - P(t, q.v + 0.08, q.v + 0.25)))})`)
      const e = P(t, q.v, q.v + 0.55)
      O(o, t >= q.v && e < 1 ? 1 - e : 0); T(o, `scale(${1 + 1.6 * E.outCubic(e)})`)
    }
    if (simbolo) T(simbolo, `rotate(${(PR.fundo.giro ?? 6) * t}deg)`)

    // texto: cada item sobe ao entrar e sai subindo antes do próximo; tudo sai antes do fecho (menos no push, que leva junto)
    const saiTudo = PR.transicao === 'push' ? Infinity : LN.F - 0.05
    itens.forEach(({ it, ls, ws }) => {
      const fim = Math.min(it.ate, saiTudo)
      const on = t >= it.de - 0.05 && t < fim
      ls.forEach((l) => { l.line.style.display = on ? 'block' : 'none' })
      if (!on) return
      riseWords(ws, t, it.de, 0.06, 0.55)
      exitWords(ws, t, fim - 0.32, 0.03, 0.3)
    })
    if (pilula) { const s = PR.transicao === 'push' ? 0 : P(t, LN.F - 0.35, LN.F - 0.05); O(pilula, (1 - s) * E.outCubic(P(t, -1, 0))); T(pilula, `translateY(${-24 * E.inCubic(s)}px)`) }

    // fecho
    const e = E.inOutCubic(P(t, LN.F, LN.F + LN.troca))
    fecho.style.display = t >= LN.F || (PR.transicao === 'corte' && t >= LN.F) ? 'block' : 'none'
    T(principal, 'none'); T(fecho, 'none'); fecho.style.clipPath = 'none'
    if (t >= LN.F) {
      if (PR.transicao === 'mascara') iris(fecho, raioCobre(ultimo.x, ultimo.y) * e, ultimo.x, ultimo.y)
      else if (PR.transicao === 'push') { T(principal, `translateX(${(-W * e).toFixed(1)}px)`); T(fecho, `translateX(${(W * (1 - e)).toFixed(1)}px)`) }
    }
    const pl = E.outCubic(P(t, LN.F + LN.troca * 0.55, LN.F + LN.troca + 0.4))
    O(logo, pl); T(logo, `translateY(${((1 - pl) * 30).toFixed(1)}px)`)
    principal.style.visibility = t >= LN.F + LN.troca ? 'hidden' : 'visible'
  }
})
