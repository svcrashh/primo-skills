// The review board in the browser: shows one phase at a time, redraws when the board or the conversation changes, and
// sends every click, message and pasted picture to the local server.
// It never rebuilds what is already on screen: a message being typed and a video being watched stay as they are.
import { renderPage, resolvePhase, nextPhase, phaseOfHash, hashOfPhase, lastFromSkill } from './render.mjs'

const page = document.getElementById('page')
const offline = document.getElementById('offline')
const ui = { phase: undefined, started: new Set(), uploads: [], dropError: '', seen: null }
const drafts = {}         // what is typed and not sent yet, by box: it survives going to another phase and back
const known = new Map()   // scene id → "state|video", to notice a preview arriving while the page is open
let view = null

// Makes `from` look like `to`, touching only what differs. A child is recognized by its id, or by what it is (tag and
// first class) and which one of those it is among its siblings, so a block that appears or leaves does not make its
// neighbors be rebuilt.
function sync(from, to) {
  for (const { name } of [...from.attributes]) if (!to.hasAttribute(name)) from.removeAttribute(name)
  for (const { name, value } of [...to.attributes]) if (from.getAttribute(name) !== value) from.setAttribute(name, value)
  if (from.tagName !== 'TEXTAREA') syncChildren(from, to)
}

function keysOf(nodes) {
  const count = {}
  return nodes.map((node) => {
    if (node.nodeType === 1 && node.id) return `#${node.id}`
    const kind = node.nodeType === 1 ? `${node.nodeName}.${node.classList[0] || ''}` : node.nodeName
    count[kind] = (count[kind] || 0) + 1
    return `${kind}:${count[kind]}`
  })
}

// Moving a node takes the focus out of it and stops its video: what is being used stays put, the rest moves around it.
const inUse = (node) => node.nodeType === 1 && (node.contains(document.activeElement) || [...node.querySelectorAll('video')].some((v) => !v.paused))

function syncChildren(from, to) {
  const wanted = [...to.childNodes], keys = keysOf(wanted), needed = new Set(keys)
  const old = [...from.childNodes], have = new Map()
  keysOf(old).forEach((key, i) => { if (needed.has(key)) have.set(key, old[i]); else old[i].remove() })
  wanted.forEach((next, i) => {
    const here = from.childNodes[i] || null
    let match = have.get(keys[i])
    if (match && match.nodeName !== next.nodeName) { match.remove(); match = null }
    if (!match) return from.insertBefore(next, from.childNodes[i] || null)
    if (match !== here) {
      if (inUse(match)) while (from.childNodes[i] !== match) from.insertBefore(from.childNodes[i], match.nextSibling)
      else from.insertBefore(match, here)
    }
    if (next.nodeType === 1) sync(match, next)
    else if (match.nodeValue !== next.nodeValue) match.nodeValue = next.nodeValue
  })
}

const phaseNow = () => resolvePhase(view, ui.phase)
const sceneNow = () => { const p = phaseNow(); return p.startsWith('scene:') ? p.slice(6) : undefined }

function draw() {
  if (!view) return
  // the conversation on screen counts as read
  if (ui.seen) { const key = sceneNow() ?? ''; ui.seen.threads[key] = lastFromSkill(view, key) }
  const next = document.createElement('div')
  next.innerHTML = renderPage(view, ui)
  syncChildren(page, next)
  for (const box of page.querySelectorAll('textarea[data-draft]')) {
    const draft = drafts[box.dataset.draft] || ''
    if (box.value !== draft) box.value = draft
  }
  document.title = `Review board · ${view.board.title}`
}

// A preview that arrives while its phase is on screen starts playing, with its sound, if the browser lets it.
function take(next) {
  const arrived = []
  for (const s of next.board.scenes || []) {
    const now = `${s.state}|${s.video}`
    if (s.state === 'animated-preview' && known.has(s.id) && known.get(s.id) !== now) arrived.push(s)
    known.set(s.id, now)
  }
  view = next
  if (!ui.seen) ui.seen = { base: Math.max(0, ...(view.events || []).map((e) => e.n)), threads: {} }
  // The person stays where they are: the page only picks a phase on arrival, or when the one on screen is gone.
  const phase = resolvePhase(view, ui.phase)
  if (phase !== ui.phase) { ui.phase = phase; history.replaceState(null, '', hashOfPhase(phase)) }
  const here = arrived.find((s) => s.id === sceneNow())
  if (!here) return draw()
  const key = `${here.id}|${here.video}`
  ui.started.add(key)
  draw()
  document.getElementById(`video-${here.id}`)?.play().catch(() => { ui.started.delete(key); draw() })
}

async function load() {
  const answer = await fetch('api/board')
  if (!answer.ok) throw new Error(`board: ${answer.status}`)
  take(await answer.json())
}

async function send(path, options) {
  const answer = await fetch(path, { method: 'POST', ...options })
  const data = await answer.json().catch(() => ({}))
  if (data.view) take(data.view)
  return { ok: answer.ok, error: data.error }
}

// A click the server refuses means the board moved on (the scene changed state, the choice was closed): show it as it
// is now. A click nobody answers means the board was stopped: say so.
async function act(action) {
  try {
    const { ok } = await send('api/act', { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(action) })
    if (!ok) await load()
    return ok
  } catch {
    offline.hidden = false
    return false
  }
}

