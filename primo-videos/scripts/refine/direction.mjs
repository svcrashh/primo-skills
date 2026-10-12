// Crítica de direção: olha o MP4 pronto e diz, com números, se ele está sem graça. O refino técnico pega defeito; esta
// pega o vídeo sem defeito que ninguém quer ver até o fim (o tutorial que passa no refino e não usa 3D, motion nem
// transição). Nunca reprova: devolve uma nota e avisos que dizem o que usar.
//   gancho     quanto o quadro muda nos 2 primeiros segundos
//   monotonia  o trecho mais longo com a mesma composição (mexe um pouco, mas é sempre o mesmo quadro)
//   momentos   o maior intervalo sem um momento forte (corte, transição, zoom, entrada grande)
//   fecho      o cartão final: entra num corte seco e fica parado, ou se monta com movimento
// Nota: 0 sinais = forte, 1 = ok, 2 ou mais = fraco. Limiares e calibração: references/refine.md, "Direção".
//   import { criticarDirecao } from './refine/direction.mjs'
//   const { nota, medidas, achados } = await criticarDirecao('out/final-9x16.mp4')
//   node scripts/refine/direction.mjs <video.mp4> [--json]
import fs from 'node:fs'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

// ── limiares (calibrados em 28 tutoriais recusados contra 8 vídeos aprovados; tabela em references/refine.md)
export const QPS = 10            // miniaturas por segundo
export const CURTO = 64          // lado curto da miniatura cinza
export const BLOCO = 16          // a composição é a média de blocos de 16 px da miniatura (4 × 7 no 9:16)
export const LIMIARES = {
  parado: 0.2,                   // diferença média (0–255) abaixo disto entre miniaturas = nada se mexe; o grão não passa disto
  janelaGancho: 2,               // s
  ganchoMin: 18,                 // soma da mudança da composição nos 2 s: recusados ≤ 14,0; aprovados ≥ 22,1 (fora o que abre com rosto falando)
  mesmaComposicao: 10,           // distância média dos blocos até o 1º quadro do trecho; acima disto a composição mudou
  monotoniaMax: 12,              // s: aprovados ≤ 10,1; 22 de 28 recusados acima
  janelaForte: 0.5,              // s: o momento forte compara o quadro com o de meio segundo antes
  forte: 16,                     // distância da composição em 0,5 s que conta como momento forte
  intervaloMax: 15,              // s sem momento forte: aprovados ≤ 12,6; 25 de 28 recusados acima
  corte: 30,                     // mudança de um quadro para o outro que é corte seco: o cartão dos recusados entra com 88–116, o dos aprovados com ≤ 16
  janelaCorte: 2,                // s antes do fim parado em que se procura o corte de entrada do cartão
  fechoParadoMax: 2.5,           // s de cartão final parado: recusados 2,8–4,6; aprovados ≤ 2,0
  cartaoMin: 1,                  // s parados no fim para contar como cartão
}

