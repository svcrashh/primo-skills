// Grava a jornada real de um tutorial num app web (Playwright), ou só confere que ela ainda roda (--check).
// O que aparece no vídeo é a tela de verdade: nada recriado. Indicador de toque, cursor, realce, zoom,
// legendas e sons são da composição (compose.mjs), a partir do log de eventos que este arquivo grava.
//
//   node <video-folder>/video.mjs                     grava todas as versões
//   node <video-folder>/video.mjs --device phone    grava só uma
//   node <video-folder>/video.mjs --check             confere sem gravar (rápido, mesma checagem de toque)
//
// O --check confere também, antes de gastar uma gravação, tudo o que o compor recusaria e já dá para saber: a série
// (series.json, brand.js, identity.json, o visual), o modo cinema contra o aparelho, o Python da trilha; com voz, pelo
// narration.json ou, antes de gerar a voz, pelo script.json ao lado dele: a fala da abertura é o título, a do fecho é o
// fimLinhas, cada g.na acha a palavra na fala do passo, nenhuma fala sobra; o ms do g.placar (≥ 2,5 s legível), o
// rótulo do g.prova (até 16 letras) e cada g.antes (o arquivo, a proporção, o ms). Cada problema sai com o que trocar.
//
// Regra sem exceção: nenhum toque sem checagem. Antes de cada toque/aponta, e de novo no instante do
// toque, document.elementFromPoint no ponto. Se não é o alvo: aviso → espera sumir; barra fixa ou botão
// flutuante → rola até liberar; qualquer outra coisa → a gravação FALHA com "X cobre Y".
//
// Saída: <folder>/output/<device>/frames/*.jpg, frames.json ([[arquivo, t], …]), events.json, taps-sheet.png
import { createRequire } from 'node:module'
import { fileURLToPath, pathToFileURL } from 'node:url'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { aparelho } from './devices.mjs'
import { criarDados } from './data.mjs'
import { TEMPO_PLACAR, PLACAR_MIN, msMinimoDoPlacar, PROVA_MAX, ANTES_MS, ANTES_EXT, ehClipe, SECAO_MAX } from './rules.mjs'

const AQUI = path.dirname(fileURLToPath(import.meta.url))
const require = createRequire(import.meta.url)
const PAGINA = fs.readFileSync(path.join(AQUI, 'page.js'), 'utf8')
const argv = process.argv.slice(2)
const opt = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 ? argv[i + 1] : d }
const r1 = (x) => +x.toFixed(1), r3 = (x) => +x.toFixed(3)
const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2)  // igual à composição
// Ponto de extensão opcional: sem scripts/app/canal.mjs no pacote, nada é avisado para fora.
const CANAL = new URL('../app/canal.mjs', import.meta.url)
const canalDoApp = async () => (fs.existsSync(CANAL) ? import(CANAL.href) : null)
// A locução só vem nos pacotes com narração: sem scripts/tutorial/locucao.mjs, o tutorial é sem voz.
const LOCUCAO = new URL('./locucao.mjs', import.meta.url)
const SEM_NARRACAO = 'video.voz is the voiceover, and this skill has no voiceover: remove "voz" from video.mjs (the tutorial comes out with the soundtrack and the caption of each step).'

// mesmo achador da skill (ou da cópia do motor num repositório): PLAYWRIGHT_PATH, node_modules, npm -g, npx
const achador = () => [path.join(AQUI, '..', 'playwright.cjs'), path.join(AQUI, 'playwright.cjs'), path.join(AQUI, '..', 'tools', 'playwright.cjs')].find((c) => fs.existsSync(c))

export function carregarPlaywright(pasta) {
  const cand = achador()
  return cand ? require(cand).carregar(pasta).pw : require('playwright')
}

/** Os argumentos de GPU do playwright.cjs (no Mac, ANGLE/Metal): a gravação e a folha abrem o Chromium como o render. */
export const argsGpu = () => { const cand = achador(); return cand ? require(cand).argsGpu() : [] }

/** Roda um vídeo: grava (padrão) ou confere (--check). Devolve [{ versao, ok, erro }]. */
export async function rodar(video, { check = argv.includes('--check'), versao = opt('device'), captura = opt('capture', 'screencast') } = {}) {
  const versoes = versao ? [versao] : video.versoes || ['phone']
  const vb = check ? null : await canalDoApp()
  await vb?.checarDono({ onde: `gravar ${video.id}` })
  const res = []
  for (const v of versoes) {
    await vb?.avisar('cenas', `recording ${video.id} (${v})`)
    const r = await rodarVersao(video, v, { check, captura })
    if (r.ok) await vb?.mostrar(path.join(video.pasta, 'output', v, 'taps-sheet.png'), `Taps: ${video.titulo || video.id} (${v})`, 'folha')
    else await vb?.avisar('erro', `${video.id} (${v}) did not record: ${r.erro}`)
    res.push(r)
  }
  if (res.some((r) => !r.ok)) process.exitCode = 1
  return res
}

export function principal(metaUrl) {
  // caminho real dos dois lados: a skill é instalada por link simbólico
  try { return !!process.argv[1] && fs.realpathSync(process.argv[1]) === fs.realpathSync(fileURLToPath(metaUrl)) } catch { return false }
}

async function abrir(pw, ap, idioma, captura) {
  const args = [`--lang=${idioma}`, '--hide-scrollbars', ...argsGpu()]
  // Headless novo (canal "chromium") + DSF na linha de comando: é o que faz o screencast sair no pixel
  // real a ~60 qps. Sem o canal, cai para o headless antigo com captureScreenshot (mais lento).
  if (captura === 'screencast') {
    try { return { browser: await pw.chromium.launch({ channel: 'chromium', args: [...args, `--force-device-scale-factor=${ap.dsf}`] }), captura } } catch (e) {
      console.log(`  (chromium channel unavailable: ${e.message.split('\n')[0]} — using captureScreenshot)`)
    }
  }
  return { browser: await pw.chromium.launch({ args }), captura: 'screenshot' }
}

/** Os aparelhos do vídeo: o que a série pede (series.json "aparelhos", ex. { "computer": { "dsf": 3 } }) com o que o
 *  video.mjs pede por cima (video.aparelhos, campo a campo). */
export function aparelhosDoVideo(video) {
  let daSerie = {}
  try { daSerie = JSON.parse(fs.readFileSync(path.join(path.resolve(video.pasta, video.serie || '../serie'), 'series.json'), 'utf8')).aparelhos || {} } catch { /* sem série legível: o --check acusa */ }
  const out = { ...daSerie }
  for (const [k, x] of Object.entries(video.aparelhos || {})) out[k] = { ...(daSerie[k] || {}), ...x }
  return out
}

