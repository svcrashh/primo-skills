// Molde "texto que se digita". Tudo o que é da marca vem de PARAMS (example*.json): cores, fontes, logo, textos,
// números. O tempo de cada bloco é a soma das durações; cada bloco é uma cena do motor sobre um fundo único.
const M = PARAMS.marca, C = M.cores, FT = M.fontes
const ff = (fam) => `"${fam}"`
const fonte = (peso, px, fam) => `${peso} ${px}px ${ff(fam)}`
const cv = document.createElement('canvas').getContext('2d')
const mede = (txt, f) => { cv.font = f; return cv.measureText(txt).width }
const quebra = (txt, f, maxW) => {
  const ls = []; let cur = ''
  for (const w of txt.split(' ')) { const tst = cur ? cur + ' ' + w : w; if (cur && mede(tst, f) > maxW) { ls.push(cur); cur = w } else cur = tst }
  if (cur) ls.push(cur)
  return ls
}
const pisca = (t) => (Math.floor(t * 2.2) % 2 === 0 ? 1 : 0)
const sobeEm = (e, t, t0, d = 50, dur = 0.55) => { const k = E.outExpo(P(t, t0, t0 + dur)); O(e, k); T(e, `translateY(${(1 - k) * d}px)`); return k }
window.SONS = []
const som = (t, nome, extra = {}) => window.SONS.push({ t: +t.toFixed(3), som: nome, ...extra })
// opcionais da marca, desligados por padrão: "borda": false (contorno transparente, mesma geometria), "sombra": false,
// cores.etiqueta/sobreEtiqueta (a 1ª etiqueta e os números da resposta; padrão: destaque/sobreDestaque) e cores.rotulo
const borda = (w, cor = C.borda) => `${w}px solid ${M.borda === false ? 'transparent' : cor}`
const sombra = (s) => (M.sombra === false ? 'none' : s)
const ET = C.etiqueta || C.destaque, sobreET = C.sobreEtiqueta || C.sobreDestaque || C.fundo
// mais opcionais, desligados por padrão: cores.sobreCampo (texto da pílula "não" sobre o campo; padrão: texto),
// passagem { tipo: 'whip' | 'push' | 'mascara' | …, dur, dir, forma } (a troca entre blocos por uma transição do motor, no
// lugar do sobe-e-desfoca) e leiaute "lado" (só nos horizontais: título e campo na coluna da esquerda, a resposta na
// da direita, e o campo não sobe)
const PASSA = PARAMS.passagem && TR[PARAMS.passagem.tipo] ? { dur: 0.45, ...PARAMS.passagem } : null
const OP_PASSA = PASSA ? (({ tipo, dur, ...o }) => o)(PASSA) : null
const LADO = PARAMS.leiaute === 'lado' && HORIZONTAL

// geometria por formato: campo, título, área da resposta, legenda. 19:9 e 21:9 usam o 16:9 esticado na largura:
// larguras crescem com W (KX); corpo e alturas ficam como no 16:9 (H é 1080 nos três). No 16:9, KX = 1.
const KX = HORIZONTAL ? W / 1920 : 1
const G = L({
  '16x9': { campoW: 1240 * KX, campoH: 132, campoFs: 50, cy: 560, tituloY: 340, tituloFs: 66, tituloW: 1500 * KX, topoY: 150, areaY: 330, areaW: 1240 * KX, legY: 968, legFs: 40, legW: 1500 * KX, fraseFs: 116, fraseW: 1500 * KX, logoH: 120 },
  '9x16': { campoW: 940, campoH: 150, campoFs: 54, cy: 880, tituloY: 640, tituloFs: 74, tituloW: 880, topoY: 400, areaY: 600, areaW: 900, legY: 1330, legFs: 50, legW: 860, fraseFs: 104, fraseW: 860, logoH: 110 },
  '1x1': { campoW: 940, campoH: 124, campoFs: 44, cy: 500, tituloY: 300, tituloFs: 60, tituloW: 900, topoY: 110, areaY: 250, areaW: 940, legY: 950, legFs: 38, legW: 900, fraseFs: 92, fraseW: 900, logoH: 96 },
})

// ── fundo único (o corte entre blocos não aparece) ─────────────────────────────────────────────────────
const TOTAL = PARAMS.cenas.reduce((s, c) => s + c.dur, 0)
cena(0, TOTAL, (root) => {
  const f = camada(root, C.fundo)
  const fx = M.fundo || {}
  if (fx.grade) el('div', { cls: 'layer', style: { backgroundImage: `linear-gradient(${rgba(C.texto, 0.05)} 1px, transparent 1px), linear-gradient(90deg, ${rgba(C.texto, 0.05)} 1px, transparent 1px)`, backgroundSize: `${fx.grade}px ${fx.grade}px` } }, f)
  const brilho = el('div', { cls: 'layer', style: { background: `radial-gradient(ellipse 55% 45% at 50% ${(G.cy / H) * 100}%, ${rgba(C.destaque, fx.brilho ?? 0.12)}, transparent 70%)` } }, f)
  const b2 = fx.cor2 ? el('div', { cls: 'layer', style: { background: `radial-gradient(circle at 88% 12%, ${rgba(fx.cor2, 0.22)}, transparent 38%), radial-gradient(circle at 10% 90%, ${rgba(C.destaque, 0.16)}, transparent 40%)` } }, f) : null
  return (t) => { O(brilho, 0.85 + 0.15 * Math.sin(t * 0.9)); if (b2) T(b2, `translate(${Math.sin(t * 0.4) * 14}px, ${Math.cos(t * 0.33) * 10}px)`) }
}, 'background')

