// O visual declarado de uma série de tutoriais (series.json com "versao": 2): o esquema dos nove elementos,
// a validação com mensagem que diz o que fazer, a resolução das cores e a checagem de contraste.
// Quem desenha é o tutorial.js (no navegador); aqui só se confere e se resolve o que a série declarou.
// Documentação de cada elemento e de cada tipo: references/tutorial.md, seção 13.
import fs from 'node:fs'
import vm from 'node:vm'

export const ELEMENTOS = ['fundo', 'moldura', 'legenda', 'selo', 'titulo', 'abertura', 'fechamento', 'realce', 'indicador']
// Elementos opcionais: sem eles, o desenho é o de sempre (o padrão de cada um reproduz o quadro de antes, pixel por pixel).
//   secao   o cartão de capítulo do g.secao no modo cinema: a cor, a tinta, como entra e o que mostra
//   painel  como o painel 3D do computador se mexe nos passos
export const OPCIONAIS = { secao: { entrada: 'diagonal' }, painel: { movimento: 'respira' } }
const DOC = 'references/tutorial.md, section 13 (The series visual)'
const FORMATOS = ['16x9', '19x9', '21x9', '9x16', '4x5', '1x1']

// Por elemento: qual campo escolhe o tipo, os tipos com os campos que cada um exige, os campos exigidos por
// todos, os valores permitidos e os opcionais (com o valor que assumem, escrito aqui e na documentação).
const ESQ = {
  fundo: {
    chave: 'tipo',
    // simbolo: o símbolo da marca em PNG (a chave de MARCA.png em `png`), gigante e recortado na borda, do lado oposto ao do texto
    tipos: { liso: [], formas: ['tinta'], grade: ['tinta'], pontos: ['tinta'], luz: ['tinta'], faixas: ['tinta'], simbolo: ['png'], proprio: [] },
    comuns: ['cor'],
    opcionais: { tinta2: null, forca: null, png: null },
  },
  moldura: {
    chave: 'tipo',
    tipos: { nenhuma: [], fio: ['cor'], janela: ['cor'], navegador: ['cor'], aparelho: ['cor'], proprio: [] },
    comuns: ['raio', 'sombra'],
    valores: { sombra: ['nenhuma', 'curta', 'longa'] },
    // tinta: a cor do endereço na barra do navegador (sem ela, a cor que se lê sobre a barra, a 70%)
    opcionais: { espessura: 2, margem: 0, tinta: null },
  },
  legenda: {
    chave: 'tipo',
    tipos: { cartao: ['fundo', 'borda', 'raio', 'tinta', 'rotulo', 'troca'], faixa: ['fundo', 'tinta', 'rotulo', 'troca'], solta: ['tinta', 'rotulo', 'troca'], nenhuma: [] },
    comuns: ['lado'],
    valores: { lado: ['direita', 'esquerda', 'baixo', 'cima'], rotulo: ['ponto', 'mono', 'numero', 'pilula', 'nenhum'], troca: ['virar', 'subir', 'corte'], caixa: ['alta', 'normal'], sombra: ['nenhuma', 'curta', 'longa'], fonte: ['titulo', 'texto'], arranjo: ['pilha', 'linha'] },
    // largura: a coluna da legenda de lado (direita/esquerda) nos formatos deitados; ≤ 1 é fração da largura do quadro
    // arranjo (legenda em cima ou embaixo, nos formatos deitados): "pilha" (seção, rótulo e frase um embaixo do outro) ou
    // "linha" (a seção e o rótulo num bloco à esquerda, a frase ao lado: a faixa fica baixa e a tela, maior)
    // recuo (px, padrão 0): a coluna de lado afastada da borda da área segura (o OCR do refino mede a letra com folga, e um
    // traço ou um texto claro no escuro, colado nela, reprova)
    opcionais: { sinal: null, caixa: 'normal', peso: 700, sombra: 'nenhuma', fonte: 'titulo', largura: null, arranjo: 'pilha', recuo: 0 },
  },
  selo: {
    chave: 'tipo',
    tipos: { pilula: ['cor'], mono: ['cor'], linha: ['cor'], nenhum: [], proprio: [] },
    comuns: [],
    // fundo: a pílula chapada nessa cor, com o texto na `cor` (sem fundo, a pílula é a cor a 12%)
    opcionais: { fundo: null },
  },
  titulo: {
    chave: 'entrada',
    tipos: { palavras: [], letras: [], mascara: [], corte: [] },
    comuns: ['caixa', 'peso', 'espaco', 'tinta'],
    valores: { caixa: ['alta', 'normal'], alinhar: ['centro', 'esquerda'] },
    opcionais: { alinhar: 'centro', escala: 1 },
  },
  abertura: {
    chave: 'saida',
    tipos: { mergulho: [], corte: [], deslizar: [], cortina: ['cor'], pouso: [], virar: [] },
    comuns: [],
    valores: { previa: ['resultado', 'nenhuma'] },
    // painel: a cor do painel do modo cinema que abre o vídeo com o logo (padrão: o fundo do fechamento)
    // indice: true mostra, depois do título, as seções do roteiro (g.secao) em pílulas numeradas, quando são 2 ou mais
    opcionais: { previa: 'resultado', painel: null, indice: false },
  },
  fechamento: {
    chave: 'entrada',
    tipos: { iris: [], cortina: [], corte: [], deslizar: [], dissolver: [] },
    comuns: ['fundo', 'tinta', 'logo'],
    valores: { logo: ['cores', 'negativo', 'png'], ordem: ['frase', 'logo', 'so-logo'] },
    opcionais: { ordem: 'frase' },
  },
  realce: {
    chave: 'tipo',
    tipos: { contorno: ['cor', 'espessura', 'raio'], cantos: ['cor', 'espessura', 'raio'], sublinhado: ['cor', 'espessura', 'raio'], preenchido: ['cor', 'raio'], proprio: [] },
    comuns: [],
    opcionais: { cor: null, espessura: 3, raio: 12 },
  },
  indicador: { chave: null, tipos: {}, comuns: ['tinta', 'contorno'] },
  // o cartão de capítulo (opcional). entrada: diagonal (a lâmina que entra pela esquerda, e o painel vira por trás) ·
  // empurrar (o cartão sobe de baixo e empurra o painel para cima; sai por cima e o painel volta de baixo) · whip (chicote
  // de lado, com borrão de movimento: o painel sai pela esquerda, o cartão passa, o painel volta pela direita) · mascara (o
  // cartão nasce num círculo do meio do painel, cobre o quadro e se fecha de volta nele).
  // letreiro: titulo (o nome na letra do título) · numero (o número da seção, gigante, em cima do nome) · digitado (o nome
  // datilografado letra a letra, com o cursor). cor: padrão a do painel da abertura (ou o fundo do fecho); tinta: padrão o
  // par da marca para essa cor (MARCA.pares).
  secao: {
    chave: 'entrada',
    tipos: { diagonal: [], empurrar: [], whip: [], mascara: [] },
    comuns: [],
    valores: { letreiro: ['titulo', 'numero', 'digitado'] },
    opcionais: { cor: null, tinta: null, letreiro: 'titulo' },
  },
  // o painel 3D do computador nos passos (opcional). movimento: respira (inclinado para o texto, respirando em senos
  // lentos: o de sempre) · plano (de frente, parado: só a câmera anda dentro dele) · travelling (anda de lado devagar, um
  // sentido por seção, e gira de leve no sentido do movimento) · orbita (gira devagar em volta do próprio centro, em Y e X)
  painel: {
    chave: 'movimento',
    tipos: { respira: [], plano: [], travelling: [], orbita: [] },
    comuns: [],
  },
}
// campos que são cor (hex ou nome); `borda` aceita também "nenhuma"
const CORES = ['cor', 'tinta', 'tinta2', 'fundo', 'borda', 'sinal', 'contorno', 'painel']
// quais tipos aceitam o gancho `proprio` (visual.js da série)
export const PROPRIOS = ['fundo', 'moldura', 'selo', 'realce']

