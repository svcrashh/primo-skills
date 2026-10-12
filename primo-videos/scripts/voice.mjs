#!/usr/bin/env node
// Voz em off pela API da ElevenLabs, opcional: sem roteiro de voz no projeto, nada aqui roda. Só Node (fetch) e ffmpeg:
// nada de Python na rede, porque o Python de algumas máquinas falha HTTPS (CERTIFICATE_VERIFY_FAILED).
//   account [--json]                             plano, créditos usados e limite, e se a conta está ativa
//   search [--language pt] [--accent …] [--gender …] [--age …] [--use-case …] [--descriptive …] [--query …]
//          [--sort usage_character_count_1y] [--n 12] [--min-notice 180] [--default] [--previews <folder>] [--json]
//                                                vozes da biblioteca que se pode usar num vídeo (grátis)
//   samples (--script s.json [--line id] | --phrase "…" [--profile calmo] [--model id]) --voices a,b,c [--out folder]
//                                                a mesma frase lida por N vozes, com samples.json para o painel
//   review script.json [--seconds s] [--json]    o texto sem tique de IA (scripts/writing.mjs) e a conta de 150 palavras/min, sem rede
//   generate script.json --out <video>/voice/<version> [--redo id,id] [--takes folder] [--accept-text]
//                                                narration.json (Contrato L) + lines/*.wav, com o take em cache; erro de escrita
//                                                numa fala nova para antes de gastar (código 3), a não ser com --accept-text
//   check narration.json [--tolerance 0.08] [--line id] [--detail]   alinhamento forçado: cada palavra a ±80 ms
//   listen narration.json [--words "Name,Acronym"] [--line id]   transcreve cada fala e confere as palavras de risco
//   listen --mix <video.mp4> --script <narration.json|script.json> [--words …] [--line id] [--threshold 90]
//                                                transcreve o áudio do MP4 final, já mixado: o mix comeu palavra? (código 1)
//   validate narration.json                      o Contrato L, sem rede
//   design --description "…" (--script s.json | --text "…") [--label a]   Voice Design: 3 prévias lendo o roteiro (sempre humana)
//   remix <voice_id> --description "same voice, warmer" (--script|--text) [--strength 0.35]   irmãs de uma voz salva
//   save <generated_voice_id> --name "…"         guarda a prévia escolhida na conta (ocupa vaga)
//   transcribe <audio> […] [--language pt]       o que a transcrição ouve num áudio qualquer
//   compare --ref <video|audio> [--from s --to s] <audio|folder> […]   timbre e ritmo contra a voz de referência, sem rede
//   measure <audio|folder> […] [--align] [--json]   tom, energia, ritmo, pausas e duração de cada leitura (só o --align usa a rede)
//   board script.json [--narration n.json] [--samples folder]   o roteiro, as falas e as vozes em JSON, para o painel, sem rede
// Todo comando aceita --log <arquivo.jsonl>: uma linha por chamada à API, sem a chave.
// Gasto: o caderno do vídeo (scripts/costs.mjs). Toda chamada paga confere o teto ANTES de chamar (código 5, nada é
// chamado) e anota o custo real depois, em <projeto>/costs.jsonl. O projeto é o --project ou a pasta acima do voice/ do
// caminho de saída ou do roteiro; comando pago sem nenhum dos dois pede o --project (código 2).
// A chave vem de ELEVENLABS_API_KEY ou de ~/.claude/secrets/elevenlabs.env e nunca é impressa. ELEVENLABS_API_BASE troca o endereço.
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import crypto from 'node:crypto'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { checkCap, noteCost, OverCap, Usage } from './costs.mjs'
import { revisarTexto, palavrasDe, segundosDe, PPM, REGRAS } from './writing.mjs'
import { lerChaveDoArquivo } from './where.cjs'

export const FORMATO = 'mp3_44100_128'
export const MODELO = 'eleven_multilingual_v2'
export const TAXA = 48000
export const PERFIS = {
  calmo: { speed: 0.95, stability: 0.55, similarity_boost: 0.75, style: 0, use_speaker_boost: true },
  reels: { speed: 1.08, stability: 0.42, similarity_boost: 0.75, style: 0, use_speaker_boost: true },
}
const TOLERANCIA = 0.08
const AVISO_MIN = 180
// Ponto de extensão opcional: sem scripts/app/canal.mjs no pacote, nada é avisado para fora.
const CANAL = new URL('./app/canal.mjs', import.meta.url)
const canalDoApp = async () => (fs.existsSync(CANAL) ? import(CANAL.href) : null)

export class Falha extends Error {
  constructor(msg, codigo = 1) { super(msg); this.codigo = codigo }
}

const r3 = (v) => Math.round(v * 1000) / 1000
const num = (s) => (s == null || s === '' || !Number.isFinite(+s) ? null : +s)
const lista = (s) => String(s || '').split(',').map((x) => x.trim()).filter(Boolean)
const dormir = (ms) => new Promise((r) => setTimeout(r, ms))
const data = (unix) => new Date(unix * 1000).toISOString().slice(0, 10)
const lerJson = (arq, oque) => {
  if (!fs.existsSync(arq)) throw new Falha(`could not find ${oque}: ${arq}`)
  try { return JSON.parse(fs.readFileSync(arq, 'utf8')) } catch (e) { throw new Falha(`${arq} is not valid JSON: ${e.message}`) }
}

// ── chave ────────────────────────────────────────────────────────────────────────────────────────
export const arquivoChave = () => path.join(os.homedir(), '.claude', 'secrets', 'elevenlabs.env')
// Os dois comandos leem a chave sem mostrar na tela e gravam o arquivo só para a própria pessoa.
const CHAVE_MAC = `mkdir -p ~/.claude/secrets && printf 'Paste the ElevenLabs key and press Enter: ' && read -rs k && echo && (umask 077; printf 'ELEVENLABS_API_KEY=%s\\n' "$k" > ~/.claude/secrets/elevenlabs.env) && unset k && echo 'Key saved.'`
const CHAVE_WIN = `$d = "$env:USERPROFILE\\.claude\\secrets"; New-Item -ItemType Directory -Force $d | Out-Null; $s = Read-Host 'Paste the ElevenLabs key and press Enter' -AsSecureString; Set-Content -Path "$d\\elevenlabs.env" -Encoding ascii -Value ("ELEVENLABS_API_KEY=" + [System.Net.NetworkCredential]::new('', $s).Password); Remove-Variable s; 'Key saved.'`
export function comoPorChave() {
  const mac = `  Mac or Linux (Terminal, zsh or bash):\n    ${CHAVE_MAC}`
  const win = `  Windows (PowerShell):\n    ${CHAVE_WIN}`
  return `Could not find the ElevenLabs key (${arquivoChave()}).
Create the key at elevenlabs.io → Developers → API Keys and run, in your own terminal (not in the chat), the command for your system.
It asks for the key without showing what you paste:
${process.platform === 'win32' ? `${win}\n${mac}` : `${mac}\n${win}`}
Or set the environment variable ELEVENLABS_API_KEY. Never paste the key into a conversation.`
}
let chaveLida = null
export function lerChave() {
  if (chaveLida) return chaveLida
  const k = (process.env.ELEVENLABS_API_KEY || '').trim() || lerChaveDoArquivo(arquivoChave(), 'ELEVENLABS_API_KEY')
  if (!k) throw new Falha(comoPorChave())
  chaveLida = k
  return k
}
// Nenhuma mensagem, erro ou registro sai com a chave, nem quando a API a devolve no corpo.
export const limpar = (s) => (chaveLida ? String(s ?? '').split(chaveLida).join('«key»') : String(s ?? ''))

// ── gasto: o caderno do vídeo ────────────────────────────────────────────────────────────────────
// O projeto (a pasta do vídeo, onde mora o costs.jsonl): o --project, ou a pasta acima do último "voice" de um dos
// caminhos (voice/v1/narration.json, voice/v1 como saída, voice/_takes/…). Sem isso, o comando pago pede o --project.
export function acharProjeto(explicito, ...caminhos) {
  if (explicito) return path.resolve(explicito)
  for (const c of caminhos.filter(Boolean)) {
    const partes = path.resolve(c).split(path.sep)
    const i = partes.lastIndexOf('voice')
    if (i > 0) return partes.slice(0, i).join(path.sep) || path.sep
  }
  throw new Falha('which video is this spend for? Pass --project <video folder>: its cost notebook (costs.jsonl) counts every paid call against the video\'s cap.', 2)
}
// Créditos por caractere: os modelos flash e turbo cobram metade.
export const creditosPorLetra = (modelo) => (/flash|turbo/.test(String(modelo || '')) ? 0.5 : 1)
// O alinhamento forçado custa cerca de 1 crédito por chamada (33 chamadas, 33 créditos, medido em 04/10/2026).
export const CREDITOS_ALINHAR = 1
// A transcrição cobra pela duração do áudio: uma leitura de 15 s custou 5 créditos (header character-cost, 06/10/2026);
// leituras de ~10 s, 2 a 4 (03/10/2026).
export const CREDITOS_STT_POR_S = 0.33
const creditosStt = (seg) => Math.max(1, Math.ceil(seg * CREDITOS_STT_POR_S))
const antes = (projeto, creditos) => checkCap(projeto, { kind: 'voice', credits: Math.ceil(creditos) })
// Depois da chamada: o custo real (header character-cost) ou, sem ele, a estimativa.
const anotar = (projeto, { custo, estimado, ...resto }) => noteCost(projeto, { kind: 'voice', provider: 'elevenlabs', credits: custo ?? estimado, ...resto })

// ── API ──────────────────────────────────────────────────────────────────────────────────────────
const estado = { chamadas: 0, registro: null, comando: '' }
const base = () => process.env.ELEVENLABS_API_BASE || 'https://api.elevenlabs.io'

function registrar(linha) {
  estado.chamadas++
  if (!estado.registro) return
  fs.mkdirSync(path.dirname(estado.registro), { recursive: true })
  fs.appendFileSync(estado.registro, limpar(JSON.stringify({ at: new Date().toISOString(), command: estado.comando, ...linha })) + '\n')
}

// Erro da API: {"detail": {"code", "message", "status" (legado)}}. Crédito acabado vem como 402
// insufficient_credits ou, no formato antigo, 401/400 quota_exceeded.
function erroApi(status, corpo) {
  let d = {}
  try { d = JSON.parse(corpo).detail ?? {} } catch {}
  const tipo = typeof d === 'string' ? '' : d.code || d.status || ''
  const msg = typeof d === 'string' ? d : d.message || ''
  const semCredito = /quota|insufficient_credits/i.test(tipo)
  const quer = semCredito
    ? 'The account ran out of credits. See the balance with `voice.mjs account` and wait for the renewal or upgrade the plan.'
    : {
      401: `ElevenLabs refused the key (401). Check the ELEVENLABS_API_KEY line in ${arquivoChave()}, without pasting the key into a conversation.`,
      402: 'This needs a paid ElevenLabs plan, or the account has a payment pending (402). See the plan and the status with `voice.mjs account`.',
      404: 'ElevenLabs did not find it (404). Check the voice_id: copy it from `voice.mjs search`.',
      422: 'ElevenLabs refused the request (422): some field is outside what it accepts.',
      429: 'Too many requests at once (429). Wait a minute and run again: what already came out is in the cache.',
    }[status] || `ElevenLabs answered ${status}.`
  const e = new Falha(limpar(`${quer}${tipo ? ` [${tipo}]` : ''}${msg ? ` ${msg}` : ''}`))
  e.status = status
  return e
}

async function api(metodo, caminho, { consulta, json, form, fala, caracteres, tolerar = [] } = {}) {
  const url = new URL(caminho, base())
  for (const [k, v] of Object.entries(consulta || {})) {
    for (const x of [v].flat()) if (x != null && x !== '') url.searchParams.append(k, String(x))
  }
  const headers = { 'xi-api-key': lerChave(), accept: 'application/json' }
  let body
  if (json) { headers['content-type'] = 'application/json'; body = JSON.stringify(json) }
  if (form) body = form
  for (let tentativa = 0; ; tentativa++) {
    const t0 = Date.now()
    let r
    try {
      r = await fetch(url, { method: metodo, headers, body })
    } catch (e) {
      registrar({ method: metodo, path: url.pathname, status: 0, error: e.cause?.code || e.message })
      throw new Falha(limpar(`Could not reach ElevenLabs (${e.cause?.code || e.message}). Check the internet and run again.`))
    }
    const corpo = await r.text()
    registrar({ method: metodo, path: url.pathname + url.search, status: r.status, ms: Date.now() - t0, request_id: r.headers.get('request-id'), cost: num(r.headers.get('character-cost')), characters: caracteres, line: fala })
    // 429 é recusa antes de processar: repetir não cobra duas vezes. 5xx pode ter processado, então não repete.
    if (r.status === 429 && tentativa < 2) { await dormir((num(r.headers.get('retry-after')) ?? 2 * 2 ** tentativa) * 1000); continue }
    if (tolerar.includes(r.status)) { let d = null; try { d = JSON.parse(corpo) } catch {} return { dados: null, erro: d?.detail ?? null, corpo, cab: r.headers, status: r.status } }
    if (!r.ok) throw erroApi(r.status, corpo)
    try { return { dados: corpo ? JSON.parse(corpo) : null, cab: r.headers, status: r.status } } catch { throw new Falha(`ElevenLabs answered something that is not JSON at ${url.pathname}.`) }
  }
}

// ── áudio ────────────────────────────────────────────────────────────────────────────────────────
export function lerWav(arq) {
  const b = fs.readFileSync(arq)
  if (b.length < 12 || b.toString('ascii', 0, 4) !== 'RIFF' || b.toString('ascii', 8, 12) !== 'WAVE') throw new Falha(`${arq} is not a WAV.`)
  let fmt = null, dados = null
  for (let p = 12; p + 8 <= b.length; ) {
    const id = b.toString('ascii', p, p + 4), n = b.readUInt32LE(p + 4)
    if (id === 'fmt ') fmt = { formato: b.readUInt16LE(p + 8), canais: b.readUInt16LE(p + 10), taxa: b.readUInt32LE(p + 12), bits: b.readUInt16LE(p + 22) }
    if (id === 'data') { dados = b.subarray(p + 8, Math.min(b.length, p + 8 + n)); break }
    p += 8 + n + (n % 2)
  }
  if (!fmt || !dados) throw new Falha(`${arq}: WAV without the fmt or data chunk.`)
  const pcm16 = (fmt.formato === 1 || fmt.formato === 0xfffe) && fmt.bits === 16
  const amostras = pcm16 ? new Int16Array(dados.buffer.slice(dados.byteOffset, dados.byteOffset + dados.length - (dados.length % 2))) : null
  return { ...fmt, pcm16, n: Math.floor(dados.length / (fmt.bits / 8) / fmt.canais), amostras, inicio: dados.byteOffset - b.byteOffset }
}

const janelas = (x, taxa, limiarDb) => {
  const jan = Math.round(0.01 * taxa), passo = Math.round(0.001 * taxa), lim = 10 ** (limiarDb / 20)
  const rms = (i) => { let s = 0; for (let k = i; k < i + jan; k++) s += x[k] * x[k]; return Math.sqrt(s / jan) / 32768 }
  return { jan, passo, cabe: (i) => i + jan < x.length, som: (i) => i + jan < x.length && rms(i) >= lim }
}

// O primeiro som: RMS de 10 ms acima de −45 dBFS, andando de 1 em 1 ms. É a medida do Contrato L.
export function inicioVoz(x, taxa, limiarDb = -45) {
  const { passo, cabe, som } = janelas(x, taxa, limiarDb)
  let i = 0
  while (cabe(i) && !som(i)) i += passo
  return cabe(i) ? i / taxa : null
}