/** Título e texto final como a tela vai mostrar (a voz da abertura e do fechamento diz o mesmo). */
function textosDaTela(video) {
  const arq = path.join(path.resolve(video.pasta, video.serie || '../serie'), 'series.json')
  const serie = fs.existsSync(arq) ? JSON.parse(fs.readFileSync(arq, 'utf8')) : {}
  return { titulo: video.titulo || video.id, fimLinhas: video.fimLinhas || serie.fimLinhas || ['Done!'] }
}

async function rodarVersao(video, v, { check, captura: capturaPedida }) {
  const ap = aparelho(v, aparelhosDoVideo(video))
  // --check: o que o compor recusaria e já dá para saber (a série, o cinema, o aparelho, o Python). Junta tudo e segue
  // para a jornada, que acha o resto (g.na, g.placar, g.prova, g.antes); no fim, sai com a lista inteira.
  const regras = []
  let comp = null
  if (check) {
    const { conferirComposicao } = await import('./compose.mjs')
    comp = conferirComposicao(video, ap)
    regras.push(...comp.erros)
  }
  // Com voz, a locução manda no tempo: cada passo fica na tela pela fala dele. Confere antes de abrir o navegador.
  // O locucao.mjs só é carregado quando o vídeo tem voz: sem voz, o gravador não depende dele. No --check sem a
  // locução ainda (a voz não foi gerada), as falas saem do script.json: só o texto, sem tempo.
  let voz = null, LV = null
  if (video.voz) {
    try {
      if (!fs.existsSync(LOCUCAO)) throw new Error(SEM_NARRACAO)
      LV = await import(LOCUCAO.href)
      if (check && !fs.existsSync(LV.caminhoLocucao(video, v))) {
        voz = LV.lerRoteiroComoLocucao(video, v)
        console.log(`  (the voice was not generated yet: checking against the text of ${voz.rel}; the timings only exist after the voice is generated)`)
      } else voz = LV.lerLocucao(video, v)
      LV.conferirTextos(voz, textosDaTela(video))
    } catch (e) {
      if (!check || !voz) {
        console.log(`✗ ${video.id} (${v}) voice: ${e.message}`)
        for (const r of regras) console.log(`  ✗ ${r}`)
        process.exitCode = 1
        return { versao: v, ok: false, erro: e.message.split('\n')[0] }
      }
      regras.push(...e.message.split('\n').map((l) => l.trim()).filter(Boolean))
    }
  }
  if (check) for (const r of regras) console.log(`  ✗ ${r}`)
  const idioma = video.idioma || 'en-US'
  const saida = path.join(video.pasta, 'output', v)
  const pw = carregarPlaywright(video.pasta)
  const { browser, captura } = await abrir(pw, ap, idioma, capturaPedida)
  const ctx = await browser.newContext({
    viewport: ap.viewport, deviceScaleFactor: ap.dsf, isMobile: !!ap.toque, hasTouch: !!ap.toque,
    locale: idioma, timezoneId: video.fuso || 'America/Sao_Paulo', colorScheme: video.tema || 'light', reducedMotion: 'no-preference',
  })
  const cfgPagina = { privacidade: { ...(video.privacidade || {}), seletores: [...((video.privacidade && video.privacidade.seletores) || []), ...(video.borrar || [])] },
    esconder: Array.isArray(video.esconder) ? { seletores: video.esconder } : video.esconder || {}, avisos: video.avisos || [] }
  await ctx.addInitScript({ content: `${PAGINA}\n;fvPagina(${JSON.stringify(cfgPagina)});` })
  const p = await ctx.newPage()
  const errosPagina = []
  p.on('pageerror', (e) => errosPagina.push(e.message))
  p.setDefaultTimeout(check ? 15000 : 30000)
  const dados = criarDados({ fuso: video.fuso, idioma, ...(video.dados || {}) })

  const eventos = []
  let t0 = null
  const agora = () => (t0 == null ? 0 : Date.now() / 1000 - t0)
  const ev = (e) => { if (t0 != null) eventos.push({ t: r3(agora()), ...e }) }
  // Troca de tela: o page.js avisa as do history e do hash; a carga inteira (p.goto, link que recarrega a página) só o
  // framenavigated vê, no commit, antes de a página aparecer. Sem ele, a página aberta por p.goto entrava já com zoom,
  // cortada no meio. A mesma tela avisada pelos dois conta uma vez.
  let ultimaTela = null
  const tela = (url) => { if (t0 != null && url !== ultimaTela) { ultimaTela = url; ev({ tipo: 'tela', url }) } }
  await p.exposeBinding('__fvTela', (_s, url) => tela(url))
  p.on('framenavigated', (f) => { if (f === p.mainFrame()) { try { const u = new URL(f.url()); if (/^https?:$/.test(u.protocol)) tela(u.pathname + u.hash) } catch {} } })

  const W = ap.viewport.width, H = ap.viewport.height
  let pos = [W / 2, ap.toque ? H * 0.72 : H / 2]
  const nativos = new Map()
  const leituraMin = check ? 0 : video.leituraMin || 3.0

  // ---------- entrar e preparar (fora da gravação) ----------
  if (video.entrar) await video.entrar({ p, v, ap, dados, check })
  else await p.goto(video.url, { waitUntil: 'networkidle' })
  if (video.preparar) await video.preparar({ p, v, ap, dados, check })
  if (video.inicio) await p.goto(new URL(video.inicio, p.url()).href, { waitUntil: 'networkidle' })
  await p.waitForLoadState('networkidle').catch(() => {})
  await p.waitForTimeout(check ? 200 : 900)

  // ---------- captura ----------
  const quadros = []
  let capturando = false, laco = null, cdp = null
  let offset = Infinity  // relógio do navegador → relógio daqui (menor latência observada)
  const brutos = []
  if (!check) {
    fs.rmSync(saida, { recursive: true, force: true })
    fs.mkdirSync(path.join(saida, 'frames'), { recursive: true })
    cdp = await ctx.newCDPSession(p)
    t0 = Date.now() / 1000
    capturando = true
    let n = 0
    if (captura === 'screencast') {
      cdp.on('Page.screencastFrame', (f) => {
        const rec = Date.now() / 1000
        cdp.send('Page.screencastFrameAck', { sessionId: f.sessionId }).catch(() => {})
        if (!capturando) return
        const nome = String(++n).padStart(5, '0') + '.jpg'
        fs.writeFileSync(path.join(saida, 'frames', nome), Buffer.from(f.data, 'base64'))
        const ts = f.metadata && f.metadata.timestamp ? f.metadata.timestamp : rec
        offset = Math.min(offset, rec - ts)
        brutos.push([nome, ts, rec])
      })
      await cdp.send('Page.startScreencast', { format: 'jpeg', quality: video.qualidade || 88, maxWidth: Math.round(W * ap.dsf), maxHeight: Math.round(H * ap.dsf), everyNthFrame: 1 })
      // o screencast só manda quadro quando algo pinta: força o primeiro
      await p.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))))
    } else {
      laco = (async () => {
        while (capturando) {
          const a = Date.now() / 1000
          let r
          try {
            // o clip é em coordenadas do DOCUMENTO: acompanha a rolagem, senão a página rolada sai em branco
            const { cssVisualViewport: vp } = await cdp.send('Page.getLayoutMetrics')
            r = await cdp.send('Page.captureScreenshot', { format: 'jpeg', quality: video.qualidade || 88, optimizeForSpeed: true, clip: { x: vp.pageX, y: vp.pageY, width: W, height: H, scale: ap.dsf } })
          } catch { continue }
          const b = Date.now() / 1000
          const nome = String(++n).padStart(5, '0') + '.jpg'
          fs.writeFileSync(path.join(saida, 'frames', nome), Buffer.from(r.data, 'base64'))
          quadros.push([nome, r3((a + b) / 2 - t0)])
        }
      })()
    }
  } else t0 = Date.now() / 1000

  // ---------- helpers ----------
  const loc = (alvo) => (typeof alvo === 'string' ? p.locator(alvo) : alvo)
  const caixa = async (l) => {
    const r = await l.evaluate((e) => window.__fv.ret(e))
    return r
  }
  const parado = async (l) => {
    let r = await caixa(l)
    for (let i = 0; i < 30; i++) {
      await p.waitForTimeout(check ? 40 : 80)
      const r2 = await caixa(l)
      const ok = Math.abs(r2.x - r.x) < 0.5 && Math.abs(r2.y - r.y) < 0.5 && Math.abs(r2.w - r.w) < 0.5
      r = r2
      if (ok) break
    }
    return r
  }
  const pontoDe = (r, ponto) => [r1(r.x + (ponto ? ponto.x : r.w / 2)), r1(r.y + (ponto ? ponto.y : r.h / 2))]
  const visivel = async (l) => {
    await l.waitFor({ state: 'visible' })
    let r = await caixa(l)
    // fora da janela, ou cortado por um contêiner com rolagem própria (corpo de diálogo, lista): rola até ele
    const cortado = await l.evaluate((e) => {
      const re = e.getBoundingClientRect()
      for (let a = e.parentElement; a && a !== document.body && a !== document.documentElement; a = a.parentElement) {
        if (!/(auto|scroll|hidden)/.test(getComputedStyle(a).overflowY)) continue
        const ra = a.getBoundingClientRect()
        if (re.top < ra.top - 1 || re.bottom > ra.bottom + 1) return true
      }
      return false
    })
    if (cortado || r.y < 0 || r.y + r.h > H || r.x < 0 || r.x + r.w > W) {
      const r0 = r
      await l.evaluate((e, suave) => e.scrollIntoView({ behavior: suave ? 'smooth' : 'auto', block: 'center', inline: 'nearest' }), !check)
      const t1 = agora()
      r = await parado(l)
      // pelo alvo, não pelo scrollY: a rolagem pode ter sido dentro do diálogo
      if (Math.abs(r.y - r0.y) > 1) ev({ tipo: 'rola', t: r3(t1 - 0.05), t1: r3(agora()), dy: r1(r0.y - r.y), auto: true })
    }
    return r
  }

  const erroCobre = (c, extra) => {
    const e = new Error(`${c.quem} covers ${c.alvo}${extra ? ` (${extra})` : ''}`)
    e.cobre = c
    return e
  }
  /** "Tem algo na frente?" — resolve (espera o aviso, rola a barra) ou falha. Devolve { r, pt, historico }. */
  const livre = async (l, ponto) => {
    // o waitForFunction do aviso acha o alvo por um atributo temporário (não dá para passar o elemento)
    await l.evaluate((e) => e.setAttribute('data-fv-alvo', ''))
    try {
      const historico = []
      let rolagens = 0
      for (let volta = 0; volta < 12; volta++) {
        const r = await parado(l)
        const pt = pontoDe(r, ponto)
        const c = await l.evaluate((e, [x, y]) => window.__fv.checa(e, x, y), pt)
        if (c.ok) return { r, pt, historico }
        if (c.tipo === 'aviso') {
          const ta = agora(), lim = video.limiteAviso || 10
          const ok = await p.waitForFunction(([x, y]) => { const e = document.querySelector('[data-fv-alvo]'); return !e || window.__fv.checa(e, x, y).tipo !== 'aviso' }, pt, { timeout: lim * 1000, polling: 100 }).then(() => true, () => false)
          historico.push({ quem: c.quem, tipo: 'aviso', acao: `waited ${(agora() - ta).toFixed(1)} s` })
          ev({ tipo: 'espera', t: r3(ta), t1: r3(agora()), motivo: `notice ${c.quem} over ${c.alvo}` })
          if (!ok) throw erroCobre(c, `the notice did not go away in ${lim} s`)
          continue
        }
        if (c.tipo === 'fixo' && rolagens < 3) {
          rolagens++
          const q = c.retQuem
          // barra na metade de baixo: o alvo sobe acima dela; na metade de cima: desce abaixo dela
          const dy = q.y + q.h / 2 > H / 2 ? r.y + r.h - (q.y - 14) : r.y - (q.y + q.h + 14)
          const ta = agora()
          const andou = await l.evaluate((e, [d, s]) => window.__fv.rolaAlvo(e, d, s), [dy, !check])
          historico.push({ quem: c.quem, tipo: 'fixo', acao: `scrolled ${Math.round(andou)} px` })
          ev({ tipo: 'rola', t: r3(ta), t1: r3(agora()), dy: r1(andou), motivo: `free ${c.alvo} from ${c.quem}` })
          if (Math.abs(andou) < 1) throw erroCobre(c, 'scrolling does not free it: the page does not move anymore')
          continue
        }
        throw erroCobre(c, c.tipo === 'fixo' ? 'scrolled 3 times and it is still covered' : c.motivo)
      }
      throw new Error(`the target ${await l.evaluate((e) => window.__fv.descrever(e))} was not free after 12 tries`)
    } finally {
      await l.evaluate((e) => e.removeAttribute('data-fv-alvo')).catch(() => {})
    }
  }

  const mover = async (pt, rapido) => {
    const d = Math.hypot(pt[0] - pos[0], pt[1] - pos[1])
    const ms = check ? 0 : Math.round(Math.min(ap.toque ? 750 : 650, Math.max(rapido ? 180 : 320, 260 + d * (ap.toque ? 0.9 : 0.45))))
    const de = pos
    const ta = agora()
    if (!check) {
      if (!ap.toque) {
        // o mouse de verdade percorre a mesma curva que o cursor desenhado (hover aparece no lugar certo)
        const passos = Math.max(4, Math.round(ms / 16))
        for (let i = 1; i <= passos; i++) {
          const e = ease(i / passos)
          await p.mouse.move(de[0] + (pt[0] - de[0]) * e, de[1] + (pt[1] - de[1]) * e)
          await p.waitForTimeout(ms / passos)
        }
      } else await p.waitForTimeout(ms)
    }
    pos = pt
    if (ms) ev({ tipo: 'move', t: r3(ta), t1: r3(agora()), de: de.map(r1), para: pt })
  }

  // --check: um problema de regra (palavra fora da fala, placar curto, rótulo longo, antes errado) é anotado e a jornada
  // segue, para a lista sair inteira de uma vez; gravando, é erro na hora.
  const regra = (msg) => {
    if (!check) throw new Error(msg)
    regras.push(msg); console.log(`  ✗ ${msg}`)
    return false
  }
  const descr = (l) => l.evaluate((e) => window.__fv.descrever(e))
  const ultimoPasso = () => [...eventos].reverse().find((e) => e.tipo === 'passo')
  let naPasso = 0, naDesde = 0  // g.na: em que passo, e a partir de que palavra procurar (repetidas pegam a próxima)

  const g = {
    p, v, ap, dados, check, phone: !!ap.toque, toque: !!ap.toque,
    /** Nova legenda. A anterior fica parada pelo menos `leituraMin` (3 s). Com voz, a legenda é a fala do passo,
     *  o passo fica na tela pela fala inteira e o controle volta 0,3 s antes do fim da frase: primeiro diz, depois faz.
     *  junto: o controle volta no primeiro som, e os toques correm com a fala (cada um no seu g.na). */
    async passo(legenda, { junto = false } = {}) {
      const ult = ultimoPasso()
      if (ult) { const falta = ult.t + (voz && !check ? LV.esperaDoPasso(voz.passos.get(ult.n), leituraMin) : leituraMin) - agora(); if (falta > 0) await p.waitForTimeout(falta * 1000) }
      const n = eventos.filter((e) => e.tipo === 'passo').length + 1
      const fala = voz && voz.passos.get(n)
      if (fala && n === 1 && !check) { const falta = LV.RESPIRO - agora(); if (falta > 0) await p.waitForTimeout(falta * 1000) }
      if (fala && fala.texto !== legenda) console.log(`  warning: step ${n}: the script says "${legenda}" and the voice says "${fala.texto}". The caption is the voice.`)
      ev({ tipo: 'passo', n, legenda: fala ? fala.texto : legenda, ...(fala ? { fala: fala.id } : {}), ...(fala && fala.texto !== legenda ? { roteiro: legenda } : {}) })
      if (check) console.log(`  · ${fala ? fala.texto : legenda}`)
      else if (fala) { const falta = eventos[eventos.length - 1].t + (junto ? LV.ENTRA : LV.devolveEm(fala)) - agora(); if (falta > 0) await p.waitForTimeout(falta * 1000) }
    },
    /** Dentro de um passo com fala: espera até `antes` s antes de a palavra ser dita, para o toque seguinte cair
     *  nela. Já passou: segue. Passo sem fala (ou vídeo sem voz): não espera. Palavra fora da fala: erro, já no --check. */
    async na(palavra, { antes = LV ? LV.NA_ANTES : 0 } = {}) {
      const ult = ultimoPasso()
      const fala = voz && ult && voz.passos.get(ult.n)
      if (!fala) return
      if (naPasso !== ult.n) { naPasso = ult.n; naDesde = 0 }
      let achada
      try { achada = LV.acharPalavra(fala, palavra, naDesde) } catch (e) { return regra(e.message) }
      const { ini, fim } = achada
      naDesde = fim
      if (check) return
      const falta = LV.instanteDaPalavra(fala, ini, ult.t) - antes - agora()
      if (falta > 0) await p.waitForTimeout(falta * 1000)
    },
    async pausa(ms) { if (!check) await p.waitForTimeout(ms) },
    /** Abre uma seção do tutorial (um bloco de passos sobre o mesmo assunto). Na composição: o painel vira em Y, o rótulo
     *  da seção troca na coluna de texto e um whoosh marca a virada. Chame antes do g.passo que abre a seção. */
    async secao(nome) {
      if (typeof nome !== 'string' || !nome.trim()) throw new Error("g.secao needs the section name: g.secao('Reports and export')")
      if (nome.length > SECAO_MAX) regra(`g.secao("${nome}"): the section name has at most ${SECAO_MAX} characters (it fits one line of the text column)`)
      // a seção nova só entra quando o passo anterior já ficou o tempo de ler (como o g.passo): ela abre junto com o passo
      const ult = ultimoPasso()
      if (ult) { const falta = ult.t + (voz && !check ? LV.esperaDoPasso(voz.passos.get(ult.n), leituraMin) : leituraMin) - agora(); if (falta > 0) await p.waitForTimeout(falta * 1000) }
      ev({ tipo: 'secao', nome: nome.trim() })
      if (check) console.log(`  § ${nome.trim()}`)
    },
    /** Espera algo: um locator aparecer (padrão) ou sumir ({ estado: 'hidden' }), ou ms. */
    async espera(alvo, { estado = 'visible', motivo = '', timeout } = {}) {
      const ta = agora()
      if (typeof alvo === 'number') { if (!check) await p.waitForTimeout(alvo) } else await loc(alvo).waitFor({ state: estado, timeout })
      ev({ tipo: 'espera', t: r3(ta), t1: r3(agora()), motivo: motivo || (typeof alvo === 'number' ? 'pause' : estado) })
    },
    /** Leva o indicador até o alvo e realça, sem tocar.
     *  dedo: false leva só a câmera (e o realce, se pedido): o indicador não aparece. É para mostrar o que o produto
     *  acabou de fazer num vídeo de venda, em que ninguém opera a tela. */
    async aponta(alvo, { ponto = null, ms = 1100, realce = true, dedo = true, lupa = null, margem = null } = {}) {
      if (lupa != null && !(lupa >= 1.5 && lupa <= 6)) throw new Error(`g.aponta: lupa ${JSON.stringify(lupa)} outside 1.5–6 (how many times the target grows; 3 is a good start)`)
      if (margem != null && !(Array.isArray(margem) && margem.length === 4 && margem.every((m) => m >= 0))) throw new Error('g.aponta: the magnifier margin (margem) is [top, right, bottom, left] in app px (what shows around the target)')
      const l = loc(alvo)
      await visivel(l)
      const { r, pt, historico } = await livre(l, ponto)
      if (dedo) await mover(pt)
      const { r: r2, pt: pt2 } = await livre(l, ponto)
      ev({ tipo: 'aponta', alvo: await descr(l), ret: r2, ponto: pt2, realce, dur: ms / 1000, checagem: historico, ...(dedo ? {} : { dedo: false }), ...(lupa ? { lupa, ...(margem ? { margem } : {}) } : {}) })
      if (!check) await p.waitForTimeout(ms)
      return r2
    },
    /** Vídeo de venda: marca uma prova que o produto acabou de dar (a resposta chegou, o estoque confirmou). Na
     *  composição a tela gira de leve, o brilho atravessa e entra um marcador grande com o rótulo e a conta
     *  ("✓ Estoque · 1 de 3"), com som. alvo: onde a prova está na tela (a câmera vai até ele, sem dedo). */
    async prova(rotulo, { alvo = null, ms = 900 } = {}) {
      if (!rotulo || typeof rotulo !== 'string') throw new Error('g.prova needs the marker label: g.prova(\'Stock\', { alvo })')
      if (rotulo.length > PROVA_MAX) regra(`g.prova("${rotulo}"): the marker label has at most ${PROVA_MAX} characters (it is read in under 1 s)`)
      let r = null
      if (alvo) { const l = loc(alvo); await visivel(l); r = (await livre(l, null)).r }
      ev({ tipo: 'prova', rotulo, ...(r ? { ret: r } : {}), dur: ms / 1000 })
      if (!check) await p.waitForTimeout(ms)
    },
    /** Vídeo de venda: o placar do que acabou de aparecer, em número que conta ("3 perguntas · 0 atendentes"). Os
     *  marcadores das provas se juntam nele, a câmera abre e o aparelho recua. Fica até o fim da gravação, que segura
     *  `ms`: o padrão já deixa o placar 2,5 s legível; um ms menor que isso é erro já no --check (o compor recusaria).
     *  itens: [{ valor: 3, rotulo: 'perguntas' }, …], até 2. */
    async placar(itens, { ms = null } = {}) {
      if (!Array.isArray(itens) || !itens.length || itens.length > 2 || itens.some((i) => !Number.isInteger(i?.valor) || i.valor < 0 || !i.rotulo)) throw new Error('g.placar needs 1 or 2 items { valor: integer ≥ 0, rotulo }: g.placar([{ valor: 3, rotulo: \'questions\' }, { valor: 0, rotulo: \'agents\' }])')
      if (eventos.some((e) => e.tipo === 'placar')) throw new Error('g.placar: a video has a single scoreboard, at the end')
      const minimo = msMinimoDoPlacar(itens)
      if (ms != null && !(ms >= minimo)) regra(`g.placar: with ms ${ms} the scoreboard stays readable for ${(ms / 1000 - TEMPO_PLACAR({ itens })).toFixed(2)} s, and the minimum is ${PLACAR_MIN} s (compor would refuse it). Use ms ≥ ${minimo}, or drop ms: the default already holds long enough.`)
      ev({ tipo: 'placar', itens: itens.map((i) => ({ valor: i.valor, rotulo: String(i.rotulo) })) })
      if (!check) await p.waitForTimeout(ms ?? minimo + 200)
    },
    /** O relance do estado anterior (vídeo de novidade: o antes curto, depois o agora), um por passo: a imagem (PNG/JPG)
     *  ou o clipe (MP4) da versão anterior, na mesma tela do aparelho gravado (o g.foto da jornada do antes tira), entra
     *  no lugar da tela gravada por `ms`, no mesmo enquadramento, com a etiqueta ANTES; no corte seco ela vira AGORA e a
     *  tela gravada volta. O áudio não muda: a fala do passo corre por cima. Chame no começo do passo, ou no instante em
     *  que a tela de agora mostra o mesmo lugar (depois de abrir o diálogo que mudou): o corte para o AGORA é a diferença.
     *  regiao: { x, y, w, h } em px do app (o que mostrar de perto: o que mudou); alvo: um locator da tela de agora no
     *  mesmo lugar (a câmera enquadra o retângulo dele); sem os dois, a câmera enquadra o alvo da próxima ação do passo.
     *  espera: false deixa a jornada seguir por baixo do relance (a troca de tela some debaixo dele). */
    async antes(arquivo, { ms = ANTES_MS.padrao, regiao = null, alvo = null, espera = true } = {}) {
      const ult = ultimoPasso()
      if (!ult) return regra('g.antes goes inside a step (after g.passo): it is the glimpse of the previous state of that step')
      if (typeof arquivo !== 'string' || !ANTES_EXT.test(arquivo)) return regra(`g.antes(${JSON.stringify(arquivo)}): pass the path of a PNG, JPG or MP4 of the previous version (relative to the video folder)`)
      if (!(ms >= ANTES_MS.min && ms <= ANTES_MS.max)) return regra(`g.antes: ms ${ms} outside ${ANTES_MS.min}–${ANTES_MS.max} (it is a glimpse; ${ANTES_MS.padrao} is a good start)`)
      if (regiao != null && !(['x', 'y', 'w', 'h'].every((k) => Number.isFinite(regiao[k])) && regiao.w > 0 && regiao.h > 0 && regiao.x >= 0 && regiao.y >= 0 && regiao.x + regiao.w <= W + 1 && regiao.y + regiao.h <= H + 1)) return regra(`g.antes: regiao ${JSON.stringify(regiao)} must be { x, y, w, h } in app px, inside the ${W}×${H} screen`)
      const abs = path.resolve(video.pasta, arquivo)
      if (!fs.existsSync(abs)) return regra(`g.antes: ${arquivo} not found in the video folder (the screen of the previous version, ${W}×${H} at any DSF: g.foto in the journey of the "before" takes it)`)
      let medida = null
      try { medida = execFileSync('ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height:format=duration', '-of', 'json', abs], { encoding: 'utf8' }) } catch { /* sem ffprobe: o compor confere */ }
      if (medida) {
        const j = JSON.parse(medida), st = (j.streams || [])[0] || {}
        if (!(st.width > 0) || Math.abs(st.width / st.height - W / H) > 0.01) return regra(`g.antes: ${arquivo} is ${st.width}×${st.height}, and the recording is ${W}×${H}. The "before" is the whole screen of the same device (any DSF).`)
        const d = Number(j.format && j.format.duration)
        if (ehClipe(abs) && d > 0 && d + 0.05 < ms / 1000) return regra(`g.antes: the clip ${arquivo} is ${d.toFixed(2)} s, shorter than ms ${ms}`)
      }
      if (eventos.some((e) => e.tipo === 'antes' && e.passo === ult.n)) return regra(`g.antes: step ${ult.n} already has a "before"`)
      let ret = regiao ? { x: r1(regiao.x), y: r1(regiao.y), w: r1(regiao.w), h: r1(regiao.h) } : null
      if (!ret && alvo) { const l = loc(alvo); await l.waitFor({ state: 'visible' }); ret = await caixa(l) }
      ev({ tipo: 'antes', passo: ult.n, arquivo: path.relative(video.pasta, abs), dur: ms / 1000, ...(ret ? { ret } : {}) })
      if (!check && espera) await p.waitForTimeout(ms)
    },
    /** A tela inteira de agora num PNG, no DSF do aparelho, em <video.fotos ou pasta do vídeo/antes>/<name>.png (no
     *  --check não tira). É a jornada do antes (o site na versão anterior) que usa: a imagem vira o g.antes do vídeo. */
    async foto(nome, { pasta = video.fotos || path.join(video.pasta, 'antes') } = {}) {
      if (!/^[\w.-]+$/.test(String(nome || ''))) throw new Error(`g.foto(${JSON.stringify(nome)}): a plain file name (letters, digits, - and _)`)
      if (check) return null
      fs.mkdirSync(pasta, { recursive: true })
      const arq = path.join(pasta, `${nome}.png`)
      await p.screenshot({ path: arq })
      return arq
    },
    /** Toca (celular) ou clica (computador) EXATAMENTE no ponto conferido.
     *  oculto: o toque de quem é atendido pelo produto (a mensagem do cliente, num vídeo de venda). Passa pela mesma
     *  checagem, mas a composição não desenha dedo, onda nem realce, não põe som e a câmera não vai até ele: na tela
     *  só aparece o que o toque causa. Não é para esconder a mão de quem opera o produto. */
    async toque(alvo, { ponto = null, depois = 700, realce = true, rapido = false, nativo = null, oculto = false } = {}) {
      const l = loc(alvo)
      await visivel(l)
      const c1 = await livre(l, ponto)
      if (!oculto) await mover(c1.pt, rapido)
      if (realce && !check && !rapido && !oculto) await p.waitForTimeout(260)
      // de novo no instante do toque: um aviso pode ter aparecido durante o movimento
      const { r, pt, historico } = await livre(l, ponto)
      if (!oculto && (pt[0] !== pos[0] || pt[1] !== pos[1])) await mover(pt, true)
      const nat = await l.evaluate((e) => window.__fv.nativo(e))
      ev({ tipo: 'toque', alvo: await descr(l), ret: r, ponto: pt, realce: realce && !oculto, checagem: [...c1.historico, ...historico], ...(nat ? { nativo: nat } : {}), ...(oculto ? { oculto: true } : {}) })
      if (!nativo) {
        if (ap.toque) await p.touchscreen.tap(pt[0], pt[1])
        else await p.mouse.click(pt[0], pt[1])
      }
      await p.waitForTimeout(check ? 120 : depois)
      return r
    },
    /** Digita num campo como uma pessoa. privado: o log não guarda o texto (senha, dado pessoal). */
    async digita(alvo, texto, { privado = null, atraso = 55, depois = 450, limpar = false } = {}) {
      const l = loc(alvo)
      await g.toque(l, { realce: false, depois: 200 })
      if (limpar) await l.fill('')
      const ehSenha = await l.evaluate((e) => e.type === 'password' || e.hasAttribute('data-privado') || e.hasAttribute('data-fv-borrar'))
      const ta = agora()
      await p.keyboard.type(texto, { delay: check ? 0 : atraso })
      const r = await caixa(l)
      ev({ tipo: 'digita', t: r3(ta), t1: r3(agora()), alvo: await descr(l), ret: r, texto: privado || ehSenha ? '•••' : texto, teclas: texto.length, privado: !!(privado || ehSenha) })
      await p.waitForTimeout(check ? 60 : depois)
    },
    /** Escolhe uma opção de um <select> nativo. A lista nativa não aparece na captura (o Chromium sem janela
     *  não desenha o popup): o campo passa pelas opções, uma a uma, com realce e legenda da escolha. */
    async escolhe(alvo, opcao, { passoAPasso = true, intervalo = 380 } = {}) {
      const l = loc(alvo)
      const tag = await l.evaluate((e) => e.tagName.toLowerCase())
      if (tag !== 'select') throw new Error(`escolhe() is for a native <select>; ${await descr(l)} is an app component: use g.toque() on the option in its list`)
      nativos.set('select', (nativos.get('select') || new Set()).add(await descr(l)))
      await g.toque(l, { depois: 150, nativo: 'select' })
      const { opcoes, atual, alvoIdx } = await l.evaluate((e, o) => {
        const ops = [...e.options].map((x) => x.label || x.text)
        const idx = ops.findIndex((t) => t.trim() === String(o).trim()) >= 0 ? ops.findIndex((t) => t.trim() === String(o).trim()) : [...e.options].findIndex((x) => x.value === o)
        return { opcoes: ops, atual: e.selectedIndex, alvoIdx: idx }
      }, opcao)
      if (alvoIdx < 0) throw new Error(`option "${opcao}" does not exist in ${await descr(l)}. Options: ${opcoes.join(' · ')}`)
      const ta = agora()
      await l.focus()
      const passo = alvoIdx > atual ? 1 : -1
      const idxs = passoAPasso && !check ? Array.from({ length: Math.abs(alvoIdx - atual) }, (_, k) => atual + passo * (k + 1)) : [alvoIdx]
      for (const i of idxs) {
        await l.evaluate((e, i) => { e.selectedIndex = i; e.dispatchEvent(new Event('input', { bubbles: true })); e.dispatchEvent(new Event('change', { bubbles: true })) }, i)
        if (!check) await p.waitForTimeout(intervalo)
      }
      await l.evaluate((e) => e.blur())
      ev({ tipo: 'escolhe', t: r3(ta), t1: r3(agora()), alvo: await descr(l), ret: await caixa(l), opcoes, escolhida: opcoes[alvoIdx] })
      if (!check) await p.waitForTimeout(500)
    },
    /** Campo de data/hora nativo: digita no próprio campo (o seletor de calendário não aparece na captura).
     *  Datas passam por dados.confere(): fim de semana e feriado são erro (a não ser { qualquerDia: true }). */
    async data(alvo, valor, { qualquerDia = false } = {}) {
      const l = loc(alvo)
      const tipo = await l.evaluate((e) => e.type)
      nativos.set(tipo, (nativos.get(tipo) || new Set()).add(await descr(l)))
      let iso = valor
      if (tipo === 'date') {
        iso = typeof valor === 'string' ? valor : dados.iso(valor)
        if (!qualquerDia) dados.confere(iso)
      }
      await g.toque(l, { depois: 150, nativo: tipo })
      await l.focus()
      const ta = agora()
      // pt-BR: dd mm aaaa; en-US: mm dd aaaa. A ordem vem do próprio campo, então digitamos pelo locale.
      const [y, m, d] = String(iso).split('-')
      const teclas = tipo === 'date' ? (/^en/.test(idioma) ? m + d + y : d + m + y) : tipo === 'time' ? String(valor).replace(':', '') : null
      // Digitando dígito a dígito, o campo passa por datas intermediárias válidas (dia 2, depois 29…) e
      // dispara input/change em cada uma. App que reage a cada troca (campo de várias datas, que vira um
      // chip por change) registra datas que ninguém escolheu. Então os eventos do campo ficam retidos
      // enquanto digita, e sai um só no fim, com o valor final.
      await l.evaluate((e) => {
        const reter = (x) => { if (x.target === e) x.stopImmediatePropagation() }
        e.__fvReter = reter
        window.addEventListener('input', reter, true); window.addEventListener('change', reter, true)
      })
      if (teclas) await p.keyboard.type(teclas, { delay: check ? 0 : 110 })
      const ok = await l.inputValue() === (tipo === 'date' ? iso : String(valor))
      await l.evaluate((e, disparar) => {
        window.removeEventListener('input', e.__fvReter, true); window.removeEventListener('change', e.__fvReter, true)
        if (disparar) { e.dispatchEvent(new Event('input', { bubbles: true })); e.dispatchEvent(new Event('change', { bubbles: true })) }
      }, ok)
      if (!ok) await l.fill(tipo === 'date' ? iso : String(valor))
      await l.evaluate((e) => e.blur())
      ev({ tipo: 'digita', t: r3(ta), t1: r3(agora()), alvo: await descr(l), ret: await caixa(l), texto: tipo === 'date' ? dados.curta(iso) : String(valor), teclas: (teclas || '').length, nativo: tipo })
      if (!check) await p.waitForTimeout(400)
      return iso
    },
    /** Anexo: toca no botão visível do app e entrega os arquivos ao seletor (que não aparece na captura). */
    async arquivo(botao, arquivos, { depois = 700 } = {}) {
      const l = loc(botao)
      // O botão é medido antes do toque: no app de verdade a tela costuma avançar assim que recebe o arquivo, e o
      // botão some (medir depois esperaria até estourar o prazo).
      const alvo = await descr(l), ret = await caixa(l)
      nativos.set('file', (nativos.get('file') || new Set()).add(alvo))
      const esperando = p.waitForEvent('filechooser')
      await g.toque(l, { depois: 0 })
      const fc = await esperando
      await fc.setFiles(arquivos)
      ev({ tipo: 'escolhe', t: r3(agora()), t1: r3(agora() + 0.8), alvo, ret, opcoes: [], escolhida: [].concat(arquivos).map((a) => path.basename(a)).join(', '), nativo: 'file' })
      await p.waitForTimeout(check ? 100 : depois)
    },
    /** Rola até o alvo (bloco: 'center' | 'start' | 'end') ou por dy px. */
    async rola(alvo, { bloco = 'center', dy = null } = {}) {
      const y0 = await p.evaluate(() => scrollY)
      const ta = agora()
      if (typeof alvo === 'number' || dy != null) await p.evaluate(([d, s]) => scrollBy({ top: d, behavior: s ? 'smooth' : 'auto' }), [dy != null ? dy : alvo, !check])
      else await loc(alvo).evaluate((e, [b, s]) => e.scrollIntoView({ behavior: s ? 'smooth' : 'auto', block: b }), [bloco, !check])
      let ant = null
      for (let i = 0; i < 40; i++) { await p.waitForTimeout(check ? 30 : 60); const y = await p.evaluate(() => scrollY); if (ant !== null && Math.abs(y - ant) < 0.5) break; ant = y }
      ev({ tipo: 'rola', t: r3(ta), t1: r3(agora()), dy: r1((await p.evaluate(() => scrollY)) - y0) })
    },
    /** Marca um momento de sucesso (som de sucesso e um pulso de câmera na composição). */
    async sucesso(alvo, { ms = 900 } = {}) {
      const r = alvo ? await caixa(loc(alvo)) : null
      ev({ tipo: 'sucesso', ...(r ? { ret: r } : {}) })
      if (!check) await p.waitForTimeout(ms)
    },
  }

  // ---------- roteiro ----------
  let falha = null
  try {
    await video.roteiro(g)
    const ult = ultimoPasso()
    const falaFim = voz && ult && voz.passos.get(ult.n)
    if (ult && !check) { const falta = ult.t + (falaFim ? Math.max(leituraMin + 0.6, LV.esperaDoPasso(falaFim, 0)) : leituraMin + 0.6) - agora(); if (falta > 0) await p.waitForTimeout(falta * 1000) }
    if (voz) {
      const np = eventos.filter((e) => e.tipo === 'passo').length
      const sobra = [...voz.passos.keys()].filter((n) => n > np)
      if (sobra.length) throw new Error(`the voiceover has a line for step ${sobra.join(', ')}, but the script only has ${np} step(s): the line would have nowhere to go`)
    }
  } catch (e) { falha = e }
  const fim = r3(agora())
  capturando = false
  if (cdp && captura === 'screencast') await cdp.send('Page.stopScreencast').catch(() => {})
  if (laco) await laco
  fs.mkdirSync(saida, { recursive: true })
  if (falha) {
    await p.screenshot({ path: path.join(saida, 'failure.png') }).catch(() => {})
    if (falha.cobre && falha.cobre.ret) {
      // marca na imagem da falha quem cobre (vermelho) e o alvo (azul)
      await p.evaluate(({ a, b }) => {
        for (const [r, c] of [[a, '#E4572E'], [b, '#2F6FEB']]) { if (!r) continue; const d = document.createElement('div'); Object.assign(d.style, { position: 'fixed', left: r.x - 3 + 'px', top: r.y - 3 + 'px', width: r.w + 6 + 'px', height: r.h + 6 + 'px', border: `3px solid ${c}`, borderRadius: '8px', zIndex: 2147483647, pointerEvents: 'none' }); document.body.appendChild(d) }
      }, { a: falha.cobre.retQuem, b: falha.cobre.ret }).catch(() => {})
      await p.screenshot({ path: path.join(saida, 'failure.png') }).catch(() => {})
    }
  }
  await p.screenshot({ path: path.join(saida, 'referencia.png') }).catch(() => {})
  await ctx.close()
  await browser.close()

  const listaNativos = [...nativos].map(([k, s]) => `${k}: ${[...s].join(', ')}`)
  if (falha) {
    const ult = ultimoPasso()
    console.log(`✗ ${video.id} (${v}) ${check ? 'failed the check' : 'did not record'}${ult ? ` at step ${ult.n} "${ult.legenda}"` : ''}:\n    ${falha.message.split('\n')[0]}\n    image: ${path.join(saida, 'failure.png')}`)
    fs.writeFileSync(path.join(saida, check ? 'check.json' : 'falha.json'), JSON.stringify({ ok: false, erro: falha.message.split('\n')[0], passo: ult || null, eventos }, null, 2))
    return { versao: v, ok: false, erro: falha.message.split('\n')[0] }
  }
  // tempo de cada quadro do screencast no relógio daqui
  if (brutos.length) for (const [nome, ts] of brutos) quadros.push([nome, r3(ts + offset - t0)])
  quadros.sort((a, b) => a[1] - b[1])
  const toques = eventos.filter((e) => e.tipo === 'toque')
  const esperas = eventos.filter((e) => e.tipo === 'espera' && /^notice /.test(e.motivo || ''))
  const rolagens = eventos.filter((e) => e.tipo === 'rola' && e.motivo)
  const resumo = `${toques.length} taps checked` + (esperas.length ? `, ${esperas.length} wait(s) for a notice` : '') + (rolagens.length ? `, ${rolagens.length} scroll(s) to free a target` : '') + (voz ? `, voice: ${voz.falas.length} lines (${voz.rel})` : '')
  if (check) {
    const semFala = voz ? eventos.filter((e) => e.tipo === 'passo' && !voz.passos.get(e.n)).map((e) => e.n) : []
    if (semFala.length) console.log(`  warning: step ${semFala.join(', ')} has no voice line: the caption keeps the g.passo text, and the voice goes quiet there (the refine fails long silence)`)
    if (eventos.some((e) => e.tipo === 'antes') && comp && !comp.vis && !regras.some((r) => /versao/.test(r))) regras.push('g.antes needs the series design ("versao": 2 in series.json)')
    if (regras.length) {
      fs.writeFileSync(path.join(saida, 'check.json'), JSON.stringify({ ok: false, regras, nativos: listaNativos, eventos }, null, 2))
      console.log(`✗ ${video.id} (${v}) the journey runs (${resumo}), but compor would refuse it — ${regras.length} problem(s), each with what to change:`)
      for (const r of regras) console.log(`    · ${r}`)
      process.exitCode = 1
      return { versao: v, ok: false, erro: regras[0] }
    }
    fs.writeFileSync(path.join(saida, 'check.json'), JSON.stringify({ ok: true, nativos: listaNativos, eventos }, null, 2))
    console.log(`✓ ${video.id} (${v}) ok · ${resumo}${voz && voz.soTexto ? ' · from the script text (generate the voice and record)' : ''} · compor rules ok`)
    for (const e of [...esperas, ...rolagens]) console.log(`    ${e.tipo === 'espera' ? 'waited for' : 'scrolled ' + Math.round(e.dy) + ' px to'} ${e.motivo}`)
  } else {
    const [qw, qh] = [Math.round(W * ap.dsf), Math.round(H * ap.dsf)]
    const qps = quadros.length / fim
    // o screencast só manda quadro quando a tela muda: a média engana. O que importa é a taxa nos trechos
    // com movimento — o pico numa janela de 1 s.
    let pico = 0
    for (let i = 0, j = 0; i < quadros.length; i++) { while (quadros[i][1] - quadros[j][1] > 1) j++; pico = Math.max(pico, i - j + 1) }
    const log = {
      id: video.id, titulo: video.titulo, versao: v,
      aparelho: { nome: ap.nome, viewport: ap.viewport, dsf: ap.dsf, toque: !!ap.toque, formato: ap.formato },
      captura: { metodo: captura, qps: r1(qps), qpsPico: pico, largura: qw, altura: qh, quadros: 'frames.json' },
      duracao: fim, gravadoEm: new Date().toISOString(), nativos: listaNativos, errosDaPagina: errosPagina,
      ...(voz ? { voz: { locucao: voz.rel, sha256: voz.sha256, perfil: voz.perfil } } : {}), eventos,
    }
    fs.writeFileSync(path.join(saida, 'frames.json'), JSON.stringify(quadros))
    fs.writeFileSync(path.join(saida, 'events.json'), JSON.stringify(log, null, 2))
    console.log(`✓ ${video.id} (${v}) recorded: ${fim.toFixed(1)} s, ${quadros.length} frames (peak ${pico} fps in motion, ${captura}, ${qw}×${qh}) · ${resumo}`)
    if (errosPagina.length) console.log('  page errors:', errosPagina.join(' | '))
    if (voz) for (const s of LV.silencios(eventos, voz.passos, fim)) {
      const quanto = `${s.seg.toFixed(1)} s without voice after the line`
      console.log(s.toques
        ? `  warning: step ${s.n}: ${quanto} (${s.toques} tap${s.toques > 1 ? 's' : ''}). Use g.passo('…', { junto: true }) and g.na('word') before each tap, or split it into steps with one line each.`
        : `  warning: step ${s.n}: ${quanto}, no tap. Shorten the wait or the pause, or put a line in that stretch.`)
    }
    try {
      const { folhaToques } = await import('./sheet.mjs')
      const f = await folhaToques(saida, pw)
      console.log(`  tap contact sheet: ${f}  ← LOOK at it before composing`)
    } catch (e) { console.log('  (contact sheet failed: ' + e.message.split('\n')[0] + ')') }
  }
  if (listaNativos.length) console.log(`  native controls (they do not show open in the capture): ${listaNativos.join(' · ')}`)
  return { versao: v, ok: true, fim, eventos: eventos.length }
}
