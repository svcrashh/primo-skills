/* Molde photo-mosaic: fotos numa grade que se reorganiza no tempo da trilha (mosaico → destaque de uma → mosaico),
 * com um rótulo informativo numa faixa ou num painel só dele, nunca sobre a foto. Nada de marca aqui: cores, fonte,
 * fotos, logo e textos vêm de PARAMS, e a linha do tempo (etapas, encaixe de cada mosaico, o logo) vem pronta em LINHA;
 * os dois são escritos pelo assemble.mjs. Cada foto é marcada (marcarImagem) e o VIDEO.texto é "fora-da-imagem": a
 * checagem do motor reprova texto que cruze uma foto. */
const PR = PARAMS, LT = LINHA, C = PR.cores, FAM = PR.fonte.familia, N = PR.fotos.length
const VAO = PR.vao, RAIO = PR.raio
const AS = areaSegura()
const DEITADO = W / H > 1.2
const fonte = (peso, px_) => `${peso} ${px_}px "${FAM}"`
const _cv = document.createElement('canvas').getContext('2d')
const medir = (txt, peso, px_) => { _cv.font = fonte(peso, px_); return _cv.measureText(txt).width }
const ETAPAS = LT.etapas, NE = ETAPAS.length, FE = LT.fecho

// ── geometria: onde ficam as fotos, onde fica o rótulo ──────────────────────────────────────────────────────────────
const G = (() => {
  if (PR.leiaute === 'mosaico') {   // a faixa do rótulo embaixo, dentro da área segura; as fotos em cima dela
    const fh = L({ '16x9': 150, '9x16': 236, padrao: 168 })
    const faixa = { x0: AS.x0, x1: AS.x1, y0: AS.y1 - fh, y1: AS.y1 }
    const fotos = { x0: AS.x0, x1: AS.x1, y0: DEITADO ? AS.y0 : Math.min(AS.y0, 140), y1: faixa.y0 - VAO }
    return { fotos, faixa, texto: faixa, painel: null }
  }
  if (DEITADO) {                    // dividido, deitado: o painel do rótulo à esquerda, a altura toda
    const pw = Math.round(W * 0.36)
    // o texto entra 24 px para dentro da área segura: a 1ª letra (o "Í", o "J") passa um pouco do lugar onde começa
    return { painel: { x0: 0, y0: 0, x1: pw, y1: H }, texto: { x0: AS.x0 + 24, x1: pw - 64, y0: AS.y0, y1: AS.y1 },
      fotos: { x0: pw + 48, x1: W - 56, y0: 56, y1: H - 56 }, sangra: 'x' }
  }
  const ph = Math.round(H * (W / H < 0.7 ? 0.34 : 0.36))   // dividido, em pé: o painel em cima, a largura toda
  return { painel: { x0: 0, y0: 0, x1: W, y1: ph }, texto: { x0: AS.x0 + 24, x1: AS.x1 - 24, y0: AS.y0, y1: ph - 40 },
    fotos: { x0: 48, x1: W - 48, y0: ph + 40, y1: H - 48 }, sangra: 'y' }
})()
const F = G.fotos
const FW = F.x1 - F.x0, FH = F.y1 - F.y0
// a janela recorta as fotos; no travelling do dividido, ela sangra até a borda do quadro do lado oposto ao painel
const TRAV = PR.camera === 'travelling'
const JAN = TRAV && G.sangra === 'x' ? { ...F, x1: W } : TRAV && G.sangra === 'y' ? { ...F, y1: H } : F
const EIXO = FW >= FH ? 'x' : 'y'
const ESTICA = TRAV ? 1.6 : 1
const visivel = EIXO === 'x' ? JAN.x1 - JAN.x0 : JAN.y1 - JAN.y0
const desloca = (t) => (TRAV ? -((EIXO === 'x' ? FW : FH) * ESTICA - visivel) * E.inOutSine(P(t, 0, LT.duracao)) : 0)

