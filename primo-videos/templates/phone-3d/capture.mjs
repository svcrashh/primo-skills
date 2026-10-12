#!/usr/bin/env node
// Grava a tela real que o celular 3D mostra: a página (captura.pagina ou captura.url) num celular de 390 px (DSF 3),
// fazendo a jornada do JSON (rolar, tocar), com o gravador da skill (scripts/tutorial/record.mjs). O render.mjs
// chama isto sozinho quando a gravação não existe ou a captura do JSON mudou; rode à mão para regravar.
//   node capture.mjs <parametros.json> --out <folder>
// Sai <folder>/output/<aparelho>/ (events.json, frames.json, frames/, taps-sheet.png) e <folder>/assinatura.txt (do que a
// gravação depende: o renderizar grava de novo quando a captura do JSON muda). A gravação crua tem dezenas de MB:
// fica fora do molde.
//
// captura.jornada, na ordem (cada item uma ação; o tempo de leitura de cada passo é o do gravador, ≥ 3 s):
//   { "passo": "Role até os planos" }           a frase do passo (vira o texto ao lado do celular)
//   { "rola": "#seletor", "bloco": "start" }    rola até o alvo (ou { "rola": 320 }: px)
//   { "toque": "#seletor" }                     toca no alvo (com a checagem de "tem algo na frente?" do gravador)
//   { "pausa": 600 }                            espera, em ms
//   { "sucesso": "#seletor" }                   marca o resultado (a câmera vai até ele)
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { rodar } from '../../scripts/tutorial/record.mjs'
import { conferir, caminho, assinaturaCaptura } from './params.mjs'

/** Grava a jornada; devolve a pasta da gravação (<folder>/output/<aparelho>). */
export async function capturar(cfg, base, pasta) {
  const c = cfg.captura
  const [arq, hash] = String(c.pagina || '').split('#')
  const url = c.url || pathToFileURL(caminho(base, arq)).href + (hash ? '#' + hash : '')
  fs.mkdirSync(pasta, { recursive: true })
  const video = {
    id: cfg.nome, titulo: cfg.nome, url, versoes: [c.aparelho], pasta, idioma: c.idioma || 'en-US', tema: c.tema === 'escuro' ? 'dark' : 'light',
    leituraMin: c.leituraMin, ...(c.inicio ? { inicio: c.inicio } : {}), ...(c.viewport ? { aparelhos: { [c.aparelho]: { viewport: c.viewport, dsf: c.dsf || 3, toque: true } } } : {}),
    async roteiro(g) {
      for (const s of c.jornada) {
        if (s.passo) await g.passo(s.passo)
        else if (s.rola != null) await g.rola(s.rola, { bloco: s.bloco || 'center' })
        else if (s.toque) await g.toque(s.toque, { depois: s.depois ?? 900 })
        else if (s.pausa) await g.pausa(s.pausa)
        else if (s.sucesso) await g.sucesso(s.sucesso, { ms: s.ms ?? 900 })
      }
    },
  }
  const [r] = await rodar(video, { check: false, versao: c.aparelho, captura: 'screencast' })
  if (!r || !r.ok) throw new Error(`the recording failed: ${r ? r.erro : 'no result'} (the image of where it failed is at ${path.join(pasta, 'output', c.aparelho, 'failure.png')})`)
  fs.writeFileSync(path.join(pasta, 'assinatura.txt'), assinaturaCaptura(cfg) + '\n')   // o renderizar grava de novo se a captura do JSON mudar
  return path.join(pasta, 'output', c.aparelho)
}

// caminho real dos dois lados: a skill é instalada por link simbólico, e aí o argv[1] não bate com o import.meta.url
if (process.argv[1] && (() => { try { return fs.realpathSync(process.argv[1]) === fs.realpathSync(fileURLToPath(import.meta.url)) } catch { return false } })()) {
  const a = process.argv.slice(2), arg = (k) => { const i = a.indexOf('--' + k); return i >= 0 ? a[i + 1] : null }
  const arqP = a.find((x) => x.endsWith('.json'))
  if (!arqP || !arg('out')) { console.error('usage: node capture.mjs <params.json> --out <folder>'); process.exit(1) }
  const base = path.dirname(path.resolve(arqP))
  const { erros, cfg } = conferir(JSON.parse(fs.readFileSync(arqP, 'utf8')), base, { arquivos: false })
  if (erros.length) { for (const e of erros) console.error('✗ ' + e); process.exit(1) }
  const g = await capturar(cfg, base, path.resolve(arg('out')))
  console.log(`✓ recording in ${g} (look at taps-sheet.png)`)
}
