// Molde before-after: a MESMA tela em dois estados, no mesmo enquadramento, cortada no clique.
// Tudo o que é marca, texto, tela e tempo vem de PARAM (video.js, gerado pelo render.mjs).
// Linha do tempo: promessa + "antes" no quadro 0 → gatilho e cursor → clique = corte seco para o "depois"
// → cortina (antes | depois lado a lado) → fecho com véu e desfoque, bordão, logo e endereço.
const M = PARAM.marca, C = M.cores, TX = PARAM.textos, TP = PARAM.tempos
const FT = M.fontes
const fTit = (s) => `${FT.tituloPeso || 700} ${s}px "${FT.titulo}"`
const fTxt = (s, w = 500) => `${w} ${s}px "${FT.texto}"`
const fMono = (s, w = 600) => `${w} ${s}px "${FT.mono || FT.texto}"`
const caixa = (s) => (FT.tituloCaixaAlta ? s.toUpperCase() : s)
const incl = FT.tituloInclinacao ? `skewX(${FT.tituloInclinacao}deg)` : ''
// Opcionais, desligados por padrão. marca.plano: cor chapada (sem brilho, sombra nem borda), etiquetas em caixa normal
// na fonte do texto, a ativa invertida (texto sobre superfície ↔ superfície sobre texto), cursor no acento, legenda da
// coluna numa caixa da superfície. fecho 'logo': o fecho é só o logo, centrado sobre cores.fechoFundo (ou o fundo),
// sem bordão, endereço, véu nem desfoque. respiro: na cortina a câmera segue empurrando devagar (o quadro não para).
const PLANO = !!M.plano, FECHO_LOGO = PARAM.fecho === 'logo', RESPIRO = !!PARAM.respiro
// textoFora (horizontais): texto nunca sobre a captura. Etiquetas na faixa acima da janela (como no 19:9), e na coluna,
// de cima para baixo: título, legenda, palavra da virada e o gatilho, com a base na base da janela. A janela é marcada
// como imagem para a checagem do motor (VIDEO.texto 'fora-da-imagem', ligado pelo render.mjs).
const TEXTO_FORA = !!PARAM.textoFora && HORIZONTAL
const sombra = (s) => (PLANO ? 'none' : s)
// Mais opcionais, desligados por padrão (TEMPLATE.md, "Opcionais"). lado 'direita' (horizontais): o 16:9 espelhado, coluna
// de texto à direita e janela à esquerda. transicao 'mascara' (o depois abre num círculo a partir de formato.origem, do
// gatilho.alvo ou do detalhe) ou 'lamina' (uma lâmina na cor de acento atravessa a janela e deixa o depois para trás); sem
// ela, o corte seco no clique. camera 'estatica': a tela não empurra nem recua. ritmo 'calmo': passagens mais lentas (os
// tempos mais folgados vêm do render.mjs). fundo { tipo 'formas' | 'simbolo' }: círculos chapados empilhados ou o
// símbolo da marca em PNG, gigante e girando devagar, atrás de tudo.
const LADO_DIR = PARAM.lado === 'direita' && HORIZONTAL
const TRANS = PARAM.transicao || 'corte', ESTATICA = PARAM.camera === 'estatica', CALMO = PARAM.ritmo === 'calmo'
const FUNDO = PARAM.fundo || null
const DUR_TR = { mascara: CALMO ? 0.9 : 0.6, lamina: CALMO ? 1.1 : 0.8 }[TRANS] || 0
const DUR_CORTINA = CALMO ? 1.6 : 1.1

