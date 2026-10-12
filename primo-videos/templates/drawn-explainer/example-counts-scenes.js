// As cenas do exemplo de formato dos números que contam (example-counts.json): quatro números de um produto.
// Leiaute dividido: o painel na cor forte à esquerda com o número que conta (texto claro) e, à direita, sobre o tom
// claro da mesma família, as peças correndo de lado (travelling). Entre as cenas, o empurrão ("transicao": "push").
// Abertura com as formas empilhadas em tons da mesma família e o símbolo claro no losango de cima; fecho só com o
// logo claro sobre a cor do painel.
// Texto nunca sobre imagem: todo texto fica no painel; as peças ficam do outro lado. Ícones, ilustração, fotos e
// símbolo são as imagens da marca (no exemplo, os marcadores de assets/example) na proporção delas (só `w` ou só `h`,
// ou recorte `cover` da foto), sem recolorir.
// O `bg` com `padding: 0` atrás de texto sobre cor é a cor de baixo: não aparece, e a checagem mede o contraste certo.

const divisa = (s) => Math.round(s.W * 0.45)
// a margem do texto: a área segura mais 16 px, porque o OCR do refino lê a caixa do texto um pouco maior que o desenho
const margem = (s) => s.livre.left + 16
// o travelling: a parede de peças anda `v` px/s para a esquerda, a cena inteira (e segue andando durante o empurrão)
const corre = (s, v) => -v * s.t
const cabe = (s, src, lado) => {
  const img = s.engine.image(src)
  return img.naturalWidth >= img.naturalHeight ? { w: lado } : { h: lado }
}
// a altura que a imagem tem com a largura `w` (o logo do canto encosta no topo da área, qualquer que seja a proporção)
const altura = (s, src, w) => {
  const img = s.engine.image(src)
  return (w * img.naturalHeight) / img.naturalWidth
}
const caixa = (ctx, cor, w, h, r) => { ctx.fillStyle = cor; ctx.beginPath(); ctx.roundRect(-w / 2, -h / 2, w, h, r); ctx.fill() }

// o painel da esquerda, por cima da parede (as peças passam por baixo dele); `abre` faz ele entrar da borda
function painel(s, cor, abre) {
  const X = divisa(s)
  const w = abre === undefined ? X : X * s.p(abre, 0.6, 'out')
  if (w > 0) s.draw({ x: w / 2, y: s.H / 2 }, (ctx) => { ctx.fillStyle = cor; ctx.fillRect(-w / 2, -s.H / 2, w, s.H) })
}

// o número da peça: a pílula no topo, o número que conta, o rótulo e o apoio, no painel
function numero(s, d, C) {
  const A = s.livre
  const L = margem(s)
  const larg = divisa(s) - L - 56
  const ps = 36, pad = 20
  s.text(s.dados.pilula, {
    x: L + pad, align: 'left', valign: 'top', y: A.top + pad, size: ps, weight: 600,
    color: C.pilulaTexto, bg: C.pilulaFundo, padding: pad, radius: 999, at: 0.1, enter: 'fade',
  })
  const tam = { numero: 280, rotulo: 88, apoio: 44 }
  const y0 = s.H * 0.55 - (tam.numero + 12 + tam.rotulo * 1.05 + 28 + tam.apoio * 1.24) / 2
  const n = s.number(d.numero, {
    x: L, align: 'left', valign: 'top', y: y0, size: tam.numero, lineHeight: 1, weight: 700,
    color: C.texto, bg: C.painel, padding: 0, radius: 0, at: 0.3, dur: 0.8,
  })
  const r = s.text(d.rotulo, {
    x: L, align: 'left', valign: 'top', y: n.y + n.h / 2 + 12, size: tam.rotulo, lineHeight: 1.05, font: 'display', weight: 700,
    color: C.texto, bg: C.painel, padding: 0, radius: 0, maxWidth: larg, at: 0.45, enter: 'rise',
  })
  s.text(d.apoio, {
    x: L, align: 'left', valign: 'top', y: r.y + r.h / 2 + 28, size: tam.apoio, weight: 500,
    color: C.texto, bg: C.painel, padding: 0, radius: 0, maxWidth: larg, at: 0.7, enter: 'rise',
  })
}

// um losango de canto arredondado (o quadrado girado 45°), cheio ou só contorno
function losango(ctx, lado, raio, cor, contorno) {
  ctx.rotate(Math.PI / 4)
  ctx.beginPath(); ctx.roundRect(-lado / 2, -lado / 2, lado, lado, raio)
  if (contorno) { ctx.strokeStyle = cor; ctx.lineWidth = 5; ctx.stroke() } else { ctx.fillStyle = cor; ctx.fill() }
}

