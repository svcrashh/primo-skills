// The review board's page as text. The same function draws it on the server (first load) and in the browser (every
// update), so it uses nothing from Node and nothing from the DOM. Everything shown comes from the board and its log; no
// example lives here.
//   view: { board, versions: { <path>: <mtime> }, events: [...], listener: "waiting" | "acting" | "away", agent: "<command>",
//           logo: bool, uploadLimitMb, problems: [] }
//   ui:   what only the open page knows: { phase: "scene:<id>" | "script" | "direction" | "all", started: Set<"scene|video">,
//           playing: "<audio element id>", uploads: [{ name, scene }], dropError: text, seen: { base: n, threads: { <thread>: n } } }
// The page goes one phase at a time: an optional "script" phase (the voice-over, approved before any voice is recorded),
// an optional "direction" phase (choices about the whole video, the voice among them), then one phase per scene, and
// "all" for the overview.

const VIDEO = /\.(mp4|mov|webm)$/i
const STATES = {
  concept: { cls: 'state-concept', name: 'Concept', line: 'A rough idea of the picture. Options to pick from.' },
  'still-approved': { cls: 'state-still', name: 'Still approved', line: 'The exact frame, agreed. Nothing moves yet.' },
  'animated-preview': { cls: 'state-preview', name: 'Animated preview', line: 'The still, moving. A draft to watch and correct.' },
  final: { cls: 'state-final', name: 'Final', line: 'Rendered with music. Ready to deliver.' },
}
const OUR_PICTURE = { concept: 'concept', 'still-approved': 'as approved', 'animated-preview': 'animated draft', final: 'final' }
const GENERAL = ''   // the thread about the whole video

