#!/usr/bin/env node
// play: entende um arquivo de áudio ou de vídeo. Diz o que é dito (transcrição pela OpenAI, com o tempo de cada trecho)
// e, se for vídeo, o que aparece (quadros espaçados por igual, montados em folhas de contato).
//
//   node play.mjs <arquivo> [--modelo <id>] [--idioma pt] [--quadros N] [--refazer] [--longo] [--json]
//   node play.mjs quadro <arquivo> --em <tempo> [--recorte X,Y,L,A]   um quadro em resolução cheia (recorte em % do quadro)
//   node play.mjs limpar [<arquivo>]                                  apaga o cache: todo, ou só o do arquivo
//
// O caminho vem como a pessoa colou: com aspas, espaço escapado, ~, file:// ou caminho do Windows, e pode vir partido
// em vários argumentos. O resultado fica em cache por arquivo (caminho, tamanho e data): o mesmo arquivo de novo não
// chama a API. Acima de 30 min ele para antes de mandar qualquer coisa e pede --longo.
// A chave: OPENAI_API_KEY, ou a linha OPENAI_API_KEY=… em ~/.claude/secrets/openai.env; nunca é impressa.
// OPENAI_API_BASE troca o endereço da API e PLAY_LIMITE_BYTES o tamanho máximo de cada parte (os testes usam os dois).
// Saída: 0 ok, 1 outra falha, 2 uso errado, 3 OpenAI indisponível agora (sem chave, chave recusada, sem crédito),
// 4 arquivo que não existe ou não é áudio nem vídeo, 5 arquivo longo (confirmar com a pessoa e rodar com --longo).
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import crypto from 'node:crypto'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { fileURLToPath } from 'node:url'
import { lerChave, passosDaChave, comoInstalarFfmpeg, arquivoDaChaveMostrado } from './requisitos.mjs'

export const MODELO_PADRAO = 'gpt-4o-transcribe-diarize'
export const LIMITE_LONGO_SEG = 30 * 60
export const PARTE_MAX_SEG = 20 * 60 // os gpt-4o-*-transcribe recusam pedido longo demais (o limite exato não foi medido)
const LIMITE_BYTES = 24 * 1024 * 1024 // a API recusa arquivo acima de 25 MB
export const LADO_MAX_FOLHA = 2000
export const POR_FOLHA_MAX = 9
const VAO = 8
const FUNDO = '0x202020'

const USO = `uso: node play.mjs <arquivo> [--modelo <id>] [--idioma pt] [--quadros N] [--refazer] [--longo] [--json]
     node play.mjs quadro <arquivo> --em <mm:ss> [--recorte X,Y,L,A]
     node play.mjs limpar [<arquivo>]`

export class Falha extends Error {
  constructor(msg, code = 1) { super(msg); this.code = code }
}

const execFileP = promisify(execFile)
const lerJson = (f) => { try { return JSON.parse(fs.readFileSync(f, 'utf8')) } catch { return null } }
function gravarJson(f, dados) {
  const tmp = `${f}.${process.pid}.tmp`
  fs.writeFileSync(tmp, JSON.stringify(dados, null, 2))
  fs.renameSync(tmp, f)
}

// ── tempo ──────────────────────────────────────────────────────────────────────────────────────────────────────────
const dois = (n) => String(n).padStart(2, '0')
/** [mm:ss] da transcrição: os minutos passam de 59 em arquivo de mais de uma hora. */
export const mmss = (s) => { const t = Math.max(0, Math.floor(s + 1e-6)); return `${dois(Math.floor(t / 60))}:${dois(t % 60)}` }
/** A duração para gente: 0:15, 3:12, 1:02:33. */
export function duracaoTexto(s) {
  const t = Math.max(0, Math.round(s))
  const h = Math.floor(t / 3600), m = Math.floor((t % 3600) / 60), seg = t % 60
  return h ? `${h}:${dois(m)}:${dois(seg)}` : `${m}:${dois(seg)}`
}
/** "83", "83.5", "1:23", "01:23.5", "1:02:03" e "[01:23]" (copiado da transcrição) → segundos. */
export function lerTempo(v) {
  const s = String(v ?? '').trim().replace(/^\[(.*)\]$/, '$1').replace(',', '.')
  if (!/^\d+(\.\d+)?$|^\d+:\d{1,2}(\.\d+)?$|^\d+:\d{1,2}:\d{1,2}(\.\d+)?$/.test(s)) {
    throw new Falha(`tempo que não entendi: "${v}". Use segundos (83) ou mm:ss (01:23).`, 2)
  }
  return s.split(':').reduce((acc, p) => acc * 60 + Number(p), 0)
}

