// node --test tests/   o --check com voz: antes de gerar a voz, pelo script.json, ele acha a fala da abertura que não
// é o título, a do fecho que não é o fimLinhas e o g.na sem a palavra na fala, junto com as outras regras (o placar, o
// rótulo, o antes). A jornada roda numa página local (file://), sem rede.
import { test, describe, before, after } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { createRequire } from 'node:module'
import { pathToFileURL } from 'node:url'
import { lerRoteiroComoLocucao, conferirTextos } from '../scripts/tutorial/locucao.mjs'

const require = createRequire(import.meta.url)
const temPlaywright = require('../scripts/playwright.cjs').candidatos().length > 0
const temFfmpeg = (() => { try { execFileSync('ffmpeg', ['-version'], { stdio: 'ignore' }); return true } catch { return false } })()

let base, serie, pyFalso
const VP = { width: 800, height: 500 }
before(() => {
  base = fs.mkdtempSync(path.join(os.tmpdir(), 'check-voice-'))
  // uma série mínima (o desenho antigo, sem "versao"): brand.js, identity.json e series.json
  serie = path.join(base, 'serie')
  fs.mkdirSync(serie)
  fs.writeFileSync(path.join(serie, 'brand.js'), 'const MARCA = { cores: { marca: "#FF6A1F", tinta: "#111111", fundo: "#FFFFFF" } }\n')
  fs.writeFileSync(path.join(serie, 'identity.json'), '{}\n')
  fs.writeFileSync(path.join(serie, 'series.json'), JSON.stringify({ fimLinhas: ['Ready to use today.'] }))
  // um "python" que diz ter numpy e scipy (a trilha não roda aqui; só a conferência)
  pyFalso = path.join(base, 'fake-python')
  fs.writeFileSync(pyFalso, '#!/bin/sh\nexit 0\n', { mode: 0o755 })
  process.env.VIDEOSTUDIO_PYTHON = pyFalso
  fs.writeFileSync(path.join(base, 'page.html'), '<!doctype html><meta charset="utf-8"><body style="margin:0;font:16px sans-serif"><h1>Editor</h1><button id="b" style="margin:40px;padding:12px 24px">Save and continue</button></body>')
})
after(() => { delete process.env.VIDEOSTUDIO_PYTHON; fs.rmSync(base, { recursive: true, force: true }) })

function pastaDoVideo(nome, falas) {
  const pasta = path.join(base, nome)
  fs.mkdirSync(path.join(pasta, 'voice', 'v1'), { recursive: true })
  fs.writeFileSync(path.join(pasta, 'voice', 'v1', 'script.json'), JSON.stringify({ idioma: 'en-US', perfil: 'calmo', voz: { id: 'x' }, falas }))
  return pasta
}
const video = (pasta, roteiro, extra = {}) => ({
  id: path.basename(pasta), pasta, serie, titulo: 'Three tweaks in the editor.', versoes: ['computer'],
  aparelhos: { computer: { viewport: VP, dsf: 1, toque: false, formato: '16x9' } },
  url: pathToFileURL(path.join(base, 'page.html')).href,
  voz: { locucao: 'voice/v1/narration.json', perfil: 'calmo' }, roteiro, ...extra,
})

describe('the voice from the script text (before generating it)', () => {
  test('reads the lines without the voice markup, and conferirTextos gives both errors together', () => {
    const pasta = pastaDoVideo('text', [
      { id: 'abertura', onde: 'abertura', texto: '[warm] Something else.' },
      { id: 'p1', onde: { passo: 1 }, texto: 'Tap on Save and continue.' },
      { id: 'fecho', onde: 'fechamento', texto: 'Bye.' },
    ])
    const v = lerRoteiroComoLocucao(video(pasta), 'computer')
    assert.equal(v.soTexto, true)
    assert.equal(v.abertura.texto, 'Something else.')
    assert.deepEqual(v.passos.get(1).palavras.map((p) => p.texto), ['Tap', 'on', 'Save', 'and', 'continue.'])
    assert.throws(() => conferirTextos(v, { titulo: 'Three tweaks in the editor.', fimLinhas: ['Ready to use today.'] }), (e) => /opening line/.test(e.message) && /closing line/.test(e.message))
  })

  test('without a script or a narration, the error says what to write', () => {
    const pasta = path.join(base, 'empty')
    fs.mkdirSync(pasta, { recursive: true })
    assert.throws(() => lerRoteiroComoLocucao(video(pasta), 'computer'), /write the script\.json before the --check/)
  })
})

describe('the --check on a real journey', { skip: !temPlaywright && 'no Playwright on this machine' }, () => {
  test('finds every problem at once, each with what to change', async () => {
    const { rodar } = await import('../scripts/tutorial/record.mjs')
    const pasta = pastaDoVideo('fails', [
      { id: 'abertura', onde: 'abertura', texto: 'Another opening.' },
      { id: 'p1', onde: { passo: 1 }, texto: 'Every section ends in Save and continue.' },
      { id: 'fecho', onde: 'fechamento', texto: 'Another closing.' },
    ])
    fs.mkdirSync(path.join(pasta, 'antes'))
    if (temFfmpeg) execFileSync('ffmpeg', ['-v', 'error', '-y', '-f', 'lavfi', '-i', 'color=c=gray:s=100x100', '-frames:v', '1', path.join(pasta, 'antes', 'torto.png')])
    const roteiro = async (g) => {
      await g.passo('Every section ends in Save and continue.', { junto: true })
      await g.na('Save')
      await g.na('Publish')
      await g.toque('#b')
      await g.prova('A label that is far too long')
      if (temFfmpeg) await g.antes('antes/torto.png')
      await g.placar([{ valor: 3, rotulo: 'tweaks' }], { ms: 2000 })
    }
    const [r] = await rodar(video(pasta, roteiro), { check: true, versao: 'computer' })
    process.exitCode = 0
    assert.equal(r.ok, false)
    const ck = JSON.parse(fs.readFileSync(path.join(pasta, 'output', 'computer', 'check.json'), 'utf8'))
    const tudo = ck.regras.join('\n')
    assert.match(tudo, /the opening line \("Another opening\."\) is not the video title/)
    assert.match(tudo, /the closing line \("Another closing\."\)/)
    assert.match(tudo, /g\.na\('Publish'\)/)
    assert.match(tudo, /at most 16 characters/)
    assert.match(tudo, /g\.placar: with ms 2000 the scoreboard stays readable for 1\.35 s.*Use ms ≥ 3150/)
    if (temFfmpeg) assert.match(tudo, /torto\.png is 100×100, and the recording is 800×500/)
  })

  test('a right journey passes, and the scoreboard without ms already holds long enough', async () => {
    const { rodar } = await import('../scripts/tutorial/record.mjs')
    const pasta = pastaDoVideo('passes', [
      { id: 'abertura', onde: 'abertura', texto: 'Three tweaks in the editor.' },
      { id: 'p1', onde: { passo: 1 }, texto: 'Every section ends in Save and continue.' },
      { id: 'fecho', onde: 'fechamento', texto: 'Ready to use today.' },
    ])
    const roteiro = async (g) => {
      await g.passo('Every section ends in Save and continue.', { junto: true })
      await g.na('Save and continue')
      await g.toque('#b')
      await g.prova('Saved')
      await g.placar([{ valor: 3, rotulo: 'tweaks' }])
    }
    const [r] = await rodar(video(pasta, roteiro), { check: true, versao: 'computer' })
    process.exitCode = 0
    assert.equal(r.ok, true, r.erro)
  })
})