/** MARCA do brand.js da série (um script de navegador: `const MARCA = {…}`). */
export function lerMarca(arquivo) {
  const ctx = { window: {} }
  vm.createContext(ctx)
  vm.runInContext(fs.readFileSync(arquivo, 'utf8') + '\n;globalThis.__M = typeof MARCA !== "undefined" ? MARCA : null', ctx)
  return ctx.__M || {}
}

const HEX = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i
const hex6 = (h) => (h.length === 4 ? '#' + [...h.slice(1)].map((c) => c + c).join('') : h).toUpperCase()

/** Confere o visual da série e devolve { visual (cores já em hex), avisos, usaProprio }. Erro = lança com o que fazer. */
export function resolverVisual(serie, marca) {
  const vis = serie.visual
  if (!vis || typeof vis !== 'object') throw new Error(`series.json has "versao": 2 and no "visual". Declare the nine elements (${ELEMENTOS.join(', ')}); the options are in ${DOC}.`)
  const faltam = ELEMENTOS.filter((k) => !vis[k])
  if (faltam.length) throw new Error(`series.json has "versao": 2 and does not declare visual.${faltam.join(', visual.')}. In a new series every element is chosen, none comes from a hidden default; the options are in ${DOC}.`)
  const paleta = { ...(marca.cores || {}), ...(vis.cores || {}) }
  const cor = (v, onde) => {
    if (typeof v !== 'string') throw new Error(`${onde}: expected a color (hex like "#FF7A1A" or a name from visual.cores/MARCA.cores), got ${JSON.stringify(v)}.`)
    if (HEX.test(v)) return hex6(v)
    if (paleta[v] != null) {
      if (!HEX.test(paleta[v])) throw new Error(`${onde}: the color "${v}" is ${JSON.stringify(paleta[v])}, which is not hex (#RRGGBB).`)
      return hex6(paleta[v])
    }
    throw new Error(`${onde}: "${v}" is neither hex nor a color name. Names that exist: ${Object.keys(paleta).join(', ') || '(none: declare visual.cores)'}.`)
  }
  const out = { cores: {} }
  for (const [n, v] of Object.entries(paleta)) if (typeof v === 'string' && HEX.test(v)) out.cores[n] = hex6(v)
  let usaProprio = false
  for (const el of [...ELEMENTOS, ...Object.keys(OPCIONAIS)]) {
    const E = ESQ[el], d = vis[el] ?? (OPCIONAIS[el] ? { ...OPCIONAIS[el] } : undefined), onde = `visual.${el}`
    if (typeof d !== 'object') throw new Error(`${onde} must be an object; options in ${DOC}.`)
    const r = { ...d }
    let tipo = null
    if (E.chave) {
      tipo = d[E.chave]
      if (!(tipo in E.tipos)) throw new Error(`${onde}.${E.chave} = ${JSON.stringify(tipo)} does not exist. Options: ${Object.keys(E.tipos).join(' | ')} (when to use each one: ${DOC}).`)
      if (tipo === 'proprio') usaProprio = true
    }
    for (const [k, v] of Object.entries(E.opcionais || {})) if (r[k] === undefined && v !== null) r[k] = v
    const exige = [...E.comuns, ...(tipo ? E.tipos[tipo] : [])]
    const semCampo = exige.filter((k) => d[k] === undefined && (E.opcionais || {})[k] == null)
    if (semCampo.length) throw new Error(`${onde} (${tipo || el}) needs ${semCampo.map((k) => `"${k}"`).join(', ')}. See ${DOC}.`)
    for (const [k, vals] of Object.entries(E.valores || {})) {
      if (r[k] === undefined) continue
      const lista = k === 'lado' && typeof r[k] === 'object' ? Object.entries(r[k]) : [[null, r[k]]]
      for (const [f, v] of lista) {
        if (f && f !== 'padrao' && !FORMATOS.includes(f)) throw new Error(`${onde}.${k}: format "${f}" does not exist (${FORMATOS.join(', ')}, padrao).`)
        if (!vals.includes(v)) throw new Error(`${onde}.${k}${f ? '.' + f : ''} = ${JSON.stringify(v)} does not exist. Options: ${vals.join(' | ')}.`)
      }
    }
    for (const k of CORES) {
      if (r[k] === undefined || r[k] === null) continue
      if (k === 'borda' && r[k] === 'nenhuma') continue
      r[k] = cor(r[k], `${onde}.${k}`)
    }
    for (const k of ['raio', 'espessura', 'peso', 'espaco', 'escala', 'forca', 'largura', 'recuo']) if (r[k] !== undefined && typeof r[k] !== 'number') throw new Error(`${onde}.${k} must be a number, got ${JSON.stringify(r[k])}.`)
    out[el] = r
  }
  // o rótulo do passo usa a tinta da legenda se a série não disser outra cor; o realce proprio não tem cor exigida
  if (!out.legenda.sinal) out.legenda.sinal = out.legenda.tinta
  if (!out.realce.cor) out.realce.cor = out.legenda.sinal || out.indicador.tinta
  if (!out.fundo.tinta2 && out.fundo.tinta) out.fundo.tinta2 = out.fundo.tinta
  if (out.fundo.forca == null) out.fundo.forca = { liso: 0, formas: 0.1, grade: 0.14, pontos: 0.22, luz: 0.38, faixas: 0.16, simbolo: 1, proprio: 1 }[out.fundo.tipo]
  // o símbolo é um asset da marca: entra inteiro, na cor do PNG (nunca transparente nem recolorido)
  if (out.fundo.tipo === 'simbolo') {
    if (typeof out.fundo.png !== 'string' || !out.fundo.png) throw new Error(`visual.fundo "simbolo" needs "png": the key of the symbol PNG in MARCA.png (e.g. "simbolo"). See ${DOC}.`)
    out.fundo.forca = 1
  }
  // o cartão de capítulo: a cor do painel da abertura (ou o fundo do fecho), e a tinta que a marca aprova sobre ela
  const SC = out.secao
  if (!SC.cor) SC.cor = out.abertura.painel || out.fechamento.fundo
  if (!SC.tinta && Array.isArray(marca.pares)) {
    const par = marca.pares.find(([f]) => typeof f === 'string' && HEX.test(f) && hex6(f) === SC.cor)
    if (par) SC.tinta = hex6(par[1])
  }
  if (typeof out.abertura.indice !== 'boolean') throw new Error(`visual.abertura.indice = ${JSON.stringify(out.abertura.indice)}: it is true (the section index after the title, with 2 or more g.secao) or false.`)
  if (!(out.legenda.recuo >= 0 && out.legenda.recuo <= 200)) throw new Error(`visual.legenda.recuo = ${out.legenda.recuo}: it is how far the side column moves away from the edge of the safe area, in px (0 to 200).`)
  if (out.legenda.largura != null && !(out.legenda.largura > 0 && (out.legenda.largura <= 0.5 || out.legenda.largura >= 200))) throw new Error(`visual.legenda.largura = ${out.legenda.largura}: it is the side caption column, a fraction of the frame width (0.2 to 0.5) or px (≥ 200).`)
  return { visual: out, avisos: contrastes(out, marca), usaProprio }
}

