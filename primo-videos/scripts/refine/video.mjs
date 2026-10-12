// Refino do vídeo pronto: olha o MP4 como quem assiste no celular e acusa o que o motor não vê.
//   legibilidade  OCR do sistema (o Vision no macOS, o Windows.Media.Ocr no Windows) nos quadros amostrados: letra
//                 pequena demais, tela encolhida
//   player        o mesmo OCR, com a letra no tamanho em que fica depois de o player encolher o vídeo (opcoes.player)
//   parado       freezedetect do ffmpeg: nada se mexe por mais de 0,6 s (o cartão final é a exceção)
//   vazio         quadro sem objeto, ou metade da área segura vazia enquanto a voz fala
//   area-segura   texto fora do retângulo seguro e conteúdo sob a interface da rede (tudo o que aparece)
// Só Node e ffmpeg; o OCR é um Swift pequeno compilado uma vez num cache (Mac) ou um script do PowerShell (Windows).
//   import { checarVideo } from './refine/video.mjs'
//   const { achados, medidas } = await checarVideo('out/final-9x16.mp4', { plataforma: 'tiktok', saidaQuadros: 'out/refine' })
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import crypto from 'node:crypto'
import { spawn, spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const AQUI = path.dirname(fileURLToPath(import.meta.url))
const FONTE_OCR = path.join(AQUI, 'ocr.swift')
const FONTE_OCR_WIN = path.join(AQUI, 'ocr.ps1')
// o Windows PowerShell 5.1, que vem em todo Windows (o pwsh 7 não carrega os tipos do WinRT que o OCR usa)
const POWERSHELL = ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File']

export const FORMATOS = { '16x9': [1920, 1080], '19x9': [2280, 1080], '21x9': [2520, 1080], '9x16': [1080, 1920], '1x1': [1080, 1080], '4x5': [1080, 1350] }
export const CHECAGENS = ['legibilidade', 'player', 'parado', 'vazio', 'area-segura']
export const PADRAO = { paradoMax: 0.6, finalParadoMin: 1.2, qps: 2, legibilidade: { minimoPx: 28, ilegivelPx: 16, excecoes: [] } }

// ── limiares (calibrados em 3 MP4 de Reels aprovados; ver o fim do arquivo) ─────────────────────────
const FREEZE_LARG = 270       // o freezedetect roda numa cópia de 270 px: o grão animado some na média
const FREEZE_RUIDO = 0.001    // n do freezedetect; 0,002 já chama de parado o @seunome trocando de fonte
const DIF_EMENDA = 0.2        // diferença média (0–255, cópia de 360) de um quadro para o outro: cartão parado ≤ 0,03, grão e brilho ≤ 0,13; o @seunome trocando de fonte ≥ 0,29
const CURTO = 360             // lado curto da cópia cinza usada para área vazia e manchas
const CEL = 12                // célula de 12 px da cópia (≈ 36 px reais)
const BORDA = 8               // |dx|+|dy| que conta como borda: grade, brilho e grão do fundo ficam ≤ 3
const CEL_CHEIA = 5           // pixels de borda para a célula ter conteúdo
const VAZIO_QPS = 10          // a área vazia é medida 10 vezes por segundo (o limite de 0,3 s pede isso)
const VAZIO_QUADRO = 0.015    // ocupação abaixo disto = quadro sem objeto (a bola de papel voando sozinha ocupa ~4%)
const VAZIO_QUADRO_S = 0.3
const VAZIO_METADE = 0.02     // metade da área segura com menos de 2% de células com conteúdo
const VAZIO_METADE_S = 1
const MANCHA_MIN = 40         // mancha menor que 40×40 px reais (os cantinhos decorativos) não conta
const FOLGA_AREA = 4          // px de folga da caixa do OCR contra o limite da área segura
const CONTRASTE_APAGADO = 80  // p95−p5 da luminância na caixa (o ocr.swift mede): esmaecido ≤ 65, opaco ≥ 110
const CAIXA_ALTA = 1.2        // o Vision mede a altura da maiúscula: etiqueta de 30 px em caixa alta sai com h≈25
const MAX_QUADROS = 12        // PNG marcados por checagem
const MAX_CONFERIR = 8        // amostras com texto fora da área que ganham quadros de conferência

const fmt = (v, c = 1) => (Math.round(v * 10 ** c) / 10 ** c).toFixed(c)
const r2 = (v) => Math.round(v * 100) / 100
const curto = (s, n = 40) => (s.length > n ? s.slice(0, n - 1) + '…' : s)
const alfanum = (s) => (String(s).match(/[\p{L}\p{N}]/gu) || []).length
const normal = (s) => String(s).toLowerCase().normalize('NFD').replace(/[^\p{L}\p{N}]/gu, '')

// ── formatos, área segura e zonas da interface ───────────────────────────────────────────────────
export function formatoDe(w, h) {
  const r = w / h
  let melhor = '16x9', d = Infinity
  for (const [f, [a, b]] of Object.entries(FORMATOS)) {
    const x = Math.abs(Math.log(r / (a / b)))
    if (x < d) { d = x; melhor = f }
  }
  return melhor
}

const tamanho = (formato, W, H) => (W && H ? [W, H] : FORMATOS[formato] || FORMATOS['16x9'])
const REDES = ['reels', 'tiktok', 'shorts']

/** O retângulo seguro para texto, igual ao `areaSegura()` do motor (assets/template/engine.js), em px do vídeo. */
export function areaSeguraDe(formato, plataforma = null, W, H) {
  ;[W, H] = tamanho(formato, W, H)
  const kx = W / 1080, ky = H / 1920
  const m = (mx, my, nome) => ({ x0: mx, y0: my, x1: W - mx, y1: H - my, nome })
  const pl = plataforma || null
  if (formato === '9x16' && REDES.includes(pl)) return { x0: 70 * kx, y0: 250 * ky, x1: 940 * kx, y1: 1450 * ky, nome: pl }
  if (formato === '9x16' && pl === 'stories') return { x0: 60 * kx, y0: 250 * ky, x1: 1020 * kx, y1: 1580 * ky, nome: 'stories' }
  if (pl === 'feed') return m(60, 60, 'feed (60 px)')
  if (pl === 'app') return m(60, 60, 'app (60 px)')
  if (pl === 'youtube') return m(W * 0.05, H * 0.05, 'youtube (5%)')
  if (W > H) return m(W * 0.05, H * 0.05, `${formato.replace('x', ':')} (5%)`)
  if (formato === '9x16') return { x0: 70 * kx, y0: 250 * ky, x1: 940 * kx, y1: 1450 * ky, nome: '9:16 (reels/tiktok/shorts)' }
  return m(60, 60, `${formato.replace('x', ':')} (60 px)`)
}

/** Onde a interface da rede cobre o vídeo (px do vídeo). Fora do 9:16 de rede não há zona: só a margem. */
export function zonasDaInterface(formato, plataforma = null, W, H) {
  ;[W, H] = tamanho(formato, W, H)
  if (formato !== '9x16') return []
  const kx = W / 1080, ky = H / 1920
  const pl = plataforma || null
  if (pl === null || REDES.includes(pl)) {
    const rede = pl || 'reels/tiktok/shorts'
    return [
      { nome: 'topo', rotulo: `the top of the ${rede} interface (name, camera)`, x0: 0, y0: 0, x1: W, y1: 220 * ky },
      { nome: 'base', rotulo: `the bottom of the ${rede} interface (caption, music, name)`, x0: 0, y0: 1500 * ky, x1: W, y1: H },
      { nome: 'botoes', rotulo: `the ${rede} button strip (like, comment, share)`, x0: 940 * kx, y0: 900 * ky, x1: W, y1: 1650 * ky },
    ]
  }
  if (pl === 'stories') {
    return [
      { nome: 'topo', rotulo: 'the top of the stories interface (progress bar, name)', x0: 0, y0: 0, x1: W, y1: 250 * ky },
      { nome: 'base', rotulo: 'the bottom of the stories interface (reply)', x0: 0, y0: 1580 * ky, x1: W, y1: H },
    ]
  }
  return []
}

// ── agrupamento no tempo ─────────────────────────────────────────────────────────────────────────
/**
 * Junta itens de amostras consecutivas num grupo só. `itens`: [{i, …}] (i = índice da amostra);
 * `mesma(a, b)` diz se dois itens são a mesma coisa; `folga` = amostras que podem faltar no meio.
 * Devolve [{itens:[…], i0, i1}].
 */
export function agruparNoTempo(itens, mesma = () => true, folga = 1) {
  const grupos = []
  for (const it of [...itens].sort((a, b) => a.i - b.i)) {
    const g = grupos.find((x) => it.i - x.i1 <= folga + 1 && mesma(x.itens[x.itens.length - 1], it))
    if (g) { g.itens.push(it); g.i1 = it.i }
    else grupos.push({ itens: [it], i0: it.i, i1: it.i })
  }
  return grupos
}

const mesmoTexto = (a, b) => {
  const x = normal(a.texto), y = normal(b.texto)
  if (x === y) return true
  const [p, g] = x.length < y.length ? [x, y] : [y, x]
  return p.length >= 4 && g.includes(p)
}

// ── trechos parados ──────────────────────────────────────────────────────────────────────────────
/** Lê o stderr do freezedetect: [{ini, fim}] (fim = null quando o trecho vai até o fim). */
export function lerFreezedetect(texto) {
  const out = []
  for (const l of String(texto).split('\n')) {
    let m = l.match(/freeze_start:\s*([\d.]+)/)
    if (m) { out.push({ ini: +m[1], fim: null }); continue }
    m = l.match(/freeze_end:\s*([\d.]+)/)
    if (m && out.length && out[out.length - 1].fim === null) out[out.length - 1].fim = +m[1]
  }
  return out
}

/**
 * O freezedetect compara com o primeiro quadro do trecho, então o brilho lento do fundo pode partir o cartão final
 * parado em dois pedaços colados. Junta a cadeia de trechos colados que chega ao fim quando, na emenda, nenhum quadro
 * muda de verdade (`difs` < DIF_EMENDA; um corte seco passa muito disso). No meio do vídeo não junta: ali trechos
 * colados são movimento lento (um zoom devagar parte o trecho a cada ~0,17 s), não quadro parado.
 * `difs[n]` = diferença média do quadro n para o anterior; tempos em segundos desde o início da leitura.
 */
export function juntarTrechos(trechos, difs, fps) {
  const out = trechos.map((t) => ({ ...t }))
  while (out.length >= 2) {
    const a = out[out.length - 2], b = out[out.length - 1]
    if (b.fim != null || a.fim == null || b.ini - a.fim > 1.5 / fps) break
    const n = Math.round(a.fim * fps)
    if (Math.max(...[n - 1, n, n + 1].map((j) => difs[j] ?? 0)) >= DIF_EMENDA) break
    a.fim = null
    out.pop()
  }
  return out
}

/**
 * Trechos parados → achados. `trechos` em segundos do vídeo; `fim` é onde a análise acaba; `fimDoVideo` diz
 * se esse fim é o fim do vídeo (só aí o trecho final é o cartão parado de propósito).
 */
export function trechosParados(trechos, { fim, fimDoVideo = true, quadro = 1 / 60, paradoMax = PADRAO.paradoMax, finalParadoMin = PADRAO.finalParadoMin } = {}) {
  const achados = []
  let final = null
  for (const tr of trechos) {
    const f = tr.fim == null ? fim : Math.min(tr.fim, fim)
    const dur = f - tr.ini
    if (fimDoVideo && f >= fim - 2.5 * quadro) { final = { ini: tr.ini, fim: f, dur }; continue }
    if (dur > paradoMax + 1e-6) {
      achados.push({
        checagem: 'parado', nivel: 'erro', t: r2(tr.ini), fim: r2(f),
        msg: `nothing moves for ${fmt(dur, 2)} s (from ${fmt(tr.ini, 2)} to ${fmt(f, 2)} s; the limit is ${fmt(paradoMax, 1)} s)`,
        oque_fazer: 'Add motion to this stretch: the next step comes in earlier, the camera breathes or an element reacts to the line.',
      })
    }
  }
  if (fimDoVideo && (!final || final.dur < finalParadoMin)) {
    const dur = final ? final.dur : 0
    achados.push({
      checagem: 'parado', nivel: 'aviso', t: r2(final ? final.ini : fim), fim: r2(fim),
      msg: final ? `the end card stays still for only ${fmt(dur, 2)} s (the minimum is ${fmt(finalParadoMin, 1)} s)` : 'the video ends in motion: the end card does not stay still',
      oque_fazer: `Hold the end card still for at least ${fmt(finalParadoMin, 1)} s, so there is time to read it.`,
    })
  }
  return { achados, final }
}

// ── legibilidade ─────────────────────────────────────────────────────────────────────────────────
/** Corpo da fonte estimado pela caixa do Vision: com minúscula a caixa vai do ascendente ao descendente (h ≈ corpo);
 *  só com maiúsculas e números ela cobre a altura da maiúscula (h ≈ 0,83 × corpo). */
export const alturaDoCorpo = (l) => (/\p{Ll}/u.test(l.texto) ? l.h : l.h * CAIXA_ALTA)

const exemplos = (textos, n = 3) => {
  const vistos = [...new Map(textos.map((t) => [normal(t), t])).values()]
  return vistos.slice(0, n).map((t) => `"${curto(t, 24)}"`).join(', ') + (vistos.length > n ? '…' : '')
}

// Plano geral: a tela inteira pequena por pouco tempo, antes de a câmera aproximar, é de propósito (a tela inteira
// primeiro, depois o zoom). Tela encolhida por mais tempo que isto continua erro.
export const PLANO_GERAL_MAX = 2.6

/**
 * Classifica as linhas do OCR. `quadros`: [{i, t, linhas:[{texto,conf,x,y,w,h}]}] em px do vídeo; `escala`
 * leva a altura ao lado curto = 1080; `passo` = segundos entre amostras. Devolve achados sem o PNG.
 * Quadro com ≥ 6 linhas pequenas é "tela encolhida": um achado só para o trecho todo (as amostras vizinhas com
 * ≥ 2 linhas pequenas entram nele), em vez de um achado por linha.
 */
export function classificarLegibilidade(quadros, { minimoPx = 28, ilegivelPx = 16, excecoes = [], escala = 1, passo = 0.5, decoracaoAte = 0 } = {}) {
  const exc = excecoes.map((e) => (e instanceof RegExp ? e : new RegExp(e, 'i')))
  // decoracaoAte: a abertura do tutorial com cinema mostra a tela de sucesso num celular 3D desfocado de propósito, ao
  // lado do título. Não é tela para ler: somada ao plano geral da primeira tela, viraria "tela encolhida". O título da
  // abertura é grande e o motor que o desenha confere a área segura.
  if (decoracaoAte > 0) quadros = quadros.filter((q) => q.t >= decoracaoAte)
  const porQuadro = []
  for (const q of quadros) {
    const pequenas = []
    for (const l of q.linhas) {
      if (alfanum(l.texto) < 2) continue   // cantos decorativos viram "Г", "7", "L"
      const h = Math.round(alturaDoCorpo(l) * escala)
      if (h >= minimoPx) continue
      if (h >= ilegivelPx && exc.some((r) => r.test(l.texto))) continue
      pequenas.push({ ...l, hn: h })
    }
    if (pequenas.length) porQuadro.push({ i: q.i, t: q.t, linhas: pequenas.map((l) => ({ ...l, nq: pequenas.length })) })
  }
  const achados = [], soltas = []
  for (const g of agruparNoTempo(porQuadro.filter((q) => q.linhas.length >= 2))) {
    const rep = g.itens.reduce((a, b) => (b.linhas.length > a.linhas.length ? b : a))
    if (rep.linhas.length < 6) continue
    g.itens.forEach((q) => (q.absorvido = true))
    const todas = g.itens.flatMap((q) => q.linhas)
    const menor = Math.min(...todas.map((l) => l.hn))
    // o tempo que a tela fica de fato encolhida: a maior sequência de amostras com >= 6 linhas pequenas (as amostras
    // vizinhas de detalhe, com 2 a 5, entram no achado mas não contam como tela encolhida)
    let dur = 0, ini = null, ant = null
    for (const q of g.itens) {
      if (q.linhas.length >= 6) { if (ini == null || q.t - ant > passo * 1.5) ini = q.t; ant = q.t; dur = Math.max(dur, q.t + passo - ini) } else ini = null
    }
    const geral = dur <= PLANO_GERAL_MAX + 1e-6
    achados.push({
      checagem: 'legibilidade', nivel: geral ? 'aviso' : 'erro', t: r2(g.itens[0].t), fim: r2(g.itens[g.itens.length - 1].t + passo),
      msg: geral
        ? `wide shot of ${fmt(dur, 1)} s: the whole screen small (${rep.linhas.length} lines below ${minimoPx} px, the smallest at ${menor} px). Fine if the camera moves in right after`
        : `${rep.linhas.length} lines of text below ${minimoPx} px in the same frame, the smallest at ${menor} px (${exemplos(todas.map((l) => l.texto))}), for ${fmt(dur, 1)} s: shrunken screen or screenshot too small`,
      oque_fazer: geral
        ? `If the voice asks the viewer to read something on this screen, move in first; above ${fmt(PLANO_GERAL_MAX, 1)} s in a row it becomes an error.`
        : 'Show less of the screen, and bigger: move the camera in on the part the voice talks about or recompose the screen for the format, instead of shrinking the whole screen.',
      caixas: rep.linhas.map(({ x, y, w, h }) => ({ x, y, w, h })), _t: rep.t,
    })
  }
  for (const q of porQuadro) if (!q.absorvido) for (const l of q.linhas) soltas.push({ i: q.i, t: q.t, ...l })
  for (const g of agruparNoTempo(soltas, mesmoTexto)) {
    const menor = g.itens.reduce((a, b) => (b.hn < a.hn ? b : a))
    // linha pequena dentro de um plano geral curto (o quadro tem outras linhas pequenas: é a tela inteira) é aviso
    const dur = g.itens[g.itens.length - 1].t + passo - g.itens[0].t
    const ruim = menor.hn < ilegivelPx && !(g.itens.every((x) => x.nq >= 3) && dur <= PLANO_GERAL_MAX + 1e-6)
    achados.push({
      checagem: 'legibilidade', nivel: ruim ? 'erro' : 'aviso', t: r2(g.itens[0].t), fim: r2(g.itens[g.itens.length - 1].t + passo),
      msg: ruim
        ? `"${curto(menor.texto)}" is ${menor.hn} px tall: unreadable on a phone (minimum ${minimoPx} px)`
        : `"${curto(menor.texto)}" is ${menor.hn} px tall, below the minimum of ${minimoPx} px`,
      oque_fazer: ruim
        ? `Make it ${minimoPx} px or more, or take this text out of the frame.`
        : `Make it ${minimoPx} px; if it is a source footnote, add it to the exceptions list.`,
      caixas: [{ x: menor.x, y: menor.y, w: menor.w, h: menor.h }], _t: menor.t,
      // ilegível numa amostra só: pode ser texto borrado no meio de um movimento (o motion blur do final); a
      // checagem confere meio passo antes e depois (conferirIlegiveis) antes de reprovar
      ...(ruim && g.itens.length === 1 ? { _relance: { texto: menor.texto, x: menor.x, y: menor.y, w: menor.w, h: menor.h } } : {}),
    })
  }
  return achados.sort((a, b) => a.t - b.t)
}

// ── leitura no player ────────────────────────────────────────────────────────────────────────────
// O vídeo toca encolhido: no celular em pé o player tem ~390 px de largura, e um 16:9 de 1920 cabe nesses 390. A régua é
// a do motor da explicação desenhada (templates/drawn-explainer/scene/engine/readability.js): o corpo da letra no tamanho em que ela aparece no player; abaixo de 16 px é
// problema. Sem faixa de aviso: 16 px no player já é o tamanho do texto corrido no celular (references/refine.md).
export const PLAYER_MINIMO = 16
export const CELULAR_EM_PE = 480       // player até 480 px de largura = celular em pé (390 no iPhone, 412 a 480 nos Android grandes)
export const FAZER_9X16 = 1 / 3        // fração dos quadros com texto reprovando que faz do 16:9 no celular em pé o problema
const TELA_INTEIRA = 6                 // linhas pequenas no mesmo quadro = a tela inteira mostrada (o mesmo da legibilidade)

/** A largura do vídeo com o lado curto em 1080 (a mesma normalização da legibilidade): 1920 no 16:9, 1080 no 9:16, 1:1 e 4:5. */
export const larguraNormalizada = (W, H) => Math.round((W * 1080) / Math.min(W, H))
export const fatorDoPlayer = (largura, player) => Math.min(1, player / largura)
/** A altura (px do vídeo normalizado) no tamanho em que fica no player. */
export const pxNoPlayer = (hn, largura, player) => hn * fatorDoPlayer(largura, player)
/** Quanto a linha precisa ter no vídeo normalizado para chegar a 16 px no player: 79 no 16:9 a 390, 45 no 9:16 a 390. */
export const pxParaOPlayer = (largura, player, minimo = PLAYER_MINIMO) => Math.ceil(Math.round((minimo * 1e6) / fatorDoPlayer(largura, player)) / 1e6)

/**
 * O que fazer quando a linha não chega a 16 px no player. `telaInteira`: 6+ linhas pequenas no mesmo quadro (a tela
 * inteira mostrada) pede câmera, não fonte maior; poucas linhas pedem o texto maior. O 16:9 num celular em pé com
 * `fracao` ≥ 1/3 dos quadros com texto reprovando não se conserta linha a linha: o formato é o problema.
 */
export function fraseDoPlayer({ telaInteira = false, precisa, player, formato = null, fracao = 0 }) {
  const base = telaInteira
    ? `Move the camera in on the current field: in a ${player} px player, each line needs ≥ ${precisa} px in the video to reach ${PLAYER_MINIMO} px.`
    : `Make the text ≥ ${precisa} px in the video (it reaches ${PLAYER_MINIMO} px in a ${player} px player), or take this text out of the frame.`
  return formato === '16x9' && player <= CELULAR_EM_PE && fracao >= FAZER_9X16 - 1e-9 ? `${base} This 16:9 on an upright phone is unreadable: make the 9:16.` : base
}

/**
 * Classifica as linhas do OCR no tamanho do player. Mesmas entradas da classificarLegibilidade, mais `player` (px de
 * largura), `largura` (a largura normalizada do vídeo) e `formato`. As exceções e a abertura decorativa valem como lá.
 * Linha abaixo de 16 px no player é erro. 6+ linhas no mesmo quadro viram um achado só (a tela inteira); por até 2,6 s
 * seguidos é o plano geral antes do zoom, e fica aviso. Devolve { achados, medidas } (achados sem o PNG).
 */
export function classificarPlayer(quadros, { player, largura, formato = null, ilegivelPx = 16, excecoes = [], escala = 1, passo = 0.5, decoracaoAte = 0 } = {}) {
  const exc = excecoes.map((e) => (e instanceof RegExp ? e : new RegExp(e, 'i')))
  const fator = fatorDoPlayer(largura, player), precisa = pxParaOPlayer(largura, player)
  if (decoracaoAte > 0) quadros = quadros.filter((q) => q.t >= decoracaoAte)
  const porQuadro = []
  let comTexto = 0
  for (const q of quadros) {
    const pequenas = []
    let texto = false
    for (const l of q.linhas) {
      if (alfanum(l.texto) < 2) continue
      const hn = Math.round(alturaDoCorpo(l) * escala)
      if (hn >= ilegivelPx && exc.some((r) => r.test(l.texto))) continue
      texto = true
      if (hn * fator < PLAYER_MINIMO) pequenas.push({ ...l, hn, hp: hn * fator })
    }
    if (texto) comTexto++
    if (pequenas.length) porQuadro.push({ i: q.i, t: q.t, linhas: pequenas })
  }
  const fracao = comTexto ? porQuadro.length / comTexto : 0
  const fazer = (telaInteira) => fraseDoPlayer({ telaInteira, precisa, player, formato, fracao })
  const no = `in a ${player} px player`
  const achados = []
  for (const g of agruparNoTempo(porQuadro.filter((q) => q.linhas.length >= 2))) {
    const rep = g.itens.reduce((a, b) => (b.linhas.length > a.linhas.length ? b : a))
    if (rep.linhas.length < TELA_INTEIRA) continue
    g.itens.forEach((q) => (q.absorvido = true))
    const todas = g.itens.flatMap((q) => q.linhas)
    const menor = todas.reduce((a, b) => (b.hn < a.hn ? b : a))
    let dur = 0, ini = null, ant = null
    for (const q of g.itens) {
      if (q.linhas.length >= TELA_INTEIRA) { if (ini == null || q.t - ant > passo * 1.5) ini = q.t; ant = q.t; dur = Math.max(dur, q.t + passo - ini) } else ini = null
    }
    const geral = dur <= PLANO_GERAL_MAX + 1e-6
    achados.push({
      checagem: 'player', nivel: geral ? 'aviso' : 'erro', t: r2(g.itens[0].t), fim: r2(g.itens[g.itens.length - 1].t + passo),
      msg: `${geral ? `wide shot of ${fmt(dur, 1)} s: ` : ''}${rep.linhas.length} lines below ${PLAYER_MINIMO} px ${no} in the same frame${geral ? '' : `, for ${fmt(dur, 1)} s`}; the smallest is ${menor.hn} px in the video and ends up ${fmt(menor.hp)} px in the player (${exemplos(todas.map((l) => l.texto))})${geral ? '. Fine if the camera moves in right after' : ': the whole screen shown'}`,
      oque_fazer: geral ? `${fazer(true)} Above ${fmt(PLANO_GERAL_MAX, 1)} s in a row it becomes an error.` : fazer(true),
      caixas: rep.linhas.map(({ x, y, w, h }) => ({ x, y, w, h })), _t: rep.t,
    })
  }
  const soltas = []
  for (const q of porQuadro) if (!q.absorvido) for (const l of q.linhas) soltas.push({ i: q.i, t: q.t, ...l })
  for (const g of agruparNoTempo(soltas, mesmoTexto)) {
    const menor = g.itens.reduce((a, b) => (b.hn < a.hn ? b : a))
    achados.push({
      checagem: 'player', nivel: 'erro', t: r2(g.itens[0].t), fim: r2(g.itens[g.itens.length - 1].t + passo),
      msg: `"${curto(menor.texto)}" is ${menor.hn} px in the video and ends up ${fmt(menor.hp)} px ${no} (below ${PLAYER_MINIMO} px)`,
      oque_fazer: fazer(false),
      caixas: [{ x: menor.x, y: menor.y, w: menor.w, h: menor.h }], _t: menor.t,
      ...(g.itens.length === 1 ? { _relance: { texto: menor.texto, x: menor.x, y: menor.y, w: menor.w, h: menor.h } } : {}),
    })
  }
  return {
    achados: achados.sort((a, b) => a.t - b.t),
    medidas: { player, larguraVideo: largura, fator: r2(fator), precisa_px: precisa, quadrosComTexto: comTexto, quadrosReprovados: porQuadro.length, fracao: r2(fracao), faca9x16: /make the 9:16/.test(fazer(false)) },
  }
}

/**
 * Texto ilegível visto numa amostra só: lê um quadro meio passo antes e outro meio passo depois. Se nenhum dos dois
 * tem texto ilegível no mesmo lugar ou com o mesmo texto, era relance: borrão de movimento (o motion blur do final lê
 * "Ver saques" como "LAR CANIIA" com 14 px) ou a troca de legenda (o "Passo 2 de 8" lido pela metade com 14 px), e
 * vira aviso. Texto parado e ilegível aparece ilegível nos vizinhos e continua erro.
 * Vale para a legibilidade (fator 1, limite = ilegivelPx) e para o player (fator do player, limite 16): o título que
 * cresce na entrada pego no meio da animação é relance também.
 */
async function conferirIlegiveis(mp4, achados, { checagem = 'legibilidade', de, ate, passoS, tmp, escala, limite, fator = 1 }) {
  const alvo = achados.filter((a) => a.checagem === checagem && a.nivel === 'erro' && a._relance).slice(0, MAX_CONFERIR)
  if (!alvo.length) return 0
  const extras = []
  for (const [j, a] of alvo.entries()) for (const lado of [-0.5, 0.5]) {
    const t = a.t + lado * passoS
    if (t < de || t >= ate) continue
    const arq = path.join(tmp, `${checagem[0]}${String(j).padStart(3, '0')}${lado < 0 ? 'a' : 'b'}.png`)
    if (spawnSync('ffmpeg', ['-v', 'error', '-y', '-ss', String(t), '-i', mp4, '-frames:v', '1', arq]).status === 0) extras.push({ arq, j })
  }
  if (!extras.length) return 0
  const lidos = await ocr(extras.map((e) => e.arq))
  const vistos = new Map()
  lidos.forEach((r, k) => { const j = extras[k].j; vistos.set(j, [...(vistos.get(j) || []), ...r.linhas]) })
  let rebaixados = 0
  for (const [j, a] of alvo.entries()) {
    const r = a._relance, cx = r.x + r.w / 2, cy = r.y + r.h / 2
    const perto = (l) => cx >= l.x - 30 && cx <= l.x + l.w + 30 && cy >= l.y - 30 && cy <= l.y + l.h + 30
    // confirma só se nos vizinhos o texto continua ilegível: o mesmo texto legível meio passo antes ou depois (o rótulo
    // do cartão lido pela metade, com 14 px, no meio da troca de legenda) é relance, não letra pequena
    const confirma = (vistos.get(j) || []).some((l) => alfanum(l.texto) >= 2 && (mesmoTexto(l, r) || perto(l)) && Math.round(alturaDoCorpo(l) * escala) * fator < limite)
    if (vistos.has(j) && !confirma) {
      a.nivel = 'aviso'; rebaixados++
      a.msg += ' — only a glimpse, mid-motion (not there half a step before or after)'
    }
  }
  return rebaixados
}

// ── área segura (texto) ──────────────────────────────────────────────────────────────────────────
/** As linhas do OCR (≥ 2 alfanuméricos) que saem do retângulo seguro, com os lados e se estão esmaecidas. */
export function linhasFora(linhas, area) {
  const out = []
  for (const l of linhas) {
    if (alfanum(l.texto) < 2) continue
    const lados = []
    if (l.x < area.x0 - FOLGA_AREA) lados.push(['x', l.x, '<', area.x0])
    if (l.x + l.w > area.x1 + FOLGA_AREA) lados.push(['x', l.x + l.w, '>', area.x1])
    if (l.y < area.y0 - FOLGA_AREA) lados.push(['y', l.y, '<', area.y0])
    if (l.y + l.h > area.y1 + FOLGA_AREA) lados.push(['y', l.y + l.h, '>', area.y1])
    if (lados.length) out.push({ ...l, lados, apagado: l.contraste != null && l.contraste < CONTRASTE_APAGADO })
  }
  return out
}

/**
 * Texto do OCR (≥ 2 alfanuméricos) fora do retângulo seguro, um achado por trecho de tempo. É erro quando algum texto
 * opaco fica fora em ≥ 2 amostras seguidas; texto esmaecido (contraste do OCR < 80) ou visto de relance é aviso.
 */
export function textoForaDaArea(quadros, area, { passo = 0.5, escala = 1, minimoPx = 28, excecoes = [] } = {}) {
  // exceções do gabarito (texto_excecoes): texto que está fora de propósito e não é para ler, como o logo no cenário
  // filmado atrás da pessoa na câmera. O plano geral continua contando todas as linhas.
  const exc = excecoes.map((e) => (e instanceof RegExp ? e : new RegExp(e, 'i')))
  const fora = []
  for (const q of quadros) {
    const linhas = linhasFora(q.linhas, area).filter((l) => !exc.some((re) => re.test(l.texto)))
    // plano geral: o quadro é a tela inteira do app, pequena (≥ 6 linhas abaixo do mínimo)
    q.geral = q.linhas.filter((l) => alfanum(l.texto) >= 2 && Math.round(alturaDoCorpo(l) * escala) < minimoPx).length >= 6
    if (linhas.length) fora.push({ i: q.i, t: q.t, linhas, geral: q.geral })
  }
  quadros = [...quadros].sort((a, b) => a.t - b.t)
  // amostras de plano geral curto (a tela inteira de passagem, até PLANO_GERAL_MAX seguidos): o texto do app que passa
  // por baixo da interface da rede ali não conta como erro
  const curtas = new Set()
  for (let k = 0; k < quadros.length; k++) {
    if (!quadros[k].geral) continue
    let j = k
    while (j + 1 < quadros.length && quadros[j + 1].geral && quadros[j + 1].t - quadros[j].t <= passo * 1.5) j++
    if (quadros[j].t + passo - quadros[k].t <= PLANO_GERAL_MAX + 1e-6) for (let x = k; x <= j; x++) curtas.add(quadros[x].i)
    k = j
  }
  const achados = []
  for (const g of agruparNoTempo(fora)) {
    const todas = g.itens.flatMap((q) => q.linhas.map((l) => ({ ...l, i: q.i, ...(curtas.has(q.i) ? { apagado: true, deGeral: true } : {}) })))
    // erro só se o mesmo texto opaco aparece fora em duas amostras ou mais
    const opacos = agruparNoTempo(todas.filter((l) => !l.apagado), mesmoTexto, 0).filter((x) => x.i1 > x.i0)
    // a tela inteira do app no plano geral curto pode passar por baixo da interface da rede (é uma imagem de
    // passagem, não texto para ler); o detalhe, não
    const planoGeral = todas.length > 0 && todas.every((l) => l.deGeral)
    const dur = g.itens[g.itens.length - 1].t + passo - g.itens[0].t
    const nivel = opacos.length ? 'erro' : 'aviso'
    const foco = opacos.length ? opacos.flatMap((x) => x.itens) : todas
    // o quadro marcado é o que tem mais linhas do foco (no erro, as opacas que ficam fora)
    const porAmostra = new Map()
    for (const l of foco) porAmostra.set(l.i, [...(porAmostra.get(l.i) || []), l])
    const [iRep, linhasRep] = [...porAmostra].reduce((a, b) => (b[1].length > a[1].length ? b : a))
    const rep = { t: g.itens.find((q) => q.i === iRep).t, linhas: linhasRep }
    // o pior estouro de cada lado
    const pior = new Map()
    for (const l of foco) for (const [eixo, v, op, lim] of l.lados) {
      const k = eixo + op, d = Math.abs(v - lim)
      if (!pior.has(k) || d > pior.get(k).d) pior.set(k, { d, txt: `${eixo} ${Math.round(v)} ${op} ${Math.round(lim)}` })
    }
    const textos = [...new Set(foco.map((l) => normal(l.texto)))]
    const relance = 'only a glimpse'
    const nota = nivel === 'erro' ? '' : planoGeral ? `, in the ${fmt(dur, 1)} s wide shot (the whole screen passing by)` : todas.every((l) => l.apagado) ? ', faded' : todas.some((l) => l.apagado) ? `, faded or ${relance}` : `, ${relance}`
    const quem = textos.length === 1 ? `text ${exemplos(foco.map((l) => l.texto), 1)} leaves` : `texts leave`
    achados.push({
      checagem: 'area-segura', nivel, t: r2(g.itens[0].t), fim: r2(g.itens[g.itens.length - 1].t + passo),
      msg: `${quem} the ${area.nome} safe area (${[...pior.values()].map((x) => x.txt).join(', ')})${textos.length > 1 ? `, up to ${rep.linhas.length} in the same frame: ` + exemplos(foco.map((l) => l.texto)) : ''}${nota}`,
      oque_fazer: `Bring the text inside x ${Math.round(area.x0)}–${Math.round(area.x1)}, y ${Math.round(area.y0)}–${Math.round(area.y1)} (position, a smaller size or a line break).`,
      caixas: rep.linhas.map(({ x, y, w, h }) => ({ x, y, w, h })), _t: rep.t,
    })
  }
  return achados
}

// ── análise de um quadro cinza reduzido ─────────────────────────────────────────────────────────
/** Mapa de células com conteúdo: 1 onde há ≥ CEL_CHEIA pixels de borda. Também guarda a caixa das bordas. */
export function mapaDeConteudo(g, w, h) {
  const cw = Math.ceil(w / CEL), ch = Math.ceil(h / CEL)
  const conta = new Uint16Array(cw * ch)
  const caixa = new Int16Array(cw * ch * 4).fill(-1)
  for (let y = 0; y < h - 1; y++) {
    const cy = (y / CEL) | 0
    for (let x = 0; x < w - 1; x++) {
      const i = y * w + x, v = g[i]
      const d = Math.abs(g[i + 1] - v) + Math.abs(g[i + w] - v)
      if (d < BORDA) continue
      const k = cy * cw + ((x / CEL) | 0)
      if (conta[k]++ === 0) { caixa[k * 4] = x; caixa[k * 4 + 1] = y; caixa[k * 4 + 2] = x; caixa[k * 4 + 3] = y; continue }
      if (x < caixa[k * 4]) caixa[k * 4] = x
      if (x > caixa[k * 4 + 2]) caixa[k * 4 + 2] = x
      if (y > caixa[k * 4 + 3]) caixa[k * 4 + 3] = y
    }
  }
  const cheia = new Uint8Array(cw * ch)
  for (let k = 0; k < cheia.length; k++) cheia[k] = conta[k] >= CEL_CHEIA ? 1 : 0
  return { cw, ch, cheia, caixa }
}

/** Fração de células com conteúdo dentro de um retângulo (px da cópia). */
export function ocupacao(mapa, r) {
  let n = 0, c = 0
  for (let cy = 0; cy < mapa.ch; cy++) for (let cx = 0; cx < mapa.cw; cx++) {
    const x = (cx + 0.5) * CEL, y = (cy + 0.5) * CEL
    if (x < r.x0 || x >= r.x1 || y < r.y0 || y >= r.y1) continue
    n++; c += mapa.cheia[cy * mapa.cw + cx]
  }
  return n ? c / n : 0
}

/** Manchas de conteúdo dentro de uma zona (px da cópia): componentes 8-conexos de células, com a caixa das bordas. */
export function manchas(mapa, z) {
  const { cw, ch, cheia, caixa } = mapa
  const dentro = (cx, cy) => { const x = (cx + 0.5) * CEL, y = (cy + 0.5) * CEL; return x >= z.x0 && x < z.x1 && y >= z.y0 && y < z.y1 }
  const visto = new Uint8Array(cw * ch), out = []
  for (let cy = 0; cy < ch; cy++) for (let cx = 0; cx < cw; cx++) {
    const k0 = cy * cw + cx
    if (!cheia[k0] || visto[k0] || !dentro(cx, cy)) continue
    const pilha = [k0]; visto[k0] = 1
    const b = { x0: Infinity, y0: Infinity, x1: -Infinity, y1: -Infinity, n: 0 }
    while (pilha.length) {
      const k = pilha.pop(), x = k % cw, y = (k / cw) | 0
      b.n++
      b.x0 = Math.min(b.x0, caixa[k * 4]); b.y0 = Math.min(b.y0, caixa[k * 4 + 1])
      b.x1 = Math.max(b.x1, caixa[k * 4 + 2]); b.y1 = Math.max(b.y1, caixa[k * 4 + 3])
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const nx = x + dx, ny = y + dy, nk = ny * cw + nx
        if (nx < 0 || ny < 0 || nx >= cw || ny >= ch || visto[nk] || !cheia[nk] || !dentro(nx, ny)) continue
        visto[nk] = 1; pilha.push(nk)
      }
    }
    out.push(b)
  }
  return out
}

