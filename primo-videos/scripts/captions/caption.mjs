#!/usr/bin/env node
// Põe na imagem a legenda palavra por palavra e, se pedido, os sons de interface, sobre um vídeo já montado.
//   node caption.mjs --video in.mp4 --narration voice/<v>/narration.json --sheet comp/audio/sheet.json --series <pasta da série>
//                     --out out.mp4 [--captions] [--sounds] [--audio mix-sem-efeitos.wav] [--cues cues.json]
//                     [--from 0 --to 15] [--script script.json] [--report out.json] [--zone 0.63,0.756 [--fixed]]
// --zone topo,base (fração da altura) troca a zona do formato; com --fixed a legenda não procura a faixa mais quieta:
// toda linha começa no topo da zona. É a legenda única de um vídeo com a pessoa na câmera, no mesmo lugar do começo ao fim.
// As duas chaves são DESLIGADAS por padrão: sem --captions e sem --sounds o arquivo sai idêntico (cópia byte a byte; com
// --from/--to, só o corte, pelo mesmo caminho de codificação). Receita: recipes/captions/README.md.
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { execFileSync, spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { palavrasDoVideo, escrita, agrupar, estados, semPiscar } from './words.mjs'
import { ZONAS, COLUNAS, COLUNAS_DO_FORMATO, formatoDe, lerQuadros, detalhePorLinha, acentoPorLinha, PESO_ACENTO, escolherTopo } from './placement.mjs'
import { estiloDaMarca, abrirDesenho } from './drawing.mjs'
import { cuesDaFolha, somarSons, medir } from './sounds.mjs'
import { aberturaDe } from '../opening.mjs'

const aqui = path.dirname(fileURLToPath(import.meta.url))
const r3 = (x) => Math.round(x * 1000) / 1000

export function probe(f) {
  const j = JSON.parse(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'stream=codec_type,width,height,r_frame_rate,pix_fmt:format=duration', '-of', 'json', f]).toString())
  const v = j.streams.find((s) => s.codec_type === 'video')
  const [n, d] = v.r_frame_rate.split('/').map(Number)
  return { w: v.width, h: v.height, fps: n / d, pix: v.pix_fmt, duracao: +j.format.duration, temAudio: j.streams.some((s) => s.codec_type === 'audio') }
}

const ff = (a) => { const r = spawnSync('ffmpeg', ['-hide_banner', '-nostats', '-v', 'error', '-y', ...a], { encoding: 'utf8', maxBuffer: 1 << 26 }); if (r.status !== 0) throw new Error('ffmpeg: ' + (r.stderr || '').slice(-600)); return r }

/** Plano da legenda: linhas, estados e o topo de cada linha (a faixa mais quieta da zona do formato). */
export async function planejar({ video, de, ate, W, H, palavras, desenho, acento, zona: zonaDada, fixa = false }) {
  const formato = formatoDe(W, H)
  const zona = zonaDada || ZONAS[formato]
  const linhas = agrupar(palavras)
  const sts = estados(linhas)
  const plano = []
  let anterior = null
  for (let li = 0; li < linhas.length; li++) {
    const l = linhas[li]
    const textos = l.map((p) => p.texto)
    const ini = l[0].ini, fim = Math.min(l[l.length - 1].fim + 0.35, linhas[li + 1] ? linhas[li + 1][0].ini : Infinity)
    if (fixa) {
      // lugar fixo: o topo da zona, na primeira coluna do formato; só confere que a linha cabe
      const nome = COLUNAS_DO_FORMATO[formato][0], alt = await desenho.medir(textos, COLUNAS[nome])
      if (zona.topo + alt > zona.base + 1e-6) throw new Error(`the line "${textos.join(' ')}" (${(alt * 100).toFixed(1)}% of the height) does not fit the zone ${zona.topo}–${zona.base}`)
      plano.push({ linha: li, textos, ini: r3(ini), fim: r3(fim), coluna: nome, topo: r3(zona.topo), altura: r3(alt), custo: 0, custoMedio: 0 })
      continue
    }
    const q = lerQuadros(video, W, H, { de: de + ini, ate: de + fim, fps: 4 })
    const qc = lerQuadros(video, W, H, { de: de + ini, ate: de + fim, fps: 8, cor: true })
    // cada coluna possível: a altura da linha naquela largura e a faixa mais quieta dela; vence a de menos detalhe
    let melhor = null
    for (const nome of COLUNAS_DO_FORMATO[formato]) {
      const col = COLUNAS[nome]
      const alt = await desenho.medir(textos, col)
      let e
      const ac = acentoPorLinha(qc, acento, col)
      try { e = escolherTopo(detalhePorLinha(q, col).map((v, y) => v + PESO_ACENTO * ac[y]), alt, zona, anterior && anterior.coluna === nome ? anterior.topo : null) } catch { continue }
      const custo = e.custo * (anterior && anterior.coluna === nome ? 1 : 1.25)   // sair da coluna anterior tem de valer a pena
      if (!melhor || custo < melhor.custo) melhor = { ...e, custo, coluna: nome, altura: alt }
    }
    if (!melhor) throw new Error(`the caption does not fit any column of the zone ${zona.topo}–${zona.base}`)
    anterior = melhor
    plano.push({ linha: li, textos, ini: r3(ini), fim: r3(fim), coluna: melhor.coluna, topo: r3(melhor.topo), altura: r3(melhor.altura), custo: r3(melhor.custo), custoMedio: r3(melhor.custoMedioDoQuadro) })
  }
  return { linhas, estados: sts, plano }
}

