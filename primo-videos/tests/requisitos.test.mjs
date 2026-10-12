// node --test tests/requisitos.test.mjs   (sem rede): o requisitos.mjs, que o instalador roda logo depois de ligar a
// skill, num HOME de mentira e com um PATH que só tem o que o teste põe: diz o que tem (✔), o que falta e é obrigatório
// (✖: ffmpeg, a conferência do ambiente e, no Windows, o Python que ela usa) e o que é opcional (○: as chaves), com os
// passos do sistema embaixo de cada falta (Mac: Terminal e brew; Windows: PowerShell, winget e Bloco de Notas); sai 1
// só quando falta o obrigatório; nunca mostra o valor de uma chave; não grava nada; fala inglês com --lang en; roda
// pelo link da skill; e, fora do Mac e do Windows, só diz que ainda não roda ali. O texto do Windows também é conferido
// fora dele, com um process.platform de mentira; no Windows, roda de verdade.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath, pathToFileURL } from 'node:url'

const SKILL = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const REQ = path.join(SKILL, 'scripts', 'requisitos.mjs'), AMB = path.join(SKILL, 'scripts', 'environment.mjs')
const mac = process.platform === 'darwin', win = process.platform === 'win32'
const suportado = { skip: !mac && !win && 'a primo-videos só roda no Mac e no Windows: fora deles, o requisitos.mjs só diz isso' }
const EL = 'sk-el-FAKE-1234567890', OA = 'sk-oa-FAKE-0987654321'
const finge = (so) => ['--import', `data:text/javascript,Object.defineProperty(process,'platform',{value:'${so}'})`]