// ── o caminho colado ───────────────────────────────────────────────────────────────────────────────────────────────
/** As leituras possíveis do caminho como a pessoa colou, da mais literal para a mais tratada. */
export function candidatosDoCaminho(bruto, { home = os.homedir() } = {}) {
  let s = String(bruto ?? '').replace(/^﻿/, '').trim()
  if (s.length >= 2 && `'"‘“`.includes(s[0]) && `'"’”`.includes(s.at(-1))) s = s.slice(1, -1).trim()
  if (/^file:\/\//i.test(s)) {
    try { s = fileURLToPath(s) } catch { s = decodeURIComponent(s.replace(/^file:\/\/(localhost)?/i, '')) }
  }
  const lista = [s]
  // No Mac o Terminal cola o espaço como "\ " (e parênteses, aspas, & com barra também). No Windows a barra é separador.
  const doWindows = /^[A-Za-z]:[\\/]/.test(s) || s.startsWith('\\\\')
  if (!doWindows && s.includes('\\')) lista.push(s.replace(/\\(.)/g, '$1'))
  return [...new Set(lista.map((c) => (c === '~' ? home : /^~[\\/]/.test(c) ? path.join(home, c.slice(2)) : c)))]
}

/** O caminho absoluto do arquivo que existe, ou null. */
export function resolverCaminho(bruto, opcoes) {
  for (const c of candidatosDoCaminho(bruto, opcoes)) if (c && fs.existsSync(c)) return path.resolve(c)
  return null
}

function arquivoDe(bruto) {
  if (!String(bruto ?? '').trim()) throw new Falha(`falta o caminho do arquivo.\n${USO}`, 2)
  const abs = resolverCaminho(bruto)
  if (!abs) {
    const c = candidatosDoCaminho(bruto).at(-1)
    throw new Falha(`Não achei o arquivo ${c}. Confira o caminho; se ele tem espaço, passe entre aspas simples: '${c}'.`, 4)
  }
  if (fs.statSync(abs).isDirectory()) throw new Falha(`${abs} é uma pasta. Passe o caminho de um arquivo de áudio ou de vídeo.`, 4)
  return abs
}

// ── ffmpeg ─────────────────────────────────────────────────────────────────────────────────────────────────────────
async function rodar(programa, args) {
  try {
    return await execFileP(programa, args, { maxBuffer: 256 << 20, windowsHide: true })
  } catch (e) {
    if (e.code === 'ENOENT') throw new Falha(`Não achei o ${programa} nesta máquina: a play precisa dele para ler o arquivo.\n${comoInstalarFfmpeg().join('\n')}`, 1)
    throw e
  }
}
const ultimaLinha = (e) => String(e?.stderr ?? e?.message ?? '').trim().split(/\r?\n/).filter(Boolean).at(-1) ?? ''

/** O que é o arquivo: tipo, duração, resolução como aparece na tela, e quais faixas usar. */
export async function sondar(abs) {
  const nome = path.basename(abs)
  let saida
  try {
    saida = (await rodar('ffprobe', ['-v', 'error', '-show_format', '-show_streams', '-of', 'json', abs])).stdout
  } catch (e) {
    if (e instanceof Falha) throw e
    throw new Falha(`${nome} não é áudio nem vídeo: o ffprobe não reconheceu (${ultimaLinha(e)}). Confira se é o arquivo certo.`, 4)
  }
  const j = JSON.parse(saida || '{}')
  const faixas = j.streams ?? []
  const formato = String(j.format?.format_name ?? '')
  const audio = faixas.find((f) => f.codec_type === 'audio')
  // capa embutida (mp3, m4a) aparece como faixa de vídeo marcada attached_pic: não é vídeo
  const video = faixas.find((f) => f.codec_type === 'video' && !f.disposition?.attached_pic)
  if (video && !audio && (/(^|,)image2$|_pipe$/.test(formato) || formato === 'webp')) {
    throw new Falha(`${nome} é uma imagem, não áudio nem vídeo: abra direto com a ferramenta de ler imagem.`, 4)
  }
  if (!audio && !video) throw new Falha(`${nome} não tem áudio nem vídeo dentro. Confira se é o arquivo certo.`, 4)
  const num = (v) => (Number.isFinite(Number(v)) && Number(v) > 0 ? Number(v) : 0)
  const duracao = num(j.format?.duration) || Math.max(0, ...faixas.map((f) => num(f.duration)))
  if (!duracao) throw new Falha(`não consegui ler a duração de ${nome}: o arquivo pode estar incompleto ou corrompido.`, 4)
  const info = {
    arquivo: abs, nome, duracao,
    tipo: video ? (audio ? 'video-com-audio' : 'video-sem-audio') : 'audio',
    temAudio: Boolean(audio), temVideo: Boolean(video),
    faixaAudio: audio?.index ?? null, faixaVideo: video?.index ?? null,
    codecAudio: audio?.codec_name ?? null, taxaAudio: num(audio?.sample_rate),
    duracaoAudio: num(audio?.duration) || duracao,
    largura: null, altura: null, quadrosNoVideo: null,
  }
  if (video) {
    let w = video.width, h = video.height
    const sar = /^(\d+):(\d+)$/.exec(video.sample_aspect_ratio ?? '')
    if (sar && +sar[1] && +sar[2] && sar[1] !== sar[2]) w = Math.round((w * +sar[1]) / +sar[2])
    const giro = Number(video.side_data_list?.find((d) => d.rotation != null)?.rotation ?? video.tags?.rotate ?? 0)
    if (Math.abs(giro) % 180 === 90) [w, h] = [h, w]
    info.largura = w
    info.altura = h
    info.quadrosNoVideo = num(video.nb_frames) || null
  }
  return info
}

