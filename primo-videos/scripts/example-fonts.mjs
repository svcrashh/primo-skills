#!/usr/bin/env node
// A fonte dos exemplos (a Inter que vem na skill, em assets/example/fonts; SIL Open Font License) dentro de um projeto de
// vídeo: <folder>/fonts/inter-*.woff2 + o bloco "Inter" no fonts.css, no mesmo formato do scripts/fonts.mjs. Todo molde
// pula o download quando o fonts.css já traz a família, então o exemplo roda sem rede. É só para os exemplos e os testes:
// num vídeo de verdade a fonte é a da marca da pessoa (scripts/fonts.mjs).
// Uso: node example-fonts.mjs <folder> [<folder> …]
//   explicação desenhada: <output>/.work-<name>       (antes do render.mjs)
//   número que conta, lista, teaser, antes e depois, texto que se digita: a pasta do projeto que o molde monta
//   capítulos: <video folder>/template                 tutorial: a pasta da série
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ORIGEM = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'assets', 'example', 'fonts')
const PESOS = { 400: 'Inter-Regular.woff2', 500: 'Inter-Medium.woff2', 600: 'Inter-SemiBold.woff2', 700: 'Inter-Bold.woff2' }

const pastas = process.argv.slice(2)
if (!pastas.length) { console.error('usage: node example-fonts.mjs <folder> [<folder> …]  (the examples\' Inter goes to <folder>/fonts/)'); process.exit(1) }
const faltam = Object.values(PESOS).filter((f) => !fs.existsSync(path.join(ORIGEM, f)))
if (faltam.length) { console.error(`the examples' font was not found in ${ORIGEM} (${faltam.join(', ')}): the skill folder is incomplete, clone it again`); process.exit(1) }

for (const p of pastas) {
  const dir = path.join(path.resolve(p), 'fonts')
  fs.mkdirSync(dir, { recursive: true })
  const cssPath = path.join(dir, 'fonts.css')
  let css = fs.existsSync(cssPath) ? fs.readFileSync(cssPath, 'utf8') : ''
  css = css.replace(/\/\* Inter \*\/[\s\S]*?\/\* fim Inter \*\/\n?/g, '')
  let bloco = '/* Inter */\n'
  for (const [peso, arq] of Object.entries(PESOS)) {
    const nome = `inter-normal-${peso}.woff2`
    fs.copyFileSync(path.join(ORIGEM, arq), path.join(dir, nome))
    bloco += `@font-face { font-family: "Inter"; src: url(${nome}) format("woff2"); font-style: normal; font-weight: ${peso}; font-display: block; }\n`
  }
  fs.writeFileSync(cssPath, css + bloco + '/* fim Inter */\n')
  console.log(`✓ the examples' Inter (400, 500, 600, 700) in ${dir}`)
}
