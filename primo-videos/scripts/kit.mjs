#!/usr/bin/env node
// O kit do produto: o que se reaproveita entre vídeos do mesmo produto, para o próximo começar pronto e a prévia sair em
// minutos. Mora em ~/Documents/VideoStudio/Brands/<slug>/kit/ (a pasta de dados da skill, uma pasta por marca, que guarda
// também o gabarito do refino e o histórico da variedade; VIDEOSTUDIO_BRANDS troca a raiz). O formato está em references/kit.md.
//
//   node kit.mjs list                                      os kits desta máquina
//   node kit.mjs show <product>                            o que o kit guarda, e se cada arquivo está lá
//   node kit.mjs save <product> --from <video folder> [--recipe <folder>] [--reading <arq>] [--series-id <id>] [--default]
//                                                          guarda (ou atualiza) o kit a partir de um vídeo aprovado
//   node kit.mjs new-video <product> <folder> --request "…" [--voice | --no-voice] [--start <rota>] [--series <id>] [--seed N] [--device computer]
//                                                          cria a pasta do vídeo já com video.mjs, recording/, a série
//                                                          e o progresso ligados: falta só a jornada e o roteiro.
//                                                          Sem voz por padrão (os textos em texts.json); --voice liga a
//                                                          voz em off (as falas em voice/v1/script.json, com a voz
//                                                          aprovada do kit, ou ainda por escolher se ele não tem uma)
//
// O kit guarda: a leitura e a tese base; as séries por formato e idioma; a voz aprovada (id, modelo, ajustes, pronúncia,
// e os takes, que são o cache: fala igual sai sem custo); a identidade da trilha e a semente; e a receita de gravação
// (a URL, o login pelo NOME da variável do cofre, nunca a senha; o idioma da tela, os tours, a barreira de escrita, os
// dados de exemplo, a privacidade e como capturar o antes). Os arquivos da receita (recording/*.mjs) são do produto.
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath, pathToFileURL } from 'node:url'

const AQUI = path.dirname(fileURLToPath(import.meta.url))
const SKILL = path.resolve(AQUI, '..')
// A narração só existe nos pacotes com voz: sem scripts/tutorial/locucao.mjs, o vídeo novo não tem como ter voz. Com
// ela, tem só quando o vídeo pede (new-video --voice): a voz aprovada do kit não liga a voz sozinha.
const NARRACAO = fs.existsSync(path.join(AQUI, 'tutorial', 'locucao.mjs'))

export const raizMarcas = () => process.env.VIDEOSTUDIO_BRANDS || path.join(os.homedir(), 'Documents', 'VideoStudio', 'Brands')
export const slug = (s) => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
const lerJson = (a) => JSON.parse(fs.readFileSync(a, 'utf8'))
const gravarJson = (a, o) => { fs.mkdirSync(path.dirname(a), { recursive: true }); fs.writeFileSync(a, JSON.stringify(o, null, 2) + '\n') }
const agoraIso = () => new Date().toISOString()
const casa = (p) => (p && p.startsWith(os.homedir()) ? '~' + p.slice(os.homedir().length) : p)
const expandir = (p) => (p && p.startsWith('~/') ? path.join(os.homedir(), p.slice(2)) : p)

/** Os kits desta máquina: [{ slug, produto, dir }]. */
export function kits() {
  const raiz = raizMarcas()
  if (!fs.existsSync(raiz)) return []
  return fs.readdirSync(raiz).map((s) => path.join(raiz, s, 'kit')).filter((d) => fs.existsSync(path.join(d, 'kit.json')))
    .map((dir) => ({ slug: path.basename(path.dirname(dir)), produto: lerJson(path.join(dir, 'kit.json')).produto, dir }))
}

