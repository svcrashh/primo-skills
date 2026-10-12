// Dado plausível: datas em dia de funcionamento e horários dentro do expediente, configuráveis por
// projeto (escola não é comércio). Nunca use "hoje" cru num tutorial: a gravação pode cair num domingo.
//   const d = criarDados({ perfil: 'escola', feriados: 'br' })
//   d.diaUtil()        → próximo dia de funcionamento a partir de hoje (hoje, se for um)
//   d.diaUtil(3)       → o 3º dia de funcionamento depois desse
//   d.horario('manha') → '08:00' (primeiro horário da manhã no expediente)
//   d.iso(data) '2026-09-29' · d.br(data) '29/09/2026' · d.curta(data) '09/29/2026' (no idioma) · d.extenso(data) 'Tue, Sep 29'
export const PERFIS = {
  escola: { dias: [1, 2, 3, 4, 5], inicio: '07:30', fim: '17:30', passo: 30 },
  clinica: { dias: [1, 2, 3, 4, 5], inicio: '08:00', fim: '18:00', passo: 20 },
  escritorio: { dias: [1, 2, 3, 4, 5], inicio: '09:00', fim: '18:00', passo: 30 },
  comercio: { dias: [1, 2, 3, 4, 5, 6], inicio: '09:00', fim: '19:00', passo: 30 },
  restaurante: { dias: [0, 2, 3, 4, 5, 6], inicio: '11:30', fim: '22:30', passo: 30 },
  sempre: { dias: [0, 1, 2, 3, 4, 5, 6], inicio: '00:00', fim: '23:30', passo: 30 },
}

const pad = (n) => String(n).padStart(2, '0')
const isoDe = (d) => `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`
const soma = (d, n) => new Date(d.getTime() + n * 86400000)

// Páscoa (computus gregoriano) → feriados móveis nacionais do Brasil
function pascoa(ano) {
  const a = ano % 19, b = Math.floor(ano / 100), c = ano % 100, d = Math.floor(b / 4), e = b % 4
  const f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30
  const i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451)
  const mes = Math.floor((h + l - 7 * m + 114) / 31), dia = ((h + l - 7 * m + 114) % 31) + 1
  return new Date(Date.UTC(ano, mes - 1, dia))
}
export function feriadosBR(ano) {
  const p = pascoa(ano)
  const fixos = ['01-01', '04-21', '05-01', '09-07', '10-12', '11-02', '11-15', '11-20', '12-25'].map((md) => `${ano}-${md}`)
  return [...fixos, isoDe(soma(p, -48)), isoDe(soma(p, -47)), isoDe(soma(p, -2)), isoDe(soma(p, 60))]  // carnaval (2), sexta santa, corpus christi
}

export function criarDados({ perfil = 'escola', dias, inicio, fim, passo, feriados = [], fuso = 'America/Sao_Paulo', hoje, idioma = 'en-US' } = {}) {
  const P = { ...(PERFIS[perfil] || PERFIS.escola), ...(dias ? { dias } : {}), ...(inicio ? { inicio } : {}), ...(fim ? { fim } : {}), ...(passo ? { passo } : {}) }
  const listaFer = new Set()
  const temFer = (ano) => {
    if (feriados === 'br' || (Array.isArray(feriados) && feriados.includes('br'))) for (const f of feriadosBR(ano)) listaFer.add(f)
    if (Array.isArray(feriados)) for (const f of feriados) if (/^\d{4}-\d\d-\d\d$/.test(f)) listaFer.add(f)
  }
  // "hoje" no fuso do projeto, como data UTC ao meio-dia (sem hora, sem fuso para atrapalhar)
  const hojeFuso = () => {
    if (hoje) return new Date(Date.UTC(...hoje.split('-').map((x, i) => (i === 1 ? +x - 1 : +x)), 12))
    const s = new Date().toLocaleDateString('en-CA', { timeZone: fuso })
    return new Date(s + 'T12:00:00Z')
  }
  const ehDiaUtil = (d) => { temFer(d.getUTCFullYear()); return P.dias.includes(d.getUTCDay()) && !listaFer.has(isoDe(d)) }
  const minutos = (hhmm) => { const [h, m] = hhmm.split(':').map(Number); return h * 60 + m }
  const hhmm = (min) => `${pad(Math.floor(min / 60))}:${pad(min % 60)}`
  const api = {
    perfil: P,
    hoje: hojeFuso,
    ehDiaUtil,
    /** n-ésimo dia de funcionamento a partir de `de` (padrão hoje). n = 0: `de` mesmo, se for dia útil. */
    diaUtil(n = 0, de = hojeFuso()) {
      let d = typeof de === 'string' ? new Date(de + 'T12:00:00Z') : de
      while (!ehDiaUtil(d)) d = soma(d, 1)
      for (let k = 0; k < n; k++) { d = soma(d, 1); while (!ehDiaUtil(d)) d = soma(d, 1) }
      return d
    },
    /** Horário dentro do expediente: 'manha' | 'tarde' | 'fim' | índice (0 = abertura) | 'HH:MM' (conferido). */
    horario(q = 'manha') {
      const a = minutos(P.inicio), b = minutos(P.fim)
      let m
      if (typeof q === 'number') m = a + q * P.passo
      else if (q === 'manha') m = Math.max(a, Math.min(b, minutos('08:00')))
      else if (q === 'tarde') m = Math.max(a, Math.min(b, minutos('14:00')))
      else if (q === 'fim') m = b - P.passo
      else m = minutos(q)
      if (m < a || m > b) throw new Error(`time ${hhmm(m)} is outside the opening hours ${P.inicio}–${P.fim} of profile "${perfil}"`)
      return hhmm(Math.round((m - a) / P.passo) * P.passo + a)
    },
    iso: (d) => isoDe(typeof d === 'string' ? new Date(d + 'T12:00:00Z') : d),
    br: (d) => { const x = typeof d === 'string' ? new Date(d + 'T12:00:00Z') : d; return `${pad(x.getUTCDate())}/${pad(x.getUTCMonth() + 1)}/${x.getUTCFullYear()}` },
    curta: (d) => (typeof d === 'string' ? new Date(d + 'T12:00:00Z') : d).toLocaleDateString(idioma, { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'UTC' }),
    extenso: (d) => (typeof d === 'string' ? new Date(d + 'T12:00:00Z') : d).toLocaleDateString(idioma, { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' }),
    /** Garante que a data é de funcionamento; senão, erro com o que fazer. */
    confere(d) {
      const x = typeof d === 'string' ? new Date(d + 'T12:00:00Z') : d
      if (!ehDiaUtil(x)) throw new Error(`${isoDe(x)} (${api.extenso(x)}) is not an opening day in profile "${perfil}". Use dados.diaUtil().`)
      return x
    },
  }
  return api
}
