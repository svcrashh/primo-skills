// Kit 3D do motor: palco WebGL (three.js) que obedece ao relógio do motor, aparelhos procedurais com a tela do produto
// como textura, logo e texto extrudados, luz que passa, poeira e pós-processamento de cinema.
// Carrega DEPOIS de engine.js e three.bundle.js (window.THREE), ANTES de scene.js. Sem módulo, sem fetch:
// tudo funciona por file:// no render quadro a quadro.
//
// Regra de ouro (a mesma do motor): nada de requestAnimationFrame, Clock, Date.now ou Math.random. Tudo é função de t.
// O palco desenha quando a cena chama p3.desenha() no fim do update(t). Se uma textura de vídeo ainda está
// decodificando, o desenho vai para ESPERA_QUADRO e o render.cjs espera antes de capturar.
//
// Unidade: 1 = a altura do celular. Câmera em graus de FOV vertical. Cores em hex.

const K3 = {
  // Tom: 'nenhum' preserva a cor exata da tela do produto (o que o dono confere). 'agx'/'aces' só se a cena não tem tela.
  tom: { nenhum: 'NoToneMapping', neutro: 'NeutralToneMapping', agx: 'AgXToneMapping', aces: 'ACESFilmicToneMapping' },
  avisouCPU: false,
}

// ---------- palco ----------
// palco3d(parent, { x, y, w, h, fov, fundo, ambiente, dof, bloom, cinema, tom, exposicao, msaa })
//   fundo: null (transparente: o DOM de baixo aparece; sem dof/bloom) | '#hex' | { cor, grade, brilho, z } (parede da marca em 3D)
//   ambiente: 'estudio' (RoomEnvironment, procedural) | { hdr: window.HDR_x (base64 de um .hdr), intensidade }
//   dof: false | { abertura: 0.002–0.02, maxblur: 0.005–0.02 }  → p3.foco(distância) a cada quadro
//   bloom: false | { forca: 0.2–0.6, raio: 0.4–0.8, limiar: 0.8–0.95 }
//   cinema: { vinheta: 0–0.6, aberracao: px no canto (0–2) }
// Devolve { el, cena, cam, renderer, add, foco, desenha, esperar, raiz }.
function palco3d(parent, o = {}) {
  const { x = 0, y = 0, w = W, h = H, fov = 30, perto = 0.05, longe = 200, msaa = 4 } = o
  const canvas = el('canvas', { cls: 'abs', style: { left: px(x), top: px(y), width: px(w), height: px(h) } }, parent)
  canvas.width = w; canvas.height = h
  const transparente = o.fundo === null
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: transparente, preserveDrawingBuffer: true, powerPreference: 'high-performance' })
  renderer.setPixelRatio(1); renderer.setSize(w, h, false)
  renderer.outputColorSpace = THREE.SRGBColorSpace
  renderer.toneMapping = THREE[K3.tom[o.tom || 'nenhum']]
  renderer.toneMappingExposure = o.exposicao ?? 1
  const gl = renderer.getContext(), dbg = gl.getExtension('WEBGL_debug_renderer_info')
  const gpu = dbg ? gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER)
  if (/SwiftShader|llvmpipe|Software/i.test(gpu) && !K3.avisouCPU) {
    K3.avisouCPU = true
    console.warn(`3D ON CPU (${gpu}): ~13x slower. Open Chromium with --use-angle=metal (Mac) or --use-gl=angle --use-angle=d3d11 (Windows).`)
  }
  window.GPU3D = gpu
  const cena = new THREE.Scene()
  const cam = new THREE.PerspectiveCamera(fov, w / h, perto, longe)
  cam.position.set(0, 0, 4)
  if (!transparente && typeof o.fundo === 'string') cena.background = new THREE.Color(o.fundo)

  // ambiente: reflexos e luz difusa. O estúdio procedural não precisa de arquivo.
  const pm = new THREE.PMREMGenerator(renderer)
  if (o.ambiente && o.ambiente.hdr) {
    const bin = Uint8Array.from(atob(o.ambiente.hdr), (c) => c.charCodeAt(0))
    const dados = new THREE.HDRLoader().parse(bin.buffer)
    const tex = new THREE.DataTexture(dados.data, dados.width, dados.height, THREE.RGBAFormat, dados.type)
    tex.mapping = THREE.EquirectangularReflectionMapping; tex.colorSpace = THREE.LinearSRGBColorSpace; tex.needsUpdate = true
    cena.environment = pm.fromEquirectangular(tex).texture
  } else cena.environment = pm.fromScene(new THREE.RoomEnvironment(), 0.04).texture
  cena.environmentIntensity = (o.ambiente && o.ambiente.intensidade) ?? 0.7

  // luzes de produto: chave quente, recorte na cor da marca por trás
  const chave = new THREE.DirectionalLight('#fff4e6', o.luzChave ?? 1.0); chave.position.set(2.5, 3, 4); cena.add(chave)
  const recorte = new THREE.DirectionalLight(o.corRecorte || '#F8C102', o.luzRecorte ?? 1.6); recorte.position.set(-3, 1.5, -4); cena.add(recorte)
  THREE.RectAreaLightUniformsLib.init()

  if (o.fundo && typeof o.fundo === 'object') fundoMarca(cena, o.fundo)

  // pós: só monta o composer se pedir algum efeito
  let composer = null, bokeh = null, cine = null
  const querPos = !transparente && (o.dof || o.bloom || o.cinema)
  if (querPos) {
    const rt = new THREE.WebGLRenderTarget(w, h, { type: THREE.HalfFloatType, samples: msaa })
    composer = new THREE.EffectComposer(renderer, rt)
    composer.setPixelRatio(1); composer.setSize(w, h)
    composer.addPass(new THREE.RenderPass(cena, cam))
    // pixel NaN/Inf (normal degenerada de extrusão, especular de clearcoat) vira um borrão branco gigante no bloom:
    // zera e limita o HDR antes de qualquer efeito que espalha luz
    composer.addPass(new THREE.ShaderPass(SHADER_LIMPA))
    if (o.dof) { bokeh = new THREE.BokehPass(cena, cam, { focus: 4, aperture: o.dof.abertura ?? 0.006, maxblur: o.dof.maxblur ?? 0.01 }); corrigeBokeh(bokeh, w, h); composer.addPass(bokeh) }
    if (o.bloom) composer.addPass(new THREE.UnrealBloomPass(new THREE.Vector2(w, h), o.bloom.forca ?? 0.35, o.bloom.raio ?? 0.6, o.bloom.limiar ?? 1.15))
    cine = new THREE.ShaderPass(SHADER_CINEMA)
    cine.uniforms.res.value.set(w, h)
    cine.uniforms.vinheta.value = o.cinema?.vinheta ?? 0.35
    cine.uniforms.aberracao.value = o.cinema?.aberracao ?? 0.8
    composer.addPass(cine)
    composer.addPass(new THREE.OutputPass())
  }

  window.P3 = window.P3 || []
  const pendentes = []
  const desenhar = () => { if (composer) composer.render(); else renderer.render(cena, cam) }
  const api = {
    el: canvas, cena, cam, renderer, composer, gpu,
    // material com userData.ambiente = k recebe o ambiente com intensidade k × a da cena (o envMapIntensity do material
    // é ignorado quando o reflexo vem de scene.environment)
    add(...objs) {
      objs.forEach((ob) => {
        const g = ob.grupo || ob; cena.add(g)
        g.traverse((m) => [].concat(m.material || []).forEach((mt) => {
          if (mt.userData.ambiente != null && 'envMap' in mt) { mt.envMap = cena.environment; mt.envMapIntensity = mt.userData.ambiente * cena.environmentIntensity; mt.needsUpdate = true }
        }))
      })
      return objs[0]
    },
    // distância de foco em unidades de mundo (da câmera ao plano nítido); abertura opcional
    foco(dist, abertura) { if (bokeh) { bokeh.uniforms.focus.value = dist; if (abertura != null) bokeh.uniforms.aperture.value = abertura; bokeh.uniforms.limite.value = bokeh.uniforms.aperture.value * 12 } },
    cinema(params) { if (cine) for (const k in params) cine.uniforms[k].value = params[k] },
    esperar(pr) { pendentes.push(pr) },
    // chame no fim do update(t)
    desenha() {
      if (pendentes.length) { const ps = pendentes.splice(0); ESPERA_QUADRO.push(Promise.all(ps).then(desenhar)) }
      else desenhar()
    },
  }
  window.P3.push(api)   // depuração: window.P3[0].composer.passes, .cena…
  return api
}

