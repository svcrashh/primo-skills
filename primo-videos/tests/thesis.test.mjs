// A tese do vídeo: ler e conferir o thesis.md, a conta do tempo de tela no roteiro e a CLI, sem chamar o Claude de verdade
// (um `claude` falso responde). node --test tests/thesis.test.mjs (sem rede)
import { test, describe, before } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { lerTese, validarTese, resumoTese, acharTese, campo, evidencias, fraseDe } from '../scripts/thesis/read.mjs'
import { tabelas, tempoDe, quemDe, lerRoteiro, contar, julgar, textoConta, gravarConta, LIMITES, MARCA_INI, MARCA_FIM } from '../scripts/thesis/count.mjs'
import { lerReceita, montarPromptTese, extrairTese, PAPEL_TESE } from '../scripts/thesis/write.mjs'

const AQUI = path.dirname(fileURLToPath(import.meta.url))
const CLI = path.join(AQUI, '..', 'scripts', 'thesis.mjs')
const CASOS = path.join(AQUI, 'cases', 'thesis')
const caso = (f) => fs.readFileSync(path.join(CASOS, f), 'utf8')
const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'tese-'))
const TESE = caso('valid-thesis.md')
// O .cmd que o npm (cmd-shim) cria para um .js do node.
const ATALHO_JS = '@ECHO off\r\nGOTO start\r\n:find_dp0\r\nSET dp0=%~dp0\r\nEXIT /b\r\n:start\r\nSETLOCAL\r\nCALL :find_dp0\r\n\r\nIF EXIST "%dp0%\\node.exe" (\r\n  SET "_prog=%dp0%\\node.exe"\r\n) ELSE (\r\n  SET "_prog=node"\r\n  SET PATHEXT=%PATHEXT:;.JS;=;%\r\n)\r\n\r\nendLocal & goto #_undefined_# 2>NUL || title %COMSPEC% & "%_prog%"  "%dp0%\\node_modules\\@anthropic-ai\\claude-code\\cli.js" %*\r\n'

describe('ler a tese', () => {
  test('acha as cinco partes e os campos', () => {
    const t = lerTese(TESE)
    assert.equal(t.produto, 'Produto')
    assert.equal(t.frase, 'A cobrança do fiado sai sozinha, no dia combinado.')
    assert.deepEqual(t.deOnde, ['site/index.html:14', 'README.md:3'])
    assert.equal(t.categoria, 'aplicativo de controle de fiado')
    assert.match(t.quemCompra, /^o dono de mercearia/)
    assert.match(t.dor, /vergonha de cobrar/)
    assert.match(t.cena, /^chega o dia combinado/)
    assert.match(t.onde, /Quem deve/)
    assert.match(t.quemTrabalha, /^o produto/)
    assert.match(t.detalhe, /^a mensagem de cobrança sai com o nome/)
    assert.equal(t.fora.length, 4)
    assert.equal(t.intencao, 'sell')
    assert.match(t.partes.duvidas, /pagamento entra sozinho/)
  })
  test('campo junta a linha seguinte e para no próximo campo', () => {
    assert.equal(campo('**Cena:** começa aqui\ne continua\n**Onde:** tela X', 'Cena'), 'começa aqui e continua')
    assert.equal(campo('**Frase**: com dois-pontos fora', 'Frase'), 'com dois-pontos fora')
    assert.equal(campo('nada', 'Frase'), '')
  })
  test('a frase entre aspas vale sozinha: o comentário depois dela não entra na conta das palavras', () => {
    assert.equal(fraseDe('"Lemos e montamos a página para você." Ela vira "feita em quinze minutos".'), 'Lemos e montamos a página para você.')
    assert.equal(fraseDe('"A cobrança sai sozinha, no dia combinado."'), 'A cobrança sai sozinha, no dia combinado.')
    assert.equal(fraseDe('Agentes que atendem sozinhos e parecem gente.'), 'Agentes que atendem sozinhos e parecem gente.')
  })
  test('evidência é `arquivo:linha` ou endereço', () => {
    assert.deepEqual(evidencias('veja `src/a.tsx:12-30`, `docs/x.md:4` e https://produto.com/precos. `README.md` sozinho não conta'), ['src/a.tsx:12-30', 'docs/x.md:4', 'https://produto.com/precos.'])
  })
  test('a intenção aceita crase, negrito e explicação depois', () => {
    assert.equal(lerTese(TESE.replace('**Intenção:** vender', '**Intenção:** `ensinar` (central de ajuda)')).intencao, 'teach')
    assert.equal(lerTese(TESE.replace('**Intenção:** vender', '**Intenção:** **Novidade**')).intencao, 'update')
  })
})

