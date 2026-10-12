// Molde rolling-list: novidades sem índice. Item = frase curta + prova de tela (interface redesenhada grande).
// Tudo o que é da marca vem de PARAMS (cores, fontes, logo, textos, telas, números). Nada aqui é de uma marca.
// Ordem: fundo (luz que anda) → abertura (promessa no quadro 0) → itens → muro → fecho → legenda por cima.

const M = PARAMS.marca
const IDIOMA = PARAMS.idioma || 'en-US', PT = /^pt/i.test(IDIOMA)
// marca.plano: cor chapada, sem sombra no painel, sem contorno e sem a vinheta do fundo
const PLANO_COR = M.plano === true
const C = {
  apoio: rgba(M.cores.texto, 0.66), apagado: rgba(M.cores.texto, 0.4), linha: PLANO_COR ? 'transparent' : rgba(M.cores.texto, 0.13),
  tinta: M.cores.fundo, ok: M.cores.destaque, pino: '#ffffff', ...M.cores,
}
const CLARO = M.tema === 'claro'
const FT = M.fontes.titulo, FX = M.fontes.texto, FM = M.fontes.mono || M.fontes.texto
const fT = (s, w = M.pesoTitulo || 700) => `${w} ${s}px "${FT}"`
const fX = (s, w = 400) => `${w} ${s}px "${FX}"`
const fM = (s, w = 600) => `${w} ${s}px "${FM}"`
const caixa = (s) => (M.caixaAlta ? String(s).toLocaleUpperCase(IDIOMA) : String(s))
const INCLINA = M.inclina || 0
const VEL = PLANO.velocidade
const PALETA = (M.paleta && M.paleta.length) ? M.paleta : [C.destaque]
// respira: a abertura e o painel da prova crescem devagar o trecho inteiro (a câmera que respira), para nada ficar
// parado quando a prova termina antes do corte
const RESPIRA = PARAMS.respira === true
const respiro = (tl, d, k) => (RESPIRA ? ` scale(${1 + k * clamp(tl, 0, d)})` : '')   // k = quanto cresce por segundo

const RET = W / H < 1.1   // retrato ou quadrado: empilha em vez de pôr lado a lado
// Horizontal (16:9, 19:9, 21:9): margem, painel, faixa e bloco do cartaz em fração da largura (no 16:9 dá os números
// de sempre); corpo de letra e alturas dependem só da altura, que é 1080 nos três. Nos largos, a legenda e as
// pílulas do muro ficam dentro da área segura de 5% (a legenda sobe 38 px, e o painel e a faixa sobem 24 px para
// ela não encostar na frase); no 16:9 ficam onde sempre estiveram.
function leiauteHorizontal() {
  const largo = W > 1920
  const m = Math.round(W / 16), pnx = Math.round((W * 200) / 1920), bx = Math.round((W * 1240) / 1920)
  return { m, painel: { x: pnx, y: 56, w: W - 2 * pnx, h: largo ? 706 : 730 }, faixa: { x: m, y: largo ? 794 : 818, w: W - 2 * m, h: 160 }, leg: { y: largo ? 966 : 1004, px: 38 },
    frase: 76, linhas: 1, badge: 96, etq: 26, cartaz: 118, bloco: { x: bx, y: 0, w: W - bx, h: 1080 }, muroX: largo ? Math.ceil(W * 0.05) : m / 2 }
}
const LAY = HORIZONTAL ? leiauteHorizontal() : L({
  '9x16': { m: 90, painel: { x: 60, y: 250, w: 960, h: 900 }, faixa: { x: 90, y: 1190, w: 900, h: 310 }, leg: { y: 1580, px: 44 },
            frase: 84, linhas: 2, badge: 96, etq: 28, cartaz: 112, bloco: { x: 0, y: 760, w: 1080, h: 420 } },
  '1x1': { m: 80, painel: { x: 70, y: 56, w: 940, h: 630 }, faixa: { x: 80, y: 716, w: 920, h: 220 }, leg: { y: 978, px: 34 },
           frase: 60, linhas: 2, badge: 76, etq: 22, cartaz: 92, bloco: { x: 0, y: 420, w: 1080, h: 290 } },
  '4x5': { m: 80, painel: { x: 70, y: 70, w: 940, h: 800 }, faixa: { x: 80, y: 900, w: 920, h: 240 }, leg: { y: 1214, px: 36 },
           frase: 66, linhas: 2, badge: 84, etq: 24, cartaz: 100, bloco: { x: 0, y: 540, w: 1080, h: 340 } },
})

// ---------- utilidades ----------
const num = (v, casas = 0) => {
  const [i, d] = Math.abs(v).toFixed(casas).split('.')
  return (v < 0 ? '−' : '') + i.replace(/\B(?=(\d{3})+(?!\d))/g, PT ? '.' : ',') + (d ? (PT ? ',' : '.') + d : '')
}
// Texto que muda (número contando) fica preso ao quadro de 60 fps: nos subquadros do motion blur ele não pode
// trocar, senão os dígitos viram fantasma.
const qd = (tl) => Math.floor(tl * 60 + 1e-4) / 60
const div = (parent, style = {}, text) => el('div', { cls: 'abs', style, ...(text != null ? { text } : {}) }, parent)
const flex = (parent, style = {}) => el('div', { style: { display: 'flex', ...style } }, parent)
const entra = (e, tl, t0, d = 0.3, dy = 24) => { const k = E.outExpo(P(tl, t0, t0 + d)); O(e, k); T(e, `translateY(${(1 - k) * dy}px)`); return k }
// Encolhe o corpo da fonte até a linha caber em maxW (o motor já esperou as fontes: medir aqui é seguro).
function cabe(line, maxW, tam, min = tam * 0.6) {
  let s = tam
  line.style.fontSize = px(s)
  while (rectOf(line).w > maxW && s > min) { s -= 2; line.style.fontSize = px(s) }
  return s
}
// Quebra uma frase em até n linhas equilibradas (por palavra).
function quebra(texto, n) {
  const ws = texto.split(' ')
  if (n <= 1 || ws.length < 2) return [texto]
  let melhor = [texto], pior = Infinity
  for (let k = 1; k < ws.length; k++) {
    const a = ws.slice(0, k).join(' '), b = ws.slice(k).join(' ')
    const m = Math.max(a.length, b.length)
    if (m < pior) { pior = m; melhor = [a, b] }
  }
  return melhor
}
// Anel de toque: o "dedo" que mostra onde a ação acontece.
function anel(parent, u) {
  const r = el('div', { cls: 'abs', style: { width: px(u * 8), height: px(u * 8), marginLeft: px(-u * 4), marginTop: px(-u * 4), borderRadius: '50%', border: `${Math.max(3, u * 0.5)}px solid ${C.destaque}`, opacity: 0, zIndex: 5 } }, parent)
  const d = el('div', { cls: 'abs', style: { width: px(u * 3.4), height: px(u * 3.4), marginLeft: px(-u * 1.7), marginTop: px(-u * 1.7), borderRadius: '50%', background: rgba(C.texto, 0.85), opacity: 0, zIndex: 5 } }, parent)
  return (tl, t0, x, y) => {
    for (const e of [r, d]) { e.style.left = px(x); e.style.top = px(y) }
    const k = P(tl, t0, t0 + 0.5)
    O(r, k > 0 && k < 1 ? 1 - k : 0); T(r, `scale(${0.3 + k * 1.1})`)
    const kd = P(tl, t0 - 0.25, t0) * (1 - P(tl, t0 + 0.2, t0 + 0.45))
    O(d, kd * 0.9); T(d, `scale(${1 - 0.2 * P(tl, t0 - 0.05, t0)})`)
  }
}
const centro = (e, base) => { const a = rectOf(e), b = rectOf(base); return [a.cx - b.x, a.cy - b.y] }

