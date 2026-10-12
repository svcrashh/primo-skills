// node --test tests/board.test.mjs   (no network beyond 127.0.0.1, no browser, no terminal opened)
// The review board: the board.json contract, the page drawn phase by phase from two very different boards, the
// conversation between the person and the skill, the click that `wait` hears, and what the local server refuses.
import { test, describe, before, after } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import http from 'node:http'
import { spawn, spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { applyAction, patchBoard, readBoard, readEvents, resolveInside, skillEvent, validateBoard, writeBoard } from '../scripts/board/data.mjs'
import { listenerState, looksLike, sanitizeName, startBoardServer } from '../scripts/board/server.mjs'
import { nextPhase, phaseOfHash, hashOfPhase, phasesOf, renderPage, resolvePhase, startPhase } from '../scripts/board/render.mjs'
import { agentPrompt, terminalCommand } from '../scripts/board.mjs'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const CLI = path.join(HERE, '..', 'scripts', 'board.mjs')
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64')
const MP4 = Buffer.concat([Buffer.from([0, 0, 0, 24]), Buffer.from('ftypmp42'), Buffer.alloc(64, 7)])

// A tutorial: three scenes, nothing to choose, nothing else on the page.
const TUTORIAL = {
  title: 'Send an invoice',
  subtitle: 'Tutorial · 20 s · 9:16',
  progress: { percent: 20, text: 'screens recorded; now: stills' },
  scenes: [
    { id: '01', title: 'Open the menu', seconds: 5, state: 'still-approved', still: 'screens/01.png', onScreen: 'Step 1', willMove: ['The camera goes to the menu'] },
    { id: '02', title: 'Fill the amount', seconds: 9, state: 'concept', still: 'screens/02.png', willMove: ['The field types itself'] },
    { id: '03', title: 'Press send', seconds: 6, state: 'animated-preview', still: 'screens/03.png', video: 'out/03.mp4', onScreen: 'Done!' },
  ],
}

// A concept video: eight scenes, two open choices, pieces and two references (one already next to a scene).
const CONCEPT = {
  title: 'Autumn <launch> & more',
  subtitle: 'Concept · 48 s · 16:9',
  progress: { label: 'Stills', percent: 62.4, text: 'two choices open' },
  choices: [
    {
      id: 'mascot', title: 'Which mascot', intro: 'Three drawings of the same fox.', scene: 's2',
      options: [
        { label: 'A', title: 'Round fox', line: 'Soft and friendly.', image: 'concepts/fox-a.png', willMove: ['The tail wags'], recommended: true },
        { label: 'B', title: 'Paper fox', line: 'Folded, flat color.', image: 'concepts/fox-b.png', willMove: ['It unfolds'] },
        { label: 'C', title: 'Line fox', image: 'concepts/fox-c.png' },
      ],
    },
    {
      id: 'ending', title: 'How it ends', scene: 's8',
      options: [
        { label: 'calm', title: 'Slow fade', image: 'concepts/end-1.jpg' },
        { label: 'bold', title: 'Hard cut', image: 'concepts/end-2.jpg', recommended: true },
      ],
    },
  ],
  scenes: [
    { id: 's1', title: 'Opening', seconds: 2, state: 'final', still: 'stills/s1.png', video: 'out/s1.mp4' },
    { id: 's2', title: 'The fox arrives', seconds: 8, state: 'concept', pendingChoice: 'mascot', onScreen: '“Hello”' },
    { id: 's3', title: 'Leaves fall', seconds: 6, state: 'concept', still: 'stills/s3.png', willMove: ['Leaves drift left'] },
    { id: 's4', title: 'The table', seconds: 6, state: 'still-approved', still: 'stills/s4.png' },
    { id: 's5', title: 'Three numbers', seconds: 7, state: 'still-approved', still: 'stills/s5.png' },
    { id: 's6', title: 'The map', seconds: 5, state: 'animated-preview', still: 'stills/s6.png', video: 'out/s6.webm' },
    { id: 's7', title: 'The crowd', seconds: 9, state: 'animated-preview', video: 'out/s7.mov', previewApproved: true },
    { id: 's8', title: 'Closing', seconds: 5, state: 'concept', pendingChoice: 'ending' },
  ],
  pieces: [
    { kind: 'Photo', name: 'Forest at dawn', image: 'kit/forest.jpg', goesTo: 'scene s3' },
    { kind: 'Icon', name: 'Leaf', image: 'kit/leaf.png' },
  ],
  references: [
    { file: 'board/references/poster.png', scene: 's4', take: ['The warm palette'] },
    { file: 'board/references/clip.mp4' },
  ],
}

const clone = (v) => JSON.parse(JSON.stringify(v))

function mediaOf(board) {
  const all = []
  for (const c of board.choices || []) for (const o of c.options) all.push(o.image)
  for (const s of board.scenes || []) all.push(s.still, s.video)
  for (const p of board.pieces || []) all.push(p.image)
  for (const r of board.references || []) all.push(r.file)
  return all.filter(Boolean)
}

/** A project folder in the temp dir with every file the board names, and the board written. */
function makeProject(board) {
  const project = fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()), 'board-test-'))
  for (const rel of mediaOf(board)) {
    const file = path.join(project, rel)
    fs.mkdirSync(path.dirname(file), { recursive: true })
    fs.writeFileSync(file, /\.(mp4|mov|webm)$/.test(rel) ? MP4 : PNG)
  }
  writeBoard(project, board)
  return project
}

/** What the page is drawn from, for a board that needs no server: every file one millisecond old. */
const viewOf = (board, more = {}) => ({ board, versions: Object.fromEntries(mediaOf(board).map((p) => [p, 1])), events: [], listener: 'away', agent: 'node board.mjs agent "/project" --terminal', ...more })

/** A request with the path and headers exactly as written: fetch would tidy up "..", and that is what is under test. */
function raw(server, rawPath, { method = 'GET', headers = {}, body } = {}) {
  return new Promise((resolve, reject) => {
    const req = http.request({ host: '127.0.0.1', port: server.port, path: rawPath, method, headers }, (res) => {
      const chunks = []
      res.on('data', (c) => chunks.push(c))
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: Buffer.concat(chunks) }))
    })
    req.on('error', reject)
    req.end(body)
  })
}
const post = (server, action) => fetch(`${server.url}api/act`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(action) })
const upload = (server, name, body, scene) => fetch(`${server.url}api/upload?name=${encodeURIComponent(name)}${scene ? `&scene=${scene}` : ''}`, { method: 'POST', body })
const count = (html, piece) => html.split(piece).length - 1
const until = async (check, ms = 4000) => { for (const end = Date.now() + ms; Date.now() < end;) { if (await check()) return true; await new Promise((r) => setTimeout(r, 40)) } return false }

function cli(args, { input, env } = {}) {
  const r = spawnSync(process.execPath, [CLI, ...args], { encoding: 'utf8', input, timeout: 30000, env: env || process.env })
  return { code: r.status, out: r.stdout.trim(), err: r.stderr.trim() }
}
function cliAsync(args) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [CLI, ...args], { stdio: ['ignore', 'pipe', 'pipe'] })
    let out = '', err = ''
    child.stdout.on('data', (c) => { out += c })
    child.stderr.on('data', (c) => { err += c })
    child.on('close', (code) => resolve({ code, out: out.trim(), err: err.trim() }))
  })
}

