// A leitura no player: a letra medida no tamanho em que fica depois de o player encolher o vídeo (references/refine.md,
// "A leitura no player"). node --test tests/refine-player.test.mjs (sem rede; ffmpeg. Os vídeos com OCR só rodam no
// macOS, com swiftc, e o texto sai do Playwright: sem um deles, esses são pulados)
import { test, describe, before, after } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import { larguraNormalizada, pxNoPlayer, pxParaOPlayer, fraseDoPlayer, classificarPlayer, binarioOcr } from '../scripts/refine/video.mjs'
import { resolverPlayer, PLAYERS } from '../scripts/refine.mjs'
import { CANAIS } from '../scripts/recommend-style.mjs'

const AQUI = path.dirname(fileURLToPath(import.meta.url))
const REFINAR = path.join(AQUI, '..', 'scripts', 'refine.mjs')
const require = createRequire(import.meta.url)
let pasta
before(() => { pasta = fs.mkdtempSync(path.join(os.tmpdir(), 'refino-player-teste-')) })
after(() => fs.rmSync(pasta, { recursive: true, force: true }))

const ffmpeg = (args) => { const r = spawnSync('ffmpeg', ['-v', 'error', '-y', ...args], { encoding: 'utf8' }); assert.equal(r.status, 0, r.stderr) }
const h264 = ['-c:v', 'libx264', '-preset', 'ultrafast', '-crf', '16', '-pix_fmt', 'yuv420p']
const refinar = (args) => spawnSync(process.execPath, [REFINAR, ...args], { encoding: 'utf8', env: { ...process.env, VIDEOSTUDIO_SEM_APP: '1' } })
const relatorio = (saida) => JSON.parse(fs.readFileSync(path.join(saida, 'refine.json'), 'utf8'))
const l = (texto, h, y = 600) => ({ texto, conf: 1, x: 200, y, w: 500, h })

// ── funções puras ────────────────────────────────────────────────────────────────────────────────
describe('a conta', () => {
  test('largura normalizada: o lado curto em 1080, como na legibilidade', () => {
    assert.equal(larguraNormalizada(1920, 1080), 1920)
    assert.equal(larguraNormalizada(1280, 720), 1920)
    assert.equal(larguraNormalizada(1080, 1920), 1080)
    assert.equal(larguraNormalizada(540, 960), 1080)
    assert.equal(larguraNormalizada(1080, 1080), 1080)
    assert.equal(larguraNormalizada(1080, 1350), 1080)
  })

  test('px no player e quanto a linha precisa ter no vídeo para chegar a 16 px', () => {
    assert.equal(pxParaOPlayer(1920, 390), 79, '16:9 no celular em pé')
    assert.equal(pxParaOPlayer(1080, 390), 45, '9:16 no celular em pé')
    assert.equal(pxParaOPlayer(1920, 854), 36, '16:9 no feed')
    assert.equal(pxParaOPlayer(1080, 1200), 16, 'player maior que o vídeo não aumenta a letra')
    assert.equal(pxNoPlayer(40, 1920, 390), 8.125)
    assert.ok(pxNoPlayer(79, 1920, 390) >= 16 && pxNoPlayer(78, 1920, 390) < 16, 'o N da mensagem é o primeiro que passa')
    assert.ok(pxNoPlayer(45, 1080, 390) >= 16 && pxNoPlayer(44, 1080, 390) < 16)
  })
})

describe('o player de cada canal', () => {
  test('os canais são os mesmos do recommend-style.mjs', () => {
    assert.deepEqual(Object.keys(PLAYERS).sort(), Object.keys(CANAIS).sort())
  })

  test('whatsapp e reels = 390, feed = 854, site e telão sem redução; --player vence o --channel', () => {
    assert.deepEqual(resolverPlayer({ canal: 'whatsapp' }), { largura: 390, origem: '--channel whatsapp', canal: 'whatsapp' })
    assert.equal(resolverPlayer({ canal: 'reels' }).largura, 390)
    assert.equal(resolverPlayer({ canal: 'feed' }).largura, 854)
    assert.equal(resolverPlayer({ canal: 'site' }).largura, null)
    assert.equal(resolverPlayer({ canal: 'big-screen' }).largura, null)
    const p = resolverPlayer({ player: '412', canal: 'feed' })
    assert.equal(p.largura, 412)
    assert.equal(p.origem, '--player 412 (overrides --channel feed)')
    assert.equal(resolverPlayer({}), null)
  })

  test('canal que não existe ou player que não é número: erro que diz o que usar', () => {
    assert.throws(() => resolverPlayer({ canal: 'tiktok' }), /whatsapp, reels, feed, site or big-screen/)
    assert.throws(() => resolverPlayer({ canal: 'toString' }), /does not exist/)
    assert.throws(() => resolverPlayer({ player: 'abc' }), /player width in px/)
    assert.throws(() => resolverPlayer({ player: '0' }), /greater than zero/)
  })
})

