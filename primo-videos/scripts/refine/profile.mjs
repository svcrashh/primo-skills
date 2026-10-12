// O gabarito de um produto: o kit da marca e os vídeos aprovados, guardados para o próximo vídeo não recomeçar do zero e
// para o refino medir contra eles. Mora em ~/Documents/VideoStudio/Brands/<product>/profile/ (a pasta de dados da skill, a
// mesma do kit e do histórico da variedade; VIDEOSTUDIO_BRANDS troca a raiz, VIDEOSTUDIO_PROFILES troca só a dos gabaritos):
//   profile.json         o formato está em references/refine.md §4
//   kit/                 cópia do template/ do projeto aprovado (kit.js, fonts/, peças da marca), sem o engine.js
//   aprovados/<name>-sheet.jpg   a folha de quadros de cada vídeo aprovado
import fs from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { raizMarcas } from '../kit.mjs'

export const REGRAS = {
  parado_max: 0.6, final_parado_min: 1.2,
  texto_min_px: 28, texto_ilegivel_px: 16, texto_excecoes: [],
  respiro_max: 1.3, fecho_respiro_max: 3.0,
}

export const slug = (s) => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'produto'
export const pastaDo = (produto) => (process.env.VIDEOSTUDIO_PROFILES ? path.join(process.env.VIDEOSTUDIO_PROFILES, slug(produto)) : path.join(raizMarcas(), slug(produto), 'profile'))

export function lerGabarito(produto) {
  const arq = path.join(pastaDo(produto), 'profile.json')
  if (!fs.existsSync(arq)) return null
  const g = JSON.parse(fs.readFileSync(arq, 'utf8'))
  return { ...g, regras: { ...REGRAS, ...(g.regras || {}) }, pasta: path.dirname(arq) }
}

// O que o video.js das cenas declara: fontes, plataforma e formatos (lido por texto: o video.js é de página, não de Node).
export function lerVideoJs(projeto) {
  const arqs = [path.join(projeto, 'video.js'), ...(fs.existsSync(path.join(projeto, 'scenes')) ? fs.readdirSync(path.join(projeto, 'scenes')).filter((c) => /^\d/.test(c)).sort().map((c) => path.join(projeto, 'scenes', c, 'video.js')) : [])].filter((f) => fs.existsSync(f))
  const out = { fontes: [], plataforma: null, formatos: [] }
  for (const f of arqs) {
    const s = fs.readFileSync(f, 'utf8')
    const lista = (re) => { const m = s.match(re); return m ? [...m[1].matchAll(/['"]([^'"]+)['"]/g)].map((x) => x[1]) : [] }
    out.fontes.push(...lista(/fontes\s*:\s*\[([^\]]*)\]/))
    out.formatos.push(...lista(/formatos\s*:\s*\[([^\]]*)\]/))
    const p = s.match(/plataforma\s*:\s*(['"])([^'"]+)\1/) || s.match(/plataforma\s*:\s*(\{[^}]*\})/)
    if (p && !out.plataforma) out.plataforma = p[2] ?? Object.fromEntries([...p[1].matchAll(/['"]?([\w]+)['"]?\s*:\s*['"]([^'"]+)['"]/g)].map((x) => [x[1], x[2]]))
  }
  return { fontes: [...new Set(out.fontes)], plataforma: out.plataforma, formatos: [...new Set(out.formatos)] }
}

export function folhaDeQuadros(mp4, destino) {
  const dur = +execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', mp4]).toString().trim()
  const { w, h } = JSON.parse(execFileSync('ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height', '-of', 'json', mp4]).toString()).streams.map((s) => ({ w: s.width, h: s.height }))[0]
  const [escala, grade] = h > w ? ['270:-1', '8x3'] : ['480:-1', '6x4']
  fs.mkdirSync(path.dirname(destino), { recursive: true })
  execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', mp4, '-vf', `fps=24/${dur},scale=${escala},tile=${grade}`, '-frames:v', '1', '-q:v', '3', destino])
  return { duracao: Math.round(dur * 1000) / 1000, largura: w, altura: h }
}

// Cria ou atualiza o gabarito a partir de um vídeo do produto. Com `aprovado`, o vídeo entra na lista e a voz dele vira
// a régua da voz apagada.
export function salvarGabarito(produto, { de = null, video = null, voz = null, aprovado = false, fontes = null, fontesExtras = null, sinteticoOk = null, plataforma = null, regras = {}, titulo = null, estilo = null } = {}) {
  const pasta = pastaDo(produto)
  fs.mkdirSync(pasta, { recursive: true })
  const arq = path.join(pasta, 'profile.json')
  const g = fs.existsSync(arq) ? JSON.parse(fs.readFileSync(arq, 'utf8')) : { versao: 1, produto, marca: {}, regras: {}, aprovados: [] }
  const vj = de ? lerVideoJs(de) : { fontes: [], plataforma: null, formatos: [] }
  if (de && fs.existsSync(path.join(de, 'template'))) {
    fs.rmSync(path.join(pasta, 'kit'), { recursive: true, force: true })
    fs.cpSync(path.join(de, 'template'), path.join(pasta, 'kit'), { recursive: true, filter: (f) => path.basename(f) !== 'engine.js' })
    g.marca.kit = 'kit/'
    g.marca.origem = de
  }
  if (fontes?.length || vj.fontes.length) g.marca.fontes = fontes?.length ? fontes : vj.fontes
  // fontes de fora de propósito (imitar o concorrente) e estilos que o próprio produto sintetiza (o site inclina)
  if (fontesExtras?.length) g.marca.fontes_extras = fontesExtras
  if (sinteticoOk?.length) g.marca.sintetico_ok = sinteticoOk
  if (plataforma || vj.plataforma) g.plataforma = plataforma || vj.plataforma
  if (vj.formatos.length) g.formatos = vj.formatos
  g.regras = { ...(g.regras || {}), ...regras }
  if (aprovado && video) {
    const nome = slug(titulo || path.basename(video, path.extname(video)))
    const folha = path.join('aprovados', `${nome}-sheet.jpg`)
    const info = folhaDeQuadros(video, path.join(pasta, folha))
    g.aprovados = (g.aprovados || []).filter((a) => a.video !== path.resolve(video))
    g.aprovados.push({ titulo: titulo || path.basename(video, path.extname(video)), video: path.resolve(video), projeto: de, folha, estilo, data: new Date().toISOString().slice(0, 10), ...info })
  }
  // a voz aprovada (refine/locucao.mjs vozDoGabarito, nos pacotes com narração) vira a régua da voz apagada
  if (aprovado && voz) g.voz = voz
  g.atualizado = new Date().toISOString().slice(0, 10)
  fs.writeFileSync(arq, JSON.stringify(g, null, 1) + '\n')
  return { ...g, pasta }
}