// ── o campo: caixa, rótulo, placeholder, texto que se digita ou se cola, limpeza, botão ────────────────────
function campo(parent, o) {
  const w = o.w ?? G.campoW, h = o.h ?? G.campoH, fs0 = o.fs ?? G.campoFs
  const fam = o.mono ? FT.mono : FT.texto
  const livre = w - h * 0.72 - (o.botao === false ? 0 : h * 0.68) - 36
  const largLetras = (tx, f) => [...tx].reduce((s, ch) => s + mede(ch, f), 0)
  const fs = Math.floor(Math.max(fs0 * 0.7, Math.min(fs0, fs0 * livre / (largLetras(o.texto || '', fonte(o.peso ?? 500, fs0, fam)) || 1))))
  const fnt = fonte(o.peso ?? 500, fs, fam)
  const box = el('div', { cls: 'abs', style: { width: px(w), height: px(h), borderRadius: px(M.raio ?? h / 2), background: C.campo, border: borda(3), boxShadow: sombra(`0 24px 60px ${rgba(C.sombra || '#000000', 0.28)}`), boxSizing: 'border-box' } }, parent)
  const pad = h * 0.36, btn = o.botao === false ? 0 : h * 0.68
  const clip = el('div', { cls: 'abs', style: { left: px(pad), top: '0', width: px(w - pad * 2 - btn - 10), height: px(h - 6), overflow: 'hidden' } }, box)
  const innerW = w - pad * 2 - btn - 10
  const phFs = Math.round(Math.min(fs0 * 0.82, fs0 * 0.82 * livre / (mede(o.placeholder || '', fonte(400, fs0 * 0.82, FT.texto)) || 1)))
  const ph = el('div', { cls: 'line', text: o.placeholder || '', style: { font: fonte(400, phFs, FT.texto), color: C.apoio, top: px((h - 6 - phFs) / 2), left: '0' } }, clip)
  if (o.placeholder) marcar(ph, 'texto', 'placeholder')
  const row = el('div', { cls: 'abs', style: { top: px((h - 6 - fs) / 2), height: px(fs * 1.2) } }, clip)
  // letras com posição absoluta: a limpeza encolhe a largura das que saem e o resto anda junto
  const mk = (ch, cor) => { const s = el('span', { text: ch, style: { position: 'absolute', top: '0', whiteSpace: 'pre', font: fnt, color: cor || C.texto, lineHeight: '1', overflow: 'hidden', display: 'inline-block' } }, row); return { s, w: mede(ch, fnt) } }
  const txt = o.texto || ''
  const chars = [...txt].map((ch) => mk(ch))
  // limpeza: { fica: 'marca', prefixo: '@' } → as letras fora de "fica" somem e o prefixo entra na frente
  let pre = [], fica = null
  if (o.limpa) {
    const i0 = txt.indexOf(o.limpa.fica)
    fica = i0 >= 0 ? [i0, i0 + o.limpa.fica.length] : [0, txt.length]
    pre = [...(o.limpa.prefixo || '')].map((ch) => mk(ch, C.destaque))
  }
  const cursor = el('div', { cls: 'abs', style: { width: px(Math.max(3, fs * 0.07)), height: px(fs * 1.12), background: C.destaque, top: px((h - 6 - fs * 1.12) / 2 + fs * 0.02) } }, clip)
  const sel = el('div', { cls: 'abs', style: { top: px((h - 6 - fs * 1.2) / 2), height: px(fs * 1.2), background: rgba(C.destaque, 0.28), borderRadius: '6px' } }, clip)
  let b = null, seta = null
  if (btn) {
    b = el('div', { cls: 'abs', style: { left: px(w - btn - h * 0.16 - 3), top: px((h - btn) / 2 - 3), width: px(btn), height: px(btn), borderRadius: '50%', background: C.borda } }, box)
    const s = sv('svg', { viewBox: '0 0 24 24', width: btn * 0.5, height: btn * 0.5 }, b)
    Object.assign(s.style, { position: 'absolute', left: px(btn * 0.25), top: px(btn * 0.25) })
    seta = sv('path', { d: o.icone === 'busca' ? 'M10.5 4a6.5 6.5 0 1 1 0 13a6.5 6.5 0 0 1 0-13zM15.5 15.5L20 20' : 'M5 12h13M13 6l6 6l-6 6', fill: 'none', stroke: C.apoio, 'stroke-width': 2.6, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, s)
  }
  let rot = null
  if (o.rotulo) {
    // rotuloFs (px) fixa o corpo do rótulo (senão ele encolhe com o texto do campo); caixaAlta false: sem maiúsculas
    const rfs = o.rotuloFs ?? Math.round(fs * 0.56), alta = M.caixaAlta !== false
    rot = el('div', { cls: 'line', text: o.rotulo, style: { font: fonte(600, rfs, FT.mono || FT.texto), color: C.rotulo || C.destaque, letterSpacing: alta ? '0.08em' : 'normal', textTransform: alta ? 'uppercase' : 'none', left: px(pad * 0.5), top: px(-(o.rotuloFs ?? fs * 0.56) - 18) } }, box)
    marcar(rot, 'texto', 'field label')
  }
  // tempos de cada letra: ritmo humano semeado, espaço um pouco mais longo
  const R = rng(o.semente ?? 3), vel = o.vel ?? 15
  const tempos = []
  let acc = 0
  for (const ch of txt) { tempos.push(acc); acc += (1 / vel) * (0.55 + R() * 0.9) * (ch === ' ' ? 1.5 : 1) }
  const durDigita = o.modo === 'cola' ? 0 : acc
  return {
    box, w, h, rot, durDigita,
    sons(t0) {
      if (!txt) return
      if (o.modo === 'cola') som(t0, 'clique', { variante: 'trackpad' })
      else som(t0, 'digitacao', { dur: Math.max(0.3, durDigita + 0.08), teclado: o.teclado || 'notebook' })
    },
    update(t, t0, tEnvia, tLimpa) {
      const tv = t - t0
      const n = o.modo === 'cola' ? (tv >= 0 ? chars.length : 0) : tempos.filter((x) => x <= tv).length
      const kl = tLimpa != null ? E.inOutCubic(P(t, tLimpa, tLimpa + 0.7)) : 0
      let x = 0
      pre.forEach((c) => { const k = E.outBack(P(t, tLimpa + 0.35, tLimpa + 0.75)); c.s.style.left = px(x); c.s.style.width = px(c.w * Math.max(0, kl)); O(c.s, P(t, tLimpa + 0.35, tLimpa + 0.6)); T(c.s, `scale(${0.6 + 0.4 * Math.min(1, k)})`); x += c.w * kl })
      chars.forEach((c, i) => {
        const sai = fica && (i < fica[0] || i >= fica[1])
        const f = sai ? 1 - kl : 1
        const vis = i < n
        c.s.style.left = px(x); c.s.style.width = px(c.w * f + 0.5); O(c.s, vis ? (sai ? 1 - E.inCubic(Math.min(1, kl * 1.4)) : 1) : 0)
        c.s.style.color = !sai && kl > 0 ? mix(C.texto, C.destaque, kl * 0.0) : C.texto
        if (vis) x += c.w * f
      })
      const fim = x
      const off = Math.max(0, fim - innerW + 12)
      T(row, `translateX(${-off}px)`)
      O(ph, n > 0 ? 0 : 1)
      const digitando = o.modo !== 'cola' && tv >= 0 && tv < durDigita + 0.15
      cursor.style.left = px(fim - off + 2)
      O(cursor, t >= (tEnvia ?? 1e9) ? 0 : digitando ? 1 : pisca(t))
      // seleção do "colado": pisca e some
      const ks = o.modo === 'cola' && tv >= 0 ? 1 - P(tv, 0.18, 0.55) : 0
      place(sel, -off, null, fim * (ks > 0 ? 1 : 0)); O(sel, ks)
      if (b) {
        const on = n > 0 ? 1 : 0, ke = tEnvia != null ? P(t, tEnvia - 0.12, tEnvia + 0.12) : 0
        b.style.background = on ? C.destaque : C.borda
        seta.setAttribute('stroke', on ? C.sobreDestaque || C.fundo : C.apoio)
        T(b, `scale(${1 - 0.14 * Math.sin(Math.PI * ke)})`)
      }
      return fim
    },
  }
}

// ── blocos de resposta ──────────────────────────────────────────────────────────────────────────────────
function respostaNumeros(parent, r, x0, y0, wArea) {
  const itens = r.itens || [], gap = 28
  const vert = VERTICAL && itens.length > 2
  const cw = vert ? wArea : (wArea - gap * (itens.length - 1)) / itens.length, ch = L({ '16x9': 170, '9x16': 190, '1x1': 160 })
  const cards = itens.map((it, i) => {
    const c = el('div', { cls: 'abs', style: { left: px(x0 + (vert ? 0 : i * (cw + gap))), top: px(y0 + (vert ? i * (ch + gap) : 0)), width: px(cw), height: px(ch), background: C.superficie, borderRadius: px(M.raioCartao ?? 22), border: borda(2), boxSizing: 'border-box' } }, parent)
    const rl = el('div', { cls: 'line', text: it.rotulo, style: { font: fonte(500, L({ '16x9': 32, '9x16': 38, '1x1': 32 }), FT.texto), color: C.apoio, left: '32px', top: '28px' } }, c)
    const v = el('div', { cls: 'line', text: it.valor, style: { font: fonte(700, L({ '16x9': 80, '9x16': 88, '1x1': 72 }), FT.titulo), color: C.texto, left: '32px', top: px(ch - L({ '16x9': 104, '9x16': 112, '1x1': 94 })) } }, c)
    marcar(rl, 'texto', it.rotulo); marcar(v, 'texto', it.rotulo + ' value')
    return { c, v, it }
  })
  const yTot = y0 + (vert ? itens.length * (ch + gap) : ch + gap) + L({ '16x9': 10, '9x16': 40, '1x1': 0 })
  let tot = null, totRot = null
  if (r.total) {
    const fsT = L({ '16x9': 230, '9x16': 260, '1x1': 200 })
    tot = el('div', { cls: 'line', text: r.total.valor, style: { font: fonte(700, fsT, FT.titulo), color: C.destaque, top: px(yTot), left: '0' } }, parent)
    const rt = rectOf(tot)
    totRot = el('div', { cls: 'line', text: r.total.rotulo, style: { font: fonte(600, L({ '16x9': 40, '9x16': 50, '1x1': 38 }), FT.texto), color: C.texto, top: px(rt.y + rt.h + 6), left: '0', letterSpacing: '0.02em' } }, parent)
    centrarX(tot, x0 + wArea / 2); centrarX(totRot, x0 + wArea / 2)
    marcar(tot, 'texto', 'total'); marcar(totRot, 'texto', 'total label')
  }
  const num = (s) => +String(s).replace(/\./g, '').replace(',', '.')
  const fmt = (v, s) => { const casas = (String(s).split(',')[1] || '').length; return v.toFixed(casas).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, '.') }
  return {
    sons(t0) { som(t0 + 0.05, 'whoosh', { variante: 'curto' }); if (tot) som(t0 + 1.25 + itens.length * 0.12, 'sucesso') },
    update(t, t0) {
      cards.forEach((k, i) => {
        sobeEm(k.c, t, t0 + i * 0.12, 60)
        const a = t0 + i * 0.12 + 0.15
        k.v.textContent = fmt(num(k.it.valor) * E.outCubic(P(t, a, a + 1.1)), k.it.valor)
      })
      if (tot) {
        const a = t0 + 0.45 + itens.length * 0.12
        const k = sobeEm(tot, t, a, 40, 0.6); sobeEm(totRot, t, a + 0.15, 30)
        tot.textContent = fmt(num(r.total.valor) * E.outCubic(P(t, a, a + 1.3)), r.total.valor)
        T(tot, `translateY(${(1 - k) * 40}px) scale(${1 + 0.06 * Math.sin(Math.PI * P(t, a + 1.25, a + 1.6))})`)
      }
    },
  }
}

