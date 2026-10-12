// node --test tests/refine-video.test.mjs   (sem rede; precisa do ffmpeg. O OCR é o do sistema — o Vision no macOS, com
// swiftc; o do Windows, pelo PowerShell — e o texto das fixtures sai do Playwright: sem um deles, os testes de texto
// são pulados)
import { test, describe, before, after } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import {
  checarVideo, zonasDaInterface, areaSeguraDe, formatoDe, trechosParados, lerFreezedetect, juntarTrechos,
  agruparNoTempo, classificarLegibilidade, textoForaDaArea, alturaDoCorpo, binarioOcr, contrasteNaCaixa,
} from '../scripts/refine/video.mjs'

const AQUI = path.dirname(fileURLToPath(import.meta.url))
const VIDEO = path.join(AQUI, '..', 'scripts', 'refine', 'video.mjs')
const require = createRequire(import.meta.url)
let pasta
before(() => { pasta = fs.mkdtempSync(path.join(os.tmpdir(), 'refino-video-teste-')) })
after(() => fs.rmSync(pasta, { recursive: true, force: true }))

function ffmpeg(args) {
  const r = spawnSync('ffmpeg', ['-v', 'error', '-y', ...args], { encoding: 'utf8' })
  assert.equal(r.status, 0, r.stderr)
}
const h264 = ['-c:v', 'libx264', '-preset', 'ultrafast', '-crf', '16', '-pix_fmt', 'yuv420p']

// ── funções puras ────────────────────────────────────────────────────────────────────────────────
describe('área segura e zonas da interface', () => {
  test('9:16 no tiktok: o retângulo do motor e as três zonas da interface', () => {
    assert.deepEqual(areaSeguraDe('9x16', 'tiktok'), { x0: 70, y0: 250, x1: 940, y1: 1450, nome: 'tiktok' })
    const z = Object.fromEntries(zonasDaInterface('9x16', 'tiktok').map((x) => [x.nome, [x.x0, x.y0, x.x1, x.y1]]))
    assert.deepEqual(z, { topo: [0, 0, 1080, 220], base: [0, 1500, 1080, 1920], botoes: [940, 900, 1080, 1650] })
  })

  test('9:16 sem plataforma vale como reels; stories tem outro retângulo e não tem botões', () => {
    assert.deepEqual(zonasDaInterface('9x16', null).map((z) => z.nome), ['topo', 'base', 'botoes'])
    const s = areaSeguraDe('9x16', 'stories')
    assert.deepEqual([s.x0, s.y0, s.x1, s.y1], [60, 250, 1020, 1580])
    assert.deepEqual(zonasDaInterface('9x16', 'stories').map((z) => z.nome), ['topo', 'base'])
  })

  test('16:9 tem 5% de margem; 1:1 e 4:5, 60 px; nenhum tem zona de interface', () => {
    const a = areaSeguraDe('16x9', null)
    assert.deepEqual([a.x0, a.y0, a.x1, a.y1], [96, 54, 1824, 1026])
    const q = areaSeguraDe('1x1', null), f = areaSeguraDe('4x5', 'feed')
    assert.deepEqual([q.x0, q.x1, f.y0, f.y1], [60, 1020, 60, 1290])
    for (const fmt of ['16x9', '1x1', '4x5']) assert.deepEqual(zonasDaInterface(fmt, null), [])
  })

  test('vídeo 9:16 menor que 1080 escala o retângulo junto', () => {
    const a = areaSeguraDe('9x16', 'reels', 540, 960)
    assert.deepEqual([a.x0, a.y0, a.x1, a.y1], [35, 125, 470, 725])
  })

  test('o formato sai da proporção do vídeo', () => {
    assert.equal(formatoDe(1080, 1920), '9x16')
    assert.equal(formatoDe(1280, 720), '16x9')
    assert.equal(formatoDe(1080, 1350), '4x5')
    assert.equal(formatoDe(720, 720), '1x1')
  })
})

