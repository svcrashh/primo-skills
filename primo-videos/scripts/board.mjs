#!/usr/bin/env node
// The review board: a local page that goes through the video one scene at a time. The person sees each still before
// it is animated, picks between options, pastes a better picture, and talks to the skill in a thread per scene. With a
// voice-over, they also approve the script before any voice is recorded, pick the voice by ear and listen to each take;
// and the page shows what the video spent. The assistant writes the board, hears each click with `wait` and answers with `say`.
//   node board.mjs set    <project> <board.json | - | '{…}'>        replace the board (validated; the files must exist)
//   node board.mjs patch  <project> <patch.json | - | '{…}'>        partial update: scenes and choices by id, references by file
//   node board.mjs open   <project> [--no-open]                     start (or reuse) the server, open the browser, print the URL
//   node board.mjs wait   <project> [--timeout <s>] [--since <n>]   block until the person does something new and print it,
//                                                                   one JSON line per event; exit 2 when the time runs out
//   node board.mjs say    <project> [--scene <id>] "<text>"         a message from the skill, in that scene's thread (or the general one)
//   node board.mjs status <project> [--scene <id>] working|idle ["<text>"]   "working…" on the page while the skill works
//   node board.mjs agent  <project> [--terminal] [--dry-run]        the prompt and the loop for whoever serves the board;
//                                                                   --terminal opens a terminal with claude on it (Terminal.app
//                                                                   on macOS, Windows Terminal on Windows)
//   node board.mjs events <project> [--since <n>]                   list the events, one JSON line each
//   node board.mjs stop   <project>
// Everything lives in <project>/board/: board.json (the data), events.jsonl (what the person did and what the skill
// said), references/ (what the person dropped or pasted), server.json (pid, port, token), seen.json (the last event
// `wait` handed over), listening.json (the heartbeat of `wait`), server.log.
// The format and the loop: recipes/board.md.
import fs from 'node:fs'
import http from 'node:http'
import path from 'node:path'
import { spawn, spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import {
  ActionError, appendEvent, boardDir, listeningFile, patchBoard, readBoard, readEvents, skillEvent, validateBoard, withLock, writeBoard,
} from './board/data.mjs'
import { acharClaude as findClaude, ambienteLimpo as cleanEnv, comoRodar as howToRun } from './critic/call.mjs'

const USAGE = `usage: node board.mjs <command> <project folder>
  set    <project> <board.json | - | '{…}'>        replace the board
  patch  <project> <patch.json | - | '{…}'>        partial update
  open   <project> [--no-open]                     start the board and print its URL
  wait   <project> [--timeout <s>] [--since <n>]   block until the person does something new
  say    <project> [--scene <id>] "<text>"         answer on the page
  status <project> [--scene <id>] working|idle ["<text>"]
  agent  <project> [--terminal] [--dry-run]        the prompt and the loop for whoever serves the board
  events <project> [--since <n>]                   list the events
  stop   <project>`
const BEAT_MS = 2000
// After `wait` hands something over, the page keeps saying "connected" this long while the skill acts on it.
const ACTING_MS = 10 * 60 * 1000, RETRY_MS = 2 * 60 * 1000
const TERMINAL_APPS = ['/System/Applications/Utilities/Terminal.app', '/Applications/Utilities/Terminal.app']
const IDLE_MS = 12 * 60 * 60 * 1000

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
const serverFile = (project) => path.join(boardDir(project), 'server.json')
const seenFile = (project) => path.join(boardDir(project), 'seen.json')
const readJsonFile = (file) => { try { return JSON.parse(fs.readFileSync(file, 'utf8')) } catch { return null } }

class Failure extends Error {
  constructor(message, code = 1) { super(message); this.code = code }
}

export function readArgs(argv) {
  const args = { _: [] }
  const numbers = new Set(['timeout', 'since']), texts = new Set(['scene'])
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a.startsWith('--') && a.length > 2) {
      const name = a.slice(2)
      if (texts.has(name)) {
        if (argv[i + 1] === undefined) throw new Failure(`--${name} needs a value`)
        args[name] = argv[++i]
      } else if (numbers.has(name)) {
        const value = Number(argv[++i])
        if (!Number.isFinite(value) || value < 0) throw new Failure(`--${name} needs a number`)
        args[name] = value
      } else args[name] = true
    } else args._.push(a)
  }
  return args
}