function respostaCartao(parent, r, x0, y0, wArea) {
  const pad = L({ '16x9': 44, '9x16': 48, '1x1': 40 })
  const fsT = L({ '16x9': 60, '9x16': 76, '1x1': 56 }), fsL = L({ '16x9': 36, '9x16': 46, '1x1': 36 }), fsC = L({ '16x9': 28, '9x16': 36, '1x1': 30 })
  const card = el('div', { cls: 'abs', style: { left: px(x0), top: px(y0), width: px(wArea), background: C.superficie, borderRadius: px(M.raioCartao ?? 28), border: borda(2), boxSizing: 'border-box', boxShadow: sombra(`0 30px 70px ${rgba(C.sombra || '#000000', 0.22)}`) } }, parent)
  let y = pad
  const tit = el('div', { cls: 'line', text: r.titulo, style: { font: fonte(700, fsT, FT.titulo), color: C.texto, left: px(pad), top: px(y) } }, card)
  marcar(tit, 'texto', 'answer title')
  y += fsT * 1.25
  const chips = (r.chips || []).map((c, i) => {
    const e = el('div', { cls: 'abs', text: c, style: { font: fonte(600, fsC, FT.texto), color: i === 0 ? sobreET : C.texto, background: i === 0 ? ET : C.campo, border: borda(2, i === 0 ? ET : C.borda), borderRadius: '999px', padding: `${fsC * 0.32}px ${fsC * 0.75}px`, whiteSpace: 'nowrap', top: px(y), lineHeight: '1' } }, card)
    return e
  })
  let cx = pad
  chips.forEach((e) => { const rr = e.getBoundingClientRect(); e.style.left = px(cx); cx += rr.width + 14 })
  if (chips.length) y += fsC * 2.2
  const fL = fonte(400, fsL, FT.texto)
  const linhas = (r.linhas || []).map((l, i) => {
    const ls = quebra(l, fL, wArea - pad * 2 - fsL * 1.6)
    const g = el('div', { cls: 'abs', style: { left: px(pad), top: px(y) } }, card)
    const n = el('div', { cls: 'abs', text: String(i + 1), style: { font: fonte(700, fsL * 0.7, FT.texto), color: sobreET, background: ET, width: px(fsL * 1.05), height: px(fsL * 1.05), borderRadius: '50%', textAlign: 'center', lineHeight: px(fsL * 1.05), top: px(fsL * 0.02) } }, g)
    const spans = []
    ls.forEach((t, k) => {
      const d = el('div', { cls: 'line', style: { font: fL, color: C.texto, left: px(fsL * 1.6), top: px(k * fsL * 1.3) } }, g)
      for (const w of t.split(/( )/)) if (w) spans.push(el('span', { text: w, style: { whiteSpace: 'pre' } }, d))
      marcar(d, 'texto', 'answer line')
    })
    y += ls.length * fsL * 1.3 + fsL * 0.5
    return { g, n, spans }
  })
  card.style.height = px(y + pad * 0.5)
  return {
    altura: y + pad * 0.5,
    sons(t0) { som(t0 + 0.02, 'whoosh', { variante: 'curto' }); som(t0 + 0.9 + linhas.length * 0.7, 'sucesso') },
    update(t, t0) {
      sobeEm(card, t, t0, 70, 0.6)
      sobeEm(tit, t, t0 + 0.15, 20)
      chips.forEach((c, i) => { const k = E.outBack(P(t, t0 + 0.35 + i * 0.1, t0 + 0.75 + i * 0.1)); O(c, Math.min(1, k * 1.4)); T(c, `scale(${0.6 + 0.4 * k})`) })
      // a resposta se escreve palavra a palavra, como o produto respondendo
      linhas.forEach((ln, i) => {
        const a = t0 + 0.75 + i * 0.7
        O(ln.n, E.outCubic(P(t, a, a + 0.25)))
        const k = P(t, a, a + 0.6)
        ln.spans.forEach((s, j) => O(s, k * ln.spans.length > j ? 1 : 0))
      })
    },
  }
}