export const esc = (v) => String(v).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))
export const slug = (v) => String(v).replace(/[^A-Za-z0-9]+/g, '-').replace(/^-|-$/g, '')
const clock = (s) => { const t = Math.round(s); return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}` }
const amount = (s) => String(Math.round(s * 10) / 10)
// US$ 0.09, US$ 0.043: two places unless a third one says something
const dollars = (v) => `US$ ${Number(v.toFixed(2)) === Number(v.toFixed(4)) ? v.toFixed(2) : v.toFixed(3)}`
const credits = (v) => Math.round(v).toLocaleString('en-US')
const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v)
const wordsOf = (text) => String(text).split(/\s+/).filter((w) => /[\p{L}\p{N}]/u.test(w)).length
const words = (n) => `${n} ${n === 1 ? 'word' : 'words'}`
const hour = (at) => { const d = new Date(at); return Number.isNaN(d.getTime()) ? '' : `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}` }

const icon = (name, cls) => `<svg${cls ? ` class="${cls}"` : ''} aria-hidden="true"><use href="#i-${name}"/></svg>`
const check = icon('check', 'check')
const nameOf = (reference) => esc(reference.name || String(reference.file).split('/').pop())
const statePill = (state) => `<span class="pill state ${STATES[state].cls}">${STATES[state].name}</span>`
const stillPill = (text = 'STILL · will be animated') => `<span class="pill kind-still">${icon('still')}${text}</span>`
const animatedPill = (text) => `<span class="pill kind-animated">${icon('play')}${text}</span>`
const bullets = (list) => `<ul class="bullets">${list.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>`
const sceneName = (s) => `Scene ${esc(s.id)} · ${esc(s.title)}`
const ACCEPT = '.png,.jpg,.jpeg,.webp,.gif,.mp4,.mov,.webm'

function makeUrl(view) {
  return (p) => {
    const v = view.versions?.[p]
    return 'files/' + String(p).split('/').map(encodeURIComponent).join('/') + (v ? `?v=${v}` : '')
  }
}

// ── phases ───────────────────────────────────────────────────────────────────────────────────────────────────────────

const scenesOf = (view) => view.board.scenes || []
const choicesOf = (view, scene) => (view.board.choices || []).filter((c) => c.scene === scene.id || c.id === scene.pendingChoice)
const generalChoices = (view) => (view.board.choices || []).filter((c) => c.scene === undefined && !scenesOf(view).some((s) => s.pendingChoice === c.id))
const scriptOf = (view) => (isObj(view.board.script) ? view.board.script : null)
/** The scenes with a line to say, in order: what the script is made of. */
const linesOf = (view) => scenesOf(view).filter((s) => isObj(s.narration) && typeof s.narration.text === 'string' && s.narration.text.trim())

export const hashOfPhase = (phase) => (phase.startsWith('scene:') ? `#scene-${phase.slice(6)}` : `#${phase}`)
export const phaseOfHash = (hash) => (hash.startsWith('#scene-') ? `scene:${decodeURIComponent(hash.slice(7))}` : hash.slice(1))

/** Every phase of this board, in order: "script" when the video has a voice-over, "direction" when there are choices about the whole video, then each scene. */
export function phasesOf(view) {
  return [...(scriptOf(view) ? ['script'] : []), ...(generalChoices(view).length ? ['direction'] : []), ...scenesOf(view).map((s) => `scene:${s.id}`)]
}

/** A still is being rebuilt from the person's picture until a newer still file arrives (or the patch names a new one). */
function rebuildingNow(scene, view) {
  if (!scene.rebuilding) return false
  const still = scene.still === undefined ? undefined : view.versions?.[scene.still]
  return !(still > Date.parse(scene.rebuilding.at))
}

/** A new take of a line was asked for, and the take on disk is still the old one: the request, else null. */
function redoing(scene, view) {
  const audio = scene.narration?.audio
  const asked = audio === undefined ? undefined : (view.events || []).filter((e) => e.type === 'redo-line' && e.scene === scene.id).at(-1)
  if (!asked) return null
  return view.versions?.[audio] > Date.parse(asked.at) ? null : asked
}

/** Whether a phase is waiting for the person: a script to approve, a choice to make, a still or a preview to approve. */
function needsYou(view, phase) {
  if (phase === 'script') return scriptOf(view)?.state === 'draft' && linesOf(view).length > 0
  if (phase === 'direction') return generalChoices(view).some((c) => c.chosen === undefined)
  const scene = scenesOf(view).find((s) => `scene:${s.id}` === phase)
  if (!scene) return false
  if (choicesOf(view, scene).some((c) => c.chosen === undefined)) return true
  if (scene.state === 'concept') return scene.pendingChoice === undefined && !rebuildingNow(scene, view)
  return scene.state === 'animated-preview' && scene.previewApproved !== true
}

/** Where the page opens: the first phase waiting for the person, else the first scene that is not final, else everything. */
export function startPhase(view) {
  const all = phasesOf(view)
  return all.find((p) => needsYou(view, p))
    || scenesOf(view).filter((s) => s.state !== 'final').map((s) => `scene:${s.id}`)[0]
    || 'all'
}

export const resolvePhase = (view, wanted) => (wanted === 'all' || phasesOf(view).includes(wanted) ? wanted : startPhase(view))

/** The phase after this one, or "all" after the last. */
export function nextPhase(view, phase) {
  const all = phasesOf(view), i = all.indexOf(phase)
  return all[i + 1] || 'all'
}

// ── the conversation ─────────────────────────────────────────────────────────────────────────────────────────────────

const threadOf = (view, key) => (view.events || []).filter((e) => (e.scene ?? GENERAL) === key && e.type !== 'status')

/** The newest thing the skill wrote in a thread: the page marks a phase when it is newer than what the person saw. */
export const lastFromSkill = (view, key) => threadOf(view, key).filter((e) => e.from === 'skill').at(-1)?.n ?? 0

function unseen(view, ui, key) {
  if (!ui.seen) return false
  return lastFromSkill(view, key) > (ui.seen.threads?.[key] ?? ui.seen.base ?? 0)
}

/** What the skill said it is doing in this thread, or null. Its next message there, or `status idle`, ends it. */
function workingOn(view, key) {
  if (view.listener === 'away') return null
  const last = (view.events || []).filter((e) => e.from === 'skill' && (e.scene ?? GENERAL) === key).at(-1)
  return last?.type === 'status' && last.state === 'working' ? last.text || '' : null
}

function entry(e, view) {
  if (e.type === 'message') {
    const skill = e.from === 'skill'
    return `<li class="${skill ? 'from-skill' : 'from-person'}"><p class="who">${skill ? 'Skill' : 'You'} <time>${hour(e.at)}</time></p><p class="said">${esc(e.text)}</p></li>`
  }
  const file = e.file ? esc(String(e.file).split('/').pop()) : ''
  const option = () => (view.board.choices || []).find((c) => c.id === e.choice)?.options.find((o) => o.label === e.option)?.title ?? `option ${e.option}`
  const did = {
    choice: () => `You chose “${esc(option())}”.`,
    'approve-still': () => 'You approved the still.',
    'approve-preview': () => 'You approved the preview.',
    reference: () => `You added ${file}.`,
    'attach-reference': () => `You put ${file} next to this scene.`,
    'replace-still': () => `You asked for this scene to be rebuilt from ${file}${e.text ? `: “${esc(e.text)}”` : '.'}`,
    'approve-script': () => 'You approved the script.',
    'redo-line': () => `You asked for a new take of this line${e.text ? `: “${esc(e.text)}”` : '.'}`,
  }[e.type]
  return did ? `<li class="is-step"><p>${did()} <time>${hour(e.at)}</time></p></li>` : ''
}

function thread(view, key, { title, about, placeholder }) {
  const id = key === GENERAL ? 'general' : slug(key), items = threadOf(view, key).map((e) => entry(e, view)).join('')
  const working = workingOn(view, key)
  const target = key === GENERAL ? '' : ` data-scene="${esc(key)}"`
  return `<section class="thread" id="thread-${id}" aria-labelledby="thread-${id}-title">
    <h3 id="thread-${id}-title">${title}</h3>
    ${items ? `<ol class="talk">${items}</ol>` : ''}
    ${working === null ? '' : `<p class="working" role="status"><span class="dots" aria-hidden="true"><i></i><i></i><i></i></span>Skill is working…${working ? ` ${esc(working)}` : ''}</p>`}
    <div class="say">
      <label class="sr-only" for="say-${id}">Write to the skill about ${about}</label>
      <textarea id="say-${id}" data-draft="say:${esc(key)}" maxlength="2000" placeholder="${placeholder}"></textarea>
      <button class="btn btn-secondary" type="button" data-say${target}>Send</button>
    </div>
  </section>`
}

// ── header and phase strip ───────────────────────────────────────────────────────────────────────────────────────────

function skillLine(view) {
  if (view.listener === 'waiting' || view.listener === 'acting') {
    return `<p class="skill is-on" role="status"><span class="dot" aria-hidden="true"></span>Skill connected${view.listener === 'acting' ? ' · working on your last step' : ''}</p>`
  }
  return `<div class="skill is-off" role="status">
    <p><strong>Skill not connected</strong> — ask in the chat to continue, or run this in a terminal:</p>
    <code>${esc(view.agent || '')}</code>
    <button class="btn" type="button" data-copy="${esc(view.agent || '')}">Copy</button>
  </div>`
}

const CAP = {
  near: { pill: 'Near the cap', note: '' },
  at: { pill: 'At the cap', note: 'I ask you in the chat before spending more.' },
  over: { pill: 'Over the cap', note: 'Past this video’s cap: I ask you in the chat before spending more.' },
}

/** How close a spend is to its cap: "" (far), near (80% or more), at, over. */
export function capLevel(spent, cap) {
  const ratio = cap > 0 ? spent / cap : spent > 0 ? Infinity : 1
  return ratio > 1 + 1e-9 ? 'over' : ratio >= 1 - 1e-9 ? 'at' : ratio >= 0.8 ? 'near' : ''
}

function meter({ name, spent, cap, value, max, more, low }) {
  const level = capLevel(value, max), percent = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 100
  return `<div class="meter${level ? ` is-${level}` : ''}">
      <p class="meter-top"><span class="label">${name}</span><span class="meter-num num"><strong>${spent}</strong> of ${cap}</span>${level ? `<span class="pill cap">${CAP[level].pill}</span>` : ''}</p>
      <div class="bar" role="meter" aria-label="${name}: ${spent} of ${cap}" aria-valuemin="0" aria-valuemax="${max}" aria-valuenow="${value}"><span style="width:${percent}%"></span></div>
      ${more ? `<p class="meter-more${low ? ' is-low' : ''}">${more}</p>` : ''}
      ${level && CAP[level].note ? `<p class="meter-note">${CAP[level].note}</p>` : ''}
    </div>`
}

/** What this video spent on generated images and on voice, each against its cap (the `costs` block of board.json). */
function spend(costs) {
  const meters = []
  if (isObj(costs.images)) {
    const { usd, capUsd, count } = costs.images
    meters.push(meter({ name: 'Images', spent: dollars(usd), cap: dollars(capUsd), value: usd, max: capUsd, more: count === undefined ? '' : `${count} generated` }))
  }
  if (isObj(costs.voice)) {
    const { credits: used, capCredits, accountLeft } = costs.voice
    const low = accountLeft !== undefined && accountLeft < capCredits - used
    meters.push(meter({
      name: 'Voice', spent: credits(used), cap: `${credits(capCredits)} credits`, value: used, max: capCredits, low,
      more: accountLeft === undefined ? '' : low ? `Only ${credits(accountLeft)} left in the account, less than this video may still use` : `${credits(accountLeft)} left in the account`,
    }))
  }
  return meters.length ? `<section class="spend" aria-labelledby="spend-title">
    <div class="spend-title"><h2 id="spend-title">Spent on this video</h2><p>against this video’s caps</p></div>
    ${meters.join('')}
  </section>` : ''
}

function header(view) {
  const { board } = view, p = board.progress
  const percent = p ? Math.round(p.percent) : 0, label = p ? esc(p.label || 'Preview') : ''
  const progress = p ? `<div class="progress">
      <p><strong>${label}: ${percent}%</strong> — ${esc(p.text)}</p>
      <div class="bar" role="progressbar" aria-label="${label} progress" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${percent}"><span style="width:${percent}%"></span></div>
    </div>` : ''
  return `<header>
  ${view.logo ? '<img class="logo" src="kit/logo.png" alt="Logo">' : ''}
  <div class="title-row">
    <div class="title">
      <h1>Review board</h1>
      <p class="project">${esc(board.title)}${board.subtitle ? ` · ${esc(board.subtitle)}` : ''}</p>
    </div>
    ${progress}
  </div>
  ${isObj(board.costs) ? spend(board.costs) : ''}
  ${skillLine(view)}
  ${(view.problems || []).length ? `<div class="problem" role="alert"><p>board.json has a problem, so this is the last good version:</p>${bullets(view.problems)}</div>` : ''}
</header>`
}

/** The four states. Inside a phase, the one the scene is in is marked. */
function legend(now) {
  const step = (state) => `<li${state === now ? ' class="is-now" aria-current="step"' : ''}>${statePill(state)}<p>${STATES[state].line}</p></li>`
  const arrow = `<li class="arrow" aria-hidden="true">${icon('arrow')}</li>`
  return `<ol class="legend" aria-label="${now ? 'Where this scene is' : 'The four states of a picture'}">${Object.keys(STATES).map(step).join(arrow)}</ol>`
}

function strip(view, ui, phase) {
  const dot = '<i class="dot" title="Waiting for you"></i>'
  const chip = (p, cls, number, name, state, key) => {
    const marked = needsYou(view, p) || unseen(view, ui, key)
    return `<li><a class="chip ${cls}${p === phase ? ' is-now' : ''}" href="${hashOfPhase(p)}" title="${number ? `${number} ` : ''}${name} · ${state}"${p === phase ? ' aria-current="step"' : ''}>
      <span class="chip-top">${number ? `<b>${number}</b>` : ''}<span>${name}</span>${marked ? dot : ''}</span>
      <small>${state}</small>
    </a></li>`
  }
  const chips = phasesOf(view).map((p) => {
    if (p === 'script') {
      const approved = scriptOf(view).state === 'approved'
      return chip(p, approved ? 'state-still' : 'state-concept', '', 'Script', approved ? 'Approved' : linesOf(view).length ? 'To approve' : 'Draft', GENERAL)
    }
    if (p === 'direction') {
      const open = generalChoices(view).filter((c) => c.chosen === undefined).length
      return chip(p, 'state-concept', '', 'Direction', open ? `${open} to choose` : 'Chosen', GENERAL)
    }
    const s = scenesOf(view).find((x) => `scene:${x.id}` === p)
    return chip(p, STATES[s.state].cls, esc(s.id), esc(s.title), rebuildingNow(s, view) ? 'Rebuilding' : STATES[s.state].name, s.id)
  }).join('')
  return `<nav class="phases" aria-label="The video, scene by scene">
  <ol>${chips}</ol>
  <a class="btn all${phase === 'all' ? ' is-now' : ''}" href="#all"${phase === 'all' ? ' aria-current="page"' : ''}>All scenes${unseen(view, ui, GENERAL) && phase !== 'all' ? '<i class="dot" title="A new message"></i>' : ''}</a>
</nav>`
}

// ── pieces of a phase ────────────────────────────────────────────────────────────────────────────────────────────────

/** What a scene shows right now: its own still, or the picture of the option it is waiting on. */
function pictureOf(scene, board) {
  const choice = scene.pendingChoice !== undefined ? (board.choices || []).find((c) => c.id === scene.pendingChoice) : null
  const chosen = choice?.options.find((o) => o.label === choice.chosen)
  const shown = chosen || (scene.still === undefined ? choice?.options.find((o) => o.recommended) || choice?.options[0] : null)
  return {
    choice, chosen,
    image: shown?.image ?? scene.still,
    generated: shown ? shown.generated : scene.generated,
    willMove: shown?.willMove ?? scene.willMove ?? [],
  }
}

// ── generated pictures and what is heard ─────────────────────────────────────────────────────────────────────────────

const genLine = (g) => `AI-generated${g.model ? ` with ${esc(g.model)}` : ''}${typeof g.usd === 'number' ? ` · ${dollars(g.usd)}` : ''}`

/** A picture the skill generated carries the mark on it, with what it cost. A picture without `generated` is the person's or the product's. */
function marked(img, generated) {
  if (!isObj(generated)) return img
  return `<div class="pic">${img}<span class="gen" title="${genLine(generated)}">${icon('spark')}AI-generated${typeof generated.usd === 'number' ? ` · ${dollars(generated.usd)}` : ''}</span></div>`
}

/**
 * A button that plays a sound, one at a time on the page. The <audio> stays where it is between redraws; `ui.playing`
 * is the id of the one playing.
 */
function listen(audio, { id, about, seconds, big = false }, ui, url) {
  const on = ui.playing === id
  return `<div class="listen${big ? ' listen-big' : ''}${on ? ' is-playing' : ''}">
      <audio id="${id}" preload="metadata" src="${url(audio)}"></audio>
      <button class="btn listen-btn" type="button" data-listen="${id}" aria-pressed="${on}" aria-label="${on ? 'Pause' : 'Listen to'} ${about}">${icon(on ? 'pause' : 'play')}<span>${on ? 'Pause' : 'Listen'}</span>${seconds ? `<span class="listen-time num">${amount(seconds)} s</span>` : ''}</button>
      <span class="wave" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i><i></i><i></i></span>
    </div>`
}

function choiceTray(choice, view, ui, url) {
  const chosen = choice.options.find((o) => o.label === choice.chosen)
  const id = esc(choice.id)
  const options = choice.options.map((o) => {
    const on = o === chosen, what = `option ${esc(o.label)}: ${esc(o.title)}`
    const sample = o.audio === undefined ? '' : listen(o.audio, { id: `audio-option-${slug(choice.id)}-${slug(o.label)}`, about: what, big: o.image === undefined }, ui, url)
    const samplePill = `<span class="pill kind-sample">${icon('wave')}SAMPLE · listen</span>`
    const look = o.image === undefined
      ? `<div class="mount sample-mount"><div class="mount-bar">${samplePill}</div><div class="sample">${sample}</div></div>`
      : `<div class="mount">
        <div class="mount-bar">${o.audio === undefined ? stillPill() + statePill('concept') : samplePill}</div>
        ${marked(`<img src="${url(o.image)}" alt="Option ${esc(o.label)}: ${esc(o.title)}">`, o.generated)}
      </div>${sample}`
    return `<article class="option${on ? ' is-chosen' : ''}" id="option-${id}-${slug(o.label)}">
      <div class="option-top"><span>Option ${esc(o.label)}</span>${o.recommended ? '<span class="pill tag-dark">Recommended</span>' : ''}</div>
      ${look}
      <h3>${esc(o.title)}</h3>
      ${o.line ? `<p class="one-line">${esc(o.line)}</p>` : ''}
      ${isObj(o.generated) ? `<p class="gen-line">${genLine(o.generated)}</p>` : ''}
      ${o.willMove?.length ? `<div class="moves"><p class="label">What will move:</p>${bullets(o.willMove)}</div>` : ''}
      <button class="btn btn-big${o.recommended ? ' btn-key' : ''}${on ? ' is-done' : ''}" type="button" data-act="choice" data-choice="${id}" data-option="${esc(o.label)}" aria-pressed="${on}">${check}<span>${on ? 'Chosen' : 'Choose this'}</span></button>
    </article>`
  }).join('')
  return `<section class="tray choice" id="choice-${id}" aria-labelledby="choice-${id}-title">
    <div class="head">
      <h2 id="choice-${id}-title">Needs your choice</h2>
      <span class="pill tag-dark">${chosen ? `Chosen: ${esc(chosen.title)}` : 'Open'}</span>
      <span class="meta">${esc(choice.title)}</span>
    </div>
    ${choice.intro ? `<p class="lead">${esc(choice.intro)}</p>` : ''}
    <div class="options${chosen ? ' has-choice' : ''}" data-count="${choice.options.length}">${options}</div>
    ${chosen ? `<p class="next">You chose “${esc(chosen.title)}”. I take it from here; pick another one if you change your mind.</p>` : ''}
  </section>`
}

function sceneMount(scene, picture, ui, url, { play = true } = {}) {
  const moving = scene.video !== undefined && (scene.state === 'animated-preview' || scene.state === 'final')
  const kind = moving
    ? animatedPill(scene.state === 'final' ? 'ANIMATED · final render' : 'ANIMATED · draft')
    : stillPill(scene.state === 'final' ? 'STILL · from the final render' : undefined)
  const id = esc(scene.id), what = `scene ${id}: ${esc(scene.title)}`
  let media
  if (moving && play) {
    const started = ui.started.has(`${scene.id}|${scene.video}`)
    media = `<div class="player${started ? ' is-started' : ''}" data-player="${id}" data-video="${esc(scene.video)}">
      <video id="video-${id}" playsinline preload="metadata"${picture.image ? ` poster="${url(picture.image)}"` : ''} src="${url(scene.video)}" aria-label="${scene.state === 'final' ? 'Final render' : 'Animated preview'} of ${what}"${started ? ' controls' : ''}></video>
      <button class="play num" type="button" data-play>${icon('play')}Play ${clock(scene.seconds)}</button>
    </div>`
  } else if (picture.image) {
    media = marked(`<img src="${url(picture.image)}" alt="${scene.state === 'concept' ? 'Concept still' : 'Still'} for ${what}">`, picture.generated)
  } else {
    media = `<video src="${url(scene.video)}" muted playsinline preload="metadata" aria-label="First frame of ${what}"></video>`
  }
  return `<div class="mount"><div class="mount-bar">${kind}${statePill(scene.state)}</div>${media}</div>`
}

/** The person's own picture next to ours, with the button that asks for the scene to be rebuilt from it. */
function yourVersion(reference, scene, view, ui, url) {
  const name = nameOf(reference), picture = pictureOf(scene, view.board), id = esc(scene.id), key = slug(reference.file)
  const video = VIDEO.test(reference.file)
  const theirs = video
    ? `<video src="${url(reference.file)}" controls playsinline preload="metadata" aria-label="Your version: ${name}"></video>`
    : `<img src="${url(reference.file)}" alt="Your version: ${name}">`
  const ours = picture.image
    ? marked(`<img src="${url(picture.image)}" alt="Our still for scene ${id}">`, picture.generated)
    : `<video src="${url(scene.video)}" controls playsinline preload="metadata" aria-label="Our preview for scene ${id}"></video>`
  // once asked, the picture has done its part: what comes next is said in the conversation, not by pressing again
  const asked = (view.events || []).some((e) => e.type === 'replace-still' && e.file === reference.file && e.scene === scene.id)
  let ask
  if (scene.rebuilding?.file === reference.file && rebuildingNow(scene, view)) {
    ask = `<p class="pill rebuilding">Rebuilding from your picture</p>
      ${scene.rebuilding.text ? `<p class="soon">Your note: “${esc(scene.rebuilding.text)}”</p>` : ''}
      <p class="soon">The new still takes the place of ours as soon as it is ready.</p>`
  } else if (asked) {
    ask = '<p class="soon">Our still was rebuilt from this picture. Approve it above, or tell me below what to change.</p>'
  } else if (video) {
    ask = '<p class="soon">A video stays here as a reference. Tell me below what to take from it.</p>'
  } else {
    ask = `<label class="label" for="keep-${key}">What to keep / change <small>(optional)</small></label>
      <textarea id="keep-${key}" data-draft="keep:${esc(reference.file)}" maxlength="2000" placeholder="Keep my colors, change only the title…"></textarea>
      <button class="btn btn-secondary" type="button" data-act="replace-still" data-scene="${id}" data-file="${esc(reference.file)}">Use my picture for this scene</button>`
  }
  return `<div class="compare" id="compare-${key}">
    <div class="compare-head"><h3>Your version vs. our still</h3><span>${name}, added by you</span></div>
    <figure>
      <figcaption>Your version</figcaption>
      <div class="mount"><div class="mount-bar"><span class="pill kind-reference">YOUR VERSION</span></div>${theirs}</div>
    </figure>
    <figure>
      <figcaption>Our still <small>scene ${id}, ${OUR_PICTURE[scene.state]}</small></figcaption>
      <div class="mount"><div class="mount-bar">${stillPill(scene.state === 'final' ? 'STILL · from the final render' : undefined)}${statePill(scene.state)}</div>${ours}</div>
    </figure>
    <div class="compare-side">
      ${reference.take?.length ? `<p class="label">What I would take from it</p>${bullets(reference.take)}` : ''}
      ${ask}
    </div>
  </div>`
}

function sending(ui, scene) {
  return ui.uploads.filter((u) => (u.scene ?? GENERAL) === scene).map((u) => `<li class="is-sending"><span class="thumb"></span><span>${esc(u.name)}</span><span>saving…</span></li>`)
}

/** Where a better picture comes in: paste, drop or pick a file. */
function swap(scene, ui) {
  const id = esc(scene.id), saving = sending(ui, scene.id)
  return `<div class="swap">
    ${icon('plus')}
    <p class="ask"><strong>Have a better picture for this scene?</strong> Paste it here (⌘V or Ctrl+V), drop the file on this page, or</p>
    <label class="btn">Choose a file<input class="sr-only" type="file" accept="${ACCEPT}" data-file data-scene="${id}"></label>
    ${ui.dropError ? `<p class="drop-error" role="alert">${esc(ui.dropError)}</p>` : ''}
    ${saving.length ? `<ul class="dropped">${saving.join('')}</ul>` : ''}
  </div>`
}

/** What a line's numbers say: its words, and once recorded its length and what it cost. */
function lineMeta(n) {
  return [words(wordsOf(n.text)), typeof n.seconds === 'number' && `${amount(n.seconds)} s`, typeof n.credits === 'number' && `${credits(n.credits)} credits`].filter(Boolean).join(' · ')
}
const tooLong = (scene) => typeof scene.narration?.seconds === 'number' && scene.narration.seconds > scene.seconds
  ? `<p class="line-warn">The take runs ${amount(scene.narration.seconds)} s, longer than the scene (${amount(scene.seconds)} s).</p>` : ''

/** The scene's line: what is said, the take to listen to alone, and the way to ask for a new one. */
function voiceBlock(scene, view, ui, url) {
  const n = scene.narration
  if (!isObj(n) || typeof n.text !== 'string' || !n.text.trim()) return ''
  const id = esc(scene.id), key = slug(scene.id), script = scriptOf(view), draft = script?.state === 'draft'
  const asked = redoing(scene, view)
  const toScript = '<a class="btn" href="#script">Open the script</a>'
  let take
  if (n.audio !== undefined) {
    take = listen(n.audio, { id: `audio-line-${key}`, about: `the line of scene ${id}`, seconds: n.seconds }, ui, url)
      + (draft ? `<p class="soon">The script changed after this take and waits for your approval again.</p>${toScript}` : '')
  } else if (draft) take = `<p class="soon">Not recorded yet: the script waits for your approval first, because recording spends credits.</p>${toScript}`
  else if (script) take = '<p class="soon">Being recorded. The take shows up here.</p>'
  else take = '<p class="soon">Not recorded yet.</p>'

  let side = ''
  if (asked) {
    side = `<p class="pill rebuilding">Redoing this line</p>
      ${asked.text ? `<p class="soon">Your note: “${esc(asked.text)}”</p>` : ''}
      <p class="soon">${draft ? 'Approve the new words in the script and I record it.' : 'The new take takes the place of this one as soon as it is ready.'}</p>`
  } else if (n.audio !== undefined) {
    side = `<label class="label" for="redo-${key}">New words, or what to change <small>(optional)</small></label>
      <textarea id="redo-${key}" data-draft="redo:${id}" maxlength="2000" placeholder="Slower, and stress the last word…"></textarea>
      <button class="btn btn-secondary" type="button" data-act="redo-line" data-scene="${id}">Record this line again</button>`
  }
  return `<section class="voice${side ? '' : ' is-alone'}" id="voice-${key}" aria-labelledby="voice-${key}-title">
    <div class="voice-head"><h3 id="voice-${key}-title">Voice-over</h3><span class="num">${lineMeta(n)}</span></div>
    <div class="voice-main">
      <p class="line-text">“${esc(n.text)}”</p>
      ${take}
      ${tooLong(scene)}
    </div>
    ${side ? `<div class="voice-side">${side}</div>` : ''}
  </section>`
}

// ── a phase ──────────────────────────────────────────────────────────────────────────────────────────────────────────

const approveButton = (act, text, scene) => `<button class="btn btn-big btn-secondary" type="button" data-act="${act}"${scene === undefined ? '' : ` data-scene="${esc(scene)}"`} aria-pressed="false">${check}<span>${text}</span></button>`
const doneButton = (text) => `<button class="btn btn-big btn-secondary is-done" type="button" aria-pressed="true" disabled>${check}<span>${text}</span></button>`
const changeButton = (box) => `<button class="btn" type="button" data-write="${box}">Change something…</button>`

function scenePhase(scene, view, ui, url) {
  const scenes = scenesOf(view), all = phasesOf(view), at = all.indexOf(`scene:${scene.id}`)
  const id = esc(scene.id), picture = pictureOf(scene, view.board), preview = scene.state === 'animated-preview'
  const waiting = scene.state === 'concept' && picture.choice
  const rebuilding = rebuildingNow(scene, view)
  const nav = (p, text, back) => (p
    ? `<a class="btn${back ? ' back' : ''}" href="${hashOfPhase(p)}">${back ? icon('arrow') : ''}${text}${back ? '' : icon('arrow')}</a>`
    : '')
  const change = changeButton(`say-${slug(scene.id)}`), done = doneButton
  const approve = (act, text) => approveButton(act, text, scene.id)

  let next, actions
  if (rebuilding) {
    next = 'I am rebuilding this still from your picture. The new one shows up here.'
    actions = change
  } else if (scene.state === 'concept') {
    next = 'This is the exact frame. Approve it and I animate it next.'
    actions = approve('approve-still', 'Approve still') + change
  } else if (scene.state === 'still-approved') {
    next = 'Still approved. I am animating it; the preview shows up here. You can go on to the next scene meanwhile.'
    actions = done('Still approved') + change
  } else if (preview && scene.previewApproved !== true) {
    next = `This is the draft, moving, with its ${linesOf(view).includes(scene) ? 'voice-over and music' : 'sound'}. Approve it and I render it final.`
    actions = approve('approve-preview', 'Approve preview') + change
  } else if (preview) {
    next = 'Preview approved. I am rendering this scene final.'
    actions = done('Preview approved') + change
  } else {
    next = 'Final. Rendered with music, ready to deliver.'
    actions = ''
  }

  const stage = waiting ? '' : `<div class="stage">
    ${sceneMount(scene, picture, ui, url)}
    <aside class="stage-side">
      ${scene.onScreen ? `<div class="field"><p class="label">On screen</p><p class="on-screen">${esc(scene.onScreen)}</p></div>` : ''}
      ${picture.willMove.length ? `<div class="field"><p class="label">${preview ? 'What moves in this draft' : scene.state === 'final' ? 'What moves' : 'What will move'}</p>${bullets(picture.willMove)}</div>` : ''}
      ${isObj(picture.generated) ? `<div class="field"><p class="label">Picture</p><p class="gen-line">${genLine(picture.generated)}</p></div>` : ''}
      <p class="next${rebuilding ? ' is-rebuilding' : ''}">${next}</p>
      ${actions ? `<div class="actions">${actions}</div>` : ''}
    </aside>
  </div>`
  const references = (view.board.references || []).filter((r) => r.scene === scene.id)

  return `<section class="phase" id="phase-${id}" data-phase="${id}" aria-labelledby="phase-${id}-title">
  <div class="phase-head">
    <span class="scene-num num">${id}</span>
    <h2 id="phase-${id}-title">${esc(scene.title)}</h2>
    <span class="meta num">${amount(scene.seconds)} s · scene ${scenes.indexOf(scene) + 1} of ${scenes.length}</span>
    <span class="phase-nav">${nav(all[at - 1], 'Previous', true)}${nav(all[at + 1] || 'all', all[at + 1] ? 'Next' : 'All scenes', false)}</span>
  </div>
  ${legend(scene.state)}
  ${stage}
  ${waiting && scene.onScreen ? `<div class="field waiting-on"><p class="label">On screen</p><p class="on-screen">${esc(scene.onScreen)}</p></div>` : ''}
  ${choicesOf(view, scene).map((c) => choiceTray(c, view, ui, url)).join('')}
  ${voiceBlock(scene, view, ui, url)}
  ${references.map((r) => yourVersion(r, scene, view, ui, url)).join('')}
  ${swap(scene, ui)}
  ${thread(view, scene.id, { title: 'Talk about this scene', about: `scene ${id}`, placeholder: 'Write to the skill: what to change, a question…' })}
</section>`
}

function directionPhase(view, ui, url) {
  const all = phasesOf(view)
  return `<section class="phase" id="phase-direction" aria-labelledby="phase-direction-title">
  <div class="phase-head">
    <h2 id="phase-direction-title">Direction</h2>
    <span class="meta">Choices about the whole video, before the scenes</span>
    <span class="phase-nav"><a class="btn" href="${hashOfPhase(all[1] || 'all')}">${all[1] ? 'Next' : 'All scenes'}${icon('arrow')}</a></span>
  </div>
  ${generalChoices(view).map((c) => choiceTray(c, view, ui, url)).join('')}
  ${thread(view, GENERAL, { title: 'Talk about the whole video', about: 'the whole video', placeholder: 'Write to the skill about the whole video…' })}
</section>`
}

/** The voice-over of the whole video, line by line, approved before any voice is recorded. */
function scriptPhase(view, ui, url) {
  const script = scriptOf(view), all = phasesOf(view), at = all.indexOf('script'), lines = linesOf(view)
  const approved = script.state === 'approved', recorded = lines.length > 0 && lines.every((s) => s.narration.audio !== undefined)
  const total = typeof script.words === 'number' ? script.words : lines.reduce((n, s) => n + wordsOf(s.narration.text), 0)
  const facts = [
    ['Words', String(total)],
    typeof script.seconds === 'number' && ['Voice time', `≈ ${amount(script.seconds)} s`],
    typeof script.credits === 'number' && ['To record', `≈ ${credits(script.credits)} credits`],
    script.voice && ['Voice', esc(script.voice)],
  ].filter(Boolean)
  const rows = scenesOf(view).map((s) => {
    const n = s.narration, id = esc(s.id)
    const where = `<a class="scene-num num" href="#scene-${id}" aria-label="Scene ${id}">${id}</a>`
    if (!lines.includes(s)) return `<li class="line is-silent">${where}<div class="line-body"><p class="line-where">${esc(s.title)} <span class="num">· ${amount(s.seconds)} s</span></p><p class="line-none">No voice in this scene</p></div></li>`
    const take = n.audio === undefined ? '' : listen(n.audio, { id: `audio-line-${slug(s.id)}`, about: `the line of scene ${id}`, seconds: n.seconds }, ui, url)
    return `<li class="line" id="line-${slug(s.id)}">${where}<div class="line-body">
        <p class="line-where">${esc(s.title)} <span class="num">· ${amount(s.seconds)} s</span></p>
        <p class="line-text">“${esc(n.text)}”</p>
        <p class="line-meta num">${lineMeta(n)}</p>
        ${tooLong(s)}
      </div>${take}</li>`
  }).join('')
  let next, actions
  if (!lines.length) {
    next = 'No lines yet. They show up here as soon as I write them.'
    actions = changeButton('say-general')
  } else if (!approved) {
    next = 'Read it as it will be heard. Approve it and I record the voice: recording spends credits, so nothing is recorded before this.'
    actions = approveButton('approve-script', 'Approve script') + changeButton('say-general')
  } else {
    next = recorded ? 'Script approved and recorded. Each take is in its scene, to listen to and to redo.' : 'Script approved. I am recording the voice; each take shows up in its scene.'
    actions = doneButton('Script approved') + changeButton('say-general')
  }
  return `<section class="phase" id="phase-script" aria-labelledby="phase-script-title">
  <div class="phase-head">
    <h2 id="phase-script-title">Script</h2>
    <span class="meta num">The voice-over · ${lines.length} ${lines.length === 1 ? 'line' : 'lines'} · ${words(total)}</span>
    <span class="phase-nav"><a class="btn" href="${hashOfPhase(all[at + 1] || 'all')}">${all[at + 1] ? 'Next' : 'All scenes'}${icon('arrow')}</a></span>
  </div>
  <div class="stage script">
    <ol class="lines" aria-label="The lines, in the order they are said">${rows}</ol>
    <aside class="stage-side">
      <dl class="facts">${facts.map(([k, v]) => `<div><dt class="label">${k}</dt><dd class="num">${v}</dd></div>`).join('')}</dl>
      <p class="next">${next}</p>
      <div class="actions">${actions}</div>
    </aside>
  </div>
  ${thread(view, GENERAL, { title: 'Talk about the whole video', about: 'the whole video', placeholder: 'Write to the skill: a line to change, a word to say differently…' })}
</section>`
}

// ── all scenes ───────────────────────────────────────────────────────────────────────────────────────────────────────

function overviewCard(scene, view, ui, url) {
  const picture = pictureOf(scene, view.board), id = esc(scene.id)
  return `<article class="scene" id="card-${id}">
    <div class="scene-head"><span class="scene-num num">${id}</span><h3>${esc(scene.title)}</h3><span class="duration num">${amount(scene.seconds)} s</span></div>
    ${sceneMount(scene, picture, ui, url, { play: false })}
    ${scene.onScreen ? `<div class="field"><p class="label">On screen</p><p class="on-screen">${esc(scene.onScreen)}</p></div>` : ''}
    ${linesOf(view).includes(scene) ? `<div class="field"><p class="label">Voice-over${scene.narration.audio === undefined ? '' : ' · recorded'}</p><p class="said-line">“${esc(scene.narration.text)}”</p></div>` : ''}
    <div class="actions"><a class="btn" href="#scene-${id}">${needsYou(view, `scene:${scene.id}`) ? 'Open: it is waiting for you' : 'Open this scene'}</a></div>
  </article>`
}

function scenesBlock(view, ui, url) {
  const scenes = scenesOf(view)
  if (!scenes.length) return ''
  const total = scenes.reduce((sum, s) => sum + s.seconds, 0)
  let at = 0
  const ruler = scenes.map((s, i) => {
    const start = at
    at += s.seconds
    const time = i === scenes.length - 1 ? `<span>${clock(start)}</span><span>${clock(total)}</span>` : clock(start)
    return `<li style="flex:${s.seconds}"><a class="${STATES[s.state].cls}" href="#scene-${esc(s.id)}" title="${esc(s.id)} ${esc(s.title)} · ${STATES[s.state].name}"><b>${esc(s.id)}</b><span>${esc(s.title)}</span></a><time>${time}</time></li>`
  }).join('')
  return `<section class="block" id="scenes" aria-labelledby="scenes-title">
  <div class="head">
    <h2 id="scenes-title">Scenes</h2>
    <span class="meta">${scenes.length} ${scenes.length === 1 ? 'scene' : 'scenes'} · ${amount(total)} s</span>
  </div>
  ${legend()}
  <ol class="ruler num" aria-label="Timeline, ${amount(total)} seconds">${ruler}</ol>
  <div class="scenes">${scenes.map((s) => overviewCard(s, view, ui, url)).join('')}</div>
</section>`
}

function referencesBlock(view, ui, url) {
  const scenes = scenesOf(view), references = view.board.references || []
  const sceneOf = (r) => scenes.find((s) => s.id === r.scene)
  const thumb = (r) => (VIDEO.test(r.file) ? `<video class="thumb" src="${url(r.file)}" muted playsinline preload="metadata"></video>` : `<img src="${url(r.file)}" alt="">`)
  const loose = references.filter((r) => !sceneOf(r)).map((r) => `<li id="reference-${slug(r.file)}">${thumb(r)}<span>${nameOf(r)}</span>${scenes.length ? `<select class="attach" data-attach="${esc(r.file)}" aria-label="Scene for ${nameOf(r)}">
      <option value="" selected>Put it next to a scene…</option>
      ${scenes.map((s) => `<option value="${esc(s.id)}">${esc(s.id)} · ${esc(s.title)}</option>`).join('')}
    </select>` : ''}</li>`)
  const placed = references.filter(sceneOf).map((r) => `<li id="reference-${slug(r.file)}">${thumb(r)}<span>${nameOf(r)}</span><a class="attach" href="#scene-${esc(r.scene)}">In scene ${esc(r.scene)}</a></li>`)
  const saving = sending(ui, GENERAL)
  return `<section class="block" id="references" aria-labelledby="references-title">
  <div class="head"><h2 id="references-title">Your references</h2></div>
  <p class="lead">Made something yourself, or found a look you like? Put it here and I set it next to our still. To change one scene's picture, paste it inside that scene.</p>
  <div class="dropzone">
    ${icon('plus')}
    <p class="ask">Drop or paste an image or a video here — a reference you made or found elsewhere</p>
    <label class="btn">Choose a file<input class="sr-only" type="file" accept="${ACCEPT}" multiple data-file></label>
    <p class="hint">PNG, JPG, WEBP, GIF, MP4, MOV or WEBM, up to ${esc(view.uploadLimitMb ?? 200)} MB. It stays on this computer.</p>
    ${ui.dropError ? `<p class="drop-error" role="alert">${esc(ui.dropError)}</p>` : ''}
    ${loose.length + placed.length + saving.length ? `<ul class="dropped">${loose.join('')}${placed.join('')}${saving.join('')}</ul>` : ''}
  </div>
</section>`
}

function pieceShape(kind) {
  if (/icon/i.test(kind)) return 'icon'
  if (/logo|symbol|wordmark/i.test(kind)) return 'mark'
  if (/photo/i.test(kind)) return 'cover'
  return 'fit'
}

function piecesBlock(view, url) {
  const pieces = view.board.pieces || []
  if (!pieces.length) return ''
  return `<section class="block" id="pieces" aria-labelledby="pieces-title">
  <div class="head"><h2 id="pieces-title">What goes into the video</h2></div>
  <p class="lead">The pieces picked for this video, and the scene each one lands in.</p>
  <div class="strip">${pieces.map((p) => {
    const shape = pieceShape(p.kind)
    return `<figure class="tile tile-${shape}">
      <div class="thumb ${shape}">${marked(`<img src="${url(p.image)}" alt="${esc(p.kind)}: ${esc(p.name)}">`, p.generated)}</div>
      <figcaption><p class="label">${esc(p.kind)}</p><p class="name">${esc(p.name)}</p>${p.goesTo ? `<p class="goes">→ ${esc(p.goesTo)}</p>` : ''}${isObj(p.generated) ? `<p class="gen-line">${genLine(p.generated)}</p>` : ''}</figcaption>
    </figure>`
  }).join('')}</div>
</section>`
}

function overview(view, ui, url) {
  return `<div class="all" id="phase-all">
${scenesBlock(view, ui, url)}
${referencesBlock(view, ui, url)}
${piecesBlock(view, url)}
<section class="block" aria-label="The whole video">
  ${thread(view, GENERAL, { title: 'Talk about the whole video', about: 'the whole video', placeholder: 'Write to the skill about the whole video…' })}
</section>
</div>`
}

/** Everything inside <div class="page">. */
export function renderPage(view, ui = {}) {
  const state = { started: ui.started || new Set(), playing: ui.playing || null, uploads: ui.uploads || [], dropError: ui.dropError || '', seen: ui.seen }
  const url = makeUrl(view), phase = resolvePhase(view, ui.phase)
  const scene = scenesOf(view).find((s) => `scene:${s.id}` === phase)
  const shown = phase === 'all' ? overview(view, state, url)
    : phase === 'script' ? scriptPhase(view, state, url)
      : phase === 'direction' ? directionPhase(view, state, url) : scenePhase(scene, view, state, url)
  return `${header(view)}
${strip(view, state, phase)}
<main data-phase="${esc(phase)}">
${shown}
</main>
<footer class="foot">
  ${icon('computer')}
  <p>Runs on this computer only (127.0.0.1). Nothing is sent anywhere.</p>
</footer>`
}

export const SYMBOLS = `<svg width="0" height="0" style="position:absolute" aria-hidden="true">
  <symbol id="i-still" viewBox="0 0 10 10"><rect width="10" height="10" rx="2.2" fill="currentColor"/></symbol>
  <symbol id="i-play" viewBox="0 0 10 10"><path d="M1.6 0.9v8.2a.6.6 0 0 0 .92.5l6.4-4.1a.6.6 0 0 0 0-1L2.52.4a.6.6 0 0 0-.92.5z" fill="currentColor"/></symbol>
  <symbol id="i-check" viewBox="0 0 16 16"><path d="M3 8.6l3.2 3.2L13 5" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></symbol>
  <symbol id="i-arrow" viewBox="0 0 28 28"><path d="M4 14h19M17 8l6 6-6 6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></symbol>
  <symbol id="i-plus" viewBox="0 0 36 36"><circle cx="18" cy="18" r="16.5" fill="none" stroke="currentColor" stroke-width="2"/><path d="M18 11v14M11 18h14" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></symbol>
  <symbol id="i-computer" viewBox="0 0 18 18"><rect x="2.5" y="3" width="13" height="9" rx="1.6" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M1 15h16" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></symbol>
  <symbol id="i-pause" viewBox="0 0 10 10"><rect x="1.6" y="0.9" width="2.5" height="8.2" rx="0.7" fill="currentColor"/><rect x="5.9" y="0.9" width="2.5" height="8.2" rx="0.7" fill="currentColor"/></symbol>
  <symbol id="i-wave" viewBox="0 0 10 10"><path d="M1 4v2M3 2.5v5M5 1v8M7 2.5v5M9 4v2" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></symbol>
  <symbol id="i-spark" viewBox="0 0 10 10"><path d="M5 0.3C5.45 3.2 6.8 4.55 9.7 5 6.8 5.45 5.45 6.8 5 9.7 4.55 6.8 3.2 5.45 0.3 5 3.2 4.55 4.55 3.2 5 0.3z" fill="currentColor"/></symbol>
</svg>`

/** The whole document the server sends on the first load. Relative links carry the token that is already in the URL. */
export function renderDocument(view) {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Review board · ${esc(view.board.title)}</title>
<link rel="stylesheet" href="app/page.css">
</head>
<body>
${SYMBOLS}
<div class="page" id="page">
${renderPage(view)}
</div>
<p class="offline" id="offline" role="status" hidden>This board is not answering. Ask in the chat to open it again.</p>
<script type="module" src="app/page.mjs"></script>
</body>
</html>
`
}
