/* Molde isometrico, modo "aparelho": as três partes como um aparelho em 3D (WebGL, three.js), com luz de estúdio suave e
 * sombra de contato curta. A bandeja (camada 1) pousa; as teclas (camada 2, uma por peça, com o ícone da marca na face de
 * cima, sem alterar o ícone) caem uma a uma nos vãos; o monitor (camada 3) abre pela dobradiça; as teclas digitam e a
 * tela (neutra, sem brilho) carrega de 0 a 100% e mostra o estado final. Rótulos numa coluna, com o mesmo espaço entre
 * eles, e cada fio é uma linha horizontal: a altura do rótulo é fixa e o ponto acompanha a borda do próprio objeto
 * (lida num mapa de IDs, quadro a quadro). Câmera em leve perspectiva, orbitando devagar. Os tempos vêm do plan.js
 * (PLANO.aparelho); cores, fonte, ícones e textos, do JSON. O fecho (só o logo) é o do iso.js. */
if (PLANO.modo === 'aparelho') (() => {
const M = PARAMS.marca, CAM = PLANO.camadas, PA = PLANO.aparelho
const C = { apoio: M.cores.texto, ...M.cores }
const PESO = { rotulo: 700, detalhe: 500, chamada: 600, ...(M.pesos || {}) }
const PECAS = CAM[1].pecas
const K = { bandeja: CAM[0].cor.topo, vao: CAM[0].cor.frente, monitor: CAM[2].cor.frente, detalhe: CAM[2].cor.topo, sombra: '#1D1D1D' }
const TELA = { fundo: '#EBEBEB', texto: '#1D1D1D', cheio: '#1D1D1D', vazio: '#DEDEDE', carregando: 'Loading…', pronto: 'Checked', ...(PARAMS.tela || {}) }
const AREA = areaSegura()
const Z = { rot: 50, det: 34, cham: 40 }

// ---------- geometria ----------
const prato = (u, w) => (1 - Math.min(1, u * u)) * (1 - Math.min(1, w * w))
function caixaMacia(w, h, d, rr, concavo = 0, N = 30) {
  const g = new THREE.BoxGeometry(1, 1, 1, N, N, N), pos = g.attributes.position
  const hx = w / 2, hy = h / 2, hz = d / 2, cl = THREE.MathUtils.clamp
  const f = (s) => Math.sign(s) * (1 - (1 - Math.abs(s)) ** 2)
  const v = new THREE.Vector3(), q = new THREE.Vector3(), n = new THREE.Vector3()
  for (let i = 0; i < pos.count; i++) {
    v.set(f(pos.getX(i) * 2) * hx, f(pos.getY(i) * 2) * hy, f(pos.getZ(i) * 2) * hz)
    q.set(cl(v.x, -hx + rr, hx - rr), cl(v.y, -hy + rr, hy - rr), cl(v.z, -hz + rr, hz - rr))
    n.copy(v).sub(q)
    if (n.lengthSq() > 1e-12) v.copy(q).add(n.normalize().multiplyScalar(rr))
    if (concavo && v.y > hy - 1e-5) v.y -= concavo * prato(v.x / (hx - rr), v.z / (hz - rr))
    pos.setXYZ(i, v.x, v.y, v.z)
  }
  g.deleteAttribute('normal'); g.deleteAttribute('uv')
  const m = THREE.BufferGeometryUtils.mergeVertices(g, 1e-5)
  m.computeVertexNormals()
  return m
}
function retArred(path, x, y, w, h, rr) {
  path.moveTo(x + rr, y); path.lineTo(x + w - rr, y); path.quadraticCurveTo(x + w, y, x + w, y + rr)
  path.lineTo(x + w, y + h - rr); path.quadraticCurveTo(x + w, y + h, x + w - rr, y + h)
  path.lineTo(x + rr, y + h); path.quadraticCurveTo(x, y + h, x, y + h - rr)
  path.lineTo(x, y + rr); path.quadraticCurveTo(x, y, x + rr, y)
  return path
}
const fosco = (cor, o = {}) => new THREE.MeshPhysicalMaterial({ color: cor, roughness: 0.6, metalness: 0, clearcoat: 0.12, clearcoatRoughness: 0.6, ...o })

const NT = PECAS.length
const KEY = 0.42, VAOH = 0.5, ESP = 0.07, MARG = 0.17, FUNDO = 0.42
const TW = NT * VAOH + (NT - 1) * ESP + 2 * MARG, TD = VAOH + MARG + FUNDO
const BT = 0.045, TH = 0.27, POCO = 0.075
const zFila = TD / 2 - MARG - VAOH / 2
const KH = 0.19, KR = 0.07, PRATO = 0.02
const MW = TW * 0.98, MH = 1.42, MT = 0.13, MR = 0.13, zDob = -TD / 2 + 0.2, yDob = TH + 0.06, ABERTO = -0.16
const SW = MW - 0.3, SH = MH - 0.3
const TECLAS = PECAS.map((q) => ({ cor: q.cor, icone: q.icone }))
const xTecla = (k) => -TW / 2 + MARG + k * (VAOH + ESP) + VAOH / 2

// ---------- câmera: leve perspectiva, orbitando devagar ----------
const ALVO = new THREE.Vector3(0, 0.62, -0.05), DIST = 14, ELEV = (21 * Math.PI) / 180
const AZ0 = 23, AZ1 = 37                                // a órbita: devagar, o tempo todo
const azDe = (t) => { const u = (t + 0.4) / (PLANO.fecho.em + 0.8); return AZ0 + (AZ1 - AZ0) * (0.6 * u + 0.4 * E.inOutSine(clamp(u))) }
function poseCamera(cam, t) {
  const az = (azDe(t) * Math.PI) / 180
  cam.position.set(ALVO.x + DIST * Math.sin(az) * Math.cos(ELEV), ALVO.y + DIST * Math.sin(ELEV), ALVO.z + DIST * Math.cos(az) * Math.cos(ELEV))
  cam.lookAt(ALVO); cam.updateMatrixWorld()
}

// ---------- movimento ----------
const queda = (t, entra, pousa, h) => (1 - E.inQuad(P(t, entra, pousa))) * h
const amassa = (t, pousa) => { const sy = 1 - 0.18 * wob(t - pousa, 1.7, 5.5); return { sy, sxz: 1 / Math.sqrt(sy) } }
function aperto(t, k) {
  // quanto a tecla k está afundada (0–1): desce rápido, segura um instante e volta macia
  let a = 0
  for (const q of PA.toques) if (q.tecla === k) a = Math.max(a, E.outQuad(P(t, q.t, q.t + 0.06)) * (1 - E.inOutSine(P(t, q.t + 0.09, q.t + 0.24))))
  return a
}
function progresso(t) {
  // cada toque leva a barra 10% adiante; o número sobe junto
  let p = 0
  PA.toques.forEach((q) => { p += 10 * E.outCubic(P(t, q.t + 0.02, q.t + 0.16)) })
  return Math.min(100, p)
}

// ---------- a tela (textura desenhada) ----------
const telaCv = document.createElement('canvas'); telaCv.width = 2400; telaCv.height = Math.round((2400 * SH) / SW)
function desenharTela(pct, checado) {
  // a tela em cores neutras e sem brilho (padrão: fundo cinza claro, texto e segmentos cheios quase pretos, vazios em cinza)
  const x = telaCv.getContext('2d'), w = telaCv.width, h = telaCv.height, m = w * 0.1
  x.clearRect(0, 0, w, h); x.fillStyle = TELA.fundo; x.fillRect(0, 0, w, h)
  const n = 20, gap = w * 0.012, bw = (w - 2 * m - (n - 1) * gap) / n, bh = h * 0.13, by = h * 0.52
  x.fillStyle = TELA.texto; x.textBaseline = 'alphabetic'
  if (!checado) {
    x.font = `${PESO.rotulo} ${Math.round(w * 0.062)}px "${M.fonte}"`
    x.fillText(TELA.carregando, m, h * 0.4)
    x.textAlign = 'right'; x.fillText(`${Math.round(pct)}%`, w - m, h * 0.4); x.textAlign = 'left'
  } else {
    // o estado final e o visto desenhado (traço, não glifo): informativo, sem frase de efeito
    x.font = `${PESO.rotulo} ${Math.round(w * 0.085)}px "${M.fonte}"`
    const tw = x.measureText(TELA.pronto).width, ck = w * 0.075, total = tw + w * 0.035 + ck, x0 = (w - total) / 2, base = h * 0.42
    x.fillText(TELA.pronto, x0, base)
    x.lineWidth = w * 0.016; x.lineCap = 'round'; x.lineJoin = 'round'; x.strokeStyle = TELA.texto
    const cx = x0 + tw + w * 0.035, cy = base - ck * 0.75
    x.beginPath(); x.moveTo(cx, cy + ck * 0.38); x.lineTo(cx + ck * 0.36, cy + ck * 0.72); x.lineTo(cx + ck, cy); x.stroke()
  }
  for (let i = 0; i < n; i++) {
    x.fillStyle = i < Math.round((pct / 100) * n) ? TELA.cheio : TELA.vazio
    x.beginPath(); x.roundRect(m + i * (bw + gap), by, bw, bh, bw * 0.28); x.fill()
  }
}

// ---------- a cena ----------
cena(0, PLANO.fecho.em + 0.0001, (root) => {
  const camA = camada(root, C.fundo)
  const canvas = el('canvas', { cls: 'abs', style: { left: '0px', top: '0px', width: px(W), height: px(H) } }, camA)
  const sonda = marcarImagem(el('div', { cls: 'abs', style: { display: 'none' } }, camA), 'the device')
  const r = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, preserveDrawingBuffer: true, powerPreference: 'high-performance' })
  r.setPixelRatio(2); r.setSize(W, H, false); r.setClearColor(0x000000, 0)
  r.toneMapping = THREE.NeutralToneMapping
  r.shadowMap.enabled = true; r.shadowMap.type = THREE.PCFShadowMap; r.shadowMap.autoUpdate = false
  const c3 = new THREE.Scene()
  const cam = new THREE.PerspectiveCamera(17, W / H, 0.1, 100)
  const pm = new THREE.PMREMGenerator(r)
  c3.environment = pm.fromScene(new THREE.RoomEnvironment(), 0.04).texture
  c3.environmentIntensity = 0.8
  const chave = new THREE.DirectionalLight('#ffffff', 1.25)
  chave.position.set(-1.6, 6, 2.6); chave.castShadow = true
  chave.shadow.mapSize.set(2048, 2048)
  Object.assign(chave.shadow.camera, { left: -2.6, right: 2.6, top: 2.6, bottom: -2.6, near: 1, far: 15 })
  chave.shadow.radius = 8; chave.shadow.bias = -0.0004; chave.shadow.normalBias = 0.01
  c3.add(chave)
  const chao = new THREE.Mesh(new THREE.PlaneGeometry(14, 14), new THREE.ShadowMaterial({ color: K.sombra, opacity: 0.12 }))
  chao.rotation.x = -Math.PI / 2; chao.receiveShadow = true
  c3.add(chao)
  const objetos = { monitor: [], teclas: [], bandeja: [] }, extras = [chao]
  const add = (m, grupo, pai) => { m.castShadow = m.receiveShadow = true; objetos[grupo].push(m); pai.add(m); return m }

  // bandeja (origem no pé: amassa a partir do chão)
  const gBand = new THREE.Group(); c3.add(gBand)
  {
    const s = retArred(new THREE.Shape(), -TW / 2, -TD / 2, TW, TD, 0.2)
    for (let k = 0; k < NT; k++) s.holes.push(retArred(new THREE.Path(), -TW / 2 + MARG + k * (VAOH + ESP), -zFila - VAOH / 2, VAOH, VAOH, 0.11))
    const geo = new THREE.ExtrudeGeometry(s, { depth: TH - 2 * BT, bevelEnabled: true, bevelThickness: BT, bevelSize: BT, bevelSegments: 10, curveSegments: 40 })
    geo.rotateX(-Math.PI / 2); geo.translate(0, BT, 0)
    add(new THREE.Mesh(geo, fosco(K.bandeja)), 'bandeja', gBand)
    const lado = VAOH - 2 * BT + 0.006, hf = TH - POCO - 0.02
    for (let k = 0; k < NT; k++) add(new THREE.Mesh(caixaMacia(lado, hf, lado, 0.06, 0, 12), fosco(K.vao)), 'bandeja', gBand).position.set(xTecla(k), hf / 2 + 0.02, zFila)
  }
  // teclas (origem no pé, dentro do vão)
  const gTec = TECLAS.map((t, k) => {
    const g = new THREE.Group(); c3.add(g)
    const m = add(new THREE.Mesh(caixaMacia(KEY, KH, KEY, KR, PRATO), fosco(t.cor)), 'teclas', g)
    m.position.y = KH / 2
    ESPERAR.push(new THREE.TextureLoader().loadAsync(t.icone).then((tex) => {
      tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8
      const a = tex.image.width / tex.image.height, s = (KEY - 2 * KR) * 0.92
      const geo = new THREE.PlaneGeometry(a >= 1 ? s : s * a, a >= 1 ? s / a : s, 24, 24)
      geo.rotateX(-Math.PI / 2)
      const p = geo.attributes.position, lim = KEY / 2 - KR
      for (let i = 0; i < p.count; i++) p.setY(i, KH + 0.0025 - PRATO * prato(p.getX(i) / lim, p.getZ(i) / lim))
      geo.computeVertexNormals()
      const dec = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ map: tex, transparent: true, roughness: 0.6, polygonOffset: true, polygonOffsetFactor: -2 }))
      dec.receiveShadow = true; extras.push(dec); g.add(dec)
    }))
    return g
  })
  // monitor: dobradiça metálica, moldura grossa, botões, tela
  const dob = add(new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.075, MW * 0.42, 48), new THREE.MeshPhysicalMaterial({ color: K.detalhe, metalness: 0.9, roughness: 0.28, clearcoat: 0.4 })), 'monitor', c3)
  dob.rotation.z = Math.PI / 2; dob.position.set(0, yDob, zDob)
  const mon = new THREE.Group(); mon.position.set(0, yDob, zDob); c3.add(mon)
  add(new THREE.Mesh(caixaMacia(MW, MH, MT, MR, 0, 30), fosco(K.monitor)), 'monitor', mon).position.set(0, MH / 2 + 0.03, 0)
  for (const [bx, bw] of [[MW * 0.24, 0.17], [MW * 0.36, 0.12]]) add(new THREE.Mesh(caixaMacia(bw, 0.07, 0.07, 0.03, 0, 10), fosco(K.detalhe)), 'monitor', mon).position.set(bx, MH + 0.055, 0)
  add(new THREE.Mesh(caixaMacia(0.07, 0.17, 0.07, 0.03, 0, 10), fosco(K.detalhe)), 'monitor', mon).position.set(MW / 2 + 0.025, MH * 0.7, 0)
  const telaTex = new THREE.CanvasTexture(telaCv); telaTex.colorSpace = THREE.SRGBColorSpace; telaTex.anisotropy = 8
  {
    const geo = new THREE.ShapeGeometry(retArred(new THREE.Shape(), -SW / 2, -SH / 2, SW, SH, 0.07), 24)
    const p = geo.attributes.position, uv = geo.attributes.uv
    for (let i = 0; i < p.count; i++) uv.setXY(i, (p.getX(i) + SW / 2) / SW, (p.getY(i) + SH / 2) / SH)
    const tela = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ map: telaTex, toneMapped: false }))
    tela.position.set(0, MH / 2 + 0.03, MT / 2 + 0.003)
    objetos.monitor.push(tela); mon.add(tela)
  }

  // pose do aparelho no instante t
  function posar(t) {
    const bq = queda(t, PA.bandeja.entra, PA.bandeja.pousa, 2.6), ba = amassa(t, PA.bandeja.pousa)
    gBand.visible = t >= PA.bandeja.entra
    gBand.position.set(0, bq, 0); gBand.scale.set(ba.sxz, ba.sy, ba.sxz)
    PA.teclas.forEach((q, k) => {
      const g = gTec[k], a = amassa(t, q.pousa)
      g.visible = t >= q.entra
      g.position.set(xTecla(k), TH - POCO + queda(t, q.entra, q.pousa, 2.6) - 0.065 * aperto(t, k), zFila)
      g.scale.set(a.sxz, a.sy, a.sxz)
    })
    const M = PA.monitor
    const sd = E.outBack(P(t, M.dobradica, M.dobradica + 0.25))
    dob.visible = mon.visible = t >= M.dobradica
    dob.scale.set(1, Math.max(0.001, sd), 1)                       // o cilindro cresce no comprimento (eixo y dele)
    const ab = P(t, M.abre, M.aberto)
    mon.rotation.x = lerp(-Math.PI / 2, ABERTO, E.outBack(ab, 1.4))
    const sm = Math.max(0.001, E.outCubic(P(t, M.abre - 0.05, M.abre + 0.3)))
    mon.scale.set(lerp(0.35, 1, sm), lerp(0.35, 1, sm), lerp(0.35, 1, sm))
  }

  // ---------- quem aparece em cada pixel: o mapa de IDs (para os fios e o enquadramento) ----------
  const COR_ID = { monitor: new THREE.MeshBasicMaterial({ color: new THREE.Color(1, 0, 0) }), teclas: new THREE.MeshBasicMaterial({ color: new THREE.Color(0, 1, 0) }), bandeja: new THREE.MeshBasicMaterial({ color: new THREE.Color(0, 0, 1) }) }
  const ID = { monitor: 1, teclas: 2, bandeja: 3 }
  function comIds(fn) {
    const guard = []
    for (const [g, lista] of Object.entries(objetos)) for (const m of lista) { guard.push([m, m.material, m.castShadow]); m.material = COR_ID[g] }
    const vis = extras.map((o) => o.visible); extras.forEach((o) => (o.visible = false))
    const tm = r.toneMapping; r.toneMapping = THREE.NoToneMapping
    try { return fn() } finally {
      r.toneMapping = tm
      for (const [m, mat] of guard) m.material = mat
      extras.forEach((o, i) => (o.visible = vis[i]))
    }
  }
  const lerId = (buf, i) => (buf[i] > 127 ? 1 : buf[i + 1] > 127 ? 2 : buf[i + 2] > 127 ? 3 : 0)
  let OFF = { x: 0, y: 0 }
  const vista = () => { cam.setViewOffset(W, H, OFF.x, OFF.y, W, H); cam.updateProjectionMatrix() }
  function mapaCheio() {
    return comIds(() => {
      const rt = new THREE.WebGLRenderTarget(W, H)
      r.setRenderTarget(rt); r.setClearColor(0x000000, 1); r.clear(); r.render(c3, cam); r.setRenderTarget(null); r.setClearColor(0x000000, 0)
      const buf = new Uint8Array(W * H * 4); r.readRenderTargetPixels(rt, 0, 0, W, H, buf); rt.dispose()
      return (x, y) => { x = Math.round(x); y = Math.round(y); if (x < 0 || y < 0 || x >= W || y >= H) return 0; return lerId(buf, ((H - 1 - y) * W + x) * 4) }
    })
  }
  const rtLinha = new THREE.WebGLRenderTarget(W, 1), bufLinha = new Uint8Array(W * 4)
  function linha(y) {
    // só a linha y do quadro: a câmera recorta 1 px de altura (barato a cada quadro)
    return comIds(() => {
      cam.setViewOffset(W, H, OFF.x, OFF.y + Math.round(y), W, 1); cam.updateProjectionMatrix()
      r.setRenderTarget(rtLinha); r.setClearColor(0x000000, 1); r.clear(); r.render(c3, cam); r.setRenderTarget(null); r.setClearColor(0x000000, 0)
      r.readRenderTargetPixels(rtLinha, 0, 0, W, 1, bufLinha)
      vista()
      return Array.from({ length: W }, (_, x) => lerId(bufLinha, x * 4))
    })
  }

  // ---------- rótulos ----------
  const cima = el('div', { cls: 'layer' }, camA)
  const fios = svgQuadro(cima)
  const fR = `${PESO.rotulo} ${Z.rot}px "${M.fonte}"`, fD = `${PESO.detalhe} ${Z.det}px "${M.fonte}"`
  // de cima para baixo: o monitor, as teclas, a bandeja (as camadas 3, 2 e 1 do JSON)
  const ROT = [[CAM[2], 'monitor'], [CAM[1], 'teclas'], [CAM[0], 'bandeja']].map(([c, obj]) => [c.rotulo, c.detalhe || '', obj, c.nomeia])
  const rots = ROT.map(([a, b, obj, nomeia]) => {
    const linhas = [{ s: a, f: fR, lh: Z.rot * 1.1, dy: 0, cor: C.texto }, ...(b ? [{ s: b, f: fD, lh: Z.det * 1.24, dy: Z.rot * 1.1 + 8, cor: C.apoio }] : [])]
    for (const l of linhas) { l.el = textLine(cima, [{ t: l.s }], { font: l.f, color: l.cor }); l.w = rectOf(l.el.line).w }
    const fio = sv('line', { stroke: C.linha, 'stroke-width': 3, 'stroke-linecap': 'round', opacity: 0 }, fios)
    const ponto = sv('circle', { r: 7, fill: C.linha, opacity: 0 }, fios)
    return { linhas, h: Math.ceil(Z.rot * 1.1 + 8 + Z.det * 1.24), id: ID[obj], nomeia, fio, ponto, xa: null }
  })
  const lw = Math.max(...rots.flatMap((q) => q.linhas.map((l) => l.w))), lh = Math.max(...rots.map((q) => q.h))
  if (PARAMS.chamada) {
    const comPilula = !!C.chamadaFundo
    const cham = el('div', { cls: 'abs', text: PARAMS.chamada, style: { font: `${PESO.chamada} ${Z.cham}px "${M.fonte}"`, color: comPilula ? C.chamadaTexto || C.texto : C.texto, whiteSpace: 'nowrap',
      ...(comPilula ? { background: C.chamadaFundo, padding: `${Math.round(Z.cham * 0.38)}px ${Math.round(Z.cham * 0.7)}px`, borderRadius: px(Z.cham * 2) } : {}) } }, cima)
    marcar(cham, 'texto', 'headline'); place(cham, AREA.x0, AREA.y0 + 16)
  }

  // ---------- enquadramento: o aparelho completo, nas poses do começo, meio e fim da órbita ----------
  const POSES = [0, PLANO.fecho.em / 2, PLANO.fecho.em]
  const montado = PLANO.fecho.em - 0.01
  const mapas = () => POSES.map((tp) => { poseCamera(cam, tp); posar(montado); vista(); return mapaCheio() })
  const caixa = (ids) => { let x0 = W, x1 = 0, y0 = H, y1 = 0; for (const id of ids) for (let y = 0; y < H; y += 2) for (let x = 0; x < W; x += 2) if (id(x, y)) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y) } return { x0, x1, y0, y1 } }
  vista()
  let ids = mapas(), b = caixa(ids)
  const VAO = 100, larguraMax = AREA.x1 - AREA.x0 - lw - VAO, topo = AREA.y0 + 110, baixo = AREA.y1 - 90
  cam.zoom = Math.min(larguraMax / (b.x1 - b.x0), (baixo - topo) / (b.y1 - b.y0)); cam.updateProjectionMatrix()
  ids = mapas(); b = caixa(ids)
  const grupo = b.x1 - b.x0 + VAO + lw, gx0 = (AREA.x0 + AREA.x1) / 2 - grupo / 2
  OFF = { x: -(gx0 - b.x0), y: -((topo + baixo) / 2 - (b.y0 + b.y1) / 2) }
  vista(); ids = mapas(); b = caixa(ids)
  const colX = b.x1 + VAO
  place(sonda, b.x0, b.y0, b.x1 - b.x0, b.y1 - b.y0)
  // as alturas dos rótulos: espaço igual, cada fio horizontal bate no próprio objeto nas três poses (cruzando o mínimo)
  const meio = 30
  // o ponto fica a VAO_PT da borda do objeto; o trecho horizontal não corre rente a uma borda (a menos de RENTE px)
  const VAO_PT = 14, RENTE = 10
  const acha = (id, y, alvo) => {
    let cruza = 0, borda = null
    for (let x = colX - 30; x >= 0; x--) { const k = id(x, y); if (k === alvo) { borda = x; break } if (k) cruza++ }
    if (borda == null) return null
    let rente = 0
    for (let x = borda + VAO_PT - 4; x <= colX - 22; x++) { const k = id(x, y); for (const d of [-RENTE, -RENTE / 2, RENTE / 2, RENTE]) if (id(x, y + d) !== k) { rente++; break } }
    return { x: borda, cruza, rente }
  }
  let melhor = null
  for (let passo = lh + 54; passo <= lh + 200; passo += 2) for (let y0 = topo; y0 + 2 * passo + lh <= AREA.y1 - 4; y0 += 2) {
    let ok = true, custo = 0
    for (let k = 0; k < 3 && ok; k++) for (const id of ids) { const h = acha(id, y0 + k * passo + meio, rots[k].id); if (!h) { ok = false; break } custo += 0.5 * h.cruza + 8 * h.rente }
    if (!ok) continue
    const nota = Math.abs(passo - (lh + 80)) + 0.5 * Math.abs(y0 + passo + lh / 2 - (b.y0 + b.y1) / 2) + custo
    if (!melhor || nota < melhor.nota) melhor = { y0, passo, nota }
  }
  if (!melhor) throw new Error('no label layout where each straight thread reaches its own object')
  rots.forEach((q, k) => { q.y = melhor.y0 + k * melhor.passo; q.ya = q.y + meio })
  window.__LAYOUT = { colX, passo: melhor.passo, ys: rots.map((q) => q.y), aparelho: b }

  let telaChave = ''
  return (t) => {
    poseCamera(cam, t); vista()
    posar(t)
    const pct = progresso(t), chk = t >= PA.checado, chaveT = chk ? 'ok' : pct.toFixed(1)
    if (chaveT !== telaChave) { desenharTela(pct, chk); telaTex.needsUpdate = true; telaChave = chaveT }
    // fios: a altura é a do rótulo; o ponto vai para a borda do objeto naquela linha, quadro a quadro
    for (const q of rots) {
      const vis = t >= q.nomeia - 0.06
      if (vis) {
        const row = linha(q.ya)
        let x = null
        for (let xx = colX - 30; xx >= 0; xx--) if (row[xx] === q.id) { x = xx; break }
        if (x != null) q.xa = x + VAO_PT - 2
      }
      // o fio não se desenha: aparece pronto, junto com o rótulo
      const ex = colX - 22, on = t >= q.nomeia + 0.12 && q.xa != null
      if (q.xa != null) {
        q.fio.setAttribute('x1', q.xa); q.fio.setAttribute('y1', q.ya); q.fio.setAttribute('x2', ex); q.fio.setAttribute('y2', q.ya)
        q.ponto.setAttribute('cx', q.xa); q.ponto.setAttribute('cy', q.ya)
      }
      O(q.fio, on ? 1 : 0); O(q.ponto, on ? 1 : 0)
      for (const l of q.linhas) { place(l.el.line, colX, q.y + l.dy); riseWords(l.el.words, t, q.nomeia + 0.12 + (l.f === fR ? 0 : 0.12), 0.05) }
    }
    sonda.style.display = t >= PA.bandeja.pousa ? 'block' : 'none'
    chave.shadow.needsUpdate = true; r.shadowMap.needsUpdate = true
    r.render(c3, cam)
  }
}, 'aparelho')
})()
