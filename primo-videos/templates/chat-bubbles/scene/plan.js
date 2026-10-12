// Linha do tempo do molde chat-bubbles: quando o "digitando…" aparece, quando cada balão e cada cartão entra,
// quando a conversa sai e o fecho (só o logo) fica. Roda no navegador (antes do motor) e no Node (render.mjs e
// testes), para os dois saberem onde cada som cai. Nada de marca aqui: cores, fontes, logo e textos vêm de PARAMS.
const CONVERSA = {
  LEIAUTES: ['coluna', 'dividido'],
  CAMERAS: ['segue', 'zoom', 'parada'],
  TRANSICOES: ['corte', 'push', 'mascara'],
  CARTOES: ['arquivo', 'lista', 'imagem'],
  MODELOS: ['capa', 'lista', 'numero', 'colunas', 'grafico', 'fecho'],
  LADOS: ['pessoa', 'produto'],
  CORES: ['fundo', 'texto', 'pessoa', 'sobrePessoa', 'produto', 'sobreProduto'],
  // segundos: quanto o "digitando…" fica, leitura de cada balão (base + por palavra, entre min e max), pausa antes da
  // resposta da pessoa, o respiro depois da última mensagem, a transição e o fecho
  // (a leitura de um balão continua enquanto o "digitando…" da resposta aparece: por isso ela é curta)
  RITMO: { digitando: 0.9, base: 0.4, porPalavra: 0.12, leituraMin: 0.8, leituraMax: 1.8, pausa: 0.25, final: 0.7, transicao: 0.55, fecho: 2.3 },
  MAX_PALAVRAS: 7,
}

const _ehCorConversa = (s) => typeof s === 'string' && /^#[0-9a-fA-F]{6}$/.test(s)
const _nPalavrasConversa = (s) => String(s || '').trim().split(/\s+/).filter(Boolean).length