describe('trechos parados', () => {
  test('lê o stderr do freezedetect, com o último trecho aberto até o fim', () => {
    const err = '[freezedetect @ 0x1] lavfi.freezedetect.freeze_start: 1.5\n[freezedetect @ 0x1] lavfi.freezedetect.freeze_duration: 0.7\n' +
      '[freezedetect @ 0x1] lavfi.freezedetect.freeze_end: 2.2\n[freezedetect @ 0x1] lavfi.freezedetect.freeze_start: 9.1\n'
    assert.deepEqual(lerFreezedetect(err), [{ ini: 1.5, fim: 2.2 }, { ini: 9.1, fim: null }])
  })

  test('parado no meio passa do limite → erro; o cartão final parado ≥ 1,2 s → nada', () => {
    const { achados, final } = trechosParados([{ ini: 3, fim: 4.5 }, { ini: 8, fim: 8.4 }, { ini: 18.5, fim: null }], { fim: 20 })
    assert.equal(achados.length, 1)
    assert.equal(achados[0].checagem, 'parado')
    assert.equal(achados[0].nivel, 'erro')
    assert.equal(achados[0].t, 3)
    assert.match(achados[0].msg, /1\.50 s/)
    assert.equal(final.dur, 1.5)
  })

  test('cartão final curto ou vídeo que acaba em movimento → aviso', () => {
    const curto = trechosParados([{ ini: 19.5, fim: null }], { fim: 20 }).achados
    assert.equal(curto.length, 1)
    assert.equal(curto[0].nivel, 'aviso')
    assert.match(curto[0].msg, /only 0\.50 s/)
    assert.equal(trechosParados([], { fim: 20 }).achados[0].nivel, 'aviso')
    assert.deepEqual(trechosParados([], { fim: 12, fimDoVideo: false }).achados, [], 'recorte no meio do vídeo não tem cartão final')
  })

  test('junta o cartão final partido pelo brilho lento, mas não um corte seco nem o meio do vídeo', () => {
    const fps = 60, difs = new Array(200).fill(0.02)
    difs[60] = 3                          // corte seco no quadro 60 (1,0 s)
    const tr = [{ ini: 0.2, fim: 0.5 }, { ini: 0.5, fim: 1.0 }, { ini: 1.0, fim: 2.0 }, { ini: 2.0, fim: null }]
    assert.deepEqual(juntarTrechos(tr, difs, fps), [{ ini: 0.2, fim: 0.5 }, { ini: 0.5, fim: 1.0 }, { ini: 1.0, fim: null }])
  })
})

