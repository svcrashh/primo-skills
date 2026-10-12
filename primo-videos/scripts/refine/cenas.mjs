// Refino das cenas de um vídeo em capítulos: cada em()/ate() acende na palavra que a voz diz, e a cena não sobra.
// checarCenas(projeto, falas, { montagem, respiroMax, fechoRespiroMax }) → { achados, medidas }
// `falas` são as da narration.json já acertadas pela voz (scripts/refine/locucao.mjs). Cada chamada literal em('…', n),
// ate(…), soa(…), soaAte(…) do scene.js é avaliada com as funções da própria cena (tempos.js, pausas.js) e comparada
// com o instante em que a palavra EXATA soa de verdade.
import fs from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'
import { acharPalavra, acharPorPrefixo, limpa, numeroDaCena } from '../chapters/tempos.mjs'
import { ADIANTADA } from './locucao.mjs'

const r2 = (v) => v.toFixed(2)
const CHAMADA = /\b(em|ate|soa|soaAte)\(\s*(['"`])([^'"`]+)\2\s*(?:,\s*(\d+)\s*)?\)/g

// O ambiente da cena: tempos.js e, se houver, pausas.js (um acerto feito à mão por cima dos tempos).
function ambiente(dir) {
  const erros = []
  const ctx = { console: { error: (m) => erros.push(String(m)), log() {}, warn() {} } }
  vm.createContext(ctx)
  for (const f of ['tempos.js', 'pausas.js']) if (fs.existsSync(path.join(dir, f))) vm.runInContext(fs.readFileSync(path.join(dir, f), 'utf8'), ctx, { filename: f })
  vm.runInContext('this.__ = { FALA: typeof FALA !== "undefined" ? FALA : null, VOZ_EM: typeof VOZ_EM !== "undefined" ? VOZ_EM : null }', ctx)
  return { ctx, erros }
}

function chamar(amb, fn, busca, vez) {
  amb.erros.length = 0
  if (typeof amb.ctx[fn] !== 'function' && !vm.runInContext(`typeof ${fn} === 'function'`, amb.ctx)) return { t: null, erro: `${fn}() does not exist in this scene` }
  const t = vm.runInContext(`${fn}(${JSON.stringify(busca)}${vez ? `, ${vez}` : ''})`, amb.ctx)
  return { t, erro: amb.erros[0] || null }
}

export function checarCenas(projeto, falas, { montagem = null, respiroMax = 1.3, fechoRespiroMax = 3.0 } = {}) {
  const achados = [], medidas = { cenas: [] }
  const dirCenas = path.join(projeto, 'scenes')
  if (!fs.existsSync(dirCenas)) return { achados, medidas }
  const inicio = Object.fromEntries((montagem?.cenas || []).map((c) => [c.nome, c]))
  // a cena de exemplo do molde (01-example) nunca entra no vídeo
  for (const nome of fs.readdirSync(dirCenas).filter((c) => /^\d\d-/.test(c) && !/-example$/.test(c)).sort()) {
    const dir = path.join(dirCenas, nome)
    if (!fs.existsSync(path.join(dir, 'tempos.js')) || !fs.existsSync(path.join(dir, 'scene.js'))) continue
    const amb = ambiente(dir), { FALA, VOZ_EM } = amb.ctx.__
    const fala = FALA && falas.find((f) => f.id === FALA.id)
    if (!fala) { achados.push({ checagem: 'palavra', nivel: 'aviso', cena: nome, msg: `the tempos.js of ${nome} speaks of "${FALA?.id}", which is not in the narration`, oque_fazer: 'run tempos.mjs again' }); continue }
    const n = numeroDaCena(fala), ini = inicio[nome]?.ini ?? null
    const noVideo = (t) => (ini == null ? null : ini + t)
    const fonte = fs.readFileSync(path.join(dir, 'scene.js'), 'utf8') + (fs.existsSync(path.join(dir, 'marcos.js')) ? '\n' + fs.readFileSync(path.join(dir, 'marcos.js'), 'utf8') : '')
    const vistas = new Set(), m = { cena: nome, fala: fala.id, chamadas: 0, adiantadas: 0 }
    for (const [, fn, , busca, vezS] of fonte.matchAll(CHAMADA)) {
      const vez = vezS ? +vezS : undefined, chave = `${fn}|${busca}|${vez || 1}`
      if (vistas.has(chave)) continue
      vistas.add(chave); m.chamadas++
      const usada = chamar(amb, fn, busca, vez)
      const chamada = `${fn}('${busca}'${vez ? `, ${vez}` : ''})`
      const iExata = acharPalavra(fala.palavras, busca, vez || 1)
      const iPrefixo = acharPorPrefixo(fala.palavras, busca, vez || 1)
      const fimDe = fn === 'ate' || fn === 'soaAte'
      if (usada.erro) { achados.push({ checagem: 'palavra', nivel: 'erro', cena: nome, msg: `${chamada}: ${usada.erro}`, oque_fazer: 'write the word as it is in the line (without accent and punctuation is fine)' }); continue }
      if (iExata < 0) {
        if (iPrefixo >= 0) {
          const alvo = fala.palavras[iPrefixo], vezExata = fala.palavras.slice(0, iPrefixo + 1).filter((p) => limpa(p.texto) === limpa(alvo.texto)).length
          achados.push({ checagem: 'palavra', nivel: 'aviso', cena: nome, msg: `${chamada} only finds "${alvo.texto}" by the prefix; with the exact-word em() it does not exist`,
            oque_fazer: `change it to ${fn}('${limpa(alvo.texto)}'${vezExata > 1 ? `, ${vezExata}` : ''}) when generating tempos.js with scripts/chapters/tempos.mjs` })
        }
        continue
      }
      const alvo = fala.palavras[iExata], real = VOZ_EM + (fimDe ? alvo.fim : alvo.ini)
      const dif = usada.t - real
      if (dif <= -ADIANTADA) {
        m.adiantadas++
        const pegou = iPrefixo >= 0 && iPrefixo !== iExata && Math.abs(VOZ_EM + (fimDe ? fala.palavras[iPrefixo].fim : fala.palavras[iPrefixo].ini) - usada.t) < 0.02 ? ` (takes "${fala.palavras[iPrefixo].texto}" by the prefix)` : ''
        achados.push({ checagem: 'palavra', nivel: 'erro', cena: nome, t: usada.t, tVideo: noVideo(usada.t),
          msg: `${chamada}${pegou} lights up at ${r2(usada.t)} s of the scene, ${r2(-dif)} s before "${alvo.texto}" is heard (${r2(real)} s)`,
          oque_fazer: pegou ? `use the exact word: the skill's tempos.mjs and ${fn}('${busca}', ${vez || 1}) then fall on "${alvo.texto}"` : 'fix the narration.json by the pauses (refine without --check-only), run tempos.mjs and render the scene again' })
      }
    }
    // a cena não sobra: depois da fala, o respiro e a saída, e só
    const dur = inicio[nome]?.dur ?? null
    const fimFala = VOZ_EM + fala.palavras.at(-1).fim
    if (dur != null) {
      const sobra = dur - fimFala, max = n === 99 ? fechoRespiroMax : respiroMax
      m.sobra = Math.round(sobra * 1000) / 1000
      if (sobra > max) achados.push({ checagem: 'silencio-fim', nivel: sobra > max + 0.7 ? 'erro' : 'aviso', cena: nome, t: fimFala, fim: dur, tVideo: noVideo(fimFala),
        msg: `${nome} goes on ${r2(sobra)} s after the last word (the limit is ${r2(max)} s)`, oque_fazer: `shorten the scene to ~${r2(Math.ceil((fimFala + Math.min(max, 0.8)) * 10) / 10)} s (DURACAO_MINIMA in tempos.js)` })
    }
    medidas.cenas.push(m)
  }
  return { achados, medidas }
}
