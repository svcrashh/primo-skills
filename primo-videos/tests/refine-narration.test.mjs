// A porta única com voz: node refine.mjs <pasta> sai com código 1 e o relatório quando a animação acende antes da
// palavra, corrige a narration.json e passa na segunda volta; o gabarito do produto guarda a voz aprovada como régua.
// Fala sintética (tests/voice-signals.mjs). node --test tests/refine-narration.test.mjs (sem rede; ffmpeg)
import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { temposJs } from '../scripts/chapters/tempos.mjs'
import { falaSintetica, falaDoWav } from './voice-signals.mjs'

const AQUI = path.dirname(fileURLToPath(import.meta.url))
const REFINE = path.join(AQUI, '..', 'scripts', 'refine.mjs')
const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'refine-narration-'))
const rodar = (args, env = {}) => spawnSync(process.execPath, [REFINE, ...args], { encoding: 'utf8', env: { ...process.env, ...env } })
const ff = (args) => assert.equal(spawnSync('ffmpeg', ['-v', 'error', '-y', ...args]).status, 0)
const SEM = ['--no-pages', '--no-ocr', '--no-direction']

// "No Vyrta, nove e noventa e nove!": o alinhamento cru põe o 1º "nove" 0,54 s antes do som (dentro da pausa), e a
// cena acende em em('nove'). O MP4 é um quadro que se mexe o tempo todo (testsrc2), sem texto pequeno.
const VERDADE = [['No', 0.2, 0.4], ['Vyrta,', 0.45, 0.95], ['nove', 1.5, 1.85], ['e', 1.9, 2.0], ['noventa', 2.05, 2.55], ['e', 2.6, 2.7], ['nove!', 2.75, 3.3]]
const CRU = VERDADE.map(([t, a, b], i) => [t, i === 2 ? 0.96 : a, b])
function projeto() {
  const p = tmp(), voz = path.join(p, 'voice', 'v1'), cena = path.join(p, 'scenes', '02-vyrta')
  fs.mkdirSync(cena, { recursive: true })
  fs.mkdirSync(path.join(p, 'out'), { recursive: true })
  falaSintetica(path.join(voz, 'lines', 'c2.wav'), VERDADE.map(([, a, b]) => [a, b]))
  const fala = falaDoWav(voz, 'lines/c2.wav', { id: 'c2', onde: { capitulo: 2 }, palavras: CRU })
  fs.writeFileSync(path.join(voz, 'narration.json'), JSON.stringify({ versao: 1, idioma: 'pt-BR', voz: { nome: 'Invented Voice' }, falas: [fala] }))
  fs.writeFileSync(path.join(voz, 'script.json'), JSON.stringify({ perfil: 'calmo' }))
  fs.writeFileSync(path.join(cena, 'tempos.js'), temposJs(fala, { falaEm: 0.3, saida: 0.5, origem: 'voice/v1/narration.json' }).js)
  fs.writeFileSync(path.join(cena, 'scene.js'), "cena(0, VIDEO.duracao, () => (t) => { if (t > em('nove')) pula() })")
  fs.writeFileSync(path.join(cena, 'video.js'), "const VIDEO = { duracao: 4.4, formatos: ['9x16'], plataforma: 'tiktok', fontes: [] }")
  fs.writeFileSync(path.join(p, 'out', 'assembly.json'), JSON.stringify({ duracao: 4.4, fala_em: 0.3, cenas: [{ nome: '02-vyrta', ini: 0, dur: 4.4 }], falas: [{ id: 'c2', som: 0.5 }] }))
  ff(['-f', 'lavfi', '-i', 'testsrc2=s=1080x1920:r=30:d=4.4', '-pix_fmt', 'yuv420p', path.join(p, 'out', 'assembled-9x16.mp4')])
  return p
}

test('fails with the report, fixes the narration on its own and, with the tempos.js redone, passes', () => {
  const p = projeto()
  const r1 = rodar([p, ...SEM])
  assert.equal(r1.status, 1, r1.stdout + r1.stderr)
  const j = JSON.parse(fs.readFileSync(path.join(p, 'refine', 'refine.json'), 'utf8'))
  assert.equal(j.aprovado, false)
  const palavra = j.achados.find((a) => a.checagem === 'palavra' && a.nivel === 'erro')
  assert.match(palavra.msg, /em\('nove'\) lights up at .* 0\.5\d s before "nove" is heard/)
  assert.ok(j.correcoes.length, 'it fixed the narration')
  assert.match(j.correcoes[0], /narration\.before-refine\.json/)
  assert.ok(fs.existsSync(path.join(p, 'voice', 'v1', 'narration.before-refine.json')))
  assert.match(fs.readFileSync(path.join(p, 'refine', 'refine.md'), 'utf8'), /## Errors[\s\S]*Animation on the word/)
  // o que o refino manda fazer: o tempos.js de novo (o render da cena seria o passo seguinte)
  const loc = JSON.parse(fs.readFileSync(path.join(p, 'voice', 'v1', 'narration.json'), 'utf8'))
  assert.ok(Math.abs(loc.falas[0].palavras[2].ini - 1.5) < 0.03, 'the narration now has "nove" where it is heard')
  fs.writeFileSync(path.join(p, 'scenes', '02-vyrta', 'tempos.js'), temposJs(loc.falas[0], { falaEm: 0.3, saida: 0.5, origem: 'voice/v1/narration.json' }).js)
  const r2 = rodar([p, ...SEM])
  const j2 = JSON.parse(fs.readFileSync(path.join(p, 'refine', 'refine.json'), 'utf8'))
  assert.deepEqual(j2.achados.filter((a) => a.nivel === 'erro').map((a) => a.msg), [])
  assert.equal(r2.status, 0, r2.stdout)
})

test('--check-only does not touch the folder', () => {
  const p = projeto(), arq = path.join(p, 'voice', 'v1', 'narration.json'), antes = fs.readFileSync(arq, 'utf8')
  const saida = path.join(tmp(), 'report')
  const r = rodar([p, '--check-only', ...SEM, '--out', saida])
  assert.equal(r.status, 1)
  assert.equal(fs.readFileSync(arq, 'utf8'), antes)
  assert.ok(!fs.existsSync(path.join(p, 'refine')))
  assert.ok(fs.existsSync(path.join(saida, 'refine.md')))
})

test('profile: keeps the approved voice; the refine uses it as the baseline for the flat voice', () => {
  const p = projeto(), casa = tmp(), env = { VIDEOSTUDIO_PROFILES: casa }
  const v = path.join(p, 'out', 'assembled-9x16.mp4')
  const g = rodar(['profile', 'Test Product', '--from', p, '--video', v, '--approved'], env)
  assert.equal(g.status, 0, g.stderr)
  assert.match(g.stdout, /voice Invented Voice \(pitch/)
  const gab = JSON.parse(fs.readFileSync(path.join(casa, 'test-product', 'profile.json'), 'utf8'))
  assert.equal(gab.plataforma, 'tiktok')
  assert.ok(gab.voz.tom > 5 && gab.voz.energia > 10, JSON.stringify(gab.voz))
  assert.match(gab.voz.fonte, /Test Product/)
  const r = rodar([p, '--check-only', ...SEM, '--product', 'Test Product', '--out', path.join(tmp(), 'r')], env)
  const j = JSON.parse(fs.readFileSync(path.join(r.stdout.match(/· (\S+refine\.md)/)[1].replace('refine.md', 'refine.json')), 'utf8'))
  assert.equal(j.checagens['voz-apagada'].status, 'passou')
  assert.match(j.medidas.voz.referencia.fonte, /Test Product/)
})