// um HOME vazio e um PATH só com os "executáveis" pedidos; nada do ambiente de verdade (nem as chaves) entra
function casa(t, { bin = [] } = {}) {
  const c = fs.mkdtempSync(path.join(os.tmpdir(), 'vs-req-'))
  t.after(() => fs.rmSync(c, { recursive: true, force: true }))
  const home = path.join(c, 'home'), dirBin = path.join(c, 'bin')
  fs.mkdirSync(home); fs.mkdirSync(dirBin)
  // o requisitos só olha os arquivos: no Windows, um <nome>.exe vazio basta
  for (const n of bin) {
    if (win) { fs.writeFileSync(path.join(dirBin, `${n}.exe`), ''); continue }
    fs.writeFileSync(path.join(dirBin, n), '#!/bin/sh\nexit 0\n'); fs.chmodSync(path.join(dirBin, n), 0o755)
  }
  const env = { HOME: home, USERPROFILE: home, PATH: dirBin }
  const roda = (extra = {}, ...a) => spawnSync(process.execPath, [REQ, ...a], { encoding: 'utf8', cwd: c, env: { ...env, ...extra } })
  // como Windows: de verdade no Windows; nos outros, com o process.platform de mentira (e o PATHEXT que acha os .exe)
  const comoWindows = (extra = {}, ...a) => spawnSync(process.execPath, [...(win ? [] : finge('win32')), REQ, ...a],
    { encoding: 'utf8', cwd: c, env: { ...env, ...(win ? {} : { PATHEXT: '.exe' }), ...extra } })
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
  // uma pasta com programas .exe vazios (que, se o requisitos rodasse, nem rodariam)
  const pastaCom = (rel, ...exes) => {
    const d = path.join(c, ...rel.split('/'))
    fs.mkdirSync(d, { recursive: true })
    for (const n of exes) fs.writeFileSync(path.join(d, n), '')
    return d
  }
  return { c, home, dirBin, env, roda, comoWindows, ambiente, segredo, pastaCom }
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
const formato = (r) => {
  const ls = r.stdout.trimEnd().split('\n')
  assert.match(ls[0], /^primo-videos: faz vídeo do seu produto/)
  assert.ok(ls.slice(1).every((l) => /^[✔✖○] |^ {4}\S|^ {4} +\S/.test(l)), `toda linha é uma coisa (✔ ✖ ○) ou um passo recuado:\n${r.stdout}`)
}
const reabrir = (oque) => new RegExp(`\\n {4}Depois feche e abra o PowerShell, e reabra o Claude Code: só as janelas novas acham o ${oque}\\.`)

// O texto do Windows na primeira vez (sem nada): winget, PowerShell, $env:USERPROFILE e Bloco de Notas, nada do Mac.
// [\\/]: no Windows de mentira, os caminhos saem com a barra do sistema em que o teste roda.
function textoDoWindows(r) {
  assert.equal(r.status, 1, r.stderr)
  formato(r)
  assert.match(bloco(r.stdout, '✖ ffmpeg: monta, codifica e confere o vídeo.'), new RegExp(`\\n {4}No PowerShell, rode:\\n {6}winget install ffmpeg${reabrir('ffmpeg').source}`))
  assert.match(bloco(r.stdout, '✖ Python 3: é com ele que a conferência do ambiente cria o Python da trilha sonora.'),
    new RegExp(`\\n {4}No PowerShell, rode:\\n {6}winget install Python\\.Python\\.3\\.12${reabrir('Python').source}`), 'sem py nem python no PATH, falta o Python que o --fix usa')
  const amb = bloco(r.stdout, '✖ Conferência do ambiente: ainda não foi feita')
  assert.match(amb, /\n {4}No PowerShell, rode:\n {6}node "[^"\n]+[\\/]scripts[\\/]environment\.mjs" --fix\n/)
  assert.match(amb, /em %USERPROFILE%[\\/]\.videostudio\) e grava %USERPROFILE%[\\/]\.videostudio[\\/]environment\.json/)
  assert.match(amb, /--yes[^\n]*~300 MB/)
  for (const [nome, arq, chave] of [['○ Voz em off', 'elevenlabs.env', 'ELEVENLABS_API_KEY'], ['○ Imagem gerada', 'openai.env', 'OPENAI_API_KEY']]) {
    const b = bloco(r.stdout, nome)
    assert.match(b, /\n {4}2\. No PowerShell, crie a pasta e abra o arquivo no Bloco de Notas \(ele pergunta se cria o arquivo: diga que sim\):\n/)
    assert.match(b, /\n {9}New-Item -ItemType Directory -Force "\$env:USERPROFILE[\\/]\.claude[\\/]secrets" \| Out-Null\n/)
    assert.match(b, new RegExp(`\\n {9}notepad "\\$env:USERPROFILE[\\\\/]\\.claude[\\\\/]secrets[\\\\/]${arq.replace('.', '\\.')}"\\n`))
    assert.match(b, new RegExp(`\\n {4}3\\. Escreva uma linha só, ${chave}= seguido da chave \\(sem espaço nem aspas\\), salve e feche\\.\\n`))
    assert.match(b, /4\. Confira: node "[^"\n]+[\\/]scripts[\\/]requisitos\.mjs"\. Esta linha passa a ✔\./)
    assert.match(b, /nunca vai na conversa com o Claude, nunca vai para o git e nunca é impressa/)
  }
  assert.doesNotMatch(r.stdout, /brew|Homebrew|chmod|open -e|mkdir|~\/|Terminal/, 'nada do Mac')
}

