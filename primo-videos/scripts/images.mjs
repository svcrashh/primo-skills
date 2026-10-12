#!/usr/bin/env node
// Generated images for a video, through the OpenAI API: a setting, an object, a scene photo, a backdrop or a texture
// that neither the product's screens nor the brand's own photos have. references/images.md says when, and what never.
// Every paid call checks this video's cap first and writes what it cost to <project>/costs.jsonl (scripts/costs.mjs).
//
//   node images.mjs generate --project <video> --prompt "<text>|@file.txt" [--name scene-02] [--n 3] [--ref <image>]…
//                            [--format 16x9 | --size 2048x1152] [--quality low] [--model <id>] [--out <folder>] [--label "…"]
//   node images.mjs final    --project <video> <chosen option.png> [--add "<what to change>"]
//   node images.mjs batch    --project <video> <batch.json> [--parallel 4]
//   node images.mjs estimate [--format 16x9 | --size WxH] [--quality low] [--n 1] [--refs 0] [--project <video>]
//   node images.mjs estimate --project <video> <batch.json>
//   node images.mjs models                                   the image models this account sees (free)
//   node images.mjs board    --project <video> [<folder>…]   {"<file>": {"model", "usd"}}: board.json's `generated`
//
// The options of a scene come out in `low` (~US$ 0.006 each). `final` redoes the chosen one in `high`, with it as the
// reference: a new picture close to it, not the same one, so it goes back to the person for approval.
// Files go to <project>/media/generated/ (or --out), with images.json beside them: per image, the prompt, model,
// quality, size, references and cost. The key: OPENAI_API_KEY, or a line OPENAI_API_KEY=… in
// ~/.claude/secrets/openai.env. It is never printed. OPENAI_API_BASE swaps the API address (tests use a local one).
// Exit codes: 2 usage, 3 OpenAI not usable now (no key, key refused, no credit: go on without generated images),
// 5 over this video's image cap (ask the person), 1 anything else.
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { Usage, checkCap, noteCost, totals } from './costs.mjs'

export const DEFAULT_MODEL = 'gpt-image-2.5-sunburst'
export const MANIFEST = 'images.json'
const OUT_DIR = path.join('media', 'generated')
const QUALITIES = ['low', 'medium', 'high', 'xhigh', 'max']

// US$ per token (Oct 2026): text in, image in (each reference), image out.
const PRICE = { text: 5e-6, imageIn: 8e-6, out: 30e-6 }
// Calibrated on 25 images paid for with gpt-image-2.5-sunburst at 1024x1536: low US$ 0.0061; high without a
// reference US$ 0.0426–0.043; high with three references US$ 0.067–0.081. Output tokens per megapixel, per quality
// (medium, xhigh and max keep the ratios of the earlier calibration: they were not measured).
const OUT_TOKENS_MPX = { low: 95, medium: 330, high: 870, xhigh: 1790, max: 3580 }
const PROMPT_TOKENS = 300 // ~1,200 characters, when the estimate does not have the prompt
const REF_TOKENS = 1550 // input tokens per reference image

// Short side 1152, long side at the format's shape: always a bit larger than the frame (×1.067), never cut.
export const SIZES = {
  '16x9': { size: '2048x1152', frame: '1920x1080' },
  '19x9': { size: '2432x1152', frame: '2280x1080' },
  '21x9': { size: '2688x1152', frame: '2520x1080' },
  '9x16': { size: '1152x2048', frame: '1080x1920' },
  '4x5': { size: '1152x1440', frame: '1080x1350' },
  '1x1': { size: '1152x1152', frame: '1080x1080' },
}

/** OpenAI cannot be used right now (no key, key refused, no credit). Exit code 3: the video goes on without it. */
export class NoKey extends Error {
  constructor(msg) { super(msg); this.code = 3 }
}
export class ApiError extends Error {
  constructor(msg) { super(msg); this.code = 1 }
}

