#!/usr/bin/env node
// Diagnóstico e conserto do ambiente das skills de vídeo: sistema, ffmpeg, Python (numpy/scipy), Playwright +
// Chromium, CPUs e disco livre.
//   node environment.mjs [pasta-do-projeto]   o que tem, o que falta e o comando certo para ESTE sistema
//   node environment.mjs --fix          resolve de uma vez: acha o Playwright e o Chromium que já existem, cria o
//                                          Python da trilha (~/.videostudio/venv com numpy e scipy, ~30 MB) e grava
//                                          ~/.videostudio/environment.json, que todos os scripts da skill leem sozinhos
//   node environment.mjs --fix --yes    e, se não houver Playwright ou Chromium, baixa (~150 MB)
//   --json: a saída em JSON (no conserto, o andamento vai para o stderr). VIDEOSTUDIO_HOME troca a pasta ~/.videostudio.
// O ffmpeg não se instala daqui: o conserto acha e diz o comando do sistema.
import { execSync, spawnSync } from 'node:child_process'
import os from 'node:os'
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import { pastaVideostudio, lerAmbiente, acharPython } from './where.cjs'

const require = createRequire(import.meta.url)
const here = path.dirname(fileURLToPath(import.meta.url))
const args = process.argv.slice(2)
const comJson = args.includes('--json'), consertar = args.includes('--fix'), sim = args.includes('--yes')
const projeto = args.find((a) => !a.startsWith('--')) || process.cwd()
const win = process.platform === 'win32', mac = process.platform === 'darwin'
const run = (cmd) => { try { return execSync(cmd, { stdio: ['ignore', 'pipe', 'pipe'], timeout: 20000 }).toString().trim() } catch { return null } }
const CASA = pastaVideostudio()
const ARQ = path.join(CASA, 'environment.json')
const curto = (p) => (p && p.startsWith(os.homedir() + path.sep) ? '~' + p.slice(os.homedir().length) : p)
const EU = `node ${path.join(here, 'environment.mjs')}`
// com --json, o stdout é só o JSON: o andamento do conserto vai para o stderr
const diz = (m) => (comJson ? console.error(m) : console.log(m))

/** O caminho absoluto de um executável no PATH, ou null. */
function noPath(nome) {
  const exts = win ? (process.env.PATHEXT || '.EXE;.CMD;.BAT;.COM').split(';').filter(Boolean) : ['']
  for (const d of (process.env.PATH || '').split(path.delimiter).filter(Boolean)) {
    for (const e of exts) {
      const p = path.join(d, nome + e)
      try { if (fs.statSync(p).isFile()) return p } catch {}
    }
  }
  return null
}

const sistema = `${mac ? 'macOS' : win ? 'Windows' : 'Linux'} ${os.release()} (${os.arch()})`
const comoFfmpeg = mac ? 'brew install ffmpeg' : win ? 'winget install --id Gyan.FFmpeg -e' : 'sudo apt install ffmpeg'
const comoPython = mac ? 'brew install python' : win ? 'winget install --id Python.Python.3.12 -e' : 'sudo apt install python3 python3-venv'
const pyVenv = path.join(CASA, 'venv', win ? 'Scripts' : 'bin', win ? 'python.exe' : 'python')
const versaoPy = (py) => { const r = spawnSync(py, ['--version'], { encoding: 'utf8', timeout: 20000 }); return r.status === 0 ? (r.stdout || r.stderr).trim() : null }
const temNumpyScipy = (py) => spawnSync(py, ['-c', 'import numpy, scipy'], { stdio: 'ignore', timeout: 60000 }).status === 0
const versaoPw = (dir) => { try { return JSON.parse(fs.readFileSync(path.join(dir, 'package.json'), 'utf8')).version } catch { return null } }

/** O Python 3 do sistema que cria o venv: [comando, ...args], ou null. */
function pythonBase() {
  for (const c of win ? [['py', '-3'], ['python'], ['python3']] : [['python3'], ['python']]) {
    const r = spawnSync(c[0], [...c.slice(1), '--version'], { encoding: 'utf8', timeout: 20000 })
    if (r.status === 0 && /Python 3/.test(r.stdout + r.stderr)) return c
  }
  return null
}

