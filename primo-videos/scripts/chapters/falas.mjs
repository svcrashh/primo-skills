// As falas da locução no vídeo em capítulos: lê a narration.json, confere o Contrato L (o mesmo do voice.mjs) e põe cada
// fala na cena dela, em <início da cena> + falaEm. A abertura vai para a cena 00-…, { capitulo: n } para a NN-…, o
// fechamento para a 99-…. Quem chama é o assemble.mjs, com --narration. Erro = lança com o que fazer.
import fs from 'node:fs'
import path from 'node:path'
import { validarLocucao } from '../voice.mjs'

/** As falas no tempo do vídeo montado: [{ ...fala, caminho, inicioArquivo, som, fim }], em ordem de som. */
export function colocarFalas(arq, cenas, { falaEm, saida }) {
  const dir = path.dirname(arq)
  if (!fs.existsSync(arq)) throw new Error(`could not find the narration ${arq}`)
  const loc = JSON.parse(fs.readFileSync(arq, 'utf8'))
  const e = validarLocucao(loc, dir)
  if (e.length) throw new Error(`the narration does not pass Contract L:\n  ${e.join('\n  ')}`)
  const problemas = [], falas = []
  for (const f of loc.falas) {
    const n = f.onde === 'abertura' ? 0 : f.onde === 'fechamento' ? 99 : f.onde.capitulo
    if (n == null) { problemas.push(`${f.id}: onde ${JSON.stringify(f.onde)} is not from a chapter video`); continue }
    const c = cenas.find((x) => x.n === n)
    if (!c) { problemas.push(`${f.id}: there is no scene ${String(n).padStart(2, '0')}-… for this line`); continue }
    const fim = falaEm + f.palavras.at(-1).fim
    if (fim > c.dur - saida) problemas.push(`${c.nome}: line ${f.id} ends at ${fim.toFixed(2)} s and the scene has ${c.dur.toFixed(2)} s; set duracao ≥ ${Math.ceil((fim + 0.8) * 10) / 10} in the scene's video.js (DURACAO_MINIMA in its tempos.js) and render it again`)
    const ini = c.ini + falaEm
    falas.push({ ...f, caminho: path.join(dir, f.arquivo), inicioArquivo: ini, som: ini + f.inicio_voz, fim: ini + f.palavras.at(-1).fim })
  }
  if (problemas.length) throw new Error(`the voice does not fit in the scenes:\n  ${problemas.join('\n  ')}`)
  return falas.sort((a, b) => a.som - b.som)
}