// ── os lugares das fotos em cada etapa ──────────────────────────────────────────────────────────────────────────────
function mosaicoEm(ex, t) {
  const off = desloca(t)
  const area = EIXO === 'x' ? { x0: F.x0 + off, y0: F.y0, w: FW * ESTICA, h: FH } : { x0: F.x0, y0: F.y0 + off, w: FW, h: FH * ESTICA }
  const g = area.w >= area.h ? ex.deitada : ex.empe
  const cw = (area.w - (g.c - 1) * VAO) / g.c, ch = (area.h - (g.r - 1) * VAO) / g.r
  return PR.fotos.map((_, p) => {
    const q = g.pos[p]
    return { x: area.x0 + q.x * (cw + VAO), y: area.y0 + q.y * (ch + VAO), w: q.s * cw + (q.s - 1) * VAO, h: q.s * ch + (q.s - 1) * VAO }
  })
}
function destaqueEm(ex) {
  const m = ex.foto, outros = PR.fotos.map((_, p) => p).filter((p) => p !== m), k = outros.length
  const rs = []
  if (FW >= FH) {                   // a foto grande à esquerda, as outras numa coluna (ou duas) à direita
    const cols = k > 6 ? 2 : 1, rows = Math.ceil(k / cols)
    const th = (FH - (rows - 1) * VAO) / rows, tw = Math.min(th * 1.3, (FW * 0.24) / cols)
    const sw = cols * tw + (cols - 1) * VAO
    rs[m] = { x: F.x0, y: F.y0, w: FW - sw - VAO, h: FH }
    outros.forEach((p, j) => { const c = Math.floor(j / rows), r = j % rows; rs[p] = { x: F.x1 - sw + c * (tw + VAO), y: F.y0 + r * (th + VAO), w: tw, h: th } })
  } else {                          // em pé: a grande em cima, as outras numa fileira (ou duas) embaixo
    const rows = k > 4 ? 2 : 1, cols = Math.ceil(k / rows)
    const tw = (FW - (cols - 1) * VAO) / cols, th = Math.min(tw * 0.9, (FH * 0.26) / rows)
    const sh = rows * th + (rows - 1) * VAO
    rs[m] = { x: F.x0, y: F.y0, w: FW, h: FH - sh - VAO }
    outros.forEach((p, j) => { const r = Math.floor(j / cols), c = j % cols; rs[p] = { x: F.x0 + c * (tw + VAO), y: F.y1 - sh + r * (th + VAO), w: tw, h: th } })
  }
  return rs
}
const lugares = (k, t) => (ETAPAS[k].tipo === 'destaque' ? destaqueEm(ETAPAS[k]) : mosaicoEm(ETAPAS[k], t))
// a ordem em que as fotos se mexem: a de leitura do lugar novo (de cima para baixo, da esquerda para a direita)
const ORDEM = ETAPAS.map((_, k) => {
  const rs = lugares(k, ETAPAS[k].t0)
  const idx = PR.fotos.map((_, p) => p).sort((a, b) => rs[a].y - rs[b].y || rs[a].x - rs[b].x)
  const rank = []; idx.forEach((p, j) => { rank[p] = j }); return rank
})
const etapaEm = (t) => { let k = 0; for (let j = 0; j < NE; j++) if (t >= ETAPAS[j].t0) k = j; return k }
const mistura = (a, b, r) => ({ x: lerp(a.x, b.x, r), y: lerp(a.y, b.y, r), w: lerp(a.w, b.w, r), h: lerp(a.h, b.h, r) })
function retNoTempo(p, t) {
  const k = etapaEm(t), b = lugares(k, t)[p]
  if (k === 0) return b
  const a0 = ETAPAS[k].t0 + ORDEM[k][p] * LT.esc
  return mistura(lugares(k - 1, t)[p], b, E.inOutCubic(P(t, a0, a0 + LT.mov)))
}
// guided-zoom: a foto em destaque avança devagar no foco dela (e volta quando o mosaico se refaz)
function zoomExtra(p, t) {
  if (PR.camera !== 'guided-zoom') return 0
  let z = 0
  for (const e of ETAPAS) if (e.tipo === 'destaque' && e.foto === p) z = Math.max(z, 0.16 * E.inOutSine(P(t, e.t0, e.t1)) * (1 - E.inOutCubic(P(t, e.t1, e.t1 + LT.mov))))
  return z
}