/** Os Playwright desta máquina, na ordem do playwright.cjs e depois um nível de ~/Documents/GitHub (o mais novo antes). */
function playwrights() {
  const { candidatos } = require(path.join(here, 'playwright.cjs'))
  const out = candidatos(projeto)
  const gh = path.join(os.homedir(), 'Documents', 'GitHub')
  let dirs = []
  try { dirs = fs.readdirSync(gh) } catch {}
  const achados = dirs.map((d) => path.join(gh, d, 'node_modules', 'playwright')).filter((p) => fs.existsSync(path.join(p, 'package.json')))
  const num = (v) => String(v || '0').split('.').map((x) => parseInt(x, 10) || 0)
  achados.sort((a, b) => { const x = num(versaoPw(a)), y = num(versaoPw(b)); for (let i = 0; i < 3; i++) if (x[i] !== y[i]) return y[i] - x[i]; return 0 })
  out.push(...achados, path.join(CASA, 'node', 'node_modules', 'playwright'))
  return [...new Set(out)].filter((p) => fs.existsSync(path.join(p, 'package.json')))
}

/** O Chromium daquele Playwright (o executablePath), se o arquivo existe. */
function chromiumDe(dir) {
  try { const exe = require(dir).chromium.executablePath(); return exe && fs.existsSync(exe) ? exe : null } catch { return null }
}

/** Abre o Chromium daquele Playwright de verdade (com os argumentos da GPU) e devolve o renderer do WebGL, ou o erro. */
async function abrir(dir) {
  const { argsGpu, rendererWebGL } = require(path.join(here, 'playwright.cjs'))
  try {
    const browser = await require(dir).chromium.launch({ args: argsGpu() })
    try { return { webgl: await rendererWebGL(browser) } } finally { await browser.close() }
  } catch (e) { return { erro: String(e.message || e).split('\n')[0] } }
}

// o npm do Windows é um .cmd, que só roda pelo shell (e aí o caminho com espaço vai entre aspas)
const roda = (cmd, a) => {
  const sh = win && cmd === 'npm'
  return spawnSync(cmd, sh ? a.map((x) => (/\s/.test(x) ? `"${x}"` : x)) : a, { stdio: ['ignore', comJson ? 2 : 'inherit', 'inherit'], shell: sh })
}

