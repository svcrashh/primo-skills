/* Molde "conversa em balões": uma conversa pessoa ↔ produto. O "digitando…", os balões que entram com mola, o cartão
 * que o produto devolve (arquivo, lista ou imagem, dentro da conversa ou num painel ao lado) e a câmera que acompanha
 * o último balão. Fecho só com o logo. Nada da marca aqui: cores, fontes, logo e textos vêm de PARAMS.
 * Ordem: conteúdo (fundo, janela, conversa, painel) → fecho por cima, com a transição entre os dois. */
const M = PARAMS.marca, C = M.cores
const FX = M.fontes.texto, FTT = M.fontes.titulo || M.fontes.texto
const fX = (s, peso = 500) => `${peso} ${Math.round(s)}px "${FX}"`
const fT = (s, peso = 700) => `${peso} ${Math.round(s)}px "${FTT}"`
const RET = W / H < 1.1                         // retrato e quadrado: o painel ao lado não cabe, o cartão entra na conversa
const LEIAUTE = RET ? 'coluna' : PLANO.leiaute
const CAMERA = PLANO.camera
const JANELA = PARAMS.janela || null
const RESPIRO = PARAMS.respiro ?? 1             // 0 = câmera sem a deriva lenta (o quadro pode parar entre balões)
const MAXP = PARAMS.maxPalavras ?? CONVERSA.MAX_PALAVRAS
const COR = {
  rotulo: C.texto, pontos: C.sobreProduto, janela: C.fundo, janelaTopo: C.janela || C.fundo, janelaTexto: C.texto,
  cartao: C.produto, sobreCartao: C.sobreProduto, etiqueta: C.pessoa, sobreEtiqueta: C.sobrePessoa,
  linha: C.fundo, sobreLinha: C.texto, ...C,
}
COR.painel = C.painel || COR.cartao
COR.sobrePainel = C.sobrePainel || COR.sobreCartao
const CHIPS = PARAMS.chips || {}
const corChip = (nome) => CHIPS[nome] || { fundo: COR.pessoa, texto: COR.sobrePessoa }

// ---------- geometria por formato (19:9 e 21:9 herdam o 16:9 pelo L(); o que é largura vem de W) ----------
const G = L({
  '16x9': { txt: 48, rot: 36, padY: 24, padX: 36, raio: 38, cauda: 12, gap: 20, gapLado: 38, larg: 0.76, ind: [156, 90], cartaoW: 920, titJ: 32, topoJ: 96 },
  '9x16': { txt: 46, rot: 38, padY: 24, padX: 34, raio: 38, cauda: 12, gap: 20, gapLado: 36, larg: 0.84, ind: [150, 88], cartaoW: 800, titJ: 34, topoJ: 100 },
  '1x1': { txt: 40, rot: 34, padY: 22, padX: 30, raio: 34, cauda: 10, gap: 18, gapLado: 30, larg: 0.8, ind: [132, 78], cartaoW: 820, titJ: 30, topoJ: 88 },
  '4x5': { txt: 42, rot: 34, padY: 22, padX: 32, raio: 34, cauda: 10, gap: 18, gapLado: 32, larg: 0.8, ind: [138, 80], cartaoW: 840, titJ: 30, topoJ: 90 },
})
// janela (a moldura do chat, opcional) e corpo (onde a conversa aparece), em coordenadas do quadro
function geometria() {
  let win = null, corpo, painel = null
  if (!RET) {
    const m = Math.round(W * 0.0625)
    if (LEIAUTE === 'dividido') {
      const cw = Math.round(W * 0.41), px0 = Math.round(W * 0.5)
      win = { x: m, y: 66, w: cw, h: 948 }
      corpo = JANELA ? { x: m + 36, y: 66 + G.topoJ + 18, w: cw - 72, h: 948 - G.topoJ - 58 } : { x: m, y: 90, w: cw, h: 900 }
      painel = { x: px0, y: 110, w: W - m - px0, h: 860 }
    } else {
      win = { x: CX - 660, y: 66, w: 1320, h: 948 }
      corpo = JANELA ? { x: CX - 604, y: 66 + G.topoJ + 18, w: 1208, h: 948 - G.topoJ - 58 } : { x: CX - 600, y: 90, w: 1200, h: 900 }
    }
  } else {
    win = L({ '9x16': { x: 70, y: 250, w: 870, h: 1200 }, '1x1': { x: 60, y: 60, w: 960, h: 960 }, '4x5': { x: 60, y: 60, w: 960, h: 1230 } })
    corpo = JANELA ? { x: win.x + 34, y: win.y + G.topoJ + 16, w: win.w - 68, h: win.h - G.topoJ - 52 }
      : L({ '9x16': { x: 84, y: 264, w: 842, h: 1172 }, '1x1': { x: 80, y: 80, w: 920, h: 920 }, '4x5': { x: 80, y: 80, w: 920, h: 1190 } })
  }
  for (const r of [win, corpo, painel]) if (r) { r.cx = r.x + r.w / 2; r.cy = r.y + r.h / 2 }
  return { win: JANELA ? win : null, corpo, painel }
}
const GEO = geometria()
const CORPO = GEO.corpo
const SEGURA = areaSegura()