test('primeira vez na máquina: falta o ffmpeg e a conferência (código 1), e cada falta diz o que fazer', suportado, (t) => {
  const { home, roda } = casa(t)
  const antes = arvore(home), t0 = Date.now()
  const r = roda()
  assert.ok(Date.now() - t0 < 2000, 'leve: menos de 2 s')
  assert.equal(r.status, 1, r.stderr)
  assert.equal(r.stderr, '')
  formato(r)
  assert.match(r.stdout, /^✔ Node\.js \d+\.\d+\.\d+$/m)
  const voz = bloco(r.stdout, '○ Voz em off: chave da ElevenLabs (ELEVENLABS_API_KEY), opcional e paga')
  assert.match(voz, /só a voz em off fica desligada; o resto funciona/)
  assert.match(voz, /1\. Crie a chave em elevenlabs\.io, no menu da esquerda, em "Developers" → "API Keys" \(elevenlabs\.io\/app\/settings\/api-keys\)\. Ela gasta os créditos do plano/)
  const img = bloco(r.stdout, '○ Imagem gerada: chave da OpenAI (OPENAI_API_KEY), opcional e paga')
  assert.match(img, /só a imagem gerada fica desligada; o resto funciona/)
  assert.match(img, /platform\.openai\.com, em "API keys"\. A API é paga por uso e é separada da assinatura do ChatGPT: precisa de crédito na conta da API \(em "Billing"\)/)

  if (win) {
    textoDoWindows(r)
    // de verdade, com as barras do Windows e a pasta do usuário trocada por %USERPROFILE% (Explorer) e $env:USERPROFILE (PowerShell)
    for (const s of ['grava %USERPROFILE%\\.videostudio\\environment.json', '\\scripts\\environment.mjs" --fix',
      'New-Item -ItemType Directory -Force "$env:USERPROFILE\\.claude\\secrets" | Out-Null', 'notepad "$env:USERPROFILE\\.claude\\secrets\\openai.env"',
      'notepad "$env:USERPROFILE\\.claude\\secrets\\elevenlabs.env"']) assert.ok(r.stdout.includes(s), `falta ${s} em:\n${r.stdout}`)
  } else {
    assert.doesNotMatch(r.stdout, /Python 3|winget|PowerShell|USERPROFILE|notepad/, 'nada do Windows')
    const ff = bloco(r.stdout, '✖ ffmpeg')
    assert.match(ff, /\n {6}brew install ffmpeg\n/)
    assert.match(ff, /Homebrew[^\n]*brew\.sh[^\n]*\n {6}\/bin\/bash -c "\$\(curl -fsSL https:\/\/raw\.githubusercontent\.com\/Homebrew\/install\/HEAD\/install\.sh\)"/, 'sem brew no PATH, ensina a instalar o Homebrew')

    const amb = bloco(r.stdout, '✖ Conferência do ambiente: ainda não foi feita')
    assert.match(amb, /\n {6}node \S*environment\.mjs --fix\n/)
    assert.match(amb, /Playwright e o Chromium/)
    assert.match(amb, /--yes[^\n]*~150 MB/)

    assert.match(voz, /\n {9}mkdir -p ~\/\.claude\/secrets && chmod 700 ~\/\.claude\/secrets\n/)
    assert.match(voz, /\n {9}touch ~\/\.claude\/secrets\/elevenlabs\.env && chmod 600 ~\/\.claude\/secrets\/elevenlabs\.env\n/)
    assert.match(voz, /3\. Abra o arquivo no seu editor \(open -e ~\/\.claude\/secrets\/elevenlabs\.env[^\n]*ELEVENLABS_API_KEY=/)
    assert.match(voz, /4\. Confira: node \S*requisitos\.mjs\./)
    assert.match(voz, /nunca vai na conversa com o Claude, nunca vai para o git e nunca é impressa/)
    assert.match(img, /touch ~\/\.claude\/secrets\/openai\.env && chmod 600 ~\/\.claude\/secrets\/openai\.env/)
    assert.match(img, /OPENAI_API_KEY=/)
  }
  assert.deepEqual(arvore(home), antes, 'não grava nada: nem o environment.json, nem o venv, nem a pasta das chaves')
})

test('o texto do Windows, conferido fora dele com um Windows de mentira', { skip: win && 'no Windows, o caso de verdade é o "primeira vez na máquina"' }, (t) => {
  const { home, comoWindows } = casa(t)
  const antes = arvore(home)
  const r = comoWindows()
  textoDoWindows(r)
  const en = comoWindows({}, '--lang', 'en')
  assert.equal(en.status, 1)
  assert.equal(en.stdout.split('\n').length, r.stdout.split('\n').length, 'as mesmas linhas')
  assert.match(en.stdout, /\n {4}In PowerShell, run:\n {6}winget install ffmpeg\n {4}Then close and reopen PowerShell, and reopen Claude Code: only new windows find ffmpeg\./)
  assert.match(en.stdout, /^✖ Python 3: the environment check uses it to create the soundtrack's Python\.$/m)
  assert.match(en.stdout, /2\. In PowerShell, create the folder and open the file in Notepad \(it asks whether to create the file: say yes\):/)
  assert.doesNotMatch(en.stdout, /Conferência|opcional|No PowerShell|Bloco de Notas/)
  assert.deepEqual(arvore(home), antes, 'não grava nada')
})

test('só falta o opcional: código 0, e com brew no PATH não ensina o Homebrew', suportado, (t) => {
  const { home, roda, ambiente } = casa(t, { bin: ['ffmpeg', 'ffprobe', ...(win ? [] : ['brew'])] })
  ambiente()
  const antes = arvore(home)
  const r = roda()
  assert.equal(r.status, 0, r.stdout)
  assert.match(r.stdout, /^✔ ffmpeg e ffprobe$/m)
  const arq = win ? '%USERPROFILE%\\.videostudio\\environment.json' : '~/.videostudio/environment.json'
  assert.ok(r.stdout.includes(`\n✔ Conferência do ambiente: feita em 2026-01-02 (${arq})\n`), r.stdout)
  assert.match(r.stdout, /^○ Voz em off/m)
  assert.match(r.stdout, /^○ Imagem gerada/m)
  assert.doesNotMatch(r.stdout, /^✖/m)
  assert.doesNotMatch(r.stdout, /Homebrew/)
  assert.doesNotMatch(r.stdout, /Python 3/, 'feita a conferência, o venv já existe: o Python não entra')
  assert.deepEqual(arvore(home), antes, 'não grava nada')
})

test('só o ffprobe faltando já é ffmpeg faltando (o brew install / winget install ffmpeg traz os dois)', suportado, (t) => {
  const { roda, ambiente } = casa(t, { bin: ['ffmpeg', 'brew'] })
  ambiente()
  const r = roda()
  assert.equal(r.status, 1)
  assert.match(bloco(r.stdout, '✖ ffmpeg'), win ? /\n {6}winget install ffmpeg\n/ : /\n {6}brew install ffmpeg/)
})

test('a conferência que não terminou, ou que aponta para o que saiu da máquina, falta (código 1)', suportado, (t) => {
  const { c, roda, ambiente } = casa(t, { bin: ['ffmpeg', 'ffprobe', win ? 'py' : 'brew'] })
  ambiente({ playwright: null })
  const r = roda()
  assert.equal(r.status, 1)
  assert.match(bloco(r.stdout, '✖ Conferência do ambiente: rodou, mas ficou faltando coisa'), /environment\.mjs"? --fix[^\n]*\n[^\n]*\n[^\n]*--yes/)
  if (win) assert.match(r.stdout, /^✔ Python 3 \([^)\n]+\\py\.exe\)$/m, 'antes do conserto, diz qual Python ele vai usar')
  ambiente({ python: path.join(c, 'nao-existe-mais') })
  assert.equal(roda().status, 1)
  ambiente()
  const ok = roda()
  assert.equal(ok.status, 0)
  assert.doesNotMatch(ok.stdout, /Python 3/)
  // o environment.json ilegível conta como não feito
  fs.writeFileSync(path.join(c, 'home', '.videostudio', 'environment.json'), '{ quebrado')
  assert.match(roda().stdout, /^✖ Conferência do ambiente: ainda não foi feita/m)
})

test('no Windows, o Python do conserto é o py ou um python.exe fora da WindowsApps (o atalho falso da Store não conta), achado sem rodar nada', (t) => {
  const { comoWindows, ambiente, pastaCom } = casa(t)
  const ff = pastaCom('ffmpeg/bin', 'ffmpeg.exe', 'ffprobe.exe')
  // o atalho que todo Windows tem: só abre a Microsoft Store
  const loja = pastaCom('local/Microsoft/WindowsApps', 'python.exe', 'python3.exe')
  const comPath = (...ds) => ({ PATH: [ff, ...ds].join(path.delimiter) })
  const so = comoWindows(comPath(loja))
  assert.equal(so.status, 1)
  assert.match(bloco(so.stdout, '✖ Python 3'), /winget install Python\.Python\.3\.12/)

  const instalado = pastaCom('Python312', 'python.exe')
  assert.match(comoWindows(comPath(loja, instalado)).stdout, /^✔ Python 3 \([^)\n]+Python312[\\/]python\.exe\)$/m)
  const lancador = pastaCom('Launcher', 'py.exe')
  const t0 = Date.now()
  const r = comoWindows(comPath(loja, instalado, lancador))
  assert.ok(Date.now() - t0 < 2000, 'leve: menos de 2 s')
  assert.match(r.stdout, /^✔ Python 3 \([^)\n]+Launcher[\\/]py\.exe\)$/m, 'o py vem antes')
  assert.equal(r.status, 1, 'o Python não basta: a conferência ainda falta')

  ambiente()
  const feito = comoWindows(comPath(loja))
  assert.equal(feito.status, 0, feito.stdout)
  assert.doesNotMatch(feito.stdout, /Python 3/, 'feita a conferência, o venv já existe: o Python não entra')
})

