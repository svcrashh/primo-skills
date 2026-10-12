// node --test tests/   (sem rede): o ~/.videostudio/environment.json (VIDEOSTUDIO_HOME numa pasta temporária) manda no
// Playwright e no Python: o playwright.cjs, mesmo copiado sozinho, põe o do environment.json logo depois do
// PLAYWRIGHT_PATH; o acharPython do where.cjs prefere o do environment.json ao python3; o environment.mjs diagnostica em JSON
// e o --fix grava o environment.json sem baixar nada quando o que precisa já existe (e, sem --yes, não baixa); as chaves
// opcionais da voz e das imagens aparecem sem o valor e não mudam o código de saída, e o arquivo delas vale do jeito
// que o Bloco de Notas do Windows grava; o npm do conserto roda sem o aviso DEP0190.
import { test, after } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { createRequire } from 'node:module'
import { fileURLToPath, pathToFileURL } from 'node:url'

const SCRIPTS = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'scripts')
const PW = path.join(SCRIPTS, 'playwright.cjs'), ONDE = path.join(SCRIPTS, 'where.cjs'), AMB = path.join(SCRIPTS, 'environment.mjs')
const win = process.platform === 'win32'
// no Windows, o python de mentira é um venv de verdade, que só o py cria
const semPy = win && spawnSync('py', ['-3', '--version']).status !== 0 && 'no Windows, o python de mentira é um venv feito pelo py -3, e não há py nesta máquina'

// uma casa isolada: HOME (USERPROFILE, no Windows) e VIDEOSTUDIO_HOME temporários, sem as variáveis que forçam caminho
function casa(t) {
  const c = fs.mkdtempSync(path.join(os.tmpdir(), 'vs-amb-'))
  t.after(() => fs.rmSync(c, { recursive: true, force: true }))
  const vh = path.join(c, 'vs')
  fs.mkdirSync(vh)
  // o SystemRoot é do Windows, não da casa: sem ele, o Python de lá pode nem abrir
  const env = { PATH: process.env.PATH, HOME: c, USERPROFILE: c, VIDEOSTUDIO_HOME: vh, npm_config_prefix: path.join(c, 'npm-vazio'), ...(win && { SystemRoot: process.env.SystemRoot }) }
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
// um "python" de mentira no venv `dir`, que importa numpy e scipy (sai 0 para -c "import numpy, scipy"); devolve o
// caminho dele. No Mac, um script de shell em bin/python que sai 0 para tudo. No Windows, que não roda script de shell,
// um venv de verdade (Scripts\python.exe) com numpy.py e scipy.py vazios: feito uma vez com o py e copiado.
let venvBase = null
after(() => { if (venvBase) fs.rmSync(path.dirname(venvBase), { recursive: true, force: true }) })
function pyFalso(dir) {
  if (!win) {
    const arq = path.join(dir, 'bin', 'python')
    fs.mkdirSync(path.dirname(arq), { recursive: true })
    fs.writeFileSync(arq, '#!/bin/sh\nexit 0\n')
    fs.chmodSync(arq, 0o755)
    return arq
  }
  if (!venvBase) {
    venvBase = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'vs-py-')), 'venv')
    const r = spawnSync('py', ['-3', '-m', 'venv', '--without-pip', venvBase], { encoding: 'utf8' })
    assert.equal(r.status, 0, `py -3 -m venv: ${r.stderr}`)
    for (const m of ['numpy', 'scipy']) fs.writeFileSync(path.join(venvBase, 'Lib', 'site-packages', `${m}.py`), '')
  }
  fs.cpSync(venvBase, dir, { recursive: true })
  return path.join(dir, 'Scripts', 'python.exe')
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