// ---------- texto ----------
const _cv = document.createElement('canvas').getContext('2d')
const larg = (s, f) => { _cv.font = f; return _cv.measureText(s).width }
/** Quebra por largura e por número de palavras (texto na tela: até MAXP palavras por linha), sem deixar uma palavra
 *  sozinha na última linha quando dá para descer uma da anterior. */
function quebrar(texto, f, maxW, maxPal = MAXP) {
  const ls = []
  let cur = []
  for (const p of String(texto).split(/\s+/).filter(Boolean)) {
    if (cur.length && (cur.length >= maxPal || larg([...cur, p].join(' '), f) > maxW)) { ls.push(cur); cur = [p] } else cur.push(p)
  }
  if (cur.length) ls.push(cur)
  const n = ls.length
  if (n > 1 && ls[n - 1].length === 1 && ls[n - 2].length >= 3) {
    const nova = [ls[n - 2][ls[n - 2].length - 1], ...ls[n - 1]]
    if (larg(nova.join(' '), f) <= maxW) { ls[n - 2] = ls[n - 2].slice(0, -1); ls[n - 1] = nova }
  }
  return ls.map((l) => l.join(' '))
}
const linhaTexto = (parent, s, f, cor, x, y, nome) => marcar(el('div', { cls: 'abs', text: s, style: { left: px(x), top: px(y), font: f, color: cor, whiteSpace: 'nowrap', lineHeight: '1.2' } }, parent), 'texto', nome)
function cortar(s, f, maxW) {   // nome de arquivo longo: corta no meio com reticências
  if (larg(s, f) <= maxW) return s
  let a = Math.ceil(s.length / 2), b = a
  while (a > 2 && larg(s.slice(0, a) + '…' + s.slice(b), f) > maxW) { a--; b++ }
  return s.slice(0, a) + '…' + s.slice(b)
}

// ---------- peças ----------
function balao(parent, m, maxW) {
  const pessoa = m.de === 'pessoa'
  const f = fX(G.txt, 500), lh = Math.round(G.txt * 1.28)
  const linhas = quebrar(m.texto, f, maxW - 2 * G.padX)
  const w = Math.ceil(Math.max(...linhas.map((l) => larg(l, f)))) + 2 * G.padX
  const h = linhas.length * lh + 2 * G.padY
  const raio = pessoa ? `${G.raio}px ${G.cauda}px ${G.raio}px ${G.raio}px` : `${G.cauda}px ${G.raio}px ${G.raio}px ${G.raio}px`
  const box = el('div', { cls: 'abs', style: { width: px(w), height: px(h), background: pessoa ? COR.pessoa : COR.produto, borderRadius: raio } }, parent)
  linhas.forEach((l, k) => linhaTexto(box, l, f, pessoa ? COR.sobrePessoa : COR.sobreProduto, G.padX, G.padY + k * lh + (lh - G.txt * 1.2) / 2, `bubble ${m.i + 1}`))
  return { el: box, w, h }
}

function digitando(parent, de) {
  const [w, h] = G.ind, pessoa = de === 'pessoa'
  const box = el('div', { cls: 'abs', style: { width: px(w), height: px(h), background: pessoa ? COR.pessoa : COR.produto,
    borderRadius: pessoa ? `${G.raio}px ${G.cauda}px ${G.raio}px ${G.raio}px` : `${G.cauda}px ${G.raio}px ${G.raio}px ${G.raio}px` } }, parent)
  const d = Math.round(h * 0.2)
  const pontos = [0, 1, 2].map((k) => el('div', { cls: 'abs', style: { left: px(w / 2 + (k - 1) * d * 1.9 - d / 2), top: px(h / 2 - d / 2), width: px(d), height: px(d), borderRadius: '50%',
    background: pessoa ? COR.sobrePessoa : COR.pontos } }, box))
  return { el: box, w, h, pontos }
}