// A picture from the clipboard has no name of its own: it gets one that says where it was pasted.
function nameFor(file, scene, pasted) {
  if (!pasted || !/^image\.[a-z0-9]+$/i.test(file.name)) return file.name
  return `pasted${scene ? `-scene-${scene}` : ''}.${file.name.split('.').pop()}`
}

async function upload(files, { scene, pasted = false } = {}) {
  ui.dropError = ''
  const limit = view?.uploadLimitMb ?? 200
  for (const file of files) {
    const name = nameFor(file, scene, pasted), mark = { name, scene }
    if (file.size > limit * 1024 * 1024) { ui.dropError = `“${name}” is larger than ${limit} MB. Send a shorter or smaller version.`; draw(); continue }
    ui.uploads = [...ui.uploads, mark]
    draw()
    try {
      const { ok, error } = await send(`api/upload?name=${encodeURIComponent(name)}${scene ? `&scene=${encodeURIComponent(scene)}` : ''}`, { body: file })
      if (!ok) ui.dropError = error || `Could not save “${name}”. Try again.`
    } catch {
      ui.dropError = `Could not save “${name}”: this board is not answering. Ask in the chat to open it again.`
    }
    ui.uploads = ui.uploads.filter((u) => u !== mark)
    draw()
  }
}

async function say(button) {
  const box = button.closest('.say').querySelector('textarea'), text = box.value.trim(), draft = box.dataset.draft
  if (!text) { box.focus(); return }
  if (await act({ type: 'message', text, scene: button.dataset.scene })) {
    delete drafts[draft]
    draw()
    document.getElementById(box.id)?.focus()
  }
}

page.addEventListener('click', async (e) => {
  const button = e.target.closest('button')
  if (!button || button.disabled) return
  const data = { ...button.dataset }   // a copy: the button itself is redrawn while the click is being answered

  if (data.act === 'replace-still') {
    const box = button.closest('.compare').querySelector('textarea'), draft = box.dataset.draft
    if (await act({ type: 'replace-still', scene: data.scene, file: data.file, text: box.value.trim() || undefined })) { delete drafts[draft]; draw() }
  } else if (data.act) {
    if (button.getAttribute('aria-pressed') === 'true') return
    const from = phaseNow()
    const ok = await act({ type: data.act, scene: data.scene, choice: data.choice, option: data.option })
    // an approved preview closes its phase: on to the next one
    if (ok && data.act === 'approve-preview' && phaseNow() === from) location.hash = hashOfPhase(nextPhase(view, from))
  } else if ('say' in data) {
    await say(button)
  } else if (data.write) {
    const box = document.getElementById(data.write)
    box.scrollIntoView({ block: 'center', behavior: 'smooth' })
    box.focus({ preventScroll: true })
  } else if ('play' in data) {
    const player = button.closest('[data-player]')
    ui.started.add(`${player.dataset.player}|${player.dataset.video}`)
    draw()
    player.querySelector('video').play()
  } else if (data.copy) {
    await navigator.clipboard.writeText(data.copy).then(() => { button.textContent = 'Copied' }, () => { button.textContent = 'Select it and copy' })
  }
})

page.addEventListener('input', (e) => {
  if (e.target.dataset?.draft) drafts[e.target.dataset.draft] = e.target.value
})

// In a thread, Enter sends and Shift+Enter breaks the line.
page.addEventListener('keydown', (e) => {
  if (e.key !== 'Enter' || e.shiftKey || e.isComposing || !e.target.dataset?.draft?.startsWith('say:')) return
  e.preventDefault()
  say(e.target.closest('.say').querySelector('[data-say]'))
})

page.addEventListener('change', (e) => {
  const data = e.target.dataset || {}
  if (data.attach && e.target.value) act({ type: 'attach-reference', file: data.attach, scene: e.target.value })
  if ('file' in data) { upload([...e.target.files], { scene: data.scene }); e.target.value = '' }
})

// A picture pasted or dropped anywhere goes to the scene on screen; outside a scene, to the general references.
document.addEventListener('paste', (e) => {
  const files = [...(e.clipboardData?.files || [])]
  if (!files.length) return
  e.preventDefault()
  upload(files, { scene: sceneNow(), pasted: true })
})
window.addEventListener('dragover', (e) => { e.preventDefault(); document.body.classList.add('is-dropping') })
window.addEventListener('dragleave', (e) => { if (!e.relatedTarget) document.body.classList.remove('is-dropping') })
window.addEventListener('drop', (e) => {
  e.preventDefault()   // without this the browser would leave the board and open the file
  document.body.classList.remove('is-dropping')
  const files = [...(e.dataTransfer?.files || [])]
  if (files.length) upload(files, { scene: sceneNow() })
})

// The address says which phase is on screen, so back, forward and reload keep the place.
function goToHash() {
  ui.phase = location.hash.length > 1 ? phaseOfHash(location.hash) : undefined
  draw()
  const bar = page.querySelector('.phases'), main = page.querySelector('main')
  if (bar && main && main.getBoundingClientRect().top < bar.offsetHeight) window.scrollTo({ top: window.scrollY + main.getBoundingClientRect().top - bar.offsetHeight - 16 })
}
window.addEventListener('hashchange', goToHash)
ui.phase = location.hash.length > 1 ? phaseOfHash(location.hash) : undefined

// The server says when the board or the conversation changed; the page asks for it again. The stream reconnects on its own.
const stream = new EventSource('api/stream')
stream.onopen = () => { offline.hidden = true }
stream.onmessage = () => { load().catch(() => {}) }
stream.onerror = () => { offline.hidden = false }
