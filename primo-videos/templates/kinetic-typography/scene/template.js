/* Molde kinetic-typography: palavras grandes entram na batida da trilha, empilham, giram e se reorganizam, com as
 * formas da marca ao lado. Nada de marca aqui: cores, fonte, formas, logo e textos vêm de PARAMS, e a linha do tempo
 * (batidas, entradas, transições, o logo) vem pronta em LINHA; os dois são escritos pelo assemble.mjs.
 * Cada frase é uma cena com fundo próprio (camada); a passagem de uma para a outra é uma transição do motor (TR). */
const PR = PARAMS, LT = LINHA, FAM = PR.fonte.familia, NF = PR.frases.length
const MINIMO = PR.fonte.minimo || 64
const fonte = (peso, px_) => `${peso} ${px_}px "${FAM}"`
const _cv = document.createElement('canvas').getContext('2d')
const medir = (txt, peso, px_) => { _cv.font = fonte(peso, px_); return _cv.measureText(txt).width }

const AS = areaSegura()
const DEITADO = W / H > 1.2
const GAP = L({ '16x9': 56, '9x16': 44, padrao: 40 })
const TETO = L({ '16x9': 400, '9x16': 330, padrao: 300 })
const ZOOM = PR.camera === 'guided-zoom' ? 0.05 : 0
const FOLGA = (1 + ZOOM) * (1 + (PR.pulso || 0)) + 0.01   // o texto cresce na batida e no zoom: o espaço dele já desconta isso
const RAZAO = 2.4                            // a linha maior da pilha tem no máximo 2,4× o corpo da menor (× o "tamanho")
const ENTRE = 0.06                           // espaço entre linhas, em fração do corpo
const PILULA = { x: 0.42, y: 0.16 }          // respiro da pílula, em fração do corpo
const ENTRADAS = { calmo: ['sobe', 'gira'], medio: ['sobe', 'gira', 'desliza'], rapido: ['escala', 'desliza', 'gira'] }
const TAM_FORMA = { circulo: 0.42, pilula: 0.2, losango: 0.36, imagem: 1.15 }
const GIRA_FORMA = { imagem: 8, losango: 6, circulo: 0, pilula: 0 }
const POS_ZONA = [[0.55, 0.5], [0.25, 0.82], [0.82, 0.18], [0.8, 0.84]]
const POS_CANTO = [[1, 0], [0, 1], [1, 1], [0, 0]]

// ── onde fica o texto e onde ficam as formas ────────────────────────────────────────────────────────────────────────
function zonas() {
  const a = { x0: AS.x0 + 8, y0: AS.y0 + 8, x1: AS.x1 - 8, y1: AS.y1 - 8 }
  const w = a.x1 - a.x0, h = a.y1 - a.y0
  if (PR.leiaute === 'full-screen') {
    const zw = w * (DEITADO ? 0.8 : 1), zh = h * (DEITADO ? 0.86 : 0.78), cx = (a.x0 + a.x1) / 2, cy = (a.y0 + a.y1) / 2
    return { texto: { x0: cx - zw / 2, x1: cx + zw / 2, y0: cy - zh / 2, y1: cy + zh / 2 }, formas: null, alinhar: 'centro' }
  }
  const esq = PR.leiaute === 'left-column'
  if (DEITADO) {   // 16:9, 19:9, 21:9: o texto numa coluna, as formas na outra (sangrando pela borda)
    const tw = w * 0.58
    const texto = esq ? { x0: a.x0, x1: a.x0 + tw, y0: a.y0, y1: a.y1 } : { x0: a.x1 - tw, x1: a.x1, y0: a.y0, y1: a.y1 }
    const formas = esq ? { x0: texto.x1 + GAP, x1: W, y0: 0, y1: H } : { x0: 0, x1: texto.x0 - GAP, y0: 0, y1: H }
    return { texto, formas, alinhar: esq ? 'esquerda' : 'direita', lado: esq ? 'direita' : 'esquerda' }
  }
  // em pé (9:16, 1:1, 4:5): a coluna vira faixa; texto em cima e formas embaixo (right-column: o contrário)
  const th = h * 0.7
  const texto = esq ? { x0: a.x0, x1: a.x1, y0: a.y0, y1: a.y0 + th } : { x0: a.x0, x1: a.x1, y0: a.y1 - th, y1: a.y1 }
  const formas = esq ? { x0: 0, x1: W, y0: texto.y1 + GAP, y1: H } : { x0: 0, x1: W, y0: 0, y1: texto.y0 - GAP }
  return { texto, formas, alinhar: 'esquerda', lado: esq ? 'baixo' : 'cima' }
}
const Z = zonas()
// o espaço útil do texto: a zona menos o que o zoom e a batida fazem ele crescer
const UTIL = (() => {
  const z = Z.texto, dw = (z.x1 - z.x0) * (1 - 1 / FOLGA) / 2, dh = (z.y1 - z.y0) * (1 - 1 / FOLGA) / 2
  return { x0: z.x0 + dw, x1: z.x1 - dw, y0: z.y0 + dh, y1: z.y1 - dh }
})()

