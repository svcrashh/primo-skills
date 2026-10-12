// node --test tests/board-voice.test.mjs   (no network beyond 127.0.0.1, no browser, nothing paid)
// The review board with a voice-over and generated pictures: the new board.json fields, what a patch does to them, the
// two new clicks (approve-script, redo-line), the page drawn from them, and the audio the local server serves.
import { test, describe, before, after } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import http from 'node:http'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { EVENT_TYPES, applyAction, patchBoard, readBoard, readEvents, validateBoard, writeBoard } from '../scripts/board/data.mjs'
import { startBoardServer } from '../scripts/board/server.mjs'
import { capLevel, phasesOf, renderPage, startPhase } from '../scripts/board/render.mjs'
import { agentPrompt } from '../scripts/board.mjs'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const CLI = path.join(HERE, '..', 'scripts', 'board.mjs')
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64')
const MP4 = Buffer.concat([Buffer.from([0, 0, 0, 24]), Buffer.from('ftypmp42'), Buffer.alloc(64, 7)])
const SOUND = Buffer.concat([Buffer.from('RIFF'), Buffer.alloc(4), Buffer.from('WAVEfmt '), Buffer.alloc(64, 3)])

// A narrated video: a script waiting for approval, a voice to pick by ear, lines with and without a take, generated pictures.
const VOICE = {
  title: 'Narrated <demo>',
  costs: { images: { usd: 0.09, capUsd: 0.5, count: 3 }, voice: { credits: 480, capCredits: 1500, accountLeft: 13191 } },
  script: { state: 'draft', words: 20, seconds: 9, credits: 190, voice: 'Calm narrator' },
  choices: [{
    id: 'voice', title: 'The voice of the video', intro: 'The same line, three voices.',
    options: [
      { label: 'A', title: 'Calm', line: 'Low and slow.', audio: 'voice/samples/a.mp3', recommended: true },
      { label: 'B', title: 'Bright', audio: 'voice/samples/b.m4a' },
      { label: 'C', title: 'Plain', audio: 'voice/samples/c.wav', image: 'images/c.png', generated: { model: 'some-model', usd: 0.011 } },
    ],
  }],
  scenes: [
    { id: '01', title: 'Cover', seconds: 4, state: 'concept', still: 'stills/01.png', narration: { text: 'Every week starts the <same> way.' } },
    { id: '02', title: 'The list', seconds: 3, state: 'concept', still: 'images/02.png', generated: { model: 'some-model', usd: 0.043 },
      narration: { text: 'Here it fits on one screen.', audio: 'voice/lines/02.wav', seconds: 3.2, credits: 61 } },
    { id: '03', title: 'The result', seconds: 6, state: 'animated-preview', still: 'stills/03.png', video: 'out/03.mp4', previewApproved: true,
      narration: { text: 'And then you move on.', audio: 'voice/lines/03.mp3', seconds: 2.1, credits: 40 } },
    { id: '04', title: 'Closing', seconds: 5, state: 'concept', still: 'stills/04.png' },
  ],
  pieces: [
    { kind: 'Photo', name: 'Their photo', image: 'kit/photo.png' },
    { kind: 'Illustration', name: 'A generated piece', image: 'images/piece.png', generated: { model: 'some-model', usd: 0.043 } },
  ],
}
// The same video before any of this: what every board looked like until now.
const SILENT = {
  title: 'No voice',
  progress: { percent: 30, text: 'stills' },
  choices: [{ id: 'look', title: 'The look', options: [{ label: 'A', title: 'Warm', image: 'stills/01.png' }, { label: 'B', title: 'Dark', image: 'stills/03.png' }] }],
  scenes: [
    { id: '01', title: 'Cover', seconds: 4, state: 'concept', still: 'stills/01.png' },
    { id: '03', title: 'The result', seconds: 6, state: 'animated-preview', still: 'stills/03.png', video: 'out/03.mp4' },
  ],
  pieces: [{ kind: 'Photo', name: 'Their photo', image: 'kit/photo.png' }],
}

const clone = (v) => JSON.parse(JSON.stringify(v))
const count = (html, piece) => html.split(piece).length - 1
function mediaOf(board) {
  const all = []
  for (const c of board.choices || []) for (const o of c.options) all.push(o.image, o.audio)
  for (const s of board.scenes || []) all.push(s.still, s.video, s.narration?.audio)
  for (const p of board.pieces || []) all.push(p.image)
  return all.filter(Boolean)
}
const viewOf = (board, more = {}) => ({ board, versions: Object.fromEntries(mediaOf(board).map((p) => [p, 1])), events: [], listener: 'away', agent: 'node board.mjs agent "/p" --terminal', ...more })

