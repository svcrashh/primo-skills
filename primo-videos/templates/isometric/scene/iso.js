/* Molde isometrico: blocos modelados em 3D (WebGL, three.js) com câmera ortográfica isométrica, que se empilham em
 * camadas, com o rótulo de cada camada ao lado, fora dos blocos, ligado por um fio. Cada bloco é uma caixa de cantos
 * arredondados e cada face tem UMA cor chapada da marca (topo, frente, lado), exatamente o hex do JSON: sem luz, sombra,
 * gradiente, borda nem chão. No arredondado a cor troca seca pela face dominante, então a pilha lê como cor da marca
 * com silhueta 3D. A câmera orbita devagar (ou sobe com a pilha); cada camada cai já sólida, pousa com um amassadinho e
 * assenta, e o rótulo entra. Nenhuma marca aqui dentro: cores, fonte, logo e textos vêm de PARAMS; os tempos, do
 * plan.js (PLANO). Fecho só com o logo.
 * Ordem: quadro 0 (a chamada e a base já caindo) → cada camada cai, pousa e é nomeada → a pilha inteira girando →
 * transição → fecho. */
const M = PARAMS.marca
// "chao", "chaoAlfa" e "fantasma" (o chão e a camada translúcida de antes) são aceitos no JSON e ignorados
const C = { apoio: M.cores.texto, ...M.cores }
const PESO = { rotulo: 700, detalhe: 500, chamada: 600, ...(M.pesos || {}) }
const fnt = (tam, peso) => `${peso} ${tam}px "${M.fonte}"`
const LINHA_ALFA = M.linhaAlfa ?? 0.85
const AREA = areaSegura()
const ESQ = PLANO.rotulos === 'esquerda'
const DOLLY = PLANO.camera === 'dolly-3d'
const RET = !HORIZONTAL
const EXPLODIDO = PARAMS.explodido ?? RET
const CAM = PLANO.camadas
const NC = CAM.length
const RAIO = 0.13      // o arredondado: fração do menor lado do bloco
const SEG = 8          // segmentos de cada arredondado (liso de perto)
const DENS = 2         // o WebGL desenha em 2× e o quadro reduz: com o MSAA, a borda sai lisa

const Z = L({
  '16x9': { rot: 50, det: 34, cham: 40 },
  '9x16': { rot: 48, det: 38, cham: 44 },
  '1x1': { rot: 40, det: 30, cham: 36 },
  padrao: { rot: 42, det: 32, cham: 38 },
})
const temCham = !!PARAMS.chamada
const topoCham = L({ '9x16': AREA.y0 + 12, padrao: AREA.y0 + 16 })
const ZONA = { x0: AREA.x0, x1: AREA.x1, y0: temCham ? topoCham + Z.cham * 2 + 24 : AREA.y0, y1: AREA.y1 }
// a pilha de um lado, os rótulos do outro
const AW = AREA.x1 - AREA.x0
const FRAC = PARAMS.pilha ?? L({ '9x16': 0.5, '1x1': 0.5, padrao: 0.54 })
const REG = ESQ ? { x0: AREA.x1 - AW * FRAC, x1: AREA.x1 } : { x0: AREA.x0, x1: AREA.x0 + AW * FRAC }
REG.y0 = ZONA.y0 + 30; REG.y1 = AREA.y1 - 20
REG.w = REG.x1 - REG.x0; REG.h = REG.y1 - REG.y0; REG.cx = (REG.x0 + REG.x1) / 2; REG.cy = (REG.y0 + REG.y1) / 2
const VAO = L({ '9x16': 50, padrao: 80 })                      // da pilha ao texto
const COL = ESQ ? { x0: AREA.x0, x1: REG.x0 - VAO } : { x0: REG.x1 + VAO, x1: AREA.x1 }
COL.w = COL.x1 - COL.x0

const _cv = document.createElement('canvas').getContext('2d')
const largura = (s, font) => { _cv.font = font; return _cv.measureText(s).width }
/** Quebra o texto no menor número de linhas que cabe em w, com as linhas equilibradas. */
function quebrar(texto, font, w) {
  const ps = String(texto).split(/\s+/)
  const gulosa = (lim) => { const out = []; let cur = ''; for (const p of ps) { const n = cur ? cur + ' ' + p : p; if (largura(n, font) > lim && cur) { out.push(cur); cur = p } else cur = n } if (cur) out.push(cur); return out }
  const base = gulosa(w)
  if (base.length < 2) return base
  let lim = w, melhor = base
  while (lim > 40) { lim -= 8; const q = gulosa(lim); if (q.length > base.length) break; melhor = q }
  return melhor
}
// a cor de cada face vai crua para o shader (0–1, sem conversão de espaço de cor): sai no quadro o hex exato
const rgb01 = (h) => hex2rgb(h).map((v) => v / 255)

