// Linha do tempo do molde ticking-checklist: os itens já na tela desde o começo, cada um marcado (✓) ou riscado (✕)
// no seu tempo, o contador subindo ("4 de 6"), a saída para o fecho (só o logo). Roda no navegador (antes do motor) e
// no Node (render.mjs e testes). Nada de marca aqui: cores, fontes, logo e textos vêm de PARAMS.
const CHECKLIST = {
  ESTRUTURAS: ['lista', 'colunas'],
  CAMERAS: ['parada', 'segue'],
  TRANSICOES: ['corte', 'push', 'mascara'],
  MARCAS: ['ok', 'nao'],
  // segundos: entrada (título, cartões, itens), um item marcado a cada "passo", a pausa ao trocar de coluna, o
  // respiro depois do último item; a transição e o fecho são iguais nos três
  RITMOS: {
    rapido: { entrada: 0.9, passo: 0.5, troca: 0.3, final: 1.0 },
    medio: { entrada: 1.0, passo: 0.8, troca: 0.4, final: 1.1 },
    calmo: { entrada: 1.2, passo: 1.25, troca: 0.5, final: 1.2 },
  },
  FIXO: { transicao: 0.55, fecho: 2.3 },
  CORES: ['fundo', 'texto', 'cartao', 'sobreCartao', 'ok', 'sobreOk'],
  MAX_ITENS: 8,
}

const _ehCorChecklist = (s) => typeof s === 'string' && /^#[0-9a-fA-F]{6}$/.test(s)
const _textoItem = (it) => (typeof it === 'string' ? it : it && it.t)

/** Os grupos de itens, do jeito que a cena desenha: a lista é um grupo só; as colunas, dois. */
function gruposChecklist(P) {
  if ((P.estrutura || 'lista') === 'colunas') return (P.colunas || []).map((c) => ({ ...c, marca: c.marca || 'ok' }))
  const L = P.lista || {}
  return [{ ...L, marca: L.marca || 'ok' }]
}