// ── texto ───────────────────────────────────────────────────────────────────────────────────────────────────────────
function quebrar(txt, peso, px_, w) {
  const out = []; let cur = ''
  for (const p of txt.split(' ')) { const n = cur ? cur + ' ' + p : p; if (medir(n, peso, px_) > w && cur) { out.push(cur); cur = p } else cur = n }
  if (cur) out.push(cur)
  return out
}
/** O rótulo em linhas: o maior corpo (até o padrão) em que ele cabe na largura, em até `maxL` linhas. */
function caberRotulo(txt, peso, corpo, minimo, w, maxL) {
  for (let px_ = corpo; px_ >= minimo; px_ -= 2) { const ls = quebrar(txt, peso, px_, w); if (ls.length <= maxL && ls.every((l) => medir(l, peso, px_) <= w)) return { px: px_, ls } }
  console.error(`LABEL DOES NOT FIT: "${txt}" did not fit in ${maxL} line(s) at ${minimo} px: shorten the label`)
  return { px: minimo, ls: quebrar(txt, peso, minimo, w) }
}

// ── a cena principal ────────────────────────────────────────────────────────────────────────────────────────────────
cena(0, FE.tr.t0 + FE.tr.dur, (root) => {
  const cam = camada(root, C.fundo)
  if (G.painel) place(el('div', { cls: 'abs', style: { background: C.painel || C.fundo } }, cam), G.painel.x0, G.painel.y0, G.painel.x1 - G.painel.x0, G.painel.y1 - G.painel.y0)
  if (G.faixa && C.faixa && C.faixa.toUpperCase() !== C.fundo.toUpperCase()) {
    const fx = el('div', { cls: 'abs', style: { background: C.faixa, borderRadius: px(RAIO) } }, cam)
    place(fx, G.faixa.x0, G.faixa.y0, G.faixa.x1 - G.faixa.x0, G.faixa.y1 - G.faixa.y0)
  }
  // as fotos, dentro da janela que as recorta
  const jan = el('div', { cls: 'abs', style: { overflow: 'hidden' } }, cam)
  place(jan, JAN.x0, JAN.y0, JAN.x1 - JAN.x0, JAN.y1 - JAN.y0)
  const fotos = PR.fotos.map((f, p) => {
    const e = el('div', { cls: 'abs', style: { overflow: 'hidden', transformOrigin: '50% 50%' } }, jan)
    const im = imagem(e, f.arquivo, { width: '100%', height: '100%', objectFit: 'cover', objectPosition: `${f.foco[0]}% ${f.foco[1]}%`, transformOrigin: `${f.foco[0]}% ${f.foco[1]}%` })
    marcarImagem(e, `photo ${p + 1}`)
    return { e, im }
  })

  // o rótulo: etiqueta fixa (pílula) e um rótulo por etapa, que troca quando o mosaico se reorganiza
  const T0 = G.texto, tw = T0.x1 - T0.x0
  const naFaixa = !!G.faixa, emLinha = naFaixa && DEITADO
  const pEt = L({ '16x9': 32, '9x16': 36, padrao: 30 })
  let pilula = null, pw = 0, ph = 0
  if (PR.etiqueta) {
    pilula = el('div', { cls: 'abs', text: PR.etiqueta, style: { font: fonte(600, pEt), lineHeight: '1', color: C.etiqueta.texto, background: C.etiqueta.fundo,
      padding: `${pEt * 0.42}px ${pEt * 0.8}px`, borderRadius: px(pEt * 2), whiteSpace: 'nowrap' } }, cam)
    marcar(pilula, 'texto', 'tag')
    const r = rectOf(pilula); pw = r.w; ph = r.h
  }
  const gapP = emLinha ? 28 : L({ '16x9': 28, padrao: 22 })
  const peso = naFaixa ? 600 : 700
  const corpo = naFaixa ? L({ '16x9': 64, '9x16': 52, padrao: 48 }) : L({ '16x9': 76, '9x16': 64, padrao: 56 })
  const minimo = L({ '16x9': 40, '9x16': 38, padrao: 34 })
  const larg = emLinha ? tw - (pilula ? pw + gapP : 0) : tw
  const maxL = naFaixa ? 2 : 4
  const rotulos = ETAPAS.map((e) => ({ e, ...caberRotulo(e.rotulo, peso, corpo, minimo, larg, maxL) }))
  const altR = (r) => r.ls.length * r.px * 1.12
  // o bloco (pílula + rótulo) centrado na zona do texto, pela altura do maior rótulo: a pílula não pula na troca
  const hMax = Math.max(...rotulos.map(altR))
  const hBloco = emLinha ? Math.max(ph, hMax) : (pilula ? ph + gapP : 0) + hMax
  const y0 = (T0.y0 + T0.y1) / 2 - hBloco / 2
  if (pilula) place(pilula, T0.x0, emLinha ? (T0.y0 + T0.y1) / 2 - ph / 2 : y0)
  const xR = emLinha ? T0.x0 + (pilula ? pw + gapP : 0) : T0.x0
  rotulos.forEach((r) => {
    const yR = emLinha ? (T0.y0 + T0.y1) / 2 - altR(r) / 2 : y0 + (pilula ? ph + gapP : 0)
    r.linhas = bloco(cam, r.ls.map((s) => [{ t: s }]), { top: yR, entrelinha: r.px * 1.12, alinhar: 'esquerda', x: xR, style: { font: fonte(peso, r.px), lineHeight: '1', color: C.rotulo } })
  })

  return (t) => {
    const tF = FE.tSai
    fotos.forEach((f, p) => {
      const r = retNoTempo(p, t)
      place(f.e, r.x - JAN.x0, r.y - JAN.y0, Math.max(1, r.w), Math.max(1, r.h))
      f.e.style.borderRadius = px(Math.min(RAIO, Math.min(r.w, r.h) / 4))
      // entra (na 1ª etapa) e sai (no fecho), cada foto na sua vez
      const te = -0.3 + ORDEM[0][p] * Math.max(LT.esc, 0.06), ts = tF + ORDEM[0][p] * 0.035
      const ent = E.outCubic(P(t, te, te + 0.5)), sai = E.inCubic(P(t, ts, ts + 0.45))
      O(f.e, ent * (1 - sai))
      T(f.e, `scale(${(lerp(0.88, 1, ent) * (1 - sai)).toFixed(4)})`)
      // a foto respira devagar dentro do recorte (e avança no foco, no guided-zoom)
      const s = 1.07 + 0.05 * Math.sin((2 * Math.PI * t) / 7 + p * 1.3) + zoomExtra(p, t)
      T(f.im, `scale(${s.toFixed(4)})`)
    })
    if (pilula) { const e = E.outCubic(P(t, -0.3, 0.1)), s = E.inCubic(P(t, tF, tF + 0.3)); O(pilula, e * (1 - s)) }
    rotulos.forEach((r, k) => {
      const e = r.e, ws = palavras(r.linhas)
      const ini = k === 0 ? -0.4 : e.t0 + 0.05, fim = k < NE - 1 ? e.t1 : FE.tSai + 0.3
      riseWords(ws, t, ini, 0.05, 0.5)
      exitWords(ws, t, fim - 0.3, 0.02, 0.28)
      r.linhas.forEach((l) => { l.line.style.visibility = t >= ini && t < fim ? 'visible' : 'hidden' })
    })
  }
}, 'mosaic')

