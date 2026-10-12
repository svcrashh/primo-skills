/* Molde light-trail-teaser: fundo escuro, uma linha de luz que desenha pedaços da interface, vira o próximo
 * pedaço, revela o produto inteiro e termina virando o botão do fecho. Tudo vem de PARAM (parametros.js,
 * gerado do JSON de parâmetros pelo assemble.mjs). Uma cena só, do 0 ao fim: a luz é contínua. */
const M = PARAM, C = M.cores, U = M.ui, FT = M.fontes
const D = VIDEO.duracao, N = M.fragmentos.length
const INTRO = 0.9, REV = M.tempos?.revelacao ?? 3.8, FECHO = M.tempos?.fecho ?? 3.6
const FR = (D - INTRO - REV - FECHO) / N
const tF = (i) => INTRO + i * FR
const T_REV = INTRO + N * FR, T_FECHO = T_REV + REV
const NO_DESTAQUE = U.noDestaque || C.fundo
const fT = (peso, px_) => `${peso} ${px_}px/1 "${FT.titulo}"`
const fX = (peso, px_) => `${peso} ${px_}px/1.25 "${FT.texto}"`
const fM = (peso, px_) => `${peso} ${px_}px/1 "${FT.mono}"`
const CAIXA = M.tituloCaixaAlta ? 'uppercase' : 'none'
const Z = M.zoomFragmento ?? 1.35   // o fragmento é um close: corpo maior que o da tela de verdade
// opções desligadas por padrão (para uma marca chapada): `liso` tira o brilho do fundo, a vinheta, as sombras
// e a borda dos cartões e do celular e não esmaece o sobretítulo (a luz e o contorno continuam); `fecho.soLogo` troca
// o fecho (frase, data, botão) por uma varredura da luz que abre o fundo do fecho com o logo sozinho, centrado e parado
const LISO = !!M.liso, SO_LOGO = !!M.fecho?.soLogo
// mais duas, também desligadas por padrão: `fundoSimbolo` { arquivo, altura, x, y, gira } (o símbolo da marca gigante e
// recortado atrás de tudo, girando `gira` graus por segundo; x/y = o centro em fração do quadro) e `fecho.abre: "circulo"`
// (com soLogo: a luz vai ao centro do celular e o fundo do fecho abre em círculo a partir dela, no lugar da lâmina)
const ABRE_CIRCULO = SO_LOGO && M.fecho.abre === 'circulo'
const FE = SO_LOGO ? { frase: [], data: '', botao: '' } : M.fecho