// A ElevenLabs às vezes devolve um estalo curto no começo do arquivo, antes de um silêncio (medido em
// 29/09/2026: 15 ms a −41 dBFS e ~75 ms de silêncio até a voz). Ele engana o primeiro som do Contrato L,
// e o motor acenderia a legenda antes da voz. Zera, só no começo, cada trecho acima de −45 dBFS que dura
// ≤ 40 ms e vem antes de ≥ 50 ms de silêncio. Devolve quantos segundos zerou.
export function limparInicio(arq, limiarDb = -45) {
  const w = lerWav(arq)
  const { passo, cabe, som } = janelas(w.amostras, w.taxa, limiarDb)
  let zerar = 0
  for (let volta = 0; volta < 5; volta++) {
    let i = zerar
    while (cabe(i) && !som(i)) i += passo
    if (!cabe(i) || i > 0.5 * w.taxa) break
    let j = i
    while (som(j)) j += passo
    let k = j
    while (cabe(k) && !som(k)) k += passo
    if (j - i > 0.04 * w.taxa || k - j < 0.05 * w.taxa || !cabe(k)) break
    zerar = k
  }
  if (!zerar) return 0
  const b = fs.readFileSync(arq)
  b.fill(0, w.inicio, w.inicio + zerar * 2)
  fs.writeFileSync(arq, b)
  return zerar / w.taxa
}

// RMS de 10 ms em dBFS, a cada `passo` s.
export function envelopeDb(x, taxa, passo = 0.005) {
  const J = Math.round(0.01 * taxa), P = Math.round(passo * taxa), db = []
  for (let i = 0; i + J <= x.length; i += P) { let s = 0; for (let k = i; k < i + J; k++) s += x[k] * x[k]; db.push(20 * Math.log10(Math.sqrt(s / J) / 32768 + 1e-9)) }
  return { db, passo, jan: 0.01 }
}

// As pausas DENTRO da fala (entre o primeiro e o último som): trechos abaixo de −38 dBFS por ≥ 0,1 s. Com esse limiar
// o fim de cada pausa caiu a ±5 ms de onde a voz volta, nas 8 palavras corrigidas à mão numa série de vídeos.
export function pausasDaVoz(x, taxa, { limiarDb = -38, minimo = 0.1 } = {}) {
  const { db, passo, jan } = envelopeDb(x, taxa)
  const som = db.map((d) => d >= limiarDb)
  const a = som.indexOf(true), b = som.lastIndexOf(true), out = []
  for (let i = a; a >= 0 && i <= b; i++) {
    if (som[i]) continue
    let j = i
    while (j <= b && !som[j]) j++
    const s0 = i * passo + jan, s1 = j * passo
    if (s1 - s0 >= minimo) out.push([r3(s0), r3(s1)])
    i = j
  }
  return out
}

// O último som: a última janela de 10 ms acima de −45 dBFS (a régua do primeiro som, vista do fim).
export function fimDaVoz(x, taxa, limiarDb = -45) {
  const J = Math.round(0.01 * taxa), P = Math.round(0.001 * taxa), L = 10 ** (limiarDb / 20)
  for (let i = x.length - J; i >= 0; i -= P) { let s = 0; for (let k = i; k < i + J; k++) s += x[k] * x[k]; if (Math.sqrt(s / J) / 32768 >= L) return (i + J) / taxa }
  return null
}

// O alinhamento da ElevenLabs põe a pausa dentro da palavra seguinte: a 1ª letra "começa" onde a anterior acabou, e
// a animação presa nela acendia 0,2 a 0,74 s antes de a voz dizer a palavra. Aqui a palavra que nasce dentro de uma
// pausa medida passa a começar no fim dela, e a última palavra, esticada até o fim do arquivo, termina no último som.
export function acertarPelaVoz(palavras, x, taxa) {
  const ps = palavras.map((p) => ({ ...p })), mudancas = []
  for (const [s0, s1] of pausasDaVoz(x, taxa)) {
    const p = ps.find((q) => q.ini >= s0 - 0.05 && q.ini < s1 && q.fim > s1)
    if (!p || s1 - p.ini < 0.05) continue
    mudancas.push({ texto: p.texto, campo: 'ini', de: p.ini, para: r3(s1) })
    p.ini = r3(s1)
  }
  const fv = fimDaVoz(x, taxa), u = ps.at(-1)
  if (fv != null && u.fim > fv + 0.05 && fv > u.ini) { mudancas.push({ texto: u.texto, campo: 'fim', de: u.fim, para: r3(fv) }); u.fim = r3(fv) }
  return { palavras: ps, mudancas }
}

// Silêncio sobrando no fim do take (já veio um com 2,1 s): corta o WAV no último som + 0,12 s, a cauda da respiração.
// Abaixo de 0,3 s de sobra não mexe. Devolve a sobra cortada, em segundos (0 = nada).
export const SOBRA_MAX = 0.3
export function apararFim(arq) {
  const w = lerWav(arq)
  const fv = fimDaVoz(w.amostras, w.taxa)
  if (fv == null) return 0
  const dur = w.n / w.taxa, novo = Math.min(w.n, Math.round((fv + 0.12) * w.taxa))
  if (dur - fv <= SOBRA_MAX) return 0
  const b = fs.readFileSync(arq), bytes = novo * 2 * w.canais
  const saida = Buffer.concat([b.subarray(0, w.inicio), b.subarray(w.inicio, w.inicio + bytes)])
  saida.writeUInt32LE(saida.length - 8, 4)
  saida.writeUInt32LE(bytes, w.inicio - 4)
  fs.writeFileSync(arq, saida)
  return r3(dur - novo / w.taxa)
}

// Quanto a voz se mexe: a faixa do tom (p90−p10, em semitons, do f0 por autocorrelação a 16 kHz) e a da energia (p90−p10
// do RMS de 40 ms, em dB, só onde há voz), mais o nível e o f0 medianos. A voz animada aprovada para Reels numa série
// mediu ~10 st e ~20 dB; a calma de tutorial, recusada em Reels ("sem vida"), ~6,7 st e ~16 dB.
export function expressividade(x, taxa) {
  const k = Math.max(1, Math.round(taxa / 16000)), sr = taxa / k, n = Math.floor(x.length / k), y = new Float32Array(n)
  for (let i = 0; i < n; i++) { let s = 0; for (let j = 0; j < k; j++) s += x[i * k + j]; y[i] = s / k / 32768 }
  const win = Math.round(0.04 * sr), hop = Math.round(0.01 * sr), db = [], f0 = []
  for (let i = 0; i + win <= n; i += hop) {
    let e = 0
    for (let j = 0; j < win; j++) e += y[i + j] ** 2
    const d = 20 * Math.log10(Math.sqrt(e / win) + 1e-9)
    if (d < -40) continue
    db.push(d)
    let melhor = 0, lag = 0
    for (let L = Math.floor(sr / 450); L <= Math.ceil(sr / 75); L++) {
      let s = 0, a = 0, b = 0
      for (let j = 0; j + L < win; j++) { s += y[i + j] * y[i + j + L]; a += y[i + j] ** 2; b += y[i + j + L] ** 2 }
      const c = s / Math.sqrt(a * b + 1e-12)
      if (c > melhor) { melhor = c; lag = L }
    }
    if (melhor > 0.6) f0.push(sr / lag)
  }
  const pct = (v, p) => { const o = [...v].sort((a, b) => a - b); return o.length ? o[Math.floor((o.length - 1) * p)] : 0 }
  const f0m = pct(f0, 0.5), st = f0.map((f) => 12 * Math.log2(f / f0m))
  return { tom: r3(pct(st, 0.9) - pct(st, 0.1)), energia: r3(pct(db, 0.9) - pct(db, 0.1)), nivel: r3(pct(db, 0.5)), f0: Math.round(f0m), quadros: db.length }
}

// O ritmo da fala, sem ouvido: conta os núcleos de sílaba (picos do envelope de energia, a ≥ 45 ms um do outro e a ≥ 2,5 dB do
// vale vizinho) e mede o intervalo entre eles. Devolve sílabas por segundo de fala (sem as pausas ≥ 0,1 s), o coeficiente de variação
// desses intervalos dentro dos trechos (voz de máquina é regular: CV baixo; gente acelera e arrasta) e a faixa de sílabas/s por trecho.
// É um indício para comparar leituras entre si, não a contagem exata de sílabas: numa frase de teste contou 18 para ~23 do texto.
export function ritmo(x, taxa, pausas = pausasDaVoz(x, taxa)) {
  const { db, passo } = envelopeDb(x, taxa, 0.005)
  const lis = db.map((_, i) => { let s = 0, n = 0; for (let k = Math.max(0, i - 2); k <= Math.min(db.length - 1, i + 2); k++) { s += db[k]; n++ } return s / n })
  const ord = [...lis].sort((a, b) => a - b), teto = ord[Math.floor((ord.length - 1) * 0.9)]
  const R = 9, picos = []
  for (let i = R; i < lis.length - R; i++) {
    if (lis[i] < teto - 22) continue
    let max = true, vE = Infinity, vD = Infinity
    for (let k = 1; k <= R && max; k++) if (lis[i - k] > lis[i] || lis[i + k] > lis[i]) max = false
    if (!max) continue
    for (let k = 1; k <= 16 && i - k >= 0; k++) vE = Math.min(vE, lis[i - k])
    for (let k = 1; k <= 16 && i + k < lis.length; k++) vD = Math.min(vD, lis[i + k])
    if (lis[i] - Math.max(vE, vD) < 2.5) continue
    const t = i * passo + 0.01
    if (picos.length && t - picos[picos.length - 1] < 0.045) continue
    picos.push(t)
  }
  const emPausa = (t) => pausas.some(([a, b]) => t > a && t < b)
  const trechos = [], lim = [0, ...pausas.flat(), Infinity]
  for (let j = 0; j < lim.length; j += 2) trechos.push(picos.filter((t) => t >= lim[j] && t < lim[j + 1] && !emPausa(t)))
  const ioi = [], porTrecho = []
  for (const t of trechos) {
    for (let i = 1; i < t.length; i++) ioi.push(t[i] - t[i - 1])
    if (t.length >= 4) porTrecho.push((t.length - 1) / (t.at(-1) - t[0]))
  }
  const media = ioi.reduce((s, v) => s + v, 0) / (ioi.length || 1)
  const cv = ioi.length > 2 ? Math.sqrt(ioi.reduce((s, v) => s + (v - media) ** 2, 0) / ioi.length) / media : 0
  return { silabas: picos.length, silabasPorSeg: r3(media ? 1 / media : 0), cv: r3(cv), faixa: porTrecho.length ? [r3(Math.min(...porTrecho)), r3(Math.max(...porTrecho))] : null }
}

function ffmpeg(args) {
  const r = spawnSync('ffmpeg', ['-hide_banner', '-v', 'error', '-y', ...args], { encoding: 'utf8' })
  if (r.error?.code === 'ENOENT') throw new Falha('ffmpeg is missing. macOS: brew install ffmpeg · Windows: winget install ffmpeg (then close and reopen PowerShell and Claude Code) · Linux: sudo apt install ffmpeg')
  if (r.status !== 0) throw new Falha(`ffmpeg failed: ${(r.stderr || '').trim()}`)
}
export const mp3ParaWav = (mp3, wav) => ffmpeg(['-i', mp3, '-ar', String(TAXA), '-ac', '1', '-c:a', 'pcm_s16le', wav])

// ── texto, pronúncia e palavras ──────────────────────────────────────────────────────────────────
export const normalizar = (t) => String(t ?? '').trim().replace(/\s+/g, ' ')
const PARTES = /^([^\p{L}\p{N}]*)(.*?)([^\p{L}\p{N}]*)$/u

// A legenda mostra o texto do roteiro; a voz recebe o texto com as trocas de pronúncia. Cada palavra
// exibida vira uma ou mais palavras ditas, e `grupos` guarda quantas, para devolver os tempos à legenda.
// Marcação de emoção e de pausa do v3 e do v4 ("[warm]", "[pause]", "[strong French accent]"): vai para a voz, que a interpreta e não
// a diz, e fica fora da legenda e das palavras do Contrato L. `marcacoes` marca quais palavras do texto fazem parte de uma.
export function marcacoes(palavras) {
  let aberta = false
  return palavras.map((w, i) => {
    if (aberta) { aberta = !w.endsWith(']'); return true }
    if (/^\[[^\]]*\]$/.test(w)) return true
    if (/^\[[^\]]*$/.test(w) && palavras.slice(i + 1).some((x) => x.endsWith(']'))) { aberta = true; return true }
    return false
  })
}
export const semMarcacao = (itens, texto = (x) => x) => { const m = marcacoes(itens.map(texto)); return itens.filter((_, i) => !m[i]) }

export function aplicarPronuncia(texto, mapa = {}) {
  const todas = normalizar(texto).split(' '), marca = marcacoes(todas)
  const exibidas = [], ditas = [], grupos = [], usadas = {}, falado = []
  todas.forEach((w, i) => {
    if (marca[i]) { falado.push(w); return }
    const [, antes, nucleo, depois] = w.match(PARTES)
    const troca = nucleo && Object.hasOwn(mapa, nucleo) ? normalizar(mapa[nucleo]) : null
    const dita = troca ? `${antes}${troca}${depois}` : w
    if (troca) usadas[nucleo] = troca
    exibidas.push(w)
    ditas.push(dita)
    grupos.push(dita.split(' ').length)
    falado.push(dita)
  })
  return { exibidas, ditas, falado: falado.join(' '), grupos, usadas }
}

// Palavras do alinhamento da ElevenLabs: separadas por espaço, com a pontuação junto.
export function palavrasDoAlinhamento(al) {
  const ch = al.characters, t0 = al.character_start_times_seconds, t1 = al.character_end_times_seconds
  const out = []
  let cur = '', a0 = 0, fim = 0
  ch.forEach((c, i) => {
    if (/^\s+$/.test(c)) { if (cur) out.push({ texto: cur, ini: a0, fim }); cur = ''; return }
    if (!cur) a0 = t0[i]
    cur += c
    fim = t1[i]
  })
  if (cur) out.push({ texto: cur, ini: a0, fim })
  return out
}

export function agrupar(ditas, grupos, exibidas) {
  if (ditas.length !== grupos.reduce((s, n) => s + n, 0)) return null
  let k = 0
  return exibidas.map((texto, i) => {
    const g = ditas.slice(k, (k += grupos[i]))
    return { texto, ini: g[0].ini, fim: g[g.length - 1].fim }
  })
}

// Uma fala do Contrato L a partir do alinhamento e do WAV já convertido.
export function montarFala({ fala, pron, alinhamento, forcado, wav, arquivo }) {
  const w = lerWav(wav)
  const ini = inicioVoz(w.amostras, w.taxa)
  if (ini == null) throw new Falha(`Line ${fala.id} came out silent (nothing above −45 dBFS). Redo it with --redo ${fala.id}.`)
  // a marcação do v3 e do v4 ("[excited]", "[pause]") vem no alinhamento como palavra, mas não é dita nem vai para a legenda
  const ditas = forcado ?? semMarcacao(palavrasDoAlinhamento(alinhamento), (d) => d.texto)
  const pal = agrupar(ditas, pron.grupos, pron.exibidas)
  if (!pal) {
    throw new Falha(`The alignment of line ${fala.id} does not match the text sent.
  sent:     ${pron.falado}
  aligned:  ${ditas.map((d) => d.texto).join(' ')}`)
  }
  const dur = w.n / w.taxa
  const palavras = pal.map((p, i) => ({
    texto: p.texto,
    ini: r3(p.ini),
    fim: r3(Math.min(p.fim, dur)),
    ...(pron.ditas[i] !== p.texto ? { dito: pron.ditas[i] } : {}),
  }))
  // O alinhamento põe a 1ª letra em 0,000 mesmo quando a voz só começa depois: vale o som medido.
  palavras[0].ini = r3(Math.max(palavras[0].ini, ini))
  if (palavras[0].fim < palavras[0].ini) palavras[0].fim = palavras[0].ini
  const acerto = acertarPelaVoz(palavras, w.amostras, w.taxa)
  return { id: fala.id, onde: fala.onde, texto: pron.exibidas.join(' '), arquivo, duracao: r3(dur), inicio_voz: r3(ini), palavras: acerto.palavras, acertos: acerto.mudancas }
}

// ── cache: o take aprovado ───────────────────────────────────────────────────────────────────────
const ordenado = (o) => (o && typeof o === 'object' && !Array.isArray(o) ? Object.fromEntries(Object.keys(o).sort().map((k) => [k, ordenado(o[k])])) : o)
// SHA-256 de tudo o que muda o som: texto enviado, voz, modelo, ajustes, formato, vizinhos e dicionário.
export const chaveTake = (p) => crypto.createHash('sha256').update(JSON.stringify(ordenado({
  texto: p.texto, voz: p.voz, modelo: p.modelo, ajustes: p.ajustes, formato: p.formato,
  anterior: p.anterior || '', seguinte: p.seguinte || '', dicionario: p.dicionario || {},
}))).digest('hex')

