// Acha o Playwright onde ele estiver nesta máquina (Mac, Linux ou Windows), sem instalar nada, e abre o Chromium do
// vídeo: todo navegador que desenha, grava ou confere um vídeo sai daqui (no Mac, na placa de vídeo).
// Ordem: PLAYWRIGHT_PATH → o ~/.videostudio/environment.json (VIDEOSTUDIO_HOME troca a pasta), que o
// `node <skill>/scripts/environment.mjs --fix` grava uma vez → node_modules do projeto/pasta atual/desta pasta → o
// último lugar onde ele foi achado (~/.cache/videostudio/playwright.json, gravado a cada uso que dá certo) → npm global
// → cache do npx. Sem nada, falha alto com o que fazer.
// Este arquivo é copiado SOZINHO para a pasta de ferramentas dos projetos: não depende de nenhum outro arquivo da
// skill (lê o environment.json por conta própria).
//   node playwright.cjs [pasta]        onde ele achou o Playwright
//   node playwright.cjs --gpu [pasta]  o renderer do WebGL (UNMASKED_RENDERER_WEBGL); sai 1 se for CPU (SwiftShader)
const fs = require('fs'), path = require('path'), os = require('os')
const { execSync } = require('child_process')

// a memória do último Playwright que abriu (o cache recriável da skill)
const MEMORIA = () => path.join(os.homedir(), '.cache', 'videostudio', 'playwright.json')
function lembrado() { try { return JSON.parse(fs.readFileSync(MEMORIA(), 'utf8')).onde || null } catch { return null } }
function lembrar(onde) {
  try {
    if (lembrado() === onde) return
    fs.mkdirSync(path.dirname(MEMORIA()), { recursive: true })
    fs.writeFileSync(MEMORIA(), JSON.stringify({ onde, quando: new Date().toISOString() }) + '\n')
  } catch { /* sem cache gravável: só não lembra */ }
}

// o que o environment.mjs --fix gravou (o mesmo que scripts/where.cjs lê, repetido aqui porque este arquivo anda só)
const AMBIENTE = () => path.join(process.env.VIDEOSTUDIO_HOME ? path.resolve(process.env.VIDEOSTUDIO_HOME) : path.join(os.homedir(), '.videostudio'), 'environment.json')
function doAmbiente() { try { const a = JSON.parse(fs.readFileSync(AMBIENTE(), 'utf8')); return typeof a.playwright === 'string' ? a.playwright : null } catch { return null } }

function candidatos(projeto) {
  const out = []
  if (process.env.PLAYWRIGHT_PATH) out.push(process.env.PLAYWRIGHT_PATH)
  const doConserto = doAmbiente()
  if (doConserto) out.push(doConserto)
  for (const base of [projeto, process.cwd(), __dirname].filter(Boolean)) {
    try { out.push(path.dirname(require.resolve('playwright/package.json', { paths: [base] }))) } catch {}
  }
  const antes = lembrado()
  if (antes) out.push(antes)
  try { out.push(path.join(execSync('npm root -g', { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim(), 'playwright')) } catch {}
  const caches = [path.join(os.homedir(), '.npm', '_npx')]
  if (process.env.LOCALAPPDATA) caches.push(path.join(process.env.LOCALAPPDATA, 'npm-cache', '_npx'))
  if (process.env.APPDATA) caches.push(path.join(process.env.APPDATA, 'npm-cache', '_npx'))
  for (const c of caches) {
    let dirs = []
    try { dirs = fs.readdirSync(c) } catch { continue }
    const achados = dirs.map((d) => path.join(c, d, 'node_modules', 'playwright')).filter((p) => fs.existsSync(path.join(p, 'package.json')))
    achados.sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs)
    out.push(...achados)
  }
  return [...new Set(out)].filter((p) => fs.existsSync(path.join(p, 'package.json')))
}

// o comando do conserto: o environment.mjs ao lado, quando este arquivo está na skill; senão, o da skill
const consertar = () => fs.existsSync(path.join(__dirname, 'environment.mjs')) ? `node ${path.join(__dirname, 'environment.mjs')}` : 'node <skill>/scripts/environment.mjs'

function carregar(projeto) {
  const cs = candidatos(projeto)
  for (const c of cs) {
    try { const pw = require(c); if (pw.chromium) { lembrar(c); return { pw, onde: c } } } catch {}
  }
  const err = new Error('Playwright not found on this machine.\n' +
    `Run once: ${consertar()} --fix (finds Playwright where it already is, or downloads it with --yes, and writes ${AMBIENTE()})\n` +
    'or point to one that already exists: PLAYWRIGHT_PATH=<folder>/node_modules/playwright')
  err.code = 'SEM_PLAYWRIGHT'
  throw err
}

// No Mac, o desenho vai pra placa de vídeo (ANGLE/Metal): medido numa cena 2D com vídeo, 99 s na CPU (SwiftShader)
// contra 46 s, com a imagem igual (SSIM 0,997); o 3D na CPU fica ~13× mais lento. Conferido num Apple M5: com estes
// argumentos o WebGL diz "ANGLE (Apple, ANGLE Metal Renderer: Apple M5)", sem eles cai no
// SwiftShader. VIDEOSTUDIO_NO_GPU=1 volta pra CPU de propósito.
const semGpu = () => !!process.env.VIDEOSTUDIO_NO_GPU
const argsGpu = () => (process.platform === 'darwin' && !semGpu() ? ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] : [])
const ehCpu = (renderer) => /SwiftShader|llvmpipe|Software/i.test(String(renderer || ''))

/** O renderer do WebGL do Chromium aberto (o UNMASKED_RENDERER_WEBGL), ou "no WebGL". */
async function rendererWebGL(browser) {
  const p = await browser.newPage()
  try {
    return await p.evaluate(() => {
      const gl = document.createElement('canvas').getContext('webgl')
      if (!gl) return 'no WebGL'
      const dbg = gl.getExtension('WEBGL_debug_renderer_info')
      return String(dbg ? gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER))
    })
  } finally { await p.close() }
}

async function abrirNavegador(projeto) {
  const { pw, onde } = carregar(projeto)
  try {
    const browser = await pw.chromium.launch({ args: ['--allow-file-access-from-files', '--force-color-profile=srgb', '--font-render-hinting=none', '--autoplay-policy=no-user-gesture-required', ...argsGpu()] })
    return { browser, onde }
  } catch (e) {
    const err = new Error(`Playwright (${onde}) could not open Chromium.\nRun: ${consertar()} --fix --yes (or, in its folder, npx playwright install chromium)\n\n${e.message.split('\n')[0]}`)
    err.code = 'SEM_CHROMIUM'
    throw err
  }
}

module.exports = { candidatos, carregar, abrirNavegador, argsGpu, rendererWebGL, ehCpu, semGpu }

if (require.main === module) {
  const a = process.argv.slice(2)
  if (a[0] === '--gpu') {
    ;(async () => {
      const { browser } = await abrirNavegador(a[1])
      const r = await rendererWebGL(browser).finally(() => browser.close())
      console.log(`WebGL: ${r}`)
      if (ehCpu(r) && !semGpu()) { console.error('3D ON CPU: the video\'s Chromium is not on the GPU (see the arguments in scripts/playwright.cjs)'); process.exitCode = 1 }
    })().catch((e) => { console.error(e.message); process.exitCode = 2 })
  } else {
    const cs = candidatos(a[0])
    console.log(cs.length ? cs.join('\n') : 'no Playwright found')
  }
}
