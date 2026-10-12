#!/usr/bin/env node
// Folha de quadros: um quadro por instante, lado a lado. node sheet.mjs <video> <output.png> <t1,t2,…> [colunas] [largura-do-quadro]
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const [video, saida, lista, cols = '8', larg = '270'] = process.argv.slice(2)
if (!video || !saida || !lista) { console.error('usage: node sheet.mjs <video> <output.png> <t1,t2,…> [columns] [frame-width]'); process.exit(1) }
const ts = lista.split(',').map(Number)
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'sheet-'))
const ar = ts.map((t, i) => {
  const f = path.join(tmp, `${i}.png`)
  const r = spawnSync('ffmpeg', ['-v', 'error', '-y', '-ss', String(t), '-i', video, '-frames:v', '1', '-vf', `scale=${larg}:-1`, f])
  if (r.status !== 0) throw new Error(`no frame at ${t} s`)
  return f
})
const r = spawnSync('ffmpeg', ['-v', 'error', '-y', ...ar.flatMap((f) => ['-i', f]), '-filter_complex', `${ar.map((_, i) => `[${i}:v]`).join('')}xstack=inputs=${ar.length}:layout=${ar.map((_, i) => `${(i % +cols)}*w0_${Math.floor(i / +cols)}*h0`.replace(/\*w0/, '*w0').replace(/\*h0/, '*h0')).join('|').replace(/(\d+)\*w0/g, (_, n) => (+n ? Array(+n).fill('w0').join('+') : '0')).replace(/(\d+)\*h0/g, (_, n) => (+n ? Array(+n).fill('h0').join('+') : '0'))}`, saida])
if (r.status !== 0) throw new Error((r.stderr || '').toString().slice(-400))
fs.rmSync(tmp, { recursive: true, force: true })
console.log(`sheet: ${saida}`)