export function lerTake(dir, chave) {
  const d = path.join(dir, chave)
  if (!fs.existsSync(path.join(d, 'take.mp3')) || !fs.existsSync(path.join(d, 'take.json'))) return null
  return { ...JSON.parse(fs.readFileSync(path.join(d, 'take.json'), 'utf8')), mp3: path.join(d, 'take.mp3') }
}
function guardarTake(dir, chave, mp3, info) {
  const d = path.join(dir, chave)
  fs.mkdirSync(d, { recursive: true })
  fs.writeFileSync(path.join(d, 'take.mp3'), mp3)
  fs.writeFileSync(path.join(d, 'take.json'), JSON.stringify(info, null, 1) + '\n')
  return path.join(d, 'take.mp3')
}
function guardarForcado(dir, chave, palavras) {
  const arq = path.join(dir, chave, 'take.json')
  fs.writeFileSync(arq, JSON.stringify({ ...JSON.parse(fs.readFileSync(arq, 'utf8')), forcado: palavras }, null, 1) + '\n')
}
function aposentarTake(dir, chave) {
  const d = path.join(dir, chave)
  if (!fs.existsSync(path.join(d, 'take.json'))) return null
  const velho = path.join(d, 'antigos', new Date().toISOString().replace(/[:.]/g, '-'))
  fs.mkdirSync(velho, { recursive: true })
  for (const f of ['take.mp3', 'take.json']) if (fs.existsSync(path.join(d, f))) fs.renameSync(path.join(d, f), path.join(velho, f))
  return velho
}
function pastaTakes(p) {
  const abs = path.resolve(p)
  if (abs.split(path.sep).includes('output')) throw new Falha(`The takes cannot live inside an output/ folder (${abs}): output/ is wiped on every render and the take is the source of the sound. Use --takes <video folder>/voice/_takes.`)
  return abs
}

// ── roteiro ──────────────────────────────────────────────────────────────────────────────────────
const ID = /^[A-Za-z0-9][A-Za-z0-9_-]*$/
// Tutorial: { passo: n }. Vídeo em capítulos (update, lançamento): { capitulo: n }. Um roteiro usa um só.
const tipoOnde = (o) => (o && typeof o === 'object' ? Object.keys(o)[0] : null)
const ondeOk = (o) => o === 'abertura' || o === 'fechamento' || (o && typeof o === 'object' && Object.keys(o).length === 1
  && ['passo', 'capitulo'].includes(tipoOnde(o)) && Number.isInteger(o[tipoOnde(o)]) && o[tipoOnde(o)] >= 1)
const ordemOnde = (o) => (o === 'abertura' ? 0 : o === 'fechamento' ? Infinity : o[tipoOnde(o)])
export const nomeOnde = (o) => (o === 'abertura' ? 'opening' : o === 'fechamento' ? 'closing' : typeof o === 'string' ? o : `${tipoOnde(o) === 'capitulo' ? 'chapter' : 'step'} ${o[tipoOnde(o)]}`)
// A cena de cada fala: 0 a abertura, 99 o fechamento, n o capítulo ou o passo n.
export const cenaDaFala = (o) => (o === 'abertura' ? 0 : o === 'fechamento' ? 99 : o && typeof o === 'object' ? o[tipoOnde(o)] : null)
const FAIXAS = { speed: [0.7, 1.2], stability: [0, 1], similarity_boost: [0, 1], style: [0, 1] }

function conferirOndes(falas, erros) {
  const vistos = new Set()
  for (const f of falas) {
    if (!ondeOk(f.onde)) { erros.push(`${f.id || '?'}: onde must be "abertura", "fechamento", { "passo": n } or { "capitulo": n }, with n ≥ 1`); continue }
    const k = nomeOnde(f.onde)
    if (vistos.has(k)) erros.push(`${f.id}: ${k} appears in more than one line (each place has a single line)`)
    vistos.add(k)
  }
  const tipos = new Set(falas.map((f) => tipoOnde(f.onde)).filter(Boolean))
  if (tipos.size > 1) erros.push('the script mixes passo and capitulo: the tutorial uses { "passo": n }, the chapter video uses { "capitulo": n }')
}

export function lerRoteiro(arq, { precisaVoz = true } = {}) {
  const r = lerJson(arq, 'the script')
  const erros = []
  if (typeof r.idioma !== 'string' || !r.idioma) erros.push('idioma: missing (e.g. "en-US", "pt-BR")')
  if (!Object.hasOwn(PERFIS, r.perfil)) erros.push(`perfil: must be ${Object.keys(PERFIS).join(' or ')} (the same as video.voz.perfil)`)
  if (precisaVoz && !(r.voz && typeof r.voz.id === 'string' && r.voz.id)) erros.push('voz.id: the chosen voice is missing (voice.mjs search → samples → the one the person approved)')
  const ajustes = { ...(PERFIS[r.perfil] || PERFIS.calmo), ...(r.ajustes || {}) }
  for (const [k, [a, b]] of Object.entries(FAIXAS)) if (!(typeof ajustes[k] === 'number' && ajustes[k] >= a && ajustes[k] <= b)) erros.push(`ajustes.${k}: ${ajustes[k]} outside ${a}–${b}`)
  if (typeof ajustes.use_speaker_boost !== 'boolean') erros.push('ajustes.use_speaker_boost: must be true or false')
  const mapaOk = (m, onde) => {
    if (m == null) return
    if (typeof m !== 'object' || Array.isArray(m)) return erros.push(`${onde}: must be an object { "Word": "how the voice reads it" }`)
    for (const [k, v] of Object.entries(m)) {
      if (/\s/.test(k) || !k) erros.push(`${onde}: the key "${k}" must be a single word, as it is in the text`)
      if (typeof v !== 'string' || !v.trim()) erros.push(`${onde}.${k}: how the voice reads it is missing`)
    }
  }
  mapaOk(r.pronuncia, 'pronuncia')
  if (!Array.isArray(r.falas) || !r.falas.length) erros.push('falas: needs at least one line')
  const falas = (r.falas || []).map((f, i) => ({ ...f, id: f?.id, texto: normalizar(f?.texto), _i: i }))
  const ids = new Set()
  for (const f of falas) {
    if (!ID.test(f.id || '')) erros.push(`falas[${f._i}].id: use letters, digits, - and _ (it becomes the file name)`)
    else if (ids.has(f.id)) erros.push(`${f.id}: repeated id`)
    ids.add(f.id)
    if (!f.texto) erros.push(`${f.id || `falas[${f._i}]`}: the text is missing`)
    mapaOk(f.pronuncia, `${f.id}.pronuncia`)
  }
  conferirOndes(falas, erros)
  if (erros.length) throw new Falha(`The script ${arq} has problems:\n${erros.map((e) => `  - ${e}`).join('\n')}`)
  // A ordem falada é a do vídeo: abertura, passos em ordem, fechamento. Os vizinhos saem dela.
  falas.sort((a, b) => ordemOnde(a.onde) - ordemOnde(b.onde))
  return { ...r, ajustes, modelo: r.voz?.modelo || MODELO, pronuncia: r.pronuncia || {}, falas: falas.map(({ _i, ...f }) => f) }
}

// v3 e v4 aceitam marcação entre colchetes ("[warm] …", "[pause]"), que vira entonação ou pausa e não é falada; no v2 o colchete seria
// lido em voz alta. O v3 não aceita o texto das falas vizinhas e só aceita stability 0 (criativo), 0,5 ou 1; o v4 aceita as duas coisas.
export const ehV3 = (modelo) => /^eleven_v3/.test(String(modelo || ''))
export const comMarcacao = (modelo) => /^eleven_v[34]/.test(String(modelo || ''))
export function comEmocao(texto, emocao, modelo) { return emocao && comMarcacao(modelo) ? `[${String(emocao).replace(/[[\]]/g, '')}] ${texto}` : texto }
export function ajustesDoModelo(ajustes = {}, modelo) {
  if (!ehV3(modelo) || ajustes.stability == null) return ajustes
  const st = [0, 0.5, 1].reduce((m, v) => (Math.abs(v - ajustes.stability) < Math.abs(m - ajustes.stability) ? v : m), 0)
  return { ...ajustes, stability: st }
}

const vizinha = (p) => (p ? semMarcacao(p.falado.split(' ')).join(' ') : '')

export function planejar(rot) {
  const pron = rot.falas.map((f) => aplicarPronuncia(f.texto, { ...rot.pronuncia, ...(f.pronuncia || {}) }))
  const v3 = ehV3(rot.modelo)
  return rot.falas.map((fala, i) => {
    const pedido = {
      texto: comEmocao(pron[i].falado, fala.emocao ?? rot.emocao, rot.modelo), voz: rot.voz?.id, modelo: rot.modelo, ajustes: ajustesDoModelo(rot.ajustes, rot.modelo), formato: FORMATO,
      anterior: v3 ? '' : vizinha(pron[i - 1]), seguinte: v3 ? '' : vizinha(pron[i + 1]), dicionario: pron[i].usadas,
    }
    return { fala, pron: pron[i], pedido, chave: chaveTake(pedido) }
  })
}

// ── Contrato L ───────────────────────────────────────────────────────────────────────────────────
export function validarLocucao(loc, base) {
  const e = []
  if (!loc || typeof loc !== 'object') return ['the file is not a JSON object']
  if (loc.versao !== 1) e.push('versao: must be 1')
  if (typeof loc.idioma !== 'string' || !loc.idioma) e.push('idioma: missing (e.g. "en-US")')
  if (loc.voz != null && (typeof loc.voz !== 'object' || Array.isArray(loc.voz))) e.push('voz: must be an object (it is informative)')
  if (!Array.isArray(loc.falas) || !loc.falas.length) return [...e, 'falas: needs at least one']
  const ids = new Set()
  loc.falas.forEach((f, k) => {
    const q = `falas[${k}]${f?.id ? ` (${f.id})` : ''}`
    if (!ID.test(f?.id || '')) e.push(`${q}: invalid id`)
    else if (ids.has(f.id)) e.push(`${q}: repeated id`)
    ids.add(f?.id)
    if (typeof f?.texto !== 'string' || !f.texto || f.texto !== normalizar(f.texto)) e.push(`${q}: empty text or text with extra spaces`)
    const n = (x) => typeof x === 'number' && Number.isFinite(x) && x >= 0
    if (!n(f?.duracao) || f.duracao === 0) e.push(`${q}: invalid duracao`)
    if (!n(f?.inicio_voz) || !(f.inicio_voz < f.duracao)) e.push(`${q}: invalid inicio_voz`)
    if (typeof f?.arquivo !== 'string' || !f.arquivo || path.isAbsolute(f.arquivo)) e.push(`${q}: arquivo must be a path relative to the narration.json`)
    else {
      const wav = path.resolve(base, f.arquivo)
      if (!fs.existsSync(wav)) e.push(`${q}: could not find ${f.arquivo}`)
      else {
        try {
          const w = lerWav(wav)
          if (!w.pcm16 || w.canais !== 1 || w.taxa !== TAXA) e.push(`${q}: ${f.arquivo} must be a 16-bit PCM WAV, ${TAXA} Hz, mono (it is ${w.bits} bits, ${w.taxa} Hz, ${w.canais} channels)`)
          else {
            if (n(f.duracao) && Math.abs(w.n / w.taxa - f.duracao) > 0.002) e.push(`${q}: duracao ${f.duracao} s, but the WAV has ${r3(w.n / w.taxa)} s`)
            const iv = inicioVoz(w.amostras, w.taxa)
            if (n(f.inicio_voz) && (iv == null || Math.abs(iv - f.inicio_voz) > 0.002)) e.push(`${q}: inicio_voz ${f.inicio_voz} s, but the first sound measured is ${iv == null ? 'none (silent)' : `${r3(iv)} s`}`)
          }
        } catch (x) { e.push(`${q}: ${x.message}`) }
      }
    }
    if (!Array.isArray(f?.palavras) || !f.palavras.length) { e.push(`${q}: the words are missing`); return }
    const tokens = typeof f.texto === 'string' ? f.texto.split(' ') : []
    if (f.palavras.length !== tokens.length) e.push(`${q}: ${f.palavras.length} words, but the text has ${tokens.length}`)
    f.palavras.forEach((p, i) => {
      const w = `${q} word ${i + 1}`
      if (p?.texto !== tokens[i]) e.push(`${w}: "${p?.texto}" is not "${tokens[i]}" from the text`)
      if (!n(p?.ini) || !n(p?.fim) || p.ini > p.fim) e.push(`${w}: invalid ini/fim`)
      else {
        if (n(f.duracao) && p.fim > f.duracao + 0.001) e.push(`${w}: fim ${p.fim} goes past the duration ${f.duracao}`)
        if (i && n(f.palavras[i - 1]?.ini) && p.ini < f.palavras[i - 1].ini) e.push(`${w}: starts before the previous one`)
      }
      if (p?.dito != null && (typeof p.dito !== 'string' || !p.dito.trim())) e.push(`${w}: empty dito`)
    })
    if (n(f.palavras[0]?.ini) && n(f.inicio_voz) && f.palavras[0].ini < f.inicio_voz - 0.0005) e.push(`${q}: the 1st word (${f.palavras[0].ini} s) starts before the first sound (${f.inicio_voz} s)`)
  })
  conferirOndes(loc.falas.filter((f) => f && f.id), e)
  return e
}

// ── review: o roteiro sem tique de IA, antes de gastar ───────────────────────────────────────────
// As regras moram no núcleo (scripts/writing.mjs): as do texto da tela valem também aqui, e a fala soma as dela. No tutorial
// (fala por passo) a frase curta é o certo e só o teto de 18 palavras vale. A marcação do v3/v4 não conta como palavra.
const textoFalado = (f) => semMarcacao(normalizar(f.texto).split(' ')).join(' ')
export function revisarFalas(rot, falas = rot.falas, { segundos = null } = {}) {
  const o = { fala: true, tutorial: rot.falas.some((f) => tipoOnde(f.onde) === 'passo'), idioma: rot.idioma }
  const achados = falas.flatMap((f) => revisarTexto(textoFalado(f), o).map((x) => ({ fala: f.id, ...x })))
  if (segundos) achados.push(...revisarTexto(falas.map(textoFalado), { ...o, segundos }).filter((x) => x.regra === 'tempo').map((x) => ({ fala: 'script', ...x })))
  return achados
}
const NIVEL = { erro: 'error', aviso: 'warning' }
const linhaAchado = (x) => `${x.nivel === 'erro' ? '✗' : '⚠'} ${x.fala} · ${NIVEL[x.nivel] ?? x.nivel} · ${REGRAS[x.regra] ?? x.regra}\n    "${x.frase}"\n    → ${x.oque_trocar}`

// ── conta e voz ──────────────────────────────────────────────────────────────────────────────────
const gratis = (s) => s?.tier === 'free' || s?.status === 'free' || s?.status === 'free_disabled'
// Conta ativa: assinatura em dia (active, trialing) ou o plano grátis. past_due, unpaid, incomplete… = a cobrança não passou,
// e a ElevenLabs pode recusar a geração até acertar o pagamento.
const ATIVOS = new Set(['active', 'trialing', 'free'])
export const contaAtiva = (s) => s?.status == null || ATIVOS.has(s.status)
const POR_QUE = {
  past_due: 'the last payment did not go through',
  unpaid: 'the subscription is unpaid',
  incomplete: 'the first payment was not completed',
  incomplete_expired: 'the first payment expired',
  canceled: 'the subscription was canceled',
  free_disabled: 'the free plan is disabled',
}
export function avisoConta(s, agora = Date.now()) {
  if (contaAtiva(s)) return null
  const renova = s.next_character_count_reset_unix
  const quando = renova ? (renova * 1000 < agora ? ` · the renewal was due on ${data(renova)} and did not happen` : ` · renews on ${data(renova)}`) : ''
  return `⚠ The ElevenLabs account is NOT active: status ${s.status} (${POR_QUE[s.status] ?? 'the subscription is not in good standing'})${quando}.
  New voice generation may be refused (402) until it is settled at elevenlabs.io → Subscription. Free calls (account, search) still work.`
}
const milhar = (v) => (v == null ? '?' : Number(v).toLocaleString('en-US'))
const AVISO_GRATIS = `Free ElevenLabs plan. What changes:
  - no commercial use: the video cannot go to an ad, a store, a client or a channel that makes money;
  - attribution required: where the video is published, say the voice is from ElevenLabs (elevenlabs.io);
  - the API does not use library voices on this plan: search shows the account's default voices.
You can go on like this. For commercial use or for the library voices, a paid plan.`

