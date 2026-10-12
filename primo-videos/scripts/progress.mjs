#!/usr/bin/env node
// O progresso do vídeo em %, em duas réguas: até a prévia (o draft aberto para o dono) e da prévia ao final.
//   node progress.mjs start <video folder> [--kit | --new] [--target <min>] [--skip telas,voz] [--restart]
//        --kit: o produto já tem kit (prévia em ~10 min); sem ele, ou com --new, produto novo (~25 min)
//   node progress.mjs now <folder> <stage> [--remaining <min>]     a etapa que começou; várias podem correr juntas
//   node progress.mjs done <folder> <stage> [--note "voz gerada"]
//   node progress.mjs skip <folder> <stage>                      a etapa que não existe neste vídeo
//   node progress.mjs line <folder>                              a linha de agora (a cada ~5 min em etapa longa)
//   node progress.mjs report <folder> [--json]                 onde o tempo foi, contra a meta; grava <folder>/stopwatch.md
//   node progress.mjs stages                                     as etapas, os pesos e os minutos de cada régua
// O estado fica em <folder>/progress.json, com o log de cada comando (o cronômetro). Cada comando imprime a linha:
//   Prévia: 40% — voz gerada; agora: gravação (~2 min) + série e trilha (~1 min) · faltam ~5 min, 4 de 10 min
// A prévia fecha com o draft: o refino dela roda junto, já na régua do final, e só trava o final.
// Passou da meta? A linha diz, e o que fazer.
// No pacote com o app, a mesma linha vai para a etapa do app (scripts/app/canal.mjs, se existir).
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

// id, nome na linha (nomeKit: o nome no produto com kit), peso (%), minutos típicos num produto com kit / num produto
// novo, e a etapa do app
export const REGUAS = {
  previa: [
    { id: 'reading', nome: 'reading and thesis', nomeKit: 'kit and request', peso: 10, kit: 1, novo: 6, app: 'roteiro' },
    { id: 'script', nome: 'script', peso: 15, kit: 2, novo: 4, app: 'roteiro' },
    { id: 'voice', nome: 'voice', peso: 15, kit: 0.5, novo: 1, app: 'voz' },
    { id: 'recording', nome: 'recording', peso: 30, kit: 2.5, novo: 6, app: 'cenas' },
    { id: 'soundtrack', nome: 'series and soundtrack', peso: 5, kit: 0, novo: 2, app: 'musica' },
    { id: 'draft', nome: 'draft', peso: 25, kit: 3, novo: 4, app: 'montagem' },
  ],
  final: [
    { id: 'refine', nome: 'preview refine', peso: 10, kit: 4, novo: 6, app: 'refino' },
    { id: 'adjustments', nome: 'requested adjustments', peso: 15, kit: 8, novo: 12, app: 'montagem' },
    { id: 'render', nome: 'final render', peso: 45, kit: 10, novo: 12, app: 'montagem' },
    { id: 'critic', nome: 'final refine and critic', peso: 20, kit: 6, novo: 6, app: 'refino' },
    { id: 'delivery', nome: 'delivery', peso: 10, kit: 2, novo: 3, app: 'pronto' },
  ],
}
export const NOMES_REGUA = { previa: 'Preview', final: 'Final' }
// a meta da prévia, do pedido ao draft aberto: produto que já tem kit, ou produto novo
export const META_MIN = { kit: 10, novo: 25 }

