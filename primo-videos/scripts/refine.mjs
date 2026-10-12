#!/usr/bin/env node
// O refino automático: tudo o que a gente pegava à mão antes de mostrar um vídeo, numa porta só.
//   node refine.mjs <pasta do vídeo | vídeo.mp4> [--format 9x16] [--product Nome] [--video out/x.mp4]
//                    [--narration voice/v1/narration.json] [--project <folder>] [--platform tiktok] [--check-only]
//                    [--out <folder>] [--no-ocr] [--no-pages] [--no-direction] [--rule chave=valor]…
//                    [--channel whatsapp|reels|feed|site|big-screen] [--player <largura em px>]
//   node refine.mjs gabarito <Produto> --from <video folder> [--video <mp4>] [--approved] [--narration …]
//                    [--fonts "A,B"] [--extra-fonts "C"] [--synthetic "A:italico"] [--platform tiktok]
//                    [--rule parado_max=0.6] [--title …] [--style <id>]
// Sai em <output> (padrão: <folder>/refine/ ou <vídeo>.refine/): refine.json, refine.md e frames/ com o problema
// marcado. Código 1 = reprovou (o refine.md diz o que fazer em cada item); 2 = não deu para rodar.
// Na pasta do vídeo, sem --check-only, ele CORRIGE o que é automático: o alinhamento da locução pelas pausas reais e o
// silêncio sobrando no fim de cada fala (guarda o original). Depois disso: tempos.mjs, render das cenas, refinar de novo.
// A direção (refine/direction.mjs) dá a nota forte/ok/fraco de quem assiste: só avisa, nunca reprova.
// --channel (onde o vídeo passa) ou --player (a largura do player em px; vence o --channel) liga a leitura no player: cada
// linha medida no tamanho em que fica depois de o player encolher o vídeo (whatsapp e reels = 390, feed = 854, site e
// big-screen = sem redução). Abaixo de 16 px no player reprova.
// As checagens e os limiares estão em references/refine.md.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { lerGabarito, salvarGabarito, lerVideoJs, REGRAS } from './refine/profile.mjs'

const NOMES = {
  legibilidade: 'Legibility (OCR)', player: 'Player readability', fonte: 'Font and logo', palavra: 'Animation on the word', alinhamento: 'Voice alignment',
  'voz-apagada': 'Flat voice', parado: 'Still frame', vazio: 'Empty frame', 'area-segura': 'Safe area', 'silencio-fim': 'Leftover silence',
}
const ORDEM = Object.keys(NOMES)
// status, nota e sinal da direção ficam em português no refine.json (valores lidos por código); impressos, em inglês
const STATUS = { reprovou: 'failed', aviso: 'warning', 'não rodou': 'did not run', passou: 'passed' }
const NOTA = { forte: 'strong', ok: 'ok', fraco: 'weak' }
const SINAL = { gancho: 'hook', monotonia: 'monotony', momentos: 'moments', fecho: 'closing' }
const r2 = (v) => (v == null ? '' : v.toFixed(2))
const relogio = (t) => (t == null ? '' : `${Math.floor(t / 60)}:${(t % 60).toFixed(2).padStart(5, '0')}`)
// Ponto de extensão opcional: sem scripts/app/canal.mjs no pacote, nada é avisado para fora.
const CANAL = new URL('./app/canal.mjs', import.meta.url)
const canalDoApp = async () => (fs.existsSync(CANAL) ? import(CANAL.href) : null)