describe('agrupamento e classificação', () => {
  test('amostras consecutivas da mesma coisa viram um grupo; um buraco grande separa', () => {
    const g = agruparNoTempo([{ i: 0 }, { i: 1 }, { i: 3 }, { i: 7 }])
    assert.deepEqual(g.map((x) => [x.i0, x.i1]), [[0, 3], [7, 7]])
  })

  test('plano geral: a tela inteira pequena por até 2,6 s antes do zoom é aviso, não erro (a tela inteira primeiro, depois o zoom)', () => {
    const l = (texto, h, y) => ({ texto, conf: 1, x: 200, y, w: 300, h })
    const tela = Array.from({ length: 8 }, (_, k) => l(`Linha do app ${k}`, 13, 400 + 30 * k))
    const curta = classificarLegibilidade([0, 0.5, 1.0].map((t, k) => ({ i: k, t, linhas: tela })))
    assert.equal(curta.length, 1)
    assert.equal(curta[0].nivel, 'aviso')
    assert.match(curta[0].msg, /wide shot of 1\.5 s/)
    const longa = classificarLegibilidade(Array.from({ length: 6 }, (_, k) => ({ i: k, t: k * 0.5, linhas: tela })))
    assert.equal(longa[0].nivel, 'erro', '3 s de tela pequena passa do plano geral')
    // uma linha só, ilegível e sem a tela em volta, continua erro mesmo curta
    const solta = classificarLegibilidade([{ i: 0, t: 0, linhas: [l('Legenda miúda', 12, 900)] }])
    assert.equal(solta[0].nivel, 'erro')
  })

  test('abertura do tutorial com cinema: o celular 3D desfocado não conta como tela encolhida', () => {
    const l = (texto, h, y) => ({ texto, conf: 1, x: 200, y, w: 300, h })
    const tela = Array.from({ length: 8 }, (_, k) => l(`Linha do app ${k}`, 7, 400 + 30 * k))
    // de 1,0 a 4,0 s: o celular 3D da abertura (até 2,4 s) e logo depois o plano geral da primeira tela
    const quadros = Array.from({ length: 6 }, (_, k) => ({ i: k, t: 1 + k * 0.5, linhas: tela }))
    assert.equal(classificarLegibilidade(quadros)[0].nivel, 'erro', 'sem saber da abertura, 3 s seguidos é erro')
    const a = classificarLegibilidade(quadros, { decoracaoAte: 2.4 })
    assert.equal(a.length, 1)
    assert.equal(a[0].nivel, 'aviso', 'só o plano geral depois da abertura conta: 1,5 s')
    assert.equal(a[0].t, 2.5)
  })

  test('caixa alta: o Vision mede a maiúscula, então 25 px de caixa ≈ 30 px de corpo', () => {
    assert.equal(alturaDoCorpo({ texto: 'MARCA PRO', h: 25 }), 30)
    assert.equal(alturaDoCorpo({ texto: 'meus links', h: 22 }), 22)
  })

  test('legibilidade: tela encolhida, linha ilegível, aviso, exceção e o mesmo texto agrupado', () => {
    const l = (texto, h, y = 600) => ({ texto, conf: 1, x: 200, y, w: 300, h })
    const tela = Array.from({ length: 7 }, (_, k) => l(`Linha de link ${k}`, 9, 400 + 30 * k))
    // a tela encolhida fica 3,5 s na tela (7 amostras a cada 0,5 s): passa do plano geral e é erro
    const quadros = [
      { i: 3, t: 1.5, linhas: [l('Título grande', 90), l('meus links', 14)] },
      { i: 4, t: 2.0, linhas: [l('meus links', 14), l('Fonte: site.com, 2026', 22), l('Toque em salvar', 22)] },
      ...Array.from({ length: 7 }, (_, k) => ({ i: 20 + k, t: 10 + k * 0.5, linhas: [...tela, l('L', 8)] })),
    ]
    const a = classificarLegibilidade(quadros, { excecoes: ['^Fonte:'] })
    const [ileg, av, enc] = a
    assert.equal(a.length, 3)
    assert.equal(enc.nivel, 'erro')
    assert.match(enc.msg, /7 lines .* shrunken screen/)
    assert.equal(enc.caixas.length, 7)
    assert.equal(ileg.nivel, 'erro')
    assert.match(ileg.msg, /"meus links" is 14 px/)
    assert.equal(ileg.t, 1.5)
    assert.equal(ileg.fim, 2.5, 'as duas amostras com "meus links" viram um achado só')
    assert.equal(av.nivel, 'aviso')
    assert.match(av.msg, /Toque em salvar/)
  })

  test('texto fora da área: opaco em duas amostras → erro; esmaecido ou de relance → aviso', () => {
    const area = areaSeguraDe('9x16', 'tiktok')
    const sob = { texto: 'Siga agora', x: 950, y: 1100, w: 110, h: 40, contraste: 200 }
    const erro = textoForaDaArea([{ i: 0, t: 0, linhas: [sob] }, { i: 1, t: 0.5, linhas: [sob] }], area)
    assert.equal(erro.length, 1)
    assert.equal(erro[0].nivel, 'erro')
    assert.match(erro[0].msg, /x 1060 > 940/)
    const apagado = textoForaDaArea([{ i: 0, t: 0, linhas: [{ ...sob, contraste: 40 }] }, { i: 1, t: 0.5, linhas: [{ ...sob, contraste: 40 }] }], area)
    assert.equal(apagado[0].nivel, 'aviso')
    assert.match(apagado[0].msg, /faded/)
    const relance = textoForaDaArea([{ i: 4, t: 2, linhas: [sob] }], area)
    assert.equal(relance[0].nivel, 'aviso')
    assert.match(relance[0].msg, /glimpse/)
    // o logo do cenário (atrás da pessoa na câmera) entra nas exceções do gabarito e deixa de ser erro; outro texto fora continua
    const logo = { ...sob, texto: 'M.marca' }
    assert.equal(textoForaDaArea([{ i: 0, t: 0, linhas: [logo] }, { i: 1, t: 0.5, linhas: [logo] }], area, { excecoes: ['^M\\W*m.rca$'] }).length, 0)
    assert.equal(textoForaDaArea([{ i: 0, t: 0, linhas: [logo, sob] }, { i: 1, t: 0.5, linhas: [logo, sob] }], area, { excecoes: ['^M\\W*m.rca$'] })[0].nivel, 'erro')
    const dentro = textoForaDaArea([{ i: 0, t: 0, linhas: [{ ...sob, x: 300 }, { texto: 'Г', x: 1000, y: 100, w: 30, h: 30 }] }], area)
    assert.deepEqual(dentro, [], 'texto dentro e canto decorativo não contam')
  })
})

