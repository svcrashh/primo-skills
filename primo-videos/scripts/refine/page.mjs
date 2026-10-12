// Refino · checagem da PÁGINA de cada cena, quadro a quadro, sem render de vídeo:
//   1. fonte computada de todo texto visível contra o kit da marca (fora do kit, fonte reserva, itálico/negrito falso);
//   2. área segura de TUDO que pinta (texto, imagem, canvas, forma SVG, caixa com fundo ou borda), não só do texto marcado;
//   3. um PNG com contorno vermelho em cada achado.
// Uso: const { achados, medidas } = await checarPaginas(projeto, { formatos, plataforma, fontesKit, passo, saidaQuadros, cenas })
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'
import { pathToFileURL } from 'node:url'

const require = createRequire(import.meta.url)
const { abrirNavegador } = require('../playwright.cjs')

const FORMATOS = { '16x9': [1920, 1080], '19x9': [2280, 1080], '21x9': [2520, 1080], '9x16': [1080, 1920], '1x1': [1080, 1080], '4x5': [1080, 1350] }
const MAX_QUADROS_POR_CENA = 10
const r2 = (t) => Math.round(t * 100) / 100

/** Cenas do projeto: scenes/NN-nome/ (com dígito no início e scene.js) ou, sem isso, o index.html da raiz (cena null). */
export function listarCenas(projeto, filtro) {
  const dir = path.join(projeto, 'scenes')
  let cenas = []
  if (fs.existsSync(dir)) {
    cenas = fs.readdirSync(dir, { withFileTypes: true })
      .filter((d) => d.isDirectory() && /^\d/.test(d.name) && fs.existsSync(path.join(dir, d.name, 'scene.js')) && fs.existsSync(path.join(dir, d.name, 'index.html')))
      .map((d) => ({ nome: d.name, html: path.join(dir, d.name, 'index.html') }))
      .sort((a, b) => a.nome.localeCompare(b.nome))
  }
  if (!cenas.length && fs.existsSync(path.join(projeto, 'index.html'))) cenas = [{ nome: null, html: path.join(projeto, 'index.html') }]
  if (filtro && filtro.length) cenas = cenas.filter((c) => filtro.includes(c.nome))
  return cenas
}

/** Zonas da interface da plataforma (coordenadas do quadro) ou, sem interface, a margem do formato (só texto, aviso). */
function zonasDe(fmt, pl) {
  const [W, H] = FORMATOS[fmt]
  if (fmt === '9x16' && (!pl || pl === 'reels' || pl === 'tiktok' || pl === 'shorts')) {
    const nome = pl || '9:16'
    return { nome, zonas: [
      { nome: 'topo', desc: `the top of the ${nome} interface`, x0: 0, y0: 0, x1: W, y1: 220, eixo: 'y', borda: (r) => `y ${Math.round(r.y0)} < 220` },
      { nome: 'base', desc: `the bottom of the ${nome} interface (caption, music)`, x0: 0, y0: 1500, x1: W, y1: H, eixo: 'y', borda: (r) => `y ${Math.round(r.y1)} > 1500` },
      { nome: 'botoes', desc: `the ${nome} button strip`, x0: 940, y0: 900, x1: W, y1: 1650, eixo: 'x', borda: (r) => `x ${Math.round(r.x1)} > 940` },
    ], seguro: 'x 70–940, y 250–1450' }
  }
  if (fmt === '9x16' && pl === 'stories') {
    return { nome: 'stories', zonas: [
      { nome: 'topo', desc: 'the top of the stories interface', x0: 0, y0: 0, x1: W, y1: 250, eixo: 'y', borda: (r) => `y ${Math.round(r.y0)} < 250` },
      { nome: 'base', desc: 'the bottom of the stories interface', x0: 0, y0: 1580, x1: W, y1: H, eixo: 'y', borda: (r) => `y ${Math.round(r.y1)} > 1580` },
    ], seguro: 'x 60–1020, y 250–1580' }
  }
  const m = (mx, my, nome) => ({ nome, zonas: [], margem: { x0: mx, y0: my, x1: W - mx, y1: H - my }, seguro: `${Math.round(mx)} px on the sides and ${Math.round(my)} px at the top and bottom` })
  if (pl === 'youtube' || (W > H && pl !== 'feed' && pl !== 'app')) return m(W * 0.05, H * 0.05, pl === 'youtube' ? 'youtube (5%)' : '16:9 (5%)')
  return m(60, 60, `${pl || fmt.replace('x', ':')} (60 px)`)
}