export function acharVideo(projeto, formato, unico) {
  const out = path.join(projeto, 'out')
  // o tutorial (compose.mjs) deixa o vídeo na raiz da pasta, <id>-<device>[-draft].mp4, sem out/: vale o mais novo
  if (!fs.existsSync(out)) {
    if (!fs.existsSync(path.join(projeto, 'video.mjs'))) return null
    const raiz = fs.readdirSync(projeto).filter((n) => n.endsWith('.mp4')).map((n) => ({ n, m: fs.statSync(path.join(projeto, n)).mtimeMs })).sort((a, b) => b.m - a.m)
    return raiz.length ? path.join(projeto, raiz[0].n) : null
  }
  const peso = (n) => (/final/.test(n) ? 4 : /previa|com-voz/.test(n) ? 3 : /montado/.test(n) ? 2 : 1)
  const mp4s = fs.readdirSync(out).filter((n) => n.endsWith('.mp4') && !/sem-audio/.test(n))
    .filter((n) => n.includes(formato) || (unico && !/\d+x\d+/.test(n)))
    .map((n) => ({ n, p: peso(n), m: fs.statSync(path.join(out, n)).mtimeMs }))
    .sort((a, b) => b.p - a.p || b.m - a.m)
  return mp4s.length ? path.join(out, mp4s[0].n) : null
}

// A narração (a locução, o alinhamento, a voz apagada, a palavra) só vem nos pacotes com voz: sem
// scripts/refine/locucao.mjs, o vídeo não tem locução e essas checagens ficam de fora.
const LOCUCAO = new URL('./refine/locucao.mjs', import.meta.url)
const narracao = async () => (fs.existsSync(LOCUCAO) ? import(LOCUCAO.href) : null)
const SEM_NARRACAO = 'this copy of the skill has no voice module (scripts/refine/locucao.mjs is missing): reinstall the skill.'

const plataformaDe = (p, formato) => (p && typeof p === 'object' ? p[formato] ?? null : p ?? null)

async function opcional(nome, carregar) {
  try { return await carregar() } catch (e) {
    if (e.code === 'ERR_MODULE_NOT_FOUND') return { pulou: `${nome} is not installed in this skill` }
    if (e.code === 'SEM_PLAYWRIGHT' || e.code === 'SEM_CHROMIUM') return { pulou: e.message.split('\n')[0] }
    throw e
  }
}

// Tutorial com cinema: até o fim da abertura (A) o quadro é o título e o celular 3D desfocado com a tela de sucesso.
// Lê o A e o cinema do data.js que o compor gerou para a versão do MP4 (<id>-<device>[-draft].mp4). 0 se não achar.
// A obra do molde explicação desenhada (<output>/.work-<name>/: um canvas, sem video.js). O render.mjs dela escreve o
// out/assembly.json (as cenas e as falas no tempo do vídeo) e, com voz, a voice/obra/narration.json (os trechos de cada
// cena); o MP4 com som fica na pasta de cima, <name>-<format>[-draft].mp4. A checagem das páginas (o DOM) não
// enxerga o canvas: o texto e a área segura de cada formato o renderizar já checou, e o MP4 o refino mede.
export function obraDesenhada(projeto) {
  if (!projeto || !fs.existsSync(path.join(projeto, 'engine', 'runtime.js'))) return null
  const arq = path.join(projeto, 'out', 'assembly.json')
  const m = fs.existsSync(arq) ? JSON.parse(fs.readFileSync(arq, 'utf8')) : null
  if (!m || m.molde !== 'drawn-explainer') return null
  let plataforma = null
  try { plataforma = JSON.parse(fs.readFileSync(path.join(projeto, 'params.js'), 'utf8').replace(/^[\s\S]*?export default /, '')).plataforma ?? null } catch { /* sem params.js: sem plataforma */ }
  return { nome: m.nome, formatos: m.formatos || [], plataforma }
}

/** O MP4 com som da obra: o mais novo entre o final e o draft, na pasta de cima. */
export function videoDaObra(projeto, nome, formato) {
  const achados = [`${nome}-${formato}.mp4`, `${nome}-${formato}-draft.mp4`].map((n) => path.join(path.dirname(projeto), n)).filter((a) => fs.existsSync(a))
  return achados.sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs)[0] || null
}

