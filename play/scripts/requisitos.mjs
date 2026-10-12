#!/usr/bin/env node
// O que a skill play precisa nesta máquina, e o que fazer com o que faltar. O instalador roda isto depois de ligar as
// skills e mostra a saída. Sem rede e sem dependência; não grava nem cria nada; nunca imprime a chave.
// Sai com 0 quando nada obrigatório falta e com 1 quando falta.
// O play.mjs usa daqui a leitura da chave e as instruções, para os dois dizerem a mesma coisa.
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

export const arquivoDaChave = () => path.join(os.homedir(), '.claude', 'secrets', 'openai.env')
/** O caminho do arquivo da chave como a pessoa digita naquele sistema. */
export const arquivoDaChaveMostrado = (so = process.platform) => (so === 'win32' ? '%USERPROFILE%\\.claude\\secrets\\openai.env' : '~/.claude/secrets/openai.env')

// No Windows o arquivo pode vir em UTF-16: é o que o "echo ... > arquivo" do PowerShell 5.1 grava. O Bloco de Notas grava
// UTF-8, às vezes com BOM, e com CRLF; a leitura da linha da chave já aceita os dois.
function lerTexto(f) {
  let b
  try { b = fs.readFileSync(f) } catch { return null }
  if (b[0] === 0xff && b[1] === 0xfe) return b.subarray(2).toString('utf16le')
  return b.toString('utf8').replace(/^﻿/, '')
}

