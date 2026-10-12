// A locução vista pelo motor (video.voz): lê a narration.json (Contrato L), confere, e põe cada fala no tempo do
// vídeo. O motor não sabe quem gerou a voz: só lê o JSON e os WAV ao lado. Quem grava (record.mjs) usa os tempos
// para segurar cada passo pela fala; quem compõe (compose.mjs) usa para montar voz.wav, o .srt e o bloco `voz` da
// folha de sincronia, e para a legenda destacar a palavra falada.
//
// Regra do tempo: a voz manda e a imagem segue. Primeiro diz, depois faz. Passo de vários toques: a fala e os
// toques correm juntos (g.passo(…, { junto: true }) + g.na), cada toque na palavra dele.
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { contraste } from './visual.mjs'

export const ENTRA = 0.15     // da troca de legenda ao primeiro som
export const ANTES = 0.30     // a 1ª ação do passo começa isto antes do fim da frase
export const FOLGA = 0.5      // da última palavra até o próximo passo
// a tela aparece e respira antes da primeira fala: com 0,5 s, a legenda do 1º passo já entrou inteira em qualquer
// saída de abertura (a cortina é a mais lenta: a legenda termina de entrar em A + 0,65 s = 0,5 + ENTRA)
export const RESPIRO = 0.5
export const PERFIS = ['calmo', 'reels']
export const TAXA = 48000
const AB_SOM = 0.30, AB_DEPOIS = 0.40      // abertura: o primeiro som, e o respiro depois da última palavra
const FE_SOM = 0.25, FE_LOGO = 1.5         // fechamento: o primeiro som, e o logo parado depois da voz
const DESTAQUE_MIN = 0.12                  // palavra curta ("a", "o") não pisca: fica em destaque ao menos isto

const r3 = (x) => +x.toFixed(3)
/** Da primeira fala medida ao fim da última palavra. */
export const util = (f) => f.palavras[f.palavras.length - 1].fim - f.inicio_voz
/** Comparação de texto sem caixa e sem pontuação (acento conta). */
export const normal = (s) => String(s).toLocaleLowerCase('pt-BR').replace(/[^\p{L}\p{N}]+/gu, ' ').trim()
const ondeTxt = (o) => (o && typeof o === 'object' ? `step ${o.passo}` : o === 'abertura' ? 'the opening' : o === 'fechamento' ? 'the closing' : String(o))

export function caminhoLocucao(video, v) {
  return path.resolve(video.pasta, String(video.voz.locucao).replace(/\{versao\}/g, v))
}

/** Lê e confere a locução da versão. Devolve { falas, abertura, fechamento, passos: Map n → fala, sha256, perfil, … }. */
export function lerLocucao(video, v) {
  if (!video.voz.locucao) throw new Error('video.voz without "locucao": use voz: { locucao: \'voice/{versao}/narration.json\', perfil: \'calmo\' }')
  const perfil = video.voz.perfil ?? 'calmo'
  if (!PERFIS.includes(perfil)) throw new Error(`video.voz.perfil "${perfil}" does not exist: use ${PERFIS.map((p) => `'${p}'`).join(' or ')}`)
  const arq = caminhoLocucao(video, v)
  const rel = path.relative(video.pasta, arq)
  if (!fs.existsSync(arq)) throw new Error(`the narration of version ${v} is missing: ${rel}. Generate this version's voice (voice.mjs generate) or remove "voz" from video.mjs for the video without voice.`)
  const bruto = fs.readFileSync(arq)
  let loc
  try { loc = JSON.parse(bruto) } catch (e) { throw new Error(`${rel} is not JSON: ${e.message}`) }
  const dir = path.dirname(arq)
  const erros = conferirLocucao(loc, dir)
  if (erros.length) throw new Error(`${rel} does not follow the narration contract:\n    ${erros.join('\n    ')}`)
  const passos = new Map()
  let abertura = null, fechamento = null
  for (const f of loc.falas) {
    f.caminho = path.join(dir, f.arquivo)
    if (f.onde === 'abertura') abertura = f
    else if (f.onde === 'fechamento') fechamento = f
    else passos.set(f.onde.passo, f)
  }
  return { ...loc, arquivo: arq, rel, dir, perfil, abertura, fechamento, passos, sha256: crypto.createHash('sha256').update(bruto).digest('hex') }
}

