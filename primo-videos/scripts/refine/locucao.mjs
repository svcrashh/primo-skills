// Refino da locução: o alinhamento pelas pausas reais, o silêncio sobrando no fim e a voz apagada. O refine.mjs carrega
// este arquivo quando ele existe (os pacotes com narração).
// refinarLocucao(arq, { corrigir, referencia, perfil }) → { achados, falas, mudancas, medidas }
// Com corrigir, reescreve a narration.json e apara os WAV, guardando antes narration.before-refine.json e
// lines/_before-refine/. Sem, só mede: as falas corrigidas voltam em memória para as outras checagens.
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { lerWav, acertarPelaVoz, fimDaVoz, apararFim, expressividade, validarLocucao, SOBRA_MAX } from '../voice.mjs'
import { acharLocucao } from '../chapters/tempos.mjs'

const r3 = (v) => Math.round(v * 1000) / 1000
const r2 = (v) => v.toFixed(2)
const mediana = (v) => { const o = [...v].sort((a, b) => a - b), m = o.length >> 1; return !o.length ? 0 : o.length % 2 ? o[m] : (o[m - 1] + o[m]) / 2 }

// Sem gabarito do produto, a régua do Reels: a voz animada aprovada mede ~10 st de tom e ~20 dB de energia; a calma de
// tutorial, recusada em Reels, ~6,7 st e ~16 dB. O piso fica entre as duas.
export const PISO_REELS = { tom: 8, energia: 17.5, piso: true }
export const ADIANTADA = 0.08
export const ANTES_DO_REFINO = 'narration.before-refine.json'

// A locução do projeto: --narration, a única voice/*/narration.json, ou a que o tempos.js das cenas diz que usou. null: não há.
export function locucaoDo(projeto, arg) {
  try { return acharLocucao(projeto, arg) } catch (e) {
    const cenas = path.join(projeto, 'scenes')
    for (const c of fs.existsSync(cenas) ? fs.readdirSync(cenas).sort() : []) {
      const t = path.join(cenas, c, 'tempos.js')
      const m = fs.existsSync(t) && fs.readFileSync(t, 'utf8').match(/from (\S*narration\.json)/)
      if (m && fs.existsSync(path.join(projeto, m[1]))) return path.join(projeto, m[1])
    }
    if (/could not find/.test(e.message)) return null
    throw e
  }
}

// A voz aprovada de um produto, para o gabarito: quem é e quanto se mexe (a régua da voz apagada no próximo vídeo).
export function vozDoGabarito(produto, locucao) {
  const loc = JSON.parse(fs.readFileSync(locucao, 'utf8'))
  const m = medirVoz(locucao)
  return { nome: loc.voz?.nome ?? null, id: loc.voz?.id ?? null, modelo: loc.voz?.modelo ?? null, ajustes: loc.voz?.ajustes ?? null, tom: m.tom, energia: m.energia, nivel: m.nivel, f0: m.f0, fonte: `the approved voice of ${produto} (${path.relative(os.homedir(), locucao)})`, locucao: path.resolve(locucao) }
}

export function medirVoz(arq) {
  const loc = JSON.parse(fs.readFileSync(arq, 'utf8')), dir = path.dirname(arq)
  const falas = loc.falas.map((f) => { const w = lerWav(path.join(dir, f.arquivo)); return { id: f.id, ...expressividade(w.amostras, w.taxa) } })
  return { tom: r3(mediana(falas.map((f) => f.tom))), energia: r3(mediana(falas.map((f) => f.energia))), nivel: r3(mediana(falas.map((f) => f.nivel))), f0: Math.round(mediana(falas.map((f) => f.f0))), falas }
}

// A voz contra a régua. Contra a voz aprovada do produto, a nota é a média das duas razões (< 0,8 reprova); contra o
// piso, abaixo dele nos dois reprova e num só avisa.
export function julgarExpressao(medida, ref) {
  const tom = medida.tom / ref.tom, energia = medida.energia / ref.energia, nota = (tom + energia) / 2
  const nivel = ref.piso ? (tom < 1 && energia < 1 ? 'erro' : tom < 1 || energia < 1 ? 'aviso' : null) : nota < 0.8 ? 'erro' : nota < 0.9 ? 'aviso' : null
  return { tom: r3(tom), energia: r3(energia), nota: r3(nota), nivel }
}