test('no Windows, o ffmpeg que o winget pôs e o PATH desta janela ainda não vê: pede só para reabrir', (t) => {
  const { c, ambiente, comoWindows, pastaCom } = casa(t)
  ambiente()
  const links = pastaCom('local/Microsoft/WinGet/Links', 'ffmpeg.exe', 'ffprobe.exe')
  const r = comoWindows({ LOCALAPPDATA: path.join(c, 'local') })
  assert.equal(r.status, 1)
  const ff = bloco(r.stdout, '✖ ffmpeg: está instalado')
  assert.match(ff, /Microsoft[\\/]WinGet[\\/]Links\), mas este PowerShell ainda não o acha\./)
  assert.match(ff, reabrir('ffmpeg'))
  assert.doesNotMatch(ff, /winget install/, 'já está instalado: não manda instalar de novo')
  const novo = comoWindows({ LOCALAPPDATA: path.join(c, 'local'), PATH: links })
  assert.equal(novo.status, 0, novo.stdout)
  assert.match(novo.stdout, /^✔ ffmpeg e ffprobe$/m)
})

test('as chaves: ditas com a origem e sem o valor, e não mudam o código de saída', suportado, (t) => {
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
  const segredos = win ? '%USERPROFILE%\\.claude\\secrets\\' : '~/.claude/secrets/'
  const r = roda({ ELEVENLABS_API_KEY: EL })
  assert.match(r.stdout, /^✔ Voz em off: chave da ElevenLabs \(ELEVENLABS_API_KEY\) encontrada na variável de ambiente$/m)
  assert.ok(r.stdout.includes(`\n✔ Imagem gerada: chave da OpenAI (OPENAI_API_KEY) encontrada em ${segredos}openai.env\n`), r.stdout)
  assert.deepEqual(arvore(home), antes, 'não grava nada')

  // a linha vazia (ou só aspas) é chave nenhuma; a chave no arquivo da ElevenLabs também conta
  segredo('openai.env', 'OPENAI_API_KEY=""\n')
  segredo('elevenlabs.env', `ELEVENLABS_API_KEY=${EL}\n`)
  const r2 = roda()
  semValor(r2)
  assert.equal(r2.status, 0, 'falta só o opcional')
  assert.ok(r2.stdout.includes(`\n✔ Voz em off: chave da ElevenLabs (ELEVENLABS_API_KEY) encontrada em ${segredos}elevenlabs.env\n`), r2.stdout)
  assert.match(r2.stdout, /^○ Imagem gerada/m)

  // salvo pelo Bloco de Notas como "Unicode" (UTF-16 com BOM) e com CRLF, vale do mesmo jeito
  segredo('openai.env', Buffer.concat([Buffer.from([0xff, 0xfe]), Buffer.from(`OPENAI_API_KEY=${OA}\r\n`, 'utf16le')]))
  const r3 = roda()
  semValor(r3)
  assert.match(r3.stdout, /^✔ Imagem gerada: chave da OpenAI \(OPENAI_API_KEY\) encontrada em /m)
})

