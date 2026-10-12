#!/usr/bin/env node
// Renderiza o vídeo direto para o ffmpeg (nada de despejar milhares de quadros no disco).
//   node render.cjs --project . --mode draft [--format 9x16] [--audio audio/soundtrack.wav]
//   node render.cjs --project . --mode final    [--format 9x16] [--out out/video-9x16.mp4]
// draft: 30 fps, sem motion blur, encode rápido — para o usuário assistir e dar opinião (minutos).
// final:    60 fps, 8 subquadros por quadro (obturador 180°) mediados pelo tmix = motion blur de verdade.
// Ajustes finos: --fps --sub --shutter --crf --preset --workers --from --to
// O draft termina gerando a folha de contato automática (frames.cjs --auto, com a checagem de colisão):
// OLHE a folha antes de mostrar. --no-sheet pula. Código 4 = a checagem achou colisão ou texto fora da área segura.
// Antes de tudo imprime o renderer do WebGL (WebGL: …); no Mac, se o Chromium cair na CPU (SwiftShader), para com
// código 5 (VIDEOSTUDIO_NO_GPU=1 renderiza na CPU de propósito).
// A janela do obturador começa no instante do quadro: corte seco no tempo T cai limpo no quadro T.
const { spawn, spawnSync, execFileSync } = require('child_process')
const path = require('path'), fs = require('fs'), os = require('os')
const { pathToFileURL } = require('url')
const { abrirNavegador, rendererWebGL, ehCpu, semGpu } = require('./playwright.cjs')
const FORMATOS = { '16x9': [1920, 1080], '19x9': [2280, 1080], '21x9': [2520, 1080], '9x16': [1080, 1920], '1x1': [1080, 1080], '4x5': [1080, 1350] }
const argv = process.argv.slice(2)
const arg = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 ? argv[i + 1] : d }
const projeto = path.resolve(arg('project', '.'))
const modo = arg('mode', 'draft')
const PRE = { draft: { fps: 30, sub: 1, shutter: 0.5, crf: 24, preset: 'veryfast' }, final: { fps: 60, sub: 8, shutter: 0.5, crf: 14, preset: 'slow' } }[modo]
if (!PRE) { console.error('--mode draft | final'); process.exit(1) }
const fps = +arg('fps', PRE.fps), sub = +arg('sub', PRE.sub), shutter = +arg('shutter', PRE.shutter)
const crf = String(arg('crf', PRE.crf)), preset = arg('preset', PRE.preset)
const workers = +arg('workers', Math.max(2, Math.min(8, os.cpus().length - 2)))