const iso = (ms) => new Date(ms).toISOString()
const minutos = (ms) => Math.max(0, Math.round(ms / 60000))
const segundos = (ms) => Math.max(0, Math.round(ms / 1000))
export const mmss = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`

/** O estado novo. Sem narração no pacote (ou com `sem`), as etapas que não existem ficam puladas e não contam. */
export function novoEstado({ narracao = true, kit = false, meta = null, sem = [], agora = Date.now() } = {}) {
  const pula = new Set([...sem, ...(narracao ? [] : ['voice'])])
  const modo = kit ? 'kit' : 'novo'
  const etapas = Object.fromEntries(Object.entries(REGUAS).map(([r, lista]) => [r, lista.map((e) => ({
    id: e.id, nome: (kit && e.nomeKit) || e.nome, peso: e.peso, min: e[modo], app: e.app, estado: pula.has(e.id) ? 'pulada' : 'pendente',
  }))]))
  const estado = { versao: 2, modo, inicio: iso(agora), meta_min: meta ?? META_MIN[modo], regua: 'previa', previa_em: null, final_em: null, etapas, log: [] }
  return registrar(estado, 'start', { agora })
}

/** Acrescenta o comando ao log do vídeo (o cronômetro). */
export function registrar(estado, cmd, { etapa = null, nota = null, agora = Date.now() } = {}) {
  estado.log ??= []
  estado.log.push({ quando: iso(agora), cmd, ...(etapa ? { etapa } : {}), ...(nota ? { nota } : {}) })
  return estado
}

function acharEtapa(estado, id) {
  for (const r of ['previa', 'final']) {
    const e = estado.etapas[r].find((x) => x.id === id)
    if (e) return { regua: r, e }
  }
  const ids = Object.values(estado.etapas).flat().map((x) => x.id)
  throw new Error(`stage "${id}" does not exist; the stages are: ${ids.join(', ')}`)
}

// a etapa marcada feita sem nunca ter tido `agora` começou quando a última feita terminou (ou no início do vídeo)
function inicioEstimado(estado, agora) {
  const fins = Object.values(estado.etapas).flat().filter((x) => x.estado === 'feito' && x.fim).map((x) => Date.parse(x.fim)).filter((t) => t <= agora)
  return iso(Math.min(agora, Math.max(Date.parse(estado.inicio), ...fins)))
}

/** Muda o estado: agora (a etapa começou; as outras em andamento continuam), feito, pular. Devolve o mesmo objeto. */
export function marcar(estado, acao, id, { nota = null, falta = null, agora = Date.now() } = {}) {
  if (!['now', 'done', 'skip'].includes(acao)) throw new Error(`action "${acao}": use now, done or skip`)
  const { regua, e } = acharEtapa(estado, id)
  const quando = iso(agora)
  if (acao === 'now') {
    if (e.estado !== 'agora') { e.inicio = quando; delete e.fim; delete e.inicio_estimado }
    e.estado = 'agora'
    if (falta != null) { e.falta = Number(falta); e.falta_em = quando }
  } else if (acao === 'done') {
    if (!e.inicio) { e.inicio = inicioEstimado(estado, agora); e.inicio_estimado = true }
    e.estado = 'feito'; e.fim = quando; delete e.falta; delete e.falta_em
    if (nota) e.nota = nota
  } else e.estado = 'pulada'
  registrar(estado, acao, { etapa: id, nota, agora })
  for (const r of ['previa', 'final']) {
    const fechou = estado.etapas[r].every((x) => x.estado === 'feito' || x.estado === 'pulada')
    const chave = r === 'previa' ? 'previa_em' : 'final_em'
    if (fechou && !estado[chave]) estado[chave] = quando
  }
  // a régua passa para o final na primeira etapa dele (um ajuste antes da prévia fechar já é o final); o refino que
  // começa antes de a prévia fechar é o dela e não tira a prévia da linha
  if (regua === 'final' && estado.regua === 'previa' && (estado.previa_em || id !== 'refine')) estado.regua = 'final'
  return estado
}

export function porcento(estado, regua = estado.regua) {
  const conta = estado.etapas[regua].filter((x) => x.estado !== 'pulada')
  const total = conta.reduce((a, x) => a + x.peso, 0)
  const feito = conta.filter((x) => x.estado === 'feito').reduce((a, x) => a + x.peso, 0)
  return total ? Math.round((100 * feito) / total) : 100
}

function faltaDe(e, agora) {
  const desde = e.falta != null ? (e.falta_em ?? e.inicio) : e.inicio
  const decorrido = desde ? (agora - Date.parse(desde)) / 60000 : 0
  return Math.max(1, Math.round((e.falta ?? e.min) - decorrido))
}

/** A linha do chat: "Prévia: 40% — voz gerada; agora: gravação (~2 min) · faltam ~5 min, 4 de 10 min". */
export function linha(estado, agora = Date.now()) {
  const r = estado.regua
  const lista = estado.etapas[r]
  const pct = porcento(estado, r)
  const ultima = lista.filter((x) => x.estado === 'feito').sort((a, b) => String(a.fim).localeCompare(String(b.fim))).at(-1)
  const feito = ultima ? (ultima.nota || `${ultima.nome} done`) : null
  const fechou = r === 'previa' ? !!estado.previa_em : !!estado.final_em
  if (fechou && r === 'final') return `${NOMES_REGUA.final}: 100% — ${feito || 'delivered'}`
  if (fechou) {
    const refino = estado.etapas.final.find((x) => x.id === 'refine')
    const junto = refino && ['pendente', 'agora'].includes(refino.estado) ? ' (the refine runs alongside)' : ''
    return `${NOMES_REGUA.previa}: 100% — ${feito || 'ready'}; now: show the preview to the owner${junto}`
  }
  const correndo = lista.filter((x) => x.estado === 'agora').map((x) => ({ nome: x.nome, falta: faltaDe(x, agora) }))
  const pendentes = lista.filter((x) => x.estado === 'pendente')
  const txtAgora = correndo.length ? `now: ${correndo.map((c) => `${c.nome} (~${c.falta} min)`).join(' + ')}`
    : pendentes.length ? `next: ${pendentes[0].nome}` : null
  // as etapas em andamento correm juntas: conta a mais longa delas, mais as que ainda nem começaram
  const resto = Math.round(Math.max(0, ...correndo.map((c) => c.falta)) + pendentes.reduce((a, x) => a + x.min, 0))
  const meio = [feito, txtAgora].filter(Boolean).join('; ')
  let texto = `${NOMES_REGUA[r]}: ${pct}%` + (meio ? ` — ${meio}` : '')
  if (r === 'final') return `${texto} · ~${resto} min left`
  const decorridoTotal = minutos(agora - Date.parse(estado.inicio))
  texto += ` · ~${resto} min left, ${decorridoTotal} of ${estado.meta_min} min`
  if (decorridoTotal > estado.meta_min) texto += `. WARNING: past the ${estado.meta_min} min target; tell the owner now and cut the preview's scope (one format, draft at 30 fps, fine-tuning after it)`
  else if (decorridoTotal + resto > estado.meta_min) texto += `. WARNING: at the current pace the preview goes past the ${estado.meta_min} min target; cut what doesn't change the preview`
  return texto
}