// ── ffmpeg ───────────────────────────────────────────────────────────────────────────────────────
export function sondar(mp4) {
  const r = spawnSync('ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height,avg_frame_rate,r_frame_rate:format=duration', '-of', 'json', mp4], { encoding: 'utf8' })
  if (r.error) throw new Error('ffprobe not found: install ffmpeg.')
  if (r.status !== 0) throw new Error(`ffprobe could not read ${mp4}: ${r.stderr.trim()}`)
  const j = JSON.parse(r.stdout), s = (j.streams || [])[0]
  if (!s) throw new Error(`${mp4} has no video stream.`)
  const taxa = (x) => { const [a, b] = String(x || '0/1').split('/').map(Number); return b ? a / b : 0 }
  return { W: s.width, H: s.height, fps: taxa(s.avg_frame_rate) || taxa(s.r_frame_rate) || 30, duracao: +j.format.duration }
}

/**
 * Uma passada no vídeo: cópia cinza reduzida a cada quadro (pelo pipe) + freezedetect na de 270 px.
 * `aCada(n, g)` recebe o índice do quadro e o buffer (reaproveitado: copie o que quiser guardar).
 * `difs[n]` = diferença média absoluta (0–255) entre o quadro n e o anterior.
 */
function passadaCinza(mp4, { de, dur, w, h, wf, hf, aCada }) {
  return new Promise((resolve, reject) => {
    const filtro = `[0:v]scale=${w}:${h},format=gray,split=2[a][b];[b]scale=${wf}:${hf},freezedetect=n=${FREEZE_RUIDO}:d=0.1,nullsink`
    const p = spawn('ffmpeg', ['-hide_banner', '-nostats', '-ss', String(de), '-t', String(dur), '-i', mp4, '-filter_complex', filtro, '-map', '[a]', '-f', 'rawvideo', '-pix_fmt', 'gray', '-'])
    const N = w * h, q = Buffer.alloc(N), ant = Buffer.alloc(N), difs = []
    let cheio = 0, n = 0, err = ''
    p.stdout.on('data', (d) => {
      let o = 0
      while (o < d.length) {
        const k = Math.min(N - cheio, d.length - o)
        d.copy(q, cheio, o, o + k); cheio += k; o += k
        if (cheio === N) {
          if (n > 0) { let s = 0; for (let j = 0; j < N; j++) s += Math.abs(q[j] - ant[j]); difs.push(s / N) } else difs.push(0)
          q.copy(ant); aCada(n++, q); cheio = 0
        }
      }
    })
    p.stderr.on('data', (d) => (err += d))
    p.on('error', (e) => reject(new Error('ffmpeg not found: ' + e.message)))
    p.on('close', (c) => (c === 0 ? resolve({ quadros: n, difs, freeze: lerFreezedetect(err) }) : reject(new Error('ffmpeg failed while reading: ' + err.slice(-400)))))
  })
}

