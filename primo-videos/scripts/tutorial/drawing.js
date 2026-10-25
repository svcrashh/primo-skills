/* O desenho declarado do modo tutorial (series.json com "versao": 2). Roda no motor, depois do
 * engine.js; quem chama é o montarTutorial (tutorial.js), que já resolveu layout, câmera e indicador.
 * Cada elemento sai de TU.visual (cores já em hex, conferido pelo visual.mjs). Um tipo existe porque muda a
 * estrutura do quadro, não a cor. O que cada um é e quando usar: references/tutorial.md, seção 13.
 */

// O iniciar() do motor espera só o peso 400 de cada fonte. O desenho mede títulos e legendas em outros pesos
// (800, 600…) na montagem: medidos com a métrica da fonte reserva, saem descentrados e com a entrelinha
// errada. Aqui se espera toda face declarada no fonts.css antes de montar. (O desenho antigo tem o mesmo
// defeito e fica como está: a regressão exige o pixel de antes.)
const _iniciarDoMotor = iniciar
// eslint-disable-next-line no-global-assign
iniciar = async function () {
  await Promise.all([...document.fonts].map((f) => f.load().catch(() => null)))
  return _iniciarDoMotor()
}

// A seção aberta antes disto (s da gravação) não vira o painel: a abertura acabou de virar (o compose.mjs usa o mesmo).
const SECAO_SEM_GIRO = 0.8

