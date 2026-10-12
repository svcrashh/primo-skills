// The example series recorded end to end: a tutorial of the neutral sample page that ships with the skill
// (assets/example/page.html), in 2 sections and 4 steps. It only shows the format: in a real video the screen is the
// person's own product. To run it: copy the series to <project>/_serie, apply a variant on top (variants/<name>/*),
// copy this file to <project>/01-guide/video.mjs and run it like any video in the series (references/tutorial.md, the
// computer recipe). All on-screen text in English: the step label, the step counter and the ending lines are set here.
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

// The installed primo-videos skill (~/.claude/skills/primo-videos); VIDEOSTUDIO_SKILL=<skill folder> overrides it.
const SKILL = [process.env.VIDEOSTUDIO_SKILL, path.join(os.homedir(), '.claude', 'skills', 'primo-videos')]
  .find((d) => d && fs.existsSync(path.join(d, 'scripts', 'tutorial', 'record.mjs')))
if (!SKILL) throw new Error('primo-videos skill not found: install it in ~/.claude/skills/primo-videos or set VIDEOSTUDIO_SKILL=<skill folder>')
const { rodar, principal } = await import(pathToFileURL(path.join(SKILL, 'scripts', 'tutorial', 'record.mjs')).href)

const video = {
  id: 'panel-tutorial-example',
  titulo: 'Find what you need on the sample page',
  rotulo: 'Step by step',
  passo: 'Step {n} of {N}',
  fimLinhas: ['Done'],
  url: pathToFileURL(path.join(SKILL, 'assets', 'example', 'page.html')).href,
  endereco: 'yourproduct.com',
  versoes: ['computer'],
  pasta: path.dirname(fileURLToPath(import.meta.url)),
  serie: '../_serie',
  idioma: 'en-US', fuso: 'America/Sao_Paulo', tema: 'light',
  privacidade: { emailsPermitidos: '@example\\.com$' },
  borrar: [],
  async roteiro(g) {
    await g.secao('Search')
    await g.passo('Search for a topic in the top field.')
    await g.digita('#search', 'report', { atraso: 90 })
    await g.espera(600, { motivo: 'the search keeps only the parts that match' })
    await g.aponta('#search-count', { ms: 1300 })
    await g.passo('Clear the search with the X.')
    await g.toque('#search-clear')
    await g.secao('Contents')
    await g.passo('Open Install in the contents.')
    await g.toque('#contents a[href="#install"]')
    await g.espera(1000, { motivo: 'the page scrolls to the section' })
    await g.passo('Copy the install command.')
    await g.toque('#copy')
    await g.sucesso('#copy', { ms: 1200 })
  },
}
export default video
if (principal(import.meta.url)) await rodar(video)
