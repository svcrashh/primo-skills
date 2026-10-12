// A resposta do crítico: um JSON com o veredito e até 3 defeitos. Aqui só se lê e se confere o formato; quem julga é a
// outra conversa. node --test tests/critic-response.test.mjs
//   { "veredito": "approve" | "reject", "resumo": "…", "defeitos": [{ "segundo": 12.5, "item": "R1", "gravidade": "severe" | "minor", "o_que": "…", "corrigir": "…" }] }
// As chaves ficam em português (o critica.json não muda); os valores em inglês e os antigos em português valem os dois e
// saem normalizados para aprova/reprova e grave/leve.
export const MAX_DEFEITOS = 3
export const ITENS = Array.from({ length: 16 }, (_, i) => `R${i + 1}`)
const VEREDITOS = { approve: 'aprova', reject: 'reprova', aprova: 'aprova', reprova: 'reprova' }
const GRAVIDADES = { severe: 'grave', minor: 'leve', grave: 'grave', leve: 'leve' }

/** Acha o objeto JSON no texto que a conversa devolveu (com ou sem cerca de código, com ou sem conversa em volta). */
export function extrairJson(texto) {
  const t = String(texto ?? '')
  const cerca = /```(?:json)?\s*([\s\S]*?)```/i.exec(t)
  const candidatos = cerca ? [cerca[1], t] : [t]
  for (const c of candidatos) {
    const ini = c.indexOf('{')
    for (let a = ini; a >= 0 && a < c.length; a = c.indexOf('{', a + 1)) {
      let fundo = 0, dentroTexto = false, esc = false
      for (let i = a; i < c.length; i++) {
        const ch = c[i]
        if (dentroTexto) { if (esc) esc = false; else if (ch === '\\') esc = true; else if (ch === '"') dentroTexto = false; continue }
        if (ch === '"') dentroTexto = true
        else if (ch === '{') fundo++
        else if (ch === '}' && --fundo === 0) {
          try { return JSON.parse(c.slice(a, i + 1)) } catch { break }
        }
      }
    }
  }
  throw new Error("the critic's answer has no JSON")
}

/**
 * Confere o formato e as regras: até 3 defeitos, cada um com segundo dentro do vídeo, item da régua, gravidade, o que e
 * o que fazer; reprova se e só se há defeito grave. Devolve { ok, erros, resposta } com a resposta já normalizada.
 */
export function validarResposta(obj, duracao) {
  const erros = []
  if (!obj || typeof obj !== 'object') return { ok: false, erros: ['the answer is not an object'], resposta: null }
  const vBruto = String(obj.veredito ?? '').toLowerCase().trim()
  const veredito = VEREDITOS[vBruto] ?? vBruto
  if (veredito !== 'aprova' && veredito !== 'reprova') erros.push('"veredito" must be "approve" or "reject"')
  const bruto = Array.isArray(obj.defeitos) ? obj.defeitos : []
  if (!Array.isArray(obj.defeitos)) erros.push('"defeitos" must be a list')
  if (bruto.length > MAX_DEFEITOS) erros.push(`there are ${bruto.length} defects; the maximum is ${MAX_DEFEITOS}`)
  const defeitos = bruto.slice(0, MAX_DEFEITOS).map((d, i) => {
    const n = i + 1
    const segundo = Number(d?.segundo)
    if (!Number.isFinite(segundo) || segundo < 0 || (duracao != null && segundo > duracao + 0.5)) erros.push(`defect ${n}: "segundo" is outside the video (${d?.segundo}; the video is ${duracao} s long)`)
    const item = String(d?.item ?? '').toUpperCase().trim()
    if (!ITENS.includes(item)) erros.push(`defect ${n}: "item" must be a rubric item (R1 to R${ITENS.length})`)
    const gBruta = String(d?.gravidade ?? '').toLowerCase().trim()
    const gravidade = GRAVIDADES[gBruta] ?? gBruta
    if (gravidade !== 'grave' && gravidade !== 'leve') erros.push(`defect ${n}: "gravidade" must be "severe" or "minor"`)
    const o_que = String(d?.o_que ?? '').trim(), corrigir = String(d?.corrigir ?? '').trim()
    if (!o_que) erros.push(`defect ${n}: "o_que" is missing`)
    if (!corrigir) erros.push(`defect ${n}: "corrigir" is missing`)
    return { segundo: Math.round(segundo * 10) / 10, item, gravidade, o_que, corrigir }
  })
  const graves = defeitos.filter((d) => d.gravidade === 'grave').length
  if (veredito === 'reprova' && !graves) erros.push('rejected without any severe defect')
  if (veredito === 'aprova' && graves) erros.push('approved with a severe defect')
  const resumo = String(obj.resumo ?? '').trim()
  return { ok: !erros.length, erros, resposta: { veredito, resumo, defeitos } }
}

const GRAVIDADE_EN = { grave: 'severe', leve: 'minor' }

/** A tabela que a CLI mostra. */
export function tabela(resposta, nome = '') {
  const L = [`${resposta.veredito === 'aprova' ? 'APPROVED' : 'REJECTED'}${nome ? ` · ${nome}` : ''}${resposta.resumo ? ` — ${resposta.resumo}` : ''}`]
  if (!resposta.defeitos.length) L.push('  (no defects)')
  for (const d of resposta.defeitos) L.push(`  ${d.segundo} s · ${d.item} · ${GRAVIDADE_EN[d.gravidade] ?? d.gravidade}: ${d.o_que}\n      → ${d.corrigir}`)
  return L.join('\n')
}