export function etapaDoApp(estado) {
  const lista = estado.etapas[estado.regua]
  if (estado.regua === 'final' && estado.final_em) return 'pronto'
  return (lista.find((x) => x.estado === 'agora') || lista.find((x) => x.estado === 'pendente') || lista.at(-1)).app
}

/**
 * Onde o tempo foi: cada etapa (começou e durou em segundos desde o início, % do tempo até a prévia), o tempo entre
 * etapas (o relógio que nenhuma etapa cobre: o agente lendo, pensando, escrevendo) e a prévia contra a meta.
 */
export function relatorio(estado, agora = Date.now()) {
  const t0 = Date.parse(estado.inicio)
  const saiu = !!estado.previa_em
  const ate = saiu ? Date.parse(estado.previa_em) : agora
  const total = segundos(ate - t0)
  const meta = Math.round(estado.meta_min * 60)
  const fimDe = (x) => (x.estado === 'pulada' || !x.inicio ? null : x.fim ? Date.parse(x.fim) : x.estado === 'agora' ? agora : null)
  const etapa = (x, comPct) => {
    const base = { id: x.id, nome: x.nome, estado: x.estado, tipico_min: x.min }
    const fim = fimDe(x)
    if (fim == null) return { ...base, comecou_s: null, durou_s: null, pct: null, estimado: false, em_andamento: false }
    const durou = segundos(fim - Date.parse(x.inicio))
    return { ...base, comecou_s: segundos(Date.parse(x.inicio) - t0), durou_s: durou, pct: comPct ? pct(durou) : null, estimado: !!x.inicio_estimado, em_andamento: x.estado === 'agora' }
  }
  const pct = (s) => (total ? Math.round((100 * s) / total) : 0)

  const trechos = Object.values(estado.etapas).flat().map((x) => [x.inicio ? Date.parse(x.inicio) : null, fimDe(x)])
    .filter(([a, b]) => a != null && b != null).map(([a, b]) => [Math.max(t0, a), Math.min(ate, b)])
    .filter(([a, b]) => b > a).sort((p, q) => p[0] - q[0])
  let coberto = 0
  let cobertoAte = -Infinity
  for (const [a, b] of trechos) if (b > cobertoAte) { coberto += b - Math.max(a, cobertoAte); cobertoAte = b }
  const entre = segundos(ate - t0 - coberto)

  const etapasPrevia = estado.etapas.previa.map((x) => etapa(x, true))
  const onde = etapasPrevia.filter((x) => x.durou_s > 0).sort((p, q) => q.durou_s - p.durou_s).slice(0, 2)
    .map(({ id, nome, durou_s, pct: p }) => ({ id, nome, durou_s, pct: p }))
  const comecou = estado.etapas.final.some((x) => fimDe(x) != null)
  return {
    modo: estado.modo ?? null,
    meta_min: estado.meta_min,
    inicio: estado.inicio,
    ate: iso(agora),
    previa: {
      saiu, total_s: total, meta_s: meta, dentro_da_meta: total <= meta, folga_s: Math.max(0, meta - total), passou_s: Math.max(0, total - meta),
      etapas: etapasPrevia, entre_etapas: { durou_s: entre, pct: pct(entre) }, onde,
    },
    final: { comecou, etapas: comecou ? estado.etapas.final.map((x) => etapa(x, false)) : [] },
  }
}

