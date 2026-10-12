// Linha do tempo e validação do molde timeline: o eixo se desenha, os marcos acendem em sequência (a câmera anda
// pelo eixo ou fica parada), depois o fecho só com o logo. Roda no navegador (antes do engine) e no Node
// (render.mjs e testes). Tudo dentro de LINHA_TEMPO: no navegador os scripts dividem o escopo com o engine.js.
const LINHA_TEMPO = (() => {
const ORIENTACOES = ['horizontal', 'vertical']
// guiada (desligada por padrão): o eixo inteiro como na estática, e a câmera aproxima no marco da vez e anda junto
const CAMERAS = ['travelling', 'estatica', 'guiada']
const TRANSICOES = { corte: 0, push: 0.6, whip: 0.5, mascara: 0.7, zoom: 0.8 }
const FECHO = { dur: 2.4, min: 1.9, max: 3.2 }
const PASSO = { padrao: 1.4, min: 1.0, max: 4.0 }
const MAX_PALAVRAS = 7
// parada, cabem no quadro de 16:9 até tantos marcos (o texto de cada um precisa de largura ou altura para ser lido)
const MAX_ESTATICA = { horizontal: 4, vertical: 6 }
const ABERTURA = 0.4
const nPalavras = (s) => String(s || '').trim().split(/\s+/).filter(Boolean).length
const ehNum = (v) => typeof v === 'number' && Number.isFinite(v)

/** Os erros dos parâmetros (lista vazia = ok). Cada mensagem diz o campo e o que pôr no lugar. */
function validar(P) {
  const e = []
  if (!P || typeof P !== 'object') return ['the parameters file must be a JSON object (see example.json)']
  const M = P.marca || {}
  if (!P.marca) e.push('missing "marca": { "nome", "logo", "cores": { "fundo", "texto" }, "fontes": { "titulo", "texto" } }')
  else {
    if (!M.nome) e.push('missing "marca.nome"')
    if (!M.cores || !M.cores.fundo || !M.cores.texto) e.push('"marca.cores" needs "fundo" and "texto" (#hex)')
    else for (const [k, v] of Object.entries(M.cores)) if (!/^#[0-9a-fA-F]{6}$/.test(v)) e.push(`marca.cores.${k}: "${v}" is not a #rrggbb color`)
    if (!M.fontes || !M.fontes.titulo) e.push('missing "marca.fontes.titulo" (the family, e.g. "Inter")')
  }
  const ori = P.orientacao || 'horizontal', cam = P.camera || 'travelling'
  if (!ORIENTACOES.includes(ori)) e.push(`orientacao "${P.orientacao}" does not exist: use ${ORIENTACOES.join(' or ')}`)
  if (!CAMERAS.includes(cam)) e.push(`camera "${P.camera}" does not exist: use travelling (moves along the axis), estatica (the whole axis in the frame) or guiada (the whole axis, and the camera zooms in on the current milestone)`)
  if (P.transicao != null && !(P.transicao in TRANSICOES)) e.push(`transicao "${P.transicao}" does not exist: use ${Object.keys(TRANSICOES).join(', ')}`)
  if (P.titulo != null && nPalavras(P.titulo) > MAX_PALAVRAS) e.push(`the title has ${nPalavras(P.titulo)} words; at most ${MAX_PALAVRAS} (informative text, no catchphrase)`)
  if (P.passo != null && (!ehNum(P.passo) || P.passo < PASSO.min || P.passo > PASSO.max)) e.push(`passo ${P.passo} s: use ${PASSO.min} to ${PASSO.max} s per milestone (the time to read the line)`)
  if (!Array.isArray(P.marcos) || P.marcos.length < 2 || P.marcos.length > 10) e.push('"marcos" needs 2 to 10 items: [{ "etapa": "Request", "texto": "What to show and to whom" }] (or "data" instead of "etapa")')
  else {
    P.marcos.forEach((m, i) => {
      const q = `milestone ${i + 1}`
      if (!m || (!m.etapa && !m.data)) e.push(`${q}: missing "etapa" or "data" (the pill label, e.g. "Render" or "Jan 2025")`)
      else if (nPalavras(m.etapa || m.data) > 3) e.push(`${q}: the step "${m.etapa || m.data}" has more than 3 words; the pill takes a short name`)
      if (!m || !m.texto) e.push(`${q}: missing "texto" (one line, up to ${MAX_PALAVRAS} words)`)
      else if (nPalavras(m.texto) > MAX_PALAVRAS) e.push(`${q}: the text has ${nPalavras(m.texto)} words; at most ${MAX_PALAVRAS} (one informative line)`)
    })
    if (cam !== 'travelling' && CAMERAS.includes(cam) && ORIENTACOES.includes(ori) && P.marcos.length > MAX_ESTATICA[ori]) e.push(`${P.marcos.length} milestones do not fit with the whole axis in the frame (camera ${cam}) in the ${ori} orientation (up to ${MAX_ESTATICA[ori]}): use "camera": "travelling"`)
  }
  if (P.final != null && (!ehNum(P.final) || P.final < 0.8 || P.final > 4)) e.push(`final ${P.final} s: the last milestone stays 0.8 to 4 s before the closing`)
  const F = P.fecho || {}
  for (const k of ['bordao', 'slogan', 'frase', 'texto', 'url', 'endereco']) if (F[k]) e.push(`fecho.${k}: this template's closing is the logo only, no text. Remove "${k}"`)
  if (F.dur != null && (!ehNum(F.dur) || F.dur < FECHO.min || F.dur > FECHO.max)) e.push(`fecho.dur ${F.dur} s: use ${FECHO.min} to ${FECHO.max} s (the logo holds still for 1.5 to 2.5 s)`)
  if (F.fundo != null && !/^#[0-9a-fA-F]{6}$/.test(F.fundo)) e.push(`fecho.fundo: "${F.fundo}" is not a #rrggbb color`)
  if (!M.logo && !F.logo) e.push('missing the logo: "marca.logo" (PNG) or "fecho.logo"; the closing is the logo only')
  return e
}

/** A linha do tempo: quando cada marco acende, o corte para o fecho e as seções da trilha. Lança erro com as mensagens. */
function planejar(P) {
  const erros = validar(P)
  if (erros.length) { const err = new Error('parameters with problems:\n  · ' + erros.join('\n  · ')); err.erros = erros; throw err }
  const passo = P.passo || PASSO.padrao, n = P.marcos.length
  const final = P.final != null ? P.final : Math.max(1.4, passo)
  const tr = P.transicao || 'corte', d = TRANSICOES[tr]
  const marcos = P.marcos.map((m, i) => ({ ...m, i, t: +(ABERTURA + i * passo).toFixed(3) }))
  const fim = +(marcos[n - 1].t + final).toFixed(3)
  const fdur = (P.fecho && P.fecho.dur) || FECHO.dur
  const fecho = { t0: fim, t1: +(fim + fdur).toFixed(3), dur: fdur, de: +(fim - d / 2).toFixed(3) }
  fecho.logoEm = +(fim + (d ? d / 2 : 0.35)).toFixed(3)
  const corte = { t: fim, a: +(fim - d / 2).toFixed(3), d }
  const secoes = [
    { nome: 'abertura', de: 0, ate: n > 1 ? marcos[1].t : fim },
    ...marcos.slice(1).map((m, j) => ({ nome: `marco-${m.i + 1}`, de: m.t, ate: j + 2 < n ? marcos[j + 2].t : fim })),
    { nome: 'fechamento', de: fim, ate: fecho.t1 },
  ]
  return { orientacao: P.orientacao || 'horizontal', camera: P.camera || 'travelling', passo, final, transicao: tr, dTransicao: d,
    marcos, cena: { t0: 0, t1: fim, ate: +(fim + d / 2).toFixed(3) }, corte, fecho, dur: fecho.t1, secoes }
}

return { planejar, validar, ORIENTACOES, CAMERAS, TRANSICOES, FECHO, PASSO, MAX_PALAVRAS, MAX_ESTATICA, ABERTURA }
})()

if (typeof module !== 'undefined') module.exports = LINHA_TEMPO
