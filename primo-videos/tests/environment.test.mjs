// node --test tests/   (sem rede): o ~/.videostudio/environment.json (VIDEOSTUDIO_HOME numa pasta temporária) manda no
// Playwright e no Python: o playwright.cjs, mesmo copiado sozinho, põe o do environment.json logo depois do
// PLAYWRIGHT_PATH; o acharPython do where.cjs prefere o do environment.json ao python3; o environment.mjs diagnostica em JSON
// e o --fix grava o environment.json sem baixar nada quando o que precisa já existe (e, sem --yes, não baixa); as chaves
// opcionais da voz e das imagens aparecem sem o valor e não mudam o código de saída.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const SCRIPTS = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'scripts')
const PW = path.join(SCRIPTS, 'playwright.cjs'), ONDE = path.join(SCRIPTS, 'where.cjs'), AMB = path.join(SCRIPTS, 'environment.mjs')
const win = process.platform === 'win32'

// uma casa isolada: HOME e VIDEOSTUDIO_HOME temporários, sem as variáveis que forçam caminho
function casa(t) {
  const c = fs.mkdtempSync(path.join(os.tmpdir(), 'vs-amb-'))
  t.after(() => fs.rmSync(c, { recursive: true, force: true }))
  const vh = path.join(c, 'vs')
  fs.mkdirSync(vh)
  const env = { PATH: process.env.PATH, HOME: c, USERPROFILE: c, VIDEOSTUDIO_HOME: vh, npm_config_prefix: path.join(c, 'npm-vazio') }
  return { c, vh, env, ambiente: (o) => fs.writeFileSync(path.join(vh, 'environment.json'), JSON.stringify({ versao: 1, ...o })) }
}
const no = (codigo, env) => spawnSync(process.execPath, ['-e', codigo], { encoding: 'utf8', cwd: env.HOME, env })

// um "playwright" de mentira: o Chromium é o próprio arquivo e o navegador responde o WebGL
function pwFalso(dir) {
  fs.mkdirSync(dir, { recursive: true })
  fs.writeFileSync(path.join(dir, 'package.json'), '{"name":"playwright","version":"9.9.9","main":"index.js"}')
  fs.writeFileSync(path.join(dir, 'index.js'), `const pagina = { evaluate: async () => 'WebGL de teste', close: async () => {} }
module.exports = { chromium: { executablePath: () => __filename, launch: async () => ({ newPage: async () => pagina, close: async () => {} }) } }`)
  return dir
}
// um "python" de mentira: sai 0 para tudo (inclusive -c "import numpy, scipy")
function pyFalso(arq) {
  fs.mkdirSync(path.dirname(arq), { recursive: true })
  fs.writeFileSync(arq, '#!/bin/sh\nexit 0\n')
  fs.chmodSync(arq, 0o755)
  return arq
}

test('o playwright.cjs põe o environment.json.playwright logo depois do PLAYWRIGHT_PATH', (t) => {
  const { c, env, ambiente } = casa(t)
  const forcado = pwFalso(path.join(c, 'forcado', 'node_modules', 'playwright'))
  const doAmbiente = pwFalso(path.join(c, 'consertado', 'node_modules', 'playwright'))
  ambiente({ playwright: doAmbiente })
  const lista = (e) => JSON.parse(no(`console.log(JSON.stringify(require(${JSON.stringify(PW)}).candidatos()))`, e).stdout)
  assert.deepEqual(lista({ ...env, PLAYWRIGHT_PATH: forcado }).slice(0, 2), [forcado, doAmbiente])
  assert.equal(lista(env)[0], doAmbiente, 'sem PLAYWRIGHT_PATH, o do environment.json vem primeiro')
})