/** O kit de um produto (pelo nome ou pelo slug). Sem kit: erro que lista os que existem. */
export function lerKit(produto) {
  const s = slug(produto)
  const achado = kits().find((k) => k.slug === s || slug(k.produto) === s)
  if (!achado) {
    const tem = kits().map((k) => `${k.produto} (${k.slug})`)
    throw new Error(`there is no kit for "${produto}" in ${raizMarcas()}.${tem.length ? ` Kits: ${tem.join(', ')}.` : ''} Make the first video through the new-product flow and, once approved, save it: node ${path.join(AQUI, 'kit.mjs')} salvar "${produto}" --from <video folder>`)
  }
  return { kit: lerJson(path.join(achado.dir, 'kit.json')), dir: achado.dir }
}

// ── salvar ───────────────────────────────────────────────────────────────────────────────────────────────────────────
const NAO_COPIA = /(^|\/)(\.venv|node_modules|_teste|saida|out|previas|__pycache__|\.DS_Store|PRONTO)(\/|$)/
function copiarPasta(de, para, { filtro = (rel) => !NAO_COPIA.test(rel) } = {}) {
  fs.mkdirSync(para, { recursive: true })
  for (const n of fs.readdirSync(de)) {
    const a = path.join(de, n), b = path.join(para, n)
    const rel = path.relative(de, a)
    if (!filtro(rel)) continue
    const st = fs.statSync(a)
    if (st.isDirectory()) copiarPasta(a, b, { filtro: (r) => filtro(path.join(n, r)) })
    else fs.copyFileSync(a, b, fs.constants.COPYFILE_FICLONE)
  }
}
/** Os takes (o cache da voz): copia cada um que ainda não está lá. Devolve quantos entraram. */
function juntarTakes(de, para) {
  if (!fs.existsSync(de)) return 0
  let n = 0
  for (const ch of fs.readdirSync(de)) {
    const a = path.join(de, ch)
    if (!fs.statSync(a).isDirectory() || !fs.existsSync(path.join(a, 'take.json'))) continue
    const b = path.join(para, ch)
    if (fs.existsSync(path.join(b, 'take.json'))) continue
    fs.mkdirSync(b, { recursive: true })
    for (const f of ['take.mp3', 'take.json']) if (fs.existsSync(path.join(a, f))) fs.copyFileSync(path.join(a, f), path.join(b, f), fs.constants.COPYFILE_FICLONE)
    n++
  }
  return n
}
/** O script.json da voz mais recente do vídeo (voice/<device>/script.json). */
function roteiroDaVoz(pasta) {
  const vz = path.join(pasta, 'voice')
  if (!fs.existsSync(vz)) return null
  const cands = fs.readdirSync(vz).map((n) => path.join(vz, n, 'script.json')).filter((a) => fs.existsSync(a))
  cands.sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs)
  return cands[0] || null
}