// as miniaturas de página: só forma e cor, sem texto (o esqueleto de seis leiautes)
function miniatura(ctx, v, w, h, P) {
  const r = 18
  const barra = (x0, y0, x1, alt, cor) => { ctx.fillStyle = cor; ctx.beginPath(); ctx.roundRect(-w / 2 + w * x0, -h / 2 + h * y0, w * (x1 - x0), h * alt, h * alt / 2); ctx.fill() }
  const fundo = [P.claro, P.neutro, P.neutro, P.neutro, P.base, P.escuro][v]
  caixa(ctx, fundo, w, h, r)
  if (v === 0) { barra(0.08, 0.36, 0.62, 0.12, P.medio); barra(0.08, 0.54, 0.44, 0.12, P.medio) }
  if (v === 1) {
    barra(0.07, 0.12, 0.24, 0.09, P.base)
    barra(0.07, 0.3, 0.64, 0.11, P.escuro); barra(0.07, 0.45, 0.5, 0.11, P.escuro)
    for (const [i, x1] of [0.55, 0.5, 0.42].entries()) barra(0.07, 0.66 + i * 0.09, x1, 0.045, P.claro)
  }
  if (v === 2) {
    ctx.fillStyle = P.base; ctx.beginPath(); ctx.roundRect(w * 0.06, -h / 2, w * 0.44, h, [0, r, r, 0]); ctx.fill()
    barra(0.07, 0.3, 0.46, 0.11, P.escuro); barra(0.07, 0.45, 0.38, 0.11, P.escuro)
    barra(0.07, 0.68, 0.42, 0.045, P.claro); barra(0.07, 0.77, 0.36, 0.045, P.claro)
  }
  if (v === 3) {
    barra(0.07, 0.12, 0.5, 0.11, P.escuro)
    for (let c = 0; c < 4; c++) {
      const x0 = 0.07 + c * 0.225
      barra(x0, 0.42, x0 + 0.07, 0.07, P.base)
      for (let k = 0; k < 3; k++) barra(x0, 0.56 + k * 0.08, x0 + 0.17 - k * 0.025, 0.04, P.claro)
    }
  }
  if (v === 4) { barra(0.1, 0.28, 0.52, 0.26, P.escuro); barra(0.1, 0.64, 0.6, 0.06, P.escuro) }
  if (v === 5) {
    barra(0.07, 0.14, 0.52, 0.11, P.neutro)
    for (let k = 0; k < 2; k++) { ctx.fillStyle = P.medio; ctx.beginPath(); ctx.roundRect(-w / 2 + w * 0.07, -h / 2 + h * (0.44 + k * 0.26), w * 0.86, h * 0.2, 10); ctx.fill() }
  }
}