// miniatura de slide redesenhada (formas chapadas, sem texto): o arquivo se monta na frente de quem assiste
function miniatura(parent, mi, w, h) {
  const b = el('div', { cls: 'abs', style: { width: px(w), height: px(h), background: mi.fundo, borderRadius: px(Math.max(6, w * 0.06)), overflow: 'hidden' } }, parent)
  const tinta = mi.tinta || COR.sobreCartao
  // a < 1: a forma de apoio, na tinta2 (uma cor da marca) ou, sem ela, na tinta mais clara
  const r = (x, y, ww, hh, a = 1, raio = 0.25) => el('div', { cls: 'abs', style: { left: x + '%', top: y + '%', width: ww + '%', height: hh + '%',
    background: a < 1 ? mi.tinta2 || rgba(tinta, a) : tinta, borderRadius: px(Math.min(w * ww, h * hh) / 100 * raio) } }, b)
  const mod = mi.modelo || 'lista'
  if (mod === 'capa') { r(9, 50, 60, 13); r(9, 70, 36, 7, 0.6) }
  else if (mod === 'lista') { r(9, 14, 44, 10); for (let k = 0; k < 3; k++) { r(9, 38 + k * 17, 5, 9, 1, 0.5); r(18, 39 + k * 17, 52 - k * 8, 7, 0.6) } }
  else if (mod === 'numero') { r(9, 22, 34, 44); r(50, 26, 38, 9, 0.6); r(50, 44, 28, 9, 0.6) }
  else if (mod === 'colunas') { r(9, 12, 42, 10); for (let k = 0; k < 3; k++) r(9 + k * 28, 36, 24, 48, 0.55, 0.2) }
  else if (mod === 'grafico') { r(9, 12, 40, 10); [30, 46, 38, 62].forEach((v, k) => r(14 + k * 19, 88 - v, 12, v, k === 3 ? 1 : 0.55, 0.15)) }
  else if (mod === 'fecho') { r(32, 44, 36, 12) }
  return b
}

