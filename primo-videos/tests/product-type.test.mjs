// node --test tests/   (sem rede, sem renderizar: só monta pastas de mentira e lê)
import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { detectarTipo, TIPOS, RECEITAS } from '../scripts/product/type.mjs'

const SCRIPT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'scripts', 'product', 'type.mjs')

function projeto(arquivos) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'vb-tipo-'))
  for (const [nome, conteudo] of Object.entries(arquivos)) {
    const p = path.join(dir, nome)
    fs.mkdirSync(path.dirname(p), { recursive: true })
    fs.writeFileSync(p, typeof conteudo === 'string' ? conteudo : JSON.stringify(conteudo))
  }
  return dir
}
const tipoDe = (arquivos) => detectarTipo(projeto(arquivos)).tipo

test('os cinco tipos têm número, nome e receita', () => {
  assert.deepEqual(Object.values(TIPOS).map((t) => t.numero).sort(), [1, 2, 3, 4, 5])
  for (const id of Object.keys(TIPOS)) {
    assert.ok(RECEITAS[id].molde && RECEITAS[id].gravar && RECEITAS[id].perguntar.length >= 2, id)
  }
})

test('1 · site ou app web de computador', () => {
  assert.equal(tipoDe({ 'package.json': { devDependencies: { vite: '5' }, scripts: { dev: 'vite' } }, 'index.html': '<html></html>' }), 'web-computer')
  assert.equal(tipoDe({ 'package.json': { dependencies: { next: '14', react: '18' } } }), 'web-computer')
  assert.equal(tipoDe({ 'index.html': '<html></html>' }), 'web-computer')
  assert.equal(tipoDe({ 'requirements.txt': 'streamlit\n', 'app.py': 'import streamlit' }), 'web-computer')
  const r = detectarTipo(projeto({ 'package.json': { devDependencies: { vite: '5' }, scripts: { dev: 'vite' } } }))
  assert.equal(r.subir, 'npm run dev')
  assert.equal(r.porta, 5173)
  assert.match(r.linha, /^Recognized: type 1 — website or web app used on the computer/)
})

test('2 · app web usado no celular', () => {
  assert.equal(tipoDe({ 'package.json': { dependencies: { '@capacitor/core': '6', react: '18' } } }), 'web-phone')
  assert.equal(tipoDe({ 'package.json': { dependencies: { expo: '51', 'react-native-web': '0.19' } } }), 'web-phone')
  assert.equal(tipoDe({ 'package.json': { devDependencies: { vite: '5' } }, 'index.html': '<meta name="viewport" content="width=device-width, user-scalable=no">' }), 'web-phone')
  assert.equal(tipoDe({ 'package.json': { devDependencies: { vite: '5' } }, 'public/manifest.json': { display: 'standalone', orientation: 'portrait' } }), 'web-phone')
})

test('3 · programa com window: Electron, Tauri, nativo', () => {
  assert.equal(detectarTipo(projeto({ 'package.json': { main: 'main.js', scripts: { start: 'electron .' }, devDependencies: { electron: '30' }, dependencies: { react: '18' } } })).sub, 'Electron')
  assert.equal(tipoDe({ 'package.json': { devDependencies: { '@tauri-apps/cli': '2', vite: '5' }, scripts: { tauri: 'tauri' } }, 'src-tauri/tauri.conf.json': '{}' }), 'window')
  assert.equal(tipoDe({ 'Cargo.toml': '[package]\nname = "x"\n[dependencies]\neframe = "0.27"\n' }), 'window')
  assert.equal(tipoDe({ 'Package.swift': '// swift-tools-version:5.9', 'Sources/x/main.swift': 'import AppKit\nlet app = NSApplication.shared' }), 'window')
  assert.equal(tipoDe({ 'requirements.txt': 'PyQt6\n', 'main.py': 'print(1)' }), 'window')
  assert.equal(tipoDe({ 'go.mod': 'module x\nrequire github.com/wailsapp/wails/v2 v2.8.0\n' }), 'window')
})

test('3 · Electron com front-end React continua sendo janela, não site', () => {
  assert.equal(tipoDe({ 'package.json': { devDependencies: { electron: '30', vite: '5' }, dependencies: { react: '18' } }, 'index.html': '<div id=root>' }), 'window')
})