// ---------- o que roda dentro da página (autossuficiente: o Playwright serializa a função) ----------
function instalar() {
  if (window.__refino) return
  // VIDEO, FMT, grain e selo do motor são const/let de script: não estão em window, mas o eval indireto enxerga
  const glob = (n) => { try { return (0, eval)(n) } catch { return undefined } }
  const stage = document.getElementById('stage') || document.body
  const ids = new WeakMap()
  let prox = 1
  const idDe = (e) => { let i = ids.get(e); if (!i) { i = prox++; ids.set(e, i) } return i }
  const vistos = new Set(), porFamilia = new Map()

  const alfa = (c) => { if (!c || c === 'transparent' || c === 'none') return 0; const m = c.match(/rgba?\(([^)]+)\)/); if (!m) return 1; const v = m[1].split(/[\s,/]+/).filter(Boolean); if (v.length < 4) return 1; return v[3].endsWith('%') ? parseFloat(v[3]) / 100 : parseFloat(v[3]) }
  const hex = (c) => { const m = c && c.match(/rgba?\(([^)]+)\)/); if (!m) return c; return '#' + m[1].split(/[\s,/]+/).filter(Boolean).slice(0, 3).map((n) => Math.round(+n).toString(16).padStart(2, '0')).join('').toUpperCase() }
  const curto = (s, n = 40) => { s = (s || '').replace(/\s+/g, ' ').trim(); return s.length > n ? s.slice(0, n - 1) + '…' : s }
  const limpa = (f) => f.trim().replace(/^["']|["']$/g, '')
  const GENERICAS = /^(serif|sans-serif|monospace|cursive|fantasy|system-ui|math|emoji|fangsong|ui-[a-z-]+|-apple-system|blinkmacsystemfont)$/i
  const FORMAS = /^(path|circle|rect|ellipse|polygon|polyline|line)$/
  const SVG_TEXTO = /^(text|tspan|textpath)$/
  const EMOJI = /[\p{Extended_Pictographic}\u{FE0F}\u{200D}\u{1F3FB}-\u{1F3FF}]/gu
  const SO_EMOJI = /^[\s\p{Extended_Pictographic}\u{FE0F}\u{200D}\u{1F3FB}-\u{1F3FF}]+$/u
  // gradiente conta como caixa só se alguma cor tiver alfa ≥ 0,35 (a régua do fundo); brilho que some no transparente não
  const fundoPinta = (bi) => bi && bi !== 'none' && (bi.includes('url(') || (bi.match(/rgba?\([^)]+\)/g) || []).some((c) => alfa(c) >= 0.35))
  const SVG_FORA = new Set(['defs', 'mask', 'clippath', 'pattern', 'marker', 'symbol', 'lineargradient', 'radialgradient', 'filter'])

  // ----- fontes: faces declaradas e prova por medida -----
  const pesoNum = (p) => (p === 'normal' ? 400 : p === 'bold' ? 700 : +p)
  function faces(fam) {
    const f = fam.toLowerCase()
    return [...document.fonts].filter((x) => limpa(x.family).toLowerCase() === f && x.status !== 'error').map((x) => {
      const p = String(x.weight).split(/\s+/).map(pesoNum)
      return { estilo: x.style === 'normal' ? 'normal' : 'italic', faixa: [p[0], p[1] != null ? p[1] : p[0]] }
    })
  }
  // casamento de peso do CSS Fonts (§5.2): qual face o navegador usa para o peso pedido
  function pesoEscolhido(w, faixas) {
    if (faixas.some(([a, b]) => w >= a && w <= b)) return w
    const abaixo = faixas.filter(([, b]) => b < w).map(([, b]) => b), acima = faixas.filter(([a]) => a > w).map(([a]) => a)
    const maxAb = abaixo.length ? Math.max(...abaixo) : null, minAc = acima.length ? Math.min(...acima) : null
    if (w >= 400 && w <= 500) { const ate500 = acima.filter((x) => x <= 500); if (ate500.length) return Math.min(...ate500); return maxAb != null ? maxAb : minAc }
    if (w < 400) return maxAb != null ? maxAb : minAc
    return minAc != null ? minAc : maxAb
  }
  const cacheSint = new Map()
  /** 'italico' | 'negrito' | null: a família existe em @font-face, mas não no estilo/peso pedido (o navegador inventa). */
  function sintetizado(fam, peso, estilo) {
    const k = `${fam}|${peso}|${estilo}`
    if (cacheSint.has(k)) return cacheSint.get(k)
    const fs = faces(fam)
    let r = []
    if (fs.length) {
      const querItalico = estilo !== 'normal'
      const ital = fs.filter((f) => f.estilo === 'italic')
      if (querItalico && !ital.length) r.push('italico')
      const grupo = querItalico && ital.length ? ital : fs.filter((f) => f.estilo === 'normal').length ? fs.filter((f) => f.estilo === 'normal') : fs
      const w = pesoNum(peso), esc = pesoEscolhido(w, grupo.map((f) => f.faixa))
      if (w >= 600 && esc != null && esc < 600) r.push('negrito')   // o Blink engrossa sozinho quando pede ≥ 600 e a face é < 600
    }
    cacheSint.set(k, r)
    return r
  }
  const cv = document.createElement('canvas').getContext('2d')
  const larg = (fonte, s) => { cv.font = fonte; return cv.measureText(s).width }
  const cacheLetra = new Map(), carregadas = new Set()
  /** Letras do texto que NÃO saem na família: com "Fam", monospace e "Fam", serif a largura é a mesma da reserva. */
  async function faltando(fam, peso, estilo, texto) {
    const base = `${estilo} ${peso} 64px`, fonte = `${base} "${fam}"`
    const letras = [...new Set([...texto])].filter((ch) => ch.trim())
    const novas = letras.filter((ch) => !cacheLetra.has(fonte + '|' + ch))
    if (novas.length) {
      const kc = fonte + '|' + novas.join('')
      if (!carregadas.has(kc)) { carregadas.add(kc); await document.fonts.load(fonte, novas.join('')).catch(() => null) }
      for (const ch of novas) {
        const igual = (g) => Math.abs(larg(`${base} "${fam}", ${g}`, ch) - larg(`${base} ${g}`, ch)) < 0.01
        cacheLetra.set(fonte + '|' + ch, igual('monospace') && igual('serif'))
      }
    }
    return letras.filter((ch) => cacheLetra.get(fonte + '|' + ch))
  }

  // ----- geometria e visibilidade (cache por amostra) -----
  let cEst, cOp, cCorte
  const est = (e) => { let s = cEst.get(e); if (!s) { s = getComputedStyle(e); cEst.set(e, s) } return s }
  function opac(e) {
    if (!e || e === document.documentElement) return 1
    if (cOp.has(e)) return cOp.get(e)
    const s = est(e)
    const o = s.display === 'none' ? 0 : parseFloat(s.opacity) * opac(e.parentElement)
    cOp.set(e, o)
    return o
  }
  const ret = (r) => ({ l: r.left, t: r.top, r: r.right, b: r.bottom })
  const inter = (a, b) => { if (!a || !b) return null; const x = { l: Math.max(a.l, b.l), t: Math.max(a.t, b.t), r: Math.min(a.r, b.r), b: Math.min(a.b, b.b) }; return x.r - x.l > 0.5 && x.b - x.t > 0.5 ? x : null }
  const uniao = (a, b) => (!a ? b : !b ? a : { l: Math.min(a.l, b.l), t: Math.min(a.t, b.t), r: Math.max(a.r, b.r), b: Math.max(a.b, b.b) })
  const INF = { l: -1e9, t: -1e9, r: 1e9, b: 1e9 }
  /** O que os ancestrais deixam ver de e (overflow ≠ visible ou clip-path/máscara: corta pela caixa deles). */
  function corte(e) {
    const p = e.parentElement
    if (!p || e === stage) return INF
    if (cCorte.has(e)) return cCorte.get(e)
    let c = corte(p)
    if (p !== stage && c) {
      const s = est(p)
      const cx = s.overflowX !== 'visible', cy = s.overflowY !== 'visible', cp = (s.clipPath && s.clipPath !== 'none') || (s.webkitMaskImage && s.webkitMaskImage !== 'none')
      if (cx || cy || cp) {
        const r = ret(p.getBoundingClientRect())
        c = inter(c, { l: cx || cp ? r.l : -1e9, r: cx || cp ? r.r : 1e9, t: cy || cp ? r.t : -1e9, b: cy || cp ? r.b : 1e9 })
      }
    }
    cCorte.set(e, c)
    return c
  }
  function foraDoDesenho(e) {   // dentro de <defs>, <mask>, <clipPath>…: não aparece por si
    for (let x = e; x && x instanceof SVGElement; x = x.parentElement) if (SVG_FORA.has(x.tagName.toLowerCase())) return true
    return false
  }
  const decorativo = (e) => !!e.closest('[data-decorativo], [data-colisao="false"]')
  function raizSvg(e) { let r = e; while (r.ownerSVGElement) r = r.ownerSVGElement; return r }
  function textoPinta(e, s) {
    if (e instanceof SVGElement) return (s.fill !== 'none' && alfa(s.fill) * parseFloat(s.fillOpacity || 1) > 0.05) || (s.stroke !== 'none' && alfa(s.stroke) * parseFloat(s.strokeOpacity || 1) > 0.05 && parseFloat(s.strokeWidth) > 0)
    if (s.webkitBackgroundClip === 'text' || s.backgroundClip === 'text') return true
    return alfa(s.webkitTextFillColor || s.color) > 0.05 || (parseFloat(s.webkitTextStrokeWidth) > 0 && alfa(s.webkitTextStrokeColor) > 0.05)
  }
  const nomeEl = (e) => { const tag = e.tagName.toLowerCase(), c = typeof e.className === 'string' && e.className.trim() ? '.' + e.className.trim().split(/\s+/)[0] : ''; return tag + c }

  window.__refino = {
    info() {
      const V = glob('VIDEO') || window.VIDEO || {}
      return { fmt: glob('FMT') || window.FMT || null, duracao: V.duracao, formatos: V.formatos || null, plataforma: V.plataforma === undefined ? null : V.plataforma, fontes: V.fontes || null }
    },
    resumo() {
      const familias = {}
      for (const [k, s] of porFamilia) familias[k] = s.size
      return { elementos: vistos.size, familias }
    },
    async amostra(t, cfg) {
      // como o checarQuadro do motor: só conta o que está PARADO (mexe ≤ 2 px em 1/30 s). Entrada, queda e
      // passagem rápida pela interface são movimento, não layout.
      const dt = t + 1 / 30 < cfg.dur ? 1 / 30 : -1 / 30
      await render(t + dt)
      const depois = (await varrer(cfg, false)).unidades
      await render(t)
      const { unidades, fontes, S } = await varrer(cfg, true)
      const W = cfg.W, H = cfg.H
      const quadro = (r) => ({ x0: r.l - S.left, y0: r.t - S.top, x1: r.r - S.left, y1: r.b - S.top })

      // área segura: unidades paradas que entram na interface (ou saem da margem, sem interface)
      const inv = []
      for (const u of unidades.values()) {
        const r = quadro(u.r), w = r.x1 - r.x0, h = r.y1 - r.y0
        if (w * h >= 0.9 * W * H) continue          // fundo, camada
        if (w < 40 && h < 40) continue               // cantinho, ponto, partícula
        const d = depois.get(u.id)
        if (d && Math.max(Math.abs(d.r.l - u.r.l), Math.abs(d.r.t - u.r.t), Math.abs(d.r.r - u.r.r), Math.abs(d.r.b - u.r.b)) > 2) continue
        const conteudo = [...u.tipos].some((x) => x !== 'caixa')
        const zonas = []
        for (const z of cfg.zonas) {
          const ix = Math.min(r.x1, z.x1) - Math.max(r.x0, z.x0), iy = Math.min(r.y1, z.y1) - Math.max(r.y0, z.y0)
          if (ix > 8 && iy > 8) zonas.push({ nome: z.nome, pen: Math.round(z.eixo === 'x' ? ix : iy) })
        }
        if (cfg.margem && u.tipos.has('texto')) {
          const m = cfg.margem
          if (r.x0 < m.x0 - 8) zonas.push({ nome: 'margem-esq', pen: Math.round(m.x0 - r.x0) })
          if (r.x1 > m.x1 + 8) zonas.push({ nome: 'margem-dir', pen: Math.round(r.x1 - m.x1) })
          if (r.y0 < m.y0 - 8) zonas.push({ nome: 'margem-topo', pen: Math.round(m.y0 - r.y0) })
          if (r.y1 > m.y1 + 8) zonas.push({ nome: 'margem-base', pen: Math.round(r.y1 - m.y1) })
        }
        if (zonas.length) inv.push({ id: u.id, r, area: w * h, conteudo, op: u.op, desc: u.tipos.has('texto') && u.tipos.size === 1 ? u.textoDesc : u.desc || u.textoDesc, textos: u.textos, zonas })
      }
      // o que está dentro de outro invasor vai junto com ele (o celular inteiro é um achado, não trinta)
      inv.sort((a, b) => b.area - a.area)
      const raiz = new Map(), grupos = new Map()
      const contem = (a, b) => b.x0 >= a.x0 - 6 && b.y0 >= a.y0 - 6 && b.x1 <= a.x1 + 6 && b.y1 <= a.y1 + 6
      inv.forEach((u, i) => {
        let r = u
        for (let j = 0; j < i; j++) if (contem(inv[j].r, u.r)) { r = raiz.get(inv[j].id); break }
        raiz.set(u.id, r)
        if (!grupos.has(r.id)) grupos.set(r.id, { id: r.id, desc: r.desc, r: r.r, membros: [] })
        grupos.get(r.id).membros.push(u)
      })
      const areas = [...grupos.values()].map((g) => {
        const zonas = {}
        for (const m of g.membros) for (const z of m.zonas) {
          const a = zonas[z.nome] || (zonas[z.nome] = { pen: 0, r: null })
          a.pen = Math.max(a.pen, z.pen)
          a.r = a.r ? { x0: Math.min(a.r.x0, m.r.x0), y0: Math.min(a.r.y0, m.r.y0), x1: Math.max(a.r.x1, m.r.x1), y1: Math.max(a.r.y1, m.r.y1) } : { ...m.r }
        }
        const textos = [...new Set(g.membros.flatMap((m) => m.textos))]
        const caixas = [g.r, ...g.membros.filter((m) => m.id !== g.id && m.textos.length).map((m) => m.r)].slice(0, 8)
        const ops = g.membros.filter((m) => m.conteudo).map((m) => m.op)
        const outros = [...new Set(g.membros.filter((m) => m.conteudo && !m.textos.length).map((m) => m.desc))]
        return { id: g.id, desc: g.desc, r: g.r, conteudo: ops.length > 0, op: ops.length ? Math.max(...ops) : 1, zonas, textos, outros, caixas }
      })
      return { fontes, areas }
    },
  }

  async function render(t) { const p = window.renderAt(t); if (p && p.then) await p }

  async function varrer(cfg, comFontes) {
    cEst = new Map(); cOp = new Map(); cCorte = new Map()
    const S = stage.getBoundingClientRect(), W = cfg.W, H = cfg.H
    const Q = { l: S.left, t: S.top, r: S.left + W, b: S.top + H }
    const kit = cfg.kit.map((f) => f.toLowerCase())
    const motor = [glob('grain'), glob('selo')].filter((x) => x instanceof Element)
    const quadro = (r) => ({ x0: r.l - S.left, y0: r.t - S.top, x1: r.r - S.left, y1: r.b - S.top })
    const unidades = new Map(), fontes = []
    const unidade = (dono, tipo, r, desc, op, texto) => {
      const id = idDe(dono)
      let u = unidades.get(id)
      if (!u) { u = { id, tipos: new Set(), r: null, desc, textos: [], op: 0 }; unidades.set(id, u) }
      u.tipos.add(tipo); u.r = uniao(u.r, r)
      if (tipo !== 'caixa') u.op = Math.max(u.op, op)
      if (tipo === 'texto' && !u.textoDesc) u.textoDesc = desc
      if (texto && !u.textos.includes(texto)) u.textos.push(texto)
    }
    const donoTexto = (e) => {
      if (e instanceof SVGElement) { const s = raizSvg(e), r = s.getBoundingClientRect(); return r.width * r.height >= 0.9 * W * H ? e : s }
      const d = e.closest('[data-colisao]:not([data-colisao="false"])') || e.closest('.line')
      return d && stage.contains(d) ? d : e
    }

    for (const e of stage.querySelectorAll('*')) {
      if (motor.some((m) => m === e || m.contains(e))) continue
      const svg = e instanceof SVGElement, tag = e.tagName.toLowerCase()
      if (svg && foraDoDesenho(e)) continue
      const op = opac(e)
      if (op < 0.05) continue
      const s = est(e)
      if (s.visibility !== 'visible') continue
      const decor = decorativo(e)

      // texto próprio (nó de texto não vazio)
      const nos = []
      for (const n of e.childNodes) if (n.nodeType === 3 && n.textContent.trim()) nos.push(n)
      if (nos.length && (!svg || SVG_TEXTO.test(tag)) && textoPinta(e, s)) {
        let rr = null
        for (const n of nos) { const rg = document.createRange(); rg.selectNodeContents(n); for (const r of rg.getClientRects()) if (r.width > 0.5 && r.height > 0.5) rr = uniao(rr, ret(r)) }
        // o texto também é cortado pelo overflow do próprio elemento (reticências, máscara de letra)
        const proprio = s.overflowX !== 'visible' || s.overflowY !== 'visible' ? ret(e.getBoundingClientRect()) : INF
        const vis = rr && inter(inter(inter(rr, proprio), corte(e)), Q)
        if (vis) {
          const texto = nos.map((n) => n.textContent).join(' ')
          const dono = donoTexto(e), frase = curto(dono.textContent || texto)
          if (comFontes && !SO_EMOJI.test(texto)) {   // emoji sai da fonte de emoji do sistema em qualquer família
            const fam = limpa(s.fontFamily.split(',')[0] || ''), peso = s.fontWeight, estilo = s.fontStyle.startsWith('oblique') ? 'italic' : s.fontStyle
            const chave = `${fam} ${peso}${estilo !== 'normal' ? ' ' + estilo : ''}`
            const id = idDe(e)
            vistos.add(id)
            if (!porFamilia.has(chave)) porFamilia.set(chave, new Set())
            porFamilia.get(chave).add(id)
            const base = { fam, peso, estilo, texto: frase, caixa: quadro(vis) }
            if (kit.length && !kit.includes(fam.toLowerCase())) fontes.push({ ...base, tipo: 'fora' })
            else if (!GENERICAS.test(fam)) {
              for (const tipo of sintetizado(fam, peso, estilo)) fontes.push({ ...base, tipo })
              const falta = await faltando(fam, peso, estilo, texto.replace(EMOJI, ''))
              if (falta.length) fontes.push({ ...base, tipo: 'reserva', falta, tudo: falta.length === [...new Set([...texto.replace(EMOJI, '')])].filter((c) => c.trim()).length })
            }
          }
          if (!decor) unidade(dono, 'texto', vis, `text "${frase}"`, op, frase)
        }
      }
      if (decor) continue

      // o que pinta
      let tipo = null, desc = null
      if (svg) {
        if (FORMAS.test(tag)) {
          const f = s.fill, k = s.stroke
          const temF = f && f !== 'none' && alfa(f) * parseFloat(s.fillOpacity || 1) > 0.05
          const temS = k && k !== 'none' && alfa(k) * parseFloat(s.strokeOpacity || 1) > 0.05 && parseFloat(s.strokeWidth) > 0
          if (temF || temS) { tipo = 'svg'; desc = `svg shape (${temF ? 'fill ' + hex(f) : 'stroke ' + hex(k)})` }
        } else if (tag === 'image' || tag === 'use') { tipo = 'svg'; desc = `svg <${tag}>` }
      } else if (tag === 'img' || tag === 'video') { tipo = 'img'; desc = `image${e.src ? ` "${decodeURIComponent(e.src.split('/').pop()).slice(0, 40)}"` : ''}` }
      else if (tag === 'canvas') { tipo = 'canvas'; desc = 'canvas' }
      else {
        const borda = ['Top', 'Right', 'Bottom', 'Left'].some((l) => parseFloat(s['border' + l + 'Width']) > 0 && s['border' + l + 'Style'] !== 'none' && alfa(s['border' + l + 'Color']) > 0.05)
        if (alfa(s.backgroundColor) >= 0.35) { tipo = 'caixa'; desc = `box ${nomeEl(e)} (background ${hex(s.backgroundColor)})` }
        else if (fundoPinta(s.backgroundImage)) { tipo = 'caixa'; desc = `box ${nomeEl(e)} (${s.backgroundImage.includes('url(') ? 'background image' : 'gradient'})` }
        else if (borda) { tipo = 'caixa'; desc = `box ${nomeEl(e)} (border)` }
      }
      if (!tipo) continue
      const vis = inter(inter(ret(e.getBoundingClientRect()), corte(e)), Q)
      if (!vis) continue
      if (comFontes) vistos.add(idDe(e))
      let dono = e
      if (svg) {
        const raiz = raizSvg(e), r = raiz.getBoundingClientRect()
        if (r.width * r.height < 0.9 * W * H) { dono = raiz; desc = `svg ${raiz.getAttribute('aria-label') ? `"${raiz.getAttribute('aria-label')}"` : nomeEl(raiz)}` }
      }
      unidade(dono, tipo, vis, desc, op)
    }
    return { unidades, fontes, S }
  }
}

