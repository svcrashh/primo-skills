// Fala sintética para os testes de voz, sem gravação de ninguém no repositório: cada palavra é uma rajada de tom no
// tempo dela (o gabarito do teste é exato), com silêncio entre as palavras. `viva` dá o tom e o volume variando de uma
// palavra para outra, como uma leitura animada; sem ela, o tom e o volume ficam iguais, como uma leitura apagada.
// E, no Mac, fala de verdade gerada na hora pelo `say`, sem rede.
import fs from 'node:fs'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { lerWav, inicioVoz } from '../scripts/voice.mjs'

export const TAXA = 48000
const F0S = [150, 290, 185, 330, 165, 250, 140, 310, 210, 270]
const GANHOS = [0.6, 0.08, 0.35, 0.05, 0.5, 0.12, 0.25, 0.04, 0.45, 0.18]

/** WAV mono 16 bits com uma rajada por [ini, fim] (s); `total` estica o fim com silêncio. → a duração. */
export function falaSintetica(arq, trechos, { total = null, viva = true } = {}) {
  const fim = total ?? trechos.at(-1)[1] + 0.25
  const n = Math.round(fim * TAXA), x = new Int16Array(n)
  trechos.forEach(([a, b], k) => {
    const f0 = viva ? F0S[k % F0S.length] : 200, g = viva ? GANHOS[k % GANHOS.length] : 0.3
    const i0 = Math.round(a * TAXA), i1 = Math.min(n, Math.round(b * TAXA)), rampa = Math.round(0.005 * TAXA)
    for (let i = i0; i < i1; i++) {
      const env = Math.min(1, (i - i0) / rampa, (i1 - i) / rampa)
      // dentro da palavra o tom sobe um pouco, como numa sílaba de verdade
      const t = (i - i0) / TAXA, f = f0 * (1 + (viva ? 0.15 : 0) * (t / Math.max(0.05, b - a)))
      x[i] = Math.round(32767 * g * env * Math.sin(2 * Math.PI * f * t))
    }
  })
  const h = Buffer.alloc(44)
  h.write('RIFF', 0); h.writeUInt32LE(36 + n * 2, 4); h.write('WAVE', 8); h.write('fmt ', 12)
  h.writeUInt32LE(16, 16); h.writeUInt16LE(1, 20); h.writeUInt16LE(1, 22); h.writeUInt32LE(TAXA, 24)
  h.writeUInt32LE(TAXA * 2, 28); h.writeUInt16LE(2, 32); h.writeUInt16LE(16, 34); h.write('data', 36); h.writeUInt32LE(n * 2, 40)
  fs.mkdirSync(path.dirname(arq), { recursive: true })
  fs.writeFileSync(arq, Buffer.concat([h, Buffer.from(x.buffer)]))
  return n / TAXA
}

/** Uma fala do Contrato L para um WAV: inicio_voz e duração medidos, as palavras como vieram (a 1ª nunca antes do som). */
export function falaDoWav(dir, arquivo, { id, onde, palavras }) {
  const w = lerWav(path.join(dir, arquivo))
  const r3 = (v) => Math.round(v * 1000) / 1000
  const iv = r3(inicioVoz(w.amostras, w.taxa))
  const ps = palavras.map(([texto, ini, fim]) => ({ texto, ini, fim }))
  ps[0].ini = r3(Math.max(ps[0].ini, iv))
  return { id, onde, texto: ps.map((p) => p.texto).join(' '), arquivo, duracao: r3(w.n / w.taxa), inicio_voz: iv, palavras: ps }
}

/** Fala de verdade pelo `say` do macOS, convertida para 48 kHz mono 16 bits. null fora do Mac (o teste pula). */
export function falaDoSay(arq, texto) {
  const aiff = arq.replace(/\.wav$/, '.aiff')
  const r = spawnSync('say', ['-o', aiff, texto])
  if (r.error || r.status !== 0) return null
  fs.mkdirSync(path.dirname(arq), { recursive: true })
  const c = spawnSync('ffmpeg', ['-v', 'error', '-y', '-i', aiff, '-ar', String(TAXA), '-ac', '1', '-c:a', 'pcm_s16le', arq])
  fs.rmSync(aiff, { force: true })
  return c.status === 0 ? arq : null
}
export const temSay = () => !spawnSync('say', ['-v', '?']).error
