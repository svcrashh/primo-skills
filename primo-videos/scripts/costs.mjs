#!/usr/bin/env node
// The cost notebook of a video. Every paid call (a generated image, a narrated line) is written to
// <project>/costs.jsonl, and nothing is spent past the video's caps without the person saying so.
//
//   node costs.mjs show  <project> [--json]                                   what was spent, against the caps
//   node costs.mjs cap   <project> [--image-usd 0.5] [--voice-credits 1500]   read or change this video's caps
//   node costs.mjs board <project> [--account-left <credits>]                 the `costs` block for board.json
//
// The caps live in <project>/costs.json; without the file, the defaults below. A call that would go past a cap
// throws OverCap (exit code 5) with what to ask the person. Usage error: exit code 2.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

export const COSTS_FILE = 'costs.jsonl'
export const CAPS_FILE = 'costs.json'
export const DEFAULT_CAPS = { imageUsd: 0.5, voiceCredits: 1500 }
const KINDS = ['image', 'voice']

export class OverCap extends Error {
  constructor(msg) { super(msg); this.code = 5 }
}
export class Usage extends Error {
  constructor(msg) { super(msg); this.code = 2 }
}

const usd = (v) => `US$ ${v.toFixed(v < 0.1 ? 3 : 2)}`
const thousands = (v) => Math.round(v).toLocaleString('en-US')
const round = (v, places) => Math.round(v * 10 ** places) / 10 ** places

/** This video's caps, with the defaults for what was not set. → { imageUsd, voiceCredits } */
export function readCaps(project) {
  const file = path.join(project, CAPS_FILE)
  if (!fs.existsSync(file)) return { ...DEFAULT_CAPS }
  let saved
  try { saved = JSON.parse(fs.readFileSync(file, 'utf8')) } catch (e) { throw new Usage(`${file} is not valid JSON (${e.message}): fix it or delete it to go back to the default caps`) }
  const caps = { ...DEFAULT_CAPS }
  for (const k of Object.keys(DEFAULT_CAPS)) if (Number.isFinite(saved[k]) && saved[k] >= 0) caps[k] = saved[k]
  return caps
}

/** Saves the caps that came (the others stay as they were). → the caps */
export function writeCaps(project, changes) {
  const caps = { ...readCaps(project) }
  for (const [k, v] of Object.entries(changes)) {
    if (!(k in DEFAULT_CAPS)) throw new Usage(`unknown cap ${k}: the caps are ${Object.keys(DEFAULT_CAPS).join(', ')}`)
    if (!Number.isFinite(v) || v < 0) throw new Usage(`${k} takes a number from 0 up; got ${JSON.stringify(v)}`)
    caps[k] = v
  }
  fs.mkdirSync(project, { recursive: true })
  fs.writeFileSync(path.join(project, CAPS_FILE), `${JSON.stringify(caps, null, 2)}\n`)
  return caps
}

/** Every paid call of this video, oldest first. */
export function readCosts(project) {
  const file = path.join(project, COSTS_FILE)
  if (!fs.existsSync(file)) return []
  return fs.readFileSync(file, 'utf8').split('\n').filter(Boolean).map((line) => JSON.parse(line))
}

/** → { images: { usd, count, capUsd, leftUsd }, voice: { credits, calls, capCredits, leftCredits } } */
export function totals(project) {
  const caps = readCaps(project), costs = readCosts(project)
  const images = costs.filter((c) => c.kind === 'image'), voice = costs.filter((c) => c.kind === 'voice')
  const spentUsd = round(images.reduce((s, c) => s + (c.usd ?? 0), 0), 4)
  const spentCredits = voice.reduce((s, c) => s + (c.credits ?? 0), 0)
  return {
    images: { usd: spentUsd, count: images.reduce((s, c) => s + (c.count ?? 1), 0), capUsd: caps.imageUsd, leftUsd: round(Math.max(0, caps.imageUsd - spentUsd), 4) },
    voice: { credits: spentCredits, calls: voice.length, capCredits: caps.voiceCredits, leftCredits: Math.max(0, caps.voiceCredits - spentCredits) },
  }
}