const r1 = (v) => Math.round(v * 10) / 10
const r2 = (v) => Math.round(v * 100) / 100
const fmt = (v, c = 1) => (Math.round(v * 10 ** c) / 10 ** c).toFixed(c)
const relogio = (t) => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`

// ── miniaturas ─────────────────────────────────────────────────────────────────────────────────────
export function distancia(a, b) {
  let s = 0
  for (let i = 0; i < a.length; i++) s += Math.abs(a[i] - b[i])
  return s / a.length
}

export function blocos(q, w, h, b = BLOCO) {
  const gw = Math.max(1, Math.floor(w / b)), gh = Math.max(1, Math.floor(h / b)), bw = Math.min(b, w), bh = Math.min(b, h)
  const g = new Float32Array(gw * gh)
  for (let y = 0; y < gh * bh; y++) for (let x = 0; x < gw * bw; x++) g[Math.floor(y / bh) * gw + Math.floor(x / bw)] += q[y * w + x] / (bw * bh)
  return g
}

export function lerMiniaturas(mp4, { qps = QPS, curto = CURTO } = {}) {
  const p = spawnSync('ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height', '-of', 'json', mp4], { encoding: 'utf8' })
  if (p.error) throw new Error('ffprobe not found: install ffmpeg.')
  if (p.status !== 0) throw new Error(`ffprobe could not read ${mp4}: ${p.stderr.trim()}`)
  const s = (JSON.parse(p.stdout).streams || [])[0]
  if (!s) throw new Error(`${mp4} has no video stream.`)
  const par = (v) => Math.max(2, Math.round(v / 2) * 2)
  const [w, h] = s.width <= s.height ? [curto, par((curto * s.height) / s.width)] : [par((curto * s.width) / s.height), curto]
  const r = spawnSync('ffmpeg', ['-v', 'error', '-i', mp4, '-an', '-sn', '-vf', `fps=${qps},scale=${w}:${h}:flags=area,format=gray`, '-f', 'rawvideo', '-pix_fmt', 'gray', '-'], { maxBuffer: 1 << 30 })
  if (r.error) throw new Error('ffmpeg did not run: ' + r.error.message)
  if (r.status !== 0) throw new Error('ffmpeg could not read the thumbnails: ' + String(r.stderr).slice(-400))
  const N = w * h, quadros = []
  for (let o = 0; o + N <= r.stdout.length; o += N) quadros.push(r.stdout.subarray(o, o + N))
  if (!quadros.length) throw new Error(`${mp4} has no frames.`)
  return { w, h, qps, quadros }
}

/** As séries que a direção mede: `fino` (mudança da miniatura inteira de um quadro para o outro) e `grosso` (a composição em blocos). */
export function seriesDe({ w, h, qps, quadros }) {
  return {
    qps,
    fino: quadros.map((q, i) => (i ? distancia(q, quadros[i - 1]) : 0)),
    grosso: quadros.map((q) => blocos(q, w, h)),
  }
}

// ── medidas (puras) ────────────────────────────────────────────────────────────────────────────────
/**
 * series: { qps, grosso: [Float32Array] (a composição de cada quadro), fino?: [número] (mudança quadro a quadro; sem
 * ele, a do grosso) }. Devolve as medidas, com os instantes em segundos.
 */
export function medirDirecao({ qps = QPS, grosso, fino }, limiares = {}) {
  const L = { ...LIMIARES, ...limiares }
  const n = grosso.length
  if (!n) throw new Error('no frames to measure')
  const passo = grosso.map((g, i) => (i ? distancia(g, grosso[i - 1]) : 0))
  const mov = fino || passo

  // o cartão final parado sai do corpo: monotonia e momentos fortes medem o que vem antes dele
  let k = n - 1
  while (k > 0 && mov[k] < L.parado) k--
  const fimCorpo = k + 1
  const parado = (n - fimCorpo) / qps

  // gancho: a mudança somada nos primeiros segundos
  const jg = Math.min(n - 1, Math.round(L.janelaGancho * qps))
  let energia = 0
  for (let i = 1; i <= jg; i++) energia += passo[i]

  // monotonia: o trecho mais longo em que a composição fica perto do primeiro quadro do trecho
  let maior = { dur: 0, ini: 0, fim: 0 }, a = 0
  for (let i = 1; i <= fimCorpo; i++) {
    if (i < fimCorpo && distancia(grosso[i], grosso[a]) <= L.mesmaComposicao) continue
    if ((i - a) / qps > maior.dur) maior = { dur: (i - a) / qps, ini: a / qps, fim: i / qps }
    a = i
  }

  // momentos fortes: a composição muda muito em meio segundo; um momento a cada segundo, no máximo
  const lag = Math.max(1, Math.round(L.janelaForte * qps))
  const picos = []
  for (let i = 1; i < fimCorpo; i++) {
    if (distancia(grosso[i], grosso[Math.max(0, i - lag)]) >= L.forte && (!picos.length || i - picos[picos.length - 1] > qps)) picos.push(i)
  }
  const marcos = [0, ...picos, fimCorpo]
  let vazio = { dur: 0, ini: 0, fim: 0 }
  for (let i = 1; i < marcos.length; i++) {
    const d = (marcos[i] - marcos[i - 1]) / qps
    if (d > vazio.dur) vazio = { dur: d, ini: marcos[i - 1] / qps, fim: marcos[i] / qps }
  }

  // fecho: como o quadro que fica parado no fim chegou lá (o cartão dos recusados entra num corte, anima 0,9 s e para)
  let salto = 0
  for (let i = Math.max(1, fimCorpo - Math.round(L.janelaCorte * qps)); i < fimCorpo; i++) salto = Math.max(salto, passo[i])
  const cartao = parado >= L.cartaoMin
  const entrada = !cartao ? 'sem cartão parado' : salto >= L.corte ? 'corte' : 'animada'

  return {
    duracao: r2(n / qps), qps,
    gancho: { mudanca: r1(energia), janela: L.janelaGancho, minimo: L.ganchoMin },
    monotonia: { maior: r1(maior.dur), ini: r2(maior.ini), fim: r2(maior.fim), maximo: L.monotoniaMax },
    momentos: { total: picos.length, porDezS: r1((picos.length / Math.max(1, fimCorpo)) * qps * 10), maiorIntervalo: r1(vazio.dur), ini: r2(vazio.ini), fim: r2(vazio.fim), maximo: L.intervaloMax, instantes: picos.map((i) => r2(i / qps)) },
    fecho: { parado: r1(parado), entrada, salto: r1(salto), ini: r2(fimCorpo / qps), maximo: L.fechoParadoMax },
  }
}

// ── nota e avisos ──────────────────────────────────────────────────────────────────────────────────
export const NOTAS = ['forte', 'ok', 'fraco']
// nota, sinal e entrada do fecho são valores lidos por código (refine.json, testes); o que se imprime sai em inglês
export const ROTULO_NOTA = { forte: 'strong', ok: 'ok', fraco: 'weak' }
export const ROTULO_SINAL = { gancho: 'hook', monotonia: 'monotony', momentos: 'moments', fecho: 'closing' }
export const ROTULO_ENTRADA = { corte: 'hard cut', animada: 'animated', 'sem cartão parado': 'no still card' }

export function julgarDirecao(m) {
  const achados = []
  const aviso = (sinal, t, fim, msg, oQueFazer) => achados.push({ checagem: 'direcao', nivel: 'aviso', sinal, t, fim, msg, oQueFazer })

  if (m.gancho.mudanca < m.gancho.minimo) {
    aviso('gancho', 0, Math.min(m.gancho.janela, m.duracao),
      `static opening: in the first ${fmt(m.gancho.janela, 0)} seconds the frame barely changes (change ${fmt(m.gancho.mudanca)}; the minimum is ${fmt(m.gancho.minimo, 0)})`,
      'open with motion that hooks from the first frame: the 3D phone spinning in (tutorial: "cinema": "moldura" in the series), a title born from a motion transition (TR.zoom, TR.mascara) or a big number counting up (conta()); a still title waiting for the voice holds no one')
  }
  if (m.monotonia.maior > m.monotonia.maximo) {
    aviso('monotonia', m.monotonia.ini, m.monotonia.fim,
      `${fmt(m.monotonia.maior)} s with the same composition: it moves a little, but it is always the same frame (maximum ${fmt(m.monotonia.maximo, 0)} s)`,
      'change the composition every 6–8 s: switch the screen with a motion transition (TR.push, TR.whip, TR.morph), move the camera in on the field that matters (camera()) or split the step in two')
  }
  if (m.momentos.maiorIntervalo > m.momentos.maximo) {
    aviso('momentos', m.momentos.ini, m.momentos.fim,
      `${fmt(m.momentos.maiorIntervalo)} s without any strong moment: no transition, zoom or big entrance (maximum ${fmt(m.momentos.maximo, 0)} s; the video has ${fmt(m.momentos.porDezS)} per 10 s)`,
      'put a strong moment every 8–10 s, on the beat of the music: a motion transition between the blocks (TR.whip, TR.zoom), a big number counting up (conta()), a word or a big stamp coming in')
  }
  if (m.fecho.parado > m.fecho.maximo) {
    aviso('fecho', m.fecho.ini, m.duracao,
      m.fecho.entrada === 'corte' ? `flat closing: the end card comes in on a hard cut and stays still for ${fmt(m.fecho.parado)} s (maximum ${fmt(m.fecho.maximo)} s)`
        : `still closing: the end card stays ${fmt(m.fecho.parado)} s with nothing moving (maximum ${fmt(m.fecho.maximo)} s)`,
      'close with the 3D logo assembling piece by piece (tutorial: "cinema": "moldura" in the series; in the other styles, the logo comes in animated) and hold it still for only 1.2–2 s at the end')
  }
  const nota = NOTAS[Math.min(2, achados.length)]
  return { nota, sinais: achados.map((a) => a.sinal), achados }
}

/** opcoes: { qps, limiares: { … } } (os padrões estão em LIMIARES). */
export async function criticarDirecao(mp4, opcoes = {}) {
  if (!fs.existsSync(mp4)) throw new Error(`Video not found: ${mp4}`)
  const t0 = Date.now()
  const series = seriesDe(lerMiniaturas(mp4, { qps: opcoes.qps ?? QPS }))
  const medidas = medirDirecao(series, opcoes.limiares)
  const { nota, sinais, achados } = julgarDirecao(medidas)
  medidas.sinais = sinais
  medidas.tempo_s = r2((Date.now() - t0) / 1000)
  return { nota, medidas, achados }
}

/** As linhas curtas que o relatório e a CLI mostram. */
export function resumoDirecao(m) {
  return [
    `hook: change ${fmt(m.gancho.mudanca)} in the first ${fmt(m.gancho.janela, 0)} s (minimum ${fmt(m.gancho.minimo, 0)})`,
    `monotony: ${fmt(m.monotonia.maior)} s with the same composition (maximum ${fmt(m.monotonia.maximo, 0)})`,
    `strong moments: ${fmt(m.momentos.porDezS)} per 10 s, longest gap ${fmt(m.momentos.maiorIntervalo)} s (maximum ${fmt(m.momentos.maximo, 0)})`,
    `closing: ${ROTULO_ENTRADA[m.fecho.entrada] ?? m.fecho.entrada}, ${fmt(m.fecho.parado)} s still (maximum ${fmt(m.fecho.maximo)})`,
  ]
}

if (process.argv[1] && fs.realpathSync(process.argv[1]) === fs.realpathSync(fileURLToPath(import.meta.url))) {
  const argv = process.argv.slice(2)
  const mp4 = argv.find((a) => !a.startsWith('--'))
  if (!mp4) { console.error('usage: node scripts/refine/direction.mjs <video.mp4> [--json]'); process.exit(2) }
  criticarDirecao(mp4).then(({ nota, medidas, achados }) => {
    if (argv.includes('--json')) return console.log(JSON.stringify({ nota, medidas, achados }, null, 1))
    console.log(`DIRECTION: ${ROTULO_NOTA[nota]}${achados.length ? ` (${achados.length} of 4 signals: ${medidas.sinais.map((x) => ROTULO_SINAL[x]).join(', ')})` : ''} · ${path.basename(mp4)}`)
    for (const l of resumoDirecao(medidas)) console.log(`  ${l}`)
    for (const a of achados) console.log(`  ! ${relogio(a.t)}–${relogio(a.fim)}  ${a.msg}\n    → ${a.oQueFazer}`)
  }).catch((e) => { console.error(e.message); process.exit(2) })
}
