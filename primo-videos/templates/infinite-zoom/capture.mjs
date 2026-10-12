#!/usr/bin/env node
// Captura as telas do zoom infinito: um print por nível (a página real no Playwright da skill, no tema do JSON e na
// janela de cada nível, em DSF alto para o zoom não amolecer) e o retângulo do detalhe em que a câmera mergulha.
// O render.mjs chama isto sozinho quando a captura não existe ou o JSON dela mudou; rode à mão para refazer.
//   node capture.mjs <parametros.json> --out <folder>
// Sai <folder>/nivel-<n>.jpg e <folder>/niveis.json ([{ arquivo, w, h, dsf, alvo: { x, y, w, h }, seletor }], em px CSS).
//
// Cada nível (niveis[n].tela): { "largura": 560, "altura": 440 } a janela do navegador; "rolar": "#seletor" põe o
// elemento no alto, a "margem" px do topo (padrão captura.margem, 76: a barra fixa da página + respiro); "clicar":
// "#seletor" (ou lista) clica antes do print (abrir um item, um menu); "esperar": ms depois disso (padrão 450).
// niveis[n].entrar: o seletor do detalhe. Ele tem de estar inteiro na janela capturada.
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { conferir, caminho, assinaturaCaptura } from './params.mjs'

const require = createRequire(import.meta.url)

/** Captura todos os níveis; devolve a lista do niveis.json. */
export async function capturar(cfg, base, pasta) {
  const { abrirNavegador } = require('../../scripts/playwright.cjs')
  const c = cfg.captura
  const [arq, hash] = String(c.pagina || '').split('#')
  const url = c.url || pathToFileURL(caminho(base, arq)).href + (hash ? '#' + hash : '')
  fs.mkdirSync(pasta, { recursive: true })
  const { browser } = await abrirNavegador(pasta)
  const saida = []
  try {
    for (const [k, nv] of cfg.niveis.entries()) {
      const t = nv.tela
      const ctx = await browser.newContext({ viewport: { width: t.largura, height: t.altura }, deviceScaleFactor: c.dsf, colorScheme: c.tema === 'escuro' ? 'dark' : 'light', locale: c.idioma || 'en-US', reducedMotion: 'reduce' })
      const p = await ctx.newPage()
      if (c.bloquear?.length) await p.route(new RegExp(c.bloquear.join('|')), (r) => r.abort())
      await p.goto(url, { waitUntil: 'load' })
      await p.evaluate(() => document.fonts.ready)
      for (const s of [].concat(t.clicar || [])) {
        const l = p.locator(s).first()
        if (!(await l.count())) throw new Error(`niveis[${k}].tela.clicar: "${s}" does not exist on the page`)
        await l.click()
        await p.waitForTimeout(250)
      }
      if (t.rolar) {
        const ok = await p.evaluate(([s, m]) => { const e = document.querySelector(s); if (!e) return false; window.scrollTo({ top: e.getBoundingClientRect().top + window.scrollY - m, behavior: 'instant' }); return true }, [t.rolar, t.margem ?? c.margem])
        if (!ok) throw new Error(`niveis[${k}].tela.rolar: "${t.rolar}" does not exist on the page`)
      }
      await p.waitForTimeout(t.esperar ?? 450)
      const alvo = await p.evaluate((s) => { const e = document.querySelector(s); if (!e) return null; const r = e.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height } }, nv.entrar)
      if (!alvo) throw new Error(`niveis[${k}].entrar: "${nv.entrar}" does not exist on the level ${k + 1} screen`)
      if (alvo.w < 4 || alvo.h < 4) throw new Error(`niveis[${k}].entrar: "${nv.entrar}" is hidden (${Math.round(alvo.w)}×${Math.round(alvo.h)} px): pick a visible element`)
      if (alvo.x < 0 || alvo.y < 0 || alvo.x + alvo.w > t.largura + 1 || alvo.y + alvo.h > t.altura + 1)
        throw new Error(`niveis[${k}].entrar: "${nv.entrar}" is outside the captured screen (x ${Math.round(alvo.x)}–${Math.round(alvo.x + alvo.w)}, y ${Math.round(alvo.y)}–${Math.round(alvo.y + alvo.h)} in a ${t.largura}×${t.altura} window): change tela.rolar, tela.margem or the screen size`)
      // o detalhe tem de ser bem menor que a tela, senão não há mergulho (a tela seguinte nasceria do tamanho desta)
      if (alvo.w > t.largura * 0.7 || alvo.h > t.altura * 0.7)
        throw new Error(`niveis[${k}].entrar: "${nv.entrar}" takes ${Math.round((100 * alvo.w) / t.largura)}% of the width and ${Math.round((100 * alvo.h) / t.altura)}% of the height of the level ${k + 1} screen: pick a smaller detail (a link, a label, an icon, up to 70% of the screen) or capture a bigger screen`)
      const nome = `nivel-${k + 1}.jpg`
      await p.screenshot({ path: path.join(pasta, nome), type: 'jpeg', quality: 90 })
      saida.push({ arquivo: nome, w: t.largura, h: t.altura, dsf: c.dsf, alvo: Object.fromEntries(Object.entries(alvo).map(([a, v]) => [a, +v.toFixed(2)])), seletor: nv.entrar })
      await ctx.close()
    }
  } finally { await browser.close() }
  fs.writeFileSync(path.join(pasta, 'niveis.json'), JSON.stringify({ assinatura: assinaturaCaptura(cfg), niveis: saida }, null, 1) + '\n')
  return saida
}

// caminho real dos dois lados: a skill é instalada por link simbólico, e aí o argv[1] não bate com o import.meta.url
if (process.argv[1] && (() => { try { return fs.realpathSync(process.argv[1]) === fs.realpathSync(fileURLToPath(import.meta.url)) } catch { return false } })()) {
  const a = process.argv.slice(2), arg = (k) => { const i = a.indexOf('--' + k); return i >= 0 ? a[i + 1] : null }
  const arqP = a.find((x) => x.endsWith('.json'))
  if (!arqP || !arg('out')) { console.error('usage: node capture.mjs <parametros.json> --out <folder>'); process.exit(1) }
  const base = path.dirname(path.resolve(arqP))
  const { erros, cfg } = conferir(JSON.parse(fs.readFileSync(arqP, 'utf8')), base, { arquivos: false })
  if (erros.length) { for (const e of erros) console.error('✗ ' + e); process.exit(1) }
  try {
    const n = await capturar(cfg, base, path.resolve(arg('out')))
    console.log(`✓ ${n.length} levels in ${path.resolve(arg('out'))}`)
  } catch (e) { console.error('✗ ' + e.message); process.exit(1) }
}