export async function salvar(produto, { de, receita = null, serieId = null, padrao = false, leitura = null } = {}) {
  if (!de) throw new Error('salvar needs --from <approved video folder>')
  const pasta = path.resolve(expandir(de))
  if (!fs.existsSync(path.join(pasta, 'video.mjs'))) throw new Error(`${pasta} has no video.mjs: the kit comes from a video made in tutorial mode`)
  const dir = path.join(raizMarcas(), slug(produto), 'kit')
  const arqKit = path.join(dir, 'kit.json')
  const kit = fs.existsSync(arqKit) ? lerJson(arqKit) : { versao: 1, produto, slug: slug(produto), criado: agoraIso(), series: {}, voz: null, trilha: null, receita: null, videos: [] }
  const feito = []
  // a leitura e a tese base
  // (--reading: a leitura do produto, quando a do vídeo é só do que ele acrescenta)
  for (const n of ['reading.md', 'thesis.md']) {
    const de = n === 'reading.md' && leitura ? path.resolve(expandir(leitura)) : path.join(pasta, n)
    if (!fs.existsSync(de)) continue
    fs.mkdirSync(dir, { recursive: true }); fs.copyFileSync(de, path.join(dir, n))
    kit[n.replace('.md', '')] = n; feito.push(n)
  }
  // o vídeo (a definição: série, aparelho, idioma, semente)
  const video = (await import(pathToFileURL(path.join(pasta, 'video.mjs')).href)).default
  const versao = (video.versoes || ['phone'])[0]
  const ap = (video.aparelhos || {})[versao] || {}
  const idioma = video.idioma || 'en-US'
  // a série: copiada inteira; a leitura dela vai junto (o caminho relativo não sobrevive à cópia)
  const serieSrc = path.resolve(pasta, video.serie || '../serie')
  if (!fs.existsSync(path.join(serieSrc, 'series.json'))) throw new Error(`the video's series has no series.json: ${serieSrc}`)
  const sid = serieId || `${versao}-${ap.formato || '16x9'}-${idioma.slice(0, 2)}`
  const serieDir = path.join(dir, 'series', sid)
  fs.rmSync(serieDir, { recursive: true, force: true })
  copiarPasta(serieSrc, serieDir)
  const sj = lerJson(path.join(serieDir, 'series.json'))
  for (const [campo, nome] of [['leitura', 'reading.md'], ['leituraDoVideo', 'leitura-do-video.md']]) {
    if (!sj[campo]) continue
    const a = path.resolve(serieSrc, sj[campo])
    if (fs.existsSync(a)) { fs.copyFileSync(a, path.join(serieDir, nome)); sj[campo] = nome } else delete sj[campo]
  }
  gravarJson(path.join(serieDir, 'series.json'), sj)
  const eraPadrao = Object.values(kit.series).some((s) => s.padrao)
  if (padrao) for (const s of Object.values(kit.series)) s.padrao = false
  kit.series[sid] = { pasta: `series/${sid}`, versao, formato: ap.formato || null, idioma, aparelho: ap.viewport ? { viewport: ap.viewport, dsf: ap.dsf, toque: !!ap.toque, formato: ap.formato } : null, cinema: video.cinema ?? sj.cinema ?? 'moldura', padrao: padrao || !eraPadrao || !!(kit.series[sid] && kit.series[sid].padrao) }
  feito.push(`series ${sid}`)
  // a trilha: a identidade da série e a semente aprovada
  const ident = fs.existsSync(path.join(serieDir, 'identity.json')) ? lerJson(path.join(serieDir, 'identity.json')) : {}
  kit.trilha = {
    identidade: `series/${sid}/identity.json`, genero: ident.genero || null, papel: ident.papel || null, bpm: ident.bpm || null,
    semente: video.semente ?? kit.trilha?.semente ?? null,
    sem_sino: (sj.niveis && sj.niveis.sucesso === false) || !!(sj.trocar && sj.trocar.sucesso),
    trocar: sj.trocar || null,
  }
  // a voz aprovada e os takes (o cache)
  const rot = roteiroDaVoz(pasta)
  if (rot) {
    const r = lerJson(rot)
    kit.voz = { id: r.voz?.id || null, nome: r.voz?.nome || null, modelo: r.voz?.modelo || null, ajustes: r.ajustes || {}, perfil: r.perfil || video.voz?.perfil || 'calmo', idioma: r.idioma || idioma, pronuncia: r.pronuncia || {}, takes: 'voice/_takes' }
    const n = juntarTakes(path.join(pasta, 'voice', '_takes'), path.join(dir, 'voice', '_takes'))
    feito.push(`voice ${kit.voz.nome || kit.voz.id} (${n} new take(s) in the cache)`)
  }
  // a receita de gravação: os arquivos do produto (recording/*.mjs) e o receita.json, que descreve em dado o que eles fazem
  const recSrc = receita ? path.resolve(expandir(receita)) : path.join(pasta, 'recording')
  if (fs.existsSync(recSrc)) {
    const recDir = path.join(dir, 'recipe')
    const arqs = fs.readdirSync(recSrc).filter((n) => /\.(mjs|js|json|md)$/.test(n) && n !== 'journey.mjs')
    if (arqs.length) {
      fs.rmSync(recDir, { recursive: true, force: true }); fs.mkdirSync(recDir, { recursive: true })
      for (const n of arqs) fs.copyFileSync(path.join(recSrc, n), path.join(recDir, n))
      const desc = arqs.includes('recipe.json') ? lerJson(path.join(recDir, 'recipe.json')) : {}
      if (desc.login && desc.login.senha != null && !/^[A-Z][A-Z0-9_]*$/.test(String(desc.login.senha))) throw new Error('recipe.json: login.senha is the NAME of the vault variable (e.g. "PRODUTO_E2E_PASSWORD"), never the password')
      kit.receita = { ...desc, arquivos: arqs.filter((n) => n !== 'recipe.json').map((n) => `recipe/${n}`) }
      feito.push(`recipe (${arqs.join(', ')})`)
    }
  }
  const v = { pasta: casa(pasta), titulo: video.titulo || video.id, quando: agoraIso() }
  kit.videos = [...(kit.videos || []).filter((x) => x.pasta !== v.pasta), v]
  kit.atualizado = agoraIso()
  gravarJson(arqKit, kit)
  return { dir, kit, feito }
}

