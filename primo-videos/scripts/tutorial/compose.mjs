// Compõe o tutorial a partir da gravação (record.mjs): tela real sobre o fundo da marca, câmera que
// acompanha a ação, indicador de toque/cursor, realce, legenda por passo com virada, abertura e
// fechamento; trilha da série gerada na duração exata (semente própria do vídeo) com os sons nos
// eventos; render no motor; mix e verificação (finalize.mjs); folha de contato dos eventos.
//
//   node compose.mjs <video-folder> [--device phone] [--mode draft|final] [--format 19x9] [--no-soundtrack] [--no-render]
//
// O formato é o do aparelho gravado, ou o que video.formato / serie.formato pedem; --format compõe outro (16x9, 19x9, 21x9,
// 9x16, 4x5, 1x1) a partir da mesma gravação, e o nome do arquivo ganha o formato.
//
// Com voz (video.voz, a locução do locucao.mjs): a abertura e o fechamento crescem pela fala, a legenda de cada
// passo é a fala com a palavra falada em destaque, e saem voz.wav (ao lado da folha de sincronia), <id>-<device>.srt
// e o bloco `voz` da folha, que a trilha mistura. Sem voz, nada disso existe e a saída é a de sempre.
//
// --no-render monta o projeto e faz só a folha de eventos com a checagem de colisão (sem trilha, sem vídeo):
// é o jeito de olhar um visual novo em segundos.
//
// Tudo o que ele lê: <folder>/video.mjs (a definição), <folder>/output/<device>/{eventos,quadros}.json e a
// identidade da série (video.serie: pasta com brand.js, fonts/, identity.json, series.json e, se a série
// desenha algum elemento por conta própria, visual.js). O visual declarado (series.json "versao": 2) é
// conferido pelo visual.mjs; série sem "versao" usa o desenho antigo do motor.
// Python com numpy/scipy: o do ambiente da skill (scripts/where.cjs: ~/.videostudio/environment.json, que o
// `environment.mjs --fix` grava), ou .venv da série/do vídeo/do motor, ou python3.
//
// g.antes (o relance do estado anterior no começo de um passo): a imagem ou o clipe da versão anterior entra no lugar
// da tela gravada, no mesmo enquadramento, com a etiqueta ANTES que vira AGORA no corte seco. O áudio não muda.
import { execFileSync, spawnSync } from 'node:child_process'
import { createRequire } from 'node:module'
import { fileURLToPath, pathToFileURL } from 'node:url'
import fs from 'node:fs'
import path from 'node:path'
import { lerMarca, resolverVisual, conferirProprio, somDaTroca, sonsDaAbertura, sonsDoFechamento, sonsDaSecao, temposDaSecao, digitacaoDaSecao, contraste } from './visual.mjs'
import { TEMPO_PLACAR, PLACAR_MIN, ehClipe, rotulosDoAntes } from './rules.mjs'

const AQUI = path.dirname(fileURLToPath(import.meta.url))
const RAIZ = path.resolve(AQUI, '..', '..')          // a skill (ou a cópia do motor num repositório)
const TEMPLATE = path.join(RAIZ, 'assets', 'template')
const AUDIO = path.join(RAIZ, 'assets', 'audio')
const SCRIPTS = path.join(RAIZ, 'scripts')
const ASSETS3D = path.join(RAIZ, 'assets', '3d')
// modo cinema (references/tutorial.md, "Modo cinema"): moldura em 3D e motion, passos de frente
export const CINEMAS = ['moldura', 'nenhum']
const argv = process.argv.slice(2)
const opt = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 ? argv[i + 1] : d }
const r3 = (x) => +x.toFixed(3)
// Ponto de extensão opcional: sem scripts/app/canal.mjs no pacote, nada é avisado para fora.
const CANAL = new URL('../app/canal.mjs', import.meta.url)
const canalDoApp = async () => (fs.existsSync(CANAL) ? import(CANAL.href) : null)
// A locução só vem nos pacotes com narração: sem scripts/tutorial/locucao.mjs, o tutorial é sem voz.
const LOCUCAO = new URL('./locucao.mjs', import.meta.url)
const SEM_NARRACAO = 'video.voz is the voiceover, and this skill has no voiceover: remove "voz" from video.mjs (the tutorial comes out with the soundtrack and the caption of each step).'

// O achador do ambiente da skill (scripts/where.cjs). A cópia do motor num repositório pode não ter: aí vale a busca de antes.
const ONDE = path.join(RAIZ, 'scripts', 'where.cjs')
/** O Python com numpy e scipy da trilha, ou null. */
export function pythonDaTrilha(dirs) {
  const extras = dirs.flatMap((d) => [path.join(d, '.venv', 'bin', 'python'), path.join(d, '.venv', 'Scripts', 'python.exe'), path.join(d, 'audio', '.venv', 'bin', 'python')])
  if (fs.existsSync(ONDE)) {
    try { return createRequire(import.meta.url)(ONDE).acharPython({ extras }) || null } catch { /* cai na busca de antes */ }
  }
  for (const c of [process.env.VIDEOSTUDIO_PYTHON, ...extras, 'python3', 'python', 'py'].filter(Boolean)) {
    const r = spawnSync(c, ['-c', 'import numpy, scipy'], { encoding: 'utf8' })
    if (r.status === 0) return c
  }
  return null
}
function acharPython(dirs) {
  const py = pythonDaTrilha(dirs)
  if (!py) throw new Error(`Python with numpy and scipy not found (for the soundtrack). Run once: node ${path.join(RAIZ, 'scripts', 'environment.mjs')} --fix`)
  return py
}

/** Folha de sincronia do vídeo: os sons de efeito caem na amostra exata de cada evento gravado. */
// Com visual (série versão 2), os sons da troca de legenda, da abertura e do fechamento seguem o que a série
// escolheu (visual.mjs); sem visual, é a folha de antes, marco por marco. Com voz, a folha ganha o bloco `voz`
// (Contrato F) e o alvo de loudness e o teto de pico do vídeo falado.
// o placar: os tempos moram em rules.mjs (o gravador confere o ms do g.placar com eles, já no --check)
export { TEMPO_PLACAR, PLACAR_MIN }
/** A seção que abre antes disto (s da gravação) não vira o painel: a abertura acabou de virar. O drawing.js usa o mesmo. */
export const SECAO_SEM_GIRO = 0.8

/**
 * O índice das seções (visual.abertura.indice, com 2 ou mais g.secao no roteiro): depois do título, as seções entram na
 * coluna como pílulas numeradas (01, 02…), uma a cada 0,15 s, seguram o tempo de ler e saem com a abertura. A abertura
 * cresce para caber o índice. A0 = a abertura sem o índice (o título fica até t0). Devolve null sem índice.
 *   { t0 (o título sai), ini (a 1ª pílula começa a entrar), passo, entra, leitura, A (a abertura nova), itens: [{ num, nome }] }
 */
export const INDICE = { minimo: 2, saiTitulo: 0.3, passo: 0.15, entra: 0.45, leituraBase: 0.8, leituraPor: 0.3, folga: 0.35 }
export function planoDoIndice(secoes, A0) {
  if (!secoes || secoes.length < INDICE.minimo) return null
  const n = secoes.length
  const t0 = r3(Math.max(1.6, A0 - 0.25))
  const ini = r3(t0 + INDICE.saiTitulo)
  const leitura = r3(INDICE.leituraBase + INDICE.leituraPor * n)
  const A = r3(ini + (n - 1) * INDICE.passo + INDICE.entra + leitura + INDICE.folga)
  return { t0, ini, passo: INDICE.passo, entra: INDICE.entra, leitura, A, itens: secoes.map((x, i) => ({ num: String(i + 1).padStart(2, '0'), nome: x.nome })) }
}

