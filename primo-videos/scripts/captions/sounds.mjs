// Camada de sons de interface sobre uma mix já pronta: sintetiza (ui_sounds.py), soma, e devolve o volume no lugar.
import fs from 'node:fs'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { acharPython as acharPythonDaSkill } from '../where.cjs'

const aqui = path.dirname(fileURLToPath(import.meta.url))
const r3 = (x) => Math.round(x * 1000) / 1000
// os efeitos que valem como "toque", "troca de tela" e "entrada do logo"; o resto da folha (riser, sucesso…) fica de fora
const DA_FOLHA = new Set(['toque', 'clique', 'digitacao', 'virada', 'whoosh', 'impacto'])

/** Os sons da folha de sincronia viram cues: o mesmo instante, o mesmo efeito (o nível é o da camada, não o do motor). */
export function cuesDaFolha(folha) {
  return (folha.marcos || []).filter((m) => DA_FOLHA.has(m.efeito)).map((m) => {
    const c = { t: m.t, efeito: m.efeito }
    for (const k of ['dur', 'variante', 'direcao', 'teclas']) if (m[k] != null) c[k] = m[k]
    if (m.efeito === 'whoosh' && c.dur == null && c.variante == null) c.variante = 'curto'
    return c
  })
}

/** O --python, se ele importa numpy e scipy; senão, o da skill (scripts/where.cjs). */
export function acharPython(extra) {
  if (extra && spawnSync(extra, ['-c', 'import numpy, scipy'], { encoding: 'utf8' }).status === 0) return extra
  const py = acharPythonDaSkill()
  if (py) return py
  throw new Error(`Python with numpy and scipy not found. Run once: node ${path.join(aqui, '..', 'environment.mjs')} --fix (or pass --python <a python with both>)`)
}

/** Loudness integrada e true peak (ebur128) de um arquivo. */
export function medir(arquivo) {
  const r = spawnSync('ffmpeg', ['-hide_banner', '-nostats', '-i', arquivo, '-vn', '-af', 'ebur128=peak=true', '-f', 'null', '-'], { encoding: 'utf8' })
  const t = (r.stderr || '') + (r.stdout || '')
  const ultimo = (re) => (t.match(re) || []).pop()?.match(/-?[\d.]+/)?.[0]
  return { I: +ultimo(/I:\s+(-?[\d.]+) LUFS/g), TP: +ultimo(/Peak:\s+(-?[\d.]+) dBFS/g) }
}

/**
 * base.wav + efeitos → mix.wav. Os efeitos são nivelados sobre a loudness da base; depois a soma volta à loudness da
 * base (no máximo 0,3 LU de correção) e o pico verdadeiro fica no teto da folha.
 */
export function somarSons({ base, cues, duracao, trechos = [], teto = -1.0, trabalho, semente = 7, python }) {
  const antes = medir(base)
  const cuesJson = path.join(trabalho, 'cues.json'), sfx = path.join(trabalho, 'sfx.wav'), mix = path.join(trabalho, 'mix.wav')
  fs.writeFileSync(cuesJson, JSON.stringify(cues))
  const py = acharPython(python)
  const s = spawnSync(py, [path.join(aqui, '..', '..', 'assets', 'audio', 'ui_sounds.py'), '--cues', cuesJson, '--duration', String(duracao), '--ref-lufs', String(antes.I), '--out', sfx, '--seed', String(semente), '--segments', JSON.stringify(trechos)], { encoding: 'utf8' })
  if (s.status !== 0) throw new Error('ui_sounds.py failed: ' + (s.stderr || s.stdout).slice(-600))
  const soma = path.join(trabalho, 'soma.wav')
  const f = (a) => { const r = spawnSync('ffmpeg', ['-hide_banner', '-nostats', '-v', 'error', '-y', ...a], { encoding: 'utf8' }); if (r.status !== 0) throw new Error('ffmpeg: ' + r.stderr.slice(-400)) }
  f(['-i', base, '-i', sfx, '-filter_complex', '[0:a][1:a]amix=inputs=2:normalize=0:duration=first[a]', '-map', '[a]', '-c:a', 'pcm_f32le', soma])
  const m = medir(soma)
  let ganho = antes.I - m.I                    // volta ao volume da base
  if (Math.abs(ganho) > 0.3) ganho = Math.sign(ganho) * 0.3
  const lim = `alimiter=limit=${(10 ** ((teto - 0.3) / 20)).toFixed(4)}:level=disabled:asc=0`
  f(['-i', soma, '-af', `volume=${ganho.toFixed(3)}dB,${lim}`, '-ar', '48000', '-c:a', 'pcm_f32le', mix])
  const depois = medir(mix)
  return { cues: cues.length, antes, soma: m, ganho_db: r3(ganho), depois, teto, mix, sfx }
}