// ── mostrar ──────────────────────────────────────────────────────────────────────────────────────────────────────────
export function mostrar(produto) {
  const { kit, dir } = lerKit(produto)
  const ok = (rel) => (rel && fs.existsSync(path.join(dir, rel)) ? '✓' : '✗ missing')
  const rot = (k) => `  ${k.padEnd(11)}`
  const mais = ' '.repeat(13)
  const L = [`Kit ${kit.produto} — ${casa(dir)} (updated ${String(kit.atualizado || kit.criado).slice(0, 16).replace('T', ' ')})`]
  if (kit.leitura) L.push(`${rot('reading')}${ok(kit.leitura)} ${kit.leitura}`)
  if (kit.tese) L.push(`${rot('thesis')}${ok(kit.tese)} ${kit.tese} (the base; the new video adjusts the proof scene)`)
  for (const [id, s] of Object.entries(kit.series || {})) L.push(`${rot('series')}${ok(s.pasta + '/series.json')} ${id}${s.padrao ? ' (default)' : ''}: ${s.versao} ${s.formato || ''}, ${s.idioma}${s.aparelho ? `, ${s.aparelho.viewport.width}×${s.aparelho.viewport.height} DSF ${s.aparelho.dsf}` : ''}, cinema ${s.cinema}`)
  if (kit.voz) {
    const nt = fs.existsSync(path.join(dir, kit.voz.takes || 'voice/_takes')) ? fs.readdirSync(path.join(dir, kit.voz.takes || 'voice/_takes')).filter((n) => fs.existsSync(path.join(dir, kit.voz.takes || 'voice/_takes', n, 'take.json'))).length : 0
    L.push(`${rot('voice')}${kit.voz.nome || '?'} ${kit.voz.id}, ${kit.voz.modelo}, ${Object.entries(kit.voz.ajustes || {}).map(([k, v]) => `${k} ${v}`).join(', ')}, profile ${kit.voz.perfil}; pronunciation: ${Object.keys(kit.voz.pronuncia || {}).join(', ') || 'none'}; ${nt} take(s) in the cache`)
  }
  if (kit.trilha) L.push(`${rot('soundtrack')}${ok(kit.trilha.identidade)} ${kit.trilha.genero || '?'} (${kit.trilha.papel || '?'}), seed ${kit.trilha.semente ?? 'new'}${kit.trilha.sem_sino ? ', no chime' : ''}${kit.trilha.trocar ? `, swaps ${JSON.stringify(kit.trilha.trocar)}` : ''}`)
  const R = kit.receita
  if (R) {
    L.push(`${rot('recipe')}${(R.arquivos || []).map((a) => `${ok(a)} ${a}`).join(' · ')}`)
    if (R.url) L.push(`${mais}URL ${R.url}${R.inicio ? ` · starts at ${R.inicio}` : ''}`)
    if (R.login) L.push(`${mais}login ${R.login.email || R.login.usuario || '?'} · password in the variable ${R.login.senha} (${R.login.cofre || 'environment'}): never the password in the kit`)
    for (const [k, rotulo] of [['idioma_tela', 'screen language'], ['tours', 'tours'], ['barreira', 'write barrier'], ['dados_de_exemplo', 'sample data'], ['privacidade', 'privacy']]) if (R[k]) L.push(`${mais}${rotulo}: ${typeof R[k] === 'string' ? R[k] : JSON.stringify(R[k])}`)
    if (R.antes) L.push(`${mais}before: ${R.antes.como || ''} (worktree ${R.antes.worktree || '?'}, port ${R.antes.porta || '?'})`)
  }
  if ((kit.videos || []).length) L.push(`${rot('videos')}${kit.videos.map((v) => `${v.titulo} (${v.pasta})`).join(' · ')}`)
  return L.join('\n')
}

