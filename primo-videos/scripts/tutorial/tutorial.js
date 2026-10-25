/* Composição do modo tutorial (roda no motor, depois do engine.js).
 * Entrada: const TUTORIAL = { eventos, quadros, aparelho, captura, titulo, serie, textos, A, F, visual? } (gerado pelo compose.mjs).
 * Tudo é função do tempo, como qualquer cena do motor: a tela gravada é uma sequencia() de quadros e
 * câmera, indicador, realce, legendas e transições saem só dos eventos gravados.
 *
 * Linha do tempo: [0, A) abertura · [A, A + duracao) tela real · [A + duracao, fim) fechamento.
 *
 * Dois desenhos:
 *  · TU.visual presente (series.json com "versao": 2): cada um dos nove elementos sai do que a série declarou
 *    (references/tutorial.md, seção 13). É este que evolui.
 *  · sem TU.visual (série antiga): cenasAntigas(), o desenho de antes da versão 2, congelado. A prova de
 *    regressão compara a folha de eventos pixel a pixel com a do motor original: não mude nada ali.
 * Câmera, indicador, realce e selos de escolha são os mesmos nos dois.
 *
 * Voz (TU.voz, só quando o video.mjs tem `voz`): nos dois desenhos, a legenda do passo é a fala, com a palavra
 * falada em destaque (falaNaLegenda). Sem TU.voz, nada muda.
 *
 * Antes (TU.antes, do g.antes; só no desenho da série): no começo do passo, a imagem ou o clipe da versão anterior
 * entra no lugar da tela gravada, dentro da mesma moldura e com a mesma câmera, por `dur` s. A câmera corta seco para
 * o enquadramento do antes (a regiao do g.antes, ou o alvo da próxima ação do passo) e fica nele até o corte de volta:
 * a tela de agora aparece no mesmo enquadramento. Indicador, realce e ondas somem no relance. A etiqueta é do drawing.js.
 */
