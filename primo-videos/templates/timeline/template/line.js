// Molde timeline: um eixo com marcos que acendem em sequência; a câmera anda pelo eixo (travelling) ou fica
// parada com o eixo inteiro no quadro (estatica). Horizontal ou vertical. Nada da marca aqui dentro: cores, fontes,
// logo, textos e ícones vêm de PARAMS (params.js, do JSON).
// Cada marco: ponto no eixo, pílula com a etapa ou a data, uma linha de texto e (opcional) um ícone num ladrilho, ao
// lado do texto, nunca debaixo dele. O título fica parado no alto desde o primeiro quadro. Fecho: só o logo, centrado.

const MK = PARAMS.marca
const CR = (() => {
  const c = MK.cores, eixo = c.eixo || mix(c.fundo, c.texto, 0.25)
  const r = { apoio: c.texto, progresso: c.texto, etiqueta: c.texto, etiquetaTexto: c.fundo, ...c, eixo }
  r.aceso = c.aceso || r.progresso; r.ponto = c.ponto || eixo
  return r
})()
const FT = MK.fontes.titulo, FX = MK.fontes.texto || FT
const PS = { titulo: 700, texto: 500, etiqueta: 700, ...(MK.pesos || {}) }
const fTit = (s) => `${PS.titulo} ${s}px "${FT}"`
const fTxt = (s, w = PS.texto) => `${w} ${s}px "${FX}"`
const HOR = PLANO.orientacao === 'horizontal', VIAJA = PLANO.camera === 'travelling', GUIA = PLANO.camera === 'guiada'
// câmera guiada: o eixo inteiro como na estática, e a lente aproxima no marco da vez (até 35%) e anda junto
const ZOOM_GUIA = 1.35

// ---------- leiaute por formato ----------
const MX = Math.round((W * 120) / 1920)
const AREA = HORIZONTAL ? { x0: MX, x1: W - MX, y0: 100, y1: 980 }
  : L({ '9x16': { x0: 90, x1: 930, y0: 290, y1: 1420 }, '1x1': { x0: 80, x1: 1000, y0: 80, y1: 1000 }, '4x5': { x0: 80, x1: 1000, y0: 90, y1: 1260 } })
AREA.w = AREA.x1 - AREA.x0; AREA.h = AREA.y1 - AREA.y0
// corpo de cada parte, por formato e por orientação (na vertical o texto tem a largura toda à direita do eixo)
const TAM = (() => {
  const t = L({
    '16x9': { titulo: 76, h: { pilula: 44, texto: 58, ponto: 48, pontoOff: 24, linha: 8, icone: 160, passo: 720 }, v: { pilula: 44, texto: 64, ponto: 48, pontoOff: 24, linha: 8, icone: 120, passo: 250 } },
    '9x16': { titulo: 68, h: { pilula: 38, texto: 48, ponto: 42, pontoOff: 20, linha: 7, icone: 130, passo: 560 }, v: { pilula: 38, texto: 50, ponto: 42, pontoOff: 20, linha: 7, icone: 104, passo: 300 } },
    '1x1': { titulo: 58, h: { pilula: 32, texto: 42, ponto: 36, pontoOff: 18, linha: 6, icone: 110, passo: 500 }, v: { pilula: 34, texto: 46, ponto: 36, pontoOff: 18, linha: 6, icone: 96, passo: 210 } },
    '4x5': { titulo: 60, h: { pilula: 34, texto: 44, ponto: 38, pontoOff: 18, linha: 6, icone: 116, passo: 520 }, v: { pilula: 36, texto: 48, ponto: 38, pontoOff: 18, linha: 6, icone: 100, passo: 240 } },
  })
  return { titulo: t.titulo, ...(HOR ? t.h : t.v) }
})()
const SEGURA = areaSegura()

