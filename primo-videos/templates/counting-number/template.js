/* Molde "número que conta". Nenhuma marca aqui dentro: cores, fontes, logo, textos e números vêm de PARAMS.
 * Blocos: contador (número sozinho → rótulo → lista que rola), cartoes (2–4 números em cartões de cor),
 * before-after (etiqueta "nome  antigo → novo" com barra), refrao (o número repetido em faixas), fecho.
 * Por cima de tudo: a chamada do quadro 0 (a promessa escrita) e a legenda da fala, palavra por palavra. */
const MC = PARAMS.marca.cores, MF = PARAMS.marca.fontes
const FMT_Q = FMT === '1x1' || FMT === '4x5'
const LF = (h, v, q = h) => (VERTICAL ? v : FMT_Q ? q : h)
const fonte = (f, px, peso) => `${peso || f.peso || 700} ${px}px "${f.familia}"`
const fNum = (px) => fonte(MF.numero, px)
const fTxt = (px, peso) => fonte(MF.texto, px, peso || MF.texto.peso || 500)
const fEtq = (px) => fonte(MF.etiqueta || MF.texto, px, (MF.etiqueta || {}).peso || 600)
const CAIXA = (s) => (MF.numero.caixaAlta ? String(s).toUpperCase() : s)
// opções desligadas por padrão: marca.fontes.texto.pesoRotulo (peso do rótulo; 600 sem ela), marca.simbolo (o símbolo
// gigante e recortado no fundo, girando devagar), passagem (a troca entre blocos pelo TR do motor), camera.zoom (cada
// bloco aproxima devagar) e, no bloco cartoes, entrada (whip ou push no lugar da tinta que abre de um canto)
const PESO_ROT = MF.texto.pesoRotulo || 600
const PASSA = PARAMS.passagem && TR[PARAMS.passagem.tipo] ? { dur: 0.45, ...PARAMS.passagem } : null
const OP_PASSA = PASSA ? (({ tipo, dur, ...o }) => o)(PASSA) : null   // dir, blur… vão para o TR
const CAM = PARAMS.camera && PARAMS.camera.zoom ? PARAMS.camera : null
// o bloco sai subindo e apagando nos últimos d s; com passagem, quem tira o bloco é a transição
const saida = (t, b, d) => (PASSA ? 0 : E.inCubic(P(t, b.t1 - d, b.t1)))

// o que o 19:9 e o 21:9 têm de largura a mais que o 16:9 (0 no 16:9 e nos outros formatos)
const SOBRA = HORIZONTAL ? W - 1920 : 0
// área livre para o conteúdo (a faixa de baixo é da legenda); no horizontal, a margem é uma fração da largura
const MX = Math.round((W * 110) / 1920)
const AREA = LF({ x0: MX, x1: W - MX, y0: 150, y1: 860 }, { x0: 140, x1: 940, y0: 300, y1: 1250 }, { x0: 90, x1: 990, y0: 150, y1: 880 })
AREA.w = AREA.x1 - AREA.x0; AREA.h = AREA.y1 - AREA.y0; AREA.cx = (AREA.x0 + AREA.x1) / 2; AREA.cy = (AREA.y0 + AREA.y1) / 2

const _cv = document.createElement('canvas').getContext('2d')
const largura = (texto, font, espaco = 0) => { _cv.font = font; return _cv.measureText(texto).width + espaco * texto.length }
/** maior corpo (até max) em que o texto cabe na largura w */
const caber = (texto, fn, w, max) => Math.min(max, Math.floor((max * w) / largura(texto, fn(max))))

function lum(hex) {
  const [r, g, b] = hex2rgb(hex).map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4 })
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}
const contraste = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05) }
/** texto legível sobre um fundo: a cor de texto da marca ou a de fundo, a que tiver mais contraste */
const tintaSobre = (fundo) => (contraste(MC.texto, fundo) >= contraste(MC.fundo, fundo) ? MC.texto : MC.fundo)

/** número no formato do idioma: em inglês (padrão) 7199 → "7,199" e 2.6 → "2.6"; com "idioma": "pt-BR", "7.199" e "2,6" */
const PT = /^pt/i.test(PARAMS.idioma || 'en-US')
function numBR(v, casas = 0, milhar = PARAMS.milhar ?? (PT ? '.' : ',')) {
  const [i, d] = Math.abs(v).toFixed(casas).split('.')
  const int = i.replace(/\B(?=(\d{3})+(?!\d))/g, milhar)
  return (v < 0 ? '−' : '') + int + (d ? (PT ? ',' : '.') + d : '')
}

