// node --test play/tests/*.test.mjs   (sem rede): a play contra uma OpenAI de mentira (api-falsa.mjs), com arquivos feitos na
// hora pelo ffmpeg (tom, silêncio, barras de teste). Chamada como a skill é instalada: por um link para a pasta.
import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { spawn, execFileSync } from 'node:child_process'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { subirApiFalsa } from './api-falsa.mjs'
import { candidatosDoCaminho, resolverCaminho, gradeDaFolha, planejarPartes, juntarLinhas, mmss, lerTempo, LADO_MAX_FOLHA } from '../scripts/play.mjs'

const SKILL = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const CHAVE = `sk-teste-${Math.random().toString(36).slice(2)}${Math.random().toString(36).slice(2)}`
const saidas = [] // tudo que a play imprimiu, para a conferência da chave no fim

let base, home, link, midia, api
const m = (nome) => path.join(midia, nome)
const ff = (...args) => execFileSync('ffmpeg', ['-hide_banner', '-v', 'error', '-y', ...args])
const dimensoes = (f) => execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'stream=width,height', '-of', 'csv=p=0:s=x', f]).toString().trim()

before(async () => {
  base = fs.mkdtempSync(path.join(os.tmpdir(), 'play teste '))
  home = path.join(base, 'casa')
  midia = path.join(base, 'Mídia da Ana')
  fs.mkdirSync(home)
  fs.mkdirSync(midia)
  link = path.join(base, 'skills', 'play')
  fs.mkdirSync(path.dirname(link))
  fs.symlinkSync(SKILL, link, process.platform === 'win32' ? 'junction' : 'dir')
  // bipes de 1 s a cada 2 s: 11 trechos com som em 21 s, com silêncio digital entre eles
  const bipes = (d) => ['-f', 'lavfi', '-i', `aevalsrc='if(lt(mod(t\\,2)\\,1)\\,0.5*sin(2*PI*440*t)\\,0)':s=16000:d=${d}`]
  ff(...bipes(21), '-c:a', 'libmp3lame', '-b:a', '64k', m('bipes.mp3'))
  ff(...bipes(5), '-c:a', 'libopus', '-b:a', '24k', m('Meu áudio (1).opus'))
  ff('-f', 'lavfi', '-i', 'color=c=red:s=64x64', '-frames:v', '1', m('capa.png'))
  ff(...bipes(3), '-i', m('capa.png'), '-map', '0:a', '-map', '1:v', '-c:a', 'libmp3lame', '-c:v', 'png', '-disposition:v', 'attached_pic', '-id3v2_version', '3', m('com capa.mp3'))
  ff('-f', 'lavfi', '-i', 'testsrc=s=320x180:r=10:d=12', ...bipes(12), '-map', '0:v', '-map', '1:a', '-c:v', 'libx264', '-preset', 'ultrafast', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-shortest', m('tela.mp4'))
  ff('-f', 'lavfi', '-i', 'testsrc=s=320x180:r=10:d=8', '-c:v', 'libx264', '-preset', 'ultrafast', '-pix_fmt', 'yuv420p', m('mudo.mp4'))
  ff('-display_rotation:v:0', '90', '-i', m('tela.mp4'), '-c', 'copy', m('em pé.mp4'))
  ff('-f', 'lavfi', '-i', 'anullsrc=r=8000:cl=mono', '-t', '1860', '-c:a', 'libmp3lame', '-b:a', '8k', m('longo.mp3'))
  fs.writeFileSync(m('nota.txt'), 'isto não é áudio\n')
  api = await subirApiFalsa({ chave: CHAVE })
})
after(async () => {
  await api?.fechar()
  fs.rmSync(base, { recursive: true, force: true })
})

/** Roda a play pelo link, como a skill instalada. Ambiente montado do zero: nada da chave de verdade passa. */
function play(args, { env = {}, semChave = false } = {}) {
  const ambiente = {
    PATH: process.env.PATH, HOME: home, USERPROFILE: home, LOCALAPPDATA: path.join(home, 'AppData', 'Local'),
    TMPDIR: process.env.TMPDIR ?? os.tmpdir(), ...(process.env.SystemRoot ? { SystemRoot: process.env.SystemRoot } : {}),
    OPENAI_API_BASE: api.url, ...(semChave ? {} : { OPENAI_API_KEY: CHAVE }), ...env,
  }
  return new Promise((resolve) => {
    const p = spawn(process.execPath, [path.join(link, 'scripts', 'play.mjs'), ...args], { env: ambiente })
    let stdout = '', stderr = ''
    p.stdout.on('data', (d) => { stdout += d })
    p.stderr.on('data', (d) => { stderr += d })
    p.on('close', (code) => { saidas.push(stdout, stderr); resolve({ code, stdout, stderr }) })
  })
}
const cacheDe = () => (process.platform === 'win32' ? path.join(home, 'AppData', 'Local', 'play')
  : process.platform === 'darwin' ? path.join(home, 'Library', 'Caches', 'play') : path.join(home, '.cache', 'play'))

test('o caminho colado em todas as formas', async () => {
  const abs = m('Meu áudio (1).opus')
  const escapado = abs.replace(/([ ()])/g, '\\$1')
  const formas = [abs, `'${abs}'`, `"${abs}"`, `“${abs}”`, `  ${abs} \n`, `'${abs}'\n`, escapado, ` ${escapado}\n`, pathToFileURL(abs).href]
  for (const f of formas) assert.equal(resolverCaminho(f), abs, `forma: ${JSON.stringify(f)}`)
  assert.equal(resolverCaminho(`~/${path.relative(base, abs)}`, { home: base }), abs, 'com ~')
  assert.equal(resolverCaminho(path.join(midia, 'não existe.opus')), null)
  // caminho do Windows: a barra é separador, não escape
  assert.deepEqual(candidatosDoCaminho('C:\\Users\\Ana\\Desktop\\audio 1.opus'), ['C:\\Users\\Ana\\Desktop\\audio 1.opus'])
  assert.deepEqual(candidatosDoCaminho('"C:\\Users\\Ana\\Desktop\\audio 1.opus"\r\n'), ['C:\\Users\\Ana\\Desktop\\audio 1.opus'])
  assert.deepEqual(candidatosDoCaminho('\\\\servidor\\pasta\\video.mp4'), ['\\\\servidor\\pasta\\video.mp4'])

  // pela linha de comando: partido em vários argumentos (sem aspas) e com o escape do Terminal
  api.zerar()
  const partido = await play(abs.split(' '))
  assert.equal(partido.code, 0, partido.stderr)
  assert.match(partido.stdout, /^Meu áudio \(1\)\.opus · áudio · 0:05/)
  const comEscape = await play([escapado])
  assert.equal(comEscape.code, 0, comEscape.stderr)
  assert.equal(api.pedidos.length, 1, 'a segunda vez vem do cache')
})

test('os tipos de arquivo: áudio, vídeo com áudio, vídeo sem áudio, e o que não é mídia', async () => {
  api.zerar()
  const capa = await play([m('com capa.mp3')])
  assert.equal(capa.code, 0, capa.stderr)
  assert.match(capa.stdout, /^com capa\.mp3 · áudio · 0:03$/m, 'capa embutida não faz do mp3 um vídeo')
  assert.doesNotMatch(capa.stdout, /O que aparece/)

  const tela = await play([m('tela.mp4')])
  assert.equal(tela.code, 0, tela.stderr)
  assert.match(tela.stdout, /^tela\.mp4 · vídeo com áudio · 0:12 · 320×180, horizontal$/m)
  assert.match(tela.stdout, /O que é dito \(gpt-4o-transcribe-diarize; 0:12 de áudio enviados à OpenAI\):\n\[00:00\] som 1\./)
  assert.match(tela.stdout, /O que aparece: 6 quadros em 1 folha de contato/)
  const folha = /^(\S.*folha-1\.jpg) {2}\(2×3\): 00:01 · 00:03 \/ 00:05 · 00:07 \/ 00:09 · 00:11$/m.exec(tela.stdout)
  assert.ok(folha, tela.stdout)
  assert.equal(dimensoes(folha[1]), `${2 * 320 + 3 * 8}x${3 * 180 + 4 * 8}`)

  const emPe = await play([m('em pé.mp4')])
  assert.equal(emPe.code, 0, emPe.stderr)
  assert.match(emPe.stdout, /· 180×320, vertical$/m, 'o vídeo girado aparece em pé')
  const folhaEmPe = /^(\S.*folha-1\.jpg) {2}\(3×2\)/m.exec(emPe.stdout)
  assert.ok(folhaEmPe, emPe.stdout)
  assert.equal(dimensoes(folhaEmPe[1]), `${3 * 180 + 4 * 8}x${2 * 320 + 3 * 8}`, 'células no formato do vídeo, em pé')

  const antes = api.pedidos.length
  const mudo = await play([m('mudo.mp4')])
  assert.equal(mudo.code, 0, mudo.stderr)
  assert.match(mudo.stdout, /^mudo\.mp4 · vídeo sem áudio · 0:08 · 320×180, horizontal$/m)
  assert.match(mudo.stdout, /O que é dito: nada, o arquivo não tem áudio\./)
  assert.equal(api.pedidos.length, antes, 'vídeo sem áudio não chama a API')

  const nota = await play([m('nota.txt')])
  assert.equal(nota.code, 4)
  assert.match(nota.stderr, /nota\.txt não é áudio nem vídeo/)
  const imagem = await play([m('capa.png')])
  assert.equal(imagem.code, 4)
  assert.match(imagem.stderr, /é uma imagem/)
  const sumido = await play([m('sumiu.opus')])
  assert.equal(sumido.code, 4)
  assert.match(sumido.stderr, /Não achei o arquivo .*sumiu\.opus.*aspas simples/)
  const pasta = await play([midia])
  assert.equal(pasta.code, 4)
  assert.match(pasta.stderr, /é uma pasta/)
})

test('a transcrição montada com os tempos, em cada formato de resposta', async () => {
  api.zerar()
  // a resposta de verdade do gpt-4o-transcribe-diarize para uma fala de 15 s (12/10/2026)
  const segs = [
    [' Oi,', 0, 0.25], [' aqui é a Marina.', 0.5, 1.35], [' Preciso que você troque a cor do botão de entrar para verde.', 1.8, 5.5],
    [' Depois,', 6.65, 7.6], [' confere se a página de preços abre no celular.', 7.9, 10.75],
    [' O prazo é sexta-feira,', 12.25, 13.85], [' às três da tarde.', 14.15, 15.2],
  ]
  api.estado.resposta = () => ({ text: '…', task: 'transcribe', duration: 15.37, segments: segs.map(([text, start, end], i) => ({ type: 'transcript.text.segment', text, speaker: 'A', start, end, id: `seg_${i}` })) })
  const r = await play([m('bipes.mp3'), '--refazer'])
  assert.equal(r.code, 0, r.stderr)
  assert.match(r.stdout, /\n\[00:00\] Oi, aqui é a Marina\. Preciso que você troque a cor do botão de entrar para verde\.\n\[00:06\] Depois, confere se a página de preços abre no celular\.\n\[00:12\] O prazo é sexta-feira, às três da tarde\.\n/)
  assert.doesNotMatch(r.stdout, /A: /, 'uma voz só: sem a letra de quem fala')
  const p = api.pedidos.at(-1)
  assert.deepEqual([p.modelo, p.formato, p.chunking, p.idioma], ['gpt-4o-transcribe-diarize', 'diarized_json', 'auto', null])
  assert.equal(p.nomeArquivo, 'audio.mp3', 'o nome do arquivo da pessoa não vai para a API')

  api.estado.resposta = () => ({ text: '…', segments: [{ text: 'Bom dia.', speaker: 'A', start: 0.4, end: 1 }, { text: 'Bom dia, tudo certo?', speaker: 'B', start: 1.5, end: 3 }, { text: 'Tudo.', speaker: 'A', start: 65.2, end: 66 }] })
  const duas = await play([m('bipes.mp3'), '--idioma', 'PT', '--refazer'])
  assert.equal(duas.code, 0, duas.stderr)
  assert.match(duas.stdout, /idioma pt; 2 vozes;/)
  assert.match(duas.stdout, /\n\[00:00\] A: Bom dia\.\n\[00:01\] B: Bom dia, tudo certo\?\n\[01:05\] A: Tudo\.\n/)
  assert.equal(api.pedidos.at(-1).idioma, 'pt')

  // a resposta de verdade do whisper-1 para a mesma fala: trechos maiores, com o tempo em segundos redondos
  api.estado.resposta = () => ({ task: 'transcribe', language: 'portuguese', duration: 15.36, text: '…', segments: [
    { id: 0, start: 0, end: 7, text: ' Oi, aqui é a Marina. Preciso que você troque a cor do botão de entrar para verde.' },
    { id: 1, start: 7, end: 11, text: ' Depois, confere se a página de preços abre no celular.' },
    { id: 2, start: 11, end: 15, text: ' O prazo é sexta-feira, às três da tarde.' },
  ] })
  const whisper = await play([m('bipes.mp3'), '--modelo', 'whisper-1'])
  assert.equal(whisper.code, 0, whisper.stderr)
  assert.deepEqual([api.pedidos.at(-1).formato, api.pedidos.at(-1).granularidade], ['verbose_json', 'segment'])
  assert.match(whisper.stdout, /idioma detectado: portuguese/)
  assert.match(whisper.stdout, /\n\[00:07\] Depois, confere se a página de preços abre no celular\.\n\[00:11\] O prazo/)

  api.estado.resposta = null

  const texto = await play([m('bipes.mp3'), '--modelo', 'gpt-transcribe'])
  assert.equal(texto.code, 0, texto.stderr)
  assert.equal(api.pedidos.at(-1).formato, 'json')
  assert.match(texto.stdout, /\n\[00:00\] som 1\. som 2\./)
  assert.match(texto.stdout, /o gpt-transcribe não devolve o tempo de cada trecho/)
})

test('arquivo acima do limite é partido nas pausas, e as partes são emendadas com o tempo certo', async () => {
  api.zerar()
  const r = await play([m('bipes.mp3'), '--refazer', '--json'], { env: { PLAY_LIMITE_BYTES: '40000' } })
  assert.equal(r.code, 0, r.stderr)
  const j = JSON.parse(r.stdout)
  assert.ok(j.transcricao.partes >= 3, `partes: ${j.transcricao.partes}`)
  assert.equal(api.pedidos.length, j.transcricao.partes)
  assert.ok(api.pedidos.every((p) => p.bytes <= 40000), 'cada parte cabe no limite')
  const inicios = j.transcricao.trechos.map((t) => t.inicio)
  assert.equal(inicios.length, 11, `um trecho por bipe, sem perder nem repetir: ${inicios}`)
  inicios.forEach((t, i) => assert.ok(Math.abs(t - 2 * i) < 0.15, `bipe ${i + 1} em ${t}, esperado ${2 * i}`))
  assert.ok(Math.abs(j.transcricao.enviado_seg - 21) < 0.2)

  // o plano: corta no meio da pausa mais perto do limite, nunca depois dele
  const pausas = [1, 3, 5, 7, 9].map((a) => ({ inicio: a, fim: a + 1 }))
  assert.deepEqual(planejarPartes(10, 60000, pausas, { limiteBytes: 40000 }).map((p) => [p.inicio, p.fim]), [[0, 5.5], [5.5, 10]])
  assert.deepEqual(planejarPartes(10, 60000, [], { limiteBytes: 40000 }).map((p) => [p.inicio, p.fim]), [[0, 6], [6, 10]])
  assert.deepEqual(planejarPartes(30 * 60, 1000, [], { maxSeg: 20 * 60 }).map((p) => [p.inicio, p.fim]), [[0, 1200], [1200, 1800]])
})

test('cache: o mesmo arquivo de novo não chama a API; --refazer chama', async () => {
  api.zerar()
  const a = m('tela.mp4')
  const primeira = await play([a, '--refazer'])
  assert.equal(primeira.code, 0, primeira.stderr)
  assert.equal(api.pedidos.length, 1)
  const folha = /^(\S.*folha-1\.jpg)/m.exec(primeira.stdout)[1]
  const quando = fs.statSync(folha).mtimeMs

  const segunda = await play([a])
  assert.equal(segunda.code, 0, segunda.stderr)
  assert.equal(api.pedidos.length, 1, 'segunda vez: zero pedidos')
  assert.match(segunda.stdout, /do cache, nada foi enviado agora/)
  assert.equal(fs.statSync(folha).mtimeMs, quando, 'as folhas também vêm do cache')

  const outra = await play([a, '--quadros', '9'])
  assert.equal(api.pedidos.length, 1, 'mudar os quadros não transcreve de novo')
  assert.match(outra.stdout, /O que aparece: 9 quadros em 1 folha/)

  const refeita = await play([a, '--refazer'])
  assert.equal(refeita.code, 0, refeita.stderr)
  assert.equal(api.pedidos.length, 2)
  assert.match(refeita.stdout, /0:12 de áudio enviados à OpenAI/)

  // arquivo que mudou é outro arquivo para o cache
  const copia = m('copia.mp4')
  fs.copyFileSync(a, copia)
  await play([copia])
  assert.equal(api.pedidos.length, 3)
  fs.appendFileSync(copia, Buffer.alloc(16))
  await play([copia])
  assert.equal(api.pedidos.length, 4)
})

test('arquivo longo para antes de qualquer pedido (código 5) e só segue com --longo', async () => {
  api.zerar()
  const r = await play([m('longo.mp3')])
  assert.equal(r.code, 5, r.stderr)
  assert.match(r.stderr, /longo\.mp3 tem 31:00\. Acima de 30 min eu paro antes de mandar.*--longo/)
  assert.equal(api.pedidos.length, 0)

  const sim = await play([m('longo.mp3'), '--longo'])
  assert.equal(sim.code, 0, sim.stderr)
  assert.equal(api.pedidos.length, 2, 'acima de 20 min vai em partes')
  assert.match(sim.stdout, /31:00 de áudio enviados à OpenAI em 2 partes/)
  assert.match(sim.stdout, /nenhuma fala reconhecida/)
})

test('sem chave: código 3, a explicação de como criar, e nenhum pedido', async () => {
  api.zerar()
  const r = await play([m('Meu áudio (1).opus'), '--refazer'], { semChave: true })
  assert.equal(r.code, 3)
  assert.equal(api.pedidos.length, 0)
  for (const t of ['platform.openai.com', '"API keys"', '"Billing"', 'separada da assinatura do ChatGPT', '~/.claude/secrets/openai.env', 'não cole na conversa']) {
    assert.ok(r.stderr.includes(t), `falta "${t}" em:\n${r.stderr}`)
  }

  // num vídeo, os quadros saem mesmo sem chave
  const v = await play([m('em pé.mp4'), '--refazer'], { semChave: true })
  assert.equal(v.code, 3)
  assert.match(v.stdout, /folha-1\.jpg/)

  // a chave no arquivo, com export e aspas, como os scripts vizinhos aceitam
  fs.mkdirSync(path.join(home, '.claude', 'secrets'), { recursive: true })
  fs.writeFileSync(path.join(home, '.claude', 'secrets', 'openai.env'), `# chave de teste\nexport OPENAI_API_KEY="${CHAVE}"\n`)
  const doArquivo = await play([m('Meu áudio (1).opus'), '--refazer'], { semChave: true })
  assert.equal(doArquivo.code, 0, doArquivo.stderr)
  assert.equal(api.pedidos.at(-1).autorizacao, `Bearer ${CHAVE}`)
  fs.rmSync(path.join(home, '.claude'), { recursive: true, force: true })
})

test('erros da API dizem o que fazer', async () => {
  api.zerar()
  const recusada = await play([m('Meu áudio (1).opus'), '--refazer'], { env: { OPENAI_API_KEY: `${CHAVE}-velha` } })
  assert.equal(recusada.code, 3)
  assert.match(recusada.stderr, /A OpenAI recusou a chave \(401: Incorrect API key provided: \[chave\]\.\)/)
  assert.match(recusada.stderr, /"API keys"/)

  api.estado.erro = { status: 429, corpo: { error: { message: 'You exceeded your current quota, please check your plan and billing details.', type: 'insufficient_quota', code: 'insufficient_quota' } } }
  const semCredito = await play([m('Meu áudio (1).opus'), '--refazer'])
  assert.equal(semCredito.code, 3)
  assert.match(semCredito.stderr, /sem crédito.*"Billing"/)
  assert.equal(api.pedidos.length, 2, 'sem crédito não tenta de novo')

  api.estado.erro = { status: 400, corpo: { error: { message: 'The model `gpt-que-nao-existe` does not exist.', code: 'model_not_found' } } }
  const modelo = await play([m('Meu áudio (1).opus'), '--modelo', 'gpt-que-nao-existe'])
  assert.equal(modelo.code, 1)
  assert.match(modelo.stderr, /não aceitou o modelo gpt-que-nao-existe.*Rode sem --modelo/)
  api.estado.erro = null

  const vazio = fs.mkdtempSync(path.join(base, 'path-'))
  const semFfmpeg = await play([m('Meu áudio (1).opus')], { env: { PATH: vazio } })
  assert.equal(semFfmpeg.code, 1)
  assert.match(semFfmpeg.stderr, /Não achei o ffprobe nesta máquina/)
  assert.match(semFfmpeg.stderr, process.platform === 'win32' ? /winget install ffmpeg/ : process.platform === 'darwin' ? /brew install ffmpeg/ : /apt install ffmpeg/)

  const uso = await play([m('tela.mp4'), '--quadros', 'muitos'])
  assert.equal(uso.code, 2)
  const desconhecida = await play([m('tela.mp4'), '--rapido'])
  assert.equal(desconhecida.code, 2)
  assert.match(desconhecida.stderr, /opção que não conheço: --rapido/)
})

test('quadro em resolução cheia num tempo dado, e recorte', async () => {
  const r = await play(['quadro', m('em pé.mp4'), '--em', '[00:02]'])
  assert.equal(r.code, 0, r.stderr)
  const f = /\(180×320\): (\S.*\.jpg)$/m.exec(r.stdout)
  assert.ok(f, r.stdout)
  assert.equal(dimensoes(f[1]), '180x320')

  const recorte = await play(['quadro', m('em pé.mp4'), '--em', '2', '--recorte', '0,0,100,50'])
  assert.equal(recorte.code, 0, recorte.stderr)
  assert.equal(dimensoes(/: (\S.*\.jpg)$/m.exec(recorte.stdout)[1]), '180x160')

  assert.equal((await play(['quadro', m('em pé.mp4'), '--em', '05:00'])).code, 2)
  assert.equal((await play(['quadro', m('em pé.mp4')])).code, 2)
  assert.equal((await play(['quadro', m('em pé.mp4'), '--em', '1', '--recorte', '50,0,60,10'])).code, 2)
  assert.equal((await play(['quadro', m('bipes.mp3'), '--em', '1'])).code, 4)
})

test('peças soltas: grade da folha, linhas, tempos', () => {
  // vertical do celular (2160×3840) e tela gravada na horizontal (1920×1080)
  const v = gradeDaFolha(8, 2160 / 3840)
  assert.deepEqual([v.cols, v.rows], [4, 2])
  assert.ok(v.cols * v.largura + 8 * (v.cols + 1) <= LADO_MAX_FOLHA && v.rows * v.altura + 8 * (v.rows + 1) <= LADO_MAX_FOLHA)
  assert.ok(Math.abs(v.largura / v.altura - 2160 / 3840) < 0.01)
  const h = gradeDaFolha(9, 1920 / 1080)
  assert.ok(h.cols * h.largura + 8 * (h.cols + 1) <= LADO_MAX_FOLHA && h.rows * h.altura + 8 * (h.rows + 1) <= LADO_MAX_FOLHA)
  assert.ok(h.largura > h.altura)

  const linhas = juntarLinhas([
    { inicio: 0, fim: 1, texto: 'Então,', falante: 'A' }, { inicio: 1.2, fim: 3, texto: 'vamos lá.', falante: 'A' },
    { inicio: 3.1, fim: 4, texto: 'Pode ser.', falante: 'B' }, { inicio: 9, fim: 10, texto: 'Fechado.', falante: 'B' },
  ])
  assert.deepEqual(linhas.map((l) => [l.inicio, l.texto]), [[0, 'Então, vamos lá.'], [3.1, 'Pode ser.'], [9, 'Fechado.']])
  assert.equal(mmss(3725.9), '62:05')
  assert.equal(lerTempo('1:02:03'), 3723)
  assert.equal(lerTempo('83,5'), 83.5)
})

test('a chave nunca aparece: nem na saída, nem no erro, nem em arquivo gravado', () => {
  const pedacos = [CHAVE, CHAVE.slice(-10)]
  for (const s of saidas) for (const p of pedacos) assert.ok(!s.includes(p), `a chave apareceu na saída:\n${s.slice(0, 400)}`)
  const anda = (d) => {
    if (!fs.existsSync(d)) return
    for (const n of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, n.name)
      if (n.isDirectory()) anda(p)
      else for (const q of pedacos) assert.ok(!fs.readFileSync(p).includes(q), `a chave foi gravada em ${p}`)
    }
  }
  anda(home)
  assert.ok(saidas.length > 20)
})

test('limpar: o cache de um arquivo, ou todo', async () => {
  await play([m('mudo.mp4')])
  await play([m('tela.mp4')])
  const n = () => fs.readdirSync(cacheDe()).length
  const antes = n()
  const um = await play(['limpar', m('mudo.mp4')])
  assert.equal(um.code, 0, um.stderr)
  assert.match(um.stdout, /Apaguei o cache de mudo\.mp4/)
  assert.equal(n(), antes - 1)
  const todo = await play(['limpar'])
  assert.match(todo.stdout, /Apaguei o cache da play/)
  assert.ok(!fs.existsSync(cacheDe()))
  assert.match((await play(['limpar'])).stdout, /já está vazio/)
})