export function linhaDoArquivo(i) {
  const tipo = { audio: 'áudio', 'video-com-audio': 'vídeo com áudio', 'video-sem-audio': 'vídeo sem áudio' }[i.tipo]
  const partes = [i.nome, tipo, duracaoTexto(i.duracao)]
  if (i.temVideo) partes.push(`${i.largura}×${i.altura}, ${i.largura > i.altura ? 'horizontal' : i.largura < i.altura ? 'vertical' : 'quadrado'}`)
  return partes.join(' · ')
}

// ── cache ──────────────────────────────────────────────────────────────────────────────────────────────────────────
export function pastaCache() {
  if (process.platform === 'win32' && process.env.LOCALAPPDATA) return path.join(process.env.LOCALAPPDATA, 'play')
  if (process.platform === 'darwin') return path.join(os.homedir(), 'Library', 'Caches', 'play')
  return path.join(os.homedir(), '.cache', 'play')
}

function pastaDoArquivo(abs) {
  const st = fs.statSync(abs)
  const marca = crypto.createHash('sha256').update(`${abs}\n${st.size}\n${Math.round(st.mtimeMs)}`).digest('hex').slice(0, 16)
  return path.join(pastaCache(), `${path.basename(abs).replace(/[^\w.-]+/g, '-').slice(0, 40)}-${marca}`)
}

// ── transcrição ────────────────────────────────────────────────────────────────────────────────────────────────────
/** O formato de resposta que dá o tempo de cada trecho em cada modelo (testado em 12/10/2026). */
export function formatoDoModelo(modelo) {
  if (/diarize/.test(modelo)) return 'diarized_json' // trechos com início, fim e quem fala
  if (/^whisper/.test(modelo)) return 'verbose_json' // trechos com início e fim
  return 'json' // gpt-transcribe, gpt-4o-transcribe e gpt-4o-mini-transcribe: só o texto
}

/** Os trechos de silêncio que o silencedetect achou: é neles que um arquivo grande é partido. */
export function lerPausas(stderr, duracao) {
  const pausas = []
  let ini = null
  for (const l of String(stderr).split(/\r?\n/)) {
    let m
    if ((m = /silence_start:\s*(-?[\d.]+)/.exec(l))) ini = Math.max(0, Number(m[1]))
    else if ((m = /silence_end:\s*([\d.]+)/.exec(l)) && ini != null) { pausas.push({ inicio: ini, fim: Number(m[1]) }); ini = null }
  }
  if (ini != null) pausas.push({ inicio: ini, fim: duracao })
  return pausas
}

/** Onde partir o áudio para cada parte caber no limite da API: no meio de uma pausa perto do limite, se houver. */
export function planejarPartes(duracao, bytes, pausas, { limiteBytes = LIMITE_BYTES, maxSeg = PARTE_MAX_SEG } = {}) {
  if (bytes <= limiteBytes && duracao <= maxSeg) return [{ inicio: 0, fim: duracao }]
  const porSeg = bytes / duracao
  const L = Math.max(1, Math.min(maxSeg, Math.floor((limiteBytes * 0.95) / porSeg)))
  const meios = pausas.map((p) => (p.inicio + p.fim) / 2)
  const partes = []
  let ini = 0
  while (duracao - ini > L) {
    const perto = meios.filter((m) => m > ini + L * 0.6 && m <= ini + L)
    const corte = perto.length ? perto.at(-1) : ini + L
    partes.push({ inicio: ini, fim: corte })
    ini = corte
  }
  partes.push({ inicio: ini, fim: duracao })
  return partes
}

/** A resposta da API → trechos com o tempo do arquivo inteiro (a parte começa em parte.inicio). */
export function trechosDaResposta(j, parte) {
  const segs = Array.isArray(j?.segments) ? j.segments : []
  if (segs.length) {
    return segs
      .map((s) => ({ inicio: parte.inicio + Number(s.start || 0), fim: parte.inicio + Number(s.end || 0), texto: String(s.text ?? '').trim(), falante: s.speaker ?? null }))
      .filter((t) => t.texto)
  }
  const texto = String(j?.text ?? '').trim()
  return texto ? [{ inicio: parte.inicio, fim: parte.fim, texto, falante: null }] : []
}

