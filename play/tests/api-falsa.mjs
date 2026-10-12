// Uma OpenAI de mentira em 127.0.0.1, para os testes rodarem sem rede e sem gastar nada. Responde o
// /v1/audio/transcriptions no formato de cada modelo e guarda cada pedido. Sem resposta combinada, ela "ouve" o áudio
// que chegou: cada trecho com som vira um segmento "som N", com o início e o fim de verdade dentro daquela parte.
import http from 'node:http'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { spawnSync } from 'node:child_process'

function lerMultipart(corpo, tipo) {
  const m = /boundary=(?:"([^"]+)"|([^;]+))/.exec(tipo ?? '')
  const campos = {}
  if (!m) return campos
  const fronteira = Buffer.from(`--${m[1] ?? m[2]}`)
  let i = corpo.indexOf(fronteira)
  while (i >= 0) {
    const ini = i + fronteira.length
    if (corpo.subarray(ini, ini + 2).toString() === '--') break
    const prox = corpo.indexOf(fronteira, ini)
    if (prox < 0) break
    const parte = corpo.subarray(ini + 2, prox - 2)
    const sep = parte.indexOf('\r\n\r\n')
    const cab = parte.subarray(0, sep).toString('utf8')
    const dados = parte.subarray(sep + 4)
    const nome = /name="([^"]+)"/.exec(cab)?.[1]
    const arquivo = /filename="([^"]*)"/.exec(cab)?.[1]
    if (nome) campos[nome] = arquivo != null ? { arquivo, dados } : dados.toString('utf8')
    i = prox
  }
  return campos
}

/** Os trechos com som de um áudio: o que fica entre os silêncios que o silencedetect acha. */
export function trechosComSom(dados) {
  const tmp = path.join(os.tmpdir(), `api-falsa-${process.pid}-${Math.random().toString(36).slice(2)}.mp3`)
  fs.writeFileSync(tmp, dados)
  try {
    const dur = Number(spawnSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', tmp], { encoding: 'utf8' }).stdout)
    const log = spawnSync('ffmpeg', ['-hide_banner', '-nostats', '-i', tmp, '-af', 'silencedetect=noise=-30dB:d=0.3', '-f', 'null', '-'], { encoding: 'utf8' }).stderr
    const sil = []
    let ini = null
    for (const l of log.split('\n')) {
      let m
      if ((m = /silence_start:\s*(-?[\d.]+)/.exec(l))) ini = Math.max(0, +m[1])
      else if ((m = /silence_end:\s*([\d.]+)/.exec(l)) && ini != null) { sil.push([ini, +m[1]]); ini = null }
    }
    if (ini != null) sil.push([ini, dur])
    const som = []
    let t = 0
    // menos de 0,2 s é estalo, não fala: o começo de uma parte cortada sem recomprimir pode estalar
    for (const [a, b] of sil) { if (a - t > 0.2) som.push([t, a]); t = b }
    if (dur - t > 0.2) som.push([t, dur])
    return { dur, som }
  } finally {
    fs.rmSync(tmp, { force: true })
  }
}

function respostaOuvida(campos) {
  const { dur, som } = trechosComSom(campos.file.dados)
  const segs = som.map(([a, b], i) => ({ start: +a.toFixed(3), end: +b.toFixed(3), text: ` som ${i + 1}.` }))
  const text = segs.map((s) => s.text.trim()).join(' ')
  const formato = campos.response_format ?? 'json'
  if (formato === 'diarized_json') {
    return { text, task: 'transcribe', duration: dur, segments: segs.map((s, i) => ({ type: 'transcript.text.segment', ...s, speaker: 'A', id: `seg_${i}` })), usage: { type: 'tokens', input_tokens: 10, output_tokens: 10, total_tokens: 20 } }
  }
  if (formato === 'verbose_json') return { task: 'transcribe', language: 'portuguese', duration: dur, text, segments: segs.map((s, i) => ({ id: i, ...s })), usage: { type: 'duration', seconds: Math.ceil(dur) } }
  return { text, languages: [{ code: 'pt' }], usage: { type: 'duration', seconds: Math.ceil(dur) } }
}

export async function subirApiFalsa({ chave }) {
  // resposta: (campos) => objeto da resposta 200; erro: { status, corpo } devolvido em todo pedido
  const estado = { resposta: null, erro: null }
  const pedidos = []
  const servidor = http.createServer((req, res) => {
    const partes = []
    req.on('data', (c) => partes.push(c))
    req.on('end', () => {
      const campos = lerMultipart(Buffer.concat(partes), req.headers['content-type'])
      const p = {
        metodo: req.method, caminho: req.url, autorizacao: req.headers.authorization,
        modelo: campos.model, formato: campos.response_format, idioma: campos.language ?? null,
        chunking: campos.chunking_strategy ?? null, granularidade: campos['timestamp_granularities[]'] ?? null,
        nomeArquivo: campos.file?.arquivo ?? null, bytes: campos.file?.dados.length ?? 0, conteudo: campos.file?.dados ?? null,
      }
      pedidos.push(p)
      const json = (status, dados) => { res.writeHead(status, { 'content-type': 'application/json' }); res.end(JSON.stringify(dados)) }
      if (req.headers.authorization !== `Bearer ${chave}`) {
        // como a API real, devolve na mensagem a chave que recebeu: o script tem de tirar antes de mostrar
        return json(401, { error: { message: `Incorrect API key provided: ${String(req.headers.authorization).replace(/^Bearer /, '')}.`, type: 'invalid_request_error', code: 'invalid_api_key' } })
      }
      if (estado.erro) return json(estado.erro.status, estado.erro.corpo)
      if (req.method !== 'POST' || req.url !== '/v1/audio/transcriptions') return json(404, { error: { message: `no route ${req.method} ${req.url}` } })
      json(200, estado.resposta ? estado.resposta(campos) : respostaOuvida(campos))
    })
  })
  await new Promise((r) => servidor.listen(0, '127.0.0.1', r))
  return {
    url: `http://127.0.0.1:${servidor.address().port}`,
    estado,
    pedidos,
    zerar: () => { pedidos.length = 0; estado.resposta = null; estado.erro = null },
    fechar: () => new Promise((r) => servidor.close(r)),
  }
}