// ── legenda karaokê da voz (regra 4: legenda sempre) ───────────────────────────────────────────────────
function legenda(root) {
  const falas = PARAMS.falas || []
  const fL = fonte(600, G.legFs, FT.texto)
  const blocos = []
  for (const f of falas) {
    const ps = f.palavras && f.palavras.length ? f.palavras : f.texto.split(' ').map((w, i, a) => ({ texto: w, ini: (f.dur || 2) * i / a.length, fim: (f.dur || 2) * (i + 1) / a.length }))
    let cur = []
    const fecha = () => { if (cur.length) blocos.push({ ps: cur.map((p) => ({ ...p, ini: f.em + p.ini, fim: f.em + p.fim })) }); cur = [] }
    const ini = blocos.length
    for (const p of ps) {
      cur.push(p); const wd = mede(cur.map((x) => x.texto).join(' '), fL)
      if (/[.:!?]$/.test(p.texto) || (/,$/.test(p.texto) && wd > G.legW * 0.5) || wd > G.legW * 1.45) fecha()
    }
    fecha()
    // palavra sozinha no fim de um bloco volta para o anterior
    for (let k = blocos.length - 1; k > ini; k--) if (blocos[k].ps.length === 1) { blocos[k - 1].ps.push(...blocos[k].ps); blocos.splice(k, 1) }
  }
  const els = blocos.map((bl) => {
    const ls = quebra(bl.ps.map((p) => p.texto).join(' '), fL, G.legW * 0.82)
    const pill = el('div', { cls: 'abs', style: { background: rgba(C.superficie, 0.92), border: borda(2), borderRadius: px(G.legFs * 0.6), padding: `${G.legFs * 0.38}px ${G.legFs * 0.7}px`, textAlign: 'center', boxSizing: 'border-box' } }, root)
    const spans = []
    let k = 0
    ls.forEach((l) => {
      const d = el('div', { style: { font: fL, color: C.texto, lineHeight: '1.25', whiteSpace: 'nowrap' } }, pill)
      l.split(' ').forEach((w, j) => { spans.push({ s: el('span', { text: (j ? ' ' : '') + w, style: { whiteSpace: 'pre' } }, d), p: bl.ps[k++] }) })
    })
    const r = pill.getBoundingClientRect()
    pill.style.left = px((W - r.width) / 2); pill.style.top = px(G.legY + (ls.length === 1 ? G.legFs * 0.35 : 0))
    marcar(pill, 'legenda', 'caption')
    return { pill, spans, t0: bl.ps[0].ini - 0.12, t1: bl.ps.at(-1).fim + 0.35 }
  })
  els.forEach((e, i) => { if (els[i + 1]) e.t1 = Math.min(e.t1, els[i + 1].t0) })
  return (t) => {
    for (const e of els) {
      const on = t >= e.t0 && t < e.t1
      e.pill.style.display = on ? 'block' : 'none'
      if (!on) continue
      const k = E.outCubic(P(t, e.t0, e.t0 + 0.18))
      O(e.pill, k); T(e.pill, `translateY(${(1 - k) * 16}px)`)
      e.spans.forEach(({ s, p }) => { s.style.color = t >= p.ini ? C.texto : rgba(C.texto, 0.42) })
    }
  }
}