const SHADER_LIMPA = {
  uniforms: { tDiffuse: { value: null }, teto: { value: 2.5 } },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
  fragmentShader: `uniform sampler2D tDiffuse; uniform float teto; varying vec2 vUv;
    void main(){ vec4 c = texture2D(tDiffuse, vUv);
      if (any(isnan(c)) || any(isinf(c))) c = vec4(0.0, 0.0, 0.0, 1.0);
      gl_FragColor = clamp(c, 0.0, teto); }`,
}

// DOF. O BokehPass do three (r186) tem dois problemas medidos aqui: (1) grava a profundidade empacotada em RGBA de
// 8 bits num alvo HalfFloat, e ela volta errada (texto em foco saía borrado); (2) o desfoque por coleta simples faz o
// fundo desfocado puxar a cor do que está nítido na frente: halo em volta da letra. Uso a infraestrutura do pass (o
// render de profundidade) com alvo Float sem empacotar e troco o shader por dispersão-como-coleta (Gustafsson,
// "Bokeh depth of field in a single pass"): cada amostra só entra se o desfoque DELA alcança o pixel, e amostra de
// trás não pode ser maior que o dobro do desfoque do centro.
const DOF_FRAG = `#include <packing>
  uniform sampler2D tColor; uniform sampler2D tDepth; uniform float focus; uniform float aperture; uniform float maxblur;
  uniform float nearClip; uniform float farClip; uniform vec2 res; uniform float limite; varying vec2 vUv;
  float prof(vec2 uv) { return -perspectiveDepthToViewZ(1.0 - texture2D(tDepth, uv).x, nearClip, farClip); }
  float coc(float d) { float esc = 0.5 * length(res); return clamp(abs(d - focus) * aperture * esc, 0.0, maxblur * esc); }
  void main() {
    vec2 tx = 1.0 / res; float dC = prof(vUv), sC = coc(dC), maxPx = min(maxblur, limite) * 0.5 * length(res);
    vec4 cor = texture2D(tColor, vUv); float tot = 1.0, raio = 0.7, ang = 0.0;
    for (int i = 0; i < 600; i++) {
      if (raio >= maxPx) break;
      vec2 uv = vUv + vec2(cos(ang), sin(ang)) * tx * raio;
      vec4 c = texture2D(tColor, uv); float d = prof(uv), sz = coc(d);
      if (d > dC) sz = clamp(sz, 0.0, sC * 2.0);
      float m = smoothstep(raio - 0.5, raio + 0.5, sz);
      cor += mix(cor / tot, c, m); tot += 1.0;
      ang += 2.39996323; raio += 1.1 / raio;
    }
    gl_FragColor = cor / tot;
  }`