// ── vídeos com defeito reconstruído ──────────────────────────────────────────────────────────────
describe('vídeo: parado e vazio', () => {
  test('1,5 s parado no meio → erro; parado só no fim (1,5 s) → nada', async () => {
    const meio = path.join(pasta, 'parado-meio.mp4'), fim = path.join(pasta, 'parado-fim.mp4')
    ffmpeg(['-f', 'lavfi', '-i', 'testsrc2=s=540x960:r=30:d=3,loop=loop=45:size=1:start=45', ...h264, meio])
    ffmpeg(['-f', 'lavfi', '-i', 'testsrc2=s=540x960:r=30:d=2,loop=loop=45:size=1:start=59', ...h264, fim])
    const a = (await checarVideo(meio, { checagens: ['parado'] })).achados
    const erro = a.filter((x) => x.nivel === 'erro')
    assert.equal(erro.length, 1, JSON.stringify(a))
    assert.ok(Math.abs(erro[0].t - 1.5) < 0.1 && Math.abs(erro[0].fim - 3.0) < 0.1, JSON.stringify(erro[0]))
    const b = await checarVideo(fim, { checagens: ['parado'] })
    assert.deepEqual(b.achados, [])
    assert.ok(b.medidas.cartaoFinalParado >= 1.4)
  })

  test('quadro todo vazio por 0,5 s → erro vazio, só ali', async () => {
    const mp4 = path.join(pasta, 'vazio.mp4'), saida = path.join(pasta, 'quadros-vazio')
    ffmpeg(['-f', 'lavfi', '-i', 'color=c=0x0d1117:s=540x960:r=30:d=3', '-f', 'lavfi', '-i', 'testsrc2=s=240x240:r=30:d=3',
      '-filter_complex', "[0][1]overlay=x='120+30*t':y=330:enable='not(between(t,1.2,1.7))'", ...h264, mp4])
    const { achados } = await checarVideo(mp4, { checagens: ['vazio'], saidaQuadros: saida })
    assert.equal(achados.length, 1, JSON.stringify(achados))
    const [v] = achados
    assert.equal(v.checagem, 'vazio')
    assert.equal(v.nivel, 'erro')
    assert.ok(Math.abs(v.t - 1.2) < 0.15 && Math.abs(v.fim - 1.7) < 0.15, JSON.stringify(v))
    assert.ok(fs.existsSync(v.quadro), 'grava o quadro marcado')
    assert.match(path.basename(v.quadro), /^vazio-\d+\.\d\d\.png$/)
  })
})

test('contraste na caixa: p95 − p5 da luminância, só dentro da caixa (a medida do ocr.swift, usada com o OCR do Windows)', () => {
  const W = 40, H = 20, px = new Uint8Array(W * H).fill(20)
  // texto claro (230) em 30% de uma caixa de 20×10; fora dela, um branco que não pode contar
  for (let y = 5; y < 15; y++) for (let x = 10; x < 30; x++) if ((x + y) % 10 < 3) px[y * W + x] = 230
  for (let x = 0; x < 5; x++) px[x] = 255
  assert.equal(contrasteNaCaixa(px, W, H, { x: 10, y: 5, w: 20, h: 10 }), 210)
  assert.equal(contrasteNaCaixa(px, W, H, { x: 0, y: 10, w: 8, h: 8 }), 0, 'fundo liso')
  assert.equal(contrasteNaCaixa(px, W, H, { x: 39, y: 5, w: 20, h: 10 }), null, 'caixa que sai do quadro sem 2 px dentro')
})