export function aberturaDecorativa(projeto, mp4) {
  if (!projeto) return 0
  // (o compor põe o formato no nome quando ele vem do --format: <id>-<device>-16x9-draft.mp4)
  const base = path.basename(mp4).replace(/\.[^.]+$/, '').replace(/-draft$/, '').replace(/-(16x9|19x9|21x9|9x16|4x5|1x1)$/, '')
  let versoes = []
  try { versoes = fs.readdirSync(path.join(projeto, 'output')) } catch { return 0 }
  const v = versoes.filter((x) => base.endsWith('-' + x)).sort((a, b) => b.length - a.length)[0]
  if (!v) return 0
  try {
    const d = fs.readFileSync(path.join(projeto, 'output', v, 'comp', 'data.js'), 'utf8')
    const A = Number((d.match(/"A":([0-9.]+)/) || [])[1]), cinema = (d.match(/"cinema":"([a-z]+)"/) || [])[1]
    return cinema === 'moldura' && A > 0 ? A : 0
  } catch { return 0 }
}

// A largura do player em cada canal (os mesmos nomes do recommend-style.mjs). null = o vídeo toca no tamanho cheio.
export const PLAYERS = { whatsapp: 390, reels: 390, feed: 854, site: null, 'big-screen': null }

/** --player vence o --channel. Devolve { largura (null = sem redução), origem, canal } ou null (nenhum dos dois). */
export function resolverPlayer({ player, canal } = {}) {
  if (canal != null && !Object.hasOwn(PLAYERS, canal)) throw new Error(`--channel "${canal}" does not exist: use whatsapp, reels, feed, site or big-screen`)
  if (player != null) {
    const n = Number(player)
    if (!(n > 0)) throw new Error(`--player is the player width in px, a number greater than zero (got "${player}")`)
    return { largura: Math.round(n), origem: `--player ${Math.round(n)}${canal ? ` (overrides --channel ${canal})` : ''}`, canal: canal ?? null }
  }
  if (canal != null) return { largura: PLAYERS[canal], origem: `--channel ${canal}`, canal }
  return null
}

const descreverPlayer = (p) => (!p ? 'not measured (pass --channel or --player)' : p.largura ? `${p.largura} px (${p.origem})` : `no reduction (${p.origem}: the video plays at full size)`)

