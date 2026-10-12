/* Modo cinema do tutorial ("cinema": "moldura" na série). A moldura do vídeo ganha 3D e motion; os
 * passos continuam de frente e legíveis. Roda no motor, depois do engine.js, do three.bundle.js e do kit3d.js; quem
 * chama é o desenho da série (drawing.js). Tudo é função do tempo, e o palco 3D desenha no fim de cada update.
 *   abertura      o celular 3D entra girando com a tela de sucesso, de perto (a letra do app no zoom de leitura), e uma
 *                 faixa de luz passa pelo vidro;
 *   pouso         a abertura sem título (visual.abertura.saida = "pouso"): o celular 3D entra com a tela do app e
 *                 assenta de frente exatamente onde o aparelho gravado vai estar. É a entrada de um vídeo em que quem
 *                 abre é uma pessoa: o aparelho chega por cima dela;
 *   troca         a cada passo, um brilho na cor da marca atravessa a tela; na troca de tela e em cada prova
 *                 (g.prova), a tela gira de leve;
 *   fechamento    o logo da marca em 3D se monta peça por peça, e uma luz passa por ele.
 * O painel 3D do computador (a tela num painel em CSS 3D que vem de longe, inclina, vira e recua) mora no drawing.js
 * (previaPainel e painelEm), porque usa a mesma moldura dos passos; daqui ele usa só a faixa de brilho (cinemaTroca).
 * Quando usar e quando não: references/tutorial.md, "Modo cinema".
 */

// unidades de mundo por px do quadro, para a câmera a d unidades do plano z = 0 (FOV vertical de 30°)
const _upx = (d) => (2 * d * Math.tan((15 * Math.PI) / 180)) / H

/**
 * Abertura: o celular 3D INTEIRO com o quadro da tela de sucesso (nunca uma faixa cortada da tela). caixa = onde o
 * aparelho mora no quadro (px). Devolve { atualizar(t), ret } — ret é o lugar do aparelho assentado, para a checagem de
 * colisão e de área segura (ela não enxerga dentro do canvas). O canvas é transparente: o fundo da série aparece atrás.
 */
function cinemaAbertura(camada, { src, caixa, corAparelho, corLuz, A, saida }) {
  const p3 = palco3d(camada, { fov: 30, fundo: null, corRecorte: corLuz, luzRecorte: 1.1, luzChave: 1.1 })
  p3.el.style.pointerEvents = 'none'
  const cel = celular3d({ tela: texturaImagem(src), cor: corAparelho, reflexo: 0.35, faixa: { largura: 0.11, forca: 0.32 }, verso: false })
  _faixaNaCor(cel, corLuz)
  // o aparelho (1 unidade de altura = 900 px de aparelho, 430 de largura) cabe na caixa com 6% de folga
  const ap = 430 / 900, hp = Math.min(caixa.h, caixa.w / ap) * 0.94
  const d = H / hp / (2 * Math.tan((15 * Math.PI) / 180)), u = _upx(d)
  p3.cam.position.set(0, 0, d)
  const bx = caixa.x + caixa.w / 2, by = caixa.y + caixa.h / 2
  const piv = new THREE.Group()
  piv.position.set((bx - W / 2) * u, -(by - H / 2) * u, 0)
  piv.add(cel.grupo)
  p3.add(piv)
  const base = piv.position.clone()
  // uma luz de verdade varre o aparelho da esquerda para a direita e acende o metal da borda
  const luz = luzQuePassa(p3, { w: 0.18, h: 2.4, intensidade: 14, alvo: [base.x, base.y, 0] })
  const wp = hp * ap
  return {
    ret: { x: bx - wp / 2, y: by - hp / 2, w: wp, h: hp },
    atualizar(t) {
      const e = E.outCubic(P(t, 0.1, 1.15))
      // entra de longe, girado de lado e de baixo, e assenta em três quartos (~22°), girando devagar até ~16°
      let ry = lerp(-1.35, -0.38, e) + 0.1 * E.inOutSine(P(t, 1.15, A))
      if (saida === 'deslizar') ry -= 0.6 * E.inCubic(P(t, A - 0.35, A + 0.1))
      piv.rotation.set(lerp(0.45, 0.08, e) - 0.03 * E.inOutSine(P(t, 1.15, A)), ry, lerp(-0.12, 0, e))
      piv.position.set(base.x + (1 - e) * 0.35, base.y - (1 - e) * 0.32, -(1 - e) * 1.6)
      cel.faixa.set(lerp(-0.3, 1.3, E.inOutSine(P(t, 0.75, 1.75))))
      luz.set(P(t, 0.55, 1.65), [base.x - 0.9, base.y + 0.4, 0.6], [base.x + 0.9, base.y - 0.2, 0.6])
      O(p3.el, E.outCubic(P(t, 0.06, 0.3)))
      // o foco é o título: o aparelho fica levemente desfocado, como numa lente de cinema (e a letra miúda do app não
      // soma com o plano geral da primeira tela)
      p3.el.style.filter = `blur(${lerp(3, 1.8, e).toFixed(2)}px)`
      p3.desenha()
    },
  }
}