function corrigeBokeh(b, w, h) {
  b._renderTargetDepth.dispose()
  b._renderTargetDepth = new THREE.WebGLRenderTarget(w, h, { minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter, type: THREE.FloatType })
  b._materialDepth.depthPacking = THREE.BasicDepthPacking; b._materialDepth.needsUpdate = true
  b.uniforms.tDepth.value = b._renderTargetDepth.texture
  b.uniforms.res = { value: new THREE.Vector2(w, h) }
  b.uniforms.limite = { value: 1 }
  b.materialBokeh.fragmentShader = DOF_FRAG
  b.materialBokeh.needsUpdate = true
}

// vinheta + aberração cromática radial (em px no canto). Sutil: aberração > 2 px já parece defeito.
const SHADER_CINEMA = {
  uniforms: { tDiffuse: { value: null }, res: { value: new THREE.Vector2(1, 1) }, vinheta: { value: 0.35 }, aberracao: { value: 0.8 } },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
  fragmentShader: `uniform sampler2D tDiffuse; uniform vec2 res; uniform float vinheta; uniform float aberracao; varying vec2 vUv;
    void main(){
      vec2 c = vUv - 0.5; float r2 = dot(c * vec2(res.x / res.y, 1.0), c * vec2(res.x / res.y, 1.0));
      vec2 d = c * aberracao / (0.5 * length(res)) * 2.0;
      vec4 col = texture2D(tDiffuse, vUv);
      col.r = texture2D(tDiffuse, vUv + d).r; col.b = texture2D(tDiffuse, vUv - d).b;
      col.rgb *= 1.0 - vinheta * smoothstep(0.15, 0.85, r2);
      gl_FragColor = col; }`,
}

// Parede da marca em 3D: cor de fundo, grade sutil e brilho na cor de destaque. Está no mundo, então mexe com a
// câmera (parallax) e desfoca com o dof. { cor, grade: alfa da linha, passo: px da grade na textura, brilho: '#hex',
// alfaBrilho, z: profundidade da parede, tam: lado do plano }
function fundoMarca(cena, f = {}) {
  const cor = f.cor || '#0B0B10', z = f.z ?? -6, tam = f.tam ?? 60
  const cv = document.createElement('canvas'); cv.width = cv.height = 512
  const g = cv.getContext('2d')
  g.fillStyle = cor; g.fillRect(0, 0, 512, 512)
  g.strokeStyle = `rgba(255,255,255,${f.grade ?? 0.05})`; g.lineWidth = 2
  const passo = 512 / 8
  for (let i = 0; i <= 8; i++) { g.beginPath(); g.moveTo(i * passo, 0); g.lineTo(i * passo, 512); g.stroke(); g.beginPath(); g.moveTo(0, i * passo); g.lineTo(512, i * passo); g.stroke() }
  const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping; tex.repeat.set(tam / (f.celula ?? 0.32) / 8, tam / (f.celula ?? 0.32) / 8)
  tex.anisotropy = 8
  const parede = new THREE.Mesh(new THREE.PlaneGeometry(tam, tam), new THREE.MeshBasicMaterial({ map: tex, toneMapped: false }))
  parede.position.z = z; cena.add(parede)
  // brilho: disco radial aditivo entre a parede e o objeto
  const bc = document.createElement('canvas'); bc.width = bc.height = 256
  const bg = bc.getContext('2d'), gr = bg.createRadialGradient(128, 128, 0, 128, 128, 128)
  // queda suave (gaussiana): queda linear deixa a borda do disco visível
  for (let i = 0; i <= 12; i++) { const r = i / 12; gr.addColorStop(r, rgba(f.brilho || '#F8C102', (f.alfaBrilho ?? 0.06) * Math.exp(-r * r * 4.5) * (1 - r))) }
  bg.fillStyle = gr; bg.fillRect(0, 0, 256, 256)
  const bt = new THREE.CanvasTexture(bc); bt.colorSpace = THREE.SRGBColorSpace
  const brilho = new THREE.Mesh(new THREE.PlaneGeometry(f.raioBrilho ?? 2.6, f.raioBrilho ?? 2.6),
    new THREE.MeshBasicMaterial({ map: bt, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }))
  brilho.position.z = z + 0.01; cena.add(brilho)
  return { parede, brilho }
}