/** Junta os trechos curtos numa linha por frase, sem misturar quem fala. */
export function juntarLinhas(trechos) {
  const linhas = []
  for (const t of trechos) {
    const u = linhas.at(-1)
    if (u && u.falante === t.falante && u.texto.length + t.texto.length < 300) {
      const vao = t.inicio - u.fim
      const fechada = /[.?!…]["'”»)]?$/.test(u.texto)
      if ((!fechada && vao <= 2) || (fechada && u.texto.length < 40 && vao < 1)) {
        u.texto += ` ${t.texto}`
        u.fim = t.fim
        continue
      }
    }
    linhas.push({ ...t })
  }
  return linhas
}

const base = () => String(process.env.OPENAI_API_BASE || 'https://api.openai.com').replace(/\/+$/, '').replace(/\/v1$/, '')
/** Tira a chave (e o que tiver cara de chave) de um texto antes de mostrar. */
function semChave(texto, chave) {
  let t = String(texto ?? '')
  if (chave) t = t.split(chave).join('[chave]')
  return t.replace(/\bsk-[A-Za-z0-9_*.-]{4,}/g, '[chave]')
}
const espera = (ms) => new Promise((r) => setTimeout(r, ms))

async function pedirTranscricao(chave, arquivo, { modelo, idioma }) {
  const formato = formatoDoModelo(modelo)
  for (let tentativa = 1; ; tentativa++) {
    const corpo = new FormData()
    const tipo = TIPO_MIME[path.extname(arquivo).slice(1)] ?? 'application/octet-stream'
    corpo.append('file', new Blob([fs.readFileSync(arquivo)], { type: tipo }), path.basename(arquivo))
    corpo.append('model', modelo)
    corpo.append('response_format', formato)
    if (formato === 'diarized_json') corpo.append('chunking_strategy', 'auto')
    if (formato === 'verbose_json') corpo.append('timestamp_granularities[]', 'segment')
    if (idioma) corpo.append('language', idioma)
    let r
    try {
      r = await fetch(`${base()}/v1/audio/transcriptions`, {
        method: 'POST', headers: { authorization: `Bearer ${chave}` }, body: corpo, signal: AbortSignal.timeout(15 * 60_000),
      })
    } catch (e) {
      if (tentativa < 3) { await espera(2000 * tentativa); continue }
      throw new Falha(`Não consegui falar com a API da OpenAI (${semChave(e.cause?.message ?? e.message, chave)}). Confira a internet e tente de novo.`, 1)
    }
    const texto = await r.text()
    let j = {}
    try { j = JSON.parse(texto) } catch {}
    if (r.ok) return j
    const msg = semChave(j?.error?.message ?? `HTTP ${r.status}`, chave)
    const codigo = String(j?.error?.code ?? j?.error?.type ?? '')
    if (r.status === 401) {
      throw new Falha(`A OpenAI recusou a chave (401: ${msg}). Crie outra em platform.openai.com, em "API keys", e troque a linha OPENAI_API_KEY=… no arquivo ${arquivoDaChaveMostrado()} (ou a variável OPENAI_API_KEY).`, 3)
    }
    if (/insufficient_quota|billing/i.test(`${codigo} ${msg}`)) {
      throw new Falha(`A conta da API da OpenAI está sem crédito (${msg}). Ponha crédito em platform.openai.com, em "Billing": a API é paga por uso e é separada da assinatura do ChatGPT.`, 3)
    }
    if ((r.status === 429 || r.status >= 500) && tentativa < 3) { await espera(3000 * tentativa); continue }
    if (/model/i.test(`${codigo} ${msg}`) && r.status < 500) {
      throw new Falha(`A OpenAI não aceitou o modelo ${modelo} (${r.status}: ${msg}). Rode sem --modelo para usar o ${MODELO_PADRAO}.`, 1)
    }
    throw new Falha(`A OpenAI respondeu ${r.status}: ${msg}`, 1)
  }
}

async function emParalelo(tarefas, n) {
  const res = new Array(tarefas.length)
  let i = 0
  await Promise.all(Array.from({ length: Math.min(n, tarefas.length) }, async () => {
    while (i < tarefas.length) { const k = i++; res[k] = await tarefas[k]() }
  }))
  return res
}

// O áudio vai como está quando a API aceita o formato, só trocando o contêiner. Comprimir de novo piora a transcrição:
// em 12/10/2026 um áudio .opus convertido para mp3 de 16 kHz voltou com duas palavras trocadas, e o original veio certo.
// O que a API não aceita vira FLAC mono, que não perde nada.
const COPIA = { opus: 'ogg', vorbis: 'ogg', aac: 'm4a', mp3: 'mp3', flac: 'flac' }
const TIPO_MIME = { ogg: 'audio/ogg', m4a: 'audio/mp4', mp3: 'audio/mpeg', flac: 'audio/flac' }
export const extensaoDoAudio = (codec) => COPIA[codec] ?? 'flac'

/** Tira a faixa de áudio para mandar (sem os metadados do arquivo, como a localização) e, se pedir, acha as pausas. */
async function extrairAudio(info, saida, { inicio = null, dur = null, pausas = false } = {}) {
  const args = ['-nostdin', '-hide_banner', '-nostats', '-y']
  if (inicio != null) args.push('-ss', inicio.toFixed(3), '-t', dur.toFixed(3))
  args.push('-i', info.arquivo, '-map', `0:${info.faixaAudio}`, '-vn', '-map_metadata', '-1')
  if (COPIA[info.codecAudio]) args.push('-c:a', 'copy')
  else args.push('-ac', '1', '-ar', String(Math.min(info.taxaAudio || 48000, 48000)), '-c:a', 'flac')
  args.push(saida)
  if (pausas) args.push('-map', `0:${info.faixaAudio}`, '-af', 'silencedetect=noise=-35dB:d=0.4', '-f', 'null', '-')
  try {
    return (await rodar('ffmpeg', args)).stderr
  } catch (e) {
    if (e instanceof Falha) throw e
    throw new Falha(`O ffmpeg não conseguiu ler o áudio de ${info.nome} (${ultimaLinha(e)}).`, 1)
  }
}

async function transcrever(info, dir, op) {
  const arq = path.join(dir, `transcricao-${op.modelo.replace(/[^\w.-]+/g, '-')}-${op.idioma ?? 'auto'}.json`)
  const guardada = op.refazer ? null : lerJson(arq)
  if (guardada) return { ...guardada, do_cache: true }

  const chave = lerChave()
  if (!chave) throw new Falha(`Sem a chave da OpenAI não dá para transcrever o que é dito.\n${passosDaChave().join('\n')}`, 3)
  if (info.duracao > LIMITE_LONGO_SEG && !op.longo) {
    throw new Falha(`${info.nome} tem ${duracaoTexto(info.duracao)}. Acima de ${LIMITE_LONGO_SEG / 60} min eu paro antes de mandar o áudio para a OpenAI, que cobra pela duração: confirme com a pessoa e rode de novo com --longo.`, 5)
  }

  const tmp = fs.mkdtempSync(path.join(dir, 'audio-'))
  try {
    const ext = extensaoDoAudio(info.codecAudio)
    const inteiro = path.join(tmp, `audio.${ext}`)
    const stderr = await extrairAudio(info, inteiro, { pausas: true })
    const limiteBytes = Number(process.env.PLAY_LIMITE_BYTES) || LIMITE_BYTES
    const partes = planejarPartes(info.duracaoAudio, fs.statSync(inteiro).size, lerPausas(stderr, info.duracaoAudio), { limiteBytes })
    const arquivos = partes.length === 1 ? [inteiro] : await emParalelo(partes.map((p, i) => async () => {
      const f = path.join(tmp, `parte-${i + 1}.${ext}`)
      await extrairAudio(info, f, { inicio: p.inicio, dur: p.fim - p.inicio })
      return f
    }), 3)
    const respostas = await emParalelo(arquivos.map((f) => () => pedirTranscricao(chave.valor, f, op)), 3)
    const t = {
      modelo: op.modelo,
      idioma: op.idioma,
      idioma_detectado: respostas[0]?.language ?? respostas[0]?.languages?.[0]?.code ?? null,
      com_tempos: formatoDoModelo(op.modelo) !== 'json',
      partes: partes.length,
      enviado_seg: +partes.reduce((s, p) => s + p.fim - p.inicio, 0).toFixed(2),
      trechos: respostas.flatMap((j, i) => trechosDaResposta(j, partes[i])).map((x) => ({ ...x, inicio: +x.inicio.toFixed(2), fim: +x.fim.toFixed(2) })),
    }
    gravarJson(arq, t)
    return { ...t, do_cache: false }
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true })
  }
}