// ---------- a pilha, em unidades da base (1 = o lado da camada de baixo; y para baixo, z para quem olha) ----------
// explodida: as camadas se afastam. No 9:16 e no 4:5 bem mais (a altura sobra): na órbita, mais que a profundidade
// da face de cima, senão a camada parece encostada na de baixo; no dolly a câmera chega perto e 0,8 já separa
const VAO_Y = !EXPLODIDO ? 0.07 : VERTICAL ? (DOLLY ? 0.8 : 1.3) : 0.28
let acum = 0
const GEO = CAM.map((c) => {
  const h = 0.2 * c.altura, g = { w: c.largura, d: c.largura, h, base: acum }
  acum += h + VAO_Y
  g.yc = -(g.base + h / 2)                      // centro (y para baixo)
  return g
})
const ALTURA = acum - VAO_Y
const Y_CENTRO = -ALTURA / 2
// os blocos de cada camada, lado a lado numa grade (a última linha incompleta fica centrada), com um vão pequeno
const BLOCOS = GEO.map((g, i) => {
  const n = CAM[i].partes, cols = Math.ceil(Math.sqrt(n)), rows = Math.ceil(n / cols), vao = 0.05
  const pw = (g.w - (cols - 1) * vao) / cols, pd = (g.d - (rows - 1) * vao) / rows
  const bs = []
  for (let p = 0; p < n; p++) {
    const r = Math.floor(p / cols), naLinha = Math.min(cols, n - r * cols), cIdx = p - r * cols
    bs.push({ x: (cIdx - (naLinha - 1) / 2) * (pw + vao), z: (r - (rows - 1) / 2) * (pd + vao) })
  }
  return { pw, pd, r: RAIO * Math.min(pw, pd, g.h), bs }
})

// ---------- câmera: giro (em volta do eixo vertical), inclinação, zoom e o ponto que ela olha ----------
const G0 = PARAMS.giro ? PARAMS.giro[0] : ESQ ? 72 : 18, G1 = PARAMS.giro ? PARAMS.giro[1] : ESQ ? 20 : 70
const INCL = PARAMS.inclinacao ?? 30
const FIM = PLANO.fimMontagem
// o giro não freia até parar: anda um pouco mais rápido no meio e, no fim, a pilha inteira ainda gira devagar até o corte
const giro = (u) => 0.6 * u + 0.4 * E.inOutSine(clamp(u))
// dolly: depois de cada camada pousar, a câmera enquadra a parte já montada (sobe e se afasta junto com a pilha)
const ESTADOS = GEO.map((g) => {
  const topo = g.base + g.h
  return { ay: -topo / 2, z: Math.min(1.8, (ALTURA + 0.9) / (topo + 0.9)) }
})
function cam(t) {
  const u = (t + 0.4) / (FIM + 0.8)
  if (!DOLLY) return { g: lerp(G0, G1, giro(u)), incl: INCL, z: lerp(0.97, 1.03, P(t, 0, FIM)), ay: Y_CENTRO }
  let s = ESTADOS[0]
  for (let k = 1; k < NC; k++) {
    const e = E.inOutCubic(P(t, CAM[k].entra, CAM[k].pousa + 0.35))
    if (e <= 0) break
    s = { ay: lerp(s.ay, ESTADOS[k].ay, e), z: Math.exp(lerp(Math.log(s.z), Math.log(ESTADOS[k].z), e)) }
  }
  const pt = E.inOutSine(P(t, 0, FIM))
  return { g: lerp(PARAMS.giro ? G0 : ESQ ? 50 : 40, PARAMS.giro ? G1 : ESQ ? 36 : 54, giro(u)) + 2.5 * Math.sin(t * 0.9), incl: lerp(PARAMS.inclinacao ?? 14, 34, pt), z: s.z, ay: s.ay }
}
/** Projeção ortográfica de um ponto da pilha (unidades) com a câmera cs. A câmera do WebGL usa esta mesma conta
 *  (matrizDaCamera), então o fio e o rótulo ficam presos ao bloco desenhado. */