function montarTutorial(TU) {
  const marcarSe = (e, tipo) => { if (typeof marcar === 'function') marcar(e, tipo) }
  const C = MARCA.cores
  const V = TU.visual || null
  const ap = TU.aparelho, vp = ap.viewport, TOQUE = ap.toque
  const A = TU.A, D = TU.duracao, F = TU.F
  const FIM = A + D + F
  const FT = VIDEO.fonteTitulo || 'system-ui', FX = VIDEO.fonteTexto || FT
  const FM = VIDEO.fonteMono || 'ui-monospace, "SF Mono", Menlo, Consolas, monospace'
  const ev = TU.eventos
  const passos = ev.filter((e) => e.tipo === 'passo')
  const NP = passos.length
  // Painel 3D (modo cinema com gravação de computador): a tela num painel em perspectiva que a câmera nunca leva para
  // debaixo do texto. O recorte fica na borda da parte livre; a câmera aproxima e recua dentro dela, e nunca para.
  const PAINEL = !!V && TU.cinema === 'moldura' && !TOQUE
  // Texto fora da imagem (series.json "texto": "fora-da-imagem", ou o painel): a tela com zoom some na borda da parte livre
  // em vez de passar por baixo da legenda, e a checagem reprova texto que cruza a imagem.
  const CLIP_LIVRE = PAINEL || VIDEO.texto === 'fora-da-imagem'
  const secoes = ev.filter((e) => e.tipo === 'secao')

  // ---------- layout por formato ----------
  // tela: onde a tela do aparelho fica no quadro (z = 1); legenda: onde a legenda mora (fora da câmera);
  // livre: a parte do quadro que a câmera usa para centrar a ação quando dá zoom (não fica sob a legenda).
  const LAY = V ? layoutNovo() : HORIZONTAL && FMT !== '16x9' ? layoutAntigoDeitado() : L({
    // 9:16 respeita a área segura do Reels/TikTok (texto em x 70–940, y 250–1450): a legenda mora ali e
    // a tela (imagem, não texto) pode descer sob a faixa de baixo da plataforma
    '9x16': (() => { const h = 1340, w = (h * vp.width) / vp.height; return { tela: { x: (W - w) / 2, y: 540, w, h, r: 44 }, legenda: { x: 80, y: 252, w: 856, h: 250 }, livre: { x: 0, y: 520, w: W, h: H - 520 } } })(),
    '16x9': (() => { const w = 1320, h = (w * vp.height) / vp.width; return { tela: { x: 64, y: (H - h) / 2 + 20, w, h, r: 18 }, legenda: { x: 1432, y: 200, w: 430, h: 680 }, livre: { x: 0, y: 0, w: 1410, h: H } } })(),
    '4x5': (() => { const h = 980, w = (h * vp.width) / vp.height; return { tela: { x: (W - w) / 2, y: 320, w, h, r: 30 }, legenda: { x: 64, y: 70, w: W - 128, h: 220 }, livre: { x: 0, y: 300, w: W, h: H - 300 } } })(),
    '1x1': (() => { const h = 800, w = (h * vp.width) / vp.height; return { tela: { x: W - w - 80, y: 200, w, h, r: 24 }, legenda: { x: 64, y: 200, w: W - w - 200, h: 600 }, livre: { x: W - w - 140, y: 0, w: w + 140, h: H } } })(),
  })
  // O desenho antigo num formato mais largo que o 16:9 (19:9, 21:9): o mesmo arranjo, a tela crescendo até a altura deixar e
  // a legenda com o resto da largura (a coluna proporcional ao quadro).
  function layoutAntigoDeitado() {
    const s = W / 1920, lw = 430 * s, a = vp.width / vp.height
    const w = TOQUE ? 1320 * s : Math.min(W - 64 - 48 - lw - 58, (H - 128) * a), h = w / a
    const tela = { x: 64, y: TOQUE ? (H - h) / 2 + 20 : clamp((H - h) / 2 + 20, 44, H - 44 - h), w, h, r: 18 }
    const lx = tela.x + w + 48
    // (o cartão tem 34 px de folga por dentro: o texto termina dentro da área segura de 5%)
    return { tela, legenda: { x: lx, y: 200, w: W * 0.95 - lx + 30, h: 680 }, livre: { x: 0, y: 0, w: lx - 22, h: H } }
  }
  const T0 = LAY.tela, k = T0.w / vp.width                 // px do quadro por px CSS do app
  const aTela = (x, y) => [T0.x + x * k, T0.y + y * k]
  const ZMAX = Math.max(1, (TU.captura.largura / T0.w) * 0.98)   // acima disso a imagem amolece
  // Celular gravado (390×844): com z = 1 o aparelho inteiro aparece e a letra de 12 px do app fica pequena (~13 px no
  // 16:9). ZMIN é o zoom de leitura dos planos de detalhe (a letra pequena com ~30 px no 16:9, ~28 px no 9:16); no 9:16
  // o teto é igual ao piso, para o app não passar para baixo dos botões da direita da plataforma (área segura).
  const CEL9 = FMT === '9x16' && TOQUE
  // Painel: o zoom de leitura é a letra de 16 px do app com ~34 px no quadro (o OCR do refino mede ~29); o plano geral, a
  // tela inteira, é curto. Chegar lá pede captura nítida: a série grava o computador com DSF 3 (serie.aparelhos).
  // visual.painel.letra: a letra pequena de leitura do app (padrão 16 px); um app denso, com tabela em 12 px, pede 12 e a
  // câmera aproxima até ela ficar com ~34 px (sempre abaixo do teto de nitidez da captura).
  const LETRA = (V && V.painel && V.painel.letra) || 16
  // visual.painel.zoom "nenhum": a tela inteira o vídeo todo (a câmera não entra no campo; o detalhe vai no realce e no
  // cursor). Para quem precisa ver em que tela está, e não só o campo.
  const SEM_ZOOM = !!(PAINEL && V && V.painel && V.painel.zoom === 'nenhum')
  const ZMIN = HORIZONTAL && TOQUE ? Math.min(ZMAX, 30 / (12 * k)) : CEL9 ? Math.min(ZMAX, 28.6 / (12 * k)) : PAINEL && !SEM_ZOOM ? Math.min(ZMAX / 1.06, 34 / (LETRA * k)) : 1
  const ZTETO = CEL9 ? ZMIN : SEM_ZOOM ? 1 : ZMAX

  // Layout da versão 2: a legenda ocupa um lado (visual.legenda.lado), a tela ocupa o maior retângulo que sobra
  // (descontada a moldura) e a parte livre é o quadro menos o lado da legenda. O texto da legenda fica sempre
  // dentro da área segura; a faixa (fundo da legenda) e a tela, que não são texto, podem ir até a borda.
  function layoutNovo() {
    const S = areaSegura(), LG = V.legenda
    const lado = typeof LG.lado === 'object' ? L(LG.lado) : LG.lado
    const lateral = lado === 'direita' || lado === 'esquerda'
    // arranjo "linha" (legenda em cima ou embaixo, num quadro deitado): a seção, o rótulo e a frase lado a lado numa faixa
    // baixa (o letreiro de rodapé); a tela fica com a altura que sobra
    const linha = LG.arranjo === 'linha' && HORIZONTAL && !lateral && LG.tipo !== 'nenhuma'
    // entre a legenda e a tela; no painel, mais: o recorte da parte livre esfuma ali, e o painel inclina em 3D
    const g = PAINEL && lateral ? 80 : linha ? 40 : L({ '16x9': 48, padrao: 40 })
    // da tela até a borda do quadro (o painel flutua: mais ar em volta, para inclinar e respirar sem encostar na borda)
    const mt = PAINEL && HORIZONTAL ? 80 : L({ '16x9': 56, '9x16': 40, padrao: 44 })
    const pf = LG.tipo === 'faixa' ? (linha ? 26 : L({ '16x9': 34, padrao: 36 })) : 0   // o quanto a faixa passa do texto
    let cr = cromo()
    let G, banda, R
    if (LG.tipo === 'nenhuma') {
      // O motor não desenha legenda: ela vem da montagem (captions/caption.mjs), uma só no vídeo inteiro, do lado
      // declarado e dentro da área segura. O layout só reserva a faixa dela: o aparelho usa o quadro, e a câmera centra
      // a ação no que a faixa deixa livre.
      const res = lateral ? Math.min(L({ '16x9': 440, padrao: 380 }), (S.x1 - S.x0) * 0.44) : L({ '16x9': 190, '9x16': 250, padrao: 210 })
      G = lado === 'baixo' ? { x: S.x0, y: S.y1 - res, w: S.x1 - S.x0, h: res } : lado === 'cima' ? { x: S.x0, y: S.y0, w: S.x1 - S.x0, h: res }
        : lado === 'direita' ? { x: S.x1 - res, y: S.y0, w: res, h: S.y1 - S.y0 } : { x: S.x0, y: S.y0, w: res, h: S.y1 - S.y0 }
      banda = G
      // no 9:16 o aparelho inteiro fica com ar em volta (o plano geral é curto: a câmera logo aproxima)
      const mv = L({ '16x9': 56, '9x16': 180, padrao: 60 }), mh = L({ '16x9': 56, padrao: 40 })
      R = lateral ? (lado === 'direita' ? { x0: mh, x1: G.x - g, y0: mv, y1: H - mv } : { x0: G.x + G.w + g, x1: W - mh, y0: mv, y1: H - mv }) : { x0: mh, x1: W - mh, y0: mv, y1: H - mv }
    } else if (lateral) {
      // a coluna: a da série (legenda.largura: fração do quadro ou px), ou 440 px no 16:9 e a mesma fração nos mais largos
      const lw0 = LG.largura != null ? (LG.largura <= 1 ? W * LG.largura : LG.largura) : HORIZONTAL && FMT !== '16x9' ? (440 * W) / 1920 : L({ '16x9': 440, '9x16': 380, '4x5': 400, '1x1': 380 })
      const lw = Math.min(lw0, (S.x1 - S.x0) * 0.44), rc = LG.recuo || 0
      // com seções (g.secao), o rótulo da seção mora no alto da coluna
      const lh = L({ '16x9': 330, '9x16': 400, padrao: 340 }) + (secoes.length ? 70 : 0)
      const x = lado === 'direita' ? S.x1 - lw - rc : S.x0 + rc
      G = { x, y: 0, w: lw, h: lh }
      banda = lado === 'direita' ? { x: x - pf, y: 0, w: W - x + pf, h: H } : { x: 0, y: 0, w: x + lw + pf, h: H }
      const bx0 = LG.tipo === 'faixa' ? banda.x : x, bx1 = LG.tipo === 'faixa' ? banda.x + banda.w : x + lw
      R = lado === 'direita' ? { x0: mt, x1: bx0 - g, y0: mt, y1: H - mt } : { x0: bx1 + g, x1: W - mt, y0: mt, y1: H - mt }
    } else {
      // visual.legenda.sobre: a faixa passa por cima da borda de baixo (ou de cima) da tela, e a tela fica com a área segura
      // inteira (no 16:9 com a janela 16:9, 90% da largura): para mostrar a página toda, grande, sem perder a frase
      const sobre = !!LG.sobre && HORIZONTAL
      const lh = linha ? 96 : L({ '16x9': 200, '9x16': 250, '4x5': 220, '1x1': 200 }) + (secoes.length ? 56 : 0)
      const lw = linha ? S.x1 - S.x0 : Math.min(S.x1 - S.x0, L({ '16x9': 1180, padrao: 9999 }))
      const y = lado === 'cima' ? S.y0 : S.y1 - lh
      G = { x: 0, y, w: lw, h: lh }
      // a faixa vai de uma borda lateral à outra e abraça o texto: descer até a borda de baixo, no 9:16,
      // pintaria 40% do quadro sob a interface da plataforma. Na linha (só nos deitados) ela sangra até a borda do quadro.
      banda = { x: 0, y: y - pf, w: W, h: lh + 2 * pf }
      if (linha && lado === 'baixo') banda.h = H - banda.y
      if (linha && lado === 'cima') { banda.h = banda.y + banda.h; banda.y = 0 }
      const by0 = LG.tipo === 'faixa' ? banda.y : y, by1 = LG.tipo === 'faixa' ? banda.y + banda.h : y + lh
      // (na linha, o painel sobe até a borda da área segura: a faixa já tirou a altura que podia)
      const mv = linha && PAINEL ? S.y0 + 16 : mt
      R = sobre ? { x0: S.x0, x1: S.x1, y0: S.y0, y1: S.y1 } : lado === 'cima' ? { x0: mt, x1: W - mt, y0: by1 + g, y1: H - mv } : { x0: mt, x1: W - mt, y0: mv, y1: by0 - g }
    }
    const SOBRE = !!LG.sobre && HORIZONTAL && !lateral
    const a = vp.width / vp.height
    let raio = V.moldura.raio
    if (V.moldura.tipo === 'aparelho') {
      // o corpo do celular do kit 3D (430×900 em volta de uma tela de 390×844): a borda acompanha o tamanho da tela
      const wa = Math.min(((R.x1 - R.x0) * 390) / 430, (R.y1 - R.y0) / (1 / a + 56 / 390)), u = wa / 390
      cr = { t: 28 * u, r: 20 * u, b: 28 * u, l: 20 * u }; raio = 44 * u
    }
    // painel: a tela inteira fica dentro da área segura (o texto do app também é texto no quadro)
    if (PAINEL) R = { x0: Math.max(R.x0, S.x0), x1: Math.min(R.x1, S.x1), y0: Math.max(R.y0, S.y0 + (SOBRE ? 0 : 16)), y1: Math.min(R.y1, S.y1 - (SOBRE ? 0 : 16)) }
    // Com o texto à direita, a borda de fora do painel é a da esquerda: inclinado para o texto, ela vem para a frente e cresce
    // na perspectiva, e é ali que o app costuma ter o nome e o menu. Ela fica 36 px dentro da área segura.
    if (PAINEL && lado === 'direita') R.x0 = Math.max(R.x0, S.x0 + 36)
    const aw = R.x1 - R.x0 - cr.l - cr.r, ah = R.y1 - R.y0 - cr.t - cr.b
    const w = Math.min(aw, ah * a), h = w / a
    const tela = { x: R.x0 + cr.l + (aw - w) / 2, y: R.y0 + cr.t + (ah - h) / 2, w, h, r: raio }
    if (LG.tipo === 'nenhuma') {
      // a parte livre fica dentro da área segura, do lado oposto ao da legenda reservada
      const livre = lado === 'baixo' ? { x: 0, y: S.y0, w: W, h: G.y - g / 2 - S.y0 } : lado === 'cima' ? { x: 0, y: G.y + G.h + g / 2, w: W, h: S.y1 - G.y - G.h - g / 2 }
        : lado === 'direita' ? { x: 0, y: 0, w: G.x - g / 2, h: H } : { x: G.x + G.w + g / 2, y: 0, w: W - G.x - G.w - g / 2, h: H }
      return { tela, legenda: G, banda, livre, lado, lateral, linha, cromo: cr }
    }
    // no painel, a coluna fica na altura do meio do painel (o texto ao lado da imagem, não colado no topo)
    if (lateral) G.y = clamp(PAINEL ? tela.y + tela.h / 2 - G.h / 2 - 40 : tela.y + L({ '16x9': 40, padrao: 32 }), S.y0, S.y1 - G.h)
    else G.x = clamp(tela.x + w / 2 - G.w / 2, S.x0, S.x1 - G.w)
    const bl = LG.tipo === 'faixa' ? banda : { x: G.x, y: G.y, w: G.w, h: G.h }
    const livre = lado === 'direita' ? { x: 0, y: 0, w: bl.x - g / 2, h: H }
      : lado === 'esquerda' ? { x: bl.x + bl.w + g / 2, y: 0, w: W - bl.x - bl.w - g / 2, h: H }
      : lado === 'cima' ? { x: 0, y: bl.y + bl.h + g / 2, w: W, h: H - bl.y - bl.h - g / 2 }
      : { x: 0, y: 0, w: W, h: bl.y - g / 2 }
    return { tela, legenda: G, banda, livre, lado, lateral, linha, cromo: cr }
  }
  // quanto a moldura ocupa em volta da tela (px do quadro), para o layout reservar
  function cromo() {
    const M = V.moldura, z = { t: 0, r: 0, b: 0, l: 0 }
    if (M.tipo === 'fio') { const e = M.espessura; return { t: e, r: e, b: e, l: e } }
    if (M.tipo === 'janela') return TOQUE ? { t: 14, r: 14, b: 14, l: 14 } : { ...z, t: 40 }
    if (M.tipo === 'navegador') return TOQUE ? { t: 58, r: 0, b: 0, l: 0 } : { ...z, t: 62 }
    if (M.tipo === 'proprio') { const m = M.margem; return Array.isArray(m) ? { t: m[0], r: m[1], b: m[2], l: m[3] } : { t: m, r: m, b: m, l: m } }
    return z   // nenhuma; e aparelho, que o layout mede junto com a tela
  }

  // ---------- câmera: sai só dos eventos ----------
  const chaves = [{ t: 0, x: CX, y: CY, z: 1 }]
  // No 9:16 a ação fica centrada na área segura da plataforma, não no quadro inteiro.
  // A parte livre termina onde começa o esfumado de baixo (120 px acima da borda da área segura): o alvo (a barra de
  // baixo do app, inclusive) fica inteiro acima dele, e não apagado dentro dele.
  // (com a legenda "nenhuma" a parte livre já termina na faixa reservada para a legenda da montagem)
  const SEM_LEGENDA = !!V && V.legenda.tipo === 'nenhuma'
  // painel: a câmera aproxima e recua dentro da tela do painel, que fica parado (a janela é a própria tela)
  const livre = PAINEL ? { x: T0.x, y: T0.y, w: T0.w, h: T0.h } : CEL9 ? (() => { const L0 = LAY.livre, S = areaSegura(), y1 = SEM_LEGENDA ? L0.y + L0.h : Math.min(L0.y + L0.h, S.y1 - 130); return { x: S.x0, y: L0.y, w: S.x1 - S.x0, h: y1 - L0.y } })() : LAY.livre
  // v2: a janela pode passar da borda da tela do aparelho só do lado da legenda (o que aparece ali fica sob ela)
  const folga = { l: livre.x, r: W - livre.x - livre.w, t: livre.y, b: H - livre.y - livre.h }
  // painel: a janela fica 36 px dentro da tela (a respiração da câmera não mostra o que fica fora dela)
  if (PAINEL) for (const q of ['l', 'r', 't', 'b']) folga[q] -= 36
  // Celular no 16:9 com zoom: a janela mostra um pouco do aparelho em cima e embaixo, para o cabeçalho e a barra do
  // app não encostarem na borda do quadro.
  if (ZMIN > 1 && !CEL9 && !PAINEL) { folga.t = Math.max(folga.t, 80); folga.b = Math.max(folga.b, 80) }
  // 9:16: com o zoom mínimo, a janela fica mais alta que a tela do app e a câmera travava no meio, sem nunca descer
  // até a barra de baixo (os toques na barra ficavam no esfumado). A folga embaixo deixa a câmera descer até trazer
  // a barra para a área segura.
  if (CEL9) folga.b = Math.max(folga.b, 1200)
  const trava = (v, meia, ini, tam, fMin, fMax, z, centroLivre) => {
    const lo = ini + meia - fMin / z, hi = ini + tam - meia + fMax / z
    // janela maior que a tela: a tela fica centrada na parte livre (não no quadro, que tem a legenda)
    return lo > hi ? ini + tam / 2 - centroLivre / z : clamp(v, lo, hi)
  }
  // justo: a caixa é o próprio retângulo (a regiao do g.antes), sem o contexto mínimo de meia tela
  const foco = (ret, t, dur = 0.75, justo = false) => {
    if (SEM_ZOOM) { const c = { t: A + t, x: CX, y: CY, z: 1, dur }; chaves.push(c); return c }
    // caixa de interesse: o alvo com contexto (no mínimo meia tela de largura), no máximo o que cabe na parte livre
    const bw = justo ? ret.w * 1.04 : Math.max(ret.w + 40, vp.width * 0.5), bh = justo ? ret.h * 1.04 : Math.max(ret.h + 40, vp.height * 0.28)
    let z = clamp(Math.min(livre.w / (bw * k * 1.15), livre.h / (bh * k * 1.15)), ZMIN, ZTETO)
    const [fx, fy] = aTela(ret.x + ret.w / 2, ret.y + ret.h / 2)
    const [ax0, ay0] = aTela(ret.x, ret.y), [ax1, ay1] = aTela(ret.x + ret.w, ret.y + ret.h)
    let x, y
    // Presa na borda da tela do aparelho, a janela pode deixar o alvo fora da parte livre (embaixo da
    // legenda: alvo no canto direito, no 16:9). Então o zoom diminui até o alvo caber na parte livre.
    for (let volta = 0; volta < 14; volta++) {
      // o foco fica no centro da parte livre, não no centro do quadro
      x = fx - (livre.x + livre.w / 2 - CX) / z; y = fy - (livre.y + livre.h / 2 - CY) / z
      // com zoom, a janela não passa da borda da tela do aparelho (senão mostra fundo e corta o app)
      const hw = W / (2 * z), hh = H / (2 * z)
      if (V) {
        x = trava(x, hw, T0.x, T0.w, folga.l, folga.r, z, livre.x + livre.w / 2 - CX)
        y = trava(y, hh, T0.y, T0.h, folga.t, folga.b, z, livre.y + livre.h / 2 - CY)
        // 9:16: a tela do app fica parada no meio da área segura; a câmera só sobe e desce
        if (CEL9) x = T0.x + T0.w / 2 - (livre.x + livre.w / 2 - CX) / z
        // 9:16: o app preenche a parte livre até o pé dela. Centrar um alvo da barra de baixo deixava o app acabar no
        // meio do quadro, com metade dele só de fundo: a barra assenta no pé da parte livre.
        // (legenda "nenhuma": o pé do app desce até o meio da faixa reservada. A legenda da montagem fica por cima da
        // barra de baixo do app, e o aparelho ocupa o quadro até lá em vez de acabar no meio dele)
        const pe = SEM_LEGENDA && LAY.lado === 'baixo' ? LAY.legenda.y + LAY.legenda.h * 0.55 : livre.y + livre.h
        if (CEL9) y = Math.max(Math.min(y, T0.y + T0.h - (pe - CY) / z), T0.y - (livre.y - CY) / z)
      } else {
        x = 2 * hw >= T0.w ? T0.x + T0.w / 2 : clamp(x, T0.x + hw, T0.x + T0.w - hw)
        y = 2 * hh >= T0.h ? T0.y + T0.h / 2 : clamp(y, T0.y + hh - (livre.y - (CY - H / 2)) / z, T0.y + T0.h - hh)
      }
      const sx0 = CX + (ax0 - x) * z, sx1 = CX + (ax1 - x) * z, sy0 = CY + (ay0 - y) * z, sy1 = CY + (ay1 - y) * z
      const cabe = sx0 >= livre.x + 8 && sx1 <= livre.x + livre.w - 8 && sy0 >= livre.y + 8 && sy1 <= livre.y + livre.h - 8
      if (cabe || z <= ZMIN) break
      z = Math.max(ZMIN, z * 0.88)
    }
    const chave = { t: A + t, x, y, z: ZMIN > 1 ? z : z < 1.12 ? 1 : z, dur }
    chaves.push(chave)
    return chave
  }
  // Plano e detalhe (a tela inteira primeiro, depois o zoom; nunca a tela cortada pelo meio): cada tela nova
  // entra inteira (z = 1, o aparelho todo), segura um instante e só então a câmera aproxima no campo da vez, no zoom
  // de leitura. No sucesso e no fim ela abre de novo para a tela inteira. O refino aceita esse plano geral curto
  // (PLANO_GERAL_MAX em scripts/refine/video.mjs); tela pequena por mais tempo continua erro.
  const SEGURA = 0.75                                 // quanto a tela inteira fica parada antes de aproximar
  let ultInteira = -9
  const inteira = (t, dur = 0.6) => { chaves.push({ t: A + t, x: CX, y: CY, z: 1, dur }); ultInteira = t }
  // rolagem: fica no detalhe, numa faixa da tela na largura toda
  const faixa = { x: 0, y: vp.height * 0.25, w: vp.width, h: vp.height * 0.4 }
  inteira(0, 0.01)
  // abertura "pouso": o aparelho inteiro já foi visto entrando; a câmera pode aproximar assim que ele assenta
  if (V && V.abertura.saida === 'pouso') ultInteira = -SEGURA
  let ultFoco = -9
  // toque oculto (g.toque(…, { oculto: true })): a câmera não vai até ele e nada é desenhado sobre ele
  const acoes = ev.filter((e) => /^(toque|aponta|digita|escolhe|prova)$/.test(e.tipo) && e.ret && !e.oculto)
  const proxAcao = (t) => acoes.find((a) => a.t > t)
  // g.antes: as janelas do relance, no tempo do vídeo (a câmera fica parada no enquadramento do antes)
  const janelasAntes = []
  // o detalhe nunca chega antes de a tela inteira ter ficado SEGURA s parada
  const depoisDaInteira = (t, dur) => Math.max(t, ultInteira + SEGURA + dur)
  // pouso: a câmera não para no aparelho inteiro. Assim que ele assenta ela segue para o primeiro alvo (mesmo que o
  // que vai aparecer ali ainda não tenha chegado): o plano geral já foi a própria entrada.
  if (V && V.abertura.saida === 'pouso' && ZMIN > 1) { const pa = proxAcao(-1); if (pa && pa.t > 0.8) foco(pa.ret, 0.75, 0.75) }
  for (const e of ev) {
    // no passo novo a câmera só abre para o quadro todo se a próxima ação demora: senão é "bomba" de zoom
    // passo novo na mesma tela: no celular, a câmera fica no detalhe (a tela inteira é só para tela nova); sem zoom de
    // leitura, abre para o quadro todo se a próxima ação demora (senão é "bomba" de zoom)
    if (e.tipo === 'passo') { const pa = proxAcao(e.t); if (ZMIN === 1 && e.t - ultFoco > 0.4 && (!pa || pa.t - e.t > 1.8)) inteira(e.t + 0.55, 0.55) }
    // a tela mudou depois de carregar (no painel, só a troca de URL abre a tela inteira: a espera fica no detalhe)
    else if (e.tipo === 'espera' && e.t1 - e.t > 0.5 && !PAINEL) inteira(e.t1 + 0.1, 0.6)
    else if ((e.tipo === 'toque' || e.tipo === 'aponta' || e.tipo === 'prova') && e.ret && !e.oculto) { foco(e.ret, depoisDaInteira(Math.max(e.t - 0.05, (chaves[chaves.length - 1].t - A) + 0.5), 0.75)); ultFoco = e.t }
    else if ((e.tipo === 'digita' || e.tipo === 'escolhe') && e.ret) { foco(e.ret, depoisDaInteira(e.t + 0.1, 0.5), 0.5); ultFoco = e.t }
    // rolar é ler: a câmera fica no detalhe (a tela inteira é só para tela nova)
    else if (e.tipo === 'rola') { if (ZMIN > 1) foco(faixa, e.t + 0.3, 0.45); else inteira(e.t + 0.3, 0.45) }
    else if (e.tipo === 'tela') inteira(e.t + 0.3, 0.45)
    else if (e.tipo === 'sucesso') inteira(e.t + 0.2, 0.7)
    // o placar: a câmera abre para o aparelho inteiro, que recua (drawing.js) e dá o quadro ao número
    else if (e.tipo === 'placar') inteira(e.t + 0.55, 0.6)
    else if (e.tipo === 'antes') {
      // o enquadramento do antes: a regiao do g.antes (justo), ou o alvo da próxima ação deste passo (com contexto, como a
      // câmera iria até ele), ou a tela inteira. Corte seco para ele, e fica até o corte de volta.
      const pp = passos.find((x) => x.t > e.t), prox = acoes.find((a) => a.t > e.t && (!pp || a.t < pp.t))
      // (a regiao que encosta na borda da tela é aparada 14 px: colada na borda, ela nunca cabia na parte livre e a câmera
      // desistia do zoom)
      const B = 14, apara = (q) => { const x0 = Math.max(q.x, B), y0 = Math.max(q.y, B), x1 = Math.min(q.x + q.w, vp.width - B), y1 = Math.min(q.y + q.h, vp.height - B); return x1 - x0 > 20 && y1 - y0 > 20 ? { x: x0, y: y0, w: x1 - x0, h: y1 - y0 } : q }
      const r = e.ret ? apara(e.ret) : (prox && prox.ret) || null
      let c0
      if (r) c0 = foco(r, e.t, 0.001, !!e.ret)
      else { inteira(e.t, 0.001); c0 = chaves[chaves.length - 1] }
      c0.antes = true
      chaves.push({ ...c0, t: A + e.t + e.dur, dur: e.dur, antes: true })
      janelasAntes.push([A + e.t, A + e.t + e.dur])
      ultFoco = e.t + e.dur
    }
  }
  inteira(Math.max(D - 0.2, (chaves[chaves.length - 1].t - A) + 0.5), 0.9)
  chaves.sort((a, b) => a.t - b.t)
  // A tela inteira fica pequena: mais que ~1,5 s parada nela vira "tela encolhida". Depois de cada tela inteira, se o
  // próximo detalhe demora, a câmera já aproxima no alvo dele (ou, no sucesso e no fim, no próprio resultado).
  if (ZMIN > 1) {
    const sucessos = ev.filter((e) => e.tipo === 'sucesso' && e.ret)
    for (const c of chaves.filter((c) => c.z === 1 && c.t >= A)) {
      const t0 = c.t - A, prox = chaves.find((x) => x.t > c.t && x.z > 1)
      if (prox && prox.t - c.t <= SEGURA + 1.4) continue
      const alvo = (proxAcao(t0) || sucessos.find((e) => e.t <= t0 + 0.5) || sucessos[sucessos.length - 1] || {}).ret
      if (alvo && t0 + SEGURA + 0.75 < D) foco(alvo, t0 + SEGURA + 0.75, 0.75)
    }
    chaves.sort((a, b) => a.t - b.t)
  }
  // Painel: a câmera nunca fica parada. Entre duas chaves que se afastam mais de 2,6 s, ela aproxima e recua devagar no
  // mesmo ponto (7%), a cada 2,2 s: algo muda no quadro a cada 2–3 s, sem tirar o alvo do lugar.
  // (com a tela inteira, painel.zoom "nenhum", não: o pulso de 7% cortaria a borda da página; quem respira é o painel)
  if (PAINEL && !SEM_ZOOM) {
    const ks = chaves.filter((c) => c.t >= A).sort((a, b) => a.t - b.t), novos = []
    ks.forEach((c, i) => {
      const prox = ks[i + 1] ? ks[i + 1].t - (ks[i + 1].dur != null ? ks[i + 1].dur : 0.7) : A + D
      for (let n = 1, t = c.t + 2.2; t < prox - 0.8; n++, t += 2.2) {
        const z = n % 2 ? (c.z * 1.07 <= ZMAX ? c.z * 1.07 : c.z / 1.07) : c.z
        novos.push({ t, x: c.x, y: c.y, z, dur: 1.5, ease: E.inOutSine })
      }
    })
    chaves.push(...novos)
    chaves.sort((a, b) => a.t - b.t)
  }
  // g.antes: nada mexe a câmera durante o relance. Chave que chegaria dentro dele sai; a que estaria a meio caminho no
  // corte de volta começa a andar só depois dele (a tela de agora aparece no mesmo enquadramento do antes).
  if (janelasAntes.length) {
    const fica = chaves.filter((c) => c.antes || !janelasAntes.some(([a0, a1]) => c.t > a0 && c.t <= a1))
    for (const c of fica) {
      if (c.antes) continue
      const d = c.dur != null ? c.dur : 0.7
      for (const [, a1] of janelasAntes) if (c.t > a1 && c.t - d < a1) c.t = a1 + d
    }
    chaves.length = 0
    chaves.push(...fica.sort((a, b) => a.t - b.t))
  }
  // Câmera viva: enquanto a voz fala e a mão espera, a câmera respira devagar, duas ondas lentas que nunca param
  // juntas. Sem isso o quadro fica parado segundos inteiros (o refino reprova quadro parado).
  // 9:16: o mundo se estende 700 px abaixo do quadro (só fundo), para a câmera poder descer até a barra do app.
  const camFixa = camera(chaves, { zmax: ZMAX, ...(CEL9 ? { ch: H + 700, vh: H } : {}) })
  const cam = Object.assign((t) => {
    const c = camFixa(t), u = t - A
    // 9:16: a respiração só afasta (até 1%), nunca aproxima: no zoom mínimo o app já ocupa a área segura inteira, e
    // aproximar mais empurrava a borda do texto do app para fora dela (x < 70).
    // painel: no detalhe a respiração só afasta (até 3%) e anda de lado, para nunca bater no teto do zoom e parar; na tela
    // inteira ela só aproxima (afastar mostraria a janela vazia em volta) e não anda de lado
    // tela inteira (painel.zoom "nenhum"): a câmera não aproxima nem por respiração (cortaria a borda da página); quem
    // respira é o próprio painel, que recua de leve (drawing.js, painelEm)
    if (PAINEL && SEM_ZOOM) return c
    if (PAINEL) {
      const b = (0.018 * (1 + Math.sin(u * 1.1))) / 2 + (0.012 * (1 + Math.sin(u * 2.3 + 1))) / 2, lado = clamp((c.z - 1.02) / 0.3)
      return { ...c, x: c.x + 7 * lado * Math.sin(u * 0.7), y: c.y + 4 * lado * Math.sin(u * 0.53 + 1), z: c.z > 1.05 ? c.z * (1 - b) : c.z * (1 + b) }
    }
    if (CEL9) return { ...c, y: c.y + 5 * Math.sin(u * 0.8), z: Math.min(ZMAX, c.z * (1 - 0.006 * (1 + Math.sin(u * 1.1)) / 2 - 0.004 * (1 + Math.sin(u * 2.3 + 1)) / 2)) }
    return { ...c, x: c.x + 4 * Math.sin(u * 0.7), z: Math.min(ZMAX, c.z * (1 + 0.016 * Math.sin(u * 1.1) + 0.010 * Math.sin(u * 2.3 + 1))) }
  }, { base: camFixa.base, opts: camFixa.opts })

  // posição do indicador: segue os "move" com a mesma curva do gravador
  const moves = ev.filter((e) => e.tipo === 'move')
  const toques = ev.filter((e) => e.tipo === 'toque' && !e.oculto)
  const telas = ev.filter((e) => e.tipo === 'tela')
  const posEm = (t) => {
    let p = moves.length ? moves[0].de : [vp.width / 2, vp.height * 0.7]
    for (const m of moves) {
      if (t < m.t) break
      p = t >= m.t1 ? m.para : [lerp(m.de[0], m.para[0], E.inOutCubic(P(t, m.t, m.t1))), lerp(m.de[1], m.para[1], E.inOutCubic(P(t, m.t, m.t1)))]
    }
    return p
  }
  // dedo visível só em volta dos toques; cursor visível desde o primeiro movimento
  const visDedo = (t) => {
    let v = 0
    for (const m of moves) {
      const tq = toques.find((q) => q.t >= m.t1 - 0.02 && q.t < m.t1 + 1.5)
      const fimV = (tq ? tq.t : m.t1) + 0.55
      v = Math.max(v, E.outCubic(P(t, m.t - 0.12, m.t + 0.12)) * (1 - E.inCubic(P(t, fimV, fimV + 0.3))))
    }
    return v
  }

  // ---------- conteúdo da tela: gravação, realce, ondas, indicador, selos de escolha ----------
  // es = { realce: {tipo, cor, espessura, raio}, dedo: [preenchimento, traço], seta: [preenchimento, traço], onda, selo: {fundo, tinta, sombra, raio} }
  function conteudoTela(mundo, es, raioTela) {
    const telaBox = el('div', { style: { position: 'absolute', left: px(T0.x), top: px(T0.y), width: px(T0.w), height: px(T0.h), borderRadius: raioTela, overflow: 'hidden', background: '#fff' } }, mundo)
    telaBox.dataset.fv = 'tela'
    if (typeof marcarImagem === 'function') marcarImagem(telaBox, 'the recorded screen')
    const seq = sequencia(telaBox, TU.quadros, { width: px(T0.w), height: px(T0.h) })
    // g.antes: a tela da versão anterior por cima da gravada, no mesmo lugar (aparece só no relance)
    const antes = (TU.antes || []).map((a) => {
      const sq = sequencia(telaBox, a.quadros, { width: px(T0.w), height: px(T0.h) })
      sq.el.style.display = 'none'
      return { a, sq }
    })
    const fx = svgQuadro(mundo)  // realce, ondas, indicador: dentro do mundo = crescem com o zoom, proporcionais à tela
    const realce = realceDe(fx, es.realce)
    const ondas = toques.map(() => sv('circle', { fill: 'none', stroke: es.onda, 'stroke-width': 2 * k }, fx))
    // painel: no toque, um brilho na cor da marca em volta do elemento tocado (só forma: um aro desfocado que cresce e some)
    let brilhos = []
    if (es.brilho) {
      const f = sv('filter', { id: 'fvBrilho', x: '-60%', y: '-60%', width: '220%', height: '220%' }, sv('defs', {}, fx))
      sv('feGaussianBlur', { stdDeviation: 7 * k }, f)
      brilhos = toques.map((q) => (q.ret ? { q, r: sv('rect', { fill: 'none', stroke: es.brilho, 'stroke-width': 7 * k, filter: 'url(#fvBrilho)', rx: 14 * k }, fx) } : null)).filter(Boolean)
    }
    const ind = sv('g', {}, fx)
    const R = (TOQUE ? 11 : 0) * k   // dedo: 22 px CSS de diâmetro (5,6% de uma tela de 390)
    let dedo, seta
    if (TOQUE) {
      dedo = sv('circle', { r: R, fill: es.dedo[0], stroke: es.dedo[1], 'stroke-width': 2 * k }, ind)
      ind.setAttribute('filter', 'drop-shadow(0 2px 5px rgba(0,0,0,.22))')
    } else {
      // cursor: ~22 px CSS de altura (1,5% de 1440), contorno, sombra curta
      seta = sv('path', { d: 'M0 0 L0 17.5 L4.4 13.6 L7.6 20.6 L10.6 19.3 L7.4 12.4 L13 12.4 Z', fill: es.seta[0], stroke: es.seta[1], 'stroke-width': 1.4, 'stroke-linejoin': 'round' }, ind)
      ind.setAttribute('filter', 'drop-shadow(0 1.5px 2px rgba(0,0,0,.3))')
    }
    // escolha de lista nativa e data: um selo com a escolha, colado no campo (a lista nativa não aparece)
    const selos = ev.filter((e) => (e.tipo === 'escolhe' || (e.tipo === 'digita' && e.nativo === 'date')) && e.ret).map((e) => {
      const s = el('div', { style: { position: 'absolute', whiteSpace: 'nowrap', font: `700 ${14 * k}px ${FX}`, color: es.selo.tinta, background: es.selo.fundo, padding: `${5 * k}px ${10 * k}px`, borderRadius: px(es.selo.raio), boxShadow: `0 ${4 * k}px ${12 * k}px ${rgba(es.selo.sombra, 0.25)}` } }, mundo)
      s.textContent = '✓ ' + (e.tipo === 'escolhe' ? e.escolhida : e.texto)
      const [sx, sy] = aTela(e.ret.x + e.ret.w, e.ret.y)
      const r = rectOf(s)
      place(s, Math.min(sx - r.w, T0.x + T0.w - r.w - 6 * k), sy - r.h - 6 * k)
      return { s, e }
    })
    return (t, tc, sai) => {
      seq.set(Math.max(0, tc))
      let emAntes = false
      for (const { a, sq } of antes) {
        const vis = tc >= a.t && tc < a.t + a.dur
        sq.el.style.display = vis ? 'block' : 'none'
        if (vis) { sq.set(tc - a.t); emAntes = true }
      }
      // realce: no aponta (a duração dele) e antes de cada toque
      let rr = null, ra = 0
      for (const e of ev) {
        if (!e.ret || e.realce === false) continue
        if (e.tipo === 'aponta') { const a = P(tc, e.t, e.t + 0.25) * (1 - P(tc, e.t + e.dur, e.t + e.dur + 0.25)); if (a > ra) { ra = a; rr = e.ret } }
        if (e.tipo === 'toque') { const a = P(tc, e.t - 0.45, e.t - 0.25) * (1 - P(tc, e.t + 0.1, e.t + 0.35)); if (a > ra) { ra = a; rr = e.ret } }
        if (e.tipo === 'escolhe') { const a = P(tc, e.t - 0.1, e.t + 0.15) * (1 - P(tc, e.t1 + 0.4, e.t1 + 0.7)); if (a > ra) { ra = a; rr = e.ret } }
      }
      // no relance do antes a tela é a da versão anterior: nada de realce, indicador nem onda por cima dela
      if (emAntes) ra = 0
      realce(t, rr, ra)
      // indicador
      const [ix, iy] = aTela(...posEm(tc))
      let aperto = 1
      toques.forEach((q, i) => {
        const d = tc - q.t
        if (d > -0.12 && d < 0.2) aperto = Math.min(aperto, 1 - 0.18 * Math.sin(Math.PI * clamp((d + 0.12) / 0.32)))
        const o = ondas[i], a = P(d, 0, 0.42)
        if (d >= 0 && d < 0.42 && !emAntes) { const [ox, oy] = aTela(...q.ponto); o.setAttribute('cx', ox); o.setAttribute('cy', oy); o.setAttribute('r', (TOQUE ? R : 5 * k) * (1 + E.outCubic(a) * (TOQUE ? 1.1 : 2.2))); O(o, 0.85 * (1 - a)) } else O(o, 0)
      })
      for (const { q, r } of brilhos) {
        const d = tc - q.t, a = P(d, -0.08, 0.05) * (1 - P(d, 0.25, 0.85))
        if (a <= 0 || emAntes) { O(r, 0); continue }
        const g = 1 + 0.18 * E.outCubic(P(d, -0.08, 0.85)), [x, y] = aTela(q.ret.x - 6, q.ret.y - 6), w = (q.ret.w + 12) * k, h = (q.ret.h + 12) * k
        r.setAttribute('x', x); r.setAttribute('y', y); r.setAttribute('width', w); r.setAttribute('height', h)
        r.setAttribute('transform', `translate(${x + w / 2} ${y + h / 2}) scale(${g}) translate(${-(x + w / 2)} ${-(y + h / 2)})`)
        O(r, 0.85 * a)
      }
      const semIndicador = emAntes ? 0 : 1
      if (TOQUE) { dedo.setAttribute('cx', ix); dedo.setAttribute('cy', iy); dedo.setAttribute('r', R * aperto); O(ind, visDedo(tc) * (1 - sai) * semIndicador) }
      else { seta.setAttribute('transform', `translate(${ix} ${iy}) scale(${k * aperto})`); O(ind, P(tc, (moves[0] || { t: 0 }).t - 0.2, (moves[0] || { t: 0 }).t) * (1 - sai) * semIndicador) }
      for (const { s, e } of selos) {
        const a = E.outBack(P(tc, (e.t1 || e.t) - 0.05, (e.t1 || e.t) + 0.3)), b = P(tc, (e.t1 || e.t) + 1.9, (e.t1 || e.t) + 2.2)
        O(s, P(tc, (e.t1 || e.t) - 0.05, (e.t1 || e.t) + 0.1) * (1 - b)); T(s, `scale(${0.6 + 0.4 * a})`); s.style.transformOrigin = '100% 100%'
      }
    }
  }

  // ---------- realce: um tipo por estrutura (o contorno é o do desenho antigo) ----------
  // Devolve (t, ret, a): ret = retângulo do alvo em px CSS do app (ou null), a = intensidade 0→1.
  function realceDe(fx, RC) {
    const box = (rr, m = 5) => { const [x, y] = aTela(rr.x - m, rr.y - m); return { x, y, w: (rr.w + 2 * m) * k, h: (rr.h + 2 * m) * k } }
    const cresce = (b, g) => `translate(${b.x + b.w / 2} ${b.y + b.h / 2}) scale(${g}) translate(${-(b.x + b.w / 2)} ${-(b.y + b.h / 2)})`
    if (RC.tipo === 'contorno') {
      const realce = sv('rect', { fill: 'none', stroke: RC.cor, 'stroke-width': RC.espessura, rx: RC.raio * k }, fx)
      const halo = sv('rect', { fill: rgba(RC.cor, 0.1), stroke: 'none', rx: RC.raio * k }, fx)
      fx.insertBefore(halo, realce)
      return (t, rr, ra) => {
        if (rr) {
          const [x, y] = aTela(rr.x - 5, rr.y - 5), g = 1 + 0.04 * (1 - ra)
          for (const r of [realce, halo]) { r.setAttribute('x', x); r.setAttribute('y', y); r.setAttribute('width', (rr.w + 10) * k); r.setAttribute('height', (rr.h + 10) * k); r.setAttribute('transform', `translate(${x + ((rr.w + 10) * k) / 2} ${y + ((rr.h + 10) * k) / 2}) scale(${g}) translate(${-(x + ((rr.w + 10) * k) / 2)} ${-(y + ((rr.h + 10) * k) / 2)})`) }
        }
        O(realce, ra); O(halo, ra)
      }
    }
    if (RC.tipo === 'cantos') {
      // quatro cantos de visor: o alvo fica emoldurado sem nada passar por cima dele
      const p = sv('path', { fill: 'none', stroke: RC.cor, 'stroke-width': RC.espessura * k * 0.9, 'stroke-linecap': RC.raio > 0 ? 'round' : 'square', 'stroke-linejoin': RC.raio > 0 ? 'round' : 'miter' }, fx)
      return (t, rr, ra) => {
        if (rr) {
          const b = box(rr, 7), g = 1 + 0.12 * (1 - E.outCubic(ra)), c = Math.min(b.w, b.h) * 0.32
          const x0 = b.x, y0 = b.y, x1 = b.x + b.w, y1 = b.y + b.h
          p.setAttribute('d', `M${x0} ${y0 + c}V${y0}H${x0 + c}M${x1 - c} ${y0}H${x1}V${y0 + c}M${x1} ${y1 - c}V${y1}H${x1 - c}M${x0 + c} ${y1}H${x0}V${y1 - c}`)
          p.setAttribute('transform', cresce(b, g))
        }
        O(p, ra)
      }
    }
    if (RC.tipo === 'sublinhado') {
      // um traço que corre por baixo do alvo, da esquerda para a direita
      const r = sv('rect', { fill: RC.cor, rx: Math.min(RC.raio, RC.espessura) * k * 0.5 }, fx)
      return (t, rr, ra) => {
        if (rr) {
          const b = box(rr, 2), e = RC.espessura * k * 0.9
          r.setAttribute('x', b.x); r.setAttribute('y', b.y + b.h + 3 * k); r.setAttribute('width', Math.max(0.01, b.w * E.outCubic(ra))); r.setAttribute('height', e)
        }
        O(r, ra > 0.02 ? 1 : 0)
      }
    }
    if (RC.tipo === 'preenchido') {
      // marca-texto: o alvo ganha um fundo de cor por trás (multiplica, então o texto do app continua legível)
      const r = sv('rect', { fill: RC.cor, rx: RC.raio * k }, fx)
      r.style.mixBlendMode = 'multiply'
      return (t, rr, ra) => {
        if (rr) { const b = box(rr, 6); r.setAttribute('x', b.x); r.setAttribute('y', b.y); r.setAttribute('width', b.w); r.setAttribute('height', b.h); r.setAttribute('transform', cresce(b, 0.94 + 0.06 * E.outBack(ra))) }
        O(r, 0.34 * ra)
      }
    }
    // proprio: o gancho desenha no svg do mundo; recebe o alvo já em px do quadro
    const up = gancho('realce', { svg: fx, k, aTela, cor: RC.cor })
    return (t, rr, ra) => up(t, rr ? { ...box(rr, 5), a: ra } : null)
  }

  // ---------- gancho `proprio` (visual.js da série) ----------
  // VISUAL_PROPRIO.<elemento> = (ctx) => (t, …) => {}. ctx traz o lugar onde desenhar e as medidas; o gancho
  // desenha só dentro do que recebeu e devolve a função do tempo. Contrato completo: references/tutorial.md §13.
  function gancho(nome, extra) {
    const fn = typeof VISUAL_PROPRIO !== 'undefined' && VISUAL_PROPRIO[nome]
    if (typeof fn !== 'function') throw new Error(`visual.${nome} is "proprio", but visual.js does not define VISUAL_PROPRIO.${nome} = (ctx) => (t) => {}`)
    const up = fn({
      W, H, FMT, L, CX, CY, A, D, F, fim: FIM, toque: TOQUE,
      cores: V.cores, visual: V, area: areaSegura(),
      tela: { ...T0 }, legenda: { ...LAY.legenda }, livre: { ...LAY.livre },
      fontes: { titulo: FT, texto: FX, mono: FM }, ...extra,
    })
    return typeof up === 'function' ? up : () => {}
  }

  // um ponto do mundo (px do quadro em z = 1) no quadro, pela câmera do instante t
  const noQuadro = (x, y, t) => { const c = cam(t), s = cam.base * c.z; return [cam.opts.vw / 2 + (x - c.x) * s, cam.opts.vh / 2 + (y - c.y) * s, s] }
  const PARTES = { conteudoTela, gancho, marcarSe, C, V, ap, vp, TOQUE, A, D, F, FIM, FT, FX, FM, ev, passos, NP, LAY, T0, k, aTela, cam, noQuadro, telas, TU, ZMIN, PAINEL, CLIP_LIVRE, secoes }
  if (V) cenasNovas(PARTES)
  else cenasAntigas(PARTES)
}

