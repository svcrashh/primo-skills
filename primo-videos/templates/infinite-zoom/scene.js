/* Molde infinite-zoom: a câmera mergulha num detalhe da tela, e esse detalhe vira a tela seguinte, sem corte, por 3 ou
 * 4 níveis (do geral ao detalhe); o último detalhe vira o fecho, só com o logo. As telas ficam numa janela; o texto,
 * numa coluna ou numa faixa fora dela, nunca por cima.
 * Como o mergulho fica contínuo: cada nível k+1 mora DENTRO do nível k, num retângulo centrado no detalhe (a proporção
 * dele, um pouco maior que o detalhe). Tudo vive num só sistema de coordenadas (o do nível 1): o nível k tem origem o_k
 * e escala s_k. A câmera é um centro c e um zoom z; o zoom anda em escala logarítmica e o centro anda em 1/z (é o que
 * faz o detalhe crescer no lugar, como um zoom num ponto fixo). O nível seguinte aparece por cima do detalhe enquanto
 * ele cresce; quando ele cobre a janela, o anterior some.
 * Nenhuma marca aqui dentro: cores, fonte, logo e textos vêm de PARAMS; a linha do tempo e as capturas, de LINHA. */
const PR = PARAMS, LN = LINHA, C = PR.marca.cores, CORPO = PR.marca.corpo, PESO = PR.marca.pesos
const FAM = (PR.marca.fonte ? `"${PR.marca.fonte}", ` : '') + '-apple-system, "Helvetica Neue", Arial, sans-serif'
const fonte = (px, peso) => `${peso} ${px}px ${FAM}`
const N = LN.niveis.length

// ---------- texto: medir e quebrar (até 7 palavras por linha, linhas equilibradas) ----------
const _cv = document.createElement('canvas').getContext('2d')
// sem kerning: o texto da cena é letra por letra (inline-block), e cada letra solta perde o kerning do par
const largura = (s, f) => { _cv.font = f; _cv.fontKerning = 'none'; return _cv.measureText(s).width }
function quebraGulosa(ps, f, w) {
  const out = []; let cur = []
  for (const p of ps) { const n = [...cur, p]; if (cur.length && (largura(n.join(' '), f) > w || n.length > 7)) { out.push(cur.join(' ')); cur = [p] } else cur = n }
  if (cur.length) out.push(cur.join(' '))
  return out
}
function quebrar(texto, f, w) {
  const ps = String(texto).split(/\s+/).filter(Boolean), n = quebraGulosa(ps, f, w).length
  let lo = 0, hi = w
  for (let i = 0; i < 18; i++) { const m = (lo + hi) / 2; if (quebraGulosa(ps, f, m).length > n) lo = m; else hi = m }
  return quebraGulosa(ps, f, hi)
}

