#!/usr/bin/env node
// Extrai as partes de um logo SVG para animar (cada forma vira uma parte com d, fill e transform).
// Uso: node logo.mjs arquivo.svg [--split] [--js NOME]
//   --split  separa caminhos compostos em subcaminhos (peças de quebra-cabeça, letras). Atenção:
//              furos (o miolo do "P", do "O") viram partes soltas — junte-os de volta ao contorno dono
//              (no navegador, agrupe por getBBox) antes de animar letra a letra.
//   --js NOME  imprime como `const NOME = {...}` em vez de JSON.
// Entende path, circle, ellipse, rect, polygon, polyline, <g transform>, fill por atributo, style e classe.
import fs from 'node:fs'

const args = process.argv.slice(2)
const arq = args.find((a) => !a.startsWith('--') && args[args.indexOf(a) - 1] !== '--js')
if (!arq) { console.error('usage: node logo.mjs file.svg [--split] [--js NAME]'); process.exit(1) }
let s = fs.readFileSync(arq, 'utf8').replace(/<metadata[\s\S]*?<\/metadata>/g, '').replace(/<!--[\s\S]*?-->/g, '')
const vb = (s.match(/<svg[^>]*viewBox="([^"]+)"/) || [])[1] || (() => {
  const w = (s.match(/<svg[^>]*width="([\d.]+)/) || [])[1], h = (s.match(/<svg[^>]*height="([\d.]+)/) || [])[1]
  return w && h ? `0 0 ${w} ${h}` : '0 0 100 100'
})()
const classes = {}
for (const st of s.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)) {
  for (const r of st[1].matchAll(/([^{}]+)\{([^}]*)\}/g)) {
    const fill = (r[2].match(/fill\s*:\s*([^;]+)/) || [])[1]
    if (fill) for (const sel of r[1].split(',')) { const m = sel.trim().match(/^\.([\w-]+)$/); if (m) classes[m[1]] = fill.trim() }
  }
}
const attr = (tag, n) => (tag.match(new RegExp(`\\s${n}="([^"]*)"`)) || [])[1]
function fillDe(tag, herdado) {
  const st = attr(tag, 'style'); const sf = st && (st.match(/fill\s*:\s*([^;]+)/) || [])[1]
  const cls = attr(tag, 'class'); const cf = cls && cls.split(/\s+/).map((c) => classes[c]).find(Boolean)
  return (sf || attr(tag, 'fill') || cf || herdado || '#000').trim()
}
const num = (v) => +v
function forma(nome, tag) {
  if (nome === 'path') return attr(tag, 'd')
  if (nome === 'circle' || nome === 'ellipse') {
    const cx = num(attr(tag, 'cx') || 0), cy = num(attr(tag, 'cy') || 0)
    const rx = num(attr(tag, 'rx') || attr(tag, 'r')), ry = num(attr(tag, 'ry') || attr(tag, 'r'))
    return `M ${cx - rx},${cy} a ${rx},${ry} 0 1,0 ${2 * rx},0 a ${rx},${ry} 0 1,0 ${-2 * rx},0 Z`
  }
  if (nome === 'rect') {
    const x = num(attr(tag, 'x') || 0), y = num(attr(tag, 'y') || 0), w = num(attr(tag, 'width')), h = num(attr(tag, 'height'))
    const r = Math.min(num(attr(tag, 'rx') || attr(tag, 'ry') || 0), w / 2, h / 2)
    if (!r) return `M ${x},${y} H ${x + w} V ${y + h} H ${x} Z`
    return `M ${x + r},${y} H ${x + w - r} A ${r},${r} 0 0 1 ${x + w},${y + r} V ${y + h - r} A ${r},${r} 0 0 1 ${x + w - r},${y + h} H ${x + r} A ${r},${r} 0 0 1 ${x},${y + h - r} V ${y + r} A ${r},${r} 0 0 1 ${x + r},${y} Z`
  }
  if (nome === 'polygon' || nome === 'polyline') {
    const p = attr(tag, 'points').trim().split(/[\s,]+/).map(Number), pts = []
    for (let i = 0; i < p.length; i += 2) pts.push(`${p[i]},${p[i + 1]}`)
    return `M ${pts.join(' L ')}${nome === 'polygon' ? ' Z' : ''}`
  }
  return null
}
const partes = []
const pilha = [{ transform: '', fill: null }]
for (const m of s.matchAll(/<(\/?)(g|path|circle|ellipse|rect|polygon|polyline|defs|clipPath|mask)\b([^>]*?)(\/?)>/g)) {
  const [, fecha, nome, resto, auto] = m
  const tag = ' ' + resto
  const topo = pilha[pilha.length - 1]
  if (['defs', 'clipPath', 'mask'].includes(nome)) { if (fecha) pilha.pop(); else if (!auto) pilha.push({ ...topo, ignorar: true }); continue }
  if (nome === 'g') {
    if (fecha) pilha.pop()
    else if (!auto) pilha.push({ transform: [topo.transform, attr(tag, 'transform')].filter(Boolean).join(' '), fill: fillDe(tag, topo.fill), ignorar: topo.ignorar })
    continue
  }
  if (fecha || topo.ignorar) continue
  const d = forma(nome, tag); if (!d) continue
  const fill = fillDe(tag, topo.fill)
  if (fill === 'none') continue
  const transform = [topo.transform, attr(tag, 'transform')].filter(Boolean).join(' ')
  const pedacos = args.includes('--split') ? d.trim().split(/(?=[Mm])/).filter((x) => x.trim()) : [d]
  // subcaminho relativo ("m") depois do primeiro só é seguro se o anterior fechou no ponto inicial;
  // na dúvida, não divida caminhos com "m" minúsculo.
  if (pedacos.length > 1 && pedacos.slice(1).some((x) => x.trim().startsWith('m'))) { partes.push({ nome: `p${partes.length + 1}`, d, fill, transform }); continue }
  for (const pd of pedacos) partes.push({ nome: `p${partes.length + 1}`, d: pd.trim(), fill, transform })
}
const out = { viewBox: vb, partes }
const js = args.indexOf('--js')
console.log(js >= 0 ? `const ${args[js + 1]} = ${JSON.stringify(out, null, 2)}` : JSON.stringify(out, null, 2))
console.error(`${partes.length} part(s) · viewBox ${vb} · colors: ${[...new Set(partes.map((p) => p.fill))].join(' ')}`)
