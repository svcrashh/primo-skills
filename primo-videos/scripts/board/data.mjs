// The review board's data: the board.json contract, the partial update, what each click changes, and the log of
// events (what the person did and what the skill said back).
// No server and no page here: everything in this file is plain data in, plain data out, plus the files in <project>/board/.
import fs from 'node:fs'
import path from 'node:path'

export const STATES = ['concept', 'still-approved', 'animated-preview', 'final']
export const SCRIPT_STATES = ['draft', 'approved']
export const IMAGE_EXT = ['png', 'jpg', 'jpeg', 'webp', 'gif']
export const VIDEO_EXT = ['mp4', 'mov', 'webm']
export const AUDIO_EXT = ['mp3', 'wav', 'm4a']
// What the person can drop on the page as a reference: a picture or a video. Audio is only served, never taken in.
export const MEDIA_EXT = [...IMAGE_EXT, ...VIDEO_EXT]
// What the person does on the page, and what the skill writes back into the same log (those carry from: "skill").
export const EVENT_TYPES = ['choice', 'approve-still', 'approve-preview', 'message', 'reference', 'attach-reference', 'replace-still', 'approve-script', 'redo-line']
export const SKILL_STATES = ['working', 'idle']
export const TEXT_MAX = 2000

const ID = /^[A-Za-z0-9][A-Za-z0-9_-]{0,39}$/
const KEYS = {
  board: ['title', 'subtitle', 'progress', 'costs', 'script', 'choices', 'scenes', 'pieces', 'references'],
  progress: ['label', 'percent', 'text'],
  costs: ['images', 'voice'],
  imageCosts: ['usd', 'capUsd', 'count'],
  voiceCosts: ['credits', 'capCredits', 'accountLeft'],
  script: ['state', 'words', 'seconds', 'credits', 'voice'],
  choice: ['id', 'title', 'intro', 'scene', 'options', 'chosen'],
  option: ['label', 'title', 'line', 'image', 'audio', 'generated', 'willMove', 'recommended'],
  scene: ['id', 'title', 'seconds', 'state', 'still', 'video', 'onScreen', 'willMove', 'narration', 'generated', 'pendingChoice', 'previewApproved', 'rebuilding'],
  narration: ['text', 'audio', 'seconds', 'credits'],
  generated: ['model', 'usd'],
  rebuilding: ['file', 'text', 'at'],
  piece: ['kind', 'name', 'image', 'generated', 'goesTo'],
  reference: ['file', 'name', 'scene', 'take'],
}

/** The scenes that have a line to say, in order: the script. */
export const linesOf = (board) => (Array.isArray(board?.scenes) ? board.scenes : []).filter((s) => isObject(s?.narration) && isText(s.narration.text))

export const extOf = (p) => path.extname(String(p)).slice(1).toLowerCase()
const isObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v)
const isText = (v) => typeof v === 'string' && v.trim() !== ''

/** The absolute path of a project-relative path, or null when it would leave the project (.., absolute, a link out). */
export function resolveInside(root, rel) {
  if (typeof rel !== 'string' || rel === '' || rel.includes('\0') || rel.includes('\\')) return null
  if (path.posix.isAbsolute(rel) || /^[A-Za-z]:/.test(rel)) return null
  const parts = rel.split('/')
  if (parts.some((s) => s === '' || s === '.' || s === '..')) return null
  const base = path.resolve(root)
  const abs = path.resolve(base, ...parts)
  if (!abs.startsWith(base + path.sep)) return null
  // A link inside the project that points out of it is a way out too: follow what exists of the path.
  try {
    const realBase = fs.realpathSync(base)
    let there = abs
    while (there !== base && !fs.existsSync(there)) there = path.dirname(there)
    const real = fs.realpathSync(there)
    if (real !== realBase && !real.startsWith(realBase + path.sep)) return null
  } catch { /* no such project folder: only the shape of the path was asked */ }
  return abs
}

