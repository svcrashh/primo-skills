// Molde real-screen-camera: tutorial com a tela real gravada, câmera que vai até o campo da vez,
// véu + desfoque no resto, cartão de passo, intertítulo entre etapas, legenda karaokê da voz e "Done!".
// Tudo o que é da marca e do vídeo vem de DADOS (montado pelo assemble.mjs a partir do JSON de parâmetros).
const D = DADOS, C = D.marca.cores, FT = D.marca.fontes, X = D.linha
const TW = D.tela.w, TH = D.tela.h
const fTitulo = (px) => `${FT.titulo.peso || 700} ${px}px "${FT.titulo.familia}"`
const fTexto = (px, peso) => `${peso || FT.texto.peso || 500} ${px}px "${FT.texto.familia}"`
const fMono = (px) => `${FT.mono ? FT.mono.peso || 600 : 600} ${px}px "${FT.mono ? FT.mono.familia : FT.texto.familia}"`
const caixa = (s) => (FT.titulo.caixa === 'alta' ? s.toUpperCase() : s)
// Opcionais, desligados por padrão. marca.plano: cor chapada (sem sombra), rótulos em caixa normal na fonte do texto e
// um pouco maiores, contorno do cursor numa cor da marca. cores.rotulo: a cor dos rótulos (padrão: destaque).
// fim.soLogo: o fim é só o logo, centrado, sem "Done!" nem apoio.
const PLANO = !!D.marca.plano, SO_LOGO = !!D.textos.fimSoLogo
// textoFora (opcional, desligado por padrão): texto nunca sobre a tela gravada. A tela (as duas cópias e o contorno) é
// recortada a `folga` px do cartão em todo quadro, inclusive no zoom e na entrada do cartão; some atrás do intertítulo
// (e da abertura chapada do plano); a tela é marcada como imagem para a checagem do motor (VIDEO.texto 'fora-da-imagem').
const FORA = !!D.textoFora, FOLGA = D.folga ?? 24
const sombra = (s) => (PLANO ? 'none' : s)
const corRotulo = C.rotulo || C.destaque
const rotulo = (s) => (PLANO ? s : s.toUpperCase())
const fRotulo = (px) => (PLANO ? fTexto(Math.round(px * 1.3), 600) : fMono(px))
// Mais opcionais, desligados por padrão (TEMPLATE.md, tabela de parâmetros). cartao: 'direita' (coluna da direita) ou
// 'embaixo' (faixa larga apoiada embaixo), só nos formatos horizontais. transicao: 'push' (o intertítulo entra empurrando
// tela e cartão) ou 'mascara' (o intertítulo abre num círculo a partir do campo e fecha no próximo). camera: 'travelling'
// (o mesmo zoom em todos os campos: a câmera anda de lado entre eles e segue deslizando devagar). fundo: formas
// empilhadas ou o símbolo gigante atrás de tudo, e o véu fica só sobre a tela. cores.traco: o fio do intertítulo e a
// barra de progresso (padrão: destaque), para quando o destaque some sobre o fundo.
const LADO = VERTICAL ? 'topo' : HORIZONTAL && (D.cartao === 'direita' || D.cartao === 'embaixo') ? D.cartao : 'esquerda'
const TRANS = D.transicao === 'push' || D.transicao === 'mascara' ? D.transicao : 'corte'
const TRAV = D.camera === 'travelling'
const FU = D.fundo && (D.fundo.tipo === 'formas' || D.fundo.tipo === 'simbolo') ? D.fundo : null
const corTraco = C.traco || C.destaque
const TD = 0.35   // push e mascara: a duração de cada lado da transição do intertítulo
const FAIXA_ALT = 176   // cartao 'embaixo': a altura prevista da faixa (rótulo + uma linha de frase)