// ---------- utilidades ----------
const _cv = document.createElement('canvas').getContext('2d')
const largura = (s, f) => { _cv.font = f; return _cv.measureText(String(s)).width }
function quebrar(texto, font, w) {
  const out = []; let cur = ''
  for (const p of String(texto).split(' ')) { const n = cur ? cur + ' ' + p : p; if (largura(n, font) > w && cur) { out.push(cur); cur = p } else cur = n }
  if (cur) out.push(cur)
  return out
}
/** Duas linhas de largura parecida (sem a palavra sozinha na segunda). */
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
const div = (parent, style = {}, text) => el('div', { cls: 'abs', style, ...(text != null ? { text } : {}) }, parent)
function texto(parent, s, font, cor, nome) {
  const e = div(parent, { font, color: cor, whiteSpace: 'nowrap', lineHeight: '1.12' }, s)
  marcar(e, 'texto', nome)
  return e
}

// ---------- cena única: título, eixo, marcos ----------
const D_TR = PLANO.dTransicao, TRN = PLANO.transicao
let FOCO = [CX, CY], RAIO_FOCO = TAM.ponto / 2

cena(0, PLANO.cena.ate, (root) => {
  const cam = camada(root, CR.fundo)
  // título no alto, fora da câmera que anda (só chega mais perto junto com o resto, no primeiro segundo)
  let y0 = AREA.y0
  const tit = div(cam, { width: px(W), height: px(H) })
  if (PARAMS.titulo) {
    let tt = TAM.titulo, ls = quebrar(PARAMS.titulo, fTit(tt), AREA.w)
    while (ls.length > 2 && tt > TAM.titulo * 0.7) { tt -= 2; ls = quebrar(PARAMS.titulo, fTit(tt), AREA.w) }
    ls = equilibrar(ls, fTit(tt))
    // na guiada o bloco dos marcos fica centrado, e o título também
    ls.forEach((s, i) => { const e = texto(tit, s, fTit(tt), CR.texto, 'title'); place(e, GUIA ? AREA.x0 + (AREA.w - largura(s, fTit(tt))) / 2 : AREA.x0, AREA.y0 + i * tt * 1.1) })
    y0 = AREA.y0 + ls.length * tt * 1.1 + L({ '16x9': 56, '9x16': 70, '1x1': 40, '4x5': 48 })
  }
  const REG = { x0: AREA.x0, x1: AREA.x1, y0, y1: AREA.y1 }
  REG.w = REG.x1 - REG.x0; REG.h = REG.y1 - REG.y0
  const OX = (REG.x0 + REG.x1) / 2, OY = (REG.y0 + REG.y1) / 2
  const resp = div(cam, { width: px(W), height: px(H), transformOrigin: `${OX}px ${OY}px` })   // a câmera que respira
  tit.style.transformOrigin = `${OX}px ${OY}px`
  if ((VIAJA || GUIA) && !HOR && PARAMS.titulo) resp.style.clipPath = `inset(${Math.max(0, REG.y0 - 24)}px 0 0 0)`
  const lente = div(resp, { transformOrigin: '0 0' })                                          // a que aproxima (guiada)
  const mundo = div(lente, {})                                                                 // a que anda pelo eixo
  const n = PLANO.marcos.length
  const ic = PLANO.marcos.some((m) => m.icone) ? TAM.icone : 0
  const fP = fTxt(TAM.pilula, PS.etiqueta), fX = fTxt(TAM.texto)

  // geometria no "mundo": posição de cada marco ao longo do eixo (s) e a reta do eixo
  let S, textW, pos, eixoFixo, abre, fecha, ancora, empilha = false, txV = 0
  const pills = PLANO.marcos.map((m) => largura(m.etapa || m.data, fP) + TAM.pilula * 1.5)
  if (HOR) {
    if (VIAJA) { S = TAM.passo; textW = Math.min(S - 120, 600) }
    else { S = (REG.w + 40) / n; textW = S - 40 }
    const linhasMax = Math.max(...PLANO.marcos.map((m) => quebrar(m.texto, fX, textW).length))
    const acima = ic ? ic + 44 : 0, abaixo = 44 + TAM.pilula * 1.7 + 18 + linhasMax * TAM.texto * 1.12
    eixoFixo = REG.y0 + (REG.h - acima - abaixo) / 2 + acima
    pos = PLANO.marcos.map((_, i) => i * S)
    // na viagem, o marco aceso fica um pouco à direita do centro: o anterior ainda se lê, o próximo aparece como ponto
    ancora = VIAJA ? REG.x0 + REG.w * 0.6 : REG.x0 + textW / 2
    abre = VIAJA ? -S * 0.6 : -30; fecha = pos[n - 1] + (VIAJA ? S * 0.6 : 30)
  } else {
    // a pílula à esquerda do eixo e o texto à direita; quando assim o texto fica estreito demais (retrato com etapa
    // longa ou ícone), o eixo vai para a borda e a pílula sobe para cima do texto ("empilha")
    const pillW = Math.max(...pills)
    eixoFixo = REG.x0 + pillW + 40
    if (REG.x1 - (eixoFixo + 48 + (ic ? ic + 24 : 0)) < REG.w * 0.45) { empilha = true; eixoFixo = REG.x0 + TAM.ponto / 2 + 6 }
    txV = eixoFixo + (empilha ? 40 : 48) + (ic ? ic + 24 : 0)
    textW = REG.x1 - txV - Math.round(REG.w * 0.04)   // folga: a câmera respira 2,5% e o canvas mede um pouco menos que o DOM
    if (GUIA) {
      // na guiada, o texto quebra em até 45% da largura (a lente cabe de perto em todo marco) e o bloco fica centrado
      textW = Math.min(textW, Math.round(REG.w * 0.45))
      const largo = Math.max(...PLANO.marcos.map((m) => Math.max(...equilibrar(quebrar(m.texto, fX, textW), fX).map((s) => largura(s, fX)))))
      const sobra = (REG.x1 - Math.round(REG.w * 0.04)) - (txV + largo)
      if (sobra > 0) { eixoFixo += sobra / 2; txV += sobra / 2 }
    }
    const linhasMax = Math.max(...PLANO.marcos.map((m) => quebrar(m.texto, fX, textW).length))
    const linhaH = empilha ? Math.max(TAM.pilula * 1.7 + 14 + linhasMax * TAM.texto * 1.12, ic) : Math.max(linhasMax * TAM.texto * 1.12, ic, TAM.pilula * 1.7)
    if (VIAJA) S = Math.max(TAM.passo, linhaH + 60)
    else S = n > 1 ? (REG.h - linhaH) / (n - 1) : 0
    if (!VIAJA && S < linhaH + 24) console.error(`TIMELINE: ${n} milestones do not fit standing still in the vertical layout of this format (${Math.round(S)} px between milestones): use "camera": "travelling"`)
    pos = PLANO.marcos.map((_, i) => i * S)
    ancora = VIAJA ? REG.y0 + REG.h * 0.45 : REG.y0 + linhaH / 2
    abre = VIAJA ? -S * 0.6 : -24; fecha = pos[n - 1] + (VIAJA ? S * 0.6 : 24)
  }
  // trilho e progresso do eixo
  const grossa = TAM.linha
  const reta = (cor) => div(mundo, HOR ? { left: px(abre), top: px(eixoFixo - grossa / 2), width: px(fecha - abre), height: px(grossa), background: cor, borderRadius: px(grossa / 2), transformOrigin: '0 50%' }
    : { left: px(eixoFixo - grossa / 2), top: px(abre), width: px(grossa), height: px(fecha - abre), background: cor, borderRadius: px(grossa / 2), transformOrigin: '50% 0' })
  const trilho = reta(CR.eixo), progresso = reta(CR.progresso)

  const marcos = PLANO.marcos.map((m, i) => {
    const s = pos[i]
    const [px0, py0] = HOR ? [s, eixoFixo] : [eixoFixo, s]
    const ponto = div(mundo, { left: px(px0), top: px(py0), width: px(TAM.ponto), height: px(TAM.ponto), marginLeft: px(-TAM.ponto / 2), marginTop: px(-TAM.ponto / 2), borderRadius: '50%', background: CR.ponto })
    const pil = div(mundo, { font: fP, color: CR.etiquetaTexto, background: CR.etiqueta, borderRadius: '999px', padding: `${TAM.pilula * 0.32}px ${TAM.pilula * 0.72}px`, whiteSpace: 'nowrap', lineHeight: '1.06' }, m.etapa || m.data)
    marcar(pil, 'texto', m.etapa || m.data)
    const rp = rectOf(pil)
    const ls = equilibrar(quebrar(m.texto, fX, textW), fX).map((l) => texto(mundo, l, fX, CR.texto, m.texto))
    const lh = TAM.texto * 1.12
    let im = null
    if (HOR) {
      place(pil, s - rp.w / 2, eixoFixo + 44)
      ls.forEach((e, j) => place(e, s - rectOf(e).w / 2, eixoFixo + 44 + rp.h + 18 + j * lh))
      if (m.icone) im = ladrilho(mundo, m.icone, ic, s - ic / 2, eixoFixo - 44 - ic)
    } else {
      const hT = ls.length * lh
      if (empilha) {
        const hB = rp.h + 14 + hT
        place(pil, txV, s - hB / 2)
        ls.forEach((e, j) => place(e, txV, s - hB / 2 + rp.h + 14 + j * lh))
      } else {
        place(pil, eixoFixo - 40 - rp.w, s - rp.h / 2)
        ls.forEach((e, j) => place(e, txV, s - hT / 2 + j * lh))
      }
      if (m.icone) im = ladrilho(mundo, m.icone, ic, eixoFixo + (empilha ? 40 : 48), s - ic / 2)
    }
    // extensão do que se lê (para apagar o marco que sai da área segura na viagem)
    const lw = Math.max(...ls.map((e) => rectOf(e).w))   // a largura de verdade do texto (não a máxima permitida)
    const ext = HOR ? [s - Math.max(lw, rp.w, ic) / 2, s + Math.max(lw, rp.w, ic) / 2] : [s - Math.max(ls.length * lh + (empilha ? rp.h + 14 : 0), rp.h, ic) / 2, s + Math.max(ls.length * lh + (empilha ? rp.h + 14 : 0), rp.h, ic) / 2]
    // a caixa do marco atravessada ao eixo (para a câmera guiada enquadrar e para apagar o que sai do quadro)
    const atr = HOR ? [ic ? eixoFixo - 44 - ic : eixoFixo - TAM.ponto / 2, eixoFixo + 44 + rp.h + 18 + ls.length * lh]
      : [empilha ? eixoFixo - TAM.ponto / 2 : eixoFixo - 40 - rp.w, txV + lw]
    return { m, s, ponto, pil, ls, im, ext, atr, t: m.t }
  })

  // a câmera: em cada marco, vai do anterior ao próximo e chega quando ele acende; o progresso anda junto
  const mov = Math.min(0.75, PLANO.passo * 0.6)
  const posEm = (t) => {
    if (t < marcos[0].t) return lerp(abre, pos[0], E.outCubic(P(t, 0.05, marcos[0].t)))
    let x = pos[0]
    for (let i = 1; i < n; i++) x = lerp(x, pos[i], E.inOutCubic(P(t, marcos[i].t - mov, marcos[i].t)))
    return x
  }
  const camEm = (t) => (VIAJA ? Math.max(pos[0], Math.min(pos[n - 1], posEm(t))) : 0)
  const desloca = (t) => ancora - camEm(t)
  // a câmera chega 8% mais perto no primeiro segundo e meio (o gancho) e respira mais 2,5% até a transição
  const chega = (t) => 0.92 + 0.08 * E.outCubic(P(t, 0, 1.4))
  const escala = (t) => chega(t) * (1 + 0.025 * P(t, 0, PLANO.corte.a))
  // câmera guiada: abre com o eixo inteiro, aproxima no 1º marco (o gancho), anda de marco em marco quando o próximo
  // acende e, depois do último, recua até o eixo inteiro. Cada marco enquadrado no centro da região, com o zoom que
  // cabe nela (até ZOOM_GUIA). Coordenadas da "tela larga" = o mundo já deslocado (como na câmera estática).
  const caixaLarga = (q) => { const dd0 = desloca(0); return HOR ? { x0: q.ext[0] + dd0, x1: q.ext[1] + dd0, y0: q.atr[0], y1: q.atr[1] } : { x0: q.atr[0], x1: q.atr[1], y0: q.ext[0] + dd0, y1: q.ext[1] + dd0 } }
  const LARGA = { fx: OX, fy: OY, z: 1 }
  const chaves = []
  if (GUIA) {
    const enquadra = (q) => { const b = caixaLarga(q); return { fx: (b.x0 + b.x1) / 2, fy: (b.y0 + b.y1) / 2, z: clamp(Math.min((REG.w * 0.9) / (b.x1 - b.x0), (REG.h * 0.9) / (b.y1 - b.y0)), 1, ZOOM_GUIA) } }
    chaves.push({ t: 0, dur: 0, ...LARGA })
    chaves.push({ t: Math.max(marcos[0].t + 0.6, 1.1), dur: 0.95, ...enquadra(marcos[0]) })
    for (let i = 1; i < n; i++) chaves.push({ t: marcos[i].t, dur: mov, ...enquadra(marcos[i]) })
    const ult = marcos[n - 1].t, rec = Math.min(1.0, PLANO.final * 0.6)
    chaves.push({ t: ult + Math.min(0.5, PLANO.final * 0.3) + rec, dur: rec, ...LARGA })
  }
  const lenteEm = (t) => {
    if (!GUIA) return LARGA
    let c = chaves[0]
    for (let i = 1; i < chaves.length; i++) {
      const k = chaves[i], e = E.inOutCubic(P(t, k.t - k.dur, k.t))
      if (e <= 0) break
      c = { fx: lerp(c.fx, k.fx, e), fy: lerp(c.fy, k.fy, e), z: Math.exp(lerp(Math.log(c.z), Math.log(k.z), e)) }
    }
    return c
  }
  // da tela larga para a tela de verdade: a lente (guiada) e depois a câmera que respira
  const naTela = (x, y, t) => { const c = lenteEm(t), k = escala(t); const lx = OX + (x - c.fx) * c.z, ly = OY + (y - c.fy) * c.z; return [OX + (lx - OX) * k, OY + (ly - OY) * k] }
  // o foco da transição para o fecho: o último ponto, na tela, no começo da janela
  const tF = PLANO.corte.a, kF = escala(tF), dF = desloca(tF)
  const lastS = pos[n - 1] + dF
  FOCO = naTela(HOR ? lastS : eixoFixo, HOR ? eixoFixo : lastS, tF)
  RAIO_FOCO = (TAM.ponto / 2) * kF * lenteEm(tF).z

  return (t) => {
    const k = escala(t), dd = desloca(t)
    T(resp, `scale(${k})`); T(tit, `scale(${chega(t)})`)
    // no zoom e na máscara o texto (título e marcos) sai no começo da transição: crescendo, ele passaria da borda do
    // quadro; fora do círculo da máscara, ficaria ao lado do logo
    const some = TRN === 'zoom' || TRN === 'mascara' ? 1 - E.inCubic(P(t, PLANO.corte.a, PLANO.corte.a + PLANO.corte.d * 0.3)) : 1
    O(tit, some)
    T(mundo, HOR ? `translateX(${dd}px)` : `translateY(${dd}px)`)
    if (GUIA) { const c = lenteEm(t); T(lente, `translate(${OX - c.z * c.fx}px, ${OY - c.z * c.fy}px) scale(${c.z})`) }
    const p = posEm(t)
    T(trilho, HOR ? `scaleX(${E.outCubic(P(t, 0, 0.5))})` : `scaleY(${E.outCubic(P(t, 0, 0.5))})`)
    const fr = clamp((p - abre) / (fecha - abre))
    T(progresso, HOR ? `scaleX(${fr})` : `scaleY(${fr})`)
    // etiquetaAtiva (opcional): a pílula do marco da vez troca para essa cor (o último aceso); as anteriores voltam
    let vez = -1
    marcos.forEach((q, i) => { if (t >= q.t) vez = i })
    for (const q of marcos) {
      if (CR.etiquetaAtiva) { const ativa = q === marcos[vez]; q.pil.style.background = ativa ? CR.etiquetaAtiva : CR.etiqueta; q.pil.style.color = ativa ? CR.etiquetaAtivaTexto || CR.etiquetaTexto : CR.etiquetaTexto }
      const kp = spring(t - q.t, 2.4, 0.5), aceso = t >= q.t
      q.ponto.style.background = aceso ? CR.aceso : CR.ponto
      T(q.ponto, `scale(${aceso ? 0.5 + 0.5 * kp : TAM.pontoOff / TAM.ponto})`)
      // o marco que sai da área segura (viagem) apaga aos poucos: nada parado meio para fora do quadro
      let vis = some
      if (VIAJA) {
        // o limite: a área segura, e na vertical o começo da região abaixo do título
        const a = HOR ? [SEGURA.x0, SEGURA.x1] : [Math.max(SEGURA.y0, REG.y0), SEGURA.y1], o = HOR ? OX : OY
        const lo = o + (q.ext[0] + dd - o) * k, hi = o + (q.ext[1] + dd - o) * k
        vis *= clamp(1 + (Math.min(lo - a[0], a[1] - hi) - 20) / 60)   // some antes de 40 px fora: nada esmaecido na borda
      } else if (GUIA) {
        // com a lente perto, o marco vizinho pode passar da borda (ou subir até o título): apaga como na viagem
        const b = caixaLarga(q), [x0, y0] = naTela(b.x0, b.y0, t), [x1, y1] = naTela(b.x1, b.y1, t)
        const m = Math.min(x0 - SEGURA.x0, SEGURA.x1 - x1, y0 - Math.max(SEGURA.y0, REG.y0), SEGURA.y1 - y1)
        vis *= clamp(1 + (m - 20) / 60)
      }
      const ke = E.outCubic(P(t, q.t, q.t + 0.4)), kt = E.outCubic(P(t, q.t + 0.08, q.t + 0.5))
      const dz = HOR ? (v) => `translateY(${(1 - v) * 18}px)` : (v) => `translateX(${(1 - v) * -18}px)`
      O(q.pil, ke * vis); T(q.pil, dz(ke))
      for (const e of q.ls) { O(e, kt * vis); T(e, dz(kt)) }
      if (q.im) { const ki = spring(t - q.t - 0.05, 2.2, 0.55); O(q.im, Math.min(1, ki) * vis); T(q.im, `scale(${0.7 + 0.3 * Math.min(1.08, ki)})`) }
    }
    transicao('sai', cam, t)
  }
}, 'timeline')

