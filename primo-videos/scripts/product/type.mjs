#!/usr/bin/env node
// Reconhece o tipo do produto pelo repositório, sem rodar nada e sem rede.
//   node type.mjs <project-folder> [--json]
// Os cinco tipos (receita de cada um em references/product.md):
//   1 web-computer · 2 web-phone · 3 janela · 4 terminal · 5 no-screen
// Lê só arquivos de manifesto (package.json, Cargo.toml, pyproject…) na raiz e um ou dois níveis abaixo.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

export const TIPOS = {
  'web-computer': { numero: 1, nome: 'website or web app used on the computer' },
  'web-phone': { numero: 2, nome: 'web app used on the phone' },
  window: { numero: 3, nome: 'computer program with a window' },
  terminal: { numero: 4, nome: 'command-line program' },
  'no-screen': { numero: 5, nome: 'product with no screen (library, API, bot, service)' },
}

const IGNORAR = new Set(['node_modules', '.git', 'dist', 'build', 'target', 'venv', '.venv', '__pycache__', '.next', '.nuxt', 'vendor', 'coverage', 'out', '.turbo', 'Pods'])
const PERIFERIA = /^(docs?|documentation|website|site|www|landing|blog|examples?|exemplos?|demos?|tests?|testes?|e2e|fixtures?|samples?|benchmarks?|scripts?|tools?)$/i
const AGRUPADORES = /^(apps?|packages?|services?|projects?|modules?|clients?|src)$/i

const ler = (p, max = 400000) => { try { return fs.readFileSync(p, 'utf8').slice(0, max) } catch { return '' } }
const existe = (p) => { try { return fs.existsSync(p) } catch { return false } }
const lerJson = (p) => { try { return JSON.parse(fs.readFileSync(p, 'utf8')) } catch { return null } }
const subpastas = (dir) => { try { return fs.readdirSync(dir, { withFileTypes: true }).filter((d) => d.isDirectory() && !IGNORAR.has(d.name) && !d.name.startsWith('.')).map((d) => d.name) } catch { return [] } }
const arquivos = (dir) => { try { return fs.readdirSync(dir, { withFileTypes: true }).filter((d) => d.isFile()).map((d) => d.name) } catch { return [] } }

// Procura texto em até `limite` arquivos de código de uma pasta (rasa), para confirmar GUI ou CLI no código.
function achaNoCodigo(dir, exts, regex, { limite = 40, fundo = 2 } = {}) {
  let vistos = 0
  const anda = (d, n) => {
    for (const e of (() => { try { return fs.readdirSync(d, { withFileTypes: true }) } catch { return [] } })()) {
      if (vistos >= limite) return false
      if (e.isDirectory()) { if (n < fundo && !IGNORAR.has(e.name) && !e.name.startsWith('.') && anda(path.join(d, e.name), n + 1)) return true; continue }
      if (!exts.some((x) => e.name.endsWith(x))) continue
      vistos++
      if (regex.test(ler(path.join(d, e.name), 60000))) return true
    }
    return false
  }
  return anda(dir, 0)
}

const gerenciador = (dir) => existe(path.join(dir, 'pnpm-lock.yaml')) ? 'pnpm' : existe(path.join(dir, 'yarn.lock')) ? 'yarn' : (existe(path.join(dir, 'bun.lockb')) || existe(path.join(dir, 'bun.lock'))) ? 'bun' : 'npm'
const rodaScript = (g, s) => (g === 'npm' ? `npm run ${s}` : g === 'yarn' ? `yarn ${s}` : `${g} run ${s}`)
const PORTAS = { vite: 5173, next: 3000, nuxt: 3000, astro: 4321, '@angular/core': 4200, '@sveltejs/kit': 5173, 'react-scripts': 3000, remix: 3000, '@remix-run/react': 3000, gatsby: 8000, '@docusaurus/core': 3000, '@ionic/vue': 8100, '@ionic/react': 8100, '@ionic/angular': 4200, expo: 8081, parcel: 1234, webpack: 8080, 'webpack-dev-server': 8080 }

