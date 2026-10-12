#!/usr/bin/env node
// Produto sem tela (biblioteca, API, bot, serviço): não existe tela para gravar, e a skill não inventa uma.
// Diz isso ao dono e propõe o que mostrar, com o que o repositório já tem (README, rotas, comandos de bot).
//   node propose.mjs <project-folder> [--json]
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { detectarTipo } from './type.mjs'

const ler = (p) => { try { return fs.readFileSync(p, 'utf8') } catch { return '' } }
const lista = (dir, ext, fundo = 3, acc = []) => {
  if (fundo < 0 || acc.length > 200) return acc
  let es = []; try { es = fs.readdirSync(dir, { withFileTypes: true }) } catch { return acc }
  for (const e of es) {
    if (['node_modules', '.git', 'dist', 'build', 'target', 'venv', '.venv', '__pycache__'].includes(e.name) || e.name.startsWith('.')) continue
    const p = path.join(dir, e.name)
    if (e.isDirectory()) lista(p, ext, fundo - 1, acc); else if (ext.some((x) => e.name.endsWith(x))) acc.push(p)
  }
  return acc
}

export function propor(pasta) {
  const t = detectarTipo(pasta)
  const raiz = t.pasta || path.resolve(pasta)
  const readme = ['README.md', 'readme.md', 'README'].map((f) => ler(path.join(raiz, f))).find(Boolean) || ''
  const codigo = (readme.match(/```[\w-]*\n([\s\S]*?)```/) || [])[1]?.trim().split('\n').slice(0, 8).join('\n') || null
  const rotas = []
  for (const f of lista(raiz, ['.js', '.mjs', '.ts', '.py', '.go', '.rs'], 3)) {
    if (/\b(test|spec|node_modules)\b/.test(f)) continue
    for (const m of ler(f).slice(0, 80000).matchAll(/\b(?:app|router|server|fastify|api|r)\.(get|post|put|delete|patch)\(\s*['"`](\/[^'"`]*)['"`]|@(?:app|router)\.(get|post|put|delete|patch)\(\s*['"](\/[^'"]*)['"]/g)) rotas.push(`${(m[1] || m[3]).toUpperCase()} ${m[2] || m[4]}`)
  }
  const unicas = [...new Set(rotas)].filter((r) => !/health|ping|favicon/i.test(r)).slice(0, 5)
  const sub = t.sub || 'biblioteca'
  const nome = t.produto || path.basename(raiz)
  const itens = []
  if (sub === 'API') {
    itens.push(`The call and the response, for real: a \`curl\` to the ${unicas[0] ? `route ${unicas[0]}` : 'most used route'} and the JSON that comes back, in the typing-terminal style (template typing-terminal; the skill runs the call against a local test server, with demo data).`)
    itens.push('The result in the product of whoever uses the API: the screen of the app that consumes this data (if it is another product of the owner, that product is the video — the skill recognizes its type).')
    itens.push('A number or a before and after: "response in 40 ms", "from 3 calls down to 1" — only if the owner has the number measured.')
  } else if (sub === 'bot') {
    itens.push('The real conversation, on the screen of the app where the bot lives (WhatsApp, Discord, Telegram): the message of whoever asks and the bot\'s answer. This needs a test account and a recording of the window/phone with that conversation: the skill asks the owner where the bot runs and which account to use.')
    itens.push('What the bot answers, as typed text (template typing-text), when the app cannot be recorded: only with real bot lines, copied from the test log.')
  } else if (sub === 'biblioteca') {
    itens.push(`The code that uses it: ${codigo ? 'the first example in the README (below)' : 'the simplest call of the library'}, typed in the editor, and what it returns when it really runs (the skill runs the example and stores the output).`)
    itens.push('The result in the product of whoever uses the library: where the effect shows up for the end user (another product of the owner, or a minimal example).')
  } else {
    itens.push('What the service does, shown from the outside: the command that triggers it and the result it leaves (file, message, record). The skill really runs it and shows it.')
  }
  itens.push('If none of this works: an explainer video with no screen (typed text, counting number, rolling list), with what the product solves for whoever uses it.')
  const linha = `${nome} is ${sub === 'API' ? 'an API' : sub === 'bot' ? 'a bot' : sub === 'biblioteca' ? 'a library' : 'a service'}: it has no screen to record, and the skill will not invent one.`
  return { tipo: t.tipo, produto: nome, sub, linha, propostas: itens, exemploReadme: codigo, rotas: unicas, perguntar: ['which of the proposals fits where the video will play', 'is there a test account or environment with demo data', 'who uses this and in which product the result shows up'] }
}

if (process.argv[1] && fs.realpathSync(process.argv[1]) === fs.realpathSync(fileURLToPath(import.meta.url))) {
  const a = process.argv.slice(2), pasta = a.find((x) => !x.startsWith('--'))
  if (!pasta) { console.error('usage: node propose.mjs <project-folder> [--json]'); process.exit(1) }
  const r = propor(pasta)
  if (a.includes('--json')) console.log(JSON.stringify(r, null, 2))
  else {
    console.log(r.linha, '\nI propose showing:')
    r.propostas.forEach((p, i) => console.log(`  ${i + 1}. ${p}`))
    if (r.rotas.length) console.log(`Routes I found: ${r.rotas.join(' · ')}`)
    if (r.exemploReadme) console.log('README example:\n' + r.exemploReadme.split('\n').map((l) => '  | ' + l).join('\n'))
    console.log('Ask the owner: ' + r.perguntar.join(' · '))
  }
}