/** Before a paid call: throws OverCap when what it is about to cost does not fit under this video's cap. */
export function checkCap(project, { kind, usd: nextUsd = 0, credits: nextCredits = 0 }) {
  if (!KINDS.includes(kind)) throw new Usage(`kind is ${KINDS.join(' or ')}; got ${JSON.stringify(kind)}`)
  const t = totals(project)
  if (kind === 'image' && t.images.usd + nextUsd > t.images.capUsd + 1e-9) {
    throw new OverCap(`this video's image cap is ${usd(t.images.capUsd)}: ${usd(t.images.usd)} already spent and this call costs about ${usd(nextUsd)}. `
      + `Ask the person whether to raise it (node costs.mjs cap <project> --image-usd <n>) before going on.`)
  }
  if (kind === 'voice' && t.voice.credits + nextCredits > t.voice.capCredits) {
    throw new OverCap(`this video's voice cap is ${thousands(t.voice.capCredits)} credits: ${thousands(t.voice.credits)} already spent and this call costs about ${thousands(nextCredits)}. `
      + `Ask the person whether to raise it (node costs.mjs cap <project> --voice-credits <n>) before going on.`)
  }
}

/**
 * After a paid call: one line in the notebook. `files` are what the call produced (absolute or relative to the
 * current folder), kept relative to the project. → the line
 */
export function noteCost(project, { kind, provider, model = null, label = null, files = [], usd: spentUsd = null, credits = null, count = null }) {
  if (!KINDS.includes(kind)) throw new Usage(`kind is ${KINDS.join(' or ')}; got ${JSON.stringify(kind)}`)
  const line = {
    at: new Date().toISOString(), kind, provider, model, label,
    files: files.map((f) => path.relative(project, path.resolve(f)).split(path.sep).join('/')),
    ...(spentUsd != null ? { usd: spentUsd } : {}), ...(credits != null ? { credits } : {}), ...(count != null ? { count } : {}),
  }
  fs.mkdirSync(project, { recursive: true })
  fs.appendFileSync(path.join(project, COSTS_FILE), `${JSON.stringify(line)}\n`)
  return line
}

/** The `costs` block of board.json. `accountLeft`: the credits left in the voice account, when known. */
export function boardBlock(project, { accountLeft = null } = {}) {
  const t = totals(project)
  return {
    images: { usd: t.images.usd, capUsd: t.images.capUsd, count: t.images.count },
    voice: { credits: t.voice.credits, capCredits: t.voice.capCredits, ...(accountLeft != null ? { accountLeft } : {}) },
  }
}

function report(project) {
  const t = totals(project), costs = readCosts(project)
  const lines = [
    `images: ${usd(t.images.usd)} of ${usd(t.images.capUsd)} (${t.images.count} generated, ${usd(t.images.leftUsd)} left)`,
    `voice:  ${thousands(t.voice.credits)} of ${thousands(t.voice.capCredits)} credits (${t.voice.calls} calls, ${thousands(t.voice.leftCredits)} left)`,
  ]
  for (const c of costs) {
    const cost = c.usd != null ? usd(c.usd) : c.credits != null ? `${thousands(c.credits)} credits` : 'no cost noted'
    lines.push(`  ${c.at.slice(0, 16).replace('T', ' ')}  ${c.kind}  ${cost}  ${c.label ?? c.model ?? c.provider}`)
  }
  return lines.join('\n')
}

function main(argv) {
  const [command, project, ...rest] = argv
  const option = (name) => { const i = rest.indexOf(`--${name}`); return i >= 0 ? rest[i + 1] : undefined }
  const number = (name) => { const v = option(name); return v === undefined ? undefined : Number(v) }
  if (!['show', 'cap', 'board'].includes(command) || !project) {
    throw new Usage('usage: node costs.mjs show <project> [--json] | cap <project> [--image-usd <n>] [--voice-credits <n>] | board <project> [--account-left <credits>]')
  }
  if (command === 'show') return console.log(rest.includes('--json') ? JSON.stringify({ ...totals(project), costs: readCosts(project) }) : report(project))
  if (command === 'board') return console.log(JSON.stringify(boardBlock(project, { accountLeft: number('account-left') ?? null })))
  const changes = {}
  if (number('image-usd') !== undefined) changes.imageUsd = number('image-usd')
  if (number('voice-credits') !== undefined) changes.voiceCredits = number('voice-credits')
  const caps = Object.keys(changes).length ? writeCaps(project, changes) : readCaps(project)
  console.log(`image cap ${usd(caps.imageUsd)} · voice cap ${thousands(caps.voiceCredits)} credits`)
}

if (process.argv[1] && (() => { try { return fs.realpathSync(process.argv[1]) === fs.realpathSync(fileURLToPath(import.meta.url)) } catch { return false } })()) {
  try { main(process.argv.slice(2)) } catch (e) {
    if (!e.code) throw e
    console.error(e.message)
    process.exit(e.code)
  }
}
