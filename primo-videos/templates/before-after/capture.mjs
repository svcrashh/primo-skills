#!/usr/bin/env node
// Captura os dois estados da MESMA tela, no mesmo viewport: "antes" e "depois".
//   node capture.mjs <parametros.json> --out <folder>
// Lê o bloco "captura" do JSON de parâmetros e grava <folder>/<tela>-antes.png e <tela>-depois.png
// (uma tela por viewport: "desk", "cel"...). O "depois" vem de um clique de verdade ("clicar": seletor),
// de um estado encenado ("css" injetado / "js" rodado) ou de outra URL ("url").
// Rotas de "bloquear" são abortadas (analytics, registro de aparelho): a captura não suja dado de ninguém.
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { createRequire } from 'node:module'
import { pathToFileURL } from 'node:url'

const require = createRequire(import.meta.url)
const { abrirNavegador } = require('../../scripts/playwright.cjs')
const argv = process.argv.slice(2)
const arg = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 ? argv[i + 1] : d }
const exp = (p) => (p && p.startsWith('~') ? path.join(os.homedir(), p.slice(1)) : p)
const jsonP = path.resolve(argv[0] || '')
if (!argv[0] || !fs.existsSync(jsonP)) { console.error('usage: node capture.mjs <parametros.json> --out <folder>'); process.exit(1) }
const cfg = JSON.parse(fs.readFileSync(jsonP, 'utf8'))
const cap = cfg.captura
if (!cap) { console.error('the JSON has no "captura" block (the screens come ready in "telas")'); process.exit(1) }
const saida = path.resolve(exp(arg('out', path.join(path.dirname(jsonP), 'telas'))))
fs.mkdirSync(saida, { recursive: true })
const resolveUrl = (u) => {
  if (/^[a-z][a-z0-9+.-]+:/i.test(u)) return u   // esquema tem 2+ letras: C:\… é caminho do Windows, não URL
  const [arq, q] = u.split('?')
  return pathToFileURL(path.resolve(path.dirname(jsonP), arq)).href + (q ? '?' + q : '')
}

const { browser } = await abrirNavegador(process.cwd())
let bloqueados = 0
for (const [nome, vp] of Object.entries(cap.telas)) {
  for (const estado of ['antes', 'depois']) {
    const ctx = await browser.newContext({ viewport: { width: vp.w, height: vp.h }, deviceScaleFactor: vp.escala || 2 })
    const p = await ctx.newPage()
    if (cap.bloquear?.length) await p.route(new RegExp(cap.bloquear.join('|')), (r) => { bloqueados++; return r.abort() })
    const d = cap.depois || {}
    const url = estado === 'depois' && d.url ? d.url : cap.url
    await p.goto(resolveUrl(url), { waitUntil: 'networkidle' })
    if (cap.rolar) await p.evaluate((y) => window.scrollTo(0, y), cap.rolar)
    await p.waitForTimeout(cap.esperar ?? 800)
    if (estado === 'depois') {
      if (d.clicar) await p.click(d.clicar)
      if (d.css) await p.addStyleTag({ content: d.css })
      if (d.js) await p.evaluate(d.js)
      await p.waitForTimeout(d.esperar ?? 600)
    }
    const arq = path.join(saida, `${nome}-${estado}.png`)
    await p.screenshot({ path: arq })
    console.log(`✓ ${arq}  (${vp.w}×${vp.h} @${vp.escala || 2}x)`)
    await ctx.close()
  }
}
await browser.close()
if (cap.bloquear?.length) console.log(`blocked routes: ${bloqueados} (${cap.bloquear.join(', ')})`)