function extrairPng(mp4, { de, dur, passo, pasta }) {
  return new Promise((resolve, reject) => {
    const p = spawn('ffmpeg', ['-v', 'error', '-ss', String(de), '-t', String(dur), '-i', mp4, '-vf', `select=not(mod(n\\,${passo}))`, '-fps_mode', 'passthrough', '-compression_level', '1', '-start_number', '0', path.join(pasta, 'q%05d.png')])
    let err = ''
    p.stderr.on('data', (d) => (err += d))
    p.on('error', reject)
    p.on('close', (c) => {
      if (c !== 0) return reject(new Error('ffmpeg could not extract the frames: ' + err.slice(-400)))
      resolve(fs.readdirSync(pasta).filter((f) => /^q\d+\.png$/.test(f)).sort().map((f) => path.join(pasta, f)))
    })
  })
}

// ── OCR ──────────────────────────────────────────────────────────────────────────────────────────
let _ocr = null
/** O OCR desta máquina: { bin, args, motor } (o Swift compila uma vez no cache) ou { erro }. */
export function binarioOcr() {
  if (_ocr) return _ocr
  if (process.platform === 'win32') return (_ocr = ocrDoWindows())
  if (process.platform !== 'darwin') return (_ocr = { erro: 'there is no OCR for this system (the refine reads text with macOS Vision or the Windows OCR)' })
  const fonte = fs.readFileSync(FONTE_OCR)
  const hash = crypto.createHash('sha1').update(fonte).digest('hex').slice(0, 12)
  const cache = path.join(os.homedir(), '.cache', 'videostudio')
  const bin = path.join(cache, `ocr-${hash}`)
  if (fs.existsSync(bin)) return (_ocr = { bin, args: [], motor: 'vision' })
  fs.mkdirSync(cache, { recursive: true })
  const tmp = `${bin}.${process.pid}`
  const r = spawnSync('swiftc', ['-O', FONTE_OCR, '-o', tmp], { encoding: 'utf8' })
  if (r.error) return (_ocr = { erro: 'swiftc not found (install the Command Line Tools: xcode-select --install)' })
  if (r.status !== 0) return (_ocr = { erro: 'swiftc could not compile ocr.swift: ' + (r.stderr || '').trim().split('\n').slice(-3).join(' ') })
  fs.renameSync(tmp, bin)
  return (_ocr = { bin, args: [], motor: 'vision' })
}