// ---------- texturas ----------
// Imagem parada (print, foto, logo): carregada antes do primeiro quadro (ESPERAR do motor).
function texturaImagem(src, { srgb = true } = {}) {
  const im = new Image(); im.src = src
  const tex = new THREE.Texture(im)
  if (srgb) tex.colorSpace = THREE.SRGBColorSpace
  tex.anisotropy = 8
  ESPERAR.push(im.decode().then(() => { tex.needsUpdate = true }).catch(() => console.error('TEXTURE DID NOT LOAD: ' + src)))
  return tex
}
// Sequência de quadros (tela gravada, vídeo de fundo do perfil) como textura, determinística.
// quadros = ['media/x/q0001.jpg', …] (ou [[arquivo, tempo], …]); fps dos quadros. set(tv) escolhe o quadro do tempo tv
// (tempo DENTRO da sequência; preso no primeiro e no último). Um <img> por troca; o palco espera decodificar.
function texturaSequencia(p3, quadros, { fps = 30, laco = false } = {}) {
  const lista = quadros.map((q, i) => (Array.isArray(q) ? q : [q, i / fps]))
  const tex = new THREE.Texture(); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8
  tex.generateMipmaps = true; tex.minFilter = THREE.LinearMipmapLinearFilter
  let atual = null
  const primeiro = new Image(); primeiro.src = lista[0][0]
  ESPERAR.push(primeiro.decode().then(() => { tex.image = primeiro; tex.needsUpdate = true; atual = lista[0][0] }))
  const total = lista[lista.length - 1][1] + 1 / fps
  return {
    textura: tex,
    set(tv) {
      if (laco) tv = ((tv % total) + total) % total
      let lo = 0, hi = lista.length - 1
      while (lo < hi) { const m = (lo + hi + 1) >> 1; if (lista[m][1] <= tv + 1e-6) lo = m; else hi = m - 1 }
      const src = lista[lo][0]
      if (src !== atual) {
        atual = src
        const im = new Image(); im.src = src
        p3.esperar(im.decode().then(() => { if (atual === src) { tex.image = im; tex.needsUpdate = true } }).catch(() => console.error('FRAME DID NOT LOAD: ' + src)))
      }
      return lo
    },
  }
}
// lista de quadros numerados: quadrosDe('media/tela/q', 90) → ['media/tela/q0001.jpg', …]
const quadrosDe = (prefixo, n, ext = 'jpg') => Array.from({ length: n }, (_, i) => `${prefixo}${String(i + 1).padStart(4, '0')}.${ext}`)

// ---------- geometria ----------
function retArred(w, h, r) {
  const s = new THREE.Shape(), x = -w / 2, y = -h / 2
  r = Math.min(r, w / 2, h / 2)
  s.moveTo(x + r, y); s.lineTo(x + w - r, y); s.quadraticCurveTo(x + w, y, x + w, y + r)
  s.lineTo(x + w, y + h - r); s.quadraticCurveTo(x + w, y + h, x + w - r, y + h)
  s.lineTo(x + r, y + h); s.quadraticCurveTo(x, y + h, x, y + h - r)
  s.lineTo(x, y + r); s.quadraticCurveTo(x, y, x + r, y)
  return s
}
// plano de canto arredondado com UV 0..1 no retângulo inteiro (a textura cobre a tela sem esticar o canto)
function telaGeo(w, h, r, seg = 16) {
  const g = new THREE.ShapeGeometry(retArred(w, h, r), seg)
  const p = g.attributes.position, uv = g.attributes.uv
  for (let i = 0; i < p.count; i++) uv.setXY(i, p.getX(i) / w + 0.5, p.getY(i) / h + 0.5)
  return g
}
// laje extrudada de canto arredondado, centrada em z (frente em +z)
function laje(w, h, prof, r, chanfro = 0.006, seg = 24) {
  const b = Math.min(chanfro, prof / 2.5)
  const g = new THREE.ExtrudeGeometry(retArred(w - 2 * b, h - 2 * b, Math.max(0.001, r - b)), {
    depth: prof - 2 * b, bevelEnabled: true, bevelThickness: b, bevelSize: b, bevelSegments: 6, curveSegments: seg })
  g.translate(0, 0, -(prof - 2 * b) / 2)
  return g   // grupos: 0 = frente/verso, 1 = lateral e chanfro
}

// ---------- materiais ----------
const MAT3D = {
  // vidro da moldura: quase espelho; com o ambiente cheio a borda de cima refletia o teto do estúdio (faixa branca)
  vidroPreto: () => new THREE.MeshPhysicalMaterial({ color: '#030406', roughness: 0.12, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.04, userData: { ambiente: 0.3 } }),
  metal: (cor = '#3a3b42', rug = 0.32) => new THREE.MeshPhysicalMaterial({ color: cor, metalness: 1, roughness: rug, clearcoat: 0.3, clearcoatRoughness: 0.2 }),
  aluminio: (cor = '#9a9ca3') => new THREE.MeshPhysicalMaterial({ color: cor, metalness: 1, roughness: 0.42 }),
  // cor de marca (logo, texto 3D): a face mostra a cor exata (emissivo) e o volume vem da luz e do reflexo no chanfro.
  // Albedo puro sob o estúdio passa de 1,0 e o bloom vira bola de luz. O branco fica em ~0,97: em ~0,87 o logo branco
  // sobre o laranja da marca saía cinza-claro (RGB 214 contra 253 do texto, num fecho com fundo laranja).
  marca: (cor) => {
    const c = new THREE.Color().setStyle(String(cor).trim()), branco = ehBranco(cor)
    return new THREE.MeshPhysicalMaterial({ color: c.clone().multiplyScalar(branco ? 0.28 : 0.3), emissive: branco ? new THREE.Color('#ffffff') : c,
      emissiveIntensity: branco ? 0.66 : 0.72, metalness: 0.2, roughness: 0.45, clearcoat: 0.3, clearcoatRoughness: 0.3, userData: { ambiente: 0.55 } })
  },
  // tela: cor exata da textura, sem luz nem tom
  tela: (map) => new THREE.MeshBasicMaterial({ map, toneMapped: false }),
  // reflexo do vidro por cima da tela: base preta + reflexo do ambiente, somado (não escurece a tela)
  reflexo: (forca = 0.5) => new THREE.MeshStandardMaterial({ color: '#000000', metalness: 1, roughness: 0.06,
    transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, userData: { ambiente: forca } }),
}

