// node --test tests/chat-bubbles.test.mjs   (sem rede; a parte que compõe precisa do Playwright com Chromium, sem ele
// ela pula; a marca dos exemplos são os marcadores de assets/example). Compõe a cena no navegador, sem render de vídeo.
// O que este arquivo trava, no molde chat-bubbles:
//   · os exemplos de formato (o de coluna e o dividido) e uma outra marca montada aqui planejam sem erro, com ida e volta, de
//     6 a 15 s, e o fecho por último;
//   · parâmetro errado dá mensagem que diz o que fazer (no plano e no render.mjs, antes de criar pasta);
//   · a cena compõe em 16:9, 9:16, 1:1, 19:9 e 21:9 e passa na checagem do motor (colisão, área segura, texto sobre imagem);
//   · antes do fecho, o último balão está na tela, opaco e dentro da área segura;
//   · o fecho é só o logo: nenhum texto visível, uma imagem só, a do logo, centrada;
//   · com imagem (cartão "imagem" e miniaturas), a checagem "fora-da-imagem" está ligada, a imagem está marcada e nenhum
//     texto a cruza.
import { test, describe, before, after } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import zlib from 'node:zlib'
import { spawnSync } from 'node:child_process'
import { createRequire } from 'node:module'
import { fileURLToPath, pathToFileURL } from 'node:url'

const require = createRequire(import.meta.url)
const SKILL = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const MOLDE = path.join(SKILL, 'templates', 'chat-bubbles')
const { CONVERSA, validarConversa, planejarConversa } = require(path.join(MOLDE, 'scene', 'plan.js'))
// uma outra marca, escura, com cores e fonte que não são as dos exemplos: prova que nada da marca está no código, e usa o
// que os exemplos não usam: câmera parada, sem janela e sem rótulos, lista dentro da conversa (com item sem chip) e corte seco.
const NEUTRO = {
  nome: 'marca-conversa', formatos: ['16x9', '9x16'],
  leiaute: 'coluna', camera: 'parada', transicao: 'corte', rotulos: false,
  chips: { novo: { fundo: '#FCA311', texto: '#14213D' } },
  marca: {
    nome: 'Marca', logo: 'logo.png',
    cores: {
      fundo: '#14213D', texto: '#F4F1EA', rotulo: '#F4F1EA',
      pessoa: '#FCA311', sobrePessoa: '#14213D',
      produto: '#22335A', sobreProduto: '#F4F1EA', pontos: '#FCA311',
      cartao: '#22335A', sobreCartao: '#F4F1EA', linha: '#1B2A4A', sobreLinha: '#F4F1EA',
    },
    fontes: { texto: 'Rubik' },
  },
  mensagens: [
    { de: 'pessoa', texto: 'quero trocar o tema do meu painel' },
    { de: 'produto', texto: 'Estes combinam com o seu logo:', cartao: { tipo: 'lista', itens: [{ t: 'Noite', chip: 'novo' }, { t: 'Areia' }, { t: 'Contraste alto' }] } },
    { de: 'pessoa', texto: 'Vou de noite.' },
  ],
  fecho: { fundo: '#14213D' },
  trilha: { semente: 1201, identidade: { genero: 'house', bpm: [118, 122] } },
}
const ler = (f) => (f === 'neutro' ? structuredClone(NEUTRO) : JSON.parse(fs.readFileSync(path.join(MOLDE, f), 'utf8')))
const EXEMPLOS = ['example.json', 'example-split.json', 'neutro']
const temPlaywright = require('../scripts/playwright.cjs').candidatos().length > 0
const FORMATOS = { '16x9': [1920, 1080], '9x16': [1080, 1920], '1x1': [1080, 1080], '19x9': [2280, 1080], '21x9': [2520, 1080] }

// PNG de cor chapada (para a imagem do cartão e o logo do teste, sem depender de arquivo de fora)
function png(w, h, rgb) {
  const T = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0 })
  const crc = (b) => { let c = 0xffffffff; for (const x of b) c = T[(c ^ x) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0 }
  const bloco = (tipo, dados) => { const n = Buffer.alloc(4); n.writeUInt32BE(dados.length); const td = Buffer.concat([Buffer.from(tipo), dados]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([n, td, c]) }
  const ih = Buffer.alloc(13); ih.writeUInt32BE(w, 0); ih.writeUInt32BE(h, 4); ih[8] = 8; ih[9] = 2
  const linha = Buffer.concat([Buffer.from([0]), Buffer.from(Array.from({ length: w * 3 }, (_, i) => rgb[i % 3]))])
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), bloco('IHDR', ih), bloco('IDAT', zlib.deflateSync(Buffer.concat(Array(h).fill(linha)))), bloco('IEND', Buffer.alloc(0))])
}

