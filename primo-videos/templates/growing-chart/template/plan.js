// Linha do tempo e validação do molde growing-chart: uma cena por gráfico, depois o fecho só com o logo.
// Roda no navegador (antes do engine) e no Node (render.mjs e testes), para os dois saberem onde cada corte cai.
// Tudo dentro de GRAFICO: no navegador os scripts dividem o mesmo escopo com o engine.js (que já tem TRANSICOES, P…).
const GRAFICO = (() => {
const TIPOS = ['barras', 'colunas', 'linha', 'rosca']
const LEIAUTES = ['em-cima', 'dividido']
const LADOS = ['esquerda', 'direita']
// transição entre as cenas e para o fecho: duração da janela (centrada no corte)
const TRANSICOES = { corte: 0, push: 0.6, whip: 0.5, mascara: 0.7, zoom: 0.8 }
const FECHO = { dur: 2.4, min: 1.9, max: 3.2 }
const MAX_PALAVRAS = 7
// quando cada parte de uma cena termina de se desenhar (s desde o início da cena): o mínimo que a cena dura é isso + 0,6 s
const ENTRA = 0.3, ESCALONA = 0.28, CRESCE = 1.2

// "percorrer" (barras e colunas, desligado por padrão): depois de crescer, o destaque passa de item em item, cada um
// com o número dando um pulo, e no fim volta ao destaque de sempre. Nada fica parado com o gráfico pronto.
const PERCORRE = { pausa: 0.15, item: 0.55, volta: 0.45 }
const PERCORRIVEIS = ['barras', 'colunas']
function desenhoBase(c) {
  if (c.tipo === 'rosca') return ENTRA + 1.8
  const n = (c.itens || []).length
  if (c.tipo === 'linha') return ENTRA + 0.25 * n + 1.2
  return ENTRA + ESCALONA * Math.max(0, n - 1) + CRESCE
}
const inicioPercurso = (c) => desenhoBase(c) + PERCORRE.pausa
function fimDoDesenho(c) {
  const base = desenhoBase(c)
  return c.percorrer && PERCORRIVEIS.includes(c.tipo) ? base + PERCORRE.pausa + PERCORRE.item * (c.itens || []).length + PERCORRE.volta : base
}
const durPadrao = (c) => Math.round((fimDoDesenho(c) + 2.0) * 10) / 10
const nPalavras = (s) => String(s || '').trim().split(/\s+/).filter(Boolean).length
const ehNum = (v) => typeof v === 'number' && Number.isFinite(v)

/** Os erros dos parâmetros (lista vazia = ok). Cada mensagem diz o campo e o que pôr no lugar. */
function validar(P) {
  const e = []
  if (!P || typeof P !== 'object') return ['the parameters file must be a JSON object (see example-split.json)']
  const M = P.marca || {}
  if (!P.marca) e.push('missing "marca": { "nome", "logo", "cores": { "fundo", "texto" }, "fontes": { "titulo", "texto" } }')
  else {
    if (!M.nome) e.push('missing "marca.nome"')
    if (!M.cores || !M.cores.fundo || !M.cores.texto) e.push('"marca.cores" needs "fundo" and "texto" (#hex)')
    else for (const [k, v] of Object.entries(M.cores)) for (const x of [].concat(v)) if (!/^#[0-9a-fA-F]{6}$/.test(x)) e.push(`marca.cores.${k}: "${x}" is not a #rrggbb color`)
    if (!M.fontes || !M.fontes.titulo) e.push('missing "marca.fontes.titulo" (the font family, e.g. "Inter")')
  }
  if (P.leiaute != null && !LEIAUTES.includes(P.leiaute)) e.push(`leiaute "${P.leiaute}" does not exist: use ${LEIAUTES.join(' or ')}`)
  if (P.lado != null && !LADOS.includes(P.lado)) e.push(`lado "${P.lado}" does not exist: use ${LADOS.join(' or ')} (which side the chart goes on in the split layout)`)
  if (P.transicao != null && !(P.transicao in TRANSICOES)) e.push(`transicao "${P.transicao}" does not exist: use ${Object.keys(TRANSICOES).join(', ')}`)
  if (!Array.isArray(P.cenas) || !P.cenas.length) e.push('missing "cenas": a list of 1 to 4 charts ({ "tipo": "barras", "titulo", "itens": [{ "rotulo", "valor" }] })')
  else {
    if (P.cenas.length > 4) e.push(`${P.cenas.length} scenes: at most 4 charts per video (one subject per screen)`)
    P.cenas.forEach((c, i) => {
      const q = `scene ${i + 1}`
      if (!TIPOS.includes(c.tipo)) { e.push(`${q}: tipo "${c.tipo}" does not exist: use ${TIPOS.join(', ')}`); return }
      if (!c.titulo) e.push(`${q}: missing "titulo" (the chart's subject, up to ${MAX_PALAVRAS} words)`)
      else if (nPalavras(c.titulo) > MAX_PALAVRAS) e.push(`${q}: the title has ${nPalavras(c.titulo)} words; at most ${MAX_PALAVRAS} (informative text, no slogan)`)
      if (c.nota && nPalavras(c.nota) > MAX_PALAVRAS) e.push(`${q}: the note has ${nPalavras(c.nota)} words; at most ${MAX_PALAVRAS} (the data source, short)`)
      if (c.percorrer != null && typeof c.percorrer !== 'boolean') e.push(`${q}: "percorrer" is true or false (the highlight moves from item to item after growing)`)
      else if (c.percorrer && !PERCORRIVEIS.includes(c.tipo)) e.push(`${q}: "percorrer" only works with ${PERCORRIVEIS.join(' and ')} (the scene is ${c.tipo})`)
      if (c.leiaute != null && !LEIAUTES.includes(c.leiaute)) e.push(`${q}: leiaute "${c.leiaute}" does not exist: use ${LEIAUTES.join(' or ')}`)
      if (c.lado != null && !LADOS.includes(c.lado)) e.push(`${q}: lado "${c.lado}" does not exist: use ${LADOS.join(' or ')}`)
      if (c.tipo === 'rosca') {
        if (!ehNum(c.valor) || !ehNum(c.total)) e.push(`${q}: the donut needs numeric "valor" and "total" (e.g. 96 of 128)`)
        else if (c.valor < 0 || c.total <= 0 || c.valor > c.total) e.push(`${q}: donut with valor ${c.valor} and total ${c.total}: the value must be between 0 and the total`)
        if (!c.rotulo) e.push(`${q}: missing "rotulo" in the donut (what the value counts, e.g. "items are already done")`)
        else if (nPalavras(c.rotulo) > MAX_PALAVRAS) e.push(`${q}: the label has ${nPalavras(c.rotulo)} words; at most ${MAX_PALAVRAS}`)
      } else {
        const min = c.tipo === 'linha' ? 3 : 2, max = c.tipo === 'linha' ? 12 : 8
        if (!Array.isArray(c.itens) || c.itens.length < min || c.itens.length > max) e.push(`${q}: ${c.tipo} needs ${min} to ${max} items in "itens": [{ "rotulo", "valor" }]`)
        else c.itens.forEach((it, j) => {
          if (!it || it.rotulo == null || it.rotulo === '') e.push(`${q}, item ${j + 1}: missing "rotulo"`)
          if (!it || !ehNum(it.valor)) e.push(`${q}, item ${j + 1}: "valor" must be a number (got ${JSON.stringify(it && it.valor)})`)
          else if (it.valor < 0) e.push(`${q}, item ${j + 1}: negative value (${it.valor}); the template draws from 0 up`)
        })
        if (c.destaque != null && ![].concat(c.destaque).every((d) => Number.isInteger(d) && d >= 0 && d < (c.itens || []).length)) e.push(`${q}: "destaque" is the index (from 0) of an item, or a list of them`)
      }
      if (c.dur != null) {
        const min = Math.ceil((fimDoDesenho(c) + 0.6) * 10) / 10
        if (!ehNum(c.dur) || c.dur < min) e.push(`${q}: dur ${c.dur} s is not enough time for the chart to draw: use ${min} s or more (or remove "dur": the default is ${durPadrao(c)} s)`)
      }
    })
  }
  const F = P.fecho || {}
  for (const k of ['bordao', 'slogan', 'frase', 'texto', 'url', 'endereco']) if (F[k]) e.push(`fecho.${k}: this template's closing is only the logo, with no text. Remove "${k}"`)
  if (F.dur != null && (!ehNum(F.dur) || F.dur < FECHO.min || F.dur > FECHO.max)) e.push(`fecho.dur ${F.dur} s: use ${FECHO.min} to ${FECHO.max} s (the logo stays still for 1.5 to 2.5 s)`)
  if (F.fundo != null && !/^#[0-9a-fA-F]{6}$/.test(F.fundo)) e.push(`fecho.fundo: "${F.fundo}" is not a #rrggbb color`)
  if (!M.logo && !F.logo) e.push('missing the logo: "marca.logo" (PNG) or "fecho.logo"; the closing is only the logo')
  return e
}

/** A linha do tempo: cenas, cortes (com a transição), fecho e as seções da trilha. Lança erro com todas as mensagens. */
function planejar(P) {
  const erros = validar(P)
  if (erros.length) { const err = new Error('parameters with problems:\n  · ' + erros.join('\n  · ')); err.erros = erros; throw err }
  const tr = P.transicao || 'corte', d = TRANSICOES[tr]
  let t = 0
  const cenas = P.cenas.map((c, i) => {
    const dur = c.dur || durPadrao(c)
    const s = { ...c, i, t0: +t.toFixed(3), t1: +(t + dur).toFixed(3), dur, leiaute: c.leiaute || P.leiaute || 'em-cima', lado: c.lado || P.lado || 'esquerda', desenhado: fimDoDesenho(c) }
    t += dur
    return s
  })
  const fdur = (P.fecho && P.fecho.dur) || FECHO.dur
  const fecho = { t0: +t.toFixed(3), t1: +(t + fdur).toFixed(3), dur: fdur }
  const dur = fecho.t1
  // cada cena fica ativa meia transição antes e depois do corte (as duas se sobrepõem na janela)
  const cortes = cenas.map((c) => ({ t: c.t1, a: +(c.t1 - d / 2).toFixed(3), d }))
  cenas.forEach((c, i) => { c.de = i === 0 ? 0 : cortes[i - 1].a; c.ate = +(c.t1 + d / 2).toFixed(3) })
  fecho.de = cortes[cortes.length - 1].a
  // o logo assenta quando a transição termina (no corte seco, depois do pulo de entrada)
  fecho.logoEm = +(fecho.t0 + (d ? d / 2 : 0.35)).toFixed(3)
  const secoes = [...cenas.map((c, i) => ({ nome: i === 0 ? 'opening' : `${c.tipo}-${i + 1}`, de: c.t0, ate: c.t1 })), { nome: 'closing', de: fecho.t0, ate: fecho.t1 }]
  return { transicao: tr, dTransicao: d, cenas, cortes, fecho, dur: +dur.toFixed(3), secoes }
}

return { planejar, validar, TIPOS, LEIAUTES, TRANSICOES, FECHO, MAX_PALAVRAS, durPadrao, fimDoDesenho, inicioPercurso, PERCORRE, ENTRA, ESCALONA, CRESCE }
})()

if (typeof module !== 'undefined') module.exports = GRAFICO