/** O Contrato L, do lado de quem lê. Devolve a lista de erros (vazia = ok). */
export function conferirLocucao(loc, dir) {
  const E = []
  if (!loc || loc.versao !== 1) E.push(`"versao" must be 1 (got ${JSON.stringify(loc && loc.versao)})`)
  if (!loc || !Array.isArray(loc.falas) || !loc.falas.length) { E.push('"falas" must be a list with at least one line'); return E }
  const ids = new Set(), ondes = new Set()
  loc.falas.forEach((f, i) => {
    const q = `falas[${i}]${f && f.id ? ` (${f.id})` : ''}`
    if (!f || typeof f !== 'object') { E.push(`${q}: not an object`); return }
    if (typeof f.id !== 'string' || !f.id) E.push(`${q}: empty "id"`)
    else if (ids.has(f.id)) E.push(`${q}: repeated "id"`)
    ids.add(f.id)
    const okOnde = f.onde === 'abertura' || f.onde === 'fechamento' || (f.onde && typeof f.onde === 'object' && Number.isInteger(f.onde.passo) && f.onde.passo >= 1)
    if (!okOnde) E.push(`${q}: "onde" must be "abertura", "fechamento" or { "passo": n } with n ≥ 1 (got ${JSON.stringify(f.onde)})${f.onde && f.onde.capitulo ? '; { "capitulo": n } is for the chapter video (references/chapters.md), not the tutorial' : ''}`)
    else if (ondes.has(ondeTxt(f.onde))) E.push(`${q}: there is already a line for ${ondeTxt(f.onde)}`)
    else ondes.add(ondeTxt(f.onde))
    if (typeof f.texto !== 'string' || !f.texto.trim()) E.push(`${q}: empty "texto"`)
    if (typeof f.arquivo !== 'string' || !f.arquivo) E.push(`${q}: empty "arquivo"`)
    else if (dir && !fs.existsSync(path.join(dir, f.arquivo))) E.push(`${q}: the audio ${f.arquivo} does not exist next to the narration.json`)
    if (!(f.duracao > 0)) E.push(`${q}: "duracao" must be > 0`)
    if (!(f.inicio_voz >= 0) || !(f.inicio_voz < f.duracao)) E.push(`${q}: "inicio_voz" must be between 0 and the duration`)
    if (!Array.isArray(f.palavras) || !f.palavras.length) { E.push(`${q}: empty "palavras"`); return }
    let ant = -1
    for (const p of f.palavras) {
      if (typeof p.texto !== 'string' || !(p.ini >= 0) || !(p.fim >= p.ini)) { E.push(`${q}: word ${JSON.stringify(p)} without a valid texto, ini or fim`); return }
      if (p.ini < ant) { E.push(`${q}: the words are out of order ("${p.texto}" starts before the previous one)`); return }
      if (p.fim > f.duracao + 0.05) { E.push(`${q}: "${p.texto}" ends at ${p.fim} s, after the end of the audio (${f.duracao} s)`); return }
      ant = p.ini
    }
    if (f.palavras[0].ini < f.inicio_voz - 0.0005) E.push(`${q}: the 1st word starts (${f.palavras[0].ini} s) before the first sound (inicio_voz ${f.inicio_voz} s)`)
    if (typeof f.texto === 'string' && f.palavras.map((p) => p.texto).join(' ') !== f.texto.trim().split(/\s+/).join(' ')) E.push(`${q}: the words joined by spaces do not make the "texto" ("${f.palavras.map((p) => p.texto).join(' ')}" ≠ "${f.texto}"): the caption shows the text and highlights the words, so both have to match`)
  })
  return E
}