// A faixa do kit soma luz branca: num app claro ela não aparece. Aqui ela vira um brilho na cor da marca, por cima da
// tela (a cor clareada pela metade e no máximo 22% de alfa: mais forte, vira uma mancha por cima do texto).
function _faixaNaCor(cel, corLuz) {
  const fm = cel.faixa.mesh.material, cl = new THREE.Color().setStyle(String(corLuz).trim()).lerp(new THREE.Color('#ffffff'), 0.5)
  fm.fragmentShader = fm.fragmentShader.replace('gl_FragColor = vec4(vec3(1.0, 0.97, 0.9) * a, 1.0);', `gl_FragColor = vec4(vec3(${cl.r.toFixed(4)}, ${cl.g.toFixed(4)}, ${cl.b.toFixed(4)}), min(a * 1.1, 0.22));`)
  fm.blending = THREE.NormalBlending; fm.needsUpdate = true
}

/**
 * Pouso: o celular 3D INTEIRO entra com a tela do app (src = o 1º quadro da gravação) e assenta de frente em `ret`, o
 * lugar do corpo do aparelho gravado no quadro (px). Sem título e sem painel: o fundo é o que estiver embaixo do
 * canvas (a pessoa do vídeo, ou o fundo da série). Em t ≥ A − 0,12 ele está de frente, parado e sem reflexo, igual ao
 * aparelho da moldura "aparelho": a troca de um pelo outro não aparece. Devolve (t) => void.
 */
function cinemaPouso(camada, { src, ret, corAparelho, corLuz, A }) {
  const p3 = palco3d(camada, { fov: 30, fundo: null, corRecorte: corLuz, luzRecorte: 1.1, luzChave: 1.1 })
  p3.el.style.pointerEvents = 'none'
  const cel = celular3d({ tela: texturaImagem(src), cor: corAparelho, reflexo: 0.4, faixa: { largura: 0.11, forca: 0.32 } })
  _faixaNaCor(cel, corLuz)
  // o reflexo do vidro some conforme o aparelho assenta: de frente, a tela tem a cor exata da gravação
  const vidros = []
  cel.corpo.traverse((m) => { if (m.material && m.material.blending === THREE.AdditiveBlending && m.material.isMeshStandardMaterial) vidros.push(m.material) })
  // 1 unidade = a altura do aparelho = ret.h px no quadro
  const d = H / ret.h / (2 * Math.tan((15 * Math.PI) / 180)), u = _upx(d)
  p3.cam.position.set(0, 0, d)
  const bx = ret.x + ret.w / 2, by = ret.y + ret.h / 2
  const piv = new THREE.Group()
  const base = new THREE.Vector3((bx - W / 2) * u, -(by - H / 2) * u, 0)
  piv.add(cel.grupo); p3.add(piv)
  // (mais fraca que a da abertura com título: de frente, a luz de 14 deixava um quarto da borda branco)
  const luz = luzQuePassa(p3, { w: 0.18, h: 2.4, intensidade: 7, alvo: [base.x, base.y, 0] })
  const T1 = A - 0.12
  return (t) => {
    // vem de baixo e de longe, de lado (~80°) e inclinado, e assenta de frente: gira mais devagar no fim
    const e = E.outCubic(P(t, 0.04, T1)), g = E.outQuart(P(t, 0.04, T1))
    piv.rotation.set(lerp(0.55, 0, g), lerp(-1.4, 0, g), lerp(-0.2, 0, g))
    piv.position.set(base.x + (1 - e) * 0.42, base.y - (1 - e) * 1.15, -(1 - e) * 2.4)
    cel.faixa.set(lerp(-0.3, 1.3, E.inOutSine(P(t, 0.35 * A, A + 0.25))))
    luz.set(P(t, 0.3 * A, T1), [base.x - 0.9, base.y + 0.4, 0.6], [base.x + 0.9, base.y - 0.2, 0.6])
    const r = 1 - E.inOutSine(P(t, 0.55 * A, T1))
    for (const m of vidros) { m.opacity = r; m.visible = r > 0.004 }
    O(p3.el, E.outCubic(P(t, 0.02, 0.14)))
    p3.desenha()
  }
}