describe('vídeo: texto (OCR do sistema)', () => {
  let navegador = null, motivo = null
  before(async () => {
    if (binarioOcr().erro) { motivo = binarioOcr().erro; return }
    try { navegador = (await require('../scripts/playwright.cjs').abrirNavegador(pasta)).browser } catch (e) { motivo = e.message.split('\n')[0] }
  })
  after(async () => { if (navegador) await navegador.close() })

  async function videoDeHtml(nome, corpo, dur = 1.6) {
    const pg = await navegador.newPage({ viewport: { width: 1080, height: 1920 } })
    await pg.setContent(`<html><body style="margin:0;width:1080px;height:1920px;background:#0d1117;color:#fff;font-family:Helvetica,Arial,sans-serif;position:relative">${corpo}</body></html>`)
    const png = path.join(pasta, nome + '.png'), mp4 = path.join(pasta, nome + '.mp4')
    await pg.screenshot({ path: png })
    await pg.close()
    ffmpeg(['-loop', '1', '-r', '30', '-t', String(dur), '-i', png, ...h264, mp4])
    return mp4
  }
  const abs = (x, y, px, texto, extra = '') => `<div style="position:absolute;left:${x}px;top:${y}px;font-size:${px}px;line-height:1.2;${extra}">${texto}</div>`

  test('tela de app encolhida (dez links de 12 px) → erro de legibilidade', async (t) => {
    if (motivo) return t.skip(motivo)
    const links = ['Instagram oficial', 'Canal no YouTube', 'Servidor do Discord', 'Loja de camisetas', 'Fale no WhatsApp',
      'Planilha de achados', 'Tutorial completo', 'Cupom de desconto', 'Agenda de lives', 'Contato comercial']
    const tela = abs(380, 620, 20, '@seunome', 'font-weight:700') +
      links.map((l, k) => abs(380, 680 + 44 * k, 12, l, 'background:#fff;color:#111;padding:6px 60px;border-radius:14px')).join('')
    // 3,6 s parada: mais que o plano geral (2,6 s), então é erro
    const mp4 = await videoDeHtml('encolhida', tela, 3.6)
    const { achados, medidas } = await checarVideo(mp4, { plataforma: 'tiktok', checagens: ['legibilidade'] })
    assert.ok(medidas.linhasOcr >= 12, `o OCR leu ${medidas.linhasOcr} linhas`)
    const enc = achados.find((a) => /shrunken screen/.test(a.msg))
    assert.ok(enc, JSON.stringify(achados))
    assert.equal(enc.nivel, 'erro')
    assert.ok(enc.caixas.length >= 6)
  })

  test('texto grande dentro da área → nada; texto sob os botões do TikTok → erro de área segura', async (t) => {
    if (motivo) return t.skip(motivo)
    const corpo = abs(120, 500, 88, 'Sua bio<br>em um link') + abs(120, 800, 56, 'Vídeo de fundo grátis') +
      abs(950, 1150, 44, 'Siga', 'font-weight:700')
    const mp4 = await videoDeHtml('grande', corpo)
    const { achados } = await checarVideo(mp4, { plataforma: 'tiktok', checagens: ['legibilidade', 'area-segura'] })
    assert.deepEqual(achados.filter((a) => a.checagem === 'legibilidade'), [])
    const fora = achados.find((a) => a.checagem === 'area-segura' && /Siga/.test(a.msg))
    assert.ok(fora, JSON.stringify(achados))
    assert.equal(fora.nivel, 'erro')
    assert.ok(fora.caixas.some((c) => c.x + c.w > 940 && c.y > 1100 && c.y < 1250), JSON.stringify(fora.caixas))
    assert.equal(achados.filter((a) => a.checagem === 'area-segura' && a.nivel === 'erro').length, 1, 'o texto dentro da área não é acusado')
  })
})

const noPath = (nome) => {
  for (const d of (process.env.PATH || '').split(path.delimiter).filter(Boolean)) {
    for (const e of process.platform === 'win32' ? ['.exe', ''] : ['']) { try { if (fs.statSync(path.join(d, nome + e)).isFile()) return path.join(d, nome + e) } catch {} }
  }
  return null
}

test('sem o OCR do sistema (sem swiftc nem cache no Mac, sem o PowerShell no Windows), o OCR vira um aviso e as outras checagens seguem', (t) => {
  const ff = noPath('ffmpeg')
  if (!ff) return t.skip('sem ffmpeg')
  const dir = path.dirname(ff)
  if (['swiftc', 'powershell.exe'].some((p) => fs.existsSync(path.join(dir, p)))) return t.skip('o OCR do sistema mora na mesma pasta do ffmpeg')
  const mp4 = path.join(pasta, 'sem-ocr.mp4')
  ffmpeg(['-f', 'lavfi', '-i', 'testsrc2=s=270x480:r=30:d=2,loop=loop=45:size=1:start=59', ...h264, mp4])
  const casa = fs.mkdtempSync(path.join(os.tmpdir(), 'refino-casa-'))
  const env = { PATH: dir, HOME: casa, USERPROFILE: casa, ...(process.env.SystemRoot ? { SystemRoot: process.env.SystemRoot } : {}) }
  const r = spawnSync(process.execPath, [VIDEO, mp4, '--json', '--checks', 'legibilidade,parado'], { encoding: 'utf8', env })
  fs.rmSync(casa, { recursive: true, force: true })
  assert.equal(r.status, 0, r.stderr)
  const { achados, medidas } = JSON.parse(r.stdout)
  assert.equal(achados.length, 1, JSON.stringify(achados))
  assert.equal(achados[0].checagem, 'legibilidade')
  assert.equal(achados[0].nivel, 'aviso')
  assert.match(achados[0].msg, /OCR did not run/)
  assert.ok(medidas.cartaoFinalParado >= 1.4, 'o parado rodou mesmo sem OCR')
})
