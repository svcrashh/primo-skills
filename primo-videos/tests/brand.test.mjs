// node --test tests/brand.test.mjs   (sem rede): as opções de cada marca, numa pasta temporária (VIDEOSTUDIO_BRANDS).
import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const SCRIPT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'scripts', 'brand.mjs')
let base, marcas
const roda = (...a) => spawnSync(process.execPath, [SCRIPT, ...a], { encoding: 'utf8', env: { ...process.env, VIDEOSTUDIO_BRANDS: marcas } })

before(() => { base = fs.mkdtempSync(path.join(os.tmpdir(), 'brand-')); marcas = path.join(base, 'Brands') })
after(() => fs.rmSync(base, { recursive: true, force: true }))

test('marca sem nada guardado: os padrões (logo abre e fecha, sem slogan, sem chamada, língua do produto)', () => {
  const r = roda('show', 'Padaria Sol', '--json')
  assert.equal(r.status, 0, r.stderr)
  assert.deepEqual(JSON.parse(r.stdout), { name: 'Padaria Sol', slug: 'padaria-sol', openingLogo: true, closingLogo: true, slogan: null, cta: null, language: null, saved: false })
  assert.equal(fs.existsSync(marcas), false, 'show não cria nada')
  assert.match(roda('show', 'Padaria Sol').stdout, /nothing saved yet[\s\S]*opening logo: on[\s\S]*closing logo: on[\s\S]*slogan: none[\s\S]*call to action: none[\s\S]*language: auto/)
})

test('set guarda só o que veio, em Brands/<slug>/brand.json, e o resto fica como estava', () => {
  let r = roda('set', 'Padaria Sol', '--opening-logo', 'off', '--slogan', 'Pão quente às seis.')
  assert.equal(r.status, 0, r.stderr)
  const arq = path.join(marcas, 'padaria-sol', 'brand.json')
  assert.deepEqual({ ...JSON.parse(fs.readFileSync(arq, 'utf8')), updated: null }, { version: 1, name: 'Padaria Sol', openingLogo: false, closingLogo: true, slogan: 'Pão quente às seis.', cta: null, language: null, updated: null })
  r = roda('set', 'padaria-sol', '--language', 'pt-BR', '--cta', 'Peça pelo app')
  assert.equal(r.status, 0, r.stderr)
  const o = JSON.parse(roda('show', 'Padaria Sol', '--json').stdout)
  assert.deepEqual([o.name, o.openingLogo, o.slogan, o.cta, o.language, o.saved], ['Padaria Sol', false, 'Pão quente às seis.', 'Peça pelo app', 'pt-BR', true])
  assert.match(roda('list').stdout, /Padaria Sol \(padaria-sol\)/)
})

test('none tira o slogan e a chamada; auto devolve a língua ao produto', () => {
  const r = roda('set', 'Padaria Sol', '--slogan', 'none', '--cta', 'none', '--language', 'auto', '--opening-logo', 'on', '--json')
  assert.equal(r.status, 0, r.stderr)
  const o = JSON.parse(r.stdout)
  assert.deepEqual([o.openingLogo, o.slogan, o.cta, o.language], [true, null, null, null])
})

test('uso errado: código 2, dizendo o que fazer', () => {
  assert.equal(roda().status, 2)
  assert.match(roda('show').stderr, /usage: node brand\.mjs show <brand>/)
  const r = roda('set', 'Padaria Sol', '--closing-logo', 'talvez')
  assert.equal(r.status, 2)
  assert.match(r.stderr, /--closing-logo takes on or off; got "talvez"/)
  assert.match(roda('set', 'Padaria Sol').stderr, /nothing to set/)
  fs.writeFileSync(path.join(marcas, 'padaria-sol', 'brand.json'), '{ quebrado')
  const q = roda('show', 'Padaria Sol')
  assert.equal(q.status, 2)
  assert.match(q.stderr, /is not valid JSON/)
})