// Layout por formato: onde o cartão fica, a área livre onde a câmera centra o campo, e o plano geral.
const LEIAUTES = {
  '16x9': { card: { x: 72, y: 540, w: 560, ancora: 'meio' }, livre: { x: 680, y: 70, w: 1180, h: 800 }, cobre: { x: 660, y: 0, w: 1260, h: 1080 },
    geral: { cx: 960, cy: 572, w: 1440 }, leg: { y: 1080 - 64, w: 1500, px: 44 }, sMin: 1.9, frase: 46, rot: 22, titulo: 104, inter: 120 },
  '9x16': { card: { x: 70, y: 262, w: 860, ancora: 'topo' }, livre: { x: 40, y: 560, w: 1000, h: 700 }, cobre: { x: 0, y: 520, w: 1080, h: 800 },
    geral: { cx: 540, cy: 900, w: 1000 }, leg: { y: 1440, w: 800, px: 48 }, sMin: 3.0, frase: 50, rot: 24, titulo: 112, inter: 128 },
}
// Todo horizontal é o 16:9 recomposto pela largura W: o cartão fica na margem esquerda (o texto dele a 5% + 16 px), a
// área livre e a faixa que a tela ampliada cobre vão do cartão até a direita, e o plano geral centra. Corpos de letra
// e alturas dependem de H e ficam os do 16:9. Com W = 1920 a conta devolve o 16:9 de sempre.
function leiauteHorizontal(W) {
  const b = LEIAUTES['16x9'], x = Math.round(W * 0.05) - 24, lx = x + b.card.w + 48
  return { ...b, card: { ...b.card, x }, livre: { ...b.livre, x: lx, w: W - 60 - lx }, cobre: { ...b.cobre, x: lx - 20, w: W - lx + 20 }, geral: { ...b.geral, cx: W / 2 } }
}
// cartao 'direita': o espelho do horizontal (cartão na margem direita, área livre e faixa coberta à esquerda)
function leiauteDireita(W) {
  const b = leiauteHorizontal(W), x = W - b.card.x - b.card.w, lx = 60
  return { ...b, card: { ...b.card, x }, livre: { ...b.livre, x: lx, w: x - 48 - lx }, cobre: { ...b.cobre, x: 0, w: x - 28 } }
}
// cartao 'embaixo': uma faixa de 60% da largura apoiada na margem de baixo (5%); a câmera centra o campo na parte de
// cima, que a tela ampliada cobre de ponta a ponta na largura. Em cima, a tela pode descer até a margem segura (5%): um
// campo colado no topo do app (a busca) não fica parado fora da área segura
function leiauteEmbaixo(W) {
  const b = leiauteHorizontal(W), base = Math.round(H * 0.95), topo = base - FAIXA_ALT, m = Math.round(H * 0.05)
  return { ...b, card: { x: b.card.x, y: base, w: Math.round(W * 0.6), ancora: 'base' }, livre: { x: 60, y: m + 10, w: W - 120, h: topo - 48 - m - 10 },
    cobre: { x: 0, y: m, w: W, h: topo - 28 - m } }
}
const LAY = HORIZONTAL ? (LADO === 'direita' ? leiauteDireita(W) : LADO === 'embaixo' ? leiauteEmbaixo(W) : leiauteHorizontal(W)) : L(LEIAUTES)
const S_MAX = D.tela.dsf * 1.1

const sGeral = LAY.geral.w / TW
const GERAL = { cx: TW / 2, cy: TH / 2, s: sGeral, fx: LAY.geral.cx, fy: LAY.geral.cy }
const centroLivre = { x: LAY.livre.x + LAY.livre.w / 2, y: LAY.livre.y + LAY.livre.h / 2 }
function enquadra(r) {
  const s = clamp(Math.min((LAY.livre.w * 0.86) / r.w, (LAY.livre.h * 0.86) / r.h), LAY.sMin, S_MAX)
  return { cx: r.x + r.w / 2, cy: r.y + r.h / 2, s, fx: centroLivre.x, fy: centroLivre.y }
}
// Chaves da câmera: plano geral → o campo de cada ação (chega um pouco antes do toque) → o resultado.
const CH = [{ v: 0, ...GERAL, reg: { x: 0, y: 0, w: TW, h: TH } }, { v: X.geral1, ...GERAL, reg: { x: 0, y: 0, w: TW, h: TH } }]
// no plano, o plano geral não fica parado: a câmera empurra devagar desde o quadro 0 até a ida para o primeiro campo
if (PLANO) Object.assign(CH[1], { dur: X.geral1, s: GERAL.s * 1.06 })
for (const fc of X.focos) CH.push({ v: fc.v, dur: fc.dur, ...enquadra(fc.reg), reg: fc.reg })
// push e mascara: o primeiro campo depois de cada intertítulo é enquadrado enquanto o intertítulo cobre o quadro, e a
// tela volta já nele
if (TRANS !== 'corte') for (const it of X.inters) {
  const k = CH.slice(2).find((c) => c.v >= it.v1 - 0.001)
  if (k) Object.assign(k, { v: it.v0 + TD + 0.01, dur: 0.001 })
}
// travelling: um zoom só (o menor dos campos, para todos caberem) e, parada em cada campo, a câmera segue andando
// devagar (TRAV_VEL px por segundo no quadro) na direção do meio da tela gravada
const TRAV_VEL = 18
if (TRAV && CH.length > 2) {
  const s = Math.min(...CH.slice(2).map((c) => c.s))
  for (const c of CH.slice(2)) {
    const dx = TW / 2 - c.cx, dy = TH / 2 - c.cy, n = Math.hypot(dx, dy) || 1
    Object.assign(c, { s, deriva: { x: ((dx / n) * TRAV_VEL) / s, y: ((dy / n) * TRAV_VEL) / s } })
  }
}
function cam(v) {
  let cur = CH[0]
  for (let i = 1; i < CH.length; i++) {
    let k = CH[i]
    const d = k.dur || 0.85
    if (v < k.v - d) break
    const e = E.inOutCubic(P(v, k.v - d, k.v))
    if (k.deriva) k = { ...k, cx: k.cx + k.deriva.x * (v - k.v), cy: k.cy + k.deriva.y * (v - k.v) }
    cur = { cx: lerp(cur.cx, k.cx, e), cy: lerp(cur.cy, k.cy, e), s: Math.exp(lerp(Math.log(cur.s), Math.log(k.s), e)),
      fx: lerp(cur.fx, k.fx, e), fy: lerp(cur.fy, k.fy, e),
      reg: { x: lerp(cur.reg.x, k.reg.x, e), y: lerp(cur.reg.y, k.reg.y, e), w: lerp(cur.reg.w, k.reg.w, e), h: lerp(cur.reg.h, k.reg.h, e) } }
  }
  let tx = cur.fx - cur.cx * cur.s, ty = cur.fy - cur.cy * cur.s
  // com zoom, a tela cobre a área livre inteira (nada de borda vazia atrás do campo)
  const cb = LAY.cobre, sw = TW * cur.s, sh = TH * cur.s
  if (sw >= cb.w) tx = clamp(tx, cb.x + cb.w - sw, cb.x)
  if (sh >= cb.h) ty = clamp(ty, cb.y + cb.h - sh, cb.y)
  return { s: cur.s, tx, ty, reg: cur.reg }
}
// tempo da gravação para cada instante do vídeo (congela entre trechos)
function tGrav(v) {
  const sg = X.trechos
  if (v <= sg[0].v0) return sg[0].r0
  for (const s of sg) if (v < s.v1) return v < s.v0 ? s.r0 : s.r0 + (v - s.v0) * s.vel
  return sg[sg.length - 1].r1
}
function interpKeys(ks, v) {
  if (!ks.length) return null
  if (v <= ks[0].v) return ks[0]
  for (let i = 1; i < ks.length; i++) if (v < ks[i].v) { const a = ks[i - 1], b = ks[i], e = E.inOutCubic(P(v, a.v, b.v)); return { x: lerp(a.x, b.x, e), y: lerp(a.y, b.y, e) } }
  return ks[ks.length - 1]
}
// foco (véu + desfoque) liga quando a câmera chega no primeiro passo
const foco = (v) => (X.passos.length ? E.inOutCubic(P(v, X.passos[0].v0 + 0.15, X.passos[0].v0 + 0.75)) : 0)