// ── o fecho: só o logo, centrado, entrando e parado ─────────────────────────────────────────────────────────────────
cena(FE.tr.t0, LT.duracao + 0.001, (root) => {
  // com o fundo do fecho igual ao do vídeo, nada abre: o logo sobe enquanto as últimas fotos encolhem
  const mesmo = PR.fecho.fundo.toUpperCase() === C.fundo.toUpperCase() && !G.painel
  const cam = camada(root, mesmo ? null : PR.fecho.fundo)
  const lw = PR.fecho.largura || L({ '16x9': 620, '9x16': 640, padrao: 560 })
  const caixa = el('div', { cls: 'layer', style: { display: 'flex', alignItems: 'center', justifyContent: 'center' } }, cam)
  marcar(imagem(caixa, PR.fecho.logo, { position: 'relative', width: px(lw) }), 'logo', 'logo')
  // senão, a cor do fecho abre do painel (dividido) ou do centro (mosaico)
  const opc = G.painel ? { forma: 'diagonal', angulo: DEITADO ? 0 : 90 } : { forma: 'circulo', x: CX, y: (F.y0 + F.y1) / 2 }
  return (t) => {
    if (!mesmo) TR.mascara.entra(cam, t, FE.tr.t0, FE.tr.dur, opc)
    const u = E.outCubic(P(t, FE.tLogo, FE.tLogo + 0.45))
    O(caixa, u); T(caixa, `translateY(${((1 - u) * 36).toFixed(2)}px)`)
  }
}, 'closing')