describe('board.json: validation', () => {
  test('the two example boards are valid', () => {
    assert.deepEqual(validateBoard(TUTORIAL), [])
    assert.deepEqual(validateBoard(CONCEPT), [])
    assert.deepEqual(validateBoard({ title: 'Only a title' }), [])
  })

  test('the example in recipes/board.md is a valid board', () => {
    const recipe = fs.readFileSync(path.join(HERE, '..', 'recipes', 'board.md'), 'utf8')
    const example = JSON.parse(/```json\n([\s\S]*?)\n```/.exec(recipe)[1])
    assert.deepEqual(validateBoard(example), [])
    assert.deepEqual(Object.keys(example), ['title', 'subtitle', 'progress', 'costs', 'script', 'choices', 'scenes', 'pieces', 'references'])
  })

  test('what is wrong comes back as "where: what to fix"', () => {
    const cases = [
      [(b) => { delete b.title }, /^board\.title: is required/],
      [(b) => { b.scenes[1].state = 'done' }, /^scenes\[1\]\.state: is required: one of concept, still-approved, animated-preview, final/],
      [(b) => { b.scenes[0].onscreen = 'typo' }, /^scenes\[0\]\.onscreen: unknown field/],
      [(b) => { b.scenes[1].id = '01' }, /^scenes\[1\]\.id: repeats another scene id/],
      [(b) => { b.scenes[0].id = 1 }, /^scenes\[0\]\.id: is required/],
      [(b) => { b.scenes[0].seconds = 0 }, /^scenes\[0\]\.seconds: is required: a number above 0/],
      [(b) => { delete b.scenes[2].video }, /^scenes\[2\]\.video: is required/],
      [(b) => { delete b.scenes[1].still }, /^scenes\[1\]\.still: is required/],
      [(b) => { b.scenes[0].still = '../outside.png' }, /^scenes\[0\]\.still: must be a path relative to the project folder/],
      [(b) => { b.scenes[0].still = '/etc/passwd.png' }, /^scenes\[0\]\.still: must be a path relative/],
      [(b) => { b.scenes[0].still = 'screens\\01.png' }, /^scenes\[0\]\.still: must be a path relative/],
      [(b) => { b.scenes[0].still = 'screens/01.svg' }, /^scenes\[0\]\.still: must be one of png, jpg, jpeg, webp, gif/],
      [(b) => { b.scenes[2].video = 'out/03.png' }, /^scenes\[2\]\.video: must be one of mp4, mov, webm/],
      [(b) => { b.scenes[0].pendingChoice = 'nope' }, /^scenes\[0\]\.pendingChoice: no choice with id "nope"/],
      [(b) => { b.scenes[0].rebuilding = { file: '../mine.png', at: 'now' } }, /^scenes\[0\]\.rebuilding\.file: must be a path relative/],
      [(b) => { b.scenes[0].rebuilding = { file: 'board/references/mine.png' } }, /^scenes\[0\]\.rebuilding\.at: is required/],
      [(b) => { b.progress.percent = 140 }, /^progress\.percent: is required: a number from 0 to 100/],
      [(b) => { b.pieces = [{ kind: 'Photo', image: 'a.png' }] }, /^pieces\[0\]\.name: is required/],
      [(b) => { b.references = [{ file: 'board/references/a.png', scene: '99' }] }, /^references\[0\]\.scene: no scene with id "99"/],
      [(b) => { b.choices = [{ id: 'c', title: 'One option', options: [{ label: 'A', title: 'Alone', image: 'a.png' }] }] }, /^choices\[0\]\.options: is required: a list of at least two options/],
    ]
    for (const [breakIt, expected] of cases) {
      const board = clone(TUTORIAL)
      breakIt(board)
      const problems = validateBoard(board)
      assert.ok(problems.some((p) => expected.test(p)), `expected ${expected} in ${JSON.stringify(problems)}`)
    }
    const concept = clone(CONCEPT)
    concept.choices[0].chosen = 'Z'
    concept.choices[1].options[1].label = 'calm'
    assert.deepEqual(validateBoard(concept), ['choices[0].chosen: no option with label "Z"', 'choices[1].options[1].label: repeats another option label ("calm")'])
    assert.deepEqual(validateBoard([]), ['board: must be a JSON object'])
  })

  test('with the project folder, every file named must be there', () => {
    const project = makeProject(TUTORIAL)
    assert.deepEqual(validateBoard(TUTORIAL, { root: project }), [])
    fs.rmSync(path.join(project, 'screens/02.png'))
    assert.deepEqual(validateBoard(TUTORIAL, { root: project }), ['scenes[1].still: file not found in the project: screens/02.png'])
  })

  test('a path never leaves the project', () => {
    const project = makeProject(TUTORIAL)
    for (const rel of ['../x.png', 'a/../../x.png', '/etc/hosts', 'C:/x.png', 'a\\b.png', 'a//b.png', './a.png', '', 'a\0.png']) assert.equal(resolveInside(project, rel), null, rel)
    assert.equal(resolveInside(project, 'screens/01.png'), path.join(project, 'screens', '01.png'))
    fs.symlinkSync(os.homedir(), path.join(project, 'way-out'))
    assert.equal(resolveInside(project, 'way-out/anything.png'), null)
  })
})

describe('board.json: partial update and what a click changes', () => {
  test('one scene changes by id and the rest stays', () => {
    const next = patchBoard(TUTORIAL, { progress: { percent: 60 }, scenes: [{ id: '02', state: 'still-approved' }] })
    assert.equal(next.scenes[1].state, 'still-approved')
    assert.equal(next.scenes[1].title, 'Fill the amount')
    assert.deepEqual(next.scenes[0], TUTORIAL.scenes[0])
    assert.deepEqual(next.progress, { percent: 60, text: 'screens recorded; now: stills' })
    assert.equal(TUTORIAL.scenes[1].state, 'concept', 'the board given is not changed')
  })

  test('null removes a field, a new id is added, "remove" takes an item out and frees the scene that waited on it', () => {
    const next = patchBoard(CONCEPT, {
      subtitle: null,
      choices: [{ id: 'mascot', remove: true }],
      scenes: [{ id: 's2', still: 'concepts/fox-a.png' }, { id: 's9', title: 'Extra', seconds: 3, state: 'concept', still: 'stills/s3.png' }],
      references: [{ file: 'board/references/clip.mp4', scene: 's6' }],
    })
    assert.equal('subtitle' in next, false)
    assert.deepEqual(next.choices.map((c) => c.id), ['ending'])
    assert.equal('pendingChoice' in next.scenes[1], false)
    assert.equal(next.scenes[7].pendingChoice, 'ending')
    assert.equal(next.scenes.at(-1).id, 's9')
    assert.equal(next.references[1].scene, 's6')
    assert.deepEqual(validateBoard(next), [])
    assert.throws(() => patchBoard(CONCEPT, { scenes: [{ title: 'No id' }] }), /every item in a patch needs its "id"/)
  })

  test('the person\'s marks belong to the picture: a new still, video or set of options starts clean', () => {
    const marked = clone(CONCEPT)
    marked.scenes[2].rebuilding = { file: 'board/references/poster.png', at: '2030-01-01T00:00:00.000Z' }
    marked.choices[0].chosen = 'B'
    const redone = patchBoard(marked, { scenes: [{ id: 's7', video: 'out/s6.webm' }, { id: 's3', still: 'stills/s4.png' }] })
    assert.equal('previewApproved' in redone.scenes[6], false)
    assert.equal('rebuilding' in redone.scenes[2], false, 'the new still ends the rebuilding')
    const renamed = patchBoard(marked, { scenes: [{ id: 's7', title: 'The crowd cheers' }, { id: 's3', onScreen: 'Autumn' }], choices: [{ id: 'mascot', intro: 'Pick one.' }] })
    assert.equal(renamed.scenes[6].previewApproved, true)
    assert.deepEqual(renamed.scenes[2].rebuilding, marked.scenes[2].rebuilding)
    assert.equal(renamed.choices[0].chosen, 'B')
    const redrawn = patchBoard(marked, { choices: [{ id: 'mascot', options: marked.choices[0].options.slice(0, 2) }] })
    assert.equal('chosen' in redrawn.choices[0], false)
  })

  test('each action changes the board and leaves its event', () => {
    let { board, event } = applyAction(CONCEPT, { type: 'choice', choice: 'mascot', option: 'B' })
    assert.deepEqual(event, { type: 'choice', choice: 'mascot', option: 'B', scene: 's2' })
    assert.equal(board.choices[0].chosen, 'B')

    ;({ board, event } = applyAction(board, { type: 'approve-still', scene: 's3' }))
    assert.deepEqual(event, { type: 'approve-still', scene: 's3' })
    assert.equal(board.scenes[2].state, 'still-approved')

    ;({ board, event } = applyAction(board, { type: 'approve-preview', scene: 's6' }))
    assert.deepEqual(event, { type: 'approve-preview', scene: 's6' })
    assert.equal(board.scenes[5].previewApproved, true)

    // a message says something and changes nothing on the board
    const before = board
    ;({ board, event } = applyAction(board, { type: 'message', scene: 's6', text: '  the map opens too fast  ' }))
    assert.deepEqual(event, { type: 'message', from: 'person', scene: 's6', text: 'the map opens too fast' })
    assert.equal(board, before)
    ;({ board, event } = applyAction(board, { type: 'message', text: 'shorter overall, please' }))
    assert.deepEqual(event, { type: 'message', from: 'person', text: 'shorter overall, please' })

    ;({ board, event } = applyAction(board, { type: 'reference', file: 'board/references/mine.png', scene: 's5' }))
    assert.deepEqual(event, { type: 'reference', file: 'board/references/mine.png', scene: 's5' })
    assert.deepEqual(board.references.at(-1), { file: 'board/references/mine.png', scene: 's5' })

    ;({ board, event } = applyAction(board, { type: 'attach-reference', file: 'board/references/clip.mp4', scene: 's6' }))
    assert.deepEqual(event, { type: 'attach-reference', file: 'board/references/clip.mp4', scene: 's6' })
    assert.equal(board.references[1].scene, 's6')
    assert.deepEqual(validateBoard(board), [])
    assert.deepEqual(CONCEPT.choices[0].chosen, undefined, 'the board given is not changed')
  })

  test('replace-still: the person\'s picture takes the scene back to a concept that waits for the rebuilt still', () => {
    const now = new Date('2031-05-06T07:08:09.000Z')
    // on an approved preview: the approval was on the old picture
    let { board, event } = applyAction(CONCEPT, { type: 'replace-still', scene: 's7', file: 'board/references/poster.png', text: ' keep my colors ' }, { now })
    assert.deepEqual(event, { type: 'replace-still', scene: 's7', file: 'board/references/poster.png', text: 'keep my colors' })
    assert.equal(board.scenes[6].state, 'concept')
    assert.equal('previewApproved' in board.scenes[6], false)
    assert.deepEqual(board.scenes[6].rebuilding, { file: 'board/references/poster.png', at: '2031-05-06T07:08:09.000Z', text: 'keep my colors' })
    assert.equal(board.references[0].scene, 's7', 'the picture now sits next to that scene')
    assert.deepEqual(validateBoard(board), [])

    // without a note, on a scene that was still waiting on a choice
    ;({ board, event } = applyAction(CONCEPT, { type: 'replace-still', scene: 's2', file: 'board/references/poster.png' }, { now }))
    assert.deepEqual(event, { type: 'replace-still', scene: 's2', file: 'board/references/poster.png' })
    assert.deepEqual(board.scenes[1].rebuilding, { file: 'board/references/poster.png', at: '2031-05-06T07:08:09.000Z' })

    // approving the rebuilt still closes it
    const rebuilt = patchBoard(applyAction(CONCEPT, { type: 'replace-still', scene: 's3', file: 'board/references/poster.png' }, { now }).board, { scenes: [{ id: 's3', rebuilding: { file: 'board/references/poster.png', at: now.toISOString() } }] })
    assert.equal('rebuilding' in applyAction(rebuilt, { type: 'approve-still', scene: 's3' }).board.scenes[2], false)
  })

  test('an action that does not fit is refused with its reason', () => {
    const refused = (action, status, message) => assert.throws(() => applyAction(CONCEPT, action), (e) => e.status === status && message.test(e.message))
    refused({ type: 'choice', choice: 'mascot', option: 'Z' }, 404, /no option "Z"/)
    refused({ type: 'choice', choice: 'nope', option: 'A' }, 404, /no choice "nope"/)
    refused({ type: 'approve-still', scene: 's4' }, 409, /not a concept still/)
    refused({ type: 'approve-still', scene: 's2' }, 409, /waiting for a choice/)
    refused({ type: 'approve-preview', scene: 's3' }, 409, /no animated preview/)
    refused({ type: 'message', scene: 's3', text: '   ' }, 400, /empty/)
    refused({ type: 'message', scene: 'nope', text: 'hello' }, 404, /no scene "nope"/)
    refused({ type: 'message', scene: 's3', text: 'x'.repeat(2001) }, 400, /too long/)
    refused({ type: 'attach-reference', file: 'board/references/none.png', scene: 's3' }, 404, /no reference/)
    refused({ type: 'replace-still', scene: 's3', file: 'board/references/none.png' }, 404, /no reference/)
    refused({ type: 'replace-still', scene: 's3', file: 'board/references/clip.mp4' }, 400, /from a picture, not from a video/)
    refused({ type: 'replace-still', scene: 'nope', file: 'board/references/poster.png' }, 404, /no scene "nope"/)
    refused({ type: 'comment', scene: 's3', text: 'old name' }, 400, /unknown action/)
    refused({ type: 'delete-everything' }, 400, /unknown action/)
  })

  test('what the skill writes is marked as the skill\'s', () => {
    assert.deepEqual(skillEvent(CONCEPT, { type: 'message', scene: 's3', text: ' Here is the new still. ' }), { type: 'message', from: 'skill', scene: 's3', text: 'Here is the new still.' })
    assert.deepEqual(skillEvent(CONCEPT, { type: 'message', text: 'All stills are in.' }), { type: 'message', from: 'skill', text: 'All stills are in.' })
    assert.deepEqual(skillEvent(CONCEPT, { type: 'status', scene: 's3', state: 'working', text: 'Redrawing the leaves' }), { type: 'status', from: 'skill', scene: 's3', state: 'working', text: 'Redrawing the leaves' })
    assert.deepEqual(skillEvent(CONCEPT, { type: 'status', state: 'idle' }), { type: 'status', from: 'skill', state: 'idle' })
    assert.throws(() => skillEvent(CONCEPT, { type: 'message', scene: 'nope', text: 'x' }), /no scene "nope"/)
    assert.throws(() => skillEvent(CONCEPT, { type: 'message', text: '' }), /empty/)
    assert.throws(() => skillEvent(CONCEPT, { type: 'status', state: 'busy' }), /working or idle/)
  })
})

