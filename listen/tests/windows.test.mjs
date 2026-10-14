// node --test listen/tests/*.test.mjs   (só no Windows; nos outros sistemas fica de fora): a listen chamada como o Claude
// chama no Windows, pelo PowerShell 5.1, pelo PowerShell 7 e pelo Git Bash, com o caminho em cada forma que ele chega
// (aspas simples ou duplas, barra normal, colado do "Copiar como caminho", ~, /c/…), numa casa com acento no nome.
import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { spawn, execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { subirApiFalsa } from './api-falsa.mjs'

const WIN = process.platform === 'win32'
const SKILL = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const CHAVE = `sk-teste-${Math.random().toString(36).slice(2)}${Math.random().toString(36).slice(2)}`
const GIT_BASH = WIN ? path.join(process.env.ProgramFiles ?? 'C:\\Program Files', 'Git', 'bin', 'bash.exe') : ''
const POWERSHELL_7 = WIN ? path.join(process.env.ProgramFiles ?? 'C:\\Program Files', 'PowerShell', '7', 'pwsh.exe') : ''

let base, home, midia, script, api, audio, apostrofo
const ff = (...args) => execFileSync('ffmpeg', ['-hide_banner', '-v', 'error', '-y', ...args])

before(async () => {
  if (!WIN) return
  base = fs.mkdtempSync(path.join(os.tmpdir(), 'listen windows '))
  home = path.join(base, 'João Silva')
  midia = path.join(home, 'Mídia da Ana')
  fs.mkdirSync(midia, { recursive: true })
  const link = path.join(home, '.claude', 'skills', 'listen')
  fs.mkdirSync(path.dirname(link), { recursive: true })
  fs.symlinkSync(SKILL, link, 'junction')
  script = path.join(link, 'scripts', 'listen.mjs')
  audio = path.join(midia, 'Meu áudio (1).opus')
  apostrofo = path.join(midia, "Áudio da D'Ávila.opus")
  const bipes = ['-f', 'lavfi', '-i', `aevalsrc='if(lt(mod(t\\,2)\\,1)\\,0.5*sin(2*PI*440*t)\\,0)':s=16000:d=3`]
  ff(...bipes, '-c:a', 'libopus', '-b:a', '24k', audio)
  fs.copyFileSync(audio, apostrofo)
  api = await subirApiFalsa({ chave: CHAVE })
})
after(async () => {
  await api?.fechar()
  if (base) fs.rmSync(base, { recursive: true, force: true })
})

/** Roda um comando inteiro num shell, como o Claude manda, com a casa de mentira. */
function noShell(shell, comando) {
  const env = {
    ...process.env, HOME: home, USERPROFILE: home, LOCALAPPDATA: path.join(home, 'AppData', 'Local'),
    OPENAI_API_BASE: api.url, OPENAI_API_KEY: CHAVE,
  }
  // -EncodedCommand leva o comando exatamente como foi escrito, com acento e aspas, sem passar pela linha de comando
  const args = shell === 'bash' ? ['-c', comando]
    : ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-EncodedCommand', Buffer.from(comando, 'utf16le').toString('base64')]
  const programa = { bash: GIT_BASH, 'powershell 5.1': 'powershell.exe', 'powershell 7': POWERSHELL_7 }[shell]
  return new Promise((resolve) => {
    const p = spawn(programa, args, { env, windowsHide: true })
    const out = [], err = []
    p.stdout.on('data', (d) => out.push(d))
    p.stderr.on('data', (d) => err.push(d))
    p.on('close', (code) => resolve({ code, stdout: Buffer.concat(out).toString('utf8'), stderr: Buffer.concat(err).toString('utf8') }))
  })
}

const psAspas = (s) => `'${s.replace(/'/g, "''")}'`
const bashAspas = (s) => `'${s.replace(/'/g, `'\\''`)}'`
const posix = (s) => `/${s[0].toLowerCase()}/${s.slice(3).replace(/\\/g, '/')}`

function formas() {
  const rel = path.relative(home, audio)
  const barra = audio.replace(/\\/g, '/')
  const ps = (arg) => `$P = ${psAspas(script)}; node $P ${arg}`
  const ps7 = fs.existsSync(POWERSHELL_7)
  const casos = []
  for (const shell of ['powershell 5.1', ...(ps7 ? ['powershell 7'] : [])]) {
    casos.push(
      [shell, 'aspas simples', ps(psAspas(audio)), audio],
      [shell, 'aspas duplas', ps(`"${audio}"`), audio],
      [shell, 'barra normal', ps(psAspas(barra)), audio],
      [shell, 'colado do "Copiar como caminho", dentro de aspas simples', ps(psAspas(`"${audio}"`)), audio],
      [shell, '~ com barra invertida', ps(psAspas(`~\\${rel}`)), audio],
      [shell, '~ com barra normal', ps(psAspas(`~/${rel.replace(/\\/g, '/')}`)), audio],
      [shell, "aspa simples dentro do nome, dobrada", ps(psAspas(apostrofo)), apostrofo],
    )
  }
  if (fs.existsSync(GIT_BASH)) {
    const bash = (arg) => `P=~/.claude/skills/listen/scripts/listen.mjs; node "$P" ${arg}`
    casos.push(
      ['bash', 'caminho do Windows em aspas simples', bash(bashAspas(audio)), audio],
      ['bash', 'caminho /c/…', bash(bashAspas(posix(audio))), audio],
      ['bash', '~ que o bash expande', bash(`~/${bashAspas(rel.replace(/\\/g, '/'))}`), audio],
      ['bash', '~ entre aspas', bash(bashAspas(`~/${rel.replace(/\\/g, '/')}`)), audio],
      ['bash', 'barra normal em aspas duplas', bash(`"${barra}"`), audio],
      ['bash', "aspa simples dentro do nome", bash(bashAspas(apostrofo)), apostrofo],
    )
  }
  return casos
}

test('no PowerShell 5.1, no PowerShell 7 e no Git Bash, o caminho em cada forma chega no mesmo arquivo', { skip: !WIN && 'só no Windows' }, async () => {
  const casos = formas()
  assert.ok(casos.some(([s]) => s === 'bash'), `o Git Bash não está em ${GIT_BASH}`)
  for (const [shell, forma, comando, arquivo] of casos) {
    const r = await noShell(shell, comando)
    const onde = `${shell}, ${forma}:\n${comando}\n${r.stdout}\n${r.stderr}`
    assert.equal(r.code, 0, onde)
    // o PowerShell pode reescrever a saída com CRLF; o que não pode é trocar os caracteres
    assert.ok(r.stdout.replace(/\r\n/g, '\n').startsWith(`${path.basename(arquivo)} · áudio · 0:03\n`), onde)
    assert.match(r.stdout, /\[00:00\] som 1\./, onde)
  }
  // um pedido por arquivo: todas as outras formas, em todos os shells, saíram do cache
  assert.equal(api.pedidos.length, 2, api.pedidos.map((p) => p.nomeArquivo).join(', '))
  const cache = fs.readdirSync(path.join(home, 'AppData', 'Local', 'listen'))
  assert.equal(cache.length, 2, `o cache vai para %LOCALAPPDATA%\\listen, uma pasta por arquivo: ${cache}`)
})