async function assinatura() {
  const { dados } = await api('GET', '/v1/user/subscription')
  return dados || {}
}
const restam = (s) => (s.character_limit != null && s.character_count != null ? s.character_limit - s.character_count : null)
const saldo = (s) => `plan ${s.tier ?? '?'} · credits used ${milhar(s.character_count)} of ${milhar(s.character_limit)} (${milhar(restam(s))} left)`

function exigirAutorizacao(autorizacao, base, nome) {
  const arq = autorizacao ? path.resolve(base, autorizacao) : null
  if (!arq || !fs.existsSync(arq) || !fs.statSync(arq).isFile() || fs.statSync(arq).size === 0) {
    throw new Falha(`The voice "${nome}" is a clone made in this account. A clone of a real person's voice only with their written consent.
Keep the signed document (PDF, image or text) in the video folder and point to it in voz.autorizacao in the script
(on samples: --authorization <file>). ${arq ? `Could not find ${arq}, or it is empty.` : 'Without it, nothing is generated.'}`)
  }
}
const ehClone = (e) => e?.categoria === 'cloned' || (e?.categoria === 'professional' && e?.daConta === true)

function avisarSaida(e) {
  if (!e?.disable_at_unix) return
  const dias = Math.ceil((e.disable_at_unix * 1000 - Date.now()) / 864e5)
  console.log(`⚠ The voice ${e.nome ? `"${e.nome}" ` : ''}leaves the library on ${data(e.disable_at_unix)} (${dias > 0 ? `in ${dias} days` : 'already left'}; checked on ${e.consultado.slice(0, 10)}).
  The takes already generated keep working. A new line or --redo with it after that date will not work: finish before or pick another voice.`)
}

// A data de saída da biblioteca aparece em GET /v1/voices/{id} → sharing.disable_at_unix. Uma voz da
// biblioteca ainda não usada na conta responde 400 voice_not_found (medido em 29/09/2026); depois do
// primeiro uso ela passa a responder, com sharing.status "copied" e o aviso prévio gravado na conta.
async function checarVoz(id, { autorizacao, base = '.' } = {}) {
  const { dados, erro, corpo, status } = await api('GET', `/v1/voices/${encodeURIComponent(id)}`, { tolerar: [400, 404] })
  const naoAchou = status === 404 || (status === 400 && /voice_not_found/.test(`${erro?.code ?? ''} ${erro?.status ?? ''}`))
  if (status === 400 && !naoAchou) throw erroApi(status, corpo)
  const v = dados || {}
  const e = {
    consultado: new Date().toISOString(), encontrada: !naoAchou, nome: v.name ?? null, categoria: v.category ?? null,
    daConta: v.is_owner ?? null, disable_at_unix: v.sharing?.disable_at_unix ?? null, notice_period: v.sharing?.notice_period ?? null,
  }
  if (ehClone(e)) exigirAutorizacao(autorizacao, base, e.nome || id)
  avisarSaida(e)
  return e
}

async function falar(pedido, fala) {
  const corpo = { text: pedido.texto, model_id: pedido.modelo, voice_settings: pedido.ajustes }
  if (pedido.anterior) corpo.previous_text = pedido.anterior
  if (pedido.seguinte) corpo.next_text = pedido.seguinte
  const { dados, cab } = await api('POST', `/v1/text-to-speech/${encodeURIComponent(pedido.voz)}/with-timestamps`, {
    consulta: { output_format: pedido.formato }, json: corpo, fala, caracteres: pedido.texto.length,
  })
  if (!dados?.audio_base64 || !dados?.alignment?.characters) throw new Falha(`ElevenLabs answered without audio or without alignment (${fala}).`)
  return { mp3: Buffer.from(dados.audio_base64, 'base64'), alinhamento: dados.alignment, request_id: cab.get('request-id'), custo: num(cab.get('character-cost')) }
}

// Antes de gastar: o teto do vídeo (local, sem rede: estourou, nada é chamado), depois o saldo e a conta.
// Devolve a assinatura (para saber o plano).
async function antesDeGastar(projeto, creditos) {
  antes(projeto, creditos)
  const s = await assinatura()
  console.log(`balance: ${saldo(s)}`)
  const aviso = avisoConta(s)
  if (aviso) console.log(aviso)
  if (gratis(s)) console.log(AVISO_GRATIS)
  return s
}
const dicaGratis = (e, s) => { if (gratis(s) && e instanceof Falha && e.status >= 400 && e.status < 500) e.message += '\nOn the free plan the API does not use library voices: pick a default voice (voice.mjs search --default).'; return e }

// ── alinhamento forçado ──────────────────────────────────────────────────────────────────────────
// A ElevenLabs alinha o áudio ao texto depois de pronto (cerca de 1 crédito por chamada). As palavras do `texto` ditas,
// sem a marcação, voltam com início e fim; `grupos` devolve cada palavra exibida ao seu grupo de ditas.
export function ditasForcadas(words, total) {
  const ws = (words || []).filter((w) => normalizar(w.text))
  const certa = ws.length === total ? ws : ws.filter((w) => /[\p{L}\p{N}]/u.test(w.text))
  return certa.length === total ? certa.map((w) => ({ texto: w.text, ini: w.start, fim: w.end })) : null
}
async function alinharForcado(wav, ditas, fala) {
  const form = new FormData()
  form.append('file', new Blob([fs.readFileSync(wav)], { type: 'audio/wav' }), path.basename(wav))
  form.append('text', ditas.join(' '))
  const { dados, cab } = await api('POST', '/v1/forced-alignment', { form, fala })
  return { words: dados?.words || [], loss: dados?.loss ?? null, custo: num(cab.get('character-cost')) }
}

// ── comandos ─────────────────────────────────────────────────────────────────────────────────────
async function cmdAccount(a) {
  const s = await assinatura()
  const ativa = contaAtiva(s)
  if (a.json) return console.log(JSON.stringify({ tier: s.tier, status: s.status, active: ativa, used: s.character_count, limit: s.character_limit, left: restam(s), renews_unix: s.next_character_count_reset_unix ?? null, free: gratis(s) }))
  console.log(saldo(s))
  const renova = s.next_character_count_reset_unix
  console.log(`status ${s.status ?? '?'}${ativa ? ' (active)' : ''}${renova ? ` · ${renova * 1000 < Date.now() ? 'renewal was due on' : 'renews on'} ${data(renova)}` : ''}${s.voice_limit != null ? ` · voices in the account ${s.voice_slots_used ?? '?'} of ${s.voice_limit}` : ''}`)
  const aviso = avisoConta(s)
  if (aviso) console.log(aviso)
  if (gratis(s)) console.log(AVISO_GRATIS)
}

const ORDENS = ['usage_character_count_1y', 'trending', 'cloned_by_count', 'created_date']
// Regras de uso num vídeo: aviso prévio ≥ 180 dias (nunca "sem aviso"), sem tarifa especial, sem
// moderação ao vivo, sem voz de famoso.
export function motivoFora(v, avisoMin = AVISO_MIN) {
  if (v.category === 'famous') return 'celebrity voice'
  if (!(v.notice_period >= avisoMin)) return v.notice_period ? `${v.notice_period}-day notice` : 'no notice period'
  if ((v.rate != null && v.rate > 1) || (v.fiat_rate != null && v.fiat_rate > 0)) return 'custom rate'
  if (v.live_moderation_enabled) return 'live moderation'
  return null
}

function linhaVoz(v, i, idioma = '') {
  const todos = [...new Set((v.verified_languages || []).map((l) => `${l.locale || l.language}${l.accent ? ` (${l.accent})` : ''}`))]
  const doIdioma = todos.filter((x) => idioma && x.toLowerCase().startsWith(idioma.toLowerCase()))
  const primeiros = [...doIdioma, ...todos.filter((x) => !doIdioma.includes(x))].slice(0, Math.max(3, doIdioma.length))
  const idiomas = todos.length > primeiros.length ? [...primeiros, `+${todos.length - primeiros.length}`] : primeiros
  const tags = [v.locale || v.language, v.accent, v.gender, v.age, v.descriptive, v.use_case].filter(Boolean).join(' · ')
  return [
    `${String(i + 1).padStart(2)}. ${v.name}  [${v.voice_id}]`,
    `    ${tags}${v.notice_period != null ? ` · notice ${v.notice_period} days` : ''}${v.usage_character_count_1y != null ? ` · ${milhar(v.usage_character_count_1y)} characters/year` : ''}${v.cloned_by_count != null ? ` · ${milhar(v.cloned_by_count)} saves` : ''}`,
    ...(v.description ? [`    ${String(v.description).replace(/\s+/g, ' ').slice(0, 140)}`] : []),
    ...(idiomas.length ? [`    verified languages: ${idiomas.join(', ')}`] : []),
    ...(v.preview_url ? [`    preview: ${v.preview_url}`] : []),
  ].join('\n')
}

async function listarPadrao(a) {
  const { dados } = await api('GET', '/v2/voices', { consulta: { voice_type: 'default', page_size: 100 } })
  const idioma = (a.language || '').toLowerCase()
  const vozes = (dados?.voices || []).map((v) => ({ ...v, ...(v.labels || {}), use_case: v.labels?.use_case }))
    .filter((v) => !idioma || (v.verified_languages || []).some((l) => (l.language || '').toLowerCase() === idioma) || (v.language || '').toLowerCase() === idioma)
  if (a.json) return console.log(JSON.stringify(vozes, null, 1))
  console.log(`Default voices of the account${idioma ? ` that speak "${idioma}"` : ''}: ${vozes.length}`)
  vozes.slice(0, num(a.n) ?? 50).forEach((v, i) => console.log(linhaVoz(v, i, a.language)))
}

async function cmdSearch(a) {
  if (a.default) return listarPadrao(a)
  const s = await assinatura()
  if (gratis(s)) { console.log(AVISO_GRATIS); return listarPadrao(a) }
  const ordem = a.sort || 'usage_character_count_1y'
  if (!ORDENS.includes(ordem)) throw new Falha(`--sort must be ${ORDENS.join(', ')}`, 2)
  const avisoMin = num(a['min-notice']) ?? AVISO_MIN
  const { dados } = await api('GET', '/v1/shared-voices', {
    consulta: {
      page_size: 100, sort: ordem, language: a.language, locale: a.locale, accent: a.accent, gender: a.gender, age: a.age,
      search: a.query, use_cases: lista(a['use-case']), descriptives: lista(a.descriptive), category: a.category,
      min_notice_period_days: avisoMin, include_custom_rates: false, include_live_moderated: false,
    },
  })
  const todas = dados?.voices || []
  const fora = {}
  const boas = todas.filter((v) => { const m = motivoFora(v, avisoMin); if (m) fora[m] = (fora[m] || 0) + 1; return !m })
  if (a.previews) {   // prévias da biblioteca: grátis, servem para o `compare` antes de gastar crédito
    const dir = path.resolve(a.previews); fs.mkdirSync(dir, { recursive: true })
    const nomes = {}
    for (const v of boas.slice(0, num(a.n) ?? 40)) {
      if (!v.preview_url) continue
      nomes[v.voice_id] = v.name
      const arq = path.join(dir, `${v.voice_id}.mp3`)
      if (!fs.existsSync(arq)) { const r = await fetch(v.preview_url); if (r.ok) fs.writeFileSync(arq, Buffer.from(await r.arrayBuffer())) }
    }
    fs.writeFileSync(path.join(dir, 'names.json'), JSON.stringify(nomes, null, 1))
    console.log(`${Object.keys(nomes).length} previews in ${dir} (free). Next: voice.mjs compare --ref <excerpt> ${dir}`)
  }
  if (a.json) return console.log(JSON.stringify(boas, null, 1))
  console.log(`${todas.length} voices in the search · ${boas.length} usable in a video${Object.keys(fora).length ? ` · left out: ${Object.entries(fora).map(([m, n]) => `${n} (${m})`).join(', ')}` : ''}`)
  boas.slice(0, num(a.n) ?? 12).forEach((v, i) => console.log(linhaVoz(v, i, a.language)))
  if (!boas.length) console.log('No voice passed the rules. Loosen a filter (accent, age, use case) or go to plan B: Voice Design (references/voice-choice.md).')
}

const slug = (s) => String(s).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'voice'
const relProjeto = (projeto, arq) => path.relative(projeto, arq).split(path.sep).join('/')

async function cmdSamples(a) {
  const vozes = lista(a.voices)
  if (!vozes.length) throw new Falha('usage: voice.mjs samples (--script script.json [--line id] | --phrase "…" [--profile calmo] [--model eleven_multilingual_v2]) --voices id1,id2,id3 [--out folder] [--project folder]', 2)
  let frase, ajustes, modelo, rotulo
  if (a.script) {
    const rot = lerRoteiro(a.script, { precisaVoz: false })
    const f = a.line ? rot.falas.find((x) => x.id === a.line) : rot.falas[0]
    if (!f) throw new Falha(`Could not find line ${a.line} in the script.`)
    modelo = rot.modelo
    frase = comEmocao(aplicarPronuncia(f.texto, { ...rot.pronuncia, ...(f.pronuncia || {}) }).falado, f.emocao ?? rot.emocao, modelo)
    ajustes = ajustesDoModelo(rot.ajustes, modelo); rotulo = `${f.id} · ${rot.perfil}`
  } else if (a.phrase) {
    const perfil = a.profile || 'calmo'
    if (!PERFIS[perfil]) throw new Falha(`--profile must be ${Object.keys(PERFIS).join(' or ')}`, 2)
    modelo = a.model || MODELO
    frase = normalizar(a.phrase); ajustes = ajustesDoModelo(PERFIS[perfil], modelo); rotulo = `${perfil} · ${modelo}`
  } else throw new Falha('Say the sentence: --script <script.json> (uses the 1st line) or --phrase "…".', 2)
  const projeto = acharProjeto(a.project, a.out, a.script)
  const saida = path.resolve(a.out || (a.script ? path.join(path.dirname(a.script), 'samples') : path.join(projeto, 'voice', 'samples')))
  const takes = pastaTakes(path.join(saida, '_takes'))
  if (!estado.registro) estado.registro = path.join(takes, 'calls.jsonl')
  const plano = vozes.map((voz) => { const pedido = { texto: frase, voz, modelo, ajustes, formato: FORMATO }; return { voz, pedido, chave: chaveTake(pedido) } })
  const falta = plano.filter((p) => !lerTake(takes, p.chave))
  const porVoz = Math.ceil(frase.length * creditosPorLetra(modelo))
  console.log(`"${frase}" (${rotulo}) · ${vozes.length} voices · ${plano.length - falta.length} in the cache · ${falta.length * frase.length} new characters`)
  if (falta.length) {
    const s = await antesDeGastar(projeto, falta.length * porVoz)
    for (const p of falta) {
      antes(projeto, porVoz)
      let ev = await checarVoz(p.voz, { autorizacao: a.authorization, base: process.cwd() })
      const t = await falar(p.pedido, p.voz).catch((e) => { throw dicaGratis(e, s) })
      if (!ev.encontrada) ev = await checarVoz(p.voz, { autorizacao: a.authorization, base: process.cwd() })
      const mp3 = guardarTake(takes, p.chave, t.mp3, { chave: p.chave, pedido: p.pedido, request_id: t.request_id, data: new Date().toISOString(), custo: t.custo, caracteres: frase.length, alinhamento: t.alinhamento, voz_estado: ev })
      anotar(projeto, { custo: t.custo, estimado: porVoz, model: modelo, label: `sample · ${ev.nome || p.voz}`, files: [mp3] })
      console.log(`  ${ev.nome || p.voz}: cost ${t.custo ?? '?'}`)
    }
  }
  const linhas = ['| # | Voice | voice_id | File | Duration | Characters/s |', '|---|---|---|---|---|---|']
  const opcoes = []
  plano.forEach((p, i) => {
    const t = lerTake(takes, p.chave)
    const nome = t.voz_estado?.nome || p.voz
    const arq = `${i + 1}-${slug(nome)}.mp3`
    fs.copyFileSync(t.mp3, path.join(saida, arq))
    const tmp = path.join(os.tmpdir(), `voice-${process.pid}-${p.chave}.wav`)
    mp3ParaWav(t.mp3, tmp)
    limparInicio(tmp)
    const w = lerWav(tmp); fs.rmSync(tmp, { force: true })
    const ini = inicioVoz(w.amostras, w.taxa) ?? 0, fim = palavrasDoAlinhamento(t.alinhamento).at(-1)?.fim ?? w.n / w.taxa
    const cps = frase.length / Math.max(0.1, fim - ini)
    linhas.push(`| ${i + 1} | ${nome} | ${p.voz} | ${arq} | ${(w.n / w.taxa).toFixed(2)} s | ${cps.toFixed(1)} |`)
    opcoes.push({ voice: p.voz, name: nome, audio: relProjeto(projeto, path.join(saida, arq)), seconds: r3(w.n / w.taxa), charsPerSecond: r3(cps), credits: t.custo ?? null })
  })
  fs.writeFileSync(path.join(saida, 'samples.json'), JSON.stringify({ phrase: frase, label: rotulo, model: modelo, options: opcoes }, null, 1) + '\n')
  console.log(`${linhas.join('\n')}\n→ ${path.join(saida, 'samples.json')}\nNobody has listened to these samples yet: whoever chooses is whoever listens.`)
}