function projectOf(args) {
  const given = args._[1]
  if (!given) throw new Failure(USAGE)
  const project = path.resolve(given)
  if (!fs.statSync(project, { throwIfNoEntry: false })?.isDirectory()) throw new Failure(`project folder not found: ${project}`)
  return project
}

function readInput(source, what) {
  if (!source) throw new Failure(`${what}: pass a JSON file, "-" for stdin, or the JSON itself`)
  const raw = source === '-' ? fs.readFileSync(0, 'utf8') : source.trimStart().startsWith('{') ? source : fs.readFileSync(path.resolve(source), 'utf8')
  try { return JSON.parse(raw) } catch (e) { throw new Failure(`${what} is not valid JSON: ${e.message}`) }
}

function checked(project, board) {
  const problems = validateBoard(board, { root: project })
  if (problems.length) throw new Failure(`the board has ${problems.length === 1 ? 'a problem' : `${problems.length} problems`}, nothing was written:\n${problems.map((p) => `  - ${p}`).join('\n')}`)
  return board
}

const many = (n, one, more = `${one}s`) => `${n} ${n === 1 ? one : more}`
const summary = (board) => {
  const open = (board.choices || []).filter((c) => c.chosen === undefined).length
  return `${many((board.scenes || []).length, 'scene')}, ${many(open, 'open choice')}, ${many((board.references || []).length, 'reference')}`
}

function set(project, source) {
  const board = readInput(source, 'the board')
  withLock(project, () => {
    // What the person dropped stays, unless the new board says otherwise.
    const kept = board.references === undefined ? readJsonFile(path.join(boardDir(project), 'board.json'))?.references : null
    if (Array.isArray(kept) && kept.length) {
      const ids = new Set((Array.isArray(board.scenes) ? board.scenes : []).map((s) => s?.id))
      board.references = kept.map(({ scene, ...rest }) => (ids.has(scene) ? { ...rest, scene } : rest))
    }
    writeBoard(project, checked(project, board))
  })
  console.log(`board written: ${summary(board)}`)
}

function patch(project, source) {
  const change = readInput(source, 'the patch')
  const board = withLock(project, () => {
    const current = readBoard(project)
    if (current === null) throw new Failure('there is no board yet: write it first with `board.mjs set <project> <board.json>`')
    let next
    try { next = patchBoard(current, change) } catch (e) { throw new Failure(e.message) }
    writeBoard(project, checked(project, next))
    return next
  })
  console.log(`board updated: ${summary(board)}`)
}

// Asks the server who it is. Always 127.0.0.1, whatever server.json says.
function ping(info) {
  return new Promise((resolve) => {
    const req = http.get({ host: '127.0.0.1', port: info.port, path: `/${info.token}/api/ping`, agent: false, timeout: 1500 }, (res) => {
      let body = ''
      res.setEncoding('utf8')
      res.on('data', (c) => { body += c })
      res.on('end', () => { try { resolve(res.statusCode === 200 ? JSON.parse(body) : null) } catch { resolve(null) } })
    })
    req.on('timeout', () => req.destroy())
    req.on('error', () => resolve(null))
  })
}

/** The server of this project, if one is answering: { pid, port, token, url }. */
async function running(project) {
  const info = readJsonFile(serverFile(project))
  if (!Number.isInteger(info?.port) || typeof info.token !== 'string') return null
  const who = await ping(info)
  return who?.ok && who.pid === info.pid && who.project === project ? { ...info, url: `http://127.0.0.1:${info.port}/${info.token}/` } : null
}

function openBrowser(url) {
  const [cmd, args] = process.platform === 'darwin' ? ['open', [url]] : process.platform === 'win32' ? ['cmd', ['/c', 'start', '', url]] : ['xdg-open', [url]]
  const notice = () => console.error(`couldn't open the browser myself: open ${url}`)
  try { spawn(cmd, args, { detached: true, stdio: 'ignore' }).on('error', notice).unref() } catch { notice() }
}

