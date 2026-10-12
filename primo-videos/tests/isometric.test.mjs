// node --test tests/isometric.test.mjs   (sem rede): o molde isometrico.
// O plano (scene/plan.js) roda no Node: validação com mensagem útil, tempos de cada camada e marcos de som; o JSON do
// visual antigo (chao, chaoAlfa, fantasma) continua valendo. O render.mjs recusa parâmetro errado antes de criar
// qualquer pasta. Com o Chromium da skill (scripts/playwright.cjs), a obra monta sem render (--assemble-only, com a Inter dos
// exemplos) e compõe em 16:9, 9:16 e 1:1 sem problema na checagem de quadros, com o JSON mínimo (parâmetros padrão) e com o
// exemplo; no fecho, só o logo aparece. No 16:9, a pilha é WebGL e o quadro (sem os textos) só tem o fundo e o hex exato
// de cada face: nada de chão, sombra, gradiente ou cor fora da paleta, fora o antialiasing das bordas. O modo "aparelho"
// (bandeja, teclas com os ícones da marca, monitor com a tela de progresso) segue a linha do tempo fixa do modo, recusa o que
// não cabe nele e, no Chromium, passa na checagem com os fios horizontais e os rótulos numa coluna de espaço igual.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import zlib from 'node:zlib'
import { spawnSync } from 'node:child_process'
import { createRequire } from 'node:module'
import { fileURLToPath, pathToFileURL } from 'node:url'

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const MOLDE = path.join(RAIZ, 'templates', 'isometric')
const require = createRequire(import.meta.url)
const { validarIso, planejarIso } = require(path.join(MOLDE, 'scene', 'plan.js'))
const ler = (f) => JSON.parse(fs.readFileSync(path.join(MOLDE, f), 'utf8'))
const EXEMPLOS = fs.readdirSync(MOLDE).filter((f) => /^example.*\.json$/.test(f))
const LOGO = path.join(RAIZ, 'assets', 'example', 'logo-placeholder.png')

// o mínimo que o molde pede: o resto fica no padrão (rótulos à direita, órbita, corte seco, ritmo médio)
const cor = (t, f, l) => ({ topo: t, frente: f, lado: l })
const minimo = () => ({
  nome: 'teste-minimo',
  marca: { fonte: 'Inter', cores: { fundo: '#1D1D1D', texto: '#F5F5F5', linha: '#F5F5F5' } },
  camadas: [
    { rotulo: 'A base', detalhe: 'o que sustenta', cor: cor('#F5F5F5', '#EBEBEB', '#DEDEDE') },
    { rotulo: 'O meio', cor: cor('#E8E8E8', '#D6D6D6', '#666666'), partes: 3 },
    { rotulo: 'O topo', cor: cor('#C7C7C7', '#A8A8A8', '#848484') },
  ],
  fecho: { logo: LOGO, fundo: '#F5F5F5' },
})

// outra marca (escura, outra fonte): órbita com giro e inclinação escolhidos, a base mais alta, o topo em 3 blocos
const giroEscolhido = () => ({
  nome: 'teste-giro',
  formatos: ['16x9', '9x16'],
  chamada: 'O que tem num pacote',
  rotulos: 'direita', camera: 'orbita', giro: [70, 25], inclinacao: 34, transicao: 'mascara', ritmo: 'medio',
  marca: {
    nome: 'Marca', fonte: 'Rubik', pesos: { rotulo: 600, detalhe: 400, chamada: 500 },
    cores: { fundo: '#101820', texto: '#F5F0E6', apoio: '#F5F0E6', linha: '#E07A1F', chao: '#22303C', chamadaFundo: '#E07A1F', chamadaTexto: '#101820' },
    fantasma: { cor: '#F5F0E6', alfa: 0.18 },
    chaoAlfa: 0.8,
  },
  camadas: [
    { rotulo: 'A base', detalhe: 'tudo num lugar só', cor: cor('#F5F0E6', '#E2D6C2', '#C4B59C'), altura: 1.3 },
    { rotulo: 'O meio', detalhe: 'um endereço para tudo', cor: cor('#F2A05A', '#E07A1F', '#A85A14') },
    { rotulo: 'O topo', detalhe: 'três canais lado a lado', cor: cor('#4A7398', '#365C80', '#244260'), partes: 3 },
  ],
  fecho: { logo: 'logo.png', fundo: '#101820', largura: 620, dur: 2.2 },
})