async function cmdGenerate(a) {
  const arq = a._[0]
  if (!arq || !a.out) throw new Falha('usage: voice.mjs generate <script.json> --out <video folder>/voice/<version> [--redo id,id] [--accept-text] [--project folder]', 2)
  const vb = await canalDoApp()
  await vb?.checarDono({ onde: 'generate the voice' })
  const rot = lerRoteiro(arq)
  const saida = path.resolve(a.out)
  const projeto = acharProjeto(a.project, saida, arq)
  const takes = pastaTakes(a.takes || path.join(path.dirname(saida), '_takes'))
  if (!estado.registro) estado.registro = path.join(takes, 'calls.jsonl')
  const baseRot = path.dirname(path.resolve(arq))
  const plano = planejar(rot)
  const refazer = new Set(lista(a.redo))
  for (const id of refazer) if (!plano.some((p) => p.fala.id === id)) throw new Falha(`--redo ${id}: there is no line with that id in the script.`, 2)
  const falta = plano.filter((p) => refazer.has(p.fala.id) || !lerTake(takes, p.chave))
  const novos = falta.reduce((s, p) => s + p.pedido.texto.length, 0)
  const porFala = (p) => Math.ceil(p.pedido.texto.length * creditosPorLetra(rot.modelo))
  // No v3 e no v4 cada fala nova ainda passa pelo alinhamento forçado (~1 crédito).
  const alinhar = comMarcacao(rot.modelo) ? CREDITOS_ALINHAR : 0
  const estimado = falta.reduce((s, p) => s + porFala(p) + alinhar, 0)
  console.log(`${plano.length} lines · ${plano.length - falta.length} in the cache · ${falta.length} to generate · ${novos} new characters${falta.length ? ` · about ${estimado} credits` : ''}`)
  // Só o que vai ser gerado passa pela revisão: o que vem do cache já foi aprovado e ouvido, e os exemplos prontos não quebram.
  if (falta.length) {
    const achados = revisarFalas(rot, falta.map((p) => p.fala))
    const erros = achados.filter((x) => x.nivel === 'erro'), avisos = achados.length - erros.length
    if (erros.length && !a['accept-text']) {
      throw new Falha(`The text of ${new Set(erros.map((x) => x.fala)).size} line(s) has a writing tic, and nothing was spent:
${erros.map(linhaAchado).join('\n')}
Change the sentence in the script and run again (\`voice.mjs review ${arq}\` also shows the warnings).
If the person wants the sentence like this, on purpose: --accept-text.`, 3)
    }
    if (erros.length) console.log(`text accepted on purpose (--accept-text): ${erros.length} writing error(s) stay in the script`)
    if (avisos) console.log(`text review: ${avisos} warning(s), which do not stop generate (\`voice.mjs review ${arq}\` shows them)`)
  }
  await vb?.avisar('voz', `generating the voice: ${plano.length} lines, ${falta.length} new`)
  let ev = plano.map((p) => lerTake(takes, p.chave)?.voz_estado).find(Boolean) || null
  if (ev && ehClone(ev)) exigirAutorizacao(rot.voz.autorizacao, baseRot, ev.nome || rot.voz.id)
  let custo = 0, semCusto = 0
  if (falta.length) {
    const s = await antesDeGastar(projeto, estimado)
    ev = await checarVoz(rot.voz.id, { autorizacao: rot.voz.autorizacao, base: baseRot })
    for (const p of falta) {
      antes(projeto, porFala(p))
      if (refazer.has(p.fala.id)) { const velho = aposentarTake(takes, p.chave); if (velho) console.log(`  ${p.fala.id}: old take kept in ${path.relative(takes, velho)}`) }
      const t = await falar(p.pedido, p.fala.id).catch((e) => { throw dicaGratis(e, s) })
      if (!ev.encontrada) ev = await checarVoz(rot.voz.id, { autorizacao: rot.voz.autorizacao, base: baseRot })
      const mp3 = guardarTake(takes, p.chave, t.mp3, {
        chave: p.chave, fala: p.fala.id, texto: p.fala.texto, pedido: p.pedido, request_id: t.request_id, data: new Date().toISOString(),
        custo: t.custo, caracteres: p.pedido.texto.length, alinhamento: t.alinhamento, voz_estado: ev,
      })
      anotar(projeto, { custo: t.custo, estimado: porFala(p), model: rot.modelo, label: `line ${p.fala.id}`, files: [mp3] })
      if (t.custo == null) semCusto++; else custo += t.custo
      console.log(`  ${p.fala.id.padEnd(11)} ${String(p.pedido.texto.length).padStart(3)} characters · cost ${t.custo ?? '?'} · ${p.pedido.texto}`)
    }
  } else if (ev) avisarSaida(ev)
  fs.mkdirSync(path.join(saida, 'lines'), { recursive: true })
  const falas = []
  for (const p of plano) {
    const t = lerTake(takes, p.chave)
    const rel = `lines/${p.fala.id}.wav`
    mp3ParaWav(t.mp3, path.join(saida, rel))
    const zerado = limparInicio(path.join(saida, rel))
    if (zerado) console.log(`  ${p.fala.id}: click before the voice zeroed (${Math.round(zerado * 1000)} ms from the start)`)
    const aparado = apararFim(path.join(saida, rel))
    if (aparado) console.log(`  ${p.fala.id}: ${aparado.toFixed(2)} s of leftover silence at the end, trimmed`)
    // Os tempos do v3 e do v4 saem até 260 ms adiantados (medido em 04/10/2026): para eles vale o alinhamento forçado do WAV pronto.
    let forcado = null
    if (comMarcacao(rot.modelo)) {
      forcado = t.forcado ?? null
      if (!forcado) {
        antes(projeto, CREDITOS_ALINHAR)
        const r = await alinharForcado(path.join(saida, rel), p.pron.ditas.flatMap((d) => d.split(' ')), p.fala.id)
        anotar(projeto, { custo: r.custo, estimado: CREDITOS_ALINHAR, model: 'forced-alignment', label: `alignment ${p.fala.id}` })
        forcado = ditasForcadas(r.words, p.pron.grupos.reduce((n, g) => n + g, 0))
        if (forcado) guardarForcado(takes, p.chave, forcado)
        else console.log(`  ${p.fala.id}: the forced alignment did not match the text; the times the voice returned stay (they can be up to 260 ms early)`)
      }
    }
    const { acertos, ...fala } = montarFala({ fala: p.fala, pron: p.pron, alinhamento: t.alinhamento, forcado, wav: path.join(saida, rel), arquivo: rel })
    for (const m of acertos) console.log(`  ${p.fala.id}: "${m.texto}" ${m.campo === 'ini' ? 'starts' : 'ends'} at ${m.para} s by the measured voice (the alignment said ${m.de} s)`)
    falas.push(fala)
  }
  const loc = { versao: 1, idioma: rot.idioma, voz: { provedor: 'elevenlabs', id: rot.voz.id, nome: rot.voz.nome || ev?.nome || null, modelo: rot.modelo, ajustes: rot.ajustes }, falas }
  const erros = validarLocucao(loc, saida)
  if (erros.length) throw new Falha(`The generated narration did not pass Contract L:\n${erros.map((e) => `  - ${e}`).join('\n')}`)
  fs.writeFileSync(path.join(saida, 'narration.json'), JSON.stringify(loc, null, 1) + '\n')
  const voz = falas.reduce((s, f) => s + f.palavras.at(-1).fim - f.inicio_voz, 0)
  console.log(`✓ ${path.join(saida, 'narration.json')} · ${falas.length} lines · ${r3(voz)} s of voice`)
  if (falta.length) console.log(`real cost (character-cost header): ${r3(custo)}${semCusto ? ` · ${semCusto} call(s) without the header` : ''} for ${novos} characters · noted in ${path.join(projeto, 'costs.jsonl')}`)
  await vb?.avisar('voz', `voice ready: ${falas.length} lines, ${r3(voz)} s`)
  // um arquivo só toca direto no painel; com várias falas, a etapa basta
  if (falas.length === 1) await vb?.tocar(path.join(saida, falas[0].arquivo), `Voice: ${falas[0].texto}`)
}

async function cmdCheck(a) {
  const arq = a._[0]
  if (!arq) throw new Falha('usage: voice.mjs check <narration.json> [--tolerance 0.08] [--line id] [--detail] [--project folder]', 2)
  const base = path.dirname(path.resolve(arq))
  const loc = lerJson(path.resolve(arq), 'the narration')
  const erros = validarLocucao(loc, base)
  if (erros.length) throw new Falha(`The narration does not pass Contract L; fix it before checking:\n${erros.map((e) => `  - ${e}`).join('\n')}`)
  const tol = num(a.tolerance) ?? TOLERANCIA
  const falas = a.line ? loc.falas.filter((f) => lista(a.line).includes(f.id)) : loc.falas
  if (!falas.length) throw new Falha(`--line ${a.line}: there is no line with that id in the narration.`, 2)
  const projeto = acharProjeto(a.project, arq)
  antes(projeto, falas.length * CREDITOS_ALINHAR)
  let ruins = 0, pior = 0
  for (const f of falas) {
    const ditas = f.palavras.map((p) => p.dito ?? p.texto)
    antes(projeto, CREDITOS_ALINHAR)
    const r = await alinharForcado(path.resolve(base, f.arquivo), ditas, f.id)
    anotar(projeto, { custo: r.custo, estimado: CREDITOS_ALINHAR, model: 'forced-alignment', label: `check ${f.id}` })
    const grupos = ditas.map((d) => d.split(' ').length)
    const ws = r.words.filter((w) => normalizar(w.text))
    const flat = ditasForcadas(r.words, grupos.reduce((n, g) => n + g, 0))
    const alinhadas = flat && agrupar(flat, grupos, f.palavras.map((p) => p.texto))
    if (!alinhadas) { ruins++; console.log(`✗ ${f.id}: the forced alignment returned ${ws.length} words for ${grupos.reduce((s, n) => s + n, 0)} spoken (${ws.map((w) => w.text).join(' ')})`); continue }
    // A 1ª palavra é julgada contra o primeiro som medido; as outras, contra o ini do narration.json.
    const d = alinhadas.map((x, i) => ({ texto: f.palavras[i].texto, ini: x.ini - (i ? f.palavras[i].ini : f.inicio_voz), fim: x.fim - f.palavras[i].fim }))
    const fora = d.filter((x) => Math.abs(x.ini) > tol + 1e-9)
    const maior = d.reduce((m, x) => (Math.abs(x.ini) > Math.abs(m.ini) ? x : m))
    const fimMeio = d.slice(0, -1).reduce((m, x) => Math.max(m, Math.abs(x.fim)), 0)
    pior = Math.max(pior, Math.abs(maior.ini))
    if (fora.length) ruins++
    console.log(`${fora.length ? '✗' : '✓'} ${f.id.padEnd(11)} ${d.length} words · largest deviation at the start ${Math.round(maior.ini * 1000)} ms ("${maior.texto}") · end, informative only: ${Math.round(fimMeio * 1000)} ms${r.loss != null ? ` · loss ${r3(r.loss)}` : ''}`)
    for (const x of fora) console.log(`    "${x.texto}" starts ${Math.round(Math.abs(x.ini) * 1000)} ms ${x.ini > 0 ? 'after' : 'before'} where the caption lights up`)
    if (a.detail) alinhadas.forEach((x, i) => console.log(`    ${f.palavras[i].texto.padEnd(14)} caption ${(i ? f.palavras[i].ini : f.inicio_voz).toFixed(3)} · forced alignment ${x.ini.toFixed(3)}–${x.fim.toFixed(3)} · deviation ${Math.round(d[i].ini * 1000)} ms`))
  }
  console.log(`${ruins ? '✗' : '✓'} ${falas.length - ruins} of ${falas.length} lines with every word within ±${Math.round(tol * 1000)} ms · worst ${Math.round(pior * 1000)} ms`)
  return ruins ? 1 : 0
}

// ── listen: a transcrição confere a pronúncia ────────────────────────────────────────────────────
// Sem keyterms de propósito: enviesar a transcrição para a palavra certa esconderia a palavra errada.
export const MODELO_STT = 'scribe_v2'
export const chaveOuvida = (t) => String(t ?? '').normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim()

// A transcrição escreve "12" e "1.248" onde a fala diz "doze" e "mil duzentas e quarenta e oito": os dois lados
// viram extenso no masculino antes de comparar (português; em outro idioma o algarismo só bate com algarismo).
const UNID = ['zero', 'um', 'dois', 'tres', 'quatro', 'cinco', 'seis', 'sete', 'oito', 'nove', 'dez', 'onze', 'doze', 'treze', 'quatorze', 'quinze', 'dezesseis', 'dezessete', 'dezoito', 'dezenove']
const DEZ = ['', '', 'vinte', 'trinta', 'quarenta', 'cinquenta', 'sessenta', 'setenta', 'oitenta', 'noventa']
const CEM = ['', 'cento', 'duzentos', 'trezentos', 'quatrocentos', 'quinhentos', 'seiscentos', 'setecentos', 'oitocentos', 'novecentos']
function ate999(n) {
  if (n < 20) return UNID[n]
  if (n < 100) return DEZ[Math.floor(n / 10)] + (n % 10 ? ' e ' + UNID[n % 10] : '')
  if (n === 100) return 'cem'
  return CEM[Math.floor(n / 100)] + (n % 100 ? ' e ' + ate999(n % 100) : '')
}
export function porExtenso(n) {
  if (!Number.isSafeInteger(n) || n < 0 || n > 999999) return String(n)
  const mil = Math.floor(n / 1000), resto = n % 1000
  if (!mil) return ate999(resto)
  const m = mil === 1 ? 'mil' : `${ate999(mil)} mil`
  return resto ? `${m}${resto < 100 || resto % 100 === 0 ? ' e' : ''} ${ate999(resto)}` : m
}
const extenso = (t) => String(t ?? '').replace(/\d{1,3}(?:\.\d{3})+(?![\d.])|\d+/g, (x) => ` ${porExtenso(Number(x.replace(/\./g, '')))} `)
const masculino = (f) => f === 'uma' ? 'um' : f === 'duas' ? 'dois' : f.replace(/entas$/, 'entos')
const fichas = (t) => chaveOuvida(extenso(t)).split(' ').filter(Boolean).map(masculino)

// Endereço ("marca.com/7") é palavra de risco que a transcrição grafa do jeito dela ("marka.com/7"):
// vale uma letra de diferença em cada pedaço de 6 letras ou mais.
const umaLetra = (a, b) => {
  if (a === b) return true
  if (Math.abs(a.length - b.length) > 1 || Math.min(a.length, b.length) < 6) return false
  let i = 0
  while (i < a.length && a[i] === b[i]) i++
  return a.slice(i + (a.length >= b.length ? 1 : 0)) === b.slice(i + (b.length >= a.length ? 1 : 0))
}