/** Every problem in a board, as "where: what to fix". An empty list means the board is valid. With `root`, files must exist. */
export function validateBoard(board, { root } = {}) {
  const problems = []
  const bad = (where, what) => problems.push(`${where}: ${what}`)
  if (!isObject(board)) return ['board: must be a JSON object']

  const known = (obj, kind, where) => {
    for (const k of Object.keys(obj)) if (!KEYS[kind].includes(k)) bad(`${where}.${k}`, `unknown field (use ${KEYS[kind].join(', ')})`)
  }
  const text = (obj, key, where, required) => {
    if (obj[key] === undefined) { if (required) bad(`${where}.${key}`, 'is required (a non-empty text)'); return }
    if (!isText(obj[key])) bad(`${where}.${key}`, 'must be a non-empty text')
  }
  const lines = (obj, key, where) => {
    if (obj[key] === undefined) return
    if (!Array.isArray(obj[key]) || !obj[key].every(isText)) bad(`${where}.${key}`, 'must be a list of non-empty texts')
  }
  const media = (obj, key, where, kinds, required) => {
    const v = obj[key]
    if (v === undefined) { if (required) bad(`${where}.${key}`, `is required (a path inside the project: ${kinds.join(', ')})`); return }
    if (typeof v !== 'string' || !resolveInside(root || '/project', v)) return bad(`${where}.${key}`, 'must be a path relative to the project folder, with no ".." and no leading "/"')
    if (!kinds.includes(extOf(v))) return bad(`${where}.${key}`, `must be one of ${kinds.join(', ')} (got "${v}")`)
    if (root && !fs.statSync(resolveInside(root, v), { throwIfNoEntry: false })?.isFile()) bad(`${where}.${key}`, `file not found in the project: ${v}`)
  }
  const items = (key, kind) => {
    if (board[key] === undefined) return []
    if (!Array.isArray(board[key])) { bad(key, 'must be a list'); return [] }
    return board[key].map((item, i) => {
      const where = `${key}[${i}]`
      if (!isObject(item)) { bad(where, 'must be an object'); return null }
      known(item, kind, where)
      return [item, where]
    }).filter(Boolean)
  }
  const unique = (pairs, key, what) => {
    const seen = new Set()
    for (const [item, where] of pairs) {
      if (seen.has(item[key])) bad(`${where}.${key}`, `repeats another ${what} ("${item[key]}")`)
      seen.add(item[key])
    }
  }
  const id = (obj, where) => {
    if (typeof obj.id !== 'string' || !ID.test(obj.id)) bad(`${where}.id`, 'is required: a short text of letters, digits, "-" or "_", like "01"')
  }
  // Money, credits, words and seconds: never negative. `above` for what cannot be zero either (a length).
  const amount = (obj, key, where, { required = false, above = false, whole = false } = {}) => {
    const v = obj[key]
    const what = `${whole ? 'a whole number' : 'a number'} ${above ? 'above 0' : 'from 0 up'}`
    if (v === undefined) { if (required) bad(`${where}.${key}`, `is required: ${what}`); return }
    if (typeof v !== 'number' || !Number.isFinite(v) || (above ? !(v > 0) : !(v >= 0)) || (whole && !Number.isInteger(v))) bad(`${where}.${key}`, `must be ${what} (got ${JSON.stringify(v)})`)
  }
  const block = (obj, key, kind, where, what) => {
    if (obj[key] === undefined) return null
    if (!isObject(obj[key])) { bad(where, `must be an object with ${what}`); return null }
    known(obj[key], kind, where)
    return obj[key]
  }
  const generated = (obj, where) => {
    const g = block(obj, 'generated', 'generated', `${where}.generated`, 'model and usd')
    if (!g) return
    text(g, 'model', `${where}.generated`)
    amount(g, 'usd', `${where}.generated`)
  }

  known(board, 'board', 'board')
  text(board, 'title', 'board', true)
  text(board, 'subtitle', 'board')
  if (board.progress !== undefined) {
    const p = board.progress
    if (!isObject(p)) bad('progress', 'must be an object with percent and text')
    else {
      known(p, 'progress', 'progress')
      if (typeof p.percent !== 'number' || !(p.percent >= 0 && p.percent <= 100)) bad('progress.percent', 'is required: a number from 0 to 100')
      text(p, 'text', 'progress', true)
      text(p, 'label', 'progress')
    }
  }
  const costs = block(board, 'costs', 'costs', 'costs', 'images and voice (what `costs.mjs board <project>` prints)')
  if (costs) {
    const images = block(costs, 'images', 'imageCosts', 'costs.images', 'usd, capUsd and count')
    if (images) {
      amount(images, 'usd', 'costs.images', { required: true })
      amount(images, 'capUsd', 'costs.images', { required: true })
      amount(images, 'count', 'costs.images', { whole: true })
    }
    const voice = block(costs, 'voice', 'voiceCosts', 'costs.voice', 'credits, capCredits and accountLeft')
    if (voice) {
      amount(voice, 'credits', 'costs.voice', { required: true })
      amount(voice, 'capCredits', 'costs.voice', { required: true })
      amount(voice, 'accountLeft', 'costs.voice')
    }
  }
  const script = block(board, 'script', 'script', 'script', 'state, and maybe words, seconds, credits and voice')
  if (script) {
    if (!SCRIPT_STATES.includes(script.state)) bad('script.state', `is required: one of ${SCRIPT_STATES.join(', ')}${script.state === undefined ? '' : ` (got ${JSON.stringify(script.state)})`}`)
    amount(script, 'words', 'script', { whole: true })
    amount(script, 'seconds', 'script')
    amount(script, 'credits', 'script')
    text(script, 'voice', 'script')
  }

  const scenes = items('scenes', 'scene'), choices = items('choices', 'choice')
  const sceneIds = new Set(scenes.map(([s]) => s.id)), choiceIds = new Set(choices.map(([c]) => c.id))

  for (const [c, where] of choices) {
    id(c, where)
    text(c, 'title', where, true)
    text(c, 'intro', where)
    if (c.scene !== undefined && !sceneIds.has(c.scene)) bad(`${where}.scene`, `no scene with id "${c.scene}"`)
    if (!Array.isArray(c.options) || c.options.length < 2) { bad(`${where}.options`, 'is required: a list of at least two options'); continue }
    const options = []
    c.options.forEach((o, j) => {
      const at = `${where}.options[${j}]`
      if (!isObject(o)) return bad(at, 'must be an object')
      known(o, 'option', at)
      text(o, 'label', at, true)
      text(o, 'title', at, true)
      text(o, 'line', at)
      // an option is a still to look at, a sample to listen to (a voice), or both
      if (o.image === undefined && o.audio === undefined) bad(`${at}.image`, `is required (a picture: ${IMAGE_EXT.join(', ')}), or an audio to listen to (${AUDIO_EXT.join(', ')})`)
      media(o, 'image', at, IMAGE_EXT, false)
      media(o, 'audio', at, AUDIO_EXT, false)
      generated(o, at)
      lines(o, 'willMove', at)
      if (o.recommended !== undefined && typeof o.recommended !== 'boolean') bad(`${at}.recommended`, 'must be true or false')
      options.push([o, at])
    })
    unique(options, 'label', 'option label')
    if (c.chosen !== undefined && !c.options.some((o) => isObject(o) && o.label === c.chosen)) bad(`${where}.chosen`, `no option with label "${c.chosen}"`)
  }
  unique(choices, 'id', 'choice id')

  for (const [s, where] of scenes) {
    id(s, where)
    text(s, 'title', where, true)
    if (typeof s.seconds !== 'number' || !(s.seconds > 0)) bad(`${where}.seconds`, 'is required: a number above 0')
    if (!STATES.includes(s.state)) bad(`${where}.state`, `is required: one of ${STATES.join(', ')}`)
    text(s, 'onScreen', where)
    lines(s, 'willMove', where)
    if (s.rebuilding !== undefined) {
      if (!isObject(s.rebuilding)) bad(`${where}.rebuilding`, 'must be an object with file and at')
      else {
        known(s.rebuilding, 'rebuilding', `${where}.rebuilding`)
        media(s.rebuilding, 'file', `${where}.rebuilding`, IMAGE_EXT, true)
        text(s.rebuilding, 'at', `${where}.rebuilding`, true)
        text(s.rebuilding, 'text', `${where}.rebuilding`)
      }
    }
    if (s.previewApproved !== undefined && typeof s.previewApproved !== 'boolean') bad(`${where}.previewApproved`, 'must be true or false')
    if (s.pendingChoice !== undefined && !choiceIds.has(s.pendingChoice)) bad(`${where}.pendingChoice`, `no choice with id "${s.pendingChoice}"`)
    media(s, 'video', where, VIDEO_EXT, s.state === 'animated-preview')
    media(s, 'still', where, IMAGE_EXT, s.video === undefined && s.pendingChoice === undefined)
    // a scene that waits on a choice shows that choice's pictures: every option needs one
    const waitsOn = s.still === undefined && s.video === undefined && choices.find(([c]) => c.id === s.pendingChoice)?.[0]
    if (waitsOn && Array.isArray(waitsOn.options) && waitsOn.options.some((o) => isObject(o) && o.image === undefined)) {
      bad(`${where}.pendingChoice`, `choice "${waitsOn.id}" has an option with no image, so this scene would have nothing to show: give the scene a still, or every option an image`)
    }
    const n = block(s, 'narration', 'narration', `${where}.narration`, 'text, and maybe audio, seconds and credits')
    if (n) {
      text(n, 'text', `${where}.narration`, true)
      media(n, 'audio', `${where}.narration`, AUDIO_EXT, false)
      amount(n, 'seconds', `${where}.narration`, { above: true })
      amount(n, 'credits', `${where}.narration`)
    }
    generated(s, where)
  }
  unique(scenes, 'id', 'scene id')

  for (const [p, where] of items('pieces', 'piece')) {
    text(p, 'kind', where, true)
    text(p, 'name', where, true)
    media(p, 'image', where, IMAGE_EXT, true)
    generated(p, where)
    text(p, 'goesTo', where)
  }

  const references = items('references', 'reference')
  for (const [r, where] of references) {
    media(r, 'file', where, MEDIA_EXT, true)
    text(r, 'name', where)
    lines(r, 'take', where)
    if (r.scene !== undefined && !sceneIds.has(r.scene)) bad(`${where}.scene`, `no scene with id "${r.scene}"`)
  }
  unique(references, 'file', 'reference file')

  return problems
}

