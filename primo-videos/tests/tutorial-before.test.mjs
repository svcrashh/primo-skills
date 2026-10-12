// node --test tests/   o --check do gravador acha, antes de gravar, o que o compor recusaria (o ms do g.placar, o rótulo
// do g.prova, o g.antes, a série), tudo de uma vez; e o g.antes chega ao compor e ao desenho. Sem voz (a parte da fala está
// em tutorial-check-voz.test.mjs). A jornada roda numa página local (file://), sem rede.
import { test, describe, before, after } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { createRequire } from 'node:module'
import { pathToFileURL } from 'node:url'
import { msMinimoDoPlacar, TEMPO_PLACAR, PLACAR_MIN, rotulosDoAntes } from '../scripts/tutorial/rules.mjs'
import { conferirComposicao, prepararAntes, conferirArquivoDoAntes, folhaDoVideo } from '../scripts/tutorial/compose.mjs'

const require = createRequire(import.meta.url)
const temPlaywright = require('../scripts/playwright.cjs').candidatos().length > 0
const temFfmpeg = (() => { try { execFileSync('ffmpeg', ['-version'], { stdio: 'ignore' }); return true } catch { return false } })()

let base, serie, pyFalso
const VP = { width: 800, height: 500 }
before(() => {
  base = fs.mkdtempSync(path.join(os.tmpdir(), 'check-'))
  // uma série mínima (o desenho antigo, sem "versao"): brand.js, identity.json e series.json
  serie = path.join(base, 'serie')
  fs.mkdirSync(serie)
  fs.writeFileSync(path.join(serie, 'brand.js'), 'const MARCA = { cores: { marca: "#FF6A1F", tinta: "#111111", fundo: "#FFFFFF" } }\n')
  fs.writeFileSync(path.join(serie, 'identity.json'), '{}\n')
  fs.writeFileSync(path.join(serie, 'series.json'), JSON.stringify({ fimLinhas: ['Dá pra usar hoje.'] }))
  // um "python" que diz ter numpy e scipy (a trilha não roda aqui; só a conferência)
  pyFalso = path.join(base, 'python-falso')
  fs.writeFileSync(pyFalso, '#!/bin/sh\nexit 0\n', { mode: 0o755 })
  process.env.VIDEOSTUDIO_PYTHON = pyFalso
  // a página da jornada
  fs.writeFileSync(path.join(base, 'pagina.html'), '<!doctype html><meta charset="utf-8"><body style="margin:0;font:16px sans-serif"><h1>Editor</h1><button id="b" style="margin:40px;padding:12px 24px">Salvar e continuar</button></body>')
})
after(() => { delete process.env.VIDEOSTUDIO_PYTHON; fs.rmSync(base, { recursive: true, force: true }) })

const video = (pasta, roteiro, extra = {}) => ({
  id: path.basename(pasta), pasta, serie: serie, titulo: 'Três ajustes no editor.', versoes: ['computer'],
  aparelhos: { computer: { viewport: VP, dsf: 1, toque: false, formato: '16x9' } },
  url: pathToFileURL(path.join(base, 'pagina.html')).href,
  roteiro, ...extra,
})