const jsonDoPowershell = (txt) => { try { return JSON.parse(String(txt).replace(/^\uFEFF/, '').trim().split(/\r?\n/).pop()) } catch { return null } }

/** O OCR do próprio Windows, pelo ocr.ps1: confere uma vez se há motor (um idioma com OCR instalado). */
function ocrDoWindows() {
  const r = spawnSync('powershell.exe', [...POWERSHELL, FONTE_OCR_WIN, '--check'], { encoding: 'utf8', timeout: 60000, windowsHide: true })
  if (r.error) return { erro: `could not run Windows PowerShell, which reads the text with the Windows OCR (${r.error.code || r.error.message})` }
  const j = jsonDoPowershell(r.stdout)
  if (!j) return { erro: 'the Windows OCR did not answer: ' + `${r.stderr || ''} ${r.stdout || ''}`.trim().split(/\r?\n/).slice(-2).join(' ') }
  if (j.erro) return { erro: j.erro }
  return { bin: 'powershell.exe', args: [...POWERSHELL, FONTE_OCR_WIN], motor: 'windows', idioma: j.idioma }
}

function rodarOcr(o, imagens) {
  return new Promise((resolve, reject) => {
    const p = spawn(o.bin, [...o.args, ...imagens], { windowsHide: true })
    let out = '', err = ''
    p.stdout.on('data', (d) => (out += d)); p.stderr.on('data', (d) => (err += d))
    p.on('error', reject)
    p.on('close', (c) => {
      if (c !== 0) return reject(new Error('the OCR failed: ' + err.slice(-300)))
      resolve(out.replace(/^\uFEFF/, '').split(/\r?\n/).filter(Boolean).map((l) => JSON.parse(l)))
    })
  })
}