// The person's marks belong to what they were made on: a new picture, a new take or new words start clean. And what the
// skill says about a picture (that it was generated) belongs to that picture.
const MARKS = {
  scenes: [
    { when: ['still', 'video', 'state'], drop: ['previewApproved', 'rebuilding'] },
    { when: ['narration.text', 'narration.audio'], drop: ['previewApproved'] },
    { when: ['still'], drop: ['generated'] },
  ],
  choices: [{ when: ['options'], drop: ['chosen'] }],
}
// Blocks merged field by field, at the top of the board and inside an item of a list.
const MERGED = ['progress', 'costs', 'script']
const MERGED_IN = { scenes: ['narration', 'generated'] }
const LIST_KEY = { scenes: 'id', choices: 'id', references: 'file' }
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b)
const at = (obj, dotted) => dotted.split('.').reduce((v, k) => (isObject(v) ? v[k] : undefined), obj)

function mergeFields(target, fields) {
  const out = { ...target }
  for (const [k, v] of Object.entries(fields)) { if (v === null) delete out[k]; else out[k] = v }
  return out
}

// One level deeper too: `{ "costs": { "voice": { "accountLeft": 900 } } }` keeps what the voice block already had.
function mergeBlock(target, fields) {
  const out = { ...target }
  for (const [k, v] of Object.entries(fields)) {
    if (v === null) delete out[k]
    else out[k] = isObject(v) && isObject(out[k]) ? mergeFields(out[k], v) : v
  }
  return out
}