export function folhaDoVideo(video, log, { A, F, semente, serie, visual = null, voz = null, cinema = 'nenhum', pecasLogo = 0, saida = null, indice = null }) {
  const D = log.duracao, dur = r3(A + D + F)
  const toque = log.aparelho.toque
  const niv = { ...(serie.niveis || {}) }
  // a série troca um som por outro (ex.: "trocar": { "sucesso": "baque" } na marca que não quer o sino); o parâmetro
  // que só o som original tem (as notas do sucesso) fica para trás
  const trocar = serie.trocar || {}
  const SO_DO_SUCESSO = ['notas', 'modo']
  const m = [], ja = new Set()
  const add = (t, evento, original, extraOriginal = {}) => {
    const efeito = trocar[original] || original
    const extra = efeito === original ? extraOriginal : Object.fromEntries(Object.entries(extraOriginal).filter(([k]) => !SO_DO_SUCESSO.includes(k)))
    if (niv[efeito] === false) return   // a série desligou este som (ex.: "niveis": { "sucesso": false })
    const tt = r3(t)
    if (tt <= 0.05 || tt >= dur - 0.3) return
    // dois sons de ataque no mesmo instante viram um só
    const chave = Math.round(tt * 20)
    if (ja.has(chave) && !extra.forca) return
    ja.add(chave)
    m.push({ t: tt, evento, som: efeito, efeito, opcional: false, ...(niv[efeito] != null ? { nivel: niv[efeito] } : {}), ...extra })
  }
  if (!visual) add(A - 0.02, 'the screen appears (opening dive)', 'whoosh', { dur: 0.6, opcional: true })
  else for (const s of sonsDaAbertura(visual, A)) add(s.t, s.evento, s.efeito, s.extra)
  // o índice: um pop baixinho em cada pílula que assenta
  if (indice) indice.itens.forEach((it, i) => add(indice.ini + i * indice.passo + 0.2, `index: ${it.num} ${it.nome}`, 'pop', { nivel: (niv.pop ?? 0) - 10, opcional: true }))
  for (const e of log.eventos) {
    const t = A + e.t
    if (e.tipo === 'passo' && e.n > 1 && !visual) add(t - 0.25, `step ${e.n}: the caption flips`, 'virada')
    if (e.tipo === 'passo' && e.n > 1 && visual) { const s = somDaTroca(visual, t); if (s) add(s.t, `step ${e.n}: the caption ${visual.legenda.troca === 'virar' ? 'flips' : 'rises'}`, s.efeito, s.extra) }
    // toque oculto (de quem é atendido): sem dedo na imagem, sem som de toque
    if (e.tipo === 'toque' && !e.nativo && !e.oculto) add(t, `${toque ? 'tap' : 'click'} on ${e.alvo}`, toque ? 'toque' : 'clique')
    if (e.tipo === 'toque' && e.nativo && !e.oculto) add(t, `opens ${e.alvo}`, toque ? 'toque' : 'clique')
    if (e.tipo === 'digita' && e.teclas) add(t, `types in ${e.alvo}`, 'digitacao', { dur: r3(Math.max(0.2, e.t1 - e.t)), teclas: e.teclas })
    if (e.tipo === 'escolhe') add(A + e.t1, `chose "${e.escolhida}"`, 'sucesso', { opcional: true, nivel: (niv.sucesso ?? -2) - 6 })
    if (e.tipo === 'tela') add(t + 0.3, `new screen: ${e.url}`, 'whoosh', { dur: 0.45, opcional: true })
    // seção nova (g.secao): o painel vira; a primeira, colada na abertura, já tem o som da saída dela
    // (no modo cinema, o cartão de capítulo entra e sai: um whoosh em cada passada)
    if (e.tipo === 'secao' && e.t > SECAO_SEM_GIRO) {
      if (visual && cinema === 'moldura') for (const s of sonsDaSecao(visual, t, e.nome)) add(s.t, s.evento, s.efeito, s.extra)
      else add(t - 0.12, `section: ${e.nome}`, 'whoosh', { dur: 0.7, variante: 'longo', opcional: true })
    }
    if (e.tipo === 'sucesso') add(t, 'success', 'sucesso')
    // vídeo de venda: a lupa abre, cada prova marca um ponto (a última com uma nota a mais) e o placar conta
    if (e.tipo === 'aponta' && e.lupa) add(t + 0.05, `the magnifier opens on ${e.alvo}`, 'whoosh', { dur: 0.35, variante: 'curto', nivel: (niv.whoosh ?? 0) - 6, opcional: true })
    if (e.tipo === 'prova') { const provas = log.eventos.filter((x) => x.tipo === 'prova'); add(t + 0.1, `proof: ${e.rotulo}`, 'sucesso', { notas: provas.indexOf(e) === provas.length - 1 ? 3 : 2 }) }
    if (e.tipo === 'placar') {
      const cheio = TEMPO_PLACAR(e)
      add(t + 0.3, 'the scoreboard counts', 'riser', { dur: r3(Math.max(0.4, cheio - 0.45)), ticks: true, opcional: true })
      add(t + cheio - 0.15, 'the scoreboard settles', 'impacto', { forca: true })
    }
  }
  if (saida) add(A + saida.de + 0.12, 'the device leaves the scene and the person comes back', 'whoosh', { dur: r3(Math.max(0.4, saida.dur - 0.1)), direcao: -1, opcional: true })
  if (!visual) add(A + D + 0.2, 'closing: the brand color covers the screen', 'impacto', { forca: true })
  else for (const s of sonsDoFechamento(visual, A + D + 0.2)) add(s.t, s.evento, s.efeito, s.extra)
  if (visual && cinema === 'moldura') {
    // o celular 3D entra girando; o logo 3D assenta a última peça em t0 + 0,55 + 0,07 por peça (cinema.js)
    if (toque) add(0.15, 'opening: the 3D phone spins in', 'whoosh', { dur: visual.abertura.saida === 'pouso' ? r3(Math.max(0.5, A - 0.25)) : 0.9, variante: 'longo', opcional: true })
    if (pecasLogo) {
      const monta = A + D + 0.2 + 0.55 + (pecasLogo - 1) * 0.07
      add(monta, 'closing: rises until the 3D logo assembles', 'riser', { dur: 1.0, forca: true, opcional: true })
      add(monta + 0.02, 'closing: the last piece of the 3D logo settles', 'impacto', { forca: true })
    }
  }
  m.sort((a, b) => a.t - b.t)
  const folha = {
    titulo: `${video.id} · ${log.versao}`, duracao: dur, bpm: serie.bpm || 100, compasso: 4, taxa: 48000,
    // a −14 LUFS (trilha protagonista) o AAC do MP4 passa até 1,5 dB do pico do WAV: o teto desce para −2,5 e o
    // finalize.mjs (teto −0,5 no MP4) passa; a −18 fica o de sempre
    saida: 'soundtrack.wav', loudness_lufs: serie.loudness_lufs ?? -18, teto_dbtp: (serie.loudness_lufs ?? -18) > -16 ? -2.5 : -1.5, semente,
    silencios: [], fade: [r3(dur - 1.2), dur],
    secoes: [
      { nome: 'opening', de: 0, ate: r3(A), energia: 'baixa', descricao: 'tutorial title' },
      { nome: 'screen', de: r3(A), ate: r3(A + D), energia: 'baixa', descricao: 'real screen with captions' },
      { nome: 'closing', de: r3(A + D), ate: dur, energia: 'media', descricao: 'closing with the brand' },
    ],
    marcos: m,
  }
  if (voz) Object.assign(folha, { loudness_lufs: -14, teto_dbtp: -1.0, voz })
  return folha
}

function sementeDe(s) { return [...s].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7) % 100000000 }

/** O visual da série: null na série antiga (com o aviso de uma linha), o resolvido na versão 2. */
export function visualDaSerie(serie, serieDir) {
  if (serie.versao == null) {
    console.log('  warning: series.json has no "versao": this is the old engine design, the same for every product, not an identity (references/tutorial.md §13)')
    return null
  }
  if (serie.versao !== 2) throw new Error(`series.json: "versao": ${JSON.stringify(serie.versao)} does not exist (use 2, or remove the field for the old design)`)
  const { visual, avisos, usaProprio } = resolverVisual(serie, lerMarca(path.join(serieDir, 'brand.js')))
  if (usaProprio) conferirProprio(path.join(serieDir, 'visual.js'), visual)
  for (const a of avisos) console.log('  warning: ' + a)
  if (!serie.leitura || !fs.existsSync(path.join(serieDir, serie.leitura))) console.log(`  warning: series.json does not point to the project reading ("leitura": "reading.md"): without it, nothing says why the visual is this one`)
  return { visual, usaProprio }
}

/**
 * Vídeo de app: o aparelho aparece. Confere as combinações do visual que dependem do aparelho gravado e da pessoa na
 * câmera (video.pessoa), e devolve os avisos. Erro = lança com o que fazer.
 *   · moldura "aparelho" e abertura "pouso" são do celular gravado, com a tela do aparelho do kit 3D;
 *   · o pouso troca o aparelho 3D pela tela gravada: sem a moldura "aparelho" a troca aparece;
 *   · celular gravado em modo cinema com a moldura "nenhuma" deixa a tela sem corpo: aviso, e erro com a pessoa.
 */
