// As cenas do exemplo de formato (example.json): capa numa cor da marca com o símbolo gigante recortado, conteúdo
// em fundo claro com a pílula, cartões chapados de canto arredondado com o símbolo no canto e o fecho só com o logo.
// Texto, cores e arquivos vêm de `s.dados` e da marca do JSON; aqui só o desenho. Logo, símbolo e ícones são as
// imagens da marca (no exemplo, os marcadores de assets/example), sempre na proporção delas (só `w` ou só `h`): nada
// distorce, nada é recolorido.
// O `bg` com `padding: 0` atrás de texto sobre cor é a cor de baixo: não aparece, e a checagem mede o contraste certo.

const empilha = (s) => s.H >= s.W
// A câmera respira (zoom lento) para nenhum trecho ficar parado; ela é a primeira coisa da cena.
const respira = (s, z, parado = 0) => s.camera([{ at: 0, zoom: z, dur: s.dur - parado, ease: 'linear' }])
// A área que continua dentro da área segura com a câmera em zoom `z` (o zoom empurra as bordas para fora), com 12 px
// de folga: o OCR do refino lê a caixa do texto um pouco maior que o desenho.
const segura = (s, z) => {
  const S = s.livre, f = 12
  const left = s.cx - (s.cx - S.left) / z + f, right = s.cx + (S.right - s.cx) / z - f
  const top = s.cy - (s.cy - S.top) / z + f, bottom = s.cy + (S.bottom - s.cy) / z - f
  return { left, right, top, bottom, w: right - left, h: bottom - top }
}
// a imagem da marca cabendo numa caixa `lado`×`lado`, sem mudar a proporção
const cabe = (s, src, lado) => {
  const img = s.engine.image(src)
  return img.naturalWidth >= img.naturalHeight ? { w: lado } : { h: lado }
}
// a altura que a imagem tem com a largura `w` (o logo do canto encosta no topo da área, qualquer que seja a proporção)
const altura = (s, src, w) => {
  const img = s.engine.image(src)
  return (w * img.naturalHeight) / img.naturalWidth
}
const giro = (s, at, dur = 0.9) => { const p = Math.min(1, Math.max(0, (s.t - at) / dur)); return 360 * (p < 0.5 ? 4 * p ** 3 : 1 - (-2 * p + 2) ** 3 / 2) }

