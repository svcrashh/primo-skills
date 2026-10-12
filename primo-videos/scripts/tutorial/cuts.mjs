// Corte seco nas esperas longas (carregando, publicando): o miolo da espera sai, e o resto do vídeo anda para trás.
// É escolha do vídeo: `cortarEsperas: { acima: 3, antes: 1, depois: 0.6 }` no video.mjs. Sem isso, nada muda.
//   acima  — só esperas mais longas que isto (s) são cortadas
//   antes  — quanto da espera fica antes do corte (s): quem assiste vê que começou a carregar
//   depois — quanto fica antes do fim da espera (s): a tela nova entra com um respiro
// A fala em curso nunca é cortada: com voz, o corte só começa 0,2 s depois do fim da fala do passo.

const r3 = (x) => Math.round(x * 1000) / 1000

/**
 * Devolve { log, quadros, cortes } com os tempos já no relógio cortado. `quadros` é a lista do frames.json
 * ([[arquivo, t], …]); `fimDaFala(n)` (opcional) diz quanto a fala do passo n dura a partir do passo.
 */
export function cortarEsperas(log, quadros, op = {}, fimDaFala = null) {
  const acima = op.acima ?? 3, antes = op.antes ?? 1, depois = op.depois ?? 0.6
  const passos = log.eventos.filter((e) => e.tipo === 'passo')
  const cortes = []
  for (const e of log.eventos) {
    if (e.tipo !== 'espera' || e.t1 == null || e.t1 - e.t <= acima) continue
    let a = e.t + antes
    const b = e.t1 - depois
    const pa = [...passos].reverse().find((p) => p.t <= e.t)
    const dura = pa && fimDaFala ? fimDaFala(pa.n) : null
    if (dura != null) a = Math.max(a, pa.t + dura + 0.2)
    if (b - a >= 0.3) cortes.push([r3(a), r3(b)])
  }
  if (!cortes.length) return { log, quadros, cortes }

  const tirado = (t) => cortes.reduce((s, [a, b]) => s + (t >= b ? b - a : t > a ? t - a : 0), 0)
  const f = (t) => r3(t - tirado(t))
  const eventos = log.eventos.map((e) => ({ ...e, t: f(e.t), ...(e.t1 != null ? { t1: f(e.t1) } : {}) }))
  const q = quadros.filter(([, t]) => !cortes.some(([a, b]) => t > a && t <= b)).map(([n, t]) => [n, f(t)])
  // A tela no instante em que a espera acaba é o último quadro de dentro do corte: ele entra no ponto do corte.
  for (const [a, b] of cortes) {
    const dentro = quadros.filter(([, t]) => t > a && t <= b)
    if (dentro.length) q.push([dentro[dentro.length - 1][0], r3(f(a) + 0.001)])
  }
  q.sort((x, y) => x[1] - y[1])
  return {
    log: { ...log, eventos, duracao: f(log.duracao), cortes: cortes.map(([a, b]) => ({ de: a, ate: b, tirou: r3(b - a) })) },
    quadros: q,
    cortes,
  }
}
