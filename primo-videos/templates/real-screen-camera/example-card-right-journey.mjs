#!/usr/bin/env node
// The recording for example-card-right.json: the sample page (assets/example/page.html), light theme, 940×660 at DSF 3
// (like example-journey.mjs). Three real steps: in the contents, Install; the Terminal block with the command; the Copy
// button, which turns into Copied. 2.4 s of reading per step (medium pace). Records with the skill's recorder
// (scripts/tutorial/record.mjs, references/tutorial.md §3–§8).
//   node example-card-right-journey.mjs [--folder <where to record>] [--page <path to the HTML page>] [--check]
// --check runs the journey without recording: every target is found and nothing covers it. It still ends with "the
// series does not exist", a check the recorder makes for tutorial series, which this template does not use.
// Output in <folder>/output/computer/ (events.json, frames.json, frames/): it is the "gravacao" of example-card-right.json.
// Default folder: ~/Documents/VideoStudio/examples/real-screen-camera-card-right/recording (the raw recording stays out of the template).
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { rodar } from '../../scripts/tutorial/record.mjs'

const argv = process.argv.slice(2)
const arg = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 ? argv[i + 1] : d }
// the sample page ships with the skill (assets/example/page.html); --page records another copy of it
const pagina = arg('page') ? path.resolve(arg('page')) : fileURLToPath(new URL('../../assets/example/page.html', import.meta.url))
if (!fs.existsSync(pagina)) { console.error(`page not found at ${pagina}: pass --page <path to the HTML page>`); process.exit(1) }
const pasta = path.resolve(arg('folder', path.join(os.homedir(), 'Documents', 'VideoStudio', 'examples', 'real-screen-camera-card-right', 'recording')))
fs.mkdirSync(pasta, { recursive: true })

const BLOCO = '.code'   // the Terminal block: label, command and Copy button
const video = {
  id: 'real-screen-camera-example-card-right',
  titulo: 'Install the product',
  url: pathToFileURL(pagina).href,
  versoes: ['computer'],
  aparelhos: { computer: { viewport: { width: 940, height: 660 }, dsf: 3 } },
  pasta,
  idioma: 'en-US',
  tema: 'light',
  leituraMin: 2.4,
  async roteiro(g) {
    await g.passo('In the contents, click Install.')
    await g.toque('#contents a[href="#install"]', { depois: 1000 })
    await g.passo('The command is on one line.')
    await g.aponta('#command', { ms: 1300 })
    await g.passo('Click Copy.')
    await g.toque('#copy', { depois: 900 })
    await g.sucesso(BLOCO, { ms: 1100 })
  },
}

await rodar(video)
