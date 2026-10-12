// The review board's local server: one project, 127.0.0.1 only, every request under the random token in the URL.
// It reads <project>/board/board.json, serves the project's pictures, videos and audio read-only, and turns each click,
// message and pasted picture into a line of events.jsonl plus the matching change in board.json. What the skill says
// back (`board.mjs say`, `status`) arrives through the same events.jsonl, and whether it is listening through the
// heartbeat that `board.mjs wait` leaves in listening.json.
import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { fileURLToPath } from 'node:url'
import { renderDocument } from './render.mjs'
import {
  ActionError, MEDIA_EXT, appendEvent, applyAction, boardFile, eventsFile, extOf, listeningFile, readBoard, readEvents,
  referencesDir, resolveInside, validateBoard, withLock, writeBoard,
} from './data.mjs'

const HERE = path.dirname(fileURLToPath(import.meta.url))
// The board has no brand of its own. A project can show its logo by putting a `board/logo.png` in its folder.
const KIT = null
export const UPLOAD_LIMIT = 200 * 1024 * 1024
// `board.mjs wait` beats every 2 s while it blocks. When it leaves, it says for how long (`grace`) the skill still
// counts as there: acting on what it was handed, or about to wait again after its time ran out.
const WAITING_FOR_MS = 8000, ACTING_FOR_MS = 10 * 60 * 1000

/** Who is on the other side: "waiting" (listening for the next click), "acting" (it just took one), or "away". */
export function listenerState(beat, now = Date.now()) {
  if (!beat || typeof beat.at !== 'number') return 'away'
  const fresh = now - beat.at < (beat.grace ?? (beat.waiting ? WAITING_FOR_MS : ACTING_FOR_MS))
  return !fresh ? 'away' : beat.waiting ? 'waiting' : 'acting'
}

const MIME = {
  png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp', gif: 'image/gif',
  mp4: 'video/mp4', mov: 'video/quicktime', webm: 'video/webm',
  mp3: 'audio/mpeg', wav: 'audio/wav', m4a: 'audio/mp4',
}
const APP = { 'page.css': 'text/css; charset=utf-8', 'page.mjs': 'text/javascript; charset=utf-8', 'render.mjs': 'text/javascript; charset=utf-8' }
const KIT_FILES = {
  'logo.png': ['logo.png', 'image/png'],
}
const HEADERS = {
  'Cache-Control': 'no-store',
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'no-referrer',
  'Cross-Origin-Resource-Policy': 'same-origin',
}
const PAGE_POLICY = "default-src 'self'; img-src 'self' blob:; media-src 'self' blob:; style-src 'self' 'unsafe-inline'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'"
const KINDS = 'PNG, JPG, WEBP, GIF, MP4, MOV or WEBM'

/** A file name safe to write: no folders, no dots but the extension's, plain letters only. Null when the type is not allowed. */
export function sanitizeName(raw) {
  const base = String(raw ?? '').split(/[\\/]/).pop().normalize('NFKD').replace(/[̀-ͯ]/g, '')
  const dot = base.lastIndexOf('.')
  const ext = dot >= 0 ? base.slice(dot + 1).toLowerCase() : ''
  if (!MEDIA_EXT.includes(ext)) return null
  let stem = base.slice(0, dot).replace(/[^A-Za-z0-9_-]+/g, '-').replace(/-{2,}/g, '-').replace(/^[-_]+|[-_]+$/g, '').slice(0, 80)
  if (!stem || /^(con|prn|aux|nul|com\d|lpt\d)$/i.test(stem)) stem = `reference${stem ? `-${stem}` : ''}`
  return `${stem}.${ext}`
}

/** Whether the first bytes of a file are what its extension says. */
export function looksLike(ext, head) {
  if (head.length < 12) return false
  const text = (from, to) => head.toString('latin1', from, to)
  switch (ext) {
    case 'png': return head.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
    case 'jpg': case 'jpeg': return head[0] === 0xff && head[1] === 0xd8 && head[2] === 0xff
    case 'gif': return text(0, 4) === 'GIF8'
    case 'webp': return text(0, 4) === 'RIFF' && text(8, 12) === 'WEBP'
    case 'webm': return head.readUInt32BE(0) === 0x1a45dfa3
    case 'mp4': case 'mov': return ['ftyp', 'moov', 'mdat', 'wide', 'free', 'skip', 'pnot'].includes(text(4, 8))
    default: return false
  }
}

