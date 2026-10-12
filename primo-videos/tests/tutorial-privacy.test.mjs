// node --test tests/   (sem rede): o que o gravador borra antes do pixel existir — e-mail e link com segredo, menos os
// permitidos (emailsPermitidos, linksPermitidos), e o liga/desliga de cada um.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const SRC = fs.readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'scripts', 'tutorial', 'page.js'), 'utf8')
const fvSensivel = new Function(`${SRC}\nreturn fvSensivel`)()
const PERFIL = 'https://perfil.exemplo.com/artista/7Qp2Xk9LmZ4tR8sVw3Ny6B'

test('link com segredo e e-mail são borrados; o link público permitido e o e-mail permitido ficam legíveis', () => {
  const padrao = fvSensivel({})
  assert.equal(padrao(PERFIL), true, 'o id de 22 caracteres parece segredo: sem permissão, borra')
  assert.equal(padrao('https://exemplo.com/7'), false)
  assert.equal(padrao('convite: https://app.exemplo.com/entrar?token=abc123def456'), true)
  assert.equal(padrao('fale com teste@exemplo.com'), true)
  const perfil = fvSensivel({ linksPermitidos: '^https://perfil\\.exemplo\\.com/artista/' })
  assert.equal(perfil(PERFIL), false, 'o perfil público permitido fica legível')
  assert.equal(perfil(`${PERFIL} e https://app.exemplo.com/entrar?token=abc123def456`), true, 'o outro link com segredo continua borrado')
  assert.equal(fvSensivel({ emailsPermitidos: '@escola-modelo\\.demo$' })('ana@escola-modelo.demo'), false)
  assert.equal(fvSensivel({ links: false })('https://app.exemplo.com/entrar?token=abc123def456'), false)
  assert.equal(fvSensivel({ emails: false })('teste@exemplo.com'), false)
  assert.equal(padrao(''), false)
})