// ── novo-video ───────────────────────────────────────────────────────────────────────────────────────────────────────
/** Os blocos condicionais de um modelo .md, que podem ficar um dentro do outro: <!-- se voz --> … <!-- fim -->, e
 *  <!-- se !voz --> para o contrário. `cond` diz o que vale neste vídeo ({ voz, 'voz-do-kit' }). */
function niveis(txt, cond) {
  const out = [], pilha = []
  for (const l of txt.split('\n')) {
    const m = /^<!--\s*se\s+(!?)([\w-]+)\s*-->$/.exec(l.trim())
    if (m) { pilha.push(m[1] ? !cond[m[2]] : !!cond[m[2]]); continue }
    if (/^<!--\s*fim\s*-->$/.test(l.trim())) { pilha.pop(); continue }
    if (pilha.every(Boolean)) out.push(l)
  }
  return out.join('\n')
}

// os modelos (texto puro: o empacotador não lê import dentro deles) com {{marcas}} trocadas
const preencher = (arq, vals) => Object.entries(vals).reduce((t, [k, v]) => t.replaceAll(`{{${k}}}`, String(v)), fs.readFileSync(path.join(AQUI, 'kit', arq), 'utf8'))
const modeloVideo = ({ gravar, id, serie, semente, origem, inicio, versao, cinema, perfil, antesPorta, produto, pedido, comVoz }) => preencher('video.template.txt', {
  id, produto, data: agoraIso().slice(0, 10), pedido140: pedido.replace(/\n/g, ' ').slice(0, 140),
  arquivoTextos: comVoz ? 'voice/v1/script.json (the lines)' : 'texts.json (the texts)', arquivoFalas: comVoz ? 'voice/v1/script.json' : 'texts.json',
  checkVoz: comVoz ? ' (before the voice, from the script)' : '', gravaVoz: comVoz ? ' (with the generated voice: voice/v1/narration.json)' : '',
  caminhoTextos: comVoz ? "'voice', 'v1', 'script.json'" : "'texts.json'", gravar, serie, cinema, semente: semente == null ? 'undefined' : semente,
  origem, inicio, versao, antesPorta,
  linhaVoz: comVoz ? `  ...(ANTES ? {} : { voz: { locucao: 'voice/v1/narration.json', roteiro: 'voice/v1/script.json', perfil: '${perfil}' } }),\n` : '',
})
const modeloJornada = ({ pedido, produto }) => preencher('journey.template.txt', { produto, pedido160: pedido.replace(/\n/g, ' ').slice(0, 160) })