// a maior escala em que a linha mais longa do cartão cabe inteira (a lista nunca corta um item no meio); nunca menos
// que o corpo mínimo de 28 px
// corpos das peças do cartão na escala k (a etiqueta e o chip, quase sempre em minúsculas, têm piso de 36 e 38 px:
// o OCR mede a palavra pela letra mais alta dela, e "entra" em 34 px mede 25, abaixo dos 28 px do refino)
const PECA = { item: (k) => Math.max(28, 32 * k), chip: (k) => Math.max(38, 26 * k), etiqueta: (k) => Math.max(36, 26 * k) }
function kQueCabe(c, w) {
  if (c.tipo !== 'lista') return Infinity
  const precisa = (k) => Math.max(...c.itens.map((it) => larg(it.t, fX(PECA.item(k), 500)) + (it.chip ? larg(it.chip, fX(PECA.chip(k), 600)) + PECA.chip(k) * 1.75 + 14 * k : 0) + 60 * k + 2 * 26 * k + 8))
  let k = 2
  while (k > 28 / 32 && precisa(k) > w) k -= 0.02
  return k
}
// o cartão que o produto devolve; k = escala (1 dentro da conversa, maior no painel)
function cartao(parent, c, w, k = 1, fundo = COR.cartao, tinta = COR.sobreCartao) {
  k = Math.min(k, kQueCabe(c, w))
  const pad = Math.round(26 * k), raio = Math.round(G.raio * Math.min(k, 1.3))
  const box = el('div', { cls: 'abs', style: { width: px(w), background: fundo, borderRadius: px(raio), overflow: 'hidden' } }, parent)
  const anima = []   // (t) => …, chamados pelo update
  let h = pad
  if (c.tipo === 'arquivo') {
    const ext = (c.etiqueta || (c.nome.match(/\.([a-z0-9]+)$/i) || [, 'arquivo'])[1]).toLowerCase()
    const fe = fX(PECA.etiqueta(k), 700), eh = Math.round(PECA.etiqueta(k) * 1.8)
    const ew = Math.ceil(larg(ext, fe)) + eh * 0.9
    const badge = el('div', { cls: 'abs', style: { left: px(pad), top: px(h), width: px(ew), height: px(eh), borderRadius: px(eh / 2), background: COR.etiqueta } }, box)
    linhaTexto(badge, ext, fe, COR.sobreEtiqueta, (ew - larg(ext, fe)) / 2, (eh - PECA.etiqueta(k) * 1.2) / 2, 'file tag')
    const fn = fX(34 * k, 600), fd = fX(Math.max(28, 28 * k), 500)
    const x2 = pad + ew + Math.round(20 * k), wTxt = w - x2 - pad
    linhaTexto(box, cortar(c.nome, fn, wTxt), fn, tinta, x2, h - 2, 'file name')
    if (c.detalhe) linhaTexto(box, cortar(c.detalhe, fd, wTxt), fd, tinta, x2, h + 34 * k * 1.2 + 2, 'file detail')
    h += Math.max(eh, 34 * k * 1.2 + (c.detalhe ? Math.max(28, 28 * k) * 1.2 + 4 : 0))
    const mins = c.miniaturas || []
    if (mins.length) {
      h += Math.round(22 * k)
      const cols = Math.min(4, mins.length), rows = Math.ceil(mins.length / cols), gap = Math.round(14 * k)
      const tw = (w - 2 * pad - (cols - 1) * gap) / cols, th = tw * 9 / 16
      const grade = el('div', { cls: 'abs', style: { left: px(pad), top: px(h), width: px(w - 2 * pad), height: px(rows * th + (rows - 1) * gap) } }, box)
      marcarImagem(grade, 'the file thumbnails')
      const ms = mins.map((mi, i) => { const e = miniatura(grade, mi, tw, th); place(e, (i % cols) * (tw + gap), Math.floor(i / cols) * (th + gap)); return e })
      h += rows * th + (rows - 1) * gap
      anima.push((t, t0) => ms.forEach((e, i) => { const ti = t0 + 0.35 + i * 0.12, s = spring(t - ti, 2.6, 0.6); O(e, P(t, ti, ti + 0.1)); T(e, `scale(${0.5 + 0.5 * s})`) }))
    }
  } else if (c.tipo === 'lista') {
    if (c.titulo) { const ft = fX(34 * k, 700); linhaTexto(box, c.titulo, ft, tinta, pad, h, 'list title'); h += Math.round(34 * k * 1.2 + 16 * k) }
    const fi = fX(PECA.item(k), 500), fc = fX(PECA.chip(k), 600)
    const rh = Math.round(Math.max(PECA.item(k) * 1.25, PECA.chip(k) * 1.75) + 28 * k), gap = Math.round(12 * k)
    const linhas = c.itens.map((it) => {
      const row = el('div', { cls: 'abs', style: { left: px(pad), top: px(h), width: px(w - 2 * pad), height: px(rh), borderRadius: px(Math.round(18 * k)), background: COR.linha } }, box)
      let chip = null, cw = 0
      if (it.chip) {
        const cc = corChip(it.chip), ch = Math.round(PECA.chip(k) * 1.75)
        cw = Math.ceil(larg(it.chip, fc)) + ch
        chip = el('div', { cls: 'abs', style: { left: px(w - 2 * pad - cw - 14 * k), top: px((rh - ch) / 2), width: px(cw), height: px(ch), borderRadius: px(ch / 2), background: cc.fundo } }, row)
        linhaTexto(chip, it.chip, fc, cc.texto, ch / 2, (ch - PECA.chip(k) * 1.2) / 2, 'chip')
      }
      linhaTexto(row, cortar(it.t, fi, w - 2 * pad - cw - 60 * k), fi, COR.sobreLinha, 22 * k, (rh - PECA.item(k) * 1.2) / 2, 'list item')
      h += rh + gap
      return { row, chip }
    })
    h -= gap
    anima.push((t, t0, tempos) => linhas.forEach(({ row, chip }, i) => {
      const ti = tempos[i], ke = E.outExpo(P(t, ti, ti + 0.35))
      O(row, ke); T(row, `translateY(${(1 - ke) * 22 * k}px)`)
      if (chip) { const s = spring(t - ti - 0.28, 2.6, 0.55); O(chip, P(t, ti + 0.28, ti + 0.36)); T(chip, `scale(${0.4 + 0.6 * s})`) }
    }))
  } else if (c.tipo === 'imagem') {
    const iw = w - 2 * pad, ih = Math.round(iw * (c.proporcao ? 1 / c.proporcao : 9 / 16))
    const im = imagem(box, c.src, { left: px(pad), top: px(h), width: px(iw), height: px(ih), objectFit: 'cover', borderRadius: px(Math.round(20 * k)) })
    marcarImagem(im, 'the card image')
    h += ih
    if (c.legenda) { const fl = fX(Math.max(28, 30 * k), 500); h += Math.round(16 * k); linhaTexto(box, cortar(c.legenda, fl, iw), fl, tinta, pad, h, 'image caption'); h += Math.round(Math.max(28, 30 * k) * 1.2) }
    anima.push((t, t0) => { const ke = E.outCubic(P(t, t0 + 0.15, t0 + 0.6)); O(im, ke); T(im, `scale(${0.96 + 0.04 * ke})`) })
  }
  h += pad
  box.style.height = px(h)
  return { el: box, w, h, anima }
}

// ---------- câmera: chaves { t, cx, cy, z } (a janela da câmera centrada em (cx, cy) da mesa, com zoom z) ----------
function cameraConversa(chaves, dur = 0.55) {
  const ks = chaves.slice().sort((a, b) => a.t - b.t)
  return (t) => {
    let cur = { ...ks[0] }
    for (let i = 1; i < ks.length; i++) {
      const k = ks[i], e = E.inOutCubic(P(t, k.t, k.t + (k.dur ?? dur)))
      if (e <= 0) break
      cur = { cx: lerp(cur.cx, k.cx, e), cy: lerp(cur.cy, k.cy, e), z: Math.exp(lerp(Math.log(cur.z), Math.log(k.z), e)), reg: k.reg || cur.reg }
    }
    return cur
  }
}