const round = (v, places = 4) => Math.round(v * 10 ** places) / 10 ** places
const usd = (v) => `US$ ${v.toFixed(v < 0.1 ? 3 : 2)}`
const readText = (file) => { try { return fs.readFileSync(file, 'utf8') } catch { return '' } }
const readJson = (file, fallback) => { try { return JSON.parse(fs.readFileSync(file, 'utf8')) } catch { return fallback } }
const posix = (p) => p.split(path.sep).join('/')
/** Relative to the project when inside it (what board.json takes), absolute otherwise. */
const fromProject = (project, file) => {
  const rel = path.relative(project, path.resolve(file))
  return rel.startsWith('..') || path.isAbsolute(rel) ? path.resolve(file) : posix(rel)
}
const pixels = (size) => String(size).split('x').map(Number)

// ── key and API ──────────────────────────────────────────────────────────────────────────────────────────────────────
const keyFile = () => path.join(os.homedir(), '.claude', 'secrets', 'openai.env')
const shown = (file) => file.replace(os.homedir(), '~')
const apiBase = () => String(process.env.OPENAI_API_BASE || 'https://api.openai.com').replace(/\/+$/, '').replace(/\/v1$/, '')

export function readKey() {
  const fromEnv = String(process.env.OPENAI_API_KEY ?? '').trim()
  if (fromEnv) return fromEnv
  const m = /^\s*(?:export\s+)?OPENAI_API_KEY\s*=\s*(.+?)\s*$/m.exec(readText(keyFile()))
  if (m) return m[1].replace(/^(['"])(.*)\1$/, '$2')
  throw new NoKey(`no OpenAI key: set OPENAI_API_KEY, or put the line OPENAI_API_KEY=… in ${shown(keyFile())} `
    + '(the person pastes it there, never in the chat). Without it the video goes on without generated images: '
    + 'ask the person for a photo, or pick a style that does not need one.')
}

/** Takes the key (and anything shaped like one) out of a message before it is shown. */
function scrub(text, key) {
  let t = String(text ?? '')
  if (key) t = t.split(key).join('[key]')
  return t.replace(/\bsk-[A-Za-z0-9_*.-]{6,}/g, '[key]')
}

async function request(route, { method = 'GET', json, form, ms = 600_000 } = {}) {
  const key = readKey()
  let r
  try {
    r = await fetch(`${apiBase()}/v1/${route}`, {
      method,
      headers: { authorization: `Bearer ${key}`, ...(json ? { 'content-type': 'application/json' } : {}) },
      body: json ? JSON.stringify(json) : form,
      signal: AbortSignal.timeout(ms),
    })
  } catch (e) {
    throw new ApiError(`could not reach the OpenAI API (${scrub(e.cause?.message ?? e.message, key)}): check the connection and try again`)
  }
  const j = await r.json().catch(() => ({}))
  if (r.ok) return j
  const msg = scrub(j?.error?.message ?? `HTTP ${r.status}`, key)
  const code = String(j?.error?.code ?? j?.error?.type ?? '')
  if (r.status === 401) throw new NoKey(`OpenAI refused the key (401: ${msg}). Fix OPENAI_API_KEY or ${shown(keyFile())}; until then the video goes on without generated images`)
  if (/insufficient_quota|billing/i.test(code + msg)) throw new NoKey(`the OpenAI account has no credit (${msg}). Add credit at platform.openai.com/settings/organization/billing; until then the video goes on without generated images`)
  if (/moderation|safety/i.test(code + msg)) throw new ApiError(`OpenAI refused the image by its safety filter (${msg}). Rewrite the prompt without what triggered it; nothing was charged`)
  throw new ApiError(`OpenAI ${r.status}: ${msg}`)
}

// ── size and cost ────────────────────────────────────────────────────────────────────────────────────────────────────
/** --format / --size → the size sent to the model. */
export function sizeFor({ format, size } = {}) {
  if (size) {
    if (!/^\d{2,5}x\d{2,5}$/.test(String(size))) throw new Usage(`--size is WIDTHxHEIGHT, like 2048x1152; got ${JSON.stringify(size)}`)
    return String(size)
  }
  const f = format ?? '16x9'
  if (!SIZES[f]) throw new Usage(`--format is one of ${Object.keys(SIZES).join(', ')}; got ${JSON.stringify(f)}`)
  return SIZES[f].size
}

/** How a picture of `size` sits in the frame of `format` when the scene shows it full screen (object-fit: cover). */
export function framing(size, format) {
  const frame = SIZES[format]?.frame
  if (!frame) return `${size}: no video format given, so no framing to check`
  const [w, h] = pixels(size), [fw, fh] = pixels(frame)
  const scale = Math.max(fw / w, fh / h)
  const seenW = Math.round(fw / scale), seenH = Math.round(fh / scale)
  const pct = `${Math.round(scale * 100)}%`
  if (seenW === w && seenH === h) return `${size} has the shape of the ${format} frame (${frame}): the engine shows it whole at ${pct}, nothing cut`
  const cut = seenW < w ? `${w - seenW} px of width (the sides)` : `${h - seenH} px of height (top and bottom)`
  const soft = scale > 1.1 ? `, enlarged to ${pct}: it will look soft` : ''
  return `${size} in the ${format} frame (${frame}): only the middle ${seenW}x${seenH} shows, ${cut} cut${soft}`
}

/** What a call should cost, before making it. Text in is paid once per call; references and images out, each. */
export function estimate({ size = SIZES['16x9'].size, quality = 'low', n = 1, refs = 0, promptChars = null } = {}) {
  const [w, h] = pixels(size)
  const mpx = (w * h) / 1e6
  const textTokens = promptChars == null ? PROMPT_TOKENS : Math.ceil(promptChars / 4)
  const out = n * mpx * (OUT_TOKENS_MPX[quality] ?? OUT_TOKENS_MPX.high) * PRICE.out
  return round(out + textTokens * PRICE.text + refs * REF_TOKENS * PRICE.imageIn)
}

/** What a call cost, from the `usage` the API answered with. null when it did not answer one. */
export function costFromUsage(u) {
  if (!u) return null
  const d = u.input_tokens_details ?? {}
  const imageIn = d.image_tokens ?? 0
  const textIn = d.text_tokens ?? Math.max(0, (u.input_tokens ?? 0) - imageIn)
  return round(textIn * PRICE.text + imageIn * PRICE.imageIn + (u.output_tokens ?? 0) * PRICE.out)
}

// ── generating ───────────────────────────────────────────────────────────────────────────────────────────────────────
const TYPES = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp' }

async function call({ prompt, refs, model, size, quality, n }) {
  let j
  if (refs.length) {
    const form = new FormData()
    for (const [k, v] of Object.entries({ model, prompt, size, quality, n: String(n) })) form.append(k, v)
    for (const ref of refs) form.append('image[]', new Blob([fs.readFileSync(ref)], { type: TYPES[path.extname(ref).toLowerCase()] ?? 'image/png' }), path.basename(ref))
    j = await request('images/edits', { method: 'POST', form })
  } else {
    j = await request('images/generations', { method: 'POST', json: { model, prompt, size, quality, n } })
  }
  const images = []
  for (const d of j.data ?? []) {
    if (d.b64_json) images.push(Buffer.from(d.b64_json, 'base64'))
    else if (d.url) images.push(Buffer.from(await (await fetch(d.url, { signal: AbortSignal.timeout(120_000) })).arrayBuffer()))
  }
  if (!images.length) throw new ApiError('OpenAI answered without any image: try again, or change the prompt')
  return { images, usage: j.usage ?? null }
}

/** The images.json of a folder: { images: [{ file, name, prompt, model, quality, size, format, refs, usd, costFrom, generated, from?, at }] } */
export function readManifest(dir) {
  return readJson(path.join(dir, MANIFEST), { images: [] })
}

function writeManifest(dir, entries) {
  const m = readManifest(dir)
  for (const e of entries) {
    const i = m.images.findIndex((x) => x.file === e.file)
    if (i >= 0) m.images[i] = e
    else m.images.push(e)
  }
  fs.writeFileSync(path.join(dir, MANIFEST), `${JSON.stringify(m, null, 2)}\n`)
}

const fileNames = (name, count) => (count === 1 ? [`${name}.png`] : Array.from({ length: count }, (_, i) => `${name}-${String.fromCharCode(97 + i)}.png`))

/**
 * One call: checks the cap, generates (or edits from `refs`), writes <out>/<name>.png (<name>-a.png, -b… with n > 1),
 * notes the cost and updates images.json. → { files, usd, costFrom, model, size, quality, format, seconds }
 */
export async function generate({ project, prompt, refs = [], out, name = 'image', n = 1, model = DEFAULT_MODEL, format = null, size = null, quality = 'low', label = null, from = null }) {
  if (!project) throw new Usage('--project <the video folder> is required: the cost goes to its costs.jsonl and counts against its cap')
  if (!String(prompt ?? '').trim()) throw new Usage('--prompt is empty: pass the text, or @file.txt')
  if (!QUALITIES.includes(quality)) throw new Usage(`--quality is one of ${QUALITIES.join(', ')}; got ${JSON.stringify(quality)}`)
  if (!Number.isInteger(n) || n < 1 || n > 10) throw new Usage(`--n is a whole number from 1 to 10; got ${JSON.stringify(n)}`)
  if (!/^[\w.-]+$/.test(name)) throw new Usage(`--name takes letters, digits, ".", "-" and "_" (it becomes the file name); got ${JSON.stringify(name)}`)
  project = path.resolve(project)
  out = path.resolve(project, out ?? OUT_DIR)
  if (!format && !size) format = '16x9'
  const theSize = sizeFor({ format, size })
  const refFiles = refs.map((r) => path.resolve(project, r))
  for (const r of refFiles) if (!fs.existsSync(r)) throw new Usage(`the reference does not exist: ${r}`)
  readKey()
  const expected = estimate({ size: theSize, quality, n, refs: refFiles.length, promptChars: prompt.length })
  checkCap(project, { kind: 'image', usd: expected })

  const t0 = Date.now()
  const { images, usage } = await call({ prompt, refs: refFiles, model, size: theSize, quality, n })
  fs.mkdirSync(out, { recursive: true })
  const files = fileNames(name, images.length).map((f, i) => { fs.writeFileSync(path.join(out, f), images[i]); return path.join(out, f) })
  const real = costFromUsage(usage)
  const spent = real ?? expected
  noteCost(project, { kind: 'image', provider: 'openai', model, label: label ?? name, files, usd: spent, count: files.length })
  const at = new Date().toISOString()
  writeManifest(out, files.map((f) => ({
    file: path.basename(f), name, prompt, model, quality, size: theSize, format: format ?? null,
    refs: refFiles.map((r) => fromProject(project, r)), usd: round(spent / files.length), costFrom: real == null ? 'estimate' : 'tokens',
    generated: true, ...(from ? { from } : {}), at,
  })))
  return { files, usd: spent, costFrom: real == null ? 'estimate' : 'tokens', model, size: theSize, quality, format, seconds: Math.round((Date.now() - t0) / 1000) }
}

/** The person chose an option: redo it in `high` with it as the first reference, beside it, as <name>-final.png. */
export async function final({ project, option, add = null, quality = 'high' }) {
  if (!project) throw new Usage('--project <the video folder> is required')
  if (!option) throw new Usage('final takes the chosen option: node images.mjs final --project <video> <option.png>')
  project = path.resolve(project)
  const file = path.resolve(project, option)
  const entry = readManifest(path.dirname(file)).images.find((e) => e.file === path.basename(file))
  if (!entry) throw new Usage(`${file} is not in the images.json beside it (it was not made by images.mjs): use generate --ref <it> --quality high`)
  const prompt = [entry.prompt, add, 'Keep the composition, the framing, the palette and the subject of the first reference image; render it in full detail.'].filter(Boolean).join('\n\n')
  return generate({
    project, prompt, refs: [file, ...entry.refs.map((r) => path.resolve(project, r))], out: path.dirname(file),
    name: `${entry.name}-final`, model: entry.model, format: entry.format, size: entry.size, quality,
    label: `${entry.name} final`, from: entry.file,
  })
}

const batchCalls = (cfg) => cfg.items.map((it) => ({
  name: it.name, prompt: [it.prompt, cfg.common].filter(Boolean).join('\n\n'), refs: it.refs ?? cfg.refs ?? [], n: it.n ?? 1,
  model: it.model ?? cfg.model ?? DEFAULT_MODEL, format: it.format ?? cfg.format ?? null, size: it.size ?? cfg.size ?? null,
  quality: it.quality ?? cfg.quality ?? 'low', label: `${cfg.label ?? 'batch'} · ${it.name}`,
}))

export function readBatch(file) {
  const cfg = readJson(path.resolve(file ?? ''), null)
  if (!cfg || !Array.isArray(cfg.items) || !cfg.items.length || cfg.items.some((it) => !it?.name || !it?.prompt)) {
    throw new Usage('the batch is a JSON file like {"out"?, "format"?, "quality"?, "common"?, "items": [{"name", "prompt", "n"?, "refs"?}]}')
  }
  return cfg
}

export const estimateBatch = (cfg) => round(batchCalls(cfg).reduce((s, c) => s + estimate({ size: sizeFor(c), quality: c.quality, n: c.n, refs: c.refs.length, promptChars: c.prompt.length }), 0))

/** Several calls, `parallel` at a time. The whole batch is checked against the cap before the first call. */
export async function batch(cfg, { project, parallel = 4, log = () => {} }) {
  if (!project) throw new Usage('--project <the video folder> is required')
  project = path.resolve(project)
  readKey()
  checkCap(project, { kind: 'image', usd: estimateBatch(cfg) })
  const queue = batchCalls(cfg)
  const done = [], failed = []
  async function worker() {
    for (let c = queue.shift(); c; c = queue.shift()) {
      try {
        const r = await generate({ project, out: cfg.out, ...c })
        done.push({ name: c.name, ...r })
        log(`${c.name}: ${r.files.map((f) => fromProject(project, f)).join(', ')} · ${usd(r.usd)}`)
      } catch (e) {
        if (e instanceof NoKey || e.code === 5) throw e
        failed.push({ name: c.name, error: e.message })
        log(`${c.name}: FAILED · ${e.message}`)
      }
    }
  }
  await Promise.all(Array.from({ length: Math.max(1, Math.min(parallel, queue.length)) }, worker))
  return { done, failed, usd: round(done.reduce((s, d) => s + d.usd, 0)) }
}

/** The image models this account sees (a free call). */
export async function models() {
  const j = await request('models', { ms: 30_000 })
  return (j.data ?? []).map((m) => m.id).filter((id) => /image|dall-e/i.test(id)).sort()
}

/** board.json's `generated` for a file made here: { model, usd }, or null when it was not generated. */
export function generatedTag(file) {
  const e = readManifest(path.dirname(path.resolve(file))).images.find((x) => x.file === path.basename(file))
  return e ? { model: e.model, usd: e.usd } : null
}

/** { "<file relative to the project>": { model, usd } } for every generated image in the folders. */
export function boardTags(project, dirs = [OUT_DIR]) {
  project = path.resolve(project)
  const tags = {}
  for (const d of dirs) {
    const dir = path.resolve(project, d)
    for (const e of readManifest(dir).images) tags[fromProject(project, path.join(dir, e.file))] = { model: e.model, usd: e.usd }
  }
  return tags
}

// ── command line ─────────────────────────────────────────────────────────────────────────────────────────────────────
function parse(argv) {
  const pos = [], o = { ref: [] }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--ref') o.ref.push(argv[++i])
    else if (a.startsWith('--')) o[a.slice(2)] = argv[i + 1] != null && !argv[i + 1].startsWith('--') ? argv[++i] : true
    else pos.push(a)
  }
  return { pos, o }
}
const promptArg = (s) => {
  if (typeof s !== 'string') return ''
  if (!s.startsWith('@')) return s
  const file = path.resolve(s.slice(1))
  if (!fs.existsSync(file)) throw new Usage(`the prompt file does not exist: ${file}`)
  return readText(file)
}
const int = (v, fallback) => (v === undefined ? fallback : Number(v))

function report(project, r) {
  const lines = r.files.map((f) => fromProject(project, f))
  lines.push(`${usd(r.usd)} (${r.costFrom === 'tokens' ? 'from the tokens' : 'estimated: the API did not say'}) · ${r.files.length} image${r.files.length > 1 ? 's' : ''} · ${r.model} ${r.size} ${r.quality} · ${r.seconds} s`)
  if (r.format) lines.push(framing(r.size, r.format))
  const t = totals(project).images
  lines.push(`images in this video: ${usd(t.usd)} of ${usd(t.capUsd)}`)
  return lines.join('\n')
}

const usage = () => readText(fileURLToPath(import.meta.url)).split('\n').slice(5, 13).map((l) => l.replace(/^\/\/ ?/, '')).join('\n')

async function main(argv) {
  const [command, ...rest] = argv
  const { pos, o } = parse(rest)
  const project = typeof o.project === 'string' ? path.resolve(o.project) : null
  if (command === 'generate') {
    const r = await generate({ project, prompt: promptArg(o.prompt), refs: o.ref, out: o.out, name: o.name, n: int(o.n, 1), model: o.model, format: o.format, size: o.size, quality: o.quality, label: o.label })
    console.log(report(project, r))
    if (r.quality === 'low' || r.quality === 'medium') console.log('show them on the board, marked as generated, with the cost; the one the person picks: node images.mjs final --project <video> <it>')
    return
  }
  if (command === 'final') {
    const r = await final({ project, option: pos[0], add: typeof o.add === 'string' ? o.add : null, quality: o.quality })
    console.log(report(project, r))
    console.log('a new picture close to the chosen one, not the same one: show it on the board again and wait for the ok before it goes into the video')
    return
  }
  if (command === 'batch') {
    const cfg = readBatch(pos[0])
    const r = await batch(cfg, { project, parallel: int(o.parallel, 4), log: (l) => console.log(l) })
    console.log(`${r.done.length} made${r.failed.length ? `, ${r.failed.length} failed` : ''} · ${usd(r.usd)} · ${fromProject(project, path.join(path.resolve(project, cfg.out ?? OUT_DIR), MANIFEST))}`)
    if (r.failed.length) process.exitCode = 1
    return
  }
  if (command === 'estimate') {
    let v, what
    if (pos[0]) {
      const cfg = readBatch(pos[0])
      v = estimateBatch(cfg)
      what = `${batchCalls(cfg).reduce((s, c) => s + c.n, 0)} images in ${cfg.items.length} calls`
    } else {
      const size = sizeFor({ format: o.format, size: o.size }), quality = o.quality ?? 'low', n = int(o.n, 1)
      if (!QUALITIES.includes(quality)) throw new Usage(`--quality is one of ${QUALITIES.join(', ')}`)
      v = estimate({ size, quality, n, refs: int(o.refs, 0), promptChars: typeof o.prompt === 'string' ? promptArg(o.prompt).length : null })
      what = `${n} image${n > 1 ? 's' : ''} · ${size} ${quality}${o.refs ? ` · ${o.refs} reference${Number(o.refs) > 1 ? 's' : ''}` : ''}`
    }
    console.log(`~${usd(v)} · ${what}`)
    if (project) {
      const t = totals(project).images
      console.log(t.usd + v > t.capUsd + 1e-9
        ? `over this video's cap: ${usd(t.usd)} of ${usd(t.capUsd)} already spent. Ask the person whether to raise it (node costs.mjs cap <project> --image-usd <n>)`
        : `fits under this video's cap: ${usd(t.usd)} of ${usd(t.capUsd)} spent`)
    }
    return
  }
  if (command === 'models') {
    const ids = await models()
    if (!ids.length) return console.log('this account sees no image model')
    console.log(ids.map((id) => (id === DEFAULT_MODEL ? `${id} (default)` : id)).join('\n'))
    if (!ids.includes(DEFAULT_MODEL)) console.log(`the default ${DEFAULT_MODEL} is not in this account's list: pass --model <one above>`)
    return
  }
  if (command === 'board') {
    if (!project) throw new Usage('board takes --project <the video folder>')
    return console.log(JSON.stringify(boardTags(project, pos.length ? pos : undefined), null, 2))
  }
  throw new Usage(`usage:\n${usage()}`)
}

// real path on both sides: the skill is installed through a symlink, and then argv[1] does not match import.meta.url
if (process.argv[1] && (() => { try { return fs.realpathSync(process.argv[1]) === fs.realpathSync(fileURLToPath(import.meta.url)) } catch { return false } })()) {
  main(process.argv.slice(2)).catch((e) => {
    if (!e.code || typeof e.code !== 'number') throw e
    console.error(e.message)
    process.exit(e.code)
  })
}