// ── medidas ─────────────────────────────────────────────────────────────────────────────────────────────────────────
const pesoDe = (l, p) => (p.destaque ? PR.fonte.pesoDestaque : l.peso)
const larg100 = (l) => l.partes.reduce((s, p) => s + medir(p.t, pesoDe(l, p), 100), 0) + (l.pilula ? 200 * PILULA.x : 0)
const altura = (l, fs) => fs * (l.pilula ? 1 + 2 * PILULA.y : 1)
const pequeno = (i, txt, fs) => console.error(`TEXT TOO SMALL: phrase ${i + 1}, "${txt}" ended up at ${Math.round(fs)} px (minimum ${MINIMO}): shorten the line or remove a line from the phrase`)

/** O corpo de cada linha: o que enche a largura útil (até o teto); depois a pilha inteira encolhe junto para caber. */
function corpos(linhas) {
  const zw = UTIL.x1 - UTIL.x0, zh = UTIL.y1 - UTIL.y0
  const cheio = linhas.map((l) => Math.min(TETO * (l.tamanho || 1), (100 * zw) / larg100(l)))
  const menor = Math.min(...cheio)
  const total = (fs) => fs.reduce((s, f, k) => s + altura(linhas[k], f) + (k ? ENTRE * Math.min(f, fs[k - 1]) : 0), 0)
  // se a pilha não cabe na altura, primeiro as linhas grandes chegam mais perto da menor (até 1,6×); só depois tudo encolhe
  let fs = cheio
  for (let r = RAZAO; r >= 1.6 - 1e-9; r -= 0.1) {
    fs = cheio.map((f, k) => Math.min(f, menor * r * (linhas[k].tamanho || 1)))
    if (total(fs) <= zh) break
  }
  const tot = total(fs)
  if (tot > zh) fs = fs.map((f) => (f * zh) / tot)
  return fs.map(Math.floor)
}

function linhaEl(pai, l, fs, cores) {
  const caixa = el('div', { cls: 'abs', style: { whiteSpace: 'nowrap' } }, pai)
  if (l.pilula) Object.assign(caixa.style, { background: cores.pilula.fundo })
  const cor = l.pilula ? cores.pilula.texto : cores.texto
  const corD = l.pilula ? cores.pilula.texto : cores.destaque || cores.texto
  const ln = textLine(caixa, l.partes.map((p) => ({ t: p.t, style: { fontWeight: pesoDe(l, p), color: p.destaque ? corD : cor } })),
    { position: 'relative', color: cor })
  const it = { l, caixa, ln }
  corpo(it, fs)
  return it
}
/** Põe o corpo na linha (e o respiro na pílula) e mede de novo. "font" zera a entrelinha: ela volta a 1 logo depois. */
function corpo(it, fs) {
  Object.assign(it.ln.line.style, { font: fonte(it.l.peso, fs), lineHeight: '1' })
  if (it.l.pilula) Object.assign(it.caixa.style, { borderRadius: px(fs), padding: `${fs * PILULA.y}px ${fs * PILULA.x}px` })
  const r = rectOf(it.caixa)
  Object.assign(it, { fs, w: r.w, h: r.h })
}
/** A altura medida de verdade manda: se a pilha passou da zona, tudo encolhe junto até caber. */
function caber(itens) {
  const zh = UTIL.y1 - UTIL.y0
  for (let n = 0; n < 4; n++) {
    const tot = itens.reduce((s, it, k) => s + it.h + (k ? ENTRE * Math.min(it.fs, itens[k - 1].fs) : 0), 0)
    if (tot <= zh) return
    const k = (zh / tot) * 0.995
    itens.forEach((it) => corpo(it, Math.floor(it.fs * k)))
  }
}