// Para cada ficha esperada, o índice da ficha ouvida que casou com ela pela maior subsequência comum (a ordem conta), ou −1.
export function alinharFichas(esperadas, ouvidas) {
  const n = esperadas.length, m = ouvidas.length
  const L = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0))
  for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--) L[i][j] = esperadas[i] === ouvidas[j] ? L[i + 1][j + 1] + 1 : Math.max(L[i + 1][j], L[i][j + 1])
  const par = new Array(n).fill(-1)
  for (let i = 0, j = 0; i < n && j < m;) {
    if (esperadas[i] === ouvidas[j]) { par[i] = j; i++; j++ } else if (L[i + 1][j] >= L[i][j + 1]) i++; else j++
  }
  return par
}
// Quais fichas esperadas a transcrição não trouxe.
export const faltasNaEscuta = (esperadas, ouvidas) => alinharFichas(esperadas, ouvidas).map((j) => j >= 0)

// Uma fala: o que se esperava ouvir contra o que a transcrição ouviu. A transcrição escreve a palavra de verdade
// ("Vyrta") ou o som dela ("Virta"), nunca a grafia do mapa ("Vírta"): a palavra de risco vale se aparecer como está no
// texto OU como foi dita. Palavra de risco = a que tem `dito` no narration.json ou está em --words; faltou uma, a
// fala falha. As outras palavras só informam.
export function julgarEscuta(fala, ouvido, extras = []) {
  const extrasK = new Set(extras.flatMap(fichas))
  const ouvidas = fichas(ouvido), tem = new Set(ouvidas)
  const grupos = fala.palavras.map((p) => ({ p, texto: fichas(p.texto), dito: p.dito != null ? fichas(p.dito) : null, risco: p.dito != null || fichas(p.texto).some((f) => extrasK.has(f)) }))
  const achada = faltasNaEscuta(grupos.flatMap((g) => g.texto), ouvidas)
  let k = 0
  const faltas = []
  const formas = (g) => [g.texto, g.dito].filter(Boolean)
  // a transcrição às vezes gruda duas palavras ("AcmeNotes"): vale a junção com a vizinha, em qualquer das formas
  const grudada = (i) => [i - 1, i + 1].some((j) => grupos[j] && formas(grupos[Math.min(i, j)]).some((a) => formas(grupos[Math.max(i, j)])
    .some((b) => tem.has([...a, ...b].join('')))))
  for (const [gi, g] of grupos.entries()) {
    const naOrdem = g.texto.every((_, i) => achada[k + i])
    k += g.texto.length
    const endereco = /[./]\S/.test(g.p.texto) && g.texto.every((f) => ouvidas.some((o) => umaLetra(f, o)))
    const ok = g.risco ? formas(g).some((fs) => fs.length && fs.every((f) => tem.has(f))) || grudada(gi) || endereco : naOrdem
    if (!ok) faltas.push({ texto: g.p.texto, esperado: g.p.dito ?? g.p.texto, risco: g.risco })
  }
  return { riscos: grupos.filter((g) => g.risco).map((g) => g.p.texto), faltas, falhou: faltas.some((f) => f.risco) }
}

// ── listen --mix: o MP4 final, já com a trilha e os efeitos, ainda deixa entender cada palavra? ────
// O `listen` de cada fala prova a pronúncia na voz limpa; este prova o mix: a música ou um efeito por cima da palavra
// some com ela, e a medida de nível (voz ≥ 12 dB acima) não vê isso. Reprova (o vídeo não vai à pessoa) com menos de 90%
// das palavras do roteiro ouvidas, com uma palavra de risco faltando, ou com 3 palavras seguidas perdidas.
export const LIMIAR_MIX = 0.9
export const SEGUIDAS_MIX = 3

// As falas como o `julgarEscuta` lê ({ id, palavras: [{ texto, dito? }] }), de um narration.json ou de um script.json
// (o roteiro aplica o mapa `pronuncia`, e a marcação do v3/v4 fica de fora).
export function falasParaOuvir(arq) {
  const j = lerJson(path.resolve(arq), 'the script or the narration')
  if (Array.isArray(j.falas) && j.falas.length && j.falas.every((f) => Array.isArray(f?.palavras))) {
    return { idioma: j.idioma, falas: j.falas.map((f) => ({ id: f.id, palavras: f.palavras.map((p) => ({ texto: p.texto, ...(p.dito != null ? { dito: p.dito } : {}) })) })) }
  }
  const rot = lerRoteiro(arq, { precisaVoz: false })
  return {
    idioma: rot.idioma,
    falas: rot.falas.map((f) => {
      const pr = aplicarPronuncia(f.texto, { ...rot.pronuncia, ...(f.pronuncia || {}) })
      return { id: f.id, palavras: pr.exibidas.map((t, i) => ({ texto: t, ...(pr.ditas[i] !== t ? { dito: pr.ditas[i] } : {}) })) }
    }),
  }
}

// O roteiro inteiro contra a transcrição do mix (a resposta da API: { text, words: [{ text, start, end, type }] }).
// Primeiro na ordem (a maior subsequência comum); o que sobra vale fora de ordem, porque o vídeo pode tocar os pedaços de
// uma fala em outra ordem, como a palavra de risco do `julgarEscuta` (dita, grudada na vizinha, endereço com uma letra).
// O trecho perdido fica entre o fim da última palavra ouvida antes dele e o começo da primeira ouvida depois.
export function julgarMix(falas, resposta, extras = [], { limiar = LIMIAR_MIX, seguidas = SEGUIDAS_MIX } = {}) {
  const extrasK = new Set(extras.flatMap(fichas))
  const ws = Array.isArray(resposta?.words) && resposta.words.length ? resposta.words.filter((w) => !w.type || w.type === 'word') : [{ text: resposta?.text ?? '' }]
  const ouv = ws.flatMap((w) => fichas(w.text).map((t) => ({ t, ini: w.start ?? null, fim: w.end ?? null })))
  const grupos = falas.flatMap((f) => f.palavras.map((p) => ({
    fala: f.id, texto: p.texto, tk: fichas(p.texto), dito: p.dito != null ? fichas(p.dito) : null,
    risco: p.dito != null || fichas(p.texto).some((x) => extrasK.has(x)), idx: null,
  }))).filter((g) => g.tk.length)
  const usada = new Array(ouv.length).fill(false)
  const marcar = (g, idx) => { g.idx = idx; for (const j of idx) usada[j] = true }
  // as fichas de uma palavra ("7.129", "marca.com/7") saem juntas da transcrição: só valem em sequência
  const seguidasNaOuvida = (js) => js.every((j, i) => j >= 0 && (!i || j === js[i - 1] + 1))
  const par = alinharFichas(grupos.flatMap((g) => g.tk), ouv.map((o) => o.t))
  let k = 0
  for (const g of grupos) { const js = par.slice(k, (k += g.tk.length)); if (seguidasNaOuvida(js)) marcar(g, js) }
  const pegar = (forma, igual = (a, b) => a === b) => {
    for (let i = 0; forma.length && i + forma.length <= ouv.length; i++) {
      if (forma.every((t, n) => !usada[i + n] && igual(t, ouv[i + n].t))) return forma.map((_, n) => i + n)
    }
    return null
  }
  const formas = (g) => [g.tk, g.dito].filter(Boolean)
  for (const [gi, g] of grupos.entries()) {
    if (g.idx) continue
    const idx = formas(g).map((f) => pegar(f)).find(Boolean) || (/[./]\S/.test(g.texto) ? pegar(g.tk, umaLetra) : null)
    if (idx) { marcar(g, idx); continue }
    for (const v of [gi - 1, gi + 1]) {
      const [a, b] = [grupos[Math.min(gi, v)], grupos[Math.max(gi, v)]]
      if (!a || !b || (a !== g && a.idx) || (b !== g && b.idx)) continue
      const j = formas(a).flatMap((x) => formas(b).map((y) => [...x, ...y].join(''))).map((t) => ouv.findIndex((o, i) => !usada[i] && o.t === t)).find((x) => x >= 0)
      if (j != null) { marcar(a, [j]); b.idx = [j]; break }
    }
  }
  const tempo = (g, lado) => {
    const ts = (g?.idx || []).map((j) => ouv[j][lado]).filter((v) => v != null)
    return ts.length ? r3(lado === 'ini' ? Math.min(...ts) : Math.max(...ts)) : null
  }
  const trechos = []
  for (let i = 0; i < grupos.length; i++) {
    if (grupos[i].idx) continue
    let j = i
    while (j < grupos.length && !grupos[j].idx) j++
    let de = i ? tempo(grupos[i - 1], 'fim') : null, ate = j < grupos.length ? tempo(grupos[j], 'ini') : null
    if (de != null && ate != null && de > ate) [de, ate] = [ate, de]
    const gs = grupos.slice(i, j)
    trechos.push({ falas: [...new Set(gs.map((g) => g.fala))], palavras: gs.map((g) => g.texto), risco: gs.filter((g) => g.risco).map((g) => g.texto), de, ate })
    i = j - 1
  }
  const ouvidas = grupos.filter((g) => g.idx).length, pct = grupos.length ? ouvidas / grupos.length : 1
  const faltaRisco = grupos.filter((g) => g.risco && !g.idx).map((g) => g.texto)
  const longos = trechos.filter((t) => t.palavras.length >= seguidas)
  const motivos = [
    ...(pct < limiar ? [`${pctTxt(pct)} of the script's words heard, below ${pctTxt(limiar)}`] : []),
    ...(faltaRisco.length ? [`risk word that does not appear: ${faltaRisco.map((t) => `"${t}"`).join(', ')}`] : []),
    ...(longos.length ? [`${longos.length} stretch(es) with ${seguidas} or more words in a row lost`] : []),
  ]
  return { total: grupos.length, ouvidas, pct, limiar, riscos: grupos.filter((g) => g.risco).map((g) => g.texto), faltaRisco, trechos, reprovou: motivos.length > 0, motivos, texto: normalizar(resposta?.text) }
}
const pctTxt = (p) => `${Math.round(p * 1000) / 10}%`
const segTxt = (v) => (v == null ? '?' : `${v.toFixed(2)} s`)
const ondePerdeu = (t) => (t.de == null && t.ate == null ? 'no time' : t.de == null ? `before ${segTxt(t.ate)}` : t.ate == null ? `after ${segTxt(t.de)}` : `between ${segTxt(t.de)} and ${segTxt(t.ate)}`)

export const O_QUE_FAZER_MIX = `What to do, in this order:
  1. Listen to each lost stretch in the MP4. If the narration alone also loses the word (\`voice.mjs listen <narration.json>\`), it is the
     take, not the mix: fix the \`pronuncia\` map and \`generate --redo <id>\`.
  2. Sound effect on top of the word (whoosh, impacto, riser, sucesso, virada): remove the marker or move it in the sheet
     (\`verify.py\` lists each effect that plays under the speech).
  3. Music over the voice: lower the soundtrack under the speech. The \`calmo\` profile ducks 11 dB, \`reels\` 9; or lower the
     music in the soundtrack identity.
  4. Redo the mix (the arrangement, through the video's compose or assemble) and run \`listen --mix\` again.`

// Transcrição de um arquivo (custo pela duração), com o teto antes e o custo anotado depois.
async function transcrever(projeto, arq, { idioma, fala, rotulo }) {
  const seg = (() => { try { const w = lerWav(arq); return w.n / w.taxa } catch { return null } })()
  const estimado = creditosStt(seg ?? 10)
  antes(projeto, estimado)
  const form = new FormData()
  form.append('file', new Blob([fs.readFileSync(arq)], { type: /\.wav$/i.test(arq) ? 'audio/wav' : undefined }), path.basename(arq))
  form.append('model_id', MODELO_STT)
  if (idioma) form.append('language_code', idioma)
  form.append('tag_audio_events', 'false')
  const { dados, cab } = await api('POST', '/v1/speech-to-text', { form, fala })
  anotar(projeto, { custo: num(cab.get('character-cost')), estimado, model: MODELO_STT, label: rotulo })
  return dados
}

async function cmdListenMix(a) {
  const mp4 = a.mix, rot = a.script || a._[0]
  if (!rot) throw new Falha('usage: voice.mjs listen --mix <final video.mp4> --script <narration.json | script.json> [--words "Name,Acronym"] [--line id] [--threshold 90] [--project folder]', 2)
  if (!fs.existsSync(mp4)) throw new Falha(`Could not find the video ${mp4}.`)
  const limiar = num(a.threshold) ?? LIMIAR_MIX * 100
  if (!(limiar > 0 && limiar <= 100)) throw new Falha('--threshold: the minimum percentage of words heard, from 1 to 100 (default 90).', 2)
  const { idioma, falas: todas } = falasParaOuvir(rot)
  const falas = a.line ? todas.filter((f) => lista(a.line).includes(f.id)) : todas
  if (!falas.length) throw new Falha(`--line ${a.line}: there is no line with that id in ${rot}.`, 2)
  const projeto = acharProjeto(a.project, rot, mp4)
  const nome = path.basename(mp4).replace(/\.[^.]+$/, ''), tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'listen-mix-')), wav = path.join(tmp, `${nome}.wav`)
  let dados
  try {
    try { ffmpeg(['-i', path.resolve(mp4), '-vn', '-ac', '1', '-ar', '16000', '-c:a', 'pcm_s16le', wav]) } catch (e) { throw new Falha(`Could not extract the audio of ${mp4}. Does the video have an audio track? (${e.message})`) }
    const w = lerWav(wav), dur = w.n / w.taxa
    console.log(`${path.basename(mp4)}: ${dur.toFixed(1)} s of audio · estimated cost ~${creditosStt(dur)} credit(s) (transcription is billed by duration)`)
    dados = await transcrever(projeto, wav, { idioma: String(idioma || '').split('-')[0].toLowerCase(), fala: 'mix', rotulo: `listen --mix ${path.basename(mp4)}` })
  } finally { fs.rmSync(tmp, { recursive: true, force: true }) }
  const j = julgarMix(falas, dados, lista(a.words), { limiar: limiar / 100 })
  const base = path.join(path.dirname(path.resolve(mp4)), `${nome}.heard-mix`)
  fs.writeFileSync(`${base}.json`, JSON.stringify(dados, null, 1) + '\n')
  const linhas = j.trechos.map((t) => `| ${ondePerdeu(t)} | ${t.falas.join(', ')} | ${t.palavras.join(' ')} | ${t.risco.join(', ') || '—'} |`)
  fs.writeFileSync(`${base}.md`, `# What the transcription heard in the final mix

Video \`${path.basename(mp4)}\` · script \`${path.basename(rot)}\`${a.line ? ` (lines ${a.line})` : ''} · model ${MODELO_STT}, no keyterms.
Passes with ${pctTxt(j.limiar)} or more of the script's words heard, every risk word heard and no stretch of
${SEGUIDAS_MIX} words in a row lost.

| | |
|---|---|
| script words heard | ${j.ouvidas} of ${j.total} (${pctTxt(j.pct)}) |
| risk words | ${j.riscos.map((t) => `${t} ${j.faltaRisco.includes(t) ? '✗' : '✓'}`).join(', ') || '—'} |
| lost stretches | ${j.trechos.length} |
| verdict | ${j.reprovou ? `✗ does not go to the person: ${j.motivos.join('; ')}` : '✓ goes to the person'} |
${linhas.length ? `\n## Where the transcription lost words\n\n| when | line | words | risk |\n|---|---|---|---|\n${linhas.join('\n')}\n\n${O_QUE_FAZER_MIX}\n` : ''}
## The transcription

> ${j.texto || '(empty)'}

The transcription proves the words are understood over the soundtrack. It does not judge whether the blend is pleasing: that
stays with whoever listens.
`)
  console.log(`${j.reprovou ? '✗' : '✓'} mix: ${j.ouvidas} of ${j.total} script words heard (${pctTxt(j.pct)}, threshold ${pctTxt(j.limiar)})${j.riscos.length ? ` · risk: ${j.riscos.length - j.faltaRisco.length} of ${j.riscos.length} heard` : ''}${j.reprovou ? ' · does not go to the person' : ''}`)
  for (const t of j.trechos) console.log(`    lost ${ondePerdeu(t)} (${t.falas.join(', ')}): "${t.palavras.join(' ')}"${t.risco.length ? ' · RISK' : ''}`)
  if (j.reprovou) console.log(`  ${j.motivos.join('\n  ')}\n${O_QUE_FAZER_MIX}`)
  console.log(`→ ${base}.md`)
  return j.reprovou ? 1 : 0
}

async function cmdListen(a) {
  if (a.mix) return cmdListenMix(a)
  const arq = a._[0]
  if (!arq) throw new Falha('usage: voice.mjs listen <narration.json> [--words "Name,Acronym"] [--line id]  or  listen --mix <video.mp4> --script <narration.json|script.json>', 2)
  const base = path.dirname(path.resolve(arq))
  const loc = lerJson(path.resolve(arq), 'the narration')
  const erros = validarLocucao(loc, base)
  if (erros.length) throw new Falha(`The narration does not pass Contract L; fix it before listening:\n${erros.map((e) => `  - ${e}`).join('\n')}`)
  const extras = lista(a.words)
  const falas = a.line ? loc.falas.filter((f) => lista(a.line).includes(f.id)) : loc.falas
  if (!falas.length) throw new Falha(`--line ${a.line}: there is no line with that id in the narration.`, 2)
  const projeto = acharProjeto(a.project, arq)
  antes(projeto, falas.reduce((s, f) => s + creditosStt(f.duracao), 0))
  const idioma = String(loc.idioma || '').split('-')[0].toLowerCase()
  const linhas = ['| line | risk | what the voice should say | what the transcription heard | |', '|---|---|---|---|---|']
  let ruins = 0
  for (const f of falas) {
    const dados = await transcrever(projeto, path.resolve(base, f.arquivo), { idioma, fala: f.id, rotulo: `listen ${f.id}` })
    const ouvido = normalizar(dados?.text)
    const j = julgarEscuta(f, ouvido, extras)
    if (j.falhou) ruins++
    const devia = f.palavras.map((p) => p.dito ?? p.texto).join(' ')
    console.log(`${j.falhou ? '✗' : '✓'} ${f.id.padEnd(11)} heard: "${ouvido}"`)
    for (const x of j.faltas) console.log(`    ${x.risco ? 'RISK ' : ''}"${x.texto}"${x.esperado !== x.texto ? ` (said "${x.esperado}")` : ''} does not appear in the transcription${x.risco ? '' : ' (informative only)'}`)
    linhas.push(`| ${f.id} | ${j.riscos.join(', ') || '—'} | ${devia} | ${ouvido} | ${j.falhou ? '✗' : '✓'} |`)
  }
  fs.writeFileSync(path.join(base, 'heard.md'), `# What the transcription heard\n\nModel ${MODELO_STT}, no keyterms. A risk word that does not appear = listen to that line and fix the \`pronuncia\` map.\n\n${linhas.join('\n')}\n\nThe transcription does not judge accent or intonation: that stays with whoever listens.\n`)
  console.log(`${ruins ? '✗' : '✓'} ${falas.length - ruins} of ${falas.length} lines with every risk word heard · → ${path.join(base, 'heard.md')}`)
  return ruins ? 1 : 0
}