/* ---------- voz: a legenda é a fala, com a palavra falada em destaque ----------
 * TU.voz = { destaque: { modo: 'cor' | 'marca', cor, tinta }, falas: [{ passo, palavras: [{ texto, ini, ate }] }] }, em
 * tempo do vídeo. Uma palavra por vez fica em destaque, de ini a ate (o fim dela, no mínimo 0,12 s para palavra curta
 * não piscar, nunca além da próxima: locucao.mjs). A cor sai da marca (acento); se não se lê sobre o fundo da
 * legenda, vira marca-texto (modo 'marca'). Só a cor muda, o texto não anda: a medida e a checagem da legenda valem.
 * Devolve a função do tempo, ou null se o passo não tem fala (aí a legenda é o texto de sempre). */
function falaNaLegenda(TU, tx, n, caixa = (s) => s) {
  const fala = TU.voz && TU.voz.falas.find((f) => f.passo === n)
  if (!fala) return null
  const D = TU.voz.destaque, ps = fala.palavras
  tx.textContent = ''
  const spans = ps.map((p, i) => { if (i) tx.appendChild(document.createTextNode(' ')); return el('span', { text: caixa(p.texto) }, tx) })
  const liga = D.modo === 'cor' ? { color: D.cor } : { color: D.tinta, background: D.cor, boxShadow: `0 0 0 0.08em ${D.cor}`, borderRadius: '0.12em' }
  const desliga = { color: '', background: '', boxShadow: '', borderRadius: '' }
  let atual = -1
  return (t) => {
    let k = -1
    for (let i = 0; i < ps.length; i++) if (t >= ps[i].ini && t < ps[i].ate) k = i
    if (k === atual) return
    if (atual >= 0) Object.assign(spans[atual].style, desliga)
    if (k >= 0) Object.assign(spans[k].style, liga)
    atual = k
  }
}