// ── fragmentos de interface (tamanhos em px do quadro; o fragmento é um close, não a tela) ─────────
const FRAG = {
  numero(box, f) {
    el('div', { text: f.titulo || '', style: { font: fX(500, 34 * Z), color: U.texto2, letterSpacing: '0.02em' } }, box)
    const n = el('div', { text: '0', style: { font: fT(700, 200 * Z), color: U.destaque, lineHeight: '1', margin: '18px 0 10px', textTransform: CAIXA } }, box)
    marcar(n, 'texto')
    el('div', { text: f.rotulo, style: { font: fX(500, 44 * Z), color: U.texto } }, box)
    return (u) => conta(n, u, 0.15, 1.6, 0, f.valor, f.casas || 0)
  },
  campo(box, f) {
    el('div', { text: f.rotulo, style: { font: fX(600, 40 * Z), color: U.texto, marginBottom: '22px' } }, box)
    const cx = el('div', { style: { position: 'relative', height: px(128 * Z), borderRadius: px(Math.min(U.raio, 28)), background: U.superficie2, border: `3px solid ${U.borda}`, padding: '0 34px', display: 'flex', alignItems: 'center', font: fX(500, 52 * Z), color: U.texto } }, box)
    const ls = textLine(cx, [{ t: f.texto }], { position: 'relative', font: fX(500, 52 * Z), color: U.texto })
    const caret = el('div', { style: { width: '4px', height: px(60 * Z), background: U.destaque, marginLeft: '6px' } }, cx)
    if (f.ajuda) el('div', { text: f.ajuda, style: { font: fX(400, 32 * Z), color: U.texto2, marginTop: '20px' } }, box)
    return (u) => {
      digita(ls.chars, u, 0.55, 0.55 + Math.min(1.3, ls.chars.length * 0.06))
      cx.style.borderColor = u > 0.4 ? U.destaque : U.borda
      O(caret, Math.floor(u * 2.4) % 2 === 0 || u < 1.9 ? 1 : 0)
    }
  },
  lista(box, f) {
    el('div', { text: f.titulo, style: { font: fX(600, 40 * Z), color: U.texto, marginBottom: '18px' } }, box)
    const linhas = f.itens.map((it, k) => {
      const [a, b] = Array.isArray(it) ? it : [it, '']
      const r = el('div', { style: { display: 'flex', alignItems: 'center', gap: '24px', height: px(104 * Z), borderTop: k ? `2px solid ${U.borda}` : 'none' } }, box)
      el('div', { style: { width: '22px', height: '22px', borderRadius: '50%', background: U.destaque, flex: 'none' } }, r)
      el('div', { text: a, style: { font: fX(500, 46 * Z), color: U.texto, flex: '1', whiteSpace: 'nowrap' } }, r)
      if (b) el('div', { text: b, style: { font: fM(500, 34 * Z), color: U.texto2, whiteSpace: 'nowrap' } }, r)
      return r
    })
    return (u) => linhas.forEach((r, k) => {
      const e = E.outExpo(P(u, 0.45 + k * 0.32, 1.05 + k * 0.32))
      O(r, e); T(r, `translateY(${(1 - e) * 30}px)`)
    })
  },
  botao(box, f) {
    if (f.acima) el('div', { text: f.acima, style: { font: fX(500, 36 * Z), color: U.texto2, marginBottom: '26px' } }, box)
    const wrap = el('div', { style: { position: 'relative', display: 'inline-block' } }, box)
    const b = el('div', { text: f.texto, style: { font: fX(600, 62 * Z), position: 'relative', display: 'inline-block', padding: `0 ${70 * Z}px`, height: px(150 * Z), lineHeight: px(150 * Z), borderRadius: px(75 * Z), background: U.superficie2, border: `3px solid ${U.borda}`, color: U.texto, whiteSpace: 'nowrap' } }, wrap)
    const anel = el('div', { style: { position: 'absolute', inset: '0', borderRadius: px(75 * Z), border: `4px solid ${U.destaque}`, opacity: 0 } }, wrap)
    const iw = parseFloat(box.dataset.w), bw = rectOf(b).w
    if (bw > iw) { b.style.fontSize = px(62 * Z * iw / bw * 0.97); b.style.padding = `0 ${70 * Z * iw / bw * 0.97}px` }
    const ok = f.depois ? el('div', { text: f.depois, style: { font: fX(500, 38 * Z), color: U.destaque, marginTop: '28px', opacity: 0 } }, box) : null
    const tq = Math.max(1.0, FR - 1.3)   // o "toque": acende no destaque
    return (u) => {
      const a = P(u, tq, tq + 0.12)
      b.style.background = a > 0.5 ? U.destaque : U.superficie2
      b.style.color = a > 0.5 ? NO_DESTAQUE : U.texto
      b.style.borderColor = a > 0.5 ? U.destaque : U.borda
      T(wrap, `scale(${u < tq ? 1 : pulse(u - tq, -0.05, 2.5, 8)})`)
      const r = P(u, tq, tq + 0.6)
      O(anel, r > 0 && r < 1 ? 1 - r : 0); T(anel, `scale(${1 + 0.25 * E.outCubic(r)})`)
      if (ok) O(ok, E.outCubic(P(u, tq + 0.2, tq + 0.6)))
    }
  },
  imagem(box, f) {
    const [rx, ry, rw, rh] = f.recorte
    // no 19:9/21:9 o fragmento é mais largo e o print cresce com ele, mas só até a altura da zona (fica centrado)
    const iw = parseFloat(box.dataset.w), hMax = KX > 1 ? G.zonaY[1] - G.zonaY[0] - 2 * G.pad : Infinity
    const w = iw * rh / rw <= hMax ? iw : hMax * rw / rh, h = Math.round(w * rh / rw)
    const v = el('div', { style: { position: 'relative', width: px(w), height: px(h), overflow: 'hidden', borderRadius: px(Math.max(0, U.raio - 18)) } }, box)
    if (w < iw) v.style.margin = '0 auto'
    const k = w / rw
    const img = imagem(v, f.arquivo, { position: 'absolute', left: px(-rx * k), top: px(-ry * k), width: px(f.largura * k), transformOrigin: `${(rx + rw / 2) * k}px ${(ry + rh / 2) * k}px` })
    return (u) => T(img, `scale(${1 + 0.06 * P(u, 0, FR)})`)
  },
  cartao(box, f) {
    el('div', { text: f.titulo, style: { font: fT(700, 76 * Z), color: U.texto, lineHeight: '1.05', textTransform: CAIXA } }, box)
    el('div', { text: f.texto, style: { font: fX(400, 40 * Z), color: U.texto2, marginTop: '22px', lineHeight: '1.3' } }, box)
    return () => {}
  },
}

