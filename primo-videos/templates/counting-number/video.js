// Linha do tempo do molde "número que conta", calculada só a partir de PARAMS (params.js, gerado pelo prepare.mjs).
// Cada bloco tem a duração pedida, esticada até caber a fala dele (em + duração da fala + 0,5 s de respiro).
const DUR_PADRAO = { contador: 4.6, 'before-after': 4.4, refrao: 2.6, fecho: 2.8 }
const RESPIRO = 0.5

const LINHA = (() => {
  let t = 0
  return PARAMS.blocos.map((b, i) => {
    let dur = b.dur || (b.tipo === 'cartoes' ? 0.25 + b.itens.length * (b.cada || 1.5)
      : b.tipo === 'contador' && b.lista && b.lista.length ? (b.sozinho ?? 1.6) + 1.3 + 0.28 * b.lista.length : DUR_PADRAO[b.tipo])
    if (!dur) throw new Error(`block ${i + 1}: unknown type "${b.tipo}"`)
    const f = b.fala && b.fala.dur ? b.fala : null
    if (f) dur = Math.max(dur, f.em + f.dur + RESPIRO)
    dur = Math.round(dur * 60) / 60
    const item = { ...b, i, t0: t, t1: t + dur, dur }
    t += dur
    return item
  })
})()

const VIDEO = {
  titulo: PARAMS.titulo || 'Number that counts',
  duracao: Math.round(LINHA[LINHA.length - 1].t1 * 1000) / 1000,
  formatos: PARAMS.formatos || ['16x9', '9x16'],
  plataforma: { '16x9': 'youtube', '9x16': 'reels', '1x1': 'feed', '4x5': 'feed' },
  fontes: [...new Set([PARAMS.marca.fontes.numero.familia, PARAMS.marca.fontes.texto.familia, (PARAMS.marca.fontes.etiqueta || PARAMS.marca.fontes.texto).familia])],
  fundo: PARAMS.marca.cores.fundo,
  grao: PARAMS.marca.grao ?? 0.08,
  impactos: [],
  selo: null,
  audio: 'audio/soundtrack.wav',
}