/* ======================================================================================================
 * Desenho antigo (série sem "versao"). Congelado: a folha de eventos tem de sair idêntica à do motor
 * original, pixel por pixel. Melhorias vão para cenasNovas.
 * ==================================================================================================== */
function cenasAntigas({ conteudoTela, marcarSe, C, TOQUE, A, D, FIM, FT, FX, passos, NP, LAY, T0, cam, telas, TU }) {
  // ---------- abertura ----------
  cena(0, A + 0.5, (root) => {
    root.style.background = C.fundo
    const w = el('div', { cls: 'layer' }, root)
    const bl = makeBlob(w, L({ '16x9': 720, '9x16': 760, padrao: 640 }), rgba(C.marca, 0.14))
    const b2 = makeBlob(w, 420, rgba(C.acento || C.marca, 0.12))
    const chip = el('div', { style: { position: 'absolute', font: `700 ${L({ '16x9': 30, padrao: 34 })}px ${FX}`, color: C.marca, background: rgba(C.marca, 0.1), padding: '12px 26px', borderRadius: '999px', whiteSpace: 'nowrap' } }, w)
    chip.textContent = TU.textos.rotulo
    const ls = bloco(w, TU.textos.tituloLinhas.map((t) => [{ t }]), { top: L({ '16x9': 470, '9x16': 800, padrao: 480 }), entrelinha: L({ '16x9': 124, '9x16': 132, padrao: 120 }), style: { font: `800 ${L({ '16x9': 112, '9x16': 100, padrao: 92 })}px ${FT}`, color: C.tinta, letterSpacing: '-0.02em' } })
    const r0 = rectOf(ls[0].line)
    place(chip, 0, r0.y - L({ '16x9': 110, padrao: 130 })); centrarX(chip)
    return (t) => {
      breathe(bl, t, W - 120, 140, spring(t, 1.3, 0.6), 8 * t, 0, 0)
      breathe(b2, t, 110, H - 140, spring(t - 0.15, 1.3, 0.6), -6 * t, 2, 1.1)
      O(chip, E.outCubic(P(t, 0.1, 0.45))); T(chip, `translateY(${(1 - E.outExpo(P(t, 0.1, 0.6))) * 30}px)`)
      riseWords(palavras(ls), t, 0.25, 0.07)
      // a abertura "mergulha" na tela: zoom-through no ponto onde a tela vai aparecer
      const z = Math.exp(Math.log(9) * E.inCubic(P(t, A - 0.45, A)))
      T(w, `translate(${CX}px,${CY}px) scale(${z}) translate(${-CX}px,${-CY}px)`); O(w, 1 - P(t, A - 0.12, A))
    }
  }, 'abertura')

  // ---------- tela real ----------
  cena(A - 0.45, A + D + 0.6, (root) => {
    const mundo = el('div', { cls: 'layer' }, root)
    // fundo da marca: papel + duas formas que respiram (ficam atrás da tela)
    const b1 = makeBlob(mundo, L({ '16x9': 900, padrao: 800 }), rgba(C.marca, 0.1))
    const b2 = makeBlob(mundo, 560, rgba(C.acento || C.marca, 0.09))
    const sombra = el('div', { style: { position: 'absolute', left: px(T0.x), top: px(T0.y), width: px(T0.w), height: px(T0.h), borderRadius: px(T0.r), boxShadow: `0 40px 90px ${rgba(C.tinta, 0.22)}, 0 8px 22px ${rgba(C.tinta, 0.12)}` } }, mundo)
    const moldura = el('div', { style: { position: 'absolute', left: px(T0.x - (TOQUE ? 14 : 0)), top: px(T0.y - (TOQUE ? 14 : 40)), width: px(T0.w + (TOQUE ? 28 : 0)), height: px(T0.h + (TOQUE ? 28 : 40)), borderRadius: px(T0.r + (TOQUE ? 14 : 4)), background: TOQUE ? '#101114' : '#fff', border: TOQUE ? 'none' : `1px solid ${rgba(C.tinta, 0.12)}` } }, mundo)
    if (!TOQUE) {
      // barra de janela do computer: três bolinhas
      for (let i = 0; i < 3; i++) el('div', { style: { position: 'absolute', left: px(18 + i * 24), top: '14px', width: '12px', height: '12px', borderRadius: '50%', background: ['#FF5F57', '#FEBC2E', '#28C840'][i] } }, moldura)
    }
    void sombra
    const conteudo = conteudoTela(mundo, {
      realce: { tipo: 'contorno', cor: C.marca, espessura: 3, raio: 12 },
      dedo: [rgba('#1B1B1F', 0.28), 'rgba(255,255,255,.95)'], seta: ['#1B1B1F', '#fff'], onda: TOQUE ? '#fff' : C.marca,
      selo: { fundo: C.marca, tinta: '#fff', sombra: C.tinta, raio: 999 },
    }, px(T0.r))
    return (t) => {
      const tc = t - A
      // até o corte a abertura ainda está mergulhando: a tela só ganha fundo quando a abertura sai
      root.style.background = t >= A - 0.12 ? C.fundo : 'transparent'
      breathe(b1, t, L({ '16x9': W - 60, padrao: W - 40 }), 120, 1, 6 * t, 1, 0.3)
      breathe(b2, t, 70, H - 90, 1, -5 * t, 3, 1.4)
      // entrada: a tela nasce de dentro da abertura (escala 0,86 → 1)
      const ent = E.outExpo(P(t, A - 0.2, A + 0.5)), sai = E.inOutCubic(P(t, A + D - 0.1, A + D + 0.55))
      aplicarCamera(mundo, cam, t)
      // troca de tela: a tela "respira" (recua 3,5% e volta em 0,45 s) no tempo do whoosh
      let resp = 0
      for (const e of telas) resp = Math.max(resp, Math.sin(Math.PI * P(tc, e.t + 0.05, e.t + 0.5)))
      const esc = lerp(0.86, 1, ent) * lerp(1, 0.9, sai) * (1 - 0.035 * resp)
      mundo.style.transform += ` translate(${CX}px,${CY}px) scale(${esc}) translate(${-CX}px,${-CY}px)`
      O(mundo, P(t, A - 0.14, A + 0.06) * (1 - P(t, A + D + 0.2, A + D + 0.55)))
      conteudo(t, tc, sai)
    }
  }, 'tela')

  // ---------- legendas (fora da câmera) ----------
  const G = LAY.legenda
  cena(A - 0.1, A + D + 0.35, (root) => {
    root.style.pointerEvents = 'none'
    const card = el('div', { style: { position: 'absolute', left: px(G.x), top: px(G.y), width: px(G.w), minHeight: px(L({ '9x16': 236, '16x9': 300, padrao: 200 })), background: '#fff', borderRadius: px(L({ '16x9': 26, padrao: 30 })), padding: L({ '16x9': '34px 34px 38px', padrao: '32px 40px 38px' }), boxSizing: 'border-box', boxShadow: `0 24px 60px ${rgba(C.tinta, 0.16)}`, transformOrigin: '50% 0%' } }, root)
    card.dataset.fv = 'legenda'
    const itens = passos.map((pa) => {
      const box = el('div', { style: { position: 'absolute', left: L({ '16x9': '34px', padrao: '40px' }), right: L({ '16x9': '34px', padrao: '40px' }), top: L({ '16x9': '34px', padrao: '32px' }) } }, card)
      const rot = el('div', { style: { display: 'flex', alignItems: 'center', gap: '12px', font: `700 ${L({ '16x9': 24, padrao: 30 })}px ${FX}`, color: C.marca, marginBottom: '14px' } }, box)
      rot.innerHTML = `<span style="width:${L({ '16x9': 12, padrao: 14 })}px;height:${L({ '16x9': 12, padrao: 14 })}px;border-radius:50%;background:${C.marca}"></span>${(TU.textos.passo || 'Step {n} of {N}').replace('{n}', pa.n).replace('{N}', NP)}`
      const tx = el('div', { style: { font: `700 ${L({ '16x9': 44, '9x16': 50, padrao: 46 })}px/1.16 ${FT}`, color: C.tinta, letterSpacing: '-0.01em' } }, box)
      const fala = falaNaLegenda(TU, tx, pa.n)
      if (!fala) tx.textContent = pa.legenda
      marcarSe(tx, 'legenda')
      return { box, tx, pa, fala }
    })
    // Legenda longa não vaza do cartão: a fonte encolhe (até 70%) até o passo caber na altura do cartão.
    // Mede uma vez, com as fontes carregadas; todo passo usa o mesmo cartão, então nada pula na virada.
    let medido = false
    const caber = () => {
      const cs = getComputedStyle(card)
      const livre = card.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom)
      for (const it of itens) {
        const d = it.box.style.display
        it.box.style.display = 'block'
        const base = parseFloat(getComputedStyle(it.tx).fontSize)
        for (let f = base; it.box.scrollHeight > livre && f > base * 0.7; f -= 2) it.tx.style.fontSize = px(f - 2)
        it.box.style.display = d
      }
      medido = true
    }
    return (t) => {
      if (!medido && (!document.fonts || document.fonts.status === 'loaded')) caber()
      for (const it of itens) if (it.fala) it.fala(t)
      const tc = t - A
      O(card, E.outCubic(P(t, A, A + 0.35)) * (1 - P(t, A + D, A + D + 0.3)))
      // virada de passo: o cartão vira no eixo X (0,5 s) e o texto novo nasce no verso
      let ativo = 0
      itens.forEach((it, i) => { if (tc >= it.pa.t - 0.25) ativo = i })
      const tv = itens[ativo] ? itens[ativo].pa.t : 0
      const f = ativo > 0 ? P(tc, tv - 0.25, tv + 0.25) : 1
      const ang = f < 1 ? (f < 0.5 ? -90 * E.inCubic(f * 2) : 90 * (1 - E.outCubic((f - 0.5) * 2))) : 0
      card.style.transform = `perspective(1400px) rotateX(${ang}deg)`
      itens.forEach((it, i) => { it.box.style.display = i === (f < 0.5 && ativo > 0 ? ativo - 1 : ativo) ? 'block' : 'none' })
    }
  }, 'legendas')

  // ---------- fechamento ----------
  cena(A + D + 0.2, FIM + 0.01, (root) => {
    root.style.background = C.marca
    const ls = bloco(root, TU.textos.fimLinhas.map((t) => [{ t }]), { top: L({ '16x9': 330, '9x16': 640, padrao: 380 }), entrelinha: L({ '16x9': 118, padrao: 124 }), style: { font: `800 ${L({ '16x9': 104, '9x16': 96, padrao: 88 })}px ${FT}`, color: '#fff', letterSpacing: '-0.02em' } })
    let logo = null
    if (MARCA.logo) {
      const vb = MARCA.logo.viewBox.split(/\s+/).map(Number), LH = L({ '16x9': 110, '9x16': 130, padrao: 110 }), LW = (LH * vb[2]) / vb[3]
      logo = sv('svg', { viewBox: MARCA.logo.viewBox, width: LW, height: LH }, root)
      Object.assign(logo.style, { position: 'absolute', left: px(CX - LW / 2), top: px(L({ '16x9': 700, '9x16': 1180, padrao: 760 })) })
      const g = sv('g', { transform: MARCA.logo.transform || '' }, logo)
      for (const pt of MARCA.logo.partes) sv('path', { d: pt.d, fill: MARCA.logo.negativo ? '#fff' : pt.fill }, g)
      marcarSe(logo, 'logo')
    }
    return (t) => {
      const t0 = A + D + 0.2
      iris(root, raioCobre(CX, CY) * E.inOutCubic(P(t, t0, t0 + 0.45)), CX, CY)
      riseWords(palavras(ls), t, t0 + 0.3, 0.08)
      if (logo) { O(logo, E.outCubic(P(t, t0 + 0.7, t0 + 1.0))); T(logo, `scale(${0.9 + 0.1 * E.outBack(P(t, t0 + 0.7, t0 + 1.1))})`); logo.style.transformOrigin = '50% 50%' }
    }
  }, 'fechamento')
}