/**
 * A partial update. Texts and `pieces` are replaced; `progress`, `costs` and `script` are merged; `scenes` and `choices`
 * are merged by `id` and `references` by `file` (a new id is added at the end, `"remove": true` takes the item out), and
 * inside a scene its `narration` and `generated`; `null` removes a field.
 * An approved script is approved on its words: a patch that changes what a line says puts it back to "draft".
 */
export function patchBoard(board, patch) {
  if (!isObject(patch)) throw new Error('the patch must be a JSON object')
  const out = { ...board }
  for (const [key, value] of Object.entries(patch)) {
    if (value === null) { delete out[key]; continue }
    if (MERGED.includes(key) && isObject(value) && isObject(out[key])) { out[key] = mergeBlock(out[key], value); continue }
    const by = LIST_KEY[key]
    if (!by || !Array.isArray(value)) { out[key] = value; continue }
    const list = [...(Array.isArray(out[key]) ? out[key] : [])]
    for (const item of value) {
      if (!isObject(item) || item[by] === undefined) throw new Error(`${key}: every item in a patch needs its "${by}"`)
      const i = list.findIndex((x) => x[by] === item[by])
      const { remove, ...fields } = item
      if (remove === true) { if (i >= 0) list.splice(i, 1); continue }
      if (i < 0) { list.push(mergeFields({}, fields)); continue }
      const inside = Object.fromEntries((MERGED_IN[key] || []).filter((k) => isObject(fields[k]) && isObject(list[i][k])).map((k) => [k, mergeFields(list[i][k], fields[k])]))
      let merged = mergeFields(list[i], { ...fields, ...inside })
      for (const marks of MARKS[key] || []) {
        if (marks.when.some((k) => !same(at(merged, k), at(list[i], k)))) {
          merged = mergeFields(merged, Object.fromEntries(marks.drop.filter((k) => !(k in fields)).map((k) => [k, null])))
        }
      }
      list[i] = merged
    }
    out[key] = list
  }
  const open = new Set((out.choices || []).map((c) => c.id))
  if (Array.isArray(out.scenes)) out.scenes = out.scenes.map((s) => (s.pendingChoice !== undefined && !open.has(s.pendingChoice) ? mergeFields(s, { pendingChoice: null }) : s))
  if (board.script?.state === 'approved' && out.script?.state === 'approved' && patch.script?.state === undefined && wordsChanged(board, out)) {
    out.script = { ...out.script, state: 'draft' }
  }
  return out
}

