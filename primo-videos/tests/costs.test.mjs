// node --test tests/   (no network) the cost notebook: what a paid call writes, the totals, and the caps that stop a call.
import { test, describe, before, after } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { DEFAULT_CAPS, OverCap, boardBlock, checkCap, noteCost, readCaps, readCosts, totals, writeCaps } from '../scripts/costs.mjs'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const COSTS = path.join(HERE, '..', 'scripts', 'costs.mjs')
const run = (...a) => spawnSync(process.execPath, [COSTS, ...a], { encoding: 'utf8' })
let base
const project = (name) => path.join(base, name)

before(() => { base = fs.mkdtempSync(path.join(os.tmpdir(), 'costs-')) })
after(() => fs.rmSync(base, { recursive: true, force: true }))

describe('the notebook', () => {
  test('a video nobody spent on has the default caps and nothing spent', () => {
    const p = project('empty')
    assert.deepEqual(readCaps(p), DEFAULT_CAPS)
    assert.deepEqual(readCosts(p), [])
    assert.deepEqual(totals(p).images, { usd: 0, count: 0, capUsd: 0.5, leftUsd: 0.5 })
    assert.deepEqual(totals(p).voice, { credits: 0, calls: 0, capCredits: 1500, leftCredits: 1500 })
  })

  test('each paid call is one line, with its files relative to the project', () => {
    const p = project('noted')
    noteCost(p, { kind: 'image', provider: 'openai', model: 'some-model', label: 'scene 02', files: [path.join(p, 'images', '02.png')], usd: 0.043 })
    noteCost(p, { kind: 'image', provider: 'openai', label: 'scene 03 options', files: [path.join(p, 'images', '03-a.png'), path.join(p, 'images', '03-b.png')], usd: 0.012, count: 2 })
    noteCost(p, { kind: 'voice', provider: 'elevenlabs', label: 'line 01', files: [path.join(p, 'voice', 'v1', '01.wav')], credits: 86 })
    const costs = readCosts(p)
    assert.equal(costs.length, 3)
    assert.deepEqual(costs[0].files, ['images/02.png'])
    assert.deepEqual(costs[1].files, ['images/03-a.png', 'images/03-b.png'])
    const t = totals(p)
    assert.equal(t.images.usd, 0.055)
    assert.equal(t.images.count, 3)
    assert.equal(t.images.leftUsd, 0.445)
    assert.equal(t.voice.credits, 86)
    assert.equal(t.voice.leftCredits, 1414)
  })
})

describe('the caps', () => {
  test('a call that fits under the cap goes through; one that does not is stopped with code 5', () => {
    const p = project('capped')
    noteCost(p, { kind: 'image', provider: 'openai', usd: 0.46 })
    assert.doesNotThrow(() => checkCap(p, { kind: 'image', usd: 0.04 }))
    assert.throws(() => checkCap(p, { kind: 'image', usd: 0.05 }), (e) => e instanceof OverCap && e.code === 5 && /--image-usd/.test(e.message))
  })

  test('images and voice have separate caps', () => {
    const p = project('separate')
    noteCost(p, { kind: 'voice', provider: 'elevenlabs', credits: 1400 })
    assert.doesNotThrow(() => checkCap(p, { kind: 'image', usd: 0.5 }))
    assert.doesNotThrow(() => checkCap(p, { kind: 'voice', credits: 100 }))
    assert.throws(() => checkCap(p, { kind: 'voice', credits: 101 }), (e) => e instanceof OverCap && /--voice-credits/.test(e.message))
  })

  test('raising a cap lets the same call through and keeps the other cap', () => {
    const p = project('raised')
    noteCost(p, { kind: 'image', provider: 'openai', usd: 0.5 })
    assert.throws(() => checkCap(p, { kind: 'image', usd: 0.04 }), OverCap)
    assert.deepEqual(writeCaps(p, { imageUsd: 1 }), { imageUsd: 1, voiceCredits: 1500 })
    assert.doesNotThrow(() => checkCap(p, { kind: 'image', usd: 0.04 }))
  })
})

describe('the command line', () => {
  test('cap changes the caps and show reports what was spent against them', () => {
    const p = project('cli')
    noteCost(p, { kind: 'image', provider: 'openai', label: 'scene 02', usd: 0.043 })
    assert.match(run('cap', p, '--voice-credits', '3000').stdout, /image cap US\$ 0\.50 · voice cap 3,000 credits/)
    const shown = JSON.parse(run('show', p, '--json').stdout)
    assert.equal(shown.images.usd, 0.043)
    assert.equal(shown.voice.capCredits, 3000)
    assert.equal(shown.costs.length, 1)
    assert.match(run('show', p).stdout, /images: US\$ 0\.043 of US\$ 0\.50 \(1 generated/)
  })

  test('board prints the block the review board shows', () => {
    const p = project('board')
    noteCost(p, { kind: 'image', provider: 'openai', usd: 0.043 })
    noteCost(p, { kind: 'voice', provider: 'elevenlabs', credits: 480 })
    assert.deepEqual(JSON.parse(run('board', p, '--account-left', '13191').stdout), {
      images: { usd: 0.043, capUsd: 0.5, count: 1 },
      voice: { credits: 480, capCredits: 1500, accountLeft: 13191 },
    })
    assert.deepEqual(boardBlock(p).voice, { credits: 480, capCredits: 1500 })
  })

  test('a missing project is a usage error (code 2)', () => {
    const r = run('show')
    assert.equal(r.status, 2)
    assert.match(r.stderr, /usage: node costs\.mjs/)
  })
})