/** O relatório em texto, para o chat e para o stopwatch.md. */
export function textoRelatorio(rel) {
  const p = rel.previa
  const modo = { kit: 'product with a kit', novo: 'new product' }[rel.modo]
  const larg = Math.max('between stages'.length, ...[...p.etapas, ...rel.final.etapas].map((x) => x.nome.length))
  const comecou = (s) => `started ${mmss(s).padStart(5)}`
  const umaEtapa = (x) => {
    const nome = `  ${x.nome.padEnd(larg)}  `
    if (x.estado === 'pulada') return `${nome}skipped`
    if (x.durou_s == null) return `${nome}not started yet`
    const partes = [comecou(x.comecou_s), `took ${mmss(x.durou_s).padStart(5)}`, x.pct == null ? null : `${String(x.pct).padStart(3)}%`, `typical ~${x.tipico_min} min`]
    return nome + partes.filter(Boolean).join('  ') + (x.estimado ? '  (estimated)' : '') + (x.em_andamento ? '  (in progress)' : '')
  }
  const folga = p.dentro_da_meta ? `${mmss(p.folga_s)} to spare` : `over by ${mmss(p.passou_s)}`
  const out = [`Stopwatch${modo ? ` (${modo})` : ''} — preview target ${rel.meta_min} min`, 'Up to the preview:']
  out.push(...p.etapas.map(umaEtapa))
  out.push(`  ${'between stages'.padEnd(larg)}  ${' '.repeat(comecou(0).length)}  took ${mmss(p.entre_etapas.durou_s).padStart(5)}  ${String(p.entre_etapas.pct).padStart(3)}%  (reading, thinking, writing)`)
  out.push(p.saiu ? `Preview out in ${mmss(p.total_s)} — target ${rel.meta_min} min: ${p.dentro_da_meta ? '✓' : '✗'} (${folga})`
    : `The preview is not out yet: ${mmss(p.total_s)} so far — target ${rel.meta_min} min (${folga})`)
  if (p.onde.length) out.push(`Where the time went: ${p.onde.map((x) => `${x.nome} ${mmss(x.durou_s)} (${x.pct}%)`).join(', ')}`)
  if (rel.final.comecou) out.push('From the preview to the final:', ...rel.final.etapas.map(umaEtapa))
  return out.join('\n')
}

// ── a linha de comando ───────────────────────────────────────────────────────────────────────────────────────────
const AQUI = path.dirname(fileURLToPath(import.meta.url))
// A narração só existe nos pacotes com voz (scripts/tutorial/locucao.mjs): sem ela, a etapa voz nem entra.
const NARRACAO = fs.existsSync(path.join(AQUI, 'tutorial', 'locucao.mjs'))
// O app só vem no pacote com ele: sem scripts/app/canal.mjs, a linha fica só no chat.
const CANAL = new URL('./app/canal.mjs', import.meta.url)

const arq = (pasta) => path.join(path.resolve(pasta), 'progress.json')
function ler(pasta) {
  const a = arq(pasta)
  if (!fs.existsSync(a)) throw new Error(`there is no ${a}: start with  node progress.mjs start ${pasta}`)
  return JSON.parse(fs.readFileSync(a, 'utf8'))
}
const gravar = (pasta, estado) => fs.writeFileSync(arq(pasta), JSON.stringify(estado, null, 1) + '\n')