test('--lang en: o mesmo bloco, em inglês, com o mesmo código de saída', suportado, (t) => {
  const { roda } = casa(t)
  const pt = roda(), en = roda({}, '--lang', 'en')
  assert.equal(en.status, pt.status)
  assert.equal(en.stdout.split('\n').length, pt.stdout.split('\n').length, 'as mesmas linhas')
  assert.match(en.stdout, /^primo-videos: makes a video of your product/)
  assert.match(en.stdout, /^✖ Environment check: not done yet/m)
  assert.match(en.stdout, /^○ Voiceover: ElevenLabs key \(ELEVENLABS_API_KEY\), optional and paid\. Without it, only the voiceover is off/m)
  assert.match(en.stdout, /^○ Generated images: OpenAI key \(OPENAI_API_KEY\), optional and paid\. Without it, only generated images are off/m)
  assert.match(en.stdout, /separate from the ChatGPT subscription: it needs credit on the API account \(under "Billing"\)/)
  assert.match(en.stdout, win ? /In PowerShell, run:/ : /In Terminal, run:/)
  assert.doesNotMatch(en.stdout, /Conferência|opcional|No Terminal|No PowerShell/)
  assert.match(roda({}, '--lang', 'en-US').stdout, /^primo-videos: makes/)
})

test('pelo link da skill: responde igual, e os comandos saem pelo link em ~/.claude/skills/primo-videos', suportado, (t) => {
  const { home, roda, env } = casa(t)
  const link = path.join(home, '.claude', 'skills', 'primo-videos')
  fs.mkdirSync(path.dirname(link), { recursive: true })
  // o instalador do Windows liga a skill por junção
  fs.symlinkSync(SKILL, link, win ? 'junction' : 'dir')
  try {
    const r = spawnSync(process.execPath, [path.join(link, 'scripts', 'requisitos.mjs')], { encoding: 'utf8', cwd: os.tmpdir(), env })
    assert.equal(r.status, 1, r.stderr)
    assert.equal(r.stdout, roda().stdout, 'pelo link e pelo caminho real, a mesma saída')
    if (win) {
      assert.ok(r.stdout.includes('\n      node "$env:USERPROFILE\\.claude\\skills\\primo-videos\\scripts\\environment.mjs" --fix\n'), r.stdout)
      assert.ok(r.stdout.includes('4. Confira: node "$env:USERPROFILE\\.claude\\skills\\primo-videos\\scripts\\requisitos.mjs".'), r.stdout)
    } else {
      assert.match(r.stdout, /\n {6}node ~\/\.claude\/skills\/primo-videos\/scripts\/environment\.mjs --fix\n/)
      assert.match(r.stdout, /4\. Confira: node ~\/\.claude\/skills\/primo-videos\/scripts\/requisitos\.mjs\./)
    }
    // o environment.mjs, que agora só roda chamado direto, também responde pelo link
    const a = spawnSync(process.execPath, [path.join(link, 'scripts', 'environment.mjs'), '--json'], { encoding: 'utf8', cwd: os.tmpdir(), env })
    assert.equal(a.status, 0, a.stderr)
    assert.ok(JSON.parse(a.stdout).sistema)
  } finally { fs.unlinkSync(link) } // tira o link antes de apagar a casa: a skill de verdade fica longe do rmSync
})