// faixa de luz que atravessa o vidro (luz que passa): .p de -0.2 a 1.2 leva a faixa de um canto ao outro
function faixaLuz(w, h, r, { largura = 0.12, forca = 0.22, angulo = 0.5 } = {}) {
  const mat = new THREE.ShaderMaterial({
    uniforms: { p: { value: -1 }, largura: { value: largura }, forca: { value: forca }, ang: { value: angulo } },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `uniform float p; uniform float largura; uniform float forca; uniform float ang; varying vec2 vUv;
      void main(){ float d = (vUv.x + vUv.y * ang) / (1.0 + ang) - p; float a = exp(-d * d / (largura * largura * 0.18)) * forca;
        gl_FragColor = vec4(vec3(1.0, 0.97, 0.9) * a, 1.0); }`,
    transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false })
  const m = new THREE.Mesh(telaGeo(w, h, r), mat)
  return { mesh: m, set(p) { mat.uniforms.p.value = p } }
}

// ---------- aparelhos ----------
// celular3d({ altura = 1, cor, tela: THREE.Texture, reflexo, verso }) → { grupo, tela (mesh), faixa, setTela(tex) }
// Proporção e tela do celular do kit 2D (430×900, tela 390×844 com raio 44): a mesma tela recortada dos vídeos
// entra sem esticar. Genérico de propósito: nenhum desenho de marca de celular (sem trade dress).
function celular3d(o = {}) {
  const k = o.altura ?? 1
  const W0 = 430 / 900, Hc = 1, P = 0.05, R = 64 / 900
  const grupo = new THREE.Group(), corpo = new THREE.Group(); grupo.add(corpo); corpo.scale.setScalar(k)
  const moldura = MAT3D.metal(o.cor || '#23242a', 0.4)
  moldura.userData.ambiente = 0.5; moldura.clearcoat = 0          // a borda de cima espelhava a luz do teto do estúdio (traço branco)
  corpo.add(new THREE.Mesh(laje(W0, Hc, P, R, 0.008, 32), [MAT3D.vidroPreto(), moldura]))
  // tela
  const tw = 390 / 900, th = 844 / 900, tr = 44 / 900, zf = P / 2 + 0.0006
  const tela = new THREE.Mesh(telaGeo(tw, th, tr), MAT3D.tela(o.tela || null))
  tela.position.z = zf; corpo.add(tela)
  if (!o.tela) tela.material.color.set('#14141B')
  const vidro = new THREE.Mesh(telaGeo(W0 - 0.012, Hc - 0.012, R - 0.006), MAT3D.reflexo(o.reflexo ?? 0.55))
  vidro.position.z = zf + 0.0004; corpo.add(vidro)
  const faixa = faixaLuz(W0 - 0.012, Hc - 0.012, R - 0.006, o.faixa)
  faixa.mesh.position.z = zf + 0.0008; corpo.add(faixa.mesh)
  // botões laterais
  const bot = (x, y, h) => { const b = new THREE.Mesh(new THREE.BoxGeometry(0.008, h, 0.018), moldura); b.position.set(x, y, 0); corpo.add(b) }
  bot(W0 / 2 + 0.002, 0.22, 0.11); bot(-W0 / 2 - 0.002, 0.27, 0.06); bot(-W0 / 2 - 0.002, 0.17, 0.06)
  // verso: módulo de câmera genérico (duas lentes e um flash)
  if (o.verso !== false) {
    const mod = new THREE.Mesh(laje(0.16, 0.16, 0.012, 0.04, 0.003), [MAT3D.vidroPreto(), moldura])
    mod.position.set(-W0 / 2 + 0.11, Hc / 2 - 0.11, -P / 2 - 0.004); corpo.add(mod)
    const lente = (x, y) => {
      const anel = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.012, 40), moldura); anel.rotation.x = Math.PI / 2
      anel.position.set(x, y, -P / 2 - 0.014); corpo.add(anel)
      const vid = new THREE.Mesh(new THREE.CircleGeometry(0.022, 40), new THREE.MeshPhysicalMaterial({ color: '#06080d', metalness: 0.2, roughness: 0.05, clearcoat: 1 }))
      vid.position.set(x, y, -P / 2 - 0.0205); vid.rotation.y = Math.PI; corpo.add(vid)
    }
    lente(mod.position.x - 0.035, mod.position.y + 0.035); lente(mod.position.x - 0.035, mod.position.y - 0.035)
    const flash = new THREE.Mesh(new THREE.CircleGeometry(0.01, 24), new THREE.MeshBasicMaterial({ color: '#d8d2c0' }))
    flash.position.set(mod.position.x + 0.04, mod.position.y + 0.035, -P / 2 - 0.0105); flash.rotation.y = Math.PI; corpo.add(flash)
  }
  return {
    grupo, tela, faixa, corpo,
    setTela(tex) { tela.material.map = tex; tela.material.color.set('#ffffff'); tela.material.needsUpdate = true },
    // pontos úteis em coordenadas do grupo (para foco e câmera): centro da tela e um ponto da tela em px de celular (390×844)
    pontoTela(xPx, yPx) { return new THREE.Vector3((xPx / 390 - 0.5) * tw * k, (0.5 - yPx / 844) * th * k, zf * k) },
  }
}

