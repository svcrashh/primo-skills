// A escrita sem tique de IA: as regras do texto da tela e da fala, e a CLI que revisa o texto da tela de um arquivo.
// node --test tests/writing.test.mjs (sem rede)
import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { revisarTexto, frasesDe, textosDoArquivo, segundosDe } from '../scripts/writing.mjs'

const CLI = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'scripts', 'writing.mjs')
// as regras de expressão são do português: os casos daqui pedem idioma 'pt' (o padrão é 'en')
const revisar = (t, o = {}) => revisarTexto(t, { idioma: 'pt', ...o })
const fala = (t, o = {}) => revisar(t, { fala: true, ...o })
const regras = (achados, nivel) => achados.filter((a) => !nivel || a.nivel === nivel).map((a) => a.regra)
const tem = (t, regra, o) => assert.ok(regras(fala(t, o)).includes(regra), `${regra} devia achar: ${t} → ${JSON.stringify(fala(t, o))}`)
const naoTem = (t, regra, o) => assert.ok(!regras(fala(t, o)).includes(regra), `${regra} não devia achar: ${t} → ${JSON.stringify(fala(t, o))}`)
const limpa = (t, o) => assert.deepEqual(fala(t, o), [], t)

describe('as frases do pedido', () => {
  test('as duas falas reprovam com erro, na fala e na tela', () => {
    for (const o of [{ fala: true }, { fala: false }]) {
      const a = revisar('O DJ pediu, tá no ar: três ajustes no editor.', o)
      assert.deepEqual(regras(a, 'erro'), ['revelacao'], JSON.stringify(a))
      assert.equal(a[0].frase, 'O DJ pediu, tá no ar: três ajustes no editor.')
      assert.match(a[0].oque_trocar, /single sentence, with the verb/)
      const b = revisar('Três pedidos, três no ar.', o)
      assert.deepEqual(regras(b, 'erro'), ['slogan'], JSON.stringify(b))
      assert.match(b[0].oque_trocar, /says what happened/)
    }
  })

  test('as reescritas passam sem erro nem aviso', () => {
    limpa('O DJ pediu três ajustes no editor do press kit, e os três já estão no ar.')
    limpa('Abre o editor do seu press kit e confere as três mudanças por lá.')
    limpa(['O DJ pediu três ajustes no editor do press kit, e os três já estão no ar.', 'Abre o editor do seu press kit e confere as três mudanças por lá.'])
  })

  test('nada de falso positivo bobo: dinheiro, hora, endereço, hífen e "não é caro"', () => {
    limpa('O plano custa R$ 1,50 por mês e a cobrança sai às 12:30 em ponto.')
    limpa('Acesse exemplo.com/7 pelo celular e cole o link do seu perfil.')
    limpa('A loja tem Wi-Fi de graça e a senha fica colada no balcão.')
    limpa('Não é caro, e você paga uma vez só no fim do mês.')
    limpa('O preço não é caro para quem toca toda semana na mesma casa.')
    assert.deepEqual(revisar(['R$ 1,50', '12:30', 'exemplo.com/7', 'Wi-Fi', '8h – 10h', 'Não é caro.']), [])
  })
})