// ---------- agrupamento no tempo e mensagens ----------
const kitTxt = (kit) => (kit.length ? kit.join(', ') : 'none')
const caixaDe = (r) => ({ x: Math.round(r.x0), y: Math.round(r.y0), w: Math.round(r.x1 - r.x0), h: Math.round(r.y1 - r.y0) })
const amostraTextos = (set) => { const a = [...set]; return a.slice(0, 3).map((x) => `"${x}"`).join(', ') + (a.length > 3 ? ` and ${a.length - 3} more` : '') }

function achadoFonte(g, ctx) {
  const { tipo, fam, peso, estilo } = g.q
  const pesos = [...g.pesos].sort().join(', ')
  const quem = `${amostraTextos(g.textos)} in ${fam} ${pesos}${estilo !== 'normal' ? ' italic' : ''}`
  let msg, oque
  if (tipo === 'fora') {
    msg = `text ${quem}, outside the brand kit (${kitTxt(ctx.kit)})`
    oque = `change it to the kit font (${kitTxt(ctx.kit)}); if the outside font is on purpose (imitating another app, for example), add "${fam}" to fontesKit`
  } else if (tipo === 'reserva') {
    const falta = [...g.falta]
    msg = g.tudo
      ? `text ${quem} fell back to the fallback font: no face of "${fam}" was used (measured on a canvas: the width is the same with monospace and with serif)`
      : `text ${quem}: the letters ${falta.slice(0, 12).join(' ')} do not exist in the font and came out in the fallback font`
    oque = g.tudo
      ? `check the @font-face of "${fam}" (file, family name, weight ${peso}${estilo !== 'normal' ? ' italic' : ''}) and whether it is in VIDEO.fontes`
      : 'regenerate the fonts with the subset that has these letters (scripts/fonts.mjs, latin-ext) or change the character'
  } else if (tipo === 'italico') {
    msg = `text ${quem}: fake italic — "${fam}" has no italic face loaded, the browser slants the regular one (the letterforms change)`
    oque = `include the italic face of "${fam}" in fonts.css (scripts/fonts.mjs) or use font-style normal`
  } else {
    msg = `text ${quem}: fake bold — "${fam}" has no face with weight ≥ 600, the browser thickens the lighter one`
    oque = `include the ${peso} face of "${fam}" in fonts.css (scripts/fonts.mjs) or use a weight that exists`
  }
  return { checagem: 'fonte', nivel: 'erro', cena: ctx.cena, formato: ctx.fmt, t: r2(g.t), ...(g.fim > g.t ? { fim: r2(g.fim) } : {}), msg, oque_fazer: oque, caixas: g.caixas.slice(0, 12).map(caixaDe) }
}