const WEB_NODE = ['vite', 'next', 'nuxt', 'astro', '@angular/core', '@sveltejs/kit', 'react-scripts', '@remix-run/react', 'remix', 'gatsby', 'react', 'react-dom', 'vue', 'svelte', 'solid-js', 'preact', 'lit', '@builder.io/qwik', '@11ty/eleventy', 'parcel', '@docusaurus/core', 'webpack-dev-server', 'alpinejs', 'htmx.org']
const CELULAR_NODE = ['@capacitor/core', '@capacitor/cli', '@ionic/react', '@ionic/vue', '@ionic/angular', '@ionic/core', 'expo', 'react-native-web', 'cordova', '@nativescript/core', 'framework7', 'onsenui', 'konsta']
const NATIVO_CELULAR_NODE = ['react-native']
const JANELA_NODE = ['electron', 'electron-builder', '@electron-forge/cli', 'electron-vite', '@tauri-apps/api', '@tauri-apps/cli', 'nw', 'neutralino', '@neutralinojs/lib', 'nodegui', '@nodegui/nodegui', 'wails']
const CLI_NODE = ['commander', 'yargs', 'inquirer', '@inquirer/prompts', 'ink', 'oclif', '@oclif/core', 'meow', 'cac', 'clipanion', 'blessed', 'enquirer', 'prompts', 'cli-table3', 'ora', 'chalk', 'minimist', 'arg', '@clack/prompts', 'vorpal', 'gluegun', 'caporal']
const API_NODE = ['express', 'fastify', 'koa', 'hono', '@nestjs/core', '@hapi/hapi', 'restify', 'apollo-server', '@apollo/server', 'graphql-yoga', 'trpc', '@trpc/server', 'socket.io', 'ws']
const BOT_NODE = ['discord.js', 'telegraf', 'grammy', '@slack/bolt', '@whiskeysockets/baileys', 'baileys', 'whatsapp-web.js', 'node-telegram-bot-api', 'eris', 'tmi.js', 'twilio', 'botbuilder', '@line/bot-sdk', 'mineflayer']

const temDep = (deps, lista) => lista.filter((n) => n in deps)

