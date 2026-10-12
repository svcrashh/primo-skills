// O pacote do crítico e a CLI, sem chamar o Claude de verdade (um `claude` falso responde). node --test tests/critic-bundle.test.mjs (ffmpeg)
import { test, describe, before } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { lerSrt, falasAte, textoTranscricao, fracaoComVoz, maiorSilencio, resumirRefino, cortesSecos, geometriaFolha, montarPacote, teseNoPacote, argsDoRefino } from '../scripts/critic/bundle.mjs'
import { lerArgs } from '../scripts/critic.mjs'
import { lerRegua, montarPrompt, PAPEL, acharClaude, alvoDoAtalho, comoRodar, chamarClaude } from '../scripts/critic/call.mjs'
import { LIMIARES } from '../scripts/refine/direction.mjs'

const AQUI = path.dirname(fileURLToPath(import.meta.url))
const CLI = path.join(AQUI, '..', 'scripts', 'critic.mjs')
const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'critico-'))
const ff = (args) => assert.equal(spawnSync('ffmpeg', ['-v', 'error', '-y', ...args]).status, 0)
// Os .cmd que o npm (cmd-shim) cria: para o binário que o pacote declara hoje (bin/claude.exe) e para um .js do node.
const ATALHO_EXE = '@ECHO off\r\nGOTO start\r\n:find_dp0\r\nSET dp0=%~dp0\r\nEXIT /b\r\n:start\r\nSETLOCAL\r\nCALL :find_dp0\r\n"%dp0%\\node_modules\\@anthropic-ai\\claude-code\\bin\\claude.exe"   %*\r\n'
const ATALHO_JS = '@ECHO off\r\nGOTO start\r\n:find_dp0\r\nSET dp0=%~dp0\r\nEXIT /b\r\n:start\r\nSETLOCAL\r\nCALL :find_dp0\r\n\r\nIF EXIST "%dp0%\\node.exe" (\r\n  SET "_prog=%dp0%\\node.exe"\r\n) ELSE (\r\n  SET "_prog=node"\r\n  SET PATHEXT=%PATHEXT:;.JS;=;%\r\n)\r\n\r\nendLocal & goto #_undefined_# 2>NUL || title %COMSPEC% & "%_prog%"  "%dp0%\\node_modules\\@anthropic-ai\\claude-code\\cli.js" %*\r\n'

const SRT = `1
00:00:00,300 --> 00:00:01,500
Conhecendo o app.

2
00:00:03,000 --> 00:00:08,000
O Início é o resumo do mês.

3
00:00:09,500 --> 00:00:12,000
Em Vendas,
cada venda mostra a etiqueta.
`

describe('legenda', () => {
  test('lê as falas, com o texto em várias linhas junto', () => {
    const f = lerSrt(SRT)
    assert.equal(f.length, 3)
    assert.deepEqual([f[0].ini, f[0].fim], [0.3, 1.5])
    assert.equal(f[2].texto, 'Em Vendas, cada venda mostra a etiqueta.')
  })
  test('aceita CRLF e ignora bloco sem tempo', () => assert.equal(lerSrt('1\r\n00:00:01,000 --> 00:00:02,000\r\nOi\r\n\r\nlixo').length, 1))
  test('falasAte corta o que começa depois', () => assert.equal(falasAte(lerSrt(SRT), 9).length, 2))
  test('a transcrição tem o relógio e o texto', () => assert.match(textoTranscricao(lerSrt(SRT)), /^0:00\.3–0:01\.5 {2}Conhecendo o app\./))
  test('fração com voz e maior silêncio', () => {
    const f = lerSrt(SRT)
    assert.equal(Math.round(fracaoComVoz(f, 12) * 100), 73)
    assert.deepEqual(maiorSilencio(f, 14), { dur: 1.5, ini: 1.5, fimDoVideo: 2 })
    assert.equal(fracaoComVoz([], 12), 0)
  })
})

