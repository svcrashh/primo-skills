// Linha do tempo do molde rolling-list: abertura → itens → muro → fecho, pela velocidade escolhida.
// Roda no navegador (antes do engine) e no Node (render.mjs), para os dois saberem onde cada fala cai.
const RITMO = {
  rajada: { abertura: 1.6, item: 1.1, muro: 2.4, fecho: 2.2, cartao: 0.9 },
  lista: { abertura: 2.2, item: 2.4, muro: 2.6, fecho: 2.4, cartao: 0.9 },
  cartaz: { abertura: 2.2, item: 4.4, cartaz: 1.5, muro: 2.4, fecho: 2.2, cartao: 0.9 },
}

function planejar(P) {
  const velocidade = P.velocidade || 'lista'
  if (!RITMO[velocidade]) throw new Error(`velocidade "${velocidade}" does not exist: use rajada, lista or cartaz`)
  const ritmo = { ...RITMO[velocidade], ...(P.ritmo || {}) }
  const secoes = []
  let t = 0
  const add = (tipo, d, extra = {}) => { secoes.push({ tipo, t0: +t.toFixed(3), t1: +(t + d).toFixed(3), ...extra }); t += d }
  add('abertura', ritmo.abertura)
  P.itens.forEach((it, i) => add('item', it.dur || ritmo.item, { i }))
  if (P.muro) add('muro', ritmo.muro)
  const F = P.fecho || {}
  const cartoes = F.cartoes && (!F.cartoesEm || F.cartoesEm.includes(velocidade)) ? F.cartoes : []
  add('fecho', ritmo.fecho + cartoes.length * ritmo.cartao, { cartoes: cartoes.length })
  const achar = (onde) => {
    if (onde && typeof onde === 'object' && onde.item) return secoes.find((s) => s.tipo === 'item' && s.i === onde.item - 1)
    return secoes.find((s) => s.tipo === onde)
  }
  const falas = (P.falas || []).map((f) => {
    const s = achar(f.onde)
    if (!s) throw new Error(`line "${f.id}": onde = ${JSON.stringify(f.onde)} does not exist in this video`)
    return { ...f, em: +(s.t0 + (f.atraso != null ? f.atraso : 0.3)).toFixed(3) }
  })
  return { velocidade, ritmo, secoes, dur: +t.toFixed(3), falas, cartoes }
}

if (typeof module !== 'undefined') module.exports = { planejar, RITMO }
