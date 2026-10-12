/* Molde "checklist que marca": itens que se marcam (✓) ou se riscam (✕), um de cada vez, com um contador ("4 de 6").
 * Numa lista só que vai sendo conferida, ou em duas colunas ("Faz" / "Não faz"). Fecho só com o logo.
 * Nada da marca aqui: cores, fontes, logo e textos vêm de PARAMS.
 * Ordem: conteúdo (fundo, título, cartões, contador, numa mesa que a câmera move) → fecho por cima. */
const M = PARAMS.marca, C = M.cores
const FX = M.fontes.texto, FTT = M.fontes.titulo || M.fontes.texto
const fX = (s, peso = 500) => `${peso} ${Math.round(s)}px "${FX}"`
const fT = (s, peso = 700) => `${peso} ${Math.round(s)}px "${FTT}"`
const RET = W / H < 1.1
const EST = PLANO.estrutura, CAMERA = PLANO.camera
const RESPIRO = PARAMS.respiro ?? 1
const COR = { nao: C.texto, sobreNao: C.fundo, vazio: C.fundo, contador: C.texto, titulo: C.texto, ...C }
const CONT = PARAMS.contador === false ? null : { modo: EST === 'colunas' ? 'coluna' : 'total', ...(PARAMS.contador || {}) }
// o "of" do contador ("4 of 6"); outro idioma: "textos": { "de": "de" } no JSON
const DE = (PARAMS.textos && PARAMS.textos.de) || 'of'
// cores de cada grupo: as da marca, com o que a coluna trouxer por cima
const corDo = (g) => {
  const c = { ...COR, ...(g.cores || {}) }
  c.risco = (g.cores && g.cores.risco) || c.sobreCartao
  return c
}

// ---------- geometria por formato (19:9 e 21:9 herdam o 16:9 pelo L(); larguras horizontais vêm de W) ----------
const G = L({
  // txt é o teto do corpo dos itens: a cena escolhe o maior que enche a altura e cabe na largura (nunca menos de 28)
  '16x9': { txt: 64, tit: 64, cab: 52, cont: 240, contRot: 64, padC: 48, gapL: 14, raio: 40 },
  '9x16': { txt: 56, tit: 60, cab: 50, cont: 200, contRot: 64, padC: 40, gapL: 12, raio: 40 },
  '1x1': { txt: 48, tit: 52, cab: 44, cont: 170, contRot: 64, padC: 36, gapL: 10, raio: 36 },
  '4x5': { txt: 50, tit: 56, cab: 46, cont: 190, contRot: 64, padC: 38, gapL: 12, raio: 38 },
})
const SEGURA = areaSegura()
const _cv = document.createElement('canvas').getContext('2d')
const larg = (s, f) => { _cv.font = f; return _cv.measureText(s).width }
const linhaTexto = (parent, s, f, cor, x, y, nome) => marcar(el('div', { cls: 'abs', text: s, style: { left: px(x), top: px(y), font: f, color: cor, whiteSpace: 'nowrap', lineHeight: '1.2' } }, parent), 'texto', nome)

// o corpo dos itens: o maior (até G.txt, nunca menos de 28 px) em que o item mais longo cabe na largura
function corpoQueCabe(textos, wTexto, max = G.txt) {
  const f1 = fX(100, 500), w100 = Math.max(...textos.map((s) => larg(s, f1)))
  return Math.max(28, Math.min(max, Math.floor((100 * wTexto) / w100)))
}

// altura de um cartão com n itens no corpo txt (as mesmas contas do cartaoGrupo)
function alturaCartao(n, txt, comCabecalho) {
  const cabPx = Math.round(Math.max(G.cab, txt * 1.1))
  const rh = Math.round(Math.max(Math.round(txt * 1.3), txt * 1.2) + txt * 0.5)
  return 2 * G.padC + (comCabecalho ? Math.round(cabPx * 1.2 + txt * 0.45) : 0) + n * rh + (n - 1) * G.gapL
}
// o maior corpo (até G.txt) em que os cartões, um embaixo do outro (ns = itens de cada um), cabem na altura alt
function corpoQueEnche(ns, alt, comCabecalho, entre = 28) {
  for (let t = G.txt; t > 28; t--) if (ns.reduce((a, n) => a + alturaCartao(n, t, comCabecalho), 0) + entre * (ns.length - 1) <= alt) return t
  return 28
}