async function contar(estado, texto) {
  console.log(texto)
  if (!fs.existsSync(CANAL)) return
  try {
    const canal = await import(CANAL.href)
    await canal.avisar(etapaDoApp(estado), texto, { progresso: porcento(estado) })
  } catch { /* o app fechado não atrapalha o vídeo */ }
}

function tabelaDasEtapas() {
  const out = []
  for (const [r, lista] of Object.entries(REGUAS)) {
    out.push(r === 'previa' ? 'Up to the preview (closes with the draft; does not wait for the refine):' : 'From the preview to the final (the preview refine runs alongside it):')
    for (const e of lista) {
      if (!NARRACAO && e.id === 'voice') continue
      out.push(`  ${e.id.padEnd(9)} ${String(e.peso).padStart(3)}%  ~${e.kit} min with a kit (new product ~${e.novo})  ${e.nomeKit ? `${e.nomeKit} / ${e.nome}` : e.nome}`)
    }
  }
  out.push(`Preview target: ~${META_MIN.kit} min for a product that already has a kit (start --kit), ~${META_MIN.novo} min for a new product.`)
  return out.join('\n')
}

const USO = 'usage: node progress.mjs start|now|done|skip|line|report|stages <video folder> [stage] [--kit | --new] [--target min] [--skip a,b] [--note "…"] [--remaining min] [--json]'

async function principal(argv) {
  const [cmd, pasta, etapa] = argv.filter((a, i) => !a.startsWith('--') && !(i > 0 && ['--target', '--skip', '--note', '--remaining'].includes(argv[i - 1])))
  const opt = (k) => { const i = argv.indexOf(`--${k}`); return i >= 0 ? argv[i + 1] : null }
  if (cmd === 'stages') { console.log(tabelaDasEtapas()); return 0 }
  if (!cmd || !pasta || ['now', 'done', 'skip'].includes(cmd) && !etapa) { console.error(USO); return 2 }
  if (!['start', 'now', 'done', 'skip', 'line', 'report'].includes(cmd)) {
    console.error(`command "${cmd}": use start, now, done, skip, line, report or stages`)
    return 2
  }
  if (cmd === 'start') {
    if (argv.includes('--kit') && argv.includes('--new')) { console.error('start: use --kit (the product already has a kit) or --new (new product), not both'); return 2 }
    if (fs.existsSync(arq(pasta)) && !argv.includes('--restart')) {
      const estado = registrar(ler(pasta), 'start', { nota: 'already existed' })
      gravar(pasta, estado)
      await contar(estado, linha(estado))
      console.log(`(${arq(pasta)} already existed; --restart starts over from scratch)`)
      return 0
    }
    fs.mkdirSync(path.resolve(pasta), { recursive: true })
    const estado = novoEstado({ narracao: NARRACAO, kit: argv.includes('--kit'), meta: opt('target') ? Number(opt('target')) : null, sem: (opt('skip') || '').split(',').map((s) => s.trim()).filter(Boolean) })
    gravar(pasta, estado)
    await contar(estado, linha(estado))
    return 0
  }
  const estado = ler(pasta)
  if (cmd === 'report') {
    gravar(pasta, registrar(estado, 'report'))
    const rel = relatorio(estado)
    const texto = textoRelatorio(rel)
    fs.writeFileSync(path.join(path.resolve(pasta), 'stopwatch.md'), `# Video stopwatch\n\n\`\`\`text\n${texto}\n\`\`\`\n`)
    console.log(argv.includes('--json') ? JSON.stringify(rel, null, 1) : texto)
    return 0
  }
  if (cmd === 'line') registrar(estado, 'line')
  else marcar(estado, cmd, etapa, { nota: opt('note'), falta: opt('remaining') })
  gravar(pasta, estado)
  await contar(estado, linha(estado))
  return 0
}

if (process.argv[1] && fs.realpathSync(process.argv[1]) === fs.realpathSync(fileURLToPath(import.meta.url))) {
  principal(process.argv.slice(2)).then((c) => { process.exitCode = c }, (e) => { console.error(`progress: ${e.message}`); process.exitCode = 2 })
}
