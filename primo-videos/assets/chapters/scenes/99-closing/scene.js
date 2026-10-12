// Fecho: o índice completo (cada item ganha o check), os números grandes (só se houver números verdadeiros) e o logo
// parado ≥ 1,5 s, com o slogan do produto. Sem NUMEROS, o logo entra logo depois do índice.
cena(0, VIDEO.duracao, (root) => {
  fundo(root)
  const A = el('div', { cls: 'layer' }, root), B = el('div', { cls: 'layer' }, root), C = el('div', { cls: 'layer' }, root)
  const cards = listaIndice(A, L({ '16x9': { x: 360 * KX, y: 110, w: 1200 * KX, h: 860 }, '9x16': { x: 90, y: 270, w: 840, h: 1180 } }))
  const checks = cards.map((c) => el('div', { text: '✓', style: { position: 'absolute', right: '24px', top: '50%', transform: 'translateY(-50%)', font: F.texto(L({ '16x9': 34, '9x16': 44 }), 700), color: TOK.ok, opacity: 0 } }, c))
  const temNumeros = NUMEROS.length > 0
  const grade = el('div', { cls: 'layer', style: { display: 'flex', flexDirection: VERTICAL ? 'column' : 'row', alignItems: 'center', justifyContent: 'center', gap: VERTICAL ? '90px' : `${160 * KX}px` } }, B)
  const nums = NUMEROS.map((nu) => {
    const box = el('div', { style: { textAlign: 'center' } }, grade)
    const v = el('div', { text: String(nu.valor), style: { font: F.titulo(L({ '16x9': 220, '9x16': 260 })), color: TOK.destaque, lineHeight: '1', transform: INCLINA } }, box)
    el('div', { text: nu.rotulo.toUpperCase(), style: { font: F.mono(L({ '16x9': 30, '9x16': 38 })), color: TOK.texto, letterSpacing: '.24em', marginTop: '14px' } }, box)
    return { box, v, nu }
  })
  const lg = logo(C, { px: L({ '16x9': 180, '9x16': 190 }) })
  const slogan = SLOGAN ? textLine(C, [{ t: SLOGAN }], { font: F.texto(L({ '16x9': 44, '9x16': 52 }), 700), color: TOK.texto }) : null
  const end = textLine(C, [{ t: ENDERECO }], { font: F.mono(L({ '16x9': 34, '9x16': 42 })), color: TOK.destaque, letterSpacing: '.12em' })
  const cent = (l, y) => place(l.line, (W - rectOf(l.line).w) / 2, y)
  // o bloco da marca fica centrado no quadro (no 9:16, alto demais deixa o terço de baixo vazio)
  cent(lg, CY - L({ '16x9': 130, '9x16': 120 })); if (slogan) cent(slogan, CY + L({ '16x9': 80, '9x16': 110 })); cent(end, CY + L({ '16x9': 160, '9x16': 210 }))
  const passoC = Math.min(0.2, 2.2 / INDICE.length)
  const tLogo = temNumeros ? 6.3 : 3.4
  return (t) => {
    O(A, E.outExpo(P(t, 0, 0.6)) * (1 - P(t, 3.0, 3.4)))
    checks.forEach((c, i) => O(c, P(t, 0.6 + i * passoC, 0.8 + i * passoC)))
    if (temNumeros) {
      O(B, P(t, 3.6, 3.9) * (1 - P(t, 6.0, 6.3)))
      nums.forEach((n, i) => { sobe(n.box, t, 3.6 + i * 0.25, 40); conta(n.v, t, 3.7 + i * 0.25, 5.2 + i * 0.25, 0, n.nu.valor) })
    } else O(B, 0)
    O(C, P(t, tLogo, tLogo + 0.3))
    riseWords(lg.words, t, tLogo, 0.05, 0.7)
    if (slogan) riseWords(slogan.words, t, tLogo + 0.4, 0.06, 0.5)
    riseWords(end.words, t, tLogo + 0.8, 0.05, 0.5)
  }
})