// ---------- o cartão de um grupo ----------
function cartaoGrupo(parent, g, gi, w, x, y, comCabecalho, txt = G.txt) {
  const cor = corDo(g)
  const pad = G.padC
  // o título do cartão cabe na largura (com o contador da coluna ao lado, quando há)
  const cabMax = Math.round(Math.max(G.cab, txt * 1.1)), folgaCont = CONT && CONT.modo === 'coluna' ? larg(`8 ${DE} 8`, fX(cabMax * 0.72, 600)) + 30 : 0
  const cabPx = g.titulo ? Math.max(28, Math.min(cabMax, Math.floor(cabMax * (w - 2 * G.padC - folgaCont) / larg(g.titulo, fT(cabMax))))) : cabMax
  const box = el('div', { cls: 'abs', style: { left: px(x), top: px(y), width: px(w), background: cor.cartao, borderRadius: px(G.raio) } }, parent)
  let h = pad, cab = null, contCol = null
  if (comCabecalho && g.titulo) {
    const f = fT(cabPx)
    cab = linhaTexto(box, g.titulo, f, cor.sobreCartao, pad, h, `title ${g.titulo}`)
    if (CONT && CONT.modo === 'coluna') {
      const cpx = Math.round(cabPx * 0.72), fc = fX(cpx, 600), n = g.itens.length
      contCol = el('div', { cls: 'abs', text: `0 ${DE} ${n}`, style: { top: px(h + (cabPx - cpx) * 0.7), font: fc, color: cor.sobreCartao, whiteSpace: 'nowrap', lineHeight: '1.2', fontVariantNumeric: 'tabular-nums' } }, box)
      contCol.style.left = px(w - pad - larg(`${n} ${DE} ${n}`, fc))
      marcar(contCol, 'texto', 'column counter')
    }
    h += Math.round(cabPx * 1.2 + txt * 0.45)
  }
  const d = Math.round(txt * 1.3)
  const wTexto = w - 2 * pad - d - txt * 0.55 - 20
  const corpo = corpoQueCabe(g.itens.map(_textoItem), wTexto, txt)
  const f = fX(corpo, 500), rh = Math.round(Math.max(d, corpo * 1.2) + txt * 0.5)
  for (const it of g.itens) if (larg(_textoItem(it), f) > wTexto + 1) console.error(`ITEM TOO LONG in ${FMT.replace('x', ':')}: "${_textoItem(it)}" does not fit on one line of the card even at ${corpo} px. Shorten the item (up to ~4 words).`)
  const linhas = g.itens.map((it, k) => {
    const yRow = h
    const row = el('div', { cls: 'abs', style: { left: '0', top: px(yRow), width: px(w), height: px(rh) } }, box)
    // círculo vazio, círculo cheio (cresce), traço da marca (desenhado)
    const cx = pad + d / 2, cy = rh / 2
    const vazio = el('div', { cls: 'abs', style: { left: px(cx - d / 2), top: px(cy - d / 2), width: px(d), height: px(d), borderRadius: '50%', background: cor.vazio } }, row)
    const marca = (it && typeof it === 'object' && it.marca) || g.marca
    const cheio = el('div', { cls: 'abs', style: { left: px(cx - d / 2), top: px(cy - d / 2), width: px(d), height: px(d), borderRadius: '50%', background: marca === 'ok' ? cor.ok : cor.nao, transform: 'scale(0)' } }, row)
    const s = sv('svg', { width: d, height: d, viewBox: '0 0 100 100' }, cheio)
    Object.assign(s.style, { position: 'absolute', left: '0', top: '0' })
    const tinta = marca === 'ok' ? cor.sobreOk : cor.sobreNao
    const tracos = (marca === 'ok' ? ['M 28 52 L 44 67 L 73 36'] : ['M 33 33 L 67 67', 'M 67 33 L 33 67'])
      .map((dd) => traco(sv('path', { d: dd, fill: 'none', stroke: tinta, 'stroke-width': 11, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, s)))
    const xt = pad + d + txt * 0.55
    // o risco do ✕ fica atrás do texto: risca sem cobrir a letra
    const risca = marca === 'nao' && g.risca !== false
    const tw = larg(_textoItem(it), f)
    const risco = risca ? el('div', { cls: 'abs', style: { left: px(xt - 6), top: px(cy - Math.max(3, corpo * 0.07) / 2 + corpo * 0.04), width: px(tw + 12), height: px(Math.max(3, corpo * 0.07)), background: cor.risco, transformOrigin: '0 50%', transform: 'scaleX(0)' } }, row) : null
    const tx = linhaTexto(row, _textoItem(it), f, cor.sobreCartao, xt, (rh - corpo * 1.2) / 2, `item ${k + 1}`)
    h += rh + G.gapL
    return { row, yRow, rh, cheio, tracos, risco, tx, marca }
  })
  h += pad - G.gapL
  box.style.height = px(h)
  // o cabeçalho (título e contador da coluna), em coordenadas do cartão: é ele que esmaece se a câmera o levar para fora
  const cabR = cab ? { x: pad, y: pad, w: w - 2 * pad, h: cabPx * 1.2 } : null
  return { box, w, h, x, y, linhas, contCol, cor, cab, cabPx, cabR }
}

// ---------- câmera (chaves { t, cx, cy, z }), como a da conversa ----------
function cameraChecklist(chaves, dur = 0.6) {
  const ks = chaves.slice().sort((a, b) => a.t - b.t)
  return (t) => {
    let cur = { ...ks[0] }
    for (let i = 1; i < ks.length; i++) {
      const k = ks[i], e = (k.ease || E.inOutCubic)(P(t, k.t, k.t + (k.dur ?? dur)))
      if (e <= 0) break
      cur = { cx: lerp(cur.cx, k.cx, e), cy: lerp(cur.cy, k.cy, e), z: Math.exp(lerp(Math.log(cur.z), Math.log(k.z), e)) }
    }
    return cur
  }
}

let ULTIMO = { x: CX, y: CY }

cena(0, PLANO.tSai + PLANO.dTr + (PLANO.transicao === 'corte' ? 0 : 0.001), (root) => {
  const cam = camada(root, C.fundo)
  const mesa = el('div', { cls: 'abs', style: { width: px(W), height: px(H), transformOrigin: '0 0' } }, cam)
  const grupos = PLANO.grupos
  const m = RET ? L({ '9x16': 90, '1x1': 80, '4x5': 80 }) : Math.round(W * 0.075)
  // borda direita no retrato e no quadrado: no 9:16, antes da coluna de botões do Reels (x 940)
  const xR = RET ? L({ '9x16': 920, '1x1': 1000, '4x5': 1000 }) : W - m
  const topo = RET ? L({ '9x16': 270, '1x1': 80, '4x5': 90 }) : 84
  const fundoUtil = RET ? L({ '9x16': 1440, '1x1': 1010, '4x5': 1270 }) : 1000
  let titulo = null, yConteudo = topo
  let titPx = G.tit
  if (PARAMS.titulo) {
    titPx = Math.max(28, Math.min(G.tit, Math.floor(G.tit * (xR - m) / larg(PARAMS.titulo, fT(G.tit)))))
    titulo = linhaTexto(mesa, PARAMS.titulo, fT(titPx), COR.titulo, m, topo, 'title')
    yConteudo = topo + Math.round(titPx * 1.2 + G.tit * 0.5)
  }
  const cartoes = []
  let contador = null
  if (EST === 'colunas') {
    if (!RET) {
      const gap = Math.round(W * 0.03), w = Math.floor((W - 2 * m - gap) / 2)
      const txt = corpoQueEnche([Math.max(...grupos.map((g) => g.itens.length))], (fundoUtil - yConteudo) * 0.96, true)
      grupos.forEach((g, gi) => cartoes.push(cartaoGrupo(mesa, g, gi, w, m + gi * (w + gap), yConteudo, true, txt)))
      // as duas da mesma altura, centradas no espaço que sobra
      const hMax = Math.max(...cartoes.map((c) => c.h))
      const y0 = yConteudo + Math.max(0, (fundoUtil - yConteudo - hMax) / 2)
      cartoes.forEach((c) => { c.box.style.height = px(hMax); c.h = hMax; c.y = y0; c.box.style.top = px(y0) })
    } else {
      const txt = corpoQueEnche(grupos.map((g) => g.itens.length), fundoUtil - yConteudo, true)
      let y = yConteudo
      grupos.forEach((g, gi) => { const c = cartaoGrupo(mesa, g, gi, xR - m, m, y, true, txt); cartoes.push(c); y += c.h + 28 })
      if (y - 28 > fundoUtil + 1) console.error(`THE COLUMNS DO NOT FIT in ${FMT.replace('x', ':')}: they reach y ${Math.round(y - 28)} and the area ends at ${fundoUtil}. Shorten the lists (fewer items) or remove the title.`)
    }
  } else {
    const g = grupos[0], n = g.itens.length
    const w = RET ? xR - m : Math.round(W * 0.52)
    // contador grande: à direita do cartão (deitado) ou embaixo dele (retrato e quadrado)
    const grande = CONT && CONT.modo === 'total'
    const hRot = grande && CONT.rotulo ? G.contRot * 1.2 : 0
    const hCont = grande ? G.cont + (hRot ? 18 + hRot : 0) : 0
    const altCartao = RET ? fundoUtil - yConteudo - (grande ? hCont + 40 : 0) : (titulo ? fundoUtil - yConteudo : (SEGURA.y1 - SEGURA.y0) * 0.92)
    const c = cartaoGrupo(mesa, g, 0, w, m, 0, true, corpoQueEnche([n], altCartao, true))
    cartoes.push(c)
    const yCard = RET ? yConteudo : titulo ? yConteudo + Math.max(0, (fundoUtil - yConteudo - c.h) / 2) : Math.round((H - c.h) / 2)
    c.box.style.top = px(yCard); c.y = yCard
    if (RET && yCard + c.h + (grande ? 30 + hCont : 0) > fundoUtil + 1) console.error(`THE LIST DOES NOT FIT in ${FMT.replace('x', ':')}${grande ? ' with the counter below' : ''}: shorten the list, remove the title${grande ? ' or use "contador": false' : ''}.`)
    if (CONT && CONT.modo === 'total') {
      const box = el('div', { cls: 'abs', style: { whiteSpace: 'nowrap' } }, mesa)
      const num = el('span', { text: '0', style: { font: fT(G.cont), color: COR.contador, fontVariantNumeric: 'tabular-nums', lineHeight: '1' } }, box)
      const de = el('span', { text: ` ${DE} ${n}`, style: { font: fT(G.cont * 0.5), color: COR.contador, lineHeight: '1' } }, box)
      marcar(box, 'texto', 'counter')
      const wMax = larg(String(n), fT(G.cont)) + larg(` ${DE} ${n}`, fT(G.cont * 0.5))
      const rot = CONT.rotulo ? linhaTexto(mesa, CONT.rotulo, fT(G.contRot), COR.contador, 0, 0, 'counter label') : null
      const xC = RET ? (m + xR) / 2 : m + w + (W - m - (m + w)) / 2
      const yC = RET ? yCard + c.h + Math.max(30, (fundoUtil - yCard - c.h - hCont) / 2) : yCard + c.h / 2 - hCont / 2
      place(box, xC - wMax / 2, yC); box.style.width = px(wMax + 4); box.style.textAlign = 'center'
      if (rot) place(rot, xC - larg(CONT.rotulo, fT(G.contRot)) / 2, yC + G.cont + 18)
      contador = { box, num, de, rot, n, r: { x: xC - Math.max(wMax, rot ? larg(CONT.rotulo, fT(G.contRot)) : 0) / 2, y: yC, w: Math.max(wMax, rot ? larg(CONT.rotulo, fT(G.contRot)) : 0), h: hCont } }
    }
  }
  // o que a composição ocupa (a câmera enquadra isto)
  const rs = [...cartoes.map((c) => ({ x: c.x, y: c.y, w: c.w, h: c.h })), ...(contador ? [contador.r] : []),
    ...(titulo ? [{ x: m, y: parseFloat(titulo.style.top), w: larg(PARAMS.titulo, fT(titPx)), h: titPx * 1.2 }] : [])]
  const COMP = { x0: Math.min(...rs.map((r) => r.x)), y0: Math.min(...rs.map((r) => r.y)), x1: Math.max(...rs.map((r) => r.x + r.w)), y1: Math.max(...rs.map((r) => r.y + r.h)) }
  // as linhas em coordenadas da mesa (para a câmera e para o destaque)
  const itens = PLANO.marcas.map((mk) => {
    const c = cartoes[mk.g], ln = c.linhas[mk.k]
    return { ...mk, c, ln, r: { x: c.x, y: c.y + ln.yRow, w: c.w, h: ln.rh } }
  })
  // destaque: a faixa que corre para o item da vez (só se a marca der a cor)
  const destaque = COR.destaque && EST === 'lista' ? el('div', { cls: 'abs', style: { borderRadius: px(G.raio * 0.5), background: COR.destaque } }, cartoes[0].box) : null
  if (destaque) cartoes[0].box.insertBefore(destaque, cartoes[0].box.firstChild)

  // câmera
  // o centro da câmera é o da área segura na largura (no 9:16 do Reels, x 505, não 540): a composição fica nela
  const o = { x: (SEGURA.x0 + SEGURA.x1) / 2, y: CY }
  // a 12 px da área segura o esmaecer já começou: o que encosta na borda nunca fica opaco nela
  const lim = { x0: SEGURA.x0 + 12, y0: SEGURA.y0 + 12, x1: SEGURA.x1 - 12, y1: SEGURA.y1 - 12 }
  // a câmera centra a composição na largura (a mesma posição de repouso quando ela já está centrada)
  const cx = (COMP.x0 + COMP.x1) / 2
  // abertura: a câmera chega perto da composição (de 0,93 a 1) enquanto ela entra; o quadro 0 já está em movimento
  const chaves = [{ t: 0, cx, cy: o.y, z: 0.93 }, { t: 0, cx, cy: o.y, z: 1, dur: 1.6, ease: E.outCubic }]
  if (CAMERA === 'segue') {
    // perto do item da vez, com a composição inteira na largura da área (o contador continua à vista)
    const zFoco = PARAMS.zoom ?? 1.12
    const z = Math.max(1, Math.min(zFoco, (lim.x1 - lim.x0 - 24) / (COMP.x1 - COMP.x0)))
    // na altura, a câmera vai para o item da vez só até onde a composição inteira continua na área (o cartão nunca
    // é cortado pela borda); se ela não couber, segue o item
    const cyMin = COMP.y1 - (lim.y1 - o.y) / z, cyMax = COMP.y0 + (o.y - lim.y0) / z
    itens.forEach((it) => {
      const alvo = it.r.y + it.r.h / 2
      const cy = cyMin <= cyMax ? clamp(alvo, cyMin, cyMax) : clamp(alvo, o.y - 260, o.y + 260)
      chaves.push({ t: it.t - 0.45, cx, cy, z, dur: 0.55 })
    })
    chaves.push({ t: PLANO.marcas[PLANO.marcas.length - 1].t + 0.45, cx, cy: o.y, z: 1, dur: 0.7 })
  }
  const cameraEm = cameraChecklist(chaves)
  const creep = 0.004 * RESPIRO
  // a deriva lenta (o quadro nunca para) só até a composição encostar na área: nada sai pela borda por causa dela
  const zTeto = (s) => {
    const q = [(o.x - lim.x0) / (s.cx - COMP.x0), (lim.x1 - o.x) / (COMP.x1 - s.cx)]
    if (CAMERA === 'parada') q.push((o.y - lim.y0) / (s.cy - COMP.y0), (lim.y1 - o.y) / (COMP.y1 - s.cy))
    return Math.min(...q.filter((v) => v > 0 && Number.isFinite(v)))
  }
  const estado = (t) => { const s = cameraEm(t); return { ...s, z: Math.min(s.z * (1 + creep * t), Math.max(s.z, zTeto(s))) } }
  const naTela = (r, s) => ({ x0: (r.x - s.cx) * s.z + o.x, y0: (r.y - s.cy) * s.z + o.y, x1: (r.x + r.w - s.cx) * s.z + o.x, y1: (r.y + r.h - s.cy) * s.z + o.y })
  const rTitulo = titulo ? { x: m, y: parseFloat(titulo.style.top), w: larg(PARAMS.titulo, fT(titPx)), h: titPx * 1.2 } : null
  const visivel = (q) => clamp(1 - Math.max(0, lim.y0 - q.y0, q.y1 - lim.y1, lim.x0 - q.x0, q.x1 - lim.x1) / 50)
  { const s = estado(PLANO.tSai), q = contador ? naTela(contador.r, s) : naTela(itens[itens.length - 1].r, s); ULTIMO = { x: (q.x0 + q.x1) / 2, y: (q.y0 + q.y1) / 2 } }

  return (t) => {
    const s = estado(t)
    T(mesa, `translate(${o.x}px, ${o.y}px) scale(${s.z}) translate(${-s.cx}px, ${-s.cy}px)`)
    // entrada: título e cartões sobem já no quadro 0; os itens logo atrás
    if (titulo) { const k = E.outExpo(P(t, 0, 0.45)); O(titulo, visivel(naTela(rTitulo, s))); T(titulo, `translateY(${(1 - k) * 24}px)`) }
    cartoes.forEach((c, ci) => {
      const ke = E.outExpo(P(t, 0.04 + ci * 0.1, 0.7 + ci * 0.1))
      T(c.box, `translateY(${(1 - ke) * 80}px)`)
      // o cabeçalho (título e contador da coluna) esmaece sozinho quando a câmera o leva para fora da área
      const vc = c.cabR ? visivel(naTela({ x: c.x + c.cabR.x, y: c.y + c.cabR.y, w: c.cabR.w, h: c.cabR.h }, s)) : 1
      if (c.cab) O(c.cab, vc)
      if (c.contCol) O(c.contCol, vc)
      c.linhas.forEach((ln, k) => { const ki = E.outExpo(P(t, 0.2 + ci * 0.12 + k * 0.07, 0.65 + ci * 0.12 + k * 0.07)); O(ln.row, ki); T(ln.row, `translateY(${(1 - ki) * 30}px)`) })
    })
    // marcas: o círculo cheio cresce com mola, o traço se desenha, o ✕ risca o texto por trás
    let feitos = 0
    const porGrupo = cartoes.map(() => 0)
    for (const it of itens) {
      const sp = spring(t - it.t, 2.6, 0.55)
      T(it.ln.cheio, `scale(${t >= it.t ? 0.2 + 0.8 * sp : 0})`)
      it.ln.tracos.forEach((f, k) => f(E.inOutCubic(P(t, it.t + 0.08 + k * 0.12, it.t + 0.3 + k * 0.12))))
      if (it.ln.risco) T(it.ln.risco, `scaleX(${E.inOutCubic(P(t, it.t + 0.12, it.t + 0.45))})`)
      // a linha some quando a câmera a leva para fora da área (nada fica pela metade na borda)
      const vis = visivel(naTela(it.r, s))
      it.ln.row.style.opacity = String(Math.min(parseFloat(it.ln.row.style.opacity || 1), vis))
      if (quadroDe(t) >= it.t + 0.15) { feitos++; porGrupo[it.g]++ }
    }
    if (destaque) {
      const ativo = itens.filter((it) => t >= it.t - 0.35)
      const a = ativo.length ? ativo[ativo.length - 1] : itens[0], ia = itens.indexOf(a)
      const ant = itens[Math.max(0, ia - 1)]
      const k = E.inOutCubic(P(t, a.t - 0.35, a.t - 0.05))
      const yA = lerp(ant.ln.yRow, a.ln.yRow, ia ? k : 1)
      Object.assign(destaque.style, { left: px(G.padC * 0.45), top: px(yA - G.gapL * 0.3), width: px(a.c.w - G.padC * 0.9), height: px(a.ln.rh + G.gapL * 0.6) })
      O(destaque, P(t, itens[0].t - 0.45, itens[0].t - 0.3) * (1 - P(t, itens[itens.length - 1].t + 0.6, itens[itens.length - 1].t + 0.9)))
    }
    if (contador) {
      contador.num.textContent = String(feitos)
      const ult = itens.filter((it) => quadroDe(t) >= it.t + 0.15).pop()
      const pul = ult ? pulse(t - ult.t - 0.15, feitos === contador.n ? 0.12 : 0.06, 2.4, 7) : 1
      contador.box.style.transformOrigin = '50% 60%'
      T(contador.box, `scale(${pul})`)
      const vis = visivel(naTela(contador.r, s))
      O(contador.box, vis); if (contador.rot) O(contador.rot, vis)
    }
    cartoes.forEach((c, ci) => { if (c.contCol) c.contCol.textContent = `${porGrupo[ci]} ${DE} ${c.linhas.length}` })
    if (PLANO.transicao === 'push') TR.push.sai(cam, t, PLANO.tSai, PLANO.dTr, { dir: 'cima' })
  }
}, 'checklist')

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