function achadoArea(g, ctx) {
  const margem = !ctx.zonas.zonas.length
  const zs = Object.entries(g.zonas)
  const onde = margem
    ? `leaves the ${ctx.zonas.nome} margin (${zs.map(([k, v]) => {
      const m = ctx.zonas.margem, r = v.r
      return k === 'margem-esq' ? `x ${Math.round(r.x0)} < ${Math.round(m.x0)}` : k === 'margem-dir' ? `x ${Math.round(r.x1)} > ${Math.round(m.x1)}` : k === 'margem-topo' ? `y ${Math.round(r.y0)} < ${Math.round(m.y0)}` : `y ${Math.round(r.y1)} > ${Math.round(m.y1)}`
    }).join('; ')})`
    : 'enters ' + zs.map(([k, v]) => { const z = ctx.zonas.zonas.find((x) => x.nome === k); return `${z.desc} (${z.borda(v.r)}, ${v.pen} px)` }).join(' and ')
  const r = g.r
  const dentro = [g.textos.length && !g.desc.startsWith('text "') ? `text ${amostraTextos(new Set(g.textos))}` : '', ...g.outros.filter((x) => x !== g.desc)]
    .filter(Boolean).join(', ')
  const fraco = g.conteudo && g.op < 0.6 ? ` (faded, opacity ${g.op.toFixed(2)})` : ''
  const msg = `${g.desc} at x ${Math.round(r.x0)}–${Math.round(r.x1)}, y ${Math.round(r.y0)}–${Math.round(r.y1)} ${onde}${dentro ? '; inside it, also in the zone: ' + dentro : ''}${fraco}`
  const oque = margem
    ? `bring the text inside the ${ctx.zonas.nome} margin (${ctx.zonas.seguro}) with L({...}), a smaller size or a line break`
    : g.conteudo
      ? `bring it inside ${ctx.zonas.seguro} (position or scale per format with L({...})); whatever sits under the interface disappears on the phone`
      : `it is only a painted box: if it is a decorative background it can stay, otherwise pull it back to ${ctx.zonas.seguro}; if it goes underneath on purpose, mark it data-colisao="false"`
  return { checagem: 'area-segura', nivel: margem ? 'aviso' : g.conteudo ? 'erro' : 'aviso', cena: ctx.cena, formato: ctx.fmt, t: r2(g.t), ...(g.fim > g.t ? { fim: r2(g.fim) } : {}), tQuadro: r2(g.tQuadro ?? g.t), msg: g.fim > g.t ? `${msg} (worst at ${r2(g.tQuadro ?? g.t)} s)` : msg, oque_fazer: oque, caixas: g.caixas.map(caixaDe) }
}