// ───────────────────────────── o conserto ─────────────────────────────
async function oConserto() {
  const amb = { versao: 1, quando: null, sistema, playwright: null, chromium: null, python: null, ffmpeg: null, ffprobe: null }
  const falta = []
  const notas = {}
  fs.mkdirSync(CASA, { recursive: true })

  // Playwright + Chromium: o primeiro que abre de verdade
  const pws = playwrights()
  let semChromium = null
  for (const dir of pws) {
    const exe = chromiumDe(dir)
    if (!exe) { semChromium = semChromium || dir; continue }
    const a = await abrir(dir)
    if (a.erro) { diz(`playwright ${curto(dir)}: Chromium did not open (${a.erro})`); semChromium = semChromium || dir; continue }
    Object.assign(amb, { playwright: dir, chromium: exe }); notas.webgl = a.webgl
    diz(`playwright ${versaoPw(dir)} at ${curto(dir)}: Chromium opens`)
    break
  }
  if (!amb.playwright) {
    const destinoNpm = path.join(CASA, 'node')
    const pwNovo = semChromium || path.join(destinoNpm, 'node_modules', 'playwright')
    const passos = []
    if (!semChromium) passos.push(['npm', ['i', 'playwright', '--prefix', destinoNpm]])
    passos.push([process.execPath, [path.join(pwNovo, 'cli.js'), 'install', 'chromium']])
    const mostra = (c, a) => [c === process.execPath ? 'node' : c, ...a].map((x) => (/\s/.test(x) ? `"${x}"` : x)).join(' ')
    if (!sim) {
      diz(semChromium
        ? `\nPlaywright ${curto(semChromium)} exists, but its Chromium does not. Chromium still has to be downloaded (~150 MB):`
        : '\nNo Playwright on this machine. Playwright and Chromium still have to be downloaded (~150 MB):')
      for (const [c, a] of passos) diz(`  ${mostra(c, a)}`)
      diz(`To do it, run again with --yes: ${EU} --fix --yes`)
      falta.push({ o: semChromium ? 'Playwright\'s Chromium' : 'Playwright', como: `${EU} --fix --yes (downloads ~150 MB)` })
    } else {
      diz(`\nDownloading ${semChromium ? 'Chromium' : 'Playwright and Chromium'} (~150 MB):`)
      let ok = true
      for (const [c, a] of passos) {
        diz(`  $ ${mostra(c, a)}`)
        const r = roda(c, a)
        if (r.status !== 0) { ok = false; diz(`  failed (code ${r.status ?? r.error?.code})`); break }
      }
      const exe = ok && chromiumDe(pwNovo)
      const a = exe ? await abrir(pwNovo) : { erro: 'Chromium did not end up in place' }
      if (exe && !a.erro) { Object.assign(amb, { playwright: pwNovo, chromium: exe }); notas.webgl = a.webgl }
      else falta.push({ o: 'Playwright + Chromium', como: `the download did not work (${a.erro || 'see above'}); in the project folder: npm i -D playwright && npx playwright install chromium` })
    }
  }

  // Python da trilha: o venv da skill, com numpy e scipy
  if (fs.existsSync(pyVenv) && temNumpyScipy(pyVenv)) amb.python = pyVenv
  else {
    const base = pythonBase()
    if (!base) falta.push({ o: 'Python 3', como: `${comoPython}, then ${EU} --fix` })
    else {
      const venv = path.join(CASA, 'venv')
      let ok = true
      if (!fs.existsSync(pyVenv)) {
        // a pasta existe sem o python (o Python de origem saiu da máquina): o venv é recriável, refaz do zero
        const a = ['-m', 'venv', ...(fs.existsSync(venv) ? ['--clear'] : []), venv]
        diz(`\nCreating the soundtrack Python in ${curto(venv)}:\n  $ ${[...base, ...a].join(' ')}`)
        const r = roda(base[0], [...base.slice(1), ...a])
        if (r.status !== 0) { ok = false; falta.push({ o: 'Python venv', como: win ? 'reinstall Python with venv (winget install --id Python.Python.3.12 -e)' : mac ? 'brew reinstall python' : 'sudo apt install python3-venv' }) }
      }
      if (ok) {
        diz(`\nInstalling numpy and scipy in the soundtrack venv (~30 MB):\n  $ ${pyVenv} -m pip install numpy scipy`)
        const r = roda(pyVenv, ['-m', 'pip', 'install', '--disable-pip-version-check', 'numpy', 'scipy'])
        if (r.status === 0 && temNumpyScipy(pyVenv)) amb.python = pyVenv
        else falta.push({ o: 'numpy + scipy', como: `pip did not install them (see above); try by hand: ${pyVenv} -m pip install numpy scipy` })
      }
    }
  }

  // ffmpeg e ffprobe: só acha
  amb.ffmpeg = noPath('ffmpeg'); amb.ffprobe = noPath('ffprobe')
  if (!amb.ffmpeg || !amb.ffprobe) falta.push({ o: 'ffmpeg', como: comoFfmpeg })

  amb.quando = new Date().toISOString()
  fs.writeFileSync(ARQ, JSON.stringify(amb, null, 2) + '\n')
  const resumo = [amb.playwright && `playwright ${versaoPw(amb.playwright)} at ${curto(amb.playwright)}`, amb.python && `python ${(versaoPy(amb.python) || '').replace(/^Python /, '')} at ${curto(amb.python)}`].filter(Boolean).join(', ')
  if (comJson) console.log(JSON.stringify({ arquivo: ARQ, ambiente: amb, webgl: notas.webgl || null, falta }, null, 2))
  else {
    if (notas.webgl) console.log(`\nWebGL: ${notas.webgl}`)
    if (falta.length) { console.log('\nMISSING:'); for (const f of falta) console.log(`  · ${f.o}: ${f.como}`) }
    console.log(falta.length ? `\nenvironment incomplete: ${curto(ARQ)} written with what I found (${resumo || 'nothing yet'})` : `\nenvironment ready: ${curto(ARQ)} (${resumo})`)
  }
  process.exit(falta.length ? 2 : 0)
}

if (consertar) await oConserto()