// notebook3d({ largura = 1.4, tela: textura 16:10, abertura (graus, 0 fechado) }) → { grupo, tampa, abre(graus) }
function notebook3d(o = {}) {
  const L = o.largura ?? 1.4, F = L * 0.68, E = 0.03
  const grupo = new THREE.Group()
  const alu = MAT3D.aluminio(o.cor || '#7d8088')
  const base = new THREE.Mesh(laje(L, F, E, 0.04, 0.006), alu)
  base.rotation.x = -Math.PI / 2; base.position.y = E / 2; grupo.add(base)
  // teclado e trackpad desenhados numa textura (procedural)
  const cv = document.createElement('canvas'); cv.width = 1024; cv.height = Math.round(1024 * (F / L))
  const g = cv.getContext('2d'); g.fillStyle = '#6f7279'; g.fillRect(0, 0, cv.width, cv.height)
  const kx = cv.width * 0.1, ky = cv.height * 0.08, kw = cv.width * 0.8, kh = cv.height * 0.42, cols = 14, rows = 6
  g.fillStyle = '#121317'; g.fillRect(kx - 6, ky - 6, kw + 12, kh + 12)
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    const cw = kw / cols, ch = kh / rows
    g.fillStyle = '#1b1c21'; g.beginPath(); g.roundRect(kx + c * cw + 3, ky + r * ch + 3, cw - 6, ch - 6, 5); g.fill()
  }
  g.fillStyle = '#666970'; g.strokeStyle = '#5a5d64'; g.lineWidth = 3
  g.beginPath(); g.roundRect(cv.width * 0.32, cv.height * 0.58, cv.width * 0.36, cv.height * 0.34, 14); g.fill(); g.stroke()
  const tt = new THREE.CanvasTexture(cv); tt.colorSpace = THREE.SRGBColorSpace; tt.anisotropy = 8
  const topo = new THREE.Mesh(new THREE.PlaneGeometry(L * 0.96, F * 0.94), new THREE.MeshStandardMaterial({ map: tt, metalness: 0.6, roughness: 0.5 }))
  topo.rotation.x = -Math.PI / 2; topo.position.y = E + 0.0008; grupo.add(topo)
  // tampa: gira na dobradiça (fundo da base)
  const tampa = new THREE.Group(); tampa.position.set(0, E, -F / 2); grupo.add(tampa)
  const TE = 0.012, TA = F * 0.98
  const painel = new THREE.Mesh(laje(L, TA, TE, 0.04, 0.004), [MAT3D.vidroPreto(), alu]); painel.position.set(0, TA / 2, 0); tampa.add(painel)
  // a tampa por trás é alumínio: um plano no verso
  const costas = new THREE.Mesh(new THREE.PlaneGeometry(L * 0.98, TA * 0.98), alu); costas.position.set(0, TA / 2, -TE / 2 - 0.0005); costas.rotation.y = Math.PI; tampa.add(costas)
  const sw = L * 0.92, sh = sw / 1.6
  const tela = new THREE.Mesh(telaGeo(sw, sh, 0.012), MAT3D.tela(o.tela || null)); tela.position.set(0, TA / 2 + 0.01, TE / 2 + 0.0006); tampa.add(tela)
  if (!o.tela) tela.material.color.set('#14141B')
  const vidro = new THREE.Mesh(telaGeo(L - 0.01, TA - 0.01, 0.036), MAT3D.reflexo(o.reflexo ?? 0.4)); vidro.position.set(0, TA / 2, TE / 2 + 0.001); tampa.add(vidro)
  const faixa = faixaLuz(L - 0.01, TA - 0.01, 0.036, o.faixa); faixa.mesh.position.set(0, TA / 2, TE / 2 + 0.0014); tampa.add(faixa.mesh)
  // 0° = fechado (tampa deitada sobre o teclado), 90° = em pé, ~105° = aberto de uso
  const abre = (graus) => { tampa.rotation.x = THREE.MathUtils.degToRad(90 - graus) }
  abre(o.abertura ?? 105)
  return { grupo, tampa, tela, faixa, abre, setTela(tex) { tela.material.map = tex; tela.material.color.set('#fff'); tela.material.needsUpdate = true },
    centroTela() { return tela.getWorldPosition(new THREE.Vector3()) } }
}

