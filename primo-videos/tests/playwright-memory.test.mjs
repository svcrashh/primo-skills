// node --test tests/   (sem rede): o playwright.cjs lembra onde achou o Playwright e acha de novo a partir de uma pasta
// de projeto sem node_modules; sem nada, falha alto com o que fazer.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const PW = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'scripts', 'playwright.cjs')
// a casa isolada: no Windows, o os.homedir() lê o USERPROFILE, não o HOME
const roda = (codigo, env) => spawnSync(process.execPath, ['-e', codigo], { encoding: 'utf8', cwd: env.HOME, env: { PATH: process.env.PATH, USERPROFILE: env.HOME, ...env } })

test('depois de achar uma vez (PLAYWRIGHT_PATH), a pasta sem node_modules acha sozinha; sem memória, falha alto', (t) => {
  const casa = fs.mkdtempSync(path.join(os.tmpdir(), 'pw-casa-'))
  try {
    const falso = path.join(casa, 'outra', 'node_modules', 'playwright')
    fs.mkdirSync(falso, { recursive: true })
    fs.writeFileSync(path.join(falso, 'package.json'), '{"name":"playwright","main":"index.js"}')
    fs.writeFileSync(path.join(falso, 'index.js'), 'module.exports = { chromium: {} }')
    const projeto = path.join(casa, 'projeto-sem-node-modules')
    fs.mkdirSync(projeto)
    const carregar = `const { carregar } = require(${JSON.stringify(PW)}); try { console.log(carregar(${JSON.stringify(projeto)}).onde) } catch (e) { console.log('ERRO ' + e.code + ' ' + e.message.split('\\n')[0]) }`
    const semNada = roda(carregar, { HOME: casa, npm_config_prefix: path.join(casa, 'npm-vazio') })
    if (!/^ERRO SEM_PLAYWRIGHT/.test(semNada.stdout)) return t.skip(`o caso "sem nada" não se reproduz aqui: achou ${semNada.stdout.trim()}`)
    assert.match(semNada.stdout, /^ERRO SEM_PLAYWRIGHT Playwright not found on this machine\./)
    const comCaminho = roda(carregar, { HOME: casa, PLAYWRIGHT_PATH: falso, npm_config_prefix: path.join(casa, 'npm-vazio') })
    assert.equal(comCaminho.stdout.trim(), falso)
    assert.equal(JSON.parse(fs.readFileSync(path.join(casa, '.cache', 'videostudio', 'playwright.json'), 'utf8')).onde, falso)
    const depois = roda(carregar, { HOME: casa, npm_config_prefix: path.join(casa, 'npm-vazio') })
    assert.equal(depois.stdout.trim(), falso, 'sem PLAYWRIGHT_PATH, achou pela memória')
  } finally { fs.rmSync(casa, { recursive: true, force: true }) }
})