/** O MARCA.logo do brand.js ({ viewBox, transform, partes: [{ d, fill, transform }] }) como texto SVG, para o logo3d. */
function svgDoLogo(logo, fillUnico) {
  const ps = logo.partes.map((p) => `<path d="${p.d}" fill="${fillUnico || p.fill || '#ffffff'}"${p.transform ? ` transform="${p.transform}"` : ''}/>`).join('')
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${logo.viewBox}"><g transform="${logo.transform || ''}">${ps}</g></svg>`
}

/**
 * Fechamento: o logo em 3D no lugar do logo plano (centro cx, cy e altura em px do quadro). Cada peça do SVG vem de
 * fora, girada, e assenta com um tremidinho; depois uma luz passa pelo chanfro. cor = um fill só (logo negativo) ou
 * null (as cores do SVG). Devolve (t) => void.
 */
function cinemaFechamento(camada, { logo, cx, cy, altura, cor, corLuz, t0 }) {
  const p3 = palco3d(camada, { fov: 30, fundo: null, corRecorte: corLuz, luzRecorte: 0.9, luzChave: 1.15 })
  p3.el.style.pointerEvents = 'none'
  const d = 4, u = _upx(d)
  p3.cam.position.set(0, 0, d)
  const al = altura * u
  const lg = logo3d(svgDoLogo(logo, cor), { altura: al, profundidade: al * 0.22, chanfro: al * 0.025 })
  lg.grupo.position.set((cx - W / 2) * u, -(cy - H / 2) * u, 0)
  p3.add(lg)
  const kl = lg.grupo.children[0].scale.x
  const R = rng(17)
  const voo = lg.pecas.map((pc, i) => {
    const dir = pc.base.clone(); if (dir.length() < 1e-6) dir.set(0, -1, 0)
    dir.normalize()
    return { dir, giro: [(R() - 0.5) * 2.6, (R() - 0.5) * 2.6, (R() - 0.5) * 1.2], chega: t0 + 0.55 + i * 0.07 }
  })
  const luz = luzQuePassa(p3, { w: al * 0.5, h: al * 6, intensidade: 16, alvo: [lg.grupo.position.x, lg.grupo.position.y, 0] })
  const lw = lg.largura
  return (t) => {
    lg.pecas.forEach((pc, i) => {
      const v = voo[i], k = P(t, v.chega - 0.6, v.chega), f = 1 - E.outCubic(k)
      pc.pivo.position.set(pc.base.x + (v.dir.x * 0.9 * al * f) / kl, pc.base.y + (v.dir.y * 0.9 * al * f) / kl, pc.base.z + (1.6 * al * f) / kl)
      pc.pivo.rotation.set(v.giro[0] * f, v.giro[1] * f, v.giro[2] * f)
      const sq = wob(t - v.chega, 3.2, 7) * 0.06
      pc.pivo.scale.set(Math.max(0.0001, (1 + sq) * E.outCubic(P(t, v.chega - 0.6, v.chega - 0.3))), 1 - sq, 1)
    })
    // o conjunto termina de girar até ficar de frente e respira devagar
    const fim = voo.length ? voo[voo.length - 1].chega : t0 + 0.6
    // montado, o logo balança devagar no eixo vertical (o fecho nunca fica um cartão chapado parado)
    const vivo = E.inOutSine(P(t, fim + 0.3, fim + 1.3))
    lg.grupo.rotation.set(0.05 * Math.sin((t - t0) * 0.9) * vivo, lerp(0.5, 0, E.outCubic(P(t, t0 + 0.3, fim + 0.5))) + (0.07 * Math.sin((t - fim) * 0.85) + 0.025 * Math.sin((t - fim) * 2.3 + 1)) * vivo, 0)
    // e a câmera se aproxima sem parar, 0,8% por segundo depois de assentar. Um seno lento sozinho quase para perto do
    // pico, e no 9:16, com o logo menor, o refino via 1,7 s de quadro parado no fecho;
    // o segundo seno, de outra frequência, não para junto. Com 2% por segundo o logo crescia ~7% e saía da área segura.
    p3.cam.position.z = d * (1 - 0.008 * Math.max(0, t - fim))
    const x0 = lg.grupo.position.x, y0 = lg.grupo.position.y
    luz.set(P(t, fim + 0.1, fim + 1.1), [x0 - lw * 1.4, y0 + al, al * 2], [x0 + lw * 1.4, y0 - al * 0.5, al * 2])
    p3.desenha()
  }
}