function cenasNovas({ conteudoTela, gancho, marcarSe, V, TOQUE, A, D, FIM, FT, FX, FM, ev, passos, NP, LAY, T0, k, vp, aTela, cam, noQuadro, telas, TU, ZMIN, PAINEL, CLIP_LIVRE, secoes }) {
  const S = areaSegura()
  const FU = V.fundo, M = V.moldura, LG = V.legenda, SE = V.selo, TI = V.titulo, AB = V.abertura, FC = V.fechamento
  const alto = (s) => s.toLocaleUpperCase('en-US')
  const lum = (h) => { const c = hex2rgb(h).map((v) => v / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)); return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2] }
  const legivel = (h) => (lum(h) > 0.4 ? '#111111' : '#FFFFFF')   // tinta que se lê sobre h
  const sombraDe = (s) => ({ nenhuma: 'none', curta: '0 6px 18px rgba(0,0,0,.18)', longa: '0 40px 90px rgba(0,0,0,.26), 0 8px 22px rgba(0,0,0,.14)' })[s] || 'none'
  const ret = (r) => ({ position: 'absolute', left: px(r.x), top: px(r.y), width: px(r.w), height: px(r.h) })
  // o rótulo do passo: o do próprio passo (g.passo(…, { rotulo })), ou o modelo da série com {n} e {N}
  const passoTxt = (n, pad) => { const pr = passos.find((x) => x.n === n); if (pr && pr.rotulo) return pr.rotulo; return (TU.textos.passo || 'Step {n} of {N}').replace('{n}', pad ? String(n).padStart(2, '0') : n).replace('{N}', pad ? String(NP).padStart(2, '0') : NP) }
  // a imagem que texto nenhum cruza (VIDEO.texto "fora-da-imagem"): a tela, o painel, a prévia
  const imagemDe = (e, nome) => { if (typeof marcarImagem === 'function') marcarImagem(e, nome); return e }
  // a pílula da série (o rótulo do passo e o índice das seções): as cores do selo quando ele é uma pílula chapada; senão, o
  // sinal da legenda sobre ele mesmo a 12% (visual.mjs, corDaPilula, confere o contraste do mesmo par)
  const PILULA = SE.tipo === 'pilula' && SE.fundo ? { fundo: SE.fundo, tinta: SE.cor } : { fundo: rgba(LG.sinal || TI.tinta, 0.12), tinta: LG.sinal || TI.tinta }
  // a moldura de fora do painel (a tela com o que a moldura ocupa em volta), no quadro, em z = 1
  const foraDoPainel = () => { const cr = LAY.cromo; return { x: T0.x - cr.l, y: T0.y - cr.t, w: T0.w + cr.l + cr.r, h: T0.h + cr.t + cr.b } }

  // ---------- fundo: o que fica atrás da tela e da abertura ----------
  // Desenhado duas vezes (abertura e tela) pela mesma função do tempo: a troca entre as cenas não aparece.
  function fundo(camada, fase) {
    camada.style.background = FU.cor
    const f = FU.forca
    if (FU.tipo === 'liso') return () => {}
    if (FU.tipo === 'formas') {
      const b1 = makeBlob(camada, L({ '16x9': 900, padrao: 800 }), rgba(FU.tinta, f))
      const b2 = makeBlob(camada, 560, rgba(FU.tinta2, f * 0.9))
      // a legenda solta de lado lê direto no fundo: com o texto à direita, as formas trocam de lado (a frase nunca fica
      // sobre uma forma, só sobre a cor do fundo, que é o par conferido)
      const X = LG.tipo === 'solta' && LAY.lateral && LAY.lado === 'direita' ? (x) => W - x : (x) => x
      return (t) => { breathe(b1, t, X(L({ '16x9': W - 60, padrao: W - 40 })), 120, 1, 6 * t, 1, 0.3); breathe(b2, t, X(70), H - 90, 1, -5 * t, 3, 1.4) }
    }
    if (FU.tipo === 'simbolo') {
      // o símbolo da marca (o PNG, inteiro, na cor dele), gigante e recortado, atrás da tela e do lado oposto ao do texto;
      // gira devagar. Fica longe da coluna: a frase nunca fica sobre ele.
      const pg = TU.png && TU.png.fundo
      if (!pg) return () => {}
      const tam = H * 1.7, alt = (tam * pg.h) / pg.w
      const dir = LAY.lateral && LAY.lado === 'direita' ? -1 : 1
      const cx = dir > 0 ? W * 0.8 : W * 0.2, cy = H * 0.55
      const im = imagem(camada, pg.src, { left: px(cx - tam / 2), top: px(cy - alt / 2), width: px(tam), height: px(alt), transformOrigin: '50% 50%' })
      return (t) => T(im, `rotate(${(dir * (8 + t * 2.4)).toFixed(3)}deg)`)
    }
    if (FU.tipo === 'grade' || FU.tipo === 'pontos') {
      // papel técnico: linhas finas (grade) ou pontos (pontos) num passo fixo, andando devagar
      const passo = L({ '16x9': 64, padrao: 60 }), id = 'fvfundo-' + fase
      const s = svgQuadro(camada)
      const pat = sv('pattern', { id, width: passo, height: passo, patternUnits: 'userSpaceOnUse' }, sv('defs', {}, s))
      if (FU.tipo === 'grade') sv('path', { d: `M${passo} 0H0V${passo}`, fill: 'none', stroke: rgba(FU.tinta, f), 'stroke-width': 1.5 }, pat)
      else sv('circle', { cx: passo / 2, cy: passo / 2, r: 2.6, fill: rgba(FU.tinta, f) }, pat)
      sv('rect', { width: W, height: H, fill: `url(#${id})` }, s)
      return (t) => pat.setAttribute('patternTransform', `translate(${((t * 5) % passo).toFixed(2)} ${((t * 3) % passo).toFixed(2)})`)
    }
    if (FU.tipo === 'luz') {
      // superfície escura com focos de luz que derivam, como luz de palco sobre fumaça
      const d = Math.max(W, H) * 1.15
      const luzes = [[FU.tinta, 0.12, 0.18, 0], [FU.tinta2, 0.9, 0.8, 2.1], [FU.tinta, 0.78, 0.05, 4.2]].map(([c, x, y, ph]) => ({
        e: el('div', { style: { position: 'absolute', left: px(x * W - d / 2), top: px(y * H - d / 2), width: px(d), height: px(d), borderRadius: '50%', willChange: 'transform', background: `radial-gradient(circle, ${rgba(c, f)} 0%, ${rgba(c, f * 0.35)} 28%, ${rgba(c, 0)} 60%)` } }, camada), ph,
      }))
      // anda por transform (a luz é rasterizada uma vez e só composta): por left/top, custava 3× o quadro de um
      // fundo liso; assim, 1,7×. Rasterizar a 1/4 e ampliar saiu mais caro, não mais barato (medido)
      return (t) => { for (const l of luzes) T(l.e, `translate(${(Math.sin(t * 0.45 + l.ph) * W * 0.08).toFixed(2)}px,${(Math.cos(t * 0.38 + l.ph) * H * 0.06).toFixed(2)}px)`) }
    }
    if (FU.tipo === 'faixas') {
      // listras largas em diagonal, em duas tintas, correndo devagar
      const lg = L({ '16x9': 110, padrao: 96 }), dg = Math.hypot(W, H)
      const s = el('div', { style: { position: 'absolute', left: px(CX - dg), top: px(CY - dg), width: px(2 * dg), height: px(2 * dg), opacity: f, background: `repeating-linear-gradient(-35deg, ${FU.tinta} 0 ${lg}px, transparent ${lg}px ${2 * lg}px, ${FU.tinta2} ${2 * lg}px ${3 * lg}px, transparent ${3 * lg}px ${4 * lg}px)` } }, camada)
      return (t) => T(s, `translate(${(t * 14).toFixed(2)}px,${(-t * 9).toFixed(2)}px)`)
    }
    return gancho('fundo', { camada, fase })
  }

  // ---------- moldura: o que envolve a tela gravada (dentro do mundo: anda com a câmera) ----------
  function moldura(mundo) {
    const r = T0.r, cr = LAY.cromo, sb = sombraDe(M.sombra)
    const fora = { x: T0.x - cr.l, y: T0.y - cr.t, w: T0.w + cr.l + cr.r, h: T0.h + cr.t + cr.b }
    let raioTela = px(r), up = () => {}, depois = null
    if (M.tipo === 'nenhuma') { if (sb !== 'none') el('div', { style: { ...ret(T0), borderRadius: px(r), boxShadow: sb } }, mundo) }
    else if (M.tipo === 'fio') imagemDe(el('div', { style: { ...ret(fora), borderRadius: px(r > 0 ? r + M.espessura : 0), background: M.cor, boxShadow: sb } }, mundo), 'the panel')
    else if (M.tipo === 'janela') {
      if (TOQUE) imagemDe(el('div', { style: { ...ret(fora), borderRadius: px(r + 14), background: M.cor, boxShadow: sb } }, mundo), 'the device')
      else {
        const j = imagemDe(el('div', { style: { ...ret(fora), borderRadius: px(r > 0 ? r + 4 : 0), background: M.cor, boxShadow: sb, boxSizing: 'border-box', border: `1px solid ${rgba(legivel(M.cor), 0.12)}` } }, mundo), 'the panel')
        for (let i = 0; i < 3; i++) el('div', { style: { position: 'absolute', left: px(18 + i * 24), top: '14px', width: '12px', height: '12px', borderRadius: '50%', background: ['#FF5F57', '#FEBC2E', '#28C840'][i] } }, j)
        raioTela = `0 0 ${px(r)} ${px(r)}`
      }
    } else if (M.tipo === 'navegador') {
      // barra de endereço com o domínio (só o domínio: caminho de URL pode ter token)
      const tinta = legivel(M.cor), bar = imagemDe(el('div', { style: { ...ret(fora), borderRadius: px(r), background: M.cor, boxShadow: sb, overflow: 'hidden' } }, mundo), 'the panel')
      const hb = cr.t, ph = TOQUE ? 38 : 36, x0 = TOQUE ? 14 : 96
      if (!TOQUE) for (let i = 0; i < 3; i++) el('div', { style: { position: 'absolute', left: px(20 + i * 22), top: px(hb / 2 - 6), width: '12px', height: '12px', borderRadius: '50%', background: rgba(tinta, 0.22) } }, bar)
      const pill = el('div', { style: { position: 'absolute', left: px(x0), right: px(x0), top: px((hb - ph) / 2), height: px(ph), borderRadius: px(ph / 2), background: rgba(M.tinta || tinta, 0.06), font: `600 ${TOQUE ? 19 : PAINEL ? 22 : 17}px ${FX}`, color: M.tinta || rgba(tinta, 0.7), display: 'flex', alignItems: 'center', justifyContent: 'center', whiteSpace: 'nowrap', overflow: 'hidden' } }, bar)
      pill.textContent = M.endereco || TU.textos.endereco || ''
      raioTela = `0 0 ${px(r)} ${px(r)}`
    } else if (M.tipo === 'aparelho') {
      // o corpo do celular do kit 3D, de frente (430×900 em volta da tela de 390×844): o mesmo aparelho que entra em 3D
      // na abertura "pouso". Borda de metal, botões de lado e, por cima da tela, o reflexo leve do vidro.
      const u = T0.w / 390, metal = mix(M.cor, '#FFFFFF', 0.2)
      const bot = (x, y, h) => el('div', { style: { position: 'absolute', left: px(x), top: px(y), width: px(5 * u), height: px(h), borderRadius: px(2 * u), background: metal } }, mundo)
      bot(fora.x + fora.w - 2 * u, fora.y + fora.h * 0.225, fora.h * 0.11)
      bot(fora.x - 3 * u, fora.y + fora.h * 0.2, fora.h * 0.06); bot(fora.x - 3 * u, fora.y + fora.h * 0.3, fora.h * 0.06)
      // a borda de metal pega luz em dois cantos, como a do aparelho 3D assentado (a troca de um pelo outro não aparece)
      const aro = `linear-gradient(135deg, ${mix(M.cor, '#FFFFFF', 0.72)} 0%, ${mix(M.cor, '#FFFFFF', 0.16)} 14%, ${mix(M.cor, '#FFFFFF', 0.1)} 84%, ${mix(M.cor, '#FFFFFF', 0.6)} 100%)`
      el('div', { style: { ...ret(fora), borderRadius: px(64 * u), background: aro, boxShadow: sb === 'none' ? 'none' : sb } }, mundo)
      const b = 4.5 * u
      el('div', { style: { ...ret({ x: fora.x + b, y: fora.y + b, w: fora.w - 2 * b, h: fora.h - 2 * b }), borderRadius: px(64 * u - b), background: mix(M.cor, '#000000', 0.45) } }, mundo)
      depois = () => el('div', { style: { ...ret(T0), borderRadius: px(r), pointerEvents: 'none', background: 'linear-gradient(118deg, rgba(255,255,255,.09) 0%, rgba(255,255,255,0) 24%)', boxShadow: 'inset 0 0 0 1px rgba(0,0,0,.22)' } }, mundo)
    } else up = gancho('moldura', { mundo, cromo: cr })
    return { raioTela, up, depois }
  }

  // ---------- título (abertura e fechamento usam o mesmo desenho de letra) ----------
  // Encolhe até a linha mais larga caber na área segura: caixa alta e escala grande estouram fácil no 9:16.
  // area: { x0, x1 } quando o título divide o quadro com outra coisa (a prévia do resultado, no 16:9)
  function titulo(parent, linhas0, { tam0, ent0, tinta, meio, area = null }) {
    const linhas = linhas0.map((s) => (TI.caixa === 'alta' ? alto(s) : s))
    const margem = L({ '16x9': 40, padrao: 24 })
    const ax0 = area ? area.x0 : S.x0, ax1 = area ? area.x1 : S.x1, xc = area ? (ax0 + ax1) / 2 : CX
    const x = TI.alinhar === 'centro' ? xc : ax0 + margem
    const maxW = TI.alinhar === 'centro' ? 2 * Math.min(xc - ax0, ax1 - xc) - 2 * margem : ax1 - x - margem
    // A entrelinha nunca fica menor que a caixa do texto na fonte da série (Baloo, Caveat e outras têm
    // ascendente alto): senão a caixa de uma linha invade a outra e a checagem acusa, com razão.
    let tam = tam0 * TI.escala, razao = ent0 / tam0, ls = []
    for (let volta = 0; volta < 14; volta++) {
      const ent = tam * razao, top = meio - (linhas.length * ent) / 2
      ls = bloco(parent, linhas.map((t) => [{ t }]), { top, entrelinha: ent, alinhar: TI.alinhar === 'centro' ? 'centro' : 'esquerda', x, style: { font: `${TI.peso} ${tam}px ${FT}`, color: tinta, letterSpacing: `${TI.espaco}em` } })
      const larg = Math.max(...ls.map((l) => rectOf(l.line).w))
      const rg = document.createRange(); rg.selectNodeContents(ls[0].chars[0])
      const caixa = rg.getBoundingClientRect().height * 1.04
      if (larg <= maxW && (linhas.length < 2 || caixa <= ent)) break
      for (const l of ls) l.line.remove()
      if (linhas.length > 1 && caixa > ent) razao = caixa / tam
      if (larg > maxW) tam *= Math.max(0.7, (maxW / larg) * 0.98)
    }
    return ls
  }
  // (dm: a duração da revelação na entrada "mascara"; o cartão de capítulo, que fica pouco tempo, usa uma mais curta)
  const entrar = (ls, t, t0, dm = 0.55) => {
    if (TI.entrada === 'palavras') riseWords(palavras(ls), t, t0, 0.07)
    else if (TI.entrada === 'letras') riseChars(letras(ls), t, t0, 0.028)
    else if (TI.entrada === 'mascara') ls.forEach((l, i) => { const e = E.inOutCubic(P(t, t0 + i * 0.12, t0 + i * 0.12 + dm)); l.line.style.clipPath = e >= 1 ? 'none' : `inset(-30% ${((1 - e) * 100).toFixed(2)}% -30% 0)` })
    else ls.forEach((l) => O(l.line, t >= t0 ? 1 : 0))
  }

  // ---------- selo: o rótulo da série acima do título ----------
  function selo(w, ls, xc = CX) {
    if (SE.tipo === 'nenhum') return () => {}
    const rs = ls.map((l) => rectOf(l.line)), r0 = rs[0]
    const x0 = Math.min(...rs.map((r) => r.x)), dy = L({ '16x9': 96, padrao: 112 })
    const texto = TU.textos.rotulo
    if (SE.tipo === 'proprio') return gancho('selo', { camada: w, texto, alinhar: TI.alinhar, titulo: { x: x0, y: r0.y, w: Math.max(...rs.map((r) => r.x + r.w)) - x0, h: rs[rs.length - 1].y + rs[rs.length - 1].h - r0.y } })
    const pos = (e) => { place(e, TI.alinhar === 'centro' ? 0 : x0, r0.y - dy); if (TI.alinhar === 'centro') centrarX(e, xc); marcarSe(e, 'texto') }
    if (SE.tipo === 'pilula') {
      const chip = el('div', { style: { position: 'absolute', font: `700 ${L({ '16x9': 30, padrao: 34 })}px ${FX}`, color: SE.cor, background: SE.fundo || rgba(SE.cor, 0.12), padding: '12px 26px', borderRadius: '999px', whiteSpace: 'nowrap' } }, w)
      chip.textContent = texto; pos(chip)
      return (t) => { O(chip, E.outCubic(P(t, 0.1, 0.45))); T(chip, `translateY(${(1 - E.outExpo(P(t, 0.1, 0.6))) * 30}px)`) }
    }
    if (SE.tipo === 'mono') {
      // letra de máquina, caixa alta, datilografada letra a letra
      const s = el('div', { style: { position: 'absolute', font: `500 ${L({ '16x9': 24, padrao: 28 })}px ${FM}`, letterSpacing: '0.16em', color: SE.cor, whiteSpace: 'nowrap' } }, w)
      const chs = [...alto(texto)].map((c) => el('span', { text: c }, s)); pos(s)
      return (t) => digita(chs, t, 0.05, 0.05 + 0.028 * chs.length)
    }
    // linha: um fio curto que se estende e o texto ao lado, sem caixa
    const box = el('div', { style: { position: 'absolute', display: 'flex', alignItems: 'center', gap: '18px', whiteSpace: 'nowrap' } }, w)
    const fio = el('span', { style: { display: 'block', width: px(L({ '16x9': 56, padrao: 64 })), height: '4px', background: SE.cor, transformOrigin: '0 50%' } }, box)
    const tx = el('span', { style: { font: `600 ${L({ '16x9': 28, padrao: 32 })}px ${FX}`, color: SE.cor } }, box)
    tx.textContent = texto; pos(box)
    return (t) => { T(fio, `scaleX(${E.outExpo(P(t, 0.05, 0.5))})`); O(tx, E.outCubic(P(t, 0.2, 0.5))); T(tx, `translateX(${(1 - E.outExpo(P(t, 0.2, 0.7))) * -16}px)`) }
  }

  // ---------- prévia do resultado: a abertura já mostra onde o tutorial chega ----------
  // Quem assiste vê a tela final antes do primeiro passo e sabe por que continuar. O quadro é o da tela de sucesso
  // (g.sucesso), ou o último da gravação. "previa": "nenhuma" na abertura da série desliga.
  function previaDoResultado() {
    if (AB.previa === 'nenhuma' || (!PAINEL && !HORIZONTAL && FMT !== '9x16') || !TU.quadros.length) return null
    const su = TU.eventos.find((e) => e.tipo === 'sucesso')
    const ate = su ? su.t + 0.6 : Infinity
    let q = TU.quadros[0]
    for (const x of TU.quadros) if (x[1] <= ate) q = x
    return { src: q[0], aspecto: T0.w / T0.h, alvo: su && su.ret ? su.ret : null }
  }
  // Onde a prévia mora: no 16:9, a metade da direita (o título fica na esquerda); no 9:16, embaixo do título. Folga das
  // bordas: na saída "deslizar" a abertura cresce 4% a partir do centro.
  function regiaoPrevia(ls, area) {
    const rs = ls.map((l) => rectOf(l.line)), baseTitulo = Math.max(...rs.map((r) => r.y + r.h))
    return area ? { x0: area.x1 + 40, x1: S.x1 - 40, y0: S.y0 + 40, y1: S.y1 - 40 } : { x0: S.x0 + 40, x1: S.x1 - 40, y0: baseTitulo + 70, y1: S.y1 - 30 }
  }
  // O aparelho inteiro, nunca uma faixa cortada da tela. A letra do app fica pequena: é um
  // plano geral curto, que o refino aceita (PLANO_GERAL_MAX).
  function previa(w, ls, pv, area) {
    const cx0 = regiaoPrevia(ls, area)
    const b = TOQUE ? 10 : 0                                     // o aro do aparelho
    let ih = cx0.y1 - cx0.y0 - 2 * b, iw = ih * pv.aspecto
    if (iw > cx0.x1 - cx0.x0 - 2 * b) { iw = cx0.x1 - cx0.x0 - 2 * b; ih = iw / pv.aspecto }
    const bw = iw + 2 * b, bh = ih + 2 * b, r = TOQUE ? Math.round(bw * 0.11) : Math.round(Math.min(18, bw * 0.02))
    const xc = area ? (cx0.x0 + cx0.x1) / 2 : TI.alinhar === 'centro' ? CX : S.x0 + L({ '16x9': 40, padrao: 24 }) + bw / 2
    const x = clamp(xc - bw / 2, cx0.x0, cx0.x1 - bw), y = cx0.y0 + (cx0.y1 - cx0.y0 - bh) / 2
    const box = el('div', { style: { ...ret({ x, y, w: bw, h: bh }), borderRadius: px(r), overflow: 'hidden', background: M.cor || '#14161C', boxShadow: sombraDe('longa') } }, w)
    // levemente fora de foco: o foco é o título, e a letra miúda do app não soma com o plano geral da primeira tela
    const sq = sequencia(box, [[pv.src, 0]], { left: px(b), top: px(b), width: px(iw), height: px(ih), borderRadius: px(Math.max(0, r - b)), filter: 'blur(1.8px)' })
    marcarSe(box, 'logo', 'result preview'); imagemDe(box, 'the result preview')
    // A saída "deslizar" cresce a abertura 4% enquanto o título é lido; a prévia não cresce junto (senão passaria da
    // área segura): a escala dela desfaz a da abertura, em volta do mesmo ponto. Esse ponto é (2·CX, 2·CY): a camada
    // não fixa transform-origin, então o translate(CX, CY) da abertura soma com a origem padrão (o centro da camada).
    box.style.transformOrigin = `${2 * CX - x}px ${2 * CY - y}px`
    return (t) => {
      sq.set(0)
      const e = E.outCubic(P(t, 0.4, 0.95))
      const push = AB.saida === 'deslizar' ? 1 + AMP * E.inOutSine(P(t, 0.25, A)) : 1
      O(box, e); T(box, `translateY(${((1 - e) * 70).toFixed(2)}px) scale(${(lerp(0.94, 1, e) / push).toFixed(4)})`)
    }
  }

  // Modo cinema: o mesmo aparelho inteiro, em 3D, entrando girando, com um brilho passando pelo vidro (cinema.js). Fica
  // numa camada própria atrás do título, que não cresce com a abertura.
  const CINE = TU.cinema === 'moldura' && typeof cinemaAbertura === 'function'
  function previaCinema(w3, ls, pv, area) {
    const cx0 = regiaoPrevia(ls, area), caixa = { x: cx0.x0, y: cx0.y0, w: cx0.x1 - cx0.x0, h: cx0.y1 - cx0.y0 }
    const up = cinemaAbertura(w3, { src: pv.src, caixa, corAparelho: M.cor || '#14161C', corLuz: V.realce.cor || '#FFFFFF', A, saida: AB.saida })
    // o marcador vem depois do canvas, por cima dele: é ele que a checagem mede (o lugar do aparelho)
    const mk = el('div', { style: { ...ret(up.ret), pointerEvents: 'none' } }, w3)
    marcarSe(mk, 'logo', 'result preview (3D)'); imagemDe(mk, 'the result preview (3D)')
    return up.atualizar
  }

  // Painel 3D (computador em modo cinema): a tela de sucesso no MESMO painel dos passos (a mesma moldura, no mesmo lugar),
  // que vem de longe girando e assenta levemente inclinado ao lado do título, olhando para ele. Um brilho passa pelo vidro.
  // Na saída "virar", o painel gira até ficar de lado em A, e a tela gravada nasce no verso (cena da tela).
  function previaPainel(camada, pv, ls) {
    const pl = el('div', { cls: 'layer', style: { pointerEvents: 'none' } }, camada)
    const mo = moldura(pl)
    const tb = el('div', { style: { ...ret(T0), borderRadius: mo.raioTela, overflow: 'hidden', background: '#FFFFFF' } }, pl)
    const sq = sequencia(tb, [[pv.src, 0]], { width: px(T0.w), height: px(T0.h) })
    const luz = el('div', { style: { position: 'absolute', left: '0', top: '0', width: '100%', height: '100%', backgroundRepeat: 'no-repeat', backgroundSize: '320% 100%',
      backgroundImage: `linear-gradient(110deg, transparent 0%, transparent 43%, ${rgba(V.realce.cor, 0.14)} 48%, ${rgba('#FFFFFF', 0.34)} 50%, ${rgba(V.realce.cor, 0.14)} 52%, transparent 57%, transparent 100%)` } }, tb)
    // (é imagem, não logo: como a tela dos passos, pode passar da área segura; texto nenhum pode cruzá-la)
    imagemDe(tb, 'the result preview (panel)')
    const fo = foraDoPainel()
    pl.style.transformOrigin = `${fo.x + fo.w / 2}px ${fo.y + fo.h / 2}px`
    // em pé, o título ocupa o alto: o painel da abertura desce para baixo dele e encolhe o que precisar para caber na área
    // segura (ele vira em Y e a tela gravada nasce no lugar do painel dos passos)
    let dy = 0, sc = 1
    if (!LAY.lateral) {
      const topo = Math.max(...ls.map((l) => { const r = rectOf(l.line); return r.y + r.h })) + 60
      sc = clamp((S.y1 - 20 - topo) / fo.h, 0.4, 1)
      dy = topo + (sc * fo.h) / 2 - (fo.y + fo.h / 2)
    }
    // o painel olha para o texto: texto à esquerda, a borda da direita vem para a frente (rotateY negativo)
    const ly = LAY.lateral ? (LAY.lado === 'direita' ? 1 : -1) : -0.4, lx = LAY.lateral ? 1 : 2.2
    const up = (t) => {
      sq.set(0)
      const e = E.outCubic(P(t, 0.3, 1.45)), viv = P(t, 1.2, 2.2)
      let ry = ly * lerp(64, 13, e) + 1.3 * Math.sin(t * 0.9) * viv
      const rx = lx * (lerp(16, 3.5, e) + 0.7 * Math.sin(t * 0.7 + 1) * viv)
      if (AB.saida === 'virar') ry = lerp(ry, ly < 0 ? -90 : 90, E.inCubic(P(t, A - 0.42, A)))
      // assentado, o painel não para: chega mais perto devagar até a virada (com o índice a abertura fica longa, e o
      // refino reprovava 0,7 s de quadro parado entre o título e as pílulas)
      const perto = 110 * E.inOutSine(P(t, 1.3, A))
      pl.style.transform = `perspective(2600px) translate3d(${(-ly * lerp(380, 0, e)).toFixed(1)}px, ${(dy + lerp(140, 0, e)).toFixed(1)}px, ${(lerp(-2400, 0, e) + perto).toFixed(1)}px) rotateY(${ry.toFixed(3)}deg) rotateX(${rx.toFixed(3)}deg) scale(${sc.toFixed(4)})`
      O(pl, E.outCubic(P(t, 0.3, 0.55)))
      luz.style.backgroundPosition = `${lerp(112, -12, E.inOutSine(P(t, 1.05, 1.95))).toFixed(2)}% 0`
    }
    // onde a prévia assenta (o mergulho entra nela)
    up.centro = [fo.x + fo.w / 2, fo.y + fo.h / 2 + dy]
    return up
  }

  // ---------- o índice das seções (visual.abertura.indice, 2 ou mais g.secao) ----------
  // Depois do título, as seções do roteiro entram no lugar dele como pílulas numeradas (01, 02…), uma a cada 0,15 s, num
  // leque em profundidade: cada uma gira de lado (preso na borda esquerda) e vem de trás, e assenta levemente virada para o
  // painel, cada uma um pouco mais funda que a anterior. Seguram o tempo de ler e saem com a abertura. Os tempos vêm do
  // compor (planoDoIndice): TU.indice = { t0, ini, passo, entra, itens: [{ num, nome }] }.
  const IDX = TU.indice || null
  function indiceDasSecoes(w, ls, area) {
    const rs = ls.map((l) => rectOf(l.line))
    const centro = TI.alinhar === 'centro', xc = area ? (area.x0 + area.x1) / 2 : CX
    const ax0 = area ? area.x0 : S.x0, ax1 = area ? area.x1 : S.x1
    const x0 = Math.min(...rs.map((r) => r.x))
    const larg = centro ? 2 * Math.min(xc - ax0, ax1 - xc) - 40 : ax1 - x0 - 12
    let tam = L({ '16x9': 54, '9x16': 52, padrao: 48 })
    const pills = IDX.itens.map((it) => {
      const p = el('div', { style: { position: 'absolute', left: '0', top: '0', display: 'flex', alignItems: 'baseline', gap: '0.55em', whiteSpace: 'nowrap', background: PILULA.fundo, color: PILULA.tinta, borderRadius: '999px', font: `700 ${tam}px/1.15 ${FX}`, padding: '0.3em 0.8em 0.32em', transformOrigin: '0% 50%' } }, w)
      el('span', { text: it.num, style: { fontWeight: '700', fontVariantNumeric: 'tabular-nums' } }, p)
      el('span', { text: it.nome, style: { fontWeight: '600' } }, p)
      marcarSe(p, 'texto')
      return p
    })
    // cabe na coluna: a letra encolhe (até 30 px) até a pílula mais larga caber
    for (let volta = 0; volta < 12 && Math.max(...pills.map((p) => rectOf(p).w)) > larg && tam > 30; volta++) { tam -= 2; for (const p of pills) p.style.fontSize = px(tam) }
    const hs = pills.map((p) => rectOf(p).h), gap = Math.round(tam * 0.5), tot = hs.reduce((a, b) => a + b, 0) + gap * (pills.length - 1)
    // de lado, o índice fica no meio de onde o título estava; em pé, começa onde o título começava
    const yTit = (Math.min(...rs.map((r) => r.y)) + Math.max(...rs.map((r) => r.y + r.h))) / 2
    let y = LAY.lateral || HORIZONTAL ? clamp(yTit - tot / 2, S.y0 + 8, S.y1 - 8 - tot) : Math.max(S.y0 + 8, Math.min(...rs.map((r) => r.y)))
    pills.forEach((p, i) => { const pw = rectOf(p).w; place(p, centro ? xc - pw / 2 : x0, y); y += hs[i] + gap })
    const up = (t) => pills.forEach((p, i) => {
      const s0 = IDX.ini + i * IDX.passo, e = E.outCubic(P(t, s0, s0 + IDX.entra))
      O(p, E.outCubic(P(t, s0, s0 + 0.16)))
      T(p, `perspective(1200px) translate3d(${(-40 * (1 - e)).toFixed(1)}px, ${(26 * (1 - e)).toFixed(1)}px, ${(-420 * (1 - e) - 16 * i).toFixed(1)}px) rotateY(${(-64 * (1 - e) - 5).toFixed(2)}deg)`)
    })
    return { up, pills }
  }

  // ---------- abertura ----------
  const janAb = { mergulho: [A - 0.45, 0.45], corte: null, deslizar: [A - 0.35, 0.5], cortina: [A - 0.4, 0.8], virar: [A - 0.42, 0.9] }[AB.saida]
  // o avanço do título na saída "deslizar" (4%, ou menos se um texto sairia da área segura)
  let AMP = 0.04
  // Abertura "pouso": sem título, selo nem painel. O aparelho 3D entra com a tela do app e assenta onde a tela gravada
  // vai estar; tudo acontece na cena da tela (abaixo), que começa em 0.
  const POUSO = AB.saida === 'pouso' && CINE && TOQUE
  if (!POUSO) cena(0, A + 0.5, (root) => {
    const fu = fundo(el('div', { cls: 'layer' }, root), 'abertura')
    const w3 = CINE && TOQUE ? el('div', { cls: 'layer', style: { pointerEvents: 'none' } }, root) : null
    const wp = PAINEL ? el('div', { cls: 'layer', style: { pointerEvents: 'none' } }, root) : null
    const w = el('div', { cls: 'layer' }, root)
    // com a prévia, o quadro deitado divide o quadro (título à esquerda, tela à direita) e o 9:16 sobe o título
    const pv = previaDoResultado()
    let area = pv && HORIZONTAL ? { x0: S.x0 + 50, x1: W * 0.52 } : null
    const ent0 = L({ '16x9': 124, '9x16': 132, padrao: 120 })
    let meio = L({ '16x9': 560, '9x16': pv ? 590 : 880, padrao: H / 2 + 40 })
    if (PAINEL && pv) {
      // o painel da abertura mora onde o dos passos vai estar: de lado, o título fica na coluna da legenda, alinhado com o
      // texto dela e na altura do meio do painel; em pé, no alto, acima do painel (o selo acima dele, na área segura)
      const fo = foraDoPainel(), G = LAY.legenda, mg = L({ '16x9': 40, padrao: 24 })
      if (LAY.lateral) { area = { x0: G.x + (LG.tipo === 'solta' ? L({ '16x9': 10, padrao: 12 }) : L({ '16x9': 30, padrao: 36 })) - mg, x1: G.x + G.w }; meio = fo.y + fo.h / 2 }
      else { const n = TU.textos.tituloLinhas.length; area = null; meio = S.y0 + 112 + (n * ent0) / 2 + 16 }
    }
    // com o índice, o título e o selo moram numa camada própria, que sai quando as pílulas entram
    const wt = IDX ? el('div', { cls: 'layer' }, w) : w
    const ls = titulo(wt, TU.textos.tituloLinhas, { tam0: L({ '16x9': 112, '9x16': 100, padrao: 92 }), ent0, tinta: TI.tinta, meio, area })
    const su = selo(wt, ls, area ? (area.x0 + area.x1) / 2 : CX)
    const idx = IDX ? indiceDasSecoes(w, ls, area) : null
    // (em pé, a prévia mora abaixo do que for mais baixo: o título ou o índice)
    const altura = idx ? [...ls, ...idx.pills.map((p) => ({ line: p }))] : ls
    const pr = pv ? (wp ? previaPainel(wp, pv, altura) : w3 ? previaCinema(w3, altura, pv, area) : previa(w, altura, pv, area)) : () => {}
    // Modo cinema: o vídeo abre num painel na cor do fecho (ou abertura.painel), que sai numa diagonal rápida e revela o
    // título (o gancho: título nascendo sobre fundo claro não muda o quadro nos 2 primeiros segundos).
    const painel = CINE ? el('div', { cls: 'layer', style: { background: AB.painel || FC.fundo, pointerEvents: 'none' } }, root) : null
    // no painel, o logo da marca (o quadro nunca fica vazio: o refino reprova fundo sozinho): o SVG do MARCA.logo, ou o PNG
    // que se lê sobre a cor do painel (MARCA.png, escolhido pelo compor). O PNG fica 0,25 s parado antes de o painel sair.
    let logoPainel = null
    const pngPainel = !MARCA.logo && TU.png && TU.png.painel
    const dp = pngPainel ? 0.25 : 0
    if (painel && pngPainel) {
      const pg = TU.png.painel, LW = Math.min((S.x1 - S.x0) * 0.5, L({ '16x9': 640, padrao: 560 }), pg.w), LH = (LW * pg.h) / pg.w
      logoPainel = imagem(painel, pg.src, { left: px(CX - LW / 2), top: px(CY - LH / 2), width: px(LW), height: px(LH), transformOrigin: '50% 50%' })
      marcarSe(logoPainel, 'logo')
    } else if (painel && MARCA.logo) {
      const vb = MARCA.logo.viewBox.split(/\s+/).map(Number), LW = Math.min((S.x1 - S.x0) * 0.62, L({ '16x9': 640, padrao: 560 })), LH = (LW * vb[3]) / vb[2]
      logoPainel = sv('svg', { viewBox: MARCA.logo.viewBox, width: LW, height: LH }, painel)
      Object.assign(logoPainel.style, { position: 'absolute', left: px(CX - LW / 2), top: px(CY - LH / 2), transformOrigin: '50% 50%' })
      const g = sv('g', { transform: MARCA.logo.transform || '' }, logoPainel)
      for (const pt of MARCA.logo.partes) sv('path', { d: pt.d, fill: FC.logo === 'negativo' ? FC.tinta : pt.fill, ...(pt.transform ? { transform: pt.transform } : {}) }, g)
    }
    if (painel) registrarTransicao('abertura/painel', 0, 0.75 + dp)
    if (janAb) registrarTransicao(`abertura/${AB.saida}`, ...janAb)
    // Na saída "deslizar" o título avança 4% enquanto é lido (o crescimento parte do canto de baixo à direita: a camada tem a
    // origem no centro). Texto perto da borda de cima ou da esquerda sairia da área segura: o avanço para antes disso.
    if (AB.saida === 'deslizar') {
      const marcados = [...w.querySelectorAll('[data-colisao="texto"]')].map((e) => rectOf(e)).filter((r) => r.w > 0)
      const teto = Math.min(1.04, ...marcados.map((r) => Math.min((W - S.x0 - 2) / Math.max(1, W - r.x), (H - S.y0 - 2) / Math.max(1, H - r.y))))
      AMP = Math.max(0, teto - 1)
    }
    return (t) => {
      fu(t); su(t); pr(t); entrar(ls, t, 0.25 + dp)
      if (idx) { exitWords(palavras(ls), t, IDX.t0, 0.03, 0.3); O(wt, 1 - E.inCubic(P(t, IDX.t0 + 0.05, IDX.t0 + 0.32))); idx.up(t) }
      if (painel) {
        const e = E.inOutCubic(P(t, 0.1 + dp, 0.7 + dp)), x = lerp(-25, 125, e)
        painel.style.clipPath = `polygon(${x.toFixed(2)}% 0, 125% 0, 125% 100%, ${(x - 25).toFixed(2)}% 100%)`
        O(painel, e < 1 ? 1 : 0)
        if (logoPainel) T(logoPainel, `translateX(${(E.inCubic(P(t, 0.1 + dp, 0.7 + dp)) * W * 0.35).toFixed(1)}px) scale(${(1 + 0.06 * P(t, 0, 0.7 + dp)).toFixed(4)})`)
      }
      if (AB.saida === 'mergulho') {
        // mergulha na tela: zoom-through no ponto onde a tela vai aparecer (no painel, a própria prévia do resultado)
        const z = Math.exp(Math.log(9) * E.inCubic(P(t, A - 0.45, A)))
        // (a camada tem a origem no centro do quadro: no painel, o deslocamento é até o centro da prévia, a partir dele)
        if (wp && pr.centro) { const dx = pr.centro[0] - CX, dy = pr.centro[1] - CY; T(w, `translate(${dx}px,${dy}px) scale(${z}) translate(${-dx}px,${-dy}px)`) }
        else T(w, `translate(${CX}px,${CY}px) scale(${z}) translate(${-CX}px,${-CY}px)`)
        O(w, 1 - P(t, A - 0.12, A))
      } else if (AB.saida === 'deslizar') {
        // o título não fica parado enquanto é lido: avança devagar (4%) até a tela entrar
        const push = 1 + AMP * E.inOutSine(P(t, 0.25, A))
        T(w, `translateX(${-W * E.inOutCubic(P(t, A - 0.35, A + 0.15))}px) translate(${CX}px,${CY}px) scale(${push}) translate(${-CX}px,${-CY}px)`)
      } else if (AB.saida === 'virar') {
        // o título sai de lado enquanto o painel vira; em A ele já saiu e a legenda do 1º passo entra
        const e = E.inCubic(P(t, A - 0.4, A))
        T(w, `translateX(${(-48 * e).toFixed(1)}px)`); O(w, t < A ? 1 - e : 0)
      }
      else O(w, t < A ? 1 : 0)
      if (wp) {
        wp.style.display = t < A ? 'block' : 'none'
        // a prévia no painel sai com o título: desliza junto (deslizar) ou atravessa a câmera junto (mergulho)
        if (AB.saida === 'deslizar') T(wp, `translateX(${(-W * E.inOutCubic(P(t, A - 0.35, A + 0.15))).toFixed(1)}px)`)
        // (no mergulho a prévia fica inteira até o painel dos passos cobrir: sem o quadro vazio de uma fusão)
        else if (AB.saida === 'mergulho') wp.style.transform = w.style.transform
      }
      // a camada 3D sai junto com o título, sem o crescimento de 4% da saída "deslizar"
      if (w3) {
        if (AB.saida === 'deslizar') T(w3, `translateX(${-W * E.inOutCubic(P(t, A - 0.35, A + 0.15))}px)`)
        else if (AB.saida === 'mergulho') { w3.style.transform = w.style.transform; O(w3, 1 - P(t, A - 0.12, A)) }
        else O(w3, t < A ? 1 : 0)
      }
    }
  }, 'abertura')

  // ---------- a pessoa atrás do aparelho (vídeo com a pessoa na câmera: video.pessoa) ----------
  // TU.pessoa = { entrada, saida, fecho }: quadros dos takes dela ([[arquivo, t], …], extraídos pelo compose.mjs).
  //   entrada  o fim do take da abertura corre atrás do aparelho que chega, e desfoca;
  //   saida    o 1º quadro do take seguinte aparece do desfoque ao foco enquanto o aparelho sai;
  //   fecho    o fim desse take corre por baixo da entrada do fechamento.
  // Com k = 0 a imagem é o quadro do take, sem filtro nenhum: a montagem corta seco do take para o miolo (e de volta)
  // em quadros iguais, e o que se vê é o gesto do aparelho, não uma fusão.
  const SEM_LEG = LG.tipo === 'nenhuma'
  const PES = TU.pessoa || null, SAI = TU.saida || null
  const provas = ev.filter((e) => e.tipo === 'prova'), placar = ev.find((e) => e.tipo === 'placar') || null
  // no relógio da tela: quanto o aparelho recuou para dar o quadro ao placar, e quanto já saiu de cena (0 → 1)
  const recuo = (tc) => (placar ? E.inOutCubic(P(tc, placar.t + 0.05, placar.t + 0.75)) : 0)
  const saida = (tc) => (SAI ? P(tc, SAI.de, SAI.de + SAI.dur) : 0)
  function camadaPessoa(root) {
    const box = el('div', { cls: 'layer', style: { overflow: 'hidden', pointerEvents: 'none', background: '#000' } }, root)
    const faz = (qs) => (qs && qs.length ? sequencia(box, qs, { width: px(W), height: px(H), objectFit: 'cover', transformOrigin: '50% 40%' }) : null)
    const sq = { entrada: faz(PES.entrada), saida: faz(PES.saida), fecho: faz(PES.fecho) }
    const veu = el('div', { cls: 'layer', style: { background: FU.cor } }, box)
    const mostra = (qual, tp, kk) => {
      const tem = !!(qual && sq[qual])
      box.style.display = tem ? 'block' : 'none'
      for (const n in sq) if (sq[n]) sq[n].el.style.display = n === qual ? 'block' : 'none'
      if (!tem) return
      const im = sq[qual].el, borra = kk > 0.002
      sq[qual].set(tp)
      im.style.filter = borra ? `blur(${(26 * kk).toFixed(2)}px)` : 'none'
      T(im, borra ? `scale(${(1 + 0.07 * kk).toFixed(4)})` : 'none')
      O(veu, borra ? 0.5 * kk : 0)
    }
    return (t) => {
      const tc = t - A
      if (t >= A + D) return mostra('fecho', t - (A + D), 0)
      if (SAI && tc >= SAI.de) return mostra('saida', 0, 1 - E.inOutCubic(P(tc, SAI.de + 0.12 * SAI.dur, SAI.de + SAI.dur)))
      // na entrada o rosto some rápido atrás do desfoque: a fala dela pode seguir por cima do aparelho que chega
      if (POUSO && t < A + 0.45) return mostra('entrada', t, E.outCubic(P(t, 0, A * 0.45)))
      mostra(null)
    }
  }

  // ---------- tela real ----------
  // (com a pessoa por baixo, a cena fica até a entrada do fechamento cobrir o quadro inteiro)
  cena(POUSO ? 0 : A - 0.45, A + D + (PES ? 0.8 : 0.6), (root) => {
    const pes = PES ? camadaPessoa(root) : null
    const fc = el('div', { cls: 'layer' }, root), fu = fundo(fc, 'tela')
    // Modo cinema: atrás do aparelho, a própria tela gravada, ampliada e desfocada, cobrindo o quadro. O espaço em volta
    // deixa de ser fundo liso sobrando (lê como vazio) e anda com o app. Um véu no tom da
    // série por cima mantém a cara da marca.
    // (no painel, não: a tela mora no painel sobre o fundo da série, e atrás do texto não passa imagem nenhuma)
    let fundoTela = null
    if (CINE && !PAINEL) {
      const bd = el('div', { cls: 'layer', style: { overflow: 'hidden', pointerEvents: 'none' } }, root)
      const esc = Math.max(W / T0.w, H / T0.h) * 1.15, bw = T0.w * esc, bh = T0.h * esc
      // sem saturar e com véu de 55%: um botão de cor forte do app virava uma mancha no fundo
      const sq = sequencia(bd, TU.quadros, { left: px((W - bw) / 2), top: px((H - bh) / 2), width: px(bw), height: px(bh), filter: 'blur(80px) saturate(0.45)' })
      el('div', { cls: 'layer', style: { background: rgba(FU.cor, 0.55) } }, bd)
      fundoTela = { bd, sq }
    }
    // Com zoom, a tela pode passar por baixo da legenda, mas nunca aparecer do outro lado dela (a tira entre a
    // legenda e a borda do quadro): lá ela vira um pedaço de app solto. O recorte fica na borda de fora da legenda.
    // Abertura "pouso": o aparelho 3D entra aqui, por cima do fundo e por baixo da tela gravada, que toma o lugar dele
    // em A. O lugar onde ele assenta é o do corpo do aparelho gravado, pela câmera daquele instante.
    let pouso = null
    if (POUSO) {
      const w3 = el('div', { cls: 'layer', style: { pointerEvents: 'none' } }, root)
      const cr = LAY.cromo, [x0, y0, sc] = noQuadro(T0.x - cr.l, T0.y - cr.t, A)
      const corpo = { x: x0, y: y0, w: (T0.w + cr.l + cr.r) * sc, h: (T0.h + cr.t + cr.b) * sc }
      pouso = { w3, up: cinemaPouso(w3, { src: TU.quadros[0][0], ret: corpo, corAparelho: M.cor || '#14161C', corLuz: V.realce.cor || '#FFFFFF', A }) }
      // (sem marcador para a checagem: como a tela gravada no plano geral, o aparelho inteiro usa o quadro todo)
      registrarTransicao('abertura/pouso', 0, A)
    }
    const b = LG.tipo === 'faixa' ? LAY.banda : LAY.legenda
    // Texto fora da imagem (o painel, ou "texto": "fora-da-imagem"): o recorte fica na borda da parte livre, e a tela com zoom
    // some ali num esfumado de 36 px, sem nunca passar por baixo do texto. É o que garante a regra; a checagem confere.
    const lv = LAY.livre, ESF = 36
    const recLivre = { esquerda: `inset(0 0 0 ${lv.x}px)`, direita: `inset(0 ${W - lv.x - lv.w}px 0 0)`, cima: `inset(${lv.y}px 0 0 0)`, baixo: `inset(0 0 ${H - lv.y - lv.h}px 0)` }[LAY.lado]
    const mascLivre = { esquerda: `linear-gradient(to right, transparent ${lv.x}px, #000 ${lv.x + ESF}px)`, direita: `linear-gradient(to left, transparent ${W - lv.x - lv.w}px, #000 ${W - lv.x - lv.w + ESF}px)`,
      cima: `linear-gradient(to bottom, transparent ${lv.y}px, #000 ${lv.y + ESF}px)`, baixo: `linear-gradient(to top, transparent ${H - lv.y - lv.h}px, #000 ${H - lv.y - lv.h + ESF}px)` }[LAY.lado]
    // (com a legenda "nenhuma" não há legenda do motor para a tela passar por baixo: sem recorte)
    // (no painel, o recorte encosta na coluna: a janela nunca chega perto dela, e a sombra do painel esmaece sem um corte reto)
    const recPainel = { esquerda: `inset(0 0 0 ${b.x + b.w + 4}px)`, direita: `inset(0 ${W - b.x + 4}px 0 0)`, cima: `inset(${b.y + b.h + 4}px 0 0 0)`, baixo: `inset(0 0 ${H - b.y + 4}px 0)` }[LAY.lado]
    const recorte = SEM_LEG ? 'none' : PAINEL ? recPainel : CLIP_LIVRE ? recLivre : { baixo: `inset(0 0 ${H - b.y - b.h}px 0)`, cima: `inset(${b.y}px 0 0 0)`, direita: `inset(0 ${W - b.x - b.w}px 0 0)`, esquerda: `inset(0 0 0 ${b.x}px)` }[LAY.lado]
    const corte = el('div', { cls: 'layer', style: { clipPath: recorte } }, root)
    // Celular no 16:9 com zoom: a tela do app é mais alta que o quadro, e o texto cortado na borda de cima e de
    // baixo some num esfumado (nunca uma linha pela metade colada na borda). No plano geral (z = 1) o aparelho cabe
    // inteiro e não leva esfumado nenhum: ele entra conforme a câmera aproxima.
    const mascara16 = HORIZONTAL && TOQUE ? (z) => {
      const k = clamp((z - 1) / 0.35), a = (56 * k).toFixed(1), b = (150 * k).toFixed(1)
      const m = k <= 0 ? 'none' : `linear-gradient(to bottom, transparent 0, transparent ${a}px, #000 ${b}px, #000 calc(100% - ${b}px), transparent calc(100% - ${a}px), transparent 100%)`
      corte.style.webkitMaskImage = m; corte.style.maskImage = m
    } : null
    // No 9:16, no detalhe, a tela do app some onde a interface da rede social cobre o vídeo (embaixo da área segura:
    // legenda e música). No plano geral (z = 1) não: o aparelho inteiro usa o quadro todo, nunca cortado no meio.
    // A máscara entra conforme a câmera aproxima: inteira em z ≥ 1,35, ou já no zoom de leitura quando ele é menor
    // (tela mais curta que 390×844: com 390×694 o detalhe é z = 1,245, a máscara parava em 70% e o rodapé do app ficava
    // legível debaixo da interface da rede, em y 1630).
    const zCheia = Math.min(0.35, Math.max(0.05, (ZMIN > 1 ? ZMIN : 1.35) - 1))
    const mascara9 = FMT === '9x16' && TOQUE && !SEM_LEG ? (z) => {
      const f = lerp(H + 130, S.y1, clamp((z - 1) / zCheia)), m = `linear-gradient(to bottom, #000 0, #000 ${(f - 120).toFixed(1)}px, transparent ${f.toFixed(1)}px, transparent 100%)`
      corte.style.webkitMaskImage = m; corte.style.maskImage = m
    } : null
    if (CLIP_LIVRE && !PAINEL && !SEM_LEG && !mascara9 && !mascara16) { corte.style.webkitMaskImage = mascLivre; corte.style.maskImage = mascLivre }
    // Painel: uma camada em perspectiva (que inclina, respira, vira e recua: painelEm, abaixo) com a moldura parada e a
    // janela da tela; a câmera aproxima e recua o mundo DENTRO da janela, que corta o que passa dela. O painel nunca muda
    // de lugar no quadro: a tela nunca chega perto do texto nem sai da área segura.
    const p3 = PAINEL ? el('div', { cls: 'layer' }, corte) : corte
    const moP = PAINEL ? moldura(p3) : null
    const janela = PAINEL ? el('div', { style: { ...ret(T0), borderRadius: moP.raioTela, overflow: 'hidden', background: '#FFFFFF' } }, p3) : p3
    const mundo = el('div', { cls: 'layer', style: PAINEL ? { left: px(-T0.x), top: px(-T0.y) } : {} }, janela)
    // (sem legenda do motor, a troca de passo não aparece na tela: o brilho fica só para as provas)
    const optTroca = { passos: SEM_LEG ? [] : passos, telas, provas, cor: V.realce.cor || V.indicador.tinta }
    let troca = CINE && !PAINEL ? cinemaTroca(el('div', { cls: 'layer', style: { pointerEvents: 'none' } }, corte), optTroca) : null
    const mo = PAINEL ? { raioTela: '0', up: moP.up, depois: null } : moldura(mundo)
    const RC = V.realce, IN = V.indicador
    const conteudo = conteudoTela(mundo, {
      realce: RC, dedo: [rgba(IN.tinta, 0.3), rgba(IN.contorno, 0.95)], seta: [IN.tinta, IN.contorno], onda: TOQUE ? IN.contorno : RC.cor,
      selo: { fundo: RC.cor, tinta: legivel(RC.cor), sombra: '#000000', raio: RC.raio > 0 ? 999 : 0 },
      brilho: PAINEL ? RC.cor : null,
    }, mo.raioTela)
    if (mo.depois) mo.depois()
    // no painel, o brilho da troca de passo passa só pelo vidro da tela (não pelo fundo em volta)
    if (PAINEL) troca = cinemaTroca(mundo.querySelector('[data-fv="tela"]'), { ...optTroca, dentro: true })
    const fo = foraDoPainel()
    if (PAINEL) p3.style.transformOrigin = `${fo.x + fo.w / 2}px ${fo.y + fo.h / 2}px`
    // A pose do painel no instante t: inclinado para o texto no plano geral e quase de frente no zoom de leitura; respira
    // (rotação e profundidade em senos lentos que nunca param juntos); gira na troca de tela; vira em Y na seção nova (sai
    // de lado até 90°, volta do outro lado) e na saída "virar" da abertura; recua no fechamento.
    const ly = LAY.lateral ? (LAY.lado === 'direita' ? 1 : -1) : -0.4, lx = LAY.lateral ? 1 : 2.2
    const giraSecoes = secoes.filter((x) => x.t > SECAO_SEM_GIRO)
    // o movimento do painel nos passos (visual.painel) e a entrada do cartão de capítulo (visual.secao)
    const MOV = (V.painel || {}).movimento || 'respira', SEC = V.secao || {}, ENT = SEC.entrada || 'diagonal'
    const SEM_ZOOM_P = (V.painel || {}).zoom === 'nenhum'
    const TS = SEC.tempos || { de0: -0.5, de1: -0.12, ate0: 0.45, ate1: 0.9, volta: 1.0 }
    // travelling: um sentido por trecho entre seções (a seção nova inverte), de lado a lado da folga que o texto deixa
    const marcos = [0, ...giraSecoes.map((x) => x.t), D]
    const trechos = marcos.slice(0, -1).map((a, i) => [a, marcos[i + 1]])
    const ampT = LAY.lateral ? 30 : 140
    let filtroPainel = ''
    // com o cartão de capítulo (modo cinema), o painel fica de lado enquanto o cartão cobre o quadro e vira de volta quando
    // ele sai: a virada que se vê é a da volta. Nas outras entradas ele é empurrado (para cima ou de lado) ou recua.
    const painelEm = (t, tc, giro, sai) => {
      const zf = clamp((cam(t).z - 1) / 0.5)
      // (no zoom de leitura a respiração cai pela metade: o texto do app fica de frente para ler)
      const vv = lerp(1, 0.5, zf)
      let ry, rx, tz, tx = 0, ty = 0
      if (MOV === 'plano' && SEM_ZOOM_P) {
        // tela inteira: o painel recua e volta de leve (só para trás, nunca cresce: a página fica inteira no quadro) e gira
        // meio grau, para o quadro nunca parar enquanto a voz fala e a mão espera
        ry = ly * 1.2 + 1.5 * Math.sin(t * 0.53); rx = 0.8 * Math.sin(t * 0.41 + 1)
        tz = -12 * (1 + Math.sin(t * 0.8)) - 6 * (1 + Math.sin(t * 1.6 + 1))
      } else if (MOV === 'plano') { ry = ly * 1.2; rx = 0; tz = 0 }
      else if (MOV === 'orbita') {
        // gira em volta do próprio centro: Y e X em quadratura, uma volta a cada 9 s; menor no zoom de leitura
        const w = (2 * Math.PI) / 9
        ry = ly * lerp(3, 1, zf) + lerp(7, 2.4, zf) * Math.sin(w * t)
        rx = lx * lerp(1.4, 0.4, zf) + lerp(3.2, 1.1, zf) * Math.cos(w * t)
        tz = -36 * (1 + Math.sin(w * t * 0.5))
      } else {
        ry = ly * lerp(5.5, 1.3, zf) + vv * (1.0 * Math.sin(t * 0.37) + 0.45 * Math.sin(t * 0.83 + 1))
        rx = lx * (lerp(2, 0.5, zf) + vv * 0.6 * Math.sin(t * 0.29 + 2))
        tz = -22 * (1 + Math.sin(t * 0.23))
        if (MOV === 'travelling') {
          let k = trechos.findIndex(([, b]) => tc < b)
          if (k < 0) k = trechos.length - 1
          const [a, b] = trechos[k], dir = k % 2 ? -1 : 1, u = P(tc, a, b)
          tx = dir * ampT * lerp(-1, 1, E.inOutSine(u))
          ry += dir * 3 * Math.sin(Math.PI * u) * lerp(1, 0.5, zf)
        }
      }
      tz -= 14 * Math.abs(giro)
      ry += 1.6 * giro
      filtroPainel = ''
      for (const x of giraSecoes) {
        const u = tc - x.t
        if (CINE && ENT === 'empurrar') {
          // o cartão sobe de baixo e empurra o painel para cima; sai por cima e o painel volta de baixo
          if (u <= TS.de0 || u >= TS.ate1) continue
          ty = u < (TS.de1 + TS.ate0) / 2 ? -H * E.inOutCubic(P(u, TS.de0, TS.de1)) : H * (1 - E.inOutCubic(P(u, TS.ate0, TS.ate1)))
          continue
        }
        if (CINE && ENT === 'whip') {
          // chicote: o painel sai pela esquerda com o cartão entrando, e volta pela direita com ele saindo, borrado
          if (u <= TS.de0 || u >= TS.ate1) continue
          const ida = u < (TS.de1 + TS.ate0) / 2, p = ida ? P(u, TS.de0, TS.de1) : P(u, TS.ate0, TS.ate1), e = E.inOutQuint(p)
          tx = ida ? -1.15 * W * e : 1.15 * W * (1 - e)
          const bl = 46 * Math.sin(Math.PI * p)
          if (bl > 0.5) filtroPainel = `blur(${bl.toFixed(1)}px)`
          continue
        }
        if (CINE && ENT === 'mascara') {
          // o painel recua enquanto o círculo cobre o quadro e volta para a frente quando ele se fecha
          if (u <= TS.de0 || u >= TS.volta) continue
          const kk = u < (TS.de1 + TS.ate0) / 2 ? E.inCubic(P(u, TS.de0, TS.de1)) : 1 - E.outCubic(P(u, TS.ate0, TS.volta))
          tz -= 520 * kk
          continue
        }
        if (CINE) {
          if (u <= -0.12 || u >= 1.0) continue
          const e = E.outCubic(P(u, 0.45, 1.0))
          ry = lerp(ly < 0 ? 90 : -90, ry, e); tz -= 320 * (1 - e)
          continue
        }
        if (u <= -0.34 || u >= 0.46) continue
        ry = u < 0 ? lerp(ry, ly < 0 ? -90 : 90, E.inCubic(P(u, -0.34, 0))) : lerp(ly < 0 ? 90 : -90, ry, E.outCubic(P(u, 0, 0.46)))
        tz -= 320 * Math.sin(Math.PI * P(u, -0.34, 0.46))
      }
      if (AB.saida === 'virar' && t < A + 0.46) ry = lerp(ly < 0 ? 90 : -90, ry, E.outCubic(P(t, A, A + 0.46)))
      ry -= ly * 16 * sai; tz -= 600 * sai
      const mv = tx || ty ? `translate3d(${tx.toFixed(1)}px, ${ty.toFixed(1)}px, ${tz.toFixed(1)}px)` : `translateZ(${tz.toFixed(1)}px)`
      return `perspective(2600px) ${mv} rotateY(${ry.toFixed(3)}deg) rotateX(${rx.toFixed(3)}deg)`
    }
    // a entrada do painel dos passos nas saídas da abertura que não são a "virar" (essa vira em painelEm): desliza da
    // direita, sai de dentro (mergulho) ou só aparece em A (cortina e corte, que cobrem a troca)
    const entradaPainel = (t, s) => {
      if (s === 'deslizar') return `translateX(${(W * (1 - E.inOutCubic(P(t, A - 0.35, A + 0.15)))).toFixed(1)}px) `
      // (mergulho: a câmera atravessou a prévia; o painel chega de perto, maior, e assenta)
      if (s === 'mergulho') { O(p3, P(t, A - 0.16, A - 0.02)); return `scale(${lerp(1.4, 1, E.outExpo(P(t, A - 0.16, A + 0.55))).toFixed(4)}) ` }
      if (s === 'cortina' || s === 'corte') O(p3, t >= A ? 1 : 0)
      return ''
    }
    // Legenda "nenhuma": o berço da legenda da montagem. Do lado reservado, o quadro escurece na cor da série: a
    // legenda se lê sobre o app claro. O que do app passa da área segura (onde a interface da rede cobre o vídeo, em
    // cima e embaixo) também escurece: o aparelho continua em cena, e o olho fica na faixa do meio, onde se lê.
    let berco = null
    if (SEM_LEG && !LAY.lateral) {
      const G = LAY.legenda, c = (a) => rgba(FU.cor, a)
      const leg = LAY.lado === 'baixo'
        ? `linear-gradient(to bottom, ${c(0)} ${G.y - 150}px, ${c(0.56)} ${G.y + 60}px, ${c(0.6)} ${S.y1}px, ${c(0.76)} ${H}px)`
        : `linear-gradient(to top, ${c(0)} ${H - G.y - G.h - 150}px, ${c(0.56)} ${H - G.y - G.h + 60}px, ${c(0.6)} ${H - S.y0}px, ${c(0.76)} ${H}px)`
      // a ponta oposta, só quando a área segura deixa uma faixa do quadro de fora (9:16 de rede social)
      const oposta = LAY.lado === 'baixo'
        ? (S.y0 > 120 ? `linear-gradient(to bottom, ${c(0.46)} 0px, ${c(0.34)} ${S.y0}px, ${c(0)} ${S.y0 + 220}px)` : null)
        : (H - S.y1 > 120 ? `linear-gradient(to top, ${c(0.46)} 0px, ${c(0.34)} ${H - S.y1}px, ${c(0)} ${H - S.y1 + 220}px)` : null)
      // Fora da área segura (em cima e embaixo, onde a interface da rede cobre o vídeo) o app sai de foco: passa como
      // forma, não como texto para ler. O refino acusava o texto do chat legível acima de y 250 por 13 s.
      const fora = (y0, y1, masc) => el('div', { style: { position: 'absolute', left: '0', top: px(y0), width: px(W), height: px(y1 - y0), pointerEvents: 'none', backdropFilter: 'blur(9px)', webkitBackdropFilter: 'blur(9px)', maskImage: masc, webkitMaskImage: masc } }, root)
      const desfoques = []
      if (S.y0 > 120) desfoques.push(Object.assign(fora(0, S.y0 + 90, `linear-gradient(to bottom, #000 0px, #000 ${S.y0 + 10}px, transparent ${S.y0 + 90}px)`), { ponta: 'cima' }))
      if (H - S.y1 > 120) desfoques.push(Object.assign(fora(S.y1 - 70, H, 'linear-gradient(to bottom, transparent 0px, #000 90px, #000 100%)'), { ponta: 'baixo' }))
      berco = el('div', { cls: 'layer', style: { pointerEvents: 'none', background: oposta ? `${leg}, ${oposta}` : leg } }, root)
      berco.desfoques = desfoques
    }
    const cort = AB.saida === 'cortina' ? el('div', { cls: 'layer', style: { background: AB.cor } }, root) : null
    return (t) => {
      const tc = t - A, s = AB.saida
      const sd = saida(tc), rc = recuo(tc)
      if (pes) pes(t)
      // pouso: o fundo da tela chega enquanto o aparelho assenta (por cima da pessoa, se houver)
      const chegou = POUSO ? E.outCubic(P(t, A * 0.3, A - 0.05)) : 1
      // o fundo da tela só aparece quando a abertura (que desenha o mesmo fundo) já saiu da frente
      O(fc, POUSO ? (PES ? 0 : 1) : (s === 'mergulho' ? t >= A - 0.12 : s === 'deslizar' ? t >= A + 0.15 : t >= A) ? 1 : 0)
      fu(t)
      if (fundoTela) {
        // entra com a tela (sem cortar o fundo da abertura) e sai junto com ela: no fechamento, ou com o aparelho que
        // volta para a pessoa
        const op = (POUSO ? chegou : E.outCubic(P(t, A - 0.2, A + 0.4))) * (SAI ? 1 - P(sd, 0, 0.5) : 1 - P(t, A + D + 0.2, A + D + 0.55))
        O(fundoTela.bd, op)
        if (op > 0) fundoTela.sq.set(Math.max(0, tc))
      }
      const ent = s === 'mergulho' ? E.outExpo(P(t, A - 0.2, A + 0.5)) : 1, sai = E.inOutCubic(P(t, A + D - 0.1, A + D + 0.55))
      aplicarCamera(mundo, cam, t)
      if (mascara9) mascara9(cam(t).z)
      if (mascara16) mascara16(cam(t).z)
      // troca de tela: a tela "respira" (recua 3,5% e volta em 0,45 s) no tempo do whoosh
      let resp = 0
      for (const e of telas) resp = Math.max(resp, Math.sin(Math.PI * P(tc, e.t + 0.05, e.t + 0.5)))
      // (no painel, quem recua é o painel inteiro, em painelEm: o conteúdo encolhido mostraria a janela vazia em volta)
      const esc = PAINEL ? 1 : lerp(0.86, 1, ent) * lerp(1, 0.9, sai) * (1 - 0.035 * resp)
      mundo.style.transform += ` translate(${CX}px,${CY}px) scale(${esc}) translate(${-CX}px,${-CY}px)`
      if (s === 'deslizar' && !PAINEL) mundo.style.transform = `translateX(${W * (1 - E.inOutCubic(P(t, A - 0.35, A + 0.15)))}px) ` + mundo.style.transform
      // modo cinema: na troca de tela a tela gira de leve em perspectiva, e a cada passo um brilho atravessa
      if (troca) {
        const ang = troca.giro(tc)
        if (ang && !PAINEL) mundo.style.transform = `perspective(2400px) rotateY(${ang.toFixed(3)}deg) ` + mundo.style.transform
        troca.brilho(tc)
      }
      if (PAINEL) {
        p3.style.transform = entradaPainel(t, s) + painelEm(t, tc, troca ? troca.giro(tc) : 0, sai)
        p3.style.filter = filtroPainel
        // deslizando da direita, o painel passa pela coluna (ainda sem texto: a legenda entra em A): sem o recorte até assentar
        if (s === 'deslizar') corte.style.clipPath = t < A + 0.15 ? 'none' : recorte
      }
      // O placar e a volta para a pessoa mexem o aparelho inteiro (a camada do recorte): no placar ele recua, inclina e
      // sai de foco (o foco é o número); na volta, cai para fora do quadro girando.
      // (no placar o aparelho desce e fica grande atrás do número: o quadro não fica com o terço de baixo vazio. Na
      // volta ele sai num movimento que se vê do começo ao fim, e não num arranco no último instante: é um gesto.)
      if (rc > 0 || sd > 0) {
        const e = E.inOutCubic(sd)
        corte.style.transformOrigin = '50% 46%'
        corte.style.transform = `perspective(2200px) translate3d(${(-W * 0.22 * e).toFixed(2)}px, ${(150 * rc + H * 1.15 * e).toFixed(2)}px, 0) rotateX(${(8 * rc + 26 * e).toFixed(3)}deg) rotateZ(${(-12 * e).toFixed(3)}deg) scale(${(1 - 0.07 * rc).toFixed(4)})`
        corte.style.filter = `blur(${(7 * rc - 3 * e).toFixed(2)}px) brightness(${(1 - 0.2 * rc + 0.15 * e).toFixed(3)})`
      } else { corte.style.transform = ''; corte.style.filter = '' }
      // pouso: a tela gravada aparece por cima do aparelho 3D já assentado (ele fica inteiro embaixo até ela cobrir)
      const op = POUSO ? P(t, A - 0.03, A + 0.09) : s === 'mergulho' ? (PAINEL ? P(t, A - 0.16, A - 0.02) : P(t, A - 0.14, A + 0.06)) : s === 'deslizar' ? 1 : t >= A ? 1 : 0
      O(mundo, op * (SAI ? 1 - P(sd, 0.9, 1) : 1 - P(t, A + D + 0.2, A + D + 0.55)))
      if (pouso) { const vivo = t < A + 0.12; pouso.w3.style.display = vivo ? 'block' : 'none'; if (vivo) pouso.up(t) }
      if (berco) {
        const vivo = (POUSO ? P(t, A - 0.15, A + 0.3) : P(t, A, A + 0.3)) * (SAI ? 1 - P(sd, 0.15, 0.85) : 1 - P(t, A + D + 0.2, A + D + 0.55))
        // O véu e o desfoque de cima entram com o zoom (no aparelho inteiro o topo dele fica limpo). O desfoque do lado
        // da legenda vale desde que o aparelho assenta: no plano geral o pé do app (o campo de mensagem) caía, legível,
        // embaixo da interface da rede.
        const zoom = clamp((cam(t).z - 1) / zCheia) * vivo
        O(berco, zoom)
        const sempre = (POUSO ? P(t, A * 0.45, A - 0.1) : P(t, A, A + 0.3)) * (SAI ? 1 - P(sd, 0.15, 0.85) : 1 - P(t, A + D + 0.2, A + D + 0.55))
        for (const d of berco.desfoques) { const od = d.ponta === LAY.lado ? sempre : zoom; d.style.display = od > 0.01 ? 'block' : 'none'; O(d, od) }
      }
      mo.up(t)
      conteudo(t, tc, sai)
      if (cort) { const e = E.inOutCubic(P(t, A - 0.4, A + 0.4)); T(cort, `translateX(${lerp(-W, W, e)}px)`); O(cort, e > 0 && e < 1 ? 1 : 0) }
    }
  }, 'tela')

  // ---------- o antes (g.antes): a etiqueta do relance, fora da câmera ----------
  // No relance, a etiqueta diz ANTES; no corte seco ela vira AGORA (no acento da marca, se ele se lê ali) e some em ~1 s.
  // Sem pílula e sem ponto: só a palavra em caixa alta espaçada, na letra mono da série. Ela mora fora da tela gravada,
  // sobre o fundo da legenda (solta ou faixa), à esquerda da primeira linha, como a etiqueta dos cartões de antes. Sem
  // lugar ali (legenda lateral, cartão, sem legenda, ou a legenda ocupa a largura toda), vai para o canto de cima da parte
  // livre com um véu do fundo da série atrás dela. A cena nasce antes da do motion: o trilho das provas fica por cima.
  // Ao lado da legenda, a cena nasce depois da das legendas (o véu da legenda solta a cobriria); no canto, antes da do
  // motion (o trilho das provas fica por cima dela). A decisão sai da largura estimada da palavra (mono: ~0,9 em por letra).
  const ANT = TU.antes || []
  const TX = TU.textos.antes || { rotulo: 'Antes', agora: 'Agora', acento: null }
  const tamAntes = L({ '16x9': 40, '9x16': 46, padrao: 42 })
  const ANTES_AO_LADO = (LG.tipo === 'solta' || LG.tipo === 'faixa') && !LAY.lateral && LAY.legenda.x - S.x0 - 28 >= Math.max(TX.rotulo.length, TX.agora.length) * tamAntes * 0.92
  const cenaDoAntes = () => cena(A, A + D + 0.02, (root) => {
    root.style.pointerEvents = 'none'
    const tam = tamAntes
    const tx = el('div', { style: { position: 'absolute', left: '0', top: '0', font: `500 ${tam}px ${VIDEO.fonteMono ? FM : FX}`, letterSpacing: '0.28em', textTransform: 'uppercase', whiteSpace: 'nowrap', lineHeight: '1' } }, root)
    let lw = 0
    for (const s of [TX.rotulo, TX.agora]) { tx.textContent = s; lw = Math.max(lw, rectOf(tx).w) }
    const G = LAY.legenda, PADL = LG.tipo === 'solta' ? L({ '16x9': 10, padrao: 12 }) : L({ '16x9': 30, padrao: 36 })
    const aoLado = ANTES_AO_LADO
    const sob = aoLado ? (LG.tipo === 'faixa' ? LG.fundo : FU.cor) : FU.cor
    const contr = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05) }
    const tinta = [aoLado ? LG.tinta : TI.tinta, TI.tinta, LG.tinta, '#FFFFFF', '#111111'].find((c) => /^#[0-9a-f]{6}$/i.test(c || '') && contr(c, sob) >= 4.5) || legivel(sob)
    const acento = TX.acento && /^#[0-9a-f]{6}$/i.test(TX.acento) && contr(TX.acento, sob) >= 3 ? TX.acento : tinta
    let x0, y0, veu = null
    if (aoLado) {
      // à esquerda da primeira linha da legenda, na mesma altura
      x0 = S.x0 + 4; y0 = G.y + PADL + Math.round(L({ '16x9': 48, padrao: 46 }) * 0.58 - tam / 2)
    } else {
      const lv = LAY.livre
      // (a caixa da letra passa da linha: 16 px de folga da borda da área segura)
      x0 = Math.max(S.x0 + 8, lv.x + 24); y0 = Math.max(S.y0 + 16, lv.y + 18)
      // o véu é uma caixa só em volta da palavra (não o quadro todo)
      const rx = lw / 2 + 200, ry = tam * 2.2
      veu = el('div', { style: { position: 'absolute', left: px(x0 + lw / 2 - rx), top: px(y0 + tam / 2 - ry), width: px(2 * rx), height: px(2 * ry), background: `radial-gradient(closest-side, ${rgba(FU.cor, 0.8)} 0%, ${rgba(FU.cor, 0.6)} 45%, ${rgba(FU.cor, 0)} 100%)` } }, root)
      root.appendChild(tx)
    }
    place(tx, x0, y0)
    marcarSe(tx, 'texto')
    return (t) => {
      const tc = t - A
      let estado = null, a = 0
      for (const x of ANT) {
        if (tc >= x.t && tc < x.t + x.dur) { estado = 'antes'; a = 1 }
        else if (tc >= x.t + x.dur && tc < x.t + x.dur + 1.25) { estado = 'agora'; a = 1 - E.inCubic(P(tc, x.t + x.dur + 0.95, x.t + x.dur + 1.25)) }
      }
      tx.style.display = estado ? 'block' : 'none'
      if (veu) veu.style.display = estado ? 'block' : 'none'
      if (!estado) return
      tx.textContent = estado === 'antes' ? TX.rotulo : TX.agora
      tx.style.color = estado === 'antes' ? tinta : acento
      O(tx, a); if (veu) O(veu, a)
    }
  }, 'antes')
  if (ANT.length && !ANTES_AO_LADO) cenaDoAntes()

  // ---------- motion do vídeo de venda: a lupa, o marcador de cada prova e o placar (fora da câmera) ----------
  // Tudo sai dos eventos: g.aponta(…, { lupa }), g.prova(rótulo) e g.placar(itens). O bloco é a cor do fechamento, a
  // letra é a tinta dele e o ponto de acento é a cor do realce (a marca em bloco, o acento só como ponto).
  const lupas = ev.filter((e) => e.tipo === 'aponta' && e.lupa && e.ret)
  if (lupas.length || provas.length || placar) cena(A, A + D + 0.02, (root) => {
    root.style.pointerEvents = 'none'
    const BL = FC.fundo, TN = FC.tinta, PT = V.realce.cor || V.indicador.tinta
    const G = LAY.legenda
    // o que sobra da área segura para o motion: tudo menos a faixa reservada da legenda da montagem
    const topo = SEM_LEG && LAY.lado === 'cima' ? G.y + G.h + 16 : S.y0, base = SEM_LEG && LAY.lado === 'baixo' ? G.y - 16 : S.y1

    // ----- lupa: o alvo sai da tela, ampliado, numa lente com a borda no acento -----
    const veuLupa = el('div', { cls: 'layer', style: { background: BL } }, root)
    const fazLupa = (e) => {
      const m = e.margem || [6, 8, 6, 8]
      const rg = { x: e.ret.x - m[3], y: e.ret.y - m[0], w: e.ret.w + m[1] + m[3], h: e.ret.h + m[0] + m[2] }
      // a escala da câmera com a lupa aberta: a lente amplia o alvo `lupa` vezes sobre o que já está no quadro
      const s0 = noQuadro(0, 0, A + e.t + 0.4)[2]
      let es = k * s0 * e.lupa
      es *= Math.min(1, (S.x1 - S.x0 - 60) / 1.02 / (rg.w * es)) // 1,02 (e 0,51 no centro): a lente aberta flutua
      const lw = rg.w * es, lh = rg.h * es, borda = 7
      const anel = el('div', { style: { position: 'absolute', left: '0', top: '0', borderRadius: '999px', border: `5px solid ${PT}`, boxSizing: 'border-box' } }, root)
      const box = el('div', { style: { position: 'absolute', left: '0', top: '0', width: px(lw), height: px(lh), borderRadius: px(Math.min(lh / 2, 60)), overflow: 'hidden', background: '#FFFFFF', boxShadow: `0 0 0 ${borda}px ${PT}, 0 34px 80px rgba(0,0,0,.42)`, transformOrigin: '50% 50%' } }, root)
      const sq = sequencia(box, TU.quadros, { width: px(vp.width * es), height: px(vp.height * es), left: px(-rg.x * es), top: px(-rg.y * es) })
      marcarSe(box, 'logo', 'magnifier')
      return (t, tc) => {
        const a = P(tc, e.t, e.t + 0.1) * (1 - P(tc, e.t + e.dur - 0.08, e.t + e.dur + 0.16))
        const vis = a > 0
        box.style.display = anel.style.display = vis ? 'block' : 'none'
        if (!vis) return 0
        sq.set(Math.max(0, tc))
        const [ax, ay, sc] = noQuadro(...aTela(e.ret.x + e.ret.w / 2, e.ret.y + e.ret.h / 2), t)
        const aw = e.ret.w * k * sc, ah = e.ret.h * k * sc
        // a lente mora acima do alvo (cobre o que já foi lido); se não couber, abaixo
        let cy = ay - ah / 2 - 44 - lh / 2
        if (cy - lh / 2 - borda < topo + 8) cy = ay + ah / 2 + 44 + lh / 2
        const cx = clamp(ax + lw * 0.16, S.x0 + lw * 0.51 + borda + 6, S.x1 - lw * 0.51 - borda - 6)
        const g = E.outBack(P(tc, e.t, e.t + 0.4)), fim = E.inCubic(P(tc, e.t + e.dur - 0.08, e.t + e.dur + 0.16))
        // aberta, a lente flutua de leve (escala e altura): parada, ela vira um quadro parado sobre a tela inteira
        const fl = tc - e.t
        const esc = lerp(1 / e.lupa, 1, g) * (1 - 0.12 * fim) * (1 + 0.018 * Math.sin(fl * 2.6))
        place(box, lerp(ax, cx, g) - lw / 2, lerp(ay, cy, g) - lh / 2 + 7 * Math.sin(fl * 1.9))
        T(box, `scale(${esc.toFixed(4)})`); O(box, a)
        // um anel sai do alvo, no acento
        const pa = P(tc, e.t + 0.05, e.t + 0.7), ar = Math.max(aw, ah) * (0.7 + 1.5 * E.outCubic(pa))
        place(anel, ax - ar, ay - ar, 2 * ar, 2 * ar); O(anel, 0.9 * (1 - pa) * a)
        return a
      }
    }
    const ups = lupas.map(fazLupa)

    // ----- marcadores: um por prova. Entra grande, com a conta ("1 de 3"), e encolhe para o trilho no topo -----
    // (0,45: a letra do marcador pequeno fica com ~32 px, acima do mínimo de leitura de 28)
    const NPV = provas.length, AH = 150, ESC = 0.45
    const trilhoY = topo + 12, grandeY = trilhoY + AH * ESC + 26
    const cards = provas.map((e, i) => {
      const c = el('div', { style: { position: 'absolute', left: '0', top: '0', height: px(AH), display: 'flex', alignItems: 'center', gap: '24px', padding: '0 52px 0 24px', boxSizing: 'border-box', borderRadius: px(AH / 2), background: BL, boxShadow: `0 0 0 3px ${rgba(TN, 0.14)}, 0 26px 60px rgba(0,0,0,.34)`, whiteSpace: 'nowrap', transformOrigin: '0 0' } }, root)
      const dm = AH - 48
      const dot = el('div', { style: { width: px(dm), height: px(dm), borderRadius: '50%', background: PT, flex: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center' } }, c)
      const chk = sv('svg', { viewBox: '0 0 24 24', width: dm * 0.64, height: dm * 0.64 }, dot)
      const tr = traco(sv('path', { d: 'M5 12.6 L10 17.4 L19 7.4', fill: 'none', stroke: legivel(PT), 'stroke-width': 3.4, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, chk))
      const rot = el('span', { text: e.rotulo, style: { font: `700 72px ${FT}`, color: TN, letterSpacing: '-0.01em' } }, c)
      const cont = el('span', { text: `${i + 1} of ${NPV}`, style: { font: `600 38px ${FX}`, color: rgba(TN, 0.62), display: 'inline-block', overflow: 'hidden' } }, c)
      marcarSe(rot, 'texto')
      const wg = rectOf(c).w, wc = rectOf(cont).w
      return { e, c, cont, tr, wg, wc, wp: (wg - wc - 24) * ESC }
    })
    // o trilho: os marcadores pequenos, lado a lado, no meio da largura segura
    const vao = 14, total = cards.reduce((a, c) => a + c.wp, 0) + vao * Math.max(0, NPV - 1)
    let xs = (S.x0 + S.x1) / 2 - total / 2
    for (const c of cards) { c.xs = xs; xs += c.wp + vao }

    // ----- placar: os marcadores se juntam e viram o número que conta -----
    let plc = null
    if (placar) {
      const veu = el('div', { cls: 'layer', style: { background: BL } }, root)
      const caixa = el('div', { style: { position: 'absolute', left: px(S.x0), top: '0', width: px(S.x1 - S.x0), display: 'flex', flexDirection: 'column', alignItems: 'center', transformOrigin: '50% 50%' } }, root)
      const linhas = placar.itens.map((it, i) => {
        if (i) el('div', { style: { width: '20px', height: '20px', borderRadius: '50%', background: PT, margin: '4px 0 18px' } }, caixa)
        const l = el('div', { style: { display: 'flex', alignItems: 'baseline', justifyContent: 'center', gap: '26px', whiteSpace: 'nowrap', lineHeight: '1' } }, caixa)
        const n = el('span', { text: String(it.valor), style: { font: `800 290px/0.92 ${FT}`, color: PT, letterSpacing: '-0.04em', display: 'inline-block', textAlign: 'right', transformOrigin: '50% 60%' } }, l)
        const r = el('span', { text: it.rotulo, style: { font: `700 100px/1 ${FT}`, color: TN, letterSpacing: '-0.02em', display: 'inline-block' } }, l)
        n.style.minWidth = px(rectOf(n).w)
        marcarSe(n, 'texto'); marcarSe(r, 'texto')
        return { it, l, n, r, t0: placar.t + 0.2 + i * 0.5 }
      })
      // cabe na largura segura e fica no meio do que sobra da área segura
      const rc0 = rectOf(caixa), larg = Math.max(...linhas.map((l) => rectOf(l.l).w))
      const f = Math.min(1, (S.x1 - S.x0 - 20) / larg)
      const cy = topo + (base - topo) * 0.48
      place(caixa, S.x0, cy - rc0.h / 2)
      plc = { veu, caixa, linhas, f, alvo: [(S.x0 + S.x1) / 2, cy - rc0.h * 0.22 * f] }
    }
    // cada número sobe de 0 até o valor, um tique por unidade (acima de 6, conta corrido)
    const PASSO = 0.16
    const numero = (l, tq) => {
      const v = l.it.valor, d = tq - (l.t0 + 0.12)
      const atual = v <= 6 ? clamp(Math.floor(d / PASSO) + 1, 0, v) : Math.round(v * E.outCubic(clamp(d / 0.7)))
      l.n.textContent = String(atual)
      // um pulso a cada tique; no zero, um carimbo só
      const ult = v <= 6 ? l.t0 + 0.12 + Math.max(0, atual - 1) * PASSO : l.t0 + 0.82
      T(l.n, `scale(${(v === 0 ? 1 + 0.5 * (1 - E.outBack(P(tq, l.t0, l.t0 + 0.4))) : pulse(tq - ult, 0.16, 3, 9)).toFixed(4)})`)
    }

    return (t) => {
      const tc = t - A, sd = saida(tc)
      let foco = 0
      for (const u of ups) foco = Math.max(foco, u(t, tc))
      O(veuLupa, 0.3 * foco)
      // marcadores
      const tp = placar ? placar.t : Infinity
      cards.forEach((c, i) => {
        const t0 = c.e.t + 0.06, prox = Math.min(i + 1 < NPV ? cards[i + 1].e.t : Infinity, tp)
        const t1 = Math.min(t0 + 1.3, prox - 0.05)
        const g = E.outBack(P(tc, t0, t0 + 0.42)), q = E.inOutCubic(P(tc, t1, t1 + 0.4)), m = E.inCubic(P(tc, tp, tp + 0.35))
        const a = P(tc, t0, t0 + 0.1) * (1 - m) * (1 - P(sd, 0.45, 0.85))
        c.c.style.display = a > 0 ? 'flex' : 'none'
        if (a <= 0) return
        // o "1 de 3" some quando o marcador encolhe para o trilho
        // (apaga antes de encolher: no meio da troca o "1 de 3" aparecia cortado)
        const qc = E.inOutCubic(P(q, 0.3, 1))
        c.cont.style.maxWidth = px(c.wc * (1 - qc)); c.cont.style.marginLeft = px(-24 * qc); O(c.cont, 1 - P(q, 0, 0.3))
        const w = c.wg - (c.wc + 24) * qc, se = lerp(0.62, 1, g), esc = lerp(1, ESC, q) * se * (1 - 0.6 * m)
        let x = lerp((S.x0 + S.x1) / 2 - w / 2, c.xs, q) + (w * (1 - se)) / 2, y = lerp(grandeY, trilhoY, q) + (AH * (1 - se)) / 2
        if (plc && m > 0) { x = lerp(x, plc.alvo[0] - (w * esc) / 2, m); y = lerp(y, plc.alvo[1] - (AH * esc) / 2, m) }
        T(c.c, `translate(${x.toFixed(2)}px,${(y - 46 * (1 - E.outCubic(P(tc, t0, t0 + 0.35)))).toFixed(2)}px) perspective(900px) rotateX(${(-64 * (1 - E.outCubic(P(tc, t0, t0 + 0.36)))).toFixed(2)}deg) scale(${esc.toFixed(4)})`)
        O(c.c, a)
        c.tr(E.outCubic(P(tc, t0 + 0.16, t0 + 0.5)))
      })
      // placar
      if (plc) {
        const tq = quadroDe(t) - A, fim = P(sd, 0.45, 0.85)
        O(plc.veu, 0.62 * E.outCubic(P(tc, tp, tp + 0.55)) * (1 - P(sd, 0.05, 0.6)))
        plc.caixa.style.display = tc >= tp ? 'flex' : 'none'
        T(plc.caixa, `translateY(${(-90 * E.inCubic(fim)).toFixed(2)}px) scale(${(plc.f * (1 + 0.012 * Math.sin((tc - tp) * 1.3))).toFixed(4)})`)
        O(plc.caixa, 1 - fim)
        for (const l of plc.linhas) {
          const e = E.outExpo(P(tc, l.t0, l.t0 + 0.5))
          O(l.l, P(tc, l.t0, l.t0 + 0.14)); T(l.l, `translateY(${((1 - e) * 60).toFixed(2)}px)`)
          numero(l, tq)
        }
        const bolas = plc.caixa.children
        for (let i = 0; i < bolas.length; i++) if (!bolas[i].firstChild) O(bolas[i], P(tc, tp + 0.55, tp + 0.75))
      }
    }
  }, 'motion')

  // ---------- legendas (fora da câmera) ----------
  // (legenda "nenhuma": o motor não desenha legenda; ela vem da montagem)
  const tLeg0 = AB.saida === 'cortina' ? A + 0.3 : A
  if (!SEM_LEG) cena(A - 0.1, A + D + 0.35, (root) => {
    root.style.pointerEvents = 'none'
    const G = LAY.legenda
    // Legenda solta não tem fundo: com zoom, a tela passaria por baixo do texto. O lado da legenda ganha o
    // mesmo fundo da série (a mesma função do tempo, então a emenda não aparece) e a tela some na borda da
    // parte livre, como papel sobre papel.
    let fuVeu = () => {}
    if (LG.tipo === 'solta' && !CLIP_LIVRE) {
      const lv = LAY.livre, veu = el('div', { cls: 'layer' }, root)
      veu.style.clipPath = { esquerda: `inset(0 ${W - lv.x}px 0 0)`, direita: `inset(0 0 0 ${lv.x + lv.w}px)`, cima: `inset(0 0 ${H - lv.y}px 0)`, baixo: `inset(${lv.y + lv.h}px 0 0 0)` }[LAY.lado]
      fuVeu = fundo(veu, 'veu')
    }
    const lay = el('div', { cls: 'layer' }, root)
    if (LG.tipo === 'faixa') el('div', { style: { ...ret(LAY.banda), background: LG.fundo } }, lay)
    const PAD = LG.tipo === 'solta' ? L({ '16x9': 10, padrao: 12 }) : L({ '16x9': 30, padrao: 36 })
    const card = el('div', { style: { ...ret(G), boxSizing: 'border-box', transformOrigin: LAY.lateral ? '50% 0%' : '50% 50%', overflow: LG.troca === 'subir' ? 'hidden' : 'visible' } }, lay)
    card.dataset.fv = 'legenda'
    if (LG.tipo === 'cartao') Object.assign(card.style, { background: LG.fundo, borderRadius: px(LG.raio), border: LG.borda === 'nenhuma' ? 'none' : `2px solid ${LG.borda}`, boxShadow: sombraDe(LG.sombra) })
    // (coluna larga, de 560 px ou mais, como a de 30% no 16:9 e no 19:9: a frase cresce com ela)
    const tam = LAY.lateral ? (G.w >= 560 ? 48 : L({ '16x9': 42, padrao: 40 })) : LAY.linha ? 52 : L({ '16x9': 48, '9x16': 50, padrao: 46 })
    // a pílula é texto pequeno sobre cor: 36 px (o OCR do refino mede a caixa da letra, ~0,8 do corpo sem descendente: ≥ 28)
    const tamRot = LG.rotulo === 'pilula' ? 36 : L({ '16x9': 22, padrao: 28 })
    // Seções (g.secao): o nome da seção mora no alto da coluna, com um traço na cor do realce (só forma), e só troca quando a
    // seção muda; os passos ficam embaixo dele. Sem seção, nada muda no lugar dos passos.
    const tamSec = 36
    // arranjo "linha" (LAY.linha): a seção e o rótulo num bloco à esquerda, a frase ao lado, na altura do meio da faixa
    const LIN = !!LAY.linha
    let TOP0 = PAD, secs = []
    if (secoes.length) {
      secs = secoes.map((x) => {
        const b = el('div', { style: { position: 'absolute', left: px(PAD), ...(LIN ? {} : { right: px(PAD) }), top: px(PAD), display: 'flex', alignItems: 'center', gap: '16px', whiteSpace: 'nowrap' } }, card)
        el('span', { style: { display: 'block', flex: 'none', width: px(Math.round(tamSec * 1.2)), height: px(Math.max(5, Math.round(tamSec * 0.2))), borderRadius: '99px', background: V.realce.cor } }, b)
        const tx = el('span', { text: x.nome, style: { font: `600 ${tamSec}px/1.1 ${FX}`, color: LG.tinta, letterSpacing: '-0.005em', overflow: 'hidden', textOverflow: 'clip' } }, b)
        marcarSe(tx, 'texto')
        return { x, b, tx }
      })
      TOP0 = PAD + Math.round(tamSec * 1.1) + 26
    }
    // os passos moram numa pista abaixo do rótulo da seção: na troca "subir" o passo que sai é cortado ali, sem passar por
    // cima do nome da seção
    const pista = secoes.length && !LIN ? el('div', { style: { position: 'absolute', left: '0', right: '0', top: px(TOP0 - 6), bottom: '0', overflow: LG.troca === 'subir' ? 'hidden' : 'visible' } }, card) : card
    const BOX0 = LIN ? 0 : secoes.length ? 6 : PAD
    const pilula = LG.rotulo === 'pilula' ? PILULA : null
    const itens = passos.map((pa) => {
      const box = el('div', { style: { position: 'absolute', left: px(PAD), right: px(PAD), top: px(BOX0), ...(LIN ? { height: px(G.h) } : {}) } }, pista)
      let rot = null
      if (LG.rotulo === 'ponto') {
        rot = el('div', { style: { display: 'flex', alignItems: 'center', gap: '12px', font: `700 ${tamRot}px ${FX}`, color: LG.sinal, marginBottom: '12px' } }, box)
        rot.innerHTML = `<span style="width:${tamRot / 2}px;height:${tamRot / 2}px;border-radius:50%;background:${LG.sinal}"></span>`
        rot.appendChild(document.createTextNode(passoTxt(pa.n)))
      } else if (LG.rotulo === 'mono') {
        rot = el('div', { style: { font: `500 ${Math.round(tamRot * 0.95)}px ${FM}`, letterSpacing: '0.1em', color: LG.sinal, marginBottom: '12px', whiteSpace: 'nowrap' } }, box)
        rot.textContent = alto(passoTxt(pa.n, true))
      } else if (pilula) {
        // a pílula da série: o rótulo do passo chapado, raio cheio (as cores do selo, quando ele é uma pílula com fundo)
        const lin = el('div', { style: LIN ? { position: 'absolute', left: '0', top: '0' } : { marginBottom: '16px' } }, box)
        rot = el('span', { text: passoTxt(pa.n), style: { display: 'inline-block', font: `700 ${tamRot}px/1.15 ${FX}`, color: pilula.tinta, background: pilula.fundo, padding: `${Math.round(tamRot * 0.3)}px ${Math.round(tamRot * 0.72)}px`, borderRadius: '999px', whiteSpace: 'nowrap' } }, lin)
      } else if (LG.rotulo === 'numero') {
        // o número do passo em corpo de título: a ordem vira a imagem
        rot = el('div', { style: { font: `800 ${Math.round(tam * 1.5)}px/1 ${FT}`, color: LG.sinal, marginBottom: '8px', letterSpacing: '-0.02em' } }, box)
        rot.innerHTML = `${String(pa.n).padStart(2, '0')}<span style="font-size:.42em;opacity:.55;letter-spacing:0">&thinsp;/${String(NP).padStart(2, '0')}</span>`
      }
      if (rot) marcarSe(rot, 'texto')
      const tx = el('div', { style: { font: `${LG.peso} ${tam}px/1.16 ${LG.fonte === 'texto' ? FX : FT}`, color: LG.tinta, letterSpacing: LG.caixa === 'alta' ? '0.02em' : '-0.01em',
        ...(LIN ? { position: 'absolute', left: '0', right: '0', top: '50%', transform: 'translateY(-50%)' } : {}) } }, box)
      const fala = falaNaLegenda(TU, tx, pa.n, LG.caixa === 'alta' ? alto : undefined)
      if (!fala) tx.textContent = LG.caixa === 'alta' ? alto(pa.legenda) : pa.legenda
      marcarSe(tx, 'legenda')
      return { box, tx, pa, fala, rot }
    })
    // linha: o bloco da esquerda (seção em cima, rótulo embaixo) tem a largura do maior dos dois; a frase começa depois dele.
    // O bloco fica no meio da altura da faixa.
    if (LIN) {
      // linha: a seção, o rótulo e a frase lado a lado, cada um na sua coluna fixa (nada pula quando a seção troca), todos na
      // altura do meio da faixa
      const caixaDoRotulo = (it) => (it.rot ? (pilula ? it.rot.parentElement : it.rot) : null)
      const rots = itens.map(caixaDoRotulo).filter(Boolean)
      const wSec = secs.length ? Math.max(...secs.map((q) => rectOf(q.b).w)) + 36 : 0
      const wRot = rots.length ? Math.max(...rots.map((r) => rectOf(r).w)) + 32 : 0
      for (const q of secs) q.b.style.top = px((G.h - rectOf(q.b).h) / 2)
      for (const r of rots) Object.assign(r.style, { position: 'absolute', left: px(wSec), top: px((G.h - rectOf(r).h) / 2), marginBottom: '0' })
      for (const it of itens) it.tx.style.left = px(wSec + wRot)
    }
    // Legenda longa não vaza: a fonte encolhe (até 60%) até o passo mais longo caber. Mede uma vez, com as fontes
    // carregadas; todo passo usa o mesmo lugar, então nada pula na troca.
    let medido = false
    // Mede o que a letra ocupa de verdade: a caixa de texto de fontes de ascendente alto passa da linha CSS
    // (o número grande da Baloo sobe 20 px acima do bloco). O bloco desce o que a letra sobe.
    const caber = () => {
      const topo = G.y + TOP0, chao = G.y + G.h - PAD, st = stage.getBoundingClientRect()
      const ext = (box) => { const rg = document.createRange(); rg.selectNodeContents(box); const r = rg.getBoundingClientRect(); return { y0: r.top - st.top, y1: r.bottom - st.top } }
      for (const it of itens) {
        const d = it.box.style.display
        it.box.style.display = 'block'
        const base = parseFloat(getComputedStyle(it.tx).fontSize)
        const mede = () => { it.box.style.top = px(BOX0); const e = ext(it.box), desce = Math.max(0, topo - e.y0); it.box.style.top = px(BOX0 + desce); return e.y1 + desce }
        // (linha: a frase fica no meio da faixa, ao lado do bloco; ela encolhe até caber na altura dela)
        const medeLinha = () => { const e = ext(it.tx); return e.y1 - e.y0 }
        if (LIN) for (let f = base; medeLinha() > G.h - 8 && f > base * 0.6; f -= 2) it.tx.style.fontSize = px(f - 2)
        else for (let f = base; mede() > chao && f > base * 0.6; f -= 2) it.tx.style.fontSize = px(f - 2)
        it.box.style.display = d
      }
      medido = true
    }
    return (t) => {
      if (!medido && (!document.fonts || document.fonts.status === 'loaded')) caber()
      for (const it of itens) if (it.fala) it.fala(t)
      fuVeu(t)
      const tc = t - A
      O(lay, E.outCubic(P(t, tLeg0, tLeg0 + 0.35)) * (1 - P(t, A + D, A + D + 0.3)))
      // a seção: a velha sobe e some, a nova sobe e entra (0,35 s), no instante da seção
      if (secs.length) {
        let at = -1
        secs.forEach((q, i) => { if (tc >= q.x.t - 0.12) at = i })
        secs.forEach((q, i) => {
          // a velha sai em 0,22 s e só então a nova entra: as duas nunca se cruzam
          const t0 = q.x.t - 0.12, prox = secs[i + 1] ? secs[i + 1].x.t - 0.12 : Infinity
          const entra = i === 0 && q.x.t <= SECAO_SEM_GIRO ? 1 : E.outCubic(P(tc, t0 + 0.2, t0 + 0.55)), sai = Number.isFinite(prox) ? E.inCubic(P(tc, prox, prox + 0.22)) : 0
          const vis = i === at || (i === at - 1 && tc < prox + 0.22)
          q.b.style.display = vis ? 'flex' : 'none'
          if (!vis) return
          O(q.b, entra * (1 - sai)); T(q.b, `translateY(${((1 - entra) * 34 - sai * 34).toFixed(1)}px)`)
        })
      }
      if (LG.troca === 'corte') {
        let ativo = 0
        itens.forEach((it, i) => { if (tc >= it.pa.t) ativo = i })
        itens.forEach((it, i) => { it.box.style.display = i === ativo ? 'block' : 'none' })
        return
      }
      let ativo = 0
      itens.forEach((it, i) => { if (tc >= it.pa.t - 0.25) ativo = i })
      const tv = itens[ativo] ? itens[ativo].pa.t : 0
      const f = ativo > 0 ? P(tc, tv - 0.25, tv + 0.25) : 1
      const qual = f < 0.5 && ativo > 0 ? ativo - 1 : ativo
      itens.forEach((it, i) => { it.box.style.display = i === qual ? 'block' : 'none' })
      if (LG.troca === 'virar') {
        // o cartão (ou o bloco de texto, na faixa e na solta) vira no eixo X e o texto novo nasce no verso
        const ang = f < 1 ? (f < 0.5 ? -90 * E.inCubic(f * 2) : 90 * (1 - E.outCubic((f - 0.5) * 2))) : 0
        card.style.transform = `perspective(1400px) rotateX(${ang}deg)`
      } else {
        // subir: o texto velho sai por cima, o novo entra por baixo
        const s = f < 1 ? (f < 0.5 ? E.inCubic(f * 2) : 1 - E.outCubic((f - 0.5) * 2)) : 0
        const it = itens[qual]
        T(it.box, `translateY(${(f < 0.5 ? -1 : 1) * s * 70}px)`); O(it.box, 1 - s)
      }
    }
  }, 'legendas')
  if (ANT.length && ANTES_AO_LADO) cenaDoAntes()

  // ---------- seção nova (g.secao) no modo cinema: o cartão de capítulo ----------
  // O cartão de capítulo do template (S25): a cor da seção (visual.secao.cor; padrão, a do painel da abertura ou a do fecho)
  // cobre o quadro com o nome da seção em letra de título, enquanto o painel sai de cena por trás. É o momento forte entre
  // dois blocos de passos. A seção que abre colada na abertura não ganha cartão (a abertura já é um).
  //   entrada  diagonal (lâmina pela esquerda, sai pela direita; o painel vira) · empurrar (sobe de baixo empurrando o painel,
  //            sai por cima) · whip (chicote de lado, borrado) · mascara (círculo que nasce no meio do painel e se fecha nele)
  //   letreiro titulo (o nome) · numero (o número da seção, gigante, em cima do nome) · digitado (o nome letra a letra)
  // Os tempos (TS, a partir do instante da seção) vêm do compor (visual.mjs, temposDaSecao); o painel usa os mesmos.
  const cartoes = CINE ? secoes.filter((x) => x.t > SECAO_SEM_GIRO) : []
  if (cartoes.length) cena(A, A + D, (root) => {
    root.style.pointerEvents = 'none'
    const SC = V.secao || {}, ENT = SC.entrada || 'diagonal', LET = SC.letreiro || 'titulo'
    const TS = SC.tempos || { de0: -0.5, de1: -0.12, ate0: 0.45, ate1: 0.9, volta: 1.0 }
    const cor = SC.cor || AB.painel || FC.fundo
    // o nome numa tinta que a marca aprova sobre essa cor (visual.secao.tinta, ou MARCA.pares); senão, a que se lê
    const par = (MARCA.pares || []).find((q) => String(q[0]).toUpperCase() === cor.toUpperCase())
    const tinta = SC.tinta || (par ? par[1] : legivel(cor))
    // o círculo da máscara nasce no meio do painel
    const fo = foraDoPainel(), mx = fo.x + fo.w / 2, my = fo.y + fo.h / 2, rCobre = raioCobre(mx, my)
    const tam0 = L({ '16x9': 150, '9x16': 120, padrao: 120 }), ent0 = L({ '16x9': 160, '9x16': 132, padrao: 130 })
    const itens = cartoes.map((x) => {
      const c = el('div', { cls: 'layer', style: { background: cor } }, root)
      const it = { x, c, ls: [], num: null, letras: null, cursor: null }
      if (LET === 'numero') {
        // o número da seção, gigante, e o nome embaixo dele (os dois na tinta do cartão, alinhados como o título)
        const n = String(secoes.indexOf(x) + 1).padStart(2, '0')
        const tn = L({ '16x9': 330, '9x16': 260, padrao: 260 }), gap = L({ '16x9': 24, padrao: 20 })
        const meioNum = CY - (ent0 + gap) / 2, meioNome = meioNum + tn * 0.5 + gap + ent0 / 2
        it.num = titulo(c, [n], { tam0: tn, ent0: tn * 1.0, tinta, meio: meioNum })
        it.ls = titulo(c, [x.nome], { tam0, ent0, tinta, meio: meioNome })
      } else {
        it.ls = titulo(c, [x.nome], { tam0, ent0, tinta, meio: CY })
        if (LET === 'digitado') {
          // as letras aparecem uma a uma, e o cursor (um traço na tinta) anda atrás da última e pisca depois
          it.letras = letras(it.ls)
          const l0 = rectOf(it.ls[0].line), hC = Math.round(tam0 * 0.82)
          it.fins = it.letras.map((ch) => { const r = rectOf(ch); return r.x + r.w })
          it.x0 = l0.x
          it.cursor = el('div', { style: { position: 'absolute', left: '0', top: px(l0.y + (l0.h - hC) / 2), width: px(Math.max(6, Math.round(tam0 * 0.06))), height: px(hC), background: tinta } }, c)
          it.dig = (SC.digitacao && SC.digitacao[x.nome]) || { t0: TS.de1 - 0.12, t1: TS.de1 + 0.3 }
        }
      }
      registrarTransicao('secao/cartao', A + x.t + TS.de0, TS.ate1 - TS.de0)
      return it
    })
    return (t) => {
      for (const it of itens) {
        const u = t - (A + it.x.t)
        const vis = u > TS.de0 && u < TS.ate1
        it.c.style.display = vis ? 'block' : 'none'
        if (!vis) continue
        const pIn = P(u, TS.de0, TS.de1), pOut = P(u, TS.ate0, TS.ate1)
        if (ENT === 'empurrar') {
          // sobe de baixo (empurrando o painel) e sai por cima (o painel volta de baixo)
          T(it.c, `translateY(${(pOut > 0 ? -H * E.inOutCubic(pOut) : H * (1 - E.inOutCubic(pIn))).toFixed(1)}px)`)
        } else if (ENT === 'whip') {
          // chicote: entra pela direita e sai pela esquerda, borrado no meio do movimento
          const ida = pOut <= 0, p = ida ? pIn : pOut, e = E.inOutQuint(p)
          T(it.c, `translateX(${(ida ? W * (1 - e) : -W * e).toFixed(1)}px)`)
          const bl = 40 * Math.sin(Math.PI * p)
          it.c.style.filter = bl > 0.5 ? `blur(${bl.toFixed(1)}px)` : 'none'
        } else if (ENT === 'mascara') {
          // um círculo nasce no meio do painel e cobre o quadro; na saída ele se fecha de volta no mesmo ponto
          const r = pOut > 0 ? rCobre * (1 - E.inOutCubic(pOut)) : rCobre * E.inOutCubic(pIn)
          it.c.style.clipPath = r >= rCobre ? 'none' : `circle(${Math.max(0, r).toFixed(1)}px at ${mx.toFixed(1)}px ${my.toFixed(1)}px)`
        } else {
          const ein = E.inOutCubic(pIn), eout = E.inOutCubic(pOut)
          const xi = lerp(-25, 125, ein), xo = lerp(-25, 125, eout)
          it.c.style.clipPath = eout > 0 ? `polygon(${xo.toFixed(2)}% 0, 125% 0, 125% 100%, ${(xo - 25).toFixed(2)}% 100%)` : `polygon(-25% 0, ${xi.toFixed(2)}% 0, ${(xi - 25).toFixed(2)}% 100%, -25% 100%)`
        }
        const tIn = A + it.x.t + TS.de1 - 0.1, tSai = A + it.x.t + TS.ate0 - 0.19
        if (it.letras) {
          // datilografado: as letras na janela do compor; o cursor segue a última e pisca até o nome sair
          const n = digita(it.letras, quadroDe(t), A + it.x.t + it.dig.t0, A + it.x.t + it.dig.t1)
          it.cursor.style.left = px((n > 0 ? it.fins[n - 1] : it.x0) + 8)
          const pisca = t > A + it.x.t + it.dig.t1 ? (Math.floor((t - (A + it.x.t + it.dig.t1)) / 0.22) % 2 ? 0.15 : 1) : 1
          O(it.cursor, pisca * (1 - P(t, tSai, tSai + 0.12)))
          for (const ch of it.letras) if (t > tSai) ch.style.opacity = String(Math.min(+ch.style.opacity, 1 - P(t, tSai, tSai + 0.18)))
        } else {
          if (it.num) { riseWords(palavras(it.num), t, tIn - 0.06, 0.07); exitWords(palavras(it.num), t, tSai, 0.03, 0.2) }
          entrar(it.ls, t, tIn, 0.3)
          // o nome sai antes de o cartão sair: a borda que passa não corta a palavra ao lado da legenda que volta
          exitWords(palavras(it.ls), t, tSai, 0.03, 0.2)
        }
      }
    }
  }, 'secao')

  // ---------- fechamento ----------
  // A entrada do cartão final (iris, cortina, corte, deslizar), a mesma com frase ou só com o logo.
  function entradaDoFecho(root, cm, t0) {
    const bw = L({ '16x9': 18, padrao: 14 })
    const borda = FC.entrada === 'cortina' ? el('div', { style: { position: 'absolute', top: '0', width: px(bw), height: px(H), background: FC.tinta } }, root) : null
    if (FC.entrada !== 'corte') registrarTransicao(`fechamento/${FC.entrada}`, t0, FC.entrada === 'deslizar' ? 0.55 : 0.45)
    return (t) => {
      const e = E.inOutCubic(P(t, t0, t0 + 0.45))
      if (FC.entrada === 'iris') iris(cm, raioCobre(CX, CY) * e, CX, CY)
      // dissolver: o cartão final chega por opacidade enquanto a tela recua (feito para o cartão na cor do fundo da série:
      // a tela vai embora e o fundo fica, sem forma nenhuma passando por cima dela)
      else if (FC.entrada === 'dissolver') O(cm, E.inOutSine(P(t, t0, t0 + 0.45)))
      else if (FC.entrada === 'cortina') {
        cm.style.clipPath = e >= 1 ? 'none' : `inset(0 ${((1 - e) * 100).toFixed(2)}% 0 0)`
        borda.style.left = px(e * W - bw / 2); O(borda, e > 0 && e < 1 ? 1 : 0)
      } else if (FC.entrada === 'deslizar') T(cm, `translateX(${W * (1 - E.outExpo(P(t, t0, t0 + 0.55)))}px)`)
    }
  }
  // Ordem "so-logo": a assinatura é o logo, sozinho. Centrado, com respiro, sobe e assenta em 0,6 s e fica parado até o
  // fim. Sem frase (nem fimLinhas), sem brilho, sem 3D, sem peça por peça. O logo é o MARCA.logo (SVG) ou o PNG da marca
  // que se lê sobre o fundo do fecho (MARCA.png, escolhido pelo compor).
  function fechoSoLogo(root, cm, t0) {
    const maxW = Math.min(L({ '16x9': 680, '9x16': 620, padrao: 600 }), (S.x1 - S.x0) * 0.62)
    let lg, LW, LH
    if (MARCA.logo) {
      const vb = MARCA.logo.viewBox.split(/\s+/).map(Number)
      LW = maxW; LH = (LW * vb[3]) / vb[2]
      lg = sv('svg', { viewBox: MARCA.logo.viewBox, width: LW, height: LH }, cm)
      const g = sv('g', { transform: MARCA.logo.transform || '' }, lg)
      for (const pt of MARCA.logo.partes) sv('path', { d: pt.d, fill: FC.logo === 'negativo' ? FC.tinta : pt.fill, ...(pt.transform ? { transform: pt.transform } : {}) }, g)
      Object.assign(lg.style, { position: 'absolute', left: px(CX - LW / 2), top: px(CY - LH / 2) })
    } else if (TU.png && TU.png.fecho) {
      // o PNG nunca passa do tamanho dele (ampliado, amolece)
      const pg = TU.png.fecho
      LW = Math.min(maxW, pg.w); LH = (LW * pg.h) / pg.w
      lg = imagem(cm, pg.src, { left: px(CX - LW / 2), top: px(CY - LH / 2), width: px(LW), height: px(LH) })
    } else throw new Error('visual.fechamento.ordem "so-logo" needs the logo: MARCA.logo (SVG) or the PNG in MARCA.png')
    lg.style.transformOrigin = '50% 50%'
    marcarSe(lg, 'logo')
    const ent = entradaDoFecho(root, cm, t0)
    return (t) => {
      ent(t)
      const e = E.outCubic(P(t, t0 + 0.35, t0 + 0.95))
      O(lg, E.outCubic(P(t, t0 + 0.35, t0 + 0.6)))
      T(lg, `translateY(${((1 - e) * 36).toFixed(2)}px) scale(${lerp(0.96, 1, e).toFixed(4)})`)
    }
  }
  cena(A + D + 0.2, FIM + 0.01, (root) => {
    const t0 = A + D + 0.2
    const cm = el('div', { cls: 'layer', style: { background: FC.fundo } }, root)
    if (FC.ordem === 'so-logo') return fechoSoLogo(root, cm, t0)
    // modo cinema: o logo vira 3D numa camada atrás do texto (o canvas transparente não cobre a frase do fecho)
    // modo cinema: depois de o logo assentar, um brilho largo atravessa o fundo do fecho (atrás do logo e da frase). O logo
    // branco sobre a cor da marca quase não deixa ver a luz do chanfro, e o fecho ficava 3,2 s parado na direção.
    const brilho = CINE ? el('div', { cls: 'layer', style: { pointerEvents: 'none', width: px(W * 0.7), left: px(-W * 0.7),
      background: 'linear-gradient(105deg, rgba(255,255,255,0) 0%, rgba(255,255,255,0.16) 50%, rgba(255,255,255,0) 100%)' } }, cm) : null
    const c3 = CINE && MARCA.logo ? el('div', { cls: 'layer', style: { pointerEvents: 'none' } }, cm) : null
    // ordem "logo" (só com o logo 3D): o logo é o assunto, maior e em cima; a frase (um endereço, uma assinatura) vai
    // embaixo dele, menor. ordem "frase" (padrão): a frase grande e o logo embaixo.
    const LOGO1 = FC.ordem === 'logo' && !!(MARCA.logo && c3)
    const vb0 = MARCA.logo ? MARCA.logo.viewBox.split(/\s+/).map(Number) : [0, 0, 1, 1]
    const LH1 = Math.min(L({ '16x9': 200, '9x16': 230, padrao: 190 }), ((S.x1 - S.x0 - 160) * vb0[3]) / vb0[2]), ly1 = L({ '16x9': 430, '9x16': 850, padrao: H * 0.44 }) - LH1 / 2
    const ls = LOGO1
      ? titulo(cm, TU.textos.fimLinhas, { tam0: L({ '16x9': 60, '9x16': 64, padrao: 56 }), ent0: L({ '16x9': 72, padrao: 78 }), tinta: FC.tinta, meio: ly1 + LH1 + L({ '16x9': 110, padrao: 130 }) })
      : titulo(cm, TU.textos.fimLinhas, { tam0: L({ '16x9': 104, '9x16': 96, padrao: 88 }), ent0: L({ '16x9': 118, padrao: 124 }), tinta: FC.tinta, meio: L({ '16x9': 430, '9x16': 800, padrao: H * 0.42 }) })
    let logo = null, logo3 = null
    if (MARCA.logo && c3) {
      const rs = ls.map((l) => rectOf(l.line)), ult = rs[rs.length - 1]
      // o logo 3D é maior que o plano, mas nunca passa da área segura (logo largo, como um nome escrito, encolhe)
      const vb = MARCA.logo.viewBox.split(/\s+/).map(Number)
      // (folga de 80 px de cada lado: o logo balança em 3D e o lado que vem para a frente cresce)
      const LH = LOGO1 ? LH1 : Math.min(L({ '16x9': 130, '9x16': 150, padrao: 130 }), ((S.x1 - S.x0 - 160) * vb[3]) / vb[2]), LW = (LH * vb[2]) / vb[3]
      const lx = clamp(TI.alinhar === 'centro' ? CX - LW / 2 : Math.min(...rs.map((r) => r.x)), S.x0 + 80, S.x1 - 80 - LW), ly = LOGO1 ? ly1 : ult.y + ult.h + L({ '16x9': 90, padrao: 110 })
      // a checagem de colisão e de área segura mede o lugar do logo (ela não enxerga dentro do canvas)
      marcarSe(el('div', { style: { ...ret({ x: lx, y: ly, w: LW, h: LH }), pointerEvents: 'none' } }, cm), 'logo')
      logo3 = cinemaFechamento(c3, { logo: MARCA.logo, cx: lx + LW / 2, cy: ly + LH / 2, altura: LH, cor: FC.logo === 'negativo' ? FC.tinta : null,
        corLuz: V.realce.cor || '#FFFFFF', t0 })
    } else if (MARCA.logo) {
      const rs = ls.map((l) => rectOf(l.line)), ult = rs[rs.length - 1]
      const vb = MARCA.logo.viewBox.split(/\s+/).map(Number), LH = L({ '16x9': 110, '9x16': 130, padrao: 110 }), LW = (LH * vb[2]) / vb[3]
      logo = sv('svg', { viewBox: MARCA.logo.viewBox, width: LW, height: LH }, cm)
      Object.assign(logo.style, { position: 'absolute', left: px(TI.alinhar === 'centro' ? CX - LW / 2 : Math.min(...rs.map((r) => r.x))), top: px(ult.y + ult.h + L({ '16x9': 90, padrao: 110 })) })
      const g = sv('g', { transform: MARCA.logo.transform || '' }, logo)
      for (const pt of MARCA.logo.partes) sv('path', { d: pt.d, fill: FC.logo === 'negativo' ? FC.tinta : pt.fill, ...(pt.transform ? { transform: pt.transform } : {}) }, g)
      marcarSe(logo, 'logo')
    }
    const ent = entradaDoFecho(root, cm, t0)
    return (t) => {
      ent(t)
      entrar(ls, t, LOGO1 ? t0 + 1.0 : t0 + 0.3)
      if (logo) { O(logo, E.outCubic(P(t, t0 + 0.7, t0 + 1.0))); T(logo, `scale(${0.9 + 0.1 * E.outBack(P(t, t0 + 0.7, t0 + 1.1))})`); logo.style.transformOrigin = '50% 50%' }
      if (logo3) logo3(t)
      if (brilho) T(brilho, `translateX(${(W * 1.7 * E.inOutSine(P(t, t0 + 1.1, t0 + 2.9))).toFixed(1)}px)`)
    }
  }, 'fechamento')
}