// Cada unidade (uma pasta com manifesto) devolve candidatos { tipo, forca, evidencia, ... }.
function unidadeNode(dir, rotulo) {
  const pkg = lerJson(path.join(dir, 'package.json'))
  if (!pkg) return []
  const deps = { ...pkg.dependencies, ...pkg.devDependencies, ...pkg.peerDependencies }
  const scripts = pkg.scripts || {}
  const g = gerenciador(dir)
  const out = []
  const nomeProduto = pkg.productName || pkg.name || path.basename(dir)
  const base = { pasta: dir, rotulo, nome: nomeProduto, gerenciador: g, instalar: existe(path.join(dir, 'node_modules')) || !Object.keys(deps).length ? null : `${g} install` }
  const scriptSobe = ['dev', 'start', 'serve', 'preview'].find((s) => scripts[s])

  const janela = temDep(deps, JANELA_NODE)
  if (janela.length || existe(path.join(dir, 'src-tauri', 'tauri.conf.json')) || existe(path.join(dir, 'electron-builder.yml')) || existe(path.join(dir, 'forge.config.js'))) {
    const tauri = janela.some((n) => n.includes('tauri')) || existe(path.join(dir, 'src-tauri'))
    const sub = tauri ? 'Tauri' : janela.includes('nw') ? 'NW.js' : janela.some((n) => /neutralino/.test(n)) ? 'Neutralino' : 'Electron'
    const subir = tauri ? (scripts.tauri ? rodaScript(g, 'tauri dev') : 'cargo tauri dev') : scripts.start ? rodaScript(g, 'start') : scripts.dev ? rodaScript(g, 'dev') : pkg.main ? 'npx electron .' : null
    out.push({ ...base, tipo: 'window', forca: 10, sub, evidencia: tauri ? `${janela.find((n) => n.includes('tauri')) || 'src-tauri/'} (Tauri)` : `${janela[0] || 'Electron config'} in package.json (Electron)`, subir })
  }
  const nativoCel = temDep(deps, NATIVO_CELULAR_NODE)
  const celular = temDep(deps, CELULAR_NODE)
  const web = temDep(deps, WEB_NODE)
  const temHtml = existe(path.join(dir, 'index.html')) || existe(path.join(dir, 'public', 'index.html')) || existe(path.join(dir, 'src', 'index.html'))
  if (celular.length && !janela.length) {
    out.push({ ...base, tipo: 'web-phone', forca: 9, evidencia: `${celular[0]} in package.json (app made for the phone, runs on the web)`, subir: scriptSobe ? rodaScript(g, scriptSobe) : null, porta: PORTAS[celular.find((n) => PORTAS[n])] || PORTAS[web.find((n) => PORTAS[n])] || null })
  } else if (nativoCel.length && !web.length) {
    out.push({ ...base, tipo: null, forca: 8, evidencia: 'react-native with no web version: native phone app, outside the five types', nativoCelular: true })
  } else if ((web.length || (temHtml && !janela.length)) && !janela.length) {
    const sinais = sinaisCelular(dir)
    const dev = web.find((n) => PORTAS[n])
    const porta = dev ? PORTAS[dev] : null
    const fraco = !web.length // só um index.html
    out.push({ ...base, tipo: sinais.length ? 'web-phone' : 'web-computer', forca: fraco ? 6 : 8, evidencia: `${web[0] || 'index.html'} ${fraco ? 'in the folder' : 'in package.json'}${sinais.length ? `; designed for the phone: ${sinais.join(', ')}` : ''}`, subir: scriptSobe ? rodaScript(g, scriptSobe) : fraco ? `npx --yes serve -l 4173 ${path.relative(dir, existe(path.join(dir, 'public', 'index.html')) ? path.join(dir, 'public') : dir) || '.'}` : null, porta, dupla: !sinais.length ? false : true })
  }
  const cli = temDep(deps, CLI_NODE)
  const bin = typeof pkg.bin === 'string' ? { [pkg.name || path.basename(dir)]: pkg.bin } : pkg.bin
  if (bin && Object.keys(bin).length && !janela.length && !web.length) {
    const nome = Object.keys(bin)[0]
    out.push({ ...base, tipo: 'terminal', forca: 7 + (cli.length ? 1 : 0), evidencia: `"bin" field (${nome}) in package.json${cli.length ? ` and ${cli[0]}` : ''}`, comando: nome, subir: `node ${bin[nome]}` })
  } else if (cli.length && !web.length && !janela.length && ['commander', 'yargs', 'inquirer', '@inquirer/prompts', 'ink', 'oclif', '@oclif/core', 'meow', 'cac', 'clipanion', 'blessed', '@clack/prompts'].some((n) => n in deps)) {
    out.push({ ...base, tipo: 'terminal', forca: 7, evidencia: `${cli[0]} in package.json (command-line program)`, subir: pkg.main ? `node ${pkg.main}` : null })
  }
  const api = temDep(deps, API_NODE), bot = temDep(deps, BOT_NODE)
  if (bot.length) out.push({ ...base, tipo: 'no-screen', forca: 5, sub: 'bot', evidencia: `${bot[0]} in package.json (bot)` })
  else if (api.length) out.push({ ...base, tipo: 'no-screen', forca: 5, sub: 'API', evidencia: `${api[0]} in package.json (server/API)`, porta: 3000 })
  if (!out.length && (pkg.main || pkg.exports || pkg.module || pkg.types || pkg.typings)) out.push({ ...base, tipo: 'no-screen', forca: 3, sub: 'biblioteca', evidencia: 'package.json with "main"/"exports" and no screen or "bin" (library)' })
  return out
}