function projetar(x, y, z, cs, k = ESC, ox = OX, oy = OY) {
  const g = (cs.g * Math.PI) / 180, i = (cs.incl * Math.PI) / 180
  const yy = y - cs.ay
  const x1 = x * Math.cos(g) + z * Math.sin(g), z1 = -x * Math.sin(g) + z * Math.cos(g)
  const y2 = yy * Math.cos(i) + z1 * Math.sin(i)
  return { x: ox + cs.z * k * x1, y: oy + cs.z * k * y2 }
}
const cantos = (g, y) => [[-g.w / 2, -g.d / 2], [g.w / 2, -g.d / 2], [g.w / 2, g.d / 2], [-g.w / 2, g.d / 2]].map(([x, z]) => [x, y, z])
// a escala (px por unidade) e o centro: a pilha inteira cabe na região em toda pose do fim da montagem (e da órbita)
const AJUSTE = (() => {
  const tempos = DOLLY ? [FIM - 0.6, FIM, PLANO.dur] : Array.from({ length: 17 }, (_, k) => (k / 16) * PLANO.dur)
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity
  for (const t of tempos) {
    const cs = { ...cam(t), z: 1 }
    for (const g of GEO) for (const yy of [-g.base, -(g.base + g.h)]) for (const p of cantos(g, yy)) {
      const q = projetar(...p, cs, 1, 0, 0)
      x0 = Math.min(x0, q.x); x1 = Math.max(x1, q.x); y0 = Math.min(y0, q.y); y1 = Math.max(y1, q.y)
    }
  }
  const esc = Math.min(REG.w / (x1 - x0), REG.h / (y1 - y0)) * 0.9
  return { ESC: esc, OX: REG.cx - ((x0 + x1) / 2) * esc, OY: REG.cy - ((y0 + y1) / 2) * esc, tempos }
})()
const ESC = AJUSTE.ESC, OY = AJUSTE.OY
let OX = AJUSTE.OX

// ---------- o movimento de cada camada: cai já sólida, pousa, amassa um pouco e assenta ----------
let QUEDA = GEO.map(() => 1)         // quanto cada camada cai (unidades); o palco acerta para ela vir de fora do quadro
function pose(i, t) {
  const c = CAM[i]
  const off = (1 - E.inQuad(P(t, c.entra, c.pousa))) * QUEDA[i]
  const sy = 1 - 0.2 * wob(t - c.pousa, 1.7, 5.5)        // ~9% de amassado no pouso, uma sobra de 2% e assenta
  return { off, sy, sxz: 1 / Math.sqrt(sy) }             // o volume fica: amassa em y, alarga em x e z
}
// um ponto da camada (x, z da grade; a = altura acima do pé da camada) na pose do instante
const naPose = (i, ps, x, a, z) => [x * ps.sxz, -(GEO[i].base + ps.off) - a * ps.sy, z * ps.sxz]
/** Onde o fio encosta na camada: o ponto da silhueta arredondada mais para o lado dos rótulos, na meia altura. */
function ancora(i, cs, ps) {
  const g = GEO[i], b = BLOCOS[i], gr = (cs.g * Math.PI) / 180, lado = ESQ ? -1 : 1
  const dx = lado * Math.cos(gr) * b.r, dz = lado * Math.sin(gr) * b.r
  let melhor = null
  for (const q of b.bs) for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const p = projetar(...naPose(i, ps, q.x + sx * (b.pw / 2 - b.r) + dx, g.h / 2, q.z + sz * (b.pd / 2 - b.r) + dz), cs)
    if (!melhor || (ESQ ? p.x < melhor.x : p.x > melhor.x)) melhor = p
  }
  return melhor
}
const PARADA = { off: 0, sy: 1, sxz: 1 }