test('os exemplos passam na validação e cada camada cai, pousa e é nomeada em ordem', () => {
  const CASOS = [...EXEMPLOS.map((f) => [f, ler(f)]), ['giro escolhido (outra marca)', giroEscolhido()]]
  assert.ok(EXEMPLOS.length >= 2 && CASOS.length >= 3, `esperava os 2 exemplos ou mais e a outra marca, achei ${EXEMPLOS.join(', ')}`)
  for (const [f, P] of CASOS) {
    assert.deepEqual(validarIso(P), [], f)
    const pl = planejarIso(P)
    assert.ok(pl.dur >= 6 && pl.dur <= 15, `${f}: ${pl.dur} s fora de 6–15 s`)
    if (pl.modo === 'pilha') assert.ok(pl.camadas[0].pousa <= 0.2, `${f}: a base tem de estar no quadro 0`)
    else assert.ok(pl.camadas[0].entra < 0 && pl.camadas[0].pousa <= 0.35, `${f}: a bandeja já está caindo no quadro 0`)
    pl.camadas.forEach((c, i) => {
      assert.ok(c.entra < c.pousa && c.pousa < c.nomeia, `${f}: camada ${i + 1} fora de ordem`)
      if (i) assert.ok(c.entra > pl.camadas[i - 1].nomeia, `${f}: a camada ${i + 1} cai antes de a de baixo ser nomeada`)
    })
    assert.ok(pl.fecho.em > pl.camadas.at(-1).nomeia, `${f}: o fecho vem depois da última camada`)
    assert.ok(pl.fecho.dur >= 2, `${f}: o logo fica parado pelo menos 2 s`)
    const ts = pl.marcos.map((m) => m.t)
    assert.deepEqual(ts, [...ts].sort((a, b) => a - b), `${f}: marcos fora de ordem`)
    assert.equal(pl.marcos.at(-1).som, 'acento', `${f}: o último som é o acento do logo`)
    assert.equal(pl.marcos.filter((m) => m.som === 'blip').length, pl.camadas.length, `${f}: um blip por camada nomeada`)
  }
})

test('o JSON do visual antigo vale: chao, chaoAlfa e fantasma são aceitos (mesmo fora do formato) e ignorados', () => {
  const P = minimo()
  P.marca.cores.chao = '#666666'; P.marca.chaoAlfa = 0.45; P.marca.fantasma = { cor: '#D6D6D6', alfa: 0.2 }
  assert.deepEqual(validarIso(P), [])
  P.marca.cores.chao = 'verde'; P.marca.fantasma = { cor: 'claro', alfa: 2 }
  assert.deepEqual(validarIso(P), [])
  assert.deepEqual(planejarIso(P).camadas.map((c) => c.pousa), planejarIso(minimo()).camadas.map((c) => c.pousa))
})

test('modo aparelho: a linha do tempo fixa (bandeja, teclas uma a uma, monitor, digitação até 100%, pronto, logo)', () => {
  const P = ler('example-device.json')
  assert.deepEqual(validarIso(P), [])
  const pl = planejarIso(P), A = pl.aparelho
  assert.equal(pl.modo, 'aparelho')
  assert.deepEqual([A.bandeja.entra, A.bandeja.pousa, A.bandeja.nomeia], [-0.3, 0.3, 0.5])
  assert.deepEqual(A.teclas.map((q) => q.pousa), [1.16, 1.3, 1.44, 1.58])
  assert.deepEqual([A.teclasNomeia, A.monitor.dobradica, A.monitor.aberto, A.monitor.nomeia], [1.8, 1.9, 2.75, 2.85])
  assert.equal(A.toques.length, 10)
  assert.deepEqual([A.toques[0].t, A.toques.at(-1).t, A.checado], [3, 4.8, 5.05])
  assert.deepEqual([pl.fecho.em, pl.dur], [6.6, 9])
  const sons = (som) => pl.marcos.filter((m) => m.som === som)
  assert.equal(sons('blip').length, 3, 'um blip por rótulo')
  assert.equal(sons('clique').length, 10, 'um clique por toque')
  assert.equal(sons('baque').length, 5, 'a bandeja e as 4 teclas pousam')
  assert.equal(pl.marcos.at(-1).som, 'acento')
  // com 3 teclas, a mesma cena, só mais curta na fileira
  const P3 = JSON.parse(JSON.stringify(P)); P3.camadas[1].pecas = P3.camadas[1].pecas.slice(0, 3)
  assert.deepEqual(validarIso(P3), [])
  assert.equal(planejarIso(P3).aparelho.teclas.length, 3)
})

