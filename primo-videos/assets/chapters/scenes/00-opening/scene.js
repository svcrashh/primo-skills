// Abertura: logo, a palavra do vídeo e o índice numerado, que se preenche item a item.
// INDICE_EM: quando o índice começa a entrar. Com voz, ponha no tempo da palavra que chama ("Vem ver"@3.5).
// No 9:16 a marca começa no centro do quadro e sobe quando o índice entra: sem isso a metade de baixo fica vazia
// enquanto a voz fala a primeira frase.
const INDICE_EM = 1.4
cena(0, VIDEO.duracao, (root) => {
  fundo(root)
  const conteudo = el('div', { cls: 'layer' }, root)
  const hero = el('div', { cls: 'layer' }, conteudo)
  const lg = logo(hero, { px: L({ '16x9': 64, '9x16': 80 }) })
  place(lg.line, LAY.tx, L({ '16x9': 330, '9x16': 270 }))
  const titulo = textLine(hero, [{ t: "WHAT'S NEW", style: { color: TOK.destaque } }], { font: F.titulo(L({ '16x9': 150, '9x16': 170 })), color: TOK.texto, transform: INCLINA })
  place(titulo.line, LAY.tx, L({ '16x9': 420, '9x16': 380 }))
  const sub = textLine(hero, [{ t: 'What changed, in ' + INDICE.length + ' items.' }], { font: F.texto(LAY.apoioPx), color: TOK.apoio })
  place(sub.line, LAY.tx, L({ '16x9': 600, '9x16': 580 }))
  // 16:9 (e 19:9, 21:9, esticado por KX): a lista à direita; 9:16: embaixo, ocupando a metade de baixo
  const cards = listaIndice(conteudo, L({ '16x9': { x: 1000 * KX, y: 110, w: 760 * KX, h: 860 }, '9x16': { x: 90, y: 680, w: 840, h: 770 } }))
  const desce = VERTICAL ? 400 : 0
  return (t) => {
    T(hero, `translateY(${desce * (1 - E.inOutCubic(P(t, INDICE_EM - 0.2, INDICE_EM + 0.45)))}px)`)
    riseWords(lg.words, t, 0.1, 0.05, 0.5)
    riseWords(titulo.words, t, 0.35, 0.05, 0.7)
    riseWords(sub.words, t, 0.8, 0.03, 0.5)
    const passoT = Math.min(0.3, 3.2 / INDICE.length)
    // os cartões só entram quando a marca já subiu: antes disso o primeiro cobria o subtítulo
    cards.forEach((c, i) => sobe(c, t, INDICE_EM + (VERTICAL ? 0.35 : 0) + i * passoT, 30))
    const s = E.inCubic(P(t, VIDEO.duracao - SAIDA, VIDEO.duracao - 0.05))
    T(conteudo, `translateY(${-30 * s}px)`); O(conteudo, 1 - s)
  }
})
