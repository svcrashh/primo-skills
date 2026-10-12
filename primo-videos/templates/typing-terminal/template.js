// Terminal que se digita: o que foi digitado e o que o programa respondeu, de verdade (terminal.json do record-terminal.mjs).
// Contrato do render.cjs: FMT, VIDEO.duracao, window.renderAt(t), window.__ready.
const FORMATOS = { '16x9': [1920, 1080], '19x9': [2280, 1080], '21x9': [2520, 1080], '9x16': [1080, 1920], '1x1': [1080, 1080], '4x5': [1080, 1350] }
const FMT = new URLSearchParams(location.search).get('f') || PARAMS.formatos[0]
if (!FORMATOS[FMT]) throw new Error(`unknown format: ${FMT} (use ${Object.keys(FORMATOS).join(', ')})`)
const [W, H] = FORMATOS[FMT]
const C = PARAMS.cores, T = PARAMS.terminal
const vertical = H > W
// opcionais, desligados por padrão: "coluna": "esquerda" (nos horizontais, a legenda vira uma coluna grande à esquerda
// e a janela fica à direita, com o texto do terminal em 46 px) e "camera": { "de": 0.85, "origem": [x, y] } (a janela
// começa com essa escala e chega ao tamanho dela no fim do terminal, a partir de origem, em fração da janela)
const COL = PARAMS.coluna === 'esquerda' && !vertical
const fs_ = vertical ? 50 : COL ? 46 : 56, lh = Math.round(fs_ * 1.5)
const st = document.getElementById('stage'); st.style.cssText = `width:${W}px;height:${H}px;background:${C.fundo}`
const win = document.getElementById('win'), bar = document.getElementById('bar'), corpo = document.getElementById('corpo'), txt = document.getElementById('txt'), leg = document.getElementById('leg')
// 19:9 e 21:9: a janela é a do 16:9 esticada na largura (a margem cresce com W; corpo e alturas, não) e 12 px mais
// curta, para a legenda caber nos 5% de baixo da área segura; "areaSegura": true faz o mesmo no 16:9 (desligado por padrão)
const largo = W / H > 16 / 9 + 0.01, sobe = largo || (PARAMS.areaSegura && !vertical) ? 12 : 0
const mx = vertical ? 60 : Math.round(110 * (largo ? W / 1920 : 1)), my = vertical ? 260 : 90
Object.assign(win.style, { left: mx + 'px', top: my + 'px', width: W - 2 * mx + 'px', height: H - 2 * my - (vertical ? 120 : sobe) + 'px', background: C.janela })
const colW = Math.round(600 * W / 1920), colGap = Math.round(70 * W / 1920)
if (COL) Object.assign(win.style, { left: mx + colW + colGap + 'px', width: W - 2 * mx - colW - colGap + 'px', height: H - 2 * my + 'px' })
const barH = 64
Object.assign(bar.style, { height: barH + 'px', background: C.barra, paddingLeft: '26px' })
// "moldura": false tira a sombra e os três botões da janela (cores de fora de qualquer marca)
if (PARAMS.moldura === false) win.style.boxShadow = 'none'
else for (const cor of ['#ff5f57', '#febc2e', '#28c840']) { const i = document.createElement('i'); i.style.cssText = `width:18px;height:18px;background:${cor}`; bar.insertBefore(i, bar.lastElementChild) }
const tit = document.getElementById('tit'); tit.textContent = T.titulo; tit.style.cssText += `;top:${barH / 2 - 14}px;font-size:24px;color:${C.texto}`
if (PARAMS.fonte) for (const e of [tit, leg]) e.style.fontFamily = `"${PARAMS.fonte}", -apple-system, Helvetica, sans-serif`
if (PARAMS.mono) txt.style.fontFamily = `"${PARAMS.mono}", monospace`   // a mono do sistema que existe (ex.: Menlo no Mac)
Object.assign(corpo.style, { top: barH + 'px', height: parseInt(win.style.height) - barH + 'px' })
Object.assign(txt.style, { left: '36px', right: '36px', fontSize: fs_ + 'px', lineHeight: lh + 'px', color: C.texto, width: parseInt(win.style.width) - 72 + 'px' })
Object.assign(leg.style, { left: mx + 'px', width: W - 2 * mx + 'px', top: vertical ? H - 220 + 'px' : H - my + 6 - sobe + 'px', fontSize: (vertical ? 44 : 34) + 'px', color: C.legenda, lineHeight: '1.2' })
if (COL) Object.assign(leg.style, { width: colW + 'px', top: '0px', height: H + 'px', display: 'flex', alignItems: 'center', textAlign: 'left', fontSize: '64px', lineHeight: '1.1', textWrap: 'balance' })
const CAMV = PARAMS.camera && PARAMS.camera.de ? PARAMS.camera : null
if (CAMV) win.style.transformOrigin = `${(CAMV.origem || [0.5, 0.5])[0] * 100}% ${(CAMV.origem || [0.5, 0.5])[1] * 100}%`