test('a cópia solta do playwright.cjs (tools/ de um projeto) também lê o environment.json', (t) => {
  const { c, vh, env, ambiente } = casa(t)
  const doAmbiente = pwFalso(path.join(c, 'consertado', 'node_modules', 'playwright'))
  ambiente({ playwright: doAmbiente })
  const solta = path.join(c, 'projeto', 'tools', 'playwright.cjs')
  fs.mkdirSync(path.dirname(solta), { recursive: true })
  fs.copyFileSync(PW, solta)
  const onde = (e) => no(`console.log(require(${JSON.stringify(solta)}).carregar(${JSON.stringify(path.join(c, 'projeto'))}).onde)`, e).stdout.trim()
  assert.equal(onde(env), doAmbiente, 'com VIDEOSTUDIO_HOME')
  // sem VIDEOSTUDIO_HOME, o padrão é ~/.videostudio
  const padrao = path.join(c, '.videostudio')
  fs.mkdirSync(padrao)
  fs.renameSync(path.join(vh, 'environment.json'), path.join(padrao, 'environment.json'))
  const { VIDEOSTUDIO_HOME, ...semVh } = env
  assert.equal(onde(semVh), doAmbiente, 'com ~/.videostudio/environment.json')
})

test('o acharPython prefere o do environment.json ao python3, e as variáveis ao environment.json', { skip: win && 'o python falso é um script de shell' }, (t) => {
  const { c, vh, env, ambiente } = casa(t)
  const achar = (e, extras = []) => no(`console.log(require(${JSON.stringify(ONDE)}).acharPython({ extras: ${JSON.stringify(extras)} }))`, e).stdout.trim()
  const doAmbiente = pyFalso(path.join(c, 'consertado', 'python'))
  const doProjeto = pyFalso(path.join(c, 'projeto', '.venv', 'bin', 'python'))
  // antes do conserto: o .venv do projeto (extras) vem antes do python3
  assert.equal(achar(env, [doProjeto]), doProjeto)
  ambiente({ python: doAmbiente })
  assert.equal(achar(env, [doProjeto]), doAmbiente, 'o do environment.json vem antes dos extras e do python3')
  assert.equal(no(`console.log(require(${JSON.stringify(ONDE)}).lerAmbiente().python)`, env).stdout.trim(), doAmbiente)
  const forcado = pyFalso(path.join(c, 'forcado', 'python'))
  for (const v of ['VIDEOSTUDIO_PYTHON', 'PYTHON']) assert.equal(achar({ ...env, [v]: forcado }), forcado, v)
  // o environment.json ilegível não quebra: cai no venv da skill
  fs.writeFileSync(path.join(vh, 'environment.json'), '{ quebrado')
  assert.equal(no(`console.log(require(${JSON.stringify(ONDE)}).lerAmbiente())`, env).stdout.trim(), 'null')
  const doVenv = pyFalso(path.join(vh, 'venv', 'bin', 'python'))
  assert.equal(achar(env, [doProjeto]), doVenv)
})

test('environment.mjs --json roda e mostra o environment.json', (t) => {
  const { c, vh, env, ambiente } = casa(t)
  const r1 = spawnSync(process.execPath, [AMB, '--json'], { encoding: 'utf8', cwd: c, env })
  assert.equal(r1.status, 0, r1.stderr)
  const j1 = JSON.parse(r1.stdout)
  assert.ok(j1.sistema && Array.isArray(j1.falta))
  assert.equal(j1.arquivo_ambiente, path.join(vh, 'environment.json'))
  assert.equal(j1.ambiente, null)
  assert.match(j1.consertar, /environment\.mjs --fix$/, 'sem environment.json, sugere o conserto')
  ambiente({ playwright: '/x', python: '/y' })
  const j2 = JSON.parse(spawnSync(process.execPath, [AMB, '--json'], { encoding: 'utf8', cwd: c, env }).stdout)
  assert.deepEqual([j2.ambiente.playwright, j2.ambiente.python], ['/x', '/y'])
  assert.ok(j2.consertar, 'o environment.json aponta para o que não existe: sugere o conserto')
})

