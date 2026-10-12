// node --test play/tests/*.test.mjs   (sem rede): o requisitos.mjs com e sem chave, com e sem ffmpeg, numa casa e num
// PATH de mentira, chamado pelo link como o instalador chama.
import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { relatorio } from '../scripts/requisitos.mjs'

const SKILL = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const CHAVE = `sk-teste-${Math.random().toString(36).slice(2)}${Math.random().toString(36).slice(2)}`
let base, link, comFfmpeg, semNada

before(() => {
  base = fs.mkdtempSync(path.join(os.tmpdir(), 'play requisitos '))
  link = path.join(base, 'skills', 'play')
  fs.mkdirSync(path.dirname(link))
  fs.symlinkSync(SKILL, link, process.platform === 'win32' ? 'junction' : 'dir')
  comFfmpeg = path.join(base, 'bin')
  semNada = path.join(base, 'vazio')
  fs.mkdirSync(comFfmpeg)
  fs.mkdirSync(semNada)
  for (const p of ['ffmpeg', 'ffprobe']) {
    fs.writeFileSync(path.join(comFfmpeg, p), '#!/bin/sh\nexit 0\n')
    fs.chmodSync(path.join(comFfmpeg, p), 0o755)
  }
})
after(() => fs.rmSync(base, { recursive: true, force: true }))

function casa(nome, arquivoDaChave = null, modo = 0o600) {
  const h = path.join(base, nome)
  fs.mkdirSync(h)
  if (arquivoDaChave != null) {
    const d = path.join(h, '.claude', 'secrets')
    fs.mkdirSync(d, { recursive: true, mode: 0o700 })
    fs.writeFileSync(path.join(d, 'openai.env'), arquivoDaChave, { mode: modo })
    fs.chmodSync(path.join(d, 'openai.env'), modo)
  }
  return h
}

function rodar(home, PATH, extra = {}) {
  const t0 = Date.now()
  const r = spawnSync(process.execPath, [path.join(link, 'scripts', 'requisitos.mjs')], { encoding: 'utf8', env: { HOME: home, USERPROFILE: home, PATH, ...extra } })
  return { ...r, ms: Date.now() - t0 }
}

/** Primeira linha: a skill e o que faz. Depois só linhas de item (✔ ✖ ○) e linhas recuadas logo abaixo delas. */
function confereFormato(saida) {
  const linhas = saida.trimEnd().split('\n')
  assert.match(linhas[0], /^play — entende um arquivo de áudio ou de vídeo/)
  for (const l of linhas.slice(1)) assert.match(l, /^([✔✖○] \S| {4,}\S)/, `linha fora do formato: "${l}"`)
}

function arvore(d) {
  const out = []
  const anda = (p) => {
    for (const n of fs.readdirSync(p, { withFileTypes: true })) {
      const q = path.join(p, n.name)
      out.push(`${path.relative(d, q)} ${fs.statSync(q).mtimeMs}`)
      if (n.isDirectory()) anda(q)
    }
  }
  anda(d)
  return out.sort()
}

test('sem chave e sem ffmpeg: os dois faltam, com o que fazer, e sai com 1', () => {
  const h = casa('casa-vazia')
  const r = rodar(h, semNada)
  assert.equal(r.status, 1, r.stderr)
  confereFormato(r.stdout)
  assert.match(r.stdout, /^✔ Node \d+/m)
  assert.match(r.stdout, /^✖ ffmpeg/m)
  assert.match(r.stdout, /^✖ chave da OpenAI/m)
  const esperado = process.platform === 'darwin'
    ? ['brew install ffmpeg', 'brew.sh', 'open -e ~/.claude/secrets/openai.env', 'chmod 600']
    : process.platform === 'win32' ? ['winget install ffmpeg', 'notepad'] : ['apt install ffmpeg', 'nano']
  for (const t of [...esperado, 'platform.openai.com', '"API keys"', '"Billing"', 'separada da assinatura do ChatGPT', 'não cole na conversa com o Claude', 'OPENAI_API_KEY=']) {
    assert.ok(r.stdout.includes(t), `falta "${t}" em:\n${r.stdout}`)
  }
  assert.ok(r.ms < 2000, `levou ${r.ms} ms`)
})