// ritmo humano semeado: cada tecla tem um atraso; o mesmo vídeo sai sempre igual
let sem = 7; const rnd = () => ((sem = (sem * 16807) % 2147483647) / 2147483647)
const CPS = T.cps || 13
const linha = []
let t = T.inicio ?? 0.4
const cmds = T.comandos.map((c) => {
  const teclas = [...c.cmd].map(() => (0.6 + rnd() * 0.8) / CPS)
  const ini = t, fimDig = ini + teclas.reduce((s, x) => s + x, 0), enter = fimDig + 0.28
  let tl = enter + 0.12, ls = []
  const passo = Math.max(0.05, T.linhaMin ?? 0.05)
  c.saida.forEach((l, i) => { const dt = i === 0 ? 0 : Math.min(Math.max(0.5, passo), Math.max(passo, l.t - c.saida[i - 1].t)); tl += dt; ls.push({ t: tl, texto: l.texto }) })
  const acabou = ls.length ? ls[ls.length - 1].t : enter
  t = acabou + (T.pausa ?? 1.3)
  return { ...c, ini, teclas, fimDig, enter, ls, acabou, tFim: t }
})
const duracao = Math.max(T.duracao || 0, t + 0.3)
// fecho opcional: depois do terminal, corte seco para o fundo do fecho com o logo centrado, entrando e parado
const F = PARAMS.fecho
const VIDEO = { titulo: PARAMS.nome, duracao: +(duracao + (F ? F.dur : 0)).toFixed(3), formatos: PARAMS.formatos, ...(F ? { fechoEm: +duracao.toFixed(3) } : {}) }

