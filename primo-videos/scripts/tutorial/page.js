// Roda DENTRO do app gravado (addInitScript). Não desenha nada no vídeo: indicador, realce e legenda
// são da composição. Aqui só:
//   · privacidade — marca com data-fv-borrar o que não pode ser legível (senha, link com token, e-mail,
//     seletores do projeto) e uma folha de estilo borra; o DOM do app não é reescrito;
//   · esconder — some com o que nunca aparece em vídeo (seletores e textos do projeto);
//   · checagem — "tem algo na frente?": quem está de fato no ponto do toque e de que tipo;
//   · trocas de tela — avisa o gravador quando a URL muda (history e hash).
// cfg = { privacidade: { seletores, emails, emailsPermitidos, links, linksPermitidos }, esconder: { seletores, textos }, avisos, folgaBaixo }

// O que num texto não pode ficar legível: e-mail (menos os de emailsPermitidos) e link com segredo (parâmetro com nome de
// segredo, ou um trecho aleatório longo), menos os de linksPermitidos (ex.: um perfil público cujo id tem 22
// letras e dígitos). emails: false ou links: false desligam de vez.
function fvSensivel(priv) {
  const RE_EMAIL = /[\w.+-]+@[\w-]+(\.[\w-]+)+/g
  const PERMITIDO = priv.emailsPermitidos ? new RegExp(priv.emailsPermitidos, 'i') : null
  const LINK_OK = priv.linksPermitidos ? new RegExp(priv.linksPermitidos, 'i') : null
  // link com segredo: parâmetro com nome de segredo, ou um trecho aleatório longo (letras e dígitos, ≥ 20)
  const RE_LINK = /https?:\/\/\S*(?:[?&#](?:token|key|chave|secret|segredo|code|codigo|convite|invite|sig|signature|auth|senha|password|t)=[^\s&#]{6,}|\/(?=[A-Za-z0-9_-]*\d)(?=[A-Za-z0-9_-]*[A-Za-z])[A-Za-z0-9_-]{20,})/i
  const emailSensivel = (s) => priv.emails !== false && (s.match(RE_EMAIL) || []).some((m) => !(PERMITIDO && PERMITIDO.test(m)))
  const linkSensivel = (s) => priv.links !== false && (s.match(/https?:\/\/\S+/gi) || []).some((u) => RE_LINK.test(u) && !(LINK_OK && LINK_OK.test(u)))
  return (s) => !!s && (emailSensivel(String(s)) || linkSensivel(String(s)))
}

function fvPagina(cfg) {
  if (window.__fv) return
  const priv = cfg.privacidade || {}
  const SEL_PRIV = ['input[type=password]', '[data-privado]', ...(priv.seletores || [])].join(',')
  const SEL_ESC = (cfg.esconder && cfg.esconder.seletores || []).join(',')
  const TXT_ESC = (cfg.esconder && cfg.esconder.textos || []).map((s) => new RegExp(s, 'i'))
  const SEL_AVISO = ['[role=status]', '[role=alert]', '[aria-live=polite]', '[aria-live=assertive]', ...(cfg.avisos || [])].join(',')
  const sensivel = fvSensivel(priv)

  const estilo = () => {
    if (document.getElementById('__fv-estilo') || !document.head) return
    const st = document.createElement('style')
    st.id = '__fv-estilo'
    st.textContent = `${SEL_PRIV}, [data-fv-borrar] { filter: blur(${priv.raio || 7}px) !important; }
      ${SEL_ESC ? SEL_ESC + ',' : ''} [data-fv-esconder] { display: none !important; }
      ::-webkit-scrollbar { display: none; } * { scrollbar-width: none; }
      ${cfg.folgaBaixo ? `body { padding-bottom: ${cfg.folgaBaixo}px !important; }` : ''}`
    document.head.appendChild(st)
  }
  const marcaTexto = (no) => {
    const el = no.parentElement
    if (el && !el.closest('[data-fv-borrar]') && sensivel(no.nodeValue)) el.setAttribute('data-fv-borrar', '')
  }
  const marcaCampo = (el) => {
    if (!(el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement)) return
    if (sensivel(el.value)) el.setAttribute('data-fv-borrar', ''); else if (el.hasAttribute('data-fv-borrar') && !el.matches(SEL_PRIV)) el.removeAttribute('data-fv-borrar')
  }
  const esconde = (el) => {
    if (!TXT_ESC.length || !(el instanceof HTMLElement) || !el.matches('button, a, [role=button], [role=menuitem], li')) return
    const t = (el.textContent || '').trim()
    if (TXT_ESC.some((re) => re.test(t)) || TXT_ESC.some((re) => re.test(el.title || '') || re.test(el.getAttribute('aria-label') || ''))) el.setAttribute('data-fv-esconder', '')
  }
  const varre = (raiz) => {
    if (!raiz) return
    if (raiz.nodeType === 3) return marcaTexto(raiz)
    if (raiz.nodeType !== 1) return
    const w = document.createTreeWalker(raiz, NodeFilter.SHOW_TEXT)
    for (let n = w.nextNode(); n; n = w.nextNode()) marcaTexto(n)
    for (const el of [raiz, ...raiz.querySelectorAll('input, textarea, button, a, [role=button], [role=menuitem], li')]) { marcaCampo(el); esconde(el) }
  }
  const montar = () => {
    estilo()
    if (!document.body || window.__fvObs) return
    varre(document.body)
    // MutationObserver roda antes da pintura: nenhum quadro sai com o texto novo ainda legível.
    window.__fvObs = new MutationObserver((ms) => { for (const m of ms) { if (m.type === 'characterData') marcaTexto(m.target); else m.addedNodes.forEach(varre); if (m.type === 'attributes') marcaCampo(m.target) } })
    window.__fvObs.observe(document.body, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ['value'] })
    document.addEventListener('input', (e) => marcaCampo(e.target), true)
  }
  document.addEventListener('DOMContentLoaded', montar)
  if (document.readyState !== 'loading') montar()

  // ---------- "tem algo na frente?" ----------
  const texto = (el) => (el.getAttribute && (el.getAttribute('aria-label') || el.getAttribute('title'))) || (el.innerText || el.textContent || '').replace(/\s+/g, ' ').trim()
  const descrever = (el) => {
    if (!el || !el.tagName) return '?'
    const tag = el.tagName.toLowerCase(), role = el.getAttribute('role')
    let s = tag + (role ? `[role=${role}]` : el.id ? `#${el.id}` : '')
    let tx = texto(el)
    if (/^(select|input|textarea)$/.test(tag)) {
      // campo: o nome dele é o rótulo (sem o texto das opções), o placeholder ou o name
      const lb = el.labels && el.labels[0]
      let r = el.getAttribute('aria-label') || ''
      if (!r && lb) { const c = lb.cloneNode(true); c.querySelectorAll('select, input, textarea').forEach((x) => x.remove()); r = c.textContent.replace(/\s+/g, ' ').trim() }
      tx = r || el.getAttribute('placeholder') || el.getAttribute('name') || ''
    }
    if (tx) s += ` "${tx.length > 40 ? tx.slice(0, 38) + '…' : tx}"`
    return s
  }
  const ret = (el) => { const r = el.getBoundingClientRect(); return { x: +r.x.toFixed(1), y: +r.y.toFixed(1), w: +r.width.toFixed(1), h: +r.height.toFixed(1) } }
  const ehAviso = (el) => el.matches(SEL_AVISO) || /toast|snackbar|sonner|notif|aviso|flash/i.test((el.id || '') + ' ' + (typeof el.className === 'string' ? el.className : ''))
  const fixoAncestral = (el) => { for (let e = el; e && e !== document.documentElement; e = e.parentElement) { const p = getComputedStyle(e).position; if (p === 'fixed' || p === 'sticky') return e } return null }
  const rolavel = (el) => {
    for (let e = el && el.parentElement; e && e !== document.body; e = e.parentElement) {
      const o = getComputedStyle(e).overflowY
      if ((o === 'auto' || o === 'scroll') && e.scrollHeight > e.clientHeight + 1) return e
    }
    return document.scrollingElement || document.documentElement
  }

  // Aviso fixo com pointer-events: none (o toque passa através) não aparece no elementFromPoint, mas
  // cobre o alvo na tela: quem assiste vê o dedo por baixo do aviso. Vale a caixa, não o hit test.
  const avisoPorCima = (alvo) => {
    const a = alvo.getBoundingClientRect()
    for (const el of document.querySelectorAll(SEL_AVISO)) {
      if (el.contains(alvo) || alvo.contains(el) || !fixoAncestral(el)) continue
      const q = el.getBoundingClientRect()
      if (q.width < 4 || q.height < 4 || !(el.innerText || '').trim()) continue
      const cs = getComputedStyle(el)
      if (cs.visibility === 'hidden' || +cs.opacity === 0) continue
      if (q.right > a.left && q.left < a.right && q.bottom > a.top && q.top < a.bottom) return el
    }
    return null
  }

  window.__fv = {
    descrever, ret,
    /** Quem está no ponto (x, y) e se é o alvo. tipo: ok | fora | aviso | fixo | outro. */
    checa(alvo, x, y) {
      const r = ret(alvo)
      const base = { alvo: descrever(alvo), ret: r }
      if (x < 0 || y < 0 || x >= innerWidth || y >= innerHeight) return { ...base, ok: false, tipo: 'fora', quem: 'the screen edge' }
      const av = avisoPorCima(alvo)
      if (av) return { ...base, ok: false, tipo: 'aviso', quem: descrever(av), retQuem: ret(av), motivo: 'notice over the target' }
      const hit = document.elementFromPoint(x, y)
      if (!hit) return { ...base, ok: false, tipo: 'fora', quem: 'nothing' }
      if (hit === alvo || alvo.contains(hit) || (alvo.labels && [...alvo.labels].some((l) => l.contains(hit)))) return { ...base, ok: true }
      let aviso = null, fixo = null
      for (let e = hit; e && e !== document.body; e = e.parentElement) {
        if (ehAviso(e) && !e.contains(alvo)) aviso = e  // o mais de fora: o aviso inteiro, não o texto dele
        const p = getComputedStyle(e).position
        if (!fixo && (p === 'fixed' || p === 'sticky') && !e.contains(alvo)) fixo = e
      }
      const quem = aviso || fixo || hit
      const rq = ret(quem)
      let tipo = aviso ? 'aviso' : fixo ? 'fixo' : 'outro'
      let motivo = ''
      // véu de modal (cobre mais da metade da tela) não é barra: rolar não resolve
      if (tipo === 'fixo' && rq.w * rq.h > 0.5 * innerWidth * innerHeight) { tipo = 'outro'; motivo = 'covers more than half the screen' }
      if (tipo === 'fixo' && fixoAncestral(alvo)) { tipo = 'outro'; motivo = 'both are fixed on the screen, scrolling does not free it' }
      return { ...base, ok: false, tipo, quem: descrever(quem) + (tipo === 'fixo' ? ' (fixed)' : ''), retQuem: rq, motivo }
    },
    /** Rola o contêiner do alvo em dy px (positivo = conteúdo sobe). Devolve quanto o alvo andou de fato. */
    async rolaAlvo(alvo, dy, suave) {
      const c = rolavel(alvo), y0 = alvo.getBoundingClientRect().y
      c.scrollBy({ top: dy, behavior: suave ? 'smooth' : 'auto' })
      let ant = null
      for (let i = 0; i < 60; i++) {
        await new Promise((r) => setTimeout(r, 50))
        const y = alvo.getBoundingClientRect().y
        if (ant !== null && Math.abs(y - ant) < 0.5) break
        ant = y
      }
      return y0 - alvo.getBoundingClientRect().y
    },
    nativo(alvo) {
      const t = alvo.tagName.toLowerCase()
      if (t === 'select') return 'select'
      if (t === 'input' && /^(date|time|datetime-local|month|week|color|file)$/.test(alvo.type)) return alvo.type
      return null
    },
  }

  // ---------- trocas de tela ----------
  let ultima = location.pathname + location.hash
  const avisa = () => {
    const agora = location.pathname + location.hash
    if (agora !== ultima) { ultima = agora; if (window.__fvTela) window.__fvTela(agora) }
  }
  for (const k of ['pushState', 'replaceState']) {
    const orig = history[k]
    history[k] = function (...a) { const r = orig.apply(this, a); setTimeout(avisa, 0); return r }
  }
  addEventListener('popstate', avisa)
  addEventListener('hashchange', avisa)
}
if (typeof module !== 'undefined') module.exports = { fvPagina }
