// node --test tests/   (sem rede) o refino numa pasta de tutorial: o compor deixa o MP4 na raiz (<id>-<device>-draft.mp4),
// sem out/, e o refine.mjs <folder> acha o mais novo dali (antes, ele não achava nada e quase nada rodava).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { acharVideo } from '../scripts/refine.mjs'

test('na pasta do tutorial (com video.mjs e sem out/), vale o MP4 mais novo da raiz', () => {
  const p = fs.mkdtempSync(path.join(os.tmpdir(), 'refino-tutorial-'))
  try {
    assert.equal(acharVideo(p, undefined, true), null)
    fs.writeFileSync(path.join(p, 'video.mjs'), 'export default {}\n')
    assert.equal(acharVideo(p, undefined, true), null)
    fs.writeFileSync(path.join(p, 'v-computer.mp4'), '')
    const velho = new Date(Date.now() - 60000)
    fs.utimesSync(path.join(p, 'v-computer.mp4'), velho, velho)
    fs.writeFileSync(path.join(p, 'v-computer-draft.mp4'), '')
    assert.equal(acharVideo(p, undefined, true), path.join(p, 'v-computer-draft.mp4'))
  } finally { fs.rmSync(p, { recursive: true, force: true }) }
})