// Onde as coisas moram em cada formato (recomposto, não recortado).
const LEIAUTES = {
  '16x9': { tx: 100, tTop: 150, tPx: 86, txW: 520, win: { x: 660, y: 90, w: 1180, h: 900 },
            leg: { modo: 'coluna', x: 100, y: 640, w: 500, px: 40 }, gat: 'canto' },
  '9x16': { tx: 70, tTop: 140, tPx: 108, txW: 940, win: { x: 60, y: 450, w: 960, h: 1180 },
            leg: { modo: 'centro', x: 60, y: 1670, w: 960, px: 54 }, gat: 'base' },
  '1x1':  { tx: 60, tTop: 54, tPx: 74, txW: 960, win: { x: 60, y: 250, w: 960, h: 770 },
            leg: { modo: 'sobre', x: 60, y: 940, w: 960, px: 36 }, gat: 'meio' },
}
// Todo horizontal é o 16:9 recomposto pela largura W: a coluna de texto fica na margem esquerda (5% + 4 px) com 27%
// da largura, e a janela da tela vai dela até a margem direita (5% − 16 px). Os corpos de letra dependem da altura e
// ficam os do 16:9. Com sobra de largura (19:9, 21:9) a janela cede 60 px de altura em cima e as etiquetas
// ANTES/DEPOIS saem de cima da captura para essa faixa. Com W = 1920 a conta devolve o 16:9 de sempre.
function leiauteHorizontal(W) {
  const b = LEIAUTES['16x9'], m = Math.round(W * 0.05), k = W / 1920
  const tx = m + 4, txW = Math.round(b.txW * k), x = tx + txW + 40
  const fora = W > 1920 || TEXTO_FORA, y = fora ? b.win.y + 60 : b.win.y
  const ly = { ...b, tx, txW, win: { x, y, w: W - (m - 16) - x, h: b.win.y + b.win.h - y },
    leg: { ...b.leg, x: tx, w: Math.round(b.leg.w * k) }, etq: fora ? 'fora' : 'dentro' }
  if (!LADO_DIR) return ly
  // lado 'direita': o mesmo leiaute espelhado (janela na margem esquerda, coluna na direita)
  const etx = W - tx - txW
  return { ...ly, tx: etx, win: { ...ly.win, x: W - ly.win.x - ly.win.w }, leg: { ...ly.leg, x: etx } }
}
// Foco herdado do 16:9 numa janela mais larga: alarga o foco até a proporção da janela (no máximo a captura
// inteira); se a captura ainda for estreita, vira uma faixa da altura certa, presa no topo do foco (cabeçalho da
// tela) e descendo só o que for preciso para o detalhe ficar até 3/4 da faixa.
function recomporFoco([x, y, w, h], det, cw, ww, wh) {
  const a = ww / wh
  if (w / h >= a) return [x, y, w, h]
  const nw = Math.min(cw, h * a), nx = clamp(x + w / 2 - nw / 2, 0, cw - nw)
  if (nw / h >= a) return [nx, y, nw, h]
  const nh = nw / a, dy = det ? det[1] : y + h / 2
  return [nx, clamp(dy - nh * 0.75, y, y + h - nh), nw, nh]
}
const LY = HORIZONTAL ? leiauteHorizontal(W) : L(LEIAUTES)
const WIN = LY.win
const CFG = PARAM.formato  // { antes, depois, w, h, foco:[x,y,w,h], detalhe:[x,y], zoomDetalhe, herdado? }
const FOCO = CFG.herdado ? recomporFoco(CFG.foco, CFG.detalhe, CFG.w, WIN.w, WIN.h) : CFG.foco