export default {
  // Abertura: o painel com o logo e o título; do outro lado, os losangos que caem empilhados, o de cima na cor do
  // painel com o símbolo claro girando devagar.
  abertura(s) {
    const d = s.dados.abertura
    const C = s.dados.cores
    const A = s.livre
    const X = divisa(s)
    s.bg(C.fundo)
    const cx = X + (s.W - X) / 2
    const lado = 280, passo = 120
    const tons = [C.painel, C.formas[0], C.formas[1], C.painel]
    // os losangos caem de cima, um depois do outro (o de baixo primeiro), e assentam com um quique
    const queda = (at) => -320 * (1 - s.p(at, 0.6, 'outBack'))
    for (let i = 3; i >= 0; i--) {
      const at = 0.1 + (3 - i) * 0.12
      const y = s.H / 2 - 1.5 * passo + i * passo + queda(at)
      s.draw({ x: cx, y, at, enter: 'fade', dur: 0.2, sfx: i === 3 || i === 0 ? 'pop' : null }, (ctx) => losango(ctx, lado, 56, tons[i], i === 3))
    }
    s.image(d.simbolo, { x: cx, y: s.H / 2 - 1.5 * passo + queda(0.46), w: 150, at: 0.46, enter: 'fade', dur: 0.2, sfx: null, rotate: 24 * s.t, radius: 0, shadow: false })
    painel(s, C.painel, 0)
    const L = margem(s)
    const ww = 230
    s.image(d.wordmark, { x: L + ww / 2, y: A.top + altura(s, d.wordmark, ww) / 2, w: ww, at: 0.3, enter: 'fade', radius: 0, shadow: false })
    const t = s.title(d.titulo, {
      x: L, align: 'left', valign: 'top', y: s.H * 0.36, size: 116, lineHeight: 0.95, color: C.texto,
      maxWidth: X - L - 48, enter: 'words', at: 0.35, bg: C.painel, padding: 0, radius: 0,
    })
    s.text(d.apoio, {
      x: L, align: 'left', valign: 'top', y: t.y + t.h / 2 + 36, size: 44, weight: 500, color: C.texto,
      maxWidth: X - L - 48, at: 0.8, enter: 'rise', bg: C.painel, padding: 0, radius: 0,
    })
  },

  // Ícones: a parede de ladrilhos claros com os ícones da marca (um arquivo por peça).
  icones(s) {
    const d = s.dados.icones
    const C = s.dados.cores
    s.bg(C.fundo)
    const X = divisa(s)
    const T = 168, G = 26, R = 4
    const cols = Math.ceil(d.pecas.length / R)
    const y0 = (s.H - (R * T + (R - 1) * G)) / 2 + T / 2
    const dx = corre(s, 110)
    d.pecas.forEach((src, i) => {
      const r = Math.floor(i / cols), c = i % cols
      const x = X + 64 + T / 2 + c * (T + G) + dx, y = y0 + r * (T + G)
      const o = { at: 0.12 + c * 0.045 + r * 0.03, enter: 'pop', dur: 0.4, sfx: i === 0 || i === cols + 3 ? 'pop' : null }
      s.draw({ x, y, ...o }, (ctx) => caixa(ctx, C.ladrilho, T, T, 34))
      s.image(src, { x, y, ...cabe(s, src, T * 0.62), ...o, sfx: null, radius: 0, shadow: false })
    })
    painel(s, C.painel)
    numero(s, d, C)
  },

  // Ilustração: uma só na cena, num cartão claro que corre de lado, com losangos no tom claro atrás andando mais
  // devagar (a paralaxe do travelling).
  ilustracoes(s) {
    const d = s.dados.ilustracoes
    const C = s.dados.cores
    s.bg(C.fundo)
    const X = divisa(s)
    const cx = X + (s.W - X) / 2
    const lento = corre(s, 55)
    for (const [i, [fx, fy, l]] of [[0.22, 0.24, 150], [0.86, 0.3, 120], [0.62, 0.82, 170], [1.12, 0.72, 140]].entries()) {
      s.draw({ x: X + (s.W - X) * fx + lento, y: s.H * fy, at: 0.05 + i * 0.06, enter: 'fade', dur: 0.4 }, (ctx) => losango(ctx, l, 30, C.formas[1], false))
    }
    const x = cx + 150 + corre(s, 110)
    s.draw({ x, y: s.H / 2, at: 0.12, enter: 'rise', dur: 0.5, sfx: 'pop' }, (ctx) => caixa(ctx, C.ladrilho, 600, 640, 48))
    s.image(d.peca, { x, y: s.H / 2, ...cabe(s, d.peca, 540), at: 0.3, enter: 'pop', dur: 0.45, sfx: null, radius: 0, shadow: false })
    painel(s, C.painel)
    numero(s, d, C)
  },

  // Fotos: a fileira de fotos da marca, em pé e de canto arredondado, correndo de lado.
  fotos(s) {
    const d = s.dados.fotos
    const C = s.dados.cores
    s.bg(C.fundo)
    const X = divisa(s)
    const w = 400, h = 560, G = 28
    const dx = corre(s, 110)
    d.pecas.forEach((src, i) => {
      s.image(src, { x: X + 64 + w / 2 + i * (w + G) + dx, y: s.H / 2, w, h, fit: 'cover', radius: 36, shadow: false, at: 0.12 + i * 0.08, enter: 'rise', dur: 0.5, sfx: i === 0 ? 'pop' : null })
    })
    painel(s, C.painel)
    numero(s, d, C)
  },

  // Leiautes de página: a parede de miniaturas desenhadas (só forma e cor, seis leiautes), correndo de lado.
  slides(s) {
    const d = s.dados.slides
    const C = s.dados.cores
    s.bg(C.fundo)
    const X = divisa(s)
    const w = 320, h = 180, G = 26, R = 3, cols = 7
    const y0 = (s.H - (R * h + (R - 1) * G)) / 2 + h / 2
    const dx = corre(s, 110)
    const P = { neutro: C.ladrilho, medio: C.painel, base: C.formas[0], claro: C.formas[1], escuro: C.escuro }
    for (let r = 0; r < R; r++) for (let c = 0; c < cols; c++) {
      const v = (c * 2 + r * 3) % 6
      s.draw({ x: X + 64 + w / 2 + c * (w + G) + dx, y: y0 + r * (h + G), at: 0.12 + c * 0.05 + r * 0.04, enter: 'pop', dur: 0.4, sfx: r === 0 && c % 3 === 0 ? 'pop' : null }, (ctx) => miniatura(ctx, v, w, h, P))
    }
    painel(s, C.painel)
    numero(s, d, C)
  },

  // Fecho: só o logo da marca, o claro sobre a cor do painel, centrado e parado. Ele entra depois do empurrão. É o
  // padrão: frase ou slogan só quando a marca tem um e a pessoa quer.
  fecho(s) {
    const d = s.dados.fecho
    s.bg(d.fundo)
    s.image(d.logo, { x: s.cx, y: s.cy, w: s.vertical ? s.W * 0.66 : 760, at: 0.55, enter: 'rise', radius: 0, shadow: false })
  },
}