test('modo aparelho: parâmetro errado dá uma mensagem que diz o que fazer', () => {
  const casos = [
    [(P) => { P.modo = 'maquete' }, /"modo": "maquete" does not exist: use pilha .* \| aparelho/],
    [(P) => { P.camadas = P.camadas.slice(0, 2) }, /takes exactly 3 layers, from the bottom up: the tray, the keys and the monitor/],
    [(P) => { delete P.camadas[1].pecas }, /layer 2 \(the keys\) needs "pecas": 2 to 6 keys/],
    [(P) => { P.camadas[1].pecas[0].cor = 'rosa' }, /key 1 needs "cor", a #RRGGBB color/],
    [(P) => { P.camadas[1].pecas[2].icone = 'doc.svg' }, /key 3 "icone" must be the path of a PNG/],
    [(P) => { P.formatos = ['16x9', '9x16'] }, /"aparelho" is horizontal only: use 16x9, 19x9, 21x9 \(got "9x16"\)/],
    [(P) => { P.tela.pronto = 'All done and ready to go' }, /"tela.pronto" is a short status of up to 4 words/],
    [(P) => { P.tela.fundo = 'cinza' }, /"tela.fundo" must be a #RRGGBB color/],
  ]
  for (const [muda, re] of casos) {
    const P = ler('example-device.json')
    muda(P)
    const erros = validarIso(P)
    assert.ok(erros.some((e) => re.test(e)), `esperava ${re} em:\n${erros.join('\n')}`)
  }
})

test('o padrão: sem camera, rotulos, transicao e ritmo, o plano usa órbita, direita, corte seco e ritmo médio', () => {
  const pl = planejarIso(minimo())
  assert.equal(pl.camera, 'orbita')
  assert.equal(pl.rotulos, 'direita')
  assert.equal(pl.transicao, 'cut-on-beat')
  assert.equal(pl.durTr, 0)
  assert.equal(pl.ritmo.passo, 1.5)
  assert.deepEqual(pl.camadas.map((c) => c.partes), [1, 3, 1])
  assert.ok(pl.camadas[1].largura < pl.camadas[0].largura, 'sem largura, as camadas afinam para cima')
})

test('parâmetro errado dá uma mensagem que diz o que fazer', () => {
  const casos = [
    [(P) => { P.camadas = P.camadas.slice(0, 1) }, /needs 2 to 6 layers, from the bottom up/],
    [(P) => { P.camadas = Array.from({ length: 7 }, (_, i) => ({ rotulo: `C${i}`, cor: cor('#F5F5F5', '#EBEBEB', '#DEDEDE') })) }, /at most 6/],
    [(P) => { delete P.camadas[1].cor }, /layer 2 \("O meio"\): "cor" needs \{ "topo", "frente", "lado" \}/],
    [(P) => { P.camadas[0].cor.lado = 'bege' }, /\.lado must be a #RRGGBB color \(got "bege"\)/],
    [(P) => { P.camadas[1].partes = 12 }, /"partes" is a whole number from 1 to 9/],
    [(P) => { P.fecho.url = 'yourproduct.com' }, /the closing is only the logo/],
    [(P) => { delete P.fecho }, /closes with only the logo/],
    [(P) => { P.camera = 'travelling' }, /use orbita \| dolly-3d/],
    [(P) => { P.rotulos = 'cima' }, /use direita \| esquerda/],
    [(P) => { P.transicao = 'zoom-through' }, /use cut-on-beat \| mascara/],
    [(P) => { P.destaque = { topo: '#E8E8E8' } }, /"destaque"\.frente must be a #RRGGBB color/],
    [(P) => { P.camadas[2].rotulo = 'um rótulo comprido demais para a tela' }, /more than 5 words/],
  ]
  for (const [muda, re] of casos) {
    const P = minimo()
    muda(P)
    const erros = validarIso(P)
    assert.ok(erros.some((e) => re.test(e)), `esperava ${re} em:\n${erros.join('\n')}`)
    assert.throws(() => planejarIso(P), re)
  }
})

test('o renderizar recusa parâmetro e formato errados antes de criar qualquer pasta', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'iso-'))
  const arq = path.join(tmp, 'p.json')
  fs.writeFileSync(arq, JSON.stringify({ ...minimo(), fecho: { logo: LOGO, bordao: 'Bora.' } }))
  let r = spawnSync(process.execPath, [path.join(MOLDE, 'render.mjs'), arq, '--out', path.join(tmp, 'output')], { encoding: 'utf8' })
  assert.equal(r.status, 1)
  assert.match(r.stderr, /the closing is only the logo/)
  fs.writeFileSync(arq, JSON.stringify({ ...minimo(), fecho: { logo: path.join(tmp, 'nao-existe.png') } }))
  r = spawnSync(process.execPath, [path.join(MOLDE, 'render.mjs'), arq, '--out', path.join(tmp, 'output')], { encoding: 'utf8' })
  assert.equal(r.status, 1)
  assert.match(r.stderr, /"fecho\.logo" does not exist/)
  fs.writeFileSync(arq, JSON.stringify(minimo()))
  r = spawnSync(process.execPath, [path.join(MOLDE, 'render.mjs'), arq, '--out', path.join(tmp, 'output'), '--formats', '16x9,3x2'], { encoding: 'utf8' })
  assert.equal(r.status, 1)
  assert.match(r.stderr, /format "3x2" does not exist: use 16x9, 19x9, 21x9, 9x16, 1x1, 4x5/)
  assert.ok(!fs.existsSync(path.join(tmp, 'output')), 'criou a pasta antes de recusar')
  fs.rmSync(tmp, { recursive: true, force: true })
})

// ---------- no Chromium: compõe sem render ----------
// PNG do Playwright (8 bits, RGB ou RGBA, sem entrelaçar) → pixels RGBA, sem dependência
function lerPng(buf) {
  let w = 0, h = 0, tipo = 0
  const idat = []
  for (let o = 8; o < buf.length;) {
    const n = buf.readUInt32BE(o), k = buf.toString('ascii', o + 4, o + 8)
    if (k === 'IHDR') { w = buf.readUInt32BE(o + 8); h = buf.readUInt32BE(o + 12); tipo = buf[o + 17] }
    if (k === 'IDAT') idat.push(buf.subarray(o + 8, o + 8 + n))
    o += 12 + n
  }
  const bpp = tipo === 6 ? 4 : 3, cru = zlib.inflateSync(Buffer.concat(idat)), lin = w * bpp
  const px = Buffer.alloc(lin * h), out = Buffer.alloc(w * h * 4)
  for (let y = 0; y < h; y++) {
    const f = cru[y * (lin + 1)], src = cru.subarray(y * (lin + 1) + 1, (y + 1) * (lin + 1))
    for (let x = 0; x < lin; x++) {
      const a = x >= bpp ? px[y * lin + x - bpp] : 0, b = y ? px[(y - 1) * lin + x] : 0, c = x >= bpp && y ? px[(y - 1) * lin + x - bpp] : 0
      const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c)
      const pred = [0, a, b, (a + b) >> 1, pa <= pb && pa <= pc ? a : pb <= pc ? b : c][f]
      px[y * lin + x] = (src[x] + pred) & 255
    }
  }
  for (let i = 0; i < w * h; i++) { out[i * 4] = px[i * bpp]; out[i * 4 + 1] = px[i * bpp + 1]; out[i * 4 + 2] = px[i * bpp + 2]; out[i * 4 + 3] = bpp === 4 ? px[i * bpp + 3] : 255 }
  return { w, h, data: out }
}

