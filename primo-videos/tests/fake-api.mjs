// Uma ElevenLabs de mentira em 127.0.0.1, para os testes rodarem sem rede e sem gastar nada.
// Responde os endpoints que o voice.mjs usa, com o mesmo formato da API, e guarda cada pedido.
import http from 'node:http'
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const INICIO = 0.12   // onde o som começa no MP3 falso; o alinhamento põe a 1ª letra em 0, como a API real
const POR_LETRA = 0.055

// O MP3 de uma fala: uma rajada de tom por palavra, no tempo que o alinhamento falso dá a ela, com o vão do espaço entre
// as palavras (como a fala de verdade, que respira entre elas: sem vão, o finalize não mede o destaque da voz).
function mp3Falso(seg, texto = null) {
  const SR = 44100, n = Math.round((seg + 0.05) * SR), x = new Int16Array(n)
  const trechos = []
  if (texto) {
    const al = alinhamentoFalso(texto)
    let ini = null
    al.characters.forEach((c, i) => {
      if (/\s/.test(c)) { if (ini != null) trechos.push([ini, al.character_end_times_seconds[i - 1]]); ini = null; return }
      if (ini == null) ini = i ? al.character_start_times_seconds[i] : INICIO
    })
    if (ini != null) trechos.push([ini, al.character_end_times_seconds.at(-1)])
  } else trechos.push([INICIO, seg])
  for (const [a, b] of trechos) {
    const i0 = Math.round(a * SR), i1 = Math.min(n, Math.round(b * SR)), rampa = Math.round(0.005 * SR)
    for (let i = i0; i < i1; i++) x[i] = Math.round(16000 * Math.min(1, (i - i0) / rampa, (i1 - i) / rampa) * Math.sin(2 * Math.PI * 220 * (i - i0) / SR))
  }
  return execFileSync('ffmpeg', ['-hide_banner', '-v', 'error', '-f', 's16le', '-ar', String(SR), '-ac', '1', '-i', 'pipe:0', '-c:a', 'libmp3lame', '-b:a', '128k', '-f', 'mp3', 'pipe:1'],
    { input: Buffer.from(x.buffer), maxBuffer: 1 << 26 })
}

export function alinhamentoFalso(texto) {
  const ch = [...texto]
  const ini = ch.map((_, i) => (i ? +(INICIO + i * POR_LETRA).toFixed(3) : 0))
  const fim = ch.map((_, i) => +(INICIO + (i + 1) * POR_LETRA).toFixed(3))
  return { characters: ch, character_start_times_seconds: ini, character_end_times_seconds: fim }
}

function campoMultipart(corpo, nome) {
  const m = corpo.toString('latin1').match(new RegExp(`name="${nome}"\\r\\n\\r\\n([\\s\\S]*?)\\r\\n--`))
  return m ? Buffer.from(m[1], 'latin1').toString('utf8') : null
}