// monitor3d({ largura = 1.6, tela: textura 16:9, pe = true }) → { grupo, painel, tela }
function monitor3d(o = {}) {
  const L = o.largura ?? 1.6, A = L * 9 / 16 + 0.06, E = 0.03
  const grupo = new THREE.Group()
  const metal = MAT3D.aluminio(o.cor || '#55575e')
  const painel = new THREE.Group(); painel.position.y = (o.pe === false ? 0 : 0.42 + A / 2); grupo.add(painel)
  painel.add(new THREE.Mesh(laje(L, A, E, 0.025, 0.005), [MAT3D.vidroPreto(), metal]))
  const costas = new THREE.Mesh(laje(L * 0.7, A * 0.6, 0.04, 0.05, 0.01), metal); costas.position.z = -E / 2 - 0.012; painel.add(costas)
  const sw = L - 0.05, sh = sw * 9 / 16
  const tela = new THREE.Mesh(telaGeo(sw, sh, 0.006), MAT3D.tela(o.tela || null)); tela.position.z = E / 2 + 0.0006; painel.add(tela)
  if (!o.tela) tela.material.color.set('#14141B')
  const vidro = new THREE.Mesh(telaGeo(L - 0.01, A - 0.01, 0.02), MAT3D.reflexo(o.reflexo ?? 0.4)); vidro.position.z = E / 2 + 0.001; painel.add(vidro)
  const faixa = faixaLuz(L - 0.01, A - 0.01, 0.02, o.faixa); faixa.mesh.position.z = E / 2 + 0.0014; painel.add(faixa.mesh)
  if (o.pe !== false) {
    const haste = new THREE.Mesh(laje(0.12, 0.62, 0.035, 0.02, 0.006), metal); haste.position.set(0, 0.31 + 0.01, -0.06); grupo.add(haste)
    const base = new THREE.Mesh(laje(0.52, 0.3, 0.022, 0.06, 0.006), metal); base.rotation.x = -Math.PI / 2; base.position.set(0, 0.011, -0.02); grupo.add(base)
  }
  return { grupo, painel, tela, faixa, setTela(tex) { tela.material.map = tex; tela.material.color.set('#fff'); tela.material.needsUpdate = true } }
}

// ---------- logo e texto ----------
// branco (ou quase) vira o material branco da marca; o resto, o material de cor. O CSS do SVG chega com espaço (" #fff").
const ehBranco = (cor) => { const hsl = new THREE.Color().setStyle(String(cor).trim()).getHSL({}); return hsl.s < 0.15 && hsl.l > 0.8 }
// logo3d(svgTexto, { altura = 1, profundidade (fração da altura), chanfro, materiais(fill) }) → { grupo, pecas }
// Cada <path> vira uma peça animável: { mesh, pivo (Group no centro da peça), centro, fill }.
// Anime pivo.position / pivo.rotation / pivo.scale (a peça gira em torno do próprio centro).
function logo3d(svg, o = {}) {
  const dados = new THREE.SVGLoader().parse(svg)
  const caixa = new THREE.Box2()
  dados.paths.forEach((p) => p.subPaths.forEach((sp) => sp.getPoints().forEach((pt) => caixa.expandByPoint(pt))))
  const tam = caixa.getSize(new THREE.Vector2()), centro = caixa.getCenter(new THREE.Vector2())
  const k = (o.altura ?? 1) / tam.y
  const prof = (o.profundidade ?? 0.1) / k, ch = (o.chanfro ?? 0.012) / k
  const grupo = new THREE.Group(), interno = new THREE.Group(); grupo.add(interno)
  interno.scale.set(k, -k, k)           // SVG tem y para baixo; escala negativa: o three inverte a face sozinho
  const mats = o.materiais || MAT3D.marca
  const cache = {}
  const pecas = dados.paths.map((p) => {
    const fill = (p.userData.style.fill || '#ffffff').toString().trim()
    const formas = p.toShapes(true)
    const geo = new THREE.ExtrudeGeometry(formas, { depth: prof, bevelEnabled: true, bevelThickness: ch, bevelSize: ch * 0.8, bevelSegments: 5, curveSegments: 16 })
    geo.computeBoundingBox()
    const c = geo.boundingBox.getCenter(new THREE.Vector3())
    geo.translate(-c.x, -c.y, -prof / 2)
    const pivo = new THREE.Group(); pivo.position.set(c.x - centro.x, c.y - centro.y, 0); interno.add(pivo)
    const mesh = new THREE.Mesh(geo, cache[fill] || (cache[fill] = mats(fill))); pivo.add(mesh)
    return { mesh, pivo, fill, centro: pivo.position.clone(), base: pivo.position.clone() }
  })
  return { grupo, pecas, largura: tam.x * k, altura: tam.y * k }
}

// texto3d(partes, { fonte, tamanho = 0.3, profundidade, chanfro, italico, espaco }) → { grupo, letras, largura }
// partes: 'TEXTO' ou [{ t: 'ONE', cor: '#fff' }, { t: 'BIO', cor: '#F8C102' }]. A fonte vem de tools/fonte3d.mjs
// (window.FONTES3D). italico: inclinação igual ao itálico sintético do Chromium (0,25, o que o site mostra com
// font-style: italic numa fonte sem arquivo itálico). Uma malha por letra: dá para animar letra a letra (letras[i].pivo).
function texto3d(partes, o = {}) {
  const nomes = Object.keys(window.FONTES3D || {})
  if (!nomes.length) { console.error('3D TEXT WITHOUT FONT: load the .js generated by tools/fonte3d.mjs before the scene'); return { grupo: new THREE.Group(), letras: [], largura: 0 } }
  const fonte = new THREE.Font(FONTES3D[o.fonte || nomes[0]])
  const dados = fonte.data, tam = o.tamanho ?? 0.3, esc = tam / dados.resolution
  const prof = o.profundidade ?? tam * 0.18, ch = o.chanfro ?? tam * 0.025
  const lista = typeof partes === 'string' ? [{ t: partes }] : partes
  const grupo = new THREE.Group(), interno = new THREE.Group(); grupo.add(interno)
  const mats = {}
  const mat = (cor) => mats[cor] || (mats[cor] = MAT3D.marca(cor))
  const cisalha = new THREE.Matrix4().makeShear(0, 0, o.italico === false ? 0 : (o.italico ?? 0.25), 0, 0, 0)
  let x = 0
  const letras = []
  for (const parte of lista) {
    for (const c of parte.t) {
      const gl = dados.glyphs[c] || dados.glyphs['?']
      if (c !== ' ' && gl) {
        const formas = fonte.generateShapes(c, tam)
        const geo = new THREE.ExtrudeGeometry(formas, { depth: prof, bevelEnabled: ch > 0, bevelThickness: ch, bevelSize: ch * 0.7, bevelSegments: 3, curveSegments: 10 })
        geo.applyMatrix4(cisalha)
        geo.computeBoundingBox()
        const cx = (geo.boundingBox.min.x + geo.boundingBox.max.x) / 2, cy = (geo.boundingBox.min.y + geo.boundingBox.max.y) / 2
        geo.translate(-cx, -cy, -prof / 2)
        const pivo = new THREE.Group(); pivo.position.set(x + cx, cy, 0); interno.add(pivo)
        pivo.add(new THREE.Mesh(geo, mat(parte.cor || '#ffffff')))
        letras.push({ c, pivo, base: pivo.position.clone() })
      }
      x += ((gl ? gl.ha : dados.resolution * 0.3) * esc) + (o.espaco ?? 0)
    }
  }
  // centra o conjunto: x no meio da largura, y no meio da altura das maiúsculas
  const capa = (dados.glyphs['H'] ? (dados.boundingBox.yMax * 0.7) : dados.resolution * 0.7) * esc
  interno.position.set(-x / 2, -capa / 2 + (letras.length ? 0 : 0), 0)
  return { grupo, letras, largura: x }
}