describe('as regras do texto (tela e fala)', () => {
  test('travessão: — e " - " entre frases; hífen de palavra e faixa de número, não', () => {
    tem('O editor mudou — e agora salva sozinho enquanto você escreve o texto.', 'travessao')
    tem('O editor mudou - e agora salva sozinho enquanto você escreve o texto.', 'travessao')
    tem('O editor mudou – e agora salva sozinho enquanto você escreve o texto.', 'travessao')
    naoTem('O e-mail chega de 8–18 minutos depois, com o recibo do Wi-Fi anexado.', 'travessao')
    naoTem('A entrega sai entre 10 - 12 dias úteis para qualquer cidade do país.', 'travessao')
  })

  test('"não é X, é Y" e as variações (só, apenas, mas também, e sim): erro', () => {
    tem('Isso não é um bug do editor, é uma escolha de quem fez o press kit.', 'nao-e-x-e-y')
    tem('Não é só um link para mandar. É o seu press kit inteiro, pronto.', 'nao-e-x-e-y')
    tem('O campo não só limpa o link do perfil, mas também soma os seguidores.', 'nao-e-x-e-y')
    tem('Não toque em Salvar no canto de cima, e sim em Publicar.', 'nao-e-x-e-y')
    assert.equal(fala('Isso não é um bug do editor, é uma escolha de quem fez o press kit.')[0].nivel, 'erro')
    naoTem('Não é caro, e você paga uma vez só no fim do mês.', 'nao-e-x-e-y')
    naoTem('O link não é obrigatório para quem já mandou o arquivo pelo editor.', 'nao-e-x-e-y')
  })

  test('"não X, mas Y" é aviso: a ressalva de verdade passa a olho', () => {
    const a = fala('O envio não demora, mas precisa de internet para mandar o arquivo.')
    assert.deepEqual(a.map((x) => [x.nivel, x.regra]), [['aviso', 'nao-x-mas-y']])
    naoTem('O envio demora pouco e precisa de internet para mandar o arquivo.', 'nao-x-mas-y')
  })

  test('revelação com dois-pontos: na fala sempre; na tela, rótulo de uma palavra passa', () => {
    tem('Três coisas mudaram no editor: o mapa, o pagamento e o recibo.', 'revelacao')
    tem('Resultado: o press kit ficou pronto antes do show de sexta à noite.', 'revelacao')
    assert.deepEqual(revisar('Antes: 3 cliques'), [])
    assert.deepEqual(revisar('Novo link · Validade: 7 dias'), [])
    assert.deepEqual(regras(revisar('O que mudou no editor: três ajustes')), ['revelacao'])
    naoTem('A live começa às 21:30 e o link chega no seu e-mail antes disso.', 'revelacao')
    naoTem('Abra https://exemplo.com no celular e entre com o seu e-mail de sempre.', 'revelacao')
  })

  test('slogan: paralelo curto sem verbo, numa frase ou em duas; o bordão "simples assim"', () => {
    for (const t of ['Menos cliques, mais vendas.', 'Menos cliques. Mais vendas.', 'Seu link, sua cara.', 'Dois cliques, três segundos.', 'Sem planilha, sem erro, sem susto.', 'Simples assim.']) {
      assert.ok(regras(revisar(t), 'erro').includes('slogan'), t)
    }
    naoTem('Sem planilha e sem erro, você fecha o caixa do dia em cinco minutos.', 'slogan')
    naoTem('Abre o editor, abre a prévia e confere se a foto ficou no lugar.', 'slogan')
    assert.deepEqual(revisar('Acabou? Pede de novo.'), [])
    assert.deepEqual(revisar(['8h – 10h', '10h – 12h']), [])
  })

  test('enchimento: simplesmente, basicamente, na verdade, literalmente, realmente', () => {
    for (const w of ['simplesmente', 'basicamente', 'na verdade', 'literalmente', 'realmente']) {
      const a = fala(`O campo ${w} limpa o link do perfil que você colou do celular.`)
      assert.deepEqual(a.map((x) => [x.nivel, x.regra]), [['erro', 'enchimento']], w)
      assert.match(a[0].oque_trocar, new RegExp(`Remove "${w}"`))
    }
    naoTem('A verdade é que o campo limpa o link do perfil que você colou.', 'enchimento')
    naoTem('O real chega na conta no mesmo dia em que o show termina.', 'enchimento')
  })

  test('chamada vazia: vamos lá, bora, fica ligado; "embora" não', () => {
    tem('Vamos lá, abre o editor do press kit e toca em Personalizar agora.', 'chamada')
    tem('Bora abrir o editor do press kit e trocar a foto da capa hoje.', 'chamada')
    tem('Fica ligado que amanhã sai a segunda parte do editor do press kit.', 'chamada')
    naoTem('O editor salva sozinho, embora a prévia demore um pouco para carregar.', 'chamada')
  })
})