/** As cores do quadro sem os textos, com a pilha inteira parada: o fundo e as faces têm de ser os hexes exatos. */
async function conferirCores(pg, P, plano, rotulo) {
  const t = +(plano.fimMontagem - 0.05).toFixed(2)
  const webgl = await pg.evaluate(async (tt) => {
    await window.renderAt(tt)
    const cv = document.querySelector('#stage canvas')
    // os textos, o fio e a pílula saem do quadro: sobra o que a pilha pinta sobre o fundo
    for (const e of document.querySelectorAll('#stage [data-colisao], #stage svg')) e.style.visibility = 'hidden'
    return !!(cv && cv.getContext('webgl2'))
  }, t)
  assert.ok(webgl, `${rotulo}: a pilha não está num canvas WebGL`)
  const { w, h, data } = lerPng(await pg.screenshot({ type: 'png' }))
  await pg.evaluate(() => { for (const e of document.querySelectorAll('#stage [data-colisao], #stage svg')) e.style.visibility = '' })
  const hex = (i) => '#' + [data[i], data[i + 1], data[i + 2]].map((v) => v.toString(16).padStart(2, '0')).join('').toUpperCase()
  const ultima = P.camadas.length - 1
  const faces = P.camadas.flatMap((c, i) => Object.values(P.destaque && i === ultima ? P.destaque : c.cor)).map((x) => x.toUpperCase())
  const paleta = new Set([P.marca.cores.fundo.toUpperCase(), ...faces])
  const conta = new Map(), naPaleta = new Uint8Array(w * h)
  for (let i = 0; i < w * h; i++) { const k = hex(i * 4); conta.set(k, (conta.get(k) || 0) + 1); naPaleta[i] = paleta.has(k) ? 1 : 0 }
  for (const f of new Set(faces)) assert.ok((conta.get(f) || 0) > 200, `${rotulo}: a face ${f} não aparece com o hex exato (${conta.get(f) || 0} px)`)
  // fora da paleta só pode estar o antialiasing: colado (até 2 px) numa cor da paleta. Miolo fora da paleta = chão, sombra ou gradiente
  let miolo = 0
  for (let y = 2; y < h - 2; y++) for (let x = 2; x < w - 2; x++) {
    if (naPaleta[y * w + x]) continue
    let perto = false
    for (let dy = -2; dy <= 2 && !perto; dy++) for (let dx = -2; dx <= 2; dx++) if (naPaleta[(y + dy) * w + x + dx]) { perto = true; break }
    if (!perto) miolo++
  }
  assert.ok(miolo <= 20, `${rotulo}: ${miolo} px fora da paleta longe de qualquer borda (chão, sombra ou gradiente?)`)
}