// fundo (opcional): o desenho atrás de tudo, numa camada; devolve a atualização do tempo. Desenhado no fundo, em cada
// intertítulo e na abertura pela mesma função do tempo, então a troca entre eles não aparece.
function desenharFundo(camadaFundo) {
  if (FU.tipo === 'simbolo') {
    // o símbolo da marca em PNG, inteiro e na cor do arquivo (nada de recolorir nem transparência), gigante, recortado
    // pela borda e girando devagar; x e y (frações do quadro) e tamanho (fração da altura) mudam o lugar
    const lugar = LADO === 'embaixo' ? [0.9, 0.92] : LADO === 'direita' ? [0.1, 0.86] : [0.9, 0.86]
    const tam = H * (FU.tamanho || 1), alt = (tam * FU.h) / FU.w, cx = W * (FU.x ?? lugar[0]), cy = H * (FU.y ?? lugar[1])
    const im = imagem(camadaFundo, FU.arquivo, { left: px(cx - tam / 2), top: px(cy - alt / 2), width: px(tam), height: px(alt), transformOrigin: '50% 50%' })
    return (t) => T(im, `rotate(${(8 + t * 2.4).toFixed(3)}deg)`)
  }
  // formas: losangos de canto bem arredondado, empilhados: um por cor de `cores`, a primeira na
  // frente e as outras descendo atrás dela até sair do quadro; ficam no lado do cartão, abaixo dele (embaixo: no canto da
  // faixa), longe de todo texto, e sobem devagar. x e y (frações do quadro) mudam o lugar do da frente.
  const cores = FU.cores && FU.cores.length ? FU.cores : [C.superficie]
  const lado = Math.round(H * 0.26), diag = lado * Math.SQRT2, passo = diag * 0.42
  const x0 = W * (FU.x ?? (LADO === 'embaixo' ? 0.87 : (LAY.card.x + LAY.card.w * (LADO === 'direita' ? 0.72 : 0.28)) / W))
  const y0 = H * (FU.y ?? (LADO === 'embaixo' ? 0.8 : (LAY.card.y + 150 + diag / 2) / H))
  const ls = cores.map((cor, i) => ({ cor, i })).reverse().map(({ cor, i }) =>
    el('div', { cls: 'abs', style: { left: px(x0 - lado / 2), top: px(y0 + i * passo - lado / 2), width: px(lado), height: px(lado), borderRadius: px(Math.round(lado * 0.2)), background: cor, transform: 'rotate(45deg)' } }, camadaFundo))
  // simbolo (opcional): o PNG do símbolo, de pé, no losango da frente
  const sb = FU.simbolo, ts = lado * 0.62
  const im = sb ? imagem(camadaFundo, sb.arquivo, { left: px(x0 - ts / 2), top: px(y0 - (ts * sb.h) / sb.w / 2), width: px(ts), height: px((ts * sb.h) / sb.w) }) : null
  return (t) => {
    const dy = (-t * 4).toFixed(2)
    for (const e of ls) T(e, `translateY(${dy}px) rotate(45deg)`)
    if (im) T(im, `translateY(${dy}px)`)
  }
}