/** Whether a line says something new: different words in a scene, or a line in a scene that had none. */
function wordsChanged(before, after) {
  const said = new Map(linesOf(before).map((s) => [s.id, s.narration.text]))
  return linesOf(after).some((s) => said.get(s.id) !== s.narration.text)
}

export class ActionError extends Error {
  constructor(status, message) { super(message); this.status = status }
}

function said(value, what = 'the message') {
  const text = typeof value === 'string' ? value.trim() : ''
  if (!text) throw new ActionError(400, `${what} is empty`)
  if (text.length > TEXT_MAX) throw new ActionError(400, `${what} is too long (${TEXT_MAX} characters at most)`)
  return text
}

/**
 * What one click, one message or one picture changes in the board, and the event it leaves: `{ board, event }`
 * (the event still without n and at). The board comes back untouched when the action only says something.
 */
export function applyAction(board, action, { now = new Date() } = {}) {
  if (!isObject(action)) throw new ActionError(400, 'the action must be a JSON object')
  const scenes = board.scenes || [], choices = board.choices || [], references = board.references || []
  const find = (list, key, value, what) => {
    const i = typeof value === 'string' ? list.findIndex((x) => x[key] === value) : -1
    if (i < 0) throw new ActionError(404, `no ${what} "${value}" on this board`)
    return i
  }
  const without = (item, ...keys) => Object.fromEntries(Object.entries(item).filter(([k]) => !keys.includes(k)))
  const put = (key, list, i, item) => ({ ...board, [key]: list.map((x, j) => (j === i ? item : x)) })

  switch (action.type) {
    case 'choice': {
      const i = find(choices, 'id', action.choice, 'choice'), c = choices[i]
      find(c.options, 'label', action.option, 'option')
      const event = { type: 'choice', choice: c.id, option: action.option }
      if (c.scene !== undefined) event.scene = c.scene
      return { board: put('choices', choices, i, { ...c, chosen: action.option }), event }
    }
    case 'approve-still': {
      const i = find(scenes, 'id', action.scene, 'scene'), s = scenes[i]
      if (s.state !== 'concept') throw new ActionError(409, `scene "${s.id}" is not a concept still (it is ${s.state})`)
      if (s.pendingChoice !== undefined) throw new ActionError(409, `scene "${s.id}" is waiting for a choice first`)
      return { board: put('scenes', scenes, i, { ...without(s, 'rebuilding'), state: 'still-approved' }), event: { type: 'approve-still', scene: s.id } }
    }
    case 'approve-preview': {
      const i = find(scenes, 'id', action.scene, 'scene'), s = scenes[i]
      if (s.state !== 'animated-preview') throw new ActionError(409, `scene "${s.id}" has no animated preview to approve (it is ${s.state})`)
      return { board: put('scenes', scenes, i, { ...s, previewApproved: true }), event: { type: 'approve-preview', scene: s.id } }
    }
    case 'message': {
      const event = { type: 'message', from: 'person', text: said(action.text) }
      if (action.scene !== undefined) event.scene = scenes[find(scenes, 'id', action.scene, 'scene')].id
      return { board, event }
    }
    case 'reference': {
      if (!MEDIA_EXT.includes(extOf(action.file))) throw new ActionError(400, 'the reference must be an image or a video')
      if (references.some((r) => r.file === action.file)) throw new ActionError(409, `"${action.file}" is already a reference`)
      const added = { file: action.file }, event = { type: 'reference', file: action.file }
      if (action.scene !== undefined) added.scene = event.scene = scenes[find(scenes, 'id', action.scene, 'scene')].id
      return { board: { ...board, references: [...references, added] }, event }
    }
    case 'attach-reference': {
      const i = find(references, 'file', action.file, 'reference')
      find(scenes, 'id', action.scene, 'scene')
      return { board: put('references', references, i, { ...references[i], scene: action.scene }), event: { type: 'attach-reference', file: action.file, scene: action.scene } }
    }
    // The person's own picture takes the place of the scene's still: the scene goes back to a concept and waits for
    // the still rebuilt from it. Whatever was approved before was approved on the old picture.
    case 'replace-still': {
      const r = find(references, 'file', action.file, 'reference'), i = find(scenes, 'id', action.scene, 'scene'), s = scenes[i]
      if (!IMAGE_EXT.includes(extOf(action.file))) throw new ActionError(400, 'a still is rebuilt from a picture, not from a video')
      const rebuilding = { file: action.file, at: now.toISOString() }, event = { type: 'replace-still', scene: s.id, file: action.file }
      if (typeof action.text === 'string' && action.text.trim()) rebuilding.text = event.text = said(action.text, 'the note')
      return {
        board: {
          ...board,
          scenes: scenes.map((x, j) => (j === i ? { ...without(s, 'previewApproved'), state: 'concept', rebuilding } : x)),
          references: references.map((x, j) => (j === r ? { ...x, scene: s.id } : x)),
        },
        event,
      }
    }
    // The voice is recorded only on words the person approved: this is that approval.
    case 'approve-script': {
      const script = board.script
      if (!isObject(script)) throw new ActionError(404, 'this board has no script to approve')
      if (script.state === 'approved') throw new ActionError(409, 'the script is already approved')
      if (!linesOf(board).length) throw new ActionError(409, 'the script has no lines yet')
      return { board: { ...board, script: { ...script, state: 'approved' } }, event: { type: 'approve-script' } }
    }
    // A new take of one line, maybe with new words or what to change: only said, the new take comes in a patch.
    case 'redo-line': {
      const s = scenes[find(scenes, 'id', action.scene, 'scene')]
      if (!isObject(s.narration) || s.narration.audio === undefined) throw new ActionError(409, `scene "${s.id}" has no recorded line to redo yet`)
      const event = { type: 'redo-line', scene: s.id }
      if (typeof action.text === 'string' && action.text.trim()) event.text = said(action.text, 'the note')
      return { board, event }
    }
    default:
      throw new ActionError(400, `unknown action "${action.type}" (use ${EVENT_TYPES.join(', ')})`)
  }
}

