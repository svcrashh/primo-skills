// node --test tests/requisitos.test.mjs   (sem rede): o requisitos.mjs, que o instalador roda logo depois de ligar a
// skill, num HOME de mentira e com um PATH que só tem o que o teste põe: diz o que tem (✔), o que falta e é obrigatório
// (✖: ffmpeg, a conferência do ambiente) e o que é opcional (○: as chaves), com os passos embaixo de cada falta; sai 1
// só quando falta o obrigatório; nunca mostra o valor de uma chave; não grava nada; fala inglês com --lang en; roda
// pelo link da skill; e, fora do macOS, só diz que ainda é só para Mac.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const SKILL = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const REQ = path.join(SKILL, 'scripts', 'requisitos.mjs'), AMB = path.join(SKILL, 'scripts', 'environment.mjs')
const mac = process.platform === 'darwin'
const soMac = { skip: !mac && 'a primo-videos só roda no macOS: fora dele, o requisitos.mjs só diz isso' }
const EL = 'sk-el-FAKE-1234567890', OA = 'sk-oa-FAKE-0987654321'

// um HOME vazio e um PATH só com os "executáveis" pedidos; nada do ambiente de verdade (nem as chaves) entra
function casa(t, { bin = [] } = {}) {
  const c = fs.mkdtempSync(path.join(os.tmpdir(), 'vs-req-'))
  t.after(() => fs.rmSync(c, { recursive: true, force: true }))
  const home = path.join(c, 'home'), dirBin = path.join(c, 'bin')
  fs.mkdirSync(home); fs.mkdirSync(dirBin)
  for (const n of bin) { fs.writeFileSync(path.join(dirBin, n), '#!/bin/sh\nexit 0\n'); fs.chmodSync(path.join(dirBin, n), 0o755) }
  const env = { HOME: home, USERPROFILE: home, PATH: dirBin }
  const roda = (extra = {}, ...a) => spawnSync(process.execPath, [REQ, ...a], { encoding: 'utf8', cwd: c, env: { ...env, ...extra } })
  // o environment.json de uma conferência que terminou: o Playwright e o Python apontam para o que existe
  const ambiente = (o = {}) => {
    const vs = path.join(home, '.videostudio')
    fs.mkdirSync(vs, { recursive: true })
    const existe = path.join(c, 'existe')
    fs.writeFileSync(existe, '')
    fs.writeFileSync(path.join(vs, 'environment.json'), JSON.stringify({ versao: 1, quando: '2026-01-02T03:04:05.000Z', playwright: existe, python: existe, ...o }))
  }
  const segredo = (arq, conteudo) => {
    fs.mkdirSync(path.join(home, '.claude', 'secrets'), { recursive: true })
    fs.writeFileSync(path.join(home, '.claude', 'secrets', arq), conteudo)
  }
  return { c, home, env, roda, ambiente, segredo }
}
// a linha que começa com a marca, e as recuadas logo abaixo dela
function bloco(saida, comeco) {
  const ls = saida.split('\n'), i = ls.findIndex((l) => l.startsWith(comeco))
  assert.ok(i >= 0, `não achei a linha "${comeco}" em:\n${saida}`)
  let j = i + 1
  while (j < ls.length && ls[j].startsWith('    ')) j++
  return ls.slice(i, j).join('\n')
}
const arvore = (dir) => fs.readdirSync(dir, { recursive: true }).sort().map((n) => {
  const p = path.join(dir, n), st = fs.statSync(p)
  return `${n} ${st.isFile() ? fs.readFileSync(p, 'utf8') : 'dir'}`
})
const semValor = (r) => { for (const v of [EL, OA, 'FAKE']) assert.ok(!`${r.stdout}${r.stderr}`.includes(v), 'a chave apareceu na saída') }