describe('the page: one phase per scene, drawn only from the board', () => {
  test('the phases are the scenes, in order; the page opens on the first one waiting for the person', () => {
    assert.deepEqual(phasesOf(viewOf(TUTORIAL)), ['scene:01', 'scene:02', 'scene:03'])
    assert.equal(startPhase(viewOf(TUTORIAL)), 'scene:02', 'a still to approve')
    assert.deepEqual(phasesOf(viewOf(CONCEPT)), ['scene:s1', 'scene:s2', 'scene:s3', 'scene:s4', 'scene:s5', 'scene:s6', 'scene:s7', 'scene:s8'])
    assert.equal(startPhase(viewOf(CONCEPT)), 'scene:s2', 'a choice to make')
    assert.equal(nextPhase(viewOf(CONCEPT), 'scene:s6'), 'scene:s7')
    assert.equal(nextPhase(viewOf(CONCEPT), 'scene:s8'), 'all', 'after the last scene, everything')
    assert.equal(resolvePhase(viewOf(CONCEPT), 'scene:gone'), 'scene:s2', 'a phase that is not there falls back')
    assert.equal(resolvePhase(viewOf(CONCEPT), 'all'), 'all')
    assert.equal(startPhase(viewOf({ title: 'Nothing yet' })), 'all')
    const done = clone(TUTORIAL)
    done.scenes[1].state = 'still-approved'
    done.scenes[2].previewApproved = true
    assert.equal(startPhase(viewOf(done)), 'scene:01', 'nothing waits: the first scene that is not final')
    for (const p of ['scene:s2', 'direction', 'all']) assert.equal(phaseOfHash(hashOfPhase(p)), p)
    assert.equal(hashOfPhase('scene:s2'), '#scene-s2')
  })

  test('choices about the whole video come first, as the Direction phase', () => {
    const board = clone(CONCEPT)
    board.choices.push({ id: 'look', title: 'The look', options: [{ label: 'A', title: 'Warm', image: 'concepts/fox-a.png' }, { label: 'B', title: 'Cold', image: 'concepts/fox-b.png' }] })
    const view = viewOf(board)
    assert.equal(phasesOf(view)[0], 'direction')
    assert.equal(startPhase(view), 'direction')
    const html = renderPage(view)
    assert.match(html, /<main data-phase="direction">/)
    assert.match(html, /<a class="chip state-concept is-now" href="#direction"[^>]*aria-current="step">\s*<span class="chip-top"><span>Direction<\/span><i class="dot"[^>]*><\/i><\/span>\s*<small>1 to choose<\/small>/)
    assert.match(html, /<h2 id="phase-direction-title">Direction<\/h2>/)
    assert.equal(count(html, '<article class="option'), 2, 'only the choice about the whole video')
    assert.match(html, /data-choice="look" data-option="A"/)
    assert.match(html, /Talk about the whole video/)
    assert.equal(count(renderPage(view, { phase: 'scene:s2' }), 'data-choice="look"'), 0, 'and it is not repeated inside a scene')
    assert.equal(phasesOf(viewOf(CONCEPT)).includes('direction'), false)
  })

  test('three scenes and no choice: the strip, and one scene on screen with its still and what comes next', () => {
    const view = viewOf(TUTORIAL), html = renderPage(view)
    assert.match(html, /<p class="project">Send an invoice · Tutorial · 20 s · 9:16<\/p>/)
    assert.match(html, /<strong>Preview: 20%<\/strong> — screens recorded; now: stills/)
    // the strip: number, name and state of every scene, the current one marked
    assert.equal(count(html, '<a class="chip '), 3)
    for (const [id, title, cls, state] of [['01', 'Open the menu', 'state-still', 'Still approved'], ['02', 'Fill the amount', 'state-concept is-now', 'Concept'], ['03', 'Press send', 'state-preview', 'Animated preview']]) {
      assert.match(html, new RegExp(`<a class="chip ${cls}" href="#scene-${id}"[^>]*>\\s*<span class="chip-top"><b>${id}</b><span>${title}</span>(<i class="dot"[^>]*></i>)?</span>\\s*<small>${state}</small>`), id)
    }
    assert.equal(count(html, 'aria-current="step"'), 2, 'the chip and the state the scene is in')
    assert.match(html, /<a class="btn all" href="#all">All scenes<\/a>/)
    // one phase at a time
    assert.match(html, /<main data-phase="scene:02">/)
    assert.equal(count(html, '<section class="phase"'), 1)
    assert.match(html, /<h2 id="phase-02-title">Fill the amount<\/h2>\s*<span class="meta num">9 s · scene 2 of 3<\/span>/)
    assert.match(html, /<li class="is-now" aria-current="step"><span class="pill state state-concept">Concept<\/span>/)
    assert.match(html, /STILL · will be animated<\/span><span class="pill state state-concept">Concept<\/span><\/div><img src="files\/screens\/02\.png\?v=1" alt="Concept still for scene 02: Fill the amount">/)
    assert.match(html, /<p class="label">What will move<\/p><ul class="bullets"><li>The field types itself<\/li><\/ul>/)
    assert.match(html, /data-act="approve-still" data-scene="02"[^>]*>.*<span>Approve still<\/span>/)
    assert.match(html, /<a class="btn back" href="#scene-01">.*Previous<\/a><a class="btn" href="#scene-03">Next/)
    assert.equal(count(html, 'id="choice-'), 0, 'no "Needs your choice" without a choice')
    assert.equal(count(html, 'class="compare"'), 0)
    assert.match(html, /Have a better picture for this scene\?<\/strong> Paste it here/)
    assert.match(html, /<textarea id="say-02" data-draft="say:02"/)
    assert.match(html, /Runs on this computer only \(127\.0\.0\.1\)/)
    for (const s of CONCEPT.scenes) assert.equal(html.includes(s.title), false, s.title)

    // after the approval: the same phase says it is being animated
    const approved = renderPage(viewOf(applyAction(TUTORIAL, { type: 'approve-still', scene: '02' }).board), { phase: 'scene:02' })
    assert.match(approved, /<span>Still approved<\/span><\/button>/)
    assert.match(approved, /I am animating it; the preview shows up here/)
    assert.equal(count(approved, 'data-act="approve-still"'), 0)

    // the preview plays with its sound, and its approval is the last step of the phase
    const preview = renderPage(view, { phase: 'scene:03' })
    assert.match(preview, /<video id="video-03" playsinline preload="metadata" poster="files\/screens\/03\.png\?v=1" src="files\/out\/03\.mp4\?v=1"/)
    assert.doesNotMatch(preview, /<video[^>]* muted/, 'a preview plays with its sound')
    assert.match(preview, /ANIMATED · draft/)
    assert.match(preview, /data-act="approve-preview" data-scene="03"/)
    assert.match(preview, /<a class="btn" href="#all">All scenes/, 'after the last scene, everything')
    assert.match(renderPage(view, { phase: 'scene:03', started: new Set(['03|out/03.mp4']) }), /<div class="player is-started" data-player="03" data-video="out\/03\.mp4">\s*<video id="video-03"[^>]* controls>/)
  })

  test('"All scenes" is the overview: the timeline, a card per scene, and no empty block', () => {
    const html = renderPage(viewOf(TUTORIAL), { phase: 'all' })
    assert.match(html, /<main data-phase="all">/)
    assert.match(html, /<a class="btn all is-now" href="#all" aria-current="page">All scenes<\/a>/)
    assert.equal(count(html, '<section class="phase"'), 0)
    assert.match(html, /3 scenes · 20 s/)
    assert.deepEqual([...html.matchAll(/<li style="flex:(\d+)">/g)].map((m) => +m[1]), [5, 9, 6], 'the ruler is proportional to the seconds')
    assert.equal(count(html, '<article class="scene"'), 3)
    assert.match(html, /<a class="btn" href="#scene-02">Open: it is waiting for you<\/a>/)
    assert.match(html, /<a class="btn" href="#scene-01">Open this scene<\/a>/)
    assert.equal(count(html, 'data-act='), 0, 'approvals happen inside the phase')
    assert.equal(count(html, 'id="pieces"'), 0, 'no "What goes into the video" without pieces')
    assert.equal(count(html, 'id="references"'), 1, 'the place to drop a reference is always there')
    assert.match(html, /The four states of a picture/)
  })

  test('eight scenes, two open choices, pieces and references: everything in the board is on the page', () => {
    const view = viewOf(CONCEPT), html = renderPage(view)
    assert.equal(html.includes('<launch>'), false, 'text from the board is escaped')
    assert.match(html, /Autumn &lt;launch&gt; &amp; more/)
    assert.match(html, /<strong>Stills: 62%<\/strong> — two choices open/)
    assert.equal(count(html, '<a class="chip '), 8)
    for (const s of CONCEPT.scenes) assert.ok(html.includes(`<b>${s.id}</b><span>${s.title}</span>`), s.title)
    // a scene waiting on a choice shows the options inside its own phase
    assert.match(html, /<main data-phase="scene:s2">/)
    assert.match(html, /<h2 id="choice-mascot-title">Needs your choice<\/h2>\s*<span class="pill tag-dark">Open<\/span>\s*<span class="meta">Which mascot<\/span>/)
    assert.equal(count(html, '<article class="option'), 3)
    for (const o of CONCEPT.choices[0].options) {
      assert.ok(html.includes(`<h3>${o.title}</h3>`), o.title)
      assert.ok(html.includes(`data-choice="mascot" data-option="${o.label}"`), o.label)
    }
    assert.equal(count(html, 'STILL · will be animated</span><span class="pill state state-concept">Concept</span>'), 3)
    assert.equal(count(html, '<span class="pill tag-dark">Recommended</span>'), 1)
    assert.equal(count(html, 'What will move:'), 2)
    assert.equal(count(html, 'data-choice="ending"'), 0, 'the other choice lives in its own scene')
    assert.equal(count(html, 'data-act="approve-still"'), 0, 'no still to approve before the choice')

    const chosen = renderPage(viewOf(applyAction(CONCEPT, { type: 'choice', choice: 'mascot', option: 'B' }).board), { phase: 'scene:s2' })
    assert.match(chosen, /<article class="option is-chosen" id="option-mascot-B">/)
    assert.match(chosen, /<span class="pill tag-dark">Chosen: Paper fox<\/span>/)
    assert.match(chosen, /You chose “Paper fox”\./)

    const ending = renderPage(view, { phase: 'scene:s8' })
    assert.equal(count(ending, '<article class="option'), 2)
    assert.match(ending, /data-choice="ending" data-option="bold"/)

    // the person's picture next to ours, with the button that asks for the scene to be rebuilt from it
    const table = renderPage(view, { phase: 'scene:s4' })
    assert.equal(count(table, 'class="compare"'), 1)
    assert.match(table, /<h3>Your version vs\. our still<\/h3><span>poster\.png, added by you<\/span>/)
    assert.match(table, /<figcaption>Your version<\/figcaption>/)
    assert.match(table, /<figcaption>Our still <small>scene s4, as approved<\/small><\/figcaption>/)
    assert.match(table, /<li>The warm palette<\/li>/)
    assert.match(table, /What to keep \/ change <small>\(optional\)<\/small>/)
    assert.match(table, /data-act="replace-still" data-scene="s4" data-file="board\/references\/poster\.png">Use my picture for this scene<\/button>/)

    // states
    assert.match(renderPage(view, { phase: 'scene:s1' }), /ANIMATED · final render/)
    assert.equal(count(renderPage(view, { phase: 'scene:s1' }), 'data-act='), 0, 'a final scene has nothing left to approve')
    assert.match(renderPage(view, { phase: 'scene:s7' }), /<span>Preview approved<\/span>/)
    assert.match(renderPage(view, { phase: 'scene:s6' }), /data-act="approve-preview" data-scene="s6"/)

    // the overview
    const all = renderPage(view, { phase: 'all' })
    assert.match(all, /8 scenes · 48 s/)
    assert.equal(count(all, '<article class="scene"'), 8)
    assert.match(all, /<img src="files\/concepts\/fox-a\.png\?v=1" alt="Concept still for scene s2: The fox arrives">/, 'a scene waiting on a choice shows the recommended option')
    assert.match(all, /<li id="reference-board-references-clip-mp4">.*<span>clip\.mp4<\/span><select class="attach" data-attach="board\/references\/clip\.mp4"/s)
    assert.match(all, /<span>poster\.png<\/span><a class="attach" href="#scene-s4">In scene s4<\/a>/)
    assert.equal(count(all, '<figure class="tile'), 2)
    assert.match(all, /<p class="label">Photo<\/p><p class="name">Forest at dawn<\/p><p class="goes">→ scene s3<\/p>/)
    assert.match(all, /<p class="label">Icon<\/p><p class="name">Leaf<\/p><\/figcaption>/)
  })

  test('"Rebuilding from your picture" lasts until a newer still arrives', () => {
    const at = '2031-05-06T07:08:09.000Z', since = Date.parse(at)
    const { board, event } = applyAction(CONCEPT, { type: 'replace-still', scene: 's3', file: 'board/references/poster.png', text: 'keep the red leaves' }, { now: new Date(at) })
    const events = [{ n: 1, at, ...event }]
    const waiting = renderPage(viewOf(board, { events, versions: { 'stills/s3.png': since - 5000, 'board/references/poster.png': since - 9000 } }), { phase: 'scene:s3' })
    assert.match(waiting, /<p class="pill rebuilding">Rebuilding from your picture<\/p>/)
    assert.match(waiting, /Your note: “keep the red leaves”/)
    assert.match(waiting, /<p class="next is-rebuilding">I am rebuilding this still from your picture/)
    assert.equal(count(waiting, 'data-act="approve-still"'), 0, 'the old still cannot be approved meanwhile')
    assert.equal(count(waiting, 'data-act="replace-still"'), 0)
    assert.match(waiting, /<small>Rebuilding<\/small>/, 'the strip says so too')

    // the new still comes either at the same path (a newer file) or as a new path in a patch
    const samePath = viewOf(board, { events, versions: { 'stills/s3.png': since + 5000, 'board/references/poster.png': since - 9000 } })
    const newPath = viewOf(patchBoard(board, { scenes: [{ id: 's3', still: 'stills/s4.png' }] }), { events })
    for (const view of [samePath, newPath]) {
      const rebuilt = renderPage(view, { phase: 'scene:s3' })
      assert.equal(count(rebuilt, '<p class="pill rebuilding">'), 0)
      assert.match(rebuilt, /Our still was rebuilt from this picture\. Approve it above/)
      assert.equal(count(rebuilt, 'data-act="replace-still"'), 0)
      assert.match(rebuilt, /data-act="approve-still" data-scene="s3"/)
      assert.match(rebuilt, /<small>Concept<\/small>/)
    }
  })

  test('the conversation: a thread per scene and one about the whole video, and who is on the other side', () => {
    const events = [
      { n: 1, at: '2031-05-06T07:08:09.000Z', type: 'approve-still', scene: 's3' },
      { n: 2, at: '2031-05-06T07:09:09.000Z', type: 'message', from: 'person', scene: 's3', text: 'Can the leaves be <red>?' },
      { n: 3, at: '2031-05-06T07:10:09.000Z', type: 'status', from: 'skill', scene: 's3', state: 'working', text: 'Redrawing the leaves' },
      { n: 4, at: '2031-05-06T07:10:19.000Z', type: 'message', from: 'skill', text: 'All stills are in.' },
      { n: 5, at: '2031-05-06T07:10:29.000Z', type: 'replace-still', scene: 's4', file: 'board/references/poster.png', text: 'my colors' },
    ]
    const view = viewOf(CONCEPT, { events, listener: 'waiting' })
    const scene = renderPage(view, { phase: 'scene:s3' })
    assert.match(scene, /<p class="skill is-on" role="status"><span class="dot" aria-hidden="true"><\/span>Skill connected<\/p>/)
    assert.match(scene, /<li class="is-step"><p>You approved the still\. <time>\d\d:\d\d<\/time><\/p><\/li>/)
    assert.match(scene, /<li class="from-person"><p class="who">You <time>\d\d:\d\d<\/time><\/p><p class="said">Can the leaves be &lt;red&gt;\?<\/p><\/li>/)
    assert.match(scene, /<p class="working" role="status">.*Skill is working… Redrawing the leaves<\/p>/)
    assert.equal(scene.includes('All stills are in.'), false, 'the general thread is not this scene\'s')
    assert.match(renderPage(view, { phase: 'scene:s4' }), /You asked for this scene to be rebuilt from poster\.png: “my colors”/)
    const all = renderPage(view, { phase: 'all' })
    assert.match(all, /<li class="from-skill"><p class="who">Skill <time>\d\d:\d\d<\/time><\/p><p class="said">All stills are in\.<\/p><\/li>/)
    assert.equal(count(all, 'Can the leaves be'), 0)

    // the skill's next message in the thread, or `status idle`, ends "working…"
    const answered = viewOf(CONCEPT, { events: [...events, { n: 6, at: events[4].at, type: 'message', from: 'skill', scene: 's3', text: 'Red leaves are in.' }], listener: 'acting' })
    assert.equal(count(renderPage(answered, { phase: 'scene:s3' }), 'class="working"'), 0)
    assert.match(renderPage(answered, { phase: 'scene:s3' }), /Skill connected · working on your last step/)
    const idle = viewOf(CONCEPT, { events: [...events, { n: 6, at: events[4].at, type: 'status', from: 'skill', scene: 's3', state: 'idle' }], listener: 'waiting' })
    assert.equal(count(renderPage(idle, { phase: 'scene:s3' }), 'class="working"'), 0)

    // a phase with something new from the skill is marked until the person looks at it
    const news = viewOf(CONCEPT, { events: [...events, { n: 6, at: events[4].at, type: 'message', from: 'skill', scene: 's4', text: 'A new still for the table.' }], listener: 'waiting' })
    const marked = /<b>s4<\/b><span>The table<\/span><i class="dot"/
    assert.match(renderPage(news, { phase: 'scene:s5', seen: { base: 5, threads: {} } }), marked)
    assert.doesNotMatch(renderPage(news, { phase: 'scene:s5', seen: { base: 5, threads: { s4: 6 } } }), marked)
    assert.doesNotMatch(renderPage(news, { phase: 'scene:s5' }), marked, 'the first drawing, on the server, knows nothing about what was seen')
    assert.match(renderPage(news, { phase: 'scene:s5', seen: { base: 3, threads: {} } }), /All scenes<i class="dot" title="A new message"><\/i><\/a>/)
    assert.doesNotMatch(renderPage(news, { phase: 'scene:s5', seen: { base: 5, threads: {} } }), /All scenes<i class="dot"/)

    // nobody listening: the page says how to bring the skill back, and "working…" is not trusted
    const away = renderPage(viewOf(CONCEPT, { events }), { phase: 'scene:s3' })
    assert.match(away, /<strong>Skill not connected<\/strong> — ask in the chat to continue, or run this in a terminal:/)
    assert.match(away, /<code>node board\.mjs agent &quot;\/project&quot; --terminal<\/code>/)
    assert.equal(count(away, 'class="working"'), 0)

    const now = 1_000_000
    assert.equal(listenerState(null, now), 'away')
    assert.equal(listenerState({ at: now - 3000, waiting: true }, now), 'waiting')
    assert.equal(listenerState({ at: now - 9000, waiting: true }, now), 'away', 'a wait that stopped beating was killed')
    assert.equal(listenerState({ at: now - 60000, waiting: true, grace: 120000 }, now), 'waiting', 'its time ran out and it is expected back')
    assert.equal(listenerState({ at: now - 60000, waiting: false }, now), 'acting', 'it took an event and is working on it')
    assert.equal(listenerState({ at: now - 60000, waiting: false, grace: 120000 }, now), 'acting')
    assert.equal(listenerState({ at: now - 130000, waiting: false, grace: 120000 }, now), 'away')
  })
})