// ---------- contraste (WCAG 2): texto que ninguém lê é o defeito mais barato de pegar antes do render ----------
const lum = (h) => { const c = [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)); return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2] }
export const contraste = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05) }

/** A pílula do rótulo do passo (legenda.rotulo "pilula"): as cores do selo quando ele é uma pílula chapada; senão, o
 *  sinal da legenda sobre ele mesmo a 12%. Devolve { fundo, tinta } (fundo null = translúcido). */
export function corDaPilula(v) {
  if (v.selo.tipo === 'pilula' && v.selo.fundo) return { fundo: v.selo.fundo, tinta: v.selo.cor }
  return { fundo: null, tinta: v.legenda.sinal }
}

function contrastes(v, marca = {}) {
  const sob = v.legenda.tipo === 'solta' ? v.fundo.cor : v.legenda.fundo
  const pil = corDaPilula(v)
  // legenda "nenhuma": o motor não desenha legenda (ela vem da montagem), então não há par para conferir
  // [nome, texto, fundo, mínimo, texto grande (aceita o par AA18 da marca)]
  const pares = [
    ...(v.legenda.tipo === 'nenhuma' ? [] : [
      ['caption', v.legenda.tinta, sob, 4.5, false],
      ...(v.legenda.rotulo === 'pilula' ? (pil.fundo ? [['step label (the pill)', pil.tinta, pil.fundo, 4.5, false]] : [['step label (the pill)', pil.tinta, sob, 3, false]])
        : v.legenda.rotulo === 'nenhum' ? [] : [['step label (legenda.sinal)', v.legenda.sinal, sob, 3, false]]),
    ]),
    ['title', v.titulo.tinta, v.fundo.cor, 3, true],
    // o fecho só com o logo não tem texto
    ...(v.fechamento.ordem === 'so-logo' ? [] : [['closing', v.fechamento.tinta, v.fechamento.fundo, 3, true]]),
  ]
  if (v.selo.cor) pares.push(['badge (selo)', v.selo.cor, v.selo.fundo || v.fundo.cor, 3, false])
  // o nome (e o número) no cartão de capítulo: letra de título, grande (aceita o AA18)
  if (v.secao && v.secao.tinta) pares.push(['section card', v.secao.tinta, v.secao.cor, 3, true])
  // o índice das seções usa a mesma pílula do rótulo do passo
  if (v.abertura.indice) pares.push(['section index (the pill)', pil.tinta, pil.fundo || v.fundo.cor, pil.fundo ? 4.5 : 3, false])
  const avisos = []
  for (const [nome, a, b, min] of pares) {
    const c = contraste(a, b)
    // abaixo de 3:1 ninguém lê no celular com brilho baixo: é erro. Entre 3 e o mínimo, é aviso.
    if (c < 3) throw new Error(`contrast of ${nome}: ${a} on ${b} gives ${c.toFixed(2)}:1, below 3:1. Change one of the two colors.`)
    if (c < min) avisos.push(`contrast of ${nome}: ${a} on ${b} gives ${c.toFixed(2)}:1 (the minimum for body text is ${min}:1)`)
  }
  // A marca que lista os pares aprovados (MARCA.pares: [fundo, texto, nota]) só aceita esses. AA18 vale só para texto grande
  // (o título, a frase do fecho); legenda, rótulo e selo pedem AAA ou AA.
  if (Array.isArray(marca.pares) && marca.pares.length) {
    const hx = (h) => (typeof h === 'string' && HEX.test(h) ? hex6(h) : null)
    const ok = marca.pares.map(([f, t, n]) => [hx(f), hx(t), n])
    for (const [nome, a, b, , grande] of pares) {
      const achado = ok.find(([f, t]) => f === b && t === a)
      if (!achado) throw new Error(`contrast of ${nome}: ${a} on ${b} is not an approved brand pair (MARCA.pares). Pairs with that background: ${ok.filter(([f]) => f === b).map(([, t, n]) => `${t} (${n})`).join(', ') || 'none'}.`)
      if (achado[2] === 'AA18' && !grande) throw new Error(`contrast of ${nome}: ${a} on ${b} is AA18 in the brand, only for a large title; ${nome} needs an AAA or AA pair.`)
    }
  }
  return avisos
}

