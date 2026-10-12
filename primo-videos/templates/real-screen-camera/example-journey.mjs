#!/usr/bin/env node
// The recording for example.json: the sample page (assets/example/page.html), light theme, 940×660 at DSF 3: at this
// width the contents sit beside the text and the text column fits whole in the template's minimum zoom (1.9×); at 1280
// it would exceed the free area. Two real steps: in the contents, How it works; then the four steps of that part.
// Records with the skill's recorder (scripts/tutorial/record.mjs, references/tutorial.md §3–§8).
//   node example-journey.mjs [--folder <where to record>] [--page <path to the HTML page>] [--check]
// --check runs the journey without recording: every target is found and nothing covers it. It still ends with "the
// series does not exist", a check the recorder makes for tutorial series, which this template does not use.
// Output in <folder>/output/computer/ (events.json, frames.json, frames/): it is the "gravacao" of example.json.
// Default folder: ~/Documents/VideoStudio/examples/real-screen-camera/recording (the raw recording stays out of the template).
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
const pasta = path.resolve(arg('folder', path.join(os.homedir(), 'Documents', 'VideoStudio', 'examples', 'real-screen-camera', 'recording')))
fs.mkdirSync(pasta, { recursive: true })

const video = {
  id: 'real-screen-camera-example',
  titulo: 'How it works on the page',
  url: pathToFileURL(pagina).href,
  versoes: ['computer'],
  aparelhos: { computer: { viewport: { width: 940, height: 660 }, dsf: 3 } },
  pasta,
  idioma: 'en-US',
  tema: 'light',
  async roteiro(g) {
    await g.passo('In the contents, click How it works.')
    await g.toque('#contents a[href="#how-it-works"]', { depois: 1200 })
    await g.passo('See the four steps, in order.')
    await g.rola('.steps', { bloco: 'center' })
    await g.aponta('.steps li:first-child span', { ms: 700 })
    await g.sucesso('.steps', { ms: 600 })
  },
}

await rodar(video)