describe('the server: what the page gets, what it takes and what it refuses', () => {
  let server, project, outside
  before(async () => {
    project = makeProject(CONCEPT)
    outside = path.join(path.dirname(project), `${path.basename(project)}-secret.png`)
    fs.writeFileSync(outside, PNG)
    fs.writeFileSync(path.join(project, 'notes.txt'), 'private')
    fs.symlinkSync(outside, path.join(project, 'stills', 'link-out.png'))
    server = await startBoardServer({ project, uploadLimit: 4096, poll: 50 })
  })
  after(async () => { await server.close(); fs.rmSync(outside, { force: true }) })

  test('it listens on 127.0.0.1 only', () => {
    assert.equal(server.host, '127.0.0.1')
    assert.match(server.url, /^http:\/\/127\.0\.0\.1:\d+\/[A-Za-z0-9_-]{32}\/$/)
  })

  test('the first load and the data are the board, as written', async () => {
    const view = await (await fetch(`${server.url}api/board`)).json()
    assert.deepEqual(view.board, CONCEPT)
    assert.deepEqual(view.problems, [])
    assert.deepEqual(view.events, [])
    assert.equal(view.listener, 'away')
    assert.equal(view.agent, `node "${CLI}" agent "${project}" --terminal`)
    assert.deepEqual(Object.keys(view.versions).sort(), [...new Set(mediaOf(CONCEPT))].sort())
    const html = await (await fetch(server.url)).text()
    assert.match(html, /<title>Review board · Autumn &lt;launch&gt; &amp; more<\/title>/)
    assert.ok(html.includes(renderPage(view)), 'server and browser share one drawing')
    assert.match(html, /<main data-phase="scene:s2">/)
  })

  test('the token is required on every request', async () => {
    const wrong = server.token.replace(/.$/, (c) => (c === 'A' ? 'B' : 'A'))
    for (const p of ['/', '/api/board', '/api/stream', '/app/page.css', '/files/stills/s3.png', `/${wrong}/`, `/${wrong}/api/board`, `/${wrong}/files/stills/s3.png`, `/${server.token}x/`]) {
      assert.equal((await raw(server, p)).status, 403, p)
    }
    for (const p of ['/api/act', '/api/upload?name=a.png', `/${wrong}/api/act`, `/${wrong}/api/upload?name=a.png`]) {
      assert.equal((await raw(server, p, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' })).status, 403, p)
    }
    assert.equal(readEvents(project).length, 0)
    assert.equal((await raw(server, `/${server.token}/`)).status, 200)
    assert.equal((await raw(server, `/${server.token}`)).headers.location, `/${server.token}/`)
  })

  test('a page from another site cannot talk to it', async () => {
    const t = `/${server.token}`
    assert.equal((await raw(server, `${t}/`, { headers: { Host: 'evil.example' } })).status, 403)
    const cross = await raw(server, `${t}/api/act`, { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: 'http://evil.example' }, body: JSON.stringify({ type: 'approve-still', scene: 's3' }) })
    assert.equal(cross.status, 403)
    const form = await raw(server, `${t}/api/act`, { method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: JSON.stringify({ type: 'approve-still', scene: 's3' }) })
    assert.equal(form.status, 415)
    assert.equal(readBoard(project).scenes[2].state, 'concept')
  })

  test('project files are read-only pictures and videos: no way out, no listing, nothing else', async () => {
    const t = `/${server.token}`
    const ok = await raw(server, `${t}/files/stills/s3.png`)
    assert.equal(ok.status, 200)
    assert.equal(ok.headers['content-type'], 'image/png')
    assert.equal(ok.headers['x-content-type-options'], 'nosniff')
    assert.ok(ok.body.equals(PNG))

    const secret = path.basename(outside)
    const escapes = [
      `${t}/files/../${secret}`, `${t}/files/stills/../../${secret}`, `${t}/files/%2e%2e/${secret}`, `${t}/files/..%2f${secret}`,
      `${t}/files/stills/..%5c..%5c${secret}`, `${t}/files/%2fetc%2fhosts.png`, `${t}/files//etc/hosts.png`, `${t}/files/stills/link-out.png`,
      `${t}/files/stills%00.png`, `${t}/../${secret}`, `${t}/app/../data.mjs`, `${t}/app/../../board.mjs`, `${t}/kit/../../SKILL.md`,
    ]
    for (const p of escapes) {
      const r = await raw(server, p)
      assert.ok([400, 403, 404].includes(r.status), `${p} → ${r.status}`)
      assert.equal(r.body.equals(PNG), false, p)
    }
    for (const p of [`${t}/files/`, `${t}/files/stills`, `${t}/files/stills/`, `${t}/files/board/references/`, `${t}/app/`, `${t}/kit/`]) assert.equal((await raw(server, p)).status, 404, p)
    for (const p of [`${t}/files/notes.txt`, `${t}/files/board/board.json`, `${t}/files/board/events.jsonl`, `${t}/app/server.mjs`, `${t}/app/data.mjs`]) assert.equal((await raw(server, p)).status, 404, p)
    for (const method of ['PUT', 'DELETE', 'PATCH']) assert.equal((await raw(server, `${t}/files/stills/s3.png`, { method })).status, 405, method)
    assert.ok(fs.readFileSync(path.join(project, 'stills/s3.png')).equals(PNG))
  })

  test('a video is served in pieces, so the player can seek', async () => {
    const r = await raw(server, `/${server.token}/files/out/s1.mp4`, { headers: { Range: 'bytes=4-11' } })
    assert.equal(r.status, 206)
    assert.equal(r.headers['content-range'], `bytes 4-11/${MP4.length}`)
    assert.equal(r.body.toString(), 'ftypmp42')
    assert.equal((await raw(server, `/${server.token}/files/out/s1.mp4`, { headers: { Range: `bytes=${MP4.length + 5}-` } })).status, 416)
  })

  test('file names are made safe', () => {
    assert.equal(sanitizeName('../../etc/My Photo (final).PNG'), 'My-Photo-final.png')
    assert.equal(sanitizeName('C:\\Users\\me\\Referência nº 2.JPEG'), 'Referencia-no-2.jpeg')
    assert.equal(sanitizeName('.hidden.png'), 'hidden.png')
    assert.equal(sanitizeName('shell.php.png'), 'shell-php.png')
    assert.equal(sanitizeName('....mp4'), 'reference.mp4')
    assert.equal(sanitizeName('con.png'), 'reference-con.png')
    assert.equal(sanitizeName(`${'a'.repeat(300)}.webm`), `${'a'.repeat(80)}.webm`)
    for (const bad of ['page.html', 'run.sh', 'drawing.svg', 'notes', 'photo.png.exe', '', null, 'doc.pdf']) assert.equal(sanitizeName(bad), null, String(bad))
    assert.equal(looksLike('png', PNG), true)
    assert.equal(looksLike('mp4', MP4), true)
    assert.equal(looksLike('png', MP4), false)
    assert.equal(looksLike('png', Buffer.from('<html><script>alert(1)</script></html>')), false)
  })

  test('an upload is saved under a safe name in board/references, and becomes an event', async () => {
    const answer = await upload(server, '../../escape/My Photo (final).PNG', PNG)
    assert.equal(answer.status, 200)
    const { event, view } = await answer.json()
    assert.equal(event.type, 'reference')
    assert.equal(event.file, 'board/references/My-Photo-final.png')
    assert.equal('scene' in event, false, 'outside a scene, it is a general reference')
    assert.ok(fs.readFileSync(path.join(project, 'board/references/My-Photo-final.png')).equals(PNG))
    assert.equal(fs.existsSync(path.join(project, '..', 'escape')), false)
    assert.deepEqual(view.board.references.at(-1), { file: 'board/references/My-Photo-final.png' })
    assert.deepEqual(readBoard(project).references.at(-1), { file: 'board/references/My-Photo-final.png' })
    assert.deepEqual(readEvents(project).at(-1), event)
    assert.deepEqual(view.events.at(-1), event, 'the page gets the log too')
    assert.ok(event.n >= 1 && !Number.isNaN(Date.parse(event.at)))

    // the same name again does not overwrite the first
    const again = await (await upload(server, 'My Photo (final).PNG', PNG)).json()
    assert.equal(again.event.file, 'board/references/My-Photo-final-2.png')
    assert.equal(again.event.n, event.n + 1)

    // and it can go next to a scene
    const attached = await (await post(server, { type: 'attach-reference', file: event.file, scene: 's3' })).json()
    assert.deepEqual({ ...attached.event, n: 0, at: '' }, { n: 0, at: '', type: 'attach-reference', file: event.file, scene: 's3' })
    assert.equal(readBoard(project).references.find((r) => r.file === event.file).scene, 's3')
    assert.match(renderPage(attached.view, { phase: 'scene:s3' }), /<h3>Your version vs\. our still<\/h3><span>My-Photo-final\.png, added by you<\/span>/)
  })

  test('a picture pasted inside a scene sits next to it; "Use my picture" asks for the still to be rebuilt', async () => {
    const pasted = await (await upload(server, 'pasted-scene-s5.png', PNG, 's5')).json()
    assert.deepEqual({ ...pasted.event, n: 0, at: '' }, { n: 0, at: '', type: 'reference', file: 'board/references/pasted-scene-s5.png', scene: 's5' })
    assert.deepEqual(readBoard(project).references.at(-1), { file: 'board/references/pasted-scene-s5.png', scene: 's5' })
    assert.match(renderPage(pasted.view, { phase: 'scene:s5' }), /data-act="replace-still" data-scene="s5" data-file="board\/references\/pasted-scene-s5\.png"/)
    assert.equal((await upload(server, 'lost.png', PNG, 'nope')).status, 404, 'a scene that is not there')
    assert.equal(fs.existsSync(path.join(project, 'board/references/lost.png')), false)

    const answer = await post(server, { type: 'replace-still', scene: 's5', file: 'board/references/pasted-scene-s5.png', text: 'keep my numbers' })
    assert.equal(answer.status, 200)
    const { event, view } = await answer.json()
    assert.deepEqual({ ...event, n: 0, at: '' }, { n: 0, at: '', type: 'replace-still', scene: 's5', file: 'board/references/pasted-scene-s5.png', text: 'keep my numbers' })
    const scene = readBoard(project).scenes[4]
    assert.equal(scene.state, 'concept', 'approved before, on the old picture')
    assert.equal(scene.rebuilding.file, 'board/references/pasted-scene-s5.png')
    assert.match(renderPage(view, { phase: 'scene:s5' }), /Rebuilding from your picture/)

    // the skill sends the new still at the same path: the page takes it and the phase waits for the approval again
    const later = new Date(Date.now() + 60000)
    fs.utimesSync(path.join(project, 'stills/s5.png'), later, later)
    let now
    assert.ok(await until(async () => { now = await (await fetch(`${server.url}api/board`)).json(); return now.versions['stills/s5.png'] === later.getTime() }))
    const rebuilt = renderPage(now, { phase: 'scene:s5' })
    assert.equal(count(rebuilt, 'Rebuilding from your picture'), 0)
    assert.match(rebuilt, /data-act="approve-still" data-scene="s5"/)
  })

  test('the person writes, the skill answers, and both are in the page\'s data', async () => {
    const sent = await (await post(server, { type: 'message', scene: 's6', text: 'The map opens too fast' })).json()
    assert.deepEqual({ ...sent.event, n: 0, at: '' }, { n: 0, at: '', type: 'message', from: 'person', scene: 's6', text: 'The map opens too fast' })
    assert.deepEqual(readBoard(project), sent.view.board, 'a message changes nothing on the board')

    const stream = await fetch(`${server.url}api/stream`), reader = stream.body.getReader()
    await reader.read()
    const working = cli(['status', project, '--scene', 's6', 'working', 'Slowing the map down'])
    assert.equal(working.code, 0, working.err)
    const said = cli(['say', project, '--scene', 's6', 'Slower now: the map takes 2 s to open.'])
    assert.equal(said.code, 0, said.err)
    assert.match(said.out, /said in scene s6: Slower now/)
    assert.match(new TextDecoder().decode((await reader.read()).value), /data: \d+/, 'the open page is told')
    await reader.cancel()

    let view
    assert.ok(await until(async () => { view = await (await fetch(`${server.url}api/board`)).json(); return view.events.at(-1)?.text?.startsWith('Slower now') }))
    assert.deepEqual(view.events.slice(-3).map((e) => [e.type, e.from, e.scene]), [['message', 'person', 's6'], ['status', 'skill', 's6'], ['message', 'skill', 's6']])
    const html = renderPage(view, { phase: 'scene:s6' })
    assert.match(html, /<p class="said">The map opens too fast<\/p>/)
    assert.match(html, /<li class="from-skill">.*<p class="said">Slower now: the map takes 2 s to open\.<\/p><\/li>/)

    assert.equal(cli(['say', project, '--scene', 'nope', 'hello']).code, 1)
    assert.equal(cli(['say', project]).code, 1)
    assert.equal(cli(['status', project, 'busy']).code, 1)
    assert.match(cli(['say', project, 'A word about the whole video.']).out, /said in the general thread/)
    assert.equal((await post(server, { type: 'message', from: 'skill', text: 'I am the skill, really' })).status, 200)
    assert.equal(readEvents(project).at(-1).from, 'person', 'the page cannot speak as the skill')
  })

  test('the page knows whether somebody is listening, from the heartbeat of wait', async () => {
    const listening = path.join(project, 'board', 'listening.json')
    const state = async () => (await (await fetch(`${server.url}api/board`)).json()).listener
    assert.equal(await state(), 'away')
    fs.writeFileSync(listening, JSON.stringify({ at: Date.now(), waiting: true }))
    assert.ok(await until(async () => await state() === 'waiting'))
    fs.writeFileSync(listening, JSON.stringify({ at: Date.now(), waiting: false, grace: 600000 }))
    assert.ok(await until(async () => await state() === 'acting'))
    fs.writeFileSync(listening, JSON.stringify({ at: Date.now() - 20000, waiting: true }))
    assert.ok(await until(async () => await state() === 'away'))
  })

  test('what is not a picture or a video, or is too large, is refused and leaves nothing behind', async () => {
    const before = fs.readdirSync(path.join(project, 'board/references')).sort()
    const events = readEvents(project).length
    const refused = async (name, body, status, message) => {
      const answer = await upload(server, name, body)
      assert.equal(answer.status, status, name)
      assert.match((await answer.json()).error, message)
    }
    await refused('page.html', Buffer.from('<script>alert(1)</script>'), 415, /is not an image or a video I can show here\. Use PNG, JPG, WEBP, GIF, MP4, MOV or WEBM\./)
    await refused('drawing.svg', Buffer.from('<svg/>'), 415, /is not an image or a video/)
    await refused('tool.exe', PNG, 415, /is not an image or a video/)
    await refused('fake.png', Buffer.from('<html><script>alert(1)</script></html>'), 415, /does not open as an image or a video/)
    await refused('empty.png', Buffer.alloc(0), 415, /does not open as an image or a video/)
    await refused('huge.png', Buffer.concat([PNG, Buffer.alloc(8192)]), 413, /is larger than 1 MB/)
    const sneaky = await raw(server, `/${server.token}/api/upload?name=huge.png`, { method: 'POST', headers: { 'Transfer-Encoding': 'chunked' }, body: Buffer.concat([PNG, Buffer.alloc(8192)]) })
    assert.equal(sneaky.status, 413, 'the limit holds without a declared size')
    assert.equal((await post(server, { type: 'reference', file: 'board/board.png' })).status, 400, 'a reference only arrives as a file')
    assert.deepEqual(fs.readdirSync(path.join(project, 'board/references')).sort(), before)
    assert.equal(readEvents(project).length, events)
  })

  test('a click that no longer fits answers with its reason and changes nothing', async () => {
    const events = readEvents(project).length
    const answer = await post(server, { type: 'approve-still', scene: 's4' })
    assert.equal(answer.status, 409)
    assert.match((await answer.json()).error, /not a concept still/)
    assert.equal((await post(server, { type: 'message', scene: 's3', text: ' ' })).status, 400)
    assert.equal((await raw(server, `/${server.token}/api/act`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{ not json' })).status, 400)
    assert.equal(readEvents(project).length, events)
  })

  test('the page follows board.json: a change on disk reaches the open page', async () => {
    const other = makeProject(TUTORIAL), watched = await startBoardServer({ project: other, poll: 50 })
    try {
      const stream = await fetch(`${watched.url}api/stream`)
      const reader = stream.body.getReader()
      const first = new TextDecoder().decode((await reader.read()).value)
      assert.match(first, /data: \d+/)
      writeBoard(other, patchBoard(TUTORIAL, { title: 'Send two invoices', scenes: [{ id: '02', state: 'still-approved' }] }))
      const second = new TextDecoder().decode((await reader.read()).value)
      assert.match(second, /data: \d+/)
      await reader.cancel()
      const html = await (await fetch(watched.url)).text()
      assert.match(html, /Send two invoices/)
      assert.match(html, /<main data-phase="scene:03">/, 'the page opens on what waits for the person now')
      // a broken board keeps the last good one on screen and says what is wrong
      fs.writeFileSync(path.join(other, 'board', 'board.json'), '{ "title": ')
      let view
      assert.ok(await until(async () => { view = await (await fetch(`${watched.url}api/board`)).json(); return view.problems.length > 0 }))
      assert.equal(view.board.title, 'Send two invoices')
      assert.match(view.problems[0], /is not valid JSON/)
    } finally { await watched.close() }
  })
})

describe('the command line: set, patch, open, wait, say, agent, events, stop', () => {
  let project
  before(() => { project = makeProject(CONCEPT); fs.rmSync(path.join(project, 'board', 'board.json')) })
  after(() => { cli(['stop', project]) })

  test('set validates before writing; patch updates one piece', () => {
    const broken = clone(CONCEPT)
    broken.scenes[2].still = 'stills/missing.png'
    broken.scenes[3].state = 'approved'
    const refused = cli(['set', project, '-'], { input: JSON.stringify(broken) })
    assert.equal(refused.code, 1)
    assert.match(refused.err, /2 problems, nothing was written/)
    assert.match(refused.err, /scenes\[2\]\.still: file not found in the project: stills\/missing\.png/)
    assert.match(refused.err, /scenes\[3\]\.state: is required: one of/)
    assert.equal(readBoard(project), null)
    assert.equal(cli(['open', project, '--no-open']).code, 1, 'no board, no page')
    assert.equal(cli(['say', project, 'hello']).code, 1, 'no board, nothing to say on')

    const file = path.join(project, 'request.json')
    fs.writeFileSync(file, JSON.stringify(CONCEPT))
    const written = cli(['set', project, file])
    assert.equal(written.code, 0, written.err)
    assert.match(written.out, /8 scenes, 2 open choices, 2 references/)
    assert.deepEqual(readBoard(project), CONCEPT)

    const patched = cli(['patch', project, '{"progress":{"percent":70},"scenes":[{"id":"s4","title":"The long table"}]}'])
    assert.equal(patched.code, 0, patched.err)
    assert.equal(readBoard(project).scenes[3].title, 'The long table')
    assert.equal(readBoard(project).progress.percent, 70)
    const bad = cli(['patch', project, '{"scenes":[{"id":"s4","state":"finished"}]}'])
    assert.equal(bad.code, 1)
    assert.equal(readBoard(project).scenes[3].state, 'still-approved')

    // a new board keeps what the person dropped, unless it brings its own references
    const { references, ...fresh } = CONCEPT
    assert.equal(cli(['set', project, '-'], { input: JSON.stringify(fresh) }).code, 0)
    assert.deepEqual(readBoard(project).references, references)
    assert.equal(cli(['bogus', project]).code, 1)
    assert.equal(cli(['set', path.join(project, 'nowhere'), file]).code, 1)
  })

  test('agent: the prompt and the loop for whoever serves the board; the terminal is only described here, never opened', () => {
    const prompt = agentPrompt(project)
    assert.match(prompt, /^Use the primo-videos skill\. Serve the review board of this video project, in a loop/)
    for (const piece of [` open "${project}"`, ` wait "${project}" --timeout 540`, ` say "${project}" --scene <id>`, ` patch "${project}"`, ` status "${project}" --scene <id> working`]) assert.ok(prompt.includes(`node "${CLI}"${piece}`), piece)
    for (const event of ['choice', 'replace-still', 'message', 'approve-still', 'approve-preview']) assert.match(prompt, new RegExp(`- ${event}: `))
    assert.match(prompt, /Never animate a scene before its approve-still/)
    assert.doesNotMatch(prompt, /skip-permissions|bypass/i)

    const plain = cli(['agent', project])
    assert.equal(plain.code, 0, plain.err)
    assert.equal(plain.out, prompt)
    assert.equal(fs.existsSync(path.join(project, 'board', 'agent-prompt.txt')), false, 'without --terminal nothing is written')

    // the command that would open Terminal.app: built, checked, not run
    const call = terminalCommand({ project: "/tmp/it's a project", claude: '/home/me/.local/bin/claude', promptFile: "/tmp/it's a project/board/agent-prompt.txt" })
    assert.equal(call.command, 'osascript')
    assert.deepEqual(call.args.filter((_, i) => i % 2 === 0), ['-e', '-e', '-e', '-e'])
    assert.equal(call.args[1], 'tell application "Terminal"')
    assert.equal(call.args[3], 'activate')
    assert.equal(call.args[5], `do script "cd '/tmp/it'\\\\''s a project' && '/home/me/.local/bin/claude' \\"$(cat '/tmp/it'\\\\''s a project/board/agent-prompt.txt')\\""`)
    assert.equal(call.args[7], 'end tell')
    assert.doesNotMatch(call.args.join(' '), /skip-permissions|bypass/i)

    // on the command line, --dry-run prints that call; where a terminal cannot be opened, the prompt comes out instead
    const fake = path.join(project, 'claude')
    fs.writeFileSync(fake, '#!/bin/sh\n', { mode: 0o755 })
    const dry = cli(['agent', project, '--terminal', '--dry-run'], { env: { ...process.env, CRITIC_CLAUDE: fake } })
    assert.equal(dry.code, 0, dry.err)
    if (process.platform === 'darwin' && ['/System/Applications/Utilities/Terminal.app', '/Applications/Utilities/Terminal.app'].some((app) => fs.existsSync(app))) {
      const printed = JSON.parse(dry.out)
      assert.equal(printed.command, 'osascript')
      assert.ok(printed.args[5].includes(`cd '${project}' && '${fake}' \\"$(cat '${path.join(project, 'board', 'agent-prompt.txt')}')\\"`))
    } else {
      assert.equal(dry.out, prompt)
      assert.match(dry.err, /not opening a terminal/)
    }
    assert.equal(fs.existsSync(path.join(project, 'board', 'agent-prompt.txt')), false, 'a dry run writes nothing')
  })

  test('open starts one server per project and returns; wait hears the click and beats while it listens; stop ends it', async () => {
    const opened = cli(['open', project, '--no-open'])
    assert.equal(opened.code, 0, opened.err)
    const url = opened.out
    assert.match(url, /^http:\/\/127\.0\.0\.1:\d+\/[A-Za-z0-9_-]{32}\/$/)
    const info = JSON.parse(fs.readFileSync(path.join(project, 'board', 'server.json'), 'utf8'))
    assert.equal(info.url, url)
    assert.equal(cli(['open', project, '--no-open']).out, url, 'a running board is reused')
    assert.equal((await fetch(url)).status, 200)
    const listener = async () => (await (await fetch(`${url}api/board`)).json()).listener
    assert.equal(await listener(), 'away')

    // nobody clicked yet
    const quiet = cli(['wait', project, '--timeout', '0.4'])
    assert.equal(quiet.code, 2)
    assert.equal(quiet.out, '')

    // the person picks an option: wait prints that event
    const server = { url }
    assert.equal((await post(server, { type: 'choice', choice: 'mascot', option: 'B' })).status, 200)
    const heard = cli(['wait', project, '--timeout', '5'])
    assert.equal(heard.code, 0, heard.err)
    const event = JSON.parse(heard.out)
    assert.deepEqual({ ...event, at: '' }, { n: 1, at: '', type: 'choice', choice: 'mascot', option: 'B', scene: 's2' })
    assert.equal(readBoard(project).choices[0].chosen, 'B')
    assert.match(renderPage(await (await fetch(`${url}api/board`)).json(), { phase: 'scene:s2' }), /You chose “Paper fox”\./)
    assert.match(await (await fetch(url)).text(), /<main data-phase="scene:s3">/, 'with the choice made, the page opens on the next thing waiting')
    assert.ok(await until(async () => await listener() === 'acting'), 'after handing an event over, the skill counts as working on it')

    // what the skill itself writes never comes back through wait
    assert.equal(cli(['say', project, '--scene', 's2', 'Paper fox it is. Drawing its still.']).code, 0)
    assert.equal(cli(['status', project, '--scene', 's2', 'working', 'Drawing the paper fox']).code, 0)
    const own = cli(['wait', project, '--timeout', '0.4'])
    assert.equal(own.code, 2, 'an event is handed over once, and the skill\'s own lines are not events for it')
    assert.equal(own.out, '')

    // a wait that is already blocking shows on the page as connected, and wakes up on the next click
    const beat = () => { try { return JSON.parse(fs.readFileSync(path.join(project, 'board', 'listening.json'), 'utf8')) } catch { return {} } }
    assert.ok(beat().waiting === true && beat().grace > 0, 'a wait that ran out of time says for how long it is expected back')
    const blocked = cliAsync(['wait', project, '--timeout', '10'])
    assert.ok(await until(() => beat().waiting === true && beat().grace === undefined), 'a blocking wait beats')
    assert.ok(await until(async () => await listener() === 'waiting'), 'and the page sees somebody listening')
    await post(server, { type: 'approve-still', scene: 's3' })
    await post(server, { type: 'message', scene: 's6', text: 'the map opens too fast' })
    const woke = await blocked
    assert.equal(woke.code, 0, woke.err)
    assert.equal(JSON.parse(woke.out.split('\n')[0]).type, 'approve-still')

    // what happened while the assistant was busy is not lost
    const rest = [woke, cli(['wait', project, '--timeout', '2'])].flatMap((r) => r.out.split('\n').filter(Boolean).map((l) => JSON.parse(l)))
    assert.deepEqual(rest.map((e) => [e.n, e.type]), [[4, 'approve-still'], [5, 'message']])
    assert.equal(rest[1].text, 'the map opens too fast')

    const all = cli(['events', project]).out.split('\n').map((l) => JSON.parse(l))
    assert.deepEqual(all.map((e) => [e.type, e.from]), [['choice', undefined], ['message', 'skill'], ['status', 'skill'], ['approve-still', undefined], ['message', 'person']])
    assert.deepEqual(cli(['events', project, '--since', '4']).out.split('\n').map((l) => JSON.parse(l).n), [5])
    assert.deepEqual(cli(['wait', project, '--since', '0', '--timeout', '1']).out.split('\n').map((l) => JSON.parse(l).n), [1, 4, 5], '--since replays what the person did')

    // without --no-open, the platform's opener is called with the URL (a stand-in here: no real browser in a test)
    if (process.platform !== 'win32') {
      const bin = fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()), 'board-opener-')), asked = path.join(bin, 'asked.txt')
      for (const name of ['open', 'xdg-open']) fs.writeFileSync(path.join(bin, name), `#!/bin/sh\nprintf '%s' "$1" > "${asked}"\n`, { mode: 0o755 })
      assert.equal(cli(['open', project], { env: { ...process.env, PATH: `${bin}${path.delimiter}${process.env.PATH}` } }).out, url)
      assert.ok(await until(() => fs.existsSync(asked) && fs.readFileSync(asked, 'utf8') === url))
    }

    const stopped = cli(['stop', project])
    assert.equal(stopped.code, 0, stopped.err)
    assert.match(stopped.out, /board stopped/)
    assert.equal(fs.existsSync(path.join(project, 'board', 'server.json')), false)
    await assert.rejects(fetch(url))
    assert.equal(cli(['wait', project, '--timeout', '5']).code, 1, 'with no board open, wait says so instead of blocking')
    assert.match(cli(['stop', project]).out, /no board is open/)
  })
})
