// node --test tests/symlink-install.test.mjs   (sem rede): a skill é instalada por link simbólico (uma pasta de skills
// apontando para o repositório). Chamado pelo caminho do link, o script tem de rodar igual: o argv[1] é o caminho do
// link e o import.meta.url é o caminho real, e quem compara os dois sem resolver sai calado, sem erro nenhum.
import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const SKILL = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
let base, link
before(() => {
  base = fs.mkdtempSync(path.join(os.tmpdir(), 'link-'))
  link = path.join(base, 'skills', 'primo-videos')
  fs.mkdirSync(path.dirname(link), { recursive: true })
  fs.symlinkSync(SKILL, link, 'dir')
})
after(() => fs.rmSync(base, { recursive: true, force: true }))

const pelolink = (script, ...args) => spawnSync(process.execPath, [path.join(link, script), ...args], { encoding: 'utf8', env: { ...process.env, VIDEOSTUDIO_BRANDS: path.join(base, 'Brands') } })

test('chamados pelo link, os scripts respondem (não saem calados)', () => {
  const casos = [
    ['scripts/brand.mjs', ['show', 'Marca Teste'], /Marca Teste \(marca-teste\)/],
    ['scripts/board.mjs', [], /usage: node board\.mjs/],
    ['scripts/catalog.mjs', ['list'], /\(card-bento\)/],
    ['scripts/kit.mjs', ['list'], /no kits in /],
    ['scripts/variety.mjs', ['list', '--brand', 'marca-teste'], /no videos of marca-teste/],
    ['scripts/recommend-style.mjs', ['styles'], /^real-screen-camera/],
    ['scripts/refine/video.mjs', [], /usage: node scripts\/refine\/video\.mjs/],
    ['scripts/opening.mjs', [], /usage: node opening\.mjs/],
    ['scripts/progress.mjs', ['stages'], /\S/],
    ['scripts/writing.mjs', ['review', '--text', 'A plain sentence.'], /\S/],
  ]
  for (const [script, args, espera] of casos) {
    const r = pelolink(script, ...args)
    assert.match(r.stdout + r.stderr, espera, `${script} ${args.join(' ')} pelo link: saída "${(r.stdout + r.stderr).slice(0, 120)}"`)
  }
})

test('nenhum script compara o argv[1] com o import.meta.url sem resolver o caminho real', () => {
  const fraco = /path\.resolve\(process\.argv\[1\]\)\s*===\s*fileURLToPath\(/
  const achados = []
  const anda = (dir) => {
    for (const n of fs.readdirSync(dir, { withFileTypes: true })) {
      if (n.name === 'node_modules' || n.name === 'vendor' || n.name.startsWith('.')) continue
      const p = path.join(dir, n.name)
      if (n.isDirectory()) anda(p)
      else if (/\.(mjs|cjs|js)$/.test(n.name) && fraco.test(fs.readFileSync(p, 'utf8'))) achados.push(path.relative(SKILL, p))
    }
  }
  for (const d of ['scripts', 'templates', 'assets']) anda(path.join(SKILL, d))
  assert.deepEqual(achados, [], 'use fs.realpathSync dos dois lados')
})