/** Luminância 8 bits da imagem, linha 0 em cima (o cinza do ffmpeg é de 0 a 255, como o do ocr.swift). */
function cinza(png, W, H) {
  const r = spawnSync('ffmpeg', ['-v', 'error', '-i', png, '-f', 'rawvideo', '-pix_fmt', 'gray', '-'], { maxBuffer: W * H + 4096, windowsHide: true })
  return r.status === 0 && r.stdout.length === W * H ? r.stdout : null
}

/** p95 − p5 da luminância na caixa: a mesma medida do ocr.swift (texto esmaecido de propósito fica abaixo de ~80). */
export function contrasteNaCaixa(px, W, H, { x, y, w, h }) {
  const x0 = Math.max(0, Math.round(x)), y0 = Math.max(0, Math.round(y)), x1 = Math.min(W, Math.round(x + w)), y1 = Math.min(H, Math.round(y + h))
  if (x1 - x0 < 2 || y1 - y0 < 2) return null
  const hist = new Uint32Array(256)
  for (let yy = y0; yy < y1; yy++) for (let xx = x0; xx < x1; xx++) hist[px[yy * W + xx]]++
  const n = (x1 - x0) * (y1 - y0)
  const p = (f) => { let s = 0; for (let v = 0; v < 256; v++) { s += hist[v]; if (s >= f * n) return v } return 255 }
  return p(0.95) - p(0.05)
}