describe('o plano (sem navegador)', () => {
  test('os exemplos planejam: ida e volta, de 6 a 15 s, balões em ordem e o fecho por último', () => {
    for (const f of EXEMPLOS) {
      const P = ler(f), p = planejarConversa(P)
      assert.ok(new Set(P.mensagens.map((m) => m.de)).size === 2, `${f}: a conversa tem os dois lados`)
      assert.ok(p.dur >= 6 && p.dur <= 15, `${f}: ${p.dur} s`)
      p.msgs.forEach((m, i) => { if (i) assert.ok(m.tEntra > p.msgs[i - 1].tEntra, `${f}: mensagem ${i + 1} fora de ordem`) })
      assert.ok(p.tSai > p.msgs.at(-1).tFim - 1e-9, `${f}: o fecho começa antes de a conversa acabar`)
      assert.ok(p.dur - p.tLogo >= 1.6, `${f}: o logo fica só ${(p.dur - p.tLogo).toFixed(2)} s`)
      assert.ok(p.sons.filter((s) => s.som === 'pop').length >= P.mensagens.length, `${f}: falta um "pop" por balão`)
      assert.equal(p.secoes[0].de, 0); assert.equal(p.secoes.at(-1).ate, p.dur)
      p.secoes.forEach((s, i) => { if (i) assert.ok(Math.abs(s.de - p.secoes[i - 1].ate) < 1e-9, `${f}: seção ${s.nome} não emenda`) })
    }
  })
  test('os parâmetros padrão: só marca e duas mensagens já formam um vídeo (coluna, segue, corte)', () => {
    const P = { marca: { nome: 'X', logo: 'x.png', cores: { fundo: '#111111', texto: '#ebebeb', pessoa: '#222222', sobrePessoa: '#ffffff', produto: '#333333', sobreProduto: '#ffffff' }, fontes: { texto: 'Inter' } },
      mensagens: [{ de: 'pessoa', texto: 'oi' }, { de: 'produto', texto: 'olá, em que ajudo?' }] }
    const p = planejarConversa(P)
    assert.deepEqual([p.leiaute, p.camera, p.transicao], ['coluna', 'segue', 'corte'])
    assert.equal(p.msgs[1].tDig, p.msgs[1].tIni, 'o produto mostra o "digitando…" por padrão')
    assert.equal(p.msgs[0].tDig, null, 'a pessoa não digita por padrão')
    assert.equal(p.dTr, 0)
  })
  test('parâmetro errado: a mensagem diz o que fazer', () => {
    const base = ler('example.json')
    const erro = (mudar) => { const P = structuredClone(base); mudar(P); return validarConversa(P).join('\n') }
    assert.match(erro((P) => { P.leiaute = 'grade' }), /leiaute "grade" does not exist: use "coluna", "dividido"/)
    assert.match(erro((P) => { P.camera = 'drone' }), /camera "drone" does not exist: use "segue", "zoom", "parada"/)
    assert.match(erro((P) => { P.camera = 'zoom' }), /camera "zoom" does not go with "janela"/)
    assert.match(erro((P) => { P.mensagens[0].de = 'robo' }), /mensagens\[0\]\.de "robo" does not exist: use "pessoa" \(on the right\) or "produto"/)
    assert.match(erro((P) => { P.mensagens[3].cartao.tipo = 'video' }), /cartao\.tipo "video" does not exist: use "arquivo", "lista", "imagem"/)
    assert.match(erro((P) => { P.mensagens[0].cartao = { tipo: 'lista', itens: [{ t: 'a' }] } }), /only the product replies with a card/)
    assert.match(erro((P) => { delete P.marca.logo }), /missing marca\.logo: the closing is only the logo/)
    assert.match(erro((P) => { P.fecho.bordao = 'Tudo pronto.' }), /fecho\.bordao: this template's closing is only the logo, with no sentence or address/)
    assert.match(erro((P) => { P.marca.cores.pessoa = 'preto' }), /marca\.cores\.pessoa "preto" is not a #rrggbb color/)
    assert.match(erro((P) => { P.mensagens = P.mensagens.slice(0, 1) }), /at least 2 messages \(back and forth\)/)
    assert.throws(() => planejarConversa({ ...base, leiaute: 'grade' }), /chat-bubbles template parameters:\n {2}- leiaute "grade"/)
    for (const k of ['LEIAUTES', 'CAMERAS', 'TRANSICOES', 'CARTOES']) assert.ok(CONVERSA[k].length >= 2)
  })
  test('o render.mjs recusa parâmetro errado e formato desconhecido antes de criar qualquer pasta', () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'conversa-erro-'))
    const P = { ...ler('example.json'), camera: 'drone' }
    const arq = path.join(MOLDE, `.teste-erro-${process.pid}.json`)
    fs.writeFileSync(arq, JSON.stringify(P))
    try {
      const r = spawnSync(process.execPath, [path.join(MOLDE, 'render.mjs'), arq, '--out', path.join(tmp, 'x')], { encoding: 'utf8' })
      assert.equal(r.status, 1); assert.match(r.stderr, /camera "drone" does not exist/)
      const r2 = spawnSync(process.execPath, [path.join(MOLDE, 'render.mjs'), path.join(MOLDE, 'example-split.json'), '--out', path.join(tmp, 'y'), '--formats', '16x9,3x2'], { encoding: 'utf8' })
      assert.equal(r2.status, 1); assert.match(r2.stderr, /format this template doesn't support: 3x2\. Use 16x9, 19x9, 21x9, 9x16, 1x1, 4x5/)
      assert.ok(!fs.existsSync(path.join(tmp, 'x')) && !fs.existsSync(path.join(tmp, 'y')), 'o renderizar criou pasta antes de recusar')
    } finally { fs.rmSync(arq, { force: true }); fs.rmSync(tmp, { recursive: true, force: true }) }
  })
})