async function open(project, args) {
  const board = readBoard(project)
  if (board === null) throw new Failure('there is no board yet: write it first with `board.mjs set <project> <board.json>`')
  checked(project, board)

  let info = await running(project)
  if (!info) {
    fs.rmSync(serverFile(project), { force: true })
    const logFile = path.join(boardDir(project), 'server.log'), log = fs.openSync(logFile, 'a')
    const child = spawn(process.execPath, [fileURLToPath(import.meta.url), 'serve', project], { detached: true, stdio: ['ignore', log, log], windowsHide: true })
    let gone = false
    child.on('exit', () => { gone = true })
    child.unref()
    fs.closeSync(log)
    for (let waited = 0; !info && !gone && waited < 10000; waited += 100) { await sleep(100); info = await running(project) }
    if (!info) throw new Failure(`the board did not start. Its log: ${logFile}`)
  }
  console.log(info.url)
  if (!args['no-open']) openBrowser(info.url)
}

async function serve(project) {
  const { startBoardServer } = await import('./board/server.mjs')
  const server = await startBoardServer({ project })
  const file = serverFile(project)
  fs.writeFileSync(file, JSON.stringify({ pid: process.pid, port: server.port, token: server.token, url: server.url, startedAt: new Date().toISOString() }, null, 2) + '\n', { mode: 0o600 })
  const shutdown = async () => {
    if (readJsonFile(file)?.pid === process.pid) fs.rmSync(file, { force: true })
    await server.close()
    process.exit(0)
  }
  process.on('SIGTERM', shutdown)
  process.on('SIGINT', shutdown)
  // Nobody stopped it: it leaves on its own once no page is open and nothing was asked for half a day, or the project is gone.
  setInterval(() => {
    const idle = !server.clients() && Date.now() - server.lastSeen() > IDLE_MS
    if (idle || readJsonFile(file)?.pid !== process.pid) shutdown()
  }, 60000)
}

async function stop(project) {
  const info = await running(project)
  if (!info) {
    fs.rmSync(serverFile(project), { force: true })
    return console.log('no board is open for this project')
  }
  try { process.kill(info.pid, 'SIGTERM') } catch { /* already gone */ }
  for (let waited = 0; waited < 5000 && await running(project); waited += 100) await sleep(100)
  fs.rmSync(serverFile(project), { force: true })
  console.log('board stopped')
}

// The page says "Skill connected" from this: a beat while `wait` blocks, and a last word when it leaves.
function beat(project, waiting, grace) {
  try { fs.writeFileSync(listeningFile(project), JSON.stringify({ at: Date.now(), waiting, ...(grace ? { grace } : {}) }) + '\n') } catch { /* the page just shows nobody */ }
}

async function wait(project, args) {
  const seen = readJsonFile(seenFile(project))?.n ?? 0
  const since = args.since ?? seen
  const deadline = args.timeout === undefined ? Infinity : Date.now() + args.timeout * 1000
  for (let checkedAt = 0, beatAt = 0; ;) {
    // only what the person did: the skill's own messages and status are in the same log
    const events = readEvents(project, since).filter((e) => e.from !== 'skill')
    if (events.length) {
      for (const e of events) console.log(JSON.stringify(e))
      fs.writeFileSync(seenFile(project), JSON.stringify({ n: Math.max(seen, events.at(-1).n) }) + '\n')
      return beat(project, false, ACTING_MS)
    }
    if (Date.now() >= deadline) {
      beat(project, true, RETRY_MS)   // nothing to act on: it is expected back for another wait
      throw new Failure(`nothing new on the board in ${args.timeout} s`, 2)
    }
    if (Date.now() - checkedAt > 3000) {
      if (!await running(project)) throw new Failure('the board is not open, so nobody can answer: run `board.mjs open <project>` first')
      checkedAt = Date.now()
    }
    if (Date.now() - beatAt >= BEAT_MS) { beat(project, true); beatAt = Date.now() }
    await sleep(Math.min(250, Math.max(0, deadline - Date.now())))
  }
}

// What the skill writes on the page goes into the same log, marked from: "skill"; `wait` never hands it back.
function write(project, fields) {
  const board = readBoard(project)
  if (board === null) throw new Failure('there is no board yet: write it first with `board.mjs set <project> <board.json>`')
  try { return withLock(project, () => appendEvent(project, skillEvent(board, fields))) } catch (e) {
    if (e instanceof ActionError) throw new Failure(e.message)
    throw e
  }
}

