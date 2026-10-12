#!/usr/bin/env node
// Roda de verdade os comandos que o dono listou e guarda o que foi digitado e o que o programa respondeu.
//   node record-terminal.mjs --commands commands.json --out terminal.json [--folder <cwd>] [--prompt "meu-cli $"]
// commands.json: { "titulo": "meu-cli", "prompt": "~/meu-cli $", "comandos": [ { "cmd": "meu-cli lista", "legenda": "Veja a lista." } ] }
// "alias": { "meu-cli": "node bin/meu-cli.js" } faz o nome do vídeo rodar o programa do projeto.
// Só roda o que está na lista (a skill pergunta ao dono quais comandos; nada de inventar comando que muda coisa).
// Cada comando tem 20 s; passou disso, é cortado e a gravação diz. A saída é a real, sem edição.
import fs from 'node:fs'
import path from 'node:path'
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const LIMITE_MS = 20000
const NO_WINDOWS = process.platform === 'win32'
export const SEM_BASH = 'Git Bash was not found (it comes with Git for Windows, which Claude Code on Windows also uses). Install it with: winget install Git.Git, or point CLAUDE_CODE_GIT_BASH_PATH at its bash.exe'

/**
 * No Windows os comandos rodam no Git Bash, o shell da ferramenta Bash do Claude Code: a lista é escrita em sh (printf,
 * curl, &&, VAR=x) e o alias é a mesma função do Mac. O PowerShell 5.1 não tem && e troca o curl pelo Invoke-WebRequest.
 * Nunca o bash.exe do System32, que é o do WSL.
 */
export function acharBash(env = process.env) {
  const arquivo = (p) => { try { return fs.statSync(p).isFile() } catch { return false } }
  const doGit = (env.PATH || '').split(';').filter((d) => d && arquivo(path.join(d, 'git.exe')))
    .flatMap((d) => [path.join(d, '..', 'bin', 'bash.exe'), path.join(d, '..', '..', 'bin', 'bash.exe')])
  const fixos = [env.ProgramFiles, env['ProgramFiles(x86)'], env.LOCALAPPDATA && path.join(env.LOCALAPPDATA, 'Programs')].filter(Boolean).map((d) => path.join(d, 'Git', 'bin', 'bash.exe'))
  return [env.CLAUDE_CODE_GIT_BASH_PATH, ...doGit, ...fixos].find((p) => p && arquivo(p)) || null
}

export function rodar(cmd, cwd, env = {}, alias = {}, limiteMs = LIMITE_MS) {
  // alias: o nome que aparece no vídeo ("meu-cli") roda o programa do projeto ("node bin/meu-cli.js"), sem instalar nada na máquina
  const prelude = Object.entries(alias).map(([n, c]) => `${n}() { ${c} "$@"; }; `).join('')
  return new Promise((resolve) => {
    const t0 = Date.now(), saida = []
    const ambiente = { ...process.env, TERM: 'xterm-256color', FORCE_COLOR: '1', ...env }
    let shell = ['/bin/sh', ['-c', prelude + cmd]]
    if (NO_WINDOWS) {
      const bash = acharBash()
      if (!bash) return resolve({ saida: [{ t: 0, texto: SEM_BASH }], codigo: 127, ms: 0, cortado: false })
      // o comando vai pelo ambiente: na linha de comando, o Git Bash expande curinga e mexe nas aspas antes do sh ver.
      // MSYS_NO_PATHCONV: sem ele, o "/cestas" de "meu-cli get /cestas" chega ao programa como C:/Program Files/Git/cestas.
      // PYTHONUTF8: o Python do Windows escreve no cano na página de código local, e o acento chegaria quebrado.
      shell = [bash, ['-c', 'eval "$PRIMO_VIDEOS_CMD"']]
      Object.assign(ambiente, { PRIMO_VIDEOS_CMD: prelude + cmd, MSYS_NO_PATHCONV: '1', PYTHONUTF8: '1' })
    }
    const p = spawn(shell[0], shell[1], { cwd, env: ambiente, detached: !NO_WINDOWS, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] })
    let resto = '', cortado = false
    const recebe = (b) => {
      resto += b
      const linhas = resto.split('\n'); resto = linhas.pop()
      for (const l of linhas) saida.push({ t: (Date.now() - t0) / 1000, texto: l.replace(/\r$/, '') })
    }
    p.stdout.setEncoding('utf8'); p.stderr.setEncoding('utf8')
    p.stdout.on('data', recebe); p.stderr.on('data', recebe)
    const corta = () => {
      cortado = true
      // a árvore toda: o programa do dono pode ter aberto outros, e eles seguram a saída aberta
      if (NO_WINDOWS) spawn('taskkill', ['/pid', String(p.pid), '/T', '/F'], { stdio: 'ignore', windowsHide: true }).on('error', () => p.kill())
      else try { process.kill(-p.pid, 'SIGTERM') } catch {}
    }
    const timer = setTimeout(corta, limiteMs)
    p.on('close', (codigo) => {
      clearTimeout(timer)
      if (resto) saida.push({ t: (Date.now() - t0) / 1000, texto: resto.replace(/\r$/, '') })
      resolve({ saida, codigo: cortado ? null : codigo, ms: Date.now() - t0, cortado })
    })
    p.on('error', (e) => resolve({ saida: [{ t: 0, texto: String(e.message) }], codigo: 127, ms: 0, cortado: false }))
  })
}

export async function gravarTerminal({ comandos, pasta }) {
  const cwd = path.resolve(pasta || process.cwd())
  const out = []
  for (const c of comandos.comandos) out.push({ cmd: c.cmd, legenda: c.legenda || '', ...(await rodar(c.cmd, cwd, {}, comandos.alias)) })
  return { titulo: comandos.titulo || path.basename(cwd), prompt: comandos.prompt || `${path.basename(cwd)} $`, comandos: out }
}

if (process.argv[1] && fs.realpathSync(process.argv[1]) === fs.realpathSync(fileURLToPath(import.meta.url))) {
  const a = process.argv.slice(2), arg = (k, d) => { const i = a.indexOf('--' + k); return i >= 0 ? a[i + 1] : d }
  if (!arg('commands') || !arg('out')) { console.error('usage: node record-terminal.mjs --commands commands.json --out terminal.json [--folder <cwd>]'); process.exit(1) }
  if (NO_WINDOWS && !acharBash()) { console.error(SEM_BASH); process.exit(1) }
  const r = await gravarTerminal({ comandos: JSON.parse(fs.readFileSync(arg('commands'), 'utf8')), pasta: arg('folder') })
  fs.writeFileSync(arg('out'), JSON.stringify(r, null, 1))
  for (const c of r.comandos) console.log(`${c.codigo === 0 ? '✓' : '✗'} ${c.cmd} · ${c.saida.length} line(s) · ${c.ms} ms${c.cortado ? ' · CUT OFF at 20 s' : ''}${c.codigo ? ` · exit code ${c.codigo}` : ''}`)
  if (r.comandos.some((c) => c.codigo !== 0)) console.log('Heads up: a command that failed will show in the video exactly as it answered. Check that this is what the owner wants to show.')
}
