// Onde está o ambiente desta máquina para as skills de vídeo: a pasta ~/.videostudio (VIDEOSTUDIO_HOME troca),
// o environment.json que o `node scripts/environment.mjs --fix` grava lá, e o Python da trilha (com numpy e scipy).
// CommonJS para servir aos .cjs e aos .mjs. As variáveis (VIDEOSTUDIO_PYTHON, PYTHON) só forçam outro
// caminho: sem elas, vale o que o environment.json diz.
const fs = require('fs'), path = require('path'), os = require('os')
const { spawnSync } = require('child_process')

function pastaVideostudio() {
  return process.env.VIDEOSTUDIO_HOME ? path.resolve(process.env.VIDEOSTUDIO_HOME) : path.join(os.homedir(), '.videostudio')
}

/** O ~/.videostudio/environment.json, ou null se não existe ou não se lê. */
function lerAmbiente() {
  try {
    const a = JSON.parse(fs.readFileSync(path.join(pastaVideostudio(), 'environment.json'), 'utf8'))
    return a && typeof a === 'object' && !Array.isArray(a) ? a : null
  } catch { return null }
}

const testados = new Map()
const temNumpyScipy = (py) => {
  if (!testados.has(py)) testados.set(py, spawnSync(py, ['-c', 'import numpy, scipy'], { stdio: 'ignore', timeout: 60000 }).status === 0)
  return testados.get(py)
}

/** O primeiro python que importa numpy e scipy, ou null. `extras`: os .venv que o script já procurava. */
function acharPython({ extras = [] } = {}) {
  const casa = pastaVideostudio()
  const cands = [
    process.env.VIDEOSTUDIO_PYTHON, process.env.PYTHON,
    (lerAmbiente() || {}).python,
    path.join(casa, 'venv', 'bin', 'python'), path.join(casa, 'venv', 'Scripts', 'python.exe'),
    ...extras,
    'python3', 'python', 'py',
  ]
  for (const c of cands) {
    if (!c || typeof c !== 'string') continue
    if (path.isAbsolute(c) && !fs.existsSync(c)) continue
    if (temNumpyScipy(c)) return c
  }
  return null
}

module.exports = { pastaVideostudio, lerAmbiente, acharPython }