cena(0, VIDEO.duracao, (root) => {
  // O leiaute mede o texto: ele é montado aqui, na construção da cena, depois de o motor carregar as fontes (medido
  // antes, com a fonte reserva, a quebra de linha sai mais estreita que a letra de verdade).
  // ---------- leiaute por formato ----------
  const corpoT = L({ '16x9': CORPO.titulo, '9x16': CORPO.titulo, '1x1': Math.max(56, Math.round(CORPO.titulo * 0.85)) })
  const fT = fonte(corpoT, PESO.titulo), fR = fonte(CORPO.rotulo, PESO.rotulo), fI = fonte(CORPO.indice, PESO.indice)
  const ALT_R = PR.textos.rotulo ? Math.round(CORPO.rotulo * 1.7) : 0, ALT_I = PR.indice ? Math.round(CORPO.indice * 1.6) : 0
  const larguraPilula = (s, f, px) => largura(s, f) + px * 1.5
  const LAY = (() => {
    const coluna = HORIZONTAL && PR.leiaute.startsWith('coluna'), emCima = PR.leiaute === 'faixa-em-cima'
    if (coluna) {
      const m = Math.round(W * 0.05), my = Math.round(H * 0.05), colW = Math.round(Math.max(500, W * 0.27)), esq = PR.leiaute === 'left-column'
      return { modo: 'coluna', janela: { x: esq ? m + colW + 56 : m, y: my, w: W - 2 * m - colW - 56, h: H - 2 * my }, texto: { x: esq ? m : W - m - colW, w: colW } }
    }
    // faixa: a janela e, embaixo (ou em cima), o texto alinhado com ela
    const m = HORIZONTAL ? Math.round(W * 0.05) : VERTICAL ? 70 : 60, y0 = HORIZONTAL ? Math.round(H * 0.05) : VERTICAL ? 250 : 60, y1 = HORIZONTAL ? H - Math.round(H * 0.05) : VERTICAL ? 1450 : H - 60
    return { modo: 'faixa', emCima, m, y0, y1 }
  })()
  // o texto mais alto entre os níveis decide a altura do bloco
  const largTexto = LAY.modo === 'coluna' ? LAY.texto.w : HORIZONTAL ? Math.min(W - 2 * LAY.m, 1400) : W - 2 * LAY.m - (VERTICAL ? 70 : 0)
  const LINHAS = LN.niveis.map((n) => quebrar(n.texto, fT, largTexto))
  const ALT_T = Math.max(...LINHAS.map((l) => l.length)) * Math.round(corpoT * 1.08) + Math.round(corpoT * 0.3)   // + o descendente da última linha
  const VAO = 22
  // índice: pílulas numa linha (na coluna, quebra se não couber)
  const nomes = PR.indice ? LN.niveis.map((n) => n.nome) : []
  const ALT_BLOCO = (ALT_R ? ALT_R + VAO : 0) + (PR.indice ? ALT_I + VAO : 0) + ALT_T
  if (LAY.modo === 'coluna') {
    LAY.texto.y = Math.round(H / 2 - ALT_BLOCO / 2)
  } else {
    const hJ = LAY.y1 - LAY.y0 - ALT_BLOCO - 44
    const wJ = Math.min(W - 2 * LAY.m, HORIZONTAL ? hJ * PR.aspectoJanela : W)
    const jx = Math.round((W - wJ) / 2)
    LAY.janela = { x: jx, y: LAY.emCima ? LAY.y1 - hJ : LAY.y0, w: Math.round(wJ), h: Math.round(hJ) }
    LAY.texto = { x: HORIZONTAL ? jx : LAY.m, w: HORIZONTAL ? wJ : largTexto, y: LAY.emCima ? LAY.y0 : LAY.y1 - ALT_BLOCO - 12 }
  }
  const WIN = LAY.janela, RJ = L({ '16x9': 28, '9x16': 32, '1x1': 26 })

  // ---------- os níveis num só sistema de coordenadas ----------
  const NV = LN.niveis.map((n) => ({ ...n }))
  const FOLGA = 1.1
  const emb = (k, a) => { const R = NV[k].alvo, w = Math.max(R.w, R.h * a) * FOLGA, h = w / a; return { x: R.x + R.w / 2 - w / 2, y: R.y + R.h / 2 - h / 2, w, h } }
  NV[0].o = [0, 0]; NV[0].s = 1
  for (let k = 0; k + 1 < N; k++) { const E = emb(k, NV[k + 1].w / NV[k + 1].h); NV[k + 1].o = [NV[k].o[0] + NV[k].s * E.x, NV[k].o[1] + NV[k].s * E.y]; NV[k + 1].s = NV[k].s * E.w / NV[k + 1].w }
  const Ef = emb(N - 1, W / H), FE = { o: [NV[N - 1].o[0] + NV[N - 1].s * Ef.x, NV[N - 1].o[1] + NV[N - 1].s * Ef.y], s: NV[N - 1].s * Ef.w / W }
  const cobre = (k) => Math.max(WIN.w / NV[k].w, WIN.h / NV[k].h) / NV[k].s
  function trava(k, x, y, z) {
    const n = NV[k], hw = WIN.w / (2 * z), hh = WIN.h / (2 * z)
    const lx = n.o[0] + hw, ux = n.o[0] + n.s * n.w - hw, ly = n.o[1] + hh, uy = n.o[1] + n.s * n.h - hh
    return [lx > ux ? (lx + ux) / 2 : clamp(x, lx, ux), ly > uy ? (ly + uy) / 2 : clamp(y, ly, uy)]
  }
  const detalhe = (k) => { const n = NV[k], R = n.alvo; return [n.o[0] + n.s * (R.x + R.w / 2), n.o[1] + n.s * (R.y + R.h / 2)] }
  const centro = (k) => { const n = NV[k]; return [n.o[0] + n.s * n.w / 2, n.o[1] + n.s * n.h / 2] }
  // chaves da câmera: chega em cada nível (cobrindo a janela, já puxando para o detalhe), empurra devagar até partir
  const KC = []
  for (let k = 0; k < N; k++) {
    const z0 = cobre(k), z1 = z0 * 1.16, d = detalhe(k), m = centro(k)
    KC.push({ t: LN.chega[k], z: z0, c: trava(k, lerp(m[0], d[0], 0.55), lerp(m[1], d[1], 0.55), z0), ease: E.inOutCubic })
    KC.push({ t: LN.parte[k], z: z1, c: trava(k, d[0], d[1], z1), ease: E.inOutSine })
  }
  const zF = 1 / FE.s
  KC.push({ t: LN.fechoChega, z: zF, c: [FE.o[0] + (WIN.x + WIN.w / 2) * FE.s, FE.o[1] + (WIN.y + WIN.h / 2) * FE.s], ease: E.inOutCubic })
  function camera(t) {
    if (t <= KC[0].t) return { z: KC[0].z, c: KC[0].c }
    for (let i = 1; i < KC.length; i++) {
      const A = KC[i - 1], B = KC[i]
      if (t > B.t && i < KC.length - 1) continue
      const u = B.ease(P(t, A.t, B.t)), z = Math.exp(lerp(Math.log(A.z), Math.log(B.z), u))
      const g = Math.abs(1 / A.z - 1 / B.z) < 1e-9 ? u : (1 / A.z - 1 / z) / (1 / A.z - 1 / B.z)
      return { z, c: [lerp(A.c[0], B.c[0], g), lerp(A.c[1], B.c[1], g)] }
    }
  }
  const caixa = (o, s, w, h, cam) => ({ x: WIN.w / 2 + (o[0] - cam.c[0]) * cam.z, y: WIN.h / 2 + (o[1] - cam.c[1]) * cam.z, w: s * w * cam.z, h: s * h * cam.z })
  // quando o nível seguinte aparece: pela largura do retângulo dele na janela (f0 na partida, 1 quando cobre), de 15% a 60%
  // do caminho que falta: aparece sobre o detalhe enquanto ele cresce, e já está inteiro antes de cobrir a janela
  const rampa = (f0) => [f0 + (1 - f0) * 0.15, f0 + (1 - f0) * 0.6]
  const RAMPA = NV.map((n, k) => {
    if (k === 0) return null
    return rampa(caixa(n.o, n.s, n.w, n.h, camera(LN.parte[k - 1])).w / WIN.w)
  })
  const RAMPA_F = rampa((FE.s * W * camera(LN.parte[N - 1]).z) / W)
  const suave = (x, a, b) => { const u = clamp((x - a) / (b - a)); return u * u * (3 - 2 * u) }

  el('div', { cls: 'layer', style: { background: C.fundo } }, root)
  const janela = el('div', { cls: 'abs', style: { left: px(WIN.x), top: px(WIN.y), width: px(WIN.w), height: px(WIN.h), overflow: 'hidden', borderRadius: px(RJ), background: C.janela } }, root)
  marcarImagem(janela, 'the screen')
  const caixas = NV.map((n, k) => {
    const b = el('div', { cls: 'abs', style: { overflow: 'hidden' } }, janela)
    imagem(b, `media/${n.arquivo}`, { width: '100%', height: '100%' })
    return b
  })
  // registra cada mergulho como transição (a checagem de texto parado não vale no meio do movimento)
  LN.parte.forEach((t) => registrarTransicao('zoom-through', t, LN.zoom))

  // ---------- texto fora da janela ----------
  const tx = LAY.texto.x
  let y = LAY.texto.y
  let rotulo = null
  if (PR.textos.rotulo) {
    rotulo = el('div', { cls: 'abs', text: PR.textos.rotulo, style: { left: px(tx), top: px(y), height: px(ALT_R), lineHeight: px(ALT_R), padding: `0 ${Math.round(CORPO.rotulo * 0.75)}px`, borderRadius: px(ALT_R / 2),
      background: C.pilulaFundo, color: C.pilulaTexto, font: fR, whiteSpace: 'nowrap' } }, root)
    marcar(rotulo, 'texto', 'label')
  }
  // o índice vai na mesma linha do rótulo quando cabe (faixa), senão na linha de baixo
  let yCur = y + (rotulo ? ALT_R + VAO : 0), emLinha = false
  const largIndice = nomes.reduce((s, n) => s + larguraPilula(n, fI, CORPO.indice) + 12, 0) - 12
  if (PR.indice && LAY.modo === 'faixa' && rotulo && larguraPilula(PR.textos.rotulo, fR, CORPO.rotulo) + 36 + largIndice <= LAY.texto.w) emLinha = true
  let ix = emLinha ? tx + LAY.texto.w - largIndice : tx, iy = emLinha ? y + (ALT_R - ALT_I) / 2 : yCur
  const pilulas = nomes.map((n) => {
    const w = larguraPilula(n, fI, CORPO.indice)
    if (!emLinha && ix > tx && ix + w > tx + LAY.texto.w) { ix = tx; iy += ALT_I + 10 }
    const e = el('div', { cls: 'abs', text: n, style: { left: px(ix), top: px(iy), height: px(ALT_I), lineHeight: px(ALT_I - 4), padding: `0 ${Math.round(CORPO.indice * 0.75) - 2}px`, borderRadius: px(ALT_I / 2),
      border: `2px solid ${C.texto}`, color: C.texto, font: fI, whiteSpace: 'nowrap', boxSizing: 'border-box' } }, root)
    marcar(e, 'texto', `index ${n}`)
    ix += w + 12
    return e
  })
  if (PR.indice && !emLinha) yCur = iy + ALT_I + VAO
  const yT = yCur
  const titulos = LINHAS.map((ls) => {
    const b = bloco(root, ls.map((s) => [{ t: s }]), { top: yT, entrelinha: Math.round(corpoT * 1.08), alinhar: 'esquerda', x: tx, style: { font: fT, color: C.texto, lineHeight: '1.08' } })
    return { b, ws: palavras(b) }
  })
  const deT = (k) => (k === 0 ? -1 : LN.parte[k - 1] + LN.zoom * 0.5), ateT = (k) => (k < N - 1 ? LN.parte[k] + LN.zoom * 0.42 : LN.parte[k] + 0.35)

  // ---------- fecho: só o logo, nascendo do último detalhe ----------
  const fecho = el('div', { cls: 'layer', style: { zIndex: 5 } }, root)
  const fundoF = el('div', { cls: 'layer', style: { background: PR.fecho.fundo || C.fundo } }, fecho)
  const lw = Math.min(PR.fecho.largura, W * 0.6), prop = PR.fecho.proporcao || 4
  const logo = imagem(fecho, 'media/logo.png', { width: px(lw), height: px(lw / prop), transformOrigin: '0 0' })
  marcar(logo, 'logo', 'logo')

  return (t) => {
    const cam = camera(t)
    // níveis: a caixa de cada um na janela; o seguinte aparece sobre o detalhe e, quando cobre a janela, o anterior some
    let cobriu = -1
    NV.forEach((n, k) => {
      const b = caixa(n.o, n.s, n.w, n.h, cam), e = caixas[k]
      const op = k === 0 ? 1 : suave(b.w / WIN.w, RAMPA[k][0], RAMPA[k][1])
      const visivel = b.w >= 3 && op > 0.001 && b.x < WIN.w && b.y < WIN.h && b.x + b.w > 0 && b.y + b.h > 0
      e.style.display = visivel ? 'block' : 'none'
      if (!visivel) return
      e.style.left = px(b.x); e.style.top = px(b.y); e.style.width = px(b.w); e.style.height = px(b.h)
      e.style.opacity = op
      e.style.borderRadius = k === 0 ? '0' : px(lerp(18, 0, P(b.w / WIN.w, 0.7, 1)))
      if (op >= 0.999 && b.x <= 0.5 && b.y <= 0.5 && b.x + b.w >= WIN.w - 0.5 && b.y + b.h >= WIN.h - 0.5) cobriu = k
    })
    caixas.forEach((e, k) => { if (k < cobriu) e.style.display = 'none' })

    titulos.forEach(({ b, ws }, k) => {
      const de = deT(k), ate = ateT(k), on = t >= de - 0.05 && t < ate
      b.forEach((l) => { l.line.style.display = on ? 'block' : 'none' })
      if (on) { riseWords(ws, t, de, 0.06, 0.55); exitWords(ws, t, ate - 0.32, 0.03, 0.3) }
    })
    let atual = 0
    for (let k = 1; k < N; k++) if (t >= LN.parte[k - 1] + LN.zoom * 0.5) atual = k
    pilulas.forEach((e, k) => { e.style.background = k === atual ? C.pilulaFundo : 'transparent'; e.style.color = k === atual ? C.pilulaTexto : C.texto; e.style.borderColor = k === atual ? C.pilulaFundo : C.texto })
    const some = E.inCubic(P(t, LN.parte[N - 1] + 0.05, LN.parte[N - 1] + 0.35))
    for (const e of [rotulo, ...pilulas]) if (e) { O(e, 1 - some); T(e, `translateY(${-20 * some}px)`) }

    // fecho
    const zf = cam.z, fx = WIN.x + WIN.w / 2 + (FE.o[0] - cam.c[0]) * zf, fy = WIN.y + WIN.h / 2 + (FE.o[1] - cam.c[1]) * zf, fw = FE.s * W * zf, fh = FE.s * H * zf
    const opF = t >= LN.fechoChega ? 1 : suave(fw / W, RAMPA_F[0], RAMPA_F[1])
    fecho.style.display = opF > 0.001 && t >= LN.parte[N - 1] ? 'block' : 'none'
    if (t >= LN.fechoChega) { fecho.style.clipPath = 'none'; O(fecho, 1); T(logo, `translate(${CX - lw / 2}px,${CY - lw / prop / 2}px)`); return }
    O(fecho, opF)
    const r = lerp(18, 0, P(fw / W, 0.7, 1))
    fecho.style.clipPath = `inset(${Math.max(0, fy).toFixed(1)}px ${Math.max(0, W - fx - fw).toFixed(1)}px ${Math.max(0, H - fy - fh).toFixed(1)}px ${Math.max(0, fx).toFixed(1)}px round ${r.toFixed(1)}px)`
    const k = fw / W
    T(logo, `translate(${(fx + (CX - lw / 2) * k).toFixed(2)}px,${(fy + (CY - lw / prop / 2) * k).toFixed(2)}px) scale(${k.toFixed(5)})`)
  }
})
