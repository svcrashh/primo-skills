// node --test tests/product-window.test.mjs
// A gravação da janela de um programa fora do Mac. As peças puras (comandos, retângulo, escolha da janela, leitura do
// ajudante) rodam em qualquer sistema; a gravação de verdade só no Windows, com uma janela de teste do Windows Forms.
// JANELA_TESTE_SAIDA=<pasta> guarda a gravação do teste do Windows ali (para subir como artefato da CI).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import crypto from 'node:crypto'
import { spawnSync, execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { argsGdigrab, areaCaptura, tamanhoDesktop, escolherJanela, descendentesDe, separarLinhas, comandoAjudanteWin, ajudanteWin, MSG_WINDOWS } from '../scripts/product/record-window.mjs'

const AQUI = path.dirname(fileURLToPath(import.meta.url))
const GRAVADOR = path.join(AQUI, '..', 'scripts', 'product', 'record-window.mjs')
const PS1 = path.join(AQUI, '..', 'scripts', 'product', 'window.ps1')
const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'vb-janela-'))

test('janela/Windows: o ajudante é o window.ps1 pelo PowerShell, sem perfil e sem esbarrar na política de execução', () => {
  const [cmd, args] = comandoAjudanteWin('clicar', 10, -20, 777)
  assert.match(cmd, /(^|[\\/])powershell\.exe$/i)
  assert.deepEqual(args.slice(0, 5), ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File'])
  assert.equal(args[5], PS1)
  assert.ok(fs.existsSync(args[5]))
  assert.deepEqual(args.slice(6), ['clicar', '10', '-20', '777'])
  assert.match(MSG_WINDOWS, /no Screen Recording or Accessibility permission/)
})

test('janela/Windows: o window.ps1 é só ASCII (o PowerShell 5.1 lê .ps1 sem BOM como ANSI) e tem as operações do window.swift', () => {
  const b = fs.readFileSync(PS1)
  const fora = [...b].findIndex((c) => c > 0x7e || (c < 0x20 && c !== 0x0a && c !== 0x0d && c !== 0x09))
  assert.equal(fora, -1, `non-ASCII byte at ${fora}: ${b.subarray(Math.max(0, fora - 30), fora + 10).toString('utf8')}`)
  const t = b.toString('utf8')
  for (const op of ['permissao', 'listar', 'tela', 'processos', 'frente', 'clicar', 'servir']) assert.match(t, new RegExp(`'${op}'`), op)
})

test('janela/Windows: o gdigrab grava o retângulo da janela na área de trabalho, sem o cursor, pelo tempo do roteiro', () => {
  const a = argsGdigrab({ x: 192, y: -8, w: 626, h: 472 }, 3, 'saida.mp4')
  const v = (k) => a[a.indexOf(k) + 1]
  assert.equal(v('-f'), 'gdigrab')
  assert.equal(v('-i'), 'desktop')
  assert.equal(v('-offset_x'), '192')
  assert.equal(v('-offset_y'), '-8')
  assert.equal(v('-video_size'), '626x472')
  assert.equal(v('-draw_mouse'), '0')
  assert.equal(v('-t'), '3.5')
  assert.ok(a.indexOf('-offset_x') < a.indexOf('-i') && a.indexOf('-t') < a.indexOf('-i'), 'the gdigrab options go before -i')
  assert.equal(v('-pix_fmt'), 'yuv420p')
  assert.equal(a.at(-1), 'saida.mp4')
})

test('janela/Windows: o retângulo é cortado no que existe na tela, com lados pares, e convertido se o ffmpeg mede a tela em outra escala', () => {
  const tela = { x: 0, y: 0, w: 1024, h: 768 }
  assert.deepEqual(areaCaptura({ x: 192, y: 144, w: 627, h: 473 }, tela, { w: 1024, h: 768 }),
    { g: { x: 192, y: 144, w: 626, h: 472 }, px: { x: 192, y: 144, w: 626, h: 472 }, razao: 1 })
  // maximizada passa uns pixels da borda
  assert.deepEqual(areaCaptura({ x: -8, y: -8, w: 1040, h: 744 }, tela, null).g, { x: 0, y: 0, w: 1024, h: 736 })
  // num monitor à esquerda do principal, a coordenada é negativa
  assert.deepEqual(areaCaptura({ x: -1500, y: 100, w: 800, h: 600 }, { x: -1920, y: 0, w: 2944, h: 1080 }, { w: 2944, h: 1080 }).g, { x: -1500, y: 100, w: 800, h: 600 })
  // o ffmpeg vendo a tela pela metade: o retângulo vai na escala dele, e o clique continua em pixels reais
  const r = areaCaptura({ x: 300, y: 150, w: 1200, h: 900 }, { x: 0, y: 0, w: 2560, h: 1600 }, { w: 1280, h: 800 })
  assert.equal(r.razao, 0.5)
  assert.deepEqual(r.g, { x: 150, y: 75, w: 600, h: 450 })
  assert.deepEqual(r.px, { x: 300, y: 150, w: 1200, h: 900 })
  // fora da tela
  assert.equal(areaCaptura({ x: 1100, y: 0, w: 400, h: 300 }, tela, null), null)
})

test('janela/Windows: lê o tamanho da tela que o gdigrab vê', () => {
  const err = "Input #0, gdigrab, from 'desktop':\n  Duration: N/A, start: 1728.140000, bitrate: 125829 kb/s\n  Stream #0:0: Video: bmp, bgra, 1024x768, 125829 kb/s, 5 fps, 1000k tbr, 1000k tbn\n"
  assert.deepEqual(tamanhoDesktop(err), { w: 1024, h: 768 })
  assert.equal(tamanhoDesktop('  Stream #0:0: Video: h264 (avc1 / 0x31637661), yuv420p'), null)
  assert.equal(tamanhoDesktop(''), null)
})

test('janela: escolhe a maior janela comum do programa aberto (ou dos descendentes), com o trecho do título', () => {
  const pares = [[10, 1], [11, 10], [12, 11], [20, 1], [13, 10]]
  const meus = descendentesDe(10, pares)
  assert.deepEqual([...meus].sort((a, b) => a - b), [10, 11, 12, 13])
  const lista = [
    { id: 1, pid: 20, titulo: 'Outro programa', w: 1900, h: 1000, camada: 0 },
    { id: 2, pid: 12, titulo: 'Paleta', w: 900, h: 700, camada: 1 },
    { id: 3, pid: 12, titulo: 'Meu App — Início', w: 800, h: 600, camada: 0 },
    { id: 4, pid: 11, titulo: 'Sobre', w: 300, h: 200, camada: 0 },
    { id: 5, pid: 13, titulo: '', w: 100, h: 60, camada: 0 },
  ]
  assert.equal(escolherJanela(lista, meus).id, 3)
  assert.equal(escolherJanela(lista, meus, 'SOBRE').id, 4)
  assert.equal(escolherJanela(lista, meus, 'nada'), null)
  assert.equal(escolherJanela(lista, new Set([99])), null)
})

test('janela/Windows: das linhas do ajudante, só JSON conta (o PowerShell às vezes solta CLIXML)', () => {
  const s = separarLinhas('#< CLIXML\r\n{"ok":true}\r\n[1,2]\n<Objs Version="1.1.0.1">\n{"tela"')
  assert.deepEqual(s.linhas, ['{"ok":true}', '[1,2]'])
  assert.equal(s.resto, '{"tela"')
})

test('janela/Linux: diz que não grava e o que fazer no lugar, sem tentar swiftc nem PowerShell', () => {
  const finge = ['--import', `data:text/javascript,Object.defineProperty(process,'platform',{value:'linux'})`]
  const dir = tmp()
  fs.writeFileSync(path.join(dir, 'script.json'), JSON.stringify({ dur: 3, passos: [] }))
  for (const args of [['--permission'], ['--launch', 'xterm', '--script', path.join(dir, 'script.json'), '--out', path.join(dir, 'gravacao')]]) {
    const r = spawnSync(process.execPath, [...finge, GRAVADOR, ...args], { encoding: 'utf8' })
    assert.equal(r.status, 3, r.stderr)
    assert.match(r.stderr, /works on macOS and Windows only, and this computer runs Linux/)
    assert.match(r.stderr, /through the browser/)
    assert.match(r.stderr, /record the screen yourself/)
    assert.doesNotMatch(r.stderr, /swiftc|powershell|ENOENT|at file:/i)
  }
  assert.equal(fs.existsSync(path.join(dir, 'gravacao')), false)
})

const SO_WINDOWS = process.platform === 'win32' ? false : 'grava janela do Windows; no Mac a gravação precisa de permissão de Gravação de Tela e é conferida à mão'

// cor média do miolo de um quadro: [r, g, b]
const corDoMeio = (arq) => [...execFileSync('ffmpeg', ['-v', 'error', '-i', arq, '-vf', 'crop=iw/2:ih/2,scale=1:1:flags=area', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-'])]
const medir = (arq) => execFileSync('ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height', '-of', 'csv=p=0:s=x', arq], { encoding: 'utf8' }).trim().split('x').map(Number)

test('janela/Windows: grava só a janela de teste, clica no botão, a imagem muda depois do clique e o programa é fechado', { skip: SO_WINDOWS, timeout: 240000 }, () => {
  const dir = tmp()
  const saida = process.env.JANELA_TESTE_SAIDA ? path.resolve(process.env.JANELA_TESTE_SAIDA) : path.join(dir, 'gravacao')
  const marca = 'Janela de teste ' + crypto.randomBytes(3).toString('hex')
  const form = path.join(dir, 'form.ps1')
  // o botão ocupa a janela toda abaixo da barra de título e só muda de cor com o clique (sem realce do mouse por cima)
  fs.writeFileSync(form, [
    'Add-Type -AssemblyName System.Windows.Forms',
    'Add-Type -AssemblyName System.Drawing',
    '$f = New-Object System.Windows.Forms.Form',
    `$f.Text = '${marca}'`,
    '$f.Width = 640',
    '$f.Height = 480',
    "$f.StartPosition = 'CenterScreen'",
    '$f.BackColor = [System.Drawing.Color]::DarkBlue',
    '$b = New-Object System.Windows.Forms.Button',
    "$b.Text = 'Clique aqui'",
    "$b.Dock = 'Fill'",
    "$b.FlatStyle = 'Flat'",
    '$b.BackColor = [System.Drawing.Color]::DarkBlue',
    '$b.ForeColor = [System.Drawing.Color]::White',
    '$b.FlatAppearance.MouseOverBackColor = [System.Drawing.Color]::DarkBlue',
    '$b.FlatAppearance.MouseDownBackColor = [System.Drawing.Color]::DarkBlue',
    "$b.Font = New-Object System.Drawing.Font('Segoe UI', 20)",
    '$b.Add_Click({',
    '  $b.BackColor = [System.Drawing.Color]::Orange',
    '  $b.FlatAppearance.MouseOverBackColor = [System.Drawing.Color]::Orange',
    '  $b.FlatAppearance.MouseDownBackColor = [System.Drawing.Color]::Orange',
    '  $b.ForeColor = [System.Drawing.Color]::Black',
    "  $b.Text = 'Clicou'",
    '})',
    '$f.Controls.Add($b)',
    '[void]$f.ShowDialog()',
    '',
  ].join('\n'))
  const script = path.join(dir, 'script.json')
  const alvo = { x: 220, y: 200, w: 200, h: 120 }
  fs.writeFileSync(script, JSON.stringify({ dur: 3, passos: [{ t: 0.6, frase: 'Clique no botao.', aponta: alvo, clique: { x: 320, y: 260 }, sucesso: alvo }] }))

  const lancar = `powershell -NoProfile -ExecutionPolicy Bypass -File "${form}"`
  const r = spawnSync(process.execPath, [GRAVADOR, '--launch', lancar, '--title', marca, '--script', script, '--out', saida], { encoding: 'utf8', timeout: 200000 })
  fs.mkdirSync(saida, { recursive: true })
  fs.writeFileSync(path.join(saida, 'gravador.log'), `status ${r.status}\n--- stdout\n${r.stdout}\n--- stderr\n${r.stderr}\n`)
  assert.equal(r.status, 0, `the recorder failed:\n${r.stdout}\n${r.stderr}`)

  const ev = JSON.parse(fs.readFileSync(path.join(saida, 'events.json'), 'utf8'))
  const quadros = JSON.parse(fs.readFileSync(path.join(saida, 'frames.json'), 'utf8'))
  assert.match(ev.captura.metodo, /gdigrab/)
  assert.ok(quadros.length >= 60, `only ${quadros.length} frames in 3 s`)
  const primeiro = path.join(saida, 'frames', quadros[0][0]), ultimo = path.join(saida, 'frames', quadros.at(-1)[0])
  assert.ok(fs.existsSync(primeiro) && fs.existsSync(ultimo))

  // o quadro tem o tamanho da janela (640×480 lógicos, menos a borda invisível), não o da tela inteira
  const dsf = ev.aparelho.dsf
  const [w, h] = medir(primeiro)
  assert.ok(Math.abs(w - 640 * dsf) <= 40 * dsf && Math.abs(h - 480 * dsf) <= 40 * dsf, `frame ${w}×${h}, expected about ${640 * dsf}×${480 * dsf}`)
  const tela = ajudanteWin('tela')
  assert.ok(w < tela.w && h < tela.h, `the frame (${w}×${h}) is as big as the screen (${tela.w}×${tela.h})`)

  const passo = ev.eventos.find((e) => e.tipo === 'passo')
  const toque = ev.eventos.find((e) => e.tipo === 'toque')
  assert.ok(passo && passo.n === 1 && passo.legenda === 'Clique no botao.', JSON.stringify(ev.eventos))
  assert.ok(toque, `no "toque" event: ${JSON.stringify(ev.eventos)}`)
  assert.deepEqual(toque.ponto, [320, 260])

  // o clique pegou: o botão azul do começo está laranja no fim
  const antes = corDoMeio(primeiro), depois = corDoMeio(ultimo)
  assert.ok(antes[2] > antes[0] + 60, `the first frame should show the blue button; mean color ${antes}`)
  assert.ok(depois[0] > depois[2] + 60, `the last frame should show the orange button after the click; mean color ${depois}`)

  // fechou o que abriu: a janela de teste não está mais na tela
  let resta = true
  for (let i = 0; i < 3 && resta; i++) {
    resta = ajudanteWin('listar').some((j) => j.titulo === marca)
    if (resta) Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 1000)
  }
  assert.equal(resta, false, 'the test window is still open: the recorder did not close what it opened')
})