/** A chave da OpenAI ({ valor, onde }), ou null. A variável de ambiente vem antes do arquivo. */
export function lerChave(env = process.env) {
  const doAmbiente = String(env.OPENAI_API_KEY ?? '').trim()
  if (doAmbiente) return { valor: doAmbiente, onde: 'na variável OPENAI_API_KEY' }
  const m = /^\s*(?:export\s+)?OPENAI_API_KEY\s*=\s*(.+?)\s*$/m.exec(lerTexto(arquivoDaChave()) ?? '')
  const valor = m ? m[1].replace(/^(['"])(.*)\1$/, '$2').trim() : ''
  return valor ? { valor, onde: 'no arquivo da chave' } : null
}

/** Como criar a chave e onde pô-la, para quem nunca fez isso. */
export function passosDaChave(so = process.platform) {
  const criar = so === 'win32'
    ? [
      '3. No PowerShell, crie a pasta e abra o arquivo da chave no Bloco de Notas (ele pergunta se cria o arquivo: diga que sim):',
      '     New-Item -ItemType Directory -Force "$env:USERPROFILE\\.claude\\secrets" | Out-Null',
      '     notepad "$env:USERPROFILE\\.claude\\secrets\\openai.env"',
    ]
    : [
      '3. No Terminal, crie o arquivo da chave, que só você pode ler, e abra no editor:',
      '     mkdir -p ~/.claude/secrets && chmod 700 ~/.claude/secrets',
      '     touch ~/.claude/secrets/openai.env && chmod 600 ~/.claude/secrets/openai.env',
      so === 'darwin' ? '     open -e ~/.claude/secrets/openai.env' : '     nano ~/.claude/secrets/openai.env',
    ]
  return [
    'A API da OpenAI é paga por uso e é separada da assinatura do ChatGPT.',
    '1. Em platform.openai.com, entre em "API keys" e crie uma chave.',
    '2. Ainda lá, em "Billing", ponha crédito na conta da API.',
    ...criar,
    '4. Escreva uma linha só, OPENAI_API_KEY= seguido da chave, salve e feche.',
    'A chave fica só nesse arquivo: não cole na conversa com o Claude e não ponha no git.',
    'A variável de ambiente OPENAI_API_KEY também vale, no lugar do arquivo.',
  ]
}

/** O caminho do programa no PATH, ou null. Só olha os arquivos: não roda nada. */
export function noPath(nome, env = process.env, so = process.platform) {
  const exts = so === 'win32' ? String(env.PATHEXT || '.EXE;.CMD;.BAT').split(';').filter(Boolean) : ['']
  for (const d of String(env.PATH ?? env.Path ?? '').split(path.delimiter)) {
    if (!d) continue
    for (const e of exts) {
      const f = path.join(d.replace(/^"(.*)"$/, '$1'), nome + e)
      try {
        fs.accessSync(f, so === 'win32' ? fs.constants.F_OK : fs.constants.X_OK)
        if (fs.statSync(f).isFile()) return f
      } catch {}
    }
  }
  return null
}

export function comoInstalarFfmpeg(so = process.platform, env = process.env) {
  if (so === 'win32') return ['No PowerShell:', '     winget install ffmpeg', 'Depois feche e abra o PowerShell, para ele achar o ffmpeg.']
  if (so === 'darwin') {
    return ['No Terminal:', '     brew install ffmpeg',
      ...(noPath('brew', env, so) ? [] : ['Sem o Homebrew (o comando brew)? Instale ele antes, com o comando que está em brew.sh.'])]
  }
  return ['Pelo gerenciador de pacotes do sistema, por exemplo:', '     sudo apt install ffmpeg']
}

export function relatorio({ env = process.env, so = process.platform, versaoNode = process.versions.node } = {}) {
  const linhas = ['play — entende um arquivo de áudio ou de vídeo: transcreve o que é dito e mostra o que aparece na imagem.']
  let falta = false
  const item = (tem, titulo, passos = []) => {
    linhas.push(`${tem ? '✔' : '✖'} ${titulo}`)
    if (!tem) falta = true
    for (const p of passos) linhas.push(`    ${p}`)
  }

  const major = Number(String(versaoNode).split('.')[0])
  if (major >= 18) item(true, `Node ${versaoNode}`)
  else item(false, `Node 18 ou mais novo (este é o ${versaoNode})`, so === 'win32' ? ['No PowerShell:', '     winget install OpenJS.NodeJS.LTS'] : ['No Terminal:', '     brew install node'])

  if (noPath('ffmpeg', env, so) && noPath('ffprobe', env, so)) item(true, 'ffmpeg e ffprobe')
  else item(false, 'ffmpeg (o ffprobe vem junto): converte o áudio e tira os quadros do vídeo', comoInstalarFfmpeg(so, env))

  const arq = arquivoDaChave()
  const mostrado = arquivoDaChaveMostrado(so)
  const chave = lerChave(env)
  if (chave?.onde === 'na variável OPENAI_API_KEY') item(true, 'chave da OpenAI (na variável OPENAI_API_KEY)')
  else if (chave) {
    let aberto = false
    if (so !== 'win32') { try { aberto = ((fs.statSync(arq).mode | fs.statSync(path.dirname(arq)).mode) & 0o077) !== 0 } catch {} }
    item(true, `chave da OpenAI (em ${mostrado})`, aberto
      ? ['Outros usuários desta máquina conseguem ler a chave. Feche a pasta e o arquivo:', '     chmod 700 ~/.claude/secrets && chmod 600 ~/.claude/secrets/openai.env']
      : [])
  } else {
    const semLinha = lerTexto(arq) != null ? [`O arquivo ${mostrado} existe, mas não tem a linha OPENAI_API_KEY=…`] : []
    item(false, 'chave da OpenAI: é ela que transcreve o que é dito', [...semLinha, ...passosDaChave(so)])
  }
  return { texto: linhas.join('\n'), falta }
}

// caminho real dos dois lados: a skill é instalada por link simbólico, e aí o argv[1] não bate com o import.meta.url
if (process.argv[1] && (() => { try { return fs.realpathSync(process.argv[1]) === fs.realpathSync(fileURLToPath(import.meta.url)) } catch { return false } })()) {
  const { texto, falta } = relatorio()
  console.log(texto)
  process.exitCode = falta ? 1 : 0
}