function alinharX(w, alinhar) { return alinhar === 'centro' ? (UTIL.x0 + UTIL.x1) / 2 - w / 2 : alinhar === 'direita' ? UTIL.x1 - w : UTIL.x0 }

/** A pilha: cada linha embaixo da outra, o bloco centrado na altura. */
function empilhar(itens) {
  const tot = itens.reduce((s, it, k) => s + it.h + (k ? ENTRE * Math.min(it.fs, itens[k - 1].fs) : 0), 0)
  let y = (UTIL.y0 + UTIL.y1) / 2 - tot / 2
  itens.forEach((it, k) => {
    if (k) y += ENTRE * Math.min(it.fs, itens[k - 1].fs)
    it.x = alinharX(it.w, Z.alinhar); it.y = y
    place(it.caixa, it.x, it.y)
    y += it.h
  })
}

/** "reorganiza": "linha" — as linhas da pilha viram uma linha só, no mesmo corpo, centrada na altura. */
function emLinha(itens, i) {
  const esp = medir(' ', 500, 100) * 1.1
  const w100 = itens.reduce((s, it) => s + (it.w / it.fs) * 100, 0) + esp * (itens.length - 1)
  const fs = Math.min(TETO * 0.6, (100 * (UTIL.x1 - UTIL.x0)) / w100)
  if (fs < MINIMO) pequeno(i, itens.map((it) => it.l.t).join(' '), fs)
  const larg = (w100 * fs) / 100
  let x = alinharX(larg, Z.alinhar)
  const cy = (UTIL.y0 + UTIL.y1) / 2
  return itens.map((it) => {
    const k = fs / it.fs, alvo = { x, y: cy - (it.h * k) / 2, k }
    x += it.w * k + (esp * fs) / 100
    return alvo
  })
}

const uniao = (rs) => ({ x0: Math.min(...rs.map((r) => r.x0)), y0: Math.min(...rs.map((r) => r.y0)), x1: Math.max(...rs.map((r) => r.x1)), y1: Math.max(...rs.map((r) => r.y1)) })
const afastar = (r, d) => ({ x0: r.x0 - d, y0: r.y0 - d, x1: r.x1 + d, y1: r.y1 + d })
function distRet(x, y, r) { const dx = Math.max(r.x0 - x, 0, x - r.x1), dy = Math.max(r.y0 - y, 0, y - r.y1); return Math.hypot(dx, dy) }