test('environment.mjs --fix grava o environment.json com o que já existe, sem baixar nada', { skip: win && 'o python falso é um script de shell' }, (t) => {
  const { c, vh, env } = casa(t)
  const pw = pwFalso(path.join(c, 'outra', 'node_modules', 'playwright'))
  const venv = pyFalso(path.join(vh, 'venv', 'bin', 'python'))
  const r = spawnSync(process.execPath, [AMB, '--fix', '--json'], { encoding: 'utf8', cwd: c, env: { ...env, PLAYWRIGHT_PATH: pw } })
  const j = JSON.parse(r.stdout)
  const gravado = JSON.parse(fs.readFileSync(path.join(vh, 'environment.json'), 'utf8'))
  assert.equal(gravado.versao, 1)
  assert.equal(gravado.playwright, pw)
  assert.equal(gravado.chromium, fs.realpathSync(path.join(pw, 'index.js')))
  assert.equal(gravado.python, venv, 'o venv da skill já tinha numpy e scipy: nada de pip')
  assert.equal(j.webgl, 'WebGL de teste')
  assert.ok(!Number.isNaN(Date.parse(gravado.quando)))
  assert.equal(r.status, gravado.ffmpeg && gravado.ffprobe ? 0 : 2, r.stderr)
  assert.ok(!fs.existsSync(path.join(vh, 'node')), 'não baixou Playwright')
})

test('environment.mjs --fix sem Playwright e sem --yes diz o que baixaria e não baixa', { skip: win && 'o python falso é um script de shell' }, (t) => {
  const { c, vh, env } = casa(t)
  pyFalso(path.join(vh, 'venv', 'bin', 'python'))
  const achado = no(`console.log(require(${JSON.stringify(PW)}).candidatos(${JSON.stringify(c)})[0] || '')`, env).stdout.trim()
  if (achado) return t.skip(`há um Playwright alcançável mesmo numa casa vazia: ${achado}`)
  const r = spawnSync(process.execPath, [AMB, '--fix'], { encoding: 'utf8', cwd: c, env })
  assert.equal(r.status, 2)
  assert.match(r.stdout, /~150 MB/)
  assert.match(r.stdout, /npm i playwright --prefix/)
  assert.match(r.stdout, /--fix --yes/)
  assert.match(r.stdout, /environment incomplete/)
  assert.ok(!fs.existsSync(path.join(vh, 'node')), 'sem --yes, não baixa')
  assert.equal(JSON.parse(fs.readFileSync(path.join(vh, 'environment.json'), 'utf8')).playwright, null)
})

// as chaves opcionais (voz e imagens): o environment.mjs diz se existem e de onde, nunca o valor, e elas não mudam o
// código de saída nem o que falta
const EL = 'sk-el-FAKE-1234567890', OA = 'sk-oa-FAKE-0987654321'
function segredo(c, arq, conteudo) {
  const d = path.join(c, '.claude', 'secrets')
  fs.mkdirSync(d, { recursive: true })
  fs.writeFileSync(path.join(d, arq), conteudo)
}
const semValor = (r, msg) => { for (const v of [EL, OA]) assert.ok(!`${r.stdout}${r.stderr}`.includes(v), `${msg}: a chave apareceu na saída`) }