function mediaPaths(board) {
  const paths = []
  for (const c of board.choices || []) for (const o of c.options || []) paths.push(o.image, o.audio)
  for (const s of board.scenes || []) paths.push(s.still, s.video, s.narration?.audio)
  for (const p of board.pieces || []) paths.push(p.image)
  for (const r of board.references || []) paths.push(r.file)
  return [...new Set(paths.filter((p) => typeof p === 'string'))]
}

/**
 * Starts the board for one project on a free port of 127.0.0.1.
 * Returns { url, host, port, token, clients(), lastSeen(), close() }.
 */
export async function startBoardServer({ project, token = crypto.randomBytes(24).toString('base64url'), uploadLimit = UPLOAD_LIMIT, kit = KIT, poll = 400 }) {
  const root = path.resolve(project)
  const logoDir = kit || path.join(root, 'board')
  const hasLogo = fs.existsSync(path.join(logoDir, KIT_FILES['logo.png'][0]))
  const clients = new Set()
  let port = 0, rev = 0, lastSeen = Date.now()
  let good = null, problems = [], versions = {}, boardStamp = null, signature = ''
  let events = [], eventsStamp = null, listener = 'away'
  const stampOf = (f) => { const st = fs.statSync(f, { throwIfNoEntry: false }); return st ? `${st.mtimeMs}:${st.size}` : '' }
  const agent = `node "${path.resolve(HERE, '..', 'board.mjs')}" agent "${root}" --terminal`

  function reload() {
    let board = null
    try { board = readBoard(root) } catch (e) { problems = [e.message]; return }
    problems = board === null ? [`${boardFile(root)} is missing`] : validateBoard(board)
    if (!problems.length) good = board
  }

  // board.json and every picture it names are watched by their date: a still rewritten at the same path shows up too.
  function tick() {
    const stamp = stampOf(boardFile(root)), said = stampOf(eventsFile(root))
    if (stamp !== boardStamp) { boardStamp = stamp; reload() }
    if (said !== eventsStamp) { eventsStamp = said; events = readEvents(root) }
    let beat = null
    try { beat = JSON.parse(fs.readFileSync(listeningFile(root), 'utf8')) } catch { /* nobody has listened yet */ }
    listener = listenerState(beat)
    const seen = {}
    for (const p of good ? mediaPaths(good) : []) {
      const abs = resolveInside(root, p), s = abs && fs.statSync(abs, { throwIfNoEntry: false })
      if (s?.isFile()) seen[p] = Math.round(s.mtimeMs)
    }
    const now = JSON.stringify([stamp, said, listener, seen, problems])
    if (now === signature) return
    signature = now
    versions = seen
    rev++
    for (const res of clients) res.write(`data: ${rev}\n\n`)
  }

  const view = () => ({
    board: good || { title: 'No board yet' }, versions, rev, logo: hasLogo, problems, events, listener, agent,
    uploadLimitMb: Math.max(1, Math.floor(uploadLimit / (1024 * 1024))),
  })

  const send = (res, status, type, body, extra = {}) => {
    res.writeHead(status, { ...HEADERS, 'Content-Type': type, 'Content-Length': Buffer.byteLength(body), ...extra })
    res.end(body)
  }
  const json = (res, status, data) => send(res, status, 'application/json; charset=utf-8', JSON.stringify(data))
  const plain = (res, status, text) => send(res, status, 'text/plain; charset=utf-8', text)

  function sendFile(req, res, abs, type, extra = {}) {
    const stat = abs && fs.statSync(abs, { throwIfNoEntry: false })
    if (!stat?.isFile()) return plain(res, 404, 'Not found')
    const head = { ...HEADERS, 'Content-Type': type, 'Accept-Ranges': 'bytes', ...extra }
    const range = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range || '')
    let start = 0, end = stat.size - 1, status = 200
    if (range && (range[1] || range[2])) {
      if (range[1] === '') start = Math.max(0, stat.size - Number(range[2]))
      else { start = Number(range[1]); if (range[2] !== '') end = Math.min(Number(range[2]), end) }
      if (start > end) { res.writeHead(416, { ...head, 'Content-Range': `bytes */${stat.size}` }); return res.end() }
      status = 206
      head['Content-Range'] = `bytes ${start}-${end}/${stat.size}`
    }
    res.writeHead(status, { ...head, 'Content-Length': stat.size ? end - start + 1 : 0 })
    if (!stat.size) return res.end()
    fs.createReadStream(abs, { start, end }).on('error', () => res.destroy()).pipe(res)
  }

  function readJson(req, limit = 64 * 1024) {
    return new Promise((resolve, reject) => {
      const chunks = []
      let size = 0
      req.on('data', (c) => {
        size += c.length
        if (size > limit) { reject(new ActionError(413, 'the request is too large')); req.destroy() } else chunks.push(c)
      })
      req.on('end', () => { try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8'))) } catch { reject(new ActionError(400, 'the request is not valid JSON')) } })
      req.on('error', reject)
    })
  }

  // One change to the board and its event, as one step: nobody else writes in between.
  function record(action) {
    const event = withLock(root, () => {
      const board = readBoard(root)
      if (board === null || validateBoard(board).length) throw new ActionError(409, 'board.json has a problem right now, so nothing was saved. Try again in a moment.')
      const result = applyAction(board, action)
      if (result.board !== board) writeBoard(root, result.board)
      return appendEvent(root, result.event)
    })
    tick()
    return event
  }

  async function act(req, res) {
    if (!/^application\/json\b/.test(req.headers['content-type'] || '')) throw new ActionError(415, 'send JSON')
    const action = await readJson(req)
    if (action?.type === 'reference') throw new ActionError(400, 'a reference arrives as a file, through the upload')
    json(res, 200, { event: record(action), view: view() })
  }

  function upload(req, res, query) {
    const params = new URLSearchParams(query), asked = params.get('name') || ''
    const scene = params.get('scene') || undefined
    const shown = asked.split(/[\\/]/).pop().slice(0, 120) || 'That file'
    const name = sanitizeName(asked)
    const refuse = (status, error) => { res.setHeader('Connection', 'close'); json(res, status, { error }); req.resume() }
    if (!name) return refuse(415, `“${shown}” is not an image or a video I can show here. Use ${KINDS}.`)
    const tooBig = `“${shown}” is larger than ${view().uploadLimitMb} MB. Send a shorter or smaller version.`
    if (Number(req.headers['content-length']) > uploadLimit) return refuse(413, tooBig)

    const dir = referencesDir(root)
    fs.mkdirSync(dir, { recursive: true })
    const tmp = path.join(dir, `.upload-${crypto.randomBytes(8).toString('hex')}`)
    const out = fs.createWriteStream(tmp, { flags: 'wx' })
    let size = 0, done = false
    // The half-written file goes away before the answer does, and only once the stream let go of it.
    const fail = (status, error) => {
      if (done) return
      done = true
      req.unpipe(out)
      const clear = () => { fs.rmSync(tmp, { force: true }); refuse(status, error) }
      if (out.closed) clear(); else { out.once('close', clear); out.destroy() }
    }
    req.on('data', (c) => { size += c.length; if (size > uploadLimit) fail(413, tooBig) })
    req.on('error', () => fail(400, `“${shown}” did not arrive whole. Try again.`))
    req.on('close', () => { if (!req.complete) fail(400, `“${shown}” did not arrive whole. Try again.`) })
    out.on('error', () => fail(500, `Could not save “${shown}” on this computer. Check the free space and try again.`))
    // On close, not on finish: the file is renamed only after the stream let go of it (Windows refuses otherwise).
    out.on('close', () => {
      if (done) return
      const head = Buffer.alloc(16), fd = fs.openSync(tmp, 'r')
      const got = fs.readSync(fd, head, 0, 16, 0)
      fs.closeSync(fd)
      if (!looksLike(extOf(name), head.subarray(0, got))) return fail(415, `“${shown}” does not open as an image or a video. Export it again as ${KINDS}.`)
      done = true
      let file = name, event
      for (let n = 2; fs.existsSync(path.join(dir, file)); n++) file = name.replace(/(\.[a-z0-9]+)$/, `-${n}$1`)
      try {
        fs.renameSync(tmp, path.join(dir, file))
        event = record({ type: 'reference', file: `board/references/${file}`, scene })
      } catch (e) {
        // not on the board, so not on disk either
        fs.rmSync(tmp, { force: true })
        fs.rmSync(path.join(dir, file), { force: true })
        return json(res, e.status || 500, { error: e instanceof ActionError ? e.message : `Could not save “${shown}”. Try again.` })
      }
      json(res, 200, { event, view: view() })
    })
    req.pipe(out)
  }

  function stream(req, res) {
    res.writeHead(200, { ...HEADERS, 'Content-Type': 'text/event-stream; charset=utf-8', Connection: 'keep-alive' })
    res.write(`retry: 1500\ndata: ${rev}\n\n`)
    clients.add(res)
    res.on('error', () => clients.delete(res))
    req.on('close', () => clients.delete(res))
  }

  async function handle(req, res) {
    lastSeen = Date.now()
    const host = req.headers.host
    const local = host === `127.0.0.1:${port}` || host === `localhost:${port}`
    const [rawPath, query = ''] = req.url.split('?')
    const given = rawPath.split('/')[1] || ''
    const known = given.length === token.length && crypto.timingSafeEqual(Buffer.from(given), Buffer.from(token))
    if (!local || !known) return plain(res, 403, 'Forbidden')
    if (rawPath === `/${token}`) { res.writeHead(302, { ...HEADERS, Location: `/${token}/` }); return res.end() }

    let rest
    try { rest = decodeURIComponent(rawPath.slice(token.length + 2)) } catch { return plain(res, 400, 'Bad request') }

    if (req.method === 'POST') {
      if (req.headers.origin && req.headers.origin !== `http://${host}`) return plain(res, 403, 'Forbidden')
      if (rest === 'api/act') return act(req, res)
      if (rest === 'api/upload') return upload(req, res, query)
      return plain(res, 404, 'Not found')
    }
    if (req.method !== 'GET') return plain(res, 405, 'Method not allowed')

    if (rest === '') return send(res, 200, 'text/html; charset=utf-8', renderDocument(view()), { 'Content-Security-Policy': PAGE_POLICY })
    if (rest === 'api/board') return json(res, 200, view())
    if (rest === 'api/stream') return stream(req, res)
    if (rest === 'api/ping') return json(res, 200, { ok: true, pid: process.pid, project: root })
    if (rest.startsWith('app/')) {
      const name = rest.slice(4)
      return Object.hasOwn(APP, name) ? sendFile(req, res, path.join(HERE, name), APP[name]) : plain(res, 404, 'Not found')
    }
    if (rest.startsWith('kit/')) {
      const entry = Object.hasOwn(KIT_FILES, rest.slice(4)) ? KIT_FILES[rest.slice(4)] : null
      return entry ? sendFile(req, res, path.join(logoDir, entry[0]), entry[1], { 'Cache-Control': 'private, max-age=3600' }) : plain(res, 404, 'Not found')
    }
    if (rest.startsWith('files/')) {
      const rel = rest.slice(6), type = MIME[extOf(rel)]
      if (!type) return plain(res, 404, 'Not found')
      return sendFile(req, res, resolveInside(root, rel), type, { 'Content-Security-Policy': "default-src 'none'; sandbox" })
    }
    return plain(res, 404, 'Not found')
  }

  const server = http.createServer((req, res) => {
    handle(req, res).catch((e) => {
      if (res.headersSent) return res.destroy()
      if (e instanceof ActionError) json(res, e.status, { error: e.message }); else { console.error(e); plain(res, 500, 'Server error') }
    })
  })
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve) })
  port = server.address().port
  tick()
  const watching = setInterval(() => { try { tick() } catch (e) { console.error(e) } }, poll)
  const beating = setInterval(() => { for (const res of clients) res.write(': still here\n\n') }, 25000)

  return {
    port, token,
    host: server.address().address,
    url: `http://127.0.0.1:${port}/${token}/`,
    clients: () => clients.size,
    lastSeen: () => lastSeen,
    close() {
      clearInterval(watching)
      clearInterval(beating)
      for (const res of clients) res.destroy()
      return new Promise((resolve) => { server.close(() => resolve()); server.closeAllConnections?.() })
    },
  }
}