describe('as regras só da fala', () => {
  test('três frases curtas em fila: aviso; duas, não; e só na fala', () => {
    const a = fala('Rápido. Fácil. Pronto para o show.')
    assert.ok(a.some((x) => x.nivel === 'aviso' && x.regra === 'tres-curtas' && x.frase === 'Rápido. Fácil. Pronto para o show.'), JSON.stringify(a))
    naoTem('Diz o que tem na geladeira. Em segundos, a receita tá na tela.', 'tres-curtas')
    assert.ok(!regras(revisar('Rápido. Fácil. Pronto para o show.')).includes('tres-curtas'))
  })

  test('8 a 18 palavras: aviso fora disso; no tutorial só o teto', () => {
    tem('Toque em Salvar.', 'tamanho')
    naoTem('Toque em Salvar.', 'tamanho', { tutorial: true })
    const longa = 'O editor novo do press kit deixa você trocar a foto da capa, mudar as cores, escolher a fonte e publicar tudo sem sair da tela.'
    tem(longa, 'tamanho')
    tem(longa, 'tamanho', { tutorial: true })
    assert.match(fala(longa).find((x) => x.regra === 'tamanho').oque_trocar, /^26 words: split/)
    naoTem('O DJ pediu três ajustes no editor do press kit.', 'tamanho')
    assert.ok(!regras(revisar('Toque em Salvar.')).includes('tamanho'), 'na tela não')
  })

  test('lista falada de 3 itens ou mais: aviso para conferir a tela; dois itens, não', () => {
    const a = fala('Ele aceita Instagram, TikTok e YouTube no mesmo campo de links.')
    assert.deepEqual(a.map((x) => [x.nivel, x.regra]), [['aviso', 'lista-falada']])
    assert.match(a[0].oque_trocar, /3 items: check that each item appears on screen/)
    tem('Rápido, simples, seguro, do jeito que o seu time precisa no dia a dia.', 'lista-falada')
    naoTem('O campo aceita Instagram e TikTok, somados num total no alto da página.', 'lista-falada')
    naoTem('Oi, eu sou a apresentadora, da Marca, e hoje vou te mostrar o tema novo.', 'lista-falada')
  })

  test('150 palavras por minuto: estima o tempo e avisa o que cortar quando passa do planejado', () => {
    assert.equal(segundosDe(150), 60)
    assert.equal(segundosDe(15), 6)
    const t = 'O DJ pediu três ajustes no editor do press kit, e os três já estão no ar.'
    assert.deepEqual(fala(t, { segundos: 10 }), [])
    const a = fala([t, t], { segundos: 10 })
    assert.deepEqual(a.map((x) => [x.nivel, x.regra]), [['aviso', 'tempo']])
    assert.match(a[0].frase, /^34 words ≈ 13\.6 s/)
    assert.match(a[0].oque_trocar, /Cut about 9 words/)
  })

  test('a marcação de emoção ([warm], [pause]) não conta como palavra', () => {
    limpa('[warm] O DJ pediu três ajustes no editor do press kit, e os três já estão no ar.')
  })
})