async function abrir(browser, html, fmt) {
  const [W, H] = fmt ? FORMATOS[fmt] : [1080, 1920]
  const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 })
  const erros = []
  page.on('pageerror', (e) => erros.push('PAGE ERROR: ' + e.message))
  page.on('console', (m) => { if (m.type() === 'error') erros.push('CONSOLE: ' + m.text()) })
  await page.goto(pathToFileURL(html).href + (fmt ? `?f=${fmt}` : ''))
  try { await page.waitForFunction('window.__ready === true', null, { timeout: 60000 }) } catch {
    await page.close()
    throw new Error(`the page ${html} was not ready within 60 s${erros.length ? ':\n' + erros.join('\n') : ''}`)
  }
  await page.evaluate(instalar)
  return { page, erros }
}

/**
 * Checa as páginas das cenas (ou o index.html da raiz) quadro a quadro.
 * @param {string} projeto pasta do vídeo (com scenes/NN-nome/ ou index.html na raiz)
 * @param {{ formatos?: string[], plataforma?: string|object|null, fontesKit?: string[], sinteticoOk?: string[], passo?: number, saidaQuadros?: string, cenas?: string[] }} [opcoes]
 *   sinteticoOk: ['Família:italico'] — estilo que o produto sintetiza de propósito (o gabarito diz), não vira erro
 * @returns {Promise<{ achados: object[], medidas: object }>}
 */
