#!/usr/bin/env node
// Renderiza um capítulo (ou todos) nos formatos do vídeo e tira a folha de quadros de cada um.
//   node render.mjs <project> <scene|all> [--mode final|draft] [--formats 16x9,19x9,21x9,9x16] [-- <opções do render.cjs>]
// Sai em scenes/<scene>/out/<format>.mp4 e out/sheet-<format>.png. Código ≠ 0 = erro no console da página
// (título largo demais, capítulo fora do índice, imagem que falta…) ou no render: corrija antes de entregar.
import fs from 'node:fs'
import path from 'node:path'
import { spawnSync, execFileSync } from 'node:child_process'

const argv = process.argv.slice(2)
const corte = argv.indexOf('--')
const extra = corte >= 0 ? argv.slice(corte + 1) : []
const args = corte >= 0 ? argv.slice(0, corte) : argv
const opt = (k, d) => { const i = args.indexOf('--' + k); return i >= 0 ? args[i + 1] : d }
const [proj, alvo] = args.filter((a, i) => !a.startsWith('--') && !(i > 0 && args[i - 1].startsWith('--')))
if (!proj || !alvo) { console.error('usage: node render.mjs <project> <scene|all> [--mode final|draft] [--formats 16x9,9x16]'); process.exit(1) }
const projeto = path.resolve(proj), modo = opt('mode', 'final')
// Ponto de extensão opcional: sem scripts/app/canal.mjs no pacote, nada é avisado para fora.
const CANAL = new URL('../app/canal.mjs', import.meta.url)
const vb = fs.existsSync(CANAL) ? await import(CANAL.href) : null
await vb?.checarDono({ onde: `render ${alvo}` })
// Sem --formats: os que o video.js da cena declara (VIDEO.formatos). Um Reels com formatos: ['9x16'] não renderiza 16:9.
const formatosDe = (dir) => {
  if (opt('formats')) return opt('formats').split(',')
  const m = fs.existsSync(path.join(dir, 'video.js')) && fs.readFileSync(path.join(dir, 'video.js'), 'utf8').match(/formatos\s*:\s*\[([^\]]*)\]/)
  const d = m ? [...m[1].matchAll(/['"](\w+)['"]/g)].map((x) => x[1]) : []
  return d.length ? d : ['16x9', '9x16']
}
const cenas = alvo === 'all' ? fs.readdirSync(path.join(projeto, 'scenes')).filter((c) => /^\d/.test(c) && fs.existsSync(path.join(projeto, 'scenes', c, 'scene.js'))).sort() : [alvo]
let falhou = 0
for (const [i, c] of cenas.entries()) {
  const dir = path.join(projeto, 'scenes', c)
  if (!fs.existsSync(path.join(dir, 'scene.js'))) { console.error(`did not find ${dir}/scene.js`); falhou++; continue }
  await vb?.avisar('cenas', `rendering ${c}${cenas.length > 1 ? ` (${i + 1} of ${cenas.length})` : ''}, ${modo}`, { progresso: Math.round((i / cenas.length) * 100) })
  for (const f of formatosDe(dir)) {
    const r = spawnSync(process.execPath, [path.join(projeto, 'tools', 'render.cjs'), '--project', dir, '--mode', modo, '--format', f, '--out', `out/${f}.mp4`, '--no-sheet', ...extra], { stdio: 'inherit' })
    if (r.status === 2) process.exit(2)   // sem Playwright ou Chromium: a mensagem acima diz o que instalar
    if (r.status !== 0) { console.error(`✗ ${c} ${f}: the render exited with code ${r.status}`); falhou++; continue }
    const mp4 = path.join(dir, 'out', `${f}.mp4`)
    const dur = +execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', mp4]).toString().trim()
    // 9:16 em 8×3; horizontal (16:9, 19:9, 21:9) em 6×4 com 270 px de altura (mais largo quanto mais largo o formato)
    const [fw, fh] = f.split('x').map(Number)
    const [escala, grade] = f === '9x16' ? ['270:-1', '8x3'] : fw > fh ? ['-2:270', '6x4'] : ['480:-1', '6x4']
    const folha = path.join(dir, 'out', `sheet-${f}.png`)
    execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', mp4, '-vf', `fps=24/${dur},scale=${escala},tile=${grade}`, '-frames:v', '1', folha])
    console.log(`✓ ${c} ${f} · ${dur.toFixed(2)} s · LOOK at the sheet: ${folha}`)
    await vb?.mostrar(folha, `Sheet: ${c} ${f} (${modo})`, 'folha')
  }
}
process.exitCode = falhou ? 1 : 0
