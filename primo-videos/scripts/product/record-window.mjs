#!/usr/bin/env node
// Grava a janela de um programa no macOS ou no Windows, só ela, no formato que o gravador da skill entrega
// (frames/ + frames.json + events.json): o molde real-screen-camera usa isso como se fosse a tela.
//
//   node record-window.mjs --launch "<comando>" [--folder <cwd do programa>] --script script.json --out <folder>
//   node record-window.mjs --pid <pid> [--title "trecho"] --script script.json --out <folder>
//   node record-window.mjs --permission        # confere as permissões do macOS (no Windows não há o que ligar)
//
// script.json (coordenadas em pontos, relativas ao canto de cima da janela, que é o que a captura mostra sem a sombra):
//   { "dur": 5, "passos": [ { "t": 0.4, "frase": "Toque em Salvar cesta.",
//       "aponta": {"x":93,"y":793,"w":334,"h":42},  // onde o foco da câmera vai
//       "clique": {"x":260,"y":814},                // opcional: clica de verdade (no Mac, precisa de Acessibilidade)
//       "sucesso": {"x":84,"y":700,"w":300,"h":50}  // opcional: o resultado, no fim do passo
//   } ] }
// macOS: screencapture -l (a janela pelo id) + window.swift. Windows: ffmpeg gdigrab do retângulo da janela na área de
// trabalho + window.ps1; lá "ponto" é o pixel dividido pela escala do monitor (100% → 1). Outros sistemas: não grava.
// --launch: o programa é aberto por aqui e só ele (o grupo de processos, ou a árvore no Windows, que esta chamada criou) é fechado no fim.
// --pid: grava a janela de um programa que você abriu; este script nunca o fecha.
// Nunca grava janela por nome de programa, nunca mata processo por nome ou porta.
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import crypto from 'node:crypto'
import { spawn, spawnSync, execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const AQUI = path.dirname(fileURLToPath(import.meta.url))
const MAC = process.platform === 'darwin', WIN = process.platform === 'win32'
export const MSG_TELA = 'The Screen Recording permission is missing. Turn it on in System Settings → Privacy & Security → Screen Recording, tick the app that runs the skill (Terminal, VS Code, iTerm…), quit and reopen that app, and run again. I stopped here; I will not keep retrying.'
export const MSG_ACESSIBILIDADE = 'The script asks for a click, and the Accessibility permission is missing. Turn it on in System Settings → Privacy & Security → Accessibility, tick the app that runs the skill, quit and reopen that app, and run again (or take the "clique" out of the script and click yourself at that moment). I stopped here.'
export const MSG_WINDOWS = 'Windows has no Screen Recording or Accessibility permission to turn on: ffmpeg (gdigrab) records the part of the screen where the window is, and the clicks use the system mouse. While it records, keep the window restored (not minimized) and nothing on top of it.'
const SISTEMA = { linux: 'Linux', freebsd: 'FreeBSD', openbsd: 'OpenBSD', sunos: 'SunOS', aix: 'AIX' }[process.platform] || process.platform
export const MSG_SEM_SUPORTE = `Recording the window of a native program works on macOS and Windows only, and this computer runs ${SISTEMA}. If the program is a web app, record it through the browser instead (types 1 and 2, scripts/tutorial/record.mjs). Otherwise, record the screen yourself (OBS or the desktop's own screen recorder) and hand me the video file. I stopped here.`
const MSG_SEM_FFMPEG = 'ffmpeg was not found. Install it (winget install ffmpeg), open a new terminal and run again.'
const semSuporte = () => { const e = new Error(MSG_SEM_SUPORTE); e.codigo = 'SEM_SUPORTE'; return e }

// O ajudante em Swift é compilado uma vez e guardado por hash do código: trocou o .swift, recompila.
export function ajudante() {
  const fonte = fs.readFileSync(path.join(AQUI, 'window.swift'))
  const hash = crypto.createHash('sha1').update(fonte).digest('hex').slice(0, 10)
  const dir = path.join(os.tmpdir(), 'videostudio-janela')
  const bin = path.join(dir, `janela-${hash}`)
  if (!fs.existsSync(bin)) {
    fs.mkdirSync(dir, { recursive: true })
    const r = spawnSync('swiftc', ['-O', path.join(AQUI, 'window.swift'), '-o', bin], { encoding: 'utf8' })
    if (r.status !== 0) throw new Error('could not compile the macOS helper (it needs the Xcode Command Line Tools: xcode-select --install)\n' + (r.stderr || '').split('\n').slice(0, 5).join('\n'))
  }
  return bin
}
const rodaJson = (args) => JSON.parse(execFileSync(ajudante(), args, { encoding: 'utf8' }))

// ── Windows: o window.ps1 pelo PowerShell 5.1, que vem em todo Windows ──
function powershell() {
  const p = path.join(process.env.SystemRoot || 'C:\\Windows', 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe')
  return fs.existsSync(p) ? p : 'powershell.exe'
}
export const comandoAjudanteWin = (...op) => [powershell(), ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', path.join(AQUI, 'window.ps1'), ...op.map(String)]]

// Só as linhas que começam com { ou [ são respostas: o PowerShell às vezes solta outra coisa na saída.
export function separarLinhas(buf) {
  const partes = buf.split('\n')
  const resto = partes.pop()
  return { linhas: partes.map((l) => l.trim()).filter((l) => l.startsWith('{') || l.startsWith('[')), resto }
}

const respostaWin = (texto) => {
  const r = JSON.parse(texto)
  if (r && !Array.isArray(r) && r.erro) throw new Error(`the Windows helper (window.ps1) failed: ${r.erro}`)
  return r
}
// Uma chamada avulsa (≈2 s: o PowerShell compila o C# a cada vez). Na gravação vale o abrirAjudanteWin.
export function ajudanteWin(...op) {
  const [cmd, args] = comandoAjudanteWin(...op)
  const r = spawnSync(cmd, args, { encoding: 'utf8', windowsHide: true })
  if (r.error) throw new Error(`could not start PowerShell (${r.error.message})`)
  const { linhas } = separarLinhas((r.stdout || '') + '\n')
  if (!linhas.length) throw new Error(`the Windows helper (window.ps1) gave no answer (code ${r.status})\n${(r.stderr || '').trim().split('\n').slice(0, 5).join('\n')}`)
  return respostaWin(linhas.at(-1))
}

// Um PowerShell só durante a gravação: compila o C# uma vez e depois responde em milissegundos (o clique sai na hora).
export function abrirAjudanteWin() {
  const [cmd, args] = comandoAjudanteWin('servir')
  const p = spawn(cmd, args, { stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true })
  const fila = []
  let buf = '', erro = '', fim = null
  const encerra = (motivo) => {
    if (!fim) fim = new Error(`the Windows helper (window.ps1 through PowerShell) stopped: ${motivo}${erro.trim() ? '\n' + erro.trim().split('\n').slice(0, 6).join('\n') : ''}`)
    for (const f of fila.splice(0)) f(null)
  }
  p.stdout.setEncoding('utf8')
  p.stderr.setEncoding('utf8')
  p.stderr.on('data', (d) => { erro += d })
  p.stdout.on('data', (d) => { const s = separarLinhas(buf + d); buf = s.resto; for (const l of s.linhas) fila.shift()?.(l) })
  p.stdin.on('error', () => {})
  p.on('error', (e) => encerra(`could not start PowerShell (${e.message})`))
  p.on('close', (c) => encerra(`code ${c}`))
  const pede = (...op) => new Promise((ok, falha) => {
    if (fim) return falha(fim)
    fila.push((l) => {
      if (l === null) return falha(fim)
      try { ok(respostaWin(l)) } catch (e) { falha(e) }
    })
    p.stdin.write(op.join(' ') + '\n')
  })
  const fecha = () => new Promise((r) => {
    if (fim) return r()
    const t = setTimeout(() => { try { p.kill() } catch {} }, 4000)
    p.once('close', () => { clearTimeout(t); r() })
    p.stdin.end()
  })
  return { pede, fecha }
}

export function permissoes() {
  if (WIN) return ajudanteWin('permissao')
  if (!MAC) throw semSuporte()
  return rodaJson(['permissao'])
}
export function janelas() {
  if (WIN) return ajudanteWin('listar')
  if (!MAC) throw semSuporte()
  return rodaJson(['listar'])
}

export function descendentesDe(raiz, pares) {
  const filhos = new Map()
  for (const [pid, ppid] of pares) (filhos.get(ppid) || filhos.set(ppid, []).get(ppid)).push(pid)
  const todos = new Set([raiz]); const fila = [raiz]
  while (fila.length) for (const f of filhos.get(fila.pop()) || []) if (!todos.has(f)) { todos.add(f); fila.push(f) }
  return todos
}
function descendentes(raiz) {
  const ps = execFileSync('ps', ['-A', '-o', 'pid=,ppid='], { encoding: 'utf8' }).trim().split('\n').map((l) => l.trim().split(/\s+/).map(Number))
  return descendentesDe(raiz, ps)
}

// A janela principal do programa: do processo (ou dos descendentes), camada 0, a maior, com o título pedido.
export function escolherJanela(lista, meus, titulo) {
  let js = lista.filter((w) => meus.has(w.pid) && w.camada === 0 && w.w >= 120 && w.h >= 80)
  if (titulo) js = js.filter((w) => (w.titulo || '').toLowerCase().includes(titulo.toLowerCase()))
  js.sort((a, b) => b.w * b.h - a.w * a.h)
  return js[0] || null
}
export function acharJanela({ pid, titulo }) {
  const meus = descendentes(pid)
  return escolherJanela(janelas(), meus, titulo)
}

const espera = (ms) => new Promise((r) => setTimeout(r, ms))

export async function gravarJanela(o) {
  if (WIN) return gravarJanelaWindows(o)
  if (!MAC) throw semSuporte()
  const perm = permissoes()
  if (!perm.tela) { const e = new Error(MSG_TELA); e.codigo = 'SEM_PERMISSAO_TELA'; throw e }
  const roteiro = o.roteiro
  const passos = roteiro.passos || []
  if (passos.some((p) => p.clique) && !perm.acessibilidade) { const e = new Error(MSG_ACESSIBILIDADE); e.codigo = 'SEM_PERMISSAO_ACESSIBILIDADE'; throw e }
  const dur = roteiro.dur || Math.max(3, ...passos.map((p) => p.t + 2))
  const saida = path.resolve(o.saida)
  fs.rmSync(path.join(saida, 'frames'), { recursive: true, force: true })
  fs.mkdirSync(path.join(saida, 'frames'), { recursive: true })

  let filho = null, pid = o.pid
  const fecha = () => { if (filho) { try { process.kill(-filho.pid, 'SIGTERM') } catch {} } }
  try {
    if (o.abrir) {
      filho = spawn('/bin/sh', ['-c', o.abrir], { cwd: o.pasta || process.cwd(), detached: true, stdio: 'ignore' })
      pid = filho.pid
    }
    if (!pid) throw new Error('missing --launch "<command>" or --pid <pid>')
    let j = null
    for (let i = 0; i < 60 && !j; i++) { j = acharJanela({ pid, titulo: o.titulo }); if (!j) await espera(500) }
    if (!j) throw new Error(`found no visible window of the program (pid ${pid}${o.titulo ? `, title containing "${o.titulo}"` : ''}) in 30 s`)
    // traz só a janela do próprio programa para a frente (sem isso o macOS grava a janela cinza, de fundo)
    spawnSync('osascript', ['-e', `tell application "System Events" to set frontmost of (first process whose unix id is ${j.pid}) to true`], { stdio: 'ignore' })
    await espera(700)
    j = acharJanela({ pid, titulo: o.titulo }) || j

    const mov = path.join(saida, 'janela.mov')
    fs.rmSync(mov, { force: true })
    const t0 = Date.now()
    const cap = spawn('screencapture', ['-v', '-o', `-l${j.id}`, `-V${Math.ceil(dur + 0.5)}`, mov], { stdio: 'ignore' })
    const capFim = new Promise((r) => cap.on('close', r))
    const agora = () => (Date.now() - t0) / 1000
    const real = []
    for (const p of passos) {
      const tc = p.t + (p.aponta ? 0.9 : 0)
      while (agora() < tc) await espera(20)
      if (p.clique) {
        // o clique mexe no mouse de verdade: só sai se a janela do programa é a que está por cima naquele ponto
        const x = j.x + p.clique.x, y = j.y + p.clique.y
        const topo = janelas().find((w) => w.camada === 0 && x >= w.x && x < w.x + w.w && y >= w.y && y < w.y + w.h)
        if (!topo || topo.id !== j.id) throw new Error(`the click of step ${real.length + 1} would land on another window (${topo ? `"${topo.titulo || topo.dono}"` : 'none'}): I did not click. Keep the program's window in view and run again.`)
        spawnSync(ajudante(), ['clicar', String(x), String(y)])
      }
      real.push({ ...p, tReal: tc })
    }
    while (agora() < dur) await espera(50)
    await capFim
    fs.rmSync(path.join(saida, 'janela.png'), { force: true })
    if (!fs.existsSync(mov) || fs.statSync(mov).size < 1000) throw new Error('the recording came out empty: check the Screen Recording permission and whether the window stayed visible')
    return await montarSaida({ saida, mov, janela: j, real, dur, o })
  } finally { fecha() }
}

// ── Windows ──
// gdigrab grava um retângulo da área de trabalho (o que está na tela, como a pessoa vê), não a janela pelo título:
// o title= pede o título exato e único, pega só a área de dentro (sem a barra) e sai preto em janela desenhada pela GPU.
export function argsGdigrab(r, dur, arq, fps = 30) {
  return ['-hide_banner', '-loglevel', 'error', '-y', '-f', 'gdigrab', '-framerate', String(fps), '-draw_mouse', '0',
    '-offset_x', String(r.x), '-offset_y', String(r.y), '-video_size', `${r.w}x${r.h}`, '-t', String(+(dur + 0.5).toFixed(2)), '-i', 'desktop',
    '-c:v', 'libx264', '-preset', 'ultrafast', '-crf', '12', '-pix_fmt', 'yuv420p', arq]
}
export const ARGS_SONDA_DESKTOP = ['-hide_banner', '-f', 'gdigrab', '-framerate', '5', '-i', 'desktop', '-frames:v', '1', '-f', 'null', '-']
export function tamanhoDesktop(stderr) {
  const m = /Video:[^\n]*?[ ,](\d{2,5})x(\d{2,5})\b/.exec(stderr || '')
  return m ? { w: +m[1], h: +m[2] } : null
}

// O retângulo que o gdigrab grava: o da janela (em pixels reais, do window.ps1), cortado no que existe na tela e com
// lados pares (o H.264 pede). Se o ffmpeg mede a tela em outra escala que o ajudante (escala de tela do Windows), converte.
export function areaCaptura(jan, tela, desk) {
  const r = desk && tela.w && Math.abs(desk.w / tela.w - 1) > 0.01 ? desk.w / tela.w : 1
  const x0 = Math.max(jan.x, tela.x), y0 = Math.max(jan.y, tela.y)
  const x1 = Math.min(jan.x + jan.w, tela.x + tela.w), y1 = Math.min(jan.y + jan.h, tela.y + tela.h)
  const par = (v) => Math.max(0, Math.floor(v / 2) * 2)
  const g = { x: Math.ceil(x0 * r) + 0, y: Math.ceil(y0 * r) + 0 }
  g.w = par(Math.floor(x1 * r) - g.x)
  g.h = par(Math.floor(y1 * r) - g.y)
  if (g.w < 64 || g.h < 64) return null
  return { g, px: { x: x0, y: y0, w: g.w / r, h: g.h / r }, razao: r }
}

async function acharJanelaWin(aj, { pid, titulo }) {
  const meus = descendentesDe(pid, await aj.pede('processos'))
  return { j: escolherJanela(await aj.pede('listar'), meus, titulo), meus }
}

// Fecha o que esta chamada abriu: a árvore do cmd.exe do --launch e os processos dela vistos durante a gravação.
// Se o cmd.exe já saiu, o pid dele pode ser de outro processo agora: fica de fora.
function fecharArvoreWin(filho, meus) {
  const pids = new Set(meus)
  if (filho.exitCode === null && filho.signalCode === null) pids.add(filho.pid); else pids.delete(filho.pid)
  for (const p of [filho.pid, ...pids].filter((p, i, a) => pids.has(p) && a.indexOf(p) === i)) {
    spawnSync('taskkill', ['/F', '/T', '/PID', String(p)], { stdio: 'ignore', windowsHide: true })
  }
}

const primeirasLinhas = (t) => t.trim().split('\n').slice(0, 5).join('\n') || 'no message'

async function gravarJanelaWindows(o) {
  const roteiro = o.roteiro
  const passos = roteiro.passos || []
  const dur = roteiro.dur || Math.max(3, ...passos.map((p) => p.t + 2))
  const saida = path.resolve(o.saida)
  fs.rmSync(path.join(saida, 'frames'), { recursive: true, force: true })
  fs.mkdirSync(path.join(saida, 'frames'), { recursive: true })

  const aj = abrirAjudanteWin()
  let filho = null, pid = o.pid, meus = new Set(), cap = null
  try {
    if (o.abrir) {
      // shell: true é o cmd.exe: roda npm/npx (.cmd), && e o "subir" do reconhecimento como a pessoa digitaria
      filho = spawn(o.abrir, { cwd: o.pasta || process.cwd(), shell: true, stdio: 'ignore' })
      filho.on('error', () => {})
      pid = filho.pid
    }
    if (!pid) throw new Error('missing --launch "<command>" or --pid <pid>')
    let j = null
    const limite = Date.now() + 30000
    while (!j && Date.now() < limite) {
      ({ j, meus } = await acharJanelaWin(aj, { pid, titulo: o.titulo }))
      if (!j && filho && filho.exitCode) throw new Error(`the --launch command exited with code ${filho.exitCode} before showing a window`)
      if (!j) await espera(500)
    }
    if (!j) throw new Error(`found no visible window of the program (pid ${pid}${o.titulo ? `, title containing "${o.titulo}"` : ''}) in 30 s (a minimized window does not count: restore it)`)
    // restaura se estiver minimizada e põe por cima das outras (posição e tamanho ficam como estão)
    await aj.pede('frente', j.id)
    await espera(700)
    const depois = await acharJanelaWin(aj, { pid, titulo: o.titulo })
    j = depois.j || j
    meus = new Set([...meus, ...depois.meus])

    // o ffmpeg e o ajudante precisam concordar em pixels: o tamanho da tela que o gdigrab vê decide a conversão
    const sonda = spawnSync('ffmpeg', ARGS_SONDA_DESKTOP, { encoding: 'utf8', windowsHide: true })
    if (sonda.error) throw new Error(MSG_SEM_FFMPEG)
    const area = areaCaptura(j, await aj.pede('tela'), tamanhoDesktop(sonda.stderr))
    if (!area) throw new Error(`the window "${j.titulo || j.dono}" is off the screen (${j.x},${j.y} ${j.w}×${j.h} px): move it into view and run again`)
    if (area.razao !== 1) console.error(`· ffmpeg sees the screen at ${area.razao.toFixed(3)}× the size Windows reports (display scaling): I converted the window's rectangle`)
    const escala = j.escala || 1

    const mp4 = path.join(saida, 'janela.mp4')
    fs.rmSync(mp4, { force: true })
    let errCap = ''
    cap = spawn('ffmpeg', argsGdigrab(area.g, dur, mp4), { stdio: ['ignore', 'ignore', 'pipe'], windowsHide: true })
    cap.stderr.setEncoding('utf8')
    cap.stderr.on('data', (d) => { errCap += d })
    const capFim = new Promise((r) => { cap.on('close', r); cap.on('error', () => r(null)) })
    // o relógio começa quando o ffmpeg abre o arquivo de saída: a essa altura o gdigrab já leu o primeiro quadro
    const t0 = await new Promise((ok) => {
      const iv = setInterval(() => { if (fs.existsSync(mp4)) { clearInterval(iv); ok(Date.now()) } }, 15)
      capFim.then(() => { clearInterval(iv); ok(null) })
    })
    if (t0 === null) throw new Error(`ffmpeg (gdigrab) did not start recording:\n${primeirasLinhas(errCap)}`)
    const agora = () => (Date.now() - t0) / 1000
    const real = []
    for (const p of passos) {
      const tc = p.t + (p.aponta ? 0.9 : 0)
      while (agora() < tc) await espera(20)
      if (p.clique) {
        // o ajudante confere e clica na mesma chamada: só clica se a janela que recebe o clique ali é a do programa
        const x = Math.round(area.px.x + p.clique.x * escala), y = Math.round(area.px.y + p.clique.y * escala)
        const r = await aj.pede('clicar', x, y, j.id)
        if (!r.ok) throw new Error(`the click of step ${real.length + 1} would land on another window (${r.topo ? `"${r.topo.titulo || r.topo.dono}"` : 'none'}): I did not click. Keep the program's window in view and run again.`)
      }
      real.push({ ...p, tReal: tc })
    }
    while (agora() < dur) await espera(50)
    await capFim
    if (!fs.existsSync(mp4) || fs.statSync(mp4).size < 1000) throw new Error(`the recording came out empty (ffmpeg gdigrab):\n${primeirasLinhas(errCap)}`)
    const pontos = { ...j, w: area.g.w / (area.razao * escala), h: area.g.h / (area.razao * escala) }
    return await montarSaida({ saida, mov: mp4, janela: pontos, real, dur, o, metodo: 'ffmpeg gdigrab (the window\'s rectangle of the desktop)' })
  } finally {
    if (cap && cap.exitCode === null) { try { cap.kill() } catch {} }
    if (filho) fecharArvoreWin(filho, meus)
    await aj.fecha()
  }
}

const sonda = (arq) => {
  const [w, h] = execFileSync('ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height', '-of', 'csv=p=0:s=x', arq], { encoding: 'utf8' }).trim().split('x').map(Number)
  const d = +execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', arq], { encoding: 'utf8' }).trim()
  return { w, h, d }
}

// O instante em que um retângulo da janela muda de verdade (o efeito do clique), medido nos quadros gravados.
function primeiraMudanca(mov, ret, dsf, apos) {
  const c = `crop=${Math.round(ret.w * dsf)}:${Math.round(ret.h * dsf)}:${Math.round(ret.x * dsf)}:${Math.round(ret.y * dsf)}`
  const r = spawnSync('ffmpeg', ['-v', 'info', '-i', mov, '-vf', `fps=30,${c},select='gt(scene,0.004)',showinfo`, '-f', 'null', '-'], { encoding: 'utf8' })
  const ts = [...(r.stderr || '').matchAll(/pts_time:([\d.]+)/g)].map((m) => +m[1]).filter((t) => t >= apos)
  return ts.length ? ts[0] : null
}

async function montarSaida({ saida, mov, janela, real, dur, o, metodo = 'screencapture -v -l (window only)' }) {
  const { w, h, d } = sonda(mov)
  const dsf = w / janela.w
  const larguraAlvo = o.largura && o.largura < w ? o.largura : w
  const esc = larguraAlvo === w ? [] : ['-vf', `scale=${larguraAlvo}:-2`]
  const fps = 30
  execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', mov, '-vf', `fps=${fps}${esc.length ? `,scale=${larguraAlvo}:-2` : ''}`, '-q:v', '2', path.join(saida, 'frames', '%05d.jpg')])
  const n = fs.readdirSync(path.join(saida, 'frames')).filter((f) => f.endsWith('.jpg')).length
  const quadros = Array.from({ length: n }, (_, i) => [String(i + 1).padStart(5, '0') + '.jpg', +(i / fps).toFixed(3)])
  fs.writeFileSync(path.join(saida, 'frames.json'), JSON.stringify(quadros))

  // o toque entra no instante em que o clique mudou a tela de verdade, quando dá para medir nos quadros
  const dsfSaida = larguraAlvo / janela.w
  const eventos = []
  real.forEach((p, i) => {
    let tc = p.tReal
    if (p.clique && (p.sucesso || p.aponta)) {
      const medido = primeiraMudanca(mov, p.sucesso || p.aponta, dsf, p.tReal - 0.4)
      if (medido !== null) tc = Math.max(p.t + 0.7, medido - 0.05)
    }
    eventos.push({ t: +p.t.toFixed(3), tipo: 'passo', n: i + 1, legenda: p.frase || `Step ${i + 1}` })
    if (p.aponta) {
      const ponto = p.clique ? [p.clique.x, p.clique.y] : [p.aponta.x + p.aponta.w / 2, p.aponta.y + p.aponta.h / 2]
      eventos.push({ t: +(p.t + 0.2).toFixed(3), t1: +(p.t + 0.7).toFixed(3), tipo: 'move', de: ponto.map((v) => v - 40), para: ponto })
      eventos.push({ t: +tc.toFixed(3), tipo: p.clique ? 'toque' : 'aponta', alvo: p.alvo || `window ${p.aponta.x},${p.aponta.y}`, ret: p.aponta, ponto, realce: true })
    }
    if (p.sucesso) eventos.push({ t: +(tc + 0.5).toFixed(3), tipo: 'sucesso', ret: p.sucesso })
  })
  const ev = { id: path.basename(saida), versao: 'janela', aparelho: { nome: 'janela', viewport: { width: Math.round(janela.w), height: Math.round(janela.h) }, dsf: +dsfSaida.toFixed(3), toque: false, formato: '16x9' },
    captura: { metodo, qps: fps, qpsPico: fps, largura: larguraAlvo, altura: Math.round(h * larguraAlvo / w), quadros: 'frames.json' },
    duracao: +Math.min(d, quadros.at(-1)[1] + 1 / fps).toFixed(3), nativos: [], errosDaPagina: [],
    janela: { dono: janela.dono, titulo: janela.titulo, pontos: { w: janela.w, h: janela.h }, pixels: { w, h } },
    eventos: eventos.sort((a, b) => a.t - b.t) }
  fs.writeFileSync(path.join(saida, 'events.json'), JSON.stringify(ev, null, 1))
  return { saida, eventos: ev, quadros: n, janela }
}

// ── linha de comando ──
function principal() {
  const argv = process.argv.slice(2)
  const arg = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 ? argv[i + 1] : d }
  if (argv.includes('--permission')) {
    if (WIN) {
      try { permissoes() } catch (e) { console.error(`✗ the Windows helper (scripts/product/window.ps1, through PowerShell) did not run: ${primeirasLinhas(e.message)}`); process.exit(1) }
      console.log('✓ ' + MSG_WINDOWS)
      process.exit(0)
    }
    if (!MAC) { console.error(MSG_SEM_SUPORTE); process.exit(3) }
    const p = permissoes()
    console.log(p.tela ? '✓ Screen Recording: on' : '✗ ' + MSG_TELA)
    console.log(p.acessibilidade ? '✓ Accessibility: on (the script can click)' : '· Accessibility: off (only matters if the script has a "clique")')
    process.exit(p.tela ? 0 : 3)
  }
  if (!arg('script') || !arg('out') || (!arg('launch') && !arg('pid'))) {
    console.error('usage: node record-window.mjs (--launch "<command>" [--folder <dir>] | --pid <pid>) --script script.json --out <folder> [--title "part of the title"] [--width 2560]\n       node record-window.mjs --permission')
    process.exit(1)
  }
  if (!MAC && !WIN) { console.error(MSG_SEM_SUPORTE); process.exit(3) }
  const roteiro = JSON.parse(fs.readFileSync(arg('script'), 'utf8'))
  gravarJanela({ abrir: arg('launch'), pasta: arg('folder'), pid: arg('pid') ? +arg('pid') : null, titulo: arg('title'), roteiro, saida: arg('out'), largura: arg('width') ? +arg('width') : null })
    .then((r) => { console.log(`✓ ${r.quadros} frames of the window "${r.janela.titulo || r.janela.dono}" (${Math.round(r.janela.w)}×${Math.round(r.janela.h)} pt) in ${r.saida}`) })
    .catch((e) => { console.error(e.codigo ? e.message : '✗ ' + e.message); process.exit(e.codigo ? 3 : 1) })
}
if (process.argv[1] && fs.realpathSync(process.argv[1]) === fs.realpathSync(fileURLToPath(import.meta.url))) principal()