let navegador = null
try { navegador = require(path.join(RAIZ, 'scripts', 'playwright.cjs')) } catch { navegador = null }
const FORMATOS = { '16x9': [1920, 1080], '9x16': [1080, 1920], '1x1': [1080, 1080] }

async function compor(P, nome) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'iso-obra-'))
  const arq = path.join(tmp, `${nome}.json`)
  // os caminhos relativos do exemplo valem a partir da pasta do molde
  const abs = JSON.parse(JSON.stringify(P))
  abs.fecho.logo = path.resolve(MOLDE, abs.fecho.logo)
  for (const c of abs.camadas) for (const q of c.pecas || []) if (q.icone) q.icone = path.resolve(MOLDE, q.icone)
  abs.nome = nome
  fs.writeFileSync(arq, JSON.stringify(abs))
  const obra = path.join(tmp, 'output', `.work-${nome}`)
  let r = spawnSync(process.execPath, [path.join(RAIZ, 'scripts', 'example-fonts.mjs'), obra], { encoding: 'utf8' })
  assert.equal(r.status, 0, r.stderr)
  r = spawnSync(process.execPath, [path.join(MOLDE, 'render.mjs'), arq, '--out', path.join(tmp, 'output'), '--assemble-only'], { encoding: 'utf8' })
  assert.equal(r.status, 0, r.stderr)
  return { tmp, obra, plano: planejarIso(abs) }
}