export async function checarPaginas(projeto, opcoes = {}) {
  projeto = path.resolve(projeto)
  const passo = opcoes.passo || 0.5
  const sinteticoOk = new Set((opcoes.sinteticoOk || []).map((x) => x.toLowerCase().replace('itálico', 'italico')))
  const cenas = listarCenas(projeto, opcoes.cenas)
  if (!cenas.length) throw new Error(`no scene in ${projeto} (neither scenes/NN-nome/ with scene.js nor index.html at the root)`)
  if (opcoes.saidaQuadros) fs.mkdirSync(opcoes.saidaQuadros, { recursive: true })
  const { browser } = await abrirNavegador(projeto)
  const achados = [], medidas = {}
  try {
    for (const c of cenas) {
      const chaveCena = c.nome || '(raiz)'
      medidas[chaveCena] = {}
      // a primeira abertura (no formato padrão da página) diz formatos, plataforma, fontes e duração
      const sonda = await abrir(browser, c.html, opcoes.formatos && opcoes.formatos[0])
      const info0 = await sonda.page.evaluate(() => window.__refino.info())
      const formatos = opcoes.formatos || info0.formatos || ['16x9', '9x16']
      let quadrosCena = 0
      for (const fmt of formatos) {
        if (!FORMATOS[fmt]) throw new Error(`unknown format: ${fmt}`)
        const t0 = Date.now()
        const aberta = fmt === info0.fmt ? sonda : await abrir(browser, c.html, fmt)
        const { page } = aberta
        const info = fmt === info0.fmt ? info0 : await page.evaluate(() => window.__refino.info())
        const plBruta = opcoes.plataforma !== undefined ? opcoes.plataforma : info.plataforma
        const pl = plBruta && typeof plBruta === 'object' ? plBruta[fmt] || null : plBruta || null
        const kit = opcoes.fontesKit || info.fontes || []
        const zonas = zonasDe(fmt, pl)
        const [W, H] = FORMATOS[fmt]
        await page.setViewportSize({ width: W, height: H })
        const dur = +info.duracao || 0
        const cfg = { W, H, dur, kit, zonas: zonas.zonas.map(({ nome, x0, y0, x1, y1, eixo }) => ({ nome, x0, y0, x1, y1, eixo })), margem: zonas.margem || null }
        const tempos = []
        for (let k = 0; k * passo < dur - 1e-6; k++) tempos.push(r2(k * passo))
        if (dur > 0 && dur - tempos[tempos.length - 1] > passo / 2) tempos.push(r2(dur - 1 / 60))   // o último quadro (cartão final parado)
        const gFonte = new Map(), gArea = new Map()
        for (const t of tempos) {
          const res = await page.evaluate(([t, cfg]) => window.__refino.amostra(t, cfg), [t, cfg])
          const primeiraVez = new Set()
          for (const q of res.fontes) {
            // o que o produto sintetiza de propósito (a família não tem itálico e o próprio site inclina) não é defeito
            if ((q.tipo === 'italico' || q.tipo === 'negrito') && sinteticoOk.has(`${q.fam}:${q.tipo === 'italico' ? 'italico' : 'negrito'}`.toLowerCase())) continue
            // fora do kit: um por família; itálico falso: família + estilo; negrito falso e reserva: família + peso + estilo
            const k = q.tipo === 'fora' ? `fora|${q.fam}` : q.tipo === 'italico' ? `italico|${q.fam}|${q.estilo}` : `${q.tipo}|${q.fam}|${q.peso}|${q.estilo}`
            let g = gFonte.get(k)
            if (!g) { g = { q, t, fim: t, textos: new Set(), pesos: new Set(), caixas: [], falta: new Set(), tudo: true }; gFonte.set(k, g); primeiraVez.add(k) }
            g.fim = t
            g.pesos.add(q.peso)
            if (g.textos.size < 20) g.textos.add(q.texto)
            if (primeiraVez.has(k) && g.caixas.length < 12) g.caixas.push(q.caixa)
            if (q.falta) { q.falta.forEach((x) => g.falta.add(x)); g.tudo = g.tudo && q.tudo }
          }
          for (const a of res.areas) {
            const k = String(a.id)
            let g = gArea.get(k)
            if (!g) { g = { ...a, t, fim: t, zonas: {}, textos: [], outros: [], pior: -1 }; gArea.set(k, g) }
            g.fim = t
            // a caixa, a mensagem e o quadro marcado são os do pior instante, não os do primeiro
            const pen = Math.max(0, ...Object.values(a.zonas).map((v) => v.pen))
            if (pen > g.pior) Object.assign(g, { pior: pen, tQuadro: t, r: a.r, caixas: a.caixas, desc: a.desc })
            g.conteudo = g.conteudo || a.conteudo
            g.op = Math.max(g.op, a.op)
            for (const [z, v] of Object.entries(a.zonas)) if (!g.zonas[z] || v.pen > g.zonas[z].pen) g.zonas[z] = v
            for (const x of a.textos) if (!g.textos.includes(x) && g.textos.length < 8) g.textos.push(x)
            for (const x of a.outros) if (!g.outros.includes(x) && g.outros.length < 2) g.outros.push(x)
          }
        }
        const ctx = { cena: c.nome, fmt, kit, zonas }
        const novos = [...[...gFonte.values()].map((g) => achadoFonte(g, ctx)), ...[...gArea.values()].map((g) => achadoArea(g, ctx))]
          .sort((a, b) => a.t - b.t)

        // quadros marcados: erros primeiro, no máximo MAX_QUADROS_POR_CENA por cena
        if (opcoes.saidaQuadros) {
          const fila = [...novos].sort((a, b) => (a.nivel === b.nivel ? a.t - b.t : a.nivel === 'erro' ? -1 : 1))
          const usados = new Set()
          for (const a of fila) {
            if (quadrosCena >= MAX_QUADROS_POR_CENA) break
            const tq = a.tQuadro ?? a.t
            let nome = `${a.checagem}-${c.nome || 'raiz'}-${fmt}-${tq.toFixed(2)}`
            for (let n = 2; usados.has(nome); n++) nome = `${a.checagem}-${c.nome || 'raiz'}-${fmt}-${tq.toFixed(2)}-${n}`
            usados.add(nome)
            const arq = path.join(opcoes.saidaQuadros, nome + '.png')
            const clip = await page.evaluate(async ([t, caixas]) => {
              const p = window.renderAt(t)
              if (p && p.then) await p
              const stage = document.getElementById('stage') || document.body
              for (const c of caixas) {
                const d = document.createElement('div')
                d.className = '__refino-contorno'
                Object.assign(d.style, { position: 'absolute', left: c.x + 'px', top: c.y + 'px', width: c.w + 'px', height: c.h + 'px', outline: '6px solid #FF2020', zIndex: 2147483647, pointerEvents: 'none', boxSizing: 'border-box' })
                stage.appendChild(d)
              }
              const r = stage.getBoundingClientRect()
              return { x: r.left, y: r.top }
            }, [tq, a.caixas || []])
            await page.screenshot({ path: arq, clip: { x: clip.x, y: clip.y, width: W, height: H } })
            await page.evaluate(() => document.querySelectorAll('.__refino-contorno').forEach((d) => d.remove()))
            a.quadro = arq
            quadrosCena++
          }
        }
        achados.push(...novos)
        const resumo = await page.evaluate(() => window.__refino.resumo())
        medidas[chaveCena][fmt] = { amostras: tempos.length, passo, duracao: dur, plataforma: pl, kit, familias: resumo.familias, elementos: resumo.elementos,
          segundos: r2((Date.now() - t0) / 1000), ...(aberta.erros.length ? { errosPagina: [...new Set(aberta.erros)] } : {}) }
        if (aberta !== sonda) await page.close()
      }
      await sonda.page.close().catch(() => {})
    }
  } finally {
    await browser.close()
  }
  return { achados, medidas }
}