// A narration.json ao lado do roteiro, se é deste texto: quanto a voz gerada levou de verdade.
function locucaoDoRoteiro(rot, locArq) {
  if (!locArq || !fs.existsSync(locArq)) return { loc: null, mesma: false }
  try {
    const loc = JSON.parse(fs.readFileSync(locArq, 'utf8'))
    const exibido = new Map(rot.falas.map((f) => [f.id, aplicarPronuncia(f.texto).exibidas.join(' ')]))
    const mesma = loc.falas.length === rot.falas.length && loc.falas.every((f) => exibido.get(f.id) === f.texto)
    return { loc, mesma }
  } catch { return { loc: null, mesma: false } }
}
const falado = (f) => f.palavras.at(-1).fim - f.inicio_voz

function cmdReview(a) {
  const arq = a._[0]
  if (!arq) throw new Falha('usage: voice.mjs review <script.json> [--seconds <planned seconds of speech>] [--json]', 2)
  const rot = lerRoteiro(arq, { precisaVoz: false })
  const segundos = num(a.seconds)
  if (a.seconds != null && !(segundos > 0)) throw new Falha('--seconds: the planned seconds of speech (the sum of the s column of the table), a number greater than zero.', 2)
  const achados = revisarFalas(rot, rot.falas, { segundos })
  const porFala = rot.falas.map((f) => ({ id: f.id, palavras: palavrasDe(textoFalado(f)).length }))
  const palavras = porFala.reduce((s, f) => s + f.palavras, 0), estimado = segundosDe(palavras)
  // A narração ao lado, se é deste texto: quanto a voz gerada levou de verdade (do primeiro som à última palavra de cada fala).
  const { loc, mesma } = locucaoDoRoteiro(rot, path.join(path.dirname(path.resolve(arq)), 'narration.json'))
  const medido = mesma ? r3(loc.falas.reduce((s, f) => s + falado(f), 0)) : null
  if (segundos && medido > segundos * 1.1) achados.push({ fala: 'script', nivel: 'aviso', regra: 'tempo', frase: `the generated voice lasts ${medido} s for ${segundos} s planned`, oque_trocar: `Cut words or plan ${Math.ceil(medido)} s of speech.` })
  const erros = achados.filter((x) => x.nivel === 'erro').length
  if (a.json) {
    console.log(JSON.stringify({ achados, palavras, segundos_estimados: estimado, ppm: PPM, planejado: segundos, medido }, null, 1))
    return erros ? 1 : 0
  }
  for (const x of achados) console.log(linhaAchado(x))
  console.log(`time: ${palavras} words ≈ ${estimado} s at ${PPM} words per minute, with the pauses (${porFala.map((f) => `${f.id} ${f.palavras}`).join(' · ')})`)
  if (segundos) console.log(`      planned: ${segundos} s${estimado > segundos * 1.1 ? ' · does not fit (see the warning)' : ' · fits'}`)
  if (medido != null) console.log(`      measured in the narration next to it: ${medido} s of voice, ${Math.round((palavras / medido) * 60)} words per minute without the pauses between lines`)
  else if (loc) console.log('      the narration.json next to it is from another text: generate again to measure')
  console.log(`${erros ? '✗' : '✓'} ${rot.falas.length} lines · ${erros} error(s) · ${achados.length - erros} warning(s)${erros ? ' · an error stops generate: change the sentence' : ''}`)
  return erros ? 1 : 0
}

function cmdValidate(a) {
  const arq = a._[0]
  if (!arq) throw new Falha('usage: voice.mjs validate <narration.json>', 2)
  const loc = lerJson(path.resolve(arq), 'the narration')
  const erros = validarLocucao(loc, path.dirname(path.resolve(arq)))
  if (erros.length) { console.log(`✗ ${arq}\n${erros.map((e) => `  - ${e}`).join('\n')}`); return 1 }
  const lugares = loc.falas.map((f) => nomeOnde(f.onde))
  const pal = loc.falas.reduce((s, f) => s + f.palavras.length, 0)
  const voz = loc.falas.reduce((s, f) => s + falado(f), 0)
  console.log(`✓ ${arq}: ${loc.falas.length} lines (${lugares.join(', ')}), ${pal} words, ${r3(voz)} s of voice`)
  return 0
}

// ── board: o roteiro, as falas e as vozes para o painel de revisão, sem rede ─────────────────────
// Por fala: o texto, o áudio (relativo ao projeto), a duração e os créditos (os do take, quando já foi gerado; senão a
// estimativa); no topo, o estado do roteiro, as palavras, os segundos e os créditos dele inteiro; e as vozes das amostras.
// Estados: needs-fix (a revisão do texto acha erro), ready (revisado, ainda sem voz), generated (a narration.json é
// deste texto), stale (há narration.json, mas de outro texto: gere de novo).
export function quadroDaVoz(arq, { locucao, amostras, projeto } = {}) {
  const rot = lerRoteiro(arq, { precisaVoz: false })
  const dir = path.dirname(path.resolve(arq))
  const proj = projeto ? path.resolve(projeto) : (() => { try { return acharProjeto(null, arq) } catch { return dir } })()
  const locArq = path.resolve(locucao || path.join(dir, 'narration.json'))
  const { loc, mesma } = locucaoDoRoteiro(rot, locArq)
  const takes = path.join(path.dirname(locArq), '..', '_takes')
  const achados = revisarFalas(rot)
  const erros = achados.filter((x) => x.nivel === 'erro')
  const plano = rot.voz?.id ? planejar(rot) : rot.falas.map((fala) => ({ fala, pedido: { texto: fala.texto }, chave: null }))
  const lines = plano.map((p) => {
    const t = p.chave ? lerTake(takes, p.chave) : null
    const f = loc?.falas.find((x) => x.id === p.fala.id && x.texto === aplicarPronuncia(p.fala.texto).exibidas.join(' '))
    const palavras = palavrasDe(textoFalado(p.fala)).length
    const estimado = Math.ceil(p.pedido.texto.length * creditosPorLetra(rot.modelo))
    return {
      id: p.fala.id, onde: p.fala.onde, scene: cenaDaFala(p.fala.onde), text: p.fala.texto,
      audio: f ? relProjeto(proj, path.join(path.dirname(locArq), f.arquivo)) : null,
      seconds: f ? r3(falado(f)) : segundosDe(palavras), words: palavras,
      credits: t?.custo ?? estimado, estimated: t?.custo == null, cached: !!t,
      review: achados.filter((x) => x.fala === p.fala.id).map((x) => ({ level: NIVEL[x.nivel] ?? x.nivel, rule: x.regra, text: x.frase, fix: x.oque_trocar })),
    }
  })
  const words = lines.reduce((s, l) => s + l.words, 0)
  const state = erros.length ? 'needs-fix' : !loc ? 'ready' : mesma ? 'generated' : 'stale'
  const amArq = amostras ? path.resolve(amostras, 'samples.json') : path.join(dir, 'samples', 'samples.json')
  const samples = fs.existsSync(amArq) ? JSON.parse(fs.readFileSync(amArq, 'utf8')) : null
  return {
    script: {
      file: relProjeto(proj, path.resolve(arq)), state, words,
      seconds: mesma ? r3(loc.falas.reduce((s, f) => s + falado(f), 0)) : segundosDe(words),
      credits: lines.reduce((s, l) => s + l.credits, 0), creditsToSpend: lines.filter((l) => !l.cached).reduce((s, l) => s + l.credits, 0),
      voice: rot.voz?.id ? { id: rot.voz.id, name: rot.voz.nome || loc?.voz?.nome || null, model: rot.modelo, profile: rot.perfil } : null,
      review: { errors: erros.length, warnings: achados.length - erros.length },
    },
    lines,
    options: samples ? samples.options.map((o) => ({ voice: o.voice, name: o.name, audio: o.audio, seconds: o.seconds })) : [],
    ...(samples ? { samplesPhrase: samples.phrase } : {}),
  }
}

function cmdBoard(a) {
  const arq = a._[0]
  if (!arq) throw new Falha('usage: voice.mjs board <script.json> [--narration <narration.json>] [--samples <folder>] [--project <folder>]', 2)
  console.log(JSON.stringify(quadroDaVoz(arq, { locucao: a.narration, amostras: a.samples, projeto: a.project }), null, 1))
}

// ── voz humana: Voice Design, remix, transcrição livre, prévias e comparação com uma referência ──
// A voz soa como uma pessoa falando, sempre. Toda descrição do Voice Design leva este pedido, mesmo que quem
// descreveu esqueça: já foi recusada uma voz "fofa de anúncio" que a descrição não pedia humana.
export const HUMANA = 'Natural and human, like a real person talking to a friend, with lively melodic intonation that rises and falls; not an announcer, not a commercial read, not robotic. Close-mic studio recording, clean, no reverb.'
export function descricaoHumana(d) { const t = normalizar(d); return /not an announcer/i.test(t) ? t : `${t} ${HUMANA}` }

// O texto da prévia é o roteiro real (100–1000 caracteres): ouvir a voz na frase do vídeo, não numa frase genérica.
function textoDaPrevia(a) {
  let t
  if (a.script) {
    const rot = lerRoteiro(a.script, { precisaVoz: false })
    t = rot.falas.map((f) => aplicarPronuncia(f.texto, { ...rot.pronuncia, ...(f.pronuncia || {}) }).falado).join(' ')
  } else if (a.text) t = normalizar(a.text)
  else throw new Falha('Say the text: --script <script.json> (the whole script) or --text "…".', 2)
  if (t.length < 100) t = `${t} ${t}`.slice(0, Math.max(100, t.length))
  return t.slice(0, 1000)
}

function gravarPrevias(dados, saida, rotulo, meta, { projeto, custo, estimado }) {
  fs.mkdirSync(saida, { recursive: true })
  const previas = (dados?.previews || []).map((p, i) => {
    const arq = `${rotulo}-${i + 1}.mp3`
    fs.writeFileSync(path.join(saida, arq), Buffer.from(p.audio_base_64, 'base64'))
    return { arquivo: arq, generated_voice_id: p.generated_voice_id, duracao: p.duration_secs }
  })
  fs.writeFileSync(path.join(saida, `${rotulo}.json`), JSON.stringify({ ...meta, previas }, null, 2) + '\n')
  anotar(projeto, { custo, estimado, model: meta.modelo ?? 'voice-design', label: rotulo, files: previas.map((p) => path.join(saida, p.arquivo)) })
  for (const p of previas) console.log(`  ${p.arquivo} · ${p.duracao?.toFixed?.(2) ?? '?'} s · generated_voice_id ${p.generated_voice_id}`)
  console.log(`→ ${saida}  (open with: open -a "QuickTime Player" ${previas.map((p) => p.arquivo).join(' ')})`)
  console.log('Like one? `voice.mjs save <generated_voice_id> --name "…"` and, for sisters of it, `voice.mjs remix <voice_id> …`.')
}

async function cmdDesign(a) {
  if (!a.description) throw new Falha('usage: voice.mjs design --description "young woman, ~23, warm…" (--script s.json | --text "…") [--label a] [--out folder] [--project folder]', 2)
  const descricao = descricaoHumana(a.description), texto = textoDaPrevia(a)
  const projeto = acharProjeto(a.project, a.out, a.script)
  const modelo = a.model || 'eleven_multilingual_ttv_v2'
  await antesDeGastar(projeto, texto.length)
  const { dados, cab } = await api('POST', '/v1/text-to-voice/design', { json: { voice_description: descricao, text: texto, model_id: modelo, guidance_scale: num(a.guidance) ?? 5 }, caracteres: texto.length })
  gravarPrevias(dados, path.resolve(a.out || path.join(projeto, 'voice', 'design')), a.label || 'design', { descricao, texto, modelo }, { projeto, custo: num(cab.get('character-cost')), estimado: texto.length })
}

// Irmãs de uma voz já salva: mesma pessoa, ajuste fino ("warmer", "a bit higher"). prompt_strength baixo = parecida.
async function cmdRemix(a) {
  const id = a._[0]
  if (!id || !a.description) throw new Falha('usage: voice.mjs remix <saved voice_id> --description "same voice, warmer…" (--script s.json | --text "…") [--strength 0.35] [--label b] [--project folder]', 2)
  const descricao = descricaoHumana(a.description), texto = textoDaPrevia(a)
  const projeto = acharProjeto(a.project, a.out, a.script)
  await antesDeGastar(projeto, texto.length)
  const { dados, cab } = await api('POST', `/v1/text-to-voice/${encodeURIComponent(id)}/remix`, { json: { voice_description: descricao, text: texto, prompt_strength: num(a.strength) ?? 0.35 }, caracteres: texto.length })
  gravarPrevias(dados, path.resolve(a.out || path.join(projeto, 'voice', 'design')), a.label || 'remix', { base: id, descricao, texto, modelo: 'remix' }, { projeto, custo: num(cab.get('character-cost')), estimado: texto.length })
}

async function cmdSave(a) {
  const gid = a._[0]
  if (!gid || !a.name) throw new Falha('usage: voice.mjs save <generated_voice_id> --name "Product · voice" [--description "…"]  (takes one voice slot of the account)', 2)
  const { dados } = await api('POST', '/v1/text-to-voice', { json: { voice_name: a.name, voice_description: descricaoHumana(a.description || a.name), generated_voice_id: gid } })
  console.log(`voice_id ${dados.voice_id}  ← put it in script.json ("voz": { "id": "${dados.voice_id}", "nome": "${a.name}" }) and in the delivery README`)
}

// Transcreve qualquer áudio (prévia, amostra, trecho de um vídeo de referência).
async function cmdTranscribe(a) {
  if (!a._.length) throw new Falha('usage: voice.mjs transcribe <audio> [<audio> …] [--language pt] [--project folder]', 2)
  const projeto = acharProjeto(a.project, ...a._)
  for (const arq of a._) {
    const dados = await transcrever(projeto, path.resolve(arq), { idioma: a.language, rotulo: `transcribe ${path.basename(arq)}` })
    console.log(`${path.basename(arq)} → ${normalizar(dados?.text)}`)
  }
}