// ── quadros ────────────────────────────────────────────────────────────────────────────────────────────────────────
/** Um quadro a cada 5 s, entre 6 e 24. */
export const quantosQuadros = (duracao) => Math.min(24, Math.max(6, Math.ceil(duracao / 5)))
/** Espaçados por igual, cada um no meio do seu pedaço do vídeo (nem o primeiro quadro, que costuma ser preto, nem o fim). */
export const temposDosQuadros = (duracao, n) => Array.from({ length: n }, (_, i) => +((duracao * (i + 0.5)) / n).toFixed(3))

/** A grade de uma folha com k quadros no formato do vídeo: a de célula maior que caiba em LADO_MAX_FOLHA. */
export function gradeDaFolha(k, aspecto, { lado = LADO_MAX_FOLHA, vao = VAO, maxLargura = Infinity } = {}) {
  let melhor = null
  for (let cols = 1; cols <= k; cols++) {
    const rows = Math.ceil(k / cols)
    const w = Math.min((lado - vao * (cols + 1)) / cols, ((lado - vao * (rows + 1)) / rows) * aspecto)
    const vazias = cols * rows - k
    if (!melhor || w > melhor.w + 1 || (w > melhor.w - 1 && vazias < melhor.vazias)) melhor = { cols, rows, w, vazias }
  }
  const largura = Math.max(2, Math.floor(Math.min(melhor.w, maxLargura) / 2) * 2)
  const altura = Math.max(2, Math.floor(largura / aspecto / 2) * 2)
  return { cols: melhor.cols, rows: melhor.rows, largura, altura }
}