// ---------- provas: a interface redesenhada, grande, só com o que o item precisa ----------
// Cada uma: (corpo, prova, { w, h, u }) → (tl, d) com tl = segundos desde que a prova apareceu e d = quanto ela fica.
const PROVA = {}

PROVA.grade = (b, p, { w, h, u }) => {
  const land = w / h > 1.25, pad = u * 3.4
  const area = div(b, { left: px(pad), top: px(pad), width: px(land ? w * 0.66 - pad : w - 2 * pad), height: px(land ? h - 2 * pad : h * 0.68 - pad) })
  const cols = p.colunas || (land ? 4 : 3)
  const itens = p.itens.slice(0, cols * 2)
  const grid = el('div', { style: { display: 'grid', gridTemplateColumns: `repeat(${cols}, 1fr)`, gridAutoRows: '1fr', gap: px(u * 2), width: '100%', height: '100%' } }, area)
  const tiles = itens.map((it) => {
    const tile = flex(grid, { flexDirection: 'column', gap: px(u * 1.1), minHeight: 0 })
    const arte = el('div', { style: { flex: '1', borderRadius: px(u * 1.6), background: `linear-gradient(160deg, ${it.cor}, ${it.cor2 || it.cor})`, position: 'relative', overflow: 'hidden', boxShadow: `inset 0 0 0 2px ${C.linha}` } }, tile)
    div(arte, { left: '12%', top: '16%', width: '56%', height: '13%', borderRadius: px(u), background: it.tinta || rgba('#ffffff', 0.85) })
    div(arte, { left: '12%', top: '38%', width: '34%', height: '7%', borderRadius: px(u), background: rgba(it.tinta || '#ffffff', 0.5) })
    div(arte, { left: '12%', bottom: '14%', top: 'auto', width: '26%', height: '14%', borderRadius: px(u * 2), background: it.botao || rgba('#ffffff', 0.6) })
    el('div', { text: it.nome, style: { font: fX(Math.round(u * 3.3), 600), color: C.texto, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' } }, tile)
    return { tile, arte }
  })
  const sel = Math.min(p.selecionado || 0, tiles.length - 1)
  let cont
  if (p.contador) {
    const box = land ? div(b, { left: px(w * 0.66 + pad * 0.5), top: px(pad), width: px(w * 0.34 - pad * 1.5), height: px(h - 2 * pad) })
      : div(b, { left: px(pad), top: px(h * 0.68 + pad * 0.4), width: px(w - 2 * pad), height: px(h * 0.32 - pad * 1.4) })
    const col = flex(box, { flexDirection: land ? 'column' : 'row', alignItems: land ? 'flex-start' : 'center', justifyContent: 'center', gap: px(u * (land ? 0.6 : 3)), width: '100%', height: '100%', borderRadius: px(u * 2), background: C.campo, padding: `0 ${px(u * 3.4)}`, boxSizing: 'border-box' })
    const n = el('div', { text: num(p.contador.ate), style: { font: fT(Math.round(u * (land ? 17 : 13))), color: C.destaque, lineHeight: '1' } }, col)
    el('div', { text: p.contador.rotulo, style: { font: fX(Math.round(u * 3.8), 500), color: C.texto, lineHeight: '1.15', maxWidth: px(land ? w * 0.28 : w * 0.5) } }, col)
    cont = { n, de: p.contador.de || 0, ate: p.contador.ate }
  }
  const toque = anel(b, u)
  let alvo = null
  return (tl, d) => {
    const q = Math.min(1, d / 2.4)
    tiles.forEach((x, i) => entra(x.tile, tl, i * 0.04 * q, 0.3 * q, u * 3))
    if (!alvo) alvo = centro(tiles[sel].arte, b)
    const tSel = 0.75 * q
    toque(tl, tSel, alvo[0], alvo[1])
    const on = tl >= tSel
    tiles[sel].arte.style.outline = on ? `${Math.max(4, u * 0.6)}px solid ${C.destaque}` : 'none'
    tiles[sel].arte.style.outlineOffset = px(u * 0.4)
    T(tiles[sel].arte, `scale(${on ? 1 + 0.05 * (1 - E.outCubic(P(tl, tSel, tSel + 0.4))) : 1})`)
    if (cont) cont.n.textContent = num(lerp(cont.de, cont.ate, E.outCubic(P(qd(tl), 0.35 * q, 1.7 * q))))
  }
}

PROVA.paleta = (b, p, { w, h, u }) => {
  const land = w / h > 1.25, pad = u * 3.4
  const lista = div(b, land ? { left: px(pad), top: px(pad), width: px(w * 0.52 - pad), height: px(h - 2 * pad) } : { left: px(pad), top: px(h * 0.5), width: px(w - 2 * pad), height: px(h * 0.5 - pad) })
  const col = flex(lista, { flexDirection: 'column', justifyContent: 'center', gap: px(u * 1.6), width: '100%', height: '100%' })
  const linhas = p.paletas.map((pl) => {
    const row = flex(col, { alignItems: 'center', gap: px(u * 2), padding: `${px(u * 1.4)} ${px(u * 2.2)}`, borderRadius: px(u * 1.8), background: C.campo, boxShadow: `inset 0 0 0 2px ${C.linha}` })
    el('div', { text: pl.nome, style: { font: fX(Math.round(u * 3.6), 600), color: C.texto, flex: '1', whiteSpace: 'nowrap' } }, row)
    for (const c of pl.cores) el('div', { style: { width: px(u * 5.4), height: px(u * 5.4), borderRadius: '50%', background: c, boxShadow: `0 0 0 2px ${C.linha}` } }, row)
    return row
  })
  const pv = div(b, land ? { left: px(w * 0.56), top: px(pad), width: px(w * 0.44 - pad), height: px(h - 2 * pad) } : { left: px(pad), top: px(pad), width: px(w - 2 * pad), height: px(h * 0.5 - pad * 1.6) })
  Object.assign(pv.style, { borderRadius: px(u * 2.4), overflow: 'hidden', boxShadow: `0 0 0 2px ${C.linha}` })
  const pvTopo = div(pv, { left: 0, top: 0, width: '100%', height: '22%' })
  const pvT1 = div(pv, { left: '9%', top: '33%', width: '62%', height: '13%', borderRadius: px(u) })
  const pvT2 = div(pv, { left: '9%', top: '53%', width: '40%', height: '7%', borderRadius: px(u) })
  const pvBt = div(pv, { left: '9%', top: '72%', width: '34%', height: '14%', borderRadius: px(u * 4) })
  const pinta = (pl) => { const [f, s, t, d] = pl.previa || pl.cores; pv.style.background = f; pvTopo.style.background = s; pvT1.style.background = t; pvT2.style.background = rgba(t, 0.55); pvBt.style.background = d }
  const toque = anel(b, u)
  const alvos = []
  const ordem = p.ordem || p.paletas.map((_, i) => i)
  return (tl, d) => {
    const q = Math.min(1, d / 2.4)
    if (!alvos.length) linhas.forEach((r) => alvos.push(centro(r, b)))
    linhas.forEach((r, i) => entra(r, tl, i * 0.05 * q, 0.3 * q, u * 3))
    entra(pv, tl, 0, 0.35 * q, u * 3)
    const passo = 0.62 * q, t0 = 0.45 * q
    const k = Math.max(0, Math.min(ordem.length - 1, Math.floor((tl - t0) / passo)))
    const idx = tl < t0 ? ordem[0] : ordem[k]
    pinta(p.paletas[idx])
    linhas.forEach((r, i) => { r.style.boxShadow = `inset 0 0 0 ${i === idx ? Math.max(3, u * 0.5) : 2}px ${i === idx ? C.destaque : C.linha}` })
    const tk = t0 + k * passo
    if (tl >= t0) toque(tl, tk, alvos[idx][0] + (land ? u * 12 : u * 20), alvos[idx][1])
    T(pv, `${pv.style.transform || ''} scale(${1 + 0.035 * (1 - E.outCubic(P(tl, tk, tk + 0.35)))})`)
  }
}

PROVA.numeros = (b, p, { w, h, u }) => {
  const land = w / h > 1.25, pad = u * 3.4
  const cards = div(b, land ? { left: px(pad), top: px(pad), width: px(w * 0.46 - pad), height: px(h - 2 * pad) } : { left: px(pad), top: px(pad), width: px(w - 2 * pad), height: px(h * 0.42 - pad) })
  const lin = flex(cards, { flexDirection: land ? 'column' : 'row', gap: px(u * 2), width: '100%', height: '100%' })
  const cs = p.cartoes.map((c) => {
    const card = flex(lin, { flex: '1', flexDirection: 'column', justifyContent: 'center', gap: px(u * 0.8), padding: `0 ${px(u * 3)}`, borderRadius: px(u * 2), background: C.campo, boxShadow: `inset 0 0 0 2px ${C.linha}` })
    el('div', { text: c.rotulo, style: { font: fX(Math.round(u * 3.6), 500), color: C.apoio } }, card)
    const n = el('div', { text: num(c.valor), style: { font: fT(Math.round(u * 10)), color: C.texto, lineHeight: '1' } }, card)
    return { card, n, v: c.valor }
  })
  const tot = div(b, land ? { left: px(w * 0.5), top: px(pad), width: px(w * 0.5 - pad), height: px(h - 2 * pad) } : { left: px(pad), top: px(h * 0.42 + pad * 0.4), width: px(w - 2 * pad), height: px(h * 0.58 - pad * 1.4) })
  const tc = flex(tot, { flexDirection: 'column', justifyContent: 'center', alignItems: 'center', width: '100%', height: '100%' })
  el('div', { text: p.total.rotulo, style: { font: fX(Math.round(u * 4.2), 600), color: C.texto } }, tc)
  const tn = el('div', { text: num(p.total.valor), style: { font: fT(Math.round(u * (land ? 22 : 20))), color: C.destaque, lineHeight: '1.05' } }, tc)
  return (tl, d) => {
    const q = Math.min(1, d / 2.4)
    cs.forEach((c, i) => { entra(c.card, tl, i * 0.06 * q, 0.3 * q, u * 3); c.n.textContent = num(lerp(0, c.v, E.outCubic(P(qd(tl), 0.2 * q, 1.1 * q)))) })
    entra(tot, tl, 0.5 * q, 0.35 * q, u * 3)
    tn.textContent = num(lerp(0, p.total.valor, E.outCubic(P(qd(tl), 0.7 * q, 1.8 * q))))
  }
}

PROVA.campo = (b, p, { w, h, u }) => {
  const pad = u * 5
  const col = flex(div(b, { left: px(pad), top: px(pad * 0.6), width: px(w - 2 * pad), height: px(h - pad * 1.2) }), { flexDirection: 'column', justifyContent: 'center', gap: px(u * 2), width: '100%', height: '100%' })
  el('div', { text: p.rotulo, style: { font: fX(Math.round(u * 4.6), 600), color: C.texto } }, col)
  if (p.dica) el('div', { text: p.dica, style: { font: fX(Math.round(u * 3.4)), color: C.apoio } }, col)
  const caixaC = el('div', { style: { position: 'relative', height: px(u * 12), borderRadius: px(u * 2), background: C.campo, boxShadow: `inset 0 0 0 2px ${C.linha}`, overflow: 'hidden' } }, col)
  const sujo = div(caixaC, { left: px(u * 3), top: '50%', right: px(u * 3), font: fM(Math.round(u * 3.6), 500), color: C.apoio, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', transform: 'translateY(-50%)' }, p.de)
  const limpo = div(caixaC, { left: px(u * 3), top: '50%', font: fX(Math.round(u * 5.4), 600), color: C.texto, whiteSpace: 'nowrap' }, p.para)
  const ok = div(caixaC, { left: 'auto', right: px(u * 3), top: '50%', width: px(u * 6.4), height: px(u * 6.4), marginTop: px(-u * 3.2), borderRadius: '50%', background: C.ok, color: C.tinta, font: fX(Math.round(u * 4), 700), display: 'flex', alignItems: 'center', justifyContent: 'center' }, '✓')
  let res
  if (p.resultado) res = el('div', { text: p.resultado, style: { alignSelf: 'flex-start', font: fX(Math.round(u * 3.6), 600), color: C.tinta, background: C.destaque, borderRadius: px(u * 4), padding: `${px(u * 1.2)} ${px(u * 2.6)}` } }, col)
  return (tl, d) => {
    const q = Math.min(1, d / 2.4), tv = 0.9 * q
    entra(col, tl, 0, 0.3 * q, u * 3)
    const k = E.outExpo(P(tl, tv, tv + 0.35 * q))
    O(sujo, 1 - k); T(sujo, `translateY(-50%) translateX(${-k * u * 6}px)`)
    O(limpo, k); T(limpo, `translateY(-50%) translateX(${(1 - k) * u * 6}px)`)
    O(ok, k); T(ok, `scale(${0.4 + 0.6 * E.outBack(P(tl, tv + 0.1, tv + 0.45))})`)
    caixaC.style.boxShadow = `inset 0 0 0 ${tl >= tv ? Math.max(3, u * 0.5) : 2}px ${tl >= tv ? C.destaque : C.linha}`
    if (res) entra(res, tl, tv + 0.4 * q, 0.3 * q, u * 2)
  }
}

PROVA.lista = (b, p, { w, h, u }) => {
  const pad = u * 4.4
  const col = flex(div(b, { left: px(pad), top: px(pad * 0.6), width: px(w - 2 * pad), height: px(h - pad * 1.2) }), { flexDirection: 'column', justifyContent: 'center', gap: px(u * 1.8), width: '100%', height: '100%' })
  const rows = p.linhas.map((ln) => {
    const r = flex(col, { alignItems: 'center', gap: px(u * 2.4), padding: `${px(u * 1.7)} ${px(u * 2.6)}`, borderRadius: px(u * 1.8), background: C.campo })
    const ck = el('div', { text: '✓', style: { width: px(u * 5.6), height: px(u * 5.6), flex: 'none', borderRadius: '50%', background: C.ok, color: C.tinta, font: fX(Math.round(u * 3.4), 700), display: 'flex', alignItems: 'center', justifyContent: 'center' } }, r)
    const tx = typeof ln === 'string' ? { t: ln } : ln
    el('div', { text: tx.t, style: { font: fX(Math.round(u * 4.2), 600), color: tx.destaque ? C.destaque : C.texto, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' } }, r)
    return { r, ck }
  })
  return (tl, d) => {
    const q = Math.min(1, d / 2.4)
    rows.forEach((x, i) => { const t0 = (0.15 + i * 0.32) * q; entra(x.r, tl, t0, 0.3 * q, u * 3); T(x.ck, `scale(${E.outBack(P(tl, t0 + 0.15 * q, t0 + 0.45 * q))})`) })
  }
}

PROVA.foto = (b, p, { w, h, u }) => {
  const im = imagem(b, p.src, { width: px(w), height: px(h), objectFit: 'cover', objectPosition: p.posicao || '50% 30%' })
  div(b, { width: px(w), height: px(h), background: `linear-gradient(180deg, transparent 45%, ${rgba('#000000', 0.6)})` })
  let tit
  if (p.titulo) tit = div(b, { left: px(u * 4), top: 'auto', bottom: px(u * 4), font: fT(Math.round(u * (p.tituloTam || 15))), color: p.corTitulo || '#ffffff', lineHeight: '1', whiteSpace: 'nowrap', letterSpacing: '0.02em' }, caixa(p.titulo))
  const chips = flex(div(b, { left: px(u * 4), top: px(u * 4), width: px(w - u * 8) }), { gap: px(u * 1.4), flexWrap: 'wrap' })
  const cs = (p.chips || []).map((c, i) => el('div', { text: c, style: { font: fX(Math.round(u * 3.4), 600), color: i === (p.chipAtivo ?? 0) ? C.tinta : C.texto, background: i === (p.chipAtivo ?? 0) ? C.destaque : rgba(C.superficie, 0.86), borderRadius: px(u * 4), padding: `${px(u * 1.2)} ${px(u * 2.6)}` } }, chips))
  return (tl, d) => {
    const q = Math.min(1, d / 2.4)
    kenBurns(im, tl, 0, d, [1.0, 50, 35], [1.1, 50, 30])
    if (tit) entra(tit, tl, 0.25 * q, 0.4 * q, u * 4)
    cs.forEach((c, i) => entra(c, tl, (0.5 + i * 0.25) * q, 0.3 * q, u * 2))
  }
}

PROVA.interruptores = (b, p, { w, h, u }) => {
  const pad = u * 4.4
  const col = flex(div(b, { left: px(pad), top: px(pad * 0.6), width: px(w - 2 * pad), height: px(h - pad * 1.2) }), { flexDirection: 'column', justifyContent: 'center', gap: px(u * 1.6), width: '100%', height: '100%' })
  const rows = p.itens.map((it) => {
    const r = flex(col, { alignItems: 'center', gap: px(u * 2), padding: `${px(u * 1.6)} ${px(u * 2.6)}`, borderRadius: px(u * 1.8), background: C.campo })
    el('div', { text: it.nome, style: { font: fX(Math.round(u * 4), 600), color: C.texto, flex: '1', whiteSpace: 'nowrap' } }, r)
    const tr = el('div', { style: { position: 'relative', width: px(u * 10), height: px(u * 5.6), borderRadius: px(u * 3), flex: 'none' } }, r)
    const kn = div(tr, { top: px(u * 0.6), width: px(u * 4.4), height: px(u * 4.4), borderRadius: '50%', background: C.pino })
    return { r, tr, kn, ligado: !!it.ligado }
  })
  const ix = p.troca || 0
  let aviso
  if (p.aviso) aviso = el('div', { text: p.aviso, style: { alignSelf: 'center', font: fX(Math.round(u * 3.6), 600), color: C.tinta, background: C.destaque, borderRadius: px(u * 4), padding: `${px(u * 1.2)} ${px(u * 2.8)}` } }, col)
  const toque = anel(b, u)
  let alvo
  return (tl, d) => {
    const q = Math.min(1, d / 2.4), tv = 0.8 * q
    if (!alvo) alvo = centro(rows[ix].tr, b)
    rows.forEach((x, i) => {
      entra(x.r, tl, i * 0.05 * q, 0.3 * q, u * 3)
      const k = i === ix ? E.inOutCubic(P(tl, tv, tv + 0.25 * q)) : 0
      const on = x.ligado ? 1 - k : k
      x.tr.style.background = on > 0.5 ? C.destaque : C.trilho || rgba(C.texto, 0.25)
      x.kn.style.left = px(lerp(u * 0.6, u * 5, on))
    })
    toque(tl, tv, alvo[0], alvo[1])
    if (aviso) entra(aviso, tl, tv + 0.35 * q, 0.3 * q, u * 2)
  }
}

PROVA.barra = (b, p, { w, h, u }) => {
  const pad = u * 5
  const col = flex(div(b, { left: px(pad), top: px(pad * 0.6), width: px(w - 2 * pad), height: px(h - pad * 1.2) }), { flexDirection: 'column', justifyContent: 'center', gap: px(u * 2.4), width: '100%', height: '100%' })
  el('div', { text: p.rotulo, style: { font: fX(Math.round(u * 4.4), 600), color: C.texto } }, col)
  const linhaN = flex(col, { alignItems: 'baseline', gap: px(u * 2) })
  const n = el('div', { text: num(p.de), style: { font: fT(Math.round(u * 17)), color: C.destaque, lineHeight: '1' } }, linhaN)
  el('div', { text: p.unidade || '', style: { font: fT(Math.round(u * 7)), color: C.texto, lineHeight: '1' } }, linhaN)
  const trilho = el('div', { style: { position: 'relative', height: px(u * 5), borderRadius: px(u * 3), background: C.trilho || rgba(C.texto, 0.12) } }, col)
  const fant = div(trilho, { height: '100%', borderRadius: px(u * 3), background: rgba(C.texto, 0.18) })
  const ench = div(trilho, { height: '100%', borderRadius: px(u * 3), background: C.destaque })
  const max = Math.max(p.de, p.para, p.max || 0)
  let nota
  if (p.nota) nota = el('div', { text: p.nota, style: { alignSelf: 'flex-start', font: fX(Math.round(u * 3.6), 600), color: C.texto, background: C.campo, boxShadow: `inset 0 0 0 2px ${C.linha}`, borderRadius: px(u * 4), padding: `${px(u * 1.2)} ${px(u * 2.6)}` } }, col)
  return (tl, d) => {
    const q = Math.min(1, d / 2.4)
    entra(col, tl, 0, 0.3 * q, u * 3)
    const k = E.inOutCubic(P(tl, 0.5 * q, 1.5 * q))
    const v = lerp(p.de, p.para, k)
    n.textContent = num(lerp(p.de, p.para, E.inOutCubic(P(qd(tl), 0.5 * q, 1.5 * q))), p.casas || 0)
    fant.style.width = `${(p.de / max) * 100}%`
    ench.style.width = `${(v / max) * 100}%`
    if (nota) entra(nota, tl, 1.4 * q, 0.3 * q, u * 2)
  }
}

PROVA.escolha = (b, p, { w, h, u }) => {
  const land = w / h > 1.25, pad = u * 4.4
  const col = flex(div(b, { left: px(pad), top: px(pad * 0.6), width: px(w - 2 * pad), height: px(h - pad * 1.2) }), { flexDirection: 'column', justifyContent: 'center', gap: px(u * 2.6), width: '100%', height: '100%' })
  if (p.pergunta) el('div', { text: p.pergunta, style: { font: fX(Math.round(u * 4.6), 600), color: C.texto } }, col)
  const grid = el('div', { style: { display: 'grid', gridTemplateColumns: `repeat(${p.colunas || (land ? 3 : 2)}, 1fr)`, gap: px(u * 1.8) } }, col)
  const ps = p.opcoes.map((o) => el('div', { text: o, style: { font: fX(Math.round(u * 4), 600), color: C.texto, background: C.campo, borderRadius: px(u * 2), padding: `${px(u * 2.4)} 0`, textAlign: 'center' } }, grid))
  let bt
  if (p.botao) bt = el('div', { text: p.botao, style: { font: fX(Math.round(u * 4.2), 700), color: C.tinta, background: C.destaque, borderRadius: px(u * 4), padding: `${px(u * 2)} 0`, textAlign: 'center' } }, col)
  const ix = p.ativa || 0
  const toque = anel(b, u)
  let alvo
  return (tl, d) => {
    const q = Math.min(1, d / 2.4), tv = 0.8 * q
    if (!alvo) alvo = centro(ps[ix], b)
    ps.forEach((e, i) => {
      entra(e, tl, i * 0.04 * q, 0.3 * q, u * 3)
      const on = i === ix && tl >= tv
      e.style.background = on ? C.destaque : C.campo
      e.style.color = on ? C.tinta : C.texto
    })
    toque(tl, tv, alvo[0], alvo[1])
    if (bt) { entra(bt, tl, 0.2 * q, 0.3 * q, u * 2); bt.style.filter = tl >= tv + 0.3 * q ? 'none' : 'saturate(0.2) opacity(0.55)' }
  }
}

// Painel: o cartão onde a prova mora. Mesmo lugar em todo item, então o corte seco entre itens não pula.
function painel(parent, prova, R) {
  const u = Math.min(R.w, R.h * 1.5) / 124
  const box = div(parent, { left: px(R.x), top: px(R.y), width: px(R.w), height: px(R.h), background: C.superficie, borderRadius: px(u * 3.4), overflow: 'hidden',
    boxShadow: PLANO_COR ? 'none' : `0 0 0 2px ${C.linha}, 0 ${u * 5}px ${u * 12}px ${rgba('#000000', CLARO ? 0.14 : 0.45)}` })
  const semTopo = prova.tipo === 'foto' || prova.semTopo
  const hh = semTopo ? 0 : Math.round(u * 9)
  if (!semTopo) {
    const head = flex(div(box, { width: px(R.w), height: px(hh), borderBottom: `2px solid ${C.linha}` }), { alignItems: 'center', gap: px(u * 1.8), height: '100%', padding: `0 ${px(u * 3.4)}` })
    el('div', { style: { width: px(u * 2), height: px(u * 2), borderRadius: '50%', background: C.destaque } }, head)
    el('div', { text: prova.titulo || '', style: { font: fX(Math.round(u * 3.6), 600), color: C.texto, flex: '1', whiteSpace: 'nowrap' } }, head)
    el('div', { text: M.nome, style: { font: fM(Math.round(u * 2.8), 600), color: C.apagado, letterSpacing: '0.08em' } }, head)
  }
  const corpo = div(box, { top: px(hh), width: px(R.w), height: px(R.h - hh) })
  const f = PROVA[prova.tipo]
  if (!f) { console.error(`PROOF "${prova.tipo}" DOES NOT EXIST: use ${Object.keys(PROVA).join(', ')}`); return { el: box, update: () => {} } }
  return { el: box, update: f(corpo, prova, { w: R.w, h: R.h - hh, u }) }
}

// ---------- fundo: a cor da marca e uma mancha de luz que muda de lugar a cada seção ----------
cena(0, PLANO.dur, (root) => {
  const cam = camada(root, C.fundo)
  if (M.gradeFundo) el('div', { cls: 'layer', style: { backgroundImage: `linear-gradient(${rgba(C.texto, 0.035)} 1px, transparent 1px), linear-gradient(90deg, ${rgba(C.texto, 0.035)} 1px, transparent 1px)`, backgroundSize: '64px 64px' } }, cam)
  const luz = el('div', { cls: 'layer' }, cam)
  if (!PLANO_COR) el('div', { cls: 'layer', style: { background: `radial-gradient(120% 90% at 50% 50%, transparent 55%, ${rgba('#000000', CLARO ? 0.06 : 0.42)})` } }, cam)
  const R = rng(PARAMS.semente || 7)
  const pos = PLANO.secoes.map(() => [W * (0.2 + R() * 0.6), H * (0.2 + R() * 0.6)])
  const forca = M.luz != null ? M.luz : 0.16
  return (t) => {
    let k = PLANO.secoes.findIndex((s) => t >= s.t0 && t < s.t1); if (k < 0) k = PLANO.secoes.length - 1
    const s = PLANO.secoes[k], a = pos[Math.max(0, k - 1)], b = pos[k]
    const e = E.inOutCubic(P(t, s.t0, s.t0 + 0.8))
    const x = lerp(a[0], b[0], e), y = lerp(a[1], b[1], e), r = Math.max(W, H) * 0.55
    luz.style.background = `radial-gradient(${r}px ${r * 0.8}px at ${x}px ${y}px, ${rgba(C.destaque, forca)}, transparent 70%)`
  }
}, 'background')

// Marca pequena no alto (retrato), para a identidade não sumir durante os itens.
function marcaPequena(parent, alt) {
  if (M.logo) return imagem(parent, M.logo, { height: px(alt), width: px(Math.round(alt * (M.logoAspecto || 1))) })
  return el('div', { cls: 'abs', text: M.nome, style: { font: fT(alt), color: C.texto, whiteSpace: 'nowrap', lineHeight: '1' } }, parent)
}

// ---------- abertura: a promessa já escrita no quadro 0 ----------
for (const s of PLANO.secoes.filter((x) => x.tipo === 'abertura')) {
  cena(s.t0, s.t1, (root) => {
    const A = PARAMS.abertura
    const g = div(root, { width: px(W), height: px(H) })
    const m = LAY.m
    const lg = marcaPequena(g, RET ? 52 : 46)
    const numero = div(g, { font: fT(L({ '16x9': 430, '9x16': 560, '1x1': 360, '4x5': 420 })), color: C.destaque, lineHeight: '0.82', whiteSpace: 'nowrap' }, String(A.numero))
    const linhas = (A.linhas || quebra(A.titulo, 2)).map((l) => div(g, { font: fT(L({ '16x9': 116, '9x16': 112, '1x1': 92, '4x5': 100 })), color: C.texto, whiteSpace: 'nowrap', lineHeight: '1' }, caixa(l)))
    let selo
    if (A.selo) selo = div(g, { font: fM(L({ '16x9': 28, '9x16': 32, '1x1': 26, '4x5': 28 })), color: C.destaque, border: `2px solid ${C.destaque}`, borderRadius: '999px', padding: '10px 24px', whiteSpace: 'nowrap', letterSpacing: '0.06em' }, caixa(A.selo))
    const nr = rectOf(numero)
    if (!RET) {
      lg.style.left = px(m); lg.style.top = px(90)
      const blocoH = nr.h, top = (LAY.leg.y - 60 - blocoH) / 2 + 40
      place(numero, m, top)
      const x = m + nr.w + 50, maxW = W - m - x
      const lh = linhas.map((l) => cabe(l, maxW, parseFloat(l.style.font.match(/(\d+)px/)[1])))
      const alto = lh.reduce((a, b) => a + b * 1.08, 0)
      let y = top + (blocoH - alto) / 2
      linhas.forEach((l, i) => { place(l, x, y); y += lh[i] * 1.08 })
      if (selo) { selo.style.left = 'auto'; selo.style.right = px(m); selo.style.top = px(88) }
    } else {
      lg.style.top = px(L({ '9x16': 150, '1x1': 70, '4x5': 80 })); centrarX(lg)
      const top = L({ '9x16': 400, '1x1': 190, '4x5': 230 })
      place(numero, (W - nr.w) / 2, top)
      let y = top + nr.h + L({ '9x16': 60, '1x1': 36, '4x5': 44 })
      linhas.forEach((l) => { const s2 = cabe(l, W - 2 * m, parseFloat(l.style.font.match(/(\d+)px/)[1])); centrarX(l); l.style.top = px(y); y += s2 * 1.1 })
      if (selo) { selo.style.top = px(y + 24); centrarX(selo) }
    }
    for (const l of linhas) { l.style.transform = `skewX(${INCLINA}deg)`; marcar(l, 'texto') }
    numero.style.transformOrigin = '50% 60%'
    if (RESPIRA && !RET) g.style.transformOrigin = `${LAY.m}px 50%`   // cresce a partir da margem: nada sai da área segura
    return (t) => {
      const tl = t - s.t0, d = s.t1 - s.t0
      T(numero, `scale(${1.05 - 0.05 * E.outCubic(P(tl, 0, 0.9))})`)
      const sai = E.inCubic(P(tl, d - 0.22, d))
      O(g, 1 - sai); T(g, `translateY(${-sai * 50}px)` + respiro(tl, d, 0.025))
      if (selo) O(selo, 0.4 + 0.6 * P(tl, 0, 0.3))
    }
  }, 'opening')
}

// ---------- itens ----------
// Cor de paleta: "#hex" (só o fundo) ou { fundo, texto, destaque, tinta } (na rajada, o nome e a etiqueta numerada
// do item usam o par de texto dessa cor, para cada fundo ficar num par aprovado da marca).
function corDoItem(i) { const c = PALETA[i % PALETA.length]; return c && typeof c === 'object' ? c : { fundo: c } }

// transicao (desligada por padrão): { tipo: 'push' | 'whip', dur, dir } troca o corte seco entre um item e o seguinte por
// uma transição do motor (TR): o item que sai fica `dur` s a mais no quadro, saindo, enquanto o próximo entra (o 1º item
// e o fecho continuam no corte)
const TRANS = PARAMS.transicao && TR[PARAMS.transicao.tipo] ? { dur: 0.5, ...PARAMS.transicao } : null
const OP_TRANS = TRANS ? (({ tipo, dur, ...o }) => o)(TRANS) : null
for (const s of PLANO.secoes.filter((x) => x.tipo === 'item')) {
  const proxItem = PLANO.secoes.some((x) => x.tipo === 'item' && x.i === s.i + 1), antItem = s.i > 0
  cena(s.t0, s.t1 + (TRANS && proxItem ? TRANS.dur : 0), (root) => {
    const it = PARAMS.itens[s.i], n = s.i + 1, d = s.t1 - s.t0
    const g = div(root, { width: px(W), height: px(H) })
    const tProva = VEL === 'cartaz' ? PLANO.ritmo.cartaz : 0
    let chapa, bloco
    const cor = corDoItem(s.i), naChapa = VEL === 'rajada' ? cor : {}
    const corTexto = naChapa.texto || C.texto, corDestaque = naChapa.destaque || C.destaque, corTinta = naChapa.tinta || C.tinta
    if (VEL === 'rajada') chapa = el('div', { cls: 'layer', style: { background: cor.fundo } }, g)
    if (VEL === 'cartaz') { const B = LAY.bloco; bloco = div(g, { left: px(B.x), top: px(B.y), width: px(B.w), height: px(B.h), background: it.cor || cor.fundo }) }
    if (RET && LAY.painel.y > 160) { const mp = marcaPequena(g, 40); mp.style.top = px(Math.round((LAY.painel.y - 40) / 2)); centrarX(mp); marcar(mp, false) }
    const pn = painel(g, it.prova, LAY.painel)
    // etiqueta: sempre no mesmo canto (número + nome curto); a frase ao lado ou embaixo
    const F = LAY.faixa
    const badge = div(g, { left: px(F.x), top: px(F.y), height: px(LAY.badge), minWidth: px(LAY.badge), padding: `0 ${px(LAY.badge * 0.22)}`, boxSizing: 'border-box', background: corDestaque, borderRadius: px(LAY.badge * 0.18), display: 'flex', alignItems: 'center', justifyContent: 'center', font: fT(Math.round(LAY.badge * 0.62)), color: corTinta, lineHeight: '1' }, String(n).padStart(2, '0'))
    const br = rectOf(badge)
    const rajada = VEL === 'rajada'
    const etq = div(g, { font: fM(LAY.etq), color: corDestaque, letterSpacing: '0.1em', whiteSpace: 'nowrap', lineHeight: '1' }, caixa(it.etiqueta).toLocaleUpperCase(IDIOMA))
    const texto = rajada ? it.etiqueta : it.frase
    const lado = !RET   // 16:9: frase à direita do número; retrato: embaixo dele
    const fx0 = lado ? F.x + br.w + 36 : F.x
    const maxW = lado ? F.x + F.w - fx0 : F.w
    const partes = quebra(caixa(texto), LAY.linhas)
    const linhas = partes.map((p) => textLine(g, [{ t: p }], { font: fT(rajada ? LAY.frase * 1.15 : LAY.frase), color: corTexto, left: '0', top: '0' }))
    let tam = Math.min(...linhas.map((l) => cabe(l.line, maxW, rajada ? LAY.frase * 1.15 : LAY.frase)))
    linhas.forEach((l) => { l.line.style.fontSize = px(tam) })
    if (lado) {
      if (rajada) { etq.style.display = 'none'; place(linhas[0].line, fx0, F.y + (LAY.badge - tam) / 2) }
      else { place(etq, fx0, F.y + 2); linhas.forEach((l, i) => place(l.line, fx0, F.y + LAY.etq + 22 + i * tam * 1.06)) }
    } else {
      place(etq, F.x + br.w + 28, F.y + (LAY.badge - LAY.etq) / 2)
      if (rajada) etq.style.display = 'none'
      linhas.forEach((l, i) => place(l.line, F.x, F.y + LAY.badge + 26 + i * tam * 1.08))
      if (rajada) linhas.forEach((l, i) => place(l.line, F.x + br.w + 28, F.y + (LAY.badge - tam) / 2 + i * tam * 1.08))
    }
    linhas.forEach((l) => { l.line.style.transform = `skewX(${INCLINA}deg)` })
    marcar(badge, 'texto'); marcar(etq, 'texto')
    // cartaz em tela cheia (só na velocidade cartaz): a promessa grande antes da prova
    let cz
    if (VEL === 'cartaz') {
      cz = div(g, { width: px(W), height: px(H), background: C.fundo })
      const partesC = quebra(caixa(it.cartaz || it.frase), RET ? 3 : 2)
      const ls = partesC.map((p) => textLine(cz, [{ t: p }], { font: fT(LAY.cartaz), color: C.texto, left: '0', top: '0' }))
      const tc = Math.min(...ls.map((l) => cabe(l.line, W - 2 * LAY.m, LAY.cartaz)))
      const alto = ls.length * tc * 1.12
      ls.forEach((l, i) => { l.line.style.fontSize = px(tc); l.line.style.top = px((LAY.leg.y - 40 - alto) / 2 + i * tc * 1.12); centrarX(l.line); l.line.style.transform = `skewX(${INCLINA}deg)` })
      if (it.palavraChave) ls.forEach((l) => l.words.forEach((w) => { if (w.inner.textContent.replace(/[.,!?:]/g, '').toLowerCase() === caixa(it.palavraChave).toLowerCase()) w.inner.style.color = C.destaque }))
      cz.ws = palavras(ls)
      g.appendChild(badge); g.appendChild(etq)   // a etiqueta fica por cima: o canto não muda entre cartaz e prova
    }
    const fraseWords = linhas.flatMap((l) => l.words)
    return (t) => {
      const tl = t - s.t0
      if (TRANS) { if (antItem) TR[TRANS.tipo].entra(g, t, s.t0, TRANS.dur, OP_TRANS); if (proxItem) TR[TRANS.tipo].sai(g, t, s.t1, TRANS.dur, OP_TRANS) }
      if (cz) {
        const emCartaz = tl < tProva
        cz.style.display = emCartaz ? 'block' : 'none'
        linhas.forEach((l) => { l.line.style.visibility = emCartaz ? 'hidden' : 'visible' })   // a frase entra com a prova, não fica escondida embaixo do cartaz
        if (emCartaz) { riseWords(cz.ws, tl, 0.0, 0.07, 0.5); exitWords(cz.ws, tl, tProva - 0.28, 0.02, 0.24) }
      }
      const tp = tl - tProva, dp = d - tProva
      if (tp < 0) return
      // a prova entra; no rajada e na lista, depois de um corte seco, com um deslize curto
      const k = E.outExpo(P(tp, 0, rajada ? 0.22 : 0.38))
      const dx = VEL === 'cartaz' ? (RET ? 0 : 140) : 50, dy = VEL === 'cartaz' && RET ? 120 : 0
      T(pn.el, `translate(${(1 - k) * dx}px, ${(1 - k) * dy}px)` + respiro(tp, dp, 0.025)); O(pn.el, 0.35 + 0.65 * k)
      if (bloco) { const kb = E.outExpo(P(tp, 0, 0.45)); T(bloco, RET ? `translateY(${(1 - kb) * 60}px)` : `translateX(${(1 - kb) * 200}px)`); O(bloco, kb) }
      pn.update(tp, dp)
      riseWords(fraseWords, tp, rajada ? 0 : 0.08, rajada ? 0.02 : 0.045, rajada ? 0.25 : 0.45)
    }
  }, `item ${s.i + 1}`)
}

// ---------- muro: o tamanho da atualização ----------
for (const s of PLANO.secoes.filter((x) => x.tipo === 'muro')) {
  cena(s.t0, s.t1, (root) => {
    const Mu = PARAMS.muro
    const g = div(root, { width: px(W), height: px(H) })
    const nomes = [...PARAMS.itens.map((i) => ({ t: i.etiqueta, visto: true })), ...(Mu.extras || []).map((t) => ({ t, visto: false }))]
    const total = Mu.total != null ? Mu.total : nomes.length
    const nTam = L({ '16x9': 300, '9x16': 300, '1x1': 210, '4x5': 240 })
    const cx = W / 2, cy = RET ? L({ '9x16': 860, '1x1': 470, '4x5': 590 }) : 470
    const nEl = div(g, { font: fT(nTam), color: C.destaque, lineHeight: '0.9', whiteSpace: 'nowrap', textAlign: 'center' }, num(total))
    const rot = div(g, { font: fT(Math.round(nTam * 0.26)), color: C.texto, whiteSpace: 'nowrap', lineHeight: '1' }, caixa(Mu.rotulo || 'new features'))
    const nr = rectOf(nEl), rr = rectOf(rot)
    const blocoH = nr.h + 16 + rr.h
    place(nEl, cx - nr.w / 2, cy - blocoH / 2); place(rot, cx - rr.w / 2, cy - blocoH / 2 + nr.h + 16)
    rot.style.transform = `skewX(${INCLINA}deg)`
    nEl.style.minWidth = px(nr.w)
    marcar(nEl, 'texto'); marcar(rot, 'texto')
    const m = LAY.m
    const areas = RET
      ? [[m * 0.6, L({ '9x16': 230, '1x1': 40, '4x5': 50 }), W - m * 1.2, cy - blocoH / 2 - L({ '9x16': 290, '1x1': 70, '4x5': 100 })], [m * 0.6, cy + blocoH / 2 + 40, W - m * 1.2, LAY.leg.y - 50 - (cy + blocoH / 2 + 40)]]
      : [[LAY.muroX, 90, cx - nr.w / 2 - LAY.muroX - 70, 850], [cx + nr.w / 2 + 70, 90, W - (cx + nr.w / 2 + 70) - LAY.muroX, 850]]
    const caixas = areas.map(([x, y, w, h]) => flex(div(g, { left: px(x), top: px(y), width: px(w), height: px(h) }), { flexWrap: 'wrap', justifyContent: 'center', alignContent: 'center', gap: '12px', width: '100%', height: '100%' }))
    const chips = nomes.map((nm, i) => el('div', { text: caixa(nm.t), style: { font: fM(44), color: nm.visto ? C.tinta : C.texto, background: nm.visto ? C.destaque : 'transparent', boxShadow: nm.visto ? 'none' : `inset 0 0 0 2px ${C.linha}`, borderRadius: '999px', padding: '10px 20px', whiteSpace: 'nowrap', lineHeight: '1' } }, caixas[i % caixas.length]))
    for (let tam = 44; tam > 14; tam -= 2) {
      if (caixas.every((c) => c.scrollHeight <= c.clientHeight + 1 && c.scrollWidth <= c.clientWidth + 1)) break
      chips.forEach((c) => { c.style.font = fM(tam - 2); c.style.padding = `${Math.round((tam - 2) / 3)}px ${Math.round((tam - 2) * 0.66)}px` })
    }
    const vistos = PARAMS.itens.length
    return (t) => {
      const tl = t - s.t0, d = s.t1 - s.t0
      chips.forEach((c, i) => { const t0 = 0.1 + (i / Math.max(1, chips.length - 1)) * 1.0; const k = E.outExpo(P(tl, t0, t0 + 0.35)); O(c, k); T(c, `scale(${0.85 + 0.15 * k})`) })
      nEl.textContent = num(Math.round(lerp(Math.min(vistos, total), total, E.outCubic(P(qd(tl), 0.1, 1.3)))))
      const kr = E.outExpo(P(tl, 0, 0.4)); O(rot, kr)
      const sai = E.inCubic(P(tl, d - 0.2, d)); O(g, 1 - sai)
    }
  }, 'wall')
}

// ---------- fecho: cartões de frase (opcional) → marca, bordão e endereço ----------
for (const s of PLANO.secoes.filter((x) => x.tipo === 'fecho')) {
  cena(s.t0, s.t1, (root) => {
    const Fe = PARAMS.fecho || {}
    const g = div(root, { width: px(W), height: px(H) })
    const dc = PLANO.ritmo.cartao
    const cartoes = PLANO.cartoes.map((txt, i) => {
      const c = div(g, { width: px(W), height: px(H), background: i % 2 ? C.texto : C.destaque })
      const ls = quebra(caixa(txt), RET ? 2 : 1).map((p) => textLine(c, [{ t: p }], { font: fT(L({ '16x9': 120, '9x16': 120, '1x1': 96, '4x5': 104 })), color: i % 2 ? C.fundo : C.tinta, left: '0', top: '0' }))
      const tc = Math.min(...ls.map((l) => cabe(l.line, W - 2 * LAY.m, L({ '16x9': 120, '9x16': 120, '1x1': 96, '4x5': 104 }))))
      ls.forEach((l, k) => { l.line.style.fontSize = px(tc); l.line.style.top = px((LAY.leg.y - 40 - ls.length * tc * 1.1) / 2 + k * tc * 1.1); centrarX(l.line); l.line.style.transform = `skewX(${INCLINA}deg)` })
      return { c, ws: palavras(ls) }
    })
    const fim = div(g, { width: px(W), height: px(H), ...(Fe.fundo ? { background: Fe.fundo } : {}) })
    const lgAlt = L({ '16x9': 150, '9x16': 150, '1x1': 110, '4x5': 120 })
    const lg = marcaPequena(fim, lgAlt)
    const bord = Fe.bordao ? textLine(fim, [{ t: caixa(Fe.bordao) }], { font: fT(L({ '16x9': 150, '9x16': 130, '1x1': 100, '4x5': 110 })), color: C.destaque, left: '0', top: '0' }) : null
    const end = Fe.endereco ? div(fim, { font: fM(L({ '16x9': 44, '9x16': 46, '1x1': 36, '4x5': 40 })), color: C.texto, whiteSpace: 'nowrap', letterSpacing: '0.04em' }, Fe.endereco) : null
    const lr = rectOf(lg)
    const bh = bord ? cabe(bord.line, W - 2 * LAY.m, parseFloat(bord.line.style.font.match(/(\d+)px/)[1]), 40) : 0
    const eh = end ? rectOf(end).h : 0
    const gap = 44, altoT = lr.h + (bord ? gap + bh : 0) + (end ? gap * 0.8 + eh : 0)
    // só o logo e nenhuma legenda: centrado no quadro (sem legenda, a faixa dela não precisa ficar livre)
    let y = !bord && !end && !PLANO.falas.length ? (H - altoT) / 2 : (LAY.leg.y - 40 - altoT) / 2
    lg.style.top = px(y); centrarX(lg); y += lr.h + gap
    if (bord) { bord.line.style.top = px(y); centrarX(bord.line); bord.line.style.transform = `skewX(${INCLINA}deg)`; y += bh + gap * 0.8 }
    if (end) { end.style.top = px(y); centrarX(end); marcar(end, 'texto') }
    marcar(lg, 'logo', M.nome)
    const tFim = cartoes.length * dc
    return (t) => {
      const tl = t - s.t0
      cartoes.forEach((c, i) => {
        const on = tl >= i * dc && tl < (i + 1) * dc
        c.c.style.display = on ? 'block' : 'none'
        if (on) riseWords(c.ws, tl, i * dc, 0.05, 0.4)
      })
      fim.style.display = tl >= tFim ? 'block' : 'none'
      const k = spring(tl - tFim, 2.2, 0.55)
      T(lg, `scale(${0.9 + 0.1 * k})`); O(lg, Math.min(1, P(tl, tFim, tFim + 0.25)))
      if (bord) riseWords(bord.words, tl, tFim + 0.2, 0.06, 0.5)
      if (end) entra(end, tl, tFim + 0.45, 0.4, 16)
    }
  }, 'closing')
}

// ---------- legenda: a fala, palavra a palavra, sempre por cima ----------
cena(0, PLANO.dur, (root) => {
  const pals = []
  for (const f of PLANO.falas) {
    const ws = (PARAMS.legendas && PARAMS.legendas[f.id]) || (() => {   // sem locução ainda: tempo estimado pelo texto
      const tk = f.texto.split(' '); let t = 0
      return tk.map((w) => { const d = (w.length + 1) / 13.5; const r = { texto: w, ini: t, fim: t + d }; t += d; return r })
    })()
    ws.forEach((w) => pals.push({ ...w, ini: w.ini + f.em, fim: w.fim + f.em, fala: f.id }))
  }
  const maxP = L({ '16x9': 7, '9x16': 4, '1x1': 5, '4x5': 5 })
  const blocos = []
  let cur = []
  pals.forEach((w, i) => {
    cur.push(w)
    const prox = pals[i + 1]
    if (!prox || prox.fala !== w.fala || cur.length >= maxP || (/[.,:;!?]$/.test(w.texto) && cur.length >= 2) || prox.ini - w.fim > 0.35) { blocos.push(cur); cur = [] }
  })
  const box = div(root, { top: px(LAY.leg.y), width: px(W), display: 'flex', justifyContent: 'center' })
  const els = blocos.map((b, i) => {
    const pill = el('div', { style: { display: 'none', font: fX(LAY.leg.px, 600), color: C.texto, background: rgba(C.fundo, 0.86), borderRadius: px(LAY.leg.px * 0.4), padding: `${px(LAY.leg.px * 0.28)} ${px(LAY.leg.px * 0.6)}`, whiteSpace: 'nowrap', lineHeight: '1.15', maxWidth: px(W - 2 * LAY.m) } }, box)
    const spans = b.map((w, k) => el('span', { text: (k ? ' ' : '') + w.texto }, pill))
    const ini = b[0].ini - 0.05, prox = blocos[i + 1]
    const fim = prox && prox[0].fala === b[0].fala ? prox[0].ini - 0.05 : b[b.length - 1].fim + 0.45
    return { pill, spans, b, ini, fim }
  })
  for (const e of els) { e.pill.style.display = 'block'; const s = cabe(e.pill, W - 2 * LAY.m, LAY.leg.px, LAY.leg.px * 0.7); e.pill.style.display = 'none'; e.tam = s }
  return (t) => {
    for (const e of els) {
      const on = t >= e.ini && t < e.fim
      e.pill.style.display = on ? 'block' : 'none'
      if (on) { marcar(e.pill, 'legenda'); e.spans.forEach((sp, k) => { sp.style.color = t >= e.b[k].ini && t < e.b[k].fim + 0.08 ? C.destaque : C.texto }) }
    }
  }
}, 'captions')