describe('as regras que o gravador e o compor dividem', () => {
  test('o ms mínimo do placar deixa 2,5 s legível depois de o último número assentar', () => {
    assert.equal(msMinimoDoPlacar([{ valor: 3, rotulo: 'a' }]), Math.ceil((TEMPO_PLACAR({ itens: [1] }) + PLACAR_MIN) * 1000))
    assert.equal(msMinimoDoPlacar([{ valor: 3, rotulo: 'a' }]), 3150)
    assert.equal(msMinimoDoPlacar([{ valor: 3, rotulo: 'a' }, { valor: 0, rotulo: 'b' }]), 3650)
    // o padrão de antes (3000 ms) deixava 2,35 s: era a regra que só estourava na composição
    assert.ok(3000 < msMinimoDoPlacar([{ valor: 1, rotulo: 'a' }]))
  })

  test('os rótulos do antes seguem o idioma do vídeo, e a série troca', () => {
    assert.deepEqual(rotulosDoAntes(), { rotulo: 'Before', agora: 'Now' })
    assert.deepEqual(rotulosDoAntes('pt-BR'), { rotulo: 'Antes', agora: 'Agora' })
    assert.deepEqual(rotulosDoAntes('es-ES'), { rotulo: 'Antes', agora: 'Ahora' })
    assert.deepEqual(rotulosDoAntes('en-US'), { rotulo: 'Before', agora: 'Now' })
    assert.deepEqual(rotulosDoAntes('pt-BR', { antes: { agora: 'Hoje' } }), { rotulo: 'Antes', agora: 'Hoje' })
  })
})

describe('a série conferida antes de gravar', () => {
  test('série sem identity.json é erro do --check, com o caminho', () => {
    const s2 = path.join(base, 'serie-sem-trilha')
    fs.mkdirSync(s2, { recursive: true })
    fs.copyFileSync(path.join(serie, 'brand.js'), path.join(s2, 'brand.js'))
    const r = conferirComposicao({ pasta: base, serie: s2 }, { toque: false, viewport: VP })
    assert.ok(r.erros.some((e) => /identity\.json/.test(e)), r.erros.join(' | '))
    assert.deepEqual(conferirComposicao({ pasta: base, serie }, { toque: false, viewport: VP }).erros, [])
    assert.match(conferirComposicao({ pasta: base, serie: path.join(base, 'nao-existe') }, { toque: false, viewport: VP }).erros[0], /the series does not exist/)
  })
})

describe('o --check numa jornada de verdade (sem voz)', { skip: !temPlaywright && 'sem Playwright nesta máquina' }, () => {
  test('acha todos os problemas de uma vez, cada um com o que trocar', async () => {
    const { rodar } = await import('../scripts/tutorial/record.mjs')
    const pasta = path.join(base, 'reprova')
    fs.mkdirSync(path.join(pasta, 'antes'), { recursive: true })
    if (temFfmpeg) execFileSync('ffmpeg', ['-v', 'error', '-y', '-f', 'lavfi', '-i', 'color=c=gray:s=100x100', '-frames:v', '1', path.join(pasta, 'antes', 'torto.png')])
    const roteiro = async (g) => {
      await g.passo('Toda seção termina em Salvar e continuar.')
      await g.toque('#b')
      await g.prova('Um rótulo comprido demais')
      if (temFfmpeg) await g.antes('antes/torto.png')
      await g.antes('antes/nao-existe.png')
      await g.placar([{ valor: 3, rotulo: 'ajustes' }], { ms: 2000 })
    }
    const [r] = await rodar(video(pasta, roteiro, { voz: undefined }), { check: true, versao: 'computer' })
    process.exitCode = 0
    assert.equal(r.ok, false)
    const tudo = JSON.parse(fs.readFileSync(path.join(pasta, 'output', 'computer', 'check.json'), 'utf8')).regras.join('\n')
    assert.match(tudo, /at most 16 characters/)
    assert.match(tudo, /g\.placar: with ms 2000 the scoreboard stays readable for 1\.35 s.*Use ms ≥ 3150/)
    assert.match(tudo, /antes\/nao-existe\.png not found/)
    if (temFfmpeg) assert.match(tudo, /torto\.png is 100×100, and the recording is 800×500/)
  })

  test('jornada certa passa, e o placar sem ms já segura o bastante', async () => {
    const { rodar } = await import('../scripts/tutorial/record.mjs')
    const pasta = path.join(base, 'passa')
    fs.mkdirSync(pasta, { recursive: true })
    const roteiro = async (g) => {
      await g.passo('Toda seção termina em Salvar e continuar.')
      await g.toque('#b')
      await g.prova('Salvo')
      await g.placar([{ valor: 3, rotulo: 'ajustes' }])
    }
    const [r] = await rodar(video(pasta, roteiro, { voz: undefined }), { check: true, versao: 'computer' })
    process.exitCode = 0
    assert.equal(r.ok, true, r.erro)
  })
})