async function extrairQuadro(info, t, saida, filtro) {
  for (const tt of [t, Math.max(0, t - 1), 0]) {
    const args = ['-nostdin', '-v', 'error', '-y', '-ss', tt.toFixed(3), '-i', info.arquivo, '-map', `0:${info.faixaVideo}`, '-frames:v', '1']
    if (filtro) args.push('-vf', filtro)
    args.push('-q:v', filtro?.startsWith('scale') ? '3' : '2', '-update', '1', saida)
    try { await rodar('ffmpeg', args) } catch (e) {
      if (e instanceof Falha) throw e
      throw new Falha(`O ffmpeg não conseguiu tirar o quadro em ${mmss(tt)} de ${info.nome} (${ultimaLinha(e)}).`, 1)
    }
    if (fs.existsSync(saida)) return
  }
  throw new Falha(`O ffmpeg não achou imagem em ${mmss(t)} de ${info.nome}.`, 1)
}

const tempoDaCelula = (s, fino) => (fino ? `${mmss(s)}.${Math.floor((s % 1) * 10 + 1e-6)}` : mmss(s))
/** Os tempos de uma folha em ordem de leitura, uma fileira por vez: "00:02 · 00:07 · 00:12 / 00:17 · …". */
export function legendaDaFolha(f) {
  const [cols] = f.grade.split('x').map(Number)
  const fino = f.tempos.length > 1 && f.tempos[1] - f.tempos[0] < 2
  const fileiras = []
  for (let i = 0; i < f.tempos.length; i += cols) fileiras.push(f.tempos.slice(i, i + cols).map((t) => tempoDaCelula(t, fino)).join(' · '))
  return fileiras.join(' / ')
}

async function folhasDeContato(info, dir, op) {
  let n = op.quadros ?? quantosQuadros(info.duracao)
  if (info.quadrosNoVideo) n = Math.min(n, info.quadrosNoVideo)
  const pasta = path.join(dir, `folhas-${n}`)
  const indice = path.join(pasta, 'folhas.json')
  const guardadas = op.refazer ? null : lerJson(indice)
  if (guardadas?.folhas?.every((f) => fs.existsSync(f.arquivo))) return guardadas.folhas

  fs.rmSync(pasta, { recursive: true, force: true })
  fs.mkdirSync(pasta, { recursive: true })
  const tempos = temposDosQuadros(info.duracao, n)
  const quantas = Math.ceil(n / POR_FOLHA_MAX)
  const por = Math.ceil(n / quantas)
  const folhas = []
  for (let k = 0; k < quantas; k++) {
    const ts = tempos.slice(k * por, (k + 1) * por)
    const g = gradeDaFolha(ts.length, info.largura / info.altura, { maxLargura: info.largura })
    const sub = path.join(pasta, `q${k + 1}`)
    fs.mkdirSync(sub)
    const filtro = `scale=${g.largura}:${g.altura}:force_original_aspect_ratio=decrease,pad=${g.largura}:${g.altura}:(ow-iw)/2:(oh-ih)/2:color=${FUNDO},setsar=1`
    await emParalelo(ts.map((t, i) => () => extrairQuadro(info, t, path.join(sub, `q${String(i + 1).padStart(3, '0')}.jpg`), filtro)), 4)
    const arquivo = path.join(pasta, `folha-${k + 1}.jpg`)
    try {
      await rodar('ffmpeg', ['-nostdin', '-v', 'error', '-y', '-framerate', '1', '-i', path.join(sub, 'q%03d.jpg'),
        '-vf', `tile=${g.cols}x${g.rows}:margin=${VAO}:padding=${VAO}:color=${FUNDO}`, '-frames:v', '1', '-q:v', '3', '-update', '1', arquivo])
    } catch (e) {
      if (e instanceof Falha) throw e
      throw new Falha(`O ffmpeg não conseguiu montar a folha de contato (${ultimaLinha(e)}).`, 1)
    }
    fs.rmSync(sub, { recursive: true, force: true })
    folhas.push({ arquivo, grade: `${g.cols}x${g.rows}`, celula: `${g.largura}x${g.altura}`, tempos: ts })
  }
  gravarJson(indice, { quadros: n, folhas })
  return folhas
}

// ── comandos ───────────────────────────────────────────────────────────────────────────────────────────────────────
export async function analisar(abs, op) {
  const info = await sondar(abs)
  const dir = pastaDoArquivo(abs)
  fs.mkdirSync(dir, { recursive: true })
  gravarJson(path.join(dir, 'arquivo.json'), { arquivo: abs })
  const r = {
    arquivo: abs, nome: info.nome, tipo: info.tipo, duracao_seg: +info.duracao.toFixed(2),
    largura: info.largura, altura: info.altura, tem_audio: info.temAudio, tem_video: info.temVideo,
    transcricao: null, folhas: [], cache: dir, erro: null,
  }
  // primeiro o que é de graça e fica na máquina: se a transcrição não der, os quadros já estão lá
  if (info.temVideo) r.folhas = await folhasDeContato(info, dir, op)
  if (info.temAudio) {
    try {
      r.transcricao = await transcrever(info, dir, op)
    } catch (e) {
      if (!(e instanceof Falha)) throw e
      r.erro = { codigo: e.code, mensagem: e.message }
    }
  }
  return { r, info }
}