describe('a frase: o que fazer depende da situação', () => {
  test('a tela inteira pede câmera; poucas linhas pedem o texto maior, com o número', () => {
    assert.match(fraseDoPlayer({ telaInteira: true, precisa: 79, player: 390, formato: '16x9' }), /^Move the camera in on the current field: in a 390 px player, each line needs ≥ 79 px in the video/)
    assert.match(fraseDoPlayer({ precisa: 45, player: 390, formato: '9x16' }), /^Make the text ≥ 45 px in the video \(it reaches 16 px in a 390 px player\)/)
  })

  test('16:9 no celular em pé com um terço ou mais dos quadros com texto reprovando: faça o 9:16', () => {
    const faz = (o) => /make the 9:16\.$/.test(fraseDoPlayer({ precisa: 79, player: 390, formato: '16x9', ...o }))
    assert.ok(faz({ fracao: 0.5 }))
    assert.ok(faz({ fracao: 1 / 3 }))
    assert.ok(!faz({ fracao: 0.2 }), 'poucos quadros: é a linha, não o formato')
    assert.ok(!faz({ fracao: 1, formato: '9x16' }), 'o 9:16 já é o formato do celular em pé')
    assert.ok(!faz({ fracao: 1, player: 854, precisa: 36 }), 'o feed não é o celular em pé')
    assert.ok(faz({ fracao: 1, telaInteira: true }), 'vale também para a tela inteira')
  })
})