export function conferirAparelho({ visual, cinema, toque, viewport, pessoa = null }) {
  const avisos = [], M = visual.moldura.tipo, pouso = visual.abertura.saida === 'pouso'
  if (M === 'aparelho' && !toque) throw new Error('visual.moldura "aparelho" is the phone body: on a computer use "janela" or "navegador" (references/tutorial.md, section 13)')
  if (pouso) {
    if (cinema !== 'moldura') throw new Error('visual.abertura.saida "pouso" is the entrance of the 3D device: it needs "cinema": "moldura" (references/tutorial.md, "Cinema mode")')
    if (!toque) throw new Error('visual.abertura.saida "pouso" is for a recorded phone (the 3D device of the kit is a phone): on a computer use another exit')
    if (M !== 'aparelho') throw new Error(`visual.abertura.saida "pouso" needs visual.moldura "aparelho" (got "${M}"): the 3D device lands and the recorded screen takes its place, with the same body around it`)
    const a = viewport.width / viewport.height
    if (Math.abs(a - 390 / 844) > 0.012) throw new Error(`visual.abertura.saida "pouso": the recorded screen is ${viewport.width}×${viewport.height}, and the 3D device of the kit has a 390×844 screen. Record with the "phone" device (or another one with the same aspect ratio).`)
  }
  if (pessoa && pessoa.entrada && !pouso) throw new Error('video.pessoa.entrada is the person behind the device as it comes in: it needs visual.abertura.saida "pouso"')
  if (visual.abertura.saida === 'virar' && (toque || cinema !== 'moldura')) throw new Error('visual.abertura.saida "virar" is the 3D panel of the computer that flips and shows the recorded screen on its back: it needs a computer recording and "cinema": "moldura" (references/tutorial.md, "3D panel")')
  if (toque && cinema === 'moldura' && M === 'nenhuma') {
    const msg = 'recorded phone with visual.moldura "nenhuma": the screen has no device body. In an app video the device shows: use "aparelho" (or "janela")'
    if (pessoa) throw new Error(`${msg}. With the person on camera this is an error: the video ends up without the phone.`)
    avisos.push(msg)
  }
  for (const a of avisos) console.log('  warning: ' + a)
  return avisos
}

/**
 * O que o compor recusa e já dá para saber antes de gravar: a série (series.json, brand.js, identity.json, o visual),
 * o modo cinema, a moldura contra o aparelho, a pessoa, a voz no pacote e o Python da trilha. O --check do gravador
 * roda isto antes da jornada. Devolve { erros, vis } (os avisos saem no console, como no compor).
 *   ap: o aparelho da versão (devices.mjs), com toque e viewport.
 */
export function conferirComposicao(video, ap) {
  const erros = []
  const tenta = (f) => { try { return f() } catch (e) { erros.push(e.message.split('\n')[0]); return null } }
  const serieDir = path.resolve(video.pasta, video.serie || '../serie')
  if (!fs.existsSync(serieDir)) return { erros: [`the series does not exist: ${serieDir} (video.serie)`], vis: null }
  const arqSerie = path.join(serieDir, 'series.json')
  const serie = fs.existsSync(arqSerie) ? tenta(() => JSON.parse(fs.readFileSync(arqSerie, 'utf8'))) || {} : {}
  const temMarca = fs.existsSync(path.join(serieDir, 'brand.js'))
  if (!temMarca) erros.push(`the series has no brand.js: ${serieDir} (see references/tutorial.md → Identity)`)
  if (!fs.existsSync(path.join(serieDir, 'identity.json'))) erros.push(`the series has no identity.json (the soundtrack): ${path.join(serieDir, 'identity.json')}`)
  const vis = temMarca ? tenta(() => visualDaSerie(serie, serieDir)) : null
  const cinema = vis ? (video.cinema ?? serie.cinema ?? 'moldura') : 'nenhum'
  if (!CINEMAS.includes(cinema)) erros.push(`"cinema": "${cinema}" does not exist: use ${CINEMAS.map((c) => `"${c}"`).join(' or ')} (references/tutorial.md, "Cinema mode")`)
  else if (vis) tenta(() => conferirAparelho({ visual: vis.visual, cinema, toque: !!ap.toque, viewport: ap.viewport, pessoa: video.pessoa }))
  if (video.pessoa && !vis) erros.push('video.pessoa needs the series design ("versao": 2 in series.json)')
  tenta(() => formatoDe({ video, serie, versao: ap.nome, aparelho: ap }))
  tenta(() => textoDe(video, serie))
  for (const e of conferirFontes(serie, serieDir)) erros.push(e)
  if (vis && temMarca) for (const e of conferirPngs(vis.visual, lerMarca(path.join(serieDir, 'brand.js')), serieDir, cinema)) erros.push(e)
  if (video.voz && !fs.existsSync(LOCUCAO)) erros.push(SEM_NARRACAO)
  if (!pythonDaTrilha([serieDir, video.pasta, RAIZ])) erros.push(`Python with numpy and scipy not found (for the soundtrack): run node ${path.join(RAIZ, 'scripts', 'environment.mjs')} --fix`)
  return { erros, vis }
}

/** As famílias de serie.fontes têm de estar no fonts/fonts.css da série: sem elas o render sai na fonte reserva. */
export function conferirFontes(serie, serieDir) {
  const fams = serie.fontes || []
  if (!fams.length) return []
  const css = fs.existsSync(path.join(serieDir, 'fonts', 'fonts.css')) ? fs.readFileSync(path.join(serieDir, 'fonts', 'fonts.css'), 'utf8') : ''
  const faltam = fams.filter((f) => !new RegExp(`font-family:\\s*["']?${f.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}["']?\\s*;`, 'i').test(css))
  if (!faltam.length) return []
  const inter = faltam.length === 1 && faltam[0] === 'Inter'
  return [`the series declares ${faltam.join(', ')} in "fontes" and ${path.join(serieDir, 'fonts', 'fonts.css')} does not have it: ${inter ? `run node ${path.join(RAIZ, 'scripts', 'example-fonts.mjs')} ${serieDir}` : `run node ${path.join(RAIZ, 'scripts', 'fonts.mjs')} ${serieDir} "${faltam[0]}"`}`]
}
/** O logo em PNG que o visual pede (fecho com "logo": "png"; painel do cinema sem MARCA.logo) tem de existir. */
export function conferirPngs(visual, marca, serieDir, cinema) {
  const pngs = pngsDaMarca(marca, serieDir), erros = []
  const onde = `MARCA.png in brand.js (${Object.values(marca.png || {}).join(', ') || 'empty'}): put the logo PNG in the series folder, at that path or in ${path.join(serieDir, 'media')}/`
  const pedeFecho = visual.fechamento.logo === 'png' || (visual.fechamento.ordem === 'so-logo' && !marca.logo)
  // a tabela da marca diz que aquela cor não leva logo horizontal (MARCA.pngPorFundo com null): escolha outra cor
  const semLogo = (f) => (porFundo(marca, f) === null ? ` The brand has no horizontal logo for ${f} (MARCA.pngPorFundo): use another color.` : '')
  if (pedeFecho && !logoPngPara(visual.fechamento.fundo, pngs, marca.pngPorFundo)) erros.push(`visual.fechamento ${visual.fechamento.ordem === 'so-logo' ? 'ordem "so-logo"' : 'logo "png"'}: no PNG logo that reads on ${visual.fechamento.fundo}.${semLogo(visual.fechamento.fundo)} ${onde}`)
  if (cinema === 'moldura' && !marca.logo && Object.keys(marca.png || {}).length && !logoPngPara(visual.abertura.painel || visual.fechamento.fundo, pngs, marca.pngPorFundo)) erros.push(`the opening panel (cinema) needs the logo, and there is no PNG that reads on ${visual.abertura.painel || visual.fechamento.fundo}.${semLogo(visual.abertura.painel || visual.fechamento.fundo)} ${onde}`)
  // o fundo "simbolo": o PNG do símbolo tem de existir na série
  if (visual.fundo.tipo === 'simbolo' && !pngs[visual.fundo.png]) erros.push(`visual.fundo "simbolo": the PNG "${visual.fundo.png}" is not in MARCA.png or was not found. ${onde}`)
  return erros
}