async function conferir(t, obra, plano, rotulo, P) {
  let abrir
  try { abrir = await navegador.abrirNavegador(obra) } catch (e) { t.skip(`sem Chromium: ${e.message.split('\n')[0]}`); return }
  const { browser } = abrir
  try {
    for (const [f, [W, H]] of Object.entries(FORMATOS)) {
      const pg = await browser.newPage({ viewport: { width: W, height: H } })
      const erros = []
      pg.on('pageerror', (e) => erros.push(e.message)); pg.on('console', (m) => { if (m.type() === 'error') erros.push(m.text()) })
      await pg.goto(pathToFileURL(path.join(obra, 'index.html')).href + `?f=${f}`)
      await pg.waitForFunction('window.__ready === true', null, { timeout: 60000 })
      assert.deepEqual(erros, [], `${rotulo} ${f}: erro na página`)
      const tempos = Array.from({ length: 24 }, (_, k) => +(((k + 0.5) * plano.dur) / 24).toFixed(2))
      const probs = []
      for (const tt of tempos) probs.push(...(await pg.evaluate((x) => window.checarQuadro(x), tt)))
      assert.deepEqual(probs.map((p) => p.msg), [], `${rotulo} ${f}: a checagem de quadros achou problema`)
      if (f === '16x9') await conferirCores(pg, P, plano, `${rotulo} ${f}`)
      // no fecho, depois que o logo entra: nenhum texto visível e uma imagem só, a do logo
      const fecho = await pg.evaluate(async (tt) => {
        await window.renderAt(tt)
        const vis = (e) => { for (let x = e; x && x.id !== 'stage'; x = x.parentElement) { const cs = getComputedStyle(x); if (cs.display === 'none' || cs.visibility === 'hidden' || +cs.opacity < 0.05) return false } return true }
        const textos = [...document.querySelectorAll('#stage *')].filter((e) => [...e.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim()) && vis(e)).map((e) => e.textContent.trim())
        const imgs = [...document.querySelectorAll('#stage img')].filter(vis).map((i) => decodeURIComponent(i.src.split('/').pop()))
        return { textos, imgs }
      }, +(plano.dur - 0.4).toFixed(2))
      assert.deepEqual(fecho.textos, [], `${rotulo} ${f}: texto no fecho`)
      assert.equal(fecho.imgs.length, 1, `${rotulo} ${f}: o fecho mostra ${fecho.imgs.join(', ')}`)
      assert.match(fecho.imgs[0], /logo/, `${rotulo} ${f}: a imagem do fecho não é o logo`)
      await pg.close()
    }
  } finally { await browser.close() }
}

test('compõe sem render com os parâmetros padrão: 16:9, 9:16 e 1:1 passam na checagem, as faces saem no hex exato e o fecho é só o logo', { skip: !navegador && 'sem scripts/playwright.cjs', timeout: 240000 }, async (t) => {
  const { tmp, obra, plano } = await compor(minimo(), 'minimo')
  try { await conferir(t, obra, plano, 'mínimo', minimo()) } finally { fs.rmSync(tmp, { recursive: true, force: true }) }
})

test('compõe sem render o exemplo de 5 camadas (dolly, rótulos à esquerda, destaque, máscara): 16:9, 9:16 e 1:1 passam na checagem', { skip: !navegador && 'sem scripts/playwright.cjs', timeout: 240000 }, async (t) => {
  const { tmp, obra, plano } = await compor(ler('example-exploded.json'), 'explodido')
  try { await conferir(t, obra, plano, 'exemplo explodido', ler('example-exploded.json')) } finally { fs.rmSync(tmp, { recursive: true, force: true }) }
})

