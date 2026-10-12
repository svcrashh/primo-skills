// Palavras de cada fala no tempo do vídeo, agrupadas em linhas curtas para a legenda na imagem.
// A fonte é a locução (narration.json: palavras com ini/fim por fala) e a folha de sincronia (onde cada fala caiu).
// O texto mostrado é o da locução, que já é o escrito ("Acme"); a pronúncia ("Ákmi") vive só no roteiro e nunca entra aqui.
const r3 = (x) => Math.round(x * 1000) / 1000

/** Cada palavra no tempo do vídeo: o início do arquivo da fala é (t da folha − inicio_voz da locução). */
export function palavrasDoVideo(loc, folha) {
  const lugar = new Map((folha.voz?.falas || []).map((f) => [f.id, f.t]))
  const out = []
  for (const f of loc.falas) {
    if (!lugar.has(f.id)) continue
    const desloc = lugar.get(f.id) - f.inicio_voz
    for (const p of f.palavras) out.push({ texto: p.texto, ini: r3(desloc + p.ini), fim: r3(desloc + p.fim), fala: f.id })
  }
  return out.sort((a, b) => a.ini - b.ini)
}

/** Troca a forma falada pela escrita. `pronuncia` é o mapa do roteiro ({ "Acme": "Ákmi" }); sem ele, nada muda. */
export function escrita(palavras, pronuncia = {}) {
  const volta = new Map(Object.entries(pronuncia).map(([escrito, falado]) => [falado.toLowerCase(), escrito]))
  return palavras.map((p) => {
    const m = p.texto.match(/^(\P{L}*)(.*?)(\P{L}*)$/u)
    const escritoDe = volta.get(m[2].toLowerCase())
    return escritoDe ? { ...p, texto: m[1] + escritoDe + m[3] } : p
  })
}

/**
 * Palavra curta não pisca: a que ficaria menos de `min` s na tela antes de a seguinte entrar ("é" de 20 ms no
 * alinhamento, e a linha seguinte começando 40 ms depois) aparece um pouco antes, no silêncio que sobra depois da
 * palavra anterior, nunca em cima dela. Se o silêncio não basta, a palavra seguinte entra até 60 ms depois (o olho
 * não vê esse atraso; uma palavra que some em 3 quadros, vê). O fim de cada palavra não muda.
 */
export const PALAVRA_MIN = 0.12
const EMPURRA_MAX = 0.06
export function semPiscar(palavras, min = PALAVRA_MIN) {
  const out = palavras.map((p) => ({ ...p }))
  for (let i = 0; i + 1 < out.length; i++) {
    const p = out[i], prox = out[i + 1]
    if (prox.ini - p.ini >= min) continue
    const piso = i > 0 ? Math.max(out[i - 1].fim, out[i - 1].ini + min) : 0
    p.ini = r3(Math.min(p.ini, Math.max(piso, prox.ini - min)))
    const falta = min - (prox.ini - p.ini)
    if (falta > 1e-9) prox.ini = r3(Math.min(prox.ini + Math.min(falta, EMPURRA_MAX), Math.max(prox.ini, prox.fim - 0.05)))
  }
  return out
}

const FIM_FORTE = /[.?!:;,]$/
/**
 * Linhas curtas: quebra em pontuação e em pausa maior que `pausa` s; cada trecho vira linhas de até `max` palavras ou
 * `maxLetras` letras, repartidas por igual (nunca sobra uma palavra solta no fim).
 */
export function agrupar(palavras, { max = 3, maxLetras = 22, pausa = 0.45 } = {}) {
  const trechos = []
  let atual = []
  palavras.forEach((p, i) => {
    atual.push(p)
    const prox = palavras[i + 1]
    if (!prox || FIM_FORTE.test(p.texto) || prox.ini - p.fim > pausa || prox.fala !== p.fala) { trechos.push(atual); atual = [] }
  })
  const letras = (l) => l.reduce((s, p) => s + p.texto.length, 0) + l.length - 1
  const linhas = []
  for (const t of trechos) {
    let n = Math.ceil(t.length / max)
    const partes = (k) => Array.from({ length: k }, (_, i) => t.slice(Math.round((i * t.length) / k), Math.round(((i + 1) * t.length) / k)))
    while (n < t.length && partes(n).some((l) => letras(l) > maxLetras)) n++
    linhas.push(...partes(n))
  }
  return linhas
}

/**
 * Os estados da legenda: um por palavra. A palavra aparece no `ini` dela (a fala já começou), as anteriores da linha
 * ficam, a atual é a destacada. A linha sai `depois` s após a última palavra, ou antes, se a próxima começa.
 */
export function estados(linhas, { depois = 0.35, antecipa = 0 } = {}) {
  const out = []
  linhas.forEach((l, li) => {
    const proxIni = linhas[li + 1] ? linhas[li + 1][0].ini - antecipa : Infinity
    l.forEach((p, wi) => {
      const ini = r3(p.ini - antecipa)
      const fimLinha = Math.min(l[l.length - 1].fim + depois, proxIni)
      const fim = r3(wi + 1 < l.length ? l[wi + 1].ini - antecipa : Math.max(ini + 0.05, fimLinha))
      out.push({ linha: li, palavra: wi, ini, fim, textos: l.slice(0, wi + 1).map((x) => x.texto), fala: p.fala })
    })
  })
  return out
}