const aspas = (s) => (process.platform === 'win32' ? `'${s.replace(/'/g, "''")}'` : `'${s.replace(/'/g, `'\\''`)}'`)

export function relatorio(r, info, script) {
  const L = [linhaDoArquivo(info)]
  const t = r.transcricao
  if (!r.tem_audio) L.push('', 'O que é dito: nada, o arquivo não tem áudio.')
  else if (!t) L.push('', 'O que é dito: não transcrevi (o motivo vem no fim).')
  else {
    const falantes = new Set(t.trechos.map((x) => x.falante).filter(Boolean))
    const sobre = [t.modelo]
    if (t.idioma) sobre.push(`idioma ${t.idioma}`)
    else if (t.idioma_detectado) sobre.push(`idioma detectado: ${t.idioma_detectado}`)
    if (falantes.size > 1) sobre.push(`${falantes.size} vozes`)
    sobre.push(t.do_cache ? 'do cache, nada foi enviado agora' : `${duracaoTexto(t.enviado_seg)} de áudio enviados à OpenAI${t.partes > 1 ? ` em ${t.partes} partes` : ''}`)
    L.push('', `O que é dito (${sobre.join('; ')}):`)
    const linhas = juntarLinhas(t.trechos)
    if (!linhas.length) L.push('(nenhuma fala reconhecida: pode ser música, ruído ou silêncio)')
    for (const l of linhas) L.push(`[${mmss(l.inicio)}] ${falantes.size > 1 && l.falante ? `${l.falante}: ` : ''}${l.texto}`)
    if (!t.com_tempos) L.push(`(o ${t.modelo} não devolve o tempo de cada trecho: o tempo é o do começo de cada parte)`)
    if (t.partes > 1 && falantes.size > 1) L.push(`(as letras de quem fala valem dentro de cada parte de até ${PARTE_MAX_SEG / 60} min: de uma parte para outra, a mesma pessoa pode mudar de letra)`)
  }
  if (r.folhas.length) {
    const n = r.folhas.reduce((s, f) => s + f.tempos.length, 0)
    L.push('', `O que aparece: ${n} quadros em ${r.folhas.length === 1 ? '1 folha' : `${r.folhas.length} folhas`} de contato. Abra cada folha com a ferramenta de ler imagem; os tempos vão em ordem de leitura (da esquerda para a direita, e as fileiras de cima para baixo, separadas por /):`)
    for (const f of r.folhas) L.push(`${f.arquivo}  (${f.grade.replace('x', '×')}): ${legendaDaFolha(f)}`)
    L.push('', `Um quadro em resolução cheia: node ${aspas(script)} quadro ${aspas(r.arquivo)} --em <mm:ss>`)
  }
  return L.join('\n')
}

export function lerRecorte(v) {
  const n = String(v).split(',').map((x) => Number(x.trim()))
  const [x, y, l, a] = n
  if (n.length !== 4 || n.some((k) => !Number.isFinite(k) || k < 0 || k > 100) || l <= 0 || a <= 0 || x + l > 100 || y + a > 100) {
    throw new Falha(`recorte que não entendi: "${v}". São quatro números em % do quadro: esquerda, topo, largura, altura (0,0,100,33 é o terço de cima).`, 2)
  }
  return n
}

async function quadro(abs, op, script) {
  if (op.em == null) throw new Falha(`falta --em <tempo>: em que ponto do vídeo (01:23, ou 83 em segundos).\n${USO}`, 2)
  const t = lerTempo(op.em)
  const recorte = op.recorte != null ? lerRecorte(op.recorte) : null
  const info = await sondar(abs)
  if (!info.temVideo) throw new Falha(`${info.nome} é só áudio: não tem imagem.`, 4)
  if (t > info.duracao) throw new Falha(`${info.nome} tem ${duracaoTexto(info.duracao)}: peça um tempo até ${mmss(info.duracao)}.`, 2)
  const pasta = path.join(pastaDoArquivo(abs), 'quadros')
  fs.mkdirSync(pasta, { recursive: true })
  const saida = path.join(pasta, `quadro-${t.toFixed(1).replace('.', '_')}s${recorte ? `-recorte-${recorte.join('-')}` : ''}.jpg`)
  const filtro = recorte
    ? `crop=trunc(iw*${recorte[2] / 100}/2)*2:trunc(ih*${recorte[3] / 100}/2)*2:trunc(iw*${recorte[0] / 100}):trunc(ih*${recorte[1] / 100})`
    : null
  if (op.refazer || !fs.existsSync(saida)) await extrairQuadro(info, t, saida, filtro)
  const dim = (await rodar('ffprobe', ['-v', 'error', '-show_entries', 'stream=width,height', '-of', 'csv=p=0:s=x', saida])).stdout.trim()
  const L = [`Quadro de ${info.nome} em ${mmss(t)}${recorte ? `, recorte ${recorte.join(',')}` : ''} (${dim.replace('x', '×')}): ${saida}`]
  const [w, h] = dim.split('x').map(Number)
  if (Math.max(w, h) > 1600) {
    L.push(`A ferramenta de ler imagem reduz imagem grande. Para ler texto pequeno, recorte a área: node ${aspas(script)} quadro ${aspas(abs)} --em ${mmss(t)} --recorte X,Y,L,A (esquerda, topo, largura e altura em % do quadro; 0,0,100,33 é o terço de cima).`)
  }
  return L.join('\n')
}

function tamanhoDe(p) {
  let st
  try { st = fs.lstatSync(p) } catch { return 0 }
  if (!st.isDirectory()) return st.size
  return fs.readdirSync(p).reduce((s, n) => s + tamanhoDe(path.join(p, n)), 0)
}
const mb = (b) => `${(b / 1024 / 1024).toFixed(1).replace('.', ',')} MB`

function limpar(bruto) {
  const raiz = pastaCache()
  if (!fs.existsSync(raiz)) return `O cache da play já está vazio (${raiz}).`
  if (!String(bruto ?? '').trim()) {
    const total = tamanhoDe(raiz)
    fs.rmSync(raiz, { recursive: true, force: true })
    return `Apaguei o cache da play (${mb(total)}): ${raiz}`
  }
  const abs = resolverCaminho(bruto) ?? path.resolve(candidatosDoCaminho(bruto).at(-1))
  let total = 0, quantas = 0
  for (const n of fs.readdirSync(raiz)) {
    const p = path.join(raiz, n)
    if (lerJson(path.join(p, 'arquivo.json'))?.arquivo !== abs) continue
    total += tamanhoDe(p)
    quantas++
    fs.rmSync(p, { recursive: true, force: true })
  }
  return quantas ? `Apaguei o cache de ${path.basename(abs)} (${mb(total)}).` : `Não havia cache de ${abs}.`
}

export function lerArgs(argv) {
  const op = { modelo: MODELO_PADRAO, idioma: null, quadros: null, refazer: false, longo: false, json: false, em: null, recorte: null }
  const soltos = []
  const comValor = ['modelo', 'idioma', 'quadros', 'em', 'recorte']
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    const m = /^--([a-z]+)(?:=(.*))?$/s.exec(a)
    if (!m) { soltos.push(a); continue }
    if (['refazer', 'longo', 'json'].includes(m[1]) && m[2] == null) op[m[1]] = true
    else if (comValor.includes(m[1])) {
      const v = m[2] ?? argv[++i]
      if (v == null || v === '') throw new Falha(`--${m[1]} precisa de um valor.\n${USO}`, 2)
      op[m[1]] = v
    } else throw new Falha(`opção que não conheço: ${a}\n${USO}`, 2)
  }
  if (op.idioma != null) {
    if (!/^[a-z]{2,3}$/i.test(op.idioma)) throw new Falha(`--idioma é o código do idioma, como pt, en ou es (veio "${op.idioma}").`, 2)
    op.idioma = op.idioma.toLowerCase()
  }
  if (op.quadros != null) {
    const n = Number(op.quadros)
    if (!Number.isInteger(n) || n < 1 || n > 60) throw new Falha(`--quadros é um número de 1 a 60 (veio "${op.quadros}").`, 2)
    op.quadros = n
  }
  const comando = ['quadro', 'limpar'].includes(soltos[0]) ? soltos.shift() : 'analisar'
  // caminho com espaço que chegou sem aspas vem partido em vários argumentos
  return { comando, caminho: soltos.join(' '), op }
}

export async function principal(argv, script = process.argv[1]) {
  let json = argv.includes('--json')
  try {
    const { comando, caminho, op } = lerArgs(argv)
    json = op.json
    if (comando === 'limpar') { console.log(limpar(caminho)); return 0 }
    const abs = arquivoDe(caminho)
    if (comando === 'quadro') { console.log(await quadro(abs, op, script)); return 0 }
    const { r, info } = await analisar(abs, op)
    console.log(op.json ? JSON.stringify(r, null, 2) : relatorio(r, info, script))
    if (r.erro) console.error(`\n${r.erro.mensagem}`)
    return r.erro?.codigo ?? 0
  } catch (e) {
    if (!(e instanceof Falha)) throw e
    if (json) console.log(JSON.stringify({ erro: { codigo: e.code, mensagem: e.message } }, null, 2))
    console.error(e.message)
    return e.code
  }
}

// caminho real dos dois lados: a skill é instalada por link simbólico, e aí o argv[1] não bate com o import.meta.url
if (process.argv[1] && (() => { try { return fs.realpathSync(process.argv[1]) === fs.realpathSync(fileURLToPath(import.meta.url)) } catch { return false } })()) {
  principal(process.argv.slice(2)).then((code) => { process.exitCode = code }, (e) => {
    console.error(`Erro inesperado na play: ${e?.stack ?? e}`)
    process.exitCode = 1
  })
}