describe('conferir a tese', () => {
  const erros = (texto) => validarTese(lerTese(texto)).erros.join(' | ')
  test('a tese completa passa', () => {
    const v = validarTese(lerTese(TESE))
    assert.equal(v.ok, true, v.erros.join('; '))
    assert.deepEqual(v.avisos, [])
  })
  test('falta uma parte', () => assert.match(erros(TESE.replace(/## 3\. A cena-prova[\s\S]*?(?=## 4)/, '')), /missing part 3, "The proof scene"/))
  test('frase sem fonte não passa', () => assert.match(erros(TESE.replace(/- `site[^\n]*\n- `README[^\n]*\n/, '- a página de entrada\n')), /does not say where it came from/))
  test('frase que é um parágrafo não passa', () => assert.match(erros(TESE.replace('A cobrança do fiado sai sozinha, no dia combinado.', Array(40).fill('palavra').join(' '))), /40 words/))
  test('intenção fora das três não passa', () => assert.match(erros(TESE.replace('**Intenção:** vender', '**Intenção:** engajar')), /sell, teach, update.*engajar/))
  test('duas intenções: vale a primeira palavra, que tem de ser uma das três', () => assert.equal(lerTese(TESE.replace('**Intenção:** vender', '**Intenção:** vender | ensinar')).intencao, 'sell'))
  test('cena-prova sem dizer onde está na tela nem quem trabalha não passa', () => {
    const e = erros(TESE.replace(/\*\*Onde, na tela:\*\*[^\n]*\n/, '').replace(/\*\*Quem trabalha:\*\*[^\n]*\n/, ''))
    assert.match(e, /where it is on screen/)
    assert.match(e, /who does the work/)
  })
  test('"o que o vídeo não mostra" vazio não passa', () => assert.match(erros(TESE.replace(/(## 4\. O que o vídeo não mostra\n)[\s\S]*?(?=\n## 5)/, '$1nada\n')), /at least one list item/))
  test('sem a linha da categoria, avisa', () => assert.match(validarTese(lerTese(TESE.replace(/\*\*Categoria[^\n]*\n/, ''))).avisos.join(), /the category may be passing for the sale/))
  test('sem o detalhe que convence, avisa e passa', () => {
    const v = validarTese(lerTese(TESE.replace(/\*\*O detalhe que convence[^\n]*\n/, '')))
    assert.equal(v.ok, true)
    assert.match(v.avisos.join(), /convincing detail/)
  })
  test('o resumo tem cinco linhas: vende, compra, prova, fora, intenção', () => {
    const r = resumoTese(lerTese(TESE)).split('\n')
    assert.equal(r.length, 5)
    assert.match(r[0], /^Sells: +"A cobrança do fiado sai sozinha, no dia combinado\." \(site\/index\.html:14\)/)
    assert.match(r[1], /^Buyer: +o dono de mercearia.* · pain: esquece quem deve/)
    assert.match(r[4], /^Intent: +sell → hook, the proof, call to action/)
  })
  test('a tese com títulos e rótulos em inglês também se lê e passa', () => {
    const en = TESE
      .replace('# Tese do vídeo', '# Video thesis')
      .replace('## 1. O que o produto vende', '## 1. What the product sells').replace('**Frase:**', '**Sentence:**').replace('**De onde:**', '**Source:**').replace('**Categoria (não é a venda):**', '**Category (not the sale):**')
      .replace('## 2. Quem compra e que dor tem', '## 2. Who buys and what pain they have').replace('**Quem compra:**', '**Who buys:**').replace('**Dor:**', '**Pain:**')
      .replace('## 3. A cena-prova', '## 3. The proof scene').replace('**Cena:**', '**Scene:**').replace('**Onde, na tela:**', '**Where, on screen:**').replace('**Quem trabalha:**', '**Who does the work:**').replace('**O detalhe que convence:**', '**The convincing detail:**').replace('**Termina em:**', '**Ends on:**')
      .replace('## 4. O que o vídeo não mostra', '## 4. What the video does not show')
      .replace('## 5. A intenção', '## 5. The intent').replace('**Intenção:**', '**Intent:**').replace('**Por quê:**', '**Why:**').replace('**Formato:**', '**Format:**')
      .replace('## O que não deu para saber', '## What could not be found out')
    assert.doesNotMatch(en, /Frase|Quem compra|Cena:|Intenção|não deu para saber/)
    const pt = lerTese(TESE), t = lerTese(en)
    const campos = ({ produto, frase, deOnde, categoria, quemCompra, dor, cena, onde, quemTrabalha, detalhe, terminaEm, fora, intencao, porque, partes }) => ({ produto, frase, deOnde, categoria, quemCompra, dor, cena, onde, quemTrabalha, detalhe, terminaEm, fora, intencao, porque, duvidas: partes.duvidas })
    assert.deepEqual(campos(t), campos(pt))
    const v = validarTese(t)
    assert.equal(v.ok, true, v.erros.join('; '))
    assert.deepEqual(v.avisos, [])
  })
  test('acharTese: a explícita, a da pasta, a de até 3 pastas acima', () => {
    const d = tmp()
    fs.mkdirSync(path.join(d, 'a', 'b', 'c', 'e'), { recursive: true })
    fs.writeFileSync(path.join(d, 'thesis.md'), TESE)
    assert.equal(acharTese(path.join(d, 'x.mp4')), path.join(d, 'thesis.md'))
    assert.equal(acharTese(path.join(d, 'a', 'b', 'c', 'x.mp4')), path.join(d, 'thesis.md'))
    assert.equal(acharTese(path.join(d, 'a', 'b', 'c', 'e', 'x.mp4')), null)
    assert.equal(acharTese(path.join(d, 'a', 'x.mp4'), path.join(d, 'outra.md')), path.join(d, 'outra.md'))
  })
})

describe('a tabela do roteiro', () => {
  test('tempo: aproximado, com vírgula, faixa e vazio', () => {
    assert.equal(tempoDe('~5'), 5)
    assert.equal(tempoDe('~3,5'), 3.5)
    assert.equal(tempoDe('2,8'), 2.8)
    assert.equal(tempoDe('4–6 s'), 5)
    assert.equal(tempoDe('12 s'), 12)
    assert.equal(tempoDe('—'), null)
    assert.equal(tempoDe(''), null)
  })
  test('quem trabalha: prova, produto, pessoa, ninguém; a entrega para alguém é pessoa', () => {
    assert.equal(quemDe('prova'), 'prova')
    assert.equal(quemDe('**o produto (prova)**'), 'prova')
    assert.equal(quemDe('produto'), 'produto')
    assert.equal(quemDe('uma pessoa (a atendente)'), 'pessoa')
    assert.equal(quemDe('produto → pessoa'), 'pessoa')
    assert.equal(quemDe('—'), 'ninguem')
    assert.equal(quemDe(''), 'ninguem')
    assert.equal(quemDe('ninguém'), 'ninguem')
    assert.equal(quemDe('a IA'), null)
  })
  test('acha a tabela certa entre várias e lê as cenas', () => {
    const md = '| a | b |\n|---|---|\n| 1 | 2 |\n\ntexto\n\n| # | Quem trabalha | O que se vê | s |\n|---|---|---|---|\n| 1 | — | abre | 3 |\n| 2 | prova | o produto faz | ~9 |\n\n| risco | grafia |\n|---|---|\n| X | Y |\n'
    assert.equal(tabelas(md).length, 3)
    const r = lerRoteiro(md)
    assert.equal(r.temColuna, true)
    assert.deepEqual(r.cenas.map(({ n, quem, s }) => [n, quem, s]), [['1', 'ninguem', 3], ['2', 'prova', 9]])
    assert.deepEqual(r.faltas, [])
  })
  test('cena sem tempo ou com "quem trabalha" que não se entende vira falta', () => {
    const r = lerRoteiro('| # | Quem trabalha | s |\n|---|---|---|\n| 1 | a IA | 3 |\n| 2 | prova | |\n')
    assert.match(r.faltas.join(' | '), /scene 1: could not tell who does the work \("a IA"\)/)
    assert.match(r.faltas.join(' | '), /scene 2: no time/)
  })
  test('a coluna e os valores em inglês também valem (Who does the work; proof, product, person, nobody)', () => {
    const r = lerRoteiro('| # | Who does the work | What is seen | Seconds |\n|---|---|---|---|\n| 1 | nobody | opens | 3 |\n| 2 | proof | the product works | about 9 |\n| 3 | product | a number | 4 to 6 |\n| 4 | a person (the agent) | clicks | 2 sec |\n')
    assert.equal(r.temColuna, true)
    assert.deepEqual(r.cenas.map(({ quem, s }) => [quem, s]), [['ninguem', 3], ['prova', 9], ['produto', 5], ['pessoa', 2]])
    assert.deepEqual(r.faltas, [])
  })
  test('texto sem tabela de roteiro devolve null', () => assert.equal(lerRoteiro('só um parágrafo'), null))
})

describe('a conta e o veredito', () => {
  const rot = (linhas) => lerRoteiro(`| # | Quem trabalha | O que se vê | s |\n|---|---|---|---|\n${linhas.map((l, i) => `| ${i + 1} | ${l[0]} | ${l[2] || 'cena'} | ${l[1]} |`).join('\n')}\n`)
  test('os limites são 50% de prova e 25% de pessoa', () => assert.deepEqual(LIMITES, { provaMin: 0.5, pessoaMax: 0.25 }))
  test('venda que passa: a prova é a maior parte e a pessoa é uma cena curta', () => {
    const r = rot([['—', 4], ['prova', 12], ['produto', 3], ['pessoa', 3], ['—', 5]])
    const c = contar(r.cenas)
    assert.deepEqual([c.total, c.tela, c.prova, c.produto, c.pessoa], [27, 18, 12, 3, 3])
    const j = julgar(r, 'sell')
    assert.equal(j.passa, true, j.motivos.join('; '))
    assert.match(textoConta(r, 'sell', j), /product time 18 s of 27 s · proof scene 12 s \(67%; minimum 50%\) · product in another scene 3 s · person working 3 s \(17%; maximum 25%\)\n\*\*Passes\.\*\*/)
  })
  test('exatamente 25% de pessoa e 50% de prova passam', () => assert.equal(julgar(rot([['prova', 10], ['produto', 5], ['pessoa', 5]]), 'sell').passa, true))
  test('pessoa acima de um quarto: volta', () => {
    const j = julgar(rot([['prova', 10], ['pessoa', 6]]), 'sell')
    assert.equal(j.veredito, 'goes back')
    assert.match(j.motivos.join(), /a person works during 38% of product time \(6 of 16 s\); the maximum is 25%/)
  })
  test('prova abaixo da metade: volta, mesmo sem pessoa', () => assert.match(julgar(rot([['prova', 4], ['produto', 10]]), 'sell').motivos.join(), /the proof scene is 29% of product time/))
  test('nenhuma cena de prova, ou nenhum tempo de produto: volta', () => {
    assert.match(julgar(rot([['produto', 10]]), 'sell').motivos.join(), /no scene is the proof scene/)
    assert.match(julgar(rot([['—', 10]]), 'sell').motivos.join(), /there is no product time/)
  })
  test('roteiro de venda sem a coluna: volta', () => {
    const r = lerRoteiro('| # | O que se vê | s |\n|---|---|---|\n| 1 | a tela | 5 |\n')
    assert.equal(r.temColuna, false)
    assert.match(julgar(r, 'sell').motivos.join(), /does not say who does the work in each scene/)
  })
  test('"Passo N de M" num roteiro de venda: volta', () => assert.match(julgar(rot([['prova', 10, 'cartão "Passo 2 de 4" e a IA responde']]), 'sell').motivos.join(), /tutorial format/))
  test('"Step N of M" num roteiro de venda: volta', () => assert.match(julgar(rot([['prova', 10, 'card "Step 2 of 4" and the AI answers']]), 'sell').motivos.join(), /"Step N of M": that is tutorial format/))
  test('ensinar e novidade: a conta sai sem veredito', () => {
    const r = rot([['pessoa', 20], ['produto', 2]])
    for (const i of ['teach', 'update']) {
      const j = julgar(r, i)
      assert.equal(j.passa, true)
      assert.match(textoConta(r, i, j), /person working 20 s \(91%\)\nNo verdict/)
    }
  })
  test('gravar a conta: entra depois da tabela, e na segunda vez troca a que estava', () => {
    const md = '# Roteiro\n\n| # | Quem trabalha | s |\n|---|---|---|\n| 1 | prova | 9 |\n\nPalavras de risco: nenhuma.\n'
    const r = lerRoteiro(md)
    const um = gravarConta(md, r, 'CONTA 1')
    assert.match(um, /\| 1 \| prova \| 9 \|\n\n<!-- count:start -->\nCONTA 1\n<!-- count:end -->\n\nPalavras de risco/)
    const dois = gravarConta(um, lerRoteiro(um), 'CONTA 2')
    assert.equal(dois.split(MARCA_INI).length, 2)
    assert.equal(dois.split(MARCA_FIM).length, 2)
    assert.match(dois, /CONTA 2/)
    assert.doesNotMatch(dois, /CONTA 1/)
  })
})

describe('o caso real: o roteiro de venda recusado', () => {
  test('como foi escrito, sem dizer quem trabalha: volta', () => {
    const r = lerRoteiro(caso('rejected-script.md'))
    assert.equal(r.cenas.length, 7)
    assert.equal(julgar(r, 'sell').veredito, 'goes back')
  })
  test('anotado pela regra: pessoa em 75% do tempo de produto e prova em 25%; volta pelos dois motivos', () => {
    const r = lerRoteiro(caso('rejected-script-annotated.md'))
    const c = contar(r.cenas)
    assert.deepEqual([c.tela, c.prova, c.pessoa], [14, 3.5, 10.5])
    assert.equal(Math.round(c.fracao.pessoa * 100), 75)
    const j = julgar(r, 'sell')
    assert.equal(j.veredito, 'goes back')
    assert.match(j.motivos.join(' | '), /the proof scene is 25% of product time \(3\.5 of 14 s\); the minimum is 50%/)
    assert.match(j.motivos.join(' | '), /a person works during 75% of product time \(10\.5 of 14 s\); the maximum is 25%/)
  })
})

describe('a receita e o prompt da conversa nova', () => {
  const receita = lerReceita()
  test('a receita tem as cinco partes, o formato e a regra de só ler', () => {
    for (const p of ['**1. What the product sells', '**2. Who buys, and what pain they have', '**3. The proof scene', '**4. What the video does not show', '**5. The intent', '# Video thesis · <product name>', 'do not run anything']) assert.ok(receita.includes(p), `falta "${p}"`)
    for (const i of ['`sell`', '`teach`', '`update`']) assert.ok(receita.includes(i), i)
  })
  test('a receita não traz marca nem produto de exemplo: a tese sai do repositório', () => {
    const molde = /```\n(# Video thesis[\s\S]*?)```/.exec(receita)[1]
    assert.deepEqual(receita.match(/^# Video thesis · .*$/gm), ['# Video thesis · <product name>'])
    for (const [, nome, valor] of molde.matchAll(/\*\*([^*\n]+):\*\*[ \t]*(.*)/g)) assert.ok(!valor || valor.startsWith('<'), `o campo "${nome}" vem preenchido: "${valor}"`)
    const exemplo = lerTese(TESE)
    const recusado = lerRoteiro(caso('rejected-script.md')).tabela.linhas.flat().filter((c) => c.length >= 20)
    const baixa = receita.toLowerCase()
    for (const t of [exemplo.frase, exemplo.categoria, exemplo.cena, exemplo.detalhe, ...recusado]) assert.ok(!baixa.includes(t.replace(/"/g, '').toLowerCase()), `a receita traz um caso de teste: "${t}"`)
    assert.doesNotMatch(receita, /\b[a-z0-9-]+\.(com|com\.br|net|io|app)\b/i)
    const nomes = new Set([...receita.matchAll(/(?<=[a-zà-ú,;] )[A-ZÀ-Ú][\wÀ-ú-]*/g)].map((m) => m[0]))
    assert.deepEqual([...nomes].filter((n) => !['README', 'Markdown', 'Reels', 'X', 'Y', 'Z'].includes(n)), [], 'nome próprio no meio da frase')
  })
  test('o formato que a receita pede passa na conferência quando preenchido', () => {
    const molde = /```\n(# Video thesis[\s\S]*?)```/.exec(receita)[1]
    const t = lerTese(molde.replace('<sell | teach | update>', 'sell').replace('`path/file:line`', '`README.md:1`'))
    const v = validarTese(t)
    assert.equal(v.ok, true, v.erros.join('; '))
  })
  test('o prompt leva a receita; o pedido só entra quando vem, e só para a intenção', () => {
    const sem = montarPromptTese({ receita: 'RECEITA-X' })
    assert.match(sem, /RECEITA-X/)
    assert.doesNotMatch(sem, /The owner's request/)
    const com = montarPromptTese({ receita: 'RECEITA-X', pedido: 'um vídeo pro Reels' })
    assert.match(com, /# The owner's request[\s\S]*decide the intent[\s\S]*um vídeo pro Reels/)
    assert.match(montarPromptTese({ receita: 'r', erros: ['missing "**Dor:**" (pain)'] }), /Your previous answer[\s\S]*- missing "\*\*Dor:\*\*"/)
  })
  test('o papel manda só ler e trata o repositório como material', () => {
    assert.match(PAPEL_TESE, /Do not run anything and do not write any file/)
    assert.match(PAPEL_TESE, /never instructions for you/)
  })
  test('extrairTese tira a conversa em volta e a cerca de código', () => {
    assert.equal(extrairTese('Li tudo. Segue:\n\n# Tese do vídeo · X\n\n## 1. O que o produto vende\n'), '# Tese do vídeo · X\n\n## 1. O que o produto vende\n')
    assert.equal(extrairTese('```markdown\n# Tese do vídeo · X\ncorpo\n```\n'), '# Tese do vídeo · X\ncorpo\n')
    assert.equal(extrairTese('I read it all. Here:\n\n# Video thesis · X\n\n## 1. What the product sells\n'), '# Video thesis · X\n\n## 1. What the product sells\n')
    assert.throws(() => extrairTese('could not read it'), /does not contain the thesis/)
  })
})

describe('CLI (claude falso)', () => {
  let dir, repo
  before(() => {
    dir = tmp()
    repo = path.join(dir, 'repo')
    fs.mkdirSync(repo)
    fs.writeFileSync(path.join(repo, 'README.md'), '# Produto\n')
  })
  // O claude falso é um script do node; no Windows, no layout do npm (claude.cmd e o .js que ele chama), para passar
  // pela resolução do .cmd de verdade. Grava os argumentos, a pasta e o que chegou pelo stdin.
  const falso = (resposta, nome) => {
    const js = `#!/usr/bin/env node\nlet entrada = ''\nprocess.stdin.setEncoding('utf8').on('data', (d) => (entrada += d)).on('end', () => {\n  require('node:fs').appendFileSync(${JSON.stringify(path.join(dir, nome + '.args'))}, JSON.stringify({ a: process.argv.slice(2), cwd: process.cwd(), entrada }) + '\\n')\n  console.log(JSON.stringify({ result: ${JSON.stringify(resposta)}, total_cost_usd: 0.3, duration_ms: 90000, num_turns: 14, usage: { input_tokens: 5, output_tokens: 7 }, modelUsage: { 'claude-sonnet-5-5': {} } }))\n})\n`
    if (process.platform === 'win32') {
      const pacote = path.join(dir, nome, 'node_modules', '@anthropic-ai', 'claude-code')
      fs.mkdirSync(pacote, { recursive: true })
      fs.writeFileSync(path.join(pacote, 'cli.js'), js)
      fs.writeFileSync(path.join(dir, nome, 'claude.cmd'), ATALHO_JS)
      return path.join(dir, nome, 'claude.cmd')
    }
    const bin = path.join(dir, nome)
    fs.writeFileSync(bin, js)
    fs.chmodSync(bin, 0o755)
    return bin
  }
  const cli = (args, bin = '/nao/existe/claude') => spawnSync('node', [CLI, ...args], { encoding: 'utf8', env: { ...process.env, CRITIC_CLAUDE: bin } })

  test('escrever: chama o claude isolado na pasta do repositório, só com leitura, e grava thesis.md e o registro', () => {
    const saida = path.join(dir, 'p1')
    const r = cli(['write', repo, '--out', saida], falso(`Pronto.\n\n${TESE}`, 'claude-ok'))
    assert.equal(r.status, 0, r.stderr)
    assert.match(r.stdout, /^Sells: +"A cobrança do fiado sai sozinha/)
    assert.match(r.stdout, /usage cost: US\$ 0.3 \(1 call, 14 turns, 90 s\)/)
    assert.equal(fs.readFileSync(path.join(saida, 'thesis.md'), 'utf8'), TESE.trim() + '\n')
    const reg = JSON.parse(fs.readFileSync(path.join(saida, 'thesis.log.json'), 'utf8'))
    assert.equal(reg.valida, true)
    assert.equal(fs.realpathSync(reg.repositorio), fs.realpathSync(repo))
    const { a, cwd, entrada } = JSON.parse(fs.readFileSync(path.join(dir, 'claude-ok.args'), 'utf8').trim())
    assert.equal(fs.realpathSync(cwd), fs.realpathSync(repo))
    assert.equal(a[a.indexOf('--tools') + 1], 'Read,Glob,Grep')
    assert.equal(a[a.indexOf('--allowedTools') + 1], 'Read,Glob,Grep')
    assert.equal(a[a.indexOf('--setting-sources') + 1], '')
    for (const flag of ['-p', '--no-session-persistence', '--strict-mcp-config', '--disable-slash-commands']) assert.ok(a.includes(flag), flag)
    assert.equal(a[a.indexOf('--system-prompt') + 1], PAPEL_TESE)
    // o papel é prosa (diz "Write the thesis…"); o que não pode ter escrita são as flags e os valores delas
    const semProsa = a.filter((_, i) => a[i - 1] !== '--system-prompt')
    assert.doesNotMatch(semProsa.join(' '), /Bash|Write|Edit|--dangerously|--resume|--continue/)
    // o prompt (a receita) vai pelo stdin, não na linha de comando: a do Windows tem teto
    assert.match(entrada, /The thesis has five parts/)
    assert.ok(!a.some((x) => x.includes('The thesis has five parts')))
  })

  test('escrever: não passa por cima de uma tese que já existe; com --redo a antiga vira thesis-v1.md', () => {
    const saida = path.join(dir, 'p1')
    const bin = falso(TESE.replace('· Produto', '· Produto 2'), 'claude-ok2')
    assert.equal(cli(['write', repo, '--out', saida], bin).status, 2)
    const r = cli(['write', repo, '--out', saida, '--redo'], bin)
    assert.equal(r.status, 0, r.stderr)
    assert.match(fs.readFileSync(path.join(saida, 'thesis.md'), 'utf8'), /· Produto 2/)
    assert.equal(fs.readFileSync(path.join(saida, 'thesis-v1.md'), 'utf8'), TESE.trim() + '\n')
  })

  test('escrever: tese fora do formato duas vezes dá código 1 e fica guardada como inválida', () => {
    const saida = path.join(dir, 'p2')
    const r = cli(['write', repo, '--out', saida], falso('# Tese do vídeo · X\n\n## 1. O que o produto vende\n**Frase:** vende tudo\n', 'claude-ruim'))
    assert.equal(r.status, 1)
    assert.match(r.stderr, /out of format twice/)
    assert.equal(fs.readFileSync(path.join(dir, 'claude-ruim.args'), 'utf8').trim().split('\n').length, 2)
    assert.ok(fs.existsSync(path.join(saida, 'thesis.invalid.md')))
    assert.ok(fs.existsSync(path.join(saida, 'thesis.attempt-1.md')) && fs.existsSync(path.join(saida, 'thesis.attempt-2.md')))
    assert.ok(!fs.existsSync(path.join(saida, 'thesis.md')))
  })

  test('escrever --prompt-only mostra o que a conversa nova recebe, sem chamar ninguém; com --request, leva o pedido', () => {
    const r = cli(['write', repo, '--out', path.join(dir, 'p3'), '--prompt-only', '--request', 'um vídeo de venda pro Reels'])
    assert.equal(r.status, 0, r.stderr)
    assert.match(r.stdout, /# The recipe[\s\S]*# The owner's request[\s\S]*um vídeo de venda pro Reels/)
  })

  test('validar: 0 com o resumo, 1 com o que falta, 2 sem arquivo; aceita a pasta', () => {
    const d = path.join(dir, 'v'); fs.mkdirSync(d)
    fs.writeFileSync(path.join(d, 'thesis.md'), TESE)
    const ok = cli(['validate', d])
    assert.equal(ok.status, 0, ok.stderr)
    assert.equal(ok.stdout.trim().split('\n').length, 5)
    fs.writeFileSync(path.join(d, 'ruim.md'), TESE.replace('**Intenção:** vender', '**Intenção:** divulgar'))
    const ruim = cli(['validate', path.join(d, 'ruim.md')])
    assert.equal(ruim.status, 1)
    assert.match(ruim.stderr, /the intent must be exactly one of/)
    assert.equal(cli(['validate', path.join(d, 'nao-existe.md')]).status, 2)
  })

  test('conta: sem tese por perto e sem --intent, para (não há roteiro sem tese)', () => {
    const d = path.join(dir, 'c0'); fs.mkdirSync(d)
    fs.copyFileSync(path.join(CASOS, 'rejected-script-annotated.md'), path.join(d, 'script.md'))
    const r = cli(['count', path.join(d, 'script.md')])
    assert.equal(r.status, 2)
    assert.match(r.stderr, /Write the thesis before the script/)
  })

  test('conta: o roteiro recusado volta (código 1), com a intenção lida da tese da pasta do projeto', () => {
    const d = path.join(dir, 'c1'); fs.mkdirSync(path.join(d, 'video'), { recursive: true })
    fs.writeFileSync(path.join(d, 'thesis.md'), TESE)
    const rot = path.join(d, 'video', 'script.md')
    fs.copyFileSync(path.join(CASOS, 'rejected-script-annotated.md'), rot)
    const r = cli(['count', rot, '--write'])
    assert.equal(r.status, 1, r.stderr)
    assert.match(r.stdout, /The count \(sell\): product time 14 s of 26\.3 s · proof scene 3\.5 s \(25%; minimum 50%\)/)
    assert.match(r.stdout, /Goes back: .*a person works during 75%/)
    assert.match(fs.readFileSync(rot, 'utf8'), /<!-- count:start -->\n\*\*The count \(sell\):\*\*[\s\S]*\*\*Goes back:\*\*[\s\S]*<!-- count:end -->/)
    const j = JSON.parse(cli(['count', rot, '--json']).stdout)
    assert.equal(j.veredito, 'goes back')
    assert.equal(j.cenas.length, 7)
  })

  test('conta: o mesmo roteiro como tutorial (--intent teach) sai sem veredito, código 0', () => {
    const r = cli(['count', path.join(CASOS, 'rejected-script-annotated.md'), '--intent', 'teach'])
    assert.equal(r.status, 0, r.stderr)
    assert.match(r.stdout, /No verdict/)
  })

  test('sem comando, ou comando sem alvo: mostra o uso e dá código 2', () => {
    assert.equal(cli([]).status, 2)
    assert.match(cli(['count']).stderr, /usage:/)
  })
})
