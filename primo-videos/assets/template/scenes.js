/* DEMONSTRAÇÃO do motor — apague tudo e escreva as cenas do vídeo.
 * Mostra: layout por formato com L(), texto com máscara, blobs respirando, logo em partes que encaixam
 * no tempo, anel de choque num impacto e duas transições do catálogo (TR.mascara círculo e TR.whip).
 * Cena com transição: o fundo fica numa camada (camada(root, cor)), não no root. */
const C = MARCA.cores
const SERIF = 'Georgia, serif', SANS = 'system-ui, sans-serif'

// 0 – 3 s · manchete
cena(0, 3.05, (root) => {
  root.style.background = C.fundo
  const b1 = makeBlob(root, L({ '16x9': 620, '9x16': 560 }), C.a, C.tinta)
  const b2 = makeBlob(root, 420, C.c)
  const ls = bloco(root, VERTICAL ? [[{ t: 'Every video' }], [{ t: 'has a ' }, { t: 'pace.', style: { color: C.a, fontStyle: 'italic' } }]]
                                  : [[{ t: 'Every video has a ' }, { t: 'pace.', style: { color: C.a, fontStyle: 'italic' } }]],
    { top: L({ '16x9': 470, '9x16': 780 }), entrelinha: 150, style: { font: `700 ${L({ '16x9': 120, '9x16': 104 })}px ${SERIF}`, color: C.tinta } })
  return (t) => {
    breathe(b1, t, W - 90, 90, spring(t, 1.4, 0.55), 10 * t, 0, 0, null, 1)
    breathe(b2, t, 80, H - 70, spring(t - 0.2, 1.4, 0.55), -8 * t, 2, 1.2)
    riseWords(palavras(ls), t, 0.25, 0.09)
    exitWords(palavras(ls), t, 2.75, 0.03)
  }
})

// 3 – 5.5 s · contador num anel (a íris abre a partir do centro; sai em whip no tempo 5,0 → 5,5)
cena(3.0, 5.5, (root) => {
  const cam = camada(root, C.tinta)
  const s = svgQuadro(cam)
  const R = L({ '16x9': 300, '9x16': 330 })
  sv('circle', { cx: CX, cy: CY, r: R, fill: 'none', stroke: rgba(C.fundo, 0.15), 'stroke-width': 3 }, s)
  const arco = sv('circle', { cx: CX, cy: CY, r: R, fill: 'none', stroke: C.b, 'stroke-width': 14, 'stroke-linecap': 'round', transform: `rotate(-90 ${CX} ${CY})` }, s)
  const desenha = traco(arco)
  const num = marcar(el('div', { cls: 'abs', style: { width: px(W), top: px(CY - 90), textAlign: 'center', font: `700 180px ${SANS}`, color: C.fundo } }, cam), 'texto')
  const leg = textLine(cam, [{ t: 'beats per minute' }], { top: px(CY + 110), font: `500 34px ${SANS}`, color: rgba(C.fundo, 0.7) })
  centrarX(leg.line)
  return (t) => {
    TR.mascara.entra(cam, t, 3.0, 0.4, { forma: 'circulo' })
    TR.whip.sai(cam, t, 5.0, 0.5)
    desenha(E.inOutCubic(P(t, 3.2, 4.8)))
    conta(num, t, 3.2, 4.8, 0, 120)
    riseWords(leg.words, t, 3.5)
  }
})

// 5.5 – 8 s · assinatura: entra em whip e as partes do logo caem e encaixam no tempo (5,5 · 5,75 · 6,0)
cena(5.0, 8.01, (root) => {
  const cam = camada(root, C.fundo)
  const LW = L({ '16x9': 900, '9x16': 820 }), LH = LW / 3
  const s = marcar(sv('svg', { viewBox: MARCA.logo.viewBox, width: LW, height: LH }, cam), 'logo', MARCA.nome)
  Object.assign(s.style, { position: 'absolute', left: px(CX - LW / 2), top: px(CY - LH / 2 - 60) })
  const g = sv('g', { transform: MARCA.logo.transform }, s)
  // gabarito: o contorno de cada peça já está lá quando o whip chega (a tela nunca abre vazia)
  for (const pt of MARCA.logo.partes) sv('path', { d: pt.d, fill: 'none', stroke: C.tinta, 'stroke-width': 2, 'stroke-dasharray': '6 6', opacity: 0.35, 'vector-effect': 'non-scaling-stroke' }, g)
  const ps = logoPartes(g, MARCA.logo.partes)
  medirPartes(ps)
  const fx = svgQuadro(cam)
  const choque = sv('circle', { cx: CX, cy: CY - 60, fill: 'none', stroke: C.a }, fx)
  const tag = textLine(cam, [{ t: 'made with the ' }, { t: '/primo-videos', style: { color: C.a } }, { t: ' engine' }], { top: px(CY + LH / 2 + 10), font: `600 40px ${SANS}`, color: C.tinta })
  centrarX(tag.line)
  return (t) => {
    TR.whip.entra(cam, t, 5.0, 0.5)
    const sp = P(t, 5.5, 6.2)
    choque.setAttribute('r', 30 + raioCobre(CX, CY) * E.outCubic(sp)); choque.setAttribute('stroke-width', 18 * (1 - sp) + 0.5); O(choque, sp > 0 && sp < 1 ? 1 - sp : 0)
    ps.forEach((q, i) => {
      const L0 = 5.5 + 0.25 * i, p = P(t, L0 - 0.4, L0)
      const sq = t >= L0 ? 1 + 0.1 * wob(t - L0, 3.4, 8) : 1
      setParte(q, 0, -700 * (1 - E.inQuad(p)), 40 * (1 - E.outCubic(p)) * (i % 2 ? 1 : -1), sq, 2 - sq)
      O(q.wrap, t < L0 - 0.4 ? 0 : 1)
    })
    riseWords(tag.words, t, 6.4, 0.08)
  }
})