describe('g.antes no compor e no desenho', { skip: !temFfmpeg && 'sem ffmpeg' }, () => {
  test('a imagem tem de ser a tela inteira do aparelho; o clipe vira quadros', () => {
    const pasta = path.join(base, 'antes-compor'), comp = path.join(pasta, 'comp')
    fs.mkdirSync(path.join(pasta, 'antes'), { recursive: true })
    const gera = (nome, extra) => execFileSync('ffmpeg', ['-v', 'error', '-y', '-f', 'lavfi', ...extra, path.join(pasta, 'antes', nome)])
    gera('certo.png', ['-i', 'color=c=white:s=1600x1000', '-frames:v', '1'])
    gera('torto.png', ['-i', 'color=c=white:s=1000x1000', '-frames:v', '1'])
    gera('clipe.mp4', ['-i', 'testsrc=s=800x500:r=30:d=1.5', '-pix_fmt', 'yuv420p'])
    assert.throws(() => conferirArquivoDoAntes(path.join(pasta, 'antes', 'torto.png'), VP), /1000×1000, and the recording is 800×500/)
    const ev = [
      { t: 0.5, tipo: 'passo', n: 1 }, { t: 0.65, tipo: 'antes', passo: 1, arquivo: 'antes/certo.png', dur: 1.2, ret: { x: 10, y: 10, w: 200, h: 100 } },
      { t: 5, tipo: 'passo', n: 2 }, { t: 5.15, tipo: 'antes', passo: 2, arquivo: 'antes/clipe.mp4', dur: 1.2 },
    ]
    const a = prepararAntes({ pasta }, comp, ev, { viewport: VP, fps: 30 })
    assert.equal(a.length, 2)
    assert.deepEqual(a[0].quadros, [['antes/1.png', 0]])
    assert.ok(fs.existsSync(path.join(comp, 'antes', '1.png')))
    assert.ok(a[1].quadros.length >= 36, `${a[1].quadros.length} quadros`)
    assert.equal(a[1].quadros[0][0], 'antes/2/0001.jpg')
    assert.deepEqual(a[0].ret, { x: 10, y: 10, w: 200, h: 100 })
  })

  test('o antes não mexe no som (o áudio fica intacto)', () => {
    const log = { versao: 'computer', duracao: 8, aparelho: { toque: false, formato: '16x9' }, eventos: [{ t: 0.5, tipo: 'passo', n: 1 }, { t: 0.65, tipo: 'antes', passo: 1, arquivo: 'a.png', dur: 1.2 }] }
    const m = folhaDoVideo({ id: 'v' }, log, { A: 2, F: 2, semente: 1, serie: {} }).marcos
    assert.ok(!m.some((x) => /antes|before/i.test(x.evento)))
  })

  test('o desenho põe a tela do antes na moldura, segura a câmera no relance e escreve a etiqueta', () => {
    const tu = fs.readFileSync(new URL('../scripts/tutorial/tutorial.js', import.meta.url), 'utf8')
    assert.match(tu, /const antes = \(TU\.antes \|\| \[\]\)\.map/)
    assert.match(tu, /janelasAntes\.push\(\[A \+ e\.t, A \+ e\.t \+ e\.dur\]\)/)
    assert.match(tu, /if \(emAntes\) ra = 0/)
    const de = fs.readFileSync(new URL('../scripts/tutorial/drawing.js', import.meta.url), 'utf8')
    assert.match(de, /const cenaDoAntes = \(\) => cena\(/)
    assert.match(de, /tx\.textContent = estado === 'antes' \? TX\.rotulo : TX\.agora/)
  })
})