test('primeira vez na máquina: falta o ffmpeg e a conferência (código 1), e cada falta diz o que fazer', soMac, (t) => {
  const { home, roda } = casa(t)
  const antes = arvore(home), t0 = Date.now()
  const r = roda()
  assert.ok(Date.now() - t0 < 2000, 'leve: menos de 2 s')
  assert.equal(r.status, 1, r.stderr)
  assert.equal(r.stderr, '')
  const ls = r.stdout.trimEnd().split('\n')
  assert.match(ls[0], /^primo-videos: faz vídeo do seu produto/)
  assert.ok(ls.slice(1).every((l) => /^[✔✖○] |^ {4}\S|^ {4} +\S/.test(l)), `toda linha é uma coisa (✔ ✖ ○) ou um passo recuado:\n${r.stdout}`)
  assert.match(r.stdout, /^✔ Node\.js \d+\.\d+\.\d+$/m)

  const ff = bloco(r.stdout, '✖ ffmpeg')
  assert.match(ff, /\n {6}brew install ffmpeg\n/)
  assert.match(ff, /Homebrew[^\n]*brew\.sh[^\n]*\n {6}\/bin\/bash -c "\$\(curl -fsSL https:\/\/raw\.githubusercontent\.com\/Homebrew\/install\/HEAD\/install\.sh\)"/, 'sem brew no PATH, ensina a instalar o Homebrew')

  const amb = bloco(r.stdout, '✖ Conferência do ambiente: ainda não foi feita')
  assert.match(amb, /\n {6}node \S*environment\.mjs --fix\n/)
  assert.match(amb, /Playwright e o Chromium/)
  assert.match(amb, /--yes[^\n]*~150 MB/)

  const voz = bloco(r.stdout, '○ Voz em off: chave da ElevenLabs (ELEVENLABS_API_KEY), opcional e paga')
  assert.match(voz, /só a voz em off fica desligada; o resto funciona/)
  assert.match(voz, /1\. Crie a chave em elevenlabs\.io, no menu da esquerda, em "Developers" → "API Keys" \(elevenlabs\.io\/app\/settings\/api-keys\)\. Ela gasta os créditos do plano/)
  assert.match(voz, /\n {9}mkdir -p ~\/\.claude\/secrets && chmod 700 ~\/\.claude\/secrets\n/)
  assert.match(voz, /\n {9}touch ~\/\.claude\/secrets\/elevenlabs\.env && chmod 600 ~\/\.claude\/secrets\/elevenlabs\.env\n/)
  assert.match(voz, /3\. Abra o arquivo no seu editor \(open -e ~\/\.claude\/secrets\/elevenlabs\.env[^\n]*ELEVENLABS_API_KEY=/)
  assert.match(voz, /4\. Confira: node \S*requisitos\.mjs\./)
  assert.match(voz, /nunca vai na conversa com o Claude, nunca vai para o git e nunca é impressa/)

  const img = bloco(r.stdout, '○ Imagem gerada: chave da OpenAI (OPENAI_API_KEY), opcional e paga')
  assert.match(img, /só a imagem gerada fica desligada; o resto funciona/)
  assert.match(img, /platform\.openai\.com, em "API keys"\. A API é paga por uso e é separada da assinatura do ChatGPT: precisa de crédito na conta da API \(em "Billing"\)/)
  assert.match(img, /touch ~\/\.claude\/secrets\/openai\.env && chmod 600 ~\/\.claude\/secrets\/openai\.env/)
  assert.match(img, /OPENAI_API_KEY=/)

  assert.deepEqual(arvore(home), antes, 'não grava nada: nem o environment.json, nem o venv, nem a pasta das chaves')
})

test('só falta o opcional: código 0, e com brew no PATH não ensina o Homebrew', soMac, (t) => {
  const { home, roda, ambiente } = casa(t, { bin: ['ffmpeg', 'ffprobe', 'brew'] })
  ambiente()
  const antes = arvore(home)
  const r = roda()
  assert.equal(r.status, 0, r.stdout)
  assert.match(r.stdout, /^✔ ffmpeg e ffprobe$/m)
  assert.match(r.stdout, /^✔ Conferência do ambiente: feita em 2026-01-02 \(~\/\.videostudio\/environment\.json\)$/m)
  assert.match(r.stdout, /^○ Voz em off/m)
  assert.match(r.stdout, /^○ Imagem gerada/m)
  assert.doesNotMatch(r.stdout, /^✖/m)
  assert.doesNotMatch(r.stdout, /Homebrew/)
  assert.deepEqual(arvore(home), antes, 'não grava nada')
})

test('só o ffprobe faltando já é ffmpeg faltando (o brew install ffmpeg traz os dois)', soMac, (t) => {
  const { roda, ambiente } = casa(t, { bin: ['ffmpeg', 'brew'] })
  ambiente()
  const r = roda()
  assert.equal(r.status, 1)
  assert.match(bloco(r.stdout, '✖ ffmpeg'), /brew install ffmpeg/)
})

test('a conferência que não terminou, ou que aponta para o que saiu da máquina, falta (código 1)', soMac, (t) => {
  const { c, roda, ambiente } = casa(t, { bin: ['ffmpeg', 'ffprobe', 'brew'] })
  ambiente({ playwright: null })
  const r = roda()
  assert.equal(r.status, 1)
  assert.match(bloco(r.stdout, '✖ Conferência do ambiente: rodou, mas ficou faltando coisa'), /environment\.mjs --fix[^\n]*\n[^\n]*\n[^\n]*--yes/)
  ambiente({ python: path.join(c, 'nao-existe-mais') })
  assert.equal(roda().status, 1)
  ambiente()
  assert.equal(roda().status, 0)
  // o environment.json ilegível conta como não feito
  fs.writeFileSync(path.join(c, 'home', '.videostudio', 'environment.json'), '{ quebrado')
  assert.match(roda().stdout, /^✖ Conferência do ambiente: ainda não foi feita/m)
})

test('as chaves: ditas com a origem e sem o valor, e não mudam o código de saída', soMac, (t) => {
  const { home, roda, ambiente, segredo } = casa(t, { bin: ['ffmpeg', 'ffprobe', 'brew'] })
  ambiente()
  segredo('openai.env', `# a chave da OpenAI\nexport OPENAI_API_KEY="${OA}"\n`)
  const antes = arvore(home)
  for (const lang of [[], ['--lang', 'en']]) {
    const r = roda({ ELEVENLABS_API_KEY: EL }, ...lang)
    semValor(r)
    assert.equal(r.status, 0)
    assert.doesNotMatch(r.stdout, /^[✖○]/m)
  }
  const r = roda({ ELEVENLABS_API_KEY: EL })
  assert.match(r.stdout, /^✔ Voz em off: chave da ElevenLabs \(ELEVENLABS_API_KEY\) encontrada na variável de ambiente$/m)
  assert.match(r.stdout, /^✔ Imagem gerada: chave da OpenAI \(OPENAI_API_KEY\) encontrada em ~\/\.claude\/secrets\/openai\.env$/m)
  assert.deepEqual(arvore(home), antes, 'não grava nada')

  // a linha vazia (ou só aspas) é chave nenhuma; a chave no arquivo da ElevenLabs também conta
  segredo('openai.env', 'OPENAI_API_KEY=""\n')
  segredo('elevenlabs.env', `ELEVENLABS_API_KEY=${EL}\n`)
  const r2 = roda()
  semValor(r2)
  assert.equal(r2.status, 0, 'falta só o opcional')
  assert.match(r2.stdout, /^✔ Voz em off: [^\n]*encontrada em ~\/\.claude\/secrets\/elevenlabs\.env$/m)
  assert.match(r2.stdout, /^○ Imagem gerada/m)
})

test('--lang en: o mesmo bloco, em inglês, com o mesmo código de saída', soMac, (t) => {
  const { roda } = casa(t)
  const pt = roda(), en = roda({}, '--lang', 'en')
  assert.equal(en.status, pt.status)
  assert.equal(en.stdout.split('\n').length, pt.stdout.split('\n').length, 'as mesmas linhas')
  assert.match(en.stdout, /^primo-videos: makes a video of your product/)
  assert.match(en.stdout, /^✖ Environment check: not done yet/m)
  assert.match(en.stdout, /^○ Voiceover: ElevenLabs key \(ELEVENLABS_API_KEY\), optional and paid\. Without it, only the voiceover is off/m)
  assert.match(en.stdout, /^○ Generated images: OpenAI key \(OPENAI_API_KEY\), optional and paid\. Without it, only generated images are off/m)
  assert.match(en.stdout, /separate from the ChatGPT subscription: it needs credit on the API account \(under "Billing"\)/)
  assert.match(en.stdout, /In Terminal, run:/)
  assert.doesNotMatch(en.stdout, /Conferência|opcional|No Terminal/)
  assert.match(roda({}, '--lang', 'en-US').stdout, /^primo-videos: makes/)
})

test('pelo link da skill: responde igual, e os comandos saem pelo ~/.claude/skills/primo-videos', soMac, (t) => {
  const { home, roda, env } = casa(t)
  const link = path.join(home, '.claude', 'skills', 'primo-videos')
  fs.mkdirSync(path.dirname(link), { recursive: true })
  fs.symlinkSync(SKILL, link, 'dir')
  const r = spawnSync(process.execPath, [path.join(link, 'scripts', 'requisitos.mjs')], { encoding: 'utf8', cwd: os.tmpdir(), env })
  assert.equal(r.status, 1, r.stderr)
  assert.equal(r.stdout, roda().stdout, 'pelo link e pelo caminho real, a mesma saída')
  assert.match(r.stdout, /\n {6}node ~\/\.claude\/skills\/primo-videos\/scripts\/environment\.mjs --fix\n/)
  assert.match(r.stdout, /4\. Confira: node ~\/\.claude\/skills\/primo-videos\/scripts\/requisitos\.mjs\./)
  // o environment.mjs, que agora só roda chamado direto, também responde pelo link
  const a = spawnSync(process.execPath, [path.join(link, 'scripts', 'environment.mjs'), '--json'], { encoding: 'utf8', cwd: os.tmpdir(), env })
  assert.equal(a.status, 0, a.stderr)
  assert.ok(JSON.parse(a.stdout).sistema)
})

test('importado, o environment.mjs não roda o diagnóstico', (t) => {
  const { env } = casa(t)
  const r = spawnSync(process.execPath, ['--input-type=module', '-e', `const m = await import(${JSON.stringify(new URL(`file://${AMB}`).href)}); console.log(Object.keys(m).sort().join(' '))`], { encoding: 'utf8', env })
  assert.equal(r.status, 0, r.stderr)
  assert.equal(r.stdout.trim(), 'ambienteVelho curto noPath opcionais')
})

test('fora do macOS: só diz que, por enquanto, é só para Mac (código 1)', () => {
  const finge = ['--import', `data:text/javascript,Object.defineProperty(process,'platform',{value:'win32'})`]
  const r = spawnSync(process.execPath, [...finge, REQ], { encoding: 'utf8', env: { HOME: os.tmpdir(), PATH: '' } })
  assert.equal(r.status, 1, r.stderr)
  const ls = r.stdout.trimEnd().split('\n')
  assert.match(ls[0], /^primo-videos: /)
  assert.equal(ls[1], '✖ macOS: a primo-videos, por enquanto, é só para Mac.')
  assert.match(ls[2], /^ {4}Neste Windows ela ainda não roda/)
  assert.equal(ls.length, 3, 'nada de ffmpeg, ambiente ou chaves num sistema em que ela não roda')
  const en = spawnSync(process.execPath, [...finge, REQ, '--lang', 'en'], { encoding: 'utf8', env: { HOME: os.tmpdir(), PATH: '' } })
  assert.match(en.stdout, /^✖ macOS: primo-videos is Mac-only for now\.$/m)
})
