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
export function rodar(cmd, cwd, env = {}, alias = {}) {
  // alias: o nome que aparece no vídeo ("meu-cli") roda o programa do projeto ("node bin/meu-cli.js"), sem instalar nada na máquina
  const prelude = Object.entries(alias).map(([n, c]) => `${n}() { ${c} "$@"; }; `).join('')
  return new Promise((resolve) => {
    const t0 = Date.now(), saida = []
    const p = spawn('/bin/sh', ['-c', prelude + cmd], { cwd, env: { ...process.env, TERM: 'xterm-256color', FORCE_COLOR: '1', ...env }, detached: true, stdio: ['ignore', 'pipe', 'pipe'] })
    let resto = '', cortado = false
    const recebe = (b) => {
      resto += b.toString('utf8')
      const linhas = resto.split('\n'); resto = linhas.pop()
      for (const l of linhas) saida.push({ t: (Date.now() - t0) / 1000, texto: l.replace(/\r$/, '') })
    }
    p.stdout.on('data', recebe); p.stderr.on('data', recebe)
    const timer = setTimeout(() => { cortado = true; try { process.kill(-p.pid, 'SIGTERM') } catch {} }, LIMITE_MS)
    p.on('close', (codigo) => {
      clearTimeout(timer)
      if (resto) saida.push({ t: (Date.now() - t0) / 1000, texto: resto })
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
  const r = await gravarTerminal({ comandos: JSON.parse(fs.readFileSync(arg('commands'), 'utf8')), pasta: arg('folder') })
  fs.writeFileSync(arg('out'), JSON.stringify(r, null, 1))
  for (const c of r.comandos) console.log(`${c.codigo === 0 ? '✓' : '✗'} ${c.cmd} · ${c.saida.length} line(s) · ${c.ms} ms${c.cortado ? ' · CUT OFF at 20 s' : ''}${c.codigo ? ` · exit code ${c.codigo}` : ''}`)
  if (r.comandos.some((c) => c.codigo !== 0)) console.log('Heads up: a command that failed will show in the video exactly as it answered. Check that this is what the owner wants to show.')
}