// Sinais de que a interface foi desenhada para o phone: manifest de PWA em retrato, meta tags de app, viewport travado.
function sinaisCelular(dir) {
  const s = []
  const html = ['index.html', 'public/index.html', 'src/index.html', 'app/layout.tsx', 'src/app/layout.tsx'].map((f) => ler(path.join(dir, f), 20000)).join('\n')
  if (/apple-mobile-web-app-capable|mobile-web-app-capable/i.test(html)) s.push('phone app meta tag')
  if (/user-scalable\s*=\s*no|maximum-scale\s*=\s*1(\.0)?\b/i.test(html)) s.push('locked viewport')
  for (const f of ['public/manifest.json', 'public/manifest.webmanifest', 'manifest.json', 'manifest.webmanifest', 'static/manifest.json']) {
    const m = lerJson(path.join(dir, f))
    if (m && (m.orientation?.startsWith('portrait') || m.display === 'standalone' || m.display === 'fullscreen') && m.orientation?.startsWith('portrait')) s.push('portrait manifest')
  }
  return s
}

function unidadeRust(dir, rotulo) {
  const c = ler(path.join(dir, 'Cargo.toml'))
  if (!c) return []
  const base = { pasta: dir, rotulo, nome: (c.match(/^\s*name\s*=\s*"([^"]+)"/m) || [])[1] || path.basename(dir), instalar: null }
  if (/^\s*(tauri|tauri-build)\s*=|\[dependencies\.tauri\]/m.test(c) || existe(path.join(dir, 'tauri.conf.json'))) return [{ ...base, tipo: 'window', forca: 10, sub: 'Tauri', evidencia: 'tauri in Cargo.toml (Tauri)', subir: 'cargo tauri dev' }]
  if (/^\s*(eframe|egui|iced|slint|fltk|gtk4?|relm4|druid|floem|xilem|winit|bevy|macroquad|tao|wry)\s*=/m.test(c)) return [{ ...base, tipo: 'window', forca: 9, sub: 'native (Rust)', evidencia: `${(c.match(/^\s*(eframe|egui|iced|slint|fltk|gtk4?|relm4|druid|floem|xilem|winit|bevy|macroquad|tao|wry)\s*=/m) || [])[1]} in Cargo.toml (window)`, subir: 'cargo run' }]
  if (/^\s*(clap|ratatui|crossterm|structopt|argh|dialoguer|indicatif|cursive|tui|inquire)\s*=|\[\[bin\]\]/m.test(c) || existe(path.join(dir, 'src', 'main.rs'))) return [{ ...base, tipo: 'terminal', forca: 7, evidencia: `${(c.match(/^\s*(clap|ratatui|crossterm|structopt|argh|dialoguer|indicatif|cursive|tui|inquire)\s*=/m) || [])[1] || 'src/main.rs'} in Cargo.toml (command-line program)`, comando: base.nome, subir: 'cargo run --' }]
  if (/^\s*(axum|actix-web|rocket|warp|tide|poem|hyper)\s*=/m.test(c)) return [{ ...base, tipo: 'no-screen', forca: 5, sub: 'API', evidencia: 'server framework in Cargo.toml (API)', subir: 'cargo run' }]
  return [{ ...base, tipo: 'no-screen', forca: 3, sub: 'biblioteca', evidencia: 'Cargo.toml without src/main.rs (library)' }]
}

function unidadePython(dir, rotulo) {
  const arqs = ['pyproject.toml', 'setup.py', 'setup.cfg', 'requirements.txt', 'Pipfile', 'environment.yml']
  const achados = arqs.filter((a) => existe(path.join(dir, a)))
  const temPy = arquivos(dir).some((f) => f.endsWith('.py'))
  if (!achados.length && !temPy) return []
  const txt = achados.map((a) => ler(path.join(dir, a))).join('\n').toLowerCase()
  const base = { pasta: dir, rotulo, nome: (txt.match(/^\s*name\s*=\s*["']([^"']+)/m) || [])[1] || path.basename(dir), instalar: null }
  const principal = ['app.py', 'main.py', '__main__.py', 'run.py', 'manage.py'].find((f) => existe(path.join(dir, f)))
  const tem = (r) => r.test(txt)
  if (tem(/\b(pyqt[56]?|pyside[26]?|tkinter|customtkinter|kivy|wxpython|pygame|flet|pywebview|dearpygui|toga|pyglet)\b/) || achaNoCodigo(dir, ['.py'], /^\s*(import|from)\s+(tkinter|PyQt\d|PySide\d|customtkinter|wx|kivy|pygame|flet|webview|dearpygui)\b/m, { limite: 20, fundo: 1 }))
    return [{ ...base, tipo: 'window', forca: 9, sub: 'native (Python)', evidencia: 'window library (tkinter/Qt/kivy/pygame…) in the Python project', subir: principal ? `python3 ${principal}` : null }]
  if (tem(/\b(streamlit|gradio|nicegui|dash|panel|reflex|solara|flask|django|jinja2|fasthtml|starlette)\b/) && (tem(/\b(streamlit|gradio|nicegui|dash|panel|reflex|solara|fasthtml)\b/) || subpastas(dir).some((d) => /^(templates|static)$/.test(d)) || existe(path.join(dir, 'manage.py')))) {
    const m = (txt.match(/\b(streamlit|gradio|nicegui|dash|panel|reflex|solara|fasthtml|flask|django|jinja2|starlette)\b/) || [])[1]
    const subir = m === 'streamlit' ? `streamlit run ${principal || 'app.py'}` : m === 'django' && principal === 'manage.py' ? 'python3 manage.py runserver' : m === 'flask' ? 'flask run' : principal && principal !== 'manage.py' ? `python3 ${principal}` : null
    const porta = { streamlit: 8501, django: 8000, flask: 5000, gradio: 7860, nicegui: 8080, dash: 8050 }[m] || null
    return [{ ...base, tipo: 'web-computer', forca: 8, sub: m, evidencia: `${m} in the Python project (web interface)`, subir, porta }]
  }
  const scriptsCli = tem(/\[project\.scripts\]|\[tool\.poetry\.scripts\]|console_scripts|entry_points/)
  if (scriptsCli || tem(/\b(click|typer|argparse|fire|docopt|cleo|rich|textual|prompt[-_]toolkit|questionary)\b/) || achaNoCodigo(dir, ['.py'], /\bargparse\.ArgumentParser|\bimport\s+(click|typer)\b|\bfrom\s+(click|typer)\b/, { limite: 20, fundo: 1 })) {
    const comando = (txt.match(/^\s*([\w.-]+)\s*=\s*["'][\w.]+:[\w.]+["']/m) || [])[1] || null
    return [{ ...base, tipo: 'terminal', forca: 7, evidencia: scriptsCli ? 'command declared in pyproject/setup (command-line program)' : 'click/typer/argparse in the Python project (command-line program)', comando, subir: comando ? comando : principal ? `python3 ${principal}` : null }]
  }
  if (tem(/\b(fastapi|aiohttp|sanic|tornado|litestar|falcon|bottle|grpcio)\b/)) return [{ ...base, tipo: 'no-screen', forca: 5, sub: 'API', evidencia: 'API framework in the Python project', porta: 8000 }]
  if (tem(/\b(discord\.py|discord|python-telegram-bot|telebot|pyrogram|slack[-_]bolt|slack[-_]sdk|hikari|aiogram)\b/)) return [{ ...base, tipo: 'no-screen', forca: 5, sub: 'bot', evidencia: 'bot library in the Python project' }]
  if (principal && !achados.length) return [{ ...base, tipo: 'terminal', forca: 5, evidencia: `${principal} loose in the folder (Python script)`, subir: `python3 ${principal}` }]
  return achados.length ? [{ ...base, tipo: 'no-screen', forca: 3, sub: 'biblioteca', evidencia: 'Python project with no interface and no command (library)' }] : []
}

function unidadeGo(dir, rotulo) {
  const m = ler(path.join(dir, 'go.mod'))
  if (!m) return []
  const base = { pasta: dir, rotulo, nome: (m.match(/^module\s+(\S+)/m) || [])[1]?.split('/').pop() || path.basename(dir), instalar: null }
  if (/wails|fyne\.io|gioui|go-gl|ebiten|walk|lorca|webview\/webview|giu|cogent/.test(m)) return [{ ...base, tipo: 'window', forca: 9, sub: 'native (Go)', evidencia: 'window library (Wails/Fyne/Gio…) in go.mod', subir: /wails/.test(m) ? 'wails dev' : 'go run .' }]
  if (/cobra|urfave\/cli|bubbletea|kong|kingpin|go-flags|survey|tview|tcell|promptui|huh/.test(m)) return [{ ...base, tipo: 'terminal', forca: 7, evidencia: 'cobra/urfave/bubbletea… in go.mod (command-line program)', comando: base.nome, subir: 'go run .' }]
  if (/gin-gonic|labstack\/echo|gofiber|go-chi|gorilla\/mux|grpc/.test(m)) return [{ ...base, tipo: 'no-screen', forca: 5, sub: 'API', evidencia: 'server framework in go.mod (API)', subir: 'go run .', porta: 8080 }]
  if (/discordgo|telebot|slack-go|whatsmeow/.test(m)) return [{ ...base, tipo: 'no-screen', forca: 5, sub: 'bot', evidencia: 'bot library in go.mod' }]
  return [{ ...base, tipo: existe(path.join(dir, 'main.go')) ? 'terminal' : 'no-screen', forca: 4, sub: existe(path.join(dir, 'main.go')) ? undefined : 'biblioteca', evidencia: existe(path.join(dir, 'main.go')) ? 'main.go (Go program)' : 'go.mod without main.go (library)', subir: existe(path.join(dir, 'main.go')) ? 'go run .' : null }]
}

function unidadeNativa(dir, rotulo) {
  const out = []
  const nomes = arquivos(dir), pastas = subpastas(dir)
  const xcode = pastas.find((p) => p.endsWith('.xcodeproj')) || nomes.find((p) => p.endsWith('.xcodeproj'))
  let xcodeAll = (() => { try { return fs.readdirSync(dir).find((p) => p.endsWith('.xcodeproj')) } catch { return null } })()
  const base = { pasta: dir, rotulo, nome: path.basename(dir), instalar: null }
  if (xcodeAll) {
    const pbx = ler(path.join(dir, xcodeAll, 'project.pbxproj'))
    if (/SDKROOT\s*=\s*iphoneos/.test(pbx)) return [{ ...base, tipo: null, forca: 8, evidencia: `${xcodeAll} is for iOS: native phone app, outside the five types`, nativoCelular: true }]
    return [{ ...base, tipo: 'window', forca: 9, sub: 'native (macOS)', evidencia: `${xcodeAll} (macOS app)`, subir: `xcodebuild -project ${xcodeAll} -scheme "${xcodeAll.replace(/\.xcodeproj$/, '')}" build` }]
  }
  if (nomes.includes('Package.swift')) {
    const swift = ler(path.join(dir, 'Package.swift'))
    const gui = achaNoCodigo(dir, ['.swift'], /^\s*import\s+(SwiftUI|AppKit|Cocoa)\b/m, { limite: 30, fundo: 3 })
    if (gui) return [{ ...base, tipo: 'window', forca: 9, sub: 'native (macOS)', evidencia: 'SwiftUI/AppKit in the Swift code', subir: 'swift run' }]
    if (/ArgumentParser|executableTarget|\.executable/.test(swift)) return [{ ...base, tipo: 'terminal', forca: 7, evidencia: 'Swift executable without SwiftUI/AppKit (command line)', subir: 'swift run' }]
    return [{ ...base, tipo: 'no-screen', forca: 3, sub: 'biblioteca', evidencia: 'Package.swift without an executable (library)' }]
  }
  if (nomes.includes('pubspec.yaml')) {
    const web = pastas.includes('web')
    return [web ? { ...base, tipo: 'web-phone', forca: 8, evidencia: 'Flutter with a web/ folder (runs in the browser)', subir: 'flutter run -d web-server --web-port 8099', porta: 8099 } : { ...base, tipo: null, forca: 8, evidencia: 'Flutter without a web/ folder: native phone app, outside the five types', nativoCelular: true }]
  }
  const csproj = nomes.find((n) => /\.csproj$/.test(n))
  if (csproj) {
    const x = ler(path.join(dir, csproj))
    if (/UseWPF|UseWindowsForms|Avalonia|MAUI|WinUI/i.test(x)) return [{ ...base, tipo: 'window', forca: 9, sub: 'native (.NET)', evidencia: `${csproj} (WPF/WinForms/Avalonia/MAUI)`, subir: 'dotnet run' }]
    if (/Microsoft\.NET\.Sdk\.Web/.test(x)) return [{ ...base, tipo: 'no-screen', forca: 5, sub: 'API', evidencia: `${csproj} (ASP.NET)`, subir: 'dotnet run' }]
    if (/<OutputType>\s*Exe/i.test(x)) return [{ ...base, tipo: 'terminal', forca: 6, evidencia: `${csproj} (console executable)`, subir: 'dotnet run' }]
  }
  return out
}

function unidadeShell(dir, rotulo) {
  const base = { pasta: dir, rotulo, nome: path.basename(dir), instalar: null }
  const sh = arquivos(dir).filter((f) => /\.(sh|bash|zsh|ps1)$/.test(f))
  if (sh.length && !existe(path.join(dir, 'package.json'))) return [{ ...base, tipo: 'terminal', forca: 4, evidencia: `${sh[0]} (shell script)`, subir: `./${sh[0]}` }]
  return []
}

function unidadeHtml(dir, rotulo) {
  if (existe(path.join(dir, 'package.json')) || !(existe(path.join(dir, 'index.html')))) return []
  const sinais = sinaisCelular(dir)
  return [{ pasta: dir, rotulo, nome: path.basename(dir), instalar: null, tipo: sinais.length ? 'web-phone' : 'web-computer', forca: 6, evidencia: `index.html in the folder${sinais.length ? `; designed for the phone: ${sinais.join(', ')}` : ''}`, subir: 'npx --yes serve -l 4173 .', porta: 4173 }]
}

function unidade(dir, rotulo) {
  return [...unidadeNode(dir, rotulo), ...unidadeRust(dir, rotulo), ...unidadePython(dir, rotulo), ...unidadeGo(dir, rotulo), ...unidadeNativa(dir, rotulo), ...unidadeHtml(dir, rotulo), ...unidadeShell(dir, rotulo)]
}

export function pastasDoProjeto(raiz) {
  const lista = [{ dir: raiz, rotulo: '.' }]
  for (const a of subpastas(raiz)) {
    if (/^(tests?|testes?|e2e|fixtures?|examples?|exemplos?|samples?|node_modules)$/i.test(a)) continue
    lista.push({ dir: path.join(raiz, a), rotulo: a })
    if (AGRUPADORES.test(a)) for (const b of subpastas(path.join(raiz, a))) lista.push({ dir: path.join(raiz, a, b), rotulo: `${a}/${b}` })
  }
  return lista
}

const PRIORIDADE = ['window', 'web-phone', 'web-computer', 'terminal', 'no-screen']
// `sub` 'biblioteca' é lido pelo propose.mjs: o valor fica, a linha mostra o rótulo em inglês
const SUB_ROTULO = { biblioteca: 'library' }

export function detectarTipo(pasta) {
  const raiz = path.resolve(pasta)
  if (!existe(raiz)) throw new Error(`the folder does not exist: ${raiz}`)
  const todos = []
  for (const { dir, rotulo } of pastasDoProjeto(raiz)) for (const c of unidade(dir, rotulo)) {
    const periferia = rotulo !== '.' && rotulo.split('/').some((p) => PERIFERIA.test(p))
    todos.push({ ...c, forca: c.forca - (periferia ? 4 : 0) - (rotulo !== '.' ? 0.5 : 0) })
  }
  todos.sort((a, b) => b.forca - a.forca || PRIORIDADE.indexOf(a.tipo) - PRIORIDADE.indexOf(b.tipo))
  const p = todos[0]
  if (!p) return { tipo: null, numero: null, nome: null, evidencia: 'no recognized manifest', linha: `Did not recognize the product type in ${raiz}: found no package.json, Cargo.toml, pyproject, go.mod, Package.swift or index.html. Ask the owner what it is and how it opens.`, candidatos: [], pasta: raiz }
  if (p.tipo === null) return { tipo: null, numero: null, nome: null, pasta: p.pasta, produto: p.nome, evidencia: p.evidencia, nativoCelular: !!p.nativoCelular, linha: `Not one of the five types: ${p.evidencia}. Ask the owner whether to record the simulator/device or whether there is a web version.`, candidatos: todos }
  const info = TIPOS[p.tipo]
  const outros = todos.filter((c) => c !== p && c.tipo && c.pasta !== p.pasta).slice(0, 4)
  const sub = p.sub ? ` · ${SUB_ROTULO[p.sub] || p.sub}` : ''
  const linha = `Recognized: type ${info.numero} — ${info.nome}${sub}. Found: ${p.evidencia}.`
  return { tipo: p.tipo, numero: info.numero, nome: info.nome, sub: p.sub || null, produto: p.nome, pasta: p.pasta, rotulo: p.rotulo, evidencia: p.evidencia, subir: p.subir || null, instalar: p.instalar || null, porta: p.porta || null, comando: p.comando || null, tambemCelular: p.tipo === 'web-computer' ? null : undefined, linha, outros: outros.map((o) => ({ tipo: o.tipo, rotulo: o.rotulo, evidencia: o.evidencia })) }
}

// Receita curta de cada tipo: o que perguntar e o caminho. Os detalhes estão em references/product.md.
export const RECEITAS = {
  'web-computer': { molde: 'real-screen-camera', gravar: 'scripts/tutorial/record.mjs (Playwright, computer version)', perguntar: ['how to log in without a password in the chat (demo mode or test account)', 'what can never appear (real data, unreleased feature)', 'which task to show'] },
  'web-phone': { molde: 'tutorial mode with a phone mockup frame (scripts/tutorial/compose.mjs)', gravar: 'scripts/tutorial/record.mjs (Playwright, phone version 390×844)', perguntar: ['how to log in without a password in the chat', 'is there a computer version too?', 'which task to show'] },
  window: { molde: 'real-screen-camera (the window goes in as the "screen")', gravar: 'scripts/product/record-window.mjs (window only, macOS)', perguntar: ['which window/screen to show and what to click', 'demo data: what can appear in the window', 'can the program be opened now? (the skill opens its own window and closes only that one)'] },
  terminal: { molde: 'typing-terminal', gravar: 'scripts/product/record-terminal.mjs (really runs it and stores what it answered)', perguntar: ['which commands to show, in order', 'does any command change things or spend resources? (the skill only runs what the owner lists)', 'does the output have real data or secrets?'] },
  'no-screen': { molde: 'none (there is no screen to record)', gravar: 'scripts/product/propose.mjs (proposes what to show)', perguntar: ['what is the most typical call or use', 'who uses this and in which product the result shows up', 'do they want the code and the response, or the result in the product of whoever uses it?'] },
}

if (process.argv[1] && fs.realpathSync(process.argv[1]) === fs.realpathSync(fileURLToPath(import.meta.url))) {
  const args = process.argv.slice(2)
  const pasta = args.find((a) => !a.startsWith('--'))
  if (!pasta) { console.error('usage: node type.mjs <project-folder> [--json]'); process.exit(1) }
  const r = detectarTipo(pasta)
  if (args.includes('--json')) console.log(JSON.stringify({ ...r, receita: r.tipo ? RECEITAS[r.tipo] : null }, null, 2))
  else {
    console.log(r.linha)
    if (r.tipo) {
      if (r.instalar) console.log(`  before starting: ${r.instalar}`)
      if (r.subir) console.log(`  start: ${r.subir}${r.porta ? ` (port ${r.porta})` : ''}  [in ${path.relative(path.resolve(pasta), r.pasta) || '.'}]`)
      console.log(`  template: ${RECEITAS[r.tipo].molde}`)
      console.log(`  ask: ${RECEITAS[r.tipo].perguntar.join(' · ')}`)
      for (const o of r.outros) console.log(`  also found: ${TIPOS[o.tipo].nome} in ${o.rotulo} (${o.evidencia})`)
    }
  }
}