// O OCR do Windows dá a caixa justa das letras: 0,73 da fonte numa linha sem haste acima ou sem perna abaixo, 0,93 com
// as duas (medido no runner do GitHub em 12/10/2026, Arial de 14 a 120 px). O Vision, em que os limiares foram calibrados,
// mede ~1,15 disso nas mesmas linhas (1,11 a 1,20 conforme a forma): a caixa do Windows cresce 15% em volta do centro.
const ALTURA_WINDOWS = 1.15
const naEscalaDoVision = (l) => { const h = Math.round(l.h * ALTURA_WINDOWS); return { ...l, y: Math.round(l.y - (h - l.h) / 2), h } }

/** OCR do sistema: [{arquivo, w, h, linhas:[{texto, x, y, w, h, contraste}]}], px com origem no topo. */
export async function ocr(imagens) {
  const o = binarioOcr()
  if (o.erro) throw new Error(o.erro)
  const lotes = []
  for (let i = 0; i < imagens.length; i += 24) lotes.push(imagens.slice(i, i + 24))
  const res = []
  // dois processos de cada vez: o Vision já usa o Neural Engine, mais que isso só disputa memória
  for (let i = 0; i < lotes.length; i += 2) res.push(...(await Promise.all(lotes.slice(i, i + 2).map((l) => rodarOcr(o, l)))).flat())
  return res.map((r) => {
    const linhas = r.linhas || []
    if (o.motor !== 'windows') return { ...r, linhas }
    // o OCR do Windows não mede o contraste: sai dos pixels da mesma imagem, na caixa justa que ele deu
    const px = linhas.length ? cinza(r.arquivo, r.w, r.h) : null
    return { ...r, linhas: linhas.map((l) => ({ ...naEscalaDoVision(l), ...(px ? { contraste: contrasteNaCaixa(px, r.w, r.h, l) ?? undefined } : {}) })) }
  })
}

// ── quadros marcados ─────────────────────────────────────────────────────────────────────────────
function marcarQuadros(mp4, achados, { pasta, area, W, H }) {
  fs.mkdirSync(pasta, { recursive: true })
  const porChecagem = {}, usados = new Set()
  for (const a of achados) {
    if (a.t == null) continue
    porChecagem[a.checagem] = (porChecagem[a.checagem] || 0) + 1
    if (porChecagem[a.checagem] > MAX_QUADROS) continue
    const t = a._t ?? a.t
    let nome = `${a.checagem}-${t.toFixed(2)}`, k = 1
    while (usados.has(nome)) nome = `${a.checagem}-${t.toFixed(2)}-${++k}`
    usados.add(nome)
    const arq = path.join(pasta, nome + '.png')
    // o drawbox não desenha caixa que começa fora do quadro: corta nas bordas
    const caixa = (c, cor, esp) => {
      const x0 = Math.max(0, Math.round(c.x)), y0 = Math.max(0, Math.round(c.y))
      const x1 = Math.min(W, Math.round(c.x + c.w)), y1 = Math.min(H, Math.round(c.y + c.h))
      return `drawbox=x=${x0}:y=${y0}:w=${Math.max(1, x1 - x0)}:h=${Math.max(1, y1 - y0)}:color=${cor}:t=${esp}`
    }
    const fs_ = []
    if (a.checagem === 'area-segura' || a.checagem === 'vazio') fs_.push(caixa({ x: area.x0, y: area.y0, w: area.x1 - area.x0, h: area.y1 - area.y0 }, 'yellow@0.7', 2))
    for (const c of a.caixas || []) fs_.push(caixa({ x: c.x - 6, y: c.y - 6, w: c.w + 12, h: c.h + 12 }, 'red', 6))
    const r = spawnSync('ffmpeg', ['-v', 'error', '-y', '-ss', String(t), '-i', mp4, '-frames:v', '1', ...(fs_.length ? ['-vf', fs_.join(',')] : []), arq])
    if (r.status === 0) a.quadro = arq
  }
}

/**
 * Texto opaco fora da área numa amostra só, sem o mesmo texto nas vizinhas: tira e lê um quadro meio passo antes e
 * outro meio passo depois, para separar o que passa de relance (no meio de um movimento) do que fica fora de verdade.
 * Devolve quadros extras com i fracionário (i ± 0,5).
 */
async function conferirRelances(mp4, quadros, area, { de, ate, fps, passo, tmp }) {
  const opacos = new Map(quadros.map((q) => [q.i, linhasFora(q.linhas, area).filter((l) => !l.apagado)]))
  const duvidas = []
  for (const [i, ls] of opacos) {
    const vizinhas = [...(opacos.get(i - 1) || []), ...(opacos.get(i + 1) || [])]
    if (ls.some((l) => !vizinhas.some((v) => mesmoTexto(l, v)))) duvidas.push(i)
  }
  const extras = []
  for (const i of duvidas.slice(0, MAX_CONFERIR)) {
    for (const lado of [-0.5, 0.5]) {
      const n = Math.round((i + lado) * passo), t = de + n / fps
      if (n < 0 || t >= ate) continue
      const arq = path.join(tmp, `c${String(n).padStart(6, '0')}.png`)
      if (spawnSync('ffmpeg', ['-v', 'error', '-y', '-ss', String(t), '-i', mp4, '-frames:v', '1', arq]).status === 0) extras.push({ arq, i: i + lado, t })
    }
  }
  if (!extras.length) return []
  const lidos = await ocr(extras.map((e) => e.arq))
  return lidos.map((r, j) => ({ i: extras[j].i, t: extras[j].t, linhas: r.linhas }))
}

