#!/usr/bin/env node
// Colhe fatos de um repositório para quem vai escrever a "leitura" do produto: pacote, cores (tokens e onde
// cada uma é usada), superfícies, fontes, tipografia, forma, densidade, arquivos de marca, documentos,
// vocabulário das telas, som e os vídeos e séries que já existem (no projeto, nas worktrees e nas pastas
// irmãs). Cada fato vem com arquivo:linha. Não interpreta nada.
// Segredo: não abre arquivo com nome de segredo e descarta, inteiro, arquivo com linha que parece segredo.
// Uso: node scripts/reading.mjs <project-folder> [--out <folder>]
//      → <output>/leitura.bruta.json e <output>/leitura.bruta.md (padrão: pasta atual)
import fs from 'node:fs'
import path from 'node:path'

const inicio = Date.now()
const args = process.argv.slice(2)
const pos = []
let saida = process.cwd()
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--out') saida = path.resolve(args[++i] || '.')
  else pos.push(args[i])
}
if (!pos[0]) {
  console.error('usage: node scripts/reading.mjs <project-folder> [--out <folder>]')
  process.exit(1)
}
const raiz = path.resolve(pos[0])
if (!fs.existsSync(raiz) || !fs.statSync(raiz).isDirectory()) {
  console.error(`${fs.existsSync(raiz) ? `${raiz} is a file, not a folder.` : `Folder not found: ${raiz}.`}\nPass the root folder of the project to read, for example:\n  node scripts/reading.mjs ~/Documents/GitHub/my-app --out ./leitura`)
  process.exit(1)
}

const PULAR = new Set('node_modules .git dist build out .next .astro .nuxt .svelte-kit coverage android ios Pods vendor .venv venv __pycache__ test-results playwright-report .turbo .cache tmp'.split(' '))
const OCULTAS_UTEIS = new Set(['.storybook'])
const MAX_BYTES = 1_000_000
const MAX_ARQUIVOS = 20_000
const MAX_DOCS = 80
const TRAVAS = new Set(['package-lock.json', 'yarn.lock', 'pnpm-lock.yaml', 'deno.lock', 'bun.lockb', 'composer.lock'])
const EXT = {
  estilo: ['css', 'scss', 'sass', 'less'],
  marcacao: ['html', 'htm', 'vue', 'svelte', 'astro'],
  script: ['js', 'jsx', 'ts', 'tsx', 'mjs', 'cjs'],
  dados: ['json', 'webmanifest'],
  doc: ['md', 'mdx'],
  imagem: ['svg', 'png', 'jpg', 'jpeg', 'webp', 'gif', 'avif', 'ico', 'pdf', 'ai', 'fig'],
  audio: ['mp3', 'wav', 'ogg', 'm4a', 'flac', 'aac'],
}
const TIPO = {}
for (const [t, l] of Object.entries(EXT)) for (const e of l) TIPO[e] = t