export async function refinar(alvo, o = {}) {
  const ehMp4 = /\.(mp4|mov|m4v)$/i.test(alvo)
  const projeto = ehMp4 ? (o.projeto ? path.resolve(o.projeto) : null) : path.resolve(alvo)
  const gab = o.produto ? lerGabarito(o.produto) : null
  // --rule na rodada vale só para ela (por cima do gabarito): a exceção de um vídeo, sem mexer na régua do produto
  const regras = { ...REGRAS, ...(gab?.regras || {}), ...(o.regras || {}) }
  const obra = obraDesenhada(projeto)
  const vj = obra ? { fontes: [], plataforma: obra.plataforma, formatos: obra.formatos } : projeto ? lerVideoJs(projeto) : { fontes: [], plataforma: null, formatos: [] }
  const formatos = o.formato ? [o.formato] : vj.formatos.length ? vj.formatos : [null]
  const saida = path.resolve(o.saida || (ehMp4 ? alvo.replace(/\.[^.]+$/, '.refine') : path.join(projeto, 'refine')))
  const quadros = path.join(saida, 'frames')
  fs.rmSync(quadros, { recursive: true, force: true })
  fs.mkdirSync(quadros, { recursive: true })
  const achados = [], medidas = {}, rodou = {}, correcoes = []
  const marca = (checagens, oque) => { for (const c of checagens) rodou[c] = rodou[c] ?? oque }
  const N = await narracao()
  if (o.locucao && !N) throw new Error(`--narration: ${SEM_NARRACAO}`)

  // 1 · a voz: alinhamento pelas pausas, silêncio do fim, voz apagada
  const montagemArq = projeto && path.join(projeto, 'out', 'assembly.json')
  const montagem = montagemArq && fs.existsSync(montagemArq) ? JSON.parse(fs.readFileSync(montagemArq, 'utf8')) : null
  const locArq = o.locucao ? path.resolve(projeto || '.', o.locucao) : projeto && N ? N.locucaoDo(projeto, null) : null
  let falas = null
  if (locArq) {
    const plat = plataformaDe(o.plataforma || vj.plataforma || gab?.plataforma, formatos[0] || '9x16')
    const rot = path.join(path.dirname(locArq), 'script.json')
    const perfil = fs.existsSync(rot) ? JSON.parse(fs.readFileSync(rot, 'utf8')).perfil : ['reels', 'tiktok', 'shorts'].includes(plat) ? 'reels' : null
    const r = N.refinarLocucao(locArq, { corrigir: !o.soChecar && !ehMp4 && !obra, referencia: gab?.voz || null, perfil })   // na obra a locução é cópia: corrige-se a original
    achados.push(...r.achados.map((a) => ({ ...a, tVideo: falaNoVideo(montagem, a.fala) })))
    medidas.voz = { locucao: locArq, ...r.medidas, mudancas: r.mudancas }
    if (!o.soChecar && !ehMp4 && (r.mudancas.length || r.sobras.length)) correcoes.push(`${path.relative(projeto, locArq)}: ${r.mudancas.length} word time(s) fixed by the voice, ${r.sobras.length} line(s) trimmed; the original stays in narration.before-refine.json`)
    falas = r.falas
    marca(['alinhamento', 'silencio-fim'], 'ok')
    marca(['voz-apagada'], r.medidas.referencia ? 'ok' : `no baseline: the product has no reference profile and the narration profile is not reels`)
  } else marca(['alinhamento', 'voz-apagada'], !N || projeto ? 'video without voiceover' : 'MP4 only: pass --project <folder> to measure the voice')

  // 2 · as cenas: cada em() na palavra exata que soa, e a cena que não sobra
  if (projeto && falas) {
    const { checarCenas } = await import('./refine/cenas.mjs')
    const r = checarCenas(projeto, falas, { montagem, respiroMax: regras.respiro_max, fechoRespiroMax: regras.fecho_respiro_max })
    achados.push(...r.achados)
    medidas.cenas = r.medidas
    marca(['palavra'], r.medidas.cenas.length ? 'ok' : 'no scenes with tempos.js')
    if (r.medidas.cenas.length) marca(['silencio-fim'], 'ok')
  } else marca(['palavra'], falas ? 'no scenes' : 'video without voiceover')

  // 3 · no Chromium: a fonte computada de cada texto contra o kit, e as caixas do DOM contra a interface da plataforma
  if (obra) marca(['fonte'], 'the drawn-explainer build is a canvas: its render.mjs already checked the text in each format')
  else if (projeto && !o.semPaginas && (fs.existsSync(path.join(projeto, 'scenes')) || fs.existsSync(path.join(projeto, 'index.html')))) {
    const r = await opcional('scripts/refine/page.mjs', async () => (await import('./refine/page.mjs')).checarPaginas(projeto, {
      formatos: formatos[0] ? formatos : undefined, plataforma: o.plataforma || undefined, saidaQuadros: quadros,
      fontesKit: o.fontes || (gab?.marca?.fontes ? [...gab.marca.fontes, ...(gab.marca.fontes_extras || [])] : undefined), sinteticoOk: gab?.marca?.sintetico_ok || [],
    }))
    if (r.pulou) marca(['fonte', 'area-segura'], `did not run: ${r.pulou}`)
    else {
      achados.push(...r.achados.map((a) => ({ ...a, origem: 'página', tVideo: a.cena && montagem ? cenaNoVideo(montagem, a.cena, a.t) : null })))
      medidas.paginas = r.medidas
      marca(['fonte', 'area-segura'], 'ok')
    }
  } else marca(['fonte'], o.semPaginas ? 'skipped (--no-pages)' : 'MP4 only: pass --project <folder> to check the fonts in the render')

  // 4 · o MP4: legibilidade, leitura no player, quadro parado, quadro vazio, área segura do que aparece
  const player = o.player || null
  if (!player) marca(['player'], 'no --channel or --player: the text was not measured at the player size')
  else if (!player.largura) marca(['player'], `${player.origem}: the video plays at full size, no reduction`)
  const videos = []
  for (const f of formatos) {
    const mp4 = ehMp4 ? path.resolve(alvo) : o.video ? path.resolve(projeto, o.video) : obra ? videoDaObra(projeto, obra.nome, f) : acharVideo(projeto, f, formatos.length === 1)
    if (!mp4) { achados.push({ checagem: 'vazio', nivel: 'aviso', msg: `could not find the MP4${f ? ` for ${f}` : ''} in out/`, oque_fazer: 'render it (a draft is fine) or pass --video' }); continue }
    videos.push(mp4)
    const plat = plataformaDe(o.plataforma || vj.plataforma || gab?.plataforma, f || '9x16')
    const r = await opcional('scripts/refine/video.mjs', async () => (await import('./refine/video.mjs')).checarVideo(mp4, {
      formato: f || undefined, plataforma: plat, paradoMax: regras.parado_max, finalParadoMin: regras.final_parado_min,
      legibilidade: { minimoPx: regras.texto_min_px, ilegivelPx: regras.texto_ilegivel_px, excecoes: regras.texto_excecoes, pular: !!o.semOcr, decoracaoAte: aberturaDecorativa(projeto, mp4) },
      player: player?.largura || null, saidaQuadros: quadros,
    }))
    if (r.pulou) { marca(['legibilidade', 'player', 'parado', 'vazio'], `did not run: ${r.pulou}`); continue }
    achados.push(...r.achados.map((a) => ({ ...a, origem: 'vídeo', video: path.basename(mp4), tVideo: a.t })))
    ;(medidas.videos ||= []).push({ video: mp4, ...r.medidas })
    marca(['legibilidade', 'parado', 'vazio', 'area-segura'], o.semOcr ? 'ok (no OCR: --no-ocr)' : 'ok')
    if (player?.largura) marca(['player'], typeof r.medidas.player === 'object' ? 'ok' : r.medidas.player || 'did not run')
  }

  // 5 · a direção: o vídeo está sem graça? Fica fora dos achados: não conta aviso nem reprova
  let direcao = null
  if (!o.semDirecao) {
    direcao = []
    for (const mp4 of videos) {
      try {
        const r = await opcional('scripts/refine/direction.mjs', async () => {
          const d = await import('./refine/direction.mjs'), c = await d.criticarDirecao(mp4)
          return { ...c, resumo: d.resumoDirecao(c.medidas) }
        })
        direcao.push({ video: mp4, ...r })
      } catch (e) { direcao.push({ video: mp4, pulou: e.message.split('\n')[0] }) }
    }
  }

  const erros = achados.filter((a) => a.nivel === 'erro').length, avisos = achados.filter((a) => a.nivel === 'aviso').length
  const checagens = Object.fromEntries(ORDEM.map((c) => {
    const os = achados.filter((a) => a.checagem === c)
    const e = os.filter((a) => a.nivel === 'erro').length, v = os.filter((a) => a.nivel === 'aviso').length
    return [c, { nome: NOMES[c], status: e ? 'reprovou' : v ? 'aviso' : rodou[c] && !/^ok/.test(rodou[c]) ? 'não rodou' : rodou[c] ? 'passou' : 'não rodou', erros: e, avisos: v, nota: rodou[c] && !/^ok$/.test(rodou[c]) ? rodou[c] : null }]
  }))
  const relatorio = {
    versao: 1, quando: new Date().toISOString(), alvo: path.resolve(alvo), projeto, videos, formatos: formatos.filter(Boolean),
    produto: o.produto || null, gabarito: gab ? path.join(gab.pasta, 'profile.json') : null, player, aprovado: erros === 0, erros, avisos,
    checagens, correcoes, achados: achados.sort((a, b) => (a.nivel === b.nivel ? (a.tVideo ?? 1e9) - (b.tVideo ?? 1e9) : a.nivel === 'erro' ? -1 : 1)), medidas, direcao,
  }
  fs.writeFileSync(path.join(saida, 'refine.json'), JSON.stringify(relatorio, null, 1) + '\n')
  fs.writeFileSync(path.join(saida, 'refine.md'), markdown(relatorio, saida))
  return { relatorio, saida }
}