/** Ícone (PNG) num ladrilho (marca.cores.ladrilho, opcional). Marcado como imagem: texto nenhum pode cruzá-lo. */
function ladrilho(parent, src, tam, x, y) {
  const box = div(parent, { left: px(x), top: px(y), width: px(tam), height: px(tam), borderRadius: px(tam * 0.28), background: CR.ladrilho || 'transparent', overflow: 'hidden', transformOrigin: '50% 50%' })
  const pad = CR.ladrilho ? tam * 0.16 : 0
  imagem(box, src, { left: px(pad), top: px(pad), width: px(tam - 2 * pad), height: px(tam - 2 * pad), objectFit: 'contain' })
  marcarImagem(box, 'the icon')
  return box
}

// ---------- transição para o fecho ----------
function transicao(lado, cam, t) {
  if (TRN === 'corte') return
  if (lado === 'sai' && TRN === 'mascara') return   // o fecho se revela por cima; a linha só fica embaixo
  const [x, y] = FOCO
  // zoom sem desfoque: desfocada, a borda da cena que sai mostraria o fundo do palco em volta do fecho
  const o = TRN === 'mascara' ? { forma: 'circulo', x, y } : TRN === 'zoom' ? { x, y, raio: RAIO_FOCO, blur: 0 } : { dir: HOR ? 'esquerda' : 'cima' }
  TR[TRN][lado](cam, t, PLANO.corte.a, PLANO.corte.d, o)
}

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
    if (TRN === 'corte') { const k = Math.min(1, spring(t - f0, 2.2, 0.6)); O(lg, E.outCubic(P(t, f0, f0 + 0.2))); T(lg, `translateY(${(1 - k) * 24}px) scale(${0.94 + 0.06 * k})`) }
    transicao('entra', cam, t)
  }
}, 'closing')