/** Abertura e fechamento falados dizem exatamente o que está escrito na tela. Os dois erros saem juntos. */
export function conferirTextos(loc, { titulo, fimLinhas }) {
  const erros = []
  if (loc.abertura && normal(loc.abertura.texto) !== normal(titulo)) erros.push(`the opening line ("${loc.abertura.texto}") is not the video title ("${titulo}"). The opening shows the title: the voice says the same. Change one of the two.`)
  const fim = fimLinhas.join(' ')
  if (loc.fechamento && normal(loc.fechamento.texto) !== normal(fim)) erros.push(`the closing line ("${loc.fechamento.texto}") is not the closing text ("${fim}", from fimLinhas). Change one of the two.`)
  if (erros.length) throw new Error(erros.join('\n    '))
}

/** O script.json da voz desta versão: video.voz.roteiro, ou o script.json ao lado da locução. */
export function caminhoRoteiro(video, v) {
  if (video.voz.roteiro) return path.resolve(video.pasta, String(video.voz.roteiro).replace(/\{versao\}/g, v))
  return path.join(path.dirname(caminhoLocucao(video, v)), 'script.json')
}

/** Antes de gerar a voz, o --check confere pelo texto do script.json o que não depende do tempo: a abertura é o título,
 *  o fecho é o fimLinhas, cada g.na acha a palavra na fala do passo, nenhuma fala sobra. Mesmo formato do lerLocucao
 *  (palavras só com o texto, sem tempo), com soTexto: true. A marcação entre colchetes da voz ("[warm]") não vai à tela. */
export function lerRoteiroComoLocucao(video, v) {
  const arq = caminhoRoteiro(video, v), rel = path.relative(video.pasta, arq)
  if (!fs.existsSync(arq)) throw new Error(`there is neither the narration (${path.relative(video.pasta, caminhoLocucao(video, v))}) nor the voice script (${rel}): write the script.json before the --check`)
  let r
  try { r = JSON.parse(fs.readFileSync(arq, 'utf8')) } catch (e) { throw new Error(`${rel} is not JSON: ${e.message}`) }
  if (!r || !Array.isArray(r.falas) || !r.falas.length) throw new Error(`${rel}: "falas" must be a list with at least one line`)
  const passos = new Map()
  let abertura = null, fechamento = null
  const falas = r.falas.map((f, i) => {
    const texto = String((f && f.texto) || '').replace(/\[[^\]]*\]/g, ' ').replace(/\s+/g, ' ').trim()
    if (!texto) throw new Error(`${rel}: line ${(f && f.id) || i} has no text`)
    const x = { id: f.id || `fala${i + 1}`, onde: f.onde, texto, palavras: texto.split(' ').map((t) => ({ texto: t })) }
    if (f.onde === 'abertura') abertura = x
    else if (f.onde === 'fechamento') fechamento = x
    else if (f.onde && Number.isInteger(f.onde.passo)) passos.set(f.onde.passo, x)
    else throw new Error(`${rel}: line ${x.id} has "onde" ${JSON.stringify(f.onde)}; in the tutorial it is "abertura", "fechamento" or { "passo": n }`)
    return x
  })
  return { falas, abertura, fechamento, passos, rel, arquivo: arq, perfil: r.perfil ?? video.voz.perfil ?? 'calmo', soTexto: true }
}

/** Quanto o passo fica na tela antes do próximo: a leitura mínima, ou a fala inteira mais a folga. */
export const esperaDoPasso = (fala, leituraMin) => (fala ? Math.max(leituraMin, ENTRA + util(fala) + FOLGA) : leituraMin)
/** Quando o g.passo() devolve o controle, contado da troca de legenda: 0,3 s antes do fim da frase. */
export const devolveEm = (fala) => Math.max(0, ENTRA + util(fala) - ANTES)