function falaNoVideo(montagem, id) {
  const f = montagem?.falas?.find((x) => x.id === id)
  return f ? f.som : null
}
function cenaNoVideo(montagem, cena, t) {
  const c = montagem?.cenas?.find((x) => x.nome === cena)
  return c && t != null ? Math.round((c.ini + t) * 1000) / 1000 : null
}

const notaDirecao = (d) => (d.pulou ? `did not run (${d.pulou})` : `${NOTA[d.nota] ?? d.nota}${d.medidas.sinais.length ? ` (${d.medidas.sinais.map((s) => SINAL[s] ?? s).join(', ')})` : ''}`)

/** O player de cada vídeo medido, numa linha: quanto a letra precisa ter e quantos quadros com texto reprovaram. */
export function resumoDoPlayer(r) {
  const linhas = [`player: ${descreverPlayer(r.player)}`]
  for (const v of r.medidas?.videos || []) {
    const p = v.player
    if (!p || typeof p !== 'object') continue
    linhas.push(`${path.basename(v.video)} (${v.formato.replace('x', ':')}, ${p.larguraVideo} wide): a line needs ≥ ${p.precisa_px} px in the video to reach 16 px in the player; ${p.quadrosReprovados} of ${p.quadrosComTexto} frames with text fall below${p.faca9x16 ? '. This 16:9 on an upright phone is unreadable: make the 9:16' : ''}`)
  }
  return linhas
}

