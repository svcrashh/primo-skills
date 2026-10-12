// O refino do núcleo, sem locução: as regras da rodada e o vídeo sem narração, em que as checagens da voz ficam de fora
// sem derrubar o resto. node --test tests/refine-rules.test.mjs (sem rede; ffmpeg)
import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const AQUI = path.dirname(fileURLToPath(import.meta.url))
const REFINAR = path.join(AQUI, '..', 'scripts', 'refine.mjs')

test('--rule: número vira número, texto_excecoes vira lista, e o = dentro da expressão não quebra', async () => {
  const { lerRegras } = await import('../scripts/refine.mjs')
  assert.deepEqual(lerRegras(['parado_max=0.8', 'texto_excecoes=^M\\W*marca$|exemplo\\.com']), { parado_max: 0.8, texto_excecoes: ['^M\\W*marca$', 'exemplo\\.com'] })
  assert.deepEqual(lerRegras(['texto_excecoes=a=b']), { texto_excecoes: ['a=b'] })
  assert.deepEqual(lerRegras(), {})
})

test('vídeo sem locução: as checagens da voz não rodam, e o resto do refino roda', () => {
  const p = fs.mkdtempSync(path.join(os.tmpdir(), 'refino-sem-voz-'))
  fs.mkdirSync(path.join(p, 'out'))
  const mp4 = path.join(p, 'out', 'final.mp4')
  assert.equal(spawnSync('ffmpeg', ['-v', 'error', '-y', '-f', 'lavfi', '-i', 'testsrc2=s=640x360:d=2:r=30', '-pix_fmt', 'yuv420p', mp4]).status, 0)
  const r = spawnSync(process.execPath, [REFINAR, p, '--check-only', '--no-ocr', '--no-pages', '--no-direction'], { encoding: 'utf8' })
  assert.ok([0, 1].includes(r.status), r.stderr || r.stdout)
  const j = JSON.parse(fs.readFileSync(path.join(p, 'refine', 'refine.json'), 'utf8'))
  assert.match(j.checagens.alinhamento.nota, /no narration\.json in the project|video without voiceover/)
  assert.match(j.checagens.palavra.nota, /no voiceover or scenes|video without voiceover/)
  assert.equal(j.videos.length, 1)
  assert.ok(['passou', 'aviso', 'reprovou'].includes(j.checagens.parado.status), j.checagens.parado.status)
})
