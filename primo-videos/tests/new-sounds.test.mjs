// node --test tests/new-sounds.test.mjs   (sem rede; precisa de um Python com numpy e scipy)
// Os oito sons portados do motor original para a explicação desenhada (pop, tique, blip, rabisco, giz, brilho, baque, erro):
// o teste de verdade é o assets/audio/test_sounds.py (nível, bordas, determinismo, nota do blip na pentatônica da
// tônica, "sino", colocar na amostra certa e o sounds.py --verify). Aqui só se acha um Python e se roda ele.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const TESTE = path.join(RAIZ, 'assets', 'audio', 'test_sounds.py')

function acharPython() {
  const cands = [
    process.env.VIDEOSTUDIO_PYTHON, process.env.PYTHON,
    process.platform === 'win32' ? 'python' : 'python3',
  ].filter(Boolean)
  for (const c of new Set(cands)) {
    if (spawnSync(c, ['-c', 'import numpy, scipy'], { encoding: 'utf8' }).status === 0) return c
  }
  return null
}

const PY = acharPython()

test('sons da explicação desenhada: o test_sounds.py passa (inclui o sounds.py --verify)', {
  skip: !PY && 'sem Python com numpy e scipy (defina VIDEOSTUDIO_PYTHON ou PYTHON para um venv com os dois)',
  timeout: 300_000,
}, () => {
  const r = spawnSync(PY, [TESTE], { cwd: RAIZ, encoding: 'utf8', env: { ...process.env, PYTHONDONTWRITEBYTECODE: '1' } })
  assert.equal(r.status, 0, `${r.stdout}\n${r.stderr}`)
  assert.match(r.stderr, /\nOK\s*$/)
})
