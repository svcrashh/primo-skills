// As cenas do exemplo de formato em que a câmera recua (example-pull-back.json): seis formatos de quadro, desenhados
// na proporção certa. Tela cheia: um quadro só, no meio, que muda de formato (os horizontais alargam com a mesma
// altura; o quadrado e os em pé crescem para cima com a mesma largura). A câmera guia: começa perto do primeiro formato,
// recua e deixa o quadro crescer à vista, sem parar. A troca de cena é um mergulho (zoom através): a câmera entra no quadro até a cor dele encher a
// tela, e a cena seguinte nasce dessa cor (corte seco no meio do mergulho, "transicao": "cut").
// Duas cores só, que se leem uma sobre a outra nos dois sentidos (o escuro e o claro da mesma família); o fecho é só
// o logo claro sobre o escuro. Nenhuma imagem além do logo: o texto fica dentro do quadro desenhado.
// O `bg` com `padding: 0` atrás de texto sobre cor é a cor de baixo: não aparece, e a checagem mede o contraste certo.

// o quadro do formato i (largura × altura em px de mundo): os horizontais com a altura `base`, os outros com a
// largura `base`
const medida = (f, base, fixa) => (fixa === 'altura' ? { w: (base * f.w) / f.h, h: base } : { w: base, h: (base * f.h) / f.w })
const mistura = (a, b, p) => a + (b - a) * p
const suave = (p) => (p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2)

// a pílula e os seis pontos (um por formato), presos à tela: desenhados antes da câmera, fora do zoom
function painel(s, d, prontos) {
  const A = s.livre
  const ps = 36, pad = 20
  const cor = s.dados.cores
  const p = s.text(d.pilula, {
    x: A.left + pad, align: 'left', valign: 'top', y: A.top + pad, size: ps, weight: 600,
    color: d.pilulaTexto, bg: d.pilulaFundo, padding: pad, radius: 999, at: d.hud, enter: 'fade', out: d.fim, outDur: 0.25,
  })
  const r = 13, passo = 42
  for (let i = 0; i < 6; i++) {
    const cheio = s.t >= prontos[i]
    s.draw({ x: A.right - r - (5 - i) * passo, y: p.y, at: d.hud, enter: 'fade', out: d.fim, outDur: 0.25 }, (ctx) => {
      ctx.fillStyle = cheio ? d.quadro : cor.vazio
      ctx.beginPath(); ctx.arc(0, 0, cheio ? r : r * 0.62, 0, Math.PI * 2); ctx.fill()
    })
  }
}

// uma cena de três formatos: o quadro que muda de medida, os rótulos que trocam, a câmera que recua e o mergulho
function formatos(s, d, primeiro) {
  const T = d.tempos   // quando cada formato entra
  const fixa = d.fixa
  const Y = s.H / 2 + 20
  const ms = d.formatos.map((f) => medida(f, d.base, fixa))
  // a medida do quadro agora: cada troca leva 0,7 s, suave
  let m = ms[0]
  for (let i = 1; i < ms.length; i++) {
    const p = suave(Math.min(1, Math.max(0, (s.t - T[i]) / 0.7)))
    if (p > 0) m = { w: mistura(m.w, ms[i].w, p), h: mistura(m.h, ms[i].h, p) }
  }
  const prontos = Array.from({ length: 6 }, (_, i) => (i < primeiro ? -1 : i < primeiro + 3 ? T[i - primeiro] + 0.35 : Infinity))
  s.bg(d.fundo)
  painel(s, d, prontos)
  // a câmera: começa perto do primeiro formato e recua até quase 1 enquanto ele está na tela; daí respira devagar e
  // deixa o quadro crescer à vista (a mesma altura, ou a mesma largura); no fim, mergulha no quadro
  const Z = d.zoom
  s.camera([
    { at: 0, zoom: Z[0], dur: 0.001 },
    { at: 0.001, zoom: Z[1], dur: T[1] - 0.001, ease: 'inOut' },
    { at: T[1], zoom: Z[2], dur: d.mergulho - T[1], ease: 'linear' },
    { at: d.mergulho, y: Y, zoom: d.mergulhoZoom, dur: s.dur - d.mergulho, ease: 'in' },
  ])
  s.draw({ x: s.cx, y: Y, at: 0.05, enter: 'pop', dur: 0.55, sfx: 'pop' }, (ctx) => {
    ctx.fillStyle = d.quadro
    ctx.beginPath(); ctx.roundRect(-m.w / 2, -m.h / 2, m.w, m.h, 40); ctx.fill()
  })
  // a guia tracejada onde o formato anterior acabava (a medida que não muda fica igual: só a outra cresce)
  for (let j = 0; j < ms.length - 1; j++) {
    s.draw({ x: s.cx, y: Y, at: T[j + 1] + 0.55, enter: 'fade', dur: 0.4, out: d.fim, outDur: 0.25 }, (ctx) => {
      ctx.strokeStyle = d.guia; ctx.lineWidth = 4; ctx.lineCap = 'round'; ctx.setLineDash([18, 14])
      ctx.beginPath()
      for (const k of [-1, 1]) {
        if (fixa === 'altura') { ctx.moveTo((k * ms[j].w) / 2, -m.h / 2 + 28); ctx.lineTo((k * ms[j].w) / 2, m.h / 2 - 28) }
        else { ctx.moveTo(-m.w / 2 + 28, (k * ms[j].h) / 2); ctx.lineTo(m.w / 2 - 28, (k * ms[j].h) / 2) }
      }
      ctx.stroke(); ctx.setLineDash([])
    })
  }
  d.formatos.forEach((f, i) => {
    const at = T[i] + 0.35
    const out = i < d.formatos.length - 1 ? T[i + 1] : d.fim
    const o = { at, out, outDur: 0.25, color: d.texto, bg: d.quadro, padding: 0, radius: 0 }
    s.text(f.nome, { ...o, x: s.cx, y: Y - 70, size: 170, font: 'display', weight: 700, lineHeight: 1, enter: 'rise', sfx: null })
    s.text(f.uso, { ...o, x: s.cx, y: Y + 62, size: 46, weight: 600, enter: 'rise', at: at + 0.1 })
    s.text(f.tamanho, { ...o, x: s.cx, y: Y + 124, size: 38, weight: 500, enter: 'rise', at: at + 0.18 })
    if (i > 0) s.sfx('blip', T[i] + 0.35, { gain: 0.5, passo: primeiro + i })
  })
  s.sfx('whoosh', d.mergulho + (s.dur - d.mergulho) * 0.6, { dur: s.dur - d.mergulho })
}

export default {
  // Os horizontais: 16:9, 19:9 e 21:9 com a mesma altura (1080), cada vez mais largos. Quadro claro no fundo escuro.
  horizontais(s) {
    formatos(s, s.dados.horizontais, 0)
  },

  // O quadrado e os em pé: 1:1, 4:5 e 9:16 com a mesma largura (1080), cada vez mais altos. A cena nasce da cor do
  // mergulho anterior (a clara), com o quadro escuro crescendo do meio.
  verticais(s) {
    formatos(s, s.dados.verticais, 3)
  },

  // Fecho: só o logo da marca, o claro sobre o escuro (a cor do mergulho), centrado e parado. É o padrão: frase ou
  // slogan só quando a marca tem um e a pessoa quer.
  fecho(s) {
    const d = s.dados.fecho
    s.bg(d.fundo)
    s.image(d.logo, { x: s.cx, y: s.cy, w: s.vertical ? s.W * 0.66 : 760, at: 0.05, enter: 'rise', radius: 0, shadow: false })
  },
}