const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;')
const CORES = { 30: '#6b7280', 31: '#ff6b6b', 32: '#7ee787', 33: '#f2cc60', 34: '#79c0ff', 35: '#d2a8ff', 36: '#76e3ea', 37: C.texto, 90: '#8b949e', 91: '#ff8080', 92: '#9be9a8', 93: '#f8e08e', 94: '#a5d6ff', 95: '#e2c5ff', 96: '#a5f3fc', 97: '#ffffff' }
function ansi(s) {
  let out = '', aberto = false
  for (const parte of s.replace(/\x1b\[[0-9;?]*[A-Za-ln-z]/g, '').split(/(\x1b\[[0-9;]*m)/)) {
    const m = parte.match(/^\x1b\[([0-9;]*)m$/)
    if (!m) { out += esc(parte); continue }
    if (aberto) { out += '</span>'; aberto = false }
    const cods = m[1].split(';').map(Number); let css = ''
    for (const c of cods) { if (c === 1) css += 'font-weight:700;'; else if (CORES[c]) css += `color:${CORES[c]};` }
    if (css) { out += `<span style="${css}">`; aberto = true }
  }
  return out + (aberto ? '</span>' : '')
}
const prompt = `<span style="color:${C.prompt}">${esc(T.prompt)}</span> `

window.renderAt = (tt) => {
  const linhas = []
  let cursorEm = -1
  cmds.forEach((c, k) => {
    if (tt < c.ini) return
    const n = tt >= c.fimDig ? c.cmd.length : (() => { let a = c.ini, i = 0; while (i < c.teclas.length && a + c.teclas[i] <= tt) a += c.teclas[i++]; return i })()
    linhas.push(prompt + `<span style="color:${C.comando}">${esc([...c.cmd].slice(0, n).join(''))}</span>`)
    if (tt < c.enter) cursorEm = linhas.length - 1
    else {
      for (const l of c.ls) if (tt >= l.t) linhas.push(ansi(l.texto) || '&nbsp;')
      const proximo = cmds[k + 1]
      if (tt >= c.acabou && !(proximo && tt >= proximo.ini)) { linhas.push(prompt); cursorEm = linhas.length - 1 }
    }
  })
  const digitando = cmds.some((c) => tt >= c.ini && tt < c.fimDig)
  const piscar = digitando || Math.floor(tt * 2) % 2 === 0
  const cursor = `<span class="cur" style="width:${Math.round(fs_ * 0.6)}px;height:${Math.round(fs_ * 1.1)}px;background:${piscar ? C.cursor : 'transparent'}"></span>`
  txt.innerHTML = linhas.map((l, i) => `<div>${l}${i === cursorEm ? cursor : ''}</div>`).join('')
  const alturaVisivel = parseInt(corpo.style.height) - 48
  const total = txt.getBoundingClientRect().height
  txt.style.top = 24 - Math.max(0, total - alturaVisivel) + 'px'
  const ativo = cmds.find((c) => tt >= c.ini - 0.1 && tt < c.tFim)
  leg.textContent = ativo ? ativo.legenda : ''
  if (CAMV) win.style.transform = `scale(${CAMV.de + (1 - CAMV.de) * Math.min(1, Math.max(0, tt / duracao))})`   // velocidade constante: o quadro nunca para
  if (fecho) {
    const dt = tt - VIDEO.fechoEm
    fecho.lay.style.display = dt >= 0 ? 'block' : 'none'
    const k = Math.min(1, Math.max(0, (dt - 0.12) / 0.5)), e = 1 - (1 - k) ** 3
    fecho.img.style.opacity = e
    fecho.img.style.transform = `translateY(${(1 - e) * 28}px)`
  }
}
let fecho = null
const espera = []
if (F) {
  const lay = document.createElement('div'), img = document.createElement('img')
  const lw = Math.round(F.largura ?? Math.min(W, H) * 0.6)
  lay.style.cssText = `position:absolute;left:0;top:0;width:${W}px;height:${H}px;background:${F.fundo};display:none`
  img.style.cssText = `position:absolute;left:${Math.round((W - lw) / 2)}px;width:${lw}px;height:auto`
  img.src = F.logo
  lay.appendChild(img); st.appendChild(lay)
  fecho = { lay, img }
  espera.push(img.decode().then(() => { img.style.top = Math.round((H - lw * img.naturalHeight / img.naturalWidth) / 2) + 'px' })
    .catch(() => console.error('CLOSING LOGO DID NOT LOAD: ' + F.logo)))
}
if (PARAMS.fonte) espera.push(...['400 24px', '700 34px', '700 44px'].map((f) => document.fonts.load(`${f} "${PARAMS.fonte}"`)))
const pronto = () => { window.renderAt(0); window.__ready = true }
if (espera.length) Promise.all(espera).then(() => {
  if (PARAMS.fonte && !document.fonts.check(`700 34px "${PARAMS.fonte}"`)) console.error('FONT DID NOT LOAD: ' + PARAMS.fonte)
  pronto()
})
else pronto()