/** What the skill writes into the log: a message in a thread, or whether it is working. Checked, with from: "skill". */
export function skillEvent(board, { type, scene, text, state }) {
  const event = { type, from: 'skill' }
  if (scene !== undefined) {
    if (!(board.scenes || []).some((s) => s.id === scene)) throw new ActionError(404, `no scene "${scene}" on this board`)
    event.scene = scene
  }
  if (type === 'message') return { ...event, text: said(text) }
  if (type !== 'status') throw new ActionError(400, `unknown skill event "${type}"`)
  if (!SKILL_STATES.includes(state)) throw new ActionError(400, `the status is ${SKILL_STATES.join(' or ')}`)
  return typeof text === 'string' && text.trim() ? { ...event, state, text: said(text) } : { ...event, state }
}

// ── the files in <project>/board/ ────────────────────────────────────────────────────────────────────────────────────

export const boardDir = (project) => path.join(path.resolve(project), 'board')
export const boardFile = (project) => path.join(boardDir(project), 'board.json')
export const eventsFile = (project) => path.join(boardDir(project), 'events.jsonl')
export const referencesDir = (project) => path.join(boardDir(project), 'references')
export const listeningFile = (project) => path.join(boardDir(project), 'listening.json')

const pause = (ms) => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms)

/** One writer at a time, across the server and the command line: board.json and events.jsonl change only in here. */
export function withLock(project, work) {
  const lock = path.join(boardDir(project), '.lock')
  fs.mkdirSync(boardDir(project), { recursive: true })
  for (let tries = 0; ; tries++) {
    try { fs.closeSync(fs.openSync(lock, 'wx')); break } catch (e) {
      if (e.code !== 'EEXIST') throw e
      const age = Date.now() - (fs.statSync(lock, { throwIfNoEntry: false })?.mtimeMs ?? Date.now())
      if (age > 5000 || tries > 400) fs.rmSync(lock, { force: true })   // whoever held it died
      else pause(15)
    }
  }
  try { return work() } finally { fs.rmSync(lock, { force: true }) }
}