function makeProject(board) {
  const project = fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()), 'board-voice-'))
  for (const rel of mediaOf(board)) {
    const file = path.join(project, rel)
    fs.mkdirSync(path.dirname(file), { recursive: true })
    fs.writeFileSync(file, /\.(mp3|wav|m4a)$/.test(rel) ? SOUND : /\.mp4$/.test(rel) ? MP4 : PNG)
  }
  writeBoard(project, board)
  return project
}
function raw(server, rawPath, headers = {}) {
  return new Promise((resolve, reject) => {
    http.get({ host: '127.0.0.1', port: server.port, path: rawPath, headers }, (res) => {
      const chunks = []
      res.on('data', (c) => chunks.push(c))
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: Buffer.concat(chunks) }))
    }).on('error', reject)
  })
}
const post = (server, action) => fetch(`${server.url}api/act`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(action) })
const cli = (...args) => { const r = spawnSync(process.execPath, [CLI, ...args], { encoding: 'utf8', timeout: 30000 }); return { code: r.status, out: r.stdout.trim(), err: r.stderr.trim() } }

describe('board.json with a voice-over: validation', () => {
  test('a narrated board is valid, and with its files on disk too', () => {
    assert.deepEqual(validateBoard(VOICE), [])
    assert.deepEqual(validateBoard(SILENT), [])
    const project = makeProject(VOICE)
    assert.deepEqual(validateBoard(VOICE, { root: project }), [])
    fs.rmSync(path.join(project, 'voice/lines/02.wav'))
    fs.rmSync(path.join(project, 'voice/samples/b.m4a'))
    assert.deepEqual(validateBoard(VOICE, { root: project }), [
      'choices[0].options[1].audio: file not found in the project: voice/samples/b.m4a',
      'scenes[1].narration.audio: file not found in the project: voice/lines/02.wav',
    ])
  })

  test('what is wrong comes back as "where: what to fix"', () => {
    const cases = [
      [(b) => { b.costs = 5 }, /^costs: must be an object with images and voice/],
      [(b) => { b.costs.images.usd = -1 }, /^costs\.images\.usd: must be a number from 0 up \(got -1\)/],
      [(b) => { delete b.costs.voice.capCredits }, /^costs\.voice\.capCredits: is required: a number from 0 up/],
      [(b) => { b.costs.images.count = 2.5 }, /^costs\.images\.count: must be a whole number from 0 up/],
      [(b) => { b.costs.voice.accountLeft = -10 }, /^costs\.voice\.accountLeft: must be a number from 0 up/],
      [(b) => { b.costs.total = 1 }, /^costs\.total: unknown field \(use images, voice\)/],
      [(b) => { b.script.state = 'done' }, /^script\.state: is required: one of draft, approved \(got "done"\)/],
      [(b) => { delete b.script.state }, /^script\.state: is required: one of draft, approved$/],
      [(b) => { b.script.words = -3 }, /^script\.words: must be a whole number from 0 up/],
      [(b) => { b.script.credits = 'many' }, /^script\.credits: must be a number from 0 up \(got "many"\)/],
      [(b) => { b.scenes[0].narration = 'hello' }, /^scenes\[0\]\.narration: must be an object with text/],
      [(b) => { delete b.scenes[0].narration.text }, /^scenes\[0\]\.narration\.text: is required/],
      [(b) => { b.scenes[1].narration.audio = 'voice/lines/02.ogg' }, /^scenes\[1\]\.narration\.audio: must be one of mp3, wav, m4a/],
      [(b) => { b.scenes[1].narration.audio = '../02.wav' }, /^scenes\[1\]\.narration\.audio: must be a path relative to the project folder/],
      [(b) => { b.scenes[1].narration.seconds = 0 }, /^scenes\[1\]\.narration\.seconds: must be a number above 0/],
      [(b) => { b.scenes[1].narration.credits = -1 }, /^scenes\[1\]\.narration\.credits: must be a number from 0 up/],
      [(b) => { b.scenes[1].narration.voice = 'x' }, /^scenes\[1\]\.narration\.voice: unknown field \(use text, audio, seconds, credits\)/],
      [(b) => { delete b.choices[0].options[0].audio }, /^choices\[0\]\.options\[0\]\.image: is required \(a picture: png, jpg, jpeg, webp, gif\), or an audio to listen to \(mp3, wav, m4a\)/],
      [(b) => { b.choices[0].options[1].audio = 'voice/samples/b.png' }, /^choices\[0\]\.options\[1\]\.audio: must be one of mp3, wav, m4a/],
      [(b) => { b.scenes[1].generated.usd = -0.1 }, /^scenes\[1\]\.generated\.usd: must be a number from 0 up/],
      [(b) => { b.scenes[1].generated.cost = 1 }, /^scenes\[1\]\.generated\.cost: unknown field \(use model, usd\)/],
      [(b) => { b.pieces[0].generated = 'yes' }, /^pieces\[0\]\.generated: must be an object with model and usd/],
      [(b) => { b.choices[0].options[2].generated = { model: '' } }, /^choices\[0\]\.options\[2\]\.generated\.model: must be a non-empty text/],
      [(b) => { delete b.scenes[3].still; b.scenes[3].pendingChoice = 'voice' }, /^scenes\[3\]\.pendingChoice: choice "voice" has an option with no image, so this scene would have nothing to show/],
    ]
    for (const [breakIt, expected] of cases) {
      const board = clone(VOICE)
      breakIt(board)
      const problems = validateBoard(board)
      assert.ok(problems.some((p) => expected.test(p)), `expected ${expected} in ${JSON.stringify(problems)}`)
    }
  })
})