/** Os erros dos parâmetros (lista vazia = válidos), cada um dizendo o que fazer. */
function validarChecklist(P) {
  const e = []
  const um = (lista) => lista.map((x) => `"${x}"`).join(', ')
  if (!P || typeof P !== 'object') return ['the parameters are a JSON object (see example.json)']
  const est = P.estrutura || 'lista'
  if (!CHECKLIST.ESTRUTURAS.includes(est)) e.push(`estrutura "${est}" does not exist: use "lista" (a list that gets checked off) or "colunas" (two columns, like "Does" and "Doesn't")`)
  if (P.camera != null && !CHECKLIST.CAMERAS.includes(P.camera)) e.push(`camera "${P.camera}" does not exist: use ${um(CHECKLIST.CAMERAS)}`)
  if (P.transicao != null && !CHECKLIST.TRANSICOES.includes(P.transicao)) e.push(`transicao "${P.transicao}" does not exist: use ${um(CHECKLIST.TRANSICOES)}`)
  if (P.ritmo != null && typeof P.ritmo === 'string' && !CHECKLIST.RITMOS[P.ritmo]) e.push(`ritmo "${P.ritmo}" does not exist: use ${um(Object.keys(CHECKLIST.RITMOS))} (or an object { "passo": 0.7 })`)
  if (P.contador != null && P.contador !== false && typeof P.contador !== 'object') e.push('contador: use { "rotulo": "checked" } or false (no counter)')
  else if (P.contador && P.contador.modo != null && !['total', 'coluna'].includes(P.contador.modo)) e.push(`contador.modo "${P.contador.modo}" does not exist: use "total" (the big number, in the list) or "coluna" (in the header of each card)`)
  else if (P.contador && P.contador.modo === 'total' && est === 'colunas') e.push('contador.modo "total" is for the list: with columns the counter goes in the header of each one ("coluna")')
  const M = P.marca
  if (!M || typeof M !== 'object') e.push('missing "marca": { nome, logo, cores, fontes }')
  else {
    if (!M.logo) e.push('missing marca.logo: the closing is only the logo, centered; put the path of a PNG (relative to the JSON)')
    else if (!/\.png$/i.test(M.logo)) e.push(`marca.logo "${M.logo}" is not a PNG: the closing uses the logo PNG (the size comes from the file)`)
    const C = M.cores || {}
    for (const k of CHECKLIST.CORES) if (!_ehCorChecklist(C[k])) e.push(`marca.cores.${k} ${C[k] == null ? 'is missing' : `"${C[k]}" is not a #rrggbb color`}`)
    for (const [k, v] of Object.entries(C)) if (typeof v === 'string' && !_ehCorChecklist(v)) e.push(`marca.cores.${k} "${v}" is not a #rrggbb color`)
    if (!M.fontes || !M.fontes.texto) e.push('missing marca.fontes.texto (the font family of the items, e.g. "Inter")')
  }
  if (P.fecho && typeof P.fecho === 'object') {
    for (const k of ['bordao', 'endereco', 'texto', 'frase']) if (P.fecho[k]) e.push(`fecho.${k}: this template's closing is only the logo, with no sentence or address; remove "${k}"`)
    if (P.fecho.fundo != null && !_ehCorChecklist(P.fecho.fundo)) e.push(`fecho.fundo "${P.fecho.fundo}" is not a #rrggbb color`)
  }
  if (est === 'colunas' && (!Array.isArray(P.colunas) || P.colunas.length !== 2)) e.push('estrutura "colunas" requires "colunas" with 2 columns: [{ "titulo": "Does", "marca": "ok", "itens": […] }, { "titulo": "Doesn\'t", "marca": "nao", "itens": […] }]')
  if (est === 'lista' && (!P.lista || typeof P.lista !== 'object')) e.push('estrutura "lista" requires "lista": { "titulo": "…", "itens": ["…", "…"] }')
  if (!e.some((x) => /requires "/.test(x))) {
    gruposChecklist(P).forEach((g, gi) => {
      const q = est === 'colunas' ? `colunas[${gi}]` : 'lista'
      if (!CHECKLIST.MARCAS.includes(g.marca)) e.push(`${q}.marca "${g.marca}" does not exist: use "ok" (✓, ticks) or "nao" (✕, strikes out)`)
      if (!Array.isArray(g.itens) || !g.itens.length) e.push(`${q}.itens: from 1 to ${CHECKLIST.MAX_ITENS} items ("text" or { "t": "text", "marca": "ok" })`)
      else {
        if (g.itens.length > CHECKLIST.MAX_ITENS) e.push(`${q}.itens: ${g.itens.length} items don't fit; up to ${CHECKLIST.MAX_ITENS} per ${est === 'colunas' ? 'column' : 'list'}`)
        g.itens.forEach((it, k) => {
          if (!_textoItem(it) || typeof _textoItem(it) !== 'string') e.push(`${q}.itens[${k}]: missing the text ("text" or { "t": "text" })`)
          if (it && typeof it === 'object' && it.marca != null && !CHECKLIST.MARCAS.includes(it.marca)) e.push(`${q}.itens[${k}].marca "${it.marca}" does not exist: use "ok" or "nao"`)
        })
      }
      if (g.cores) for (const [k, v] of Object.entries(g.cores)) if (!_ehCorChecklist(v)) e.push(`${q}.cores.${k} "${v}" is not a #rrggbb color`)
    })
  }
  return e
}

/** A linha do tempo inteira, só a partir dos parâmetros. Erro de parâmetro: lança com todas as mensagens juntas. */
function planejarChecklist(P) {
  const erros = validarChecklist(P)
  if (erros.length) throw new Error('ticking-checklist template parameters:\n  - ' + erros.join('\n  - '))
  const R = { ...CHECKLIST.RITMOS[typeof P.ritmo === 'string' ? P.ritmo : 'medio'], ...CHECKLIST.FIXO, ...(typeof P.ritmo === 'object' ? P.ritmo : {}) }
  const grupos = gruposChecklist(P)
  const sons = []
  const som = (t, nome, extra = {}) => sons.push({ t: +t.toFixed(3), som: nome, ...extra })
  let t = R.entrada, n = 0
  const marcas = []   // { g, k, t, marca }
  grupos.forEach((g, gi) => {
    if (gi > 0) t += R.troca
    g.itens.forEach((it, k) => {
      const marca = (it && typeof it === 'object' && it.marca) || g.marca
      marcas.push({ g: gi, k, t: +t.toFixed(3), marca, n: ++n })
      if (marca === 'ok') som(t, 'blip', { passo: n - 1 })
      else som(t, 'toque', { variante: 'firme' })
      t += R.passo
    })
  })
  const tUltima = marcas[marcas.length - 1].t
  const transicao = P.transicao || 'corte'
  const tSai = +(tUltima + 0.4 + R.final).toFixed(3)
  const dTr = transicao === 'corte' ? 0 : R.transicao
  const tLogo = +(tSai + dTr * 0.6).toFixed(3)
  const dur = +(tSai + dTr + R.fecho).toFixed(3)
  som(0.05, 'pop', { opcional: true })   // no começo da trilha o ataque não se mede: marco opcional
  if (transicao === 'push') som(tSai + dTr / 2, 'whoosh', { opcional: true })
  som(tLogo, 'acento')
  sons.sort((a, b) => a.t - b.t)
  const secoes = [{ nome: 'opening', de: 0, ate: marcas[0].t }]
  grupos.forEach((g, gi) => {
    const ms = marcas.filter((m) => m.g === gi)
    secoes.push({ nome: `group-${gi + 1}`, de: ms[0].t, ate: gi + 1 < grupos.length ? marcas.find((m) => m.g === gi + 1).t : tSai })
  })
  secoes.push({ nome: 'closing', de: tSai, ate: dur })
  return { ritmo: R, estrutura: P.estrutura || 'lista', camera: P.camera || 'parada', transicao, grupos, marcas, total: marcas.length, tSai, dTr, tLogo, dur, sons, secoes }
}

if (typeof module !== 'undefined') module.exports = { CHECKLIST, validarChecklist, planejarChecklist, gruposChecklist }