// ── tela da revelação desenhada (largura lógica 390, como um celular) ─────────────────────────────
const BLOCO = {
  cabecalho(p, b) {
    const w = el('div', { style: { padding: '26px 24px 18px', background: b.fundo || U.destaque, color: b.cor || NO_DESTAQUE } }, p)
    el('div', { text: b.sobre || '', style: { font: fM(600, 13), letterSpacing: '0.12em', opacity: 0.8 } }, w)
    el('div', { text: b.titulo, style: { font: fT(800, 40), lineHeight: '1.05', marginTop: '8px', textTransform: CAIXA } }, w)
    if (b.sub) el('div', { text: b.sub, style: { font: fX(500, 17), marginTop: '8px', opacity: 0.9 } }, w)
  },
  numero(p, b) {
    const w = el('div', { style: { padding: '18px 24px', display: 'flex', gap: '28px' } }, p)
    for (const [v, r] of b.itens) {
      const c = el('div', {}, w)
      el('div', { text: v, style: { font: fT(800, 38), color: U.destaque, textTransform: CAIXA } }, c)
      el('div', { text: r, style: { font: fX(500, 14), color: U.texto2, marginTop: '4px' } }, c)
    }
  },
  lista(p, b) {
    const w = el('div', { style: { margin: '6px 16px', padding: '14px 18px', background: U.superficie2, borderRadius: '16px' } }, p)
    el('div', { text: b.titulo, style: { font: fX(600, 18), color: U.texto, marginBottom: '6px' } }, w)
    for (const it of b.itens) {
      const [a, c] = Array.isArray(it) ? it : [it, '']
      const r = el('div', { style: { display: 'flex', justifyContent: 'space-between', padding: '9px 0', borderTop: `1px solid ${U.borda}`, font: fX(500, 16), color: U.texto } }, w)
      el('span', { text: a }, r); if (c) el('span', { text: c, style: { color: U.texto2, font: fM(500, 14) } }, r)
    }
  },
  botao(p, b) {
    el('div', { text: b.texto, style: { font: fX(600, 20), margin: '14px 16px', height: '58px', lineHeight: '58px', textAlign: 'center', borderRadius: '29px', background: U.destaque, color: NO_DESTAQUE } }, p)
  },
  chips(p, b) {
    const w = el('div', { style: { padding: '10px 16px', display: 'flex', flexWrap: 'wrap', gap: '8px' } }, p)
    for (const c of b.itens) el('div', { text: c, style: { padding: '8px 14px', borderRadius: '18px', border: `1.5px solid ${U.borda}`, font: fX(500, 15), color: U.texto } }, w)
  },
}

// ── geometria por formato ─────────────────────────────────────────────────────────────────────────
// 19:9 e 21:9 usam o leiaute do 16:9 esticado na largura: posições e larguras horizontais crescem com W (KX),
// corpo e alturas ficam como no 16:9 (H é 1080 nos três). No 16:9, KX = 1. O conteúdo do fragmento fica a
// pad + folga = 112·KX px da borda do quadro, dentro dos 5% da área segura.
const KX = HORIZONTAL ? W / 1920 : 1
const G = L({
  '16x9': { visW: 1060 * KX, sangra: 120, folga: 112 * KX - 72, pad: 72, zonaY: [170, 920], nomeW: 640 * KX,
            cel: { h: 930, cx: 960 * KX, cy: 540, fechoX: 1330 * KX }, fecho: { x: 130 * KX, w: 860 * KX, logoY: 210, fraseY: 330, dataY: 610, botaoY: 700 },
            leg: { pe: 1022, w: 1500 * KX, x: 210 * KX, fs: 40 }, prom: { fs: 76, kfs: 30, x: 96 * KX, y: 72 } },
  '9x16': { visW: 940, sangra: 120, folga: 20, pad: 64, zonaY: [640, 1330], nomeW: 900,
            cel: { h: 1040, cx: 540, cy: 860, fechoX: 540, fechoY: 1460 }, fecho: { x: 90, w: 900, logoY: 300, fraseY: 410, dataY: 690, botaoY: 780 },
            leg: { pe: 1440, w: 820, x: 95, fs: 44 }, prom: { fs: 84, kfs: 34, x: 90, y: 268 } },
})