export default {
  // Capa: a cor da marca, o símbolo gigante e recortado, girando devagar; o logo no canto; o título grande (o par
  // de cores da capa só precisa servir para título grande).
  capa(s) {
    const d = s.dados.capa
    const vert = empilha(s)
    s.bg(d.fundo)
    const Z = 1.04
    respira(s, Z)
    const A = segura(s, Z)
    const sw = vert ? s.W * 1.2 : s.H * 1.3
    s.image(d.simbolo, {
      x: vert ? s.W * 0.86 : s.W * 0.87, y: vert ? s.H * 0.8 : s.H * 0.56, w: sw,
      at: 0, enter: 'zoom', dur: 1.2, sfx: null, rotate: -10 + 16 * (s.t / s.dur), radius: 0, shadow: false,
    })
    const ww = vert ? 300 : 250
    s.image(d.wordmark, { x: A.left + ww / 2, y: A.top + altura(s, d.wordmark, ww) / 2, w: ww, at: 0.15, enter: 'fade', radius: 0, shadow: false })
    s.title(d.titulo, {
      x: A.left, align: 'left', y: vert ? A.top + A.h * 0.34 : A.top + A.h * 0.55,
      size: vert ? 176 : 196, lineHeight: 0.9, color: d.texto, maxWidth: vert ? A.w : A.w * 0.5,
      enter: 'words', at: 0.35, bg: d.fundo, padding: 0, radius: 0,
    })
  },

  // Conteúdo: a pílula, o título com a palavra-chave na cor de destaque, o apoio, e um cartão chapado por peça
  // entrando no tempo, cada um com o ícone num ladrilho claro e o símbolo no canto, que gira quando todos chegaram.
  // O bloco inteiro fica centrado na altura.
  pecas(s) {
    const d = s.dados.pecas
    const vert = empilha(s)
    s.bg(d.fundo)
    const Z = 1.03
    respira(s, Z)
    const A = segura(s, Z)
    const n = d.itens.length
    const ps = vert ? 58 : 36
    const pad = ps * 0.55
    const tam = { titulo: vert ? 112 : 124, apoio: vert ? 46 : 44, rotulo: vert ? 76 : 76 }
    const gap = vert ? 28 : 40
    const vaos = [vert ? 50 : 40, vert ? 32 : 26, vert ? 56 : 54]
    // no 16:9 o bloco (pílula, título de uma linha, apoio, cartões) fica centrado na altura; no vertical ele começa no
    // topo da área e os cartões crescem até o fim dela
    const bloco = ps * 1.24 + pad * 2 + tam.titulo * 0.95 + tam.apoio * 1.24 + 440 + vaos.reduce((a, b) => a + b, 0)
    const y0 = vert ? A.top : A.top + Math.max(0, (A.h - bloco) / 2)
    const pill = s.text(d.pilula, {
      x: A.left + pad, align: 'left', valign: 'top', y: y0 + pad, size: ps, weight: 600,
      color: d.pilulaTexto, bg: d.pilulaFundo, padding: pad, radius: 999, at: 0.1, enter: 'fade',
    })
    const t = s.title(d.titulo, {
      x: A.left, align: 'left', valign: 'top', y: pill.bottom + vaos[0],
      size: tam.titulo, lineHeight: 0.95, color: d.texto, maxWidth: A.w,
      enter: 'words', at: 0.1,
    })
    const ap = s.text(d.apoio, {
      x: A.left, align: 'left', valign: 'top', y: t.bottom + vaos[1],
      size: tam.apoio, weight: 500, color: d.texto, maxWidth: A.w, at: 0.55, enter: 'rise',
    })
    const topo = ap.bottom + vaos[2]
    const ch = vert ? Math.min(300, (A.bottom - topo - (n - 1) * gap) / n) : 440   // no vertical, até o fim da área
    const cw = vert ? A.w : (A.w - gap * (n - 1)) / n
    const T = vert ? 150 : 168                 // o ladrilho do ícone
    const m = vert ? 40 : 40                   // a margem dentro do cartão
    d.itens.forEach((it, i) => {
      const at = 0.9 + i * 0.45   // os cartões chegam logo: a cena nunca fica só com a pílula
      const x0 = vert ? A.left : A.left + i * (cw + gap)
      const yc = vert ? topo + i * (ch + gap) : topo
      const rise = { at, enter: 'rise', dur: 0.5 }
      s.draw({ x: x0 + cw / 2, y: yc + ch / 2, ...rise, sfx: 'pop' }, (ctx) => {
        ctx.fillStyle = it.cor
        ctx.beginPath(); ctx.roundRect(-cw / 2, -ch / 2, cw, ch, 44); ctx.fill()
      })
      const tx = x0 + m + T / 2, ty = vert ? yc + ch / 2 : yc + m + T / 2
      s.draw({ x: tx, y: ty, ...rise }, (ctx) => {
        ctx.fillStyle = d.fundo
        ctx.beginPath(); ctx.roundRect(-T / 2, -T / 2, T, T, 30); ctx.fill()
      })
      s.image(it.icone, { x: tx, y: ty, ...cabe(s, it.icone, T * 0.66), ...rise, radius: 0, shadow: false })
      // o símbolo no canto gira uma vez, um cartão depois do outro, quando os três já chegaram
      const ss = vert ? 72 : 68
      const gira = 3.3 + i * 0.35
      s.image(it.simbolo, { x: x0 + cw - m - ss / 2, y: yc + m + ss / 2, w: ss, ...rise, rotate: giro(s, gira), radius: 0, shadow: false })
      s.sfx('blip', gira, { gain: 0.5, passo: i })
      s.text(it.rotulo, {
        x: vert ? tx + T / 2 + 40 : x0 + m, align: 'left', valign: vert ? 'middle' : 'bottom',
        y: vert ? ty : yc + ch - m, size: tam.rotulo, font: 'display', weight: 700,
        color: it.texto, bg: it.cor, padding: 0, radius: 0, ...rise,
      })
    })
  },

  // Fecho: só o logo da marca (o que lê bem no fundo do fecho), centrado, com respiro. É o padrão: frase ou slogan
  // só quando a marca tem um e a pessoa quer. A câmera para 1,5 s antes do fim.
  fecho(s) {
    const d = s.dados.fecho
    const vert = empilha(s)
    s.bg(d.fundo)
    const Z = 1.03
    respira(s, Z, 1.5)
    const A = segura(s, Z)
    const lw = vert ? A.w * 0.72 : 760
    s.image(d.logo, { x: s.cx, y: s.cy, w: lw, at: 0.05, enter: 'rise', radius: 0, shadow: false })   // logo cedo: o fecho nunca abre vazio
  },
}