// ── os blocos ───────────────────────────────────────────────────────────────────────────────────────────
function titulo(parent, texto, y, destaque, col) {   // col { x, w }: alinhado à esquerda numa coluna (leiaute "lado")
  const f = fonte(700, G.tituloFs, FT.titulo)
  const ls = quebra(texto, f, col ? col.w : G.tituloW)
  const lines = ls.map((l, i) => {
    const d = el('div', { cls: 'line', style: { font: f, color: C.texto, top: px(y - (ls.length - 1) * G.tituloFs * 1.08 + i * G.tituloFs * 1.08), left: '0', textTransform: M.caixaAlta ? 'uppercase' : 'none', letterSpacing: M.caixaAlta ? '0.01em' : '-0.01em' } }, parent)
    for (const w of l.split(/( )/)) if (w) el('span', { text: w, style: { whiteSpace: 'pre', color: destaque && destaque.split(' ').includes(w.replace(/[.,!?]/g, '')) ? C.destaque : null } }, d)
    if (col) d.style.left = px(col.x); else centrarX(d)
    return d
  })
  return lines
}

const BLOCO = {
  // pergunta: o pedido no campo (digitado ou colado), roleta de exemplos, limpeza, envio e a resposta do produto
  pergunta(root, b, t0) {
    // leiaute "lado": coluna da esquerda (título e campo) e da direita (resposta), 760 px cada no 16:9, com 80 entre elas;
    // a 140 px da borda, para o "respira" (até 0,05) não levar o texto para fora dos 5% da área segura
    const LD = LADO ? { x: Math.round(140 * KX), w: Math.round(760 * KX), gap: Math.round(80 * KX), cy: G.cy + 80 } : null
    const tituloEls = b.titulo ? titulo(root, b.titulo, (LD ? LD.cy - G.cy : 0) + G.tituloY - (b.rotulo ? 40 : 0), b.destaque, LD) : []
    const cp = campo(root, { ...b, w: LD ? LD.w : G.campoW })
    const cx0 = LD ? LD.x : (W - cp.w) / 2, cy0 = (LD ? LD.cy : G.cy) - cp.h / 2
    place(cp.box, cx0, cy0)
    // 19:9/21:9: o campo é mais largo, o texto cabe maior e o rótulo em cima dele cresce junto; no topo, o campo
    // desce o que for preciso para o rótulo ficar dentro dos 5% da área segura ("areaSegura": true faz isso em todo formato)
    let topoY = G.topoY
    if ((KX > 1 || PARAMS.areaSegura) && cp.rot && !LD) {
      const rg = document.createRange(); rg.selectNodeContents(cp.rot)
      const acima = Math.min(...[...rg.getClientRects()].map((r) => r.top)) - cy0
      topoY = Math.max(topoY, H * 0.05 + 2 - acima + cp.h / 2)
    }
    const tDig = t0 + (b.em ?? 0.5)
    const tLimpa = b.limpa ? t0 + b.limpa.em : null
    const tEnvia = b.resposta ? t0 + b.resposta.em - 0.35 : null
    cp.sons(tDig)
    if (tLimpa) som(tLimpa + 0.4, 'acento')
    if (tEnvia) som(tEnvia, 'clique')
    // selo de limpeza ("Link limpo ✓") encostado no campo
    let selo = null
    if (b.limpa && b.limpa.selo) {
      selo = el('div', { cls: 'abs', text: '✓ ' + b.limpa.selo, style: { font: fonte(600, Math.round(G.campoFs * 0.6), FT.texto), color: C.sobreDestaque || C.fundo, background: C.ok || C.destaque, borderRadius: '999px', padding: `${G.campoFs * 0.2}px ${G.campoFs * 0.5}px`, whiteSpace: 'nowrap', lineHeight: '1' } }, root)
      const r = selo.getBoundingClientRect()
      place(selo, cx0 + cp.w - r.width - 20, cy0 + cp.h + 22)
      marcar(selo, 'texto', 'badge')
    }
    // roleta de exemplos acima e abaixo do campo, desfocados
    let roleta = null
    if (b.roleta && b.roleta.length) {
      const fR = fonte(500, G.campoFs * 0.86, FT.texto), S = G.campoH * 1.05
      roleta = b.roleta.map((tx, i) => { const d = el('div', { cls: 'line', text: tx, style: { font: fR, color: C.apoio, left: px(cx0 + G.campoH * 0.36) } }, root); marcar(d, false); return d })
    }
    let resp = null, yResp = 0
    if (b.resposta && LD) {   // ao lado do campo: montada numa caixa na coluna da direita e centrada na altura
      const caixa = el('div', { cls: 'abs' }, root)
      resp = b.resposta.tipo === 'numeros' ? respostaNumeros(caixa, b.resposta, 0, 0, LD.w) : respostaCartao(caixa, b.resposta, 0, 0, LD.w)
      const r0 = rectOf(caixa), alto = Math.max(...[...caixa.children].map((c) => { const r = rectOf(c); return r.y + r.h - r0.y }))
      place(caixa, LD.x + LD.w + LD.gap, Math.round((H - alto) / 2))
      resp.sons(t0 + b.resposta.em)
    } else if (b.resposta) {
      const yTop = topoY - cp.h / 2
      yResp = yTop + cp.h + L({ '16x9': 48, '9x16': 70, '1x1': 40 })
      const x0 = (W - G.areaW) / 2
      resp = b.resposta.tipo === 'numeros' ? respostaNumeros(root, b.resposta, x0, yResp, G.areaW) : respostaCartao(root, b.resposta, x0, yResp, G.areaW)
      resp.sons(t0 + b.resposta.em)
    }
    return (t) => {
      const tv = t - t0
      tituloEls.forEach((d, i) => { const k = 1 - E.outCubic(P(t, t0 + b.dur - 0.01, t0 + b.dur)); O(d, 1) })
      // envio: o campo sobe para o topo e o título sai
      const ks = b.resposta && !LD ? E.inOutCubic(P(t, t0 + b.resposta.em - 0.2, t0 + b.resposta.em + 0.45)) : 0
      const yC = lerp(cy0, topoY - cp.h / 2, ks)
      T(cp.box, `translateY(${yC - cy0}px)`)
      tituloEls.forEach((d) => { O(d, 1 - ks); T(d, `translateY(${-ks * 80}px)`) })
      if (selo) { const k = E.outBack(P(t, tLimpa + 0.55, tLimpa + 0.95)); O(selo, Math.min(1, k) * (1 - ks)); T(selo, `translateY(${yC - cy0}px) scale(${0.7 + 0.3 * Math.min(1, k)})`) }
      cp.update(t, tDig, tEnvia, tLimpa)
      if (roleta) {
        const S = G.campoH * 1.05, passo = 0.85, fimR = b.em ?? 0.5
        const kk = Math.min(roleta.length - 1, tv / passo)
        const base = Math.floor(kk), fr = E.inOutCubic(Math.min(1, (kk - base) / 0.45))
        const pos = Math.min(roleta.length - 1, base + fr)
        const sai = P(t, tDig - 0.3, tDig + 0.4)
        roleta.forEach((d, i) => {
          const off = (i - pos) * S
          const dist = Math.abs(off) / S
          const fs = G.campoFs * 0.86
          d.style.top = px(G.cy - fs / 2 + off + (off > 0 ? S * 0.25 : -S * 0.25))
          O(d, (off < S * 0.5 ? 0 : Math.max(0, 0.55 - 0.18 * dist)) * (1 - sai))
          d.style.filter = `blur(${1.5 + dist * 1.6}px)`
        })
      }
      if (resp) resp.update(t, t0 + b.resposta.em)
    }
  },

  // frase: texto grande digitado com cursor, palavra de destaque, pílulas de resposta, apagar opcional
  frase(root, b, t0) {
    const fsz = b.fs ? L(b.fs) : G.fraseFs
    const f = fonte(700, fsz, FT.titulo)
    const ls = quebra(b.texto, f, G.fraseW)
    const lh = fsz * 1.12
    const hTot = ls.length * lh + (b.pilulas ? fsz * 1.3 : 0)
    const y0 = (b.y ? L(b.y) : (VERTICAL ? H * 0.42 : H * 0.44)) - hTot / 2
    const chars = []
    const lines = ls.map((l, i) => {
      const d = el('div', { cls: 'line', style: { font: f, color: C.texto, top: px(y0 + i * lh), left: '0', textTransform: M.caixaAlta ? 'uppercase' : 'none' } }, root)
      for (const w of l.split(/( )/)) {
        if (!w) continue
        const dest = b.destaque && b.destaque.split(' ').includes(w.replace(/[.,!?]/g, ''))
        for (const ch of w) chars.push({ s: el('span', { text: ch, style: { whiteSpace: 'pre', color: dest ? C.destaque : null } }, d), linha: i })
      }
      centrarX(d)
      return d
    })
    const cursor = el('div', { cls: 'abs', style: { width: px(fsz * 0.08), height: px(fsz * 1.0), background: C.destaque } }, root)
    const pos = chars.map((c) => { const r = rectOf(c.s); return { x: r.x + r.w, y: r.y + (r.h - fsz) / 2 } })
    const pos0 = ls.length ? (() => { const r = rectOf(lines[0]); return { x: r.x, y: r.y + (r.h - fsz) / 2 } })() : { x: CX, y: H / 2 }
    const vel = b.vel ?? 16, R = rng(b.semente ?? 5)
    const tempos = []; let acc = 0
    chars.forEach((c) => { tempos.push(acc); acc += (1 / vel) * (0.6 + R() * 0.8) })
    const tDig = t0 + (b.em ?? 0)
    som(tDig, 'digitacao', { dur: acc + 0.05 })
    const pil = (b.pilulas || []).map((p) => {
      const fp = fonte(600, Math.round(fsz * 0.42), FT.texto)
      const nao = p.tipo === 'nao'
      const e = el('div', { cls: 'abs', text: (nao ? '✕ ' : '✓ ') + p.t, style: { font: fp, color: nao ? C.sobreCampo || C.texto : C.sobreDestaque || C.fundo, background: nao ? C.campo : C.destaque, border: borda(2, nao ? C.borda : C.destaque), borderRadius: '999px', padding: `${fsz * 0.14}px ${fsz * 0.36}px`, whiteSpace: 'nowrap', lineHeight: '1', textDecoration: nao ? 'line-through' : 'none' } }, root)
      marcar(e, 'texto', p.t)
      return e
    })
    let px0 = 0; const gap = 18
    const larg = pil.map((e) => e.getBoundingClientRect().width), tot = larg.reduce((s, w) => s + w, 0) + gap * Math.max(0, pil.length - 1)
    pil.forEach((e, i) => { place(e, (W - tot) / 2 + px0, y0 + ls.length * lh + fsz * 0.35); px0 += larg[i] + gap })
    const tPil = tDig + acc + 0.25
    pil.forEach((_, i) => som(tPil + i * 0.22, 'toque'))
    const tApaga = b.apaga ? t0 + b.dur - 0.9 : null
    return (t) => {
      const tv = t - tDig
      let n = tempos.filter((x) => x <= tv).length
      if (tApaga) n = Math.round(n * (1 - P(t, tApaga, tApaga + 0.5)))
      chars.forEach((c, i) => O(c.s, i < n ? 1 : 0))
      const p = n ? pos[n - 1] : pos0
      cursor.style.left = px(p.x + fsz * 0.04); cursor.style.top = px(p.y)
      O(cursor, tv >= 0 && tv < acc + 0.1 ? 1 : pisca(t))
      pil.forEach((e, i) => { const k = E.outBack(P(t, tPil + i * 0.22, tPil + i * 0.22 + 0.45), 2.2); O(e, Math.min(1, P(t, tPil + i * 0.22, tPil + i * 0.22 + 0.2)) * (tApaga ? 1 - P(t, tApaga - 0.2, tApaga) : 1)); T(e, `scale(${0.5 + 0.5 * k})`) })
    }
  },

  // fecho: o endereço se digita no campo, o campo vira o logo, e o bordão fica
  fecho(root, b, t0) {
    if (b.fundo) camada(root, b.fundo)   // opcional: o fecho com fundo próprio (ex.: um fundo claro para o logo, num vídeo de outra cor)
    const cp = b.digita ? campo(root, { texto: b.digita, mono: true, w: Math.min(G.campoW, VERTICAL ? 860 : 900 * KX), botao: false, vel: b.vel ?? 18, semente: 9 }) : null
    if (cp) place(cp.box, (W - cp.w) / 2, G.cy - cp.h / 2 - L({ '16x9': 60, '9x16': 80, '1x1': 40 }))
    const tDig = t0 + (b.em ?? 0.2)
    if (cp) cp.sons(tDig)
    const tLogo = t0 + (b.logoEm ?? (cp ? (b.em ?? 0.2) + cp.durDigita + 0.6 : 0.3))
    som(tLogo, 'whoosh', { variante: 'medio' })
    const lg = el('div', { cls: 'abs' }, root)
    // fecho só com o logo (sem campo, bordão nem endereço): o logo no centro do quadro
    const soLogo = !cp && !b.bordao && !b.endereco
    const yL = soLogo ? (H - G.logoH) / 2 : G.cy - G.logoH / 2 - L({ '16x9': 70, '9x16': 110, '1x1': 50 })
    if (M.logo && M.logo.arquivo) {
      const img = imagem(lg, 'media/' + M.logo.arquivo, { height: px(G.logoH), width: 'auto', position: 'absolute', left: '0', top: '0' })
      const ww = G.logoH * (M.logo.proporcao || 4)
      place(lg, (W - ww) / 2, yL); img.style.width = px(ww)
      marcar(img, 'logo', M.nome)
    } else {
      const d = el('div', { cls: 'line', text: (M.logo && M.logo.texto) || M.nome, style: { font: fonte(800, G.logoH, FT.titulo), color: C.texto, letterSpacing: '-0.02em', top: '0', left: '0' } }, lg)
      if (M.logo && M.logo.ponto) el('span', { text: M.logo.ponto, style: { color: C.destaque } }, d)
      place(lg, 0, yL); centrarX(d)
      marcar(d, 'logo', M.nome)
    }
    const bord = b.bordao ? el('div', { cls: 'line', text: b.bordao, style: { font: fonte(600, L({ '16x9': 54, '9x16': 60, '1x1': 50 }), FT.texto), color: C.texto, top: px(yL + G.logoH + L({ '16x9': 56, '9x16': 70, '1x1': 50 })), left: '0' } }, root) : null
    if (bord) { centrarX(bord); marcar(bord, 'texto', 'tagline') }
    const end = b.endereco ? el('div', { cls: 'line', text: b.endereco, style: { font: fonte(500, L({ '16x9': 34, '9x16': 40, '1x1': 32 }), FT.mono || FT.texto), color: C.destaque, top: px(yL + G.logoH + L({ '16x9': 150, '9x16': 175, '1x1': 135 })), left: '0', letterSpacing: '0.04em' } }, root) : null
    if (end) { centrarX(end); marcar(end, 'texto', 'address') }
    return (t) => {
      if (cp) {
        cp.update(t, tDig, null, null)
        const k = E.inOutCubic(P(t, tLogo - 0.25, tLogo + 0.25))
        O(cp.box, 1 - k); T(cp.box, `scale(${1 - 0.15 * k}) translateY(${-30 * k}px)`)
      }
      const k = E.outBack(P(t, tLogo, tLogo + 0.6), 1.6)
      O(lg, P(t, tLogo, tLogo + 0.25)); T(lg, `scale(${0.85 + 0.15 * k})`)
      if (bord) sobeEm(bord, t, tLogo + 0.35, 30)
      if (end) sobeEm(end, t, tLogo + 0.55, 20)
    }
  },
}