const medidas = (arq) => {
  const s = execFileSync('ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height', '-of', 'csv=p=0:s=x', arq], { encoding: 'utf8' }).trim().split('\n')[0]
  const [w, h] = s.split('x').map(Number)
  return { w, h }
}
/** Confere a imagem (ou o clipe) de um g.antes contra o aparelho gravado: a tela inteira, na mesma proporção. Erro = lança. */
export function conferirArquivoDoAntes(arq, viewport, onde = 'g.antes') {
  if (!fs.existsSync(arq)) throw new Error(`${onde}: ${arq} not found (the image or the clip of the previous version, on the same ${viewport.width}×${viewport.height} screen)`)
  const { w, h } = medidas(arq)
  if (!(w > 0 && h > 0)) throw new Error(`${onde}: ${arq} is not an image or video that ffprobe can read`)
  if (Math.abs(w / h - viewport.width / viewport.height) > 0.01) throw new Error(`${onde}: ${path.basename(arq)} is ${w}×${h}, and the recording is ${viewport.width}×${viewport.height}. The "before" is the whole screen of the same device (any DSF): capture it with the same viewport (g.foto in the journey of the "before").`)
  return { w, h }
}

/** Os quadros de cada g.antes, copiados para comp/antes/: a imagem como está; o clipe vira JPG no fps da composição. */
export function prepararAntes(video, comp, eventos, { viewport, fps = 30 }) {
  const lista = eventos.filter((e) => e.tipo === 'antes')
  if (!lista.length) return []
  const dir = path.join(comp, 'antes')
  fs.mkdirSync(dir, { recursive: true })
  return lista.map((e, i) => {
    const arq = path.resolve(video.pasta, e.arquivo)
    conferirArquivoDoAntes(arq, viewport, `g.antes of step ${e.passo}`)
    let quadros
    if (ehClipe(arq)) {
      const sub = path.join(dir, String(i + 1))
      fs.mkdirSync(sub, { recursive: true })
      execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', arq, '-t', String(e.dur + 0.2), '-vf', `fps=${fps}`, '-q:v', '2', path.join(sub, '%04d.jpg')])
      const n = fs.readdirSync(sub).filter((f) => f.endsWith('.jpg')).length
      if (!n) throw new Error(`g.antes of step ${e.passo}: the clip ${e.arquivo} gave no frames`)
      quadros = Array.from({ length: n }, (_, k) => [`antes/${i + 1}/${String(k + 1).padStart(4, '0')}.jpg`, r3(k / fps)])
    } else {
      const nome = `${i + 1}${path.extname(arq).toLowerCase()}`
      fs.copyFileSync(arq, path.join(dir, nome))
      quadros = [[`antes/${nome}`, 0]]
    }
    return { passo: e.passo, t: e.t, dur: e.dur, ...(e.ret ? { ret: e.ret } : {}), quadros }
  })
}

export const TAMANHOS = { '16x9': [1920, 1080], '19x9': [2280, 1080], '21x9': [2520, 1080], '9x16': [1080, 1920], '4x5': [1080, 1350], '1x1': [1080, 1080] }
/** Formato deitado (mais largo que alto): 16:9, 19:9, 21:9. O resto do motor decide pela orientação, nunca por "é 16:9". */
export const deitado = (fmt) => { const [w, h] = TAMANHOS[fmt] || [0, 0]; return w > h }
/**
 * O formato do vídeo composto. Vence o primeiro que existir: --format (cli), video.formato, serie.formato, o do aparelho
 * gravado. video.formato e serie.formato são um formato ("19x9") ou um por versão ({ computer: "19x9", padrao: "16x9" }).
 */
export function formatoDe({ cli = null, video = {}, serie = {}, versao, aparelho = {} }) {
  const de = (x) => (x && typeof x === 'object' ? x[versao] ?? x.padrao ?? null : x || null)
  const f = cli || de(video.formato) || de(serie.formato) || aparelho.formato || '16x9'
  if (!TAMANHOS[f]) throw new Error(`format "${f}" does not exist: use ${Object.keys(TAMANHOS).join(', ')} (--format, video.formato or serie.formato)`)
  return f
}
/** Os modos de texto da série: "fora-da-imagem" faz a checagem reprovar texto que cruza a tela gravada (ou o painel). */
export const TEXTOS = ['fora-da-imagem', 'livre']
export function textoDe(video = {}, serie = {}) {
  const t = video.texto ?? serie.texto ?? 'livre'
  if (!TEXTOS.includes(t)) throw new Error(`"texto": "${t}" does not exist: use ${TEXTOS.map((x) => `"${x}"`).join(' or ')} (references/tutorial.md, "Text outside the image")`)
  return t
}

// ---------- o logo em PNG (MARCA.png): a marca que só tem o logo em imagem ----------
// O arquivo é procurado na série: o caminho do brand.js, ou <serie>/media/<name>. Só os marcadores da série de exemplo
// (*-placeholder*.png) também são achados em assets/example/, onde a skill os guarda: a série de exemplo compõe sem
// ninguém copiar imagem. O compor copia para o projeto do motor no mesmo caminho do brand.js.
const EXEMPLO = path.join(RAIZ, 'assets', 'example')
const ehMarcador = (nome) => /-placeholder(-[a-z]+)?\.png$/i.test(nome)
export function acharPng(serieDir, rel) {
  const nome = path.basename(String(rel))
  const cands = [path.resolve(serieDir, rel), path.join(serieDir, 'media', nome), ...(ehMarcador(nome) ? [path.join(EXEMPLO, nome)] : [])]
  return cands.find((f) => fs.existsSync(f)) || null
}
const medidaPng = (arq) => { const b = fs.readFileSync(arq); return b.toString('ascii', 1, 4) === 'PNG' ? { w: b.readUInt32BE(16), h: b.readUInt32BE(20) } : null }
/** Os PNG de MARCA.png que existem: { chave: { rel, arq, w, h } } (rel = o caminho dentro do projeto do motor). */
export function pngsDaMarca(marca, serieDir) {
  const out = {}
  for (const [chave, rel] of Object.entries(marca.png || {})) {
    if (typeof rel !== 'string' || !/\.png$/i.test(rel)) continue
    const arq = acharPng(serieDir, rel)
    const m = arq && medidaPng(arq)
    if (!m) continue
    const limpo = path.posix.normalize(rel.replace(/\\/g, '/'))
    out[chave] = { rel: limpo.startsWith('..') || path.isAbsolute(limpo) ? `media/${path.basename(rel)}` : limpo, arq, ...m }
  }
  return out
}
// a cor que cada logo PNG tem, pela chave do MARCA.png (o resto da paleta vem do brand.js)
const lumHex = (h) => contraste(h, '#000000')   // 1 (preto) a 21 (branco)
/** A chave de MARCA.png que a tabela da marca manda usar sobre `fundo` (MARCA.pngPorFundo: { "#979797": "logo",
 *  "#C0C0C0": null }); undefined = a tabela não fala dessa cor (vale a regra do claro e do escuro); null = nenhum logo. */
export function porFundo(marca, fundo) {
  const t = (marca && marca.pngPorFundo) || {}
  const k = Object.keys(t).find((h) => String(h).toUpperCase() === String(fundo).toUpperCase())
  return k === undefined ? undefined : t[k]
}
/** O logo PNG que se lê sobre `fundo`: o que a tabela da marca manda (tabela = MARCA.pngPorFundo), se ela fala dessa cor;
 *  senão, em fundo claro, o colorido (png.logo) ou o escuro (png.logoPreto); em fundo escuro ou de cor forte, o claro
 *  (png.logoClaro). null = nenhum disponível. */
export function logoPngPara(fundo, pngs, tabela = null) {
  const k0 = porFundo({ pngPorFundo: tabela }, fundo)
  if (k0 !== undefined) return k0 && pngs[k0] ? { chave: k0, ...pngs[k0] } : null
  const claro = lumHex(fundo) > 9   // um fundo quase branco dá ~19; uma cor forte de marca, ~5
  const ordem = claro ? ['logo', 'logoPreto'] : ['logoClaro', 'logo']
  const k = ordem.find((c) => pngs[c])
  return k ? { chave: k, ...pngs[k] } : null
}
/**
 * Os quadros da pessoa (video.pessoa) para o motor desenhar atrás do aparelho: extraídos dos takes dela, no tamanho do
 * quadro, pelo número do quadro (o corte da montagem cai em quadro inteiro). Devolve { entrada, saida, fecho }, cada um
 * [[arquivo, t], …] com t a partir do ponto de corte.
 *   entrada: { arquivo, de }   o take da abertura; `de` = onde a montagem sai dele (s)
 *   saida:   { arquivo, em }   o take seguinte; `em` = o quadro em que a montagem entra nele (padrão 0)
 *   fecho:   { arquivo, de }   o mesmo take; `de` = onde a montagem sai dele para o fechamento
 */