// g.na(palavra) volta isto antes da palavra. Do g.na ao toque: ~0,13 s de checagem, o mover (0,32 a 0,75 s; ~0,45 s
// num toque típico), 0,26 s de realce e ~0,13 s de checagem de novo. Com 0,6 s, o indicador chega no começo da
// palavra e o toque cai ~0,4 s depois, ainda dentro dela.
export const NA_ANTES = 0.6
// mais que isto sem voz no meio do vídeo arrasta: o gravador avisa no fim
export const SILENCIO_MAX = 2.5

/** Onde a palavra (ou a sequência, "New sale") está na fala, procurando a partir da palavra `desde`.
 *  Devolve { ini, fim } (índices em fala.palavras, fim exclusivo). Não achou = erro que diz o passo, a palavra e a fala. */
export function acharPalavra(fala, palavra, desde = 0) {
  const alvo = normal(palavra)
  const n = fala.onde && fala.onde.passo
  if (!alvo) throw new Error(`g.na(${JSON.stringify(palavra)}): say the word of step ${n}'s line where the tap falls`)
  const ws = fala.palavras.map((p) => p.texto)
  const procura = (de) => {
    for (let i = de; i < ws.length; i++) {
      // a partir de um sinal solto ("—") não: o tempo seria o do sinal, não o da palavra
      if (!normal(ws[i])) continue
      for (let k = i + 1; k <= ws.length; k++) {
        const s = normal(ws.slice(i, k).join(' '))
        if (s === alvo) return { ini: i, fim: k }
        if (s.length >= alvo.length) break
      }
    }
    return null
  }
  const achou = procura(desde)
  if (achou) return achou
  if (desde > 0 && procura(0)) throw new Error(`g.na('${palavra}'): step ${n}'s line has no more of that word after "${ws[desde - 1]}", the last one a g.na took ("${fala.texto}")`)
  throw new Error(`g.na('${palavra}'): step ${n}'s line does not have that word ("${fala.texto}")`)
}

/** Quando a palavra i começa, no relógio da gravação: o passo trocou em tPasso, o 1º som cai ENTRA depois
 *  (é o que linhaDoTempo usa para pôr a voz no vídeo). */
export const instanteDaPalavra = (fala, i, tPasso) => tPasso + ENTRA + fala.palavras[i].ini - fala.inicio_voz

/** Trechos sem voz no meio da gravação: do fim de cada fala ao primeiro som da fala seguinte (ou ao fim da
 *  gravação, no último passo). Devolve os que passam de `limite`: [{ n, seg, toques }], toques = os do trecho. */
export function silencios(eventos, passos, fim, limite = SILENCIO_MAX) {
  const comFala = eventos.filter((e) => e.tipo === 'passo' && passos.get(e.n))
  const toques = eventos.filter((e) => e.tipo === 'toque')
  const out = []
  comFala.forEach((e, k) => {
    const de = e.t + ENTRA + util(passos.get(e.n))
    const ate = k + 1 < comFala.length ? comFala[k + 1].t + ENTRA : fim
    if (ate - de > limite) out.push({ n: e.n, seg: r3(ate - de), toques: toques.filter((x) => x.t >= de && x.t < ate).length })
  })
  return out
}

export const duracaoAbertura = (fala, base) => (fala ? Math.max(base, AB_SOM + util(fala) + AB_DEPOIS) : base)
export const duracaoFechamento = (fala, base) => (fala ? Math.max(base, FE_SOM + util(fala) + FE_LOGO) : base)

/** Palavras no tempo do vídeo, com o fim do destaque (ate): nunca menos que DESTAQUE_MIN, nunca depois da próxima. */
export function destaques(palavras, desloc) {
  return palavras.map((p, i) => {
    const ini = desloc + p.ini, prox = palavras[i + 1] ? desloc + palavras[i + 1].ini : Infinity
    return { texto: p.texto, ini: r3(ini), fim: r3(desloc + p.fim), ate: r3(Math.min(prox, Math.max(desloc + p.fim, ini + DESTAQUE_MIN))) }
  })
}

