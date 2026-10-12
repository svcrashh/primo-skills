#!/usr/bin/env node
// O que a primo-videos precisa nesta máquina, em poucas linhas: o instalador do primo-skills roda isto logo depois de
// ligar a skill, e quem instala roda de novo quando quiser.
//   node requisitos.mjs [--lang en]   em português por padrão
// ✔ tem · ✖ falta e é obrigatório · ○ falta e é opcional; embaixo de cada falta, o comando ou os passos. Leve: não abre
// o Chromium, não cria o venv e não grava nada (isso é o environment.mjs --fix). Sai 0 quando nada obrigatório falta e
// 1 quando falta. Das chaves, diz só se existem e de onde, nunca o valor.
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { opcionais, noPath, ambienteVelho, curto } from './environment.mjs'
import { pastaVideostudio, lerAmbiente } from './where.cjs'

const here = path.dirname(fileURLToPath(import.meta.url))
const real = (p) => { try { return fs.realpathSync(p) } catch { return null } }

function principal(args) {
  const i = args.indexOf('--lang')
  const en = i >= 0 && /^en(-us)?$/i.test(args[i + 1] || '')
  const t = (pt, ingles) => (en ? ingles : pt)

  const linhas = [t(
    'primo-videos: faz vídeo do seu produto (tutorial, lançamento, vinheta, corte para Reels), com ou sem narração, na sua marca.',
    'primo-videos: makes a video of your product (tutorial, launch, logo sting, cut for Reels), with or without narration, in your brand.',
  )]
  let falta = false
  const item = (marca, texto, passos = []) => {
    if (marca === '✖') falta = true
    linhas.push(`${marca} ${texto}`, ...passos.map((p) => `    ${p}`))
  }
  const fim = () => { console.log(linhas.join('\n')); return falta ? 1 : 0 }

  if (process.platform !== 'darwin') {
    const sistema = process.platform === 'win32' ? 'Windows' : process.platform === 'linux' ? 'Linux' : process.platform
    item('✖', t('macOS: a primo-videos, por enquanto, é só para Mac.', 'macOS: primo-videos is Mac-only for now.'), [t(
      `Neste ${sistema} ela ainda não roda: não há nada a instalar para ela agora.`,
      `It does not run on ${sistema} yet: there is nothing to install for it now.`,
    )])
    return fim()
  }

  // os comandos saem pelo link da skill quando ele aponta para esta cópia; senão, pelo caminho desta cópia
  const SKILL = path.resolve(here, '..'), LINK = path.join(os.homedir(), '.claude', 'skills', 'primo-videos')
  const base = real(LINK) && real(LINK) === real(SKILL) ? LINK : SKILL
  const script = (nome) => { const p = path.join(base, 'scripts', nome), c = curto(p); return `node ${/\s/.test(c) ? `"${p}"` : c}` }
  const noTerminal = t('No Terminal, rode:', 'In Terminal, run:')
  const brew = (pacote) => [noTerminal, `  brew install ${pacote}`, ...(noPath('brew') ? [] : [
    t('Sem o Homebrew (o comando brew)? Instale-o antes, colando no Terminal o comando da página brew.sh, e faça o que ele pedir no fim:',
      'No Homebrew (the brew command)? Install it first by pasting into Terminal the command from brew.sh, and do what it asks at the end:'),
    '  /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"',
  ])]

  const node = process.versions.node
  if (Number(node.split('.')[0]) >= 18) item('✔', `Node.js ${node}`)
  else item('✖', t(`Node.js ${node}: a skill precisa do 18 ou mais novo.`, `Node.js ${node}: the skill needs 18 or newer.`), brew('node'))

  if (noPath('ffmpeg') && noPath('ffprobe')) item('✔', t('ffmpeg e ffprobe', 'ffmpeg and ffprobe'))
  else item('✖', t('ffmpeg: monta, codifica e confere o vídeo.', 'ffmpeg: assembles, encodes and checks the video.'), brew('ffmpeg'))

  const casa = curto(pastaVideostudio()), arq = path.join(pastaVideostudio(), 'environment.json'), amb = lerAmbiente()
  if (!ambienteVelho(amb)) item('✔', t(`Conferência do ambiente: feita em ${String(amb.quando || '?').slice(0, 10)} (${curto(arq)})`, `Environment check: done on ${String(amb.quando || '?').slice(0, 10)} (${curto(arq)})`))
  else item('✖', amb
    ? t('Conferência do ambiente: rodou, mas ficou faltando coisa, ou o que ela achou saiu da máquina.', 'Environment check: it ran, but something was left missing, or what it found is no longer on this machine.')
    : t('Conferência do ambiente: ainda não foi feita (é uma vez por máquina).', 'Environment check: not done yet (it is once per machine).'), [
    noTerminal,
    `  ${script('environment.mjs')} --fix`,
    t(`Ele acha o Playwright e o Chromium, que desenham as cenas, cria o Python da trilha sonora (numpy e scipy, ~30 MB, em ${casa}) e grava ${curto(arq)}. O que ele não resolver sozinho, ele diz com o comando certo.`,
      `It finds Playwright and Chromium, which draw the scenes, creates the soundtrack's Python (numpy and scipy, ~30 MB, in ${casa}) and writes ${curto(arq)}. Whatever it cannot settle on its own, it names with the right command.`),
    t('Se não houver Chromium nesta máquina, ele pede para rodar de novo com --yes no fim: aí ele baixa (~150 MB).',
      'If there is no Chromium on this machine, it asks you to run it again with --yes at the end: then it downloads it (~150 MB).'),
  ])

  const op = opcionais()
  const CHAVES = [
    ['voz', 'ElevenLabs', t('Voz em off', 'Voiceover'), t('a voz em off', 'the voiceover'), t(
      'Crie a chave em elevenlabs.io, no menu da conta, em "API Keys". Ela gasta os créditos do plano da sua própria conta.',
      'Create the key at elevenlabs.io, in the account menu, under "API Keys". It spends the credits of your own account\'s plan.')],
    ['imagens', 'OpenAI', t('Imagem gerada', 'Generated images'), t('a imagem gerada', 'generated images'), t(
      'Crie a chave em platform.openai.com, em "API keys". A API é paga por uso e é separada da assinatura do ChatGPT: precisa de crédito na conta da API (em "Billing").',
      'Create the key at platform.openai.com, under "API keys". The API is paid per use and is separate from the ChatGPT subscription: it needs credit on the API account (under "Billing").')],
  ]
  for (const [k, servico, oque, desliga, cria] of CHAVES) {
    const x = op[k], arquivo = curto(x.arquivo), pasta = curto(path.dirname(x.arquivo))
    if (x.ok) {
      const onde = x.de === 'ambiente' ? t('na variável de ambiente', 'in the environment variable') : t(`em ${arquivo}`, `in ${arquivo}`)
      item('✔', t(`${oque}: chave da ${servico} (${x.chave}) encontrada ${onde}`, `${oque}: ${servico} key (${x.chave}) found ${onde}`))
      continue
    }
    item('○', t(`${oque}: chave da ${servico} (${x.chave}), opcional e paga. Sem ela, só ${desliga} fica desligada; o resto funciona.`,
      `${oque}: ${servico} key (${x.chave}), optional and paid. Without it, only ${desliga} ${k === 'voz' ? 'is' : 'are'} off; everything else works.`), [
      t('Para ligar:', 'To turn it on:'),
      `1. ${cria}`,
      t('2. No Terminal, crie a pasta e o arquivo, fechados só para você:', '2. In Terminal, create the folder and the file, closed to anyone but you:'),
      `     mkdir -p ${pasta} && chmod 700 ${pasta}`,
      `     touch ${arquivo} && chmod 600 ${arquivo}`,
      t(`3. Abra o arquivo no seu editor (open -e ${arquivo} abre no TextEdit), escreva uma linha só, ${x.chave}= seguido da chave (sem espaço nem aspas), e salve.`,
        `3. Open the file in your editor (open -e ${arquivo} opens it in TextEdit), write a single line, ${x.chave}= followed by the key (no spaces, no quotes), and save.`),
      t(`4. Confira: ${script('requisitos.mjs')}. Esta linha passa a ✔.`, `4. Check it: ${script('requisitos.mjs')} --lang en. This line turns into ✔.`),
      t(`A chave nunca vai na conversa com o Claude, nunca vai para o git e nunca é impressa. Em vez do arquivo, também vale a variável de ambiente ${x.chave}.`,
        `The key never goes into the conversation with Claude, never goes into git and is never printed. Instead of the file, the environment variable ${x.chave} works too.`),
    ])
  }
  return fim()
}

// caminho real dos dois lados: a skill é instalada por link simbólico, e aí o argv[1] não bate com o import.meta.url
if (process.argv[1] && real(process.argv[1]) === real(fileURLToPath(import.meta.url))) process.exitCode = principal(process.argv.slice(2))