test('o acharPython prefere o do environment.json ao python3, e as variáveis ao environment.json', { skip: semPy }, (t) => {
  const { c, vh, env, ambiente } = casa(t)
  const achar = (e, extras = []) => no(`console.log(require(${JSON.stringify(ONDE)}).acharPython({ extras: ${JSON.stringify(extras)} }))`, e).stdout.trim()
  const doAmbiente = pyFalso(path.join(c, 'consertado'))
  const doProjeto = pyFalso(path.join(c, 'projeto', '.venv'))
  // antes do conserto: o .venv do projeto (extras) vem antes do python3
  assert.equal(achar(env, [doProjeto]), doProjeto)
  ambiente({ python: doAmbiente })
  assert.equal(achar(env, [doProjeto]), doAmbiente, 'o do environment.json vem antes dos extras e do python3')
  assert.equal(no(`console.log(require(${JSON.stringify(ONDE)}).lerAmbiente().python)`, env).stdout.trim(), doAmbiente)
  const forcado = pyFalso(path.join(c, 'forcado'))
  for (const v of ['VIDEOSTUDIO_PYTHON', 'PYTHON']) assert.equal(achar({ ...env, [v]: forcado }), forcado, v)
  // o environment.json ilegível não quebra: cai no venv da skill
  fs.writeFileSync(path.join(vh, 'environment.json'), '{ quebrado')
  assert.equal(no(`console.log(require(${JSON.stringify(ONDE)}).lerAmbiente())`, env).stdout.trim(), 'null')
  const doVenv = pyFalso(path.join(vh, 'venv'))
  assert.equal(achar(env, [doProjeto]), doVenv, 'o venv da skill (bin/python; no Windows, Scripts\\python.exe)')
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

test('environment.mjs --fix grava o environment.json com o que já existe, sem baixar nada', { skip: semPy }, (t) => {
  const { c, vh, env } = casa(t)
  const pw = pwFalso(path.join(c, 'outra', 'node_modules', 'playwright'))
  const venv = pyFalso(path.join(vh, 'venv'))
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

test('environment.mjs --fix sem Playwright e sem --yes diz o que baixaria e não baixa', { skip: semPy }, (t) => {
  const { c, vh, env } = casa(t)
  pyFalso(path.join(vh, 'venv'))
  const achado = no(`console.log(require(${JSON.stringify(PW)}).candidatos(${JSON.stringify(c)})[0] || '')`, env).stdout.trim()
  if (achado) return t.skip(`há um Playwright alcançável mesmo numa casa vazia: ${achado}`)
  const r = spawnSync(process.execPath, [AMB, '--fix'], { encoding: 'utf8', cwd: c, env })
  assert.equal(r.status, 2)
  // o Chromium e o Chromium headless que vem junto: no Windows, medido, 197 + 118 MiB
  assert.match(r.stdout, win ? /~300 MB/ : /~150 MB/)
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
// o arquivo da chave como cada sistema o mostra: no Windows, como o Explorer e o cmd entendem
const mostrado = (arq) => (win ? `%USERPROFILE%\\.claude\\secrets\\${arq}` : `~/.claude/secrets/${arq}`)

test('environment.mjs: as chaves da voz e das imagens são opcionais, ditas sem o valor, e não mudam o código de saída', (t) => {
  const { c, env } = casa(t)
  const roda = (e, ...a) => spawnSync(process.execPath, [AMB, ...a], { encoding: 'utf8', cwd: c, env: e })
  const sem = roda(env)
  assert.match(sem.stdout, /^voice\s+ELEVENLABS_API_KEY not found · optional, paid/m)
  assert.match(sem.stdout, /^images\s+OPENAI_API_KEY not found · optional, paid/m)
  assert.match(sem.stdout, /OPTIONAL \(paid[^\n]*\n {2}· ELEVENLABS_API_KEY: [^\n]*voice\.mjs account[^\n]*\n {2}· OPENAI_API_KEY: [^\n]*openai\.env/)
  // no Windows, a variável que se põe no PowerShell some quando ele fecha: o conselho é o arquivo, no Bloco de Notas
  if (win) {
    assert.ok(sem.stdout.includes(`save the line ELEVENLABS_API_KEY=… in ${mostrado('elevenlabs.env')} (`), sem.stdout)
    assert.ok(sem.stdout.includes('PowerShell command that asks for it without showing it'), sem.stdout)
    assert.ok(sem.stdout.includes('New-Item -ItemType Directory -Force "$env:USERPROFILE\\.claude\\secrets" | Out-Null, then notepad "$env:USERPROFILE\\.claude\\secrets\\openai.env"'), sem.stdout)
    assert.doesNotMatch(sem.stdout, /export |~\//)
  } else assert.match(sem.stdout, /· OPENAI_API_KEY: [^\n]*To turn it on: export OPENAI_API_KEY, or write the line OPENAI_API_KEY=… in ~\/\.claude\/secrets\/openai\.env/)
  const jSem = JSON.parse(roda(env, '--json').stdout)
  assert.deepEqual([jSem.opcional.voz.ok, jSem.opcional.imagens.ok], [false, false])

  segredo(c, 'openai.env', `# a chave da OpenAI\nexport OPENAI_API_KEY="${OA}"\n`)
  const comChave = { ...env, ELEVENLABS_API_KEY: EL }
  const com = roda(comChave)
  semValor(com, 'texto')
  assert.equal(com.status, sem.status, 'a chave não muda o código de saída')
  assert.match(com.stdout, /ELEVENLABS_API_KEY found \(environment\)/)
  assert.ok(com.stdout.includes(`OPENAI_API_KEY found (${mostrado('openai.env')})`), com.stdout)
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
  assert.ok(doArquivo.stdout.includes(`ELEVENLABS_API_KEY found (${mostrado('elevenlabs.env')})`), doArquivo.stdout)
})

test('environment.mjs --fix: as chaves opcionais não mudam o código de saída e não vão para a saída nem para o environment.json', { skip: semPy }, (t) => {
  const { c, vh, env } = casa(t)
  const pw = pwFalso(path.join(c, 'outra', 'node_modules', 'playwright'))
  pyFalso(path.join(vh, 'venv'))
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
  assert.ok(com.stdout.includes(`OPENAI_API_KEY found (${mostrado('openai.env')})`), com.stdout)
  const rj = roda(comChave, '--json')
  semValor(rj, '--fix --json')
  const j = JSON.parse(rj.stdout)
  assert.equal(rj.status, sem.status)
  assert.deepEqual([j.opcional.voz.de, j.opcional.imagens.de], ['ambiente', 'arquivo'])
  assert.ok(!j.falta.some((f) => /API_KEY/.test(f.o)), 'a chave não entra no que falta')
  const gravado = fs.readFileSync(path.join(vh, 'environment.json'), 'utf8')
  for (const v of [EL, OA]) assert.ok(!gravado.includes(v), 'a chave não vai para o environment.json')
})

test('o arquivo da chave vale do jeito que o Bloco de Notas grava: com BOM (UTF-8, UTF-16 LE e BE) e com CRLF', (t) => {
  const { c, env } = casa(t)
  const { lerChaveDoArquivo } = createRequire(import.meta.url)(ONDE)
  const arq = path.join(c, 'chave.env')
  const le = (conteudo) => { fs.writeFileSync(arq, conteudo); return lerChaveDoArquivo(arq, 'OPENAI_API_KEY') }
  const bom = (b, txt, enc) => Buffer.concat([Buffer.from(b), enc === 'utf16be' ? Buffer.from(txt, 'utf16le').swap16() : Buffer.from(txt, enc)])
  const casos = {
    'UTF-8 com BOM e CRLF': bom([0xef, 0xbb, 0xbf], `# a chave\r\nOPENAI_API_KEY=${OA}\r\n`, 'utf8'),
    'UTF-16 LE (o "Unicode" do Bloco de Notas) com CRLF': bom([0xff, 0xfe], `OPENAI_API_KEY=${OA}\r\n`, 'utf16le'),
    'UTF-16 BE com aspas': bom([0xfe, 0xff], `OPENAI_API_KEY="${OA}"\r\n`, 'utf16be'),
    'export e aspas simples, LF': `export OPENAI_API_KEY='${OA}'\n`,
    'sem quebra no fim': `OPENAI_API_KEY=${OA}`,
    'a última linha manda': `OPENAI_API_KEY=velha\r\nOPENAI_API_KEY=${OA}\r\n`,
  }
  for (const [caso, conteudo] of Object.entries(casos)) assert.equal(le(conteudo), OA, caso)
  for (const conteudo of ['OPENAI_API_KEY=\r\n', 'OPENAI_API_KEY=""\r\n', `ELEVENLABS_API_KEY=${EL}\n`, `OPENAI_API_KEY=${OA}\nOPENAI_API_KEY=\n`, bom([0xff, 0xfe], '', 'utf16le')]) {
    assert.equal(le(conteudo), '', JSON.stringify(String(conteudo)))
  }
  assert.equal(lerChaveDoArquivo(path.join(c, 'nao-existe.env'), 'OPENAI_API_KEY'), '')

  // e o environment.mjs, que lê por ele, acha a chave salva como "Unicode", sem mostrá-la
  segredo(c, 'openai.env', casos['UTF-16 LE (o "Unicode" do Bloco de Notas) com CRLF'])
  const r = spawnSync(process.execPath, [AMB], { encoding: 'utf8', cwd: c, env })
  semValor(r, 'UTF-16')
  assert.ok(r.stdout.includes(`OPENAI_API_KEY found (${mostrado('openai.env')})`), r.stdout)
})

test('o npm do conserto roda sem shell no Windows (o npm-cli.js ao lado do node.exe) e sem o aviso DEP0190', (t) => {
  const { c } = casa(t)
  // a pasta do --prefix com espaço, como a de um usuário "Nome Sobrenome"; o `npm prefix` só a repete, sem rede
  const destino = path.join(c, 'Nome Sobrenome', 'node')
  fs.mkdirSync(destino, { recursive: true })
  // num processo à parte: o aviso DEP0190 sai no stderr de quem chama o spawn
  const codigo = `import { comandoNpm } from ${JSON.stringify(pathToFileURL(AMB).href)}
import { spawnSync } from 'node:child_process'
const casos = { desteSistema: {}, windowsSemNpmCli: { so: 'win32', node: ${JSON.stringify(path.join(c, 'node.exe'))} } }
const out = {}
for (const [nome, o] of Object.entries(casos)) {
  const [cmd, args, shell] = comandoNpm(['prefix', '--prefix', ${JSON.stringify(destino)}], o)
  const r = spawnSync(cmd, args, { encoding: 'utf8', shell })
  out[nome] = { cmd, args, shell, status: r.status, saida: (r.stdout || '').trim(), erro: r.error?.code }
}
console.log(JSON.stringify(out))`
  const r = spawnSync(process.execPath, ['--input-type=module', '-e', codigo], { encoding: 'utf8' })
  assert.equal(r.status, 0, r.stderr)
  assert.doesNotMatch(r.stderr, /DEP0190/)
  const { desteSistema: aqui, windowsSemNpmCli: semCli } = JSON.parse(r.stdout)
  for (const [nome, x] of Object.entries({ aqui, semCli })) {
    assert.equal(x.status, 0, `${nome}: ${JSON.stringify(x)}`)
    assert.equal(x.saida, destino, `${nome}: o caminho com espaço chegou inteiro ao npm`)
  }
  if (win) assert.deepEqual([aqui.cmd, aqui.args[0], aqui.shell], [process.execPath, path.join(path.dirname(process.execPath), 'node_modules', 'npm', 'bin', 'npm-cli.js'), false], 'no Windows, o npm-cli.js pelo node, sem shell')
  else assert.deepEqual([aqui.cmd, aqui.shell], ['npm', false], 'fora do Windows, o npm de sempre')
  assert.deepEqual([semCli.shell, semCli.args], [true, []], 'sem o npm-cli.js: uma linha só pelo shell, sem argumentos em lista')
  assert.match(semCli.cmd, /^npm prefix --prefix ".+Nome Sobrenome[\\/]node"$/)
})