export async function subirApiFalsa({ chave }) {
  const estado = {
    tier: 'starter', status: null, usados: 1000, limite: 40000, renova: 1790000000, desvio: 0, devolverChaveNo401: false,
    vozes: {}, naoUsadas: new Set(), biblioteca: [], padrao: [], custoPorLetra: 0.4, ouvido: {},
  }
  const pedidos = []
  const servidor = http.createServer((req, res) => {
    const partes = []
    req.on('data', (c) => partes.push(c))
    req.on('end', () => {
      const corpo = Buffer.concat(partes)
      const url = new URL(req.url, 'http://x')
      const p = { metodo: req.method, caminho: url.pathname, consulta: url.searchParams, cabecalhos: req.headers, corpo }
      pedidos.push(p)
      const json = (status, dados, extra = {}) => { res.writeHead(status, { 'content-type': 'application/json', 'request-id': `req-${pedidos.length}`, ...extra }); res.end(JSON.stringify(dados)) }
      if (req.headers['xi-api-key'] !== chave || estado.devolverChaveNo401) {
        return json(401, { detail: { type: 'authentication_error', code: 'invalid_api_key', message: `Invalid API key: ${req.headers['xi-api-key']}`, status: 'invalid_api_key' } })
      }
      if (req.method === 'GET' && url.pathname === '/v1/user/subscription') {
        return json(200, { tier: estado.tier, status: estado.status ?? (estado.tier === 'free' ? 'free' : 'active'), character_count: estado.usados, character_limit: estado.limite, next_character_count_reset_unix: estado.renova, voice_limit: 10, voice_slots_used: 1 })
      }
      if (req.method === 'GET' && url.pathname.startsWith('/v1/voices/')) {
        // Como a API real (29/09/2026): voz da biblioteca ainda não usada na conta dá 400 voice_not_found.
        const id = decodeURIComponent(url.pathname.slice('/v1/voices/'.length))
        const v = estado.vozes[id]
        return v && !estado.naoUsadas.has(id) ? json(200, v) : json(400, { detail: { status: 'voice_not_found', message: `A voice with ID '${id}' was not found.` } })
      }
      if (req.method === 'GET' && url.pathname === '/v1/shared-voices') return json(200, { voices: estado.biblioteca, has_more: false, total_count: estado.biblioteca.length })
      if (req.method === 'GET' && url.pathname === '/v2/voices') return json(200, { voices: estado.padrao, has_more: false, total_count: estado.padrao.length })
      const tts = url.pathname.match(/^\/v1\/text-to-speech\/([^/]+)\/with-timestamps$/)
      if (req.method === 'POST' && tts) {
        const d = JSON.parse(corpo.toString('utf8'))
        p.json = d
        estado.naoUsadas.delete(decodeURIComponent(tts[1]))
        const al = alinhamentoFalso(d.text)
        const seg = al.character_end_times_seconds.at(-1) + 0.03
        const custo = +(d.text.length * estado.custoPorLetra).toFixed(1)
        estado.usados += Math.ceil(custo)
        return json(200, { audio_base64: mp3Falso(seg, d.text).toString('base64'), alignment: al, normalized_alignment: al }, { 'character-cost': String(custo) })
      }
      if (req.method === 'POST' && url.pathname === '/v1/forced-alignment') {
        const texto = campoMultipart(corpo, 'text')
        p.texto = texto
        let t = 0
        const words = texto.split(' ').map((w, i) => {
          const al = alinhamentoFalso(texto)
          const ini = (i ? al.character_start_times_seconds[t] : INICIO) + estado.desvio
          const fim = al.character_end_times_seconds[t + w.length - 1] + estado.desvio
          t += w.length + 1
          return { text: w, start: +ini.toFixed(3), end: +fim.toFixed(3), loss: 0.1 }
        })
        return json(200, { characters: [], words, loss: 0.1 }, { 'character-cost': '1' })
      }
      if (req.method === 'POST' && url.pathname === '/v1/speech-to-text') {
        // Não transcreve nada: devolve o que o teste pôs em estado.ouvido[<nome do arquivo>].
        const nome = (corpo.toString('latin1').match(/name="file"; filename="([^"]+)"/) || [])[1]
        p.modelo = campoMultipart(corpo, 'model_id'); p.idioma = campoMultipart(corpo, 'language_code'); p.keyterms = campoMultipart(corpo, 'keyterms')
        // um objeto é a resposta inteira, como a API devolve
        if (estado.ouvido[nome] && typeof estado.ouvido[nome] === 'object') return json(200, estado.ouvido[nome], { 'character-cost': '2' })
        const text = estado.ouvido[nome] ?? ''
        return json(200, { language_code: 'eng', text, words: text.split(' ').map((w, i) => ({ text: w, start: i * 0.3, end: i * 0.3 + 0.25, type: 'word' })) }, { 'character-cost': '2' })
      }
      if (req.method === 'POST' && url.pathname === '/v1/text-to-voice/design') {
        const d = JSON.parse(corpo.toString('utf8'))
        p.json = d
        return json(200, { previews: [1, 2, 3].map((i) => ({ audio_base_64: mp3Falso(1).toString('base64'), generated_voice_id: `gen${i}`, duration_secs: 1 })), text: d.text }, { 'character-cost': String(d.text.length) })
      }
      json(404, { detail: { code: 'not_found', message: `no route ${req.method} ${url.pathname}` } })
    })
  })
  await new Promise((r) => servidor.listen(0, '127.0.0.1', r))
  return {
    url: `http://127.0.0.1:${servidor.address().port}`,
    estado,
    pedidos,
    zerar: () => { pedidos.length = 0 },
    tts: () => pedidos.filter((p) => p.caminho.includes('/text-to-speech/')),
    fechar: () => new Promise((r) => servidor.close(r)),
  }
}