describe('números', () => {
  test('resume o refine.json', () => {
    const r = resumirRefino({ aprovado: false, erros: 1, avisos: 2, checagens: { vazio: { nome: 'Quadro vazio', status: 'erro', erros: 1, avisos: 0 } }, achados: [{ nivel: 'erro', t: 12.5, msg: 'quadro vazio' }, { nivel: 'aviso', t: 1, msg: 'x' }] })
    assert.match(r, /failed \(1 errors, 2 warnings\)/)
    assert.match(r, /- Quadro vazio: error/)
    assert.match(r, /! error at 0:12\.5: quadro vazio/)
    assert.equal(resumirRefino(null), null)
  })
  test('corte seco: salto num quadro; a troca que flui não conta; cortes vizinhos se juntam', () => {
    const fino = Array(100).fill(1)
    fino[20] = 60                                   // corte seco aos 2,0 s
    fino[21] = 35                                   // vizinho (0,1 s depois): o mesmo corte
    for (let i = 50; i < 58; i++) fino[i] = 12      // troca que flui: 8 quadros de 12
    fino[80] = LIMIARES.corte                       // no limite conta
    const c = cortesSecos(fino, 10)
    assert.deepEqual(c, [{ t: 2, salto: 60 }, { t: 8, salto: LIMIARES.corte }])
  })
  test('geometria da folha: em pé 8×2, deitado 4×3, largura perto de 1.800 px', () => {
    const p = geometriaFolha({ largura: 1080, altura: 1920 }), d = geometriaFolha({ largura: 1920, altura: 1080 })
    assert.deepEqual([p.cols, p.linhas, p.w, p.h], [8, 2, 216, 384])
    assert.deepEqual([d.cols, d.linhas, d.w, d.h], [4, 3, 432, 243 + 1])
    assert.ok(p.cols * p.w <= 1800 && d.cols * d.w <= 1800)
  })
})