export function refinarLocucao(arq, { corrigir = true, referencia = null, perfil = null } = {}) {
  const loc = JSON.parse(fs.readFileSync(arq, 'utf8')), dir = path.dirname(arq)
  const achados = [], mudancas = [], novas = []
  const sobras = []
  for (const f of loc.falas) {
    const w = lerWav(path.join(dir, f.arquivo))
    const dur = w.n / w.taxa, fv = fimDaVoz(w.amostras, w.taxa)
    const sobra = fv == null ? 0 : dur - fv
    const { palavras, mudancas: ms } = acertarPelaVoz(f.palavras, w.amostras, w.taxa)
    const nova = { ...f, palavras }
    if (sobra > SOBRA_MAX) {
      const corte = r3(Math.min(dur, fv + 0.12))
      sobras.push({ id: f.id, sobra: r3(sobra), corte })
      nova.duracao = corte
      achados.push({ checagem: 'silencio-fim', nivel: 'erro', fala: f.id, msg: `line ${f.id} has ${r2(sobra)} s of leftover silence at the end (the take has ${r2(dur)} s, the voice ends at ${r2(fv)} s)`,
        oque_fazer: corrigir ? 'trimmed in the WAV and in the narration.json: run tempos.mjs and render the scene again (it gets shorter)' : 'run the refine without --check-only (it trims), then tempos.mjs and the scene render' })
    }
    for (const m of ms) mudancas.push({ fala: f.id, ...m })
    const adiantadas = ms.filter((m) => m.campo === 'ini' && m.para - m.de >= ADIANTADA)
    if (adiantadas.length) {
      achados.push({ checagem: 'alinhamento', nivel: 'aviso', fala: f.id,
        msg: `in line ${f.id}, the alignment put ${adiantadas.map((m) => `"${m.texto}" ${r2(m.para - m.de)} s early`).join(', ')} (the word after a pause was born inside it)`,
        oque_fazer: corrigir ? 'fixed in the narration.json by the measured pauses: run tempos.mjs and render the scenes again' : 'run the refine without --check-only to fix the narration.json; the scenes that use em() on these words come out early (see the "palavra" check)' })
    }
    novas.push({ fala: nova, w })
  }

  // A voz contra a régua
  const exp = novas.map(({ fala, w }) => ({ id: fala.id, ...expressividade(w.amostras, w.taxa) }))
  const medida = { tom: r3(mediana(exp.map((e) => e.tom))), energia: r3(mediana(exp.map((e) => e.energia))), nivel: r3(mediana(exp.map((e) => e.nivel))), f0: Math.round(mediana(exp.map((e) => e.f0))) }
  const ref = referencia || (perfil === 'reels' ? { ...PISO_REELS, fonte: 'the Reels floor (no product reference)' } : null)
  let julgamento = null
  if (ref) {
    julgamento = julgarExpressao(medida, ref)
    const de = ref.fonte || 'the approved voice of the product'
    if (julgamento.nivel) achados.push({ checagem: 'voz-apagada', nivel: julgamento.nivel,
      msg: `the voice moves less than ${de}: pitch ${r2(medida.tom)} st against ${r2(ref.tom)} (${Math.round(julgamento.tom * 100)}%), energy ${r2(medida.energia)} dB against ${r2(ref.energia)} (${Math.round(julgamento.energia * 100)}%)`,
      oque_fazer: 'generate again with a lively read (eleven_v3, "emocao": "excited", stability 0, exclamation where there is excitement) and let the person listen next to the approved one before assembling' })
    for (const e of exp) {
      if (e.tom < 0.7 * ref.tom && e.energia < 0.8 * ref.energia) achados.push({ checagem: 'voz-apagada', nivel: 'aviso', fala: e.id,
        msg: `line ${e.id} comes out flat: pitch ${r2(e.tom)} st and energy ${r2(e.energia)} dB, against ${r2(ref.tom)} and ${r2(ref.energia)} of the baseline`,
        oque_fazer: `redo only it (voice.mjs generate --redo ${e.id}) with more exclamation in the text` })
    }
  }

  if (corrigir && (mudancas.length || sobras.length)) {
    const bak = path.join(dir, ANTES_DO_REFINO)
    if (!fs.existsSync(bak)) fs.copyFileSync(arq, bak)
    for (const s of sobras) {
      const f = loc.falas.find((x) => x.id === s.id), wav = path.join(dir, f.arquivo)
      const guarda = path.join(dir, path.dirname(f.arquivo), '_before-refine', path.basename(f.arquivo))
      fs.mkdirSync(path.dirname(guarda), { recursive: true })
      if (!fs.existsSync(guarda)) fs.copyFileSync(wav, guarda)
      apararFim(wav)
      const nova = novas.find((n) => n.fala.id === s.id).fala, w2 = lerWav(wav)
      nova.duracao = r3(w2.n / w2.taxa)
      for (const p of nova.palavras) p.fim = Math.min(p.fim, nova.duracao)
    }
    const novo = { ...loc, falas: novas.map((n) => n.fala) }
    const erros = validarLocucao(novo, dir)
    if (erros.length) throw new Error(`the fixed narration did not pass Contract L (nothing was changed in the JSON):\n  ${erros.join('\n  ')}`)
    fs.writeFileSync(arq, JSON.stringify(novo, null, 1) + '\n')
  }
  return { achados, falas: novas.map((n) => n.fala), mudancas, sobras, medidas: { voz: medida, referencia: ref, julgamento, falas: exp } }
}