// ── timbre: compara candidatas com um trecho de referência (o vídeo que a pessoa aprovou) ──
// Sem rede e sem Python: ffmpeg decodifica, o resto é FFT, mel, MFCC, F0 por autocorrelação e centroide.
// Mede o parecido, não o bonito: as 3 mais próximas vão para o ouvido de quem decide, lado a lado com a referência.
const SR_T = 16000
function pcm(arq, de, ate) {
  const r = spawnSync('ffmpeg', ['-v', 'error', ...(de != null ? ['-ss', String(de)] : []), ...(ate != null ? ['-to', String(ate)] : []), '-i', arq, '-vn', '-ac', '1', '-ar', String(SR_T), '-f', 'f32le', '-'], { maxBuffer: 1 << 30 })
  if (r.status !== 0) throw new Falha(`ffmpeg could not read ${arq}: ${String(r.stderr).trim()}`)
  return new Float32Array(r.stdout.buffer, r.stdout.byteOffset, r.stdout.length / 4)
}
function fft(re, im) {
  const n = re.length
  for (let i = 1, j = 0; i < n; i++) { let b = n >> 1; for (; j & b; b >>= 1) j ^= b; j ^= b; if (i < j) { [re[i], re[j]] = [re[j], re[i]]; [im[i], im[j]] = [im[j], im[i]] } }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = -2 * Math.PI / len, wr = Math.cos(ang), wi = Math.sin(ang)
    for (let i = 0; i < n; i += len) {
      let cr = 1, ci = 0
      for (let k = 0; k < len / 2; k++) {
        const ar = re[i + k + len / 2] * cr - im[i + k + len / 2] * ci, ai = re[i + k + len / 2] * ci + im[i + k + len / 2] * cr
        re[i + k + len / 2] = re[i + k] - ar; im[i + k + len / 2] = im[i + k] - ai; re[i + k] += ar; im[i + k] += ai
        const t = cr * wr - ci * wi; ci = cr * wi + ci * wr; cr = t
      }
    }
  }
}
function melBanco(n = 40, nfft = 512) {
  const mel = (h) => 2595 * Math.log10(1 + h / 700), hz = (m) => 700 * (10 ** (m / 2595) - 1)
  const pts = Array.from({ length: n + 2 }, (_, i) => hz(mel(60) + (mel(7600) - mel(60)) * i / (n + 1)))
  const b = pts.map((p) => Math.floor((nfft + 1) * p / SR_T))
  return Array.from({ length: n }, (_, i) => { const w = new Float32Array(nfft / 2 + 1); for (let k = b[i]; k < b[i + 1]; k++) w[k] = (k - b[i]) / Math.max(1, b[i + 1] - b[i]); for (let k = b[i + 1]; k < b[i + 2]; k++) w[k] = (b[i + 2] - k) / Math.max(1, b[i + 2] - b[i + 1]); return w })
}
export function timbre(x) {
  const hop = 160, win = 400, N = 512, FB = melBanco(), hann = Float32Array.from({ length: win }, (_, i) => 0.5 - 0.5 * Math.cos(2 * Math.PI * i / (win - 1)))
  const nfr = Math.max(0, Math.floor((x.length - win) / hop)), quadros = []
  for (let f = 0; f < nfr; f++) { let e = 0; for (let i = 0; i < win; i++) e += x[f * hop + i] ** 2; quadros.push({ f, e: Math.sqrt(e / win) }) }
  const lim = [...quadros].map((q) => q.e).sort((p, q) => p - q)[Math.floor(quadros.length * 0.4)] ?? 0
  const voz = quadros.filter((q) => q.e > lim)
  const mf = [], f0 = [], cen = []
  for (const [iq, q] of voz.entries()) {
    const re = new Float64Array(N), im = new Float64Array(N)
    for (let i = 0; i < win; i++) re[i] = x[q.f * hop + i] * hann[i]
    fft(re, im)
    const p = Array.from({ length: N / 2 + 1 }, (_, k) => re[k] ** 2 + im[k] ** 2)
    let sp = 0, sw = 0; p.forEach((v, k) => { sp += v; sw += v * k }); cen.push(sw / (sp + 1e-9) * SR_T / N)
    const lm = FB.map((w) => Math.log(w.reduce((s, wk, k) => s + wk * p[k], 0) + 1e-10))
    mf.push(Array.from({ length: 19 }, (_, c) => lm.reduce((s, v, m) => s + v * Math.cos(Math.PI * (c + 1) * (m + 0.5) / lm.length), 0) * Math.sqrt(2 / lm.length)))
    if (iq % 3 === 0) {
      const a0 = re.length && (() => { let s = 0; for (let i = 0; i < win; i++) s += (x[q.f * hop + i] * hann[i]) ** 2; return s })()
      let melhor = -1, lag = 0
      for (let L = Math.floor(SR_T / 400); L < Math.floor(SR_T / 120); L++) { let s = 0; for (let i = 0; i + L < win; i++) s += x[q.f * hop + i] * hann[i] * x[q.f * hop + i + L] * hann[i + L]; if (s > melhor) { melhor = s; lag = L } }
      if (melhor > 0.35 * a0) f0.push(SR_T / lag)
    }
  }
  const med = (v) => { const o = [...v].sort((p, q) => p - q); return o.length ? o[Math.floor(o.length / 2)] : 0 }
  const media = Array.from({ length: 19 }, (_, c) => mf.reduce((s, v) => s + v[c], 0) / Math.max(1, mf.length))
  const desvio = Array.from({ length: 19 }, (_, c) => Math.sqrt(mf.reduce((s, v) => s + (v[c] - media[c]) ** 2, 0) / Math.max(1, mf.length)))
  return { media, desvio, f0: med(f0), centroide: med(cen), duracao: x.length / SR_T }
}
export function distanciaTimbre(m, r) {
  const n = (u, v) => Math.sqrt(u.reduce((s, x, i) => s + (x - v[i]) ** 2, 0))
  return n(m.media, r.media) + 0.5 * n(m.desvio, r.desvio) + Math.abs(Math.log((m.f0 || 1) / (r.f0 || 1))) * 30 + Math.abs(Math.log((m.centroide || 1) / (r.centroide || 1))) * 10
}
function cmdCompare(a) {
  if (!a.ref || !a._.length) throw new Falha('usage: voice.mjs compare --ref <video or audio> [--from 0.6 --to 5.1] <audio|folder> […]  (the same sentence as the reference = the fairest comparison)', 2)
  const r = timbre(pcm(path.resolve(a.ref), num(a.from), num(a.to)))
  const arqs = a._.flatMap((p) => fs.statSync(p).isDirectory() ? fs.readdirSync(p).filter((f) => /\.(mp3|wav|m4a)$/i.test(f)).map((f) => path.join(p, f)) : [p])
  const nomes = {}
  for (const p of new Set(a._.filter((x) => fs.statSync(x).isDirectory()))) { const j = path.join(p, 'names.json'); if (fs.existsSync(j)) Object.assign(nomes, JSON.parse(fs.readFileSync(j, 'utf8'))) }
  const res = arqs.map((f) => { const m = timbre(pcm(f)); return { f, m, d: distanciaTimbre(m, r) } }).sort((p, q) => p.d - q.d)
  console.log(`reference: voice ~${r.f0.toFixed(0)} Hz · centroid ${r.centroide.toFixed(0)} Hz · ${r.duracao.toFixed(2)} s`)
  console.log('| # | distance | file | voice | Hz | centroid | duration |\n|---|---|---|---|---|---|---|')
  res.slice(0, num(a.n) ?? 12).forEach((x, i) => { const id = path.basename(x.f).replace(/\.[^.]+$/, ''); console.log(`| ${i + 1} | ${x.d.toFixed(1)} | ${path.basename(x.f)} | ${nomes[id] || ''} | ${x.m.f0.toFixed(0)} | ${x.m.centroide.toFixed(0)} | ${x.m.duracao.toFixed(2)} s |`) })
  console.log('Smaller distance = more alike. With the same sentence as the reference, compare the duration too (the pace). Whoever decides listens to the top 3 next to the reference.')
}

// ── measure: o que dá para ver numa leitura sem ouvido ───────────────────────────────────────────
// O take.json da leitura mora ao lado do áudio ou no _takes/ da pasta, achado pelos mesmos bytes do MP3.
function takeDe(arq) {
  const abs = path.resolve(arq), dir = path.dirname(abs)
  const proprio = path.join(dir, 'take.json')
  if (fs.existsSync(proprio)) return proprio
  const bytes = fs.readFileSync(abs)
  for (const t of ['_takes', path.join('..', '_takes')]) {
    const d = path.join(dir, t)
    if (!fs.existsSync(d)) continue
    for (const h of fs.readdirSync(d)) {
      const mp3 = path.join(d, h, 'take.mp3')
      if (fs.existsSync(mp3) && fs.readFileSync(mp3).equals(bytes)) return path.join(d, h, 'take.json')
    }
  }
  return null
}

// As palavras com tempo de uma leitura: as do alinhamento forçado, se já foi feito, senão as da própria voz (no v3 e no v4,
// até 260 ms adiantadas).
function palavrasDoTake(take) {
  if (!take) return null
  const info = JSON.parse(fs.readFileSync(take, 'utf8'))
  if (info.forcado) return info.forcado
  return info.alinhamento?.characters ? semMarcacao(palavrasDoAlinhamento(info.alinhamento), (d) => d.texto) : null
}

// A palavra depois da qual cai cada pausa: a que termina mais perto do começo dela.
export function ondeCaem(pausas, palavras) {
  return pausas.map(([a]) => palavras.reduce((m, p) => (Math.abs(p.fim - a) < Math.abs(m.fim - a) ? p : m), palavras[0])?.texto ?? '?')
}

export function medirAudio(arq) {
  const tmp = path.join(os.tmpdir(), `measure-${process.pid}-${path.basename(arq)}.wav`)
  mp3ParaWav(arq, tmp)
  limparInicio(tmp)
  const w = lerWav(tmp)
  fs.rmSync(tmp, { force: true })
  const ini = inicioVoz(w.amostras, w.taxa), fim = fimDaVoz(w.amostras, w.taxa)
  if (ini == null) throw new Falha(`${arq} is silent.`)
  const pausas = pausasDaVoz(w.amostras, w.taxa, { minimo: 0.2 }), pal = palavrasDoTake(takeDe(arq))
  return { arquivo: arq, duracao: r3(fim - ini), ...expressividade(w.amostras, w.taxa), ...ritmo(w.amostras, w.taxa, pausas), pausas, depoisDe: pal ? ondeCaem(pausas, pal) : null }
}

// --align: antes de medir, alinha cada leitura que tem take.json ao texto dela (cerca de 1 crédito por leitura) e guarda no take.
async function alinharLeituras(arqs, projetoArg) {
  const pendentes = arqs.map((arq) => ({ arq, take: takeDe(arq) })).filter((x) => x.take && (() => { const i = JSON.parse(fs.readFileSync(x.take, 'utf8')); return !i.forcado && i.pedido?.texto })())
  if (!pendentes.length) return
  const projeto = acharProjeto(projetoArg, ...pendentes.map((x) => x.take))
  antes(projeto, pendentes.length * CREDITOS_ALINHAR)
  for (const { arq, take } of pendentes) {
    const info = JSON.parse(fs.readFileSync(take, 'utf8'))
    const ditas = semMarcacao(info.pedido.texto.split(' '))
    const tmp = path.join(os.tmpdir(), `align-${process.pid}-${path.basename(arq)}.wav`)
    mp3ParaWav(arq, tmp)
    limparInicio(tmp)
    try {
      antes(projeto, CREDITOS_ALINHAR)
      const r = await alinharForcado(tmp, ditas, path.basename(path.dirname(take)))
      anotar(projeto, { custo: r.custo, estimado: CREDITOS_ALINHAR, model: 'forced-alignment', label: `measure --align ${path.basename(arq)}` })
      const f = ditasForcadas(r.words, ditas.length)
      if (f) fs.writeFileSync(take, JSON.stringify({ ...info, forcado: f }, null, 1) + '\n')
      else console.log(`${arq}: the forced alignment did not match the text; the voice's own times stay`)
    } finally { fs.rmSync(tmp, { force: true }) }
  }
}

async function cmdMeasure(a) {
  if (!a._.length) throw new Falha('usage: voice.mjs measure <audio|folder> […] [--align] [--json]  (mp3 or wav; with the take.json nearby, says after which word each pause falls; --align uses the network for that)', 2)
  for (const p of a._) if (!fs.existsSync(p)) throw new Falha(`Could not find ${p}.`)
  const arqs = a._.flatMap((p) => (fs.statSync(p).isDirectory() ? fs.readdirSync(p).filter((f) => /\.(mp3|wav|m4a)$/i.test(f)).sort().map((f) => path.join(p, f)) : [p]))
  if (a.align) await alinharLeituras(arqs, a.project)
  const res = arqs.map((f) => medirAudio(f))
  if (a.json) return console.log(JSON.stringify(res, null, 1))
  console.log('| file | duration | pitch (st) | energy (dB) | syllables/s | pace CV | syl/s range | pauses ≥ 0.2 s | fall after |\n|---|---|---|---|---|---|---|---|---|')
  for (const m of res) {
    const ps = m.pausas.map(([s0, s1]) => (s1 - s0).toFixed(2))
    console.log(`| ${path.basename(path.dirname(path.resolve(m.arquivo)))}/${path.basename(m.arquivo)} | ${m.duracao.toFixed(2)} s | ${m.tom.toFixed(1)} | ${m.energia.toFixed(1)} | ${m.silabasPorSeg.toFixed(1)} | ${m.cv.toFixed(2)} | ${m.faixa ? m.faixa.map((v) => v.toFixed(1)).join('–') : '—'} | ${ps.join(' · ') || '—'} | ${m.depoisDe ? m.depoisDe.join(' · ') || '—' : '?'} |`)
  }
  console.log('Pitch and energy: p10–p90 range (an approved lively voice measures ~10 st and ~20 dB). CV: variation of the interval between syllables. None of this judges whether it sounds good: whoever listens judges.')
}

const COMANDOS = { account: cmdAccount, search: cmdSearch, samples: cmdSamples, generate: cmdGenerate, check: cmdCheck, listen: cmdListen, validate: cmdValidate, review: cmdReview,
  board: cmdBoard, design: cmdDesign, remix: cmdRemix, save: cmdSave, transcribe: cmdTranscribe, compare: cmdCompare, measure: cmdMeasure }
const SEM_VALOR = new Set(['json', 'default', 'detail', 'align', 'accept-text'])
const SEM_REDE = new Set(['validate', 'review', 'compare', 'board'])

export async function principal(argv) {
  const [cmd, ...resto] = argv
  if (!COMANDOS[cmd]) { console.error(`usage: node voice.mjs <${Object.keys(COMANDOS).join('|')}> …  (the header of scripts/voice.mjs explains each one)`); return 2 }
  const a = { _: [] }
  estado.chamadas = 0; estado.comando = cmd; estado.registro = null
  try {
    for (let i = 0; i < resto.length; i++) {
      const s = resto[i]
      if (!s.startsWith('--')) { a._.push(s); continue }
      const k = s.slice(2)
      if (SEM_VALOR.has(k)) { a[k] = true; continue }
      if (resto[i + 1] == null || resto[i + 1].startsWith('--')) throw new Falha(`--${k} needs a value.`, 2)
      a[k] = resto[++i]
    }
    if (a.log) estado.registro = path.resolve(a.log)
    return (await COMANDOS[cmd](a)) ?? 0
  } catch (e) {
    console.error(limpar(e instanceof Falha || e instanceof OverCap || e instanceof Usage ? e.message : e?.stack || e))
    return e instanceof Falha ? e.codigo : e instanceof OverCap || e instanceof Usage ? e.code : 1
  } finally {
    if (!SEM_REDE.has(cmd) && !(cmd === 'measure' && !a.align)) (a.json ? console.error : console.log)(`API calls: ${estado.chamadas}`)
  }
}

// caminho real dos dois lados: a skill é instalada por link simbólico, e aí o argv[1] não bate com o import.meta.url
if (process.argv[1] && (() => { try { return fs.realpathSync(process.argv[1]) === fs.realpathSync(fileURLToPath(import.meta.url)) } catch { return false } })()) process.exitCode = await principal(process.argv.slice(2))