// ───────────────────────────── o diagnóstico ─────────────────────────────
const r = { sistema, shell: win ? 'PowerShell' : (process.env.SHELL || 'sh'), cpus: os.cpus().length, node: process.version }
r.ffmpeg = (run('ffmpeg -version') || '').split('\n')[0] || null
r.ffprobe = !!run('ffprobe -version')

const pyBom = acharPython()
const base = pyBom ? null : pythonBase()
r.python_cmd = pyBom || (base && base.join(' '))
r.python = pyBom ? versaoPy(pyBom) : base ? versaoPy(base[0]) : null
if (r.python_cmd) r.numpy_scipy = !!pyBom

try {
  const { candidatos } = require(path.join(here, 'playwright.cjs'))
  const cs = candidatos(projeto)
  r.playwright = cs[0] || null
  if (cs[0]) r.chromium = chromiumDe(cs[0])
} catch (e) { r.playwright_erro = e.message }

try { const st = fs.statfsSync(projeto); r.disco_livre_gb = +((st.bavail * st.bsize) / 1e9).toFixed(1) } catch {}

r.arquivo_ambiente = ARQ
r.ambiente = lerAmbiente()

const falta = []
if (!r.ffmpeg) falta.push(['ffmpeg', comoFfmpeg])
if (!r.python_cmd) falta.push(['Python 3', comoPython])
else if (!r.numpy_scipy) falta.push(['numpy + scipy (only for the soundtrack)', `${EU} --fix (creates ${curto(path.join(CASA, 'venv'))} with both)`])
if (!r.playwright) falta.push(['Playwright', `${EU} --fix (finds the one already installed; if there is none, --yes downloads ~150 MB)`])
else if (!r.chromium) falta.push(['Playwright\'s Chromium', `${EU} --fix --yes (downloads ~150 MB)`])
if (r.disco_livre_gb != null && r.disco_livre_gb < 3) falta.push(['disk space', `only ${r.disco_livre_gb} GB free — the render streams, but the encode and the previews need ~2 GB`])
r.falta = falta.map(([o, c]) => ({ o, como: c }))
r.workers_sugeridos = Math.max(2, Math.min(8, r.cpus - 2))
// o environment.json falta, ou aponta para o que não existe mais: o conserto refaz
const ambVelho = !r.ambiente || ['playwright', 'python'].some((k) => !r.ambiente[k] || !fs.existsSync(r.ambiente[k]))
r.consertar = falta.length || ambVelho ? `${EU} --fix` : null

if (comJson) { console.log(JSON.stringify(r, null, 2)); process.exit(0) }
console.log(`system    ${r.sistema} · ${r.cpus} CPUs · shell ${r.shell}`)
console.log(`node      ${r.node}`)
console.log(`ffmpeg    ${r.ffmpeg || 'NOT FOUND'}`)
console.log(`python    ${r.python || 'NOT FOUND'}${r.python_cmd ? ` (${r.python_cmd})` : ''}${r.python_cmd ? ` · numpy/scipy ${r.numpy_scipy ? 'ok' : 'missing'}` : ''}`)
console.log(`playwright ${r.playwright || 'NOT FOUND'}`)
console.log(`chromium  ${r.chromium ? 'ok' : 'NOT FOUND'}`)
if (r.disco_livre_gb != null) console.log(`disk      ${r.disco_livre_gb} GB free`)
console.log(`workers   ${r.workers_sugeridos} (parallel render)`)
console.log(r.ambiente
  ? `env file  ${curto(ARQ)} (from ${String(r.ambiente.quando || '?').slice(0, 10)}) · playwright ${curto(r.ambiente.playwright) || '—'} · python ${curto(r.ambiente.python) || '—'}`
  : `env file  ${curto(ARQ)} does not exist`)
if (falta.length) { console.log('\nMISSING:'); for (const f of r.falta) console.log(`  · ${f.o}: ${f.como}`) }
else console.log('\nAll set to render.')
if (r.consertar) console.log(`\nTo fix it all at once (and write ${curto(ARQ)}, which every script reads on its own): ${r.consertar}`)
process.exit(falta.some(([o]) => /ffmpeg|Playwright|Chromium/.test(o)) ? 2 : 0)