// Para o app: o resultado numa linha (o título da prévia do refine.md) e o problema principal, quando há.
export function paraODono(r) {
  const notas = (r.direcao || []).filter((d) => !d.pulou).map((d) => d.nota)
  const direcao = ['fraco', 'ok', 'forte'].find((n) => notas.includes(n))
  const nome = path.basename(r.videos.length === 1 ? r.videos[0] : r.alvo)
  const erro = r.achados.find((a) => a.nivel === 'erro')
  const fraco = (r.direcao || []).find((d) => d.nota === 'fraco')
  const frase = erro ? `refine failed for ${nome}: ${erro.tVideo != null ? `${relogio(erro.tVideo)} ` : ''}${erro.msg}`
    : fraco ? `weak direction in ${nome}: ${fraco.achados?.[0]?.msg ?? 'the video is dull'}`
      : `refine passed${direcao ? `, direction ${NOTA[direcao]}` : ''}: ${nome}`
  return { titulo: `Refine: ${r.aprovado ? 'PASSED' : 'FAILED'}${direcao ? ` · Direction: ${NOTA[direcao]}` : ''} — ${nome}`, frase }
}

export function markdown(r, saida) {
  const rel = (p) => (p ? path.relative(saida, p) : '')
  const dir = r.direcao || []
  const linhas = [`# Refine · ${path.basename(r.alvo)}`, '',
    r.aprovado ? `**Passed** (${r.avisos} warning${r.avisos === 1 ? '' : 's'}).` : `**Failed:** ${r.erros} error${r.erros === 1 ? '' : 's'} and ${r.avisos} warning${r.avisos === 1 ? '' : 's'}. Fix the errors and run it again.`, '',
    ...dir.map((d) => `**DIRECTION: ${notaDirecao(d)}**${dir.length > 1 ? ` · ${path.basename(d.video)}` : ''}${d.nota === 'fraco' ? ': the video is dull. Change what the Direction section points out and run it again, or show it and say why it stayed this way.' : ''}`), dir.length ? '' : null,
    `- Video: ${r.videos.map((v) => `\`${v}\``).join(', ') || 'none'}`, r.projeto ? `- Project: \`${r.projeto}\`` : null,
    `- Reference profile: ${r.gabarito ? `\`${r.gabarito}\`` : r.produto ? `none saved for "${r.produto}" (save one with \`refine.mjs profile\`)` : 'none (pass --product)'}`,
    ...resumoDoPlayer(r).map((l, i) => (i ? `  - ${l}` : `- ${l[0].toUpperCase()}${l.slice(1)}`)), '',
    '| Check | Result | Errors | Warnings | Note |', '|---|---|---|---|---|',
    ...Object.values(r.checagens).map((c) => `| ${c.nome} | ${STATUS[c.status] ?? c.status} | ${c.erros} | ${c.avisos} | ${c.nota || ''} |`), '']
  if (r.correcoes.length) linhas.push('## Fixed automatically', '', ...r.correcoes.map((c) => `- ${c}`), '', 'Now: `node $SKILL/scripts/chapters/tempos.mjs <folder> --narration …`, render the scenes and run the refine again.', '')
  for (const nivel of ['erro', 'aviso']) {
    const os = r.achados.filter((a) => a.nivel === nivel)
    if (!os.length) continue
    linhas.push(`## ${nivel === 'erro' ? 'Errors' : 'Warnings'}`, '')
    for (const a of os) {
      const onde = [a.tVideo != null ? `${relogio(a.tVideo)}${a.fim != null && a.origem === 'vídeo' ? `–${relogio(a.fim)}` : ''}` : null, a.cena ? `scene ${a.cena}${a.t != null && a.origem !== 'vídeo' ? ` (${r2(a.t)} s)` : ''}` : null, a.fala ? `line ${a.fala}` : null].filter(Boolean).join(' · ')
      linhas.push(`- **${NOMES[a.checagem] || a.checagem}**${onde ? ` · ${onde}` : ''}: ${a.msg}.${a.oque_fazer ? ` → ${a.oque_fazer}.` : ''}${a.quadro ? ` [frame](${rel(a.quadro)})` : ''}`.replace(/\.\./g, '.'))
    }
    linhas.push('')
  }
  if (dir.length) {
    linhas.push('## Direction', '', 'Never fails the video: it says whether the video holds attention (references/refine.md, "Direction"). 0 signals = strong, 1 = ok, 2 or more = weak.', '')
    for (const d of dir) {
      linhas.push(`### ${notaDirecao(d)} · \`${path.basename(d.video)}\``, '')
      if (d.pulou) continue
      linhas.push(...d.resumo.map((l) => `- ${l}`), '')
      for (const a of d.achados) linhas.push(`- **${SINAL[a.sinal] ?? a.sinal}**${a.t != null ? ` · ${relogio(a.t)}–${relogio(a.fim)}` : ''}: ${a.msg}. → ${a.oQueFazer}.`)
      if (d.achados.length) linhas.push('')
    }
  }
  linhas.push('## What the refine does not judge', '', '- Whether the voice fits the brand, the intonation of questions, breaths or clicks: by ear.',
    '- Whether the soundtrack works under the voice: by ear.', '- The taste of the motion and the composition: look at the contact sheet (the direction measures whether there is motion, change and strong moments, not whether they look good).', '')
  return linhas.filter((l) => l !== null).join('\n')
}