// ── monta a linha do tempo ──────────────────────────────────────────────────────────────────────────────
{
  let t0 = 0
  PARAMS.cenas.forEach((b, i) => {
    const a = t0, fim = a + b.dur, ultimo = i === PARAMS.cenas.length - 1
    if (!BLOCO[b.tipo]) throw new Error(`unknown block: ${b.tipo} (use pergunta, frase or fecho)`)
    cena(a, fim + (PASSA && !ultimo ? PASSA.dur : 0), (root) => {
      // com passagem, o bloco tem o fundo próprio (a transição leva a tela inteira) e fica PASSA.dur a mais, saindo
      const wrap = el('div', { cls: 'layer', style: PASSA ? { background: C.fundo } : {} }, root)
      // "respira" (0 = parada, o padrão): a câmera chega perto devagar, o bloco cresce essa fração do começo ao fim,
      // a partir do topo (o que está em cima fica dentro da área segura); o fecho não respira, o logo fica parado
      const respira = b.tipo === 'fecho' ? 0 : PARAMS.respira || 0
      if (respira) wrap.style.transformOrigin = '50% 0'
      const up = BLOCO[b.tipo](wrap, b, a)
      return (t) => {
        up(t)
        if (PASSA) {
          if (respira) T(wrap, `scale(${1 + respira * P(t, a, fim)})`)
          if (i > 0) TR[PASSA.tipo].entra(wrap, t, a, PASSA.dur, OP_PASSA)
          if (!ultimo) TR[PASSA.tipo].sai(wrap, t, fim, PASSA.dur, OP_PASSA)
          return
        }
        // passagem: o bloco sai subindo e desfocando nos últimos 0,35 s; o próximo entra limpo
        const ks = ultimo ? 0 : E.inCubic(P(t, fim - 0.35, fim))
        O(wrap, 1 - ks); T(wrap, `translateY(${-50 * ks}px)${respira ? ` scale(${1 + respira * P(t, a, fim)})` : ''}`); wrap.style.filter = ks > 0 ? `blur(${ks * 10}px)` : ''
        const ke = i === 0 ? 1 : E.outCubic(P(t, a, a + 0.3))
        if (ks === 0) { O(wrap, ke); wrap.style.filter = ke < 1 ? `blur(${(1 - ke) * 8}px)` : '' }
      }
    }, b.tipo + '-' + (i + 1))
    if (i > 0) som(a - 0.05, 'whoosh', { variante: 'curto' })
    t0 = fim
  })
  if (PARAMS.falas && PARAMS.falas.length) cena(0, TOTAL, (root) => legenda(root), 'captions')
}
