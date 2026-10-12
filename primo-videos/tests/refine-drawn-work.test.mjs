// node --test tests/   (sem rede): o refine.mjs reconhece a obra do molde explicação desenhada — o mapa do vídeo
// (out/assembly.json), a plataforma do params.js e o MP4 com som na pasta de cima (o mais novo entre final e draft).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { obraDesenhada, videoDaObra } from '../scripts/refine.mjs'

function obraFalsa() {
  const saida = fs.mkdtempSync(path.join(os.tmpdir(), 'obra-desenhada-'))
  const obra = path.join(saida, '.work-marca')
  fs.mkdirSync(path.join(obra, 'engine'), { recursive: true })
  fs.mkdirSync(path.join(obra, 'out'), { recursive: true })
  fs.writeFileSync(path.join(obra, 'engine', 'runtime.js'), '// motor\n')
  fs.writeFileSync(path.join(obra, 'params.js'), `// gerado\nexport default ${JSON.stringify({ nome: 'marca', plataforma: { '9x16': 'reels' } }, null, 1)}\n`)
  fs.writeFileSync(path.join(obra, 'out', 'assembly.json'), JSON.stringify({ versao: 1, molde: 'drawn-explainer', nome: 'marca', formatos: ['16x9', '9x16'], cenas: [], falas: [] }))
  return { saida, obra }
}

test('a obra da explicação desenhada é reconhecida, com os formatos e a plataforma', () => {
  const { saida, obra } = obraFalsa()
  try {
    assert.deepEqual(obraDesenhada(obra), { nome: 'marca', formatos: ['16x9', '9x16'], plataforma: { '9x16': 'reels' } })
    assert.equal(obraDesenhada(saida), null, 'pasta sem o motor não é obra')
    fs.writeFileSync(path.join(obra, 'out', 'assembly.json'), JSON.stringify({ molde: 'outro' }))
    assert.equal(obraDesenhada(obra), null, 'montagem de outro molde não é esta obra')
  } finally { fs.rmSync(saida, { recursive: true, force: true }) }
})

test('o MP4 da obra é o mais novo entre o final e o draft, na pasta de cima', () => {
  const { saida, obra } = obraFalsa()
  try {
    assert.equal(videoDaObra(obra, 'marca', '16x9'), null)
    const rasc = path.join(saida, 'marca-16x9-draft.mp4'), fin = path.join(saida, 'marca-16x9.mp4')
    fs.writeFileSync(rasc, '')
    assert.equal(videoDaObra(obra, 'marca', '16x9'), rasc)
    fs.writeFileSync(fin, '')
    fs.utimesSync(rasc, new Date(Date.now() - 60000), new Date(Date.now() - 60000))
    assert.equal(videoDaObra(obra, 'marca', '16x9'), fin)
    assert.equal(videoDaObra(obra, 'marca', '9x16'), null)
  } finally { fs.rmSync(saida, { recursive: true, force: true }) }
})
