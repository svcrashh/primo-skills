// Onde a legenda fica: a faixa mais quieta do quadro dentro da zona permitida do formato.
// "Quieta" = pouco detalhe (gradiente) nos quadros do próprio vídeo, no tempo em que a linha está na tela. Texto de interface,
// cartão e o realce têm muito detalhe; fundo desfocado e o vazio do aparelho, pouco.
import { spawnSync } from 'node:child_process'

/** Zonas por formato, em fração da altura. 9:16: acima do terço de baixo (a rede cobre) e abaixo do topo; 16:9: embaixo. */
export const ZONAS = {
  '9x16': { topo: 0.1, base: 2 / 3 },
  '16x9': { topo: 0.6, base: 0.95 },
  '1x1': { topo: 0.1, base: 0.8 },
  '4x5': { topo: 0.1, base: 0.74 },
}

/** Onde na largura a legenda pode ficar. Nos formatos largos, as colunas das laterais também contam (o aparelho costuma deixar uma livre). */
export const COLUNAS = {
  centro: { x0: 0.05, x1: 0.95 },
  // 9:16: o retângulo seguro do Reels/TikTok/Shorts (x 70–940 em 1080). À direita ficam os botões da rede: uma linha de
  // três palavras ("Teste a demonstração…") chegava a x 1008, debaixo deles. Mais larga que a coluna, a linha quebra.
  seguro: { x0: 70 / 1080, x1: 940 / 1080 },
  esquerda: { x0: 0.03, x1: 0.3 },
  direita: { x0: 0.7, x1: 0.97 },
}
export const COLUNAS_DO_FORMATO = { '9x16': ['seguro'], '16x9': ['centro', 'esquerda', 'direita'], '1x1': ['centro'], '4x5': ['centro'] }

export function formatoDe(w, h) {
  const r = w / h
  if (Math.abs(r - 9 / 16) < 0.02) return '9x16'
  if (Math.abs(r - 16 / 9) < 0.02) return '16x9'
  if (Math.abs(r - 1) < 0.02) return '1x1'
  if (Math.abs(r - 4 / 5) < 0.02) return '4x5'
  throw new Error(`format ${w}×${h} has no caption zone (use 9:16, 16:9, 1:1 or 4:5)`)
}

/** Quadros em cinza, pequenos (lado maior 320), a `fps` por segundo, de [de, ate] do vídeo. Devolve { w, h, quadros: [Uint8Array] }. */
export function lerQuadros(video, W, H, { de, ate, fps = 4, cor = false }) {
  const k = 320 / Math.max(W, H)
  const w = Math.round(W * k), h = Math.round(H * k)
  const r = spawnSync('ffmpeg', ['-v', 'error', '-ss', String(de), '-t', String(Math.max(0.05, ate - de)), '-i', video, '-vf', `fps=${fps},scale=${w}:${h},format=${cor ? 'rgb24' : 'gray'}`, '-f', 'rawvideo', '-'], { maxBuffer: 1 << 28 })
  if (r.status !== 0) throw new Error(`ffmpeg could not read the frames: ${(r.stderr || '').toString().slice(-300)}`)
  const c = cor ? 3 : 1
  const n = Math.floor(r.stdout.length / (w * h * c))
  return { w, h, quadros: Array.from({ length: n }, (_, i) => r.stdout.subarray(i * w * h * c, (i + 1) * w * h * c)) }
}

/** Detalhe por linha de pixels (média sobre as colunas 8%–92% e sobre os quadros): gradiente horizontal + vertical. */
export function detalhePorLinha({ w, h, quadros }, { x0: cx0 = 0.08, x1: cx1 = 0.92 } = {}) {
  const d = new Float64Array(h)
  const x0 = Math.floor(w * cx0), x1 = Math.ceil(w * cx1)
  for (const q of quadros) {
    for (let y = 0; y < h - 1; y++) {
      let s = 0
      for (let x = x0; x < x1 - 1; x++) s += Math.abs(q[y * w + x + 1] - q[y * w + x]) + Math.abs(q[(y + 1) * w + x] - q[y * w + x])
      d[y] += s / (x1 - x0)
    }
  }
  return d.map((v) => v / Math.max(1, quadros.length))
}

/**
 * O topo (em fração da altura) da faixa de altura `alturaFrac` com menos detalhe dentro da zona. `anterior` dá histerese:
 * a legenda só sai do lugar se o novo custar menos de 55% do atual (ganho de quase 2×), para não pular entre linhas.
 */
export function escolherTopo(detalhe, alturaFrac, zona, anterior = null) {
  const h = detalhe.length
  const a = Math.round(alturaFrac * h), lo = Math.round(zona.topo * h), hi = Math.floor(zona.base * h) - a
  if (hi < lo) throw new Error(`the caption (${(alturaFrac * 100).toFixed(1)}% of the height) does not fit the zone ${zona.topo.toFixed(2)}–${zona.base.toFixed(2)}`)
  const soma = new Float64Array(h + 1)
  for (let y = 0; y < h; y++) soma[y + 1] = soma[y] + detalhe[y]
  const custo = (y) => soma[y + a] - soma[y]
  let melhor = lo
  for (let y = lo; y <= hi; y++) if (custo(y) < custo(melhor)) melhor = y
  if (anterior != null) {
    const y = Math.min(hi, Math.max(lo, Math.round(anterior * h)))
    if (custo(y) <= custo(melhor) * 1.8 + 1e-6) melhor = y
  }
  return { topo: melhor / h, custo: custo(melhor) / a, custoMedioDoQuadro: soma[h] / h }
}

/**
 * Fração de pixels da cor de acento por linha (o maior valor entre os quadros): o realce e o dedo do app são dessa cor, e é isso que
 * a legenda não pode tapar. `q` vem de lerQuadros com cor: true.
 */
export function acentoPorLinha({ w, h, quadros }, acento, { x0: cx0 = 0.08, x1: cx1 = 0.92 } = {}) {
  const [r0, g0, b0] = [1, 3, 5].map((i) => parseInt(acento.slice(i, i + 2), 16))
  const d = new Float64Array(h)
  const x0 = Math.floor(w * cx0), x1 = Math.ceil(w * cx1)
  for (const q of quadros) {
    for (let y = 0; y < h; y++) {
      let n = 0
      for (let x = x0; x < x1; x++) {
        const i = (y * w + x) * 3
        if (Math.abs(q[i] - r0) + Math.abs(q[i + 1] - g0) + Math.abs(q[i + 2] - b0) < 90) n++
      }
      d[y] = Math.max(d[y], n / (x1 - x0))   // o pico, não a média: um quadro com o realce embaixo da legenda já é tapar
    }
  }
  return d
}

export const PESO_ACENTO = 400   // uma linha inteira de acento custa tanto quanto 400 de detalhe: a legenda desvia do realce