/** Cada fala no tempo do vídeo. Confere que a gravação é desta locução: nenhuma fala atravessa uma troca de passo. */
export function linhaDoTempo(loc, log, { A, D }) {
  const passos = log.eventos.filter((e) => e.tipo === 'passo')
  const out = []
  const por = (f, inicioArquivo) => ({
    id: f.id, onde: f.onde, texto: f.texto, caminho: f.caminho, inicioArquivo,
    som: inicioArquivo + f.inicio_voz, fim: inicioArquivo + f.palavras[f.palavras.length - 1].fim,
    palavras: destaques(f.palavras, inicioArquivo),
  })
  if (loc.abertura) out.push(por(loc.abertura, AB_SOM - loc.abertura.inicio_voz))
  for (const [n, f] of [...loc.passos].sort((a, b) => a[0] - b[0])) {
    const i = passos.findIndex((e) => e.n === n)
    if (i < 0) throw new Error(`the narration has a line for step ${n} ("${f.texto}"), but the recording has ${passos.length} step(s). Check the script or the narration.`)
    const pa = passos[i], lim = i + 1 < passos.length ? passos[i + 1].t : D
    const x = por(f, A + pa.t + ENTRA - f.inicio_voz)
    // a gravação segurou o passo por esta fala? (outra locução depois de gravar quebra isto). A legenda começa a
    // trocar 0,25 s antes do passo seguinte: a fala termina antes disso.
    if (x.fim > A + lim - 0.25) throw new Error(`step ${n}'s line ("${f.texto}", ${util(f).toFixed(2)} s) does not fit in the recorded step (${(lim - pa.t).toFixed(2)} s): the recording is from another narration. Record again (node video.mjs).`)
    out.push(x)
  }
  if (loc.fechamento) out.push(por(loc.fechamento, A + D + FE_SOM - loc.fechamento.inicio_voz))
  return out.sort((a, b) => a.som - b.som)
}

/** Como a palavra falada se destaca na legenda: a cor da marca (acento) se ela se lê sobre o fundo da legenda
 *  (≥ 3:1); senão, marca-texto na cor. A letra do marca-texto é a tinta da série se ela se lê ali (≥ 4,5:1); senão,
 *  a que mais contrasta entre o fundo da legenda, branco e quase-preto. A cor do destaque nunca é fixa. */