test('com a chave na variável e ffmpeg: tudo ✔ e sai com 0, sem mostrar a chave', () => {
  const h = casa('casa-variavel')
  const r = rodar(h, comFfmpeg, { OPENAI_API_KEY: CHAVE })
  assert.equal(r.status, 0, r.stdout)
  confereFormato(r.stdout)
  assert.equal(r.stdout.match(/^✔/gm).length, 3, r.stdout)
  assert.match(r.stdout, /^✔ chave da OpenAI \(na variável OPENAI_API_KEY\)$/m)
  assert.ok(!r.stdout.includes(CHAVE.slice(-10)) && !r.stderr.includes(CHAVE.slice(-10)))
})

test('com a chave no arquivo (com export e aspas): ✔, sem mostrar a chave', () => {
  const h = casa('casa-arquivo', `# minha chave\nexport OPENAI_API_KEY='${CHAVE}'\n`)
  const r = rodar(h, comFfmpeg)
  assert.equal(r.status, 0, r.stdout)
  confereFormato(r.stdout)
  assert.match(r.stdout, /^✔ chave da OpenAI \(em ~\/\.claude\/secrets\/openai\.env\)$/m)
  assert.doesNotMatch(r.stdout, /chmod/, 'arquivo 600 em pasta 700: nada a avisar')
  assert.ok(!r.stdout.includes(CHAVE.slice(-10)))
})

test('arquivo da chave aberto para outros usuários: avisa como fechar', { skip: process.platform === 'win32' }, () => {
  const h = casa('casa-aberta', `OPENAI_API_KEY=${CHAVE}\n`, 0o644)
  const r = rodar(h, comFfmpeg)
  assert.equal(r.status, 0)
  confereFormato(r.stdout)
  assert.match(r.stdout, /Outros usuários desta máquina conseguem ler a chave/)
  assert.match(r.stdout, /chmod 700 ~\/\.claude\/secrets && chmod 600 ~\/\.claude\/secrets\/openai\.env/)
})

test('arquivo sem a linha da chave: diz o que falta nele', () => {
  const h = casa('casa-sem-linha', 'ELEVENLABS_API_KEY=outra-coisa\n')
  const r = rodar(h, comFfmpeg)
  assert.equal(r.status, 1)
  confereFormato(r.stdout)
  assert.match(r.stdout, /existe, mas não tem a linha OPENAI_API_KEY=…/)
})

test('não grava nem cria nada', () => {
  const h = casa('casa-intocada', `OPENAI_API_KEY=${CHAVE}\n`)
  const antes = arvore(h)
  rodar(h, comFfmpeg)
  rodar(h, semNada)
  assert.deepEqual(arvore(h), antes)
})

test('no Windows o texto fala de winget, do PowerShell e da pasta do usuário', () => {
  const homeDeVerdade = process.env.HOME
  process.env.HOME = casa('casa-windows')
  const { texto, falta } = relatorio({ so: 'win32', env: { PATH: '' } })
  const velho = relatorio({ so: 'win32', env: { PATH: '' }, versaoNode: '16.20.0' }).texto
  process.env.HOME = homeDeVerdade
  assert.equal(falta, true)
  confereFormato(texto)
  for (const t of ['winget install ffmpeg', 'feche e abra o PowerShell', 'notepad "$env:USERPROFILE\\.claude\\secrets\\openai.env"', 'New-Item -ItemType Directory']) {
    assert.ok(texto.includes(t), `falta "${t}" em:\n${texto}`)
  }
  assert.doesNotMatch(texto, /brew|chmod/)
  assert.match(velho, /^✖ Node 18 ou mais novo \(este é o 16\.20\.0\)\n {4}No PowerShell:\n {4} {5}winget install OpenJS\.NodeJS\.LTS/m)
})