/** The board on disk, or null when there is none yet. Invalid JSON throws with the file name in the message. */
export function readBoard(project) {
  let raw
  try { raw = fs.readFileSync(boardFile(project), 'utf8') } catch (e) { if (e.code === 'ENOENT') return null; throw e }
  try { return JSON.parse(raw) } catch (e) { throw new Error(`${boardFile(project)} is not valid JSON: ${e.message}`) }
}

export function writeBoard(project, board) {
  const file = boardFile(project), tmp = `${file}.${process.pid}.tmp`
  fs.mkdirSync(path.dirname(file), { recursive: true })
  fs.writeFileSync(tmp, JSON.stringify(board, null, 2) + '\n')
  fs.renameSync(tmp, file)
}

export function readEvents(project, since = 0) {
  let raw = ''
  try { raw = fs.readFileSync(eventsFile(project), 'utf8') } catch (e) { if (e.code !== 'ENOENT') throw e }
  const events = []
  for (const line of raw.split('\n')) {
    if (!line.trim()) continue
    try { events.push(JSON.parse(line)) } catch { /* a line cut by a crash: skip it */ }
  }
  return events.filter((e) => e.n > since)
}

/** Appends one event with the next number. Call it inside withLock. */
export function appendEvent(project, fields) {
  const last = readEvents(project).at(-1)
  const event = { n: (last?.n ?? 0) + 1, at: new Date().toISOString(), ...fields }
  fs.appendFileSync(eventsFile(project), JSON.stringify(event) + '\n')
  return event
}
