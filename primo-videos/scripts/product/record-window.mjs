#!/usr/bin/env node
// Grava a janela de um programa no macOS, só ela, no formato que o gravador da skill entrega
// (frames/ + frames.json + events.json): o molde real-screen-camera usa isso como se fosse a tela.
//
//   node record-window.mjs --launch "<comando>" [--folder <cwd do programa>] --script script.json --out <folder>
//   node record-window.mjs --pid <pid> [--title "trecho"] --script script.json --out <folder>
//   node record-window.mjs --permission        # só confere as permissões do macOS
//
// script.json (coordenadas em pontos, relativas ao canto de cima da janela, que é o que a captura mostra sem a sombra):
//   { "dur": 5, "passos": [ { "t": 0.4, "frase": "Toque em Salvar cesta.",
//       "aponta": {"x":93,"y":793,"w":334,"h":42},  // onde o foco da câmera vai
//       "clique": {"x":260,"y":814},                // opcional: clica de verdade (precisa de Acessibilidade)
//       "sucesso": {"x":84,"y":700,"w":300,"h":50}  // opcional: o resultado, no fim do passo
//   } ] }
// --launch: o programa é aberto por aqui e só ele (o grupo de processos que esta chamada criou) é fechado no fim.
// --pid: grava a janela de um programa que você abriu; este script nunca o fecha.
// Nunca grava janela por nome de programa, nunca mata processo por nome ou porta.
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import crypto from 'node:crypto'
import { spawn, spawnSync, execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const AQUI = path.dirname(fileURLToPath(import.meta.url))
export const MSG_TELA = 'The Screen Recording permission is missing. Turn it on in System Settings → Privacy & Security → Screen Recording, tick the app that runs the skill (Terminal, VS Code, iTerm…), quit and reopen that app, and run again. I stopped here; I will not keep retrying.'
export const MSG_ACESSIBILIDADE = 'The script asks for a click, and the Accessibility permission is missing. Turn it on in System Settings → Privacy & Security → Accessibility, tick the app that runs the skill, quit and reopen that app, and run again (or take the "clique" out of the script and click yourself at that moment). I stopped here.'

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

export function permissoes() { return rodaJson(['permissao']) }
export function janelas() { return rodaJson(['listar']) }

function descendentes(raiz) {
  const ps = execFileSync('ps', ['-A', '-o', 'pid=,ppid='], { encoding: 'utf8' }).trim().split('\n').map((l) => l.trim().split(/\s+/).map(Number))
  const filhos = new Map()
  for (const [pid, ppid] of ps) (filhos.get(ppid) || filhos.set(ppid, []).get(ppid)).push(pid)
  const todos = new Set([raiz]); const fila = [raiz]
  while (fila.length) for (const f of filhos.get(fila.pop()) || []) if (!todos.has(f)) { todos.add(f); fila.push(f) }
  return todos
}

// A janela principal do programa: do processo (ou dos descendentes), camada 0, a maior, com o título pedido.
export function acharJanela({ pid, titulo }) {
  const meus = descendentes(pid)
  let js = janelas().filter((w) => meus.has(w.pid) && w.camada === 0 && w.w >= 120 && w.h >= 80)
  if (titulo) js = js.filter((w) => w.titulo.toLowerCase().includes(titulo.toLowerCase()))
  js.sort((a, b) => b.w * b.h - a.w * a.h)
  return js[0] || null
}

const espera = (ms) => new Promise((r) => setTimeout(r, ms))

export async function gravarJanela(o) {
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

async function montarSaida({ saida, mov, janela, real, dur, o }) {
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
    captura: { metodo: 'screencapture -v -l (window only)', qps: fps, qpsPico: fps, largura: larguraAlvo, altura: Math.round(h * larguraAlvo / w), quadros: 'frames.json' },
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
    const p = permissoes()
    console.log(p.tela ? '✓ Screen Recording: on' : '✗ ' + MSG_TELA)
    console.log(p.acessibilidade ? '✓ Accessibility: on (the script can click)' : '· Accessibility: off (only matters if the script has a "clique")')
    process.exit(p.tela ? 0 : 3)
  }
  if (!arg('script') || !arg('out') || (!arg('launch') && !arg('pid'))) {
    console.error('usage: node record-window.mjs (--launch "<command>" [--folder <dir>] | --pid <pid>) --script script.json --out <folder> [--title "part of the title"] [--width 2560]\n       node record-window.mjs --permission')
    process.exit(1)
  }
  const roteiro = JSON.parse(fs.readFileSync(arg('script'), 'utf8'))
  gravarJanela({ abrir: arg('launch'), pasta: arg('folder'), pid: arg('pid') ? +arg('pid') : null, titulo: arg('title'), roteiro, saida: arg('out'), largura: arg('width') ? +arg('width') : null })
    .then((r) => { console.log(`✓ ${r.quadros} frames of the window "${r.janela.titulo || r.janela.dono}" (${r.janela.w}×${r.janela.h} pt) in ${r.saida}`) })
    .catch((e) => { console.error(e.codigo ? e.message : '✗ ' + e.message); process.exit(e.codigo ? 3 : 1) })
}
if (process.argv[1] && fs.realpathSync(process.argv[1]) === fs.realpathSync(fileURLToPath(import.meta.url))) principal()