// ── a checagem ───────────────────────────────────────────────────────────────────────────────────
/**
 * Confere um MP4 pronto. Devolve { achados, medidas }.
 * opcoes: { formato (deduz de largura×altura), plataforma: 'tiktok'|'reels'|'shorts'|'stories'|'feed'|'youtube'|'app'|null,
 *   paradoMax: 0.6, finalParadoMin: 1.2, legibilidade: { minimoPx: 28, ilegivelPx: 16, excecoes: [regex em string], pular: false },
 *   player: largura do player em px (a leitura no player só roda com ele; o refine.mjs tira do --channel),
 *   qps: 2, saidaQuadros: '<folder>', de, ate, checagens: ['legibilidade','player','parado','vazio','area-segura'] }
 * Achado: { checagem, nivel, t, fim?, msg, oque_fazer, caixas?: [{x,y,w,h}] (px do vídeo), quadro? }.
 */
export async function checarVideo(mp4, opcoes = {}) {
  const t0 = Date.now()
  if (!fs.existsSync(mp4)) throw new Error(`Video not found: ${mp4}`)
  const info = sondar(mp4)
  const { W, H, fps, duracao } = info
  const formato = opcoes.formato || formatoDe(W, H)
  const plataforma = opcoes.plataforma ?? null
  const paradoMax = opcoes.paradoMax ?? PADRAO.paradoMax
  const finalParadoMin = opcoes.finalParadoMin ?? PADRAO.finalParadoMin
  // valor undefined (regra que o gabarito não define) fica com o padrão
  const leg = { ...PADRAO.legibilidade, ...Object.fromEntries(Object.entries(opcoes.legibilidade || {}).filter(([, v]) => v != null)) }
  const qps = opcoes.qps ?? PADRAO.qps
  const quer = new Set(opcoes.checagens || CHECAGENS)
  const player = quer.has('player') && opcoes.player > 0 ? opcoes.player : null
  const de = Math.max(0, opcoes.de ?? 0), ate = Math.min(duracao, opcoes.ate ?? duracao)
  const dur = ate - de
  if (!(dur > 0)) throw new Error(`Empty interval: from ${de} to ${ate} s.`)

  const area = areaSeguraDe(formato, plataforma, W, H)
  const zonas = zonasDaInterface(formato, plataforma, W, H)
  const k = CURTO / Math.min(W, H)                       // vídeo → cópia
  const w = Math.round(W * k / 2) * 2, h = Math.round(H * k / 2) * 2
  const kx = w / W, ky = h / H
  const kf = FREEZE_LARG / Math.min(W, H)
  const wf = Math.round(W * kf / 2) * 2, hf = Math.round(H * kf / 2) * 2
  const escala = 1080 / Math.min(W, H)                   // altura do texto em px de um vídeo de 1080
  const passo = Math.max(1, Math.round(fps / qps)), passoVazio = Math.max(1, Math.round(fps / VAZIO_QPS))
  const tq = (n) => de + n / fps
  const areaP = { x0: area.x0 * kx, y0: area.y0 * ky, x1: area.x1 * kx, y1: area.y1 * ky }
  const meio = (areaP.y0 + areaP.y1) / 2
  const cima = { ...areaP, y1: meio }, baixo = { ...areaP, y0: meio }

  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'refino-video-'))
  const achados = []
  const medidas = { tempos: {}, arquivo: mp4, formato, plataforma, largura: W, altura: H, fps: r2(fps), duracao: r2(duracao), de: r2(de), ate: r2(ate), qps, areaSegura: area, zonas: zonas.map((z) => z.nome) }
  try {
    // 1) a passada cinza: ocupação 10×/s, cópias das amostras e o freezedetect
    const ocup = [], guardados = new Map()
    const precisaOcr = !leg.pular && (quer.has('legibilidade') || quer.has('area-segura') || !!player)
    const ocrOk = precisaOcr ? binarioOcr() : {}
    const pngs = !precisaOcr || ocrOk.erro ? Promise.resolve([]) : extrairPng(mp4, { de, dur, passo, pasta: tmp })
    pngs.catch(() => {})
    const leitura = await passadaCinza(mp4, {
      de, dur, w, h, wf, hf,
      aCada: (n, g) => {
        const amostra = n % passo === 0
        if (n % passoVazio !== 0 && !amostra) return
        const mapa = mapaDeConteudo(g, w, h)
        if (n % passoVazio === 0) ocup.push({ n, t: tq(n), total: ocupacao(mapa, areaP), cima: ocupacao(mapa, cima), baixo: ocupacao(mapa, baixo) })
        if (amostra) guardados.set(n / passo, { mapa })
      },
    })
    medidas.quadrosLidos = leitura.quadros
    medidas.amostras = guardados.size

    // 2) parado
    const trechos = juntarTrechos(leitura.freeze, leitura.difs, fps).map((x) => ({ ini: de + x.ini, fim: x.fim == null ? null : de + x.fim }))
    const pr = trechosParados(trechos, { fim: ate, fimDoVideo: ate >= duracao - 1.5 / fps, quadro: 1 / fps, paradoMax, finalParadoMin })
    if (quer.has('parado')) achados.push(...pr.achados)
    medidas.parados = trechos.map((x) => ({ ini: r2(x.ini), fim: r2(x.fim ?? ate), dur: r2((x.fim ?? ate) - x.ini) }))
    medidas.cartaoFinalParado = pr.final ? r2(pr.final.dur) : 0

    // 3) vazio
    const dt = passoVazio / fps
    const corridas = (ok) => {
      const out = []
      let ini = null
      ocup.forEach((o, j) => {
        if (ok(o)) { if (ini === null) ini = j }
        else if (ini !== null) { out.push([ini, j - 1]); ini = null }
      })
      if (ini !== null) out.push([ini, ocup.length - 1])
      return out.map(([a, b]) => ({ a: ocup[a], b: ocup[b], dur: ocup[b].t - ocup[a].t + dt, js: ocup.slice(a, b + 1) }))
    }
    const vazios = corridas((o) => o.total < VAZIO_QUADRO).filter((c) => c.dur > VAZIO_QUADRO_S)
    for (const c of quer.has('vazio') ? vazios : []) {
      const pico = Math.max(...c.js.map((o) => o.total))
      achados.push({
        checagem: 'vazio', nivel: 'erro', t: r2(c.a.t), fim: r2(c.b.t + dt),
        msg: `empty frame for ${fmt(c.dur, 1)} s: only ${fmt(pico * 100, 0)}% of the safe area has any object`,
        oque_fazer: 'Do not leave the background alone: the next element comes in earlier or the previous one leaves later.',
        _t: (c.a.t + c.b.t) / 2,
      })
    }
    const dentroDeVazio = (o) => vazios.some((v) => o.t >= v.a.t && o.t <= v.b.t)
    for (const [lado, r, nome] of quer.has('vazio') ? [['cima', cima, 'top'], ['baixo', baixo, 'bottom']] : []) {
      for (const c of corridas((o) => o[lado] < VAZIO_METADE && o.total >= VAZIO_QUADRO).filter((c) => c.dur > VAZIO_METADE_S)) {
        if (c.js.every(dentroDeVazio)) continue
        const outro = c.js.reduce((s, o) => s + o[lado === 'cima' ? 'baixo' : 'cima'], 0) / c.js.length
        achados.push({
          checagem: 'vazio', nivel: 'aviso', t: r2(c.a.t), fim: r2(c.b.t + dt),
          msg: `the ${nome} half of the safe area stays empty for ${fmt(c.dur, 1)} s (the other half is ${fmt(outro * 100, 0)}% filled)`,
          oque_fazer: lado === 'cima' ? 'Recompose: move the content up or put the title in this half.' : 'Recompose: move the content down or make it bigger, or use this half for a supporting element.',
          caixas: [{ x: r.x0 / kx, y: r.y0 / ky, w: (r.x1 - r.x0) / kx, h: (r.y1 - r.y0) / ky }],
          _t: (c.a.t + c.b.t) / 2,
        })
      }
    }
    medidas.vazio = {
      medicoes: ocup.length, porSegundo: r2(1 / dt),
      ocupacaoMedia: r2(ocup.reduce((s, o) => s + o.total, 0) / Math.max(1, ocup.length)),
      quadroVazio_s: r2(vazios.reduce((s, c) => s + c.dur, 0)),
      menor: ocup.length ? (({ t, total }) => ({ t: r2(t), ocupacao: r2(total) }))(ocup.reduce((a, b) => (b.total < a.total ? b : a))) : null,
    }

    // 4) área segura: conteúdo sob a interface
    const sob = []
    for (const [i, { mapa }] of guardados) {
      for (const z of quer.has('area-segura') ? zonas : []) {
        const zp = { x0: z.x0 * kx, y0: z.y0 * ky, x1: z.x1 * kx, y1: z.y1 * ky }
        const ms = manchas(mapa, zp).map((m) => ({ x: m.x0 / kx, y: m.y0 / ky, w: (m.x1 - m.x0 + 1) / kx, h: (m.y1 - m.y0 + 1) / ky, n: m.n }))
          .filter((m) => m.w >= MANCHA_MIN && m.h >= MANCHA_MIN)
        if (ms.length) sob.push({ i, t: de + (i * passo) / fps, zona: z, ms })
      }
    }
    for (const g of agruparNoTempo(sob, (a, b) => a.zona.nome === b.zona.nome)) {
      if (g.i1 === g.i0) continue   // uma amostra só: algo atravessando a faixa no meio de um movimento
      const z = g.itens[0].zona
      const rep = g.itens.reduce((a, b) => (b.ms.length > a.ms.length ? b : a))
      const t1 = g.itens[g.itens.length - 1].t
      const durS = t1 - g.itens[0].t + passo / fps
      achados.push({
        checagem: 'area-segura', nivel: 'aviso', t: r2(g.itens[0].t), fim: r2(t1 + passo / fps),
        msg: `content under ${z.rotulo} for ${fmt(durS, 1)} s`,
        oque_fazer: 'Take what matters out of this strip: the interface covers the video there, so only background or decorative shapes can go there.',
        caixas: rep.ms.map(({ x, y, w, h }) => ({ x: Math.round(x), y: Math.round(y), w: Math.round(w), h: Math.round(h) })), _t: rep.t,
      })
    }

    // 5) OCR: legibilidade e texto fora da área segura
    if (!precisaOcr) {
      medidas.ocr = leg.pular ? 'skipped (legibilidade.pular)' : 'not requested'
      if (player) medidas.player = 'did not run: no OCR (--no-ocr)'
    } else if (ocrOk.erro) {
      achados.push({
        checagem: 'legibilidade', nivel: 'aviso', t: null,
        msg: `the OCR did not run (${ocrOk.erro}): legibility${player ? ', player readability' : ''} and text outside the safe area were not checked`,
        oque_fazer: process.platform === 'win32' ? 'Check the text on the contact sheet yourself; to have the OCR, fix what the message above says (the refine reads text with the Windows OCR, through Windows PowerShell).'
          : process.platform === 'darwin' ? 'Run the refine on a Mac with the Command Line Tools (swiftc), or check the text on the contact sheet.'
            : 'Run the refine on a Mac or on Windows, or check the text on the contact sheet.',
      })
      medidas.ocr = 'did not run: ' + ocrOk.erro
      if (player) medidas.player = 'did not run: ' + ocrOk.erro
    } else {
      const lista = await pngs
      medidas.tempos.leitura = r2((Date.now() - t0) / 1000)
      const lidos = await ocr(lista)
      const quadros = lidos.map((r) => {
        const i = +path.basename(r.arquivo).match(/\d+/)[0]
        return { i, t: de + (i * passo) / fps, linhas: r.linhas }
      })
      medidas.ocr = ocrOk.motor
      medidas.quadrosOcr = quadros.length
      medidas.linhasOcr = quadros.reduce((s, q) => s + q.linhas.length, 0)
      const sp = passo / fps
      if (quer.has('legibilidade')) {
        const leg_ = classificarLegibilidade(quadros, { ...leg, escala, passo: sp })
        medidas.ilegiveisDeRelance = await conferirIlegiveis(mp4, leg_, { de, ate, passoS: sp, tmp, escala, limite: leg.ilegivelPx ?? PADRAO.legibilidade.ilegivelPx })
        for (const a of leg_) delete a._relance
        achados.push(...leg_)
      }
      if (player) {
        const largura = larguraNormalizada(W, H)
        const pl = classificarPlayer(quadros, { player, largura, formato, ilegivelPx: leg.ilegivelPx, excecoes: leg.excecoes ?? [], escala, passo: sp, decoracaoAte: leg.decoracaoAte ?? 0 })
        medidas.player = { ...pl.medidas, deRelance: await conferirIlegiveis(mp4, pl.achados, { checagem: 'player', de, ate, passoS: sp, tmp, escala, limite: PLAYER_MINIMO, fator: fatorDoPlayer(largura, player) }) }
        for (const a of pl.achados) delete a._relance
        achados.push(...pl.achados)
      }
      if (quer.has('area-segura')) {
        const extras = await conferirRelances(mp4, quadros, area, { de, ate, fps, passo, tmp })
        medidas.quadrosConferidos = extras.length
        achados.push(...textoForaDaArea([...quadros, ...extras], area, { passo: sp, escala, minimoPx: leg.minimoPx ?? PADRAO.legibilidade.minimoPx, excecoes: leg.excecoes ?? [] }))
      }
      medidas.tempos.ocr = r2((Date.now() - t0) / 1000 - medidas.tempos.leitura)
    }

    achados.sort((a, b) => (a.t ?? -1) - (b.t ?? -1))
    const t1 = Date.now()
    if (opcoes.saidaQuadros) marcarQuadros(mp4, achados, { pasta: opcoes.saidaQuadros, area, W, H })
    medidas.tempos.quadros = r2((Date.now() - t1) / 1000)
    for (const a of achados) delete a._t
    medidas.achados = { erro: achados.filter((a) => a.nivel === 'erro').length, aviso: achados.filter((a) => a.nivel === 'aviso').length }
    medidas.tempo_s = r2((Date.now() - t0) / 1000)
    return { achados, medidas }
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true })
  }
}