/** As formas da frase: na zona delas (coluna) ou nos cantos (tela cheia), sempre longe do texto. */
function formasEl(pai, lista, texto, i) {
  const base = Math.min(W, H)
  const longe = afastar(texto, GAP)
  return lista.map((s, k) => {
    const tam = (s.tamanho ?? TAM_FORMA[s.tipo]) * base
    const dims = (q) => (s.tipo === 'pilula' ? [q * 2.6, q] : s.tipo === 'losango' ? [q * 0.72, q * 0.72] : [q, q])
    // o raio que a forma ocupa, com o pulo da entrada e a batida (a forma cresce ~10% por um instante)
    const raio = (q) => { const [w, h] = dims(q); return 1.1 * (s.tipo === 'pilula' ? Math.hypot(w, h) / 2 : q / 2) }
    let q = tam, cx, cy
    if (Z.formas) {
      const zf = Z.formas, [fx, fy] = s.x != null ? [s.x, s.y ?? 0.5] : POS_ZONA[k % POS_ZONA.length]
      cx = zf.x0 + fx * (zf.x1 - zf.x0); cy = zf.y0 + fy * (zf.y1 - zf.y0)
      const R = raio(q)
      if (Z.lado === 'direita') cx = Math.max(cx, longe.x1 + R)
      if (Z.lado === 'esquerda') cx = Math.min(cx, longe.x0 - R)
      if (Z.lado === 'baixo') cy = Math.max(cy, longe.y1 + R)
      if (Z.lado === 'cima') cy = Math.min(cy, longe.y0 - R)
    } else {
      const [fx, fy] = s.x != null ? [s.x, s.y ?? 0] : POS_CANTO[(k + i) % POS_CANTO.length]
      cx = fx * W; cy = fy * H
      const d = distRet(cx, cy, longe)
      if (raio(q) > d) q *= d / raio(q)
      if (raio(q) < 60) return null   // não cabe sem encostar no texto: fica de fora
    }
    const [w, h] = dims(q)
    let e
    if (s.tipo === 'imagem') {
      // a caixa marcada não gira (o que a checagem mede é ela); quem gira é a imagem dentro dela
      e = el('div', { cls: 'abs', style: { width: px(w), height: px(h) } }, pai)
      e.__gira = imagem(e, s.arquivo, { width: '100%', height: '100%', objectFit: 'contain', transformOrigin: '50% 50%' })
      marcarImagem(e, `shape ${k + 1} of phrase ${i + 1}`)
    } else {
      e = el('div', { cls: 'abs', style: { width: px(w), height: px(h), background: s.cor, borderRadius: s.tipo === 'losango' ? px(w * 0.2) : px(Math.min(w, h) / 2) } }, pai)
    }
    place(e, cx - w / 2, cy - h / 2)
    e.style.transformOrigin = '50% 50%'
    const rot0 = s.angulo ?? (s.tipo === 'losango' ? 45 : s.tipo === 'pilula' ? -18 : 0)
    const R = raio(q)
    return { e, s, k, cx, cy, q, rot0, gira: s.gira ?? GIRA_FORMA[s.tipo], ret: { x0: cx - R, y0: cy - R, x1: cx + R, y1: cy + R } }
  }).filter(Boolean)
}

// ── tempo ───────────────────────────────────────────────────────────────────────────────────────────────────────────
const desdeBatida = (t) => t - Math.floor(t / LT.b + 1e-6) * LT.b
const batida = (t) => pulse(desdeBatida(t), 1, 2, 9) - 1   // 1 na batida, perto de 0 entre elas

const ORIGEM = []   // de onde a máscara da frase seguinte abre (o centro da maior forma desta)
const TRAN = { push: TR.push, whip: TR.whip, mascara: TR.mascara }
function opcoesTR(tipo, iAnterior) {
  if (tipo === 'push') return { dir: 'cima' }
  if (tipo === 'whip') return { dir: 'esquerda' }
  const o = ORIGEM[iAnterior] || { x: Z.formas ? (Z.formas.x0 + Z.formas.x1) / 2 : CX, y: CY }
  return { forma: 'circulo', x: clamp(o.x, 0, W), y: clamp(o.y, 0, H) }
}
function transicoes(cam, t, f) {
  if (f.entrada && f.entrada.dur > 0) TRAN[f.entrada.tipo].entra(cam, t, f.entrada.t0, f.entrada.dur, opcoesTR(f.entrada.tipo, f.i - 1))
  if (f.saida && f.saida.dur > 0 && f.saida.tipo !== 'mascara') TRAN[f.saida.tipo].sai(cam, t, f.saida.t0, f.saida.dur, opcoesTR(f.saida.tipo, f.i))
}

