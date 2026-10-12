#!/usr/bin/env node
// The recording for example-card-below.json: the sample page (assets/example/page.html), DARK theme, 940×660 at DSF 3.
// Two real steps: type "items" in the page's search; in the contents that remain, open Details, where the row with the
// 128 items is. 2.4 s of reading per step (medium pace). Records with the skill's recorder
// (scripts/tutorial/record.mjs, references/tutorial.md §3–§8).
//   node example-card-below-journey.mjs [--folder <where to record>] [--page <path to the HTML page>] [--check]
// --check runs the journey without recording: every target is found and nothing covers it. It still ends with "the
// series does not exist", a check the recorder makes for tutorial series, which this template does not use.
// Output in <folder>/output/computer/ (events.json, frames.json, frames/): it is the "gravacao" of example-card-below.json.
// Default folder: ~/Documents/VideoStudio/examples/real-screen-camera-card-below/recording (the raw recording stays out of the template).
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
const pasta = path.resolve(arg('folder', path.join(os.homedir(), 'Documents', 'VideoStudio', 'examples', 'real-screen-camera-card-below', 'recording')))
fs.mkdirSync(pasta, { recursive: true })

const video = {
  id: 'real-screen-camera-example-card-below',
  titulo: 'Search the page',
  url: pathToFileURL(pagina).href,
  versoes: ['computer'],
  aparelhos: { computer: { viewport: { width: 940, height: 660 }, dsf: 3 } },
  pasta,
  idioma: 'en-US',
  tema: 'dark',
  leituraMin: 2.4,
  // the sample page changes theme by its Theme button, not by the system: switch it before the recording starts
  async preparar({ p }) { await p.locator('#theme').dispatchEvent('click') },
  async roteiro(g) {
    await g.passo('In the search, type items.')
    await g.digita('#search', 'items', { depois: 900 })
    await g.passo('In the contents that remain, open Details.')
    await g.toque('#contents a[href="#details"]', { depois: 1000 })
    await g.sucesso('#detail-items', { ms: 1300 })
  },
}

await rodar(video)