export function quadrosDaPessoa(video, comp, formato, { A }) {
  const [LW, LH] = TAMANHOS[formato] || TAMANHOS['9x16']   // (qualquer formato da tabela)
  const dest = path.join(comp, 'pessoa')
  fs.mkdirSync(dest, { recursive: true })
  const sonda = (arq) => {
    const j = JSON.parse(execFileSync('ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-count_packets', '-show_entries', 'stream=r_frame_rate,nb_read_packets,height,color_space,color_range,pix_fmt', '-of', 'json', arq]).toString()).streams[0]
    const [n, d] = j.r_frame_rate.split('/').map(Number)
    // a mesma leitura de cor da montagem dos takes: sem etiqueta, HD é BT.709
    const matriz = { bt709: 'bt709', smpte170m: 'bt601', bt470bg: 'bt601' }[j.color_space] ?? (j.height >= 720 ? 'bt709' : 'bt601')
    return { fps: n / d, total: +j.nb_read_packets, cor: `in_color_matrix=${matriz}:in_range=${j.color_range === 'pc' || /^yuvj/.test(j.pix_fmt || '') ? 'pc' : 'tv'}` }
  }
  const extrai = (nome, cfg, t0, dur) => {
    if (!cfg) return null
    if (!cfg.arquivo) throw new Error(`video.pessoa.${nome} has no "arquivo" (the take of the person)`)
    const arq = path.resolve(video.pasta, cfg.arquivo)
    if (!fs.existsSync(arq)) throw new Error(`video.pessoa.${nome}: ${arq} not found`)
    const s = sonda(arq), k0 = Math.round(t0 * s.fps), k1 = Math.min(s.total - 1, k0 + Math.max(0, Math.ceil(dur * s.fps)))
    if (k0 >= s.total) throw new Error(`video.pessoa.${nome}: ${t0} s is past the end of the take (${(s.total / s.fps).toFixed(2)} s)`)
    // PNG, por RGB e com a conversão exata: o quadro tem de sair do motor igual ao do take (o corte da montagem é
    // seco). Em JPEG, e com o arredondamento rápido do swscale, o quadro saía ~2 níveis mais escuro que o take.
    execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', arq, '-vf', `select='between(n,${k0},${k1})',scale=${LW}:${LH}:force_original_aspect_ratio=increase:${s.cor}:flags=lanczos+accurate_rnd+full_chroma_int+full_chroma_inp,format=gbrp,crop=${LW}:${LH}`, '-fps_mode', 'passthrough', '-pix_fmt', 'rgb24', path.join(dest, `${nome}-%04d.png`)])
    return Array.from({ length: k1 - k0 + 1 }, (_, i) => [`pessoa/${nome}-${String(i + 1).padStart(4, '0')}.png`, r3(i / s.fps)])
  }
  const P = video.pessoa
  return {
    entrada: extrai('entrada', P.entrada, P.entrada?.de ?? 0, A + 0.5),
    saida: extrai('saida', P.saida, P.saida?.em ?? 0, 0),
    fecho: extrai('fecho', P.fecho, P.fecho?.de ?? 0, 1.2),
  }
}