cena(0, VIDEO.duracao, (root) => {
  camada(root, C.fundo)
  const fundoBrilho = PLANO ? null : el('div', { cls: 'layer', style: { background: `radial-gradient(70% 60% at ${((WIN.x + WIN.w / 2) / W) * 100}% ${((WIN.y + WIN.h / 2) / H) * 100}%, ${rgba(C.acento, 0.12)}, transparent 70%)` } }, root)
  // fundo opcional, atrás de tudo. formas: círculos chapados empilhados (x, y em fração de W e H, r em fração de H, na
  // ordem de baixo para cima). simbolo: o PNG da marca inteiro, na cor dele (nunca recolorido nem transparente).
  const formas = FUNDO?.tipo === 'formas' ? (FUNDO.formas || []).map((f, i) => {
    const r = f.r * H
    return { e: el('div', { cls: 'abs', style: { left: px(f.x * W - r), top: px(f.y * H - r), width: px(2 * r), height: px(2 * r), borderRadius: '50%', background: f.cor } }, root), i }
  }) : []
  let simb = null
  if (FUNDO?.tipo === 'simbolo' && FUNDO.png) {
    const s = (FUNDO.tamanho || 0.9) * H
    simb = imagem(root, FUNDO.png, { left: px((FUNDO.x ?? 0.15) * W - s / 2), top: px((FUNDO.y ?? 0.9) * H - s / 2), width: px(s), height: px(s) })
  }

  // ── título-promessa: inteiro no quadro 0 ──
  // o corpo do título se ajusta à coluna; abaixo de 70% do previsto, o texto é que está comprido
  const monta = (tpx) => TX.promessa.map((parts, i) => {
    const l = textLine(root, parts.map((p) => ({ t: caixa(p.t), style: p.k ? { color: C.acento } : {} })), { font: fTit(tpx), color: C.texto, transform: incl })
    place(l.line, LY.tx, LY.tTop + i * tpx * 1.04)
    return l
  })
  let linhas = monta(LY.tPx)
  const largT = Math.max(...linhas.map((l) => rectOf(l.line).w))
  if (largT > LY.txW) {
    for (const l of linhas) l.line.remove()
    const k = LY.txW / largT
    if (k < 0.7) console.error(`PROMISE TOO WIDE in ${FMT}: shorten the text (it needed ${Math.round(k * 100)}% of the font size)`)
    linhas = monta(Math.floor(LY.tPx * k))
  }

  // ── janela da tela ──
  const win = el('div', { cls: 'abs', style: { left: px(WIN.x), top: px(WIN.y), width: px(WIN.w), height: px(WIN.h), overflow: 'hidden', borderRadius: '28px',
    background: C.superficie, boxShadow: sombra(`0 40px 120px rgba(0,0,0,.35), 0 0 0 2px ${C.linha}`) } }, root)
  const [fx, fy, fw, fh] = FOCO
  const s0 = Math.max(WIN.w / fw, WIN.h / fh)               // px do quadro por px CSS da captura
  const cam = el('div', { cls: 'abs', style: { width: px(CFG.w), height: px(CFG.h), transformOrigin: '0 0' } }, win)
  const imgA = imagem(cam, CFG.antes, { width: px(CFG.w), height: px(CFG.h) })
  const camD = el('div', { cls: 'abs', style: { width: px(CFG.w), height: px(CFG.h) } }, cam)
  const imgD = imagem(camD, CFG.depois, { width: px(CFG.w), height: px(CFG.h) })
  if (s0 < 1) console.error(`SCREEN SHRUNK in ${FMT}: focus ${fw}×${fh} in a ${WIN.w}×${WIN.h} window (scale ${s0.toFixed(2)}). Make the focus smaller.`)
  // posição base: centro do foco no centro da janela
  const ox = WIN.w / 2 - (fx + fw / 2) * s0, oy = WIN.h / 2 - (fy + fh / 2) * s0
  const det = CFG.detalhe || [fx + fw / 2, fy + fh / 2]
  const pDet = [ox + det[0] * s0, oy + det[1] * s0]          // detalhe em coordenadas da janela
  const zDet = CFG.zoomDetalhe || 2.2
  function enquadra(z, pz) {
    let l = pz[0] + (ox - pz[0]) * z, tp = pz[1] + (oy - pz[1]) * z
    const iw = CFG.w * s0 * z, ih = CFG.h * s0 * z
    if (iw >= WIN.w) l = clamp(l, WIN.w - iw, 0); if (ih >= WIN.h) tp = clamp(tp, WIN.h - ih, 0)
    T(cam, `translate(${l}px,${tp}px) scale(${s0 * z})`)
    return [l, s0 * z, tp]
  }

  // véu + desfoque do fecho
  const veu = el('div', { cls: 'layer', style: { width: px(WIN.w), height: px(WIN.h), background: C.fundo, opacity: 0 } }, win)

  // divisória da cortina
  const div = el('div', { cls: 'abs', style: { width: '6px', height: px(WIN.h), marginLeft: '-3px', background: C.acento, boxShadow: sombra(`0 0 30px ${rgba(C.acento, 0.6)}`) } }, win)
  const pega = el('div', { cls: 'abs', style: { width: '64px', height: '64px', marginLeft: '-32px', marginTop: '-32px', top: px(WIN.h / 2), borderRadius: '50%', background: C.acento,
    color: C.sobreAcento, font: fTxt(30, 700), display: 'flex', alignItems: 'center', justifyContent: 'center' }, text: PLANO ? '' : '‹ ›' }, win)
  // passagem do clique: o anel que segue a borda da máscara, ou a lâmina que atravessa a janela
  const anelMasc = TRANS === 'mascara' ? el('div', { cls: 'abs', style: { borderRadius: '50%', border: `6px solid ${C.acento}`, boxSizing: 'border-box', opacity: 0 } }, win) : null
  const LAM_W = WIN.w * 0.22
  const lamina = TRANS === 'lamina' ? el('div', { cls: 'abs', style: { width: px(LAM_W), height: px(WIN.h), background: C.acento, opacity: 0 } }, win) : null

  // etiquetas no canto fixo (o olho aprende onde ler); com LY.etq 'fora', na faixa logo acima da janela
  const fora = LY.etq === 'fora'
  const paiEtq = fora ? el('div', { cls: 'abs', style: { left: px(WIN.x), top: px(WIN.y), width: px(WIN.w), height: '0' } }, root) : win
  const etqPx = L({ '16x9': 34, '9x16': 46, '1x1': 34 })
  const etq = (texto, ativo) => el('div', { cls: 'abs', text: PLANO ? texto : texto.toUpperCase(), style: { font: PLANO ? fTxt(etqPx, 600) : fMono(etqPx), letterSpacing: PLANO ? '0' : '.2em', padding: '12px 20px', borderRadius: '999px',
    background: ativo ? (PLANO ? C.texto : C.acento) : C.superficie, color: ativo ? (PLANO ? C.superficie : C.sobreAcento) : C.texto,
    border: PLANO ? 'none' : `2px solid ${ativo ? C.acento : C.linha}`, whiteSpace: 'nowrap', boxShadow: sombra('0 10px 30px rgba(0,0,0,.25)') } }, paiEtq)
  const eA = etq(TX.antes, false), eD = etq(TX.depois, true), eA2 = etq(TX.antes, false)
  const eY = fora ? -(rectOf(eA).h + 16) : 28
  place(eA, 28, eY); place(eD, 28, eY)
  const wD = rectOf(eD).w
  place(eA2, 28, eY)
  if (LADO_DIR) place(eA2, WIN.w - 28 - rectOf(eA2).w, eY)   // espelhado: na cortina o antes fica à direita
  marcar(eA, 'texto'); marcar(eD, 'texto')
  if (TEXTO_FORA) { marcar(eA2, 'texto'); marcarImagem(win, 'the captured screen') }

  // palavra da virada, canto oposto
  const vir = el('div', { cls: 'abs', text: TX.virada, style: { font: fTit(L({ '16x9': 64, '9x16': 70, '1x1': 56 })), color: C.sobreAcento, background: C.acento, padding: '10px 26px 14px',
    borderRadius: '18px', whiteSpace: 'nowrap', transform: incl, transformOrigin: '100% 0' } }, win)
  const vw = rectOf(vir).w
  const virBox = el('div', { cls: 'abs', style: { left: px(WIN.w - vw - 28), top: '24px' } }, win); virBox.appendChild(vir); vir.style.position = 'relative'
  const baseTit = Math.max(...linhas.map((l) => { const r = rectOf(l.line); return r.y + r.h }))
  if (fora) {   // fora da captura: na coluna, abaixo do título
    root.appendChild(virBox); place(virBox, LY.tx, baseTit + 48); vir.style.transformOrigin = '0 0'
    marcar(vir, 'texto')
  }

  // ── gatilho: o controle que causa a mudança, com os rótulos exatos do produto ──
  // Opcionais: gatilho.alvo [x, y] = nada desenhado, o cursor clica na própria tela (px CSS da captura);
  // gatilho.campo + gatilho.termo = um campo de busca (o texto do campo vazio) onde o termo é digitado antes do corte.
  const G = PARAM.gatilho
  const ALVO = Array.isArray(G.alvo), CAMPO = !ALVO && typeof G.campo === 'string'
  const gk = L({ '16x9': 1.15, '9x16': 1.8, '1x1': 1.1 })
  const paiGat = ALVO ? win : TEXTO_FORA ? root : win   // textoFora: o gatilho vai para a coluna, com a base na base da janela
  let gat = null, ops = [], gy = 0, alvoXY = null, campoTxt = null, caret = null
  if (!ALVO) {
    gat = el('div', { cls: 'abs', style: { width: px(440 * gk), boxSizing: 'border-box', padding: px(24 * gk), borderRadius: px(24 * gk), background: C.superficie,
      border: PLANO ? 'none' : `2px solid ${C.linha}`, boxShadow: sombra('0 30px 80px rgba(0,0,0,.45)') } }, paiGat)
    if (CAMPO) {   // o campo invertido (texto ↔ superfície), como a etiqueta ativa: lupa + texto + cursor de texto
      Object.assign(gat.style, { background: C.texto, padding: `${px(20 * gk)} ${px(24 * gk)}`, borderRadius: '999px', display: 'flex', alignItems: 'center', gap: px(14 * gk) })
      el('div', { html: `<svg viewBox="0 0 24 24" width="${30 * gk}" height="${30 * gk}" fill="none" stroke="${C.superficie}" stroke-width="2.4" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>`,
        style: { display: 'flex', flex: 'none' } }, gat)
      campoTxt = el('div', { text: G.campo, style: { font: fTxt(30 * gk, 500), color: C.superficie, whiteSpace: 'nowrap' } }, gat)
      caret = el('div', { style: { width: '3px', height: px(34 * gk), background: C.superficie, flex: 'none', marginLeft: px(-10 * gk), opacity: 0 } }, gat)
    } else {
      el('div', { text: G.titulo, style: { font: fTxt(24 * gk, 700), color: C.apagado, marginBottom: px(14 * gk), letterSpacing: '.04em' } }, gat)
      ops = G.opcoes.map((o) => {
        const r = el('div', { style: { display: 'flex', alignItems: 'center', gap: px(14 * gk), padding: `${px(14 * gk)} ${px(16 * gk)}`, borderRadius: px(14 * gk), marginTop: px(8 * gk), border: `2px solid ${PLANO ? 'transparent' : C.linha}`, position: 'relative' } }, gat)
        const bol = el('div', { style: { width: px(28 * gk), height: px(28 * gk), borderRadius: '50%', border: `3px solid ${C.apagado}`, boxSizing: 'border-box', flex: 'none' } }, r)
        el('div', { text: o, style: { font: fTxt(30 * gk, 500), color: C.texto, whiteSpace: 'nowrap' } }, r)
        return { r, bol }
      })
    }
    const gw = 440 * gk, gh = rectOf(gat).h
    const gx = TEXTO_FORA ? LY.tx : LY.gat === 'base' ? (WIN.w - gw) / 2 : WIN.w - gw - 32
    gy = TEXTO_FORA ? WIN.y + WIN.h - gh : LY.gat === 'meio' ? (WIN.h - gh) / 2 : WIN.h - gh - 32
    place(gat, gx, gy)
    if (TEXTO_FORA) place(virBox, LY.tx, gy - 40 - rectOf(virBox).h)   // a virada logo acima do gatilho
    const alvo = CAMPO ? campoTxt : ops[G.escolha].r, ra = rectOf(alvo), rw = rectOf(paiGat)
    alvoXY = CAMPO ? [ra.x - rw.x + Math.min(ra.w, 160 * gk), ra.y - rw.y + ra.h / 2] : [ra.x - rw.x + 46 * gk, ra.y - rw.y + ra.h / 2]
  }
  const cursor = el('div', { cls: 'abs', style: { width: '44px', height: '44px', marginLeft: '-22px', marginTop: '-22px', borderRadius: '50%', background: PLANO ? C.acento : rgba('#FFFFFF', 0.85),
    border: `3px solid ${C.texto}`, boxShadow: sombra('0 6px 20px rgba(0,0,0,.35)'), opacity: 0 } }, paiGat)
  const anel = el('div', { cls: 'abs', style: { width: '90px', height: '90px', marginLeft: '-45px', marginTop: '-45px', borderRadius: '50%', border: `5px solid ${C.acento}`, opacity: 0 } }, paiGat)

  // ── legenda igual à fala ──
  const LG = LY.leg
  const legBox = el('div', { cls: 'abs', style: { left: px(LG.x), top: px(LG.y), width: px(LG.w), display: 'flex', justifyContent: LG.modo === 'coluna' ? 'flex-start' : 'center' } }, root)
  const col = LG.modo === 'coluna', caixaCol = col && PLANO   // no plano, a legenda da coluna ganha a caixa da superfície
  const blocos = PARAM.legendas.map((b) => {
    const e = el('div', { text: b.texto, style: { font: fTxt(LG.px, 600), color: C.texto, background: col && !caixaCol ? 'transparent' : C.superficie,
      padding: caixaCol ? '16px 24px 18px' : col ? '0' : '14px 26px', borderRadius: caixaCol ? '20px' : '16px', lineHeight: 1.25, maxWidth: px(LG.w), boxSizing: 'border-box', textAlign: col ? 'left' : 'center',
      position: 'absolute', opacity: 0, boxShadow: col ? 'none' : sombra('0 12px 40px rgba(0,0,0,.3)'), borderLeft: col && !caixaCol ? `6px solid ${C.acento}` : 'none', paddingLeft: caixaCol ? '24px' : col ? '22px' : '26px', ...(caixaCol ? { textWrap: 'balance' } : {}) } }, legBox)
    marcar(e, 'legenda')
    return { ...b, e }
  })
  if (LG.modo === 'sobre') legBox.style.top = px(WIN.y + WIN.h - 40 - 80)
  if (TEXTO_FORA) legBox.style.top = px(baseTit + 48)
  if (TEXTO_FORA && ALVO) {   // sem gatilho desenhado: a virada logo abaixo da legenda mais alta
    const hLeg = Math.max(0, ...blocos.map((b) => rectOf(b.e).h))
    place(virBox, LY.tx, baseTit + 48 + hLeg + 40)
  }

  // ── fecho: bordão + logo + endereço, sobre o véu; com fecho 'logo', só o logo sobre o quadro inteiro ──
  let fecho, logoFecho = null
  if (FECHO_LOGO) {
    fecho = el('div', { cls: 'layer', style: { background: C.fechoFundo || C.fundo, opacity: 0 } }, root)
    const lw = L({ '16x9': 640, '9x16': 640, '1x1': 560 })
    if (M.logo) logoFecho = imagem(fecho, M.logo, { left: '50%', top: '50%', width: px(lw), height: 'auto', marginLeft: px(-lw / 2), translate: '0 -50%' })
    else console.error('LOGO-ONLY CLOSING without marca.logo: add the logo PNG')
  } else {
  fecho = el('div', { cls: 'layer', style: { width: px(WIN.w), height: px(WIN.h), display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', opacity: 0 } }, win)
  const bPx = L({ '16x9': 104, '9x16': 112, '1x1': 84 })
  const bLs = TX.bordao.map((parts) => {
    const d = el('div', { style: { font: fTit(bPx), color: C.texto, transform: incl, whiteSpace: 'nowrap', lineHeight: 1.08, textAlign: 'center' } }, fecho)
    for (const p of parts) el('span', { text: caixa(p.t), style: p.k ? { color: C.acento } : {} }, d)
    return d
  })
  const assin = el('div', { style: { display: 'flex', alignItems: 'center', gap: '22px', marginTop: px(bPx * 0.55) } }, fecho)
  if (M.logo) imagem(assin, M.logo, { position: 'relative', height: px(L({ '16x9': 70, '9x16': 76, '1x1': 60 })), width: 'auto' })
  else el('div', { text: M.nome, style: { font: fTit(L({ '16x9': 64, '9x16': 70, '1x1': 56 })), color: C.texto } }, assin)
  el('div', { text: M.url, style: { font: fMono(L({ '16x9': 32, '9x16': 36, '1x1': 30 })), color: C.acento, letterSpacing: '.06em' } }, fecho).style.marginTop = '18px'
  const largB = Math.max(...bLs.map((d) => d.getBoundingClientRect().width))
  if (largB > WIN.w - 80) {
    const k = (WIN.w - 80) / largB
    if (k < 0.7) console.error(`TAGLINE TOO WIDE in ${FMT}: shorten the text (it needed ${Math.round(k * 100)}% of the font size)`)
    for (const d of bLs) d.style.font = fTit(Math.floor(bPx * k))
  }
  }

  const varZoomOut = PARAM.variacao === 'zoom-out'
  // a virada (etiqueta, palavra, opção marcada) acontece no clique; com a lâmina, quando ela passa do meio da janela
  const TV = TP.clique + (TRANS === 'lamina' ? DUR_TR / 2 : 0)
  // o toque do cursor: no clique; no campo de busca, antes, para dar tempo de digitar o termo
  const tToque = CAMPO ? TP.gatilho + 0.75 : TP.clique
  const ORIGEM = CFG.origem || (ALVO ? G.alvo : det)   // de onde a máscara abre (px CSS da captura)
  // janelas de passagem para a folha --auto e a checagem de colisão: a máscara/lâmina e o fecho que cobre o título
  if (DUR_TR) registrarTransicao(TRANS, TP.clique, DUR_TR)
  if (FECHO_LOGO) registrarTransicao('fecho', TP.fecho, 0.35)
  return (t) => {
    // câmera
    let z
    if (ESTATICA) z = 1
    else if (varZoomOut) z = Math.exp(Math.log(zDet) * (1 - E.inOutCubic(P(t, TP.clique + 0.6, TP.clique + 2.6))))
    else z = 1 + 0.06 * E.inOutCubic(P(t, 0, TP.clique)) + 0.04 * E.inOutCubic(P(t, TP.clique, TP.cortina)) - 0.1 * E.inOutCubic(P(t, TP.cortina - 0.2, TP.cortina + 0.5))
      + (RESPIRO ? 0.04 * P(t, TP.cortina + 0.5, TP.fecho + 0.3) : 0)
    const [camL, camK, camT] = enquadra(Math.max(1, z), pDet)

    // corte seco no clique (ou máscara, ou lâmina); cortina depois
    // espelhado (lado 'direita'): a divisória entra pela direita e o depois fica à esquerda, perto da coluna
    const pc = E.inOutCubic(P(t, TP.cortina, TP.cortina + DUR_CORTINA))
    const cx = LADO_DIR ? WIN.w - WIN.w * 0.5 * pc : WIN.w * 0.5 * pc
    const naCortina = t >= TP.cortina
    camD.style.display = t >= TP.clique ? 'block' : 'none'
    let clip = !naCortina ? 'none' : LADO_DIR ? `inset(0 ${CFG.w - (cx - camL) / camK}px 0 0)` : `inset(0 0 0 ${(cx - camL) / camK}px)`
    const ptr = DUR_TR ? P(t, TP.clique, TP.clique + DUR_TR) : 1
    if (anelMasc) {   // círculo que abre do ponto de origem até cobrir a janela
      const ox0 = camL + ORIGEM[0] * camK, oy0 = camT + ORIGEM[1] * camK
      const rMax = Math.max(...[[0, 0], [WIN.w, 0], [0, WIN.h], [WIN.w, WIN.h]].map(([qx, qy]) => Math.hypot(qx - ox0, qy - oy0)))
      const r = rMax * E.inOutCubic(ptr)
      if (!naCortina && ptr < 1) clip = `circle(${r / camK}px at ${ORIGEM[0]}px ${ORIGEM[1]}px)`
      O(anelMasc, t >= TP.clique && ptr < 1 ? 1 - E.inCubic(ptr) : 0)
      place(anelMasc, ox0 - r, oy0 - r, 2 * r, 2 * r)
    }
    if (lamina) {     // a lâmina atravessa da esquerda para a direita; o depois fica para trás dela
      const lx = lerp(-LAM_W, WIN.w, E.inOutCubic(ptr)), xc = lx + LAM_W / 2
      if (!naCortina && ptr < 1) clip = `inset(0 ${Math.max(0, CFG.w - (xc - camL) / camK)}px 0 0)`
      O(lamina, t >= TP.clique && ptr < 1 ? 1 : 0); T(lamina, `translateX(${lx}px)`)
    }
    camD.style.clipPath = clip
    O(div, naCortina ? 1 - P(t, TP.fecho, TP.fecho + 0.3) : 0); T(div, `translateX(${cx}px)`)
    O(pega, naCortina ? (1 - P(t, TP.fecho, TP.fecho + 0.3)) * P(t, TP.cortina, TP.cortina + 0.2) : 0); T(pega, `translateX(${cx}px)`)

    // etiquetas
    const fe = 1 - P(t, TP.fecho, TP.fecho + 0.3)
    O(eA, t < TV ? fe : 0)
    O(eD, t >= TV ? fe : 0)
    O(eA2, naCortina ? fe * P(t, TP.cortina + 0.6, TP.cortina + 1.0) : 0)
    const dxD = LADO_DIR ? 0 : (WIN.w - 28 - wD - 28) * E.inOutCubic(P(t, TP.cortina, TP.cortina + DUR_CORTINA))
    T(eD, `translateX(${dxD}px)`)

    // virada: estampa no clique, some antes da cortina
    const pv = P(t, TV, TV + 0.35)
    O(vir, t >= TV ? 1 - P(t, TP.cortina - 0.4, TP.cortina) : 0)
    T(vir, `${incl} scale(${t >= TV ? 1 + 0.25 * (1 - E.outBack(pv, 2.2)) : 1})`)
    O(virBox, naCortina ? 0 : 1)

    // gatilho + cursor + toque
    const gIn = E.outExpo(P(t, TP.gatilho, TP.gatilho + 0.5)), gOut = E.inCubic(P(t, TP.clique + 0.7, TP.clique + 1.1))
    if (gat) { O(gat, gIn * (1 - gOut)); T(gat, `translateY(${(1 - gIn) * 40 + gOut * 30}px)`) }
    const sel = t >= TV ? G.escolha : 0
    ops.forEach((o, i) => {
      const on = i === sel
      o.r.style.background = on && !PLANO ? rgba(C.acento, 0.14) : 'transparent'; o.r.style.borderColor = PLANO ? 'transparent' : on ? C.acento : C.linha
      o.bol.style.borderColor = on ? C.acento : C.apagado; o.bol.style.boxShadow = on ? `inset 0 0 0 ${7 * gk}px ${C.acento}` : 'none'
    })
    if (CAMPO) {   // o termo é digitado letra a letra entre o toque no campo e o corte
      const letras = Array.from(G.termo || ''), n = Math.round(letras.length * P(t, tToque + 0.15, Math.max(tToque + 0.3, TP.clique - 0.2)))
      campoTxt.textContent = t >= tToque ? letras.slice(0, n).join('') : G.campo
      caret.style.opacity = t >= tToque && (n < letras.length || Math.floor((t - tToque) / 0.5) % 2 === 0) ? 1 : 0
    }
    const alvoT = ALVO ? [camL + G.alvo[0] * camK, camT + G.alvo[1] * camK] : alvoXY   // na tela, o alvo anda com a câmera
    const lado = LADO_DIR ? -1 : 1
    const cIn = E.inOutCubic(P(t, TP.gatilho + 0.3, tToque - 0.12))
    const c0 = ALVO ? [Math.min(alvoT[0] + 300, WIN.w - 40), Math.min(alvoT[1] + 220, WIN.h - 40)]
      : TEXTO_FORA ? [alvoT[0] + 240 * lado, alvoT[1] - 200] : [alvoT[0] - L({ '16x9': 260, '9x16': 200, '1x1': 220 }), alvoT[1] + 180 + gy * 0]
    const cxp = lerp(c0[0], alvoT[0], cIn), cyp = lerp(Math.min(c0[1], (TEXTO_FORA && !ALVO ? H : WIN.h) - 30), alvoT[1], cIn) - 60 * Math.sin(Math.PI * cIn)
    const aperta = 1 - 0.18 * Math.sin(Math.PI * P(t, tToque - 0.12, tToque + 0.12))
    O(cursor, P(t, TP.gatilho + 0.3, TP.gatilho + 0.5) * (1 - gOut)); T(cursor, `translate(${cxp}px,${cyp}px) scale(${aperta})`)
    const pa = P(t, tToque, tToque + 0.55)
    O(anel, pa > 0 && pa < 1 ? 1 - pa : 0); T(anel, `translate(${alvoT[0]}px,${alvoT[1]}px) scale(${0.3 + 1.2 * E.outCubic(pa)})`)

    // fundo opcional: as formas entram e flutuam; o símbolo gira devagar (entra com meia volta a mais)
    for (const f of formas) {
      const pe = E.outBack(P(t, 0.1 * f.i, 0.1 * f.i + 0.9), 1.4)
      T(f.e, `translate(${10 * Math.sin(0.55 * t + 1.7 * f.i)}px,${8 * Math.cos(0.45 * t + 1.1 * f.i)}px) scale(${pe})`)
    }
    if (simb) T(simb, `rotate(${(FUNDO.giro ?? 6) * t + 90 * (1 - E.outCubic(P(t, 0, 1.6)))}deg)`)

    // legendas
    for (const b of blocos) {
      const on = P(t, b.de, b.de + 0.18) * (1 - P(t, b.ate - 0.12, b.ate))
      O(b.e, on); T(b.e, `translateY(${(1 - E.outCubic(P(t, b.de, b.de + 0.3))) * 14}px)`)
    }

    if (FECHO_LOGO) {   // o quadro vira o fundo do fecho e o logo sobe e para
      const fo = E.inOutCubic(P(t, TP.fecho, TP.fecho + 0.35))
      O(fecho, fo); for (const l of linhas) O(l.line, 1 - fo)   // o título sai junto: nada fica coberto pelo fecho
      const pl = E.outCubic(P(t, TP.fecho + 0.3, TP.fecho + 1.2))
      if (logoFecho) { O(logoFecho, pl); T(logoFecho, `translateY(${(1 - pl) * 40}px)`) }
    } else {
    // fecho: véu + desfoque, bordão, assinatura
    const pf = E.inOutCubic(P(t, TP.fecho, TP.fecho + 0.5))
    O(veu, 0.84 * pf); cam.style.filter = pf > 0 ? `blur(${14 * pf}px)` : 'none'
    O(fecho, P(t, TP.fecho + 0.2, TP.fecho + 0.6)); T(fecho, `translateY(${(1 - E.outExpo(P(t, TP.fecho + 0.2, TP.fecho + 0.9))) * 40}px)`)
    }
    if (fundoBrilho) O(fundoBrilho, 1)
  }
})