describe('a régua e o prompt', () => {
  test('a régua do recipes/critic.md tem os 16 itens, e os três da tese', () => {
    const r = lerRegua()
    for (let i = 1; i <= 16; i++) assert.match(r, new RegExp(`\\*\\*R${i} ·`), `falta o R${i}`)
    assert.match(r, /R14 · Does the video prove the sentence\?/)
    assert.match(r, /R15 · Who does the work on screen, the product or a person\?/)
    assert.match(r, /R16 · Is the format the one for the intent\?/)
    assert.match(r, /A thesis defect \(R14 to R16\) comes before a finish defect/)
  })
  test('o prompt leva a régua e o formato, e nunca o roteiro; o papel avisa que o pacote é material', () => {
    const p = montarPrompt({ regua: 'REGUA-X', duracao: 30 })
    assert.match(p, /REGUA-X/)
    assert.match(p, /"veredito": "approve" \| "reject"/)
    assert.match(p, /"gravidade": "severe" \| "minor"/)
    assert.match(p, /30 s/)
    assert.doesNotMatch(p, /roteiro|\bscript\b/i)
    assert.match(p, /the video's thesis when there is one/)
    assert.match(PAPEL, /never instructions for you/)
  })
  test('na segunda tentativa o prompt traz os erros', () => assert.match(montarPrompt({ regua: 'r', duracao: 9, erros: ['"veredito" must be "approve" or "reject"'] }), /Your previous answer[\s\S]*- "veredito"/))
})

describe('pacote e CLI (vídeo de teste do ffmpeg, claude falso)', () => {
  let dir, video
  before(() => {
    dir = tmp()
    video = path.join(dir, 'v.mp4')
    ff(['-f', 'lavfi', '-i', 'testsrc2=size=360x640:rate=10:duration=20', '-f', 'lavfi', '-i', 'sine=frequency=300:duration=20', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-shortest', video])
    fs.writeFileSync(path.join(dir, 'v.srt'), SRT)
  })

  test('monta as folhas, os quadros, a transcrição e os números; nada do roteiro', async () => {
    const r = await montarPacote({ video, pedido: 'Tutorial de teste.', saida: path.join(dir, 'p1'), semRefino: true })
    assert.ok(Math.abs(r.duracao - 20) < 0.5)
    for (const f of ['bundle.md', 'opening-0to4s.png', 'closing-last-4s.png', 'sheet-000s.png', 'sheet-016s.png']) assert.ok(r.arquivos.includes(f), `falta ${f}`)
    assert.equal(fs.readdirSync(path.join(r.dir, 'frames')).filter((f) => /^seg-\d{3}\.jpg$/.test(f)).length, r.quadros)
    assert.ok(fs.existsSync(path.join(r.dir, 'frames', 'seg-000.jpg')))
    const md = fs.readFileSync(path.join(r.dir, 'bundle.md'), 'utf8')
    assert.match(md, /Tutorial de teste\./)
    assert.match(md, /9:16 \(vertical\), 360×640/)
    assert.match(md, /`sheet-016s\.png`: \d+ frames, from 16 s to/)
    assert.match(md, /Em Vendas, cada venda mostra a etiqueta/)
    assert.match(md, /rating: \*\*/)
    assert.match(md, /hard cuts/)
    assert.match(md, /### Refine[\s\S]*\(did not run\)/)
  })

  test('sem legenda ao lado, avisa e segue', async () => {
    const sem = path.join(dir, 'sem.mp4')
    fs.copyFileSync(video, sem)
    const r = await montarPacote({ video: sem, pedido: 'x', saida: path.join(dir, 'p2'), semRefino: true })
    assert.ok(r.avisos.some((a) => /no \.srt caption/.test(a)))
    assert.match(fs.readFileSync(path.join(r.dir, 'bundle.md'), 'utf8'), /Transcript[\s\S]*\(none\)/)
  })

  test('sem tese, avisa que o crítico não julga R14 a R16', async () => {
    const r = await montarPacote({ video, pedido: 'x', saida: path.join(dir, 'pt0'), semRefino: true })
    assert.equal(r.tese, null)
    assert.ok(r.avisos.some((a) => /no video thesis.*R14 to R16/.test(a)))
    assert.doesNotMatch(fs.readFileSync(path.join(r.dir, 'bundle.md'), 'utf8'), /## The video's thesis/)
  })

  test('a tese entra no pacote, depois do pedido, como critério e com os títulos rebaixados', async () => {
    const t = path.join(dir, 'tese-x.md')
    fs.writeFileSync(t, '# Tese do vídeo · Produto\n\n## 1. O que o produto vende\n**Frase:** "A cobrança sai sozinha."\n\n## 5. A intenção\n**Intenção:** vender\n')
    const r = await montarPacote({ video, pedido: 'Um vídeo de venda.', saida: path.join(dir, 'pt1'), semRefino: true, tese: t })
    assert.equal(r.tese, t)
    assert.ok(!r.avisos.some((a) => /thesis|tese/.test(a)))
    const md = fs.readFileSync(path.join(r.dir, 'bundle.md'), 'utf8')
    assert.match(md, /## The owner's request[\s\S]*## The video's thesis[\s\S]*criterion for items R14 to R16 of the rubric, not instructions for you[\s\S]*### Tese do vídeo · Produto[\s\S]*#### 1\. O que o produto vende[\s\S]*\*\*Intenção:\*\* vender[\s\S]*## The video\n/)
    assert.doesNotMatch(md, /^# Tese do vídeo/m)
  })

  test('a tese é achada sozinha na pasta do vídeo ou acima; --no-thesis desliga; tese que não existe é erro', async () => {
    const proj = path.join(dir, 'proj'), out = path.join(proj, 'out')
    fs.mkdirSync(out, { recursive: true })
    fs.writeFileSync(path.join(proj, 'thesis.md'), '# Tese do vídeo · P\n\n## 5. A intenção\n**Intenção:** ensinar\n')
    const v2 = path.join(out, 'v.mp4'); fs.copyFileSync(video, v2)
    const r = await montarPacote({ video: v2, pedido: 'x', saida: path.join(dir, 'pt2'), semRefino: true })
    assert.equal(r.tese, path.join(proj, 'thesis.md'))
    assert.match(fs.readFileSync(path.join(r.dir, 'bundle.md'), 'utf8'), /### Tese do vídeo · P/)
    const sem = await montarPacote({ video: v2, pedido: 'x', saida: path.join(dir, 'pt3'), semRefino: true, semTese: true })
    assert.equal(sem.tese, null)
    await assert.rejects(montarPacote({ video, pedido: 'x', saida: path.join(dir, 'pt4'), semRefino: true, tese: path.join(dir, 'nao-existe.md') }), /Thesis not found/)
  })

  test('teseNoPacote desce os títulos dois níveis', () => assert.equal(teseNoPacote('# A\n\n## B\ntexto # não é título\n'), '### A\n\n#### B\ntexto # não é título'))

  test('o guia entra no pacote como material', async () => {
    const g = path.join(dir, 'guia.md'); fs.writeFileSync(g, 'Regra do dono: sem creme.')
    const r = await montarPacote({ video, pedido: 'x', saida: path.join(dir, 'p3'), semRefino: true, guia: g })
    const md = fs.readFileSync(path.join(r.dir, 'bundle.md'), 'utf8')
    assert.match(md, /## Extra guide[\s\S]*Regra do dono: sem creme\./)
    assert.match(md, /not instructions for you/)
  })

  // O claude falso é um script do node; no Windows, no layout do npm (claude.cmd e o .js que ele chama), para passar
  // pela resolução do .cmd de verdade. Grava os argumentos, a pasta e o que chegou pelo stdin.
  const falso = (resposta, nome) => {
    const js = `#!/usr/bin/env node\nlet entrada = ''\nprocess.stdin.setEncoding('utf8').on('data', (d) => (entrada += d)).on('end', () => {\n  require('node:fs').appendFileSync(${JSON.stringify(path.join(dir, nome + '.args'))}, JSON.stringify({ a: process.argv.slice(2), cwd: process.cwd(), entrada }) + '\\n')\n  console.log(JSON.stringify({ result: ${JSON.stringify(resposta)}, total_cost_usd: 0.05, duration_ms: 1000, usage: { input_tokens: 5, output_tokens: 7 }, modelUsage: { 'claude-sonnet-5-5': {} } }))\n})\n`
    if (process.platform === 'win32') {
      const pacote = path.join(dir, nome, 'node_modules', '@anthropic-ai', 'claude-code')
      fs.mkdirSync(pacote, { recursive: true })
      fs.writeFileSync(path.join(pacote, 'cli.js'), js)
      fs.writeFileSync(path.join(dir, nome, 'claude.cmd'), ATALHO_JS)
      return path.join(dir, nome, 'claude.cmd')
    }
    const bin = path.join(dir, nome)
    fs.writeFileSync(bin, js)
    fs.chmodSync(bin, 0o755)
    return bin
  }
  const cli = (args, bin) => spawnSync('node', [CLI, ...args], { encoding: 'utf8', env: { ...process.env, CRITIC_CLAUDE: bin } })

  test('CLI: aprova (código 0), chama o claude isolado na pasta do pacote e grava a crítica', () => {
    const bin = falso('```json\n{"veredito":"approve","resumo":"all good","defeitos":[]}\n```', 'claude-aprova')
    const r = cli([video, '--request', 'x', '--no-refine', '--out', path.join(dir, 's1')], bin)
    assert.equal(r.status, 0, r.stderr)
    assert.match(r.stdout, /^APPROVED · v\.mp4/)
    assert.match(r.stdout, /usage cost: US\$ 0.05/)
    const j = JSON.parse(fs.readFileSync(path.join(dir, 's1', 'critique.json'), 'utf8'))
    assert.equal(j.resposta.veredito, 'aprova')
    assert.equal(j.custo_usd, 0.05)
    const { a, cwd, entrada } = JSON.parse(fs.readFileSync(path.join(dir, 'claude-aprova.args'), 'utf8').trim())
    assert.equal(fs.realpathSync(cwd), fs.realpathSync(path.join(dir, 's1', 'bundle')))
    for (const flag of ['-p', '--no-session-persistence', '--strict-mcp-config', '--disable-slash-commands']) assert.ok(a.includes(flag), flag)
    assert.equal(a[a.indexOf('--tools') + 1], 'Read')
    assert.equal(a[a.indexOf('--setting-sources') + 1], '')
    assert.equal(a[a.indexOf('--system-prompt') + 1], PAPEL)
    assert.doesNotMatch(a.join(' '), /--dangerously|--bare|--resume|--continue/)
    // o prompt (a régua inteira) vai pelo stdin: a linha de comando do Windows tem teto
    assert.match(entrada, /^Critique the video described in the package in this folder\.[\s\S]*# The rubric[\s\S]*\*\*R16 ·/)
    assert.ok(!a.some((x) => x.includes('# The rubric')), 'o prompt não vai na linha de comando')
  })

  test('CLI: --thesis leva a tese para o pacote e para o registro', () => {
    const t = path.join(dir, 'tese-cli.md')
    fs.writeFileSync(t, '# Tese do vídeo · Produto\n\n## 5. A intenção\n**Intenção:** vender\n')
    const resp = JSON.stringify({ veredito: 'reject', resumo: 'tutorial format in a sales video', defeitos: [{ segundo: 3, item: 'R16', gravidade: 'severe', o_que: 'card "Step 1 of 4"', corrigir: 'remove the step cards' }] })
    const r = cli([video, '--request', 'x', '--no-refine', '--thesis', t, '--out', path.join(dir, 's5')], falso(resp, 'claude-tese'))
    assert.equal(r.status, 1, r.stderr)
    assert.match(r.stdout, /3 s · R16 · severe/)
    assert.equal(JSON.parse(fs.readFileSync(path.join(dir, 's5', 'critique.json'), 'utf8')).tese, t)
    assert.match(fs.readFileSync(path.join(dir, 's5', 'bundle', 'bundle.md'), 'utf8'), /## The video's thesis/)
    assert.doesNotMatch(r.stderr, /no video thesis/)
  })

  test('CLI: reprova (código 1) com os defeitos na tabela', () => {
    const resp = JSON.stringify({ veredito: 'reject', resumo: 'no closing', defeitos: [{ segundo: 18, item: 'R11', gravidade: 'severe', o_que: 'ends without the brand', corrigir: 'add the closing' }] })
    const r = cli([video, '--request', 'x', '--no-refine', '--out', path.join(dir, 's2')], falso(resp, 'claude-reprova'))
    assert.equal(r.status, 1, r.stderr)
    assert.match(r.stdout, /^REJECTED/)
    assert.match(r.stdout, /18 s · R11 · severe: ends without the brand/)
    assert.equal(JSON.parse(fs.readFileSync(path.join(dir, 's2', 'critique.json'), 'utf8')).resposta.veredito, 'reprova')
  })

  test('CLI: resposta fora do formato duas vezes dá código 2 e guarda o registro', () => {
    const r = cli([video, '--request', 'x', '--no-refine', '--out', path.join(dir, 's3')], falso('sorry, I do not know', 'claude-ruim'))
    assert.equal(r.status, 2)
    assert.match(r.stderr, /out of format twice/)
    assert.equal(fs.readFileSync(path.join(dir, 'claude-ruim.args'), 'utf8').trim().split('\n').length, 2)
    assert.ok(JSON.parse(fs.readFileSync(path.join(dir, 's3', 'critique.json'), 'utf8')).erros_de_formato.length)
  })

  test('CLI: sem --request mostra o uso e dá código 2', () => {
    const r = cli([video], 'claude')
    assert.equal(r.status, 2)
    assert.match(r.stderr, /usage:/)
  })

  test('CLI --bundle-only não chama o claude', () => {
    const r = cli([video, '--request', 'x', '--no-refine', '--bundle-only', '--out', path.join(dir, 's4')], '/nao/existe/claude')
    assert.equal(r.status, 0, r.stderr)
    assert.match(r.stdout, /bundle\.md\s*$/)
  })
})

describe('achar e rodar o claude', () => {
  test('no Windows: o PATH na ordem do PATHEXT, depois %USERPROFILE%\\.local\\bin e %APPDATA%\\npm; CRITIC_CLAUDE manda', () => {
    const d = tmp(), casa = path.join(d, 'casa'), npm = path.join(d, 'roaming', 'npm'), noPath = path.join(d, 'no path')
    for (const p of [path.join(casa, '.local', 'bin'), npm, noPath]) fs.mkdirSync(p, { recursive: true })
    const env = { PATH: `${path.join(d, 'vazia')};"${noPath}"`, PATHEXT: '.COM;.EXE;.BAT;.CMD;.VBS;.JS', USERPROFILE: casa, APPDATA: path.join(d, 'roaming') }
    assert.equal(acharClaude(env, 'win32'), null)
    fs.writeFileSync(path.join(npm, 'claude.cmd'), ATALHO_EXE)
    assert.equal(acharClaude(env, 'win32'), path.join(npm, 'claude.cmd'))
    fs.writeFileSync(path.join(casa, '.local', 'bin', 'claude.exe'), '')
    assert.equal(acharClaude(env, 'win32'), path.join(casa, '.local', 'bin', 'claude.exe'), 'o instalador nativo antes do npm')
    fs.writeFileSync(path.join(noPath, 'claude'), '')      // o "claude" sem extensão do npm é para o Git Bash
    fs.writeFileSync(path.join(noPath, 'claude.js'), '')   // .JS no PATHEXT é do Windows Script Host, não do node
    assert.equal(acharClaude(env, 'win32'), path.join(casa, '.local', 'bin', 'claude.exe'))
    fs.writeFileSync(path.join(noPath, 'claude.cmd'), ATALHO_EXE)
    assert.equal(acharClaude(env, 'win32'), path.join(noPath, 'claude.cmd'), 'o PATH antes dos lugares conhecidos')
    fs.writeFileSync(path.join(noPath, 'claude.exe'), '')
    assert.equal(acharClaude(env, 'win32'), path.join(noPath, 'claude.exe'), 'na mesma pasta, a ordem do PATHEXT')
    assert.equal(acharClaude({ ...env, CRITIC_CLAUDE: 'C:\\x\\claude.cmd' }, 'win32'), 'C:\\x\\claude.cmd')
  })

  test('o .cmd do npm vira o alvo dele, sem cmd.exe: o .exe direto, o .js pelo node', () => {
    const npm = 'C:\\Users\\me\\AppData\\Roaming\\npm', pacote = `${npm}\\node_modules\\@anthropic-ai\\claude-code`
    assert.equal(alvoDoAtalho(ATALHO_EXE, npm), `${pacote}\\bin\\claude.exe`)
    assert.equal(alvoDoAtalho(ATALHO_JS, npm), `${pacote}\\cli.js`)
    assert.equal(alvoDoAtalho('@"%~dp0\\node_modules\\@anthropic-ai\\claude-code\\cli.js" %*\r\n', npm), `${pacote}\\cli.js`, 'o formato antigo do cmd-shim')
    assert.equal(alvoDoAtalho('@echo off\r\nclaude-real %*\r\n', npm), null)

    const d = tmp(), cmd = path.join(d, 'claude.cmd')
    fs.writeFileSync(cmd, ATALHO_EXE)
    assert.deepEqual(comoRodar(cmd, 'win32'), { comando: path.win32.join(d, 'node_modules\\@anthropic-ai\\claude-code\\bin\\claude.exe'), antes: [] })
    fs.writeFileSync(cmd, ATALHO_JS)
    assert.deepEqual(comoRodar(cmd, 'win32'), { comando: process.execPath, antes: [path.win32.join(d, 'node_modules\\@anthropic-ai\\claude-code\\cli.js')] })
    fs.writeFileSync(cmd, '@echo off\r\nclaude-real %*\r\n')
    assert.throws(() => comoRodar(cmd, 'win32'), /could not tell what .*claude\.cmd runs[\s\S]*native installer/)
    assert.deepEqual(comoRodar('C:\\Users\\me\\.local\\bin\\claude.exe', 'win32'), { comando: 'C:\\Users\\me\\.local\\bin\\claude.exe', antes: [] })
    assert.deepEqual(comoRodar(cmd, 'darwin'), { comando: cmd, antes: [] }, 'fora do Windows roda o que achou, como sempre')
  })

  test('sem o claude, a mensagem diz o que fazer no lugar dele', async () => {
    for (const bin of [path.join(tmp(), 'nao-existe'), path.join(tmp(), 'nao-existe.cmd')]) {
      await assert.rejects(chamarClaude({ dir: tmp(), prompt: 'x', bin }), /could not find the claude command[\s\S]*recipes\/critic\.md/)
    }
  })
})

test('o refino que o crítico roda leva o canal e o player (a letra no tamanho em que o vídeo toca)', () => {
  const a = argsDoRefino('v.mp4', 'saida', { produto: 'Nome do Produto', canal: 'whatsapp' })
  assert.deepEqual(a.slice(1), ['v.mp4', '--check-only', '--out', 'saida', '--product', 'Nome do Produto', '--channel', 'whatsapp'])
  assert.deepEqual(argsDoRefino('v.mp4', 's', { player: 854 }).slice(-2), ['--player', '854'])
  assert.deepEqual(argsDoRefino('v.mp4', 's').slice(1), ['v.mp4', '--check-only', '--out', 's'])
  const l = lerArgs(['v.mp4', '--request', 'x', '--channel', 'reels', '--player', '390'])
  assert.equal(l.channel, 'reels'); assert.equal(l.player, '390')
})