export async function comporVersao(video, v, { modo = 'draft', semTrilha = false, semRender = false, formato = null } = {}) {
  const dir = path.join(video.pasta, 'output', v)
  let log = JSON.parse(fs.readFileSync(path.join(dir, 'events.json'), 'utf8'))
  let quadros = JSON.parse(fs.readFileSync(path.join(dir, 'frames.json'), 'utf8'))
  const serieDir = path.resolve(video.pasta, video.serie || '../serie')
  const serie = fs.existsSync(path.join(serieDir, 'series.json')) ? JSON.parse(fs.readFileSync(path.join(serieDir, 'series.json'), 'utf8')) : {}
  let A = serie.abertura ?? 2.4, F = serie.fechamento ?? 2.8
  if (!fs.existsSync(path.join(serieDir, 'brand.js'))) throw new Error(`the series has no brand.js: ${serieDir} (see references/tutorial.md → Identity)`)
  const vis = visualDaSerie(serie, serieDir)
  // o índice das seções faz a abertura crescer (a voz, se houver, pode crescer mais: o índice segura até o fim dela)
  const indice = vis && vis.visual.abertura.indice && vis.visual.abertura.saida !== 'pouso' ? planoDoIndice(log.eventos.filter((e) => e.tipo === 'secao'), A) : null
  if (indice) A = Math.max(A, indice.A)
  const titulo = video.titulo || video.id
  // o formato do vídeo (deitado, em pé ou quadrado) e o modo de texto; um formato pedido no --format vai para o nome do arquivo
  const fmt = formatoDe({ cli: formato, video, serie, versao: v, aparelho: log.aparelho })
  const fmtPadrao = formatoDe({ video, serie, versao: v, aparelho: log.aparelho })
  const sufFmt = fmt === fmtPadrao ? '' : `-${fmt}`
  const texto = textoDe(video, serie)
  const errosFonte = conferirFontes(serie, serieDir)
  if (errosFonte.length) throw new Error(errosFonte[0])
  // voz: a locução manda no tempo da abertura e do fechamento e dá o texto de cada legenda. O locucao.mjs só é
  // carregado quando o vídeo tem voz: sem voz, a composição não depende dele.
  if (video.voz && !fs.existsSync(LOCUCAO)) throw new Error(SEM_NARRACAO)
  const LV = video.voz ? await import(LOCUCAO.href) : null
  const loc = LV && LV.lerLocucao(video, v)
  // corte seco nas esperas longas, só quando o vídeo pede (cuts.mjs); a fala do passo nunca é cortada
  if (video.cortarEsperas) {
    const { cortarEsperas } = await import('./cuts.mjs')
    const fimDaFala = loc ? (n) => { const f = loc.passos.get(n); return f ? LV.ENTRA + LV.util(f) : null } : null
    const c = cortarEsperas(log, quadros, video.cortarEsperas, fimDaFala)
    log = c.log; quadros = c.quadros
    for (const [a, b] of c.cortes) console.log(`  hard cut in the wait: ${a.toFixed(2)}–${b.toFixed(2)} s of the recording (${(b - a).toFixed(1)} s shorter)`)
  }
  let falasVoz = null, eventos = log.eventos
  if (loc) {
    if (!log.voz) throw new Error(`the recording of ${v} is from before the voice: the step was not held by the voice line. Record again (node ${path.join(video.pasta, 'video.mjs')} --device ${v}).`)
    if (log.voz.sha256 !== loc.sha256) console.log(`  warning: ${loc.rel} changed after the recording; the timings were checked again against the recorded steps`)
    LV.conferirTextos(loc, { titulo, fimLinhas: video.fimLinhas || serie.fimLinhas || ['Done!'] })
    const A0 = A, F0 = F
    A = LV.duracaoAbertura(loc.abertura, A); F = LV.duracaoFechamento(loc.fechamento, F)
    falasVoz = LV.linhaDoTempo(loc, log, { A, D: log.duracao })
    // a legenda é a fala (a fala vence o que o roteiro escreveu)
    eventos = log.eventos.map((e) => {
      const f = e.tipo === 'passo' && loc.passos.get(e.n)
      if (!f || f.texto === e.legenda) return e
      console.log(`  warning: step ${e.n}: the recorded caption says "${e.legenda}" and the voice says "${f.texto}". The caption is the voice.`)
      return { ...e, legenda: f.texto }
    })
    const cresceu = (x, x0) => `${x.toFixed(2)} s${x > x0 ? ` (grew from ${x0.toFixed(2)} s for the voice)` : ''}`
    console.log(`  voice: ${loc.falas.length} lines from ${loc.rel}, profile ${loc.perfil} · opening ${cresceu(A, A0)} · closing ${cresceu(F, F0)}`)
  }
  const comp = path.join(dir, 'comp')
  fs.rmSync(comp, { recursive: true, force: true })
  fs.mkdirSync(path.join(comp, 'tools'), { recursive: true })
  // modo cinema: só no desenho da série (versão 2); padrão "moldura", "nenhum" desliga (série ou vídeo)
  const cinema = vis ? (video.cinema ?? serie.cinema ?? 'moldura') : 'nenhum'
  if (!CINEMAS.includes(cinema)) throw new Error(`"cinema": "${cinema}" does not exist: use ${CINEMAS.map((c) => `"${c}"`).join(' or ')} (references/tutorial.md, "Cinema mode")`)
  const toque = !!log.aparelho.toque
  if (vis) conferirAparelho({ visual: vis.visual, cinema, toque, viewport: log.aparelho.viewport, pessoa: video.pessoa })
  // A pessoa na câmera (video.pessoa) atrás do aparelho, e a volta para ela: a gravação ganha `volta` s no fim, parada no
  // último quadro, para o aparelho sair de cena. O fim da tela cai num quadro inteiro do vídeo: é onde a montagem corta.
  let pessoa = null, saida = null
  if (video.pessoa) {
    if (!vis) throw new Error('video.pessoa needs the series design ("versao": 2 in series.json)')
    const fpsFinal = serie.fps || 60
    if (video.pessoa.saida) {
      const d0 = log.duracao, volta = video.pessoa.volta ?? 0.7
      const fim = Math.ceil((A + d0 + volta) * fpsFinal - 1e-6) / fpsFinal
      saida = { de: d0, dur: r3(fim - A - d0) }
      log = { ...log, duracao: r3(fim - A) }
    }
    pessoa = quadrosDaPessoa(video, comp, fmt, { A })
  }
  const placar = log.eventos.find((e) => e.tipo === 'placar')
  if (placar) {
    // legível = do último número assentado até o placar começar a sair (45% da volta, ou o fim da tela)
    const legivel = (saida ? saida.de + 0.45 * saida.dur : log.duracao) - (placar.t + TEMPO_PLACAR(placar))
    if (legivel < PLACAR_MIN) throw new Error(`the scoreboard stays readable for ${legivel.toFixed(2)} s; the minimum is ${PLACAR_MIN} s. Hold longer after g.placar (ms) and record again.`)
  }

  // 1 · projeto do motor
  fs.copyFileSync(path.join(TEMPLATE, 'engine.js'), path.join(comp, 'engine.js'))
  fs.copyFileSync(path.join(AQUI, 'tutorial.js'), path.join(comp, 'tutorial.js'))
  if (vis) fs.copyFileSync(path.join(AQUI, 'drawing.js'), path.join(comp, 'drawing.js'))
  if (cinema === 'moldura') {
    for (const f of ['three.bundle.js', 'kit3d.js']) fs.copyFileSync(path.join(ASSETS3D, f), path.join(comp, f))
    fs.copyFileSync(path.join(AQUI, 'cinema.js'), path.join(comp, 'cinema.js'))
  }
  if (vis && vis.usaProprio) fs.copyFileSync(path.join(serieDir, 'visual.js'), path.join(comp, 'visual.js'))
  for (const f of ['playwright.cjs', 'frames.cjs', 'render.cjs', 'finalize.mjs']) fs.copyFileSync(path.join(SCRIPTS, f), path.join(comp, 'tools', f))
  let html = fs.readFileSync(path.join(TEMPLATE, 'index.html'), 'utf8')
  const extras = vis ? `${cinema === 'moldura' ? '<script src="three.bundle.js"></script>\n<script src="kit3d.js"></script>\n<script src="cinema.js"></script>\n' : ''}<script src="drawing.js"></script>\n${vis.usaProprio ? '<script src="visual.js"></script>\n' : ''}` : ''
  html = html.replace('<script src="scenes.js"></script>', `<script src="data.js"></script>\n${extras}<script src="tutorial.js"></script>\n<script src="scenes.js"></script>`)
  fs.writeFileSync(path.join(comp, 'index.html'), html)
  if (fs.existsSync(path.join(serieDir, 'fonts'))) fs.cpSync(path.join(serieDir, 'fonts'), path.join(comp, 'fonts'), { recursive: true })
  else { fs.mkdirSync(path.join(comp, 'fonts')); fs.writeFileSync(path.join(comp, 'fonts', 'fonts.css'), '') }
  fs.copyFileSync(path.join(serieDir, 'brand.js'), path.join(comp, 'brand.js'))
  // o logo em PNG (MARCA.png), quando a marca não tem o logo em SVG: o fecho e o painel da abertura do cinema
  const marcaSerie = lerMarca(path.join(serieDir, 'brand.js'))
  const pngs = pngsDaMarca(marcaSerie, serieDir)
  for (const p of Object.values(pngs)) { fs.mkdirSync(path.dirname(path.join(comp, p.rel)), { recursive: true }); fs.copyFileSync(p.arq, path.join(comp, p.rel)) }
  if (vis) for (const e of conferirPngs(vis.visual, marcaSerie, serieDir, cinema)) throw new Error(e)
  const dur = r3(A + log.duracao + F)
  fs.writeFileSync(path.join(comp, 'video.js'), `// generated by compose.mjs — do not edit; change the series or the video and compose again
const VIDEO = ${JSON.stringify({
    titulo, duracao: dur, bpm: serie.bpm || 100, formatos: [fmt], fontes: serie.fontes || [], texto,
    fonteTitulo: serie.fonteTitulo ? `"${serie.fonteTitulo}"` : undefined, fonteTexto: serie.fonteTexto ? `"${serie.fonteTexto}"` : undefined,
    fundo: undefined, grao: 0, impactos: [], selo: null, audio: 'audio/soundtrack.wav', plataforma: video.plataforma || serie.plataforma || null,
    ...(vis && serie.fonteMono ? { fonteMono: `"${serie.fonteMono}", ui-monospace, Menlo, Consolas, monospace` } : {}),
  }, null, 2)}\n`)
  const quebra = (s, max) => { const ps = s.split(' '), ls = ['']; for (const p of ps) { if ((ls[ls.length - 1] + ' ' + p).trim().length > max && ls[ls.length - 1]) ls.push(p); else ls[ls.length - 1] = (ls[ls.length - 1] + ' ' + p).trim() } return ls }
  const vert = !deitado(fmt)
  const TU = {
    A, F, duracao: log.duracao, aparelho: log.aparelho, captura: log.captura, eventos,
    quadros: quadros.map(([f, t]) => ['../frames/' + f, t]),
    textos: {
      rotulo: video.rotulo || serie.rotulo || 'Step by step',
      tituloLinhas: video.tituloLinhas || quebra(titulo, vert ? 12 : 24),
      fimLinhas: (video.fimLinhas || serie.fimLinhas || ['Done!']).flatMap((l) => quebra(l, vert ? 12 : 24)),
      // rótulo do cartão de legenda; {n} e {N} viram o passo e o total (série em outro idioma)
      passo: video.passo || serie.passo || 'Step {n} of {N}',
    },
  }
  if (pessoa) TU.pessoa = pessoa
  if (saida) TU.saida = saida
  // g.antes: só no desenho da série (versão 2); a etiqueta é a tinta do título, e o AGORA, o acento da marca quando se lê
  // sobre o fundo da série
  if (log.eventos.some((e) => e.tipo === 'antes')) {
    if (!vis) throw new Error('g.antes needs the series design ("versao": 2 in series.json): the old series design does not draw the "before"')
    TU.antes = prepararAntes(video, comp, log.eventos, { viewport: log.aparelho.viewport, fps: modo === 'final' ? serie.fps || 60 : 30 })
    // o desenho escolhe a tinta pelo fundo onde a etiqueta mora (a legenda ou o fundo da série); o acento vai cru
    const cores = lerMarca(path.join(serieDir, 'brand.js')).cores || {}
    TU.textos.antes = { ...rotulosDoAntes(video.idioma, serie), acento: [cores.acento, cores.marca].find((c) => /^#[0-9a-f]{6}$/i.test(c || '')) || null }
  }
  if (vis) {
    TU.visual = vis.visual
    TU.cinema = cinema
    if (indice) TU.indice = indice
    // o logo PNG que se lê sobre o fundo do fecho e sobre o painel da abertura (MARCA.logo em SVG, quando existe, vence)
    const so = (x) => x && { src: x.rel, w: x.w, h: x.h }
    TU.png = {
      fecho: so(logoPngPara(vis.visual.fechamento.fundo, pngs, marcaSerie.pngPorFundo)),
      painel: so(logoPngPara(vis.visual.abertura.painel || vis.visual.fechamento.fundo, pngs, marcaSerie.pngPorFundo)),
      ...(vis.visual.fundo.tipo === 'simbolo' ? { fundo: so(pngs[vis.visual.fundo.png]) } : {}),
    }
    // o cartão de capítulo: os tempos da entrada escolhida e a janela de cada nome datilografado (visual.mjs)
    TU.visual = { ...vis.visual, secao: { ...vis.visual.secao, tempos: temposDaSecao(vis.visual),
      digitacao: Object.fromEntries(log.eventos.filter((e) => e.tipo === 'secao').map((e) => [e.nome, digitacaoDaSecao(vis.visual, e.nome)])) } }
    // a barra do navegador mostra só o domínio: o caminho pode carregar token
    TU.textos.endereco = video.endereco || serie.endereco || (() => { try { return new URL(video.url).host } catch { return '' } })()
  }
  // (com a legenda "nenhuma" o motor não desenha legenda: o destaque da palavra é o da legenda da montagem)
  if (loc && !(vis && vis.visual.legenda.tipo === 'nenhuma')) {
    const marca = lerMarca(path.join(serieDir, 'brand.js')), LG = vis && vis.visual.legenda
    const cores = vis ? { fundo: LG.tipo === 'solta' ? vis.visual.fundo.cor : LG.fundo, tinta: LG.tinta } : { fundo: '#FFFFFF', tinta: (marca.cores || {}).tinta || '#111111' }
    TU.voz = { destaque: LV.estiloDestaque(marca, cores), falas: falasVoz.filter((f) => typeof f.onde === 'object').map((f) => ({ passo: f.onde.passo, palavras: f.palavras })) }
  }
  fs.writeFileSync(path.join(comp, 'data.js'), `// generated by compose.mjs from events.json and frames.json\nconst TUTORIAL = ${JSON.stringify(TU)}\n${vis ? 'const VISUAL_PROPRIO = {}   // the visual.js of the series fills it (proprio hook)\n' : ''}`)
  fs.writeFileSync(path.join(comp, 'scenes.js'), 'montarTutorial(TUTORIAL)\n')

  // 2 · trilha da série: semente própria do vídeo e da versão (nunca a mesma trilha esticada)
  fs.mkdirSync(path.join(comp, 'audio'), { recursive: true })
  const semente = video.semente ?? sementeDe(video.id + '·' + v)
  const pecasLogo = cinema === 'moldura' ? ((lerMarca(path.join(serieDir, 'brand.js')).logo || {}).partes || []).length : 0
  const folha = folhaDoVideo(video, log, { A, F, semente, serie, visual: vis && vis.visual, voz: loc && LV.blocoFolha(falasVoz, loc.perfil), cinema, pecasLogo, saida, indice })
  fs.writeFileSync(path.join(comp, 'audio', 'sheet.json'), JSON.stringify(folha, null, 2))
  let arqSrt = null
  if (loc) {
    LV.escreverVozWav(falasVoz, dur, path.join(comp, 'audio', 'voz.wav'))
    arqSrt = path.join(video.pasta, `${video.id}-${v}.srt`)
    fs.writeFileSync(arqSrt, LV.srt(falasVoz))
  }
  let trilha = null
  if (!semTrilha && !semRender) {
    for (const f of ['synth.py', 'verify.py', 'sounds.py', 'series.py', 'arrange_series.py', ...(loc ? ['mix_voz.py'] : [])]) fs.copyFileSync(path.join(AUDIO, f), path.join(comp, 'audio', f))
    const ident = path.join(serieDir, 'identity.json')
    if (!fs.existsSync(ident)) throw new Error(`the series has no identity.json (the soundtrack): ${ident}`)
    fs.copyFileSync(ident, path.join(comp, 'audio', 'identity.json'))
    const py = acharPython([serieDir, video.pasta, RAIZ])
    const a = spawnSync(py, ['arrange_series.py', 'identity.json', 'sheet.json'], { cwd: path.join(comp, 'audio'), encoding: 'utf8' })
    if (a.status !== 0) { console.log(a.stdout, a.stderr); throw new Error('arrange_series.py failed') }
    const ver = spawnSync(py, ['verify.py', 'sheet.json'], { cwd: path.join(comp, 'audio'), encoding: 'utf8' })
    if (ver.status !== 0) { console.log(ver.stdout, ver.stderr); throw new Error('verify.py failed the soundtrack') }
    trilha = path.join(comp, 'audio', 'soundtrack.wav')
    let resumo = ''
    try { const vj = JSON.parse(fs.readFileSync(path.join(comp, 'audio', 'trilha.variation.json'), 'utf8')); const va = vj.variacao || {}; resumo = ` · ${va.tom || ""} ${va.modo || ""}, ${Math.round(vj.bpm_efetivo || va.bpm || 0)} BPM` } catch { /* sem resumo */ }
    console.log(`  soundtrack: seed ${semente}${resumo} · verify.py OK`)
  }

  const final = path.join(video.pasta, `${video.id}-${v}${sufFmt}${modo === 'draft' ? '-draft' : ''}.mp4`)
  if (!semRender) {
  // 3 · render
  const out = path.join(comp, 'out', `${modo}-${fmt}.mp4`)
  const extra = modo === 'final' ? ['--fps', String(serie.fps || 60), '--sub', String(serie.sub || 4)] : []
  // navegadores do render: a série fixa (máquina dividida); sem isso, o render.cjs usa núcleos − 2
  if (serie.workers) extra.push('--workers', String(serie.workers))
  const rr = spawnSync('node', [path.join(comp, 'tools', 'render.cjs'), '--project', comp, '--mode', modo, '--format', fmt, '--out', out, ...extra], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] })
  const errosRender = (rr.stderr || '').trim()
  // quem desenhou este render (o render.cjs para sozinho, no Mac, se cair na CPU)
  const gl = /^WebGL: .*$/m.exec(rr.stdout || '')
  if (gl) console.log(`  ${gl[0]}`)
  if (rr.status === 4) { console.log('  ' + (rr.stderr || '').trim().split('\n').join('\n  ')); throw new Error('the collision/safe-area check failed the composition (list above): fix the layout or the texts, not the check') }
  if (rr.status !== 0 && rr.status !== 3) { console.log(rr.stdout, rr.stderr); throw new Error('render failed') }
  if (errosRender) console.log('  ' + errosRender.split('\n').join('\n  '))

  // 4 · mix + verificação
  if (trilha) {
    const fin = spawnSync('node', [path.join(comp, 'tools', 'finalize.mjs'), '--project', comp, '--video', out, '--audio', trilha, '--sheet', path.join(comp, 'audio', 'sheet.json'), '--out', final], { encoding: 'utf8' })
    process.stdout.write(fin.stdout.split('\n').filter((l) => /^[✓✗]/.test(l)).map((l) => '  ' + l).join('\n') + '\n')
    if (fin.status !== 0) throw new Error('finalize.mjs failed ' + final)
  } else fs.copyFileSync(out, final)
  }

  // 5 · folha de contato dos eventos no vídeo composto (obrigatória: olhe antes de mostrar)
  const tempos = new Set(indice ? [1.2, indice.ini + 0.08, indice.ini + (indice.itens.length - 1) * indice.passo + 0.2, A - 0.9, A - 0.2, A + 0.3] : [A * 0.5, A - 0.2, A + 0.3])
  for (const e of log.eventos) {
    if (e.tipo === 'toque') { tempos.add(A + e.t - 0.3); tempos.add(A + e.t); tempos.add(A + e.t + 0.35) }
    if (e.tipo === 'passo') { tempos.add(A + e.t - 0.25); tempos.add(A + e.t + 0.6) }
    if (e.tipo === 'escolhe' || e.tipo === 'sucesso') tempos.add(A + (e.t1 || e.t) + 0.4)
    if (e.tipo === 'tela') tempos.add(A + e.t + 0.3)
    if (e.tipo === 'aponta' && e.lupa) tempos.add(A + e.t + 0.6)
    if (e.tipo === 'prova') { tempos.add(A + e.t + 0.3); tempos.add(A + e.t + 0.9) }
    if (e.tipo === 'placar') { tempos.add(A + e.t + 0.45); tempos.add(A + e.t + TEMPO_PLACAR(e) + 0.4) }
    if (e.tipo === 'antes') { tempos.add(A + e.t + 0.35); tempos.add(A + e.t + e.dur + 0.3) }
    if (e.tipo === 'secao') { tempos.add(A + e.t + 0.15); tempos.add(A + e.t + 0.75); tempos.add(A + e.t + 1.1); if (e.t > SECAO_SEM_GIRO) tempos.add(A + e.t - 0.25) }
  }
  // a passagem da abertura para o painel (virar, e as outras saídas no painel do computador)
  if (vis && (vis.visual.abertura.saida === 'virar' || (cinema === 'moldura' && !toque && vis.visual.abertura.saida !== 'corte'))) { tempos.add(A - 0.2); tempos.add(A + 0.2) }
  // modo cinema: o primeiro quadro é o painel com o logo (o gancho)
  if (vis && cinema === 'moldura' && vis.visual.abertura.saida !== 'pouso') tempos.add(0.12)
  if (vis && vis.visual.abertura.saida === 'pouso') { tempos.add(A * 0.3); tempos.add(A * 0.65) }
  if (saida) { tempos.add(A + saida.de + 0.35 * saida.dur); tempos.add(A + saida.de + 0.75 * saida.dur) }
  tempos.add(A + log.duracao + 0.35); tempos.add(dur - 0.5)
  const lista = [...tempos].filter((t) => t > 0 && t < dur).sort((a, b) => a - b).map((t) => t.toFixed(2))
  const q = spawnSync('node', [path.join(comp, 'tools', 'frames.cjs'), '--project', comp, '--format', fmt, '--times', lista.join(','), '--name', 'eventos'], { encoding: 'utf8' })
  const folhaImg = (q.stdout.match(/(?:contact sheet|folha de contato): (.*)/) || [])[1]
  if (q.stderr && q.stderr.trim()) console.log('  ' + q.stderr.trim().split('\n').join('\n  '))
  // uma exceção no desenho deixa o quadro pela metade: nunca um ✓ com a página quebrada
  if (/PAGE ERROR|ERRO NA PÁGINA/.test(q.stderr || '')) throw new Error(`the video design broke in the browser (PAGE ERROR, above): ${(/(?:PAGE ERROR|ERRO NA PÁGINA): .*/.exec(q.stderr) || [''])[0]}`)
  const destinoFolha = path.join(video.pasta, `${video.id}-${v}${sufFmt}-sheet.png`)
  // sem a folha de eventos não há o que olhar: falha alto (ex.: o Playwright não foi achado), nunca um ✓ sem folha
  if (!folhaImg) throw new Error(`the event sheet did not come out (frames.cjs exited with ${q.status}): ${((q.stderr || '') + (q.stdout || '')).trim().split('\n').slice(0, 4).join(' | ') || 'no message'}`)
  fs.copyFileSync(folhaImg, destinoFolha)
  if (semRender && q.status === 4) throw new Error('the collision/safe-area check failed the composition (list above): fix the layout or the texts, not the check')
  // texto fora da imagem: a linha do tempo inteira, a 5 quadros por segundo (a folha só vê os instantes dos eventos)
  if (texto === 'fora-da-imagem') {
    const c = spawnSync('node', [path.join(comp, 'tools', 'frames.cjs'), '--project', comp, '--format', fmt, '--check', '--qps', '5'], { encoding: 'utf8' })
    const linha = (c.stdout.match(/^(?:check|checagem) .*$/m) || [''])[0]
    if (linha) console.log('  ' + linha)
    if (c.status === 4) { console.log('  ' + (c.stderr || '').trim().split('\n').join('\n  ')); throw new Error('the check failed (text over the image, collision or safe area; list above): fix the layout or the texts, not the check') }
    if (c.status && c.status !== 4) console.log('  ' + ((c.stderr || '') + (c.stdout || '')).trim().split('\n').slice(0, 4).join('\n  '))
  }
  // 6 · o que a montagem dos takes não pode cortar (ela lê este arquivo): a entrada do aparelho 3D, o logo 3D e, com a pessoa,
  // os pontos de corte. Fica ao lado do vídeo, com o mesmo nome.
  let arqCinema = null
  if (!semRender && cinema === 'moldura') {
    const D = log.duracao, pouso = vis.visual.abertura.saida === 'pouso'
    const trechos = []
    if (toque && (pouso || vis.visual.abertura.previa !== 'nenhuma')) trechos.push({ nome: 'the entrance of the 3D device', de: 0, ate: r3(pouso ? A : Math.min(A, 1.4)) })
    if (!toque && vis.visual.abertura.previa !== 'nenhuma') trechos.push({ nome: 'the entrance of the 3D panel', de: 0, ate: r3(Math.min(A, 1.6)) })
    if (pecasLogo) trechos.push({ nome: 'the 3D logo of the closing', de: r3(A + D + 0.2 + 0.55), ate: r3(Math.min(dur, A + D + 0.2 + 0.55 + (pecasLogo - 1) * 0.07 + 0.8)) })
    arqCinema = final.replace(/\.mp4$/, '.cinema.json')
    fs.writeFileSync(arqCinema, JSON.stringify({ versao: 1, video: path.basename(final), cinema, duracao: dur, trechos,
      ...(pessoa ? { pessoa: { entra: pessoa.entrada ? 0 : null, sai: saida ? r3(A + D) : null, fecho: pessoa.fecho ? r3(A + D) : null, cortes: video.pessoa } } : {}) }, null, 1))
  }
  return { final: semRender ? null : final, folha: destinoFolha, duracao: dur, colisao: q.status === 4, ...(arqCinema ? { cinema: arqCinema } : {}), ...(loc ? { srt: arqSrt, voz: path.join(comp, 'audio', 'voz.wav') } : {}) }
}