describe('board.json with a voice-over: patch and clicks', () => {
  test('costs and script are merged like progress, narration and generated inside their scene', () => {
    let next = patchBoard(VOICE, { costs: { voice: { accountLeft: 900 }, images: { usd: 0.13, count: 4 } }, script: { seconds: 10 } })
    assert.deepEqual(next.costs, { images: { usd: 0.13, capUsd: 0.5, count: 4 }, voice: { credits: 480, capCredits: 1500, accountLeft: 900 } })
    assert.deepEqual(next.script, { ...VOICE.script, seconds: 10 })
    next = patchBoard(VOICE, { scenes: [{ id: '01', narration: { audio: 'voice/lines/02.wav', seconds: 2.4 } }, { id: '02', generated: { usd: 0.05 } }] })
    assert.deepEqual(next.scenes[0].narration, { text: 'Every week starts the <same> way.', audio: 'voice/lines/02.wav', seconds: 2.4 })
    assert.deepEqual(next.scenes[1].generated, { model: 'some-model', usd: 0.05 })
    assert.deepEqual(patchBoard(VOICE, { scenes: [{ id: '02', narration: { credits: null } }] }).scenes[1].narration, { text: 'Here it fits on one screen.', audio: 'voice/lines/02.wav', seconds: 3.2 })
    assert.deepEqual(validateBoard(next), [])
    assert.equal(VOICE.scenes[0].narration.audio, undefined, 'the board given is not changed')
  })

  test('a new take or new words clear the preview approval; the take\'s numbers do not', () => {
    const take = patchBoard(VOICE, { scenes: [{ id: '03', narration: { audio: 'voice/lines/02.wav' } }] })
    assert.equal('previewApproved' in take.scenes[2], false)
    const said = patchBoard(VOICE, { scenes: [{ id: '03', narration: { text: 'And you move on.' } }] })
    assert.equal('previewApproved' in said.scenes[2], false)
    const measured = patchBoard(VOICE, { scenes: [{ id: '03', narration: { seconds: 2.3, credits: 41 } }] })
    assert.equal(measured.scenes[2].previewApproved, true)
  })

  test('an approved script is approved on its words: new words put it back to draft', () => {
    const approved = applyAction(VOICE, { type: 'approve-script' }).board
    const draft = (patch) => patchBoard(approved, patch).script.state
    assert.equal(draft({ scenes: [{ id: '02', narration: { text: 'It fits on one screen.' } }] }), 'draft')
    assert.equal(draft({ scenes: [{ id: '04', narration: { text: 'See you.' } }] }), 'draft', 'a new line is new words')
    assert.equal(draft({ scenes: [{ id: '05', title: 'Extra', seconds: 2, state: 'concept', still: 'stills/04.png', narration: { text: 'One more.' } }] }), 'draft')
    assert.equal(draft({ scenes: [{ id: '02', narration: { audio: 'voice/lines/03.mp3', seconds: 2 } }] }), 'approved', 'a take is not new words')
    assert.equal(draft({ scenes: [{ id: '02', narration: null }] }), 'approved', 'a line taken out says nothing new')
    assert.equal(draft({ title: 'Renamed', scenes: [{ id: '02', title: 'The short list' }] }), 'approved')
    assert.equal(draft({ script: { state: 'approved' }, scenes: [{ id: '02', narration: { text: 'Other words.' } }] }), 'approved', 'what the patch says itself wins')
  })

  test('a generated picture\'s mark belongs to that picture', () => {
    assert.equal('generated' in patchBoard(VOICE, { scenes: [{ id: '02', still: 'stills/01.png' }] }).scenes[1], false, 'the person\'s still is not generated')
    assert.deepEqual(patchBoard(VOICE, { scenes: [{ id: '02', still: 'stills/01.png', generated: { model: 'other', usd: 0.02 } }] }).scenes[1].generated, { model: 'other', usd: 0.02 })
    assert.deepEqual(patchBoard(VOICE, { scenes: [{ id: '02', state: 'still-approved' }] }).scenes[1].generated, VOICE.scenes[1].generated)
  })

  test('approve-script: the script is approved and the event says so', () => {
    const { board, event } = applyAction(VOICE, { type: 'approve-script' })
    assert.deepEqual(event, { type: 'approve-script' })
    assert.deepEqual(board.script, { ...VOICE.script, state: 'approved' })
    assert.equal(VOICE.script.state, 'draft', 'the board given is not changed')
    const refused = (b, status, message) => assert.throws(() => applyAction(b, { type: 'approve-script' }), (e) => e.status === status && message.test(e.message))
    refused(board, 409, /already approved/)
    refused(SILENT, 404, /no script to approve/)
    refused({ ...SILENT, script: { state: 'draft' } }, 409, /no lines yet/)
  })

  test('redo-line: only said, with the note when there is one', () => {
    let { board, event } = applyAction(VOICE, { type: 'redo-line', scene: '02', text: '  slower, and warmer  ' })
    assert.deepEqual(event, { type: 'redo-line', scene: '02', text: 'slower, and warmer' })
    assert.equal(board, VOICE, 'nothing on the board changes until the new take comes')
    ;({ event } = applyAction(VOICE, { type: 'redo-line', scene: '03', text: '   ' }))
    assert.deepEqual(event, { type: 'redo-line', scene: '03' })
    const refused = (action, status, message) => assert.throws(() => applyAction(VOICE, action), (e) => e.status === status && message.test(e.message))
    refused({ type: 'redo-line', scene: '01' }, 409, /scene "01" has no recorded line to redo yet/)
    refused({ type: 'redo-line', scene: '04' }, 409, /no recorded line/)
    refused({ type: 'redo-line', scene: 'nope' }, 404, /no scene "nope"/)
    refused({ type: 'redo-line', scene: '02', text: 'x'.repeat(2001) }, 400, /too long/)
    assert.ok(EVENT_TYPES.includes('approve-script') && EVENT_TYPES.includes('redo-line'))
    assert.throws(() => applyAction(VOICE, { type: 'redo' }), /approve-script, redo-line/)
  })

  test('whoever serves the board is told what the two new events ask for', () => {
    const prompt = agentPrompt('/project')
    assert.match(prompt, /- approve-script: .*Never record a line before its approve-script/)
    assert.match(prompt, /- redo-line: record only that scene's line again/)
  })
})

describe('the page with a voice-over', () => {
  test('the script comes first, before the direction and the scenes, and the page opens on it while it waits', () => {
    const view = viewOf(VOICE)
    assert.deepEqual(phasesOf(view), ['script', 'direction', 'scene:01', 'scene:02', 'scene:03', 'scene:04'])
    assert.equal(startPhase(view), 'script')
    assert.equal(startPhase(viewOf(applyAction(VOICE, { type: 'approve-script' }).board)), 'direction', 'then the voice, by ear')
    const empty = { ...SILENT, script: { state: 'draft' } }
    assert.equal(phasesOf(viewOf(empty))[0], 'script')
    assert.notEqual(startPhase(viewOf(empty)), 'script', 'a script with no lines has nothing to approve')
    const none = renderPage(viewOf(empty), { phase: 'script' })
    assert.match(none, /No lines yet\. They show up here as soon as I write them\./)
    assert.equal(count(none, 'data-act="approve-script"'), 0)
  })

  test('the script phase: every scene in order, what each line says, its numbers and its take', () => {
    const html = renderPage(viewOf(VOICE))
    assert.match(html, /<main data-phase="script">/)
    assert.match(html, /<a class="chip state-concept is-now" href="#script"[^>]*>\s*<span class="chip-top"><span>Script<\/span><i class="dot"[^>]*><\/i><\/span>\s*<small>To approve<\/small>/)
    assert.match(html, /<h2 id="phase-script-title">Script<\/h2>\s*<span class="meta num">The voice-over · 3 lines · 20 words<\/span>/)
    assert.equal(count(html, '<li class="line"'), 3)
    assert.equal(count(html, '<li class="line is-silent">'), 1)
    assert.match(html, /Closing <span class="num">· 5 s<\/span><\/p><p class="line-none">No voice in this scene<\/p>/)
    assert.match(html, /<p class="line-text">“Every week starts the &lt;same&gt; way\.”<\/p>\s*<p class="line-meta num">6 words<\/p>/)
    assert.match(html, /<p class="line-meta num">6 words · 3\.2 s · 61 credits<\/p>\s*<p class="line-warn">The take runs 3\.2 s, longer than the scene \(3 s\)\.<\/p>/)
    assert.equal(count(html, 'class="line-warn"'), 1, 'only the take that does not fit its scene')
    assert.match(html, /<audio id="audio-line-02" preload="metadata" src="files\/voice\/lines\/02\.wav\?v=1"><\/audio>/)
    assert.match(html, /data-listen="audio-line-03" aria-pressed="false" aria-label="Listen to the line of scene 03">.*<span>Listen<\/span><span class="listen-time num">2\.1 s<\/span>/)
    for (const [k, v] of [['Words', '20'], ['Voice time', '≈ 9 s'], ['To record', '≈ 190 credits'], ['Voice', 'Calm narrator']]) assert.ok(html.includes(`<dt class="label">${k}</dt><dd class="num">${v}</dd>`), k)
    assert.match(html, /<button class="btn btn-big btn-secondary" type="button" data-act="approve-script" aria-pressed="false">.*<span>Approve script<\/span><\/button>/)
    assert.match(html, /nothing is recorded before this/)
    assert.match(html, /<textarea id="say-general"/, 'the talk about it is the thread about the whole video')

    const { words, ...counted } = VOICE.script
    assert.match(renderPage(viewOf({ ...VOICE, script: counted })), /<dt class="label">Words<\/dt><dd class="num">17<\/dd>/, 'without words, the lines are counted')
    assert.match(renderPage(viewOf({ ...VOICE, script: { state: 'draft' } })), /<dl class="facts"><div><dt class="label">Words<\/dt><dd class="num">17<\/dd><\/div><\/dl>/)
    assert.match(renderPage(viewOf(VOICE), { phase: 'script', playing: 'audio-line-02' }), /<div class="listen is-playing">\s*<audio id="audio-line-02"[^>]*><\/audio>\s*<button[^>]*data-listen="audio-line-02" aria-pressed="true" aria-label="Pause the line of scene 02">/)

    const approved = renderPage(viewOf(applyAction(VOICE, { type: 'approve-script' }).board), { phase: 'script' })
    assert.match(approved, /<span>Script approved<\/span><\/button>/)
    assert.match(approved, /href="#script"[^>]*>\s*<span class="chip-top"><span>Script<\/span><\/span>\s*<small>Approved<\/small>/)
    assert.match(approved, /<a class="chip state-still is-now" href="#script"/)
    assert.equal(count(approved, 'data-act="approve-script"'), 0)
    assert.match(approved, /I am recording the voice; each take shows up in its scene/)
  })

  test('what the video spent, against each cap, on every phase; nothing without costs', () => {
    for (const phase of ['script', 'direction', 'scene:02', 'all']) {
      const html = renderPage(viewOf(VOICE), { phase })
      assert.match(html, /<section class="spend" aria-labelledby="spend-title">/, phase)
    }
    const html = renderPage(viewOf(VOICE))
    assert.match(html, /<span class="label">Images<\/span><span class="meter-num num"><strong>US\$ 0\.09<\/strong> of US\$ 0\.50<\/span><\/p>\s*<div class="bar" role="meter" aria-label="Images: US\$ 0\.09 of US\$ 0\.50" aria-valuemin="0" aria-valuemax="0.5" aria-valuenow="0.09"><span style="width:18%"><\/span><\/div>\s*<p class="meter-more">3 generated<\/p>/)
    assert.match(html, /<strong>480<\/strong> of 1,500 credits<\/span><\/p>[\s\S]*?<span style="width:32%"><\/span><\/div>\s*<p class="meter-more">13,191 left in the account<\/p>/)
    assert.equal(count(html, 'class="pill cap"'), 0)
    const at = (usd, credits = 480, accountLeft) => renderPage(viewOf({ ...VOICE, costs: { images: { usd, capUsd: 0.5 }, voice: { credits, capCredits: 1500, ...(accountLeft === undefined ? {} : { accountLeft }) } } }))
    assert.match(at(0.41), /<div class="meter is-near">[\s\S]*?<span class="pill cap">Near the cap<\/span>/)
    assert.match(at(0.5), /<div class="meter is-at">[\s\S]*?At the cap[\s\S]*?<p class="meter-note">I ask you in the chat before spending more\.<\/p>/)
    assert.match(at(0.62), /<div class="meter is-over">[\s\S]*?Over the cap[\s\S]*?<span style="width:100%">/)
    assert.match(at(0.043), /<strong>US\$ 0\.043<\/strong>/)
    assert.match(at(0.1, 1600), /<div class="meter is-over">\s*<p class="meter-top"><span class="label">Voice<\/span>/)
    assert.match(at(0.1, 480, 300), /<p class="meter-more is-low">Only 300 left in the account, less than this video may still use<\/p>/)
    assert.equal(count(at(0.1, 480), 'class="meter-more'), 0, 'no count and no account: nothing under the bars')
    assert.deepEqual([capLevel(0, 0.5), capLevel(0.39, 0.5), capLevel(0.4, 0.5), capLevel(0.5, 0.5), capLevel(0.5000001, 0.5), capLevel(0, 0), capLevel(1, 0)], ['', '', 'near', 'at', 'over', 'at', 'over'])
    assert.equal(count(renderPage(viewOf({ ...VOICE, costs: {} })), 'class="spend"'), 0, 'a block with nothing in it is not drawn')
    assert.equal(count(renderPage(viewOf({ ...VOICE, costs: { voice: VOICE.costs.voice } })), '<div class="meter'), 1)
  })

  test('a scene\'s line: what it says, its take alone, and how to ask for another', () => {
    const view = viewOf(VOICE)
    const first = renderPage(view, { phase: 'scene:01' })
    assert.match(first, /<section class="voice is-alone" id="voice-01" aria-labelledby="voice-01-title">\s*<div class="voice-head"><h3 id="voice-01-title">Voice-over<\/h3><span class="num">6 words<\/span><\/div>/)
    assert.match(first, /<p class="line-text">“Every week starts the &lt;same&gt; way\.”<\/p>\s*<p class="soon">Not recorded yet: the script waits for your approval first, because recording spends credits\.<\/p><a class="btn" href="#script">Open the script<\/a>/)
    assert.equal(count(first, 'data-act="redo-line"'), 0, 'nothing to redo before there is a take')

    const second = renderPage(view, { phase: 'scene:02' })
    assert.match(second, /<span class="num">6 words · 3\.2 s · 61 credits<\/span>/)
    assert.match(second, /<audio id="audio-line-02" preload="metadata" src="files\/voice\/lines\/02\.wav\?v=1"><\/audio>/)
    assert.match(second, /The script changed after this take and waits for your approval again\./)
    assert.match(second, /<label class="label" for="redo-02">New words, or what to change <small>\(optional\)<\/small><\/label>\s*<textarea id="redo-02" data-draft="redo:02" maxlength="2000"/)
    assert.match(second, /<button class="btn btn-secondary" type="button" data-act="redo-line" data-scene="02">Record this line again<\/button>/)
    assert.match(second, /The take runs 3\.2 s, longer than the scene \(3 s\)\./)

    const approved = viewOf(applyAction(VOICE, { type: 'approve-script' }).board)
    assert.match(renderPage(approved, { phase: 'scene:01' }), /<p class="soon">Being recorded\. The take shows up here\.<\/p>/)
    assert.equal(count(renderPage(approved, { phase: 'scene:02' }), 'The script changed'), 0)
    const { script, ...noScript } = VOICE
    assert.match(renderPage(viewOf(noScript), { phase: 'scene:01' }), /<p class="soon">Not recorded yet\.<\/p>/)
    assert.equal(count(renderPage(view, { phase: 'scene:04' }), 'class="voice'), 0, 'a scene with no line has no voice block')

    const preview = clone(VOICE)
    preview.scenes[2].previewApproved = false
    assert.match(renderPage(viewOf(preview), { phase: 'scene:03' }), /This is the draft, moving, with its voice-over and music\. Approve it and I render it final\./)
  })

  test('"Redoing this line" lasts until a newer take arrives', () => {
    const at = '2031-05-06T07:08:09.000Z', since = Date.parse(at)
    const events = [{ n: 1, at, type: 'redo-line', scene: '02', text: 'warmer <please>' }, { n: 2, at, type: 'approve-script' }]
    const asked = renderPage(viewOf(VOICE, { events, versions: { 'voice/lines/02.wav': since - 5000 } }), { phase: 'scene:02' })
    assert.match(asked, /<p class="pill rebuilding">Redoing this line<\/p>\s*<p class="soon">Your note: “warmer &lt;please&gt;”<\/p>/)
    assert.match(asked, /Approve the new words in the script and I record it\./, 'the script is still a draft here')
    assert.equal(count(asked, 'data-act="redo-line"'), 0)
    assert.match(asked, /<li class="is-step"><p>You asked for a new take of this line: “warmer &lt;please&gt;” <time>\d\d:\d\d<\/time><\/p><\/li>/)
    assert.match(renderPage(viewOf(VOICE, { events }), { phase: 'all' }), /<li class="is-step"><p>You approved the script\. <time>/)
    const approved = applyAction(VOICE, { type: 'approve-script' }).board
    assert.match(renderPage(viewOf(approved, { events, versions: { 'voice/lines/02.wav': since - 5000 } }), { phase: 'scene:02' }), /The new take takes the place of this one as soon as it is ready\./)
    // the new take at the same path, or at a new one
    for (const view of [viewOf(VOICE, { events, versions: { 'voice/lines/02.wav': since + 5000 } }), viewOf(patchBoard(VOICE, { scenes: [{ id: '02', narration: { audio: 'voice/lines/03.mp3' } }] }), { events, versions: { 'voice/lines/03.mp3': since + 5000 } })]) {
      const back = renderPage(view, { phase: 'scene:02' })
      assert.equal(count(back, 'Redoing this line'), 0)
      assert.match(back, /data-act="redo-line" data-scene="02"/)
    }
  })

  test('a voice is chosen by ear: options that are heard, one button each', () => {
    const html = renderPage(viewOf(VOICE), { phase: 'direction' })
    assert.equal(count(html, '<article class="option'), 3)
    assert.equal(count(html, 'SAMPLE · listen</span>'), 3)
    assert.equal(count(html, '<div class="listen listen-big">'), 2, 'an option with no picture is its sound')
    assert.match(html, /<audio id="audio-option-voice-A" preload="metadata" src="files\/voice\/samples\/a\.mp3\?v=1"><\/audio>/)
    assert.match(html, /<audio id="audio-option-voice-B" preload="metadata" src="files\/voice\/samples\/b\.m4a\?v=1"><\/audio>/)
    assert.match(html, /aria-label="Listen to option C: Plain"/)
    assert.equal(count(html, '<img src="files/voice'), 0)
    assert.match(html, /<img src="files\/images\/c\.png\?v=1" alt="Option C: Plain">/)
    assert.equal(count(html, 'STILL · will be animated'), 0, 'a sample is not a still to animate')
    assert.equal(count(html, 'data-act="choice" data-choice="voice"'), 3)
    const chosen = renderPage(viewOf(applyAction(VOICE, { type: 'choice', choice: 'voice', option: 'B' }).board), { phase: 'direction' })
    assert.match(chosen, /<article class="option is-chosen" id="option-voice-B">/)
    assert.match(chosen, /You chose “Bright”\./)
  })

  test('a generated picture carries the mark and its cost; the person\'s pictures do not', () => {
    const scene = renderPage(viewOf(VOICE), { phase: 'scene:02' })
    assert.match(scene, /<div class="pic"><img src="files\/images\/02\.png\?v=1" alt="Concept still for scene 02: The list"><span class="gen" title="AI-generated with some-model · US\$ 0\.043"><svg aria-hidden="true"><use href="#i-spark"\/><\/svg>AI-generated · US\$ 0\.043<\/span><\/div>/)
    assert.match(scene, /<p class="label">Picture<\/p><p class="gen-line">AI-generated with some-model · US\$ 0\.043<\/p>/)
    assert.equal(count(renderPage(viewOf(VOICE), { phase: 'scene:01' }), 'class="gen'), 0)
    const options = renderPage(viewOf(VOICE), { phase: 'direction' })
    assert.equal(count(options, '<span class="gen"'), 1)
    assert.match(options, /<p class="gen-line">AI-generated with some-model · US\$ 0\.011<\/p>/)
    const all = renderPage(viewOf(VOICE), { phase: 'all' })
    assert.equal(count(all, '<span class="gen"'), 2, 'the scene card and the generated piece')
    assert.match(all, /<p class="name">A generated piece<\/p><p class="gen-line">AI-generated with some-model · US\$ 0\.043<\/p>/)
    assert.match(all, /<p class="label">Voice-over · recorded<\/p><p class="said-line">“Here it fits on one screen\.”<\/p>/)
    assert.match(all, /<p class="label">Voice-over<\/p><p class="said-line">“Every week starts the &lt;same&gt; way\.”<\/p>/)
    assert.match(renderPage(viewOf({ ...VOICE, pieces: [{ kind: 'Photo', name: 'x', image: 'kit/photo.png', generated: {} }] }), { phase: 'all' }), /<span class="gen" title="AI-generated">.*AI-generated<\/span>/, 'without model and cost, still marked')
  })

  test('a board without any of this is drawn as before: no script, no costs, no voice, no mark', () => {
    for (const phase of [...phasesOf(viewOf(SILENT)), 'all']) {
      const html = renderPage(viewOf(SILENT), { phase })
      for (const piece of ['class="spend"', 'phase-script', 'class="voice', 'class="gen', 'data-listen', '<audio', 'Voice-over']) assert.equal(count(html, piece), 0, `${phase}: ${piece}`)
    }
    assert.deepEqual(phasesOf(viewOf(SILENT)), ['direction', 'scene:01', 'scene:03'])
    assert.match(renderPage(viewOf(SILENT), { phase: 'scene:03' }), /This is the draft, moving, with its sound\./)
  })
})

describe('the server: audio from the project, and the two new clicks', () => {
  let server, project, outside
  before(async () => {
    project = makeProject(VOICE)
    outside = path.join(path.dirname(project), `${path.basename(project)}-secret.mp3`)
    fs.writeFileSync(outside, SOUND)
    fs.symlinkSync(outside, path.join(project, 'voice', 'link-out.mp3'))
    fs.writeFileSync(path.join(project, 'voice', 'lines', 'other.ogg'), SOUND)
    server = await startBoardServer({ project, poll: 50, uploadLimit: 4096 })
  })
  after(async () => { await server.close(); fs.rmSync(outside, { force: true }) })

  test('mp3, wav and m4a are served with their type, in pieces when asked', async () => {
    const t = `/${server.token}`
    for (const [file, type] of [['voice/lines/03.mp3', 'audio/mpeg'], ['voice/lines/02.wav', 'audio/wav'], ['voice/samples/b.m4a', 'audio/mp4']]) {
      const r = await raw(server, `${t}/files/${file}`)
      assert.equal(r.status, 200, file)
      assert.equal(r.headers['content-type'], type, file)
      assert.equal(r.headers['x-content-type-options'], 'nosniff')
      assert.ok(r.body.equals(SOUND), file)
    }
    const part = await raw(server, `${t}/files/voice/lines/02.wav`, { Range: 'bytes=0-3' })
    assert.equal(part.status, 206)
    assert.equal(part.headers['content-range'], `bytes 0-3/${SOUND.length}`)
    assert.equal(part.body.toString(), 'RIFF')
    const view = await (await fetch(`${server.url}api/board`)).json()
    for (const p of ['voice/lines/02.wav', 'voice/lines/03.mp3', 'voice/samples/a.mp3', 'voice/samples/b.m4a', 'voice/samples/c.wav']) assert.ok(view.versions[p] > 0, `${p} is watched, so a new take at the same path shows up`)
  })

  test('audio from outside the project never comes back', async () => {
    const t = `/${server.token}`, secret = path.basename(outside)
    for (const p of [`${t}/files/../${secret}`, `${t}/files/voice/../../${secret}`, `${t}/files/%2e%2e/${secret}`, `${t}/files/..%2f${secret}`, `${t}/files/voice/link-out.mp3`, `${t}/files/%2fetc%2fpasswd.mp3`, `${t}/files/voice/lines/other.ogg`]) {
      const r = await raw(server, p)
      assert.ok([400, 403, 404].includes(r.status), `${p} → ${r.status}`)
      assert.equal(r.body.equals(SOUND), false, p)
    }
    assert.equal((await raw(server, `/wrong-token/files/voice/lines/02.wav`)).status, 403)
  })

  test('approve-script and redo-line become events and what `board.mjs events` lists', async () => {
    const approved = await post(server, { type: 'approve-script' })
    assert.equal(approved.status, 200)
    assert.equal(readBoard(project).script.state, 'approved')
    assert.equal((await post(server, { type: 'approve-script' })).status, 409)
    const redo = await (await post(server, { type: 'redo-line', scene: '02', text: ' warmer ' })).json()
    assert.deepEqual({ ...redo.event, n: 0, at: '' }, { n: 0, at: '', type: 'redo-line', scene: '02', text: 'warmer' })
    assert.equal((await post(server, { type: 'redo-line', scene: '01' })).status, 409)
    assert.equal((await post(server, { type: 'choice', choice: 'voice', option: 'C' })).status, 200)
    assert.deepEqual(readEvents(project).map((e) => e.type), ['approve-script', 'redo-line', 'choice'])
    const listed = cli('events', project)
    assert.equal(listed.code, 0, listed.err)
    assert.deepEqual(listed.out.split('\n').map((l) => { const { n, at, ...e } = JSON.parse(l); return e }), [
      { type: 'approve-script' }, { type: 'redo-line', scene: '02', text: 'warmer' }, { type: 'choice', choice: 'voice', option: 'C' },
    ])
  })

  test('a reference the person drops is still a picture or a video, never audio', async () => {
    const answer = await fetch(`${server.url}api/upload?name=${encodeURIComponent('take.mp3')}`, { method: 'POST', body: SOUND })
    assert.equal(answer.status, 415)
    assert.match((await answer.json()).error, /is not an image or a video I can show here/)
  })

  test('set refuses a take that is not there; patch brings it in', () => {
    const missing = clone(VOICE)
    missing.scenes[0].narration.audio = 'voice/lines/01.wav'
    const refused = spawnSync(process.execPath, [CLI, 'set', project, '-'], { input: JSON.stringify(missing), encoding: 'utf8' })
    assert.equal(refused.status, 1)
    assert.match(refused.stderr, /scenes\[0\]\.narration\.audio: file not found in the project: voice\/lines\/01\.wav/)
    fs.writeFileSync(path.join(project, 'voice', 'lines', '01.wav'), SOUND)
    const patched = cli('patch', project, JSON.stringify({ costs: { voice: { credits: 560 } }, scenes: [{ id: '01', narration: { audio: 'voice/lines/01.wav', seconds: 2.5, credits: 80 } }] }))
    assert.equal(patched.code, 0, patched.err)
    const board = readBoard(project)
    assert.deepEqual(board.scenes[0].narration, { text: 'Every week starts the <same> way.', audio: 'voice/lines/01.wav', seconds: 2.5, credits: 80 })
    assert.equal(board.costs.voice.credits, 560)
    assert.equal(board.costs.voice.capCredits, 1500)
    assert.equal(board.script.state, 'approved', 'a take is not new words')
  })
})