describe('frases e arquivos', () => {
  test('frasesDe corta no ponto com maiúscula depois; reticências no meio, endereço e número não', () => {
    assert.deepEqual(frasesDe('Diz o que tem. Em segundos, tá na tela.'), ['Diz o que tem.', 'Em segundos, tá na tela.'])
    assert.deepEqual(frasesDe('Um tema… da Marca Mais. Acesse exemplo.com/7 por R$ 1,50.'), ['Um tema… da Marca Mais.', 'Acesse exemplo.com/7 por R$ 1,50.'])
  })

  const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'escrita-'))
  test('o texto da tela de JSON, md e js: com o lugar, sem nota, código, cor nem bloco de código', () => {
    const d = tmp()
    fs.writeFileSync(path.join(d, 'a.json'), JSON.stringify({ _sobre: 'Nota: não é texto da tela', cor: '#FF7900', css: '.a { color: red; }', cenas: [{ titulo: 'Seus números no press kit', linhas: ['Três pedidos, três no ar.'] }] }))
    assert.deepEqual(textosDoArquivo(path.join(d, 'a.json')), [{ onde: 'cenas[0].titulo', texto: 'Seus números no press kit' }, { onde: 'cenas[0].linhas[0]', texto: 'Três pedidos, três no ar.' }])
    fs.writeFileSync(path.join(d, 'b.md'), '# Roteiro\n\n| # | Tela |\n|---|---|\n| 1 | O DJ pediu, tá no ar: três ajustes |\n| 2 | — |\n\n```\nx: y z\n```\n')
    assert.deepEqual(textosDoArquivo(path.join(d, 'b.md')).map((t) => t.texto), ['O DJ pediu, tá no ar: três ajustes'])
    fs.writeFileSync(path.join(d, 'c.mjs'), "// comentário: não conta\ng.passo('Toque em Salvar — e pronto')\nconst x = `${a} b`\n")
    assert.deepEqual(textosDoArquivo(path.join(d, 'c.mjs')), [{ onde: 'line 2', texto: 'Toque em Salvar — e pronto' }])
  })

  test('a CLI: erro sai com código 1, a frase e o que trocar; texto limpo sai com 0', () => {
    const d = tmp()
    fs.writeFileSync(path.join(d, 'tela.json'), JSON.stringify({ cenas: [{ titulo: 'O DJ pediu, tá no ar: três ajustes no editor.' }, { titulo: 'Três pedidos, três no ar.' }] }))
    const r = spawnSync(process.execPath, [CLI, 'review', path.join(d, 'tela.json'), '--lang', 'pt'], { encoding: 'utf8' })
    assert.equal(r.status, 1, r.stdout + r.stderr)
    assert.match(r.stdout, /✗ cenas\[0\]\.titulo · error · reveal with a colon\n {4}"O DJ pediu, tá no ar: três ajustes no editor\."\n {4}→ /)
    assert.match(r.stdout, /cenas\[1\]\.titulo · error · slogan instead of the fact/)
    assert.match(r.stdout, /2 text\(s\) · 2 error\(s\) · 0 warning\(s\)/)
    const ok = spawnSync(process.execPath, [CLI, 'review', '--text', 'Abre o editor do seu press kit e confere as três mudanças por lá.', '--lang', 'pt'], { encoding: 'utf8' })
    assert.equal(ok.status, 0, ok.stdout + ok.stderr)
    assert.match(ok.stdout, /✓ 1 text\(s\) · 0 error\(s\) · 0 warning\(s\)/)
    const j = spawnSync(process.execPath, [CLI, 'review', '--text', 'Três pedidos, três no ar.', '--json', '--lang', 'pt'], { encoding: 'utf8' })
    assert.deepEqual(JSON.parse(j.stdout).map((x) => [x.onde, x.nivel, x.regra]), [['text', 'erro', 'slogan']])
    const uso = spawnSync(process.execPath, [CLI, 'review'], { encoding: 'utf8' })
    assert.equal(uso.status, 1)
    assert.match(uso.stderr, /usage: node writing\.mjs review/)
  })

  test('o slogan declarado da marca (marca.slogan, ou --accept) passa; o mesmo texto sem ele reprova', () => {
    const d = tmp()
    const tela = { marca: { slogan: 'Seu som. Sua cena. Seu link.' }, dados: { fecho: { bordao: 'Seu som. Sua cena. *Seu link.*' }, titulo: 'Três pedidos, três no ar.' } }
    fs.writeFileSync(path.join(d, 'com.json'), JSON.stringify(tela))
    const r = spawnSync(process.execPath, [CLI, 'review', path.join(d, 'com.json'), '--lang', 'pt'], { encoding: 'utf8' })
    assert.equal(r.status, 1, 'o slogan inventado continua reprovando')
    assert.doesNotMatch(r.stdout, /Seu som/)
    assert.match(r.stdout, /1 text\(s\) · 1 error\(s\) · 0 warning\(s\) · 2 accepted on purpose/)
    fs.writeFileSync(path.join(d, 'sem.json'), JSON.stringify({ dados: { bordao: 'Seu som. Sua cena. *Seu link.*' } }))
    const sem = spawnSync(process.execPath, [CLI, 'review', path.join(d, 'sem.json'), '--lang', 'pt'], { encoding: 'utf8' })
    assert.equal(sem.status, 1)
    assert.match(sem.stdout, /dados\.bordao · error · slogan instead of the fact/)
    const aceito = spawnSync(process.execPath, [CLI, 'review', path.join(d, 'sem.json'), '--accept', 'Seu som. Sua cena. Seu link.', '--lang', 'pt'], { encoding: 'utf8' })
    assert.equal(aceito.status, 0, aceito.stdout + aceito.stderr)
    assert.match(aceito.stdout, /✓ 0 text\(s\) · 0 error\(s\) · 0 warning\(s\) · 1 accepted on purpose/)
  })
})

describe('o idioma', () => {
  test('o padrão é inglês: pontuação e tamanho valem; as regras de expressão só com idioma pt', () => {
    assert.deepEqual(revisarTexto('Fewer clicks, more sales.'), [])
    assert.deepEqual(revisarTexto('Três pedidos, três no ar.'), [], 'slogan é regra do português')
    assert.deepEqual(regras(revisarTexto('Três pedidos, três no ar.', { idioma: 'pt' })), ['slogan'])
    assert.deepEqual(regras(revisarTexto('Three things changed in the editor: the map, the payment and the receipt.')), ['revelacao'])
    assert.deepEqual(regras(revisarTexto('The editor changed — and now it saves on its own while you type.')), ['travessao'])
    const f = revisarTexto('The new press kit editor lets you change the cover photo, the colors, the font and publish it all without leaving the screen.', { fala: true })
    assert.deepEqual(regras(f), ['tamanho', 'lista-falada'])
  })

  test('a CLI sem --lang revisa em inglês; --lang sem valor diz o que passar', () => {
    const r = spawnSync(process.execPath, [CLI, 'review', '--text', 'Três pedidos, três no ar.'], { encoding: 'utf8' })
    assert.equal(r.status, 0, r.stdout + r.stderr)
    assert.match(r.stdout, /✓ 1 text\(s\) · 0 error\(s\) · 0 warning\(s\)/)
    const sem = spawnSync(process.execPath, [CLI, 'review', '--text', 'Três pedidos, três no ar.', '--lang'], { encoding: 'utf8' })
    assert.equal(sem.status, 1)
    assert.match(sem.stderr, /--lang needs a language code, e\.g\. --lang pt/)
  })
})
