// Com a legenda e os sons desligados, o vídeo sai idêntico: cópia byte a byte. node --test tests/captions-off.test.mjs
import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const aqui = path.dirname(fileURLToPath(import.meta.url))
const legendar = path.join(aqui, '..', 'scripts', 'captions', 'caption.mjs')

test('sem --captions e sem --sounds a saída é idêntica à entrada', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'legendar-teste-'))
  const entrada = path.join(tmp, 'in.mp4'), saida = path.join(tmp, 'out.mp4')
  const g = spawnSync('ffmpeg', ['-v', 'error', '-y', '-f', 'lavfi', '-i', 'testsrc=size=270x480:rate=30:duration=1', '-f', 'lavfi', '-i', 'sine=frequency=440:duration=1', '-c:v', 'libx264', '-c:a', 'aac', '-shortest', entrada])
  assert.equal(g.status, 0)
  const r = spawnSync('node', [legendar, '--video', entrada, '--out', saida], { encoding: 'utf8' })
  assert.equal(r.status, 0, r.stderr)
  assert.ok(fs.readFileSync(entrada).equals(fs.readFileSync(saida)))
  fs.rmSync(tmp, { recursive: true, force: true })
})

test('--captions sem locução é erro que diz o que falta, não um vídeo sem legenda', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'legendar-teste-'))
  const entrada = path.join(tmp, 'in.mp4')
  spawnSync('ffmpeg', ['-v', 'error', '-y', '-f', 'lavfi', '-i', 'testsrc=size=270x480:rate=30:duration=1', '-c:v', 'libx264', entrada])
  const r = spawnSync('node', [legendar, '--video', entrada, '--out', path.join(tmp, 'o.mp4'), '--captions'], { encoding: 'utf8' })
  assert.notEqual(r.status, 0)
  assert.match(r.stderr, /--narration/)
  fs.rmSync(tmp, { recursive: true, force: true })
})