describe('classificar no player', () => {
  const o169 = { player: 390, largura: 1920, formato: '16x9' }

  test('linha de 40 px no 16:9 a 390: erro com os números (no vídeo, no player e quanto precisa)', () => {
    const { achados, medidas } = classificarPlayer([{ i: 0, t: 0, linhas: [l('Abra o menu', 40)] }, { i: 1, t: 0.5, linhas: [l('Abra o menu', 40)] }], o169)
    assert.equal(achados.length, 1)
    const [a] = achados
    assert.equal(a.checagem, 'player')
    assert.equal(a.nivel, 'erro')
    assert.equal(a.msg, '"Abra o menu" is 40 px in the video and ends up 8.1 px in a 390 px player (below 16 px)')
    assert.match(a.oque_fazer, /^Make the text ≥ 79 px in the video/)
    assert.match(a.oque_fazer, /make the 9:16/, 'todos os quadros com texto reprovam')
    assert.equal(a.fim, 1)
    assert.deepEqual({ p: medidas.precisa_px, c: medidas.quadrosComTexto, r: medidas.quadrosReprovados }, { p: 79, c: 2, r: 2 })
  })

  test('o mesmo player num 9:16: 40 px reprova (precisa de 45), 50 px passa; título grande no 16:9 passa', () => {
    const o916 = { player: 390, largura: 1080, formato: '9x16' }
    const [a] = classificarPlayer([{ i: 0, t: 0, linhas: [l('Toque em salvar', 40)] }], o916).achados
    assert.match(a.msg, /is 40 px in the video and ends up 14\.4 px/)
    assert.match(a.oque_fazer, /≥ 45 px/)
    assert.doesNotMatch(a.oque_fazer, /9:16/)
    assert.deepEqual(classificarPlayer([{ i: 0, t: 0, linhas: [l('Toque em salvar', 50)] }], o916).achados, [])
    assert.deepEqual(classificarPlayer([{ i: 0, t: 0, linhas: [l('Sua bio em um link', 120)] }], o169).achados, [])
  })

  test('a tela inteira (6+ linhas no mesmo quadro): um achado só, "aproxime a câmera"; até 2,6 s é o plano geral, aviso', () => {
    const tela = Array.from({ length: 8 }, (_, k) => l(`Linha do app ${k}`, 30, 300 + 40 * k))
    const longa = classificarPlayer(Array.from({ length: 7 }, (_, k) => ({ i: k, t: k * 0.5, linhas: tela })), o169).achados
    assert.equal(longa.length, 1)
    assert.equal(longa[0].nivel, 'erro')
    assert.match(longa[0].msg, /^8 lines below 16 px in a 390 px player in the same frame, for 3\.5 s; the smallest is 30 px in the video and ends up 6\.1 px/)
    assert.match(longa[0].oque_fazer, /^Move the camera in on the current field/)
    assert.equal(longa[0].caixas.length, 8)
    const curta = classificarPlayer([0, 0.5, 1].map((t, k) => ({ i: k, t, linhas: tela })), o169).achados
    assert.equal(curta.length, 1)
    assert.equal(curta[0].nivel, 'aviso')
    assert.match(curta[0].msg, /^wide shot of 1\.5 s/)
  })

  test('exceções e a abertura decorativa valem como na legibilidade; canto decorativo não conta', () => {
    const q = [{ i: 0, t: 0, linhas: [l('Fonte: site.com, 2026', 22), l('Fonte: mínima', 12, 700), l('Г', 10, 800)] }]
    const a = classificarPlayer(q, { ...o169, excecoes: ['^Fonte:'] }).achados
    assert.equal(a.length, 1, 'a exceção vale acima do piso de 16 px; abaixo dele, não (como na legibilidade)')
    assert.match(a[0].msg, /Fonte: mínima/)
    const abertura = [{ i: 0, t: 0.5, linhas: [l('celular desfocado', 20)] }, { i: 1, t: 3, linhas: [l('Sua bio em um link', 120)] }]
    assert.deepEqual(classificarPlayer(abertura, { ...o169, decoracaoAte: 2.4 }).achados, [])
  })

  test('16:9 com poucos quadros reprovando: a frase fica na linha, sem pedir o 9:16', () => {
    const q = [
      { i: 0, t: 0, linhas: [l('Rodapé pequeno', 40)] },
      ...[1, 2, 3, 4].map((i) => ({ i: i * 3, t: i * 1.5, linhas: [l('Título grande', 120)] })),
    ]
    const { achados, medidas } = classificarPlayer(q, o169)
    assert.equal(medidas.fracao, 0.2)
    assert.equal(achados.length, 1)
    assert.doesNotMatch(achados[0].oque_fazer, /9:16/)
  })
})