test('compõe sem render o modo aparelho (16:9): checagem limpa, fios horizontais, rótulos numa coluna de espaço igual, fecho só com o logo', { skip: !navegador && 'sem scripts/playwright.cjs', timeout: 240000 }, async (t) => {
  const P = ler('example-device.json')
  const { tmp, obra, plano } = await compor(P, 'aparelho')
  let abrir
  try { abrir = await navegador.abrirNavegador(obra) } catch (e) { fs.rmSync(tmp, { recursive: true, force: true }); t.skip(`sem Chromium: ${e.message.split('\n')[0]}`); return }
  const { browser } = abrir
  try {
    const pg = await browser.newPage({ viewport: { width: 1920, height: 1080 } })
    const erros = []
    pg.on('pageerror', (e) => erros.push(e.message)); pg.on('console', (m) => { if (m.type() === 'error') erros.push(m.text()) })
    await pg.goto(pathToFileURL(path.join(obra, 'index.html')).href + '?f=16x9')
    await pg.waitForFunction('window.__ready === true', null, { timeout: 90000 })
    assert.deepEqual(erros, [], 'erro na página')
    const probs = []
    for (const tt of Array.from({ length: 24 }, (_, k) => +(((k + 0.5) * plano.dur) / 24).toFixed(2))) probs.push(...(await pg.evaluate((x) => window.checarQuadro(x), tt)))
    assert.deepEqual(probs.map((p) => p.msg), [], 'a checagem de quadros achou problema')
    // com o aparelho pronto, em três pontos da órbita: cada fio é horizontal e comprido; os rótulos têm a mesma margem
    // esquerda e o mesmo espaço entre eles
    for (const tt of [plano.aparelho.monitor.nomeia + 0.5, plano.aparelho.checado + 0.2, plano.fecho.em - 0.05]) {
      const m = await pg.evaluate(async (x) => {
        await window.renderAt(x)
        const ativa = (e) => { const s = e.closest('.scene'); return s && s.style.display !== 'none' }
        const fios = [...document.querySelectorAll('#stage line')].filter((l) => ativa(l) && +getComputedStyle(l).opacity > 0.5).map((l) => ['x1', 'y1', 'x2', 'y2'].map((a) => +l.getAttribute(a)))
        const linhas = [...document.querySelectorAll('#stage .line')].filter(ativa).map((e) => Math.round(e.getBoundingClientRect().left))
        return { fios, linhas, webgl: !!document.querySelector('#stage canvas').getContext('webgl2') }
      }, tt)
      assert.ok(m.webgl, 'o aparelho é WebGL')
      assert.equal(m.fios.length, 3, `t=${tt}: três fios`)
      for (const [x1, y1, x2, y2] of m.fios) { assert.equal(y1, y2, `t=${tt}: fio não é horizontal`); assert.ok(x2 - x1 > 40, `t=${tt}: fio curto demais (${x2 - x1} px)`) }
      assert.equal(new Set(m.linhas).size, 1, `t=${tt}: rótulos fora da coluna (${[...new Set(m.linhas)].join(', ')})`)
      const ys = m.fios.map((f) => f[1]).sort((a, b) => a - b)
      assert.ok(Math.abs((ys[1] - ys[0]) - (ys[2] - ys[1])) < 1, `t=${tt}: espaço desigual entre os rótulos (${ys.join(', ')})`)
    }
    const fecho = await pg.evaluate(async (x) => {
      await window.renderAt(x)
      const vis = (e) => { for (let y = e; y && y.id !== 'stage'; y = y.parentElement) { const cs = getComputedStyle(y); if (cs.display === 'none' || cs.visibility === 'hidden' || +cs.opacity < 0.05) return false } return true }
      return { textos: [...document.querySelectorAll('#stage *')].filter((e) => [...e.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim()) && vis(e)).length, imgs: [...document.querySelectorAll('#stage img')].filter(vis).length }
    }, +(plano.dur - 0.4).toFixed(2))
    assert.deepEqual(fecho, { textos: 0, imgs: 1 }, 'o fecho é só o logo')
    await pg.close()
  } finally { await browser.close(); fs.rmSync(tmp, { recursive: true, force: true }) }
})