const NOME_SEGREDO = [/^\.env(\..*)?$/i, /\.(pem|key|p12|pfx|keystore|jks|crt|cer|mobileprovision)$/i, /^id_rsa/i, /credencia/i, /credential/i, /secret/i, /segredo/i, /token/i, /^service-account.*\.json$/i, /^google-services\.json$/i, /^GoogleService-Info\.plist$/i, /^\.npmrc$/i, /^\.netrc$/i]
const TOKEN_DE_DESIGN = /tokens?[\w .-]*\.(css|scss|sass|less)$|tokens[\w .-]*\.mdx?$|(^|[-_])(design-)?tokens([-_.][\w.-]*)?\.(json|ts|js|mjs|cjs)$/i
const nomeDeSegredo = (n) => {
  const casou = NOME_SEGREDO.filter((r) => r.test(n))
  return casou.length > 0 && !(casou.length === 1 && casou[0].source === 'token' && TOKEN_DE_DESIGN.test(n) && !/^tokens?\.json$/i.test(n))
}
const PADROES_SEGREDO = [
  /\bsk-[A-Za-z0-9_-]{16,}/, /\bsk_live_[A-Za-z0-9]{8,}/, /\bAKIA[0-9A-Z]{16}\b/, /\bghp_[A-Za-z0-9]{20,}/, /\bgithub_pat_\w{20,}/,
  /\bxox[bap]-[A-Za-z0-9-]{10,}/, /-----BEGIN [A-Z ]*PRIVATE KEY-----/, /\beyJ[\w-]{8,}\.eyJ[\w-]{8,}/, /\bAIza[\w-]{30,}/,
  /(api[_-]?key|secret|token|password|senha|passwd|private[_-]?key|client[_-]?secret)['"]?\s*[:=]\s*(['"])(?![A-Za-zÀ-ÿ][a-zà-ÿ]*\2)[^'"\s]{8,}\2/i,
  /\b[A-Z0-9_]*(KEY|SECRET|TOKEN|PASSWORD|PASS|PASSWD|SENHA)[A-Z0-9_]*\s*(=\s*(?![\w$]+[.(]|\$|<|\{)[^\s'"`]{8,}|:\s*(?=[^\s'"`]*\d)(?![\w$]+[.(<[])[^\s'"`(<[]{12,})/,
]

const TONS = ['50', '100', '200', '300', '400', '500', '600', '700', '800', '900', '950']
const PALETA = { white: '#FFFFFF', black: '#000000' }
for (const f of 'red:fef2f2,ffe2e2,ffc9c9,ffa2a2,ff6467,fb2c36,e7000b,c10007,9f0712,82181a,460809 orange:fff7ed,ffedd4,ffd6a7,ffb86a,ff8904,ff6900,f54900,ca3500,9f2d00,7e2a0c,441306 amber:fffbeb,fef3c6,fee685,ffd230,ffb900,fe9a00,e17100,bb4d00,973c00,7b3306,461901 yellow:fefce8,fef9c2,fff085,ffdf20,fdc700,f0b100,d08700,a65f00,894b00,733e0a,432004 lime:f7fee7,ecfcca,d8f999,bbf451,9ae600,7ccf00,5ea500,497d00,3c6300,35530e,192e03 green:f0fdf4,dcfce7,b9f8cf,7bf1a8,05df72,00c950,00a63e,008236,016630,0d542b,032e15 emerald:ecfdf5,d0fae5,a4f4cf,5ee9b5,00d492,00bc7d,009966,007a55,006045,004f3b,002c22 teal:f0fdfa,cbfbf1,96f7e4,46ecd5,00d5be,00bba7,009689,00786f,005f5a,0b4f4a,022f2e cyan:ecfeff,cefafe,a2f4fd,53eafd,00d3f2,00b8db,0092b8,007595,005f78,104e64,053345 sky:f0f9ff,dff2fe,b8e6fe,74d4ff,00bcff,00a6f4,0084d1,0069a8,00598a,024a70,052f4a blue:eff6ff,dbeafe,bedbff,8ec5ff,51a2ff,2b7fff,155dfc,1447e6,193cb8,1c398e,162456 indigo:eef2ff,e0e7ff,c6d2ff,a3b3ff,7c86ff,615fff,4f39f6,432dd7,372aac,312c85,1e1a4d violet:f5f3ff,ede9fe,ddd6ff,c4b4ff,a684ff,8e51ff,7f22fe,7008e7,5d0ec0,4d179a,2f0d68 purple:faf5ff,f3e8ff,e9d4ff,dab2ff,c27aff,ad46ff,9810fa,8200db,6e11b0,59168b,3c0366 fuchsia:fdf4ff,fae8ff,f6cfff,f4a8ff,ed6aff,e12afb,c800de,a800b7,8a0194,721378,4b004f pink:fdf2f8,fce7f3,fccee8,fda5d5,fb64b6,f6339a,e60076,c6005c,a3004c,861043,510424 rose:fff1f2,ffe4e6,ffccd3,ffa1ad,ff637e,ff2056,ec003f,c70036,a50036,8b0836,4d0218 slate:f8fafc,f1f5f9,e2e8f0,cad5e2,90a1b9,62748e,45556c,314158,1d293d,0f172b,020618 gray:f9fafb,f3f4f6,e5e7eb,d1d5dc,99a1af,6a7282,4a5565,364153,1e2939,101828,030712 zinc:fafafa,f4f4f5,e4e4e7,d4d4d8,9f9fa9,71717b,52525c,3f3f46,27272a,18181b,09090b neutral:fafafa,f5f5f5,e5e5e5,d4d4d4,a1a1a1,737373,525252,404040,262626,171717,0a0a0a stone:fafaf9,f5f5f4,e7e5e4,d6d3d1,a6a09b,79716b,57534d,44403b,292524,1c1917,0c0a09'.split(' ')) {
  const [nome, hs] = f.split(':')
  hs.split(',').forEach((h, i) => { PALETA[`${nome}-${TONS[i]}`] = '#' + h.toUpperCase() })
}

const STOP_PT = new Set('o os da do das dos em na nas nos um uma umas uns para por com sem que não mais mas ao aos à às seu sua seus suas meu minha você vocês ele ela eles elas isso isto esta este essa esse já também como quando onde muito pelo pela pelos pelas há ser foi são está estão tem ter vai sobre até depois antes entre agora aqui cada ou é e de'.split(' '))
const STOP_EN = new Set('the an and of to in on for with without from by is are was were be been it its this that these those you your we our they their he she his her not but if then so at into about up out all any can will just more than also how what when where who which or'.split(' '))
const PALAVRAS_DOC = ['público', 'usuário', 'usuária', 'usuários', 'usuárias', 'cliente', 'clientes', 'persona', 'personas', 'perfil', 'perfis', 'público-alvo', 'segmento', 'segmentos', 'nicho', 'mercado', 'para quem', 'quem usa', 'audience', 'user', 'users', 'customer', 'customers', 'target', 'marca', 'identidade', 'voz', 'tom', 'brand', 'tone', 'voice', 'estilo', 'visual', 'paleta', 'tipografia', 'música', 'som', 'proposta', 'missão', 'promessa', 'posicionamento', 'concorrente', 'concorrentes', 'recusou', 'recusado', 'recusada', 'recusados', 'reprovado', 'reprovada', 'aprovado', 'aprovou', 'feedback']
const PALAVRAS_SOM = ['soundcloud', 'spotify', 'mixcloud', 'beatport', 'deezer', 'bandcamp', 'playlist', 'playlists', 'bpm', 'trilha sonora', 'música', 'músicas', 'music', 'áudio', 'audio', 'som', 'sons', 'sound', 'sounds', 'dj', 'djs', 'techno', 'house music', 'tech house', 'deep house', 'funk', 'trap', 'hip hop', 'hip-hop', 'rap', 'sertanejo', 'pagode', 'samba', 'forró', 'lo-fi', 'lofi', 'jazz', 'eletrônica', 'edm', 'drum and bass', 'reggaeton', 'piseiro', 'axé', 'mpb', 'rock']
const DEPS_DE_CARA = /^(@fontsource(-variable)?\/|tailwindcss$|@tailwindcss\/|lucide|@radix-ui\/|shadcn|@shadcn\/|framer-motion$|motion$|three$|@react-three\/|gsap$|lottie|@lottiefiles\/|@headlessui\/|@heroicons\/|react-icons$|@mui\/|@chakra-ui\/|antd$|@mantine\/|daisyui$|@phosphor-icons\/|@tabler\/icons|styled-components$|@emotion\/|class-variance-authority$|tailwind-merge$|vaul$|sonner$|cmdk$|recharts$|chart\.js$|@capacitor\/core$|howler$|tone$|@fortawesome\/|swiper$|embla-carousel)/
const ALVOS_SUPERFICIE = /^(html|body|main|:root|#root|#app|#__next)(?=$|[.\[:])/
const PESO_CLASSE = { thin: 100, extralight: 200, light: 300, normal: 400, medium: 500, semibold: 600, bold: 700, extrabold: 800, black: 900 }

const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
const cmp = (a, b) => (a < b ? -1 : a > b ? 1 : 0)
const inc = (o, k, n = 1) => { o[k] = (o[k] || 0) + n }
const ordenar = (o) => Object.entries(o).sort((a, b) => b[1] - a[1] || cmp(a[0], b[0]))
const rel = (abs) => path.relative(raiz, abs).split(path.sep).join('/') || '.'
const profundidade = (r) => r.split('/').length
const temSegredo = (s) => PADROES_SEGREDO.some((r) => r.test(s))
const suspeito = (p) => {
  p = p.replace(/^[^\w]+|[^\w=]+$/g, '')
  return p.length >= 24 && /^[\w+/=.-]+$/.test(p) && ((/[a-z]/.test(p) && /[A-Z]/.test(p) && /\d/.test(p)) || /^[0-9a-f]{32,}$/i.test(p))
}
const classesDe = (p) => [/[a-z]/, /[A-Z]/, /\d/, /[^\w\s]/].filter((r) => r.test(p)).length
const regexPalavras = (lista) => new RegExp(`(?<![\\p{L}\\p{N}_])(${[...lista].sort((a, b) => b.length - a.length).map(esc).join('|')})(?![\\p{L}\\p{N}_])`, 'giu')

const janela = (s, pos) => (s.length <= 120 || !(pos > 30) ? s : '…' + s.slice(pos - 30, pos + 150))
function trecho(s, max = 120) {
  if (temSegredo(s)) return null
  const t = s.replace(/\s+/g, ' ').trim().split(' ').map((p) => (suspeito(p) ? '[omitted]' : p)).join(' ')
  return t.length > max ? t.slice(0, max - 1) + '…' : t
}

function contador() { return new Map() }
function somar(m, chave, local, texto, n = 1) {
  let e = m.get(chave)
  if (!e) m.set(chave, (e = { n: 0, exemplos: [] }))
  e.n += n
  if (local && e.exemplos.length < 3) {
    const t = texto === undefined ? undefined : trecho(texto)
    e.exemplos.push(t ? { local, trecho: t } : { local })
  }
}
const listar = (m, lim = 60) => [...m].sort((a, b) => b[1].n - a[1].n || cmp(a[0], b[0])).slice(0, lim).map(([valor, e]) => ({ valor, n: e.n, exemplos: e.exemplos }))
const totalDe = (m) => [...m.values()].reduce((s, e) => s + e.n, 0)

function lerCor(v) {
  v = v.trim().toLowerCase().replace(/\s*!important$/, '')
  let m
  if ((m = v.match(/^#([0-9a-f]+)$/)) && [3, 4, 6, 8].includes(m[1].length)) {
    let h = m[1]
    if (h.length <= 4) h = [...h].map((c) => c + c).join('')
    return { r: parseInt(h.slice(0, 2), 16), g: parseInt(h.slice(2, 4), 16), b: parseInt(h.slice(4, 6), 16), a: h.length === 8 ? parseInt(h.slice(6), 16) / 255 : 1 }
  }
  if (v === 'white') return { r: 255, g: 255, b: 255, a: 1 }
  if (v === 'black') return { r: 0, g: 0, b: 0, a: 1 }
  if (v === 'transparent') return { r: 0, g: 0, b: 0, a: 0 }
  if ((m = v.match(/^rgba?\(([^()]*)\)$/))) {
    const p = m[1].split(/[\s,/]+/).filter(Boolean)
    if (p.length < 3) return null
    const c = p.slice(0, 3).map((x) => (x.endsWith('%') ? parseFloat(x) * 2.55 : parseFloat(x)))
    return c.some(isNaN) ? null : { r: c[0], g: c[1], b: c[2], a: alfa(p[3]) }
  }
  if ((m = v.match(/^hsla?\(([^()]*)\)$/))) return hsl(m[1])
  if ((m = v.match(/^oklch\(([^()]*)\)$/))) return oklch(m[1])
  if (/^-?[\d.]+(deg)?\s+[\d.]+%\s+[\d.]+%(\s*\/\s*[\d.]+%?)?$/.test(v)) return hsl(v)
  if ((m = v.match(/^(\d{1,3})\s+(\d{1,3})\s+(\d{1,3})$/)) && m.slice(1).every((x) => +x <= 255)) return { r: +m[1], g: +m[2], b: +m[3], a: 1 }
  return null
}
const alfa = (x) => (x === undefined || x === 'none' ? 1 : x.endsWith('%') ? parseFloat(x) / 100 : parseFloat(x))
function hsl(txt) {
  const p = txt.split(/[\s,/]+/).filter(Boolean)
  if (p.length < 3) return null
  const h = (((parseFloat(p[0]) % 360) + 360) % 360) / 360, s = parseFloat(p[1]) / 100, l = parseFloat(p[2]) / 100
  if ([h, s, l].some(isNaN)) return null
  const f = (n) => { const k = (n + h * 12) % 12, a = s * Math.min(l, 1 - l); return 255 * (l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1))) }
  return { r: f(0), g: f(8), b: f(4), a: alfa(p[3]) }
}
function oklch(txt) {
  const p = txt.split(/[\s/]+/).filter(Boolean)
  if (p.length < 3) return null
  const L = p[0].endsWith('%') ? parseFloat(p[0]) / 100 : parseFloat(p[0])
  const C = p[1] === 'none' ? 0 : p[1].endsWith('%') ? (parseFloat(p[1]) / 100) * 0.4 : parseFloat(p[1])
  const H = p[2] === 'none' ? 0 : parseFloat(p[2])
  if ([L, C, H].some(isNaN)) return null
  const a = C * Math.cos((H * Math.PI) / 180), b = C * Math.sin((H * Math.PI) / 180)
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3, m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3, s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3
  const g = (x) => 255 * Math.min(1, Math.max(0, x <= 0.0031308 ? 12.92 * x : 1.055 * x ** (1 / 2.4) - 0.055))
  return { r: g(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s), g: g(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s), b: g(-0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s), a: alfa(p[3]) }
}
function infoCor(c) {
  const [r, g, b] = [c.r, c.g, c.b].map((x) => Math.round(Math.min(255, Math.max(0, x))))
  const lin = (x) => { x /= 255; return x <= 0.04045 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4 }
  const luminancia = +(0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b)).toFixed(4)
  const a = +Math.min(1, Math.max(0, isNaN(c.a) ? 1 : c.a)).toFixed(2)
  const hex = '#' + [r, g, b].map((x) => x.toString(16).padStart(2, '0')).join('').toUpperCase()
  return { hex, ...(a < 1 ? { alfa: a } : {}), luminancia, classe: luminancia < 0.1 ? 'escura' : luminancia > 0.5 ? 'clara' : 'media' }
}
const chaveLiteral = (i) => i.hex + (i.alfa !== undefined ? `/${Math.round(i.alfa * 100)}%` : '')
const RE_COR_LITERAL = /(?<![&\w/#])#[0-9a-fA-F]{3,8}(?![\w-])|\b(?:rgba?|hsla?|oklch)\([^()]*\)/g

// ── 1. Caminhada ────────────────────────────────────────────────────────────
const ignorados = { segredos: [], pastas: [], limites: [] }
const arquivos = []
let vistos = 0
{
  const pilha = [raiz]
  let estourou = false
  while (pilha.length && !estourou) {
    const dir = pilha.pop()
    let itens
    try { itens = fs.readdirSync(dir, { withFileTypes: true }) } catch { ignorados.limites.push(`no permission to read ${rel(dir)}`); continue }
    itens.sort((a, b) => cmp(a.name, b.name))
    const subpastas = []
    for (const it of itens) {
      const abs = path.join(dir, it.name)
      if (it.isSymbolicLink()) continue
      if (it.isDirectory()) {
        if (abs === saida) continue
        if (PULAR.has(it.name) || (it.name.startsWith('.') && !OCULTAS_UTEIS.has(it.name))) ignorados.pastas.push(rel(abs))
        else subpastas.push(abs)
      } else if (it.isFile()) {
        if (/^leitura\.bruta\.(json|md)$/.test(it.name)) continue
        if (++vistos > MAX_ARQUIVOS) { estourou = true; break }
        if (nomeDeSegredo(it.name)) { ignorados.segredos.push({ arquivo: rel(abs), motivo: 'nome' }); continue }
        const ext = path.extname(it.name).slice(1).toLowerCase()
        if (TIPO[ext]) arquivos.push({ abs, rel: rel(abs), nome: it.name, ext, tipo: TIPO[ext] })
      }
    }
    pilha.push(...subpastas.reverse())
  }
  if (estourou) ignorados.limites.push(`stopped at ${MAX_ARQUIVOS} files: the rest of the tree was not read`)
}

// ── 2. Leitura dos textos (com filtro de segredo) ───────────────────────────
const textos = []
for (const a of arquivos) {
  if (!['estilo', 'marcacao', 'script', 'dados', 'doc'].includes(a.tipo)) continue
  if (TRAVAS.has(a.nome) || /\.min\.(js|css)$|\.map$/.test(a.nome)) continue
  a.bytes = fs.statSync(a.abs).size
  if (a.bytes > MAX_BYTES) { ignorados.limites.push(`${a.rel}: ${a.bytes} bytes, above the 1 MB cap`); continue }
  const texto = fs.readFileSync(a.abs, 'utf8').replace(/^﻿/, '')
  const linhas = texto.split(/\r?\n/)
  if (linhas.some(temSegredo)) { ignorados.segredos.push({ arquivo: a.rel, motivo: 'conteúdo' }); continue }
  textos.push({ ...a, texto, linhas })
}
function linhaDe(arq, idx) {
  if (!arq.inicios) { arq.inicios = [0]; for (let i = 0; i < arq.texto.length; i++) if (arq.texto[i] === '\n') arq.inicios.push(i + 1) }
  let lo = 0, hi = arq.inicios.length - 1
  while (lo < hi) { const m = (lo + hi + 1) >> 1; if (arq.inicios[m] <= idx) lo = m; else hi = m - 1 }
  return lo + 1
}
const achaLinha = (arq, re) => { const i = arq.linhas.findIndex((l) => re.test(l)); return i < 0 ? null : i + 1 }
const local = (arq, n) => (n ? `${arq.rel}:${n}` : arq.rel)
const lerJson = (arq) => { try { return JSON.parse(arq.texto) } catch { return null } }
const ehTeste = (r) => /(\.test\.|\.spec\.|\.stories\.|(^|\/)(e2e|tests?|__tests__|__mocks__|mocks?|fixtures?|__fixtures__)\/)/.test(r)
const CRITERIO_FORA = 'tests, fixtures, mocks, stories and the docs/ folder are left out of colors, fonts, shape, density and vocabulary (docs/ still counts for documents and sound)'
for (const a of textos) a.fora = ehTeste(a.rel) || a.rel.startsWith('docs/')

// ── 3. CSS: declarações e regras ────────────────────────────────────────────
function lerCss(texto, base, comentarioDuplo) {
  const decls = [], regras = [], pilha = [], blocos = []
  let buf = '', ini = base, linha = base, par = 0, aspas = '', bloco = 0
  const emitir = (t) => {
    const seletor = pilha.join(' '), b = blocos[blocos.length - 1] || 0
    if (t[0] === '@') { const m = t.match(/^@([\w-]+)\s*(.*)$/); if (m) decls.push({ prop: '@' + m[1], valor: m[2], seletor, linha: ini, bloco: b }); return }
    const k = t.indexOf(':')
    if (k > 0) { const p = t.slice(0, k).trim(); decls.push({ prop: p.startsWith('--') ? p : p.toLowerCase(), valor: t.slice(k + 1).trim(), seletor, linha: ini, bloco: b }) }
  }
  for (let i = 0; i < texto.length; i++) {
    const c = texto[i]
    if (aspas) { buf += c; if (c === '\n') linha++; if (c === aspas && texto[i - 1] !== '\\') aspas = ''; continue }
    if (c === '/' && texto[i + 1] === '*') {
      const f = texto.indexOf('*/', i + 2), fim = f < 0 ? texto.length : f + 2
      for (let k = i; k < fim; k++) if (texto[k] === '\n') linha++
      i = fim - 1
      continue
    }
    if (comentarioDuplo && par === 0 && c === '/' && texto[i + 1] === '/') { const f = texto.indexOf('\n', i); i = (f < 0 ? texto.length : f) - 1; continue }
    if (c === '\n') linha++
    if (par === 0 && (c === '{' || c === ';' || c === '}')) {
      const t = buf.replace(/\s+/g, ' ').trim()
      if (c === '{') { pilha.push(t); blocos.push(++bloco); regras.push({ proprio: t, seletor: pilha.join(' '), linha: ini }) }
      else if (t) emitir(t)
      if (c === '}') { pilha.pop(); blocos.pop() }
      buf = ''
      continue
    }
    if (c === '"' || c === "'") aspas = c
    else if (c === '(') par++
    else if (c === ')') par = Math.max(0, par - 1)
    if (!buf.trim() && !/\s/.test(c)) ini = linha
    buf += c
  }
  if (buf.trim()) emitir(buf.replace(/\s+/g, ' ').trim())
  return { decls, regras }
}

const decls = [], regras = []
for (const arq of textos) {
  if (arq.fora) continue
  const juntar = (r) => { for (const d of r.decls) decls.push({ ...d, arq }); for (const g of r.regras) regras.push({ ...g, arq }) }
  if (arq.tipo === 'estilo') juntar(lerCss(arq.texto, 1, arq.ext !== 'css'))
  if (arq.tipo === 'marcacao') {
    arq.linhasEstilo = new Set()
    for (const m of arq.texto.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/gi)) {
      const base = linhaDe(arq, m.index + m[0].indexOf('>') + 1)
      juntar(lerCss(m[1], base, /lang=["'](scss|sass|less)/.test(m[0])))
      const fim = base + m[1].split('\n').length - 1
      for (let n = base; n <= fim; n++) arq.linhasEstilo.add(n)
    }
  }
}

// ── 4. Tokens: CSS, tailwind.config e arquivos de tokens ────────────────────
const tokens = new Map()
const defToken = (nome, d) => { if (!tokens.has(nome)) tokens.set(nome, []); tokens.get(nome).push(d) }
for (const d of decls) if (d.prop.startsWith('--') || d.prop.startsWith('$')) defToken(d.prop, { valor: d.valor, seletor: d.seletor, local: `${d.arq.rel}:${d.linha}`, origem: 'css' })

function blocoDe(texto, iAbre) {
  let prof = 0
  for (let i = iAbre; i < texto.length; i++) {
    if (texto[i] === '{') prof++
    else if (texto[i] === '}' && --prof === 0) return texto.slice(iAbre + 1, i)
  }
  return texto.slice(iAbre + 1)
}
function folhas(txt, linha0) {
  const out = [], pilha = []
  const re = /['"]?([\w$.-]+)['"]?\s*:\s*(?:(\{)|\[([^\]]*)\]|(['"`])([^'"`]*)\4)|(\})/g
  txt.split('\n').forEach((l, i) => {
    for (const m of l.matchAll(re)) {
      if (m[6]) pilha.pop()
      else if (m[2]) pilha.push(m[1])
      else out.push({ nome: [...pilha, m[1]].filter((k) => k !== 'DEFAULT').join('-'), valor: m[3] !== undefined ? m[3] : m[5], linha: linha0 + i })
    }
  })
  return out
}
const configTailwind = { darkMode: [], raios: [], sombras: [] }
for (const arq of textos) {
  if (arq.fora) continue
  const tw = /^tailwind\.config\.(js|cjs|mjs|ts)$/.test(arq.nome)
  const tk = /(^|[-_])(tokens|theme|colors|colours)([-_.][\w-]+)*\.(json|js|ts|mjs|cjs)$/i.test(arq.nome)
  if (!tw && !tk) continue
  arq.ehTokens = true
  if (tk) {
    const prefixo = arq.nome.replace(/\.[^.]+$/, '')
    for (const f of folhas(arq.texto, 1)) if (lerCor(f.valor) || /var\(--/.test(f.valor)) defToken(`${prefixo}.${f.nome}`, { valor: f.valor, seletor: '', local: `${arq.rel}:${f.linha}`, origem: 'token file' })
    continue
  }
  for (const [chave, destino] of [['colors', 'cor'], ['fontFamily', 'font'], ['borderRadius', 'raio'], ['boxShadow', 'sombra']]) {
    for (const m of arq.texto.matchAll(new RegExp(`\\b${chave}\\s*:\\s*\\{`, 'g'))) {
      const iAbre = m.index + m[0].length - 1
      for (const f of folhas(blocoDe(arq.texto, iAbre), linhaDe(arq, iAbre))) {
        const d = { valor: f.valor, seletor: '', local: `${arq.rel}:${f.linha}`, origem: 'tailwind.config' }
        if (destino === 'cor') defToken(`tailwind.${f.nome}`, d)
        else if (destino === 'font') defToken(`tailwind.font.${f.nome}`, d)
        else (destino === 'raio' ? configTailwind.raios : configTailwind.sombras).push({ nome: f.nome, valor: f.valor, local: d.local })
      }
    }
  }
  const n = achaLinha(arq, /darkMode\s*:/)
  if (n) configTailwind.darkMode.push({ valor: arq.linhas[n - 1].trim().slice(0, 80), local: local(arq, n) })
}

const neutro = (s) => !/\.dark\b|prefers-color-scheme:\s*dark|\[data-/.test(s)
function defPreferida(nome, seletor) {
  const defs = tokens.get(nome)
  if (!defs) return null
  return (seletor !== undefined && defs.find((d) => d.seletor === seletor)) || defs.find((d) => neutro(d.seletor)) || defs[0]
}
function resolver(valor, seletor, prof = 0) {
  if (prof > 8) return valor
  return valor.replace(/var\(\s*(--[\w-]+)\s*(?:,\s*([^()]*(?:\([^()]*\))?[^()]*))?\)/g, (tudo, n, reserva) => {
    const d = defPreferida(n, seletor)
    return d ? resolver(d.valor, seletor, prof + 1) : reserva ? resolver(reserva, seletor, prof + 1) : tudo
  })
}
function corDoValor(valor, seletor, parcial = false) {
  const v = resolver(valor, seletor).trim()
  let c = lerCor(v)
  if (!c && parcial) { const m = v.match(RE_COR_LITERAL); if (m) c = lerCor(m[0]) }
  return c ? infoCor(c) : null
}

const tokensCor = new Map()
for (const [nome, defs] of tokens) {
  const cores = defs.map((d) => corDoValor(d.valor, d.seletor))
  if (!cores.some(Boolean)) continue
  const p = defPreferida(nome)
  const alias = (p.valor.match(/var\(\s*(--[\w-]+)/) || [])[1]
  const semVar = p.valor.replace(/var\([^)]*\)/g, '')
  const literal = /#[0-9a-f]{3,8}\b|(rgba?|hsla?|oklch)\(\s*[\d.]/i.test(semVar)
  tokensCor.set(nome, { defs, cores, cor: corDoValor(p.valor, p.seletor), alias_de: alias && !literal ? alias : undefined })
}
const ehFonteToken = (n) => (/^--([\w-]*-)?(font|ff|family|typeface)(-|$)/i.test(n) && !/(weight|size|feature|variation|smoothing|stretch|leading|tracking|line-height|display-mode)/i.test(n)) || n.startsWith('tailwind.font.')

// ── 5. Uso: classes, var(), literais, CSS ───────────────────────────────────
const usos = new Map()
function usar(chave, contexto, arquivo, linha, texto) {
  let u = usos.get(chave)
  if (!u) usos.set(chave, (u = { total: 0, contextos: {}, arquivos: {}, exemplos: [], porArquivo: {} }))
  u.total++
  inc(u.contextos, contexto)
  inc(u.arquivos, arquivo)
  if (u.exemplos.length < 8 && (u.porArquivo[arquivo] || 0) < 2) {
    const t = trecho(texto)
    if (t) { u.exemplos.push({ local: `${arquivo}:${linha}`, contexto, trecho: t }); inc(u.porArquivo, arquivo) }
  }
}
function contextoProp(p, valor = '') {
  p = p.replace(/[A-Z]/g, (m) => '-' + m.toLowerCase()).toLowerCase()
  if (/gradient\(/.test(valor)) return 'gradiente'
  if (/^background/.test(p)) return 'fundo'
  if (/shadow/.test(p) || /shadow\(/.test(valor)) return 'sombra'
  if (/^(border|outline|column-rule)/.test(p)) return 'borda'
  if (/^(fill|stroke|stop-color|flood-color|lighting-color|accent-color)/.test(p)) return 'preenchimento'
  if (/^(color|caret-color|text-decoration|-webkit-text-fill-color|text-emphasis)/.test(p)) return 'texto'
  if (/^font-family$/.test(p)) return 'fonte'
  return 'outro'
}
function contextoLinha(l, i) {
  const antes = l.slice(0, i)
  const m = antes.match(/([A-Za-z-]+)\s*:\s*[^:;,{}]*$/) || antes.match(/([A-Za-z-]+)=\{?["']?[^"'=\s]*$/)
  if (m) return contextoProp(m[1], l.slice(i, i + 80))
  return /gradient\(/.test(l) ? 'gradiente' : 'outro'
}

const T = { caixaAlta: contador(), tracking: contador(), pesos: contador(), italico: contador(), grandes: contador() }
const FO = { raios: contador(), sombras: contador(), bordas: contador(), backdrop: contador(), gradientes: contador(), blend: contador(), textura: contador() }
const DENS = { p: {}, gap: {}, space: {}, texto: {} }
const escuro = { classe_dark: contador(), prefers_dark: contador(), atributo_tema: contador(), alternancia_js: contador(), custom_variant: contador(), variante_dark: 0 }
const superficies = { fundos: [], color_scheme: [] }
const familias = new Map()
const fontsourceVisto = new Set()

function familia(nome) {
  const k = nome.toLowerCase().replace(/\s+/g, ' ')
  if (!familias.has(k)) familias.set(k, { familia: nome, definicoes: [], diretos: 0, exemplos: [], tokens: new Set(), pesos: new Set(), estilos: new Set(), arquivos: new Set() })
  return familias.get(k)
}
function primeiraFamilia(valor, seletor) {
  let v = valor.trim()
  if (/^var\(/.test(v)) v = resolver(v, seletor)
  const f = v.split(',')[0].replace(/^['"\s]+|['"\s]+$/g, '')
  return !f || /^(inherit|initial|unset|revert|revert-layer|var\()/.test(f) || f.length > 60 ? null : f
}
function defFamilia(nome, origem, loc, pesos = [], extra = {}) {
  if (!nome) return
  const f = familia(nome)
  if (f.doSlug && !/fontsource|package\.json/.test(origem)) { f.familia = nome; f.doSlug = false }
  if (!f.definicoes.length && /fontsource|package\.json/.test(origem)) f.doSlug = true
  if (!f.definicoes.some((d) => d.origem === origem && d.local === loc)) f.definicoes.push({ origem, local: loc, ...extra })
  for (const p of pesos) if (p) f.pesos.add(String(p))
}
const nomeDoSlug = (s) => s.split('-').map((p) => p[0].toUpperCase() + p.slice(1)).join(' ')
function fontsource(texto, loc) {
  for (const m of texto.matchAll(/@fontsource(-variable)?\/([a-z0-9-]+)(?:\/([\w-]+)\.css)?/g)) {
    const chave = `${loc}|${m[0]}`
    if (fontsourceVisto.has(chave)) continue
    fontsourceVisto.add(chave)
    const peso = m[1] ? 'variable' : (m[3] || '').match(/\d{3}/)?.[0]
    defFamilia(nomeDoSlug(m[2]), m[1] ? '@fontsource-variable' : '@fontsource', loc, [peso])
    if (/italic/.test(m[3] || '')) familia(nomeDoSlug(m[2])).estilos.add('italic')
  }
}
function googleFonts(texto, loc) {
  for (const m of texto.matchAll(/https?:\/\/fonts\.googleapis\.com\/css2?\?[^"'\s)>]+/g)) {
    for (const par of m[0].replace(/&amp;/g, '&').split('?')[1].split('&')) {
      const [k, v] = par.split('=')
      if (k !== 'family' || !v) continue
      for (const fam of decodeURIComponent(v.replace(/\+/g, ' ')).split('|')) {
        const [nome, spec = ''] = fam.split(':')
        const pesos = spec.includes('@') ? spec.split('@')[1].split(';').map((p) => p.split(',').pop()) : spec.split(',')
        defFamilia(nome.trim(), 'google fonts', loc, pesos.map((p) => p.replace(/[^\d.]/g, '')).filter(Boolean))
      }
    }
  }
}

const RE_VALOR_DE_ATRIBUTO = /(\b(?!class(?:Name)?=)[\w-]+=\{?|\b(variant|size|type|intent|appearance|as)\s*:\s*)["'`]$/
const RE_CLASSE_COR = /^(bg|text|border(?:-[trblxyse])?|ring(?:-offset)?|outline|divide|fill|stroke|from|via|to|shadow|placeholder|caret|accent|decoration)-(.+?)(?:\/(\d+|\[[^\]]+\]))?$/
function ctxDoPrefixo(p) {
  if (p.startsWith('border') || p.startsWith('ring') || p === 'outline' || p === 'divide') return 'borda'
  return { bg: 'fundo', text: 'texto', placeholder: 'texto', caret: 'texto', decoration: 'texto', fill: 'preenchimento', stroke: 'preenchimento', accent: 'preenchimento', shadow: 'sombra', from: 'gradiente', via: 'gradiente', to: 'gradiente' }[p]
}
function chaveDaClasseCor(nome) {
  if (nome[0] === '[') {
    const d = nome.slice(1, -1)
    const v = d.match(/^(?:color:)?var\((--[\w-]+)/) || d.match(/^(?:color:)?(--[\w-]+)$/)
    if (v) return v[1]
    const c = lerCor(d.replace(/_/g, ' '))
    return c ? chaveLiteral(infoCor(c)) : null
  }
  if (nome[0] === '(') return (nome.match(/^\((?:color:)?(--[\w-]+)\)$/) || [])[1] || null
  if (tokens.has('--color-' + nome)) return '--color-' + nome
  if (tokens.has('tailwind.' + nome)) return 'tailwind.' + nome
  if (PALETA[nome]) return 'tailwind:' + nome
  return null
}
function tokenDeFonte(nome) {
  if (nome[0] === '[' || nome[0] === '(') return (nome.match(/(--[\w-]+)/) || [])[1] || null
  for (const k of ['--font-' + nome, 'tailwind.font.' + nome]) if (tokens.has(k)) return k
  return null
}

function classe(cru, arq, n, linha) {
  let s = cru.replace(/[,;]+$/, '')
  const conta = (c) => s.split(c).length - 1
  while (s.endsWith(')') && conta(')') > conta('(')) s = s.slice(0, -1)
  while (s.startsWith('(') && conta('(') > conta(')')) s = s.slice(1)
  let prof = 0, corte = -1
  for (let k = 0; k < s.length; k++) {
    const c = s[k]
    if (c === '[' || c === '(') prof++
    else if (c === ']' || c === ')') prof--
    else if (c === ':' && prof === 0) corte = k
  }
  const variantes = corte < 0 ? [] : s.slice(0, corte).split(':')
  const base = s.slice(corte + 1).replace(/^!|!$/g, '')
  if (!/^-?[a-z][\w-]*(\[[^\s]*\]|\(--[\w-]+\))?(\/[\w.[\]%]+)?$/.test(base)) return false
  const rel = arq.rel
  linha = janela(linha, linha.indexOf(cru))
  let m
  if ((m = base.match(RE_CLASSE_COR))) {
    const chave = chaveDaClasseCor(m[2])
    if (chave) {
      usar(chave, ctxDoPrefixo(m[1]), rel, n, linha)
      if (variantes.includes('dark')) escuro.variante_dark++
      return true
    }
  }
  if (variantes.includes('dark')) escuro.variante_dark++
  const loc = `${rel}:${n}`
  if ((m = base.match(/^font-(.+)$/))) {
    if (PESO_CLASSE[m[1]]) somar(T.pesos, base, loc, linha)
    else { const tk = tokenDeFonte(m[1]); if (tk) usar(tk, 'fonte', rel, n, linha) }
  }
  if (base === 'uppercase') somar(T.caixaAlta, base, loc, linha)
  else if (base === 'italic') somar(T.italico, base, loc, linha)
  else if (/^tracking-/.test(base)) somar(T.tracking, base, loc, linha)
  else if (/^text-([5-9]xl|\[clamp\()/.test(base)) somar(T.grandes, base, loc, linha)
  if ((m = base.match(/^text-(xs|sm|base|lg|xl|[2-9]xl)$/))) inc(DENS.texto, m[1])
  else if ((m = base.match(/^-?p[xytrblse]?-(.+)$/))) inc(DENS.p, m[1])
  else if ((m = base.match(/^gap(?:-[xy])?-(.+)$/))) inc(DENS.gap, m[1])
  else if ((m = base.match(/^space-[xy]-(?!reverse)(.+)$/))) inc(DENS.space, m[1])
  else if (/^rounded(-|$)/.test(base)) somar(FO.raios, base, loc, linha)
  else if (/^(shadow|drop-shadow|inset-shadow|text-shadow)(-|$)/.test(base)) somar(FO.sombras, base, loc, linha)
  else if (/^(border(-[trblxyse])?(-\d+|-\[[^\]]+\])?|border-(solid|dashed|dotted|double|none|hidden)|ring(-\d+|-inset)?|outline(-\d+|-none|-dashed|-dotted|-hidden)?|divide-[xy](-\d+)?)$/.test(base)) somar(FO.bordas, base, loc, linha)
  else if (/^backdrop-/.test(base)) somar(FO.backdrop, base, loc, linha)
  else if (/^bg-(gradient-to|linear|radial|conic)(-|$)/.test(base)) somar(FO.gradientes, base, loc, linha)
  else if (/^(mix-blend|bg-blend)-/.test(base)) somar(FO.blend, base, loc, linha)
  if (/grain|noise|textur/.test(base)) somar(FO.textura, base, loc, linha)
  return false
}

function varsELiterais(resto, arq, n, linha) {
  for (const m of resto.matchAll(/var\(\s*(--[\w-]+)/g)) usar(m[1], contextoLinha(resto, m.index), arq.rel, n, janela(linha, m.index))
  for (const m of resto.matchAll(RE_COR_LITERAL)) {
    const c = lerCor(m[0])
    if (c) usar(chaveLiteral(infoCor(c)), contextoLinha(resto, m.index), arq.rel, n, janela(linha, m.index))
  }
}

function alvoSuperficie(seletor) {
  for (const parte of seletor.split(',')) {
    const ult = parte.trim().split(/[\s>+~]+/).pop() || ''
    const m = ult.match(ALVOS_SUPERFICIE)
    if (m) return m[1]
  }
  return null
}
function fundo(alvo, valor, seletor, loc, origem) {
  const cor = corDoValor(valor, seletor, true)
  superficies.fundos.push({ alvo, valor: valor.slice(0, 120), ...(cor ? { cor } : {}), seletor: seletor || undefined, local: loc, origem })
}

for (const d of decls) {
  const arq = d.arq, cheia = arq.linhas[d.linha - 1] || '', texto = janela(cheia, cheia.indexOf(d.prop)), loc = `${arq.rel}:${d.linha}`
  if (d.prop.startsWith('--') || d.prop.startsWith('$')) continue
  if (d.prop === '@apply') {
    const alvo = alvoSuperficie(d.seletor)
    for (const c of d.valor.split(/\s+/)) {
      classe(c, arq, d.linha, texto)
      const m = c.match(/^bg-(.+?)(?:\/\d+)?$/)
      if (alvo && m) { const k = chaveDaClasseCor(m[1]); if (k) fundo(alvo, `@apply ${c}`, d.seletor, loc, 'css') }
    }
    continue
  }
  if (d.prop === '@import') { fontsource(d.valor, loc); googleFonts(d.valor, loc); continue }
  if (d.prop === '@custom-variant' && /^dark\b/.test(d.valor)) { somar(escuro.custom_variant, '@custom-variant dark', loc, texto); continue }
  if (d.prop[0] === '@') continue
  const ctx = contextoProp(d.prop, d.valor)
  for (const m of d.valor.matchAll(/var\(\s*(--[\w-]+)/g)) usar(m[1], ctx, arq.rel, d.linha, texto)
  if (arq.ext !== 'css') for (const m of d.valor.matchAll(/(\$[\w-]+)/g)) usar(m[1], ctx, arq.rel, d.linha, texto)
  for (const m of d.valor.matchAll(RE_COR_LITERAL)) { const c = lerCor(m[0]); if (c) usar(chaveLiteral(infoCor(c)), ctx, arq.rel, d.linha, texto) }
  const p = d.prop, v = d.valor
  const alvo = alvoSuperficie(d.seletor)
  if (alvo && (p === 'background' || p === 'background-color')) fundo(alvo, v, d.seletor, loc, 'css')
  if (p === 'color-scheme') superficies.color_scheme.push({ valor: v, seletor: d.seletor, local: loc })
  if (p === 'text-transform' && /uppercase/.test(v)) somar(T.caixaAlta, 'text-transform: uppercase', loc, texto)
  if (p === 'letter-spacing') somar(T.tracking, `letter-spacing: ${v}`, loc, texto)
  if (p === 'font-weight') somar(T.pesos, `font-weight: ${v}`, loc, texto)
  if (p === 'font-style' && /italic/.test(v)) somar(T.italico, 'font-style: italic', loc, texto)
  if (p === 'font-size' && /clamp\(/.test(v)) somar(T.grandes, `font-size: ${v.slice(0, 60)}`, loc, texto)
  if (/^border(-(top|right|bottom|left|start|end)){0,2}-radius$|^border-radius$/.test(p)) somar(FO.raios, `border-radius: ${v}`, loc, texto)
  if (p === 'box-shadow' || p === 'text-shadow' || (p === 'filter' && /drop-shadow\(/.test(v))) somar(FO.sombras, `${p}: ${v.slice(0, 80)}`, loc, texto)
  if (/^(border|border-(top|right|bottom|left|block|inline)(-(start|end))?|border-width|border-style|outline|outline-width|outline-style)$/.test(p)) somar(FO.bordas, `${p}: ${v.slice(0, 60)}`, loc, texto)
  if (/backdrop-filter$/.test(p)) somar(FO.backdrop, `backdrop-filter: ${v}`, loc, texto)
  for (const g of v.matchAll(/((?:repeating-)?(?:linear|radial|conic)-gradient)\(/g)) somar(FO.gradientes, g[1], loc, texto)
  if (/blend-mode$/.test(p)) somar(FO.blend, `${p}: ${v}`, loc, texto)
  if (/^(filter|background|background-image|mask|mask-image|-webkit-mask-image)$/.test(p) && /noise|grain|textur|feTurbulence/i.test(v)) somar(FO.textura, `${p}: ${v.slice(0, 60)}`, loc, texto)
  if (p === 'font-family') {
    const f = primeiraFamilia(v, d.seletor)
    if (f && !/^var\(/.test(v.trim())) {
      const F = familia(f)
      if (d.seletor.endsWith('@font-face')) continue
      F.diretos++
      if (F.exemplos.length < 4) F.exemplos.push({ local: loc, trecho: trecho(texto) })
    }
  }
}
{
  const faces = new Map()
  for (const d of decls) if (/@font-face$/.test(d.seletor)) {
    const k = `${d.arq.rel}#${d.bloco}`
    if (!faces.has(k)) faces.set(k, { local: `${d.arq.rel}:${d.linha}` })
    faces.get(k)[d.prop] = d.valor
  }
  for (const f of faces.values()) {
    const nome = primeiraFamilia(f['font-family'] || '')
    if (!nome) continue
    const arquivosFonte = [...(f.src || '').matchAll(/url\(\s*['"]?([^'")]+)/g)].map((m) => m[1].split('/').pop())
    defFamilia(nome, '@font-face', f.local, [f['font-weight']], { arquivos: arquivosFonte.slice(0, 4) })
    if (f['font-style']) familia(nome).estilos.add(f['font-style'])
    for (const a of arquivosFonte) familia(nome).arquivos.add(a)
  }
}
for (const r of regras) {
  const loc = `${r.arq.rel}:${r.linha}`, t = r.arq.linhas[r.linha - 1] || ''
  if (/(^|[^\w-])\.dark(?![\w-])/.test(r.proprio)) somar(escuro.classe_dark, '.dark', loc, t)
  if (/prefers-color-scheme\s*:\s*dark/.test(r.proprio)) somar(escuro.prefers_dark, '@media (prefers-color-scheme: dark)', loc, t)
  const a = r.proprio.match(/\[data-(theme|mode|tema|scheme|color-scheme|surface)[^\]]*\]/)
  if (a) somar(escuro.atributo_tema, a[0], loc, t)
}

const vocab = { frases: new Map(), palavras: {}, pt: 0, en: 0, textos: 0 }
function limparFrase(s) {
  s = s.replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/\s+/g, ' ').trim()
  if (!s || s.length > 160 || !/\p{L}{2}/u.test(s)) return null
  if (/=>|\(\)|;|&&|\|\||==|!=|\+\+|::|\/\/|\/\*|\*\/|`|\$\{|\s=\s| \? .+ : |^[\W\d_]+$/.test(s)) return null
  if (/https?:|www\.|^\.{0,2}\/\w|\.(png|jpe?g|svg|webp|tsx?|jsx?|css|json|md|mp3|mp4)\b|@\w+\//i.test(s)) return null
  const ps = s.split(' ')
  const pareceClasse = (w) => /^[a-z0-9:!/[\].#%()-]+$/.test(w) && /[-:[]/.test(w)
  if (ps.length >= 2 && ps.filter(pareceClasse).length >= ps.length / 2) return null
  if (ps.length === 1 && pareceClasse(s) && !/^[a-zà-ú]+-[a-zà-ú]+$/.test(s)) return null
  if (/^[a-z]+[A-Z]\w*$|^[A-Z][A-Z0-9_]{3,}$|^[a-z_]+\.[a-z_.]+$|^[a-z]+(_[a-z]+)+$/.test(s)) return null
  if (ps.some((p) => p.length >= 24 && classesDe(p) >= 2)) return null
  if ((s.match(/\(/g) || []).length !== (s.match(/\)/g) || []).length) return null
  if (/^(return|const|let|var|function|import|export|await|async|typeof|null|undefined|true|false|this|new|else|default|props|children)$/.test(s)) return null
  if (temSegredo(s)) return null
  return s
}
function frase(cru, arq, n, origem) {
  const s = limparFrase(cru)
  if (!s) return
  vocab.textos++
  const ps = s.split(' ')
  if (ps.length <= 8) {
    let e = vocab.frases.get(s)
    if (!e) vocab.frases.set(s, (e = { n: 0, exemplo: `${arq.rel}:${n}`, origem }))
    e.n++
  }
  for (const w of s.toLowerCase().match(/\p{L}[\p{L}'-]*/gu) || []) {
    if (STOP_PT.has(w) && !STOP_EN.has(w)) vocab.pt++
    else if (STOP_EN.has(w) && !STOP_PT.has(w)) vocab.en++
    if (w.length >= 3 && !STOP_PT.has(w) && !STOP_EN.has(w)) inc(vocab.palavras, w)
  }
}
const RE_I18N = /(^|\/)(locales?|i18n|lang|langs|messages|translations)\//
for (const arq of textos) {
  if (arq.fora) continue
  const jsx = arq.tipo === 'marcacao' || ['jsx', 'tsx', 'js'].includes(arq.ext)
  if (RE_I18N.test(arq.rel) && ['json', 'ts', 'js', 'mjs'].includes(arq.ext)) {
    for (const m of arq.texto.matchAll(/:\s*(["'`])((?:(?!\1)[^\\\n]|\\.)+)\1/g)) frase(m[2].replace(/\{\{?[^{}]*\}?\}/g, '…').replace(/<\/?\w+>/g, ' '), arq, linhaDe(arq, m.index), 'i18n')
    continue
  }
  if (arq.tipo !== 'script' && arq.tipo !== 'marcacao') continue
  if (jsx) {
    const t = arq.tipo === 'marcacao' ? arq.texto.replace(/<(script|style)[^>]*>[\s\S]*?<\/\1>/gi, (b) => b.replace(/[^\n]/g, ' ')) : arq.texto
    for (const m of t.matchAll(/>([^<>{}]+)</g)) {
      if (!/\p{L}/u.test(m[1])) continue
      frase(m[1], arq, linhaDe(arq, m.index + 1 + (m[1].length - m[1].trimStart().length)), 'text')
    }
    for (const m of t.matchAll(/\b(placeholder|title|aria-label|alt|label)\s*=\s*\{?\s*(["'])([^"'{}$\n]+?)\2/g)) frase(m[3], arq, linhaDe(arq, m.index), m[1])
  }
  if (arq.tipo === 'script' && !arq.ehTokens) {
    for (const m of arq.texto.matchAll(/\b(title|label|description|subtitle|heading|text|cta|placeholder|titulo|subtitulo|descricao|texto|rotulo)\s*:\s*(["'`])([^"'`{}$\n]+?)\2/g)) frase(m[3], arq, linhaDe(arq, m.index), 'object')
  }
}

const RE_SOM = regexPalavras(PALAVRAS_SOM)
const RE_DOC = regexPalavras(PALAVRAS_DOC)
const som = new Map()
const metadados = []
for (const arq of textos) {
  if ((arq.tipo === 'script' || arq.tipo === 'marcacao') && !arq.fora) {
    const pular = arq.linhasEstilo || new Set()
    arq.linhas.forEach((linha, i) => {
      const n = i + 1
      if (pular.has(n) || linha.length > 3000) return
      if (/^\s*(\/\/|\/\*|\*)/.test(linha)) return
      let resto = linha
      let cursor = 0
      for (const cru of linha.split(/[\s"'`{}]+/)) {
        if (!cru || cru.length > 200) continue
        const idx = linha.indexOf(cru, cursor)
        cursor = idx + cru.length
        if (RE_VALOR_DE_ATRIBUTO.test(linha.slice(Math.max(0, idx - 40), idx))) continue
        if (classe(cru, arq, n, linha)) resto = resto.replace(cru, ' '.repeat(cru.length))
      }
      if (!arq.ehTokens) varsELiterais(resto, arq, n, linha)
      const loc = `${arq.rel}:${n}`
      const tag = linha.match(/<(html|body|main)\b[^>]*?\bclass(?:Name)?=\{?(?:\w+\()?["'`]([^"'`]*)/)
      if (tag) for (const c of tag[2].split(/\s+/)) {
        const m = c.match(/^bg-(.+?)(?:\/\d+)?$/)
        if (m && chaveDaClasseCor(m[1])) {
          const k = chaveDaClasseCor(m[1])
          fundo(tag[1], c, '', loc, `class on <${tag[1]}>`)
          if (tokensCor.has(k) || k[0] === '#' || k.startsWith('tailwind:')) superficies.fundos[superficies.fundos.length - 1].cor = k.startsWith('tailwind:') ? infoCor(lerCor(PALETA[k.slice(9)])) : k[0] === '#' ? infoCor(lerCor(k.split('/')[0])) : tokensCor.get(k).cor
        }
      }
      if (/prefers-color-scheme\s*:\s*dark/.test(linha)) somar(escuro.prefers_dark, 'matchMedia / prefers-color-scheme in a script', loc, linha)
      if (/classList\.(add|toggle|remove)\(\s*['"]dark['"]|setAttribute\(\s*['"]data-(theme|mode)|dataset\.(theme|mode)\b/.test(linha)) somar(escuro.alternancia_js, 'theme switch by script', loc, linha)
      if (/@fontsource/.test(linha)) fontsource(linha, loc)
      if (/fonts\.googleapis\.com/.test(linha)) googleFonts(linha, loc)
      const nf = linha.match(/import\s*\{([^}]*)\}\s*from\s*['"]next\/font\/google['"]/)
      if (nf) for (const nome of nf[1].split(',').map((x) => x.trim().split(/\s+as\s+/)[0]).filter(Boolean)) defFamilia(nome.replace(/_/g, ' '), 'next/font/google', loc)
      if (/^layout\.(tsx|ts|jsx|js)$/.test(arq.nome)) {
        const md = linha.match(/\b(title|description|themeColor|applicationName)\s*:\s*(["'`])([^"'`]+)\2/)
        if (md && !temSegredo(linha)) metadados.push({ campo: md[1], valor: md[3], local: loc, origem: 'Next metadata' })
      }
    })
  }
  if (['script', 'marcacao', 'doc'].includes(arq.tipo) && !ehTeste(arq.rel)) {
    arq.linhas.forEach((linha, i) => {
      if (linha.length > 3000) return
      for (const m of linha.matchAll(RE_SOM)) {
        const w = m[1].toLowerCase()
        let e = som.get(w)
        if (!e) som.set(w, (e = { n: 0, arquivos: new Set(), exemplos: [] }))
        e.n++
        e.arquivos.add(arq.rel)
        if (e.exemplos.length < 5 && !e.exemplos.some((x) => x.local.startsWith(arq.rel + ':'))) { const t = trecho(linha); if (t) e.exemplos.push({ local: `${arq.rel}:${i + 1}`, trecho: t }) }
      }
    })
  }
}

// ── 6. Montagem ─────────────────────────────────────────────────────────────
const aliasesDe = new Map()
for (const [nome, t] of tokensCor) if (t.alias_de && tokensCor.has(t.alias_de)) {
  if (!aliasesDe.has(t.alias_de)) aliasesDe.set(t.alias_de, [])
  aliasesDe.get(t.alias_de).push(nome)
}
function totalComAlias(nome, visto = new Set()) {
  if (visto.has(nome)) return 0
  visto.add(nome)
  return (usos.get(nome)?.total || 0) + (aliasesDe.get(nome) || []).reduce((s, a) => s + totalComAlias(a, visto), 0)
}
function agregado(nome, visto = new Set()) {
  if (visto.has(nome)) return null
  visto.add(nome)
  const base = usos.get(nome)
  const r = { contextos: { ...(base?.contextos || {}) }, arquivos: { ...(base?.arquivos || {}) }, exemplos: [...(base?.exemplos || [])] }
  for (const a of aliasesDe.get(nome) || []) {
    const s = agregado(a, visto)
    if (!s) continue
    for (const [k, v] of Object.entries(s.contextos)) inc(r.contextos, k, v)
    for (const [k, v] of Object.entries(s.arquivos)) inc(r.arquivos, k, v)
    for (const e of s.exemplos) if (r.exemplos.length < 8) r.exemplos.push(e)
  }
  return r
}
const resumoUso = (u) => u ? {
  contextos: Object.fromEntries(ordenar(u.contextos)),
  arquivos: ordenar(u.arquivos).slice(0, 10).map(([arquivo, n]) => ({ arquivo, n })),
  exemplos: u.exemplos,
} : { contextos: {}, arquivos: [], exemplos: [] }

const coresTokens = [...tokensCor].map(([nome, t]) => {
  const u = usos.get(nome)
  const via = (aliasesDe.get(nome) || []).map((a) => ({ nome: a, n: totalComAlias(a) })).filter((x) => x.n).sort((a, b) => b.n - a.n || cmp(a.nome, b.nome))
  return {
    nome,
    ...(t.cor ? { cor: t.cor } : {}),
    definicoes: t.defs.map((d, i) => ({ valor: d.valor.slice(0, 120), seletor: d.seletor || undefined, local: d.local, origem: d.origem === 'css' ? undefined : d.origem, ...(t.cores[i] ? { cor: t.cores[i] } : {}) })),
    ...(t.alias_de ? { alias_de: t.alias_de } : {}),
    usos: { total: totalComAlias(nome), direto: u?.total || 0, via_alias: via, ...resumoUso(agregado(nome)) },
  }
}).sort((a, b) => b.usos.total - a.usos.total || cmp(a.nome, b.nome))

const hexDosTokens = new Map()
for (const t of coresTokens) if (t.cor) {
  const k = chaveLiteral(t.cor)
  if (!hexDosTokens.has(k)) hexDosTokens.set(k, [])
  hexDosTokens.get(k).push(t.nome)
}
const literais = [...usos].filter(([k]) => k[0] === '#').map(([k, u]) => ({
  valor: k, cor: infoCor(lerCor(k.split('/')[0])), total: u.total, ...resumoUso(u), igual_a_tokens: (hexDosTokens.get(k) || []).slice(0, 5),
})).map((x) => { if (/\/\d+%$/.test(x.valor)) x.cor.alfa = +x.valor.match(/\/(\d+)%$/)[1] / 100; return x })
  .sort((a, b) => b.total - a.total || cmp(a.valor, b.valor))
const tailwindPadrao = [...usos].filter(([k]) => k.startsWith('tailwind:')).map(([k, u]) => ({
  classe: k.slice(9), cor: infoCor(lerCor(PALETA[k.slice(9)])), total: u.total, ...resumoUso(u),
})).sort((a, b) => b.total - a.total || cmp(a.classe, b.classe))

const porNumero = {}
for (const [k, e] of T.pesos) {
  const m = k.match(/^font-(\w+)$/)
  const num = m ? PESO_CLASSE[m[1]] : (k.match(/:\s*(\d{3}|bold|normal|bolder|lighter)/) || [])[1]
  if (num) inc(porNumero, { bold: 700, normal: 400 }[num] || num, e.n)
}
const tipografia = {
  caixa_alta: { total: totalDe(T.caixaAlta), formas: listar(T.caixaAlta) },
  tracking: { total: totalDe(T.tracking), valores: listar(T.tracking, 40) },
  pesos: { total: totalDe(T.pesos), por_numero: Object.fromEntries(ordenar(porNumero)), valores: listar(T.pesos, 40) },
  italico: { total: totalDe(T.italico), formas: listar(T.italico) },
  tamanhos_grandes: { total: totalDe(T.grandes), valores: listar(T.grandes, 40) },
}
const tokensForma = (re) => [...tokens].filter(([n]) => re.test(n) && !tokensCor.has(n)).map(([nome, defs]) => ({ nome, valor: defs[0].valor.slice(0, 100), local: defs[0].local, usos: usos.get(nome)?.total || 0 })).sort((a, b) => b.usos - a.usos || cmp(a.nome, b.nome))
const forma = {
  raios: { total: totalDe(FO.raios), tokens: [...tokensForma(/radius|rounded|raio/i), ...configTailwind.raios.map((r) => ({ nome: `tailwind.borderRadius.${r.nome}`, valor: r.valor, local: r.local }))], valores: listar(FO.raios) },
  sombras: { total: totalDe(FO.sombras), tokens: [...tokensForma(/shadow|sombra|elevation/i), ...configTailwind.sombras.map((r) => ({ nome: `tailwind.boxShadow.${r.nome}`, valor: r.valor, local: r.local }))], valores: listar(FO.sombras) },
  bordas: { total: totalDe(FO.bordas), valores: listar(FO.bordas) },
  backdrop: { total: totalDe(FO.backdrop), valores: listar(FO.backdrop, 20) },
  gradientes: { total: totalDe(FO.gradientes), valores: listar(FO.gradientes, 20) },
  blend: { total: totalDe(FO.blend), valores: listar(FO.blend, 20) },
  textura: { total: totalDe(FO.textura), valores: listar(FO.textura, 20), imagens: arquivos.filter((a) => a.tipo === 'imagem' && /grain|noise|textur|paper|papel/i.test(a.nome)).map((a) => a.rel).slice(0, 20) },
}
const ordemTamanho = (o) => Object.fromEntries(ordenar(o))
const densidade = { padding: ordemTamanho(DENS.p), gap: ordemTamanho(DENS.gap), space: ordemTamanho(DENS.space), texto: ordemTamanho(DENS.texto) }

const modoEscuro = {
  classe_dark: { n: totalDe(escuro.classe_dark), locais: listar(escuro.classe_dark, 1)[0]?.exemplos || [] },
  prefers_color_scheme_dark: { n: totalDe(escuro.prefers_dark), formas: listar(escuro.prefers_dark, 5) },
  atributo_de_tema: listar(escuro.atributo_tema, 15),
  troca_por_script: { n: totalDe(escuro.alternancia_js), locais: listar(escuro.alternancia_js, 1)[0]?.exemplos || [] },
  custom_variant: { n: totalDe(escuro.custom_variant), locais: listar(escuro.custom_variant, 1)[0]?.exemplos || [] },
  tailwind_darkMode: configTailwind.darkMode,
  classes_com_variante_dark: escuro.variante_dark,
}
modoEscuro.existe = modoEscuro.classe_dark.n + modoEscuro.prefers_color_scheme_dark.n + modoEscuro.atributo_de_tema.length + modoEscuro.custom_variant.n + modoEscuro.tailwind_darkMode.length + escuro.variante_dark > 0

const porProfundidade = (a, b) => profundidade(a.rel) - profundidade(b.rel) || cmp(a.rel, b.rel)
const pacote = { package_json: [], manifestos: [], html: [], metadados: [] }
for (const a of textos.filter((x) => x.nome === 'package.json').sort(porProfundidade).slice(0, 10)) {
  const j = lerJson(a) || {}
  const campo = (k) => (j[k] === undefined ? undefined : { valor: j[k], local: local(a, achaLinha(a, new RegExp(`^\\s*"${k}"\\s*:`))) })
  const deps = Object.entries({ ...j.dependencies, ...j.devDependencies }).filter(([n]) => DEPS_DE_CARA.test(n))
    .map(([nome, versao]) => ({ nome, versao, local: local(a, achaLinha(a, new RegExp(`"${esc(nome)}"\\s*:`))) })).sort((x, y) => cmp(x.nome, y.nome))
  for (const d of deps) if (d.nome.startsWith('@fontsource')) defFamilia(nomeDoSlug(d.nome.split('/')[1]), 'package.json', d.local)
  pacote.package_json.push({ arquivo: a.rel, name: campo('name'), description: campo('description'), keywords: campo('keywords'), homepage: campo('homepage'), dependencias_de_cara: deps })
}
for (const a of textos.filter((x) => !x.fora && (x.nome === 'manifest.json' || x.ext === 'webmanifest')).sort(porProfundidade).slice(0, 5)) {
  const j = lerJson(a)
  if (!j) continue
  const campos = {}
  for (const k of ['name', 'short_name', 'description', 'theme_color', 'background_color']) if (j[k] !== undefined) {
    campos[k] = { valor: j[k], local: local(a, achaLinha(a, new RegExp(`"${k}"\\s*:`))) }
    const c = /color/.test(k) && lerCor(String(j[k]))
    if (c) campos[k].cor = infoCor(c)
  }
  pacote.manifestos.push({ arquivo: a.rel, ...campos })
}
for (const a of textos.filter((x) => /^(vite|next|nuxt|astro)\.config\./.test(x.nome))) a.linhas.forEach((l, i) => {
  const m = l.match(/\b(short_name|theme_color|background_color|themeColor|backgroundColor)\s*:\s*(["'`])([^"'`]+)\2/)
  if (!m) return
  const c = lerCor(m[3])
  pacote.manifestos.push({ arquivo: a.rel, [m[1]]: { valor: m[3], local: local(a, i + 1), ...(c ? { cor: infoCor(c) } : {}) } })
})
for (const a of textos.filter((x) => !x.fora && (x.ext === 'html' || x.ext === 'htm') && (x.nome === 'index.html' || profundidade(x.rel) === 1)).sort(porProfundidade).slice(0, 10)) {
  const h = { arquivo: a.rel }
  const t = a.texto.match(/<title[^>]*>([^<]*)<\/title>/i)
  if (t) h.title = { valor: t[1].trim(), local: local(a, linhaDe(a, t.index)) }
  for (const [campo, nome] of [['description', 'description'], ['theme_color', 'theme-color']]) {
    const m = a.texto.match(new RegExp(`<meta\\s[^>]*name=["']${nome}["'][^>]*>`, 'i'))
    const v = m && (m[0].match(/content=["']([^"']*)["']/i) || [])[1]
    if (v !== undefined && v !== null) {
      h[campo] = { valor: v, local: local(a, linhaDe(a, m.index)) }
      const c = campo === 'theme_color' && lerCor(v)
      if (c) h[campo].cor = infoCor(c)
    }
  }
  const gf = [...a.texto.matchAll(/https?:\/\/fonts\.googleapis\.com\/css2?\?[^"'\s>]+/g)].map((m) => ({ url: m[0].replace(/&amp;/g, '&'), local: local(a, linhaDe(a, m.index)) }))
  if (gf.length) h.google_fonts = gf
  for (const m of gf) googleFonts(m.url, m.local)
  if (Object.keys(h).length > 1) pacote.html.push(h)
}
pacote.metadados = metadados.slice(0, 20)
for (const m of [...pacote.manifestos, ...pacote.html]) for (const k of ['background_color', 'theme_color', 'backgroundColor', 'themeColor']) {
  if (m[k]) superficies.fundos.push({ alvo: k, valor: String(m[k].valor), ...(m[k].cor ? { cor: m[k].cor } : {}), local: m[k].local, origem: m.arquivo.endsWith('html') ? 'meta theme-color' : 'manifest' })
}

const tokenParaFamilia = new Map()
for (const [nome, defs] of tokens) if (ehFonteToken(nome)) {
  const d = defPreferida(nome)
  const f = primeiraFamilia(d.valor, d.seletor)
  if (!f || /^\d/.test(f)) continue
  defFamilia(f, nome.startsWith('tailwind.') ? 'tailwind.config fontFamily' : 'token', d.local, [], { variavel: nome })
  tokenParaFamilia.set(nome, f)
  familia(f).tokens.add(nome)
}
const fontes = [...familias.values()].map((f) => {
  let usosT = f.diretos
  const ex = [...f.exemplos]
  for (const tk of f.tokens) { const u = usos.get(tk); if (u) { usosT += u.total; for (const e of u.exemplos) if (ex.length < 6) ex.push({ local: e.local, trecho: e.trecho }) } }
  return { familia: f.familia, definida_em: f.definicoes.slice(0, 12), tokens: [...f.tokens].sort(), usos: usosT, pesos: [...f.pesos].sort(), estilos: [...f.estilos].sort(), arquivos_de_fonte: [...f.arquivos].sort().slice(0, 12), exemplos: ex }
}).filter((f) => f.definida_em.length || f.usos).sort((a, b) => b.usos - a.usos || cmp(a.familia, b.familia))

const RE_MARCA = /(logo|s[ií]mbolo|symbol|brand|marca|presskit|press-kit|favicon|og-image|og_image|opengraph|apple-touch-icon|manual|identidade)/i
const EXT_MARCA = new Set(['svg', 'png', 'jpg', 'jpeg', 'webp', 'pdf', 'ai', 'fig', 'ico'])
const candidatosMarca = arquivos.filter((a) => EXT_MARCA.has(a.ext) && RE_MARCA.test(a.rel)).sort((a, b) => cmp(a.rel, b.rel))
const marca = {
  total: candidatosMarca.length,
  arquivos: candidatosMarca.slice(0, 150).map((a) => {
    const r = { arquivo: a.rel, bytes: fs.statSync(a.abs).size }
    if (a.ext === 'svg') {
      const fd = fs.openSync(a.abs, 'r'), buf = Buffer.alloc(65536), n = fs.readSync(fd, buf, 0, 65536, 0)
      fs.closeSync(fd)
      const tag = (buf.toString('utf8', 0, n).match(/<svg\b[^>]*>/i) || [''])[0]
      for (const at of ['viewBox', 'width', 'height']) { const m = tag.match(new RegExp(`\\s${at}=["']([^"']+)["']`)); if (m) r[at === 'viewBox' ? 'viewBox' : at === 'width' ? 'largura' : 'altura'] = m[1] }
    }
    return r
  }),
}

const docsTodos = textos.filter((a) => a.tipo === 'doc')
const prioridadeRaiz = (n) => (/^readme/i.test(n) ? 0 : /^claude\.md$/i.test(n) ? 1 : /^agents\.md$/i.test(n) ? 2 : 3)
const grupoDoc = (a) => (profundidade(a.rel) === 1 ? 0 : a.rel.startsWith('docs/') ? 1 : /^(readme|claude|agents)\.mdx?$/i.test(a.nome) ? 2 : 9)
const docsEscolhidos = docsTodos.filter((a) => grupoDoc(a) < 9).sort((a, b) => grupoDoc(a) - grupoDoc(b) || (grupoDoc(a) === 0 ? prioridadeRaiz(a.nome) - prioridadeRaiz(b.nome) : 0) || porProfundidade(a, b))
if (docsEscolhidos.length > MAX_DOCS) ignorados.limites.push(`documents: read ${MAX_DOCS} of ${docsEscolhidos.length} candidates (root and docs/ first)`)
const documentos = docsEscolhidos.slice(0, MAX_DOCS).map((a) => {
  const t = a.linhas.find((l) => /^#\s+\S/.test(l)) || a.linhas.find((l) => /^#{1,6}\s+\S/.test(l))
  const trechos = []
  let cerca = false
  for (let i = 0; i < a.linhas.length && trechos.length < 15; i++) {
    const l = a.linhas[i]
    if (/^\s*(```|~~~)/.test(l)) { cerca = !cerca; continue }
    if (cerca || /^\s*\|?[\s:-]+\|[\s|:-]*$/.test(l)) continue
    const ps = [...new Set([...l.matchAll(RE_DOC)].map((m) => m[1].toLowerCase()))]
    if (!ps.length) continue
    const tx = trecho(l, 200)
    if (tx) trechos.push({ linha: i + 1, texto: tx, palavras: ps })
  }
  return { arquivo: a.rel, titulo: t ? trecho(t.replace(/^#+\s*/, ''), 120) : null, bytes: a.bytes, linhas: a.linhas.length, trechos }
})

const frases = [...vocab.frases].sort((a, b) => b[1].n - a[1].n || cmp(a[0], b[0])).slice(0, 150).map(([texto, e]) => ({ texto, n: e.n, exemplo: e.exemplo, origem: e.origem }))
const vocabulario = {
  idioma: { stopwords_pt: vocab.pt, stopwords_en: vocab.en, predominante: vocab.pt === vocab.en ? 'indefinido' : vocab.pt > vocab.en ? 'pt' : 'en' },
  textos_colhidos: vocab.textos,
  frases_distintas: vocab.frases.size,
  frases,
  palavras: ordenar(vocab.palavras).slice(0, 40).map(([palavra, n]) => ({ palavra, n })),
}

const audios = arquivos.filter((a) => a.tipo === 'audio').sort((a, b) => cmp(a.rel, b.rel))
const somOut = {
  arquivos_de_audio: { total: audios.length, arquivos: audios.slice(0, 60).map((a) => ({ arquivo: a.rel, bytes: fs.statSync(a.abs).size })) },
  mencoes: [...som].sort((a, b) => b[1].n - a[1].n || cmp(a[0], b[0])).map(([palavra, e]) => ({ palavra, n: e.n, arquivos: e.arquivos.size, exemplos: e.exemplos })),
}

const RE_RAMO_VIDEO = /(v[ií]deo|tutorial|s[eé]rie|ajuda|help|motion|brand|marca|rebrand|design|identidade)/i
const ARQ_SERIE = new Set(['series.json', 'identity.json', 'brand.js', 'sheet.json', 'reading.md'])
const DIR_SERIE = new Set(['_serie', '_motor', 'videos', 'tutoriais'])
const EXT_VIDEO = new Set(['mp4', 'mov', 'webm', 'm4v'])
function sinaisDeVideo(base) {
  const achados = { arquivos_de_serie: [], pastas_de_serie: [], videos: 0 }
  const pilha = [[base, 0]]
  let passos = 0
  while (pilha.length && passos++ < 4000) {
    const [dir, prof] = pilha.pop()
    let itens
    try { itens = fs.readdirSync(dir, { withFileTypes: true }) } catch { continue }
    for (const it of itens) {
      const abs = path.join(dir, it.name), r = path.relative(base, abs).split(path.sep).join('/')
      if (it.isDirectory()) {
        if (PULAR.has(it.name) || it.name.startsWith('.')) continue
        if (DIR_SERIE.has(it.name.toLowerCase())) achados.pastas_de_serie.push(r)
        if (prof < 4) pilha.push([abs, prof + 1])
      } else if (it.isFile()) {
        if (ARQ_SERIE.has(it.name)) achados.arquivos_de_serie.push(r)
        if (EXT_VIDEO.has(path.extname(it.name).slice(1).toLowerCase())) achados.videos++
      }
    }
  }
  achados.arquivos_de_serie.sort(); achados.pastas_de_serie.sort()
  achados.arquivos_de_serie = achados.arquivos_de_serie.slice(0, 30)
  achados.pastas_de_serie = achados.pastas_de_serie.slice(0, 30)
  return achados
}
const temSinal = (s) => s.arquivos_de_serie.length || s.pastas_de_serie.length || s.videos
function lerGit() {
  let gitdir = path.join(raiz, '.git')
  try {
    if (fs.statSync(gitdir).isFile()) gitdir = path.resolve(raiz, fs.readFileSync(gitdir, 'utf8').replace(/^gitdir:\s*/, '').trim())
  } catch { return null }
  let comum = gitdir
  try { comum = path.resolve(gitdir, fs.readFileSync(path.join(gitdir, 'commondir'), 'utf8').trim()) } catch {}
  const ramos = new Set()
  const heads = path.join(comum, 'refs', 'heads')
  const pilha = [heads]
  while (pilha.length) {
    const d = pilha.pop()
    let itens
    try { itens = fs.readdirSync(d, { withFileTypes: true }) } catch { continue }
    for (const it of itens) (it.isDirectory() ? pilha.push(path.join(d, it.name)) : ramos.add(path.relative(heads, path.join(d, it.name)).split(path.sep).join('/')))
  }
  try {
    for (const l of fs.readFileSync(path.join(comum, 'packed-refs'), 'utf8').split('\n')) {
      const m = l.match(/^[0-9a-f]{40} refs\/heads\/(.+)$/)
      if (m) ramos.add(m[1])
    }
  } catch {}
  const worktrees = []
  try {
    for (const w of fs.readdirSync(path.join(comum, 'worktrees')).sort()) {
      try {
        const alvo = path.dirname(fs.readFileSync(path.join(comum, 'worktrees', w, 'gitdir'), 'utf8').trim())
        if (!fs.existsSync(alvo) || path.resolve(alvo) === raiz) continue
        let ramo = ''
        try { ramo = fs.readFileSync(path.join(comum, 'worktrees', w, 'HEAD'), 'utf8').trim().replace(/^ref: refs\/heads\//, '') } catch {}
        worktrees.push({ caminho: alvo.split(path.sep).join('/'), ramo, ...sinaisDeVideo(alvo) })
      } catch {}
    }
  } catch {}
  const todos = [...ramos].sort()
  return { ramos_total: todos.length, ramos_de_video_ou_marca: todos.filter((r) => RE_RAMO_VIDEO.test(r)), worktrees_com_sinal: worktrees.filter(temSinal), worktrees_total: worktrees.length, worktrees }
}
const historicoGit = lerGit()
const historico = {
  criterio: 'videos and series the product already has: files series.json, identity.json, brand.js, sheet.json, reading.md; folders _serie, _motor, videos, tutoriais; video files. Searched in the project, in the worktrees of the same git and in the sibling folders whose name starts the same way. Names and counts only, nothing is read.',
  projeto: sinaisDeVideo(raiz),
  git: historicoGit && { ramos_total: historicoGit.ramos_total, ramos_de_video_ou_marca: historicoGit.ramos_de_video_ou_marca, worktrees_total: historicoGit.worktrees_total, worktrees_com_sinal: historicoGit.worktrees_com_sinal },
  irmas: (() => {
    const pai = path.dirname(raiz), nome = path.basename(raiz).toLowerCase()
    let itens = []
    try { itens = fs.readdirSync(pai, { withFileTypes: true }) } catch {}
    const jaVistas = new Set((historicoGit?.worktrees ?? []).map((w) => w.caminho))
    return itens.filter((it) => it.isDirectory() && it.name.toLowerCase() !== nome && it.name.toLowerCase().startsWith(nome) && !jaVistas.has(path.join(pai, it.name).split(path.sep).join('/')))
      .map((it) => ({ caminho: path.join(pai, it.name).split(path.sep).join('/'), ...sinaisDeVideo(path.join(pai, it.name)) }))
      .sort((a, b) => cmp(a.caminho, b.caminho))
  })(),
}

ignorados.segredos.sort((a, b) => cmp(a.arquivo, b.arquivo))
ignorados.fora_do_produto = { criterio: CRITERIO_FORA, arquivos: textos.filter((a) => a.fora).length }
ignorados.pastas.sort()
const saidaJson = {
  versao: 1,
  gerado: new Date().toISOString(),
  projeto: { caminho: raiz.split(path.sep).join('/'), nome: path.basename(raiz), arquivos_vistos: Math.min(vistos, MAX_ARQUIVOS), arquivos_de_texto_lidos: textos.length },
  pacote,
  cores: {
    criterio: 'relative luminance (WCAG): escura (dark) < 0.10 ≤ media (mid) ≤ 0.50 < clara (light); uses per token include the tokens that point to it (via_alias)',
    tokens: coresTokens,
    literais_soltos: literais,
    tailwind_padrao: tailwindPadrao,
  },
  superficies: { fundos: superficies.fundos, color_scheme: superficies.color_scheme, modo_escuro: modoEscuro },
  fontes,
  tipografia,
  forma,
  densidade,
  marca,
  documentos,
  vocabulario,
  som: somOut,
  historico,
  ignorados,
}

// ── 7. Markdown ─────────────────────────────────────────────────────────────
const cel = (s) => String(s ?? '').replace(/\|/g, '\\|').replace(/\s+/g, ' ').trim()
const cod = (s) => (s === undefined || s === null || s === '' ? '' : String(s).includes('`') ? cel(s) : '`' + cel(s) + '`')
const tabela = (cab, linhas) => (linhas.length ? [`| ${cab.join(' | ')} |`, `|${cab.map(() => '---').join('|')}|`, ...linhas.map((l) => `| ${l.map((c) => (c === undefined ? '' : c)).join(' | ')} |`)].join('\n') : '_nothing found_')
// valores do JSON que ficam em português (chaves e categorias); no .md saem em inglês
const CONTEXTO = { gradiente: 'gradient', fundo: 'background', sombra: 'shadow', borda: 'border', preenchimento: 'fill', texto: 'text', fonte: 'font', outro: 'other' }
const CLASSE = { escura: 'dark', clara: 'light', media: 'mid' }
const MOTIVO = { nome: 'name', 'conteúdo': 'content' }
const IDIOMA = { indefinido: 'undetermined' }
const ctxTxt = (c) => Object.entries(c).map(([k, v]) => `${CONTEXTO[k] ?? k} ${v}`).join(', ')
const corTxt = (c) => (c ? `${c.hex}${c.alfa !== undefined ? ` α${c.alfa}` : ''} · ${CLASSE[c.classe] ?? c.classe}` : '')
const mais = (lista, n) => (lista.length > n ? `\n\n_+${lista.length - n} more in the JSON._` : '')
const exTxt = (ex) => (ex && ex[0] ? `${cod(ex[0].local)}${ex[0].trecho ? ' ' + cod(ex[0].trecho.slice(0, 70)) : ''}` : '')
const L = []
L.push(`# Raw reading — ${saidaJson.projeto.nome}`, '', '> Facts gathered by a script, with no interpretation. The interpreting happens in `reading.md`.', '')
L.push(`Generated at ${saidaJson.gerado} · ${saidaJson.projeto.arquivos_vistos} files seen, ${textos.length} text files read · everything in full in \`leitura.bruta.json\`.`, '')

L.push('## Package', '')
for (const p of pacote.package_json) {
  const f = ['name', 'description', 'keywords', 'homepage'].filter((k) => p[k]).map((k) => `- ${k}: ${cod(Array.isArray(p[k].valor) ? p[k].valor.join(', ') : p[k].valor)} (${p[k].local})`)
  L.push(`**${p.arquivo}**`, ...f)
  if (p.dependencias_de_cara.length) L.push(`- look-and-feel dependencies: ${p.dependencias_de_cara.map((d) => `${cod(d.nome + '@' + d.versao)} (${d.local})`).join(', ')}`)
  L.push('')
}
for (const m of [...pacote.manifestos, ...pacote.html, ...pacote.metadados.map((x) => ({ arquivo: x.origem, [x.campo]: x }))]) {
  const campos = Object.entries(m).filter(([k]) => k !== 'arquivo' && k !== 'google_fonts').map(([k, v]) => `${k}: ${cod(v.valor)}${v.cor ? ` (${corTxt(v.cor)})` : ''} ${v.local}`)
  if (campos.length) L.push(`- **${m.arquivo}** — ${campos.join(' · ')}`)
}
L.push('')

L.push('## Colors', '', `${coresTokens.length} color tokens, ${literais.length} loose literal colors, ${tailwindPadrao.length} colors from the default Tailwind palette in use.`, '')
L.push('### Tokens', '', tabela(['token', 'definition', 'color', 'uses (direct)', 'contexts', 'where it shows up most'], coresTokens.slice(0, 15).map((t) => [
  cod(t.nome), `${cod(t.definicoes[0].valor)} ${t.definicoes[0].seletor ? cod(t.definicoes[0].seletor) + ' ' : ''}${t.definicoes[0].local}${t.definicoes.length > 1 ? ` (+${t.definicoes.length - 1})` : ''}`,
  corTxt(t.cor), `${t.usos.total} (${t.usos.direto})`, ctxTxt(t.usos.contextos), t.usos.arquivos.slice(0, 2).map((a) => `${a.arquivo} (${a.n})`).join(', '),
])) + mais(coresTokens, 15), '')
L.push('### Loose literal colors (outside tokens)', '', tabela(['color', 'tone', 'uses', 'contexts', 'same as token', 'example'], literais.slice(0, 15).map((c) => [
  cod(c.valor), CLASSE[c.cor.classe] ?? c.cor.classe, c.total, ctxTxt(c.contextos), c.igual_a_tokens.map(cod).join(' '), exTxt(c.exemplos),
])) + mais(literais, 15), '')
if (tailwindPadrao.length) L.push('### Default Tailwind palette in use', '', tabela(['color class', 'hex', 'uses', 'contexts', 'example'], tailwindPadrao.slice(0, 12).map((c) => [cod(c.classe), corTxt(c.cor), c.total, ctxTxt(c.contextos), exTxt(c.exemplos)])) + mais(tailwindPadrao, 12), '')

L.push('## Surfaces', '', tabela(['target', 'value', 'color', 'selector', 'where'], superficies.fundos.slice(0, 15).map((f) => [cod(f.alvo), cod(f.valor), corTxt(f.cor), cod(f.seletor), f.local])) + mais(superficies.fundos, 15), '')
if (superficies.color_scheme.length) L.push(`color-scheme: ${superficies.color_scheme.slice(0, 5).map((c) => `${cod(c.valor)} on ${cod(c.seletor)} ${c.local}`).join(' · ')}`, '')
L.push(`Dark mode: ${modoEscuro.existe ? 'there are signs' : 'no sign'} — \`.dark\` ${modoEscuro.classe_dark.n}×, prefers-color-scheme: dark ${modoEscuro.prefers_color_scheme_dark.n}×, theme attribute ${modoEscuro.atributo_de_tema.map((a) => `${cod(a.valor)} ${a.n}×`).join(', ') || '0'}, @custom-variant dark ${modoEscuro.custom_variant.n}×, darkMode in tailwind.config ${modoEscuro.tailwind_darkMode.length}×, classes with \`dark:\` ${modoEscuro.classes_com_variante_dark}, switch by script ${modoEscuro.troca_por_script.n}×.`)
const primeiroEscuro = [modoEscuro.classe_dark.locais[0], modoEscuro.prefers_color_scheme_dark.formas[0]?.exemplos[0], modoEscuro.atributo_de_tema[0]?.exemplos[0]].filter(Boolean)
if (primeiroEscuro.length) L.push(`Where: ${primeiroEscuro.map((e) => e.local).join(', ')}`)
L.push('')

L.push('## Fonts', '', tabela(['family', 'defined in', 'uses', 'weights', 'usage example'], fontes.slice(0, 15).map((f) => [
  `**${cel(f.familia)}**`, f.definida_em.slice(0, 3).map((d) => `${d.origem}${d.variavel ? ' ' + cod(d.variavel) : ''} ${d.local}`).join('; '), f.usos, f.pesos.join(', '), exTxt(f.exemplos),
])) + mais(fontes, 15), '')

L.push('## Typography in use', '')
L.push(`- uppercase: ${tipografia.caixa_alta.total} (${tipografia.caixa_alta.formas.map((f) => `${cod(f.valor)} ${f.n}`).join(', ')})`)
L.push(`- italic: ${tipografia.italico.total}`)
L.push(`- weights by number: ${Object.entries(tipografia.pesos.por_numero).map(([k, v]) => `${k}: ${v}`).join(', ') || '—'}`)
L.push(`- tracking: ${tipografia.tracking.valores.slice(0, 8).map((f) => `${cod(f.valor)} ${f.n}`).join(', ') || '—'}`)
L.push(`- large sizes: ${tipografia.tamanhos_grandes.valores.slice(0, 8).map((f) => `${cod(f.valor)} ${f.n}`).join(', ') || '—'}`, '')

L.push('## Shape', '')
for (const [k, rot] of [['raios', 'Radii'], ['sombras', 'Shadows'], ['bordas', 'Borders']]) {
  const f = forma[k]
  L.push(`### ${rot} (${f.total} uses)`, '')
  if (f.tokens?.length) L.push(`Tokens: ${f.tokens.slice(0, 8).map((t) => `${cod(t.nome)} = ${cod(t.valor)} ${t.local}${t.usos ? ` (${t.usos} uses)` : ''}`).join(' · ')}`, '')
  L.push(tabela(['value', 'n', 'example'], f.valores.slice(0, 12).map((v) => [cod(v.valor), v.n, exTxt(v.exemplos)])) + mais(f.valores, 12), '')
}
L.push(`Effects: backdrop ${forma.backdrop.total} (${forma.backdrop.valores.slice(0, 4).map((v) => `${cod(v.valor)} ${v.n}`).join(', ')}) · gradients ${forma.gradientes.total} (${forma.gradientes.valores.slice(0, 4).map((v) => `${cod(v.valor)} ${v.n}`).join(', ')}) · blend ${forma.blend.total} · texture ${forma.textura.total}${forma.textura.imagens.length ? ` (images: ${forma.textura.imagens.slice(0, 4).map(cod).join(', ')})` : ''}`, '')

L.push('## Density (class count)', '')
for (const [k, rot] of [['padding', 'padding (p-*)'], ['gap', 'gap-*'], ['space', 'space-*'], ['texto', 'text size']]) L.push(`- ${rot}: ${Object.entries(densidade[k]).slice(0, 12).map(([t, n]) => `${t}: ${n}`).join(', ') || '—'}`)
L.push('')

L.push(`## Brand files (${marca.total})`, '', tabela(['file', 'bytes', 'viewBox'], marca.arquivos.slice(0, 15).map((a) => [cod(a.arquivo), a.bytes, cod(a.viewBox)])) + mais(marca.arquivos, 15), '')

L.push(`## Documents (${documentos.length})`, '', tabela(['file', 'title', 'KB', 'excerpts'], documentos.slice(0, 15).map((d) => [cod(d.arquivo), cel(d.titulo), (d.bytes / 1024).toFixed(1), d.trechos.length])) + mais(documentos, 15), '')
const trechosMd = documentos.flatMap((d) => d.trechos.slice(0, 2).map((t) => [`${d.arquivo}:${t.linha}`, t.palavras.join(', '), cel(t.texto.slice(0, 160))])).slice(0, 15)
L.push('First excerpts that mention audience, product or brand:', '', tabela(['where', 'words', 'excerpt'], trechosMd), '')

L.push('## Screen vocabulary', '', `Language by stopword count: pt ${vocabulario.idioma.stopwords_pt} × en ${vocabulario.idioma.stopwords_en} → **${IDIOMA[vocabulario.idioma.predominante] ?? vocabulario.idioma.predominante}**. ${vocabulario.textos_colhidos} texts collected, ${vocabulario.frases_distintas} distinct phrases of 1 to 8 words.`, '')
L.push(tabela(['phrase', 'n', 'example', 'source'], frases.slice(0, 15).map((f) => [cel(f.texto), f.n, f.exemplo, f.origem])) + mais(frases, 15), '')
L.push(`Most frequent words: ${vocabulario.palavras.slice(0, 25).map((p) => `${p.palavra} (${p.n})`).join(', ') || '—'}`, '')

L.push('## Sound', '', `${somOut.arquivos_de_audio.total} audio files${somOut.arquivos_de_audio.total ? ': ' + somOut.arquivos_de_audio.arquivos.slice(0, 6).map((a) => cod(a.arquivo)).join(', ') : ''}.`, '')
L.push(tabela(['word', 'n', 'files', 'example'], somOut.mencoes.slice(0, 12).map((m) => [cod(m.palavra), m.n, m.arquivos, exTxt(m.exemplos)])) + mais(somOut.mencoes, 12), '')

const sinalTxt = (s) => `${s.videos} videos · ${[...s.pastas_de_serie, ...s.arquivos_de_serie].slice(0, 6).map(cod).join(', ') || 'no series file'}`
L.push('## Videos and series that already exist', '', 'A series that already exists (approved or rejected) is the strongest evidence for the reading: open it and read it before deciding.', '')
L.push(`- in the project: ${sinalTxt(historico.projeto)}`)
if (historico.git) {
  L.push(`- git branches: ${historico.git.ramos_total}; those about video, help or brand: ${historico.git.ramos_de_video_ou_marca.slice(0, 20).map(cod).join(', ') || 'none'}`)
  L.push(`- worktrees of the same git with a video sign: ${historico.git.worktrees_com_sinal.length} of ${historico.git.worktrees_total}`)
  for (const w of historico.git.worktrees_com_sinal.slice(0, 10)) L.push(`  - ${cod(w.caminho)} (branch ${cod(w.ramo)}): ${sinalTxt(w)}`)
}
const irmasComSinal = historico.irmas.filter(temSinal)
L.push(`- sibling folders whose name starts the same way (besides the worktrees above): ${historico.irmas.length}, with a video sign: ${irmasComSinal.length}`)
for (const i of irmasComSinal.slice(0, 10)) L.push(`  - ${cod(i.caminho)}: ${sinalTxt(i)}`)
L.push('')

L.push('## Ignored', '', `Secrets (${ignorados.segredos.length}, path and reason only): ${ignorados.segredos.slice(0, 20).map((s) => `${cod(s.arquivo)} (${MOTIVO[s.motivo] ?? s.motivo})`).join(', ') || 'none'}${ignorados.segredos.length > 20 ? ' …' : ''}`, '')
L.push(`Outside the product: ${ignorados.fora_do_produto.arquivos} files (${ignorados.fora_do_produto.criterio}).`, '')
L.push(`Skipped folders: ${ignorados.pastas.length}. Limits: ${ignorados.limites.length ? ignorados.limites.map(cel).join('; ') : 'none'}.`, '')

fs.mkdirSync(saida, { recursive: true })
const caminhoJson = path.join(saida, 'leitura.bruta.json'), caminhoMd = path.join(saida, 'leitura.bruta.md')
fs.writeFileSync(caminhoJson, JSON.stringify(saidaJson, null, 2) + '\n')
fs.writeFileSync(caminhoMd, L.join('\n') + '\n')
console.log(`leitura: ${saidaJson.projeto.arquivos_vistos} files seen, ${textos.length} read · ${coresTokens.length} color tokens, ${literais.length} loose colors, ${fontes.length} families, ${documentos.length} documents, ${frases.length} phrases · ${ignorados.segredos.length} skipped as secrets · ${Date.now() - inicio} ms → ${caminhoJson} | ${caminhoMd}`)