test('4 · programa de linha de comando', () => {
  assert.equal(tipoDe({ 'package.json': { name: 'x', bin: { x: 'bin/x.js' } } }), 'terminal')
  assert.equal(tipoDe({ 'package.json': { name: 'x', bin: 'cli.js' } }), 'terminal')
  assert.equal(tipoDe({ 'package.json': { dependencies: { commander: '12' }, main: 'cli.js' } }), 'terminal')
  assert.equal(tipoDe({ 'pyproject.toml': '[project]\nname="x"\n[project.scripts]\nx = "x.cli:main"\n' }), 'terminal')
  assert.equal(detectarTipo(projeto({ 'pyproject.toml': '[project]\nname="x"\n[project.scripts]\nxis = "x.cli:main"\n' })).comando, 'xis')
  assert.equal(tipoDe({ 'Cargo.toml': '[package]\nname = "x"\n[dependencies]\nclap = "4"\n' }), 'terminal')
  assert.equal(tipoDe({ 'go.mod': 'module x\nrequire github.com/spf13/cobra v1.8.0\n' }), 'terminal')
  assert.equal(tipoDe({ 'install.sh': '#!/bin/sh\necho oi' }), 'terminal')
})

test('5 · produto sem tela: biblioteca, API, bot', () => {
  assert.equal(tipoDe({ 'package.json': { name: 'lib', main: 'src/index.js' } }), 'no-screen')
  assert.equal(detectarTipo(projeto({ 'package.json': { dependencies: { fastify: '4' } } })).sub, 'API')
  assert.equal(detectarTipo(projeto({ 'package.json': { dependencies: { 'discord.js': '14' } } })).sub, 'bot')
  assert.equal(tipoDe({ 'requirements.txt': 'fastapi\nuvicorn\n', 'main.py': 'x' }), 'no-screen')
  assert.equal(tipoDe({ 'go.mod': 'module x\nrequire github.com/gin-gonic/gin v1.9\n' }), 'no-screen')
})

test('monorepo: a tela vence a API, e o site de documentação não vence o produto', () => {
  const r = detectarTipo(projeto({
    'package.json': { private: true, workspaces: ['apps/*'] },
    'apps/api/package.json': { dependencies: { fastify: '4' } },
    'apps/web/package.json': { devDependencies: { vite: '5' }, dependencies: { react: '18' } },
  }))
  assert.equal(r.tipo, 'web-computer')
  assert.equal(r.rotulo, 'apps/web')
  assert.equal(detectarTipo(projeto({
    'package.json': { name: 'cli', bin: { cli: 'bin/cli.js' } },
    'docs/package.json': { dependencies: { '@docusaurus/core': '3', react: '18' } },
  })).tipo, 'terminal')
})

test('app nativo de celular e pasta sem manifesto não viram um dos cinco tipos por chute', () => {
  const rn = detectarTipo(projeto({ 'package.json': { dependencies: { 'react-native': '0.74' } } }))
  assert.equal(rn.tipo, null)
  assert.match(rn.linha, /outside the five types/)
  const vazio = detectarTipo(projeto({ 'LEIAME.txt': 'oi' }))
  assert.equal(vazio.tipo, null)
  assert.match(vazio.linha, /Did not recognize/)
})

test('node_modules e pastas de teste não enganam o reconhecimento', () => {
  assert.equal(tipoDe({
    'package.json': { name: 'lib', main: 'index.js' },
    'node_modules/electron/package.json': { name: 'electron', dependencies: { electron: '1' } },
    'tests/fixtures/package.json': { devDependencies: { electron: '30' } },
  }), 'no-screen')
})

test('a linha de saída da linha de comando diz o tipo em uma linha', () => {
  const dir = projeto({ 'package.json': { name: 'x', bin: { x: 'x.js' } } })
  const r = spawnSync(process.execPath, [SCRIPT, dir], { encoding: 'utf8' })
  assert.equal(r.status, 0)
  assert.match(r.stdout.split('\n')[0], /^Recognized: type 4 — command-line program/)
  const j = JSON.parse(spawnSync(process.execPath, [SCRIPT, dir, '--json'], { encoding: 'utf8' }).stdout)
  assert.equal(j.numero, 4)
  assert.equal(j.receita.molde, 'typing-terminal')
  assert.equal(spawnSync(process.execPath, [SCRIPT], { encoding: 'utf8' }).status, 1)
})