// ---------- conteúdo: fundo, janela, conversa, painel ----------
const DIV = LEIAUTE === 'dividido'
const T_FIM_CONTEUDO = PLANO.tSai + PLANO.dTr
let ULTIMO = { x: CX, y: CY }   // onde a conversa termina (a máscara do fecho nasce daí)

cena(0, T_FIM_CONTEUDO + (PLANO.transicao === 'corte' ? 0 : 0.001), (root) => {
  const cam = camada(root, C.fundo)
  let topoTitulo = null
  if (GEO.win) {
    const w = GEO.win
    const jan = el('div', { cls: 'abs', style: { left: px(w.x), top: px(w.y), width: px(w.w), height: px(w.h), background: COR.janela, borderRadius: px(G.raio * 1.2), overflow: 'hidden' } }, cam)
    el('div', { cls: 'abs', style: { left: '0', top: '0', width: px(w.w), height: px(G.topoJ), background: COR.janelaTopo } }, jan)
    if (JANELA.titulo) {
      const f = fX(G.titJ, 600)
      topoTitulo = linhaTexto(jan, cortar(JANELA.titulo, f, w.w - 80), f, COR.janelaTexto, 40, (G.topoJ - G.titJ * 1.2) / 2, 'window title')
    }
  }
  // a mesa: a conversa inteira, no lugar de repouso; a câmera move a mesa (transform) dentro do recorte
  const recorte = el('div', { cls: 'abs', style: GEO.win ? { left: px(CORPO.x), top: px(CORPO.y), width: px(CORPO.w), height: px(CORPO.h), overflow: 'hidden' } : { width: px(W), height: px(H) } }, cam)
  const off = GEO.win ? { x: CORPO.x, y: CORPO.y } : { x: 0, y: 0 }   // a mesa em coordenadas do quadro, dentro do recorte
  const mesa = el('div', { cls: 'abs', style: { width: px(W), height: px(H), transformOrigin: '0 0' } }, recorte)
  const fixo = el('div', { cls: 'layer' }, cam)

  const maxW = CORPO.w * G.larg
  const blocos = []    // { el, r (mesa), de, ate?, tipo }
  const eventos = []   // { t, r, painel? } o que a câmera segue
  let y = CORPO.y + G.gap, ladoAnt = null, rotuloAberto = null
  const painelDe = DIV ? PARAMS.mensagens.findIndex((m) => m.cartao) : -1
  let pn = null
  PARAMS.mensagens.forEach((m0, i) => {
    const m = { ...m0, i }, pl = PLANO.msgs[i], dir = m.de === 'pessoa'
    if (ladoAnt) y += m.de === ladoAnt ? G.gap : G.gapLado
    const xLado = (w) => (dir ? CORPO.x + CORPO.w - w : CORPO.x)
    const quem = (dir ? PARAMS.pessoa : PARAMS.produto) || {}
    const t0 = pl.tDig ?? pl.tEntra
    // rótulo com o nome: na primeira fala de cada um (padrão), em toda troca de quem fala ("sempre") ou nunca (false)
    const rot = PARAMS.rotulos ?? 'primeira'
    const primeira = PARAMS.mensagens.findIndex((x) => x.de === m.de) === i
    if (quem.nome && m.de !== ladoAnt && (rot === 'sempre' || (rot === 'primeira' && primeira))) {
      const f = fX(G.rot, 600), w = larg(quem.nome, f)
      const lb = linhaTexto(mesa, cortar(quem.nome, f, CORPO.w), f, COR.rotulo, xLado(Math.min(w, CORPO.w)), y, `label ${quem.nome}`)
      rotuloAberto = { el: lb, r: { x: xLado(w), y, w, h: G.rot * 1.2 }, de: t0, tipo: 'rotulo' }
      blocos.push(rotuloAberto)
      y += Math.round(G.rot * 1.2 + 10)
    }
    const b = balao(mesa, m, maxW)
    const rb = { x: xLado(b.w), y, w: b.w, h: b.h }
    place(b.el, rb.x, rb.y)
    b.el.style.transformOrigin = dir ? '100% 0' : '0 0'
    if (pl.tDig != null) {
      const d = digitando(mesa, m.de)
      const rd = { x: xLado(d.w), y, w: d.w, h: d.h }
      place(d.el, rd.x, rd.y)
      d.el.style.transformOrigin = dir ? '100% 0' : '0 0'
      blocos.push({ el: d.el, r: rd, de: pl.tDig, ate: pl.tEntra, tipo: 'digitando', pontos: d.pontos })
      eventos.push({ t: pl.tDig, r: rb })   // a câmera já vai para onde o balão vai nascer
    } else eventos.push({ t: pl.tEntra, r: rb })
    blocos.push({ el: b.el, r: rb, de: pl.tEntra, tipo: 'balao' })
    // a câmera enquadra o balão com o rótulo dele; o rótulo esmaece junto com o balão
    const alvoCam = rotuloAberto ? { x: Math.min(rb.x, rotuloAberto.r.x), y: rotuloAberto.r.y, w: 0, h: rb.y + rb.h - rotuloAberto.r.y } : rb
    if (rotuloAberto) { alvoCam.w = Math.max(rb.x + rb.w, rotuloAberto.r.x + rotuloAberto.r.w) - alvoCam.x; rotuloAberto.dono = rb; rotuloAberto = null }
    eventos[eventos.length - 1].r = alvoCam
    y += b.h
    if (m.cartao && i === painelDe) {
      // dividido: o cartão abre no painel ao lado, numa máscara que nasce do balão
      const R = GEO.painel, k = 1.25 * G.txt / 40
      const par = CAMERA === 'zoom' ? mesa : fixo
      const c = cartao(par, m.cartao, R.w, k, COR.painel, COR.sobrePainel)
      const rc = { x: R.x, y: Math.max(R.y, Math.min(R.y + R.h - c.h, CORPO.cy - c.h / 2)), w: R.w, h: c.h }
      place(c.el, rc.x, rc.y)
      pn = { c, r: rc, t0: pl.tCartao, tempos: pl.itens, origem: { x: rb.x + rb.w, y: rb.y + rb.h / 2 }, naMesa: par === mesa }
      if (pn.naMesa) blocos.push({ el: c.el, r: rc, de: pl.tCartao, tipo: 'painel' })
      eventos.push({ t: pl.tCartao, r: rc, painel: true })
    } else if (m.cartao) {
      y += 14
      const c = cartao(mesa, m.cartao, Math.min(G.cartaoW, CORPO.w * 0.9), G.txt / 40)
      const rc = { x: xLado(c.w), y, w: c.w, h: c.h }
      place(c.el, rc.x, rc.y)
      c.el.style.transformOrigin = dir ? '100% 0' : '0 0'
      blocos.push({ el: c.el, r: rc, de: pl.tCartao, tipo: 'cartao', anima: c.anima, tempos: pl.itens })
      eventos.push({ t: pl.tCartao, r: rc })
      y += c.h
    }
    ladoAnt = m.de
  })
  const fimConversa = y + G.gap

  // o que sai da área (o corpo da janela, ou a área segura) esmaece: nada parado fica pela metade na borda
  // a 12 px da área segura o esmaecer já começou: o que encosta na borda nunca fica opaco nela
  const D = 12
  const lim = GEO.win ? { x0: CORPO.x, y0: CORPO.y, x1: CORPO.x + CORPO.w, y1: CORPO.y + CORPO.h }
    : CAMERA === 'zoom' ? { x0: SEGURA.x0 + D, y0: SEGURA.y0 + D, x1: SEGURA.x1 - D, y1: SEGURA.y1 - D }
      : { x0: Math.max(SEGURA.x0 + D, CORPO.x - 40), y0: Math.max(SEGURA.y0 + D, CORPO.y - 30), x1: Math.min(SEGURA.x1 - D, CORPO.x + CORPO.w + 40), y1: Math.min(SEGURA.y1 - D, CORPO.y + CORPO.h + 30) }
  // chaves da câmera
  const o = DIV && CAMERA === 'zoom' ? { x: CX, y: CORPO.cy } : { x: CORPO.cx, y: CORPO.cy }
  const leitura = CORPO.y + CORPO.h * (PARAMS.linhaDeLeitura ?? 0.85)
  const zFoco = PARAMS.zoom ?? 1.25
  const chaves = []
  // o que cada chave quer inteiro na largura da área: a coluna da conversa (e o painel, quando ele está na mesa)
  const regColuna = { x0: CORPO.x, x1: CORPO.x + CORPO.w }
  const regGeral = pn && pn.naMesa ? { x0: Math.min(CORPO.x, pn.r.x), x1: Math.max(CORPO.x + CORPO.w, pn.r.x + pn.r.w) } : regColuna
  if (CAMERA === 'parada') {
    if (fimConversa > CORPO.y + CORPO.h + 1) console.error(`THE CHAT DOES NOT FIT WITH A STILL CAMERA in ${FMT.replace('x', ':')}: it needs ${Math.round(fimConversa - CORPO.y)} px of height and has ${Math.round(CORPO.h)}. Use "camera": "segue" (the camera follows the last bubble) or shorten the messages.`)
    chaves.push({ t: 0, cx: o.x, cy: o.y, z: 1, reg: regGeral })
  } else {
    let rolagem = -Infinity
    eventos.forEach((ev, k) => {
      // o painel na mesa (câmera zoom) abre onde a câmera está olhando naquela hora
      if (ev.painel && pn.naMesa && Number.isFinite(rolagem)) { pn.r.y += rolagem; place(pn.c.el, pn.r.x, pn.r.y) }
      const alvo = ev.painel ? rolagem : Math.max(rolagem, ev.r.y + ev.r.h - leitura)
      rolagem = alvo
      const base = { cx: o.x, cy: o.y + alvo, z: 1, reg: regGeral }
      if (CAMERA === 'segue' || ev.painel && !pn.naMesa) chaves.push({ t: k ? ev.t : 0, ...base })
      else if (ev.painel) {
        chaves.push({ t: ev.t - 0.05, ...base, dur: 0.6 })
        const z = Math.min(zFoco * 0.9, (SEGURA.x1 - SEGURA.x0) * 0.9 / ev.r.w, (SEGURA.y1 - SEGURA.y0) * 0.85 / ev.r.h)
        // o painel abre com a conversa inteira à vista; só depois de os primeiros itens entrarem a câmera chega nele
        chaves.push({ t: ev.t + 1.4, cx: ev.r.x + ev.r.w / 2, cy: ev.r.y + ev.r.h / 2, z: Math.max(1, z), dur: 0.9, reg: { x0: ev.r.x, x1: ev.r.x + ev.r.w } })
      } else {
        // perto da conversa, com a coluna inteira e centrada na largura da área: a câmera só sobe e desce (sem tremer de
        // lado a cada balão) e o balão do outro lado continua à vista
        const z = Math.max(1, Math.min(zFoco, (lim.x1 - lim.x0 - 20) / CORPO.w, CORPO.h * 0.8 / ev.r.h))
        const cx = CORPO.x + CORPO.w / 2
        // o balão novo fica um pouco abaixo do meio: a conversa de antes aparece em cima dele
        const cy = ev.r.y + ev.r.h / 2 - Math.max(0, CORPO.h * 0.4 - ev.r.h * z / 2) * 0.45 / z
        chaves.push({ t: k ? ev.t - 0.05 : 0, cx, cy, z, reg: regColuna })
      }
    })
    if (CAMERA === 'zoom') chaves.push({ t: Math.max(eventos[eventos.length - 1].t + 1.0, PLANO.tSai - 1.0), cx: o.x, cy: o.y + rolagem, z: 1, dur: 0.8, reg: regGeral })
  }
  const cameraEm = cameraConversa(chaves)
  const deriva = CAMERA === 'segue' ? 6 * RESPIRO : 0, creep = CAMERA === 'segue' ? 0 : 0.004 * RESPIRO
  // a deriva lenta (o quadro nunca para) só até o que a chave enquadra encostar na área: nada sai pela borda por causa dela
  const zTeto = (s) => Math.min(...[(o.x - lim.x0) / (s.cx - s.reg.x0), (lim.x1 - o.x) / (s.reg.x1 - s.cx)].filter((v) => v > 0 && Number.isFinite(v)))
  // parada: a conversa desce devagar no espaço que sobra embaixo dela (sem passar do corpo)
  const folga = CAMERA === 'parada' ? Math.max(0, CORPO.y + CORPO.h - fimConversa) : 0
  const estado = (t) => {
    const s = cameraEm(t)
    return { cx: s.cx, cy: s.cy + deriva * t - Math.min(folga, 6 * RESPIRO * t), z: Math.min(s.z * (1 + creep * t), Math.max(s.z, zTeto(s))) }
  }
  // ponto da mesa → quadro (sem o recorte: o recorte só corta)
  const naTela = (r, s) => ({ x0: (r.x - s.cx) * s.z + o.x, y0: (r.y - s.cy) * s.z + o.y, x1: (r.x + r.w - s.cx) * s.z + o.x, y1: (r.y + r.h - s.cy) * s.z + o.y })
  const FAIXA = 36   // em 36 px para fora do limite já sumiu: nada fica pela metade, esmaecido, na borda
  const visivel = (q, faixa = FAIXA) => clamp(1 - Math.max(0, lim.y0 - q.y0, q.y1 - lim.y1, lim.x0 - q.x0, q.x1 - lim.x1) / faixa)
  if (pn && !pn.naMesa) { const q = naTela({ x: pn.origem.x, y: pn.origem.y, w: 0, h: 0 }, estado(pn.t0)); pn.origemTela = { x: q.x0, y: q.y0 } }
  {   // a máscara do fecho nasce do centro do que ficou por último na tela (o painel, quando há)
    const s = estado(PLANO.tSai), r = pn ? pn.r : blocos[blocos.length - 1].r
    const q = pn && !pn.naMesa ? { x0: r.x, y0: r.y, x1: r.x + r.w, y1: r.y + r.h } : naTela(r, s)
    ULTIMO = { x: (q.x0 + q.x1) / 2, y: (q.y0 + q.y1) / 2 }
  }

  return (t) => {
    const s = estado(t)
    T(mesa, `translate(${o.x - off.x}px, ${o.y - off.y}px) scale(${s.z}) translate(${-s.cx}px, ${-s.cy}px)`)
    for (const b of blocos) {
      const on = t >= b.de && (b.ate == null || t < b.ate + 0.14)
      b.el.style.display = on ? 'block' : 'none'
      if (!on) continue
      // o rótulo (uma linha pequena) some logo que passa do limite; o resto esmaece na faixa
      const vis = Math.min(visivel(naTela(b.r, s), b.tipo === 'rotulo' ? 12 : FAIXA), b.dono ? visivel(naTela(b.dono, s)) : 1)
      if (b.tipo === 'digitando') {
        const sp = spring(t - b.de, 2.6, 0.6), sai = P(t, b.ate, b.ate + 0.12)
        O(b.el, vis * P(t, b.de, b.de + 0.1) * (1 - sai)); T(b.el, `scale(${(0.5 + 0.5 * sp) * (1 - 0.4 * sai)})`)
        b.pontos.forEach((p, k) => { const f = Math.max(0, Math.sin(2 * Math.PI * (1.7 * (t - b.de) - k * 0.18))); T(p, `translateY(${-f * G.ind[1] * 0.13}px)`); O(p, 0.45 + 0.55 * f) })
      } else if (b.tipo === 'rotulo') {
        O(b.el, vis * E.outCubic(P(t, b.de, b.de + 0.25)))
      } else if (b.tipo === 'painel') {
        O(b.el, vis)
      } else {
        const sp = spring(t - b.de, 2.4, 0.55)
        O(b.el, vis * P(t, b.de, b.de + 0.12)); T(b.el, `scale(${0.6 + 0.4 * sp})`)
        if (b.anima) b.anima.forEach((f) => f(t, b.de, b.tempos))
      }
    }
    if (pn) {
      const on = t >= pn.t0
      pn.c.el.style.display = on ? 'block' : 'none'
      if (on) {
        // a máscara nasce da ponta do balão (em coordenadas do painel)
        const k = E.inOutCubic(P(t, pn.t0, pn.t0 + 0.55))
        const og = pn.naMesa ? pn.origem : pn.origemTela
        const ox = og.x - pn.r.x, oy = og.y - pn.r.y
        const raio = Math.max(Math.hypot(ox, oy), Math.hypot(ox - pn.r.w, oy), Math.hypot(ox, oy - pn.r.h), Math.hypot(ox - pn.r.w, oy - pn.r.h)) * 1.02
        pn.c.el.style.clipPath = k >= 1 ? 'none' : `circle(${raio * k}px at ${ox}px ${oy}px)`
        pn.c.anima.forEach((f) => f(t, pn.t0, pn.tempos))
      }
    }
    // a conversa sai para o fecho
    if (PLANO.transicao === 'push') TR.push.sai(cam, t, PLANO.tSai, PLANO.dTr, { dir: 'cima' })
  }
}, 'conversa')

