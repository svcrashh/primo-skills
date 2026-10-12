// Capítulo de exemplo. Copie a pasta, troque a duracao do video.js e escreva o palco.
// A moldura (fundo, cartão do índice, etiqueta, título, apoio, saída) vem do capitulo(); o seu trabalho é o palco.
cena(0, VIDEO.duracao, (root) => {
  const cap = capitulo(root, {
    n: 1, dur: VIDEO.duracao,
    titulo: [[{ t: 'New' }], [{ t: 'alerts', k: true }]],          // 2–3 palavras; quebre a linha antes de encolher
    apoio: [{ t: 'Choose what you want to get.', em: 2.6 }, { t: 'One tap turns it on.', em: 5.2 }],
  })
  const pal = cap.palco
  const ch = PALCO.h * 0.94
  const c = celular(pal, { x: (PALCO.w - 430 * ch / 900) / 2, y: (PALCO.h - ch) / 2, h: ch })
  el('div', { text: 'Alerts', style: { position: 'absolute', left: '28px', top: '96px', font: F.titulo(48), color: TOK.texto } }, c.tela)
  // três linhas, não trinta: só o que o capítulo conta
  const itens = ['New order', 'Message', 'Daily summary'].map((rot, i) => {
    const y = 190 + i * 120
    const linha = el('div', { cls: 'abs', style: { left: '20px', top: px(y), width: '350px', height: '100px', borderRadius: '18px', background: TOK.campo } }, c.tela)
    el('div', { text: rot, style: { position: 'absolute', left: '22px', top: '32px', font: F.texto(28, 500), color: TOK.texto } }, linha)
    const trilho = el('div', { cls: 'abs', style: { left: '262px', top: '30px', width: '68px', height: '40px', borderRadius: '20px', background: rgba(TOK.texto, 0.14) } }, linha)
    const bola = el('div', { cls: 'abs', style: { left: '4px', top: '4px', width: '32px', height: '32px', borderRadius: '50%', background: TOK.texto } }, trilho)
    return { linha, trilho, bola }
  })
  const tq = toque(c.tela)
  return (t) => {
    cap.update(t)
    sobe(c.el, t, ENTRA_PALCO, 80)
    itens.forEach((it, i) => sobe(it.linha, t, 1.5 + i * 0.15, 30))
    // antes → depois: o segundo aviso liga quando a voz diz "um toque liga"
    const liga = E.outExpo(P(t, 5.6, 6.0))
    tq(t, 5.5, 20 + 262 + 34, 190 + 120 + 30 + 20)
    T(itens[1].bola, `translateX(${28 * liga}px)`)
    itens[1].trilho.style.background = liga > 0.5 ? TOK.destaque : rgba(TOK.texto, 0.14)
    itens[1].linha.style.boxShadow = liga > 0.5 ? `0 0 0 2px ${TOK.destaque}` : 'none'
  }
})