/** número com prefixo/sufixo em cor de destaque; devolve { e, set(v) } */
function numero(parent, cfg, corpo, cor) {
  const e = el('div', { cls: 'abs', style: { font: fNum(corpo), color: cor, whiteSpace: 'nowrap', lineHeight: 'normal', fontVariantNumeric: 'tabular-nums', letterSpacing: (MF.numero.espaco || 0) + 'em' } }, parent)
  const pre = cfg.prefixo ? el('span', { text: cfg.prefixo, style: { color: MC.acento, fontSize: '0.55em', verticalAlign: '0.62em', marginRight: '0.06em' } }, e) : null
  const n = el('span', {}, e)
  const suf = cfg.sufixo ? el('span', { text: cfg.sufixo, style: { color: MC.acento, ...(cfg.sufixo.length > 1 ? { fontSize: '0.4em', marginLeft: '0.12em' } : {}) } }, e) : null
  marcar(e, 'texto', 'number')
  return { e, n, pre, suf, set: (v) => { n.textContent = numBR(v, cfg.casas || 0) } }
}
const textoNum = (cfg, v) => (cfg.prefixo || '') + numBR(v ?? cfg.ate, cfg.casas || 0) + (cfg.sufixo || '')

// ---------- fundo único (o corte entre blocos não aparece) ----------
cena(0, VIDEO.duracao, (root) => {
  const c = camada(root, MC.fundo)
  const brilho = el('div', { cls: 'layer', style: { background: `radial-gradient(${LF(`${1100 + SOBRA / 2}px 800px`, '1000px 1100px', '900px 800px')} at ${AREA.cx}px ${AREA.cy}px, ${rgba(MC.acento, PARAMS.marca.brilho ?? 0.12)}, transparent 70%)` } }, c)
  if (PARAMS.marca.grade) el('div', { cls: 'layer', style: {
    backgroundImage: `linear-gradient(${rgba(MC.texto, 0.035)} 1px, transparent 1px), linear-gradient(90deg, ${rgba(MC.texto, 0.035)} 1px, transparent 1px)`,
    backgroundSize: '64px 64px', backgroundPosition: `${(W / 2) % 64}px ${(H / 2) % 64}px` } }, c)
  // símbolo gigante (o PNG da marca, sem recolorir): centro em (x·W, y·H), altura em px, `gira` graus por segundo
  const S = PARAMS.marca.simbolo
  const simb = S ? imagem(c, S.arquivo, { height: px(S.altura), width: px(S.altura * (S.proporcao || 1)), left: px(S.x * W - (S.altura * (S.proporcao || 1)) / 2), top: px(S.y * H - S.altura / 2) }) : null
  return (t) => { O(brilho, 0.75 + 0.25 * Math.sin(t * 0.9)); if (simb) T(simb, `rotate(${(S.gira || 0) * t}deg)`) }
})

