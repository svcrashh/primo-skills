#!/usr/bin/env node
// O crítico independente: olha o vídeo pronto de fora, sem saber como foi feito, e diz aprova ou reprova com até 3 defeitos.
//   node critic.mjs <video.mp4> --request "<o que o dono pediu>" [--thesis <thesis.md>] [--guide <file>] [--captions <.srt>]
//                    [--refine <refine.json|pasta>] [--channel <channel>] [--player <px>] [--no-refine] [--no-thesis] [--product Nome] [--out <folder>] [--model sonnet]
//                    [--bundle-only] [--json]
// A tese (recipes/thesis.md) é achada sozinha: o thesis.md da pasta do vídeo ou de até 3 acima. Com ela o crítico cobra R14 a R16.
// Sai em <video>.critic/ (pacote/, critique.json, critique.md). Código 0 = aprova, 1 = reprova, 2 = não deu para rodar.
// A régua e a regra de uso: recipes/critic.md.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { montarPacote } from './critic/bundle.mjs'
import { chamarClaude, lerRegua, montarPrompt, MODELO_PADRAO, ORCAMENTO_PADRAO } from './critic/call.mjs'
import { extrairJson, validarResposta, tabela } from './critic/response.mjs'

const uso = 'usage: node critic.mjs <video.mp4> --request "<what the owner asked for>" [--thesis <thesis.md>] [--guide <file>] [--captions <.srt>] [--refine <refine.json|folder>] [--channel <channel>] [--player <px>] [--no-refine] [--no-thesis] [--out <folder>] [--model sonnet] [--bundle-only] [--json]'

export function lerArgs(argv) {
  const a = { _: [] }
  const com = new Set(['request', 'thesis', 'guide', 'captions', 'refine', 'product', 'channel', 'player', 'out', 'model', 'budget'])
  for (let i = 0; i < argv.length; i++) {
    const k = argv[i]
    if (k.startsWith('--')) {
      const nome = k.slice(2)
      if (com.has(nome)) { a[nome] = argv[++i]; if (a[nome] == null) throw new Error(`--${nome} needs a value`) } else a[nome] = true
    } else a._.push(k)
  }
  return a
}

async function main() {
  const a = lerArgs(process.argv.slice(2))
  const video = a._[0]
  if (!video || !a.request) { console.error(uso); process.exit(2) }
  const saida = path.resolve(a.out || video.replace(/\.[^.]+$/, '') + '.critic')
  fs.mkdirSync(saida, { recursive: true })

  console.error(`building the package for ${path.basename(video)}…`)
  const pacote = await montarPacote({ video, pedido: a.request, saida, guia: a.guide, legenda: a.captions, refino: a.refine, semRefino: !!a['no-refine'], produto: a.product, canal: a.channel, player: a.player, tese: a.thesis, semTese: !!a['no-thesis'] })
  for (const av of pacote.avisos) console.error(`warning: ${av}`)
  console.error(`package ready at ${pacote.dir} (${pacote.arquivos.length} files, ${pacote.quadros} frames)`)
  if (a['bundle-only']) return console.log(path.join(pacote.dir, 'bundle.md'))

  const regua = lerRegua()
  const modelo = a.model || MODELO_PADRAO
  const chamadas = []
  let validada = null, erros = null
  for (let tentativa = 1; tentativa <= 2 && !validada; tentativa++) {
    console.error(`calling the critic (${modelo}, fresh conversation${tentativa > 1 ? ', second attempt' : ''})…`)
    const r = await chamarClaude({ dir: pacote.dir, prompt: montarPrompt({ regua, duracao: pacote.duracao, erros }), modelo, orcamento: +(a.budget || ORCAMENTO_PADRAO) })
    chamadas.push({ modelo: r.modelo, custo_usd: r.custo_usd, uso: r.uso, duracao_ms: r.duracao_ms, turnos: r.turnos })
    try {
      const v = validarResposta(extrairJson(r.texto), pacote.duracao)
      if (v.ok) validada = v.resposta
      else erros = v.erros
    } catch (e) { erros = [e.message] }
  }
  const custo = chamadas.reduce((s, c) => s + (c.custo_usd ?? 0), 0)
  const registro = { video: path.resolve(video), pedido: a.request, tese: pacote.tese, quando: new Date().toISOString(), duracao_s: Math.round(pacote.duracao * 10) / 10, direcao: { nota: pacote.direcao.nota, ...pacote.direcao.medidas }, cortes_secos: pacote.cortes, chamadas, custo_usd: Math.round(custo * 1e4) / 1e4, resposta: validada, erros_de_formato: validada ? null : erros }
  fs.writeFileSync(path.join(saida, 'critique.json'), JSON.stringify(registro, null, 1))
  if (!validada) { console.error(`the critic answered out of format twice:\n${erros.map((e) => `  - ${e}`).join('\n')}`); process.exit(2) }
  const texto = tabela(validada, path.basename(video))
  fs.writeFileSync(path.join(saida, 'critique.md'), `# Critique · ${path.basename(video)}\n\n\`\`\`\n${texto}\n\`\`\`\n\nUsage cost: US$ ${registro.custo_usd} in ${chamadas.length} call(s) to ${chamadas[0].modelo}.\n`)
  if (a.json) console.log(JSON.stringify(registro, null, 1))
  else console.log(`${texto}\n\nusage cost: US$ ${registro.custo_usd} (${chamadas.length} call${chamadas.length > 1 ? 's' : ''}, ${chamadas.map((c) => `${c.uso?.entrada ?? '?'}+${c.uso?.cache_criado ?? 0} input tokens, ${c.uso?.saida ?? '?'} output, ${Math.round((c.duracao_ms ?? 0) / 1000)} s`).join(' · ')})`)
  process.exit(validada.veredito === 'aprova' ? 0 : 1)
}

if (process.argv[1] && fs.realpathSync(process.argv[1]) === fs.realpathSync(fileURLToPath(import.meta.url))) {
  main().catch((e) => { console.error(e.message); process.exit(2) })
}