test('environment.mjs: as chaves da voz e das imagens são opcionais, ditas sem o valor, e não mudam o código de saída', (t) => {
  const { c, env } = casa(t)
  const roda = (e, ...a) => spawnSync(process.execPath, [AMB, ...a], { encoding: 'utf8', cwd: c, env: e })
  const sem = roda(env)
  assert.match(sem.stdout, /^voice\s+ELEVENLABS_API_KEY not found · optional, paid/m)
  assert.match(sem.stdout, /^images\s+OPENAI_API_KEY not found · optional, paid/m)
  assert.match(sem.stdout, /OPTIONAL \(paid[^\n]*\n {2}· ELEVENLABS_API_KEY: [^\n]*voice\.mjs account[^\n]*\n {2}· OPENAI_API_KEY: [^\n]*openai\.env/)
  const jSem = JSON.parse(roda(env, '--json').stdout)
  assert.deepEqual([jSem.opcional.voz.ok, jSem.opcional.imagens.ok], [false, false])

  segredo(c, 'openai.env', `# a chave da OpenAI\nexport OPENAI_API_KEY="${OA}"\n`)
  const comChave = { ...env, ELEVENLABS_API_KEY: EL }
  const com = roda(comChave)
  semValor(com, 'texto')
  assert.equal(com.status, sem.status, 'a chave não muda o código de saída')
  assert.match(com.stdout, /ELEVENLABS_API_KEY found \(environment\)/)
  assert.match(com.stdout, /OPENAI_API_KEY found \(~\/\.claude\/secrets\/openai\.env\)/)
  assert.doesNotMatch(com.stdout, /OPTIONAL/)
  const rj = roda(comChave, '--json')
  semValor(rj, '--json')
  const j = JSON.parse(rj.stdout)
  assert.deepEqual([j.opcional.voz.ok, j.opcional.voz.de, j.opcional.imagens.ok, j.opcional.imagens.de], [true, 'ambiente', true, 'arquivo'])
  assert.deepEqual(j.falta, jSem.falta, 'a chave não entra no que falta')
  assert.equal(j.consertar, jSem.consertar)

  // linha vazia (ou só aspas) no arquivo = sem chave
  segredo(c, 'elevenlabs.env', 'ELEVENLABS_API_KEY=\n')
  segredo(c, 'openai.env', 'OPENAI_API_KEY=""\n')
  const vazia = roda(env)
  assert.match(vazia.stdout, /ELEVENLABS_API_KEY not found/)
  assert.match(vazia.stdout, /OPENAI_API_KEY not found/)
  assert.equal(vazia.status, sem.status)
  // a chave no arquivo da ElevenLabs também conta
  segredo(c, 'elevenlabs.env', `ELEVENLABS_API_KEY=${EL}\n`)
  const doArquivo = roda(env)
  semValor(doArquivo, 'do arquivo')
  assert.match(doArquivo.stdout, /ELEVENLABS_API_KEY found \(~\/\.claude\/secrets\/elevenlabs\.env\)/)
})

test('environment.mjs --fix: as chaves opcionais não mudam o código de saída e não vão para a saída nem para o environment.json', { skip: win && 'o python falso é um script de shell' }, (t) => {
  const { c, vh, env } = casa(t)
  const pw = pwFalso(path.join(c, 'outra', 'node_modules', 'playwright'))
  pyFalso(path.join(vh, 'venv', 'bin', 'python'))
  const base = { ...env, PLAYWRIGHT_PATH: pw }
  const roda = (e, ...a) => spawnSync(process.execPath, [AMB, '--fix', ...a], { encoding: 'utf8', cwd: c, env: e })
  const sem = roda(base)
  assert.match(sem.stdout, /ELEVENLABS_API_KEY not found · optional/)
  assert.match(sem.stdout, /OPTIONAL \(paid/)
  segredo(c, 'openai.env', `OPENAI_API_KEY=${OA}\n`)
  const comChave = { ...base, ELEVENLABS_API_KEY: EL }
  const com = roda(comChave)
  semValor(com, '--fix')
  assert.equal(com.status, sem.status, 'a chave não muda o código de saída do conserto')
  assert.match(com.stdout, /ELEVENLABS_API_KEY found \(environment\)/)
  assert.match(com.stdout, /OPENAI_API_KEY found \(~\/\.claude\/secrets\/openai\.env\)/)
  const rj = roda(comChave, '--json')
  semValor(rj, '--fix --json')
  const j = JSON.parse(rj.stdout)
  assert.equal(rj.status, sem.status)
  assert.deepEqual([j.opcional.voz.de, j.opcional.imagens.de], ['ambiente', 'arquivo'])
  assert.ok(!j.falta.some((f) => /API_KEY/.test(f.o)), 'a chave não entra no que falta')
  const gravado = fs.readFileSync(path.join(vh, 'environment.json'), 'utf8')
  for (const v of [EL, OA]) assert.ok(!gravado.includes(v), 'a chave não vai para o environment.json')
})