// ---------- gancho proprio: o visual.js da série roda no render, então não pode depender de nada de fora ----------
const PROIBIDO = [
  [/\bfetch\s*\(|XMLHttpRequest|WebSocket|EventSource|\bimport\s*\(/, 'network: the render runs without network and the video must come out the same on any machine'],
  [/https?:\/\//, 'network address: bring the file into the series folder'],
  [/Math\.random|Date\.now|new Date\b|performance\.now/, 'clock or unseeded random: every subframe would come out different (use rng(semente) and the time t)'],
  [/requestAnimationFrame|setTimeout|setInterval/, 'clock-driven animation: everything must be a function of the time t'],
  [/@keyframes|animation\s*:|transition\s*:/, 'CSS animation: the render captures frame by frame by the time t, not by the clock'],
]
export function conferirProprio(arquivo, visual) {
  if (!fs.existsSync(arquivo)) {
    const quais = PROPRIOS.filter((k) => visual[k] && (visual[k].tipo === 'proprio'))
    throw new Error(`visual.${quais.join(', visual.')} is "proprio", but the series has no visual.js (${arquivo}). The hook is in ${DOC}.`)
  }
  const src = fs.readFileSync(arquivo, 'utf8').replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, '')
  for (const [re, porque] of PROIBIDO) {
    const m = src.match(re)
    if (m) throw new Error(`visual.js uses "${m[0]}": ${porque}.`)
  }
  for (const k of PROPRIOS) if (visual[k].tipo === 'proprio' && !new RegExp(`VISUAL_PROPRIO\\.${k}\\s*=`).test(src)) throw new Error(`visual.${k} is "proprio", but visual.js does not define VISUAL_PROPRIO.${k} = (ctx) => …`)
}

// ---------- som: a folha de sincronia acompanha o visual (nomes de efeito de assets/audio/sounds.py) ----------
/** Som da troca de legenda no passo que começa em t (a troca vai de t−0,25 a t+0,25). null = nenhum. */
export function somDaTroca(visual, t) {
  const tr = visual.legenda.tipo === 'nenhuma' ? null : visual.legenda.troca
  if (tr === 'virar') return { t: t - 0.25, efeito: 'virada', extra: { variante: 'cartao' } }
  if (tr === 'subir') return { t, efeito: 'whoosh', extra: { dur: 0.4, nivel: -9, opcional: true } }   // pico no meio da troca
  return null   // corte: a troca seca é o próprio acento; um som ali só faria ruído a cada passo
}
/** Sons da passagem da abertura para a tela (A = fim da abertura). */
export function sonsDaAbertura(visual, A) {
  const s = visual.abertura.saida
  if (s === 'mergulho') return [{ t: A - 0.02, efeito: 'whoosh', evento: 'the screen appears (opening dive)', extra: { dur: 0.6, opcional: true } }]
  if (s === 'deslizar') return [{ t: A - 0.1, efeito: 'whoosh', evento: 'the screen slides in', extra: { dur: 0.5, direcao: -1, opcional: true } }]
  if (s === 'cortina') return [{ t: A, efeito: 'whoosh', evento: 'the curtain passes and reveals the screen', extra: { dur: 0.8, opcional: true } }]
  if (s === 'virar') return [{ t: A - 0.25, efeito: 'whoosh', evento: 'the panel flips and the recorded screen appears on its back', extra: { dur: 0.7, opcional: true } }]
  return []   // corte: seco, sem som; pouso: o som é o do aparelho 3D que entra (compose.mjs)
}
/** Os tempos do cartão de capítulo, em s a partir do instante da seção: quando ele começa a entrar (de0) e cobre o quadro
 *  (de1), quando começa a sair (ate0) e some (ate1), e quando o painel volta a estar no lugar (volta). O drawing.js usa os
 *  mesmos (TU.visual.secao.tempos, escritos pelo compor). */
export function temposDaSecao(visual) {
  const e = (visual.secao || OPCIONAIS.secao).entrada
  if (e === 'whip') return { de0: -0.34, de1: -0.12, ate0: 0.5, ate1: 0.74, volta: 0.8 }
  if (e === 'mascara') return { de0: -0.46, de1: -0.1, ate0: 0.5, ate1: 0.9, volta: 1.0 }
  // empurrar: o cartão cheio segura um pouco mais (o número e o nome, dois letreiros para ler)
  if (e === 'empurrar') return { de0: -0.5, de1: -0.14, ate0: 0.58, ate1: 0.98, volta: 1.0 }
  return { de0: -0.5, de1: -0.12, ate0: 0.45, ate1: 0.9, volta: 1.0 }   // diagonal
}
/** Sons do cartão de capítulo da seção que abre em t (modo cinema). nome = o nome da seção (o datilografado tem uma tecla
 *  por letra). A diagonal é a de sempre: um whoosh na entrada e outro na saída. */
export function sonsDaSecao(visual, t, nome = '') {
  const SC = visual.secao || OPCIONAIS.secao, tp = temposDaSecao(visual)
  const out = []
  if (SC.entrada === 'whip') {
    // chicote: curto e forte, nos dois sentidos
    out.push({ t: t + tp.de0 + 0.06, efeito: 'whoosh', evento: `section: the card "${nome}" whips past`, extra: { dur: 0.3, variante: 'curto', opcional: true } })
    out.push({ t: t + tp.ate0 + 0.05, efeito: 'whoosh', evento: 'section: the whip back and the panel comes in', extra: { dur: 0.3, variante: 'curto', direcao: -1, opcional: true } })
  } else if (SC.entrada === 'empurrar') {
    out.push({ t: t + tp.de0 + 0.05, efeito: 'whoosh', evento: `section: the card "${nome}" rises and pushes the panel`, extra: { dur: 0.45, opcional: true } })
    out.push({ t: t + tp.ate0 + 0.05, efeito: 'whoosh', evento: 'section: the card leaves at the top and the panel comes back', extra: { dur: 0.45, direcao: -1, opcional: true } })
  } else if (SC.entrada === 'mascara') {
    out.push({ t: t + tp.de0 + 0.06, efeito: 'whoosh', evento: `section: the card "${nome}" opens in a circle`, extra: { dur: 0.45, opcional: true } })
    out.push({ t: t + tp.ate0 + 0.05, efeito: 'whoosh', evento: 'section: the circle closes on the panel', extra: { dur: 0.45, direcao: -1, opcional: true } })
  } else {
    out.push({ t: t - 0.4, efeito: 'whoosh', evento: `section: the card "${nome}" comes in`, extra: { dur: 0.45, opcional: true } })
    out.push({ t: t + 0.5, efeito: 'whoosh', evento: 'section: the card leaves and the panel flips', extra: { dur: 0.5, direcao: -1, opcional: true } })
  }
  if (SC.letreiro === 'digitado' && nome) {
    const d = digitacaoDaSecao(visual, nome)
    out.push({ t: t + d.t0, efeito: 'digitacao', evento: `section: "${nome}" is typed out`, extra: { dur: +(d.t1 - d.t0).toFixed(3), teclas: [...nome].filter((c) => c.trim()).length, opcional: true } })
  }
  return out
}
/** A janela do letreiro datilografado (s a partir da seção): começa com o cartão quase cheio e termina antes de ele sair. */
export function digitacaoDaSecao(visual, nome) {
  const tp = temposDaSecao(visual)
  const t0 = tp.de1 - 0.12
  return { t0, t1: t0 + Math.min(0.5, 0.045 * [...nome].length + 0.06) }
}
/** Sons da entrada do fechamento (t0 = início dele). */
export function sonsDoFechamento(visual, t0) {
  const e = visual.fechamento.entrada
  if (e === 'deslizar') return [{ t: t0 + 0.25, efeito: 'whoosh', evento: 'closing: the final card slides in', extra: { dur: 0.5, direcao: -1, forca: true, opcional: true } }]   // whoosh não tem ataque seco: o verify.py só exige ataque de marco obrigatório
  if (e === 'cortina') return [{ t: t0 + 0.45, efeito: 'impacto', evento: 'closing: the curtain closes over the screen', extra: { forca: true } }]
  if (e === 'corte') return [{ t: t0, efeito: 'impacto', evento: 'closing: hard cut to the brand', extra: { forca: true } }]
  // dissolver: a tela recua e some no fundo da série (o cartão final tem a cor dele); o som é o do recuo
  if (e === 'dissolver') return [{ t: t0 - 0.1, efeito: 'whoosh', evento: 'closing: the screen pulls back and fades into the background', extra: { dur: 0.6, direcao: -1, opcional: true } }]
  return [{ t: t0, efeito: 'impacto', evento: 'closing: the brand color covers the screen', extra: { forca: true } }]
}