export async function compor(pasta, { versao = opt('device'), modo = opt('mode', 'draft'), semTrilha = argv.includes('--no-soundtrack'), semRender = argv.includes('--no-render'), formato = opt('format') } = {}) {
  const video = (await import(pathToFileURL(path.join(path.resolve(pasta), 'video.mjs')).href)).default
  const versoes = versao ? [versao] : (video.versoes || []).filter((v) => fs.existsSync(path.join(video.pasta, 'output', v, 'events.json')))
  if (!versoes.length) throw new Error(`nothing recorded in ${video.pasta}/output: first run node ${path.join(pasta, 'video.mjs')}`)
  const vb = await canalDoApp()
  await vb?.checarDono({ onde: `compor ${video.id}` })
  const nome = video.titulo || video.id
  const rotuloModo = { draft: 'draft' }[modo] || modo
  const res = []
  for (const v of versoes) {
    console.log(`composing ${video.id} (${v}, ${rotuloModo})…`)
    await vb?.avisar('montagem', `composing ${nome} (${v}, ${rotuloModo})`)
    const r = await comporVersao(video, v, { modo, semTrilha, semRender, formato }).catch(async (e) => {
      await vb?.avisar('erro', `${nome} (${v}): ${e.message.split('\n')[0]}`)
      throw e
    })
    console.log(`✓ ${r.final || '(no render)'} (${r.duracao.toFixed(1)} s)\n  contact sheet: ${r.folha}  ← LOOK at it before showing it to anyone`)
    await vb?.mostrar(r.folha, `Sheet: ${nome} (${v}, ${rotuloModo})`, 'folha')
    if (r.final) await vb?.mostrar(r.final, `${modo === 'final' ? 'Final' : 'Draft'}: ${nome} (${v})`)
    res.push(r)
  }
  return res
}

// caminho real dos dois lados: a skill pode ser chamada por um symlink (outra pasta de skills apontando para ~/.claude/skills), e aí o
// argv[1] não bate com o import.meta.url e o script sai calado, sem erro nenhum
if (process.argv[1] && (() => { try { return fs.realpathSync(process.argv[1]) === fs.realpathSync(fileURLToPath(import.meta.url)) } catch { return false } })()) {
  const alvo = argv.find((a, i) => !a.startsWith('--') && !(i > 0 && argv[i - 1].startsWith('--') && !['--no-soundtrack', '--no-render'].includes(argv[i - 1])))
  if (!alvo) { console.error('usage: node compose.mjs <video-folder> [--device v] [--mode draft|final] [--format 19x9] [--no-soundtrack] [--no-render]'); process.exit(1) }
  try { await compor(alvo) } catch (e) { console.error('✗ ' + e.message); process.exit(1) }
}