// ---------- fecho: só o logo, centrado e parado ----------
cena(PLANO.tSai, PLANO.dur + 0.001, (root) => {
  const cam = camada(root, (PARAMS.fecho && PARAMS.fecho.fundo) || C.fundo)
  const lgW = L({ '16x9': 620, '9x16': 640, '1x1': 560, '4x5': 580 }), lgH = Math.round(lgW / (M.logoAspecto || 4))
  const lg = imagem(cam, M.logo, { left: px(CX - lgW / 2), top: px(CY - lgH / 2), width: px(lgW), height: px(lgH) })
  marcar(lg, 'logo', M.nome)
  lg.style.transformOrigin = '50% 50%'
  return (t) => {
    if (PLANO.transicao === 'push') TR.push.entra(cam, t, PLANO.tSai, PLANO.dTr, { dir: 'cima' })
    if (PLANO.transicao === 'mascara') TR.mascara.entra(cam, t, PLANO.tSai, PLANO.dTr, { forma: 'circulo', x: ULTIMO.x, y: ULTIMO.y })
    const t0 = PLANO.tLogo
    O(lg, E.outCubic(P(t, t0, t0 + 0.25))); T(lg, `scale(${0.88 + 0.12 * spring(t - t0, 1.8, 0.6)})`)
  }
}, 'fecho')