export function novoVideo(produto, pastaVideo, { pedido, voz = false, serie = null, semente = null, versao = null, inicio = null, progresso = true } = {}) {
  if (!pastaVideo) throw new Error('new-video needs the video folder: node kit.mjs new-video "<product>" <folder> --request "…"')
  if (!pedido) throw new Error('new-video needs --request "<what the owner asked for, in their words>"')
  const { kit, dir } = lerKit(produto)
  const pasta = path.resolve(expandir(pastaVideo))
  if (fs.existsSync(pasta) && fs.readdirSync(pasta).filter((n) => n !== '.DS_Store').length) throw new Error(`${pasta} already exists and is not empty: choose a new folder`)
  const ids = Object.keys(kit.series || {})
  if (!ids.length) throw new Error(`the ${kit.produto} kit has no series: save a video with kit.mjs save`)
  const sid = serie || ids.find((i) => kit.series[i].padrao) || ids[0]
  const S = kit.series[sid]
  if (!S) throw new Error(`the ${kit.produto} kit has no series "${serie}"; it has: ${ids.join(', ')}`)
  const R = kit.receita || {}
  if (!(R.arquivos || []).some((a) => path.basename(a) === 'base.mjs')) throw new Error(`the ${kit.produto} kit has no recording recipe (recipe/base.mjs): save it with kit.mjs save … --recipe <folder with base.mjs>`)
  // a voz é do vídeo, não do kit: só com --voice. Sem ele, é o vídeo sem voz de sempre, com os textos em texts.json,
  // mesmo que o kit guarde uma voz aprovada
  const comVoz = !!voz
  if (comVoz && !NARRACAO) throw new Error('this copy of the skill has no voice module (scripts/tutorial/locucao.mjs is missing): reinstall the skill, or run new-video without --voice (on-screen text, soundtrack and effects)')
  const V = NARRACAO ? kit.voz : null
  fs.mkdirSync(path.join(pasta, 'recording'), { recursive: true })
  for (const a of R.arquivos) fs.copyFileSync(path.join(dir, a), path.join(pasta, 'recording', path.basename(a)))
  fs.writeFileSync(path.join(pasta, 'recording', 'journey.mjs'), modeloJornada({ pedido, produto: kit.produto }))
  for (const n of ['reading.md', 'thesis.md']) if (kit[n.replace('.md', '')] && fs.existsSync(path.join(dir, n))) fs.copyFileSync(path.join(dir, n), path.join(pasta, n))
  const falas = [
    { id: 'abertura', onde: 'abertura', texto: 'TODO: the opening (it is the title on screen)' },
    { id: 'p1', onde: { passo: 1 }, texto: 'TODO: the line for step 1' },
    { id: 'fechamento', onde: 'fechamento', texto: 'TODO: the closing (it is the end text on screen)' },
  ]
  let takes = 0
  if (!comVoz) gravarJson(path.join(pasta, 'texts.json'), { idioma: S.idioma, falas })
  else {
    // kit sem voz aprovada: o roteiro sai sem `voz`, que a pessoa escolhe de ouvido (o generate recusa até lá, sem gastar)
    gravarJson(path.join(pasta, 'voice', 'v1', 'script.json'), V ? { idioma: V.idioma, perfil: V.perfil, voz: { id: V.id, nome: V.nome, modelo: V.modelo }, ajustes: V.ajustes, pronuncia: V.pronuncia, falas } : { idioma: S.idioma, perfil: 'calmo', falas })
    if (V) takes = juntarTakes(path.join(dir, V.takes || 'voice/_takes'), path.join(pasta, 'voice', '_takes'))
  }
  const id = path.basename(pasta)
  const v = versao || S.versao
  fs.writeFileSync(path.join(pasta, 'video.mjs'), modeloVideo({
    gravar: path.join(SKILL, 'scripts', 'tutorial', 'record.mjs'), id, serie: path.join(dir, S.pasta),
    semente: semente ?? kit.trilha?.semente ?? null, origem: R.url || 'https://exemplo.com', inicio: inicio || R.inicio || '/', versao: v,
    cinema: S.cinema || 'moldura', perfil: V?.perfil || 'calmo', antesPorta: R.antes?.porta || 8191, produto: kit.produto, pedido, comVoz,
  }))
  const modelo = path.join(AQUI, 'kit', 'REQUEST.template.md')
  const sub = { '{{produto}}': kit.produto, '{{pedido}}': pedido, '{{pasta}}': pasta, '{{skill}}': SKILL, '{{serie}}': sid, '{{kit}}': casa(dir), '{{voz}}': V ? `${V.nome || V.id} (${V.id}, ${V.modelo})` : '', '{{takes}}': String(takes) }
  let ped = niveis(fs.readFileSync(modelo, 'utf8'), { voz: comVoz, 'voz-do-kit': !!V })
  for (const [k, x] of Object.entries(sub)) ped = ped.replaceAll(k, x)
  fs.writeFileSync(path.join(pasta, 'REQUEST.md'), ped)
  const linhasProgresso = []
  if (progresso) {
    const pg = (...a) => { const r = spawnSync(process.execPath, [path.join(AQUI, 'progress.mjs'), ...a], { encoding: 'utf8' }); if (r.stdout.trim()) linhasProgresso.push(r.stdout.trim().split('\n').at(-1)) }
    pg('start', pasta, '--kit', ...(comVoz ? ['--voice'] : []))
    pg('done', pasta, 'reading', '--note', `${kit.produto} kit applied`)
    pg('done', pasta, 'soundtrack', '--note', `series ${sid} and soundtrack from the kit`)
  }
  return { pasta, serie: sid, takes, comVoz, vozDoKit: V ? V.nome || V.id : null, progresso: linhasProgresso }
}