export function estiloDestaque(marca, { fundo, tinta }) {
  const cores = (marca && marca.cores) || {}
  const hex = (h) => (/^#[0-9a-f]{3}$/i.test(h) ? '#' + [...h.slice(1)].map((c) => c + c).join('') : h)
  const cor = hex(cores.acento || cores.marca)
  if (!/^#[0-9a-f]{6}$/i.test(cor || '')) throw new Error(`the spoken caption highlights the word in the brand's accent color: MARCA.cores.acento (or .marca) must be a hex, got ${JSON.stringify(cores.acento || cores.marca)}`)
  const f = hex(fundo), t = hex(tinta)
  if (contraste(cor, f) >= 3) return { modo: 'cor', cor }
  const letra = contraste(t, cor) >= 4.5 ? t : [f, '#FFFFFF', '#111111', t].reduce((a, b) => (contraste(b, cor) > contraste(a, cor) ? b : a))
  return { modo: 'marca', cor, tinta: letra }
}

// ---------- áudio: WAV PCM sem dependência ----------
function lerWav(arquivo) {
  const b = fs.readFileSync(arquivo)
  if (b.toString('ascii', 0, 4) !== 'RIFF' || b.toString('ascii', 8, 12) !== 'WAVE') throw new Error(`${arquivo} is not a WAV`)
  let fmt = null, dados = null
  for (let o = 12; o + 8 <= b.length;) {
    const id = b.toString('ascii', o, o + 4), n = b.readUInt32LE(o + 4)
    if (id === 'fmt ') fmt = { tag: b.readUInt16LE(o + 8), canais: b.readUInt16LE(o + 10), taxa: b.readUInt32LE(o + 12), bits: b.readUInt16LE(o + 22), sub: n >= 26 ? b.readUInt16LE(o + 32) : null }
    if (id === 'data') dados = b.subarray(o + 8, Math.min(b.length, o + 8 + n))
    o += 8 + n + (n % 2)
  }
  if (!fmt || !dados) throw new Error(`${arquivo}: WAV without fmt or data`)
  const tag = fmt.tag === 0xfffe ? fmt.sub : fmt.tag
  if (fmt.taxa !== TAXA || fmt.canais !== 1) throw new Error(`${arquivo}: the narration contract asks for 48 kHz mono, got ${fmt.taxa} Hz with ${fmt.canais} channel(s)`)
  const q = fmt.bits / 8, n = Math.floor(dados.length / q), x = new Int16Array(n)
  const i16 = (v) => Math.max(-32768, Math.min(32767, Math.round(v * 32768)))
  for (let i = 0; i < n; i++) {
    const o = i * q
    if (tag === 1 && q === 2) x[i] = dados.readInt16LE(o)
    else if (tag === 1 && q === 3) x[i] = i16(dados.readIntLE(o, 3) / 8388608)
    else if (tag === 1 && q === 4) x[i] = i16(dados.readInt32LE(o) / 2147483648)
    else if (tag === 3 && q === 4) x[i] = i16(dados.readFloatLE(o))
    else throw new Error(`${arquivo}: ${fmt.bits}-bit sample (format ${tag}) not supported; use 16- or 24-bit PCM`)
  }
  return x
}

/** voz.wav: a faixa inteira do vídeo, 48 kHz mono 16 bits, cada fala na amostra dela e silêncio fora delas. */
export function escreverVozWav(falas, duracao, destino) {
  const n = Math.round(duracao * TAXA), y = new Int16Array(n)
  for (const f of falas) {
    const x = lerWav(f.caminho), o = Math.round(f.inicioArquivo * TAXA)
    for (let i = Math.max(0, -o); i < x.length && o + i < n; i++) y[o + i] = Math.max(-32768, Math.min(32767, y[o + i] + x[i]))
  }
  const h = Buffer.alloc(44)
  h.write('RIFF', 0); h.writeUInt32LE(36 + n * 2, 4); h.write('WAVE', 8); h.write('fmt ', 12)
  h.writeUInt32LE(16, 16); h.writeUInt16LE(1, 20); h.writeUInt16LE(1, 22); h.writeUInt32LE(TAXA, 24)
  h.writeUInt32LE(TAXA * 2, 28); h.writeUInt16LE(2, 32); h.writeUInt16LE(16, 34); h.write('data', 36); h.writeUInt32LE(n * 2, 40)
  fs.writeFileSync(destino, Buffer.concat([h, Buffer.from(y.buffer, y.byteOffset, y.byteLength)]))
}

/** Legenda externa: uma deixa por fala, do primeiro som ao fim da última palavra, no tempo do vídeo final. */
export function srt(falas) {
  const ts = (s) => { const ms = Math.round(s * 1000), h = Math.floor(ms / 3600000), m = Math.floor(ms / 60000) % 60, ss = Math.floor(ms / 1000) % 60; return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(ss).padStart(2, '0')},${String(ms % 1000).padStart(3, '0')}` }
  return falas.map((f, i) => `${i + 1}\n${ts(f.som)} --> ${ts(f.fim)}\n${f.texto}\n`).join('\n')
}

/** O bloco `voz` da folha de sincronia (Contrato F). */
export function blocoFolha(falas, perfil) {
  return {
    arquivo: 'voz.wav',
    trechos: falas.map((f) => [r3(f.som), r3(f.fim)]),
    perfil,
    falas: falas.map((f) => ({ id: f.id, t: r3(f.som), texto: f.texto })),
  }
}
