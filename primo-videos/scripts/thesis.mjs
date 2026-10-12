#!/usr/bin/env node
// A tese do vídeo: o que o vídeo tem de provar, escrito antes do roteiro. recipes/thesis.md
//   node thesis.mjs write <repository> --out <project folder> [--request "<o que o dono pediu>"] [--model sonnet] [--redo] [--prompt-only]
//       uma conversa nova do Claude, que só vê a receita e o repositório, escreve <output>/thesis.md
//   node thesis.mjs validate <thesis.md | pasta>
//       confere as cinco partes e mostra o resumo em cinco linhas
//   node thesis.mjs count <script.md> [--thesis <thesis.md> | --intent sell|teach|update] [--write] [--json]
//       quem trabalha em cada cena, a conta do tempo de tela e o veredito
// Código 0 = passou, 1 = a tese não passou na conferência ou o roteiro volta, 2 = não deu para rodar.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { lerTese, validarTese, resumoTese, acharTese, INTENCOES } from './thesis/read.mjs'
import { lerRoteiro, contar, julgar, textoConta, gravarConta } from './thesis/count.mjs'
import { lerReceita, montarPromptTese, extrairTese, destino, guardarAnterior, PAPEL_TESE, MODELO_PADRAO, ORCAMENTO_PADRAO, FERRAMENTAS, TEMPO_MAX_MS } from './thesis/write.mjs'
import { chamarClaude } from './critic/call.mjs'

const uso = [
  'usage: node thesis.mjs write <repository> --out <project folder> [--request "<what the owner asked for>"] [--model sonnet] [--redo] [--prompt-only]',
  '       node thesis.mjs validate <thesis.md | folder>',
  '       node thesis.mjs count <script.md> [--thesis <thesis.md> | --intent sell|teach|update] [--write] [--json]',
].join('\n')

export function lerArgs(argv) {
  const a = { _: [] }
  const com = new Set(['out', 'request', 'model', 'budget', 'thesis', 'intent'])
  for (let i = 0; i < argv.length; i++) {
    const k = argv[i]
    if (k.startsWith('--')) {
      const nome = k.slice(2)
      if (com.has(nome)) { a[nome] = argv[++i]; if (a[nome] == null) throw new Error(`--${nome} needs a value`) } else a[nome] = true
    } else a._.push(k)
  }
  return a
}

const arquivoDaTese = (p) => (fs.existsSync(p) && fs.statSync(p).isDirectory() ? path.join(p, 'thesis.md') : p)

async function escrever(a) {
  const repo = a._[1]
  if (!repo || !a.out) { console.error(uso); return 2 }
  const dir = path.resolve(repo)
  if (!fs.existsSync(dir) || !fs.statSync(dir).isDirectory()) { console.error(`Repository not found: ${dir}`); return 2 }
  const receita = lerReceita()
  if (a['prompt-only']) { console.log(montarPromptTese({ receita, pedido: a.request })); return 0 }
  const arq = destino(a.out)
  if (fs.existsSync(arq) && !a.redo) { console.error(`${arq} already exists. To write another one, pass --redo (the current one is kept as thesis-v1.md).`); return 2 }

  const modelo = a.model || MODELO_PADRAO
  const chamadas = []
  let texto = null, erros = null, conferencia = null
  for (let tentativa = 1; tentativa <= 2 && !conferencia?.ok; tentativa++) {
    console.error(`writing the thesis for ${path.basename(dir)} (${modelo}, a fresh conversation that only sees the recipe and the repository${tentativa > 1 ? ', second attempt' : ''})…`)
    const r = await chamarClaude({ dir, prompt: montarPromptTese({ receita, pedido: a.request, erros }), modelo, orcamento: +(a.budget || ORCAMENTO_PADRAO), timeoutMs: TEMPO_MAX_MS, papel: PAPEL_TESE, ferramentas: FERRAMENTAS, quem: 'the thesis conversation' })
    try {
      texto = extrairTese(r.texto)
      conferencia = validarTese(lerTese(texto))
      erros = conferencia.erros
    } catch (e) { erros = [e.message]; conferencia = null; texto = texto ?? r.texto }
    chamadas.push({ modelo: r.modelo, custo_usd: r.custo_usd, uso: r.uso, duracao_ms: r.duracao_ms, turnos: r.turnos, erros_de_formato: erros?.length ? erros : null })
    if (erros?.length) {
      console.error(`the answer failed the format check:\n${erros.map((e) => `  - ${e}`).join('\n')}`)
      fs.mkdirSync(path.dirname(arq), { recursive: true })
      fs.writeFileSync(arq.replace(/\.md$/, `.attempt-${tentativa}.md`), texto ?? '')
    }
  }
  const custo = chamadas.reduce((s, c) => s + (c.custo_usd ?? 0), 0)
  fs.mkdirSync(path.dirname(arq), { recursive: true })
  const anterior = conferencia?.ok ? guardarAnterior(arq) : null
  const gravado = conferencia?.ok ? arq : arq.replace(/\.md$/, '.invalid.md')
  fs.writeFileSync(gravado, texto ?? '')
  fs.writeFileSync(arq.replace(/\.md$/, '.log.json'), JSON.stringify({ repositorio: dir, pedido: a.request || null, quando: new Date().toISOString(), tese: gravado, valida: !!conferencia?.ok, erros: conferencia?.ok ? null : erros, avisos: conferencia?.avisos ?? [], chamadas, custo_usd: Math.round(custo * 1e4) / 1e4 }, null, 1))
  const custoTxt = `usage cost: US$ ${Math.round(custo * 1e4) / 1e4} (${chamadas.length} call${chamadas.length > 1 ? 's' : ''}, ${chamadas.map((c) => `${c.turnos ?? '?'} turns, ${Math.round((c.duracao_ms ?? 0) / 1000)} s`).join(' · ')})`
  if (!conferencia?.ok) {
    console.error(`the thesis came back out of format twice (saved to ${gravado}).\n${custoTxt}`)
    return 1
  }
  if (anterior) console.error(`the previous thesis was kept as ${anterior}`)
  for (const av of conferencia.avisos) console.error(`warning: ${av}`)
  console.log(`${resumoTese(lerTese(texto))}\n\n${arq}\n${custoTxt}`)
  return 0
}