// ── as frases ───────────────────────────────────────────────────────────────────────────────────────────────────────
PR.frases.forEach((fr, i) => {
  const f = LT.frases[i]
  cena(f.t0, f.t1, (root) => {
    const cam = camada(root, fr.cores.fundo)
    const fundoFormas = el('div', { cls: 'layer' }, cam)
    const palco = el('div', { cls: 'layer' }, cam)
    const fs = corpos(fr.linhas)
    const itens = fr.linhas.map((l, k) => {
      const it = linhaEl(palco, l, fs[k], fr.cores)
      const ciclo = ENTRADAS[fr.ritmo || PR.ritmo] || ENTRADAS.medio
      it.entra = l.entra || (PR.entradas || ciclo)[(k + i) % (PR.entradas || ciclo).length]
      if (it.entra !== 'sobe') it.ln.words.forEach((w) => T(w.inner, 'none'))
      return it
    })
    caber(itens)
    itens.forEach((it, k) => { if (it.fs < MINIMO) pequeno(i, fr.linhas[k].t.replace(/\*/g, ''), it.fs) })
    empilhar(itens)
    const alvos = fr.reorganiza === 'linha' ? emLinha(itens, i) : null
    const rs = itens.map((it) => ({ x0: it.x, y0: it.y, x1: it.x + it.w, y1: it.y + it.h }))
    if (alvos) itens.forEach((it, k) => rs.push({ x0: alvos[k].x, y0: alvos[k].y, x1: alvos[k].x + it.w * alvos[k].k, y1: alvos[k].y + it.h * alvos[k].k }))
    const bloco = uniao(rs)
    const cxB = (bloco.x0 + bloco.x1) / 2, cyB = (bloco.y0 + bloco.y1) / 2
    const ocupa = afastar(bloco, Math.max(bloco.x1 - bloco.x0, bloco.y1 - bloco.y0) * (FOLGA - 1) / 2)
    const formas = formasEl(fundoFormas, fr.formas || [], ocupa, i)
    const maior = formas.slice().sort((a, b) => b.q - a.q)[0]
    ORIGEM[i] = maior ? { x: maior.cx, y: maior.cy } : { x: cxB, y: cyB }
    palco.style.transformOrigin = `${cxB}px ${cyB}px`
    // "gira" balança a linha para o lugar, pendurada no canto de baixo; se o balanço passaria por uma forma, ela vira
    // de frente (rotateX), sem sair da própria caixa
    const dyMax = itens.slice(1).reduce((s, it, k) => s + (it.h + ENTRE * Math.min(it.fs, itens[k].fs)) / 2, 0)
    itens.forEach((it) => {
      if (it.entra !== 'gira') return
      const R = Math.hypot(it.w, it.h), varre = { x0: it.x - it.h, x1: it.x + R, y0: it.y, y1: it.y + it.h + R + dyMax }
      it.vira = formas.some((s) => s.ret.x0 < varre.x1 && s.ret.x1 > varre.x0 && s.ret.y0 < varre.y1 && s.ret.y1 > varre.y0)
    })

    return (t) => {
      transicoes(cam, t, f)
      // a pilha se recentra a cada linha que entra (a de cima sobe para dar lugar à nova)
      let dy = 0
      for (let k = 1; k < itens.length; k++) dy += ((itens[k].h + ENTRE * Math.min(itens[k].fs, itens[k - 1].fs)) / 2) * (1 - E.outCubic(P(t, f.entradas[k], f.entradas[k] + f.entraDur * 1.2)))
      T(palco, `translateY(${dy.toFixed(2)}px)` + (ZOOM ? ` scale(${(1 + ZOOM * E.inOutSine(P(t, f.t0, f.t1))).toFixed(4)})` : ''))
      itens.forEach((it, k) => {
        const tE = f.entradas[k], d = f.entraDur, u = P(t, tE, tE + d), w = it.w, h = it.h
        let tx = 0, ty = 0, sc = 1, rot = 0, flip = 0, op = t < tE ? 0 : 1, blur = 0
        if (it.entra === 'sobe') { riseWords(it.ln.words, t, tE, 0.05, d); if (it.l.pilula) op = E.outCubic(P(t, tE, tE + 0.12)) }
        else if (it.entra === 'gira' && it.vira) { flip = 90 * (1 - E.outQuart(u)); op = P(t, tE, tE + 0.06) }
        else if (it.entra === 'gira') { rot = 90 * (1 - E.outQuart(u)); op = P(t, tE, tE + 0.06) }   // de baixo para cima: não passa pela linha de cima
        else if (it.entra === 'escala') { sc = lerp(1.45, 1, E.outExpo(u)); op = E.outCubic(P(t, tE, tE + 0.1)) }
        else if (it.entra === 'desliza') { const e = E.outExpo(u); tx = (k % 2 ? 1 : -1) * W * 0.45 * (1 - e); blur = 14 * (1 - e) ** 2; op = P(t, tE, tE + 0.05) }
        let sR = 1
        if (alvos) {
          const r = E.inOutCubic(P(t, f.tReorg + k * 0.04, f.tReorg + 0.6 + k * 0.04))
          tx += (alvos[k].x - it.x) * r; ty += (alvos[k].y - it.y) * r; sR = lerp(1, alvos[k].k, r)
        }
        if (t > tE + d && PR.pulso) sc *= 1 + PR.pulso * batida(t - k * 0.03)
        const partes = [`translate(${tx.toFixed(2)}px, ${ty.toFixed(2)}px)`]
        if (sR !== 1) partes.push(`scale(${sR.toFixed(4)})`)
        if (sc !== 1) partes.push(`translate(${w / 2}px, ${h / 2}px) scale(${sc.toFixed(4)}) translate(${-w / 2}px, ${-h / 2}px)`)
        if (rot) partes.push(`translate(0px, ${h}px) rotate(${rot.toFixed(3)}deg) translate(0px, ${-h}px)`)
        if (flip) partes.push(`translate(${w / 2}px, ${h}px) perspective(${Math.max(1200, 4 * w)}px) rotateX(${flip.toFixed(3)}deg) translate(${-w / 2}px, ${-h}px)`)
        it.caixa.style.transformOrigin = '0 0'
        T(it.caixa, partes.join(' '))
        O(it.caixa, op)
        it.caixa.style.filter = blur > 0.3 ? `blur(${blur.toFixed(2)}px)` : 'none'
      })
      formas.forEach((s) => {
        const te = (i === 0 ? -0.3 : f.t0) + s.k * LT.b / 2
        const sc = spring(t - te, 1.6, 0.6) * (1 + 0.035 * batida(t))
        const bob = Math.sin((t + s.k) * 1.4) * s.q * 0.025
        const rot = s.rot0 + s.gira * (t - f.t0)
        if (s.e.__gira) { T(s.e, `translateY(${bob.toFixed(2)}px) scale(${Math.max(0, sc).toFixed(4)})`); T(s.e.__gira, `rotate(${rot.toFixed(3)}deg)`) }
        else T(s.e, `translateY(${bob.toFixed(2)}px) rotate(${rot.toFixed(3)}deg) scale(${Math.max(0, sc).toFixed(4)})`)
      })
    }
  }, `phrase ${i + 1}`)
})

// ── o fecho: só o logo, centrado, entrando e parado ─────────────────────────────────────────────────────────────────
cena(LT.fecho.t0, LT.duracao + 0.001, (root) => {
  const cam = camada(root, PR.fecho.fundo)
  const lw = PR.fecho.largura || L({ '16x9': 620, '9x16': 640, padrao: 560 })
  const caixa = el('div', { cls: 'layer', style: { display: 'flex', alignItems: 'center', justifyContent: 'center' } }, cam)
  marcar(imagem(caixa, PR.fecho.logo, { position: 'relative', width: px(lw) }), 'logo', 'logo')
  const ent = LT.fecho.entrada
  return (t) => {
    if (ent.dur > 0) TRAN[ent.tipo].entra(cam, t, ent.t0, ent.dur, opcoesTR(ent.tipo, NF - 1))
    const u = E.outCubic(P(t, LT.fecho.tLogo, LT.fecho.tLogo + 0.45))
    O(caixa, u); T(caixa, `translateY(${((1 - u) * 36).toFixed(2)}px)`)
  }
}, 'closing')