// ---------- o palco WebGL ----------
// Caixa de cantos arredondados (RoundedBoxGeometry) com a face de cada triângulo: 0 = topo, 1 = frente, 2 = lado. A
// geometria já separa as faces na diagonal de 45° do arredondado, e é ali que a cor troca (o MSAA alisa a troca).
function caixaArredondada(w, h, d, r) {
  const geo = new THREE.RoundedBoxGeometry(w, h, d, SEG, r)
  const n = geo.attributes.position.count, porFace = n / 6, face = new Float32Array(n), nor = geo.attributes.normal.array
  // a ordem da BoxGeometry: +x, -x, +y, -y, +z, -z. Com y para baixo, -y é o topo; +z, a frente; ±x e -z, o lado.
  // A base (+y) só aparece na metade de baixo do arredondado, com a câmera baixa: fica com a cor do lado de onde ela
  // vira (com a cor do topo, uma linha clara correria pela aresta de baixo, como uma borda)
  for (let tri = 0; tri < n / 3; tri++) {
    const f = Math.floor((tri * 3) / porFace)
    let v = f === 3 ? 0 : f === 4 ? 1 : 2
    if (f === 2) {
      let nx = 0, nz = 0
      for (let k = 0; k < 3; k++) { nx += nor[(tri * 3 + k) * 3]; nz += nor[(tri * 3 + k) * 3 + 2] }
      v = nz > 0 && nz >= Math.abs(nx) ? 1 : 2
    }
    face[tri * 3] = face[tri * 3 + 1] = face[tri * 3 + 2] = v
  }
  geo.setAttribute('face', new THREE.BufferAttribute(face, 1))
  geo.deleteAttribute('normal'); geo.deleteAttribute('uv')
  return geo
}
const SHADER = {
  vertexShader: 'attribute float face;\nvarying float vFace;\nvoid main() {\n  vFace = face;\n  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);\n}',
  // cor chapada, sem luz nem tom: o hex do JSON sai igual no quadro
  fragmentShader: 'uniform vec3 topo;\nuniform vec3 frente;\nuniform vec3 lado;\nvarying float vFace;\nvoid main() {\n  gl_FragColor = vec4(vFace < 0.5 ? topo : vFace < 1.5 ? frente : lado, 1.0);\n}',
}