// ── linha de comando ─────────────────────────────────────────────────────────────────────────────────────────────────
async function principal(argv) {
  const opt = (k) => { const i = argv.indexOf(`--${k}`); return i >= 0 ? argv[i + 1] : null }
  const COM_VALOR = ['--from', '--recipe', '--series-id', '--series', '--request', '--seed', '--device', '--reading', '--start']
  const pos = argv.filter((a, i) => !a.startsWith('--') && !(i > 0 && COM_VALOR.includes(argv[i - 1])))
  const [cmd, produto, alvo] = pos
  if (cmd === 'list') {
    const ks = kits()
    console.log(ks.length ? ks.map((k) => `${k.produto} (${k.slug}) — ${casa(k.dir)}`).join('\n') : `no kits in ${raizMarcas()}`)
    return 0
  }
  if (cmd === 'show' && produto) { console.log(mostrar(produto)); return 0 }
  if (cmd === 'save' && produto) {
    const r = await salvar(produto, { de: opt('from'), receita: opt('recipe'), serieId: opt('series-id'), padrao: argv.includes('--default'), leitura: opt('reading') })
    console.log(`✓ ${r.kit.produto} kit saved in ${casa(r.dir)}: ${r.feito.join(' · ')}\n`)
    console.log(mostrar(produto))
    return 0
  }
  if (cmd === 'new-video' && produto) {
    if (argv.includes('--voice') && argv.includes('--no-voice')) throw new Error('new-video takes --voice or --no-voice, not both')
    const r = novoVideo(produto, alvo, { pedido: opt('request'), voz: argv.includes('--voice'), serie: opt('series'), semente: opt('seed') != null ? Number(opt('seed')) : null, versao: opt('device'), inicio: opt('start') })
    const comoVoz = !r.comVoz ? 'without voice' : r.vozDoKit ? `with the kit's voice (${r.vozDoKit}), ${r.takes} voice take(s) in the cache` : 'with a voiceover, the voice still to be chosen'
    console.log(`✓ ${r.pasta} created with the kit (series ${r.serie}, ${comoVoz})`)
    console.log(`  only missing: recording/journey.mjs and ${r.comVoz ? 'voice/v1/script.json' : 'texts.json'} — the path is in ${path.join(r.pasta, 'REQUEST.md')}`)
    if (!r.comVoz && r.vozDoKit && !argv.includes('--no-voice')) console.log(`  the kit holds an approved voice (${r.vozDoKit}), left out: a video only has a voiceover when it asks for one (new-video … --voice)`)
    for (const l of r.progresso) console.log(l)
    return 0
  }
  console.error('usage: node kit.mjs list | show <product> | save <product> --from <folder> [--recipe <folder>] [--series-id id] [--default] | new-video <product> <folder> --request "…" [--voice | --no-voice] [--series id] [--seed N]')
  return 2
}

if (process.argv[1] && (() => { try { return fs.realpathSync(process.argv[1]) === fs.realpathSync(fileURLToPath(import.meta.url)) } catch { return false } })()) {
  principal(process.argv.slice(2)).then((c) => { process.exitCode = c }, (e) => { console.error(`kit: ${e.message}`); process.exitCode = 2 })
}