// node scripts/refine/video.mjs <video.mp4> [--platform tiktok] [--frames pasta] [--qps 2] [--except regex …]
//   [--checks parado,vazio] [--from s --to s] [--json]      código 4 = achou erro
// caminho real dos dois lados: a skill é instalada por link simbólico, e aí o argv[1] não bate com o import.meta.url
if (process.argv[1] && (() => { try { return fs.realpathSync(process.argv[1]) === fs.realpathSync(fileURLToPath(import.meta.url)) } catch { return false } })()) {
  const argv = process.argv.slice(2)
  const arg = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 ? argv[i + 1] : d }
  const comValor = ['--platform', '--frames', '--qps', '--except', '--checks', '--format', '--from', '--to']
  const mp4 = argv.find((a, i) => !a.startsWith('--') && !comValor.includes(argv[i - 1]))
  if (!mp4) { console.error('usage: node scripts/refine/video.mjs <video.mp4> [--platform tiktok] [--frames pasta] [--qps 2] [--except regex] [--checks parado,vazio] [--json]'); process.exit(1) }
  const exc = argv.flatMap((a, i) => (argv[i - 1] === '--except' ? [a] : []))
  checarVideo(mp4, {
    plataforma: arg('platform', null), qps: +arg('qps', PADRAO.qps), saidaQuadros: arg('frames'),
    formato: arg('format'), de: arg('from') != null ? +arg('from') : undefined, ate: arg('to') != null ? +arg('to') : undefined,
    legibilidade: { excecoes: exc }, checagens: arg('checks') ? arg('checks').split(',') : undefined,
  }).then(({ achados, medidas }) => {
    process.exitCode = medidas.achados.erro ? 4 : 0
    if (argv.includes('--json')) return console.log(JSON.stringify({ achados, medidas }, null, 1))
    const NIVEL = { erro: 'ERROR', aviso: 'WARNING' }
    for (const a of achados) console.log(`${(NIVEL[a.nivel] ?? a.nivel).padEnd(7)} ${a.checagem.padEnd(12)} ${a.t == null ? '' : `t=${fmt(a.t, 2)}${a.fim != null ? '–' + fmt(a.fim, 2) : ''} s`}  ${a.msg}`)
    console.log(`\n${medidas.achados.erro} error(s), ${medidas.achados.aviso} warning(s) in ${fmt(medidas.tempo_s, 1)} s`)
  }).catch((e) => { console.error(e.message); process.exit(1) })
}

// Calibração (em 3 MP4 9:16 60 fps de Reels aprovados, que têm grão e fundo com brilho lento):
// - freezedetect a 270 px, n=0,001: acha o cartão final (1,4–1,8 s) e respiros de 0,3–0,5 s; com n=0,002 ele chama de
//   parado o @seunome trocando de fonte a cada 8 quadros (1,7 s de um dos Reels), que é movimento.
// - borda ≥ 8 na cópia de 360 px: no fundo (grade, brilho, grão) nenhum pixel passa de 3.
// - quadro vazio < 1,5% da área segura: a bola de papel amassada voando sozinha (0,6 s de outro Reels) ocupa
//   ~4% e é um objeto em cena, não um quadro vazio; fundo puro dá 0%.
// - texto esmaecido: um celular apagado atrás de outra tela mede contraste 33–65; texto opaco, 110–231.