test('importado, o environment.mjs não roda o diagnóstico', (t) => {
  const { env } = casa(t)
  const r = spawnSync(process.execPath, ['--input-type=module', '-e', `const m = await import(${JSON.stringify(pathToFileURL(AMB).href)}); console.log(Object.keys(m).sort().join(' '))`], { encoding: 'utf8', env })
  assert.equal(r.status, 0, r.stderr)
  assert.equal(r.stdout.trim(), 'ambienteVelho baixaChromium comandoNpm curto noPath opcionais')
})

test('fora do Mac e do Windows: só diz que, por enquanto, ela roda só neles (código 1)', () => {
  const env = { HOME: os.tmpdir(), USERPROFILE: os.tmpdir(), PATH: '' }
  const r = spawnSync(process.execPath, [...finge('linux'), REQ], { encoding: 'utf8', env })
  assert.equal(r.status, 1, r.stderr)
  const ls = r.stdout.trimEnd().split('\n')
  assert.match(ls[0], /^primo-videos: /)
  assert.equal(ls[1], '✖ Mac ou Windows: a primo-videos, por enquanto, roda só no Mac e no Windows.')
  assert.match(ls[2], /^ {4}Neste Linux ela ainda não roda/)
  assert.equal(ls.length, 3, 'nada de ffmpeg, ambiente ou chaves num sistema em que ela não roda')
  const en = spawnSync(process.execPath, [...finge('linux'), REQ, '--lang', 'en'], { encoding: 'utf8', env })
  assert.match(en.stdout, /^✖ Mac or Windows: primo-videos runs only on Mac and Windows for now\.$/m)
})