function say(project, args) {
  const text = args._[2] === '-' ? fs.readFileSync(0, 'utf8') : args._[2]
  if (!text) throw new Failure('usage: node board.mjs say <project> [--scene <id>] "<text>"')
  const event = write(project, { type: 'message', scene: args.scene, text })
  console.log(`said ${event.scene ? `in scene ${event.scene}` : 'in the general thread'}: ${event.text}`)
}

function status(project, args) {
  const event = write(project, { type: 'status', scene: args.scene, state: args._[2], text: args._[3] })
  console.log(`${event.scene ? `scene ${event.scene}` : 'the board'}: ${event.state}${event.text ? ` (${event.text})` : ''}`)
}

/** What whoever serves the board is told: the loop, with the commands written in full for this project. */
export function agentPrompt(project) {
  const board = `node "${fileURLToPath(import.meta.url)}"`, p = `"${project}"`
  return [
    `Use the primo-videos skill. Serve the review board of this video project, in a loop, until the person says stop: ${project}`,
    '',
    `1. ${board} open ${p}   (once; it reuses the board that is already running)`,
    `2. ${board} wait ${p} --timeout 540   (blocks until the person does something on the page and prints it; exit 2 = nothing yet: run it again)`,
    '3. Act on each event, one scene at a time:',
    '   - choice: make the chosen option that scene\'s still, and close the choice',
    '   - replace-still: rebuild that scene\'s still from the person\'s picture (the file in the event), following the note that came with it, and show it again',
    '   - message: answer in the same thread; if it asks for a change, make it and show the scene again',
    '   - approve-still: animate that scene and show the preview. Never animate a scene before its approve-still',
    '   - approve-preview: that scene is done; render it final',
    '   - approve-script: the voice-over script is approved: record the approved lines and put each take in its scene\'s narration.audio. Never record a line before its approve-script',
    '   - redo-line: record only that scene\'s line again, with the new words or the change the person wrote (text), and show it again',
    `   While you work on a scene: ${board} status ${p} --scene <id> working "<what you are doing>"`,
    `4. Show the result on the page: ${board} patch ${p} '<json>'   and say it there: ${board} say ${p} --scene <id> "<text>"`,
    '5. Back to 2.',
    '',
    `The board.json format and what each event carries: ${path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'recipes', 'board.md')}`,
  ].join('\n')
}

const shellQuote = (v) => `'${String(v).replace(/'/g, `'\\''`)}'`

/** The osascript call that opens Terminal.app in the project folder with claude on the prompt file. Nothing runs here. */
export function terminalCommand({ project, claude, promptFile }) {
  const line = `cd ${shellQuote(project)} && ${shellQuote(claude)} "$(cat ${shellQuote(promptFile)})"`
  const quoted = line.replace(/\\/g, '\\\\').replace(/"/g, '\\"')
  return { command: 'osascript', args: ['-e', 'tell application "Terminal"', '-e', 'activate', '-e', `do script "${quoted}"`, '-e', 'end tell'] }
}

const quoteWin = (v) => `"${String(v).replace(/(\\+)$/, '$1$1')}"`   // a path has no '"': only a trailing backslash needs doubling
const quotePs = (v) => `'${String(v).replace(/['\u2018\u2019\u201A\u201B]/g, '$&$&')}'`   // PowerShell reads the curly ones as quotes too

/**
 * Windows: the call that opens Windows Terminal in the project folder running `board.mjs agent-window`, which starts
 * claude with the prompt file, so no shell ever parses the prompt. Without wt.exe, a console window through PowerShell
 * runs the same. Nothing runs here.
 */
export function windowsTerminalCommand({ project, claude, wt, node = process.execPath, script = fileURLToPath(import.meta.url) }) {
  const inside = [node, script, 'agent-window', project, claude]
  // wt splits its command line into tabs at each ";"
  if (wt) return { command: wt, args: ['-w', 'new', 'nt', '--title', 'primo-videos board', '-d', project, ...inside].map((a) => a.replace(/;/g, '\\;')) }
  return { command: 'powershell.exe', args: ['-NoProfile', '-NonInteractive', '-Command', `Start-Process -FilePath ${quotePs(node)} -ArgumentList ${quotePs(inside.slice(1).map(quoteWin).join(' '))}`] }
}