/** --rule chave=valor (repetível): número, ou a lista de `texto_excecoes` separada por |. */
export function lerRegras(lista = []) {
  return Object.fromEntries(lista.map((r) => { const i = r.indexOf('='); const k = r.slice(0, i), v = r.slice(i + 1); return [k, k === 'texto_excecoes' ? v.split('|') : +v] }))
}

async function principal(argv) {
  const a = { _: [] }
  const SEM = new Set(['check-only', 'no-ocr', 'no-pages', 'no-direction', 'approved'])
  for (let i = 0; i < argv.length; i++) {
    const s = argv[i]
    if (!s.startsWith('--')) { a._.push(s); continue }
    const k = s.slice(2)
    if (SEM.has(k)) { a[k] = true; continue }
    if (argv[i + 1] == null) { console.error(`--${k} needs a value`); return 2 }
    if (k === 'rule') (a.rule ||= []).push(argv[++i]); else a[k] = argv[++i]
  }
  let player
  try { player = resolverPlayer({ player: a.player, canal: a.channel }) } catch (e) { console.error(e.message); return 2 }
  if (a._[0] === 'profile') {
    const produto = a._[1]
    if (!produto || !a.from) { console.error('usage: node refine.mjs profile <Product> --from <video folder> [--video <mp4>] [--approved] [--narration voice/v1/narration.json]'); return 2 }
    const de = path.resolve(a.from)
    const regras = lerRegras(a.rule)
    const N = await narracao()
    if (a.narration && !N) { console.error(`--narration: ${SEM_NARRACAO}`); return 2 }
    const locucao = a.narration ? path.resolve(de, a.narration) : N ? N.locucaoDo(de, null) : null
    const voz = a.approved && locucao && fs.existsSync(locucao) ? N.vozDoGabarito(produto, locucao) : null
    const lista = (v) => v?.split(',').map((s) => s.trim()).filter(Boolean)
    const g = salvarGabarito(produto, { de, video: a.video && path.resolve(a.video), voz, aprovado: !!a.approved, fontes: lista(a.fonts), fontesExtras: lista(a['extra-fonts']), sinteticoOk: lista(a.synthetic), plataforma: a.platform, regras, titulo: a.title, estilo: a.style })
    console.log(`✓ ${path.join(g.pasta, 'profile.json')} · fonts ${(g.marca.fontes || []).join(', ') || '—'} · ${g.aprovados.length} approved${g.voz ? ` · voice ${g.voz.nome || ''} (pitch ${r2(g.voz.tom)} st, energy ${r2(g.voz.energia)} dB)` : ''}`)
    return 0
  }
  const alvo = a._[0]
  if (!alvo || !fs.existsSync(alvo)) { console.error('usage: node refine.mjs <video folder | video.mp4> [--format 9x16] [--product Name] [--channel whatsapp|reels|feed|site|big-screen] [--player <px>] [--check-only] [--out <folder>]  (the script header explains the rest)'); return 2 }
  const vb = await canalDoApp()
  await vb?.avisar('refino', `refining ${path.basename(path.resolve(alvo))}`)
  const { relatorio: r, saida } = await refinar(alvo, {
    formato: a.format, produto: a.product, video: a.video, locucao: a.narration, projeto: a.project, plataforma: a.platform, fontes: a.fonts?.split(',').map((s) => s.trim()),
    soChecar: !!a['check-only'], saida: a.out, semOcr: !!a['no-ocr'], semPaginas: !!a['no-pages'], semDirecao: !!a['no-direction'],
    regras: lerRegras(a.rule), player,
  })
  for (const l of resumoDoPlayer(r)) console.log(l)
  for (const c of Object.values(r.checagens)) console.log(`${c.status === 'reprovou' ? '✗' : c.status === 'aviso' ? '!' : c.status === 'passou' ? '✓' : '·'} ${c.nome.padEnd(22)} ${STATUS[c.status] ?? c.status}${c.erros ? ` · ${c.erros} error(s)` : ''}${c.avisos ? ` · ${c.avisos} warning(s)` : ''}${c.nota ? ` · ${c.nota}` : ''}`)
  for (const x of r.achados.filter((x) => x.nivel === 'erro').slice(0, 12)) console.log(`  ✗ ${x.tVideo != null ? relogio(x.tVideo) + ' ' : ''}${x.msg} → ${x.oque_fazer}`)
  for (const c of r.correcoes) console.log(`  fixed: ${c}`)
  for (const d of r.direcao || []) {
    console.log(`DIRECTION ${notaDirecao(d)}${r.direcao.length > 1 ? ` · ${path.basename(d.video)}` : ''}`)
    for (const x of d.achados || []) console.log(`  ! ${x.msg} → ${x.oQueFazer}`)
  }
  console.log(`${r.aprovado ? 'PASSED' : 'FAILED'} · ${r.erros} error(s), ${r.avisos} warning(s) · ${path.join(saida, 'refine.md')}`)
  const dono = paraODono(r)
  await vb?.mostrar(path.join(saida, 'refine.md'), dono.titulo, 'texto')
  await vb?.avisar('refino', dono.frase)
  return r.aprovado ? 0 : 1
}

if (process.argv[1] && fs.realpathSync(process.argv[1]) === fs.realpathSync(fileURLToPath(import.meta.url))) {
  principal(process.argv.slice(2)).then((c) => { process.exitCode = c }).catch((e) => { console.error(e.stack || e.message); process.exitCode = 2 })
}