async function main() {
  const argv = process.argv.slice(2)
  const arg = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 ? argv[i + 1] : d }
  const flag = (k) => argv.includes('--' + k)
  const video = path.resolve(arg('video') || fail('missing --video'))
  const saida = path.resolve(arg('out') || fail('missing --out'))
  const legenda = flag('captions'), sons = flag('sounds')
  const info = probe(video)
  const de = +arg('from', 0), ate = +arg('to', info.duracao), dur = r3(ate - de)
  const recorte = arg('from') != null || arg('to') != null
  // a abertura com o logo (scripts/opening.mjs) pôs segundos antes do vídeo: a folha e a locução são de antes dela
  const abertura = aberturaDe(video)
  if (abertura && (legenda || sons)) console.log(`the video has the logo opening (+${abertura.toFixed(2)} s): the captions and the sounds move with it`)
  fs.mkdirSync(path.dirname(saida), { recursive: true })

  if (!legenda && !sons && !recorte) { fs.copyFileSync(video, saida); console.log(`✓ ${saida} (captions and sounds off: identical copy)`); return }

  const trabalho = fs.mkdtempSync(path.join(os.tmpdir(), 'legendar-'))
  const relatorio = { video, saida, de, ate, legenda, sons }
  const entradas = ['-ss', String(de), '-t', String(dur), '-i', video]
  let filtro = null, idxOverlay = null
  const extra = []

  if (legenda) {
    const loc = JSON.parse(fs.readFileSync(path.resolve(arg('narration') || fail('--captions needs --narration')), 'utf8'))
    const folha = JSON.parse(fs.readFileSync(path.resolve(arg('sheet') || fail('--captions needs --sheet')), 'utf8'))
    const serieDir = path.resolve(arg('series') || fail('--captions needs --series (the folder with series.json and brand.js)'))
    const roteiro = arg('script') && JSON.parse(fs.readFileSync(path.resolve(arg('script')), 'utf8'))
    const todas = semPiscar(escrita(palavrasDoVideo(loc, folha), (roteiro && roteiro.pronuncia) || {})).map((p) => ({ ...p, ini: r3(p.ini + abertura), fim: r3(p.fim + abertura) }))
    const palavras = todas.filter((p) => p.fim > de && p.ini < ate).map((p) => ({ ...p, ini: r3(p.ini - de), fim: r3(p.fim - de) }))
    const estilo = estiloDaMarca(serieDir)
    const desenho = await abrirDesenho(estilo, info.w, info.h, serieDir)
    try {
      const { linhas, estados: sts, plano } = await planejar({ video, de, ate, W: info.w, H: info.h, palavras, desenho, acento: estilo.acento, zona: arg('zone') && Object.fromEntries(arg('zone').split(',').map((v, i) => [['topo', 'base'][i], +v])), fixa: flag('fixed') })
      const lugarDe = new Map(plano.map((p) => [p.linha, p]))
      const partes = [], caixas = []
      const vazio = path.join(trabalho, 'vazio.png')
      ff(['-f', 'lavfi', '-i', `color=c=black@0:s=${info.w}x${info.h},format=rgba`, '-frames:v', '1', vazio])   // do tamanho do quadro: o concat toma o tamanho do 1º arquivo
      let t = 0
      const pe = (arq, d) => { if (d > 0.0005) partes.push(`file '${arq}'`, `duration ${d.toFixed(4)}`) }
      for (const [i, s] of sts.entries()) {
        pe(vazio, s.ini - t)
        const arq = path.join(trabalho, `e${String(i).padStart(4, '0')}.png`)
        const cx = await desenho.desenhar(arq, linhas[s.linha].map((p) => p.texto), s.palavra, lugarDe.get(s.linha).topo, COLUNAS[lugarDe.get(s.linha).coluna])
        caixas.push({ ...s, caixa: cx[cx.length - 1] })
        pe(arq, s.fim - s.ini)
        t = s.fim
      }
      pe(vazio, Math.max(0.1, dur - t + 0.5))
      // o concat pede o último arquivo repetido, senão corta a duração dele
      partes.push(partes[partes.length - 2])
      fs.writeFileSync(path.join(trabalho, 'lista.txt'), partes.join('\n') + '\n')
      relatorio.acento = [1, 3, 5].map((i) => parseInt(estilo.acento.slice(i, i + 2), 16))
      relatorio.plano = plano
      relatorio.estados = caixas
      // a camada vira um vídeo com alfa a quadro constante antes de ir por cima: o concat de imagens sozinho perde quadros no overlay
      const camada = path.join(trabalho, 'camada.mov')
      ff(['-f', 'concat', '-safe', '0', '-i', path.join(trabalho, 'lista.txt'), '-vf', `fps=${info.fps},format=rgba`, '-t', String(dur), '-c:v', 'png', '-fps_mode', 'cfr', camada])
      entradas.push('-i', camada)
      idxOverlay = 1
      filtro = `[0:v][${idxOverlay}:v]overlay=0:0:format=auto:eof_action=pass[v]`
    } finally { await desenho.fechar() }
  }

  // áudio: a faixa do vídeo (ou --audio) e, com --sounds, os efeitos por cima, no mesmo volume
  let audioArgs = ['-map', '0:a?', '-c:a', 'copy']
  if (sons) {
    const folha = arg('sheet') && JSON.parse(fs.readFileSync(path.resolve(arg('sheet')), 'utf8'))
    const cues = (arg('cues') ? JSON.parse(fs.readFileSync(path.resolve(arg('cues')), 'utf8')) : cuesDaFolha(folha || fail('--sounds needs --cues or --sheet'))).map((c) => ({ ...c, t: r3(c.t + abertura) }))
    const base = path.join(trabalho, 'base.wav')
    ff(arg('audio') ? ['-ss', String(de), '-t', String(dur), '-i', path.resolve(arg('audio')), '-ar', '48000', '-ac', '2', '-c:a', 'pcm_f32le', base]
      : ['-ss', String(de), '-t', String(dur), '-i', video, '-vn', '-ar', '48000', '-ac', '2', '-c:a', 'pcm_f32le', base])
    const noJanela = cues.filter((c) => c.t >= de && c.t < ate).map((c) => ({ ...c, t: r3(c.t - de) }))
    const trechos = ((folha && folha.voz && folha.voz.trechos) || []).map(([a, b]) => [a + abertura - de, b + abertura - de]).filter(([a, b]) => b > 0 && a < dur)
    const teto = (folha && folha.teto_dbtp) ?? -1.0
    const r = somarSons({ base, cues: noJanela, duracao: dur, trechos, teto, trabalho, semente: +arg('seed', 7), python: arg('python') })
    relatorio.sons = r
    extra.push('-i', r.mix)
    audioArgs = ['-map', `${entradas.filter((x) => x === '-i').length}:a`, '-c:a', 'aac', '-b:a', '320k', '-ar', '48000']
  } else if (recorte) audioArgs = ['-map', '0:a?', '-c:a', 'aac', '-b:a', '320k', '-ar', '48000']

  const args = [...entradas, ...extra]
  if (filtro) args.push('-filter_complex', filtro, '-map', '[v]')
  else args.push('-map', '0:v')
  args.push('-c:v', 'libx264', '-crf', '16', '-preset', 'medium', '-pix_fmt', info.pix || 'yuv420p', '-r', String(info.fps), ...audioArgs, '-t', String(dur), '-movflags', '+faststart', saida)
  ff(args)
  if (arg('report')) fs.writeFileSync(path.resolve(arg('report')), JSON.stringify(relatorio, null, 1))
  console.log(`✓ ${saida} (${dur.toFixed(2)} s${legenda ? ` · captions: ${relatorio.estados.length} words in ${relatorio.plano.length} lines` : ''}${sons ? ` · sounds: ${relatorio.sons.cues} · mix ${relatorio.sons.depois.I} LUFS (before ${relatorio.sons.antes.I})` : ''})`)
  if (!process.env.CAPTION_KEEP_WORK) fs.rmSync(trabalho, { recursive: true, force: true })
}
function fail(m) { console.error('✗ ' + m); process.exit(1) }
if (process.argv[1] && fs.realpathSync(process.argv[1]) === fs.realpathSync(fileURLToPath(import.meta.url))) main().catch((e) => { console.error('✗ ' + e.message); process.exit(1) })