// ---------- a cena da pilha (no modo "aparelho", quem monta a cena é o device.js; o fecho é este mesmo) ----------
let PONTO_FECHO = { x: REG.cx, y: REG.cy }
if (PLANO.modo !== 'aparelho') cena(0, PLANO.fecho.em + PLANO.durTr + (PLANO.durTr ? 0 : 0.0001), (root) => {
  const camA = camada(root, C.fundo)
  const palco = el('div', { cls: 'abs' }, camA)        // o canvas do WebGL (criado depois que o grupo se centra)
  const sondas = el('div', { cls: 'abs' }, camA)       // as faces invisíveis para a checagem de quadros

  // ---- rótulos (fora dos blocos), com o fio até a camada ----
  const cima = el('div', { cls: 'layer' }, camA)
  const fios = svgQuadro(cima)
  const fR = fnt(Z.rot, PESO.rotulo), fD = fnt(Z.det, PESO.detalhe)
  const rotulos = CAM.map((c) => {
    const lr = quebrar(c.rotulo, fR, COL.w), ld = c.detalhe ? quebrar(c.detalhe, fD, COL.w) : []
    const linhas = [...lr.map((s) => ({ s, f: fR, tam: Z.rot, cor: C.texto, lh: Z.rot * 1.1 })), ...ld.map((s, k) => ({ s, f: fD, tam: Z.det, cor: C.apoio, lh: Z.det * 1.24, gap: k === 0 ? 8 : 0 }))]
    let h = 0
    for (const l of linhas) { l.dy = h + (l.gap || 0); h = l.dy + l.lh; l.w = largura(l.s, l.f); l.el = textLine(cima, [{ t: l.s }], { font: l.f, color: l.cor }) }
    const fio = sv('line', { stroke: C.linha, 'stroke-width': L({ '9x16': 4, padrao: 3 }), 'stroke-linecap': 'round', opacity: 0 }, fios)
    const ponto = sv('circle', { r: L({ '9x16': 8, padrao: 7 }), fill: C.linha, opacity: 0 }, fios)
    return { c, linhas, h, fio, ponto }
  })
  // a pilha e os rótulos como um grupo só, centrado na largura (a pilha alta e estreita não fica num canto)
  {
    const lw = Math.max(...rotulos.flatMap((r) => r.linhas.map((l) => l.w)))
    let sx0 = Infinity, sx1 = -Infinity
    for (const t of AJUSTE.tempos) {
      const cs = { ...cam(t), z: 1 }
      for (const g of GEO) for (const yy of [-g.base, -(g.base + g.h)]) for (const p of cantos(g, yy)) { const q = projetar(...p, cs); sx0 = Math.min(sx0, q.x); sx1 = Math.max(sx1, q.x) }
    }
    const sw = sx1 - sx0, grupo = lw + VAO + sw, gx0 = (AREA.x0 + AREA.x1) / 2 - grupo / 2
    const alvo = ESQ ? gx0 + lw + VAO + sw / 2 : gx0 + sw / 2
    OX += alvo - (sx0 + sx1) / 2
    if (ESQ) COL.x1 = alvo - sw / 2 - VAO; else COL.x0 = alvo + sw / 2 + VAO
    // o dolly chega perto, mas a pilha não pode empurrar os rótulos para fora da área segura: o zoom fica até onde a
    // folga do lado dos rótulos deixa
    const zMax = Math.max(1, 1 + (0.8 * 2 * Math.max(0, gx0 - AREA.x0)) / sw)   // 0,8: a pose do começo é mais baixa e larga
    for (const e of ESTADOS) e.z = Math.min(e.z, zMax)
  }
  // cada camada cai de fora do quadro: começa com o ponto mais baixo logo acima da borda de cima, e a queda inteira
  // aparece (a base começa antes do quadro 0, que já a mostra perto do lugar)
  QUEDA = GEO.map((g, i) => {
    const cs = cam(CAM[i].entra), s = cs.z * ESC * Math.cos((cs.incl * Math.PI) / 180)
    const baixo = Math.max(...cantos(g, -g.base).map((p) => projetar(...p, cs).y))
    return Math.max(0.6, (baixo + 24) / s)
  })
  // o canvas cobre só a faixa da largura por onde a pilha passa (com folga para o amassado), na altura toda
  let bx0 = Infinity, bx1 = -Infinity
  for (let k = 0; k <= 240; k++) {
    const cs = cam((k / 240) * PLANO.dur)
    for (const g of GEO) for (const p of cantos(g, 0)) { const q = projetar(...p, cs); bx0 = Math.min(bx0, q.x); bx1 = Math.max(bx1, q.x) }
  }
  const folga = 0.08 * (bx1 - bx0) + 16
  const cx0 = Math.max(0, Math.floor(bx0 - folga)), cw = Math.min(W, Math.ceil(bx1 + folga)) - cx0
  const canvas = el('canvas', { cls: 'abs', style: { left: px(cx0), top: '0px', width: px(cw), height: px(H) } }, palco)
  const gl3 = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, premultipliedAlpha: true, preserveDrawingBuffer: true, powerPreference: 'high-performance' })
  gl3.setPixelRatio(DENS); gl3.setSize(cw, H, false); gl3.setClearColor(0x000000, 0)
  gl3.toneMapping = THREE.NoToneMapping
  const cena3 = new THREE.Scene()
  const cam3 = new THREE.Camera()
  // a matriz da câmera é a conta do projetar(), levada para as coordenadas do canvas (e a profundidade para o z-buffer)
  const matrizDaCamera = (cs) => {
    const s = cs.z * ESC, g = (cs.g * Math.PI) / 180, i = (cs.incl * Math.PI) / 180, D = 20000
    const cg = Math.cos(g), sg = Math.sin(g), ci = Math.cos(i), si = Math.sin(i)
    cam3.projectionMatrix.set(
      (2 * s * cg) / cw, 0, (2 * s * sg) / cw, (2 * (OX - cx0)) / cw - 1,
      (2 * s * sg * si) / H, (-2 * s * ci) / H, (-2 * s * cg * si) / H, 1 - (2 * (OY - s * cs.ay * ci)) / H,
      (s * sg * ci) / D, (s * si) / D, (-s * cg * ci) / D, (-s * cs.ay * si) / D,
      0, 0, 0, 1)
    cam3.projectionMatrixInverse.copy(cam3.projectionMatrix).invert()
  }
  const camadas3 = CAM.map((c, i) => {
    const g = GEO[i], b = BLOCOS[i]
    const cor = { topo: new THREE.Vector3(), frente: new THREE.Vector3(), lado: new THREE.Vector3() }
    const mat = new THREE.ShaderMaterial({ ...SHADER, uniforms: { topo: { value: cor.topo }, frente: { value: cor.frente }, lado: { value: cor.lado } }, side: THREE.DoubleSide })
    const geo = caixaArredondada(b.pw, g.h, b.pd, b.r)
    const grupo = new THREE.Group()                       // a origem é o pé da camada: amassa a partir do chão dela
    for (const q of b.bs) { const m = new THREE.Mesh(geo, mat); m.position.set(q.x, -g.h / 2, q.z); m.frustumCulled = false; grupo.add(m) }
    cena3.add(grupo)
    // as faces de cada bloco para a checagem (como as faces em CSS de antes): topo e os quatro lados
    const faces = b.bs.map(() => [[2, 3, 6, 7], [4, 5, 6, 7], [0, 1, 2, 3], [1, 3, 5, 7], [0, 2, 4, 6]].map((idx) => {
      const f = marcarImagem(el('div', { cls: 'abs', style: { display: 'none' } }, sondas), `layer "${c.rotulo}"`)
      return { f, idx }
    }))
    return { c, g, b, grupo, cor, faces, pousada: false }
  })
  const destaque = PARAMS.destaque || null
  const corDe = (tripla) => ({ topo: rgb01(tripla.topo), frente: rgb01(tripla.frente), lado: rgb01(tripla.lado) })
  const CORES = CAM.map((c) => corDe(c.cor)), DEST = destaque ? corDe(destaque) : null

  let cham = null
  if (temCham) {
    const comPilula = !!C.chamadaFundo
    cham = el('div', { cls: 'abs', text: PARAMS.chamada, style: { font: fnt(Z.cham, PESO.chamada), color: comPilula ? C.chamadaTexto || C.texto : C.texto, whiteSpace: 'nowrap',
      ...(comPilula ? { background: C.chamadaFundo, padding: `${Math.round(Z.cham * 0.38)}px ${Math.round(Z.cham * 0.7)}px`, borderRadius: px(Z.cham * 2) } : {}) } }, cima)
    marcar(cham, 'texto', 'headline')
    const rc = rectOf(cham)
    place(cham, RET ? CX - rc.w / 2 : ESQ ? AREA.x0 : AREA.x0, topoCham)
  }

  return (t) => {
    const cs = cam(t)
    matrizDaCamera(cs)
    const poses = CAM.map((c, i) => pose(i, t))
    camadas3.forEach((q, i) => {
      const { c, g, b, grupo, cor, faces } = q, ps = poses[i]
      grupo.visible = t >= c.entra
      grupo.position.set(0, -(g.base + ps.off), 0)
      grupo.scale.set(ps.sxz, ps.sy, ps.sxz)
      // com destaque, a camada troca seco para a cor de destaque no instante em que é nomeada e volta à dela quando a
      // próxima é nomeada: sem mistura no meio (a mistura de duas cores da marca dá uma terceira, fora da paleta)
      const prox = CAM[i + 1]
      const usa = DEST && t >= c.nomeia && !(prox && t >= prox.nomeia) ? DEST : CORES[i]
      for (const f of ['topo', 'frente', 'lado']) cor[f].set(...usa[f])
      // a camada pousada vira "imagem" para a checagem: texto nenhum pode cruzar (enquanto cai, não conta)
      const pousada = t >= c.pousa
      if (pousada !== q.pousada) { for (const bl of faces) for (const { f } of bl) f.style.display = pousada ? 'block' : 'none'; q.pousada = pousada }
      if (pousada) b.bs.forEach((bl, j) => {
        const pts = []
        for (let v = 0; v < 8; v++) pts.push(projetar(...naPose(i, ps, bl.x + (v & 1 ? 0.5 : -0.5) * b.pw, v & 2 ? g.h : 0, bl.z + (v & 4 ? 0.5 : -0.5) * b.pd), cs))
        for (const { f, idx } of faces[j]) {
          const xs = idx.map((v) => pts[v].x), ys = idx.map((v) => pts[v].y)
          place(f, Math.min(...xs), Math.min(...ys), Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys))
        }
      })
    })
    gl3.render(cena3, cam3)

    // rótulos: alinhados com a própria camada, empurrados para não encostar um no outro
    const ext = camadas3.filter(({ c }) => t >= c.pousa - 0.1).flatMap(({ g }) => cantos(g, g.yc).map((p) => projetar(...p, cs).x))
    const borda = ext.length ? (ESQ ? Math.min(...ext) - VAO : Math.max(...ext) + VAO) : (ESQ ? COL.x1 : COL.x0)
    const xr = ESQ ? Math.min(COL.x1, borda) : Math.max(COL.x0, borda)
    const pos = rotulos.map((r, i) => {
      const parada = ancora(i, cs, PARADA)
      return { r, ancora: ancora(i, cs, poses[i]), y: parada.y - Z.rot * 0.55 }
    })
    const ordem = [...pos].sort((a, b) => a.y - b.y)
    for (let j = 1; j < ordem.length; j++) ordem[j].y = Math.max(ordem[j].y, ordem[j - 1].y + ordem[j - 1].r.h + 22)
    const sobra = ordem.length ? ordem[ordem.length - 1].y + ordem[ordem.length - 1].r.h - (ZONA.y1 - 6) : 0
    if (sobra > 0) for (const p of ordem) p.y -= sobra
    for (let j = ordem.length - 2; j >= 0; j--) ordem[j].y = Math.min(ordem[j].y, ordem[j + 1].y - ordem[j].r.h - 22)
    pos.forEach(({ r, ancora, y }, i) => {
      const c = CAM[i]
      let fora = 0
      for (const l of r.linhas) {
        const lx = ESQ ? xr - l.w : xr
        place(l.el.line, lx, y + l.dy)
        riseWords(l.el.words, t, c.nomeia + 0.12 + (l.f === fR ? 0 : 0.12), 0.05)
        fora = Math.max(fora, ZONA.y0 - (y + l.dy), y + l.dy + l.lh - ZONA.y1, ESQ ? AREA.x0 - lx : lx + l.w - AREA.x1)
      }
      const vis = clamp(1 - fora / 28)
      for (const l of r.linhas) O(l.el.line, vis)
      const ex = ESQ ? xr + 16 : xr - 16, ey = y + Z.rot * 0.55
      const pf = E.inOutCubic(P(t, c.nomeia, c.nomeia + 0.32))
      r.fio.setAttribute('x1', ancora.x); r.fio.setAttribute('y1', ancora.y)
      r.fio.setAttribute('x2', lerp(ancora.x, ex, pf)); r.fio.setAttribute('y2', lerp(ancora.y, ey, pf))
      O(r.fio, pf > 0 ? LINHA_ALFA * vis : 0)
      r.ponto.setAttribute('cx', ancora.x); r.ponto.setAttribute('cy', ancora.y)
      O(r.ponto, LINHA_ALFA * E.outBack(P(t, c.nomeia - 0.05, c.nomeia + 0.2)) * vis)
    })
    // o fecho nasce do topo da pilha
    const gt = GEO[NC - 1], q = projetar(0, -(gt.base + gt.h), 0, cs)
    PONTO_FECHO = { x: q.x, y: q.y }
  }
}, 'pilha')