function validar(a) {
  const alvo = a._[1]
  if (!alvo) { console.error(uso); return 2 }
  const arq = arquivoDaTese(path.resolve(alvo))
  if (!fs.existsSync(arq)) { console.error(`Thesis not found: ${arq}`); return 2 }
  const tese = lerTese(fs.readFileSync(arq, 'utf8'))
  const v = validarTese(tese)
  if (!v.ok) { console.error(`the thesis failed the check (${arq}):\n${v.erros.map((e) => `  - ${e}`).join('\n')}`); return 1 }
  for (const av of v.avisos) console.error(`warning: ${av}`)
  console.log(resumoTese(tese))
  return 0
}

function conta(a) {
  const alvo = a._[1]
  if (!alvo) { console.error(uso); return 2 }
  const arq = path.resolve(alvo)
  if (!fs.existsSync(arq)) { console.error(`Script not found: ${arq}`); return 2 }
  let intencao = a.intent
  if (!intencao) {
    const t = acharTese(arq, a.thesis)
    if (!t || !fs.existsSync(t)) { console.error(`There is no thesis for this script${t ? ` (${t})` : ' (looked for thesis.md in its folder and up to 3 folders above)'}. Write the thesis before the script: node thesis.mjs write <repository> --out <project folder>. Or pass --intent.`); return 2 }
    const tese = lerTese(fs.readFileSync(t, 'utf8'))
    const v = validarTese(tese)
    if (!v.ok) { console.error(`the thesis failed the check (${t}):\n${v.erros.map((e) => `  - ${e}`).join('\n')}`); return 2 }
    intencao = tese.intencao
  }
  if (!INTENCOES.includes(intencao)) { console.error(`unknown intent: ${intencao}. Use one of: ${INTENCOES.join(', ')}`); return 2 }
  const md = fs.readFileSync(arq, 'utf8')
  const roteiro = lerRoteiro(md)
  if (!roteiro) { console.error(`No script table found in ${arq}: it needs one row per scene, with the "Who does the work" and "s" columns.`); return 2 }
  const j = julgar(roteiro, intencao)
  const bloco = textoConta(roteiro, intencao, j)
  if (a.write) fs.writeFileSync(arq, gravarConta(md, roteiro, bloco))
  if (a.json) console.log(JSON.stringify({ roteiro: arq, intencao, ...contar(roteiro.cenas), cenas: roteiro.cenas.map(({ n, quem, s }) => ({ n, quem, s })), veredito: j.veredito, motivos: j.motivos }, null, 1))
  else console.log(bloco.replace(/\*\*/g, ''))
  return j.passa ? 0 : 1
}

async function main() {
  const a = lerArgs(process.argv.slice(2))
  const cmd = a._[0]
  if (cmd === 'write') return escrever(a)
  if (cmd === 'validate') return validar(a)
  if (cmd === 'count') return conta(a)
  console.error(uso)
  return 2
}

if (process.argv[1] && (() => { try { return fs.realpathSync(process.argv[1]) === fs.realpathSync(fileURLToPath(import.meta.url)) } catch { return false } })()) {
  main().then((c) => process.exit(c)).catch((e) => { console.error(e.message); process.exit(2) })
}
