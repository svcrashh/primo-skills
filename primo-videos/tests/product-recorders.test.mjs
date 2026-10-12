// node --test tests/   (sem rede; roda só comandos de mentira em pasta temporária)
import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { rodar, gravarTerminal } from '../scripts/product/record-terminal.mjs'
import { propor } from '../scripts/product/propose.mjs'
import { MSG_TELA, MSG_ACESSIBILIDADE } from '../scripts/product/record-window.mjs'

const AQUI = path.dirname(fileURLToPath(import.meta.url))
const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'vb-prod-'))

test('terminal: guarda o que o programa respondeu de verdade, com código de saída', async () => {
  const dir = tmp()
  fs.writeFileSync(path.join(dir, 'oi.js'), 'console.log("linha 1"); console.error("linha 2"); process.exit(3)')
  const r = await rodar('node oi.js', dir)
  assert.deepEqual(r.saida.map((l) => l.texto).sort(), ['linha 1', 'linha 2'])
  assert.equal(r.codigo, 3)
})

test('terminal: o nome que aparece no vídeo roda o programa do projeto (alias)', async () => {
  const dir = tmp()
  fs.writeFileSync(path.join(dir, 'x.js'), 'console.log("args:", process.argv.slice(2).join(","))')
  const g = await gravarTerminal({ pasta: dir, comandos: { titulo: 'x', prompt: '$', alias: { meuapp: 'node x.js' }, comandos: [{ cmd: 'meuapp a b', legenda: 'l' }] } })
  assert.equal(g.comandos[0].cmd, 'meuapp a b')
  assert.equal(g.comandos[0].saida[0].texto, 'args: a,b')
})

test('janela: a mensagem de permissão diz onde ligar, em uma mensagem só', () => {
  assert.match(MSG_TELA, /System Settings → Privacy & Security → Screen Recording/)
  assert.match(MSG_ACESSIBILIDADE, /Privacy & Security → Accessibility/)
  assert.equal(MSG_TELA.split('\n').length, 1)
  const r = spawnSync(process.execPath, [path.join(AQUI, '..', 'scripts', 'product', 'record-window.mjs')], { encoding: 'utf8' })
  assert.equal(r.status, 1)
  assert.match(r.stderr, /usage:/)
})

test('sem tela: diz que não há tela e propõe o que mostrar, sem inventar tela', () => {
  const dir = tmp()
  fs.writeFileSync(path.join(dir, 'package.json'), JSON.stringify({ name: 'api-x', dependencies: { fastify: '4' } }))
  fs.writeFileSync(path.join(dir, 'server.js'), "app.get('/cestas', h); app.post('/cestas', h)")
  const r = propor(dir)
  assert.equal(r.tipo, 'no-screen')
  assert.match(r.linha, /has no screen to record/)
  assert.ok(r.rotas.includes('GET /cestas'))
  assert.ok(r.propostas.some((p) => /curl/.test(p)))
  assert.ok(r.propostas.length >= 3)
})