cena(0, X.dur, (root) => {
  // push: tela, cartão e fundo andam juntos num palco que o intertítulo empurra
  const palco = TRANS === 'push' ? el('div', { cls: 'layer' }, root) : root
  const fundo = camada(palco, C.fundo)
  const desenhos = FU ? [desenharFundo(fundo)] : []
  if (D.marca.textura !== 'liso') {
    const g = el('div', { cls: 'layer', style: { backgroundImage: `radial-gradient(${rgba(C.texto, 0.09)} 1.6px, transparent 1.8px)`, backgroundSize: '34px 34px' } }, fundo)
    g.style.opacity = 0.9
  }
  // mundo = moldura de navegador + tela gravada. Duas cópias: a de baixo desfocada, a de cima nítida e recortada no campo.
  // moldura 'nenhuma': a gravação já traz a própria barra (janela de programa); só entra a sombra e o canto arredondado
  const barra = D.moldura === 'nenhuma' ? 0 : 46
  function mundo(parent) {
    const m = el('div', { cls: 'abs', style: { width: px(TW), height: px(TH), transformOrigin: '0 0' } }, parent)
    const moldura = el('div', { cls: 'abs', style: { left: px(-10), top: px(-barra - 10), width: px(TW + 20), height: px(TH + barra + 20), borderRadius: '18px', background: C.superficie, boxShadow: sombra(`0 40px 90px ${rgba('#000000', 0.35)}`) } }, m)
    if (barra) for (let i = 0; i < 3; i++) el('div', { cls: 'abs', style: { left: px(26 + i * 22), top: px(barra / 2 + 2), width: '12px', height: '12px', borderRadius: '50%', background: rgba(C.texto, 0.28) } }, moldura)
    if (barra && D.endereco) el('div', { cls: 'abs', text: D.endereco, style: { left: px(TW / 2 - 200), top: px(13), width: '400px', height: px(barra - 16), lineHeight: px(barra - 16), borderRadius: '10px', textAlign: 'center', background: rgba(C.texto, 0.08), color: rgba(C.texto, 0.7), font: fTexto(15, 500) } }, moldura)
    const seq = sequencia(m, D.quadros, { width: px(TW), height: px(TH), borderRadius: '4px' })
    return { m, seq }
  }
  const telaA = FORA ? el('div', { cls: 'layer' }, palco) : palco
  const A = mundo(telaA)
  const veu = el('div', { cls: 'layer', style: { background: C.veu } }, palco)
  const janela = el('div', { cls: 'layer' }, palco)
  const B = mundo(janela)
  if (FORA) { marcarImagem(A.m, 'the recorded screen'); marcarImagem(B.m, 'the recorded screen (focus)') }
  const borda = el('div', { cls: 'abs', style: { border: `3px solid ${rgba(C.destaque, 0.9)}`, borderRadius: '16px', boxShadow: sombra(`0 0 0 9999px transparent, 0 18px 50px ${rgba('#000000', 0.35)}`) } }, palco)
  // cursor (seta) e anel de toque
  const cur = sv('svg', { width: 40, height: 48, viewBox: '0 0 20 24' }, palco)
  Object.assign(cur.style, { position: 'absolute', left: '0', top: '0', overflow: 'visible' })
  sv('path', { d: 'M1 1 L1 19 L5.6 14.8 L8.6 22 L11.6 20.7 L8.7 13.6 L15 13.6 Z', fill: C.destaque, stroke: PLANO ? C.fundo : '#FFFFFF', 'stroke-width': 1.6, 'stroke-linejoin': 'round' }, cur)
  const aneis = X.toques.map(() => el('div', { cls: 'abs', style: { width: '0', height: '0', borderRadius: '50%', border: `4px solid ${C.destaque}` } }, palco))

  // cartão de passo: rótulo + frase de cada passo, trocando por "subir"
  const card = el('div', { cls: 'abs', style: { left: px(LAY.card.x), width: px(LAY.card.w), background: C.superficie, borderRadius: '26px', boxShadow: sombra(`0 24px 60px ${rgba('#000000', 0.28)}`), overflow: 'hidden' } }, palco)
  const barraProg = el('div', { cls: 'abs', style: { left: '0', bottom: '0', height: '6px', width: '0', background: corTraco } }, card)
  const conteudos = X.passos.map((p) => {
    const c = el('div', { style: { position: 'absolute', left: '40px', top: '34px', width: px(LAY.card.w - 80) } }, card)
    el('div', { text: rotulo(D.textos.passo.replace('{n}', p.n).replace('{N}', X.passos.length)), style: { font: fRotulo(LAY.rot), letterSpacing: PLANO ? '0' : '0.12em', color: corRotulo, marginBottom: '14px' } }, c)
    el('div', { text: p.frase, style: { font: fTexto(LAY.frase, FT.texto.pesoForte || 700), lineHeight: '1.18', color: C.texto } }, c)
    marcar(c, 'texto', p.frase)
    return c
  })
  const altCard = Math.max(...conteudos.map((c) => c.getBoundingClientRect().height)) + 34 + 40
  card.style.height = px(altCard)
  card.style.top = px(LAY.card.ancora === 'meio' ? LAY.card.y - altCard / 2 : LAY.card.ancora === 'base' ? LAY.card.y - altCard : LAY.card.y)

  // legenda karaokê das falas (a palavra dita fica numa caixa da cor de destaque)
  const legendas = X.falas.map((f) => {
    const box = el('div', { cls: 'abs', style: { left: px(CX - LAY.leg.w / 2), width: px(LAY.leg.w), display: 'flex', justifyContent: 'center' } }, root)
    const pil = el('div', { style: { display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: `0 ${Math.round(LAY.leg.px * 0.26)}px`, padding: '14px 26px', borderRadius: '20px', background: rgba(C.superficie, 0.92), maxWidth: px(LAY.leg.w) } }, box)
    const ws = f.palavras.map((w) => el('span', { text: w.texto, style: { font: fTexto(LAY.leg.px, 700), color: C.texto, padding: '2px 8px', borderRadius: '10px', lineHeight: '1.3' } }, pil))
    const h = box.getBoundingClientRect().height
    box.style.top = px(LAY.leg.y - h)
    marcar(pil, 'legenda', f.texto)
    return { box, ws, f }
  })

  // intertítulos: o fundo da marca e 2–3 palavras grandes
  const inters = X.inters.map((it) => {
    const lay = camada(root, C.fundo)
    if (FU) desenhos.push(desenharFundo(lay))
    const ls = bloco(lay, [[{ t: caixa(it.texto) }]], { top: CY - LAY.inter * 0.55, entrelinha: LAY.inter, style: { font: fTitulo(LAY.inter), color: C.texto, letterSpacing: '-0.01em' } })
    const fio = el('div', { cls: 'abs', style: { left: px(CX - 50), top: px(CY - LAY.inter * 0.55 - 46), width: '100px', height: '8px', borderRadius: '4px', background: corTraco, transformOrigin: '50% 50%' } }, lay)
    return { lay, ls, fio, it }
  })

  // abertura: a promessa escrita já no quadro 0, sobre a tela no plano geral velada
  const ab = el('div', { cls: 'layer' }, root)
  const abVeu = el('div', { cls: 'layer', style: { background: C.fundo } }, ab)
  if (FU) desenhos.push(desenharFundo(abVeu))
  const abTexto = PLANO ? el('div', { cls: 'layer' }, ab) : ab   // no plano, rótulo e título num bloco que respira
  const rot = el('div', { cls: 'abs', text: rotulo(D.textos.rotulo), style: { left: '0', width: px(W), textAlign: 'center', font: fRotulo(LAY.rot + 4), letterSpacing: PLANO ? '0' : '0.16em', color: corRotulo } }, abTexto)
  const linhasTit = D.textos.tituloLinhas[FMT] || (HORIZONTAL && D.textos.tituloLinhas['16x9']) || D.textos.tituloLinhas.padrao
  const tit = bloco(abTexto, linhasTit.map((l) => [{ t: caixa(l) }]), { top: CY - (linhasTit.length * LAY.titulo * 1.26) / 2, entrelinha: LAY.titulo * 1.26, style: { font: fTitulo(LAY.titulo), color: C.texto } })
  rot.style.top = px(CY - (linhasTit.length * LAY.titulo * 1.26) / 2 - 70)
  marcar(rot, 'texto', 'label')

  // fim: "Done!" + apoio + logo, abrindo de um círculo no campo do último passo (com fim.soLogo, só o logo, centrado)
  const fim = camada(root, C.fimFundo)
  let fimL = null, apoio = null
  if (!SO_LOGO) {
  fimL = bloco(fim, [[{ t: D.textos.fim }]], { top: CY - L({ '16x9': 130, '9x16': 170 }), entrelinha: 150, style: { font: fTitulo(L({ '16x9': 150, '9x16': 160 })), color: C.fimTexto } })
  apoio = el('div', { cls: 'abs', text: D.textos.fimApoio || '', style: { left: '0', width: px(W), top: px(CY + L({ '16x9': 110, '9x16': 110 })), textAlign: 'center', font: fTexto(L({ '16x9': 40, '9x16': 44 }), 500), color: rgba(C.fimTexto, 0.82) } }, fim)
  if (D.textos.fimApoio) marcar(apoio, 'texto', 'supporting line')
  }
  let logo = null
  if (D.logo && SO_LOGO) logo = imagem(fim, D.logo.arquivo, { left: px(CX - D.logo.w / 2), top: px(CY - D.logo.h / 2), width: px(D.logo.w), height: px(D.logo.h) })
  else if (D.logo) logo = imagem(fim, D.logo.arquivo, { left: px(CX - D.logo.w / 2), top: px(L({ '16x9': 250, '9x16': 560 }) - D.logo.h / 2), width: px(D.logo.w), height: px(D.logo.h) })

  legendas.forEach(({ box }) => root.appendChild(box))   // a legenda fica por cima de tudo, inclusive do fim
  if (TRANS !== 'corte') for (const it of X.inters) { registrarTransicao(TRANS, it.v0, TD); registrarTransicao(TRANS, it.v1 - TD, TD) }
  // push e mascara: o passo que abre uma etapa troca no cartão enquanto o intertítulo cobre o quadro (sem animação)
  const vira = (p) => {
    if (TRANS === 'corte' || !p.corte) return null
    const ii = X.inters.find((x) => Math.abs(x.v1 - p.v0) < 1e-6)
    return ii ? ii.v0 + TD : null
  }

  return (t) => {
    const k = cam(t), tr = `translate(${k.tx}px,${k.ty}px) scale(${k.s})`
    for (const d of desenhos) d(t)
    // intertítulo da vez; com push ou mascara, quanto ele já entrou (tIn) e já saiu (tOut). coberto = ele tapa o quadro
    const it = X.inters.find((x) => t >= x.v0 && t < x.v1)
    const tIn = it && TRANS !== 'corte' ? E.inOutCubic(P(t, it.v0, it.v0 + TD)) : 1
    const tOut = it && TRANS !== 'corte' ? E.inOutCubic(P(t, it.v1 - TD, it.v1)) : 0
    const coberto = !!it && tIn >= 1 && tOut <= 0
    if (TRANS === 'push') {   // o palco sai pela esquerda empurrado pelo intertítulo e volta pela direita empurrando-o
      const xp = !it ? 0 : tOut > 0 ? W * (1 - tOut) : -W * tIn
      T(palco, xp ? `translateX(${xp.toFixed(2)}px)` : 'none'); palco.style.display = coberto ? 'none' : 'block'
    }
    const tg = tGrav(t)
    A.seq.set(tg); B.seq.set(tg)
    T(A.m, tr); T(B.m, tr)
    const f = foco(t) * (PLANO ? 1 - P(t, X.fim.v0, X.fim.v0 + 0.35) : t < X.fim.v0 ? 1 : 0)   // no plano, o véu sai suave sob a íris
    A.m.style.filter = f > 0.01 ? `blur(${(10 * f) / k.s}px)` : 'none'
    O(veu, (D.marca.veu || 0.58) * f)
    const pad = 14, rx = k.reg.x * k.s + k.tx - pad, ry = k.reg.y * k.s + k.ty - pad, rw = k.reg.w * k.s + 2 * pad, rh = k.reg.h * k.s + 2 * pad
    // cartão: entra pela lateral (16:9) ou de cima (9:16) no primeiro passo e sai no fim
    const p0 = X.passos[0].v0, entra = PLANO ? E.outExpo(P(t, p0 + 0.15, p0 + 0.75)) : E.outExpo(P(t, p0 - 0.1, p0 + 0.5)), sai = E.inOutCubic(P(t, X.fim.v0 - 0.35, X.fim.v0))
    const desloc = VERTICAL ? (1 - entra) * -420 - sai * 420 : LADO === 'direita' ? (1 - entra) * 700 + sai * 700 : LADO === 'embaixo' ? (1 - entra) * 420 + sai * 420 : (1 - entra) * -700 - sai * 700
    // textoFora: onde a tela começa (a borda do cartão + a folga), na linha do tempo do cartão; com o cartão à direita ou
    // embaixo, onde ela termina
    const corte = !FORA ? 0 : LADO === 'direita' ? Math.min(W, Math.floor(LAY.card.x + desloc - FOLGA)) : LADO === 'embaixo' ? Math.min(H, Math.floor(parseFloat(card.style.top) + desloc - FOLGA))
      : Math.max(0, Math.ceil(VERTICAL ? parseFloat(card.style.top) + altCard + desloc + FOLGA : LAY.card.x + LAY.card.w + desloc + FOLGA))
    let cx0 = lerp(0, rx, f), cy0 = lerp(0, ry, f)
    let cx1 = lerp(W, rx + rw, f), cy1 = lerp(H, ry + rh, f)
    if (FORA) {
      if (VERTICAL) cy0 = Math.max(cy0, corte); else if (LADO === 'direita') cx1 = Math.min(cx1, corte); else if (LADO === 'embaixo') cy1 = Math.min(cy1, corte); else cx0 = Math.max(cx0, corte)
      telaA.style.clipPath = VERTICAL ? `inset(${corte}px 0 0 0)` : LADO === 'direita' ? `inset(0 ${W - corte}px 0 0)` : LADO === 'embaixo' ? `inset(0 0 ${H - corte}px 0)` : `inset(0 0 0 ${corte}px)`
      if (FU) {   // com fundo desenhado, o véu fica só sobre a tela (o retângulo dela no quadro, dentro do recorte): o fundo guarda a cor
        const m = 10 * k.s, vx0 = Math.max(k.tx - m, LADO === 'esquerda' ? corte : 0), vy0 = Math.max(k.ty - (barra + 10) * k.s, LADO === 'topo' ? corte : 0)
        const vx1 = Math.min(k.tx + TW * k.s + m, LADO === 'direita' ? corte : W), vy1 = Math.min(k.ty + TH * k.s + m, LADO === 'embaixo' ? corte : H)
        veu.style.clipPath = `inset(${vy0}px ${W - vx1}px ${H - vy1}px ${vx0}px round ${18 * k.s}px)`
      }
      const vt = coberto ? 0 : PLANO ? P(t, X.abertura - 0.2, X.abertura) : 1   // atrás de camada opaca a tela não conta
      O(telaA, vt); O(janela, vt)
    }
    janela.style.clipPath = `inset(${cy0}px ${W - cx1}px ${H - cy1}px ${cx0}px round ${18 * f}px)`
    const bx = FORA && LADO === 'esquerda' ? Math.max(rx - 2, corte) : rx - 2, by = FORA && LADO === 'topo' ? Math.max(ry - 2, corte) : ry - 2
    const bw = (FORA && LADO === 'direita' ? Math.min(rx + rw + 2, corte) : rx + rw + 2) - bx, bh = (FORA && LADO === 'embaixo' ? Math.min(ry + rh + 2, corte) : ry + rh + 2) - by
    place(borda, bx, by, LADO === 'direita' ? Math.max(0, bw) : bw, LADO === 'embaixo' ? Math.max(0, bh) : bh); O(borda, f * 0.9 * (FORA ? (PLANO ? P(t, X.abertura - 0.2, X.abertura) : 1) : 1))

    const pc = interpKeys(X.cursor, t), vis = P(t, X.geral1 - 0.2, X.geral1 + 0.2) * (1 - P(t, X.fim.v0 - 0.1, X.fim.v0))
    if (pc) T(cur, `translate(${pc.x * k.s + k.tx - 2}px,${pc.y * k.s + k.ty - 2}px)`)
    O(cur, pc ? vis : 0)
    X.toques.forEach((q, i) => {
      const e = P(t, q.v, q.v + 0.5), r = 8 + 46 * E.outExpo(e), x = q.x * k.s + k.tx, y = q.y * k.s + k.ty
      place(aneis[i], x - r, y - r, 2 * r, 2 * r); O(aneis[i], t >= q.v && e < 1 ? 1 - e : 0)
    })

    T(card, VERTICAL || LADO === 'embaixo' ? `translateY(${desloc}px)` : `translateX(${desloc}px)`)
    O(card, entra * (1 - sai)); card.style.display = coberto ? 'none' : 'block'
    let atual = 0
    X.passos.forEach((p, i) => { if (t >= (vira(p) ?? p.v0 - 0.05)) atual = i })
    conteudos.forEach((c, i) => {
      const p = X.passos[i], prox = X.passos[i + 1], vp = vira(p), vq = prox ? vira(prox) : null
      const e = vp != null ? (t >= vp ? 1 : 0) : E.outExpo(P(t, p.v0 - 0.05, p.v0 + 0.4))
      const s = !prox ? 0 : vq != null ? (t >= vq ? 1 : 0) : E.inOutCubic(P(t, prox.v0 - 0.3, prox.v0 - 0.05))
      T(c, `translateY(${(1 - e) * 60 - s * 60}px)`); O(c, i === 0 && t < p.v0 ? 1 : e * (1 - s))
    })
    barraProg.style.width = px(LAY.card.w * ((atual + P(t, X.passos[atual].v0, X.passos[atual].v1)) / X.passos.length))

    legendas.forEach(({ box, ws, f: fl }) => {
      const ini = fl.palavras[0].ini, fimF = fl.palavras[fl.palavras.length - 1].fim
      const o = P(t, ini - 0.25, ini - 0.05) * (1 - P(t, fimF + 0.45, fimF + 0.65))
      O(box, o); T(box, `translateY(${(1 - E.outExpo(P(t, ini - 0.25, ini + 0.1))) * 24}px)`)
      fl.palavras.forEach((w, i) => {
        const dita = t >= w.ini - 0.03 && (t < w.fim + 0.02 || (i === fl.palavras.length - 1 && t < fimF + 0.65))
        ws[i].style.background = dita ? C.destaque : 'transparent'
        ws[i].style.color = dita ? C.sobreDestaque : C.texto
        ws[i].style.opacity = t >= w.ini - 0.03 ? 1 : 0.55
      })
    })

    inters.forEach(({ lay, ls, fio, it }) => {
      const on = t >= it.v0 && t < it.v1
      lay.style.display = on ? 'block' : 'none'
      if (on && TRANS === 'corte') { riseWords(palavras(ls), t, it.v0, 0.06, 0.45); T(fio, `scaleX(${E.outExpo(P(t, it.v0, it.v0 + 0.4))})`) }
      else if (on) {
        // push: as palavras sobem enquanto o painel chega e saem com ele; mascara: sobem depois que o círculo cobriu o
        // quadro e descem antes de ele fechar (texto nenhum aparece com a tela à vista)
        const a = E.inOutCubic(P(t, it.v0, it.v0 + TD)), b = E.inOutCubic(P(t, it.v1 - TD, it.v1)), ws = palavras(ls)
        const t0 = TRANS === 'push' ? it.v0 + TD * 0.5 : it.v0 + TD + 0.02, t1 = it.v1 - TD - 0.3 - 0.03 * (ws.length - 1)
        riseWords(ws, t, t0, 0.06, 0.45)
        if (TRANS === 'mascara') exitWords(ws, t, t1, 0.03, 0.26)
        T(fio, `scaleX(${E.outExpo(P(t, t0, t0 + 0.4)) * (TRANS === 'mascara' ? 1 - E.inOutCubic(P(t, t1, it.v1 - TD)) : 1)})`)
        if (TRANS === 'push') T(lay, `translateX(${(W * (1 - a) - W * b).toFixed(2)}px)`)
        else {   // o círculo nasce no campo da vez e fecha no próximo (a câmera já está nele)
          const ox = clamp((k.reg.x + k.reg.w / 2) * k.s + k.tx, 0, W), oy = clamp((k.reg.y + k.reg.h / 2) * k.s + k.ty, 0, H)
          iris(lay, raioCobre(ox, oy) * Math.min(a, 1 - b), ox, oy)
        }
      }
    })

    // abertura: título inteiro no quadro 0; sai subindo e o véu abre para o plano geral
    const sa = E.inOutCubic(P(t, X.abertura - 0.45, X.abertura))
    ab.style.display = t < X.abertura ? 'block' : 'none'
    O(abVeu, (PLANO ? 1 : 0.86) * (1 - sa))   // no plano, a abertura é o fundo chapado (a tela não vaza atrás do título)
    palavras(tit).forEach((w) => { T(w.inner, `translateY(${-sa * 140}%)`) })
    O(rot, 1 - sa)
    if (PLANO) T(abTexto, `scale(${1 + 0.05 * P(t, 0, X.abertura)})`)
    if (PLANO && FORA) O(abTexto, 1 - P(t, X.abertura - 0.45, X.abertura - 0.2))   // o título sai antes de a tela aparecer

    const fv = X.fim.v0, fe = E.inOutCubic(P(t, fv, fv + 0.55))
    fim.style.display = t >= fv ? 'block' : 'none'
    if (t >= fv) {
      const ox = X.fimOrigem ? X.fimOrigem.x * k.s + k.tx : CX, oy = X.fimOrigem ? X.fimOrigem.y * k.s + k.ty : CY
      iris(fim, raioCobre(ox, oy) * fe, ox, oy)
      if (SO_LOGO) {   // o logo sobe e para
        const pl = E.outExpo(P(t, fv + 0.45, fv + 1.0))
        if (logo) { O(logo, pl); T(logo, `translateY(${(1 - pl) * 40}px)`) }
      } else {
      riseWords(palavras(fimL), t, fv + 0.3, 0.06, 0.5)
      O(apoio, E.outExpo(P(t, fv + 0.6, fv + 1.0))); T(apoio, `translateY(${(1 - E.outExpo(P(t, fv + 0.6, fv + 1.0))) * 30}px)`)
      if (logo) O(logo, E.outExpo(P(t, fv + 0.8, fv + 1.2)))
      }
    }
  }
})