function findWt(env = process.env) {
  const dirs = [...(env.PATH || '').split(';'), env.LOCALAPPDATA && path.join(env.LOCALAPPDATA, 'Microsoft', 'WindowsApps')].filter(Boolean)
  // accessSync, not statSync: WindowsApps\wt.exe is an app execution alias, a link that stat cannot always follow
  for (const file of dirs.map((d) => path.join(d, 'wt.exe'))) try { fs.accessSync(file); return file } catch { /* next */ }
  return null
}

/** What the Windows window runs: claude in the project with the prompt as its first message, then a PowerShell there. */
function agentWindow(project, args) {
  process.on('SIGINT', () => {})   // Ctrl+C is for claude; this process only waits for it
  try {
    const { comando, antes } = howToRun(args._[2] || findClaude() || 'claude')
    const prompt = fs.readFileSync(path.join(boardDir(project), 'agent-prompt.txt'), 'utf8').trimEnd()
    const run = spawnSync(comando, [...antes, prompt], { cwd: project, stdio: 'inherit', env: cleanEnv() })
    if (run.error) throw run.error
  } catch (e) { console.error(`couldn't start claude: ${e.message}`) }
  if (process.stdin.isTTY) spawnSync('powershell.exe', ['-NoLogo'], { cwd: project, stdio: 'inherit' })
}

function agent(project, args) {
  const prompt = agentPrompt(project)
  if (args.terminal) {
    const claude = findClaude(), windows = process.platform === 'win32'
    const missing = windows ? (!claude ? 'the claude command (Claude Code) was not found in the PATH, in %USERPROFILE%\\.local\\bin or in %APPDATA%\\npm' : null)
      : process.platform !== 'darwin' ? 'opening a terminal only works on macOS and Windows'
        : !TERMINAL_APPS.some((app) => fs.existsSync(app)) ? 'Terminal.app is not on this machine'
          : !claude ? 'the claude command (Claude Code) was not found in the PATH or in ~/.local/bin' : null
    if (!missing) {
      const promptFile = path.join(boardDir(project), 'agent-prompt.txt')
      const wt = windows ? findWt() : null
      const call = windows ? windowsTerminalCommand({ project, claude, wt }) : terminalCommand({ project, claude, promptFile })
      if (args['dry-run']) return console.log(JSON.stringify(call, null, 2))
      fs.mkdirSync(boardDir(project), { recursive: true })
      fs.writeFileSync(promptFile, prompt + '\n')
      const app = !windows ? 'Terminal' : wt ? 'Windows Terminal' : 'PowerShell'
      spawn(call.command, call.args, { detached: true, stdio: 'ignore', ...(windows ? { env: cleanEnv() } : {}) })
        .on('error', () => console.error(`couldn't open the ${app}: paste this prompt into the assistant instead\n\n${prompt}`)).unref()
      return console.log(`a ${app} window is opening with claude on this board (the prompt: ${promptFile})${windows && !wt ? '. Claude Code looks better in Windows Terminal: winget install Microsoft.WindowsTerminal' : ''}`)
    }
    console.error(`not opening a terminal: ${missing}. Give this prompt to the assistant instead:\n`)
  }
  console.log(prompt)
}

function events(project, args) {
  for (const e of readEvents(project, args.since ?? 0)) console.log(JSON.stringify(e))
}

async function main(argv) {
  const args = readArgs(argv), command = args._[0]
  if (!command || args.help) return console.log(USAGE)
  const commands = {
    set: (p) => set(p, args._[2]), patch: (p) => patch(p, args._[2]), open: (p) => open(p, args), serve, stop,
    wait: (p) => wait(p, args), say: (p) => say(p, args), status: (p) => status(p, args), agent: (p) => agent(p, args), events: (p) => events(p, args),
    'agent-window': (p) => agentWindow(p, args),
  }
  if (!Object.hasOwn(commands, command)) throw new Failure(`unknown command "${command}"\n${USAGE}`)
  await commands[command](projectOf(args))
}

// caminho real dos dois lados: a skill é instalada por link simbólico, e aí o argv[1] não bate com o import.meta.url
if (process.argv[1] && (() => { try { return fs.realpathSync(process.argv[1]) === fs.realpathSync(fileURLToPath(import.meta.url)) } catch { return false } })()) {
  main(process.argv.slice(2)).catch((e) => {
    console.error(e instanceof Failure ? e.message : e)
    process.exit(e instanceof Failure ? e.code : 1)
  })
}