// ---------- blocos ----------
const BLOCOS = {
  contador(root, b) {
    const t0 = b.t0, tRot = t0 + (b.sozinho ?? 1.6), temLista = b.lista && b.lista.length
    const cor = MC.texto
    // fase A: o número sozinho, o maior que cabe
    const final = textoNum(b)
    // zona do número sozinho: abaixo da chamada, acima da legenda
    const ZA = LF({ y0: 140, y1: 1010 }, { y0: 330, y1: 1250 }, { y0: 130, y1: 960 })
    let corpoA = caber(final, fNum, AREA.w * LF(0.86, 0.9, 0.9), LF(760, 640, 560))
    const N = numero(root, b, corpoA, cor)
    N.set(b.ate)
    let rA = rectOf(N.e)
    if (rA.h > ZA.y1 - ZA.y0) { corpoA = Math.floor(corpoA * (ZA.y1 - ZA.y0) / rA.h); N.e.style.font = fNum(corpoA); rA = rectOf(N.e) }
    const xA = AREA.cx - rA.w / 2, yA = (ZA.y0 + ZA.y1) / 2 - rA.h / 2
    // largura do valor final, centrado: enquanto conta, o número não corre para o lado
    N.e.style.width = px(Math.ceil(rA.w)); N.e.style.textAlign = 'center'
    place(N.e, xA, yA)
    // fase B: o número encolhe e abre espaço para o rótulo (e a lista)
    const kB = temLista ? LF(0.5, 0.5, 0.5) : LF(0.62, 0.66, 0.62)
    const rotPx = Math.min(LF(76, 72, 64), caber(b.rotulo, (p) => fTxt(p, PESO_ROT), AREA.w * (temLista && !VERTICAL ? 0.4 : 0.92), 76))
    const rot = textLine(root, [{ t: b.rotulo }], { font: fTxt(rotPx, PESO_ROT), color: MC.texto })
    const rr = rectOf(rot.line)
    let xB, yB, rotX, rotY
    const wB = rA.w * kB, hB = rA.h * kB
    if (temLista && !VERTICAL) {            // 16:9 e 1:1 → número à esquerda, lista à direita
      xB = AREA.x0 + LF(40, 0, 0); yB = AREA.cy - (hB + rr.h + 24) / 2
      rotX = xB + 8; rotY = yB + hB + 24
    } else {                                  // 9:16 (ou sem lista) → número em cima, rótulo embaixo
      xB = AREA.cx - wB / 2; yB = temLista ? AREA.y0 + 10 : AREA.cy - (hB + rr.h + 30) / 2
      rotX = AREA.cx - rr.w / 2; rotY = yB + hB + 26
    }
    place(rot.line, rotX, rotY)
    // lista que rola
    let lista = null
    if (temLista) {
      const itemPx = LF(58, 62, 48), lh = Math.round(itemPx * 1.42), vis = LF(7, 5, 6)
      // nos largos, metade da sobra vai entre o número e a lista (a outra metade fica à direita dela)
      const lx = VERTICAL ? AREA.x0 : Math.max(xB + wB, rotX + rr.w) + LF(110, 0, 60) + SOBRA / 2
      const ly = VERTICAL ? rotY + rr.h + 50 : AREA.cy - (vis * lh) / 2
      const lw = VERTICAL ? AREA.w : AREA.x1 - lx
      const caixa = el('div', { cls: 'abs', style: { left: px(lx), top: px(ly), width: px(lw), height: px(vis * lh), overflow: 'hidden',
        maskImage: `linear-gradient(transparent, #000 ${100 / vis}%, #000 ${100 - 100 / vis}%, transparent)`, webkitMaskImage: `linear-gradient(transparent, #000 ${100 / vis}%, #000 ${100 - 100 / vis}%, transparent)` } }, root)
      const trilho = el('div', { cls: 'abs', style: { width: px(lw) } }, caixa)
      const itens = b.lista.map((s, i) => el('div', { cls: 'abs', text: s, style: { top: px(i * lh), left: '0', width: px(lw), height: px(lh), lineHeight: px(lh), font: fTxt(itemPx, 500),
        color: MC.texto, whiteSpace: 'nowrap', textAlign: VERTICAL ? 'center' : 'left' } }, trilho))
      if (PARAMS.lista_numerada !== false) itens.forEach((e, i) => { e.textContent = ''; el('span', { text: String(i + 1).padStart(2, '0') + '  ', style: { font: fEtq(itemPx * 0.62), color: MC.acento, verticalAlign: '0.12em' } }, e); el('span', { text: b.lista[i] }, e) })
      const ini = tRot + 0.35, fim = b.t1 - 0.7
      lista = { caixa, trilho, itens, lh, vis, ini, fim }
    }
    // chamada (a promessa do quadro 0) só no primeiro bloco: a camada de cima cuida dela
    return (t) => {
      const pc = P(t, t0 + 0.05, t0 + (b.conta ?? 1.35))
      const v = lerp(b.de ?? 0, b.ate, E.outExpo(pc))
      N.set(b.casas ? v : Math.round(v))
      const vel = pc < 1 ? (1 - E.outExpo(pc)) : 0
      N.e.style.filter = vel > 0.02 ? `blur(${(vel * 5).toFixed(2)}px)` : 'none'
      const pb = E.inOutCubic(P(t, tRot, tRot + 0.6))
      const k = lerp(1, kB, pb)
      T(N.e, `translate(${lerp(xA, xB, pb) - xA}px, ${lerp(yA, yB, pb) - yA}px) scale(${k})`)
      N.e.style.transformOrigin = '0 0'
      // pulso no fim da contagem
      const pl = t - (t0 + (b.conta ?? 1.35))
      if (pl > 0 && pl < 0.5 && pb === 0) T(N.e, `scale(${1 + 0.035 * Math.sin(Math.PI * pl / 0.5)})`)
      riseWords(rot.words, t, tRot + 0.3, 0.07)
      if (lista) {
        const pe = E.outCubic(P(t, lista.ini, lista.ini + 0.5))
        O(lista.caixa, pe)
        const ic = (lista.itens.length - 1) * E.inOutCubic(P(t, lista.ini, lista.fim))
        T(lista.trilho, `translateY(${(1 - pe) * 60 + (lista.vis * lista.lh) / 2 - (ic * lista.lh + lista.lh / 2)}px)`)
        lista.itens.forEach((e, i) => {
          const a = clamp(1 - Math.abs(i - ic))
          e.style.color = a > 0.5 ? MC.acento : MC.texto
          O(e, 0.42 + 0.58 * a)
        })
      }
      const ps = saida(t, b, 0.35)
      T(root, `translateY(${-30 * ps}px)`); O(root, 1 - ps)
    }
  },

  cartoes(root, b) {
    const cada = b.cada || 1.5, pal = MC.cartoes && MC.cartoes.length ? MC.cartoes : [MC.acento]
    const cams = b.itens.map((it, i) => {
      const fundo = it.cor || pal[i % pal.length], tinta = it.tinta || tintaSobre(fundo)
      const c = camada(root, fundo)
      const numPx = caber(textoNum(it, it.valor), fNum, AREA.w * 0.9, LF(400, 420, 340))
      const N = numero(c, { ...it, ate: it.valor }, numPx, tinta)
      if (N.pre) N.pre.style.color = tinta
      if (N.suf) N.suf.style.color = tinta
      N.set(it.valor)
      const rn = rectOf(N.e)
      const rotPx = LF(78, 76, 66)
      const linhas = VERTICAL && largura(it.rotulo, fTxt(rotPx, PESO_ROT)) > AREA.w ? quebrar(it.rotulo, fTxt(rotPx, PESO_ROT), AREA.w) : [it.rotulo]
      const ls = bloco(c, linhas.map((s) => [{ t: s }]), { top: 0, entrelinha: rotPx * 1.15, style: { font: fTxt(rotPx, PESO_ROT), color: tinta } })
      const hRot = linhas.length * rotPx * 1.15
      const yN = AREA.cy - (rn.h + 20 + hRot) / 2
      place(N.e, AREA.cx - rn.w / 2, yN)
      ls.forEach((l, j) => { l.line.style.top = px(yN + rn.h + 20 + j * rotPx * 1.15); centrarX(l.line, AREA.cx) })
      const e0 = b.t0 + 0.05 + i * cada
      // origem da tinta: um canto diferente por cartão
      const ox = [W * 0.15, W * 0.85, W * 0.5, W * 0.1][i % 4], oy = [H * 0.9, H * 0.1, H * 1.05, H * 0.2][i % 4]
      return { c, N, it, ls, e0, ox, oy }
    })
    // entrada: 'whip' ou 'push' (o TR do motor) no lugar da tinta; com passagem, o 1º cartão já chega com o bloco
    const ENT = b.entrada && TR[b.entrada] ? b.entrada : null, oEnt = { dir: b.dir || 'esquerda' }
    return (t) => {
      cams.forEach(({ c, N, it, ls, e0, ox, oy }, i) => {
        const prox = cams[i + 1]
        if (ENT) {
          const jaEsta = i === 0 && PASSA
          c.style.display = (jaEsta || t >= e0) && !(prox && t >= prox.e0 + 0.42) ? 'block' : 'none'
          if (!jaEsta) TR[ENT].entra(c, t, e0, 0.42, oEnt)
          if (prox) TR[ENT].sai(c, t, prox.e0, 0.42, oEnt)
        } else {
          const pe = E.inOutCubic(P(t, e0, e0 + 0.42))
          c.style.display = t >= e0 && !(prox && t >= prox.e0 + 0.42) ? 'block' : 'none'
          iris(c, raioCobre(ox, oy) * pe, ox, oy)
        }
        const pc = P(t, e0 + 0.12, e0 + 0.8)
        N.set(it.casas ? lerp(it.de ?? 0, it.valor, E.outExpo(pc)) : Math.round(lerp(it.de ?? 0, it.valor, E.outExpo(pc))))
        T(N.e, `translateY(${(1 - E.outExpo(P(t, e0 + 0.1, e0 + 0.6))) * 40}px)`)
        riseWords(palavras(ls), t, e0 + 0.32, 0.06)
      })
    }
  },

  'before-after'(root, b) {
    const t0 = b.t0
    const nomePx = LF(46, 44, 40)
    const nome = textLine(root, [{ t: b.nome.toUpperCase() }], { font: fEtq(nomePx), color: MC.acento, letterSpacing: '.12em' })
    const velhoTxt = textoNum({ ...b, prefixo: '' , sufixo: '' }, b.de) + (b.unidade ? ' ' + b.unidade : '')
    const novoTxt = textoNum({ ...b, prefixo: '', sufixo: '' }, b.ate) + (b.unidade ? ' ' + b.unidade : '')
    const velhoPx = caber(velhoTxt, fNum, LF(620, 760, 600), LF(170, 150, 140))
    const novoPx = caber(novoTxt, fNum, LF(780, 800, 620), LF(250, 210, 190))
    const velho = el('div', { cls: 'abs', text: velhoTxt, style: { font: fNum(velhoPx), color: MC.texto, whiteSpace: 'nowrap', lineHeight: 'normal', fontVariantNumeric: 'tabular-nums' } }, root)
    const novo = el('div', { cls: 'abs', style: { font: fNum(novoPx), color: MC.acento, whiteSpace: 'nowrap', lineHeight: 'normal', fontVariantNumeric: 'tabular-nums' } }, root)
    const novoN = el('span', { text: numBR(b.ate, b.casas || 0) }, novo)
    if (b.unidade) el('span', { text: ' ' + b.unidade }, novo)
    marcar(novo, 'texto', 'new value')
    const rv = rectOf(velho), rn = rectOf(novo), rnm = rectOf(nome.line)
    const s = svgQuadro(root)
    const barH = LF(22, 22, 20), barW = LF(1300 + SOBRA / 2, 760, 820)
    let yNome, vx, vy, nx, ny, seta, barX, barY
    if (!VERTICAL) {
      const gap = LF(230 + SOBRA / 2, 0, 150), tot = rv.w + gap + rn.w
      yNome = AREA.y0 + LF(70, 0, 40)
      const yMid = AREA.cy - 30
      vx = AREA.cx - tot / 2; vy = yMid - rv.h / 2 + (rn.h - rv.h) * 0.3
      nx = vx + rv.w + gap; ny = yMid - rn.h / 2
      const ax = vx + rv.w + gap * 0.22, bx = nx - gap * 0.22, ay = yMid
      seta = sv('path', { d: `M ${ax} ${ay} L ${bx} ${ay} M ${bx - 26} ${ay - 22} L ${bx} ${ay} L ${bx - 26} ${ay + 22}`, fill: 'none', stroke: MC.acento, 'stroke-width': 9, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, s)
      barX = AREA.cx - barW / 2; barY = ny + rn.h + LF(80, 0, 70)
    } else {
      yNome = AREA.y0 + 20
      vx = AREA.cx - rv.w / 2; vy = yNome + rnm.h + 50
      const ay = vy + rv.h + 30, by = ay + 130
      seta = sv('path', { d: `M ${AREA.cx} ${ay} L ${AREA.cx} ${by} M ${AREA.cx - 24} ${by - 26} L ${AREA.cx} ${by} L ${AREA.cx + 24} ${by - 26}`, fill: 'none', stroke: MC.acento, 'stroke-width': 9, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, s)
      nx = AREA.cx - rn.w / 2; ny = by + 20
      barX = AREA.cx - barW / 2; barY = ny + rn.h + 40
    }
    place(nome.line, AREA.cx - rnm.w / 2, yNome)
    place(velho, vx, vy); place(novo, nx, ny)
    marcar(velho, 'texto', 'old value')
    const desenhaSeta = traco(seta)
    const risco = sv('line', { x1: vx - 10, y1: vy + rv.h * 0.55, x2: vx + rv.w + 10, y2: vy + rv.h * 0.55, stroke: MC.acento, 'stroke-width': 8, 'stroke-linecap': 'round' }, s)
    const desenhaRisco = traco(risco)
    // barras: a antiga cheia (apagada), a nova encolhe até a proporção
    const barra = (y, cor, a) => el('div', { cls: 'abs', style: { left: px(barX), top: px(y), width: px(barW), height: px(barH), borderRadius: px(barH / 2), background: cor, opacity: a, transformOrigin: '0 50%' } }, root)
    const bVelha = barra(barY, MC.texto, 0.22), bNova = barra(barY + barH + 16, MC.acento, 1)
    const fator = b.ate / b.de
    let chip = null
    if (b.rotulo) {
      const chipPx = LF(46, 46, 40)
      chip = el('div', { cls: 'abs', text: b.rotulo, style: { font: fTxt(chipPx, 700), color: tintaSobre(MC.acento), background: MC.acento, padding: `${chipPx * 0.32}px ${chipPx * 0.6}px`, borderRadius: px(chipPx), whiteSpace: 'nowrap' } }, root)
      const rc = rectOf(chip)
      // no 9:16 o rótulo fica ao lado da seta (embaixo das barras ele bateria na legenda)
      place(chip, VERTICAL ? AREA.cx + 50 : nx + rn.w - rc.w, VERTICAL ? vy + rv.h + 95 - rc.h / 2 : ny - rc.h - 24)
      marcar(chip, 'texto', 'label')
    }
    return (t) => {
      riseWords(nome.words, t, t0 + 0.05, 0.05)
      const pv = E.outExpo(P(t, t0 + 0.1, t0 + 0.6))
      O(velho, pv * lerp(1, 0.42, E.inOutCubic(P(t, t0 + 0.75, t0 + 1.1)))); T(velho, `translateY(${(1 - pv) * 40}px)`)
      desenhaRisco(E.inOutCubic(P(t, t0 + 0.7, t0 + 0.95)))
      O(risco, P(t, t0 + 0.7, t0 + 0.72))
      desenhaSeta(E.inOutCubic(P(t, t0 + 0.85, t0 + 1.25)))
      const pn = P(t, t0 + 1.05, t0 + 2.1)
      O(novo, E.outCubic(P(t, t0 + 1.0, t0 + 1.25)))
      const v = lerp(b.de, b.ate, E.outCubic(pn))
      novoN.textContent = numBR(b.casas ? v : Math.round(v), b.casas || 0)
      O(bVelha, 0.22 * E.outCubic(P(t, t0 + 0.2, t0 + 0.6)))
      O(bNova, E.outCubic(P(t, t0 + 0.2, t0 + 0.6)))
      T(bNova, `scaleX(${lerp(1, fator, E.outCubic(pn))})`)
      if (chip) { const sp = spring(t - (t0 + 2.15), 2.2, 0.5); O(chip, t > t0 + 2.15 ? 1 : 0); T(chip, `scale(${0.6 + 0.4 * sp})`); chip.style.transformOrigin = VERTICAL ? '50% 50%' : '100% 100%' }
      const ps = saida(t, b, 0.35)
      T(root, `translateY(${-30 * ps}px)`); O(root, 1 - ps)
    }
  },

  refrao(root, b) {
    const txt = (b.texto || textoNum(b)).toUpperCase() + '   ·   '
    const linhas = LF(5, 7, 5), fpx = Math.round(AREA.h / linhas * 0.86)
    const passo = (H - 2 * LF(40, 120, 40)) / linhas
    const faixas = []
    const meio = Math.floor(linhas / 2)
    for (let i = 0; i < linhas; i++) {
      const cheio = i === meio
      const e = el('div', { cls: 'abs', text: txt.repeat(8), style: { top: px(LF(40, 120, 40) + i * passo + (passo - fpx) / 2), left: '0', font: fNum(fpx), lineHeight: '1', whiteSpace: 'nowrap',
        color: cheio ? MC.acento : 'transparent', webkitTextStroke: cheio ? '0' : `2px ${rgba(MC.texto, 0.35)}` } }, root)
      faixas.push({ e, w: largura(txt, fNum(fpx)), dir: i % 2 ? 1 : -1, cheio })
    }
    return (t) => {
      const lt = t - b.t0
      faixas.forEach((f, i) => {
        const x = -f.w + f.dir * (lt * 260 + i * 90) % f.w
        T(f.e, `translateX(${x}px)`)
        O(f.e, E.outCubic(P(t, b.t0 + i * 0.04, b.t0 + 0.3 + i * 0.04)))
      })
      const ps = saida(t, b, 0.3); O(root, 1 - ps)
    }
  },

  fecho(root, b) {
    const t0 = b.t0
    if (b.fundo) camada(root, b.fundo)
    let logo = null, rl = null
    const lgW = LF(620, 640, 560)
    if (PARAMS.marca.logo) {
      logo = imagem(root, PARAMS.marca.logo, { width: px(lgW) })
      rl = { w: lgW, h: lgW / (PARAMS.marca.logoProporcao || 4) }
    } else {
      const lpx = caber(PARAMS.marca.nome, fNum, lgW, LF(150, 140, 120))
      logo = el('div', { cls: 'abs', text: CAIXA(PARAMS.marca.nome), style: { font: fNum(lpx), color: MC.texto, whiteSpace: 'nowrap', lineHeight: 'normal' } }, root)
      rl = rectOf(logo)
    }
    marcar(logo, 'logo', PARAMS.marca.nome)
    const bpx = LF(66, 62, 54)
    const linhas = !b.bordao ? [] : largura(b.bordao, fTxt(bpx, 600)) > AREA.w * 0.95 ? quebrar(b.bordao, fTxt(bpx, 600), AREA.w * 0.95) : [b.bordao]
    const ls = bloco(root, linhas.map((s) => [{ t: s }]), { top: 0, entrelinha: bpx * 1.2, style: { font: fTxt(bpx, 600), color: MC.texto } })
    const upx = LF(44, 44, 40)
    const url = b.url ? textLine(root, [{ t: b.url }], { font: fEtq(upx), color: MC.acento, letterSpacing: '.04em' }) : null
    // só o logo (sem bordão nem endereço): centrado na área, sem reservar a linha do bordão
    const hTot = rl.h + (linhas.length || url ? 70 : 0) + linhas.length * bpx * 1.2 + (url ? 40 + upx : 0)
    const y0 = AREA.cy - hTot / 2
    place(logo, AREA.cx - rl.w / 2, y0)
    ls.forEach((l, j) => { l.line.style.top = px(y0 + rl.h + 70 + j * bpx * 1.2); centrarX(l.line, AREA.cx) })
    if (url) { url.line.style.top = px(y0 + rl.h + 70 + linhas.length * bpx * 1.2 + 40); centrarX(url.line, AREA.cx) }
    return (t) => {
      const sp = spring(t - t0, 1.8, 0.55)
      O(logo, E.outCubic(P(t, t0, t0 + 0.25))); T(logo, `scale(${0.85 + 0.15 * sp})`); logo.style.transformOrigin = '50% 50%'
      riseWords(palavras(ls), t, t0 + 0.35, 0.06)
      if (url) riseWords(url.words, t, t0 + 0.75, 0.05)
    }
  },
}

function quebrar(texto, font, w) {
  const out = []; let cur = ''
  for (const p of texto.split(' ')) { const n = cur ? cur + ' ' + p : p; if (largura(n, font) > w && cur) { out.push(cur); cur = p } else cur = n }
  if (cur) out.push(cur)
  return out
}

// cada bloco desenha numa div própria: o root da cena fica livre para o motor (tremor, transições)
// passagem: o bloco que sai fica PASSA.dur a mais no quadro, saindo, enquanto o próximo entra; câmera: o bloco cresce
// de (1 − camera.zoom) até o tamanho normal, do começo ao fim, a partir de camera.origem ([x, y] em fração do quadro;
// o centro da área sem ela): a câmera chega perto e nada sai da área que o leiaute já respeita
for (const b of LINHA) {
  const ultimo = b.i === LINHA.length - 1
  if (!PASSA && !CAM) { cena(b.t0, b.t1 + (ultimo ? 0.001 : 0), (root) => BLOCOS[b.tipo](el('div', { cls: 'layer' }, root), b)); continue }
  cena(b.t0, b.t1 + (ultimo ? 0.001 : PASSA ? PASSA.dur : 0), (root) => {
    const vai = el('div', { cls: 'layer' }, root), perto = el('div', { cls: 'layer' }, vai)
    const up = BLOCOS[b.tipo](el('div', { cls: 'layer' }, perto), b)
    const zoom = CAM && b.tipo !== 'fecho' ? CAM.zoom : 0
    if (zoom) perto.style.transformOrigin = CAM.origem ? `${CAM.origem[0] * W}px ${CAM.origem[1] * H}px` : `${AREA.cx}px ${AREA.cy}px`
    return (t) => {
      up(t)
      if (zoom) T(perto, `scale(${1 - zoom * (1 - E.inOutSine(P(t, b.t0, b.t1)))})`)   // de 1 − zoom até o tamanho do leiaute: nada passa da área
      if (PASSA && b.i > 0) TR[PASSA.tipo].entra(vai, t, b.t0, PASSA.dur, OP_PASSA)
      if (PASSA && !ultimo) TR[PASSA.tipo].sai(vai, t, b.t1, PASSA.dur, OP_PASSA)
    }
  })
}

// ---------- por cima: chamada do quadro 0 e legenda ----------
cena(0, VIDEO.duracao, (root) => {
  // chamada: a promessa escrita, já no quadro 0, até o fim do primeiro bloco
  const b0 = LINHA[0]
  let cham = null
  if (PARAMS.chamada) {
    // etiqueta com "caixaAlta": false: a chamada sai como foi escrita, sem o espaçamento de caixa alta
    const semCaixa = (MF.etiqueta || {}).caixaAlta === false, esp = semCaixa ? (MF.etiqueta.espaco || 0) : 0.1
    const chTxt = semCaixa ? PARAMS.chamada : PARAMS.chamada.toUpperCase()
    const cpx = Math.min(LF(40, 36, 32), Math.floor(LF(40, 36, 32) * (LF(AREA.w - 200, 760, 860) - 40) / largura(chTxt, fEtq(LF(40, 36, 32)), esp * LF(40, 36, 32))))
    cham = el('div', { cls: 'abs', style: { left: px(AREA.x0), top: px(LF(70, 262, 60)), display: 'flex', alignItems: 'center', gap: '18px', font: fEtq(cpx), color: MC.texto, letterSpacing: esp + 'em', whiteSpace: 'nowrap' } }, root)
    el('div', { style: { width: '14px', height: '14px', borderRadius: '50%', background: MC.acento } }, cham)
    el('div', { text: chTxt }, cham)
    marcar(cham, 'texto', 'callout')
    if (VERTICAL) centrarX(cham, CX)
  }
  // legenda: uma pílula por fala, palavra acendendo quando é dita
  const lpx = LF(44, 50, 40), maxW = LF(AREA.w - 300, 800, 900)
  const falas = LINHA.filter((b) => b.fala && b.fala.palavras).map((b) => {
    const f = b.fala, tS = b.t0 + f.em
    const p = el('div', { cls: 'abs', style: { font: fTxt(lpx, 600), color: MC.legenda || MC.texto, background: rgba(MC.legendaFundo || MC.fundo, 0.82), padding: `${lpx * 0.36}px ${lpx * 0.7}px`,
      borderRadius: px(lpx * 0.5), maxWidth: px(maxW), textAlign: 'center', lineHeight: '1.25', boxSizing: 'border-box' } }, root)
    const ws = f.palavras.map((w, i) => { const s = el('span', { text: w.texto + (i < f.palavras.length - 1 ? ' ' : '') }, p); return { s, ini: tS + w.ini } })
    const r = rectOf(p)
    place(p, CX - r.w / 2, LF(H - 70 - r.h, 1440 - r.h, H - 50 - r.h))
    marcar(p, 'legenda')
    return { p, ws, a: tS - 0.12, z: tS + f.dur + 0.3 }
  })
  return (t) => {
    if (cham) { const pc = E.inCubic(P(t, b0.t1 - 0.4, b0.t1)); O(cham, 1 - pc) }
    for (const f of falas) {
      const on = E.outCubic(P(t, f.a, f.a + 0.12)) * (1 - E.inCubic(P(t, f.z, f.z + 0.2)))
      O(f.p, on)
      f.ws.forEach((w) => { w.s.style.opacity = t >= w.ini ? 1 : 0.45 })
    }
  }
})