/**
 * Motion da troca, na tela gravada. passos, telas e provas: os eventos (t no relógio da tela, sem a abertura). camada = um
 * layer por cima do mundo, dentro do recorte da tela (ou, com dentro: true, a própria caixa da tela gravada, no painel do
 * computador). Devolve { brilho(tc), giro(tc) } — giro dá o ângulo em graus.
 */
function cinemaTroca(camada, { passos, telas, cor, provas = [], dentro = false }) {
  // dentro: a faixa cobre só a camada que recebeu (a tela do painel), não o quadro inteiro
  const faixa = el('div', { cls: dentro ? '' : 'layer', style: { pointerEvents: 'none', backgroundRepeat: 'no-repeat', backgroundSize: '320% 100%', ...(dentro ? { position: 'absolute', left: '0', top: '0', width: '100%', height: '100%' } : {}),
    backgroundImage: `linear-gradient(112deg, transparent 0%, transparent 44%, ${rgba(cor, 0.0)} 45%, ${rgba(cor, 0.2)} 49%, ${rgba('#ffffff', 0.32)} 50%, ${rgba(cor, 0.2)} 51%, ${rgba(cor, 0.0)} 55%, transparent 56%, transparent 100%)` } }, camada)
  // em cada prova (g.prova) o brilho também atravessa e a tela gira de leve, como na troca de tela
  const trocas = [...passos.slice(1).map((p) => p.t), ...provas.map((p) => p.t + 0.1)]
  const giros = [...telas, ...provas].sort((a, b) => a.t - b.t)
  return {
    brilho(tc) {
      let p = -1
      for (const t of trocas) if (tc >= t - 0.15 && tc <= t + 0.5) p = P(tc, t - 0.15, t + 0.5)
      O(faixa, p < 0 ? 0 : 1)
      if (p >= 0) faixa.style.backgroundPosition = `${lerp(115, -15, E.inOutSine(p)).toFixed(2)}% 0`
    },
    giro(tc) {
      let a = 0
      giros.forEach((e, i) => { const s = Math.sin(Math.PI * P(tc, e.t + 0.02, e.t + 0.55)); if (s > 0) a = (i % 2 ? -1 : 1) * 6 * s })
      return a
    },
  }
}