// ── o refine.mjs, sem OCR ───────────────────────────────────────────────────────────────────────
describe('refine.mjs: o player no relatório', () => {
  let mp4
  before(() => {
    mp4 = path.join(pasta, 'sem-texto.mp4')
    ffmpeg(['-f', 'lavfi', '-i', 'testsrc2=s=640x360:r=30:d=2', ...h264, mp4])
  })

  test('--channel site: a checagem não roda e o resumo diz por quê; sem nada, diz como ligar', () => {
    const saida = path.join(pasta, 'site')
    const r = refinar([mp4, '--channel', 'site', '--no-ocr', '--no-direction', '--out', saida])
    assert.ok([0, 1].includes(r.status), r.stderr)
    const j = relatorio(saida)
    assert.deepEqual(j.player, { largura: null, origem: '--channel site', canal: 'site' })
    assert.equal(j.checagens.player.status, 'não rodou')
    assert.match(j.checagens.player.nota, /--channel site: the video plays at full size/)
    assert.match(r.stdout, /^player: no reduction \(--channel site/m)
    const sem = path.join(pasta, 'sem')
    refinar([mp4, '--no-ocr', '--no-direction', '--out', sem])
    assert.match(relatorio(sem).checagens.player.nota, /no --channel or --player/)
    assert.match(fs.readFileSync(path.join(sem, 'refine.md'), 'utf8'), /- Player: not measured \(pass --channel or --player\)/)
  })

  test('--channel que não existe: código 2 e a lista dos que existem', () => {
    const r = refinar([mp4, '--channel', 'tiktok'])
    assert.equal(r.status, 2)
    assert.match(r.stderr, /whatsapp, reels, feed, site or big-screen/)
  })
})

// ── vídeos de verdade, com o OCR do macOS ────────────────────────────────────────────────────────
describe('refine.mjs --player com o OCR de verdade', () => {
  let navegador = null, motivo = null
  before(async () => {
    if (binarioOcr().erro) { motivo = binarioOcr().erro; return }
    try { navegador = (await require('../scripts/playwright.cjs').abrirNavegador(pasta)).browser } catch (e) { motivo = e.message.split('\n')[0] }
  })
  after(async () => { if (navegador) await navegador.close() })

  // 16:9 de 1920×1080: o texto numa placa de 1600 px que desliza devagar sobre o fundo (nada fica parado)
  async function video16x9(nome, corpo) {
    const pg = await navegador.newPage({ viewport: { width: 1600, height: 1080 } })
    await pg.setContent(`<html><body style="margin:0;width:1600px;height:1080px;background:#0d1117;color:#fff;font-family:Helvetica,Arial,sans-serif">${corpo}</body></html>`)
    const png = path.join(pasta, nome + '.png'), mp4 = path.join(pasta, nome + '.mp4')
    await pg.screenshot({ path: png })
    await pg.close()
    ffmpeg(['-f', 'lavfi', '-i', 'color=c=0x0d1117:s=1920x1080:r=30:d=2.4', '-loop', '1', '-i', png,
      '-filter_complex', "[0][1]overlay=x='100+40*t':y=0:shortest=1", ...h264, mp4])
    return mp4
  }
  const linha = (y, px, texto) => `<div style="position:absolute;left:120px;top:${y}px;font-size:${px}px;line-height:1.2">${texto}</div>`

  test('texto de 40 px no 16:9: passa na resolução cheia e reprova no player de 390, com o quadro marcado', async (t) => {
    if (motivo) return t.skip(motivo)
    const mp4 = await video16x9('quarenta', linha(380, 40, 'Abra o menu e toque em salvar') + linha(500, 40, 'Depois confirme o pedido na tela'))
    const saida = path.join(pasta, 'quarenta.refine')
    const r = refinar([mp4, '--player', '390', '--no-direction', '--out', saida])
    assert.equal(r.status, 1, r.stdout + r.stderr)
    const j = relatorio(saida)
    assert.equal(j.checagens.legibilidade.status, 'passou', JSON.stringify(j.achados.filter((a) => a.checagem === 'legibilidade')))
    assert.equal(j.checagens.player.status, 'reprovou')
    assert.equal(j.player.origem, '--player 390')
    const erros = j.achados.filter((a) => a.checagem === 'player' && a.nivel === 'erro')
    assert.ok(erros.length >= 1, JSON.stringify(j.achados))
    for (const a of erros) {
      assert.match(a.msg, /is (\d+) px in the video and ends up \d+\.\d px in a 390 px player/)
      const [, px] = a.msg.match(/is (\d+) px in the video/)
      assert.ok(+px >= 28 && +px < 79, `a linha mede ${px} px: legível na resolução cheia, pequena no player`)
      assert.match(a.oque_fazer, /Make the text ≥ 79 px in the video .* make the 9:16\.$/)
      assert.ok(a.quadro && fs.existsSync(a.quadro), "o quadro marcado existe")
    }
    assert.match(r.stdout, /^player: 390 px \(--player 390\)/m)
    assert.match(r.stdout, /a line needs ≥ 79 px in the video/)
    assert.match(fs.readFileSync(path.join(saida, 'refine.md'), 'utf8'), /\*\*Player readability\*\* · .*ends up \d+\.\d px in a 390 px player/)
  })

  test('texto grande no 16:9: passa no player de 390 (pelo --channel whatsapp)', async (t) => {
    if (motivo) return t.skip(motivo)
    const mp4 = await video16x9('grande', linha(300, 120, 'Sua bio em um link') + linha(520, 96, 'Pronto em um minuto'))
    const saida = path.join(pasta, 'grande.refine')
    const r = refinar([mp4, '--channel', 'whatsapp', '--no-direction', '--out', saida])
    const j = relatorio(saida)
    assert.equal(r.status, 0, r.stdout + JSON.stringify(j.achados))
    assert.deepEqual(j.player, { largura: 390, origem: '--channel whatsapp', canal: 'whatsapp' })
    assert.equal(j.checagens.player.status, 'passou')
    const p = j.medidas.videos[0].player
    assert.ok(p.quadrosComTexto >= 4 && p.quadrosReprovados === 0, JSON.stringify(p))
  })
})