cena(0, D, (root) => {
  root.style.background = C.fundo
  // fundo: dois brilhos da cor da luz que derivam devagar + grade fina + vinheta
  const brilhos = LISO ? [] : [0, 1].map((k) => el('div', { cls: 'abs', style: { width: px(1400), height: px(1400), borderRadius: '50%', background: `radial-gradient(circle, ${rgba(C.luz, k ? 0.10 : 0.16)} 0%, ${rgba(C.luz, 0)} 62%)` } }, root))
  if (M.grade !== false) el('div', { cls: 'layer', style: { backgroundImage: `linear-gradient(${rgba(C.texto, 0.035)} 1px, transparent 1px), linear-gradient(90deg, ${rgba(C.texto, 0.035)} 1px, transparent 1px)`, backgroundSize: '64px 64px' } }, root)
  if (!LISO) el('div', { cls: 'layer', style: { background: `radial-gradient(ellipse at 50% 50%, ${rgba(C.fundo, 0)} 45%, ${rgba(C.fundo, 0.85)} 100%)` } }, root)
  const FS = M.fundoSimbolo
  const simb = FS ? imagem(root, FS.arquivo, { width: px(FS.altura), height: px(FS.altura), left: px(FS.x * W - FS.altura / 2), top: px(FS.y * H - FS.altura / 2) }) : null

  // promessa no quadro 0 → vira o sobretítulo fixo no alto
  const prom = textLine(root, [{ t: M.promessa }], { font: fT(700, G.prom.fs), color: C.texto, textTransform: CAIXA, letterSpacing: '0.01em' })
  const pr = rectOf(prom.line)
  const promW = Math.min(pr.w, VERTICAL ? 780 : W - 2 * G.prom.x)
  const promK0 = promW / pr.w
  const p0 = { x: CX - promW / 2, y: CY - (pr.h * promK0) / 2 - 20 }
  const pk = G.prom.kfs / G.prom.fs
  const p1 = { x: VERTICAL ? CX - (pr.w * pk) / 2 : G.prom.x, y: G.prom.y }
  prom.line.style.transformOrigin = '0 0'

  // fragmentos
  const frags = M.fragmentos.map((f, i) => {
    const lado = VERTICAL ? 0 : i % 2          // 16:9 alterna: sangra à esquerda, depois à direita
    const sangraEsq = VERTICAL || lado === 0   // 9:16: sempre à esquerda, longe dos botões do reels
    const w = G.visW + G.sangra
    const x = sangraEsq ? -G.sangra : W - G.visW
    const box = el('div', { cls: 'abs', style: { width: px(w), boxSizing: 'border-box', padding: `${G.pad}px ${G.pad + (sangraEsq ? 0 : G.sangra + G.folga)}px ${G.pad}px ${G.pad + (sangraEsq ? G.sangra + G.folga : 0)}px`,
      background: U.superficie, border: LISO ? 'none' : `2px solid ${U.borda}`, borderRadius: px(U.raio), boxShadow: LISO ? 'none' : `0 40px 140px ${rgba('#000000', 0.5)}` } }, root)
    box.dataset.w = w - 2 * G.pad - G.sangra - G.folga
    const up = FRAG[f.tipo](box, f)
    const h = rectOf(box).h
    const [z0, z1] = G.zonaY
    const y = Math.round((z0 + z1) / 2 - h / 2)
    place(box, x, y)
    // NOVO · nome do recurso, no lado vazio (16:9) ou acima (9:16)
    let nome = null
    if (f.nome) {
      const g = el('div', { cls: 'abs', style: { width: px(G.nomeW) } }, root)
      place(g, VERTICAL ? 90 : (lado ? 110 * KX : G.visW + 130 * KX), VERTICAL ? y - 230 : y + h / 2 - 110)
      const tag = textLine(g, [{ t: M.etiqueta || 'NOVO' }], { position: 'relative', font: fM(600, VERTICAL ? 34 : 32), color: C.etiqueta || C.luz, letterSpacing: '0.18em' })
      const nm = textLine(g, [{ t: f.nome }], { position: 'relative', marginTop: '18px', font: fT(700, VERTICAL ? 88 : 84), color: C.texto, textTransform: CAIXA, whiteSpace: 'nowrap', width: 'max-content' })
      const cabe = VERTICAL ? W - 180 : W - G.visW - 230 * KX
      const lw = rectOf(nm.line).w
      if (lw > cabe) nm.line.style.fontSize = px((VERTICAL ? 88 : 84) * cabe / lw)
      nome = { g, words: [...tag.words, ...nm.words] }
    }
    const visX0 = Math.max(0, x), visX1 = Math.min(W, x + w)
    return { f, box, up, x, y, w, h, visX0, visX1, nome, t0: tF(i) }
  })

  // celular da revelação
  const CEL = G.cel, celH = CEL.h, celW = Math.round(celH * 390 / 844), borda = Math.round(celH * 0.014)
  const cel = el('div', { cls: 'abs', style: { width: px(celW), height: px(celH), borderRadius: px(celH * 0.075), background: LISO ? C.fundo : mix(C.fundo, '#000000', 0.6), boxShadow: LISO ? 'none' : `0 0 0 2px ${rgba(C.luz, 0.35)}, 0 60px 160px ${rgba('#000000', 0.6)}` } }, root)
  place(cel, CEL.cx - celW / 2, CEL.cy - celH / 2)
  const tela = el('div', { cls: 'abs', style: { left: px(borda), top: px(borda), width: px(celW - 2 * borda), height: px(celH - 2 * borda), borderRadius: px(celH * 0.062), overflow: 'hidden', background: M.revelacao.fundo || U.superficie } }, cel)
  const telaW = celW - 2 * borda, telaH = celH - 2 * borda
  let rolar = () => {}
  if (M.revelacao.imagem) {
    const im = M.revelacao.imagem, ih = telaW * im.altura / im.largura
    const img = imagem(tela, im.arquivo, { position: 'absolute', left: '0', top: '0', width: px(telaW) })
    const [r0, r1] = im.rolar || [0, 0]
    rolar = (t) => T(img, `translateY(${-(ih - telaH) * lerp(r0, r1, E.inOutCubic(P(t, T_REV + 1.2, SO_LOGO ? T_FECHO : T_FECHO + 1.5)))}px)`)
  } else {
    const k = telaW / 390
    const conteudo = el('div', { cls: 'abs', style: { width: '390px', transformOrigin: '0 0', transform: `scale(${k})` } }, tela)
    for (const b of M.revelacao.blocos) BLOCO[b.tipo](conteudo, b)
  }

  // fecho: logo, frase (o bordão), data, botão que nasce da luz
  const FX = G.fecho
  const fecho = el('div', { cls: 'abs', style: { width: px(FX.w) } }, root)
  place(fecho, FX.x, 0)
  let logo
  if (SO_LOGO) logo = null   // o logo do fecho só com logo é o do painel, abaixo
  else if (M.logo.arquivo) { logo = imagem(fecho, M.logo.arquivo, { position: 'absolute', top: px(FX.logoY), height: px(M.logo.altura || 64), left: VERTICAL ? '50%' : '0', transform: VERTICAL ? 'translateX(-50%)' : '' }); marcar(logo, 'logo', M.marca) }
  else { logo = el('div', { text: M.logo.texto, style: { position: 'absolute', top: px(FX.logoY), left: '0', right: '0', textAlign: VERTICAL ? 'center' : 'left', font: fT(800, 64), color: C.texto, textTransform: CAIXA } }, fecho); marcar(logo, 'logo', M.marca) }
  const fraseFs = L({ '16x9': 104, '9x16': 112 })
  const fr = bloco(fecho, FE.frase.map((ln) => ln.split(/(\*[^*]+\*)/).filter(Boolean).map((s) => s.startsWith('*') ? { t: s.slice(1, -1), style: { color: C.luz } } : { t: s })),
    { top: FX.fraseY, entrelinha: fraseFs * 1.2, alinhar: VERTICAL ? 'centro' : 'esquerda', x: VERTICAL ? FX.w / 2 : 0, style: { font: fT(700, fraseFs), color: C.texto, textTransform: CAIXA } })
  if (VERTICAL) fr.forEach((l) => { l.line.style.left = px(parseFloat(l.line.style.left) - FX.x) })
  const dataL = textLine(fecho, [{ t: FE.data }], { top: px(FX.dataY), font: fM(600, L({ '16x9': 36, '9x16': 40 })), color: C.luz, letterSpacing: '0.14em' })
  if (VERTICAL) dataL.line.style.left = px((FX.w - rectOf(dataL.line).w) / 2)
  const btnH = L({ '16x9': 110, '9x16': 120 })
  const btn = el('div', { cls: 'abs', style: { height: px(btnH), borderRadius: px(btnH / 2), background: C.luz, overflow: 'hidden', boxShadow: `0 0 40px ${rgba(C.luz, 0.6)}` } }, root)
  const btnTxt = el('div', { text: FE.botao, style: { font: fX(600, L({ '16x9': 44, '9x16': 46 })), position: 'absolute', left: '0', right: '0', top: '0', lineHeight: px(btnH), textAlign: 'center', color: C.noLuz || C.fundo, whiteSpace: 'nowrap' } }, btn)
  marcar(btnTxt, 'texto')
  const btnW = Math.max(L({ '16x9': 520, '9x16': 640 }), rectOf(btnTxt).w + 120)
  const btnX = VERTICAL ? CX - btnW / 2 : FX.x, btnY = FX.botaoY
  // fecho só com o logo: o fundo do fecho cobre o quadro atrás da luz, o logo entra no centro
  let painel = null, logoSo = null
  if (SO_LOGO) {
    fecho.style.visibility = 'hidden'
    painel = el('div', { cls: 'layer', style: { background: M.fecho.fundo || C.texto, display: 'none' } }, root)
    const lh = M.fecho.logoAltura || M.logo.altura || 64
    logoSo = el('div', { cls: 'abs', style: { width: px(W), height: px(lh), display: 'flex', justifyContent: 'center' } }, painel)
    place(logoSo, 0, CY - lh / 2)
    if (M.logo.arquivo) marcar(imagem(logoSo, M.logo.arquivo, { position: 'relative', height: px(lh) }), 'logo', M.marca)
    else marcar(el('div', { text: M.logo.texto, style: { font: fT(800, lh), lineHeight: px(lh), color: C.fundo, textTransform: CAIXA } }, logoSo), 'logo', M.marca)
  }

  // a linha de luz (div com brilho) e o contorno desenhado (SVG)
  const svg = svgQuadro(root)
  svg.style.filter = `drop-shadow(0 0 10px ${C.luz})`
  const contornos = [...frags.map((q) => [q.x, q.y, q.w, q.h, U.raio]), [CEL.cx - celW / 2, CEL.cy - celH / 2, celW, celH, celH * 0.075]].map(([x, y, w, h, r]) => {
    const p = sv('rect', { x, y, width: w, height: h, rx: r, fill: 'none', stroke: C.luz, 'stroke-width': 3 }, svg)
    return { p, d: traco(p), len: p.getTotalLength() }
  })
  const luz = el('div', { cls: 'abs', style: { background: `linear-gradient(180deg, ${rgba(C.luz, 0)} 0%, ${C.luz} 22%, ${LISO ? C.texto : '#FFFFFF'} 50%, ${C.luz} 78%, ${rgba(C.luz, 0)} 100%)`, boxShadow: `0 0 24px 6px ${rgba(C.luz, 0.75)}, 0 0 90px 20px ${rgba(C.luz, 0.35)}` } }, root)
  const setLuz = (x, y, w, h, o = 1) => { place(luz, x - w / 2, y - h / 2, w, h); luz.style.borderRadius = px(Math.min(w, h) / 2); O(luz, o) }

  // legenda (sempre que a voz fala)
  const LG = G.leg
  const leg = el('div', { cls: 'abs', style: { width: px(LG.w), left: px(LG.x), bottom: px(H - LG.pe), top: 'auto', textAlign: 'center' } }, root)
  const legTxt = el('span', { style: { display: 'inline-block', padding: '12px 26px', borderRadius: '14px', background: rgba(C.fundo, 0.78), font: fX(500, LG.fs), color: C.texto, lineHeight: '1.25' } }, leg)
  marcar(legTxt, 'legenda')
  const falas = M.falas || []

  // posição do "ponto de luz" correndo pela borda do fragmento
  const naBorda = (q, prog) => { const c = contornos[frags.indexOf(q)], pt = c.p.getPointAtLength(c.len * (0.2 + prog) % c.len); return [clamp(pt.x, 20, W - 20), clamp(pt.y, 20, H - 20)] }
  const inicioDe = (q) => [q.visX0 + 4, q.y + q.h / 2]

  return (t) => {
    // fundo vivo
    if (simb) T(simb, `rotate(${(FS.gira || 0) * t}deg)`)
    brilhos.forEach((b, k) => place(b, (k ? W * 0.75 : W * 0.2) - 700 + 160 * Math.sin(t * 0.35 + k * 2), (k ? H * 0.8 : H * 0.25) - 700 + 120 * Math.cos(t * 0.3 + k)))

    // promessa: grande no quadro 0, sobe para o alto; some no fecho
    const pe = E.inOutCubic(P(t, 0.55, 1.15))
    const ps = lerp(promK0, pk, pe)
    place(prom.line, lerp(p0.x, p1.x, pe), lerp(p0.y, p1.y, pe))
    T(prom.line, `scale(${ps})`)
    O(prom.line, (1 - (LISO ? 0 : 0.35) * pe) * (1 - P(t, T_REV - 0.3, T_REV + 0.2)))   // liso: o sobretítulo fica na cor do texto, sem esmaecer

    // fragmentos
    let luzFeita = false
    frags.forEach((q, i) => {
      const u = t - q.t0, vis = u > -0.05 && u < FR + 0.05
      q.box.style.display = vis ? 'block' : 'none'
      if (q.nome) q.nome.g.style.display = vis ? 'block' : 'none'
      contornos[i].p.style.display = vis ? 'inline' : 'none'
      if (!vis) return
      const sweep = E.inOutCubic(P(u, 0.15, 0.8))
      const barX = lerp(q.visX0, q.visX1, sweep)
      q.box.style.clipPath = u < 0.8 ? `inset(-60px ${Math.max(0, q.x + q.w - barX)}px -60px -60px)` : 'none'
      const sai = P(u, FR - 0.4, FR)
      O(q.box, 1 - E.inCubic(sai))
      q.box.style.filter = sai > 0 ? `blur(${8 * sai}px)` : 'none'
      T(q.box, `scale(${(1 + 0.025 * P(u, 0.8, FR)) * (1 - 0.04 * sai)})`)
      contornos[i].d(E.outCubic(P(u, 0.15, 0.95)))
      contornos[i].p.style.opacity = (u < 0.95 ? 1 : 0.35 + 0.65 * Math.exp(-3 * (u - 0.95))) * (1 - sai)
      q.up(u)
      if (q.nome) { riseWords(q.nome.words, t, q.t0 + 0.45, 0.07); exitWords(q.nome.words, t, q.t0 + FR - 0.4, 0.02, 0.28) }
      // a luz: ponto → barra → varre → volta a ponto correndo na borda → vai ao próximo
      if (u >= 0 && u < FR) {
        luzFeita = true
        const hb = q.h + 80, [sx, sy] = inicioDe(q)
        if (u < 0.15) { const g = E.outCubic(P(u, 0, 0.15)); setLuz(sx, sy, lerp(16, 8, g), lerp(16, hb, g)) }
        else if (u < 0.8) setLuz(barX, q.y + q.h / 2, 8, hb)
        else if (u < 1.0) { const g = E.inOutCubic(P(u, 0.8, 1.0)), [bx, by] = naBorda(q, 0); setLuz(lerp(q.visX1, bx, g), lerp(q.y + q.h / 2, by, g), lerp(8, 16, g), lerp(hb, 16, g)) }
        else {
          const prog = 0.5 * P(u, 1.0, FR - 0.4)
          const [bx, by] = naBorda(q, prog)
          if (u < FR - 0.4) setLuz(bx, by, 16, 16)
          else {
            const g = E.inOutCubic(P(u, FR - 0.4, FR))
            const [nx, ny] = i + 1 < N ? inicioDe(frags[i + 1]) : [CEL.cx - celW / 2 + 4, CEL.cy]
            setLuz(lerp(bx, nx, g), lerp(by, ny, g), 16, 16)
          }
        }
      }
    })
    if (t < INTRO) { const g = E.outCubic(P(t, 0, INTRO)); const [nx, ny] = inicioDe(frags[0]); setLuz(lerp(CX, nx, g), lerp(H + 20, ny, g), 16, 16 + 120 * Math.sin(Math.PI * g), 0.4 + 0.6 * g); luzFeita = true }

    // revelação: a luz varre o celular, a tela aparece, a câmera recua
    const ur = t - T_REV, cv = t >= T_REV - 0.05
    cel.style.display = cv ? 'block' : 'none'
    contornos[N].p.style.display = cv ? 'inline' : 'none'
    if (cv) {
      const sw = E.inOutCubic(P(ur, 0.15, 1.0))
      const cx0 = CEL.cx - celW / 2, bx = lerp(cx0, cx0 + celW, sw)
      cel.style.clipPath = ur < 1.0 ? `inset(-80px ${Math.max(0, cx0 + celW - bx)}px -80px -80px)` : 'none'
      const z = lerp(1.18, 1, E.outCubic(P(ur, 0, 2.2)))
      let dy = 0, esc = 1, apaga = 0
      const gf = SO_LOGO ? 0 : E.inOutCubic(P(t, T_FECHO - 0.2, T_FECHO + 0.6)), dx = (CEL.fechoX - CEL.cx) * gf
      if (VERTICAL) { dy = (CEL.fechoY - CEL.cy) * gf; apaga = 0.55 * gf }
      else esc = 1 - 0.04 * gf
      T(cel, `translate(${dx}px, ${dy}px) scale(${z * esc})`)
      cel.style.filter = apaga > 0 ? `brightness(${1 - apaga})` : 'none'
      contornos[N].d(E.outCubic(P(ur, 0.15, 1.1)))
      contornos[N].p.style.opacity = (ur < 1.1 ? 1 : 0.3) * (1 - P(t, T_FECHO, T_FECHO + 0.5))
      contornos[N].p.style.transformOrigin = `${CEL.cx}px ${CEL.cy}px`
      contornos[N].p.style.transform = `translate(${dx}px, ${dy}px) scale(${z * esc})`
      rolar(t)
      if (t >= T_REV && t < T_FECHO + 1.2) {
        luzFeita = true
        if (ur < 0.15) setLuz(cx0 + 4, CEL.cy, 8, lerp(16, celH + 100, E.outCubic(P(ur, 0, 0.15))))
        else if (ur < 1.0) setLuz(bx, CEL.cy, 8, celH + 100)
        else if (ur < 1.4) { const g = E.inOutCubic(P(ur, 1.0, 1.4)); setLuz(cx0 + celW, lerp(CEL.cy, CEL.cy - celH / 2 + 40, g), lerp(8, 16, g), lerp(celH + 100, 16, g)) }
        else if (ABRE_CIRCULO) { // desce pela borda do celular, vai ao centro do quadro e abre o fecho em círculo
          const a = T_FECHO - 0.6, yPe = CEL.cy + celH / 2 - 40
          if (t < a) setLuz(cx0 + celW, lerp(CEL.cy - celH / 2 + 40, yPe, E.inOutCubic(P(t, T_REV + 1.4, a))), 16, 16)
          else if (t < T_FECHO) { const g = E.inOutCubic(P(t, a, T_FECHO)), d = lerp(16, 34, g); setLuz(lerp(cx0 + celW, CX, g), lerp(yPe, CY, g), d, d) }
          else { const d = lerp(34, 90, E.outCubic(P(t, T_FECHO, T_FECHO + 0.3))); setLuz(CX, CY, d, d, 1 - P(t, T_FECHO + 0.1, T_FECHO + 0.35)) }
        }
        else if (SO_LOGO) { // desce pela borda do celular, vai à borda direita do quadro, vira lâmina e varre até a esquerda
          const a = T_FECHO - 0.5, b = T_FECHO - 0.15, yPe = CEL.cy + celH / 2 - 40
          if (t < a) setLuz(cx0 + celW, lerp(CEL.cy - celH / 2 + 40, yPe, E.inOutCubic(P(t, T_REV + 1.4, a))), 16, 16)
          else if (t < b) { const g = E.inOutCubic(P(t, a, b)); setLuz(lerp(cx0 + celW, W - 6, g), lerp(yPe, CY, g), 16, 16) }
          else if (t < T_FECHO) { const g = E.outCubic(P(t, b, T_FECHO)); setLuz(W - 6, CY, lerp(16, 8, g), lerp(16, H + 120, g)) }
          else setLuz(lerp(W - 6, -10, E.inOutCubic(P(t, T_FECHO, T_FECHO + 0.7))), CY, 8, H + 120, 1 - P(t, T_FECHO + 0.7, T_FECHO + 0.9))
        }
        else if (t < T_FECHO + 0.3) setLuz(cx0 + celW + dx, lerp(CEL.cy - celH / 2 + 40, CEL.cy + celH / 2 - 40, E.inOutCubic(P(t, T_REV + 1.4, T_FECHO + 0.3))), 16, 16)
        else { // a luz vai até o lugar do botão e se estica nele
          const g = E.inOutCubic(P(t, T_FECHO + 0.3, T_FECHO + 0.75)), s = E.outExpo(P(t, T_FECHO + 0.75, T_FECHO + 1.2))
          const ax = cx0 + celW + (CEL.fechoX - CEL.cx), ay = CEL.cy + celH / 2 - 40 + (VERTICAL ? (CEL.fechoY - CEL.cy) : 0)
          const ex = btnX + btnW / 2, ey = btnY + btnH / 2
          setLuz(lerp(ax, ex, g), lerp(ay, ey, g), lerp(16, btnW, s), lerp(16, btnH, s), 1 - s)
        }
      }
    }
    // fecho
    const fv = t >= T_FECHO
    fecho.style.display = fv ? 'block' : 'none'
    btn.style.display = !SO_LOGO && t >= T_FECHO + 0.75 ? 'block' : 'none'
    if (SO_LOGO) {
      painel.style.display = fv ? 'block' : 'none'
      if (fv) {
        painel.style.clipPath = ABRE_CIRCULO ? `circle(${(raioCobre(CX, CY) * E.inOutCubic(P(t, T_FECHO, T_FECHO + 0.7))).toFixed(1)}px at ${CX}px ${CY}px)`
          : `inset(0 0 0 ${clamp(lerp(W - 6, -10, E.inOutCubic(P(t, T_FECHO, T_FECHO + 0.7))), 0, W)}px)`
        const e = E.outCubic(P(t, T_FECHO + 0.55, T_FECHO + 1.05))
        O(logoSo, e); T(logoSo, `translateY(${(1 - e) * 36}px)`)
      }
    } else if (fv) {
      O(logo, E.outCubic(P(t, T_FECHO + 0.1, T_FECHO + 0.6)))
      const ws = palavras(fr)
      riseWords(ws, t, T_FECHO + 0.25, 0.09)
      ws.forEach((w, k) => { const a = P(t, T_FECHO + 0.35 + k * 0.09, T_FECHO + 0.75 + k * 0.09); w.inner.style.opacity = 0.25 + 0.75 * a })
      riseWords(dataL.words, t, T_FECHO + 0.9, 0.05)
      const s = E.outExpo(P(t, T_FECHO + 0.75, T_FECHO + 1.2))
      place(btn, lerp(btnX + btnW / 2 - 8, btnX, s), lerp(btnY + btnH / 2 - 8, btnY, s), lerp(16, btnW, s), lerp(16, btnH, s))
      btn.style.borderRadius = px(lerp(8, btnH / 2, s))
      O(btnTxt, E.outCubic(P(t, T_FECHO + 1.1, T_FECHO + 1.5)))
      btn.style.boxShadow = `0 0 ${40 + 30 * Math.sin(t * 3)}px ${rgba(C.luz, 0.55)}`
    }
    if (!luzFeita) O(luz, 0)

    // legenda
    const fa = falas.find((f) => t >= f.em - 0.1 && t < f.ate + 0.15)
    if (fa) { if (legTxt.textContent !== fa.texto) legTxt.textContent = fa.texto; O(leg, E.outCubic(P(t, fa.em - 0.1, fa.em + 0.1)) * (1 - P(t, fa.ate, fa.ate + 0.15))) }
    else O(leg, 0)
  }
})