// ---------- fecho: só o logo, centrado e parado ----------
cena(PLANO.fecho.em, PLANO.dur, (root) => {
  const F = PARAMS.fecho
  const camB = camada(root, F.fundo || C.fundo)
  const lw = F.largura ?? L({ '16x9': 640, '9x16': 620, padrao: 560 })
  const lh = lw / (F.logoAspecto || 4)
  const logo = imagem(camB, F.logo, { width: px(lw), left: px(CX - lw / 2), top: px(CY - lh / 2) })
  marcar(logo, 'logo', 'closing logo')
  const anel = PLANO.transicao === 'mascara' ? sv('circle', { fill: 'none', stroke: C.linha, 'stroke-width': 6, opacity: 0 }, svgQuadro(root)) : null
  const t0 = PLANO.fecho.em, d = PLANO.durTr
  return (t) => {
    const kk = E.outCubic(P(t, PLANO.fecho.logoEm, PLANO.fecho.logoEm + 0.45))
    O(logo, kk); T(logo, `translateY(${(1 - kk) * 24}px)`)
    if (PLANO.transicao === 'mascara') {
      TR.mascara.entra(camB, t, t0, d, { forma: 'circulo', x: PONTO_FECHO.x, y: PONTO_FECHO.y })
      const p = P(t, t0, t0 + d)
      anel.setAttribute('cx', PONTO_FECHO.x); anel.setAttribute('cy', PONTO_FECHO.y)
      anel.setAttribute('r', raioCobre(PONTO_FECHO.x, PONTO_FECHO.y) * E.inOutCubic(p))
      O(anel, p > 0 && p < 1 ? 1 : 0)
    }
  }
}, 'fecho')