/** Os erros dos parâmetros (lista vazia = válidos), cada um dizendo o que fazer. */
function validarConversa(P) {
  const e = []
  const um = (v, lista) => lista.map((x) => `"${x}"`).join(', ')
  if (!P || typeof P !== 'object') return ['the parameters are a JSON object (see example.json)']
  if (P.leiaute != null && !CONVERSA.LEIAUTES.includes(P.leiaute)) e.push(`leiaute "${P.leiaute}" does not exist: use ${um(0, CONVERSA.LEIAUTES)}`)
  if (P.camera != null && !CONVERSA.CAMERAS.includes(P.camera)) e.push(`camera "${P.camera}" does not exist: use ${um(0, CONVERSA.CAMERAS)}`)
  if (P.transicao != null && !CONVERSA.TRANSICOES.includes(P.transicao)) e.push(`transicao "${P.transicao}" does not exist: use ${um(0, CONVERSA.TRANSICOES)}`)
  if (P.rotulos != null && ![false, 'primeira', 'sempre'].includes(P.rotulos)) e.push(`rotulos "${P.rotulos}" does not exist: use "primeira" (the name on each side's first message), "sempre" or false`)
  if (P.camera === 'zoom' && P.janela) e.push('camera "zoom" does not go with "janela" (the camera would get close to a cropped window): remove the window or use camera "segue"')
  const M = P.marca
  if (!M || typeof M !== 'object') e.push('missing "marca": { nome, logo, cores, fontes }')
  else {
    if (!M.logo) e.push('missing marca.logo: the closing is only the logo, centered; put the path of a PNG (relative to the JSON)')
    else if (!/\.png$/i.test(M.logo)) e.push(`marca.logo "${M.logo}" is not a PNG: the closing uses the logo PNG (the size comes from the file)`)
    const C = M.cores || {}
    for (const k of CONVERSA.CORES) if (!_ehCorConversa(C[k])) e.push(`marca.cores.${k} ${C[k] == null ? 'is missing' : `"${C[k]}" is not a #rrggbb color`}`)
    for (const [k, v] of Object.entries(C)) if (typeof v === 'string' && !_ehCorConversa(v)) e.push(`marca.cores.${k} "${v}" is not a #rrggbb color`)
    if (!M.fontes || !M.fontes.texto) e.push('missing marca.fontes.texto (the font family of the bubbles, e.g. "Inter")')
  }
  if (P.fecho && typeof P.fecho === 'object') {
    for (const k of ['bordao', 'endereco', 'texto', 'frase']) if (P.fecho[k]) e.push(`fecho.${k}: this template's closing is only the logo, with no sentence or address; remove "${k}"`)
    if (P.fecho.fundo != null && !_ehCorConversa(P.fecho.fundo)) e.push(`fecho.fundo "${P.fecho.fundo}" is not a #rrggbb color`)
  }
  const ms = P.mensagens
  if (!Array.isArray(ms) || ms.length < 2) e.push('"mensagens" needs at least 2 messages (back and forth): [{ "de": "pessoa", "texto": "…" }, { "de": "produto", "texto": "…" }]')
  else {
    ms.forEach((m, i) => {
      const q = `mensagens[${i}]`
      if (!CONVERSA.LADOS.includes(m.de)) e.push(`${q}.de "${m.de}" does not exist: use "pessoa" (on the right) or "produto" (on the left)`)
      if (!m.texto || typeof m.texto !== 'string') e.push(`${q}: missing "texto" (what is written in the bubble)`)
      if (m.digitando != null && !(m.digitando >= 0 && m.digitando <= 3)) e.push(`${q}.digitando ${m.digitando}: seconds of "typing…", from 0 to 3`)
      const c = m.cartao
      if (c) {
        if (m.de !== 'produto') e.push(`${q}.cartao: only the product replies with a card (arquivo, lista or imagem); the person writes`)
        if (!CONVERSA.CARTOES.includes(c.tipo)) e.push(`${q}.cartao.tipo "${c.tipo}" does not exist: use ${um(0, CONVERSA.CARTOES)}`)
        if (c.tipo === 'arquivo') {
          if (!c.nome) e.push(`${q}.cartao: the file needs a "nome" (e.g. "Name of the file")`)
          if (c.miniaturas && (!Array.isArray(c.miniaturas) || c.miniaturas.length > 8)) e.push(`${q}.cartao.miniaturas: from 0 to 8 thumbnails`)
          ;(c.miniaturas || []).forEach((mi, k) => {
            if (!_ehCorConversa(mi.fundo)) e.push(`${q}.cartao.miniaturas[${k}].fundo: a #rrggbb color`)
            for (const c of ['tinta', 'tinta2']) if (mi[c] != null && !_ehCorConversa(mi[c])) e.push(`${q}.cartao.miniaturas[${k}].${c} "${mi[c]}" is not a #rrggbb color`)
            if (mi.modelo && !CONVERSA.MODELOS.includes(mi.modelo)) e.push(`${q}.cartao.miniaturas[${k}].modelo "${mi.modelo}" does not exist: use ${um(0, CONVERSA.MODELOS)}`)
          })
        }
        if (c.tipo === 'lista' && (!Array.isArray(c.itens) || !c.itens.length || c.itens.length > 6)) e.push(`${q}.cartao: the list needs 1 to 6 "itens" ({ "t": "…", "chip": "entra" })`)
        else if (c.tipo === 'lista') c.itens.forEach((it, k) => { if (!it || typeof it.t !== 'string' || !it.t) e.push(`${q}.cartao.itens[${k}]: missing the text ({ "t": "…" })`) })
        if (c.tipo === 'imagem' && !c.src) e.push(`${q}.cartao: the image needs "src" (the file path, relative to the JSON)`)
      }
    })
  }
  if (P.chips) for (const [nome, cc] of Object.entries(P.chips)) if (!cc || !_ehCorConversa(cc.fundo) || !_ehCorConversa(cc.texto)) e.push(`chips.${nome}: use { "fundo": "#rrggbb", "texto": "#rrggbb" }`)
  return e
}

function _leituraConversa(texto, R) { return Math.min(R.leituraMax, Math.max(R.leituraMin, R.base + R.porPalavra * _nPalavrasConversa(texto))) }
function _durCartaoConversa(c) {
  if (c.tipo === 'arquivo') return 0.35 + (c.miniaturas || []).length * 0.12 + (c.ler ?? 1.0)
  if (c.tipo === 'lista') return 0.3 + c.itens.length * (c.passo ?? 0.55) + (c.ler ?? 0.8)
  return c.ler ?? 1.8
}

/** A linha do tempo inteira, só a partir dos parâmetros. Erro de parâmetro: lança com todas as mensagens juntas. */
function planejarConversa(P) {
  const erros = validarConversa(P)
  if (erros.length) throw new Error('chat-bubbles template parameters:\n  - ' + erros.join('\n  - '))
  const R = { ...CONVERSA.RITMO, ...(P.ritmo || {}) }
  const sons = []
  const som = (t, nome, extra = {}) => sons.push({ t: +t.toFixed(3), som: nome, ...extra })
  let t = 0.05
  const msgs = P.mensagens.map((m, i) => {
    const ant = P.mensagens[i - 1]
    if (ant && m.de !== ant.de && m.de === 'pessoa') t += m.pausa ?? R.pausa
    else if (m.pausa) t += m.pausa
    const tIni = t
    const dig = m.digitando ?? (m.de === 'produto' ? R.digitando : 0)
    const tDig = dig > 0 ? +t.toFixed(3) : null
    t += dig
    const tEntra = +t.toFixed(3)
    som(tEntra, 'pop', tEntra < 0.3 ? { opcional: true } : {})   // no começo da trilha o ataque não se mede: marco opcional
    let tCartao = null, itens = []
    if (m.cartao) {
      tCartao = +(tEntra + 0.5).toFixed(3)
      som(tCartao, 'pop')
      if (m.cartao.tipo === 'lista') {
        const passo = m.cartao.passo ?? 0.55
        itens = m.cartao.itens.map((_, k) => +(tCartao + 0.3 + k * passo).toFixed(3))
        itens.forEach((ti, k) => { if (m.cartao.itens[k].chip) som(ti + 0.28, 'blip', { passo: k }) })
      }
      t = tCartao + _durCartaoConversa(m.cartao)
    } else t = tEntra + (m.ler ?? _leituraConversa(m.texto, R))
    return { i, de: m.de, tIni: +tIni.toFixed(3), tDig, tEntra, tCartao, itens, tFim: +t.toFixed(3) }
  })
  const transicao = P.transicao || 'corte'
  const tSai = +(t + R.final).toFixed(3)
  const dTr = transicao === 'corte' ? 0 : R.transicao
  const tLogo = +(tSai + dTr * 0.6).toFixed(3)
  const dur = +(tSai + dTr + R.fecho).toFixed(3)
  if (transicao === 'push') som(tSai + dTr / 2, 'whoosh', { opcional: true })
  som(tLogo, 'acento')
  sons.sort((a, b) => a.t - b.t)
  // seções da trilha: uma por mensagem (contíguas), e o fechamento a partir de quando a conversa sai
  const secoes = msgs.map((m, k) => ({ nome: k === 0 ? 'opening' : `${{ pessoa: 'person', produto: 'product' }[m.de] || m.de}-${k + 1}`, de: k === 0 ? 0 : m.tIni, ate: k + 1 < msgs.length ? msgs[k + 1].tIni : tSai }))
  secoes.push({ nome: 'closing', de: tSai, ate: dur })
  return { ritmo: R, leiaute: P.leiaute || 'coluna', camera: P.camera || 'segue', transicao, msgs, tSai, dTr, tLogo, dur, sons, secoes }
}

if (typeof module !== 'undefined') module.exports = { CONVERSA, validarConversa, planejarConversa }