describe('a cena composta no navegador (sem render)', { skip: !temPlaywright ? 'sem Playwright' : false }, () => {
  let tmp, browser
  const obras = {}
  // monta a obra (a Inter dos exemplos antes, sem rede) e devolve o caminho
  const montar = (nome, P) => {
    const arq = path.join(tmp, `${nome}.json`), saida = path.join(tmp, nome)
    if (P.marca.logo && !path.isAbsolute(P.marca.logo)) P.marca.logo = path.resolve(MOLDE, P.marca.logo)
    fs.writeFileSync(arq, JSON.stringify({ ...P, nome, marca: { ...P.marca, fontes: { texto: 'Inter' } } }))
    const obra = path.join(saida, `.work-${nome}`)
    spawnSync(process.execPath, [path.join(SKILL, 'scripts', 'example-fonts.mjs'), obra], { encoding: 'utf8' })
    const r = spawnSync(process.execPath, [path.join(MOLDE, 'render.mjs'), arq, '--out', saida, '--assemble-only'], { encoding: 'utf8' })
    assert.equal(r.status, 0, r.stderr)
    return obra
  }
  async function abrir(obra, fmt) {
    const [w, h] = FORMATOS[fmt]
    const p = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 1 })
    const erros = []
    p.on('console', (m) => { if (m.type() === 'error') erros.push(m.text()) })
    p.on('pageerror', (e) => erros.push(e.message))
    const quebrou = new Promise((_, nao) => p.on('pageerror', (e) => nao(new Error(`a cena quebrou no ${fmt}: ${e.message}`))))
    await p.goto(pathToFileURL(path.join(obra, 'index.html')).href + `?f=${fmt}`)
    await Promise.race([p.waitForFunction('window.__ready === true', null, { timeout: 60000 }), quebrou])
    return { p, erros }
  }
  // varre a linha do tempo inteira com a checagem do motor (a mesma do frames.cjs --check)
  const checar = (p) => p.evaluate(async () => {
    const out = []
    for (let t = 0; t < VIDEO.duracao; t += 0.1) out.push(...(await checarQuadro(t)).map((q) => q.msg))
    return [...new Set(out)]
  })
  const opaco = `(e) => { let o = 1; for (let x = e; x && x !== document.documentElement; x = x.parentElement) { const cs = getComputedStyle(x); if (cs.display === 'none') return 0; o *= +cs.opacity } return o }`

  before(async () => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'conversa-cena-'))
    obras.coluna = montar('coluna', ler('example.json'))
    obras.dividido = montar('dividido', ler('example-split.json'))
    // a mesma conversa com um cartão de imagem (e o leiaute dividido): a imagem é marcada e nenhum texto a cruza
    fs.writeFileSync(path.join(tmp, 'foto.png'), png(320, 180, [168, 128, 255]))
    const P = ler('example.json')
    P.mensagens[3].cartao = { tipo: 'imagem', src: path.join(tmp, 'foto.png'), legenda: 'A legenda da imagem' }
    obras.imagem = montar('imagem', P)
    obras.imagemDividido = montar('imagem-dividido', { ...P, leiaute: 'dividido', janela: null, camera: 'zoom' })
    browser = (await require('../scripts/playwright.cjs').abrirNavegador(tmp)).browser
  })
  after(async () => { if (browser) await browser.close(); if (tmp) fs.rmSync(tmp, { recursive: true, force: true }) })

  for (const ex of ['coluna', 'dividido']) {
    test(`${ex}: compõe nos cinco formatos, sem erro no console e sem problema na checagem do motor`, async () => {
      for (const fmt of Object.keys(FORMATOS)) {
        const { p, erros } = await abrir(obras[ex], fmt)
        const probs = await checar(p)
        await p.close()
        assert.deepEqual(erros, [], `${ex} ${fmt}: erro no console`)
        assert.deepEqual(probs, [], `${ex} ${fmt}: a checagem acusou`)
      }
    })
    test(`${ex}: antes do fecho o último balão está na tela, opaco e dentro da área segura; o fecho é só o logo, centrado`, async () => {
      for (const fmt of ['16x9', '9x16', '1x1']) {
        const { p } = await abrir(obras[ex], fmt)
        const r = await p.evaluate(async (opaco) => {
          const op = eval(opaco)
          await renderAt(PLANO.tSai - 0.05)
          const n = PARAMS.mensagens.length, a = areaSegura()
          const linhas = [...document.querySelectorAll(`[data-colisao-nome="bubble ${n}"]`)].map((e) => { const q = e.getBoundingClientRect(); return { o: op(e), dentro: q.left >= a.x0 && q.right <= a.x1 && q.top >= a.y0 && q.bottom <= a.y1 } })
          await renderAt(VIDEO.duracao - 0.3)
          const visiveis = [...document.querySelectorAll('#stage *')].filter((e) => op(e) > 0.05)
          const textos = visiveis.filter((e) => [...e.childNodes].some((c) => c.nodeType === 3 && c.textContent.trim())).map((e) => e.textContent.trim())
          const imgs = visiveis.filter((e) => e.tagName === 'IMG').map((e) => { const q = e.getBoundingClientRect(); return { logo: e.dataset.colisao === 'logo', cx: q.left + q.width / 2, cy: q.top + q.height / 2 } })
          return { linhas, textos, imgs, W, H }
        }, opaco)
        await p.close()
        assert.ok(r.linhas.length > 0, `${ex} ${fmt}: o último balão não tem linha marcada`)
        for (const l of r.linhas) { assert.ok(l.o >= 0.9, `${ex} ${fmt}: o último balão está esmaecido (${l.o})`); assert.ok(l.dentro, `${ex} ${fmt}: o último balão sai da área segura`) }
        assert.deepEqual(r.textos, [], `${ex} ${fmt}: texto no fecho`)
        assert.equal(r.imgs.length, 1, `${ex} ${fmt}: o fecho tem ${r.imgs.length} imagens`)
        assert.ok(r.imgs[0].logo, `${ex} ${fmt}: a imagem do fecho não é o logo`)
        assert.ok(Math.abs(r.imgs[0].cx - r.W / 2) < 2 && Math.abs(r.imgs[0].cy - r.H / 2) < 2, `${ex} ${fmt}: o logo não está centrado`)
      }
    })
  }

  test('com imagem: a checagem "fora-da-imagem" está ligada, a imagem e as miniaturas são marcadas e nenhum texto as cruza', async () => {
    for (const [obra, fmts] of [[obras.imagem, ['16x9', '9x16', '1x1']], [obras.imagemDividido, ['16x9', '21x9']], [obras.coluna, ['16x9']]]) {
      for (const fmt of fmts) {
        const { p, erros } = await abrir(obra, fmt)
        const info = await p.evaluate(() => ({ texto: VIDEO.texto, imagens: [...document.querySelectorAll('[data-imagem]')].map((e) => e.dataset.imagem) }))
        const probs = await checar(p)
        await p.close()
        assert.deepEqual(erros, [], `${fmt}: erro no console`)
        assert.equal(info.texto, 'fora-da-imagem')
        assert.ok(info.imagens.length >= 1, `${fmt}: nenhuma imagem marcada`)
        assert.deepEqual(probs, [], `${fmt}: a checagem acusou`)
      }
    }
  })

  test('conversa que não cabe com a câmera parada: o erro diz o que fazer', async () => {
    const obra = montar('parada', { ...ler('example.json'), camera: 'parada' })
    const { p, erros } = await abrir(obra, '16x9')
    await p.close()
    assert.ok(erros.some((e) => /THE CHAT DOES NOT FIT WITH A STILL CAMERA in 16:9: .*Use "camera": "segue"/.test(e)), erros.join('\n'))
  })
})