;(async () => {
  const { browser } = await abrirNavegador(projeto)
  // quem desenha este render: no Mac tem de ser a placa de vídeo (com o 3D na CPU, ~13× mais lento)
  const gpu = await rendererWebGL(browser)
  console.log(`WebGL: ${gpu}`)
  if (ehCpu(gpu) && process.platform === 'darwin' && !semGpu()) {
    await browser.close()
    console.error('3D ON CPU: the Chromium of this render fell back to SwiftShader. Check the GPU arguments in tools/playwright.cjs (copy the skill\'s one again), or run with VIDEOSTUDIO_NO_GPU=1 to render on the CPU on purpose.')
    process.exit(5)
  }
  const url0 = pathToFileURL(path.join(projeto, 'index.html')).href  // file:///C:/… no Windows
  const probe = await browser.newPage()
  const falhas = []
  probe.on('pageerror', (e) => falhas.push('PAGE ERROR: ' + e.message))
  probe.on('console', (m) => { if (m.type() === 'error') falhas.push('CONSOLE: ' + m.text()) })
  await probe.goto(url0 + (arg('format') ? `?f=${arg('format')}` : ''))
  await probe.waitForFunction('window.__ready === true', null, { timeout: 60000 }).catch(() => { throw new Error('the page was not ready after 60 s.\n' + (falhas.join('\n') || 'no error in the console: check that scenes.js and video.js load')) })
  const info = await probe.evaluate(() => ({ fmt: FMT, dur: VIDEO.duracao }))
  await probe.close()
  const formato = arg('format', info.fmt)
  const [VW, VH] = FORMATOS[formato]
  const de = +arg('from', 0), ate = +arg('to', info.dur)
  const saida = path.resolve(projeto, arg('out', `out/${modo}-${formato}.mp4`))
  fs.mkdirSync(path.dirname(saida), { recursive: true })
  const semAudio = arg('audio') ? saida.replace(/\.mp4$/, '.sem-audio.mp4') : saida

  const vf = [sub > 1 ? `tmix=frames=${sub}` : null, sub > 1 ? `select='not(mod(n+1\\,${sub}))'` : null, `setpts=N/(${fps}*TB)`,
    // conversão exata (accurate_rnd, croma inteira): o caminho rápido do swscale escurecia tons escuros e saturados em
    // ~2 níveis (medido num quadro de vídeo escuro: 29,6 → 27,6 no vermelho médio). Num corte seco entre um take e o
    // mesmo quadro passado pelo motor, isso aparecia como um degrau de cor.
    'scale=in_color_matrix=bt601:in_range=full:out_color_matrix=bt709:out_range=limited:flags=accurate_rnd+full_chroma_int+full_chroma_inp', 'format=yuv420p'].filter(Boolean).join(',')
  const ff = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(fps * sub), '-c:v', 'mjpeg', '-i', '-',
    '-vf', vf, '-r', String(fps), '-c:v', 'libx264', '-preset', preset, '-crf', crf, '-profile:v', 'high', '-pix_fmt', 'yuv420p',
    '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709', '-movflags', '+faststart', semAudio], { stdio: ['pipe', 'inherit', 'inherit'] })
  const ffFim = new Promise((res, rej) => ff.on('close', (c) => (c === 0 ? res() : rej(new Error('ffmpeg exited with code ' + c)))))

  const erros = new Set()
  const pages = await Promise.all(Array.from({ length: workers }, async () => {
    const p = await browser.newPage({ viewport: { width: VW, height: VH }, deviceScaleFactor: 1 })
    p.on('pageerror', (e) => erros.add('PAGE ERROR: ' + e.message))
    p.on('console', (m) => { if (m.type() === 'error') erros.add('CONSOLE: ' + m.text()) })
    await p.goto(url0 + `?f=${formato}`)
    await p.waitForFunction('window.__ready === true', null, { timeout: 60000 })
    return p
  }))
  // Um quadro inteiro (todos os seus subquadros) por worker: os subquadros ficam juntos no tempo e uma
  // imagem grande (tela gravada) decodifica uma vez por quadro, não uma vez por subquadro.
  const n0 = Math.round(de * fps), n1 = Math.round(ate * fps)
  const total = (n1 - n0) * sub
  const pend = new Map()
  let prox = 0, n = n0, feitos = 0, ultimoLog = -1
  const t0 = Date.now()
  const escreve = (b) => new Promise((res) => (ff.stdin.write(b) ? res() : ff.stdin.once('drain', res)))
  let fila = Promise.resolve()
  const esvazia = () => (fila = fila.then(async () => { while (pend.has(prox)) { const b = pend.get(prox); pend.delete(prox); prox++; await escreve(b) } }))
  await Promise.all(pages.map(async (p) => {
    while (n < n1) {
      const q = n++
      // não deixa um worker adiantado encher a memória enquanto o quadro da vez não sai
      while ((q - n0) * sub - prox > 200) await new Promise((r) => setTimeout(r, 5))
      for (let k = 0; k < sub; k++) {
        await p.evaluate((t) => window.renderAt(t), q / fps + (k / sub) * (shutter / fps))
        pend.set((q - n0) * sub + k, await p.screenshot({ type: 'jpeg', quality: 95 }))
      }
      await esvazia()
      feitos += sub
      const pct = Math.floor((feitos / total) * 20)
      if (pct !== ultimoLog) { ultimoLog = pct; const s = (Date.now() - t0) / 1000; console.log(`${pct * 5}% · ${feitos}/${total} captures · ${s.toFixed(0)} s · ~${((s / feitos) * (total - feitos)).toFixed(0)} s left`) }
    }
  }))
  await esvazia(); ff.stdin.end(); await ffFim; await browser.close()
  for (const e of erros) console.error(e)
  if (arg('audio')) {
    execFileSync('ffmpeg', ['-loglevel', 'error', '-y', '-i', semAudio, '-ss', String(de), '-i', path.resolve(projeto, arg('audio')), '-map', '0:v', '-map', '1:a', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '256k', '-shortest', '-movflags', '+faststart', saida])
    fs.rmSync(semAudio)
  }
  console.log(`ok · ${formato} · ${fps} fps · ${sub > 1 ? sub + ' subframes (motion blur)' : 'no motion blur'} · ${((Date.now() - t0) / 1000).toFixed(0)} s`)
  console.log(saida)
  if (erros.size) process.exitCode = 3
  if (modo === 'draft' && !argv.includes('--no-sheet')) {
    console.log('making the automatic contact sheet…')
    const r = spawnSync(process.execPath, [path.join(__dirname, 'frames.cjs'), '--project', projeto, '--auto', '--format', formato], { stdio: 'inherit' })
    const suf = formato !== '16x9' ? `-${formato}` : ''
    const folhas = [`auto-cenas${suf}.png`, `auto-cortes${suf}.png`].map((f) => path.join(projeto, 'previas', f)).filter((f) => fs.existsSync(f))
    for (const f of folhas) console.log(`LOOK at the sheet before showing it: ${f}`)
    if (r.status === 4 && !process.exitCode) process.exitCode = 4
    else if (r.status && r.status !== 4 && !process.exitCode) process.exitCode = r.status
  }
})().catch((e) => { console.error(e.message); process.exit(e.code === 'SEM_PLAYWRIGHT' || e.code === 'SEM_CHROMIUM' ? 2 : 1) })