// ---------- luz e partículas ----------
// Luz que passa: uma luz de área estreita que cruza o objeto e acende o metal (o brilho é físico).
// luzQuePassa(p3, { w, h, intensidade, cor }) → { luz, set(p, de, ate, alvo) } com de/ate = [x,y,z] e p 0..1
function luzQuePassa(p3, o = {}) {
  const forca = o.intensidade ?? 12
  const luz = new THREE.RectAreaLight(o.cor || '#ffffff', 0, o.w ?? 0.25, o.h ?? 3)
  p3.cena.add(luz)
  const alvo = new THREE.Vector3(...(o.alvo || [0, 0, 0]))
  return {
    luz,
    set(p, de, ate) {
      luz.intensity = p > 0 && p < 1 ? forca * Math.sin(Math.PI * p) : 0
      luz.position.set(lerp(de[0], ate[0], p), lerp(de[1], ate[1], p), lerp(de[2], ate[2], p))
      luz.lookAt(alvo)
    },
  }
}
// Poeira no ar: pontos semeados numa caixa, deriva lenta em função de t. Com dof viram bokeh.
// poeira(p3, { n, caixa: [x, y, z], centro, tam, cor, seed, foraDe }) → { pontos, set(t) }
function poeira(p3, o = {}) {
  const n = o.n ?? 220, [bx, by, bz] = o.caixa || [4, 6, 4], [cx, cy, cz] = o.centro || [0, 0, 0]
  const R = rng(o.seed ?? 7), base = new Float32Array(n * 3), vel = new Float32Array(n * 3), pos = new Float32Array(n * 3)
  // foraDe: [x, y, z] = meia-caixa em volta da origem sem poeira (grão nítido em cima da tela parece sujeira)
  const fora = o.foraDe, dentro = (x, y, z) => fora && Math.abs(x) < fora[0] && Math.abs(y) < fora[1] && Math.abs(z) < fora[2]
  for (let i = 0; i < n; i++) {
    do { base[i * 3] = cx + (R() - 0.5) * bx; base[i * 3 + 1] = cy + (R() - 0.5) * by; base[i * 3 + 2] = cz + (R() - 0.5) * bz }
    while (dentro(base[i * 3], base[i * 3 + 1], base[i * 3 + 2]))
    vel[i * 3] = (R() - 0.5) * 0.04; vel[i * 3 + 1] = 0.02 + R() * 0.05; vel[i * 3 + 2] = (R() - 0.5) * 0.03
  }
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3))
  const dc = document.createElement('canvas'); dc.width = dc.height = 64
  const dg = dc.getContext('2d'), gr = dg.createRadialGradient(32, 32, 0, 32, 32, 32)
  gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.5, 'rgba(255,255,255,.55)'); gr.addColorStop(1, 'rgba(255,255,255,0)')
  dg.fillStyle = gr; dg.fillRect(0, 0, 64, 64)
  const tex = new THREE.CanvasTexture(dc)
  const mat = new THREE.PointsMaterial({ map: tex, color: o.cor || '#ffe3a0', size: o.tam ?? 0.02, sizeAttenuation: true, transparent: true,
    opacity: o.opacidade ?? 0.6, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false })
  const pontos = new THREE.Points(geo, mat); p3.cena.add(pontos)
  return {
    pontos,
    set(t) {
      for (let i = 0; i < n * 3; i += 3) {
        pos[i] = base[i] + vel[i] * t + Math.sin(t * 0.7 + i) * 0.01
        pos[i + 1] = cy + (((base[i + 1] - cy + vel[i + 1] * t) % by) + by * 1.5) % by - by / 2
        pos[i + 2] = base[i + 2] + vel[i + 2] * t
      }
      geo.attributes.position.needsUpdate = true
    },
  }
}

// util: interpolação de vetores e graus
const v3 = (a) => new THREE.Vector3(...a)
const rad = (g) => (g * Math.PI) / 180
